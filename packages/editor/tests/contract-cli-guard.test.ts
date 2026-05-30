// =============================================================================
// Contract CLI guard — regression test for review finding M4.
//
// Importing `scripts/contract-cli.ts` MUST NOT trigger its `main()` function,
// because `main()` either rewrites `contract.json` or calls `process.exit`.
// The guard `isDirectInvocation()` ensures `main()` only fires when the CLI
// is invoked directly via `node scripts/contract-cli.ts <cmd>`.
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { CONTRACT_SNAPSHOT_PATH } from '../scripts/extract-contract.ts';

test('regression M4: importing contract-cli.ts does NOT execute main() at module load', async () => {
  const before = readFileSync(CONTRACT_SNAPSHOT_PATH, 'utf8');

  // Dynamic import — if main() ran on import, it would either rewrite the
  // snapshot or call process.exit(2) (no command → exit code 2). The import
  // completing normally + the snapshot bytes being unchanged is the proof.
  const moduleExports = await import('../scripts/contract-cli.ts');

  const after = readFileSync(CONTRACT_SNAPSHOT_PATH, 'utf8');
  assert.equal(before, after, 'importing the CLI module must not rewrite contract.json');
  assert.equal(typeof moduleExports.main, 'function', 'main() must be exported for explicit invocation if needed');
});
