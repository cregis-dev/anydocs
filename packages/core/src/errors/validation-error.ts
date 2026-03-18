import { DomainError, type DomainErrorDetails } from './domain-error.ts';

export class ValidationError extends DomainError {
  constructor(message: string, details: DomainErrorDetails) {
    super('VALIDATION_ERROR', message, details);
    this.name = 'ValidationError';
  }
}
