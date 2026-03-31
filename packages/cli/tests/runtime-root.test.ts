import assert from 'node:assert/strict';
import { lstat, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { isInsideNodeModules, materializeRuntimeRoot } from '../src/runtime/runtime-root.ts';

test('isInsideNodeModules detects packaged runtime paths', () => {
  assert.equal(isInsideNodeModules('/tmp/node_modules/@anydocs/cli/docs-runtime'), true);
  assert.equal(isInsideNodeModules('/tmp/anydocs-cli-runtime/docs-runtime'), false);
});

test('materializeRuntimeRoot copies packaged runtimes out of node_modules and vendors dependencies locally', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'anydocs-cli-runtime-test-'));
  const packagedRuntimeRoot = path.join(tempRoot, 'node_modules', '@anydocs', 'cli', 'docs-runtime');
  const sharedDependencyRoot = path.join(tempRoot, 'linked-deps', 'sample-dep');

  try {
    await mkdir(path.join(packagedRuntimeRoot, 'scripts'), { recursive: true });
    await mkdir(sharedDependencyRoot, { recursive: true });
    await mkdir(path.join(tempRoot, 'node_modules', '@anydocs', 'cli'), { recursive: true });
    await writeFile(path.join(packagedRuntimeRoot, 'scripts', 'gen-public-assets.mjs'), 'export {};\n', 'utf8');
    await writeFile(path.join(packagedRuntimeRoot, 'next.config.mjs'), 'export default {};\n', 'utf8');
    await writeFile(path.join(sharedDependencyRoot, 'index.js'), 'export default "ok";\n', 'utf8');
    await symlink(sharedDependencyRoot, path.join(tempRoot, 'node_modules', 'sample-dep'), 'dir');

    const materializedRoot = await materializeRuntimeRoot(packagedRuntimeRoot, 'docs');

    assert.equal(isInsideNodeModules(materializedRoot), false);
    assert.equal(materializedRoot === packagedRuntimeRoot, false);
    const copiedScript = await lstat(path.join(materializedRoot, 'scripts', 'gen-public-assets.mjs'));
    assert.equal(copiedScript.isFile(), true);
    const copiedNodeModules = await lstat(path.join(materializedRoot, 'node_modules'));
    assert.equal(copiedNodeModules.isSymbolicLink(), false);
    assert.equal(copiedNodeModules.isDirectory(), true);
    const copiedDependency = await lstat(path.join(materializedRoot, 'node_modules', 'sample-dep'));
    assert.equal(copiedDependency.isSymbolicLink(), false);
    assert.equal(await readFile(path.join(materializedRoot, 'node_modules', 'sample-dep', 'index.js'), 'utf8'), 'export default "ok";\n');

    await rm(materializedRoot, { recursive: true, force: true });
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
