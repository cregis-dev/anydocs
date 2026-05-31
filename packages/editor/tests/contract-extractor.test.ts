// =============================================================================
// Contract extractor — stability + drift detection (Story 6.5 AC7).
//
// All cases drive the extractor against in-memory source strings via
// `extractContractFromSource` so the on-disk contract file is never touched.
// Stability cases assert that cosmetic noise (JSDoc, whitespace, declaration
// order) produces the same snapshot. Drift cases assert that substantive
// changes (added/removed/renamed symbol, signature change) produce a diff.
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  extractContractFromSource,
  type ContractSnapshot,
} from '../scripts/extract-contract.ts';

const BASELINE_SOURCE = `
/** Test config. */
export type EditorConfig = {
  initialContent: unknown;
  plugins?: ReadonlyArray<EditorPlugin>;
};

export type EditorPlugin = {
  blockType: string;
  schemaFragment: unknown;
};

/** Factory. */
export function createEditor(config: EditorConfig): EditorInstance {
  throw new Error('not implemented');
}

export type EditorInstance = {
  mount(target: HTMLElement): () => void;
};

export function registerPlugin(plugin: EditorPlugin): void {}
`;

function symbolNames(snapshot: ContractSnapshot): string[] {
  return snapshot.symbols.map((symbol) => symbol.name);
}

test('extractor sorts symbols by name ascending', () => {
  const snapshot = extractContractFromSource(BASELINE_SOURCE);
  const names = symbolNames(snapshot);
  const sorted = [...names].sort();
  assert.deepEqual(names, sorted, 'extractor must emit symbols in sorted order');
});

test('extractor captures the five expected symbols', () => {
  const snapshot = extractContractFromSource(BASELINE_SOURCE);
  assert.deepEqual(
    symbolNames(snapshot).sort(),
    ['EditorConfig', 'EditorInstance', 'EditorPlugin', 'createEditor', 'registerPlugin'].sort(),
  );
});

test('classifies functions as kind=function and type aliases as kind=type', () => {
  const snapshot = extractContractFromSource(BASELINE_SOURCE);
  const byName = new Map(snapshot.symbols.map((symbol) => [symbol.name, symbol]));
  assert.equal(byName.get('createEditor')?.kind, 'function');
  assert.equal(byName.get('registerPlugin')?.kind, 'function');
  assert.equal(byName.get('EditorConfig')?.kind, 'type');
  assert.equal(byName.get('EditorInstance')?.kind, 'type');
  assert.equal(byName.get('EditorPlugin')?.kind, 'type');
});

// ---------------------------------------------------------------------------
// Stability cases — cosmetic noise must produce identical output.
// ---------------------------------------------------------------------------

test('stability: JSDoc edits do not change the snapshot', () => {
  const withJsdoc = BASELINE_SOURCE.replace('/** Test config. */', '/** A long replacement docstring that should not affect the contract surface at all. */');
  const a = extractContractFromSource(BASELINE_SOURCE);
  const b = extractContractFromSource(withJsdoc);
  assert.deepEqual(a, b, 'JSDoc-only edits must not surface in the snapshot');
});

test('stability: declaration reordering does not change the snapshot', () => {
  const reordered = `
export function registerPlugin(plugin: EditorPlugin): void {}

export type EditorPlugin = {
  blockType: string;
  schemaFragment: unknown;
};

export type EditorInstance = {
  mount(target: HTMLElement): () => void;
};

export function createEditor(config: EditorConfig): EditorInstance {
  throw new Error('not implemented');
}

export type EditorConfig = {
  initialContent: unknown;
  plugins?: ReadonlyArray<EditorPlugin>;
};
`;
  const a = extractContractFromSource(BASELINE_SOURCE);
  const b = extractContractFromSource(reordered);
  assert.deepEqual(a, b, 'declaration order must not affect the snapshot (extractor sorts by name)');
});

test('stability: trailing/leading whitespace does not change the snapshot', () => {
  const padded = `\n\n\n${BASELINE_SOURCE}\n\n\n`;
  const a = extractContractFromSource(BASELINE_SOURCE);
  const b = extractContractFromSource(padded);
  assert.deepEqual(a, b);
});

test('stability: extra blank lines between declarations do not change the snapshot', () => {
  const spaced = BASELINE_SOURCE.replace(/\n\n/g, '\n\n\n\n');
  const a = extractContractFromSource(BASELINE_SOURCE);
  const b = extractContractFromSource(spaced);
  assert.deepEqual(a, b);
});

// ---------------------------------------------------------------------------
// Drift cases — substantive changes must produce a diff.
// ---------------------------------------------------------------------------

test('drift: adding a new exported function surfaces a new symbol', () => {
  const augmented = `${BASELINE_SOURCE}\nexport function brandNewExport(): void {}\n`;
  const baseline = extractContractFromSource(BASELINE_SOURCE);
  const changed = extractContractFromSource(augmented);
  assert.notDeepEqual(changed, baseline);
  assert.ok(
    changed.symbols.some((symbol) => symbol.name === 'brandNewExport'),
    'new export must appear in symbols array',
  );
  assert.equal(changed.symbols.length, baseline.symbols.length + 1);
});

test('drift: removing an exported function drops a symbol', () => {
  const reduced = BASELINE_SOURCE.replace(
    'export function registerPlugin(plugin: EditorPlugin): void {}',
    '',
  );
  const baseline = extractContractFromSource(BASELINE_SOURCE);
  const changed = extractContractFromSource(reduced);
  assert.notDeepEqual(changed, baseline);
  assert.ok(
    !changed.symbols.some((symbol) => symbol.name === 'registerPlugin'),
    'removed export must not appear',
  );
});

