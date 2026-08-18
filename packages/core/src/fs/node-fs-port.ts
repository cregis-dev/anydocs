import { promises as fs } from 'node:fs';
import path from 'node:path';

import type { FileSystemPort } from './file-system-port.ts';
import { createDocsRepository, type DocsRepository } from './docs-repository.ts';
import {
  createApiSourceRepository,
  type ApiSourceRepository,
} from './api-source-repository.ts';

/**
 * Server-only filesystem implementation (Story 9.5 isolation). This module — and
 * ONLY this module within the fs layer — imports `node:fs`/`node:path`, so the
 * repositories and the desktop adapter stay browser-bundleable for the Tauri
 * webview. Web/CLI server code uses the `createNode*` factories below.
 */

/** Injectable filesystem operations used by {@link nodeAtomicWrite}. */
export type AtomicWriteOps = {
  mkdir: (dir: string) => Promise<void>;
  writeFile: (filePath: string, data: string) => Promise<void>;
  rename: (from: string, to: string) => Promise<void>;
  rm: (filePath: string) => Promise<void>;
};

const REAL_ATOMIC_WRITE_OPS: AtomicWriteOps = {
  mkdir: async (dir) => {
    await fs.mkdir(dir, { recursive: true });
  },
  writeFile: async (filePath, data) => {
    await fs.writeFile(filePath, data, 'utf8');
  },
  rename: async (from, to) => {
    await fs.rename(from, to);
  },
  rm: async (filePath) => {
    await fs.rm(filePath, { force: true });
  },
};

/**
 * Atomic write with injectable steps: ensure parent dir → write a temp file in
 * the same directory → rename over the target. On any failure the temp artifact
 * is removed and the original error is rethrown (the target is never partially
 * written — rename is its only mutation). Exported for Story 9.4 fault-injection.
 */
export async function nodeAtomicWrite(
  absPath: string,
  contents: string,
  ops: AtomicWriteOps = REAL_ATOMIC_WRITE_OPS,
): Promise<void> {
  const dir = path.dirname(absPath);
  const tempFilePath = path.join(
    dir,
    `.${path.basename(absPath)}.${process.pid}.${Date.now()}.tmp`,
  );
  await ops.mkdir(dir);
  try {
    await ops.writeFile(tempFilePath, contents);
    await ops.rename(tempFilePath, absPath);
  } catch (error) {
    await ops.rm(tempFilePath).catch(() => {});
    throw error;
  }
}

/**
 * Default `FileSystemPort` backed by `node:fs/promises`. Behavior is identical to
 * the repositories' previous inline helpers (atomic temp-then-rename write,
 * native error semantics), so web/CLI behavior is unchanged.
 */
export function createNodeFsPort(): FileSystemPort {
  return {
    async readText(absPath) {
      return fs.readFile(absPath, 'utf8');
    },
    async writeFileAtomic(absPath, contents) {
      await nodeAtomicWrite(absPath, contents);
    },
    async ensureDir(absPath) {
      await fs.mkdir(absPath, { recursive: true });
    },
    async exists(absPath) {
      try {
        await fs.access(absPath);
        return true;
      } catch {
        return false;
      }
    },
    async readDir(absPath) {
      return fs.readdir(absPath);
    },
    async remove(absPath) {
      await fs.rm(absPath);
    },
  };
}

/** Server convenience: a docs repository backed by the node fs port. */
export function createNodeDocsRepository(projectRoot: string): DocsRepository {
  return createDocsRepository(projectRoot, createNodeFsPort());
}

/** Server convenience: an api-source repository backed by the node fs port. */
export function createNodeApiSourceRepository(projectRoot: string): ApiSourceRepository {
  return createApiSourceRepository(projectRoot, createNodeFsPort());
}
