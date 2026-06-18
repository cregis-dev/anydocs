// =============================================================================
// Story 9.7 — renderer cold-start reporter once-guard + runtime gating.
//
// Verifies reportColdStartReached() fires the desktop IPC at most once and is a
// no-op when there is no Tauri bridge (web runtime). jsdom provides `window`.
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';

import { JSDOM } from 'jsdom';

const jsdom = new JSDOM('<!DOCTYPE html><html><body></body></html>', { url: 'http://localhost/' });
for (const key of ['window', 'document'] as const) {
  const value = (jsdom.window as unknown as Record<string, unknown>)[key];
  try {
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  } catch {
    // skip accessor-only globals
  }
}

const { reportColdStartReached, __resetColdStartReporterForTests } = await import('./cold-start.ts');

function setInvoke(fn: ((cmd: string) => unknown) | undefined): void {
  (globalThis.window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = fn
    ? { invoke: fn }
    : undefined;
}

test('a web-runtime no-op does not burn the once-guard for a later desktop call', () => {
  __resetColdStartReporterForTests();
  setInvoke(undefined);
  reportColdStartReached(); // web: no bridge → nothing dispatched

  const calls: string[] = [];
  setInvoke((cmd) => {
    calls.push(cmd);
    return Promise.resolve(1500);
  });
  reportColdStartReached(); // desktop now available → must still fire
  assert.deepEqual(calls, ['report_cold_start']);
});

test('reportColdStartReached invokes report_cold_start exactly once on desktop', async () => {
  __resetColdStartReporterForTests();
  const calls: string[] = [];
  setInvoke((cmd) => {
    calls.push(cmd);
    return Promise.resolve(1500);
  });

  reportColdStartReached();
  reportColdStartReached();
  reportColdStartReached();
  // Let the fire-and-forget promise settle.
  await Promise.resolve();

  assert.deepEqual(calls, ['report_cold_start']);
});

test('a synchronous throw from invoke is swallowed and does not burn the guard', () => {
  __resetColdStartReporterForTests();
  setInvoke(() => {
    throw new Error('bridge malformed'); // sync throw, not a rejected promise
  });
  reportColdStartReached(); // must not throw out of the reporter

  const calls: string[] = [];
  setInvoke((cmd) => {
    calls.push(cmd);
    return Promise.resolve(1500);
  });
  reportColdStartReached(); // the earlier sync failure must not have disabled retry
  assert.deepEqual(calls, ['report_cold_start']);
});

test('a rejected report is swallowed (best-effort metric)', async () => {
  __resetColdStartReporterForTests();
  setInvoke(() => Promise.reject(new Error('command unavailable')));
  reportColdStartReached();
  await Promise.resolve();
  assert.ok(true, 'must not throw when the command rejects');
});
