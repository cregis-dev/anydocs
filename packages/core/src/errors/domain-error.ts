export type DomainErrorDetails = {
  entity: string;
  rule: string;
  remediation?: string;
  metadata?: Record<string, unknown>;
};

export class DomainError extends Error {
  readonly code: string;
  readonly details: DomainErrorDetails;

  constructor(code: string, message: string, details: DomainErrorDetails) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    this.details = details;
  }
}
