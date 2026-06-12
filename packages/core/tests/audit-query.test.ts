import test, { afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { query } from '../src/services/audit-log-service.ts';
import { appendAuditEntry } from '../src/fs/audit-repository.ts';
import { ValidationError } from '../src/errors/validation-error.ts';
import type { AuditEntry } from '../src/types/audit.ts';

let auditRoot: string;

beforeEach(async () => {
  auditRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'anydocs-audit-query-'));
});

afterEach(async () => {
  await fs.rm(auditRoot, { recursive: true, force: true });
});

function entry(overrides: Partial<AuditEntry> = {}): AuditEntry {
  return {
    schemaVersion: 1,
    id: 'id-1',
    timestamp: '2026-06-12T10:00:00.000Z',
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

/** Seed a spread of entries across two UTC days with varied axes. */
async function seedSpread(): Promise<void> {
  await appendAuditEntry(auditRoot, entry({ id: 'a', timestamp: '2026-06-11T08:00:00.000Z', scope: 'inline', status: 'pending', operation: 'create', actor: { kind: 'human' }, target: { resourceKind: 'block', pageId: 'intro', blockId: 'b1' } }));
  await appendAuditEntry(auditRoot, entry({ id: 'b', timestamp: '2026-06-11T20:00:00.000Z', scope: 'page', status: 'committed', operation: 'update', target: { resourceKind: 'page', pageId: 'guide' } }));
  await appendAuditEntry(auditRoot, entry({ id: 'c', timestamp: '2026-06-12T09:00:00.000Z', scope: 'workspace', status: 'rejected', operation: 'delete', projectId: 'other-docs', actor: { kind: 'system' }, target: { resourceKind: 'navigation', navigationId: 'nav' } }));
  await appendAuditEntry(auditRoot, entry({ id: 'd', timestamp: '2026-06-12T15:00:00.000Z', scope: 'page', status: 'committed', operation: 'update', target: { resourceKind: 'page', pageId: 'intro' } }));
}

test('empty audit dir yields an empty paginated result', async () => {
  const res = await query(auditRoot);
  assert.deepEqual(res, { entries: [], total: 0, hasMore: false });
});

test('single-axis filters return exactly the matching subset', async () => {
  await seedSpread();
  assert.deepEqual((await query(auditRoot, { scope: 'page' })).entries.map((e) => e.id), ['d', 'b']);
  assert.deepEqual((await query(auditRoot, { status: 'committed' })).entries.map((e) => e.id), ['d', 'b']);
  assert.deepEqual((await query(auditRoot, { operation: 'delete' })).entries.map((e) => e.id), ['c']);
  assert.deepEqual((await query(auditRoot, { actorKind: 'system' })).entries.map((e) => e.id), ['c']);
  assert.deepEqual((await query(auditRoot, { resourceKind: 'page' })).entries.map((e) => e.id), ['d', 'b']);
  assert.deepEqual((await query(auditRoot, { pageId: 'intro' })).entries.map((e) => e.id), ['d', 'a']);
  assert.deepEqual((await query(auditRoot, { projectId: 'other-docs' })).entries.map((e) => e.id), ['c']);
});

test('combined filters apply AND semantics', async () => {
  await seedSpread();
  const res = await query(auditRoot, { scope: 'page', status: 'committed', pageId: 'intro' });
  assert.deepEqual(res.entries.map((e) => e.id), ['d']);
});

test('timestamp range is inclusive across multiple days', async () => {
  await seedSpread();
  // [2026-06-11T20:00, 2026-06-12T09:00] inclusive → b and c
  const res = await query(auditRoot, { from: '2026-06-11T20:00:00.000Z', to: '2026-06-12T09:00:00.000Z' });
  assert.deepEqual(res.entries.map((e) => e.id), ['c', 'b']);
});

test('open-ended ranges work (only from / only to)', async () => {
  await seedSpread();
  assert.deepEqual((await query(auditRoot, { from: '2026-06-12T00:00:00.000Z' })).entries.map((e) => e.id), ['d', 'c']);
  assert.deepEqual((await query(auditRoot, { to: '2026-06-11T23:59:59.999Z' })).entries.map((e) => e.id), ['b', 'a']);
});

test('results are reverse-chronological with id-desc tiebreak for equal timestamps', async () => {
  const ts = '2026-06-12T12:00:00.000Z';
  await appendAuditEntry(auditRoot, entry({ id: 'aaa', timestamp: ts }));
  await appendAuditEntry(auditRoot, entry({ id: 'ccc', timestamp: ts }));
  await appendAuditEntry(auditRoot, entry({ id: 'bbb', timestamp: ts }));
  const res = await query(auditRoot);
  assert.deepEqual(res.entries.map((e) => e.id), ['ccc', 'bbb', 'aaa']);
});

test('pagination slices with correct total and hasMore', async () => {
  await seedSpread(); // 4 entries
  const page1 = await query(auditRoot, { limit: 2, offset: 0 });
  assert.deepEqual(page1.entries.map((e) => e.id), ['d', 'c']);
  assert.equal(page1.total, 4);
  assert.equal(page1.hasMore, true);

  const page2 = await query(auditRoot, { limit: 2, offset: 2 });
  assert.deepEqual(page2.entries.map((e) => e.id), ['b', 'a']);
  assert.equal(page2.total, 4);
  assert.equal(page2.hasMore, false);
});

test('default limit (50) and offset (0) apply when omitted', async () => {
  await seedSpread();
  const res = await query(auditRoot, {});
  assert.equal(res.entries.length, 4);
  assert.equal(res.total, 4);
  assert.equal(res.hasMore, false);
});

test('out-of-range offset returns empty entries but the real total', async () => {
  await seedSpread();
  const res = await query(auditRoot, { offset: 100 });
  assert.deepEqual(res.entries, []);
  assert.equal(res.total, 4);
  assert.equal(res.hasMore, false);
});

test('invalid pagination inputs throw ValidationError', async () => {
  await assert.rejects(() => query(auditRoot, { limit: 0 }), (e) => e instanceof ValidationError);
  await assert.rejects(() => query(auditRoot, { limit: -1 }), (e) => e instanceof ValidationError);
  await assert.rejects(() => query(auditRoot, { limit: 1.5 }), (e) => e instanceof ValidationError);
  await assert.rejects(() => query(auditRoot, { offset: -1 }), (e) => e instanceof ValidationError);
  await assert.rejects(() => query(auditRoot, { offset: 2.5 }), (e) => e instanceof ValidationError);
  await assert.rejects(() => query(auditRoot, { from: 'not-a-date' }), (e) => e instanceof ValidationError);
  await assert.rejects(() => query(auditRoot, { to: 'nope' }), (e) => e instanceof ValidationError);
});

test('shard pruning: shards outside the range are never read', async () => {
  // Valid entries on 2026-06-12; a poisoned (unparseable) shard on 2026-01-01.
  await appendAuditEntry(auditRoot, entry({ id: 'd', timestamp: '2026-06-12T15:00:00.000Z' }));
  await fs.writeFile(path.join(auditRoot, '2026-01-01.ndjson'), 'this-is-not-json\n', 'utf8');

  // Range excludes the poisoned shard → must succeed (poison shard pruned, never parsed).
  const res = await query(auditRoot, { from: '2026-06-01T00:00:00.000Z' });
  assert.deepEqual(res.entries.map((e) => e.id), ['d']);

  // Control: with no range the poisoned shard IS read and parsing throws.
  await assert.rejects(() => query(auditRoot, {}));
});

test('shard pruning: a `to`-only upper bound prunes later shards', async () => {
  await appendAuditEntry(auditRoot, entry({ id: 'd', timestamp: '2026-06-12T15:00:00.000Z' }));
  // A poisoned shard AFTER the upper bound must never be read.
  await fs.writeFile(path.join(auditRoot, '2027-01-01.ndjson'), 'still-not-json\n', 'utf8');

  const res = await query(auditRoot, { to: '2026-12-31T23:59:59.999Z' });
  assert.deepEqual(res.entries.map((e) => e.id), ['d']);
});

test('a corrupt (unparseable) timestamp sorts deterministically to the end', async () => {
  // Hand-write a row whose timestamp is valid JSON but not a parseable date —
  // query reads raw (no re-validation) and must not produce undefined ordering.
  await appendAuditEntry(auditRoot, entry({ id: 'good', timestamp: '2026-06-12T10:00:00.000Z' }));
  const corrupt = JSON.stringify({ ...entry({ id: 'bad' }), timestamp: 'not-a-date' });
  await fs.appendFile(path.join(auditRoot, '2026-06-12.ndjson'), `${corrupt}\n`, 'utf8');

  const res = await query(auditRoot);
  assert.equal(res.total, 2);
  assert.deepEqual(res.entries.map((e) => e.id), ['good', 'bad']); // corrupt last
});
