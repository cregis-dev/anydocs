import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test, { afterEach, beforeEach } from 'node:test';

import {
  appendAuditEntry,
  initializeProject,
  listAuditShardDates,
  readAuditShard,
  type AuditEntry,
} from '@anydocs/core';

import { runAuditPruneCommand } from '../src/commands/audit-command.ts';

let repoRoot: string;
let auditRoot: string;

beforeEach(async () => {
  repoRoot = await mkdtemp(path.join(os.tmpdir(), 'anydocs-cli-audit-'));
  await initializeProject({ repoRoot, languages: ['en'], defaultLanguage: 'en' });
  auditRoot = path.join(repoRoot, '.anydocs', 'audit');
});

afterEach(async () => {
  await rm(repoRoot, { recursive: true, force: true });
});

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

function entry(id: string, timestamp: string): AuditEntry {
  return {
    schemaVersion: 1,
    id,
    timestamp,
    scope: 'page',
    operation: 'update',
    status: 'committed',
    projectId: 'docs',
    target: { resourceKind: 'page', pageId: 'intro' },
    actor: { kind: 'agent', agentProvider: 'ref' },
    runtimeMode: 'web',
  };
}

test('audit prune deletes shards beyond the retention window and records a summary entry', async () => {
  const oldKey = isoDaysAgo(400).slice(0, 10);
  const recentKey = isoDaysAgo(2).slice(0, 10);
  await appendAuditEntry(auditRoot, entry('ancient', isoDaysAgo(400)));
  await appendAuditEntry(auditRoot, entry('recent', isoDaysAgo(2)));

  const exitCode = await runAuditPruneCommand({ targetDir: repoRoot });
  assert.equal(exitCode, 0);

  const remaining = await listAuditShardDates(auditRoot);
  assert.ok(!remaining.includes(oldKey), 'old shard pruned');
  assert.ok(remaining.includes(recentKey), 'recent shard kept');

  // a system structural summary entry landed in today's shard
  const today = await readAuditShard(auditRoot, new Date());
  const summary = today.find((e) => e.operation === 'structural');
  assert.ok(summary, 'system summary entry appended');
  assert.equal(summary.actor.kind, 'system');
  assert.equal(summary.scope, 'workspace');
});

test('audit prune is a no-op for a project under the retention window', async () => {
  await appendAuditEntry(auditRoot, entry('recent', isoDaysAgo(3)));
  const before = await listAuditShardDates(auditRoot);

  const exitCode = await runAuditPruneCommand({ targetDir: repoRoot });
  assert.equal(exitCode, 0);

  assert.deepEqual(await listAuditShardDates(auditRoot), before);
  // no system entry appended anywhere
  const shard = await readAuditShard(auditRoot, new Date(isoDaysAgo(3)));
  assert.equal(shard.length, 1);
  assert.equal(shard[0].operation, 'update');
});

test('audit prune fails (exit 1) when no project contract is present', async () => {
  const empty = await mkdtemp(path.join(os.tmpdir(), 'anydocs-cli-audit-empty-'));
  try {
    const exitCode = await runAuditPruneCommand({ targetDir: empty, json: true });
    assert.equal(exitCode, 1);
  } finally {
    await rm(empty, { recursive: true, force: true });
  }
});
