// =============================================================================
// @anydocs/editor — Contract Diff Engine
// -----------------------------------------------------------------------------
// Compares two ContractSnapshot values and produces a structured diff used by
// the CLI's `check` command and the contract-diff-printer tests. Kept in its
// own module so the printer is unit-testable without spawning the CLI.
// =============================================================================

import type { ContractSnapshot, ContractSymbol, ContractSymbolKind } from './extract-contract.ts';

export type ContractDiffEntry =
  | { type: 'added'; name: string; kind: ContractSymbolKind; signature: string }
  | { type: 'removed'; name: string; kind: ContractSymbolKind; signature: string }
  | {
      type: 'renamed';
      from: string;
      to: string;
      kind: ContractSymbolKind;
      signature: string;
    }
  | {
      type: 'signature-change';
      name: string;
      kind: ContractSymbolKind;
      expectedSignature: string;
      actualSignature: string;
    };

export type ContractDiffResult = {
  ok: boolean;
  entries: ContractDiffEntry[];
};

export function diffSnapshots(expected: ContractSnapshot, actual: ContractSnapshot): ContractDiffResult {
  const expectedByName = new Map<string, ContractSymbol>(expected.symbols.map((symbol) => [symbol.name, symbol]));
  const actualByName = new Map<string, ContractSymbol>(actual.symbols.map((symbol) => [symbol.name, symbol]));

  const rawAdded: ContractSymbol[] = [];
  const rawRemoved: ContractSymbol[] = [];
  const signatureChanges: Array<{ name: string; kind: ContractSymbolKind; expectedSignature: string; actualSignature: string }> = [];

  for (const [name, actualSymbol] of actualByName) {
    const expectedSymbol = expectedByName.get(name);
    if (!expectedSymbol) {
      rawAdded.push(actualSymbol);
      continue;
    }
    if (expectedSymbol.signature !== actualSymbol.signature || expectedSymbol.kind !== actualSymbol.kind) {
      signatureChanges.push({
        name,
        kind: actualSymbol.kind,
        expectedSignature: expectedSymbol.signature,
        actualSignature: actualSymbol.signature,
      });
    }
  }

  for (const [name, expectedSymbol] of expectedByName) {
    if (!actualByName.has(name)) {
      rawRemoved.push(expectedSymbol);
    }
  }

  // Rename detection heuristic: pair an added and a removed when they share
  // the same `kind` and produce an identical signature (modulo the declared
  // name). The signature already includes the symbol name, so we normalize
  // it for comparison by substituting a placeholder name.
  const matchedAddIndexes = new Set<number>();
  const matchedRemoveIndexes = new Set<number>();
  const renames: Array<{ from: string; to: string; kind: ContractSymbolKind; signature: string }> = [];

  for (let removedIndex = 0; removedIndex < rawRemoved.length; removedIndex += 1) {
    const removedSymbol = rawRemoved[removedIndex]!;
    const removedNormalized = normalizeSignatureForRenameMatch(removedSymbol);
    for (let addedIndex = 0; addedIndex < rawAdded.length; addedIndex += 1) {
      if (matchedAddIndexes.has(addedIndex)) continue;
      const addedSymbol = rawAdded[addedIndex]!;
      if (addedSymbol.kind !== removedSymbol.kind) continue;
      const addedNormalized = normalizeSignatureForRenameMatch(addedSymbol);
      if (addedNormalized === removedNormalized) {
        renames.push({
          from: removedSymbol.name,
          to: addedSymbol.name,
          kind: addedSymbol.kind,
          signature: addedSymbol.signature,
        });
        matchedAddIndexes.add(addedIndex);
        matchedRemoveIndexes.add(removedIndex);
        break;
      }
    }
  }

  const finalAdded = rawAdded.filter((_, index) => !matchedAddIndexes.has(index));
  const finalRemoved = rawRemoved.filter((_, index) => !matchedRemoveIndexes.has(index));

  const entries: ContractDiffEntry[] = [];
  for (const symbol of finalAdded) {
    entries.push({ type: 'added', name: symbol.name, kind: symbol.kind, signature: symbol.signature });
  }
  for (const symbol of finalRemoved) {
    entries.push({ type: 'removed', name: symbol.name, kind: symbol.kind, signature: symbol.signature });
  }
  for (const rename of renames) {
    entries.push({ type: 'renamed', from: rename.from, to: rename.to, kind: rename.kind, signature: rename.signature });
  }
  for (const change of signatureChanges) {
    entries.push({
      type: 'signature-change',
      name: change.name,
      kind: change.kind,
      expectedSignature: change.expectedSignature,
      actualSignature: change.actualSignature,
    });
  }

  entries.sort((left, right) => sortKeyFor(left).localeCompare(sortKeyFor(right)));

  return { ok: entries.length === 0, entries };
}

