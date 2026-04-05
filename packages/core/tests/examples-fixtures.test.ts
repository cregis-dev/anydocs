import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { validateDocContentV1 } from '../src/utils/index.ts';

const REPO_ROOT = fileURLToPath(new URL('../../..', import.meta.url));

async function listExamplePageFiles(): Promise<string[]> {
  const examplesRoot = path.join(REPO_ROOT, 'examples');
  const exampleDirs = await readDirNames(examplesRoot);
  const files: string[] = [];

  for (const exampleDir of exampleDirs) {
    const pagesRoot = path.join(examplesRoot, exampleDir, 'pages');
    const langDirs = await readDirNames(pagesRoot).catch(() => []);

    for (const langDir of langDirs) {
      const pageDir = path.join(pagesRoot, langDir);
      const entries = await readDirNames(pageDir, true);
      files.push(...entries.filter((entry) => entry.endsWith('.json')).map((entry) => path.join(pageDir, entry)));
    }
  }

  return files.sort();
}

async function readDirNames(dir: string, filesOnly = false): Promise<string[]> {
  const { readdir } = await import('node:fs/promises');
  const entries = await readdir(dir, { withFileTypes: true });
  return entries
    .filter((entry) => (filesOnly ? entry.isFile() : entry.isDirectory()))
    .map((entry) => entry.name)
    .sort();
}

test('example page fixtures use canonical content as the only persisted content source', async () => {
  const files = await listExamplePageFiles();
  assert.ok(files.length > 0);

  for (const file of files) {
    const page = JSON.parse(await readFile(file, 'utf8')) as {
      content?: unknown;
      render?: unknown;
    };

    const validation = validateDocContentV1(page.content);
    assert.equal(
      validation.ok,
      true,
      `${path.relative(REPO_ROOT, file)} should store valid DocContentV1 (${validation.ok ? '' : `${validation.path}: ${validation.error}`})`,
    );
    assert.equal(
      Object.prototype.hasOwnProperty.call(page, 'render'),
      false,
      `${path.relative(REPO_ROOT, file)} should not persist render output`,
    );
  }
});
