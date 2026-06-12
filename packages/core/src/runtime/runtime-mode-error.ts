import { DomainError, type DomainErrorDetails } from '../errors/domain-error.ts';

/**
 * Machine-branchable codes for runtime mode resolution failures. Consumers can
 * switch on `error.code` (or `error.name === 'RuntimeModeResolutionError'`).
 */
export type RuntimeModeErrorCode =
  | 'RUNTIME_MODE_AMBIGUOUS'
  | 'RUNTIME_MODE_INVALID_INJECTION'
  | 'RUNTIME_MODE_NOT_RESOLVED'
  | 'RUNTIME_MODE_CONFLICT';

/**
 * Typed error thrown by the runtime mode resolver. Extends the shared
 * `DomainError` hierarchy so it carries a stable `name`, a `code`, and
 * structured `details` (entity / rule / remediation / metadata).
 */
export class RuntimeModeResolutionError extends DomainError {
  constructor(code: RuntimeModeErrorCode, message: string, details: DomainErrorDetails) {
    super(code, message, details);
    this.name = 'RuntimeModeResolutionError';
  }
}