function sortKeyFor(entry: ContractDiffEntry): string {
  if (entry.type === 'renamed') {
    return `${entry.type}:${entry.from}->${entry.to}`;
  }
  return `${entry.type}:${entry.name}`;
}

function normalizeSignatureForRenameMatch(symbol: ContractSymbol): string {
  // Replace the symbol's declared name within its own signature with a stable
  // placeholder so two declarations that differ ONLY by name produce identical
  // strings. Walk the signature in-place rather than building a dynamic
  // RegExp from the symbol name (which would trip semgrep's
  // detect-non-literal-regexp blocking rule). The word-boundary check is a
  // straightforward "neither neighbour is an identifier character" test.
  const name = symbol.name;
  const signature = symbol.signature;
  if (name.length === 0) {
    return signature;
  }
  let result = '';
  let cursor = 0;
  while (cursor < signature.length) {
    const match = signature.indexOf(name, cursor);
    if (match === -1) {
      result += signature.slice(cursor);
      break;
    }
    result += signature.slice(cursor, match);
    const before = match > 0 ? signature.charCodeAt(match - 1) : -1;
    const afterIndex = match + name.length;
    const after = afterIndex < signature.length ? signature.charCodeAt(afterIndex) : -1;
    if (!isIdentifierCharCode(before) && !isIdentifierCharCode(after)) {
      result += '__name__';
    } else {
      result += name;
    }
    cursor = afterIndex;
  }
  return result;
}

function isIdentifierCharCode(code: number): boolean {
  // Matches the characters JavaScript's \b regex word-boundary treats as
  // word characters: ASCII letters, digits, and underscore. Sufficient for
  // the contract surface (TypeScript identifiers are constrained to this set
  // in practice for our declared symbols).
  if (code < 0) return false;
  if (code >= 48 && code <= 57) return true; // 0-9
  if (code >= 65 && code <= 90) return true; // A-Z
  if (code >= 97 && code <= 122) return true; // a-z
  return code === 95; // _
}

export function formatDiff(result: ContractDiffResult): string {
  if (result.ok) {
    return '@anydocs/editor contract is in sync with contract/contract.json.';
  }

  const lines: string[] = [];
  lines.push('@anydocs/editor contract drift detected (vs contract/contract.json):');
  lines.push('');

  for (const entry of result.entries) {
    if (entry.type === 'added') {
      lines.push(`  + added:    ${entry.name}  (kind=${entry.kind})`);
      lines.push(`              ${entry.signature}`);
    } else if (entry.type === 'removed') {
      lines.push(`  - removed:  ${entry.name}  (kind=${entry.kind})`);
      lines.push(`              ${entry.signature}`);
    } else if (entry.type === 'renamed') {
      lines.push(`  ~ renamed:  ${entry.from} -> ${entry.to}  (kind=${entry.kind}, signature unchanged)`);
      lines.push(`              ${entry.signature}`);
    } else {
      lines.push(`  ~ changed:  ${entry.name}  signature-change  (kind=${entry.kind})`);
      lines.push(`              expected: ${entry.expectedSignature}`);
      lines.push(`              actual:   ${entry.actualSignature}`);
    }
  }

  lines.push('');
  lines.push('If this change is intentional, run:');
  lines.push('  pnpm --filter @anydocs/editor contract:update');
  lines.push('and commit the resulting contract/contract.json.');

  return lines.join('\n');
}
