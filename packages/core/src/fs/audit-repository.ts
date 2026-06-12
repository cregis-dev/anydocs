import fs from 'node:fs/promises';
import path from 'node:path';

import { ValidationError } from '../errors/validation-error.ts';
import type { RuntimeMode } from '../runtime/runtime-mode.ts';
import { assertValidAuditEntry } from '../schemas/audit-entry-schema.ts';
import { AUDIT_SCHEMA_VERSION, type AuditEntry } from '../types/audit.ts';

/**
 * Daily-sharded, append-only NDJSON audit repository.
 *
 * Storage: `<auditRoot>/YYYY-MM-DD.ndjson` (one entry per line). The shard date
 * is derived from the entry's own `timestamp` (UTC), not wall-clock, so replays
 * and backfills are deterministic. See architecture.md §"Audit Log Architecture".
 *
 * This module provides durable append + foundational reads. The write-ahead
 * lifecycle (Story 10.3) and the filtered/paginated query API (Story 10.4) build
 * on top of it.
 */

const SHARD_FILE_RE = /^(\d{4}-\d{2}-\d{2})\.ndjson$/;

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

/** `YYYY-MM-DD.ndjson` from the UTC components of `date`. */
export function auditShardFileName(date: Date): string {
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}.ndjson`;
}

export function auditShardPath(auditRoot: string, date: Date): string {
  return path.join(auditRoot, auditShardFileName(date));
}

function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}

/**
 * Validate (Story 10.1) and durably append an audit entry to its day's shard.
 * Creates the audit directory on first write. The entry is written as a single
 * complete newline-terminated JSON line.
 */
export async function appendAuditEntry(auditRoot: string, entry: AuditEntry): Promise<void> {
  // Validate BEFORE any filesystem mutation — never persist a malformed entry.
  assertValidAuditEntry(entry);

  const shardPath = auditShardPath(auditRoot, new Date(entry.timestamp));
  await fs.mkdir(auditRoot, { recursive: true });
  await fs.appendFile(shardPath, `${JSON.stringify(entry)}\n`, 'utf8');
}

/**
 * Atomically replace a day's shard with `entries` (write-temp-then-rename).
 * Used by the write-ahead lifecycle service (Story 10.3) to update an entry's
 * status in place. An empty `entries` array removes the shard.
 */
export async function overwriteAuditShard(
  auditRoot: string,
  date: Date,
  entries: AuditEntry[],
): Promise<void> {
  const shardPath = auditShardPath(auditRoot, date);
  if (entries.length === 0) {
    await fs.rm(shardPath, { force: true });
    return;
  }
  await fs.mkdir(auditRoot, { recursive: true });
  const tempPath = `${shardPath}.${process.pid}.${Date.now()}.tmp`;
  const body = `${entries.map((entry) => JSON.stringify(entry)).join('\n')}\n`;
  await fs.writeFile(tempPath, body, 'utf8');
  await fs.rename(tempPath, shardPath);
}

/**
 * Read a single day's shard into entries. A missing shard yields `[]` (not an
 * error). Foundational read for Story 10.4's query API.
 */
export async function readAuditShard(auditRoot: string, date: Date): Promise<AuditEntry[]> {
  let raw: string;
  try {
    raw = await fs.readFile(auditShardPath(auditRoot, date), 'utf8');
  } catch (error) {
    if (isErrnoException(error) && error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
  return raw
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as AuditEntry);
}

/**
 * List available shard dates (`YYYY-MM-DD`), sorted ascending. A missing audit
 * directory yields `[]`.
 */
export async function listAuditShardDates(auditRoot: string): Promise<string[]> {
  let files: string[];
  try {
    files = await fs.readdir(auditRoot);
  } catch (error) {
    if (isErrnoException(error) && error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
  return files
    .map((file) => SHARD_FILE_RE.exec(file)?.[1])
    .filter((date): date is string => date !== undefined)
    .sort();
}

/** Default audit retention window (NFR30: ≥ 30 days). */
export const AUDIT_RETENTION_DAYS = 30;

export type PruneAuditOptions = {
  /** Project id for the system summary entry (required entry field). */
  projectId: string;
  /** Runtime mode for the system summary entry (required entry field). */
  runtimeMode: RuntimeMode;
  /** Retention window in days; shards strictly older than this are pruned. Defaults to 30. */
  retentionDays?: number;
  /** Reference "now"; defaults to the current time. Overridable for deterministic tests. */
  now?: Date;
  /** Id for the system summary entry; defaults to `system-prune-<now ISO>`. */
  entryId?: string;
};

export type PruneAuditResult = {
  /** Shard dates (`YYYY-MM-DD`) that were deleted, ascending. */
  prunedDates: string[];
  /** The retention window applied. */
  retentionDays: number;
  /** The cutoff date (`YYYY-MM-DD`): shards strictly before this were pruned. */
  cutoff: string;
  /** Id of the appended system summary entry; present only when ≥1 shard was pruned. */
  auditEntryId?: string;
};

/**
 * Delete daily shards older than the retention window (NFR30, default ≥ 30 days)
 * and, when anything was pruned, append a single system `structural` audit entry
 * summarizing the prune. A shard exactly `retentionDays` old (on the cutoff date)
 * is KEPT. Under-retention projects are a no-op: nothing deleted, nothing appended.
 *
 * The summary entry lands in `now`'s shard (always within retention), so it is
 * never self-pruned in the same run. The audit log has no dedicated resourceKind,
 * so the project-level prune records `target.resourceKind: 'project-config'`.
 */
export async function pruneAuditShards(
  auditRoot: string,
  options: PruneAuditOptions,
): Promise<PruneAuditResult> {
  const retentionDays = options.retentionDays ?? AUDIT_RETENTION_DAYS;
  if (!Number.isInteger(retentionDays) || retentionDays < 0) {
    throw new ValidationError('Audit retention window must be a non-negative integer number of days.', {
      entity: 'audit-prune',
      rule: 'audit-retention-days-must-be-non-negative-integer',
      remediation: 'Pass retentionDays as a whole number ≥ 0 (defaults to 30).',
      metadata: { retentionDays },
    });
  }

  const now = options.now ?? new Date();
  const cutoff = new Date(now);
  cutoff.setUTCDate(cutoff.getUTCDate() - retentionDays);
  const cutoffKey = auditShardFileName(cutoff).slice(0, 'YYYY-MM-DD'.length);

  const dates = await listAuditShardDates(auditRoot);
  const prunedDates = dates.filter((date) => date < cutoffKey);
  const base: PruneAuditResult = { prunedDates, retentionDays, cutoff: cutoffKey };
  if (prunedDates.length === 0) {
    return base;
  }

  for (const date of prunedDates) {
    // Empty entries → overwriteAuditShard removes the shard file (Story 10.3 primitive).
    await overwriteAuditShard(auditRoot, new Date(`${date}T00:00:00.000Z`), []);
  }

  const entry: AuditEntry = {
    schemaVersion: AUDIT_SCHEMA_VERSION,
    id: options.entryId ?? `system-prune-${now.toISOString()}`,
    timestamp: now.toISOString(),
    scope: 'workspace',
    operation: 'structural',
    status: 'committed',
    projectId: options.projectId,
    target: { resourceKind: 'project-config' },
    actor: { kind: 'system' },
    runtimeMode: options.runtimeMode,
    diff: {
      summary: `Pruned ${prunedDates.length} audit shard(s) older than ${retentionDays} days (cutoff ${cutoffKey}): ${prunedDates.join(', ')}`,
    },
  };
  await appendAuditEntry(auditRoot, entry); // validates before persistence

  return { ...base, auditEntryId: entry.id };
}
