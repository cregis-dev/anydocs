import test, { afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  appendAuditEntry,
  listAuditShardDates,
  pruneAuditShards,
  readAuditShard,
  AUDIT_RETENTION_DAYS,
} from '../src/fs/audit-repository.ts';
import { ValidationError } from '../src/errors/validation-error.ts';
import type { AuditEntry } from '../src/types/audit.ts';

let auditRoot: string;

beforeEach(async () => {
  auditRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'anydocs-audit-prune-'));
});

afterEach(async () => {
  await fs.rm(auditRoot, { recursive: true, force: true });
});

const NOW = new Date('2026-06-12T10:00:00.000Z');

/** ISO timestamp `days` before NOW (UTC). */
function daysBefore(days: number): string {
  const d = new Date(NOW);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

function entry(overrides: Partial<AuditEntry> = {}): AuditEntry {
  return {
    schemaVersion: 1,
    id: 'e',
    timestamp: NOW.toISOString(),
    scope: 'page',
    operation: 'update',
    status: 'committed',
    projectId: 'starter-docs',
    target: { resourceKind: 'page', pageId: 'intro' },
    actor: { kind: 'agent', agentProvider: 'ref' },
    runtimeMode: 'web',
    ...overrides,
  };
}

const pruneOpts = { projectId: 'starter-docs', runtimeMode: 'web' as const, now: NOW };

test('prunes shards older than the retention window and appends a system summary entry', async () => {
  await appendAuditEntry(auditRoot, entry({ id: 'ancient', timestamp: daysBefore(400) }));
  await appendAuditEntry(auditRoot, entry({ id: 'old', timestamp: daysBefore(40) }));
  await appendAuditEntry(auditRoot, entry({ id: 'recent', timestamp: daysBefore(5) }));

  const result = await pruneAuditShards(auditRoot, { ...pruneOpts, entryId: 'prune-1' });

  // older-than-30-days shards pruned (ascending)
  assert.deepEqual(result.prunedDates, [daysBefore(400).slice(0, 10), daysBefore(40).slice(0, 10)]);
  assert.equal(result.retentionDays, 30);
  assert.equal(result.auditEntryId, 'prune-1');

  // pruned shards gone; recent shard survives
  const remaining = await listAuditShardDates(auditRoot);
  assert.ok(!remaining.includes(daysBefore(400).slice(0, 10)));
  assert.ok(!remaining.includes(daysBefore(40).slice(0, 10)));
  assert.ok(remaining.includes(daysBefore(5).slice(0, 10)));

  // system summary entry appended into NOW's shard and itself survives
  const todayShard = await readAuditShard(auditRoot, NOW);
  const summary = todayShard.find((e) => e.id === 'prune-1');
  assert.ok(summary);
  assert.equal(summary.operation, 'structural');
  assert.equal(summary.actor.kind, 'system');
  assert.equal(summary.scope, 'workspace');
  assert.match(summary.diff?.summary ?? '', /Pruned 2 audit shard\(s\) older than 30 days/);
});

test('a project under the retention window is a no-op (nothing deleted, no entry)', async () => {
  await appendAuditEntry(auditRoot, entry({ id: 'recent', timestamp: daysBefore(5) }));
  const before = await listAuditShardDates(auditRoot);

  const result = await pruneAuditShards(auditRoot, pruneOpts);

  assert.deepEqual(result.prunedDates, []);
  assert.equal(result.auditEntryId, undefined);
  assert.deepEqual(await listAuditShardDates(auditRoot), before);
  // no system entry was appended
  const todayShard = await readAuditShard(auditRoot, new Date(daysBefore(5)));
  assert.equal(todayShard.length, 1);
  assert.equal(todayShard[0].id, 'recent');
});

test('a shard exactly retentionDays old is kept (retention is ">= N days")', async () => {
  await appendAuditEntry(auditRoot, entry({ id: 'boundary', timestamp: daysBefore(30) }));
  const result = await pruneAuditShards(auditRoot, pruneOpts);
  assert.deepEqual(result.prunedDates, []);
  assert.ok((await listAuditShardDates(auditRoot)).includes(daysBefore(30).slice(0, 10)));
});

test('custom retentionDays narrows the window', async () => {
  await appendAuditEntry(auditRoot, entry({ id: 'd10', timestamp: daysBefore(10) }));
  await appendAuditEntry(auditRoot, entry({ id: 'd3', timestamp: daysBefore(3) }));

  const result = await pruneAuditShards(auditRoot, { ...pruneOpts, retentionDays: 7, entryId: 'p' });
  assert.deepEqual(result.prunedDates, [daysBefore(10).slice(0, 10)]);
  assert.equal(result.retentionDays, 7);
});

test('invalid retentionDays throws ValidationError', async () => {
  await assert.rejects(() => pruneAuditShards(auditRoot, { ...pruneOpts, retentionDays: -1 }), (e) => e instanceof ValidationError);
  await assert.rejects(() => pruneAuditShards(auditRoot, { ...pruneOpts, retentionDays: 2.5 }), (e) => e instanceof ValidationError);
});

test('AUDIT_RETENTION_DAYS is 30', () => {
  assert.equal(AUDIT_RETENTION_DAYS, 30);
});
