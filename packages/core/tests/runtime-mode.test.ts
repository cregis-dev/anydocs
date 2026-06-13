import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  __resetRuntimeModeForTests,
  getRuntimeMode,
  isRuntimeMode,
  resolveRuntimeMode,
} from '../src/runtime/runtime-mode.ts';
import { RuntimeModeResolutionError } from '../src/runtime/runtime-mode-error.ts';

type MutableGlobal = Record<string, unknown>;

afterEach(() => {
  __resetRuntimeModeForTests();
  delete (globalThis as MutableGlobal).__TAURI_INTERNALS__;
  delete (globalThis as MutableGlobal).__TAURI__;
});

test('resolves web from explicit injectedMode', () => {
  assert.equal(resolveRuntimeMode({ injectedMode: 'web' }), 'web');
  assert.equal(getRuntimeMode(), 'web');
});

test('resolves desktop from explicit injectedMode', () => {
  assert.equal(resolveRuntimeMode({ injectedMode: 'desktop' }), 'desktop');
  assert.equal(getRuntimeMode(), 'desktop');
});

test('resolves from ANYDOCS_RUNTIME_MODE env injection', () => {
  assert.equal(resolveRuntimeMode({ env: { ANYDOCS_RUNTIME_MODE: 'desktop' } }), 'desktop');
});

test('resolves desktop from the Tauri global probe (fallback only)', () => {
  (globalThis as MutableGlobal).__TAURI_INTERNALS__ = {};
  assert.equal(resolveRuntimeMode({ env: {} }), 'desktop');
});

test('fails fast when the environment is ambiguous', () => {
  assert.throws(
    () => resolveRuntimeMode({ env: {} }),
    (err: unknown) =>
      err instanceof RuntimeModeResolutionError && err.code === 'RUNTIME_MODE_AMBIGUOUS',
  );
});

test('rejects an invalid env injection and surfaces the offending value', () => {
  assert.throws(
    () => resolveRuntimeMode({ env: { ANYDOCS_RUNTIME_MODE: 'native' } }),
    (err: unknown) =>
      err instanceof RuntimeModeResolutionError &&
      err.code === 'RUNTIME_MODE_INVALID_INJECTION' &&
      err.details.metadata?.received === 'native',
  );
});

test('getRuntimeMode throws before resolution', () => {
  assert.throws(
    () => getRuntimeMode(),
    (err: unknown) =>
      err instanceof RuntimeModeResolutionError && err.code === 'RUNTIME_MODE_NOT_RESOLVED',
  );
});

test('repeated reads return the same immutable value', () => {
  resolveRuntimeMode({ injectedMode: 'web' });
  assert.equal(getRuntimeMode(), 'web');
  assert.equal(getRuntimeMode(), 'web');
});

test('a second resolve with a conflicting mode throws and leaves the cache intact', () => {
  resolveRuntimeMode({ injectedMode: 'web' });
  assert.throws(
    () => resolveRuntimeMode({ injectedMode: 'desktop' }),
    (err: unknown) =>
      err instanceof RuntimeModeResolutionError && err.code === 'RUNTIME_MODE_CONFLICT',
  );
  assert.equal(getRuntimeMode(), 'web');
});

test('a second resolve consistent with the cached mode returns the cached value', () => {
  resolveRuntimeMode({ injectedMode: 'desktop' });
  // same explicit mode
  assert.equal(resolveRuntimeMode({ injectedMode: 'desktop' }), 'desktop');
  // no new injection / no probe → returns cached without re-resolving
  assert.equal(resolveRuntimeMode({ env: {} }), 'desktop');
});

test('isRuntimeMode narrows valid modes and rejects others', () => {
  assert.equal(isRuntimeMode('web'), true);
  assert.equal(isRuntimeMode('desktop'), true);
  assert.equal(isRuntimeMode('native'), false);
  assert.equal(isRuntimeMode(undefined), false);
  assert.equal(isRuntimeMode(42), false);
});
