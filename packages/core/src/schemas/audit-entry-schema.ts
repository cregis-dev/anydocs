import { ValidationError } from '../errors/validation-error.ts';
import { isRuntimeMode } from '../runtime/runtime-mode.ts';
import {
  AUDIT_ACTOR_KINDS,
  AUDIT_OPERATIONS,
  AUDIT_RESOURCE_KINDS,
  AUDIT_SCHEMA_VERSION,
  AUDIT_SCOPES,
  AUDIT_STATUSES,
  isAuditActorKind,
  isAuditOperation,
  isAuditResourceKind,
  isAuditScope,
  isAuditStatus,
  type AuditActor,
  type AuditDiff,
  type AuditEntry,
  type AuditTarget,
} from '../types/audit.ts';

/**
 * Runtime validation + JSON Schema for the v1 audit entry shape.
 *
 * NOTE: `@anydocs/core` is intentionally zero-Zod — validation is hand-rolled
 * with type guards + `ValidationError`, matching `docs-schema.ts`. The
 * {@link AUDIT_ENTRY_JSON_SCHEMA_V1} constant below is the machine-readable
 * (draft-07) encoding of the same shape; the validator and the JSON Schema MUST
 * stay in sync. Story 10.7 governs versioned, additive evolution.
 */

const ENTITY = 'audit-entry';

/** Top-level keys permitted on an audit entry (closed shape — additionalProperties: false). */
const ALLOWED_KEYS = new Set<string>([
  'schemaVersion',
  'id',
  'timestamp',
  'scope',
  'operation',
  'status',
  'projectId',
  'target',
  'actor',
  'runtimeMode',
  'diff',
  'rejectionReason',
  'rollbackOf',
  'promptDigest',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function fail(rule: string, remediation: string, metadata?: Record<string, unknown>): never {
  throw new ValidationError(`Validation failed for "${ENTITY}" on rule "${rule}".`, {
    entity: ENTITY,
    rule,
    remediation,
    metadata,
  });
}

function assertNonEmptyString(value: unknown, field: string): asserts value is string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    fail(`${field}-required`, `Provide a non-empty string for "${field}".`, {
      field,
      received: value,
    });
  }
}

function assertOptionalString(value: unknown, field: string): void {
  if (value === undefined) {
    return;
  }
  if (typeof value !== 'string') {
    fail(`${field}-string`, `"${field}" must be a string when present.`, { field, received: value });
  }
}

function validateActor(value: unknown): AuditActor {
  if (!isRecord(value)) {
    fail('actor-object', 'Provide an "actor" object with a "kind".', { received: value });
  }
  if (!isAuditActorKind(value.kind)) {
    fail('actor-kind-enum', `"actor.kind" must be one of ${AUDIT_ACTOR_KINDS.join(', ')}.`, {
      field: 'actor.kind',
      received: value.kind,
    });
  }
  assertOptionalString(value.agentProvider, 'actor.agentProvider');
  return { kind: value.kind, agentProvider: value.agentProvider as string | undefined };
}

function validateTarget(value: unknown): AuditTarget {
  if (!isRecord(value)) {
    fail('target-object', 'Provide a "target" object with a "resourceKind".', { received: value });
  }
  if (!isAuditResourceKind(value.resourceKind)) {
    fail(
      'target-resource-kind-enum',
      `"target.resourceKind" must be one of ${AUDIT_RESOURCE_KINDS.join(', ')}.`,
      { field: 'target.resourceKind', received: value.resourceKind },
    );
  }
  assertOptionalString(value.pageId, 'target.pageId');
  assertOptionalString(value.blockId, 'target.blockId');
  assertOptionalString(value.navigationId, 'target.navigationId');
  return {
    resourceKind: value.resourceKind,
    pageId: value.pageId as string | undefined,
    blockId: value.blockId as string | undefined,
    navigationId: value.navigationId as string | undefined,
  };
}

function validateDiff(value: unknown): AuditDiff | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!isRecord(value)) {
    fail('diff-object', '"diff" must be an object when present.', { received: value });
  }
  assertOptionalString(value.summary, 'diff.summary');
  return { before: value.before, after: value.after, summary: value.summary as string | undefined };
}

/**
 * Validate an unknown value as a v1 {@link AuditEntry}. Throws {@link ValidationError}
 * (naming the offending field) before any persistence. Use at the audit
 * producer boundary (Story 10.2 repository) prior to writing.
 */
