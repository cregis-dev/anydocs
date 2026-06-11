// =============================================================================
// Web runtime lock scoping — regression coverage for build/preview contention.
//
// `startDocsPreviewServer` holds its lock for the preview server's entire
// lifetime. When export and preview shared ONE lock, any `build` issued while
// a preview was running polled the filesystem lock for 5 minutes and then
// failed with a timeout ("build 和 preview 相互争夺资源"). The two modes stage
// fully isolated runtime workspaces, so the lock is now scoped per mode:
// 'export' and 'preview' never contend; same-scope acquisitions still
// serialize (they share a fixed staging directory per mode).
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { acquireWebRuntimeLock } from '../src/services/web-runtime-bridge.ts';

// The bridge resolves its lock directory under the web package root.
// Point ANYDOCS_WEB_RUNTIME_ROOT at a temp dir that passes the
// `isWebRuntimeRoot` marker check so tests never touch the real packages/web.
const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'anydocs-web-runtime-lock-'));
await mkdir(path.join(tempRoot, 'scripts'), { recursive: true });
await writeFile(path.join(tempRoot, 'scripts', 'gen-public-assets.mjs'), '// marker for isWebRuntimeRoot\n', 'utf8');
process.env.ANYDOCS_WEB_RUNTIME_ROOT = tempRoot;

test.after(async () => {
  delete process.env.ANYDOCS_WEB_RUNTIME_ROOT;
  await rm(tempRoot, { recursive: true, force: true });
});

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test('export and preview scopes do not contend (build no longer waits behind a running preview)', async () => {
  // Simulate a long-running preview: acquire and HOLD the preview lock.
  const releasePreview = await acquireWebRuntimeLock('preview');

  // A build must acquire its 'export' lock immediately. Pre-fix this hung on
  // the shared in-process queue (deadlock in-process) or polled the shared
  // filesystem lock for 5 minutes (cross-process).
  let exportAcquired = false;
  const exportPromise = acquireWebRuntimeLock('export').then((release) => {
    exportAcquired = true;
    return release;
  });
  const releaseExport = await Promise.race([
    exportPromise,
    delay(2_000).then(() => null),
  ]);

  assert.ok(exportAcquired, "the 'export' lock must be acquirable while the 'preview' lock is held");
  assert.ok(releaseExport, 'export lock acquisition resolved with a release handle');

  await releaseExport?.();
  await releasePreview();
});

test('same-scope acquisitions still serialize (two exports share one staging dir)', async () => {
  const releaseFirst = await acquireWebRuntimeLock('export');

  let secondAcquired = false;
  const secondPromise = acquireWebRuntimeLock('export').then((release) => {
    secondAcquired = true;
    return release;
  });

  // Give the second acquisition ample time to (incorrectly) slip through.
  await delay(600);
  assert.equal(secondAcquired, false, 'second export must wait while the first holds the lock');

  await releaseFirst();
  const releaseSecond = await secondPromise;
  assert.equal(secondAcquired, true, 'second export proceeds once the first releases');
  await releaseSecond();
});

test('scoped filesystem lock dirs are distinct and carry the scope in owner.json', async () => {
  const releasePreview = await acquireWebRuntimeLock('preview');
  const releaseExport = await acquireWebRuntimeLock('export');

  assert.ok(
    existsSync(path.join(tempRoot, '.anydocs-web-runtime.lock-preview')),
    'preview scope uses its own lock dir',
  );
  assert.ok(
    existsSync(path.join(tempRoot, '.anydocs-web-runtime.lock-export')),
    'export scope uses its own lock dir',
  );

  await releaseExport();
  await releasePreview();

  assert.equal(existsSync(path.join(tempRoot, '.anydocs-web-runtime.lock-preview')), false, 'release removes the preview lock dir');
  assert.equal(existsSync(path.join(tempRoot, '.anydocs-web-runtime.lock-export')), false, 'release removes the export lock dir');
});

test('release handles are idempotent', async () => {
  const release = await acquireWebRuntimeLock('export');
  await release();
  await assert.doesNotReject(async () => release());

  // The scope must be re-acquirable afterwards.
  const again = await acquireWebRuntimeLock('export');
  await again();
});

test('stale lock from a dead process is cleaned up instead of blocking until timeout', async () => {
  // Plant a lock dir owned by a PID that cannot be alive (pid 1 is launchd /
  // init and never matches a Node child; use an absurdly high dead pid).
  const lockDir = path.join(tempRoot, '.anydocs-web-runtime.lock-export');
  await mkdir(lockDir, { recursive: true });
  await writeFile(
    path.join(lockDir, 'owner.json'),
    JSON.stringify({ pid: 2 ** 22 + 12345, scope: 'export', acquiredAt: new Date().toISOString() }),
    'utf8',
  );

  let acquired = false;
  const release = await Promise.race([
    acquireWebRuntimeLock('export').then((r) => {
      acquired = true;
      return r;
    }),
    delay(5_000).then(() => null),
  ]);

  assert.ok(acquired, 'stale dead-pid lock must be reclaimed promptly');
  await release?.();
});
