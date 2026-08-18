import { DomainError } from '../errors/domain-error.ts';

/**
 * Injectable filesystem seam used by the repositories (Story 9.3). This module is
 * **node-free** (Story 9.5 isolation) so it bundles into the Tauri webview. The
 * default node-backed implementation lives in `node-fs-port.ts` (server-only);
 * the desktop implementation in `desktop-fs-adapter.ts` routes through Tauri IPC.
 *
 * All methods take ABSOLUTE paths (the repositories compute absolute paths from
 * the project root). Adapters that need relative paths convert internally.
 */
export interface FileSystemPort {
  /** Read a file as UTF-8 text. Throws a missing-file error when absent (see {@link isMissingFileError}). */
  readText(absPath: string): Promise<string>;
  /** Atomically write text: ensure the parent dir exists, write to a temp file, then rename over the target. */
  writeFileAtomic(absPath: string, contents: string): Promise<void>;
  /** Create a directory (recursive); a no-op when it already exists. */
  ensureDir(absPath: string): Promise<void>;
  /** Whether a file or directory exists at the path. */
  exists(absPath: string): Promise<boolean>;
  /** List entry names of a directory. */
  readDir(absPath: string): Promise<string[]>;
  /** Remove a file. Throws a missing-file error when absent (callers may treat that as a no-op). */
  remove(absPath: string): Promise<void>;
}

/**
 * True when an error means "the file/directory was not there". Recognizes both
 * the native Node `ENOENT` (node port) and the desktop adapter's not-found case
 * (a {@link DomainError} carrying `details.metadata.notFound === true`). The
 * repositories use this to treat absent pages/navigation as empty/`null`.
 */
export function isMissingFileError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }
  if ('code' in error && (error as { code?: unknown }).code === 'ENOENT') {
    return true;
  }
  if (error instanceof DomainError) {
    const metadata = error.details?.metadata as { notFound?: unknown } | undefined;
    if (metadata?.notFound === true) {
      return true;
    }
  }
  return false;
}
