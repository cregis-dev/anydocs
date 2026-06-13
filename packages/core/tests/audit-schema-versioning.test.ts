import test from 'node:test';
import assert from 'node:assert/strict';

import {
  assertValidAuditEntry,
  validateAuditEntry,
  AUDIT_ENTRY_JSON_SCHEMA_V1,
  AUDIT_ENTRY_ALLOWED_KEYS,
  AUDIT_SCHEMA_CHANGE_HISTORY,
} from '../src/schemas/audit-entry-schema.ts';
import {
  AUDIT_ACTOR_KINDS,
  AUDIT_OPERATIONS,
  AUDIT_RESOURCE_KINDS,
  AUDIT_SCHEMA_VERSION,
  AUDIT_SCOPES,
  AUDIT_STATUSES,
} from '../src/types/audit.ts';
import type { AuditEntry } from '../src/types/audit.ts';

/**
 * Story 10.7 — schema-versioning governance. These guards turn any edit to the
 * v1 audit-entry contract into a deliberate, reviewed act: update the pinned
 * expectation + append AUDIT_SCHEMA_CHANGE_HISTORY (and bump + migrate if breaking).
 */

// The pinned v1 contract. Changing these is a SCHEMA CHANGE — update deliberately.
const EXPECTED_VERSION = 1;
const EXPECTED_REQUIRED = [
  'actor',
  'id',
  'operation',
  'projectId',
  'runtimeMode',
  'schemaVersion',
  'scope',
  'status',
  'target',
  'timestamp',
];
const EXPECTED_ALLOWED_KEYS = [
  'actor',
  'diff',
  'id',
  'operation',
  'projectId',
  'promptDigest',
  'rejectionReason',
  'rollbackOf',
  'runtimeMode',
  'schemaVersion',
  'scope',
  'status',
  'target',
  'timestamp',
];

/** Canonical entry with ONLY the required fields — no optional fields present. */
function minimalRequiredEntry(): AuditEntry {
  return {
    schemaVersion: 1,
    id: 'min-1',
    timestamp: '2026-06-12T10:00:00.000Z',
    scope: 'page',
    operation: 'update',
    status: 'committed',
    projectId: 'starter-docs',
    target: { resourceKind: 'page' },
    actor: { kind: 'system' },
    runtimeMode: 'web',
  };
}

test('forward-compat: a required-fields-only entry validates (optional additions stay non-breaking)', () => {
  // If a future change makes a new field REQUIRED, this breaks → signals a breaking
  // change that needs a schemaVersion bump, not a silent additive edit.
  assert.doesNotThrow(() => validateAuditEntry(minimalRequiredEntry()));
});

test('v1 contract guard: required set + version + allowed keys are pinned', () => {
  assert.equal(AUDIT_SCHEMA_VERSION, EXPECTED_VERSION);
  assert.equal(AUDIT_ENTRY_JSON_SCHEMA_V1.properties.schemaVersion.const, EXPECTED_VERSION);
  assert.deepEqual([...AUDIT_ENTRY_JSON_SCHEMA_V1.required].sort(), EXPECTED_REQUIRED);
  assert.deepEqual([...AUDIT_ENTRY_ALLOWED_KEYS].sort(), EXPECTED_ALLOWED_KEYS);
});

test('a non-current schemaVersion is explicitly rejected (future entries are unreadable under v1)', () => {
  assert.throws(() => assertValidAuditEntry({ ...minimalRequiredEntry(), schemaVersion: 2 }));
  assert.throws(() => assertValidAuditEntry({ ...minimalRequiredEntry(), schemaVersion: 0 }));
});

test('validator and JSON Schema stay in sync: properties keys === allowed keys, required ⊆ keys', () => {
  const schemaKeys = Object.keys(AUDIT_ENTRY_JSON_SCHEMA_V1.properties).sort();
  assert.deepEqual(schemaKeys, [...AUDIT_ENTRY_ALLOWED_KEYS].sort());
  for (const field of AUDIT_ENTRY_JSON_SCHEMA_V1.required) {
    assert.ok(schemaKeys.includes(field), `required field "${field}" must be a declared property`);
  }
});

test('JSON Schema enums match the canonical enum domains (catches narrowing/expansion)', () => {
  // Enum narrowing (removing a value) is a BREAKING change; expansion is additive.
  // Tying the schema enums to the single-source AUDIT_* arrays makes either a
  // deliberate, reviewed edit rather than a silent drift past the version guard.
  const props = AUDIT_ENTRY_JSON_SCHEMA_V1.properties;
  assert.deepEqual([...props.scope.enum].sort(), [...AUDIT_SCOPES].sort());
  assert.deepEqual([...props.operation.enum].sort(), [...AUDIT_OPERATIONS].sort());
  assert.deepEqual([...props.status.enum].sort(), [...AUDIT_STATUSES].sort());
  assert.deepEqual([...props.actor.properties.kind.enum].sort(), [...AUDIT_ACTOR_KINDS].sort());
  assert.deepEqual(
    [...props.target.properties.resourceKind.enum].sort(),
    [...AUDIT_RESOURCE_KINDS].sort(),
  );
});

test('schema change history is consistent (monotonic, genesis present, latest === current version)', () => {
  assert.ok(AUDIT_SCHEMA_CHANGE_HISTORY.length >= 1);

  // versions non-decreasing
  for (let i = 1; i < AUDIT_SCHEMA_CHANGE_HISTORY.length; i++) {
    assert.ok(
      AUDIT_SCHEMA_CHANGE_HISTORY[i].version >= AUDIT_SCHEMA_CHANGE_HISTORY[i - 1].version,
      'change history versions must be non-decreasing',
    );
  }

  // genesis present
  assert.ok(AUDIT_SCHEMA_CHANGE_HISTORY.some((record) => record.version === 1));

  // documented latest cannot drift behind the code's actual version
  const latest = AUDIT_SCHEMA_CHANGE_HISTORY[AUDIT_SCHEMA_CHANGE_HISTORY.length - 1];
  assert.equal(latest.version, AUDIT_SCHEMA_VERSION);

  // each record well-formed
  for (const record of AUDIT_SCHEMA_CHANGE_HISTORY) {
    assert.equal(typeof record.version, 'number');
    assert.match(record.date, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(record.summary.length > 0);
  }
});
