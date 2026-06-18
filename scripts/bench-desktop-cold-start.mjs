#!/usr/bin/env node
// =============================================================================
// Desktop cold-start budget harness — Story 9.7 (NFR26).
//
// Launches a PACKAGED desktop build from cold N times, each in bench mode
// (ANYDOCS_COLD_START_BENCH=1), and reads the `ANYDOCS_COLD_START_MS=<n>` stdout
// marker the Rust `report_cold_start` command prints once the renderer reports
// the editor is editable. Each sample is appended to an NDJSON trend file (AC2),
// then the p95 ≤ 3s budget is enforced (AC1/AC3) with a message naming the
// change scope.
//
// Run AFTER packaging (`pnpm build:desktop`):
//   node --experimental-strip-types scripts/bench-desktop-cold-start.mjs \
//     [--runs 20] [--bin <path-to-app-binary>] [--project <project-dir>] [--scope <label>]
//
// Prerequisite the harness cannot supply itself: the packaged app must boot
// straight to an editable page (a locked project + active page). Pass --project
// (or ANYDOCS_BENCH_PROJECT) pointing at a project dir, e.g. examples/starter-docs.
// =============================================================================

import { spawn } from 'node:child_process';
import { mkdir, appendFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  COLD_START_MIN_RUNS,
  evaluateColdStart,
  formatTrendRecord,
  parseColdStartMarker,
} from '../packages/desktop/bench/cold-start-budget.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

function parseArgs(argv) {
  const out = { errors: [] };
  const readPositiveInt = (flag, raw) => {
    const n = Number.parseInt(raw, 10);
    if (!Number.isFinite(n) || n <= 0) {
      out.errors.push(`${flag} requires a positive integer (got ${raw === undefined ? '<missing>' : `"${raw}"`})`);
      return undefined;
    }
    return n;
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--runs') out.runs = readPositiveInt('--runs', argv[++i]);
    else if (arg === '--timeout') out.timeoutMs = readPositiveInt('--timeout', argv[++i]);
    else if (arg === '--bin') out.bin = argv[++i];
    else if (arg === '--project') out.project = argv[++i];
    else if (arg === '--scope') out.scope = argv[++i];
    else out.errors.push(`unknown argument: ${arg}`);
  }
  return out;
}

/** Resolve the packaged app's executable, trying common macOS/Linux locations. */
function resolveBinary(explicit) {
  const candidates = [
    explicit,
    process.env.ANYDOCS_DESKTOP_BIN,
    path.join(REPO_ROOT, 'packages/desktop/src-tauri/target/release/Anydocs.app/Contents/MacOS/Anydocs'),
    path.join(REPO_ROOT, 'packages/desktop/src-tauri/target/release/anydocs-desktop'),
    path.join(REPO_ROOT, 'packages/desktop/src-tauri/target/release/Anydocs'),
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

/** Spawn one cold launch; resolve with the editable elapsed-ms from the marker. */
function runOnce(binary, env, timeoutMs) {
  return new Promise((resolve, reject) => {
    // Parse the marker from stdout only, line by line — stderr is inherited (so
    // the app's diagnostics surface) and never mixed into the parse buffer, so
    // interleaved logs or a chunk split mid-line cannot corrupt or hide the marker.
    const child = spawn(binary, [], { env, stdio: ['ignore', 'pipe', 'inherit'] });
    let settled = false;
    let buffer = '';

    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        child.kill('SIGTERM');
      } catch {
        // already gone
      }
      fn(value);
    };

    const timer = setTimeout(
      () => finish(reject, new Error(`no cold-start marker within ${timeoutMs}ms`)),
      timeoutMs,
    );

    child.stdout.on('data', (chunk) => {
      buffer += chunk.toString();
      let newlineIndex;
      while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 1);
        const ms = parseColdStartMarker(line);
        if (ms !== null) {
          finish(resolve, ms);
          return;
        }
      }
    });
    child.on('error', (err) => finish(reject, err));
    child.on('exit', () => {
      if (!settled) finish(reject, new Error('app exited before reporting cold start'));
    });
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.errors.length > 0) {
    console.error(`Cold-start harness: invalid arguments:\n  ${args.errors.join('\n  ')}`);
    process.exit(2);
  }
  const runs = args.runs ?? COLD_START_MIN_RUNS;
  const timeoutMs = args.timeoutMs ?? 30_000;
  const scope = args.scope ?? process.env.ANYDOCS_BENCH_SCOPE ?? 'local desktop build';
  const project = args.project ?? process.env.ANYDOCS_BENCH_PROJECT;

  const binary = resolveBinary(args.bin);
  if (!binary) {
    console.error(
      'Cold-start harness: packaged desktop binary not found.\n' +
        '  Build it first: pnpm build:desktop\n' +
        '  Then pass --bin <path> or set ANYDOCS_DESKTOP_BIN.',
    );
    process.exit(2);
  }

  const childEnv = { ...process.env, ANYDOCS_COLD_START_BENCH: '1' };
  if (project) childEnv.ANYDOCS_BENCH_PROJECT = path.resolve(REPO_ROOT, project);

  const trendDir = path.join(REPO_ROOT, 'packages/desktop/bench/trend');
  await mkdir(trendDir, { recursive: true });
  const stamp = new Date().toISOString();
  const trendFile = path.join(trendDir, `cold-start-${stamp.slice(0, 10)}.ndjson`);

  console.log(`Cold-start harness: ${runs} runs of ${path.relative(REPO_ROOT, binary)} (budget p95 ≤ 3000ms)`);
  const samples = [];
  for (let run = 1; run <= runs; run += 1) {
    try {
      const ms = await runOnce(binary, childEnv, timeoutMs);
      const sample = { run, ms, ts: new Date().toISOString(), scope };
      samples.push(sample);
      await appendFile(trendFile, formatTrendRecord(sample));
      console.log(`  run ${run}/${runs}: ${ms}ms`);
    } catch (error) {
      console.error(`  run ${run}/${runs}: FAILED — ${error.message}`);
    }
  }

  const result = evaluateColdStart(samples, { scope });
  console.log(`\nTrend written to ${path.relative(REPO_ROOT, trendFile)}`);
  console.log(result.message);
  process.exit(result.withinBudget && result.enoughRuns ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(2);
});
