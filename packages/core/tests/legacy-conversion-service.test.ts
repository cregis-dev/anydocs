import assert from 'node:assert/strict';
import { access, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  createDocsRepository,
  loadNavigation,
  loadPage,
  savePage,
} from '../src/fs/docs-repository.ts';
import { convertImportedLegacyContent } from '../src/services/legacy-conversion-service.ts';
import { initializeProject } from '../src/services/init-service.ts';
import { importLegacyDocumentation } from '../src/services/legacy-import-service.ts';

async function createTempRepoRoot(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), 'anydocs-legacy-convert-repo-'));
}

async function createTempSourceRoot(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), 'anydocs-legacy-convert-src-'));
}

test('convertImportedLegacyContent converts staged imports into draft pages and canonical navigation', async () => {
  const repoRoot = await createTempRepoRoot();
  const sourceRoot = await createTempSourceRoot();

  try {
    await initializeProject({ repoRoot, languages: ['en'], defaultLanguage: 'en' });
    await writeFile(
      path.join(sourceRoot, 'guide.md'),
      [
        '---',
        'title: Guide',
        'customField: keep-me',
        '---',
        '',
        '# Guide',
        '',
        '- bullet item',
        '',
        '1. first step',
        '',
        '- [ ] follow up item',
        '',
        '| Header | Value |',
        '| --- | --- |',
        '| Row | Data |',
        '',
        'Imported markdown content',
      ].join('\n'),
      'utf8',
    );
    await writeFile(
      path.join(sourceRoot, 'nested-getting-started.mdx'),
      ['---', 'title: Getting Started', '---', '', '# Getting Started', '', '<Callout>Review me</Callout>'].join('\n'),
      'utf8',
    );

    const importResult = await importLegacyDocumentation({
      repoRoot,
      sourceRoot,
      lang: 'en',
    });

    const result = await convertImportedLegacyContent({
      repoRoot,
      importId: importResult.importId,
    });

    assert.equal(result.convertedCount, 2);
    await access(result.reportFile);
    assert.ok(result.items.every((item) => item.status === 'draft'));
    assert.ok(result.warnings.some((warning) => warning.code === 'legacy-import-mdx-review-required'));
    assert.ok(result.warnings.some((warning) => warning.code === 'legacy-import-frontmatter-unmapped'));
    assert.equal(
      result.warnings.some((warning) => warning.code === 'legacy-import-markdown-construct-review-required'),
      false,
    );

    const repository = createDocsRepository(repoRoot);
    const guidePage = await loadPage(repository, 'en', 'guide');
    assert.ok(guidePage);
    assert.equal(guidePage.status, 'draft');
    assert.equal(guidePage.slug, 'guide');
    assert.match(guidePage.render?.markdown ?? '', /# Guide/);
    assert.match(guidePage.render?.markdown ?? '', /- \[ \] follow up item/);
    assert.deepEqual(Object.values(guidePage.content).map((block) => (block as { type: string }).type), [
      'HeadingOne',
      'BulletedList',
      'NumberedList',
      'TodoList',
      'Table',
      'Paragraph',
    ]);
    assert.equal(guidePage.review?.sourceType, 'legacy-import');
    assert.equal(guidePage.review?.sourceId, importResult.importId);
    assert.equal(guidePage.review?.required, true);
    assert.ok(guidePage.review?.warnings?.some((warning) => warning.code === 'legacy-import-frontmatter-unmapped'));
    assert.equal(
      guidePage.review?.warnings?.some((warning) => warning.code === 'legacy-import-markdown-construct-review-required'),
      false,
    );

    const navigation = await loadNavigation(repository, 'en');
    const importedSection = navigation.items.find(
      (item) => item.type === 'section' && item.title === `Imported: ${importResult.importId}`,
    );
    assert.ok(importedSection);
    assert.equal(importedSection.type, 'section');
    assert.ok(
      importedSection.children.some(
        (item) => item.type === 'page' && item.pageId === 'guide',
      ),
    );

    const manifest = JSON.parse(await readFile(path.join(result.importRoot, 'manifest.json'), 'utf8')) as {
      status: string;
      items: Array<{ status: string }>;
    };
    assert.equal(manifest.status, 'converted');
    assert.ok(manifest.items.every((item) => item.status === 'converted'));

    const report = JSON.parse(await readFile(result.reportFile, 'utf8')) as {
      status: string;
      convertedCount: number;
      warnings: Array<{ code: string }>;
    };
    assert.equal(report.status, 'converted');
    assert.equal(report.convertedCount, 2);
    assert.ok(report.warnings.some((warning) => warning.code === 'legacy-import-mdx-review-required'));
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
    await rm(sourceRoot, { recursive: true, force: true });
  }
});

test('convertImportedLegacyContent flags conflicts and keeps imported pages in draft review state', async () => {
  const repoRoot = await createTempRepoRoot();
  const sourceRoot = await createTempSourceRoot();

  try {
    await initializeProject({ repoRoot, languages: ['en'], defaultLanguage: 'en' });
    const repository = createDocsRepository(repoRoot);
    await savePage(repository, 'en', {
      id: 'guide',
      lang: 'en',
      slug: 'guide',
      title: 'Existing Guide',
      status: 'published',
      content: {},
      render: {
        markdown: '# Existing Guide',
        plainText: 'Existing Guide',
      },
    });

    await writeFile(path.join(sourceRoot, 'guide.md'), '# Imported Guide\n\nNeeds review.\n', 'utf8');

    const importResult = await importLegacyDocumentation({
      repoRoot,
      sourceRoot,
      lang: 'en',
    });

    const result = await convertImportedLegacyContent({
      repoRoot,
      importId: importResult.importId,
    });

    assert.ok(result.warnings.some((warning) => warning.code === 'legacy-import-page-id-conflict'));
    assert.ok(result.warnings.some((warning) => warning.code === 'legacy-import-slug-conflict'));

    const convertedPage = await loadPage(repository, 'en', 'guide-2');
    assert.ok(convertedPage);
    assert.equal(convertedPage.status, 'draft');
    assert.equal(convertedPage.slug, 'guide-2');
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
    await rm(sourceRoot, { recursive: true, force: true });
  }
});

test('convertImportedLegacyContent rolls back partial writes when conversion fails mid-run', async () => {
  const repoRoot = await createTempRepoRoot();
  const sourceRoot = await createTempSourceRoot();

  try {
    await initializeProject({ repoRoot, languages: ['en'], defaultLanguage: 'en' });
    await writeFile(path.join(sourceRoot, 'guide.md'), '# Guide\n\nBody.\n', 'utf8');
    await writeFile(path.join(sourceRoot, 'nested-getting-started.mdx'), '# Getting Started\n\nBody.\n', 'utf8');

    const importResult = await importLegacyDocumentation({
      repoRoot,
      sourceRoot,
      lang: 'en',
    });

    await mkdir(
      path.join(repoRoot, 'pages', 'en', 'nested-getting-started.json'),
      { recursive: true },
    );

    await assert.rejects(
      () =>
        convertImportedLegacyContent({
          repoRoot,
          importId: importResult.importId,
        }),
    );

    const repository = createDocsRepository(repoRoot);
    assert.equal(await loadPage(repository, 'en', 'guide'), null);

    const navigation = await loadNavigation(repository, 'en');
    assert.ok(!navigation.items.some((item) => item.type === 'section' && item.title === `Imported: ${importResult.importId}`));

    const manifest = JSON.parse(await readFile(path.join(importResult.importRoot, 'manifest.json'), 'utf8')) as {
      status: string;
      items: Array<{ status: string }>;
    };
    assert.equal(manifest.status, 'staged');
    assert.ok(manifest.items.every((item) => item.status === 'staged'));

    await assert.rejects(() => access(path.join(importResult.importRoot, 'conversion-report.json')), /ENOENT/);
    const importItems = await readdir(path.join(importResult.importRoot, 'items'));
    assert.ok(importItems.length >= 2);
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
    await rm(sourceRoot, { recursive: true, force: true });
  }
});
