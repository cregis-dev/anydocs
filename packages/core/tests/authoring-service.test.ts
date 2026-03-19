import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { ValidationError } from '../src/errors/validation-error.ts';
import { createDocsRepository, loadNavigation, loadPage } from '../src/fs/docs-repository.ts';
import {
  createPage,
  replaceNavigationItems,
  setPageStatus,
  setNavigation,
  updatePage,
} from '../src/services/authoring-service.ts';
import { initializeProject } from '../src/services/init-service.ts';

async function createTempProjectRoot(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), 'anydocs-authoring-'));
}

test('createPage writes a canonical page file and returns the created page metadata', async () => {
  const projectRoot = await createTempProjectRoot();

  try {
    await initializeProject({ repoRoot: projectRoot, languages: ['en'], defaultLanguage: 'en' });

    const result = await createPage({
      projectRoot,
      lang: 'en',
      page: {
        id: 'guide',
        slug: 'getting-started/guide',
        title: 'Guide',
        description: 'Authoring guide',
        tags: ['GUIDE'],
        content: { blocks: [] },
      },
    });

    assert.equal(result.page.id, 'guide');
    assert.equal(result.page.status, 'draft');
    assert.equal(result.page.updatedAt != null, true);
    assert.match(result.filePath, /pages\/en\/guide\.json$/);

    const persisted = JSON.parse(await readFile(result.filePath, 'utf8')) as {
      id: string;
      slug: string;
      updatedAt?: string;
    };
    assert.equal(persisted.id, 'guide');
    assert.equal(persisted.slug, 'getting-started/guide');
    assert.equal(typeof persisted.updatedAt, 'string');
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test('createPage rejects duplicate slugs with a stable validation error', async () => {
  const projectRoot = await createTempProjectRoot();

  try {
    await initializeProject({ repoRoot: projectRoot, languages: ['en'], defaultLanguage: 'en' });
    await createPage({
      projectRoot,
      lang: 'en',
      page: {
        id: 'guide',
        slug: 'shared-slug',
        title: 'Guide',
        content: { blocks: [] },
      },
    });

    await assert.rejects(
      () =>
        createPage({
          projectRoot,
          lang: 'en',
          page: {
            id: 'guide-2',
            slug: 'shared-slug',
            title: 'Guide 2',
            content: { blocks: [] },
          },
        }),
      (error: unknown) =>
        error instanceof ValidationError &&
        error.details.rule === 'page-slug-unique-per-language' &&
        error.details.metadata?.duplicatePageId === 'guide',
    );
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test('updatePage applies a shallow patch and refreshes updatedAt', async () => {
  const projectRoot = await createTempProjectRoot();

  try {
    await initializeProject({ repoRoot: projectRoot, languages: ['en'], defaultLanguage: 'en' });
    const created = await createPage({
      projectRoot,
      lang: 'en',
      page: {
        id: 'guide',
        slug: 'guide',
        title: 'Guide',
        description: 'Before',
        tags: ['GUIDE'],
        content: { blocks: [] },
      },
    });

    const result = await updatePage({
      projectRoot,
      lang: 'en',
      pageId: 'guide',
      patch: {
        slug: 'guide/updated',
        title: 'Updated Guide',
        description: 'After',
        tags: ['GUIDE', 'UPDATED'],
        render: {
          markdown: '# Updated Guide',
          plainText: 'Updated Guide',
        },
      },
    });

    assert.equal(result.page.slug, 'guide/updated');
    assert.equal(result.page.title, 'Updated Guide');
    assert.deepEqual(result.page.tags, ['GUIDE', 'UPDATED']);
    assert.equal(result.page.render?.plainText, 'Updated Guide');
    assert.notEqual(result.page.updatedAt, created.page.updatedAt);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test('updatePage rejects missing pages', async () => {
  const projectRoot = await createTempProjectRoot();

  try {
    await initializeProject({ repoRoot: projectRoot, languages: ['en'], defaultLanguage: 'en' });

    await assert.rejects(
      () =>
        updatePage({
          projectRoot,
          lang: 'en',
          pageId: 'missing-page',
          patch: { title: 'Missing' },
        }),
      (error: unknown) =>
        error instanceof ValidationError && error.details.rule === 'page-must-exist',
    );
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test('setPageStatus persists a valid status transition', async () => {
  const projectRoot = await createTempProjectRoot();

  try {
    await initializeProject({ repoRoot: projectRoot, languages: ['en'], defaultLanguage: 'en' });
    await createPage({
      projectRoot,
      lang: 'en',
      page: {
        id: 'guide',
        slug: 'guide',
        title: 'Guide',
        content: { blocks: [] },
      },
    });

    const result = await setPageStatus({
      projectRoot,
      lang: 'en',
      pageId: 'guide',
      status: 'in_review',
    });

    assert.equal(result.page.status, 'in_review');
    const persisted = await loadPage(createDocsRepository(projectRoot), 'en', 'guide');
    assert.equal(persisted?.status, 'in_review');
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test('setPageStatus preserves publication approval enforcement', async () => {
  const projectRoot = await createTempProjectRoot();

  try {
    await initializeProject({ repoRoot: projectRoot, languages: ['en'], defaultLanguage: 'en' });
    await createPage({
      projectRoot,
      lang: 'en',
      page: {
        id: 'imported-guide',
        slug: 'imported-guide',
        title: 'Imported Guide',
        content: { blocks: [] },
        review: {
          required: true,
          sourceType: 'legacy-import',
          sourceId: 'legacy-1',
        },
      },
    });

    await assert.rejects(
      () =>
        setPageStatus({
          projectRoot,
          lang: 'en',
          pageId: 'imported-guide',
          status: 'published',
        }),
      (error: unknown) =>
        error instanceof ValidationError &&
        error.details.rule === 'page-review-must-be-approved-before-publication',
    );
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test('setNavigation persists canonical navigation with existing page validation', async () => {
  const projectRoot = await createTempProjectRoot();

  try {
    await initializeProject({ repoRoot: projectRoot, languages: ['en'], defaultLanguage: 'en' });
    await createPage({
      projectRoot,
      lang: 'en',
      page: {
        id: 'guide',
        slug: 'guide',
        title: 'Guide',
        content: { blocks: [] },
      },
    });

    const result = await setNavigation({
      projectRoot,
      lang: 'en',
      navigation: {
        version: 1,
        items: [
          {
            type: 'section',
            title: 'Docs',
            children: [
              { type: 'page', pageId: 'welcome' },
              { type: 'page', pageId: 'guide' },
            ],
          },
        ],
      },
    });

    assert.equal(result.navigation.items.length, 1);
    const persisted = await loadNavigation(createDocsRepository(projectRoot), 'en');
    assert.deepEqual(persisted.items, result.navigation.items);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test('setNavigation rejects missing page references through canonical validation', async () => {
  const projectRoot = await createTempProjectRoot();

  try {
    await initializeProject({ repoRoot: projectRoot, languages: ['en'], defaultLanguage: 'en' });

    await assert.rejects(
      () =>
        setNavigation({
          projectRoot,
          lang: 'en',
          navigation: {
            version: 1,
            items: [{ type: 'page', pageId: 'missing-page' }],
          },
        }),
      (error: unknown) =>
        error instanceof ValidationError &&
        error.details.rule === 'navigation-page-reference-must-exist',
    );
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test('replaceNavigationItems preserves the current version and replaces item structure', async () => {
  const projectRoot = await createTempProjectRoot();

  try {
    await initializeProject({ repoRoot: projectRoot, languages: ['en'], defaultLanguage: 'en' });

    const result = await replaceNavigationItems({
      projectRoot,
      lang: 'en',
      items: [
        {
          type: 'section',
          title: 'Guides',
          children: [{ type: 'page', pageId: 'welcome' }],
        },
      ],
    });

    assert.equal(result.navigation.version, 1);
    assert.equal(result.navigation.items[0]?.type, 'section');
    assert.equal(result.navigation.items[0]?.title, 'Guides');
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});
