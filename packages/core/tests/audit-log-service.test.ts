import test, { afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  markCommitted,
  markRejected,
  persistPending,
  runWriteAhead,
} from '../src/services/audit-log-service.ts';
import { readAuditShard } from '../src/fs/audit-repository.ts';
import type { AuditEntry } from '../src/types/audit.ts';

let auditRoot: string;

beforeEach(async () => {
  auditRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'anydocs-audit-svc-'));
});

afterEach(async () => {
  await fs.rm(auditRoot, { recursive: true, force: true });
});

function entry(overrides: Partial<AuditEntry> = {}): AuditEntry {
  return {
    schemaVersion: 1,
    id: 'entry-1',
    timestamp: '2026-06-12T10:00:00.000Z',
    scope: 'page',
    operation: 'update',
    status: 'committed', // persistPending forces 'pending'
    projectId: 'starter-docs',
    target: { resourceKind: 'page', pageId: 'intro' },
    actor: { kind: 'agent', agentProvider: 'ref' },
    runtimeMode: 'web',
    ...overrides,
  };
}

const shardKey = new Date('2026-06-12T00:00:00.000Z');

test('persistPending writes a pending entry and returns its id', async () => {
  const id = await persistPending(auditRoot, entry());
  assert.equal(id, 'entry-1');
  const [persisted] = await readAuditShard(auditRoot, shardKey);
  assert.equal(persisted.status, 'pending');
});

test('markCommitted flips status to committed (durable, re-read confirms)', async () => {
  const id = await persistPending(auditRoot, entry());
  const updated = await markCommitted(auditRoot, id);
  assert.equal(updated.status, 'committed');
  const [reread] = await readAuditShard(auditRoot, shardKey);
  assert.equal(reread.status, 'committed');
});

test('markRejected sets rejected status and rejectionReason', async () => {
  const id = await persistPending(auditRoot, entry());
  await markRejected(auditRoot, id, 'disk full');
  const [reread] = await readAuditShard(auditRoot, shardKey);
  assert.equal(reread.status, 'rejected');
  assert.equal(reread.rejectionReason, 'disk full');
});

test('markCommitted on an unknown id throws', async () => {
  await assert.rejects(() => markCommitted(auditRoot, 'nope'));
});

test('atomic rewrite preserves sibling entries in the same shard', async () => {
  await persistPending(auditRoot, entry({ id: 'a' }));
  await persistPending(auditRoot, entry({ id: 'b' }));
  await markCommitted(auditRoot, 'a');

  const all = await readAuditShard(auditRoot, shardKey);
  const byId = Object.fromEntries(all.map((e) => [e.id, e.status]));
  assert.equal(byId.a, 'committed');
  assert.equal(byId.b, 'pending'); // untouched sibling intact
  assert.equal(all.length, 2);
});

test('runWriteAhead commits when the content write succeeds', async () => {
  let ran = 0;
  const out = await runWriteAhead(auditRoot, entry({ id: 'wa-ok' }), async () => {
    ran += 1;
    return 'written';
  });
  assert.equal(ran, 1);
  assert.equal(out.result, 'written');
  assert.equal(out.entry.status, 'committed');
  const [reread] = await readAuditShard(auditRoot, shardKey);
  assert.equal(reread.status, 'committed');
});

test('runWriteAhead rejects (and re-throws) when the content write fails', async () => {
  await assert.rejects(
    () =>
      runWriteAhead(auditRoot, entry({ id: 'wa-fail' }), async () => {
        throw new Error('write boom');
      }),
    /write boom/,
  );
  const [reread] = await readAuditShard(auditRoot, shardKey);
  assert.equal(reread.status, 'rejected');
  assert.equal(reread.rejectionReason, 'write boom');
  // no committed entry exists
  const committed = (await readAuditShard(auditRoot, shardKey)).filter((e) => e.status === 'committed');
  assert.equal(committed.length, 0);
});

test('runWriteAhead does not let a markRejected failure mask the original error', async () => {
  // Persist pending, then remove the shard so the catch-path markRejected can't
  // find the entry and throws — the ORIGINAL content-write error must still surface.
  await assert.rejects(
    () =>
      runWriteAhead(auditRoot, entry({ id: 'wa-double' }), async () => {
        await fs.rm(auditRoot, { recursive: true, force: true }); // break the audit log mid-flight
        throw new Error('original boom');
      }),
    /original boom/, // not a "no audit entry found" masking error
  );
});
