// =============================================================================
// Desktop cold-start budget — Story 9.7 (NFR26).
//
// Pure, node-free statistics + budget evaluation for the desktop cold-start
// harness. The Rust shell records a process-start `Instant`; the renderer calls
// the `report_cold_start` command once the editor is editable, which (in bench
// mode) prints `ANYDOCS_COLD_START_MS=<n>`. The launcher
// (scripts/bench-desktop-cold-start.mjs) collects one sample per cold launch,
// appends them to an NDJSON trend file (AC2 — per-run timing for trend
// analysis), and calls `evaluateColdStart` to enforce the p95 ≤ 3s budget
// (AC1 / AC3 — fail with a message that names the change scope).
//
// This module owns the math and the pass/fail contract so it is unit-testable
// headless; the launcher and Rust/renderer instrumentation are the I/O around it.
// =============================================================================

/** NFR26: 95th-percentile time-to-editable budget, in milliseconds. */
export const COLD_START_BUDGET_MS = 3000;
/** The percentile NFR26 is measured at. */
export const COLD_START_PERCENTILE = 95;
/** AC1: the budget is evaluated across this many cold runs. */
export const COLD_START_MIN_RUNS = 20;

export type ColdStartSample = {
  /** 1-based run index within a harness session. */
  run: number;
  /** Time-to-editable for this run, in milliseconds. */
  ms: number;
  /** ISO timestamp the sample was recorded (optional; for trend analysis). */
  ts?: string;
  /** Change scope this sample belongs to (e.g. a git short sha or label). */
  scope?: string;
};

export type ColdStartEvaluation = {
  runs: number;
  p50: number;
  p95: number;
  min: number;
  max: number;
  budgetMs: number;
  percentile: number;
  /** True when p95 ≤ budget. Vacuously false when there are no samples. */
  withinBudget: boolean;
  /** True when runs ≥ the required sample count. */
  enoughRuns: boolean;
  /** Human-readable pass/fail line; on failure it names the change scope. */
  message: string;
};

export type EvaluateColdStartOptions = {
  budgetMs?: number;
  percentile?: number;
  minRuns?: number;
  /** Change scope for the failure message (git sha, branch, or label). */
  scope?: string;
};

/**
 * Nearest-rank percentile over a numeric sample. Returns 0 for an empty input.
 * `p` is a percentage in [0, 100].
 */
export function percentile(values: number[], p: number): number {
  const sorted = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (sorted.length === 0) return 0;
  const clampedP = Math.min(100, Math.max(0, p));
  const rank = Math.ceil((clampedP / 100) * sorted.length);
  const index = Math.min(sorted.length - 1, Math.max(0, rank - 1));
  return sorted[index]!;
}

/** Keep only the valid (finite, non-negative) timing values from samples. */
function validTimings(samples: ColdStartSample[]): number[] {
  return samples
    .map((sample) => sample.ms)
    .filter((ms) => Number.isFinite(ms) && ms >= 0);
}

/**
 * Evaluate cold-start samples against the NFR26 budget. The returned `message`
 * names the change scope when the budget is exceeded so a CI failure points at
 * the regressing change (AC3).
 */
export function evaluateColdStart(
  samples: ColdStartSample[],
  options: EvaluateColdStartOptions = {},
): ColdStartEvaluation {
  const budgetMs = options.budgetMs ?? COLD_START_BUDGET_MS;
  const pct = options.percentile ?? COLD_START_PERCENTILE;
  const minRuns = options.minRuns ?? COLD_START_MIN_RUNS;
  const scope = options.scope?.trim() || 'unknown change scope';

  const timings = validTimings(samples);
  const runs = timings.length;
  const p50 = percentile(timings, 50);
  const pHigh = percentile(timings, pct);
  const min = runs === 0 ? 0 : Math.min(...timings);
  const max = runs === 0 ? 0 : Math.max(...timings);
  const enoughRuns = runs >= minRuns;
  const withinBudget = runs > 0 && pHigh <= budgetMs;

  let message: string;
  if (runs === 0) {
    message =
      `No cold-start samples recorded. Run scripts/bench-desktop-cold-start.mjs ` +
      `against a packaged build to capture ${minRuns} runs.`;
  } else if (!withinBudget) {
    message =
      `Cold-start budget exceeded: p${pct} ${pHigh}ms > ${budgetMs}ms (NFR26) ` +
      `over ${runs} run(s) [p50 ${p50}ms, max ${max}ms]. ` +
      `Regressing change scope: ${scope}.`;
  } else if (!enoughRuns) {
    message =
      `Cold-start p${pct} ${pHigh}ms within ${budgetMs}ms budget, but only ${runs}/${minRuns} ` +
      `runs recorded — capture the full sample before treating this as a pass.`;
  } else {
    message = `Cold-start p${pct} ${pHigh}ms within ${budgetMs}ms budget over ${runs} runs [p50 ${p50}ms, max ${max}ms].`;
  }

  return {
    runs,
    p50,
    p95: pHigh,
    min,
    max,
    budgetMs,
    percentile: pct,
    withinBudget,
    enoughRuns,
    message,
  };
}

/** Serialize one trend record as a single NDJSON line (trailing newline). */
export function formatTrendRecord(sample: ColdStartSample): string {
  return JSON.stringify(sample) + '\n';
}

/** Parse an NDJSON trend file body into samples, skipping blank/invalid lines. */
export function parseTrendRecords(body: string): ColdStartSample[] {
  const samples: ColdStartSample[] = [];
  for (const line of body.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed = JSON.parse(trimmed) as ColdStartSample;
      if (typeof parsed?.ms === 'number' && typeof parsed?.run === 'number') {
        samples.push(parsed);
      }
    } catch {
      // ignore malformed lines — a partial run should not poison the trend
    }
  }
  return samples;
}

/** Parse the launcher's bench stdout marker `ANYDOCS_COLD_START_MS=<n>`. */
export const COLD_START_STDOUT_RE = /ANYDOCS_COLD_START_MS=(\d+)/;

export function parseColdStartMarker(line: string): number | null {
  const match = COLD_START_STDOUT_RE.exec(line);
  if (!match) return null;
  const ms = Number.parseInt(match[1]!, 10);
  return Number.isFinite(ms) ? ms : null;
}
