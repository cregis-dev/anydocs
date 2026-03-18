import assert from 'node:assert/strict';
import { access, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { ValidationError } from '../src/errors/validation-error.ts';
import { initializeProject } from '../src/services/init-service.ts';
import { importLegacyDocumentation } from '../src/services/legacy-import-service.ts';

async function createTempRepoRoot(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), 'anydocs-legacy-import-repo-'));
}

async function createTempSourceRoot(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), 'anydocs-legacy-import-src-'));
}

test('importLegacyDocumentation stages markdown and mdx files into the conversion path', async () => {
  const repoRoot = await createTempRepoRoot();
  const sourceRoot = await createTempSourceRoot();

  try {
    await initializeProject({ repoRoot, languages: ['en'], defaultLanguage: 'en' });
    await writeFile(
      path.join(sourceRoot, 'getting-started.mdx'),
      ['---', 'title: Getting Started', 'tags: [intro, migration]', '---', '', '# Welcome', '', 'Legacy body'].join('\n'),
      'utf8',
    );
    await writeFile(
      path.join(sourceRoot, 'guide.md'),
      ['# Guide', '', 'Imported markdown content'].join('\n'),
      'utf8',
    );

    const result = await importLegacyDocumentation({
      repoRoot,
      sourceRoot,
      lang: 'en',
    });

    assert.equal(result.itemCount, 2);
    assert.ok(result.importRoot.includes(path.join('imports')));
    await access(result.manifestFile);

    const manifest = JSON.parse(await readFile(result.manifestFile, 'utf8')) as {
      status: string;
      itemCount: number;
      items: Array<{ slug: string; status: string }>;
    };
    assert.equal(manifest.status, 'staged');
    assert.equal(manifest.itemCount, 2);
    assert.deepEqual(
      manifest.items.map((item) => item.slug).sort(),
      ['getting-started', 'guide'],
    );
    assert.ok(manifest.items.every((item) => item.status === 'staged'));

    const firstItemPath = path.join(result.importRoot, 'items', `${result.items[0].id}.json`);
    const firstItem = JSON.parse(await readFile(firstItemPath, 'utf8')) as {
      title: string;
      format: string;
      rawContent: string;
      status: string;
    };
    assert.equal(firstItem.status, 'staged');
    assert.ok(firstItem.format === 'markdown' || firstItem.format === 'mdx');
    assert.ok(firstItem.rawContent.length > 0);

    await assert.rejects(
      () => access(path.join(repoRoot, 'pages', 'en', 'getting-started.json')),
      /ENOENT/,
    );
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
    await rm(sourceRoot, { recursive: true, force: true });
  }
});

test('importLegacyDocumentation fails clearly for malformed frontmatter and leaves no staged content behind', async () => {
  const repoRoot = await createTempRepoRoot();
  const sourceRoot = await createTempSourceRoot();

  try {
    await initializeProject({ repoRoot, languages: ['en'], defaultLanguage: 'en' });
    await writeFile(
      path.join(sourceRoot, 'broken.md'),
      ['---', 'title: Broken', '', '# Missing closing fence'].join('\n'),
      'utf8',
    );

    await assert.rejects(
      () =>
        importLegacyDocumentation({
          repoRoot,
          sourceRoot,
          lang: 'en',
        }),
      (error: unknown) => {
        assert.ok(error instanceof ValidationError);
        assert.equal(error.details.entity, 'legacy-import');
        assert.equal(error.details.rule, 'legacy-frontmatter-closed');
        return true;
      },
    );

    const importEntries = await readdir(path.join(repoRoot, 'imports'));
    assert.deepEqual(importEntries, []);
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
    await rm(sourceRoot, { recursive: true, force: true });
  }
});

test('importLegacyDocumentation parses CRLF frontmatter without dropping metadata', async () => {
  const repoRoot = await createTempRepoRoot();
  const sourceRoot = await createTempSourceRoot();

  try {
    await initializeProject({ repoRoot, languages: ['en'], defaultLanguage: 'en' });
    await writeFile(
      path.join(sourceRoot, 'windows-guide.md'),
      '---\r\ntitle: Windows Guide\r\ndescription: Imported from CRLF\r\ntags: [windows, crlf]\r\n---\r\n\r\n# Windows Guide\r\n\r\nBody.\r\n',
      'utf8',
    );

    const result = await importLegacyDocumentation({
      repoRoot,
      sourceRoot,
      lang: 'en',
    });

    const itemPath = path.join(result.importRoot, 'items', `${result.items[0].id}.json`);
    const item = JSON.parse(await readFile(itemPath, 'utf8')) as {
      title: string;
      description?: string;
      tags?: string[];
      body: string;
    };

    assert.equal(item.title, 'Windows Guide');
    assert.equal(item.description, 'Imported from CRLF');
    assert.deepEqual(item.tags, ['windows', 'crlf']);
    assert.match(item.body, /# Windows Guide/);
    assert.match(item.body, /\r\n/);
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
    await rm(sourceRoot, { recursive: true, force: true });
  }
});