test('drift: renaming an exported function surfaces both a removal and an addition', () => {
  const renamed = BASELINE_SOURCE.replace(
    'export function registerPlugin(plugin: EditorPlugin): void {}',
    'export function registerThing(plugin: EditorPlugin): void {}',
  );
  const baseline = extractContractFromSource(BASELINE_SOURCE);
  const changed = extractContractFromSource(renamed);
  assert.notDeepEqual(changed, baseline);
  const names = changed.symbols.map((symbol) => symbol.name);
  assert.ok(names.includes('registerThing'), 'new name must appear');
  assert.ok(!names.includes('registerPlugin'), 'old name must not appear');
});

test('drift: changing a function parameter type surfaces a signature-change', () => {
  const widened = BASELINE_SOURCE.replace(
    'export function createEditor(config: EditorConfig): EditorInstance',
    'export function createEditor(config: EditorConfig, hooks: unknown): EditorInstance',
  );
  const baseline = extractContractFromSource(BASELINE_SOURCE);
  const changed = extractContractFromSource(widened);
  const baselineSig = baseline.symbols.find((symbol) => symbol.name === 'createEditor')?.signature;
  const changedSig = changed.symbols.find((symbol) => symbol.name === 'createEditor')?.signature;
  assert.notEqual(changedSig, baselineSig, 'signature must change when parameters change');
  assert.match(changedSig ?? '', /hooks/, 'new parameter must appear in signature');
});

test('drift: changing a type alias body surfaces a signature-change', () => {
  const widened = BASELINE_SOURCE.replace(
    'export type EditorPlugin = {\n  blockType: string;\n  schemaFragment: unknown;\n};',
    'export type EditorPlugin = {\n  blockType: string;\n  schemaFragment: unknown;\n  newField: number;\n};',
  );
  const baseline = extractContractFromSource(BASELINE_SOURCE);
  const changed = extractContractFromSource(widened);
  const baselineSig = baseline.symbols.find((symbol) => symbol.name === 'EditorPlugin')?.signature;
  const changedSig = changed.symbols.find((symbol) => symbol.name === 'EditorPlugin')?.signature;
  assert.notEqual(changedSig, baselineSig);
  assert.match(changedSig ?? '', /newField/);
});

// ---------------------------------------------------------------------------
// Exotic-but-supported shapes — confirm classification stays sensible.
// ---------------------------------------------------------------------------

test('extractor handles exported interfaces with kind=type', () => {
  const source = `
export interface ISomething {
  foo: string;
}
`;
  const snapshot = extractContractFromSource(source);
  assert.equal(snapshot.symbols.length, 1);
  assert.equal(snapshot.symbols[0]?.name, 'ISomething');
  assert.equal(snapshot.symbols[0]?.kind, 'type');
});

test('extractor handles exported classes with kind=type', () => {
  const source = `
export class Widget {
  doIt(): void {}
}
`;
  const snapshot = extractContractFromSource(source);
  assert.equal(snapshot.symbols.length, 1);
  assert.equal(snapshot.symbols[0]?.name, 'Widget');
  assert.equal(snapshot.symbols[0]?.kind, 'type');
});

test('extractor strips function bodies from signatures', () => {
  const source = `
export function withBigBody(): void {
  const huge = 'a really really long body that should not appear in the contract surface';
  console.log(huge);
}
`;
  const snapshot = extractContractFromSource(source);
  const signature = snapshot.symbols[0]?.signature ?? '';
  assert.doesNotMatch(signature, /huge/, 'function body must not appear in the snapshot signature');
  assert.doesNotMatch(signature, /console\.log/, 'function body must not appear in the snapshot signature');
});

test('extractor ignores non-exported declarations', () => {
  const source = `
function internalHelper(): void {}
type InternalType = string;
export function publicEntry(): void {}
`;
  const snapshot = extractContractFromSource(source);
  assert.equal(snapshot.symbols.length, 1, 'only exported declarations should be tracked');
  assert.equal(snapshot.symbols[0]?.name, 'publicEntry');
});

// ---------------------------------------------------------------------------
// Regression tests for review findings (see Story 6.5 code-review).
// ---------------------------------------------------------------------------

test('regression M3: multi-declaration `export const a = 1, b = 2;` produces distinct per-symbol signatures', () => {
  const source = `
export const a: number = 1, b: string = 'two';
`;
  const snapshot = extractContractFromSource(source);
  assert.equal(snapshot.symbols.length, 2, 'each declaration must surface as its own symbol');
  const byName = new Map(snapshot.symbols.map((symbol) => [symbol.name, symbol]));
  const sigA = byName.get('a')?.signature ?? '';
  const sigB = byName.get('b')?.signature ?? '';
  assert.notEqual(sigA, sigB, 'two symbols from one multi-declarator statement must NOT share a signature');
  assert.match(sigA, /\ba\b/, "symbol `a` signature must contain its own name");
  assert.doesNotMatch(sigA, /\bb\b/, "symbol `a` signature must NOT contain the sibling name `b`");
  assert.match(sigB, /\bb\b/, "symbol `b` signature must contain its own name");
  assert.doesNotMatch(sigB, /\ba\b/, "symbol `b` signature must NOT contain the sibling name `a`");
});

test('regression M2: extractor refuses ExportDeclaration re-exports with a clear error', () => {
  const source = `
export { foo, bar } from './internal.ts';
`;
  assert.throws(
    () => extractContractFromSource(source),
    /re-export declarations are not supported/i,
    'ExportDeclaration must throw rather than silently dropping the re-exported symbols',
  );
});

test('regression M2: extractor refuses `export * from` re-exports', () => {
  const source = `
export * from './internal.ts';
`;
  assert.throws(
    () => extractContractFromSource(source),
    /re-export declarations are not supported/i,
    '`export *` must throw rather than silently dropping the whole sub-module',
  );
});
