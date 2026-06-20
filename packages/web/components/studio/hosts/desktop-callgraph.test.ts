// =============================================================================
// Desktop call-graph boundary audit — Story 9.6 (FR52).
//
// Asserts that the desktop Studio call graph contains zero `/api/local/*` calls.
// The desktop renderer routes document I/O through native Tauri fs commands
// (createDesktopNativeHost) and delegates the remaining project/build/preview
// operations to the local desktop server over `/studio/*` (createDesktopHttpHost)
// — it must never reach the dev-only `/api/local/*` HTTP surface.
//
// This is a transitive guard: starting from the desktop host entry modules, it
// walks every reachable web-source import (relative + `@/` alias) and fails if
// any reachable module embeds an `/api/local` URL literal. It deliberately does
// NOT start from `backend.ts`, whose `web` branch legitimately reaches
// `web-local-host` (the `/api/local` consumer) — that branch is not part of the
// desktop call graph.
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HOSTS_DIR = __dirname;
const WEB_ROOT = path.resolve(__dirname, '..', '..', '..');

// Entry points of the desktop call graph (the host the desktop backend selects).
const DESKTOP_ROOTS = [
  path.join(HOSTS_DIR, 'desktop-native-host.ts'),
  path.join(HOSTS_DIR, 'desktop-http-host.ts'),
  path.join(WEB_ROOT, 'components', 'studio', 'native-desktop-bridge.ts'),
];

const RESOLVE_EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'];
const IMPORT_RE = /(?:import|export)[^'"]*?from\s*['"]([^'"]+)['"]|import\s*['"]([^'"]+)['"]/g;
// Match an `/api/local` path in a string/template literal, including a
// template-interpolation prefix (`${base}/api/local`) — the `}` form. Ignores
// prose comments (no adjacent quote/`}`). Concatenation that splits the literal
// itself (`'/api' + '/local'`) is not realistically detectable by any scan.
const API_LOCAL_RE = /(['"`}])\/api\/local\b/;

/** A resolved web-source file, an intentionally-skipped external package, or an unresolved local import. */
type Resolution =
  | { kind: 'file'; file: string }
  | { kind: 'external' }
  | { kind: 'unresolved'; spec: string };

/** Resolve a relative or `@/` import spec to an on-disk web-source file. */
function resolveWebSource(fromFile: string, spec: string): Resolution {
  let base: string;
  if (spec.startsWith('@/')) {
    base = path.join(WEB_ROOT, spec.slice(2));
  } else if (spec.startsWith('.')) {
    base = path.resolve(path.dirname(fromFile), spec);
  } else {
    return { kind: 'external' }; // bare package (node_modules, @anydocs/*) — not web source
  }

  const candidates = [
    base,
    ...RESOLVE_EXTENSIONS.map((ext) => base + ext),
    ...RESOLVE_EXTENSIONS.map((ext) => path.join(base, `index${ext}`)),
  ];
  for (const candidate of candidates) {
    try {
      if (statSync(candidate).isFile()) return { kind: 'file', file: candidate };
    } catch {
      // not this candidate
    }
  }
  // A relative/`@/` import that resolves to nothing is NOT silently skipped — it
  // would be a hole in the walk (a reachable module the guard never scans).
  return { kind: 'unresolved', spec };
}

function collectDesktopGraph(): {
  files: Set<string>;
  missingRoots: string[];
  unresolved: Array<{ from: string; spec: string }>;
} {
  const files = new Set<string>();
  const missingRoots: string[] = [];
  const unresolved: Array<{ from: string; spec: string }> = [];
  const queue: string[] = [];

  for (const root of DESKTOP_ROOTS) {
    try {
      if (statSync(root).isFile()) queue.push(root);
      else missingRoots.push(root);
    } catch {
      missingRoots.push(root);
    }
  }

  while (queue.length > 0) {
    const file = queue.pop()!;
    if (files.has(file)) continue;
    files.add(file);

    let source: string;
    try {
      source = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    for (const match of source.matchAll(IMPORT_RE)) {
      const spec = match[1] ?? match[2];
      if (!spec) continue;
      const resolution = resolveWebSource(file, spec);
      if (resolution.kind === 'file') {
        if (!files.has(resolution.file)) queue.push(resolution.file);
      } else if (resolution.kind === 'unresolved') {
        unresolved.push({ from: path.relative(WEB_ROOT, file), spec });
      }
    }
  }

  return { files, missingRoots, unresolved };
}

test('Story 9.6 / FR52: desktop call graph contains zero /api/local calls', () => {
  const { files, missingRoots, unresolved } = collectDesktopGraph();

  assert.deepEqual(missingRoots, [], `desktop call-graph roots not found: ${missingRoots.join(', ')}`);
  // Sanity: the walk must actually traverse the host subgraph, not pass vacuously.
  assert.ok(files.size >= DESKTOP_ROOTS.length, 'desktop graph walk reached no files');
  // No relative/@ import may fail to resolve — an unresolved local import is a
  // hole in the walk (a reachable module the /api/local scan never visits).
  assert.deepEqual(
    unresolved,
    [],
    `unresolved local imports leave the call graph incomplete:\n${unresolved
      .map((u) => `  ${u.from} -> ${u.spec}`)
      .join('\n')}`,
  );

  const violations: Array<{ file: string; line: number; snippet: string }> = [];
  for (const file of files) {
    const lines = readFileSync(file, 'utf8').split('\n');
    for (let i = 0; i < lines.length; i += 1) {
      if (API_LOCAL_RE.test(lines[i]!)) {
        violations.push({
          file: path.relative(WEB_ROOT, file),
          line: i + 1,
          snippet: lines[i]!.trim().slice(0, 160),
        });
      }
    }
  }

  assert.equal(
    violations.length,
    0,
    `Desktop call graph must not reference /api/local/* (use Tauri invoke or /studio/*). Offenders:\n${violations
      .map((v) => `  ${v.file}:${v.line}  ${v.snippet}`)
      .join('\n')}`,
  );
});

test('guard is effective: it flags an /api/local literal when present (negative control)', () => {
  // Proves the regex + walker would catch a regression rather than passing vacuously.
  assert.ok(API_LOCAL_RE.test("await fetch('/api/local/page')"));
  assert.ok(API_LOCAL_RE.test('fetch(`/api/local/navigation`)'));
  // Template-interpolated base: `${serverBaseUrl}/api/local/page`.
  assert.ok(API_LOCAL_RE.test('fetch(`${serverBaseUrl}/api/local/page`)'));
  // Must NOT match a non-string mention (e.g. a prose comment) to avoid false positives.
  assert.equal(API_LOCAL_RE.test('// the web runtime uses /api/local/* routes'), false);
});
