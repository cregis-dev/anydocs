import { ValidationError } from '../errors/validation-error.ts';
import {
  appendAuditEntry,
  listAuditShardDates,
  overwriteAuditShard,
  readAuditShard,
} from '../fs/audit-repository.ts';
import { assertValidAuditEntry } from '../schemas/audit-entry-schema.ts';
import type { AuditEntry } from '../types/audit.ts';

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
    await markRejected(auditRoot, id, reason);
    throw error;
  }
}
