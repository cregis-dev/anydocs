// =============================================================================
// Studio call-graph boundary audit — Story 7.1 AC11.
//
// Machine-enforces the rule that Studio code (and any other web module that
// is NOT inside `lib/editor-host/`) imports the editor exclusively through
// the published `@anydocs/editor` entry. Direct imports from internal paths
// (`@anydocs/editor/src/...` etc.) are forbidden.
//
// Also asserts that `lib/editor-host/` is the only directory under
// `packages/web/` that imports `@anydocs/editor` at all — preserving the
// boundary that Story 7.2 / 7.3 will rely on when swapping editor
// implementations.
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = path.resolve(__dirname, '..', '..');
const EDITOR_HOST_DIR = path.resolve(__dirname);
const SELF_FILE = fileURLToPath(import.meta.url);

const SCAN_ROOTS = [
  path.join(WEB_ROOT, 'app'),
  path.join(WEB_ROOT, 'components'),
  path.join(WEB_ROOT, 'lib'),
  path.join(WEB_ROOT, 'scripts'),
];

const SKIP_DIRECTORY_NAMES = new Set(['node_modules', '.next', 'dist', 'out', 'coverage', '.turbo']);
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs']);

function listSourceFiles(root: string): string[] {
  const results: string[] = [];
  let entries: import('node:fs').Dirent[];
  try {
    entries = readdirSync(root, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    if (SKIP_DIRECTORY_NAMES.has(entry.name)) continue;
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      results.push(...listSourceFiles(fullPath));
      continue;
    }
    if (entry.isFile()) {
      const ext = path.extname(entry.name);
      if (SOURCE_EXTENSIONS.has(ext)) {
        results.push(fullPath);
      }
      continue;
    }
    if (entry.isSymbolicLink()) {
      try {
        if (statSync(fullPath).isFile() && SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
          results.push(fullPath);
        }
      } catch {
        // ignore broken symlinks
      }
    }
  }
  return results;
}

const allWebSources = SCAN_ROOTS.flatMap(listSourceFiles);

// ---------------------------------------------------------------------------
// AC11 — no internal imports from `@anydocs/editor/src/...`
// ---------------------------------------------------------------------------

test('AC11: no web source imports from @anydocs/editor/src/ (forbidden internal path)', () => {
  // The internal-import sentinel ONLY matches actual import / require
  // statements — comments and string literals describing the rule
  // (in this very file) must not self-trigger.
  const internalImportPattern = /\b(?:from|import|require\()\s*['"]@anydocs\/editor\/(?:src|dist\/src)\//;
  const violations: Array<{ file: string; line: number; snippet: string }> = [];
  for (const file of allWebSources) {
    if (file === SELF_FILE) continue; // skip the audit test itself
    const text = readFileSync(file, 'utf8');
    const lines = text.split('\n');
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
      const line = lines[lineIndex]!;
      if (internalImportPattern.test(line)) {
        violations.push({
          file: path.relative(WEB_ROOT, file),
          line: lineIndex + 1,
          snippet: line.trim().slice(0, 160),
        });
      }
    }
  }
  assert.equal(
    violations.length,
    0,
    `web sources must not reach into @anydocs/editor internals. Violations:\n${violations
      .map((v) => `  ${v.file}:${v.line} — ${v.snippet}`)
      .join('\n')}`,
  );
});

// ---------------------------------------------------------------------------
// AC11 — only `lib/editor-host/` imports from `@anydocs/editor` at all
// ---------------------------------------------------------------------------

test('AC11: only lib/editor-host/ imports from @anydocs/editor (boundary discipline)', () => {
  const importPattern = /\bfrom\s+['"]@anydocs\/editor(?:\/[^'"]*)?['"]/;
  const offenders: Array<{ file: string; line: number; snippet: string }> = [];
  for (const file of allWebSources) {
    if (file.startsWith(EDITOR_HOST_DIR)) {
      // The host adapter is the SINGLE module allowed to import the editor.
      continue;
    }
    const text = readFileSync(file, 'utf8');
    const lines = text.split('\n');
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
      const line = lines[lineIndex]!;
      if (importPattern.test(line)) {
        offenders.push({
          file: path.relative(WEB_ROOT, file),
          line: lineIndex + 1,
          snippet: line.trim().slice(0, 160),
        });
      }
    }
  }
  assert.equal(
    offenders.length,
    0,
    `only lib/editor-host/ may import @anydocs/editor. Offenders:\n${offenders
      .map((o) => `  ${o.file}:${o.line} — ${o.snippet}`)
      .join('\n')}`,
  );
});

// ---------------------------------------------------------------------------
// AC13 (Story 7.3) — no source under packages/web imports @yoopta/*
// ---------------------------------------------------------------------------

test('AC13: no source under packages/web imports @yoopta/* (Yoopta retired in Story 7.3)', () => {
  // Story 7.3 cutover deleted every `@yoopta/*` runtime dep from web's
  // package.json and the surrounding source surface. This guard catches
  // any accidental re-introduction (e.g. a copy-paste from `examples/`,
  // which is excluded from tsconfig but still on disk).
  //
  // The pattern matches actual import/require statements only — comments
  // and string literals describing the retirement (in this very file
  // and elsewhere) must not self-trigger.
  const yooptaImportPattern = /\b(?:from|import|require\()\s*['"]@yoopta\//;
  const violations: Array<{ file: string; line: number; snippet: string }> = [];
  for (const file of allWebSources) {
    if (file === SELF_FILE) continue; // skip the audit test itself
    const text = readFileSync(file, 'utf8');
    const lines = text.split('\n');
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
      const line = lines[lineIndex]!;
      if (yooptaImportPattern.test(line)) {
        violations.push({
          file: path.relative(WEB_ROOT, file),
          line: lineIndex + 1,
          snippet: line.trim().slice(0, 160),
        });
      }
    }
  }
  assert.equal(
    violations.length,
    0,
    `Story 7.3 retired @yoopta/* from packages/web. No source under app/, components/, lib/, scripts/, tests/ may import @yoopta/*. Violations:\n${violations
      .map((v) => `  ${v.file}:${v.line} — ${v.snippet}`)
      .join('\n')}`,
  );
});

test('sanity: the scan discovered at least one web source file', () => {
  // Defensive: if listSourceFiles silently returned empty (e.g. a path was
  // renamed), the previous tests would pass vacuously. This assertion
  // ensures the audit actually exercised the codebase.
  assert.ok(allWebSources.length > 50, `expected to scan >50 web source files, got ${allWebSources.length}`);
});
