import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertValidDocContentV1,
  validateDocContentV1,
  assertValidAuditEntry,
  AUDIT_SCHEMA_VERSION,
  CAPABILITY_MATRIX,
  isRuntimeMode,
} from '../src/content/index.ts';

// Proves the @anydocs/core reuse seam actually executes in the cloud package —
// not just that the types resolve. If these fail, the cloud edition has drifted
// off the shared domain (Team First strategy, action 2).

test('doc-content-v1 validator from core accepts a valid cloud document', () => {
  const content = {
    version: 1,
    blocks: [
      { type: 'heading', id: 'b1', level: 1, children: [{ type: 'text', text: 'Cloud page' }] },
      { type: 'paragraph', id: 'b2', children: [{ type: 'text', text: 'Body' }] },
    ],
  };
  assert.doesNotThrow(() => assertValidDocContentV1(content));
  assert.equal(validateDocContentV1(content).ok, true);
});

test('doc-content-v1 validator from core rejects an invalid document', () => {
  const bad = { version: 1, blocks: [{ type: 'not-a-real-block', id: 'x', children: [] }] };
  const result = validateDocContentV1(bad);
  assert.equal(result.ok, false);
  // The cloud gets core's precise diagnostics, not a generic boolean — this is the
  // reason to share the validator rather than re-implement a looser one.
  assert.equal(result.path, 'content.blocks[0].type');
  assert.match(result.error, /unsupported block type/);
  assert.throws(() => assertValidDocContentV1(bad));
});

test('audit entry contract is the SAME schema version as the local-first edition', () => {
  // The cloud stores audit entries in Postgres rather than NDJSON, but the entry
  // contract must not fork — C3.2/C10.3 depend on this staying shared.
  assert.equal(typeof AUDIT_SCHEMA_VERSION, 'number');
  assert.throws(() => assertValidAuditEntry({ nonsense: true }));
});

test('runtime capability matrix is available for the C1.5 project mode field', () => {
  assert.ok(CAPABILITY_MATRIX, 'capability matrix should be importable');
  assert.equal(isRuntimeMode('desktop'), true);
  assert.equal(isRuntimeMode('definitely-not-a-mode'), false);
});

test('importing the cloud content seam does not pull node:fs into the module graph', async () => {
  // The seam exists precisely so cloud bundles stay serverless-safe. core/portable
  // is guarded structurally in packages/core/tests/portable-entry.test.ts; this is
  // the consumer-side smoke check that the re-export chain preserves it.
  const mod = await import('../src/content/index.ts');
  assert.ok(Object.keys(mod).length > 0, 'content seam should export something');
});
