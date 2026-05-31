// =============================================================================
// Contract snapshot — load-bearing CI gate (Story 6.5 AC5).
//
// Re-extracts the @anydocs/editor public surface and asserts it matches the
// committed contract/contract.json byte-for-byte. Any drift fails the root
// `pnpm test` regression gate, which CI runs on every PR.
//
// If this test fails after an intentional contract change, run:
//   pnpm --filter @anydocs/editor contract:update
// and commit the resulting contract/contract.json in the same PR.
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  CONTRACT_SNAPSHOT_PATH,
  extractContract,
  type ContractSnapshot,
} from '../scripts/extract-contract.ts';
import { diffSnapshots, formatDiff } from '../scripts/contract-diff.ts';

test('committed contract/contract.json matches the extracted public surface', () => {
  const actual = extractContract();
  const expected = JSON.parse(readFileSync(CONTRACT_SNAPSHOT_PATH, 'utf8')) as ContractSnapshot;
  const diff = diffSnapshots(expected, actual);
  assert.equal(
    diff.ok,
    true,
    `\n${formatDiff(diff)}\n`,
  );
});

test('committed contract.json declares exactly the 5 symbols from Story 6.1 AC2', () => {
  const expected = JSON.parse(readFileSync(CONTRACT_SNAPSHOT_PATH, 'utf8')) as ContractSnapshot;
  const names = expected.symbols.map((symbol) => symbol.name).sort();
  assert.deepEqual(
    names,
    ['EditorConfig', 'EditorInstance', 'EditorPlugin', 'createEditor', 'registerPlugin'].sort(),
    'contract.json must declare exactly the five symbols frozen by Story 6.1',
  );
});

test('contract.json snapshot header fields are stable', () => {
  const expected = JSON.parse(readFileSync(CONTRACT_SNAPSHOT_PATH, 'utf8')) as ContractSnapshot;
  assert.equal(expected.version, 1, 'snapshot schema version must be 1');
  assert.equal(expected.package, '@anydocs/editor', 'snapshot must declare the package name');
  assert.equal(
    expected.generatedFrom,
    'contract/public-api.ts',
    'snapshot must record the canonical source path',
  );
});
