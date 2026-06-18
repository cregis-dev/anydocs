// =============================================================================
// Story 9.7 — cold-start budget statistics + enforcement (NFR26) unit tests.
//
// Exercises the pure budget/percentile contract headless. The actual 20-run
// measurement (AC1) is produced by scripts/bench-desktop-cold-start.mjs against
// a packaged build; this suite proves the math, the pass/fail decision, and the
// regression message that names the change scope (AC3).
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  COLD_START_BUDGET_MS,
  COLD_START_MIN_RUNS,
  COLD_START_PERCENTILE,
  evaluateColdStart,
  formatTrendRecord,
  parseColdStartMarker,
  parseTrendRecords,
  percentile,
  type ColdStartSample,
} from './cold-start-budget.ts';

function samples(msValues: number[]): ColdStartSample[] {
  return msValues.map((ms, i) => ({ run: i + 1, ms }));
}

test('budget constants match NFR26', () => {
  assert.equal(COLD_START_BUDGET_MS, 3000);
  assert.equal(COLD_START_PERCENTILE, 95);
  assert.equal(COLD_START_MIN_RUNS, 20);
});

test('percentile uses nearest-rank and is order-independent', () => {
  const values = [10, 50, 20, 40, 30];
  assert.equal(percentile(values, 0), 10);
  assert.equal(percentile(values, 50), 30);
  assert.equal(percentile(values, 100), 50);
  // 20 sorted values 1..20: p95 -> ceil(0.95*20)=19 -> 19th value.
  const twenty = Array.from({ length: 20 }, (_v, i) => i + 1);
  assert.equal(percentile(twenty, 95), 19);
  assert.equal(percentile([], 95), 0);
  assert.equal(percentile([NaN, 5, Infinity], 50), 5);
});

test('evaluateColdStart passes when p95 is within budget over enough runs', () => {
  // 20 runs all ≤ 3000ms.
  const evalResult = evaluateColdStart(samples(Array.from({ length: 20 }, () => 1800)));
  assert.equal(evalResult.runs, 20);
  assert.equal(evalResult.p95, 1800);
  assert.equal(evalResult.withinBudget, true);
  assert.equal(evalResult.enoughRuns, true);
  assert.match(evalResult.message, /within 3000ms budget over 20 runs/);
});

test('evaluateColdStart fails and names the scope when p95 exceeds budget', () => {
  // 19 fast runs + 1 slow outlier pushes p95 over 3000ms (nearest-rank picks the 19th).
  const ms = [...Array.from({ length: 18 }, () => 1500), 3200, 4000];
  const evalResult = evaluateColdStart(samples(ms), { scope: 'abc1234 desktop shell', minRuns: 20 });
  assert.equal(evalResult.withinBudget, false);
  assert.ok(evalResult.p95 > COLD_START_BUDGET_MS, `p95 ${evalResult.p95} should exceed budget`);
  assert.match(evalResult.message, /Cold-start budget exceeded/);
  assert.match(evalResult.message, /Regressing change scope: abc1234 desktop shell\./);
});

test('evaluateColdStart flags too-few runs even when within budget', () => {
  const evalResult = evaluateColdStart(samples([1200, 1300, 1400]));
  assert.equal(evalResult.withinBudget, true);
  assert.equal(evalResult.enoughRuns, false);
  assert.match(evalResult.message, /only 3\/20 runs recorded/);
});

test('evaluateColdStart with no samples is not a vacuous pass', () => {
  const evalResult = evaluateColdStart([]);
  assert.equal(evalResult.runs, 0);
  assert.equal(evalResult.withinBudget, false);
  assert.equal(evalResult.enoughRuns, false);
  assert.match(evalResult.message, /No cold-start samples recorded/);
});

test('NDJSON trend records round-trip and tolerate malformed lines', () => {
  const recs = samples([1000, 2000]).map((s) => ({ ...s, ts: '2026-06-19T00:00:00.000Z' }));
  const body = recs.map(formatTrendRecord).join('') + 'not json\n\n{"partial":true}\n';
  const parsed = parseTrendRecords(body);
  assert.equal(parsed.length, 2);
  assert.deepEqual(
    parsed.map((s) => s.ms),
    [1000, 2000],
  );
});

test('parseColdStartMarker extracts the bench stdout sample', () => {
  assert.equal(parseColdStartMarker('ANYDOCS_COLD_START_MS=1842'), 1842);
  assert.equal(parseColdStartMarker('noise ANYDOCS_COLD_START_MS=2500 trailing'), 2500);
  assert.equal(parseColdStartMarker('unrelated output'), null);
});
