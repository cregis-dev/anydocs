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

function setInvoke(fn: ((cmd: string) => Promise<unknown>) | undefined): void {
  (globalThis.window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = fn
    ? { invoke: fn }
    : undefined;
}

test('reportColdStartReached is a no-op without a Tauri bridge (web runtime)', () => {
  __resetColdStartReporterForTests();
  setInvoke(undefined);
  // Must not throw and must not require any bridge.
  reportColdStartReached();
  assert.ok(true);
});

test('reportColdStartReached invokes report_cold_start exactly once on desktop', async () => {
  __resetColdStartReporterForTests();
  const calls: string[] = [];
  setInvoke(async (cmd: string) => {
    calls.push(cmd);
    return 1500;
  });

  reportColdStartReached();
  reportColdStartReached();
  reportColdStartReached();
  // Let the fire-and-forget promise settle.
  await Promise.resolve();

  assert.deepEqual(calls, ['report_cold_start']);
});

test('a rejected report is swallowed (best-effort metric)', async () => {
  __resetColdStartReporterForTests();
  setInvoke(async () => {
    throw new Error('command unavailable');
  });
  reportColdStartReached();
  await Promise.resolve();
  assert.ok(true, 'must not throw when the command rejects');
});
