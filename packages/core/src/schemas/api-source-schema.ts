import { ValidationError } from '../errors/validation-error.ts';
import type { ApiSourceDoc } from '../types/api-source.ts';
import { isApiSourceStatus, isApiSourceType } from '../types/api-source.ts';
import { isDocsLang } from '../types/docs.ts';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function createApiSourceValidationError(
  rule: string,
  remediation: string,
  metadata?: Record<string, unknown>,
): ValidationError {
  return new ValidationError(`API source validation failed for rule "${rule}".`, {
    entity: 'api-source',
    rule,
    remediation,
    metadata,
  });
}

function assertNonEmptyString(
  value: unknown,
  rule: string,
  remediation: string,
  metadata?: Record<string, unknown>,
): asserts value is string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw createApiSourceValidationError(rule, remediation, {
      ...metadata,
      received: value,
    });
  }
}

function validateId(value: unknown): string {
  assertNonEmptyString(
    value,
    'api-source-id-required',
    'Provide a non-empty string for api source "id".',
  );
  const trimmed = value.trim();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(trimmed)) {
    throw createApiSourceValidationError(
      'api-source-id-format',
      'Use lowercase letters, numbers, and hyphens only for api source ids.',
      { received: value },
    );
  }
  return trimmed;
}

function validateSource(input: unknown): ApiSourceDoc['source'] {
  if (!isRecord(input) || typeof input.kind !== 'string') {
    throw createApiSourceValidationError(
      'api-source-source-object',
      'Use an object with "kind" for api source "source".',
      { received: input },
    );
  }

  if (input.kind === 'url') {
    assertNonEmptyString(
      input.url,
      'api-source-source-url-required',
      'Provide a non-empty "url" when api source kind is "url".',
    );
    return {
      kind: 'url',
      url: input.url.trim(),
    };
  }

  if (input.kind === 'file') {
    assertNonEmptyString(
      input.path,
      'api-source-source-path-required',
      'Provide a non-empty "path" when api source kind is "file".',
    );
    return {
      kind: 'file',
      path: input.path.trim(),
    };
  }

  throw createApiSourceValidationError(
    'api-source-source-kind-supported',
    'Use "url" or "file" for api source "source.kind".',
    { received: input.kind },
  );
}

function validateDisplay(input: unknown): ApiSourceDoc['display'] {
  if (!isRecord(input)) {
    throw createApiSourceValidationError(
      'api-source-display-object',
      'Use an object for api source "display".',
      { received: input },
    );
  }

  assertNonEmptyString(
    input.title,
    'api-source-display-title-required',
    'Provide a non-empty title for api source display settings.',
  );

  if (input.groupId != null) {
    assertNonEmptyString(
      input.groupId,
      'api-source-display-group-id-string',
      'Use a non-empty string for display.groupId when present.',
    );
  }

  return {
    title: input.title.trim(),
    ...(typeof input.groupId === 'string' ? { groupId: input.groupId.trim() } : {}),
  };
}

function validateRuntime(input: unknown): ApiSourceDoc['runtime'] | undefined {
  if (input == null) {
    return undefined;
  }

  if (!isRecord(input)) {
    throw createApiSourceValidationError(
      'api-source-runtime-object',
      'Use an object for api source "runtime" when present.',
      { received: input },
    );
  }

  if (input.routeBase != null) {
    assertNonEmptyString(
      input.routeBase,
      'api-source-runtime-route-base-string',
      'Use a non-empty string for runtime.routeBase when present.',
    );
  }

  if (input.tryIt != null) {
    if (!isRecord(input.tryIt) || typeof input.tryIt.enabled !== 'boolean') {
      throw createApiSourceValidationError(
        'api-source-runtime-try-it-object',
        'Use an object with a boolean "enabled" for runtime.tryIt when present.',
        { received: input.tryIt },
      );
    }
  }

  return {
    ...(typeof input.routeBase === 'string' ? { routeBase: input.routeBase.trim() } : {}),
    ...(isRecord(input.tryIt) && typeof input.tryIt.enabled === 'boolean'
      ? { tryIt: { enabled: input.tryIt.enabled } }
      : {}),
  };
}

export function validateApiSourceDoc(input: unknown): ApiSourceDoc {
  if (!isRecord(input)) {
    throw createApiSourceValidationError(
      'api-source-object',
      'Ensure the api source document is a JSON object.',
      { received: input },
    );
  }

  const id = validateId(input.id);

  if (!isApiSourceType(input.type)) {
    throw createApiSourceValidationError(
      'api-source-type-supported',
      'Use one of the supported api source types.',
      { received: input.type },
    );
  }

  if (!isDocsLang(input.lang)) {
    throw createApiSourceValidationError(
      'api-source-lang-supported',
      'Use a supported docs language for api sources.',
      { received: input.lang },
    );
  }

  if (!isApiSourceStatus(input.status)) {
    throw createApiSourceValidationError(
      'api-source-status-supported',
      'Use a supported api source status.',
      { received: input.status },
    );
  }

  const runtime = validateRuntime(input.runtime);

  return {
    id,
    type: input.type,
    lang: input.lang,
    status: input.status,
    source: validateSource(input.source),
    display: validateDisplay(input.display),
    ...(runtime ? { runtime } : {}),
  };
}
