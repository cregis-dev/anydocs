import assert from 'node:assert/strict';
import { lstat, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { isInsideNodeModules, materializeRuntimeRoot } from '../src/runtime/runtime-root.ts';

test('isInsideNodeModules detects packaged runtime paths', () => {
  assert.equal(isInsideNodeModules('/tmp/node_modules/@anydocs/cli/docs-runtime'), true);
  assert.equal(isInsideNodeModules('/tmp/anydocs-cli-runtime/docs-runtime'), false);
});

test('materializeRuntimeRoot copies packaged runtimes out of node_modules and links dependencies', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'anydocs-cli-runtime-test-'));
  const packagedRuntimeRoot = path.join(tempRoot, 'node_modules', '@anydocs', 'cli', 'docs-runtime');

  try {
    await mkdir(path.join(packagedRuntimeRoot, 'scripts'), { recursive: true });
    await writeFile(path.join(packagedRuntimeRoot, 'scripts', 'gen-public-assets.mjs'), 'export {};\n', 'utf8');
    await writeFile(path.join(packagedRuntimeRoot, 'next.config.mjs'), 'export default {};\n', 'utf8');

    const materializedRoot = await materializeRuntimeRoot(packagedRuntimeRoot, 'docs');

    assert.equal(isInsideNodeModules(materializedRoot), false);
    assert.equal(materializedRoot === packagedRuntimeRoot, false);
    const copiedScript = await lstat(path.join(materializedRoot, 'scripts', 'gen-public-assets.mjs'));
    assert.equal(copiedScript.isFile(), true);
    const linkedNodeModules = await lstat(path.join(materializedRoot, 'node_modules'));
    assert.equal(linkedNodeModules.isSymbolicLink(), true);

    await rm(materializedRoot, { recursive: true, force: true });
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
