import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

// Guards the @anydocs/core/portable reuse seam (Team First strategy, action 2).
//
// The Cloud Team Edition imports this entry from a serverless/edge runtime, where
// `node:fs` is unavailable. These tests walk the ACTUAL import graph — not a
// hand-maintained list — so a future core change that pulls a filesystem module
// into the portable surface fails here instead of at cloud runtime.

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '../src');
const PORTABLE = join(SRC, 'portable.ts');

// Every spelling Node accepts for the fs builtin.
const FS_IMPORT = /(?:from|import)\s*\(?\s*['"](?:node:)?fs(?:\/promises)?['"]/;

function resolveRelative(spec: string, importer: string): string | null {
  if (!spec.startsWith('.')) return null;
  const base = resolve(dirname(importer), spec);
  for (const candidate of [base, join(base, 'index.ts')]) {
    if (candidate.endsWith('.ts') && existsSync(candidate)) return candidate;
  }
  return null;
}

/** Walks the transitive relative-import graph from `entry`. */
function reachableFiles(entry: string): string[] {
  const seen = new Set<string>();
  const queue = [entry];
  while (queue.length > 0) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(/from\s+['"](\.[^'"]+)['"]/g)) {
      const dep = resolveRelative(match[1], file);
      if (dep) queue.push(dep);
    }
  }
  return [...seen];
}

test('portable entry exists and is reachable', () => {
  assert.ok(existsSync(PORTABLE), 'src/portable.ts must exist');
  const reached = reachableFiles(PORTABLE);
  assert.ok(reached.length > 20, `expected a real module graph, walked ${reached.length} files`);
});

test('nothing reachable from @anydocs/core/portable imports node:fs', () => {
  const offenders = reachableFiles(PORTABLE)
    .filter((file) => FS_IMPORT.test(readFileSync(file, 'utf8')))
    .map((file) => relative(SRC, file))
    .sort();

  assert.deepEqual(
    offenders,
    [],
    `These modules are reachable from portable.ts but import node:fs:\n  ${offenders.join('\n  ')}\n` +
      'Keep them out of the portable surface, or invert the dependency behind a caller-supplied port.',
  );
});

test('the root entry is NOT portable — portable.ts is not merely an alias', () => {
  // Sanity check on the guard itself: if the root entry ever became fs-free, this
  // test failing would tell us the portable split is no longer load-bearing.
  const rootOffenders = reachableFiles(join(SRC, 'index.ts')).filter((file) =>
    FS_IMPORT.test(readFileSync(file, 'utf8')),
  );
  assert.ok(
    rootOffenders.length > 0,
    'expected the root entry to still reach node:fs (fs/ + services/ live there)',
  );
});

test('portable surface actually exports the shared contracts the cloud needs', async () => {
  const mod = await import('../src/portable.ts');
  for (const name of [
    'assertValidDocContentV1', // doc-content-v1 storage contract
    'assertValidAuditEntry', // audit entry contract (Epic 10)
    'resolveRuntimeMode', // runtime mode (Epic 8)
    'CAPABILITY_MATRIX', // capability matrix (Epic 8)
  ]) {
    assert.ok(name in mod, `portable entry should export ${name}`);
  }
});
