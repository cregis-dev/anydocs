import { DomainError, type DomainErrorDetails } from './domain-error.ts';

/**
 * Filesystem read failure surfaced by a {@link import('../fs/file-system-port.ts').FileSystemPort}.
 * The desktop adapter maps the Rust-side `FsError` onto this; a not-found case
 * carries `details.metadata.notFound === true` so `isMissingFileError` treats it
 * the same as a native `ENOENT` (see fs/file-system-port.ts).
 */
export class FsReadError extends DomainError {
  constructor(message: string, details: DomainErrorDetails) {
    super('FS_READ_ERROR', message, details);
    this.name = 'FsReadError';
  }
}

/** Filesystem write failure surfaced by a `FileSystemPort` (atomic write/rename/mkdir/delete). */
export class FsWriteError extends DomainError {
  constructor(message: string, details: DomainErrorDetails) {
    super('FS_WRITE_ERROR', message, details);
    this.name = 'FsWriteError';
  }
}