export function assertValidAuditEntry(value: unknown): asserts value is AuditEntry {
  if (!isRecord(value)) {
    fail('entry-object', 'An audit entry must be an object.', { received: value });
  }

  // Closed shape — reject unknown top-level keys (additionalProperties: false parity).
  for (const key of Object.keys(value)) {
    if (!ALLOWED_KEYS.has(key)) {
      fail('no-additional-properties', `Unknown audit entry field "${key}".`, { field: key });
    }
  }

  // schemaVersion (const 1) — a different version is a hard reject (Story 10.7 owns evolution).
  if (value.schemaVersion !== AUDIT_SCHEMA_VERSION) {
    fail(
      'schema-version',
      `schemaVersion must be ${AUDIT_SCHEMA_VERSION}. Backward-incompatible changes require a version bump + migration (Story 10.7).`,
      { field: 'schemaVersion', received: value.schemaVersion },
    );
  }

  assertNonEmptyString(value.id, 'id');

  assertNonEmptyString(value.timestamp, 'timestamp');
  if (Number.isNaN(Date.parse(value.timestamp))) {
    fail('timestamp-iso-8601', '"timestamp" must be an ISO 8601 date-time string.', {
      field: 'timestamp',
      received: value.timestamp,
    });
  }

  if (!isAuditScope(value.scope)) {
    fail('scope-enum', `"scope" must be one of ${AUDIT_SCOPES.join(', ')}.`, {
      field: 'scope',
      received: value.scope,
    });
  }
  if (!isAuditOperation(value.operation)) {
    fail('operation-enum', `"operation" must be one of ${AUDIT_OPERATIONS.join(', ')}.`, {
      field: 'operation',
      received: value.operation,
    });
  }
  if (!isAuditStatus(value.status)) {
    fail('status-enum', `"status" must be one of ${AUDIT_STATUSES.join(', ')}.`, {
      field: 'status',
      received: value.status,
    });
  }

  assertNonEmptyString(value.projectId, 'projectId');

  if (!isRuntimeMode(value.runtimeMode)) {
    fail('runtime-mode-enum', '"runtimeMode" must be one of web, desktop.', {
      field: 'runtimeMode',
      received: value.runtimeMode,
    });
  }

  validateTarget(value.target);
  validateActor(value.actor);
  validateDiff(value.diff);
  assertOptionalString(value.rejectionReason, 'rejectionReason');
  assertOptionalString(value.rollbackOf, 'rollbackOf');
  assertOptionalString(value.promptDigest, 'promptDigest');
}

/** Validate and return the value narrowed to {@link AuditEntry}. */
export function validateAuditEntry(value: unknown): AuditEntry {
  assertValidAuditEntry(value);
  return value;
}

/**
 * Machine-readable (JSON Schema draft-07) encoding of the v1 audit entry. The
 * canonical shape for external consumers and docs. Kept in sync with
 * {@link assertValidAuditEntry}. Frozen to prevent accidental mutation.
 */
export const AUDIT_ENTRY_JSON_SCHEMA_V1 = Object.freeze({
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'anydocs://schemas/audit-entry/v1',
  title: 'AuditEntry',
  type: 'object',
  required: [
    'schemaVersion',
    'id',
    'timestamp',
    'scope',
    'operation',
    'status',
    'projectId',
    'target',
    'actor',
    'runtimeMode',
  ],
  properties: {
    schemaVersion: { const: 1 },
    id: { type: 'string', description: 'ULID for ordered uniqueness' },
    timestamp: { type: 'string', format: 'date-time', description: 'ISO 8601' },
    scope: { enum: ['inline', 'page', 'workspace'] },
    operation: { enum: ['create', 'update', 'delete', 'rollback', 'structural'] },
    status: { enum: ['pending', 'committed', 'rejected'], description: 'Write-ahead lifecycle' },
    projectId: { type: 'string' },
    runtimeMode: { enum: ['web', 'desktop'] },
    actor: {
      type: 'object',
      required: ['kind'],
      properties: {
        kind: { enum: ['agent', 'human', 'system'] },
        agentProvider: {
          type: 'string',
          description: 'Provider port identifier; empty if kind != agent',
        },
      },
    },
    target: {
      type: 'object',
      required: ['resourceKind'],
      properties: {
        resourceKind: { enum: ['block', 'page', 'navigation', 'project-config'] },
        pageId: { type: 'string' },
        blockId: { type: 'string' },
        navigationId: { type: 'string' },
      },
    },
    diff: {
      type: 'object',
      description: 'Compact change summary',
      properties: {
        before: { description: 'Pre-change snapshot (canonical doc-content-v1 fragment or config object)' },
        after: { description: 'Post-change snapshot' },
        summary: { type: 'string', description: 'Short human-readable description' },
      },
    },
    rejectionReason: { type: 'string', description: "Populated only when status = 'rejected'" },
    rollbackOf: {
      type: 'string',
      description: "If operation = 'rollback', references the original entry id",
    },
    promptDigest: {
      type: 'string',
      description: 'SHA-256 of the prompt that triggered the Agent invocation; PII-safe',
    },
  },
  additionalProperties: false,
} as const);
