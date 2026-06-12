import test, { afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  appendAuditEntry,
  auditShardFileName,
  listAuditShardDates,
  readAuditShard,
} from '../src/fs/audit-repository.ts';
import type { AuditEntry } from '../src/types/audit.ts';

let auditRoot: string;

beforeEach(async () => {
  auditRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'anydocs-audit-'));
});

afterEach(async () => {
  await fs.rm(auditRoot, { recursive: true, force: true });
});

function entry(overrides: Partial<AuditEntry> = {}): AuditEntry {
  return {
    schemaVersion: 1,
    id: '01J0000000000000000000000A',
    timestamp: '2026-06-12T10:00:00.000Z',
    scope: 'page',
    operation: 'update',
    status: 'committed',
    projectId: 'starter-docs',
    target: { resourceKind: 'page', pageId: 'intro' },
    actor: { kind: 'human' },
    runtimeMode: 'web',
    ...overrides,
  };
}

test('auditShardFileName derives YYYY-MM-DD.ndjson from UTC', () => {
  assert.equal(auditShardFileName(new Date('2026-06-12T10:00:00.000Z')), '2026-06-12.ndjson');
  // late-UTC instant stays on its UTC day regardless of host tz
  assert.equal(auditShardFileName(new Date('2026-01-05T23:59:59.000Z')), '2026-01-05.ndjson');
});

test('append creates the audit dir + shard and round-trips the entry', async () => {
  const e = entry();
  await appendAuditEntry(auditRoot, e);

  const dates = await listAuditShardDates(auditRoot);
  assert.deepEqual(dates, ['2026-06-12']);

  const read = await readAuditShard(auditRoot, new Date(e.timestamp));
  assert.equal(read.length, 1);
  assert.deepEqual(read[0], e);
});

test('same-day appends accumulate in order on one shard', async () => {
  const a = entry({ id: 'A', timestamp: '2026-06-12T08:00:00.000Z' });
  const b = entry({ id: 'B', timestamp: '2026-06-12T09:00:00.000Z' });
  await appendAuditEntry(auditRoot, a);
  await appendAuditEntry(auditRoot, b);

  const read = await readAuditShard(auditRoot, new Date('2026-06-12T00:00:00.000Z'));
  assert.deepEqual(
    read.map((r) => r.id),
    ['A', 'B'],
  );
  assert.deepEqual(await listAuditShardDates(auditRoot), ['2026-06-12']);
});

test('cross-day entries route to separate shards; listing is sorted', async () => {
  await appendAuditEntry(auditRoot, entry({ id: 'jun', timestamp: '2026-06-12T10:00:00.000Z' }));
  await appendAuditEntry(auditRoot, entry({ id: 'jan', timestamp: '2026-01-05T10:00:00.000Z' }));

  assert.deepEqual(await listAuditShardDates(auditRoot), ['2026-01-05', '2026-06-12']);
  assert.equal((await readAuditShard(auditRoot, new Date('2026-01-05T00:00:00Z')))[0].id, 'jan');
  assert.equal((await readAuditShard(auditRoot, new Date('2026-06-12T00:00:00Z')))[0].id, 'jun');
});

test('reading a missing shard returns []', async () => {
  const read = await readAuditShard(auditRoot, new Date('2099-12-31T00:00:00.000Z'));
  assert.deepEqual(read, []);
});

test('listing shard dates on a missing audit dir returns []', async () => {
  const missing = path.join(auditRoot, 'does-not-exist');
  assert.deepEqual(await listAuditShardDates(missing), []);
});

test('an invalid entry is rejected before any file is written', async () => {
  const bad = { ...entry(), scope: 'global' } as unknown as AuditEntry;
  await assert.rejects(() => appendAuditEntry(auditRoot, bad));
  // nothing persisted
  assert.deepEqual(await listAuditShardDates(auditRoot), []);
});
