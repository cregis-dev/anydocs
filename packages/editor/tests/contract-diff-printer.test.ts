// =============================================================================
// Contract diff printer — message structure tests (Story 6.5 AC4).
//
// Verifies that each divergence class produces a uniquely identifiable line
// prefix and that every drift message instructs the developer to run
// `pnpm --filter @anydocs/editor contract:update`.
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';

import type { ContractSnapshot } from '../scripts/extract-contract.ts';
import { diffSnapshots, formatDiff } from '../scripts/contract-diff.ts';

function snapshotOf(symbols: ContractSnapshot['symbols']): ContractSnapshot {
  return {
    version: 1,
    package: '@anydocs/editor',
    generatedFrom: 'contract/public-api.ts',
    symbols,
  };
}

const BASELINE: ContractSnapshot = snapshotOf([
  { name: 'createEditor', kind: 'function', signature: 'export function createEditor(config: EditorConfig): EditorInstance;' },
  { name: 'EditorConfig', kind: 'type', signature: 'export type EditorConfig = { initialContent: unknown; };' },
]);

test('matching snapshots produce an OK result with no entries', () => {
  const result = diffSnapshots(BASELINE, BASELINE);
  assert.equal(result.ok, true);
  assert.equal(result.entries.length, 0);
  assert.match(formatDiff(result), /in sync/);
});

test('added symbol surfaces as a `+ added:` line', () => {
  const actual = snapshotOf([
    ...BASELINE.symbols,
    { name: 'brandNew', kind: 'function', signature: 'export function brandNew(): void;' },
  ]);
  const result = diffSnapshots(BASELINE, actual);
  assert.equal(result.ok, false);
  const added = result.entries.find((entry) => entry.type === 'added');
  assert.ok(added, 'must contain an added entry');
  const printed = formatDiff(result);
  assert.match(printed, /\+ added:\s+brandNew/, 'printer must show + added: with the symbol name');
});

test('removed symbol surfaces as a `- removed:` line', () => {
  const actual = snapshotOf(BASELINE.symbols.filter((symbol) => symbol.name !== 'createEditor'));
  const result = diffSnapshots(BASELINE, actual);
  assert.equal(result.ok, false);
  const removed = result.entries.find((entry) => entry.type === 'removed');
  assert.ok(removed, 'must contain a removed entry');
  const printed = formatDiff(result);
  assert.match(printed, /- removed:\s+createEditor/, 'printer must show - removed: with the symbol name');
});

test('signature change surfaces as a `~ changed:` line with expected + actual signatures', () => {
  const actual = snapshotOf([
    {
      name: 'createEditor',
      kind: 'function',
      signature: 'export function createEditor(config: EditorConfig, hooks: EditorHooks): EditorInstance;',
    },
    BASELINE.symbols[1]!,
  ]);
  const result = diffSnapshots(BASELINE, actual);
  assert.equal(result.ok, false);
  const changed = result.entries.find((entry) => entry.type === 'signature-change');
  assert.ok(changed, 'must contain a signature-change entry');
  const printed = formatDiff(result);
  assert.match(printed, /~ changed:\s+createEditor\s+signature-change/, 'printer must classify the change');
  assert.match(printed, /expected:.*EditorConfig\)/, 'printer must include the expected signature');
  assert.match(printed, /actual:.*hooks: EditorHooks/, 'printer must include the actual signature');
});

test('renamed symbol heuristic: added+removed with identical signature pair as `renamed`', () => {
  const renamed = snapshotOf([
    { name: 'EditorConfig', kind: 'type', signature: 'export type EditorConfig = { initialContent: unknown; };' },
    {
      name: 'spawnEditor',
      kind: 'function',
      signature: 'export function spawnEditor(config: EditorConfig): EditorInstance;',
    },
  ]);
  const result = diffSnapshots(BASELINE, renamed);
  assert.equal(result.ok, false);
  const rename = result.entries.find((entry) => entry.type === 'renamed');
  assert.ok(rename, 'must classify as renamed when removed/added share signature shape');
  const printed = formatDiff(result);
  assert.match(printed, /~ renamed:\s+createEditor -> spawnEditor/, 'printer must show old -> new name');
});

test('rename heuristic is signature-aware: added+removed with different signatures do NOT pair as renamed', () => {
  const notRenamed = snapshotOf([
    BASELINE.symbols[1]!,
    {
      name: 'totallyDifferentThing',
      kind: 'function',
      signature: 'export function totallyDifferentThing(arg: number): boolean;',
    },
  ]);
  const result = diffSnapshots(BASELINE, notRenamed);
  assert.equal(result.ok, false);
  const rename = result.entries.find((entry) => entry.type === 'renamed');
  assert.equal(rename, undefined, 'must not pair into a rename when signatures differ');
  const added = result.entries.find((entry) => entry.type === 'added');
  const removed = result.entries.find((entry) => entry.type === 'removed');
  assert.ok(added && removed, 'both unrelated changes must surface independently');
});

test('rename heuristic is kind-aware: cannot pair a function with a type alias', () => {
  const swapped = snapshotOf([
    BASELINE.symbols[1]!,
    { name: 'spawnEditor', kind: 'type', signature: 'export type spawnEditor = { foo: number; };' },
  ]);
  const result = diffSnapshots(BASELINE, swapped);
  const rename = result.entries.find((entry) => entry.type === 'renamed');
  assert.equal(rename, undefined, 'kinds must match for the rename heuristic to fire');
});

test('drift output always tells the developer to run contract:update', () => {
  const actual = snapshotOf([
    ...BASELINE.symbols,
    { name: 'somethingNew', kind: 'function', signature: 'export function somethingNew(): void;' },
  ]);
  const result = diffSnapshots(BASELINE, actual);
  const printed = formatDiff(result);
  assert.match(printed, /pnpm --filter @anydocs\/editor contract:update/, 'remediation hint must be present');
  assert.match(printed, /If this change is intentional/, 'guidance must explain what to do');
});

test('drift output mentions the snapshot path so the user knows what to commit', () => {
  const actual = snapshotOf([
    ...BASELINE.symbols,
    { name: 'somethingNew', kind: 'function', signature: 'export function somethingNew(): void;' },
  ]);
  const result = diffSnapshots(BASELINE, actual);
  const printed = formatDiff(result);
  assert.match(printed, /contract\/contract\.json/, 'the snapshot path must appear in the drift message');
});
