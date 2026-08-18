import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  CAPABILITY_MATRIX,
  getCapabilities,
  type RuntimeCapabilities,
} from '../src/runtime/capability-matrix.ts';
import {
  __resetRuntimeModeForTests,
  resolveRuntimeMode,
} from '../src/runtime/runtime-mode.ts';

afterEach(() => {
  __resetRuntimeModeForTests();
});

const CAPABILITY_FIELDS: Array<keyof RuntimeCapabilities> = [
  'projectFsReadSurface',
  'projectFsWriteSurface',
  'localApiReachable',
  'studioEditing',
  'agentInvocation',
  'auditPersistence',
  'runtimeModeLabel',
];

test('matrix has both runtime modes', () => {
  assert.deepEqual(Object.keys(CAPABILITY_MATRIX).sort(), ['desktop', 'web']);
});

test('every capability field is populated for both modes', () => {
  for (const mode of ['web', 'desktop'] as const) {
    for (const field of CAPABILITY_FIELDS) {
      assert.notEqual(
        CAPABILITY_MATRIX[mode][field],
        undefined,
        `${mode}.${field} should be defined`,
      );
    }
  }
});

test('web row reflects local-api write surface and reachable local api', () => {
  const caps = getCapabilities('web');
  assert.equal(caps.projectFsWriteSurface, 'local-api');
  assert.equal(caps.localApiReachable, true);
  assert.equal(caps.runtimeModeLabel, 'web');
});

test('desktop row reflects native-fs and unreachable local api', () => {
  const caps = getCapabilities('desktop');
  assert.equal(caps.projectFsWriteSurface, 'native-fs');
  assert.equal(caps.localApiReachable, false);
  assert.equal(caps.runtimeModeLabel, 'desktop');
});

test('audit persistence is mode-independent', () => {
  assert.equal(
    getCapabilities('web').auditPersistence,
    getCapabilities('desktop').auditPersistence,
  );
});

test('getCapabilities() defaults to the resolved runtime mode', () => {
  resolveRuntimeMode({ injectedMode: 'desktop' });
  assert.equal(getCapabilities().runtimeModeLabel, 'desktop');
});

test('returned capability rows are frozen (immutable)', () => {
  const caps = getCapabilities('web');
  assert.ok(Object.isFrozen(caps));
  assert.throws(() => {
    // @ts-expect-error — runtime immutability check
    caps.localApiReachable = false;
  }, TypeError);
  // matrix value unchanged
  assert.equal(getCapabilities('web').localApiReachable, true);
});

test('a consumer can read any field generically for both modes (forward-extensible)', () => {
  // Demonstrates the contract: consumers read fields through the typed accessor,
  // so adding a new field surfaces for both modes with no consumer change.
  for (const mode of ['web', 'desktop'] as const) {
    const caps = getCapabilities(mode);
    for (const field of CAPABILITY_FIELDS) {
      assert.ok(field in caps);
    }
  }
});
