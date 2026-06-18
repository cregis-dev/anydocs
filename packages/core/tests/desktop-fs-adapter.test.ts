import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import { mkdtemp, rm, readFile } from 'node:fs/promises';

import { createDesktopFsPort, type TauriInvoke } from '../src/fs/desktop-fs-adapter.ts';
import { isMissingFileError } from '../src/fs/file-system-port.ts';
import { createNodeFsPort } from '../src/fs/node-fs-port.ts';
import { FsReadError, FsWriteError } from '../src/errors/fs-error.ts';

const PROJECT_ROOT = '/proj';

type Call = { command: string; args?: Record<string, unknown> };

function stub(handler: (call: Call) => unknown): { invoke: TauriInvoke; calls: Call[] } {
  const calls: Call[] = [];
  const invoke: TauriInvoke = async (command, args) => {
    const call = { command, args };
    calls.push(call);
    return handler(call);
  };
  return { invoke, calls };
}

test('readText maps absolute path to a root-relative fs_read call', async () => {
  const { invoke, calls } = stub(() => 'file-contents');
  const port = createDesktopFsPort({ projectRoot: PROJECT_ROOT, invoke });

  const result = await port.readText(path.join(PROJECT_ROOT, 'pages/en/intro.json'));

  assert.equal(result, 'file-contents');
  assert.deepEqual(calls, [{ command: 'fs_read', args: { path: 'pages/en/intro.json' } }]);
});

test('writeFileAtomic ensures the parent dir then writes', async () => {
  const { invoke, calls } = stub(() => undefined);
  const port = createDesktopFsPort({ projectRoot: PROJECT_ROOT, invoke });

  await port.writeFileAtomic(path.join(PROJECT_ROOT, 'pages/en/intro.json'), '{"a":1}');

  assert.deepEqual(calls, [
    { command: 'fs_mkdir', args: { path: 'pages/en' } },
    { command: 'fs_write', args: { path: 'pages/en/intro.json', contents: '{"a":1}' } },
  ]);
});

test('readDir maps fs_list entries to names', async () => {
  const { invoke } = stub(() => [
    { name: 'intro.json', isDir: false },
    { name: 'guide.json', isDir: false },
  ]);
  const port = createDesktopFsPort({ projectRoot: PROJECT_ROOT, invoke });

  const names = await port.readDir(path.join(PROJECT_ROOT, 'pages/en'));
  assert.deepEqual(names, ['intro.json', 'guide.json']);
});

test('exists checks membership in the parent listing', async () => {
  const { invoke, calls } = stub(() => [{ name: 'en.json', isDir: false }]);
  const port = createDesktopFsPort({ projectRoot: PROJECT_ROOT, invoke });

  assert.equal(await port.exists(path.join(PROJECT_ROOT, 'navigation/en.json')), true);
  assert.equal(await port.exists(path.join(PROJECT_ROOT, 'navigation/zh.json')), false);
  assert.equal(calls[0]?.args?.path, 'navigation');
});

test('exists returns false when the parent dir is missing', async () => {
  const { invoke } = stub(() => {
    throw { kind: 'notFound', message: 'parent missing' };
  });
  const port = createDesktopFsPort({ projectRoot: PROJECT_ROOT, invoke });
  assert.equal(await port.exists(path.join(PROJECT_ROOT, 'navigation/en.json')), false);
});

test('remove maps to fs_delete', async () => {
  const { invoke, calls } = stub(() => undefined);
  const port = createDesktopFsPort({ projectRoot: PROJECT_ROOT, invoke });
  await port.remove(path.join(PROJECT_ROOT, 'pages/en/intro.json'));
  assert.deepEqual(calls, [{ command: 'fs_delete', args: { path: 'pages/en/intro.json' } }]);
});

test('Rust not-found error maps to FsReadError recognized by isMissingFileError', async () => {
  const { invoke } = stub(() => {
    throw { kind: 'notFound', message: 'cannot resolve path' };
  });
  const port = createDesktopFsPort({ projectRoot: PROJECT_ROOT, invoke });

  await assert.rejects(
    () => port.readText(path.join(PROJECT_ROOT, 'pages/en/missing.json')),
    (error: unknown) => {
      assert.ok(error instanceof FsReadError);
      assert.equal((error as FsReadError).details.metadata?.notFound, true);
      assert.equal(isMissingFileError(error), true);
      return true;
    },
  );
});

test('Rust io error on write maps to FsWriteError (not a missing-file error)', async () => {
  const { invoke } = stub((call) => {
    if (call.command === 'fs_mkdir') return undefined;
    throw { kind: 'io', message: 'disk full' };
  });
  const port = createDesktopFsPort({ projectRoot: PROJECT_ROOT, invoke });

  await assert.rejects(
    () => port.writeFileAtomic(path.join(PROJECT_ROOT, 'pages/en/intro.json'), 'x'),
    (error: unknown) => {
      assert.ok(error instanceof FsWriteError);
      assert.equal(isMissingFileError(error), false);
      return true;
    },
  );
});

test('paths outside the project root are rejected before any invoke', async () => {
  const { invoke, calls } = stub(() => undefined);
  const port = createDesktopFsPort({ projectRoot: PROJECT_ROOT, invoke });

  await assert.rejects(() => port.readText('/etc/passwd'));
  await assert.rejects(() => port.readText(path.join(PROJECT_ROOT, '../sibling/x.json')));
  assert.equal(calls.length, 0, 'no IPC call should be made for escaping paths');
});

test('node port round-trips read/write/list/remove in a tempdir', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'anydocs-node-port-'));
  try {
    const port = createNodeFsPort();
    const file = path.join(dir, 'sub', 'page.json');
    await port.writeFileAtomic(file, '{"v":1}\n'); // also exercises auto parent-dir creation
    assert.equal(await port.exists(file), true);
    assert.equal(await port.readText(file), '{"v":1}\n');
    assert.equal(await readFile(file, 'utf8'), '{"v":1}\n');
    assert.deepEqual(await port.readDir(path.join(dir, 'sub')), ['page.json']);
    await port.remove(file);
    assert.equal(await port.exists(file), false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('node port surfaces native ENOENT recognized by isMissingFileError', async () => {
  const port = createNodeFsPort();
  await assert.rejects(
    () => port.readText('/no/such/anydocs/file.json'),
    (error: unknown) => isMissingFileError(error),
  );
});
