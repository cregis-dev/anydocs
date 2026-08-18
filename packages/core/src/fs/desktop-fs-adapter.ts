import { relativePosix, dirnamePosix, basenamePosix } from '../utils/posix-path.ts';

import { FsReadError, FsWriteError } from '../errors/fs-error.ts';
import type { DomainErrorDetails } from '../errors/domain-error.ts';
import type { FileSystemPort } from './file-system-port.ts';

/**
 * Tauri IPC invoker, injected by the host (Story 9.5 passes
 * `@tauri-apps/api/core`'s `invoke`). Declared locally so `@anydocs/core` stays
 * framework-agnostic — it never imports `@tauri-apps/api`.
 */
export type TauriInvoke = (command: string, args?: Record<string, unknown>) => Promise<unknown>;

export type DesktopFsPortOptions = {
  /** Absolute project root; the Rust `set_active_project_root` must be set to the same path. */
  projectRoot: string;
  /** Injected Tauri `invoke`. */
  invoke: TauriInvoke;
};

/** Shape of the serialized error the Rust fs commands return on failure (Story 9.2). */
type RustFsError = { kind?: string; message?: string };

function isRustFsError(value: unknown): value is RustFsError {
  return !!value && typeof value === 'object' && ('kind' in value || 'message' in value);
}

/**
 * `FileSystemPort` backed by the native Rust fs commands over Tauri IPC. Converts
 * the repositories' absolute paths to project-root-relative paths (the Rust
 * command contract) and maps the Rust `FsError` onto typed domain errors.
 */
export function createDesktopFsPort(options: DesktopFsPortOptions): FileSystemPort {
  const { projectRoot, invoke } = options;

  function toRelative(absPath: string, op: 'read' | 'write'): string {
    const posix = relativePosix(projectRoot, absPath);
    if (posix === '' || posix === '.' || posix.startsWith('..')) {
      throw makeError(op, {
        kind: 'pathEscapesRoot',
        message: `Path is outside the active project root: ${absPath}`,
      });
    }
    return posix;
  }

  function makeError(op: 'read' | 'write', err: unknown): Error {
    const rust = isRustFsError(err) ? err : undefined;
    const kind = rust?.kind ?? 'io';
    const message = rust?.message ?? (err instanceof Error ? err.message : String(err));
    const details: DomainErrorDetails = {
      entity: 'desktop-fs',
      rule: `fs-${op}`,
      metadata: { kind, notFound: kind === 'notFound' },
    };
    return op === 'read' ? new FsReadError(message, details) : new FsWriteError(message, details);
  }

  return {
    async readText(absPath) {
      const rel = toRelative(absPath, 'read');
      try {
        return (await invoke('fs_read', { path: rel })) as string;
      } catch (error) {
        throw makeError('read', error);
      }
    },

    async writeFileAtomic(absPath, contents) {
      const rel = toRelative(absPath, 'write');
      const parent = dirnamePosix(rel);
      try {
        // Rust `fs_write` requires an existing parent dir (Story 9.2); ensure it first.
        if (parent && parent !== '.') {
          await invoke('fs_mkdir', { path: parent });
        }
        await invoke('fs_write', { path: rel, contents });
      } catch (error) {
        throw makeError('write', error);
      }
    },

    async ensureDir(absPath) {
      const rel = toRelative(absPath, 'write');
      try {
        await invoke('fs_mkdir', { path: rel });
      } catch (error) {
        throw makeError('write', error);
      }
    },

    async exists(absPath) {
      const rel = toRelative(absPath, 'read');
      const parent = dirnamePosix(rel);
      const base = basenamePosix(rel);
      try {
        const entries = (await invoke('fs_list', { path: parent })) as Array<{ name: string }>;
        return entries.some((entry) => entry.name === base);
      } catch (error) {
        if (isRustFsError(error) && error.kind === 'notFound') {
          return false;
        }
        throw makeError('read', error);
      }
    },

    async readDir(absPath) {
      const rel = toRelative(absPath, 'read');
      try {
        const entries = (await invoke('fs_list', { path: rel })) as Array<{ name: string }>;
        return entries.map((entry) => entry.name);
      } catch (error) {
        throw makeError('read', error);
      }
    },

    async remove(absPath) {
      const rel = toRelative(absPath, 'write');
      try {
        await invoke('fs_delete', { path: rel });
      } catch (error) {
        throw makeError('write', error);
      }
    },
  };
}
