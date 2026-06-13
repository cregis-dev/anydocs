import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

/**
 * Machine-enforced guard for Story 8.2 (architecture.md §"Pattern: Capability
 * Matrix as Single Source"). Consumers MUST branch on runtime mode via
 * `getCapabilities()` from `@anydocs/core`, never by comparing the mode literal
 * inline. This test scans tracked source and fails on inline
 * `runtimeMode === ...` / `getRuntimeMode() === ...` comparisons outside the
 * one place they legitimately live: `packages/core/src/runtime/`.
 *
 * Scope note: it intentionally does NOT forbid Tauri-global probes or
 * `bootContext.mode === 'desktop'`-style Phase 1 checks — those are different
 * concerns (the resolver owns Tauri detection; consolidating them is Epic 9).
 */

const here = dirname(fileURLToPath(import.meta.url)); // packages/core/tests
const packagesDir = join(here, '..', '..'); // packages/

// Directories never scanned (build output, deps, generated studio mirrors).
const SKIP_DIRS = new Set([
  'node_modules',
  'dist',
  '.next',
  'coverage',
  'studio-runtime', // packages/cli/studio-runtime — generated mirror of web studio
]);

// Path fragments (posix-normalized) that are allowed to compare the mode literal.
const ALLOWLIST_FRAGMENTS = [
  'packages/core/src/runtime/', // the resolver + capability matrix live here
];

const FORBIDDEN_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /\bruntimeMode\s*===/, label: 'runtimeMode === ...' },
  { re: /===\s*runtimeMode\b/, label: '... === runtimeMode' },
  { re: /\bgetRuntimeMode\s*\(\s*\)\s*===/, label: 'getRuntimeMode() === ...' },
  { re: /===\s*getRuntimeMode\s*\(\s*\)/, label: '... === getRuntimeMode()' },
];

function* walk(dir: string): Generator<string> {
  let entries: ReturnType<typeof readdirSync>;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name) || entry.name.startsWith('.')) {
        continue;
      }
      yield* walk(full);
    } else if (
      (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) &&
      !entry.name.endsWith('.d.ts')
    ) {
      yield full;
    }
  }
}

function posix(p: string): string {
  return p.split(/[\\/]/).join('/');
}

test('no inline runtimeMode-literal comparisons exist outside packages/core/src/runtime/', () => {
  const violations: string[] = [];

  for (const file of walk(packagesDir)) {
    const rel = posix(file);
    if (ALLOWLIST_FRAGMENTS.some((frag) => rel.includes(frag))) {
      continue;
    }
    // Test files legitimately compare the mode literal.
    if (rel.includes('/tests/') || rel.endsWith('.test.ts') || rel.endsWith('.test.tsx')) {
      continue;
    }

    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      for (const { re, label } of FORBIDDEN_PATTERNS) {
        if (re.test(line)) {
          violations.push(`${rel}:${i + 1} — ${label}\n    ${line.trim()}`);
        }
      }
    });
  }

  assert.equal(
    violations.length,
    0,
    `Inline runtime-mode branching is forbidden — read from getCapabilities() instead.\n` +
      `Offending sites:\n${violations.join('\n')}`,
  );
});
