import { ValidationError } from '../errors/validation-error.ts';
import {
  appendAuditEntry,
  auditShardFileName,
  listAuditShardDates,
  overwriteAuditShard,
  readAuditShard,
} from '../fs/audit-repository.ts';
import { assertValidAuditEntry } from '../schemas/audit-entry-schema.ts';
import type { AuditEntry, AuditQuery, AuditQueryResult } from '../types/audit.ts';

/**
 * Write-ahead audit lifecycle service (`pending → committed | rejected`).
 *
 * The audit log is append-only NDJSON, but a lifecycle transition mutates one
 * logical entry's status. This service therefore performs an atomic
 * read-modify-rewrite of the small daily shard (via `overwriteAuditShard`),
 * keeping one line per logical entry. Safe under the Phase 2 single-writer
 * model. See architecture.md §"Write-Ahead Audit Integration".
 */

function shardDate(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

function notFound(id: string): never {
  throw new ValidationError(`No audit entry found for id "${id}".`, {
    entity: 'audit-entry',
    rule: 'audit-entry-must-exist-for-status-update',
    remediation: 'Only call markCommitted/markRejected with an id returned by persistPending.',
    metadata: { id },
  });
}

/**
 * Durably persist a `pending` audit entry BEFORE any content write. Returns the
 * entry id for follow-up commit/rejection. Forces `status: 'pending'`.
 */
export async function persistPending(auditRoot: string, entry: AuditEntry): Promise<string> {
  const pending: AuditEntry = { ...entry, status: 'pending' };
  await appendAuditEntry(auditRoot, pending); // validates before persistence
  return pending.id;
}

/**
 * Locate the entry by id (scanning shards newest-first — a transition almost
 * always targets the just-persisted pending entry), apply `updater`, re-validate,
 * and atomically rewrite that shard. Throws if the id is not found.
 */
async function updateEntryStatus(
  auditRoot: string,
  id: string,
  updater: (entry: AuditEntry) => AuditEntry,
): Promise<AuditEntry> {
  const dates = await listAuditShardDates(auditRoot);
  for (const date of [...dates].reverse()) {
    const shardKey = shardDate(date);
    const entries = await readAuditShard(auditRoot, shardKey);
    const index = entries.findIndex((entry) => entry.id === id);
    if (index === -1) {
      continue;
    }
    const updated = updater(entries[index]);
    assertValidAuditEntry(updated);
    const next = [...entries];
    next[index] = updated;
    await overwriteAuditShard(auditRoot, shardKey, next);
    return updated;
  }
  return notFound(id);
}

/**
 * Locate an audit entry by id, scanning shards newest-first (a lookup target —
 * e.g. a rollback — is usually recent). Returns `undefined` if no shard contains
 * the id. Read-only.
 */
export async function findAuditEntry(
  auditRoot: string,
  id: string,
): Promise<AuditEntry | undefined> {
  const dates = await listAuditShardDates(auditRoot);
  for (const date of [...dates].reverse()) {
    const entries = await readAuditShard(auditRoot, shardDate(date));
    const found = entries.find((entry) => entry.id === id);
    if (found) {
      return found;
    }
  }
  return undefined;
}

/** Update the entry to `committed`. */
export async function markCommitted(auditRoot: string, id: string): Promise<AuditEntry> {
  return updateEntryStatus(auditRoot, id, (entry) => ({ ...entry, status: 'committed' }));
}

/** Update the entry to `rejected` and record the reason. */
export async function markRejected(
  auditRoot: string,
  id: string,
  reason: string,
): Promise<AuditEntry> {
  return updateEntryStatus(auditRoot, id, (entry) => ({
    ...entry,
    status: 'rejected',
    rejectionReason: reason,
  }));
}

export type WriteAheadResult<T> = {
  id: string;
  result: T;
  entry: AuditEntry;
};

/**
 * Run the architecture's write-ahead sequence around a content-write callback:
 * persist a pending audit record, run the content write, then commit on success
 * or reject (and re-throw) on failure. The "content rolled back / never
 * partially applied" guarantee holds by ORDERING — the content write is the only
 * content mutation and either succeeds (→ committed) or throws (→ rejected, no
 * committed content). Partial-write atomicity of the content itself is the
 * content-repository's responsibility (temp-then-rename).
 */
export async function runWriteAhead<T>(
  auditRoot: string,
  entry: AuditEntry,
  applyContentWrite: () => Promise<T>,
): Promise<WriteAheadResult<T>> {
  const id = await persistPending(auditRoot, entry);
  try {
    const result = await applyContentWrite();
    const committed = await markCommitted(auditRoot, id);
    return { id, result, entry: committed };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    // Best-effort rejection record: a failure to mark-rejected (e.g. a corrupt
    // or removed shard) must NOT mask the original content-write error, which is
    // the real root cause the caller needs to see.
    try {
      await markRejected(auditRoot, id, reason);
    } catch {
      // swallow — the original `error` below is the one that matters
    }
    throw error;
  }
}

const DEFAULT_QUERY_LIMIT = 50;

function paginationError(message: string, metadata: Record<string, unknown>): never {
  throw new ValidationError(message, {
    entity: 'audit-query',
    rule: 'audit-query-pagination-must-be-valid',
    remediation: 'limit must be a positive integer, offset a non-negative integer, from/to valid ISO timestamps.',
    metadata,
  });
}

const SHARD_DATE_KEY_LENGTH = 10; // "YYYY-MM-DD"

/** UTC `YYYY-MM-DD` for an ISO timestamp (the shard key it would land in). */
function utcDateKey(iso: string): string {
  // auditShardFileName → "YYYY-MM-DD.ndjson"; take the date prefix.
  return auditShardFileName(new Date(iso)).slice(0, SHARD_DATE_KEY_LENGTH);
}

/**
 * Filtered, reverse-chronological, paginated read over the audit log
 * (Story 10.4, architecture.md §"Query API"). Read-only — performs no writes.
 *
 * Only the daily shards whose UTC date intersects the requested `from`/`to`
 * range are read; entries are filtered in memory (AND semantics), sorted
 * `timestamp` desc then `id` desc (stable ULID tiebreak), then sliced by
 * `offset`/`limit`. `total` is the pre-pagination match count.
 */
export async function query(auditRoot: string, filter: AuditQuery = {}): Promise<AuditQueryResult> {
  const limit = filter.limit ?? DEFAULT_QUERY_LIMIT;
  const offset = filter.offset ?? 0;
  // Pagination is unbounded by design: the audit log is local, single-writer and
  // Phase 2 sized, so a caller-chosen `limit` is trusted (no upper clamp).
  if (!Number.isInteger(limit) || limit <= 0) {
    paginationError('Audit query "limit" must be a positive integer.', { limit });
  }
  if (!Number.isInteger(offset) || offset < 0) {
    paginationError('Audit query "offset" must be a non-negative integer.', { offset });
  }
  if (filter.from !== undefined && Number.isNaN(Date.parse(filter.from))) {
    paginationError('Audit query "from" must be a valid ISO 8601 timestamp.', { from: filter.from });
  }
  if (filter.to !== undefined && Number.isNaN(Date.parse(filter.to))) {
    paginationError('Audit query "to" must be a valid ISO 8601 timestamp.', { to: filter.to });
  }

  // Shard pruning: read only the shards whose UTC date intersects [from, to].
  const fromKey = filter.from !== undefined ? utcDateKey(filter.from) : undefined;
  const toKey = filter.to !== undefined ? utcDateKey(filter.to) : undefined;
  const dates = (await listAuditShardDates(auditRoot)).filter(
    (date) => (fromKey === undefined || date >= fromKey) && (toKey === undefined || date <= toKey),
  );

  // Numeric bounds — robust to ISO format/precision differences between the
  // caller's bounds and the stored timestamps (string compare is not).
  const fromMs = filter.from !== undefined ? Date.parse(filter.from) : undefined;
  const toMs = filter.to !== undefined ? Date.parse(filter.to) : undefined;

  // Decorate with the parsed timestamp ONCE (Schwartzian transform) — avoids
  // O(n log n) re-parsing in the sort comparator and lets range + sort share it.
  const matched: Array<{ entry: AuditEntry; ms: number }> = [];
  for (const date of dates) {
    const entries = await readAuditShard(auditRoot, shardDate(date));
    for (const entry of entries) {
      if (!matchesFilter(entry, filter)) {
        continue;
      }
      const ms = Date.parse(entry.timestamp);
      // Range bounds compared numerically; a NaN (corrupt) timestamp cannot
      // satisfy a bounded range, so exclude it when a bound is present.
      if (fromMs !== undefined && !(ms >= fromMs)) continue;
      if (toMs !== undefined && !(ms <= toMs)) continue;
      matched.push({ entry, ms });
    }
  }

  matched.sort((a, b) => {
    // Reverse chronological. A NaN (corrupt) timestamp sorts deterministically
    // to the end rather than producing an undefined ordering.
    const aNaN = Number.isNaN(a.ms);
    const bNaN = Number.isNaN(b.ms);
    if (aNaN || bNaN) {
      if (aNaN && bNaN) return idDesc(a.entry.id, b.entry.id);
      return aNaN ? 1 : -1;
    }
    if (a.ms !== b.ms) {
      return b.ms - a.ms;
    }
    return idDesc(a.entry.id, b.entry.id); // ULID tiebreak, descending
  });

  const total = matched.length;
  const entries = matched.slice(offset, offset + limit).map((m) => m.entry);
  return { entries, total, hasMore: offset + entries.length < total };
}

/** Compare ids descending (ULID lexical order = creation order). */
function idDesc(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? 1 : -1;
}

function matchesFilter(entry: AuditEntry, filter: AuditQuery): boolean {
  if (filter.scope !== undefined && entry.scope !== filter.scope) return false;
  if (filter.status !== undefined && entry.status !== filter.status) return false;
  if (filter.operation !== undefined && entry.operation !== filter.operation) return false;
  if (filter.actorKind !== undefined && entry.actor.kind !== filter.actorKind) return false;
  if (filter.resourceKind !== undefined && entry.target.resourceKind !== filter.resourceKind) return false;
  if (filter.pageId !== undefined && entry.target.pageId !== filter.pageId) return false;
  if (filter.projectId !== undefined && entry.projectId !== filter.projectId) return false;
  return true;
}
