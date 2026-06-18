import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

/**
 * Story 9.5 (AC2) guard: the `@anydocs/core/client-fs` entry must bundle into the
 * Tauri webview, which has no `node:*` built-ins. This walks the transitive
 * relative-import graph from `src/client-fs.ts` and fails if ANY reachable module
 * imports a `node:` built-in (or bare `fs`/`path`). Keeps the renderer surface
 * platform-agnostic — node I/O stays behind `node-fs-port.ts` (server-only).
 */

const here = dirname(fileURLToPath(import.meta.url)); // packages/core/tests
const srcDir = join(here, '..', 'src');
const entry = join(srcDir, 'client-fs.ts');

const IMPORT_RE = /(?:import|export)[^'"]*?from\s*['"]([^'"]+)['"]/g;
const NODE_BUILTIN_RE = /^(?:node:|fs$|path$|fs\/|path\/)/;

function resolveModule(fromFile: string, spec: string): string | null {
  if (!spec.startsWith('.')) return null; // bare/external specs handled by the builtin check
  const base = resolve(dirname(fromFile), spec);
  // specs already include the .ts extension in this codebase
  return base.endsWith('.ts') ? base : `${base}.ts`;
}

test('client-fs transitive graph contains no node: built-in imports', () => {
  const visited = new Set<string>();
  const violations: string[] = [];
  const queue = [entry];

  while (queue.length > 0) {
    const file = queue.pop()!;
    if (visited.has(file)) continue;
    visited.add(file);

    let source: string;
    try {
      source = readFileSync(file, 'utf8');
    } catch {
      continue;
    }

    for (const match of source.matchAll(IMPORT_RE)) {
      const spec = match[1];
      if (NODE_BUILTIN_RE.test(spec)) {
        violations.push(`${file.replace(srcDir, 'src')} imports '${spec}'`);
        continue;
      }
      const resolved = resolveModule(file, spec);
      if (resolved) queue.push(resolved);
    }
  }

  assert.equal(
    violations.length,
    0,
    `client-fs must stay node-free for the Tauri webview bundle. Offenders:\n${violations.join('\n')}`,
  );
  // sanity: we actually walked the graph
  assert.ok(visited.size >= 5, `expected to walk several modules, walked ${visited.size}`);
});
