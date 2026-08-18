import test, { afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { rollback, RollbackNotApplicableError } from '../src/services/rollback-service.ts';
import { findAuditEntry } from '../src/services/audit-log-service.ts';
import { appendAuditEntry, readAuditShard } from '../src/fs/audit-repository.ts';
import { ValidationError } from '../src/errors/validation-error.ts';
import type { AuditEntry } from '../src/types/audit.ts';

let auditRoot: string;

beforeEach(async () => {
  auditRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'anydocs-rollback-'));
});

afterEach(async () => {
  await fs.rm(auditRoot, { recursive: true, force: true });
});

function entry(overrides: Partial<AuditEntry> = {}): AuditEntry {
  return {
    schemaVersion: 1,
    id: 'orig-1',
    timestamp: '2026-06-12T10:00:00.000Z',
    scope: 'page',
    operation: 'update',
    status: 'committed',
    projectId: 'starter-docs',
    target: { resourceKind: 'page', pageId: 'intro' },
    actor: { kind: 'agent', agentProvider: 'ref' },
    runtimeMode: 'web',
    diff: { before: { title: 'Old' }, after: { title: 'New' }, summary: 'changed title' },
    ...overrides,
  };
}

const shardKey = new Date('2026-06-12T00:00:00.000Z');

function spy() {
  const calls: Array<{ snapshot: unknown; original: AuditEntry }> = [];
  const fn = async (snapshot: unknown, original: AuditEntry) => {
    calls.push({ snapshot, original });
  };
  return { fn, calls };
}

test('rollback re-applies the snapshot and persists a committed rollback entry', async () => {
  await appendAuditEntry(auditRoot, entry());
  const applied = spy();

  const result = await rollback(auditRoot, 'orig-1', {
    applyRollback: applied.fn,
    rollbackEntryId: 'rb-1',
    timestamp: '2026-06-12T11:00:00.000Z',
  });

  // callback invoked once with the pre-change snapshot
  assert.equal(applied.calls.length, 1);
  assert.deepEqual(applied.calls[0].snapshot, { title: 'Old' });
  assert.equal(applied.calls[0].original.id, 'orig-1');

  // returned + persisted rollback entry
  assert.equal(result.entry.status, 'committed');
  const all = await readAuditShard(auditRoot, shardKey);
  const rb = all.find((e) => e.id === 'rb-1');
  assert.ok(rb);
  assert.equal(rb.operation, 'rollback');
  assert.equal(rb.rollbackOf, 'orig-1');
  assert.equal(rb.status, 'committed');
  assert.deepEqual(rb.diff?.after, { title: 'Old' }); // restores the old state
  assert.deepEqual(rb.diff?.before, { title: 'New' }); // leaving the new state

  // original untouched
  const orig = all.find((e) => e.id === 'orig-1');
  assert.equal(orig?.status, 'committed');
  assert.equal(orig?.operation, 'update');
});

test('rollback actor defaults to system (not the original actor) and is overridable', async () => {
  await appendAuditEntry(auditRoot, entry()); // original actor is an agent
  const applied = spy();

  // default → system (must NOT impersonate the original agent actor)
  await rollback(auditRoot, 'orig-1', {
    applyRollback: applied.fn,
    rollbackEntryId: 'rb-sys',
    timestamp: '2026-06-12T11:00:00.000Z',
  });
  const sys = (await readAuditShard(auditRoot, shardKey)).find((e) => e.id === 'rb-sys');
  assert.equal(sys?.actor.kind, 'system');
  assert.equal(sys?.actor.agentProvider, undefined);

  // explicit override is honored
  await rollback(auditRoot, 'orig-1', {
    applyRollback: applied.fn,
    rollbackEntryId: 'rb-human',
    timestamp: '2026-06-12T12:00:00.000Z',
    actor: { kind: 'human' },
  });
  const human = (await readAuditShard(auditRoot, shardKey)).find((e) => e.id === 'rb-human');
  assert.equal(human?.actor.kind, 'human');
});

test('rejected entry refuses rollback (ROLLBACK_NOT_COMMITTED), no content change', async () => {
  await appendAuditEntry(auditRoot, entry({ id: 'rej', status: 'rejected', rejectionReason: 'boom' }));
  const applied = spy();

  await assert.rejects(
    () => rollback(auditRoot, 'rej', { applyRollback: applied.fn, rollbackEntryId: 'rb' }),
    (e) => e instanceof RollbackNotApplicableError && e.code === 'ROLLBACK_NOT_COMMITTED',
  );
  assert.equal(applied.calls.length, 0);
  // no new entry persisted (still just the one)
  assert.equal((await readAuditShard(auditRoot, shardKey)).length, 1);
});

test('pending entry refuses rollback (ROLLBACK_NOT_COMMITTED)', async () => {
  await appendAuditEntry(auditRoot, entry({ id: 'pend', status: 'pending' }));
  const applied = spy();
  await assert.rejects(
    () => rollback(auditRoot, 'pend', { applyRollback: applied.fn, rollbackEntryId: 'rb' }),
    (e) => e instanceof RollbackNotApplicableError && e.code === 'ROLLBACK_NOT_COMMITTED',
  );
  assert.equal(applied.calls.length, 0);
});

test('committed entry without a snapshot refuses rollback (ROLLBACK_NO_SNAPSHOT)', async () => {
  await appendAuditEntry(auditRoot, entry({ id: 'no-snap', diff: { after: { title: 'New' } } }));
  const applied = spy();
  await assert.rejects(
    () => rollback(auditRoot, 'no-snap', { applyRollback: applied.fn, rollbackEntryId: 'rb' }),
    (e) => e instanceof RollbackNotApplicableError && e.code === 'ROLLBACK_NO_SNAPSHOT',
  );
  assert.equal(applied.calls.length, 0);
});

test('unknown id throws ValidationError (not RollbackNotApplicableError)', async () => {
  const applied = spy();
  await assert.rejects(
    () => rollback(auditRoot, 'ghost', { applyRollback: applied.fn, rollbackEntryId: 'rb' }),
    (e) => e instanceof ValidationError,
  );
  assert.equal(applied.calls.length, 0);
});

test('a throwing applyRollback rejects the rollback entry and re-throws the original error', async () => {
  await appendAuditEntry(auditRoot, entry());

  await assert.rejects(
    () =>
      rollback(auditRoot, 'orig-1', {
        applyRollback: async () => {
          throw new Error('content write failed');
        },
        rollbackEntryId: 'rb-fail',
        timestamp: '2026-06-12T11:00:00.000Z',
      }),
    /content write failed/,
  );

  const all = await readAuditShard(auditRoot, shardKey);
  const rb = all.find((e) => e.id === 'rb-fail');
  assert.equal(rb?.status, 'rejected');
  assert.equal(rb?.rejectionReason, 'content write failed');
  // original untouched
  assert.equal(all.find((e) => e.id === 'orig-1')?.status, 'committed');
});

test('findAuditEntry locates an entry in an older (non-newest) shard', async () => {
  await appendAuditEntry(auditRoot, entry({ id: 'old', timestamp: '2026-06-10T10:00:00.000Z' }));
  await appendAuditEntry(auditRoot, entry({ id: 'new', timestamp: '2026-06-12T10:00:00.000Z' }));

  const found = await findAuditEntry(auditRoot, 'old');
  assert.equal(found?.id, 'old');
  assert.equal(await findAuditEntry(auditRoot, 'missing'), undefined);
});
