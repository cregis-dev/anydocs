// =============================================================================
// @anydocs/editor — Contract CLI (update / check)
// -----------------------------------------------------------------------------
// Two commands:
//
//   contract:update — regenerates contract/contract.json from the extractor.
//                     Run intentionally when changing the public surface.
//
//   contract:check  — re-extracts the contract, compares against the committed
//                     contract/contract.json, prints a structured diff on
//                     divergence, and exits non-zero. Wired into the regression
//                     gate via tests/contract-snapshot.test.ts (Story 6.5).
// =============================================================================

import { readFileSync, writeFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import {
  CONTRACT_SNAPSHOT_PATH,
  extractContract,
  serializeSnapshot,
  type ContractSnapshot,
} from './extract-contract.ts';
import { diffSnapshots, formatDiff } from './contract-diff.ts';

function runUpdate(): void {
  const snapshot = extractContract();
  writeFileSync(CONTRACT_SNAPSHOT_PATH, serializeSnapshot(snapshot), 'utf8');
  // eslint-disable-next-line no-console
  console.log(`Wrote ${snapshot.symbols.length} symbol(s) to contract/contract.json.`);
}

function runCheck(): void {
  const actual = extractContract();
  const expected = readCommittedSnapshot();
  const diff = diffSnapshots(expected, actual);
  if (diff.ok) {
    // eslint-disable-next-line no-console
    console.log(formatDiff(diff));
    return;
  }
  // eslint-disable-next-line no-console
  console.error(formatDiff(diff));
  process.exit(1);
}

function readCommittedSnapshot(): ContractSnapshot {
  let raw: string;
  try {
    raw = readFileSync(CONTRACT_SNAPSHOT_PATH, 'utf8');
  } catch (cause) {
    const message =
      cause instanceof Error
        ? `contract/contract.json is missing or unreadable (${cause.message}). Run \`pnpm --filter @anydocs/editor contract:update\` to generate it.`
        : 'contract/contract.json is missing. Run `pnpm --filter @anydocs/editor contract:update` to generate it.';
    throw new Error(message);
  }
  return JSON.parse(raw) as ContractSnapshot;
}

export function main(): void {
  const command = process.argv[2];
  if (command === 'update') {
    runUpdate();
    return;
  }
  if (command === 'check') {
    runCheck();
    return;
  }
  // eslint-disable-next-line no-console
  console.error('Usage: contract-cli <update|check>');
  process.exit(2);
}

// Top-level execution is guarded so importing this module (e.g. from a test)
// does not write contract.json or call process.exit. The CLI only runs when
// this file is the script Node was invoked with.
function isDirectInvocation(): boolean {
  if (!process.argv[1]) {
    return false;
  }
  try {
    const invokedPath = realpathSync(process.argv[1]);
    const modulePath = realpathSync(fileURLToPath(import.meta.url));
    return path.resolve(invokedPath) === path.resolve(modulePath);
  } catch {
    return false;
  }
}

if (isDirectInvocation()) {
  main();
}
