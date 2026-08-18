import test from 'node:test';
import assert from 'node:assert/strict';

import {
  AUDIT_ENTRY_JSON_SCHEMA_V1,
  assertValidAuditEntry,
  validateAuditEntry,
} from '../src/schemas/audit-entry-schema.ts';
import { ValidationError } from '../src/errors/validation-error.ts';

function validEntry(): Record<string, unknown> {
  return {
    schemaVersion: 1,
    id: '01J0000000000000000000000A',
    timestamp: '2026-06-12T10:00:00.000Z',
    scope: 'page',
    operation: 'update',
    status: 'committed',
    projectId: 'starter-docs',
    target: { resourceKind: 'page', pageId: 'getting-started-intro' },
    actor: { kind: 'agent', agentProvider: 'reference-provider' },
    runtimeMode: 'web',
    diff: { before: { a: 1 }, after: { a: 2 }, summary: 'bumped a' },
    promptDigest: 'abc123',
  };
}

function expectValidationError(fn: () => void, field?: string): void {
  assert.throws(fn, (err: unknown) => {
    assert.ok(err instanceof ValidationError, 'expected a ValidationError');
    if (field !== undefined) {
      assert.equal((err.details.metadata as { field?: string } | undefined)?.field, field);
    }
    return true;
  });
}

test('accepts a fully-valid audit entry (required + optional fields)', () => {
  const entry = validateAuditEntry(validEntry());
  assert.equal(entry.schemaVersion, 1);
  assert.equal(entry.scope, 'page');
  assert.equal(entry.actor.kind, 'agent');
  assert.equal(entry.target.resourceKind, 'page');
  assert.equal(entry.runtimeMode, 'web');
});

test('accepts a minimal entry with only required fields', () => {
  const entry = validEntry();
  delete entry.diff;
  delete entry.promptDigest;
  assert.doesNotThrow(() => assertValidAuditEntry(entry));
});

const REQUIRED_FIELDS = [
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
] as const;

for (const field of REQUIRED_FIELDS) {
  test(`rejects an entry missing required field "${field}"`, () => {
    const entry = validEntry();
    delete entry[field];
    expectValidationError(() => assertValidAuditEntry(entry));
  });
}

const ENUM_CASES: Array<{ field: string; mutate: (e: Record<string, unknown>) => void }> = [
  { field: 'scope', mutate: (e) => (e.scope = 'global') },
  { field: 'operation', mutate: (e) => (e.operation = 'patch') },
  { field: 'status', mutate: (e) => (e.status = 'done') },
  { field: 'runtimeMode', mutate: (e) => (e.runtimeMode = 'native') },
  { field: 'actor.kind', mutate: (e) => (e.actor = { kind: 'robot' }) },
  {
    field: 'target.resourceKind',
    mutate: (e) => (e.target = { resourceKind: 'paragraph' }),
  },
];

for (const { field, mutate } of ENUM_CASES) {
  test(`rejects out-of-domain enum value for "${field}"`, () => {
    const entry = validEntry();
    mutate(entry);
    expectValidationError(() => assertValidAuditEntry(entry), field);
  });
}

test('rejects an unknown top-level field', () => {
  const entry = validEntry();
  entry.foo = 'bar';
  expectValidationError(() => assertValidAuditEntry(entry), 'foo');
});

test('rejects schemaVersion other than 1', () => {
  const entry = validEntry();
  entry.schemaVersion = 2;
  expectValidationError(() => assertValidAuditEntry(entry), 'schemaVersion');
});

test('rejects a non-ISO timestamp', () => {
  const entry = validEntry();
  entry.timestamp = 'not-a-date';
  expectValidationError(() => assertValidAuditEntry(entry), 'timestamp');
});

test('rejects a non-object entry', () => {
  expectValidationError(() => assertValidAuditEntry(null));
  expectValidationError(() => assertValidAuditEntry([]));
  expectValidationError(() => assertValidAuditEntry('nope'));
});

test('AUDIT_ENTRY_JSON_SCHEMA_V1 matches the architecture spec shape', () => {
  assert.equal(AUDIT_ENTRY_JSON_SCHEMA_V1.$id, 'anydocs://schemas/audit-entry/v1');
  assert.equal(AUDIT_ENTRY_JSON_SCHEMA_V1.additionalProperties, false);
  assert.deepEqual(AUDIT_ENTRY_JSON_SCHEMA_V1.required, [
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
  ]);
  assert.equal(AUDIT_ENTRY_JSON_SCHEMA_V1.properties.schemaVersion.const, 1);
  assert.ok(Object.isFrozen(AUDIT_ENTRY_JSON_SCHEMA_V1));
});
