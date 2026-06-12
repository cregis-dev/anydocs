import fs from 'node:fs/promises';
import path from 'node:path';

import { assertValidAuditEntry } from '../schemas/audit-entry-schema.ts';
import type { AuditEntry } from '../types/audit.ts';

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
