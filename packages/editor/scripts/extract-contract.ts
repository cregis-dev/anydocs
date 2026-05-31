// =============================================================================
// @anydocs/editor — Public API Contract Extractor
// -----------------------------------------------------------------------------
// Reads `packages/editor/contract/public-api.ts` and produces a deterministic
// JSON snapshot of the public surface. The snapshot is committed to
// `packages/editor/contract/contract.json` and re-extracted by CI to detect
// drift. See Story 6.5 in `artifacts/bmad/implementation-artifacts/`.
//
// Design discipline (per Story 6.5):
//   * Bespoke TypeScript compiler API — NO @microsoft/api-extractor or similar
//     heavyweight tooling. The contract is five symbols; a focused ~200 LOC
//     extractor matches the repo's minimal-dependency policy.
//   * Pure syntactic extraction. We parse the contract file with
//     `ts.createSourceFile` and walk top-level export declarations — we do NOT
//     resolve types via `ts.createProgram`/`ts.TypeChecker`. This makes the
//     extractor self-contained: it does not need `@anydocs/core` to be built,
//     does not need a populated node_modules tree, and produces byte-identical
//     output across machines.
//   * Deterministic output: symbols sorted by name, no timestamps, no absolute
//     paths, normalized whitespace, two-space JSON indent + trailing newline.
//   * The shape captured for each symbol is: name + kind ('function'|'type')
//     + a normalized signature string produced by `ts.createPrinter` with
//     comments removed and whitespace collapsed.
// =============================================================================

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(SCRIPT_DIR, '..');
const CONTRACT_SOURCE_PATH = path.join(PACKAGE_ROOT, 'contract/public-api.ts');
const CONTRACT_SOURCE_REL = 'contract/public-api.ts';

export type ContractSymbolKind = 'function' | 'type';

export type ContractSymbol = {
  name: string;
  kind: ContractSymbolKind;
  signature: string;
};

export type ContractSnapshot = {
  version: 1;
  package: '@anydocs/editor';
  generatedFrom: typeof CONTRACT_SOURCE_REL;
  symbols: ContractSymbol[];
};

/**
 * Public entry point — extracts the contract surface from the on-disk
 * `contract/public-api.ts` file.
 */
export function extractContract(): ContractSnapshot {
  const sourceText = readFileSync(CONTRACT_SOURCE_PATH, 'utf8');
  return extractContractFromSource(sourceText);
}

/**
 * Pure extraction from an in-memory source string. Used by tests to verify
 * stability under cosmetic edits without touching the on-disk file.
 */
export function extractContractFromSource(sourceText: string): ContractSnapshot {
  const sourceFile = ts.createSourceFile(
    CONTRACT_SOURCE_REL,
    sourceText,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
  );

  const printer = ts.createPrinter({
    removeComments: true,
    newLine: ts.NewLineKind.LineFeed,
  });

  const symbols: ContractSymbol[] = [];

  ts.forEachChild(sourceFile, (node) => {
    // ExportDeclaration (`export { foo } from './sub.ts'` or `export * from
    // './sub.ts'`) is checked BEFORE the export-modifier filter because these
    // nodes are export statements themselves rather than declarations carrying
    // an `export` modifier. Detect them up front so they cannot silently drop
    // re-exported symbols from the snapshot.
    if (ts.isExportDeclaration(node)) {
      throw new Error(
        `extract-contract: re-export declarations are not supported in contract/public-api.ts ` +
        `(found at line ${sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1}). ` +
        `Declare exported symbols directly in this file, or extend extract-contract.ts to handle ExportDeclaration nodes.`,
      );
    }

    if (!hasExportModifier(node)) {
      return;
    }

    if (ts.isFunctionDeclaration(node) && node.name) {
      symbols.push({
        name: node.name.text,
        kind: 'function',
        signature: normalizeSignature(printer.printNode(ts.EmitHint.Unspecified, stripFunctionBody(node), sourceFile)),
      });
      return;
    }

    if (ts.isTypeAliasDeclaration(node)) {
      symbols.push({
        name: node.name.text,
        kind: 'type',
        signature: normalizeSignature(printer.printNode(ts.EmitHint.Unspecified, node, sourceFile)),
      });
      return;
    }

    if (ts.isInterfaceDeclaration(node)) {
      symbols.push({
        name: node.name.text,
        kind: 'type',
        signature: normalizeSignature(printer.printNode(ts.EmitHint.Unspecified, node, sourceFile)),
      });
      return;
    }

    if (ts.isClassDeclaration(node) && node.name) {
      // Classes are not currently part of the @anydocs/editor public surface
      // (Story 6.1 keeps EditorNotImplementedError internal). The branch exists
      // so a future intentional class export surfaces as a tracked symbol.
      symbols.push({
        name: node.name.text,
        kind: 'type',
        signature: normalizeSignature(printer.printNode(ts.EmitHint.Unspecified, node, sourceFile)),
      });
      return;
    }

    if (ts.isVariableStatement(node)) {
      // Multi-declaration statements (`export const a = 1, b = 2;`) get split
      // into per-declaration entries so each symbol owns a distinct signature
      // — otherwise every entry would share the same combined VariableStatement
      // text. We synthesise a single-declaration VariableStatement per name
      // before printing so signatures stay distinct and stable.
      for (const declaration of node.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name)) {
          continue;
        }
        const isFunctionLike =
          declaration.initializer !== undefined &&
          (ts.isArrowFunction(declaration.initializer) || ts.isFunctionExpression(declaration.initializer));
        const singleList = ts.factory.createVariableDeclarationList([declaration], node.declarationList.flags);
        const singleStatement = ts.factory.createVariableStatement(node.modifiers, singleList);
        symbols.push({
          name: declaration.name.text,
          kind: isFunctionLike ? 'function' : 'type',
          signature: normalizeSignature(printer.printNode(ts.EmitHint.Unspecified, singleStatement, sourceFile)),
        });
      }
      return;
    }

    if (ts.isEnumDeclaration(node)) {
      symbols.push({
        name: node.name.text,
        kind: 'type',
        signature: normalizeSignature(printer.printNode(ts.EmitHint.Unspecified, node, sourceFile)),
      });
      return;
    }
  });

  symbols.sort((left, right) => (left.name < right.name ? -1 : left.name > right.name ? 1 : 0));

  return {
    version: 1,
    package: '@anydocs/editor',
    generatedFrom: CONTRACT_SOURCE_REL,
    symbols,
  };
}

function hasExportModifier(node: ts.Node): boolean {
  if (!ts.canHaveModifiers(node)) {
    return false;
  }
  const modifiers = ts.getModifiers(node);
  return modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) ?? false;
}

function stripFunctionBody(declaration: ts.FunctionDeclaration): ts.FunctionDeclaration {
  return ts.factory.updateFunctionDeclaration(
    declaration,
    declaration.modifiers,
    declaration.asteriskToken,
    declaration.name,
    declaration.typeParameters,
    declaration.parameters,
    declaration.type,
    /* body */ undefined,
  );
}

function normalizeSignature(printed: string): string {
  return printed
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\n]*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Serialize a snapshot to the on-disk JSON form. Centralized so the CLI and
 * tests format identically — two-space indent + trailing newline + UTF-8.
 */
export function serializeSnapshot(snapshot: ContractSnapshot): string {
  return `${JSON.stringify(snapshot, null, 2)}\n`;
}

export const CONTRACT_SNAPSHOT_PATH = path.join(PACKAGE_ROOT, 'contract/contract.json');
