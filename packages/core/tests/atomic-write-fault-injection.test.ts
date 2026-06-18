import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import { mkdtemp, mkdir, writeFile, rename, rm, readFile, readdir } from 'node:fs/promises';

import {
  nodeAtomicWrite,
  type AtomicWriteOps,
} from '../src/fs/node-fs-port.ts';
import { createDesktopFsPort, type TauriInvoke } from '../src/fs/desktop-fs-adapter.ts';
import { FsWriteError } from '../src/errors/fs-error.ts';

const RUNS = 25; // "100% of injected runs" (AC1)

function realOps(): AtomicWriteOps {
  return {
    mkdir: async (dir) => {
      await mkdir(dir, { recursive: true });
    },
    writeFile: async (filePath, data) => {
      await writeFile(filePath, data, 'utf8');
    },
    rename: async (from, to) => {
      await rename(from, to);
    },
    rm: async (filePath) => {
      await rm(filePath, { force: true });
    },
  };
}

async function withTempDir(run: (dir: string) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'anydocs-atomic-'));
  try {
    await run(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function hasTempLeftover(dir: string): Promise<boolean> {
  const entries = await readdir(dir);
  return entries.some((name) => name.includes('anydocs-tmp'));
}

test('node atomic write: temp-write failure leaves the original unchanged (100% of runs)', async () => {
  await withTempDir(async (dir) => {
    const target = path.join(dir, 'page.json');
    await writeFile(target, 'ORIGINAL', 'utf8');

    for (let i = 0; i < RUNS; i += 1) {
      const ops = realOps();
      const realWrite = ops.writeFile;
      ops.writeFile = async (filePath, _data) => {
        await realWrite(filePath, 'partial-garbage'); // partial temp, then fail
        throw new Error('injected temp-write failure');
      };

      await assert.rejects(() => nodeAtomicWrite(target, 'NEWDATA', ops));
      assert.equal(await readFile(target, 'utf8'), 'ORIGINAL');
    }
    assert.equal(await hasTempLeftover(dir), false, 'temp artifact must be cleaned up');
  });
});

test('node atomic write: rename failure leaves the original unchanged (100% of runs)', async () => {
  await withTempDir(async (dir) => {
    const target = path.join(dir, 'page.json');
    await writeFile(target, 'ORIGINAL', 'utf8');

    for (let i = 0; i < RUNS; i += 1) {
      const ops = realOps();
      ops.rename = async () => {
        throw new Error('injected rename failure');
      };

      await assert.rejects(() => nodeAtomicWrite(target, 'NEWDATA', ops));
      assert.equal(await readFile(target, 'utf8'), 'ORIGINAL');
    }
    assert.equal(await hasTempLeftover(dir), false, 'temp artifact must be cleaned up after rename failure');
  });
});

test('node atomic write: successful write has full content and no leftover temp', async () => {
  await withTempDir(async (dir) => {
    const target = path.join(dir, 'page.json');
    await writeFile(target, 'OLD-AND-LONGER', 'utf8');
    await nodeAtomicWrite(target, 'NEW', realOps());
    assert.equal(await readFile(target, 'utf8'), 'NEW'); // wholesale, no leftover bytes
    assert.equal(await hasTempLeftover(dir), false);
  });
});

test('desktop adapter: a Rust write failure surfaces a typed FsWriteError (AC2)', async () => {
  const invoke: TauriInvoke = async (command) => {
    if (command === 'fs_mkdir') return undefined;
    throw { kind: 'io', message: 'injected disk failure' };
  };
  const port = createDesktopFsPort({ projectRoot: '/proj', invoke });

  await assert.rejects(
    () => port.writeFileAtomic('/proj/pages/en/intro.json', '{"a":1}'),
    (error: unknown) => error instanceof FsWriteError,
  );
  // The original file is never partially written: the desktop adapter performs
  // no write itself — atomicity is enforced Rust-side (cargo fault-injection tests).
});
