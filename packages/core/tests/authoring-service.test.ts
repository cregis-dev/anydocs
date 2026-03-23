import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { ValidationError } from '../src/errors/validation-error.ts';
import { createDocsRepository, loadNavigation, loadPage } from '../src/fs/docs-repository.ts';
import {
  createPagesBatch,
  createPage,
  deleteAuthoredPage,
  deleteNavigationItem,
  insertNavigationItem,
  moveNavigationItem,
  replaceNavigationItems,
  setPageStatus,
  setPageStatusesBatch,
  setProjectLanguages,
  setNavigation,
  updatePagesBatch,
  updatePage,
} from '../src/services/authoring-service.ts';
import { loadProjectContract } from '../src/fs/content-repository.ts';
import { initializeProject } from '../src/services/init-service.ts';

async function createTempProjectRoot(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), 'anydocs-authoring-'));
}

function createYooptaContent(text: string = 'Body copy') {
  return {
    'block-1': {
      id: 'block-1',
      type: 'Paragraph',
      value: [
        {
          id: 'paragraph-1',
          type: 'paragraph',
          children: [{ text }],
          props: { nodeType: 'block' },
        },
      ],
      meta: {
        order: 0,
        depth: 0,
      },
    },
  };
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
        content: createYooptaContent(),
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
        content: createYooptaContent(),
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
            content: createYooptaContent(),
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

test('createPage rejects content that is not valid Yoopta structure', async () => {
  const projectRoot = await createTempProjectRoot();

  try {
    await initializeProject({ repoRoot: projectRoot, languages: ['en'], defaultLanguage: 'en' });

    await assert.rejects(
      () =>
        createPage({
          projectRoot,
          lang: 'en',
          page: {
            id: 'guide',
            slug: 'guide',
            title: 'Guide',
            content: {
              blocks: [],
            },
          },
        }),
      (error: unknown) =>
        error instanceof ValidationError &&
        error.details.rule === 'page-content-must-be-valid-yoopta',
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
        content: createYooptaContent(),
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

test('updatePage can regenerate render output from the resulting Yoopta content', async () => {
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
        content: createYooptaContent('Before'),
      },
    });

    const result = await updatePage({
      projectRoot,
      lang: 'en',
      pageId: 'guide',
      patch: {
        content: {
          'block-1': {
            id: 'block-1',
            type: 'HeadingTwo',
            value: [
              {
                id: 'heading-1',
                type: 'heading-two',
                children: [{ text: 'Updated Section' }],
                props: { nodeType: 'block' },
              },
            ],
            meta: { order: 0, depth: 0 },
          },
          'block-2': {
            id: 'block-2',
            type: 'Paragraph',
            value: [
              {
                id: 'paragraph-2',
                type: 'paragraph',
                children: [{ text: 'Updated body copy' }],
                props: { nodeType: 'block' },
              },
            ],
            meta: { order: 1, depth: 0 },
          },
        },
      },
      regenerateRender: true,
    });

    assert.equal(result.page.render?.markdown, '## Updated Section\n\nUpdated body copy');
    assert.equal(result.page.render?.plainText, 'Updated Section\n\nUpdated body copy');
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
        content: createYooptaContent(),
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
        content: createYooptaContent(),
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

test('deleteAuthoredPage removes the page file and matching navigation references through authoring service', async () => {
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
        content: createYooptaContent(),
      },
    });
    await setNavigation({
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

    const result = await deleteAuthoredPage({
      projectRoot,
      lang: 'en',
      pageId: 'guide',
    });

    assert.match(result.filePath, /pages\/en\/guide\.json$/);
    assert.equal(result.removedNavigationRefs, 1);
    assert.equal(await loadPage(createDocsRepository(projectRoot), 'en', 'guide'), null);
    const navigation = await loadNavigation(createDocsRepository(projectRoot), 'en');
    assert.deepEqual(navigation.items, [
      {
        type: 'section',
        title: 'Docs',
        children: [{ type: 'page', pageId: 'welcome' }],
      },
    ]);
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
        content: createYooptaContent(),
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

test('setProjectLanguages updates enabled languages and refreshes canonical project contract files', async () => {
  const projectRoot = await createTempProjectRoot();

  try {
    await initializeProject({ repoRoot: projectRoot, languages: ['en'], defaultLanguage: 'en' });

    const result = await setProjectLanguages({
      projectRoot,
      languages: ['en', 'zh'],
      defaultLanguage: 'zh',
    });

    assert.match(result.filePath, /anydocs\.config\.json$/);
    assert.deepEqual(result.config.languages, ['en', 'zh']);
    assert.equal(result.config.defaultLanguage, 'zh');

    const contractResult = await loadProjectContract(projectRoot);
    assert.equal(contractResult.ok, true);
    if (contractResult.ok) {
      assert.deepEqual(contractResult.value.config.languages, ['en', 'zh']);
      assert.equal(contractResult.value.config.defaultLanguage, 'zh');
    }
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test('insertNavigationItem inserts into a nested section without replacing the whole document manually', async () => {
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
        content: createYooptaContent(),
      },
    });
    await setNavigation({
      projectRoot,
      lang: 'en',
      navigation: {
        version: 1,
        items: [
          {
            type: 'section',
            title: 'Docs',
            children: [{ type: 'page', pageId: 'welcome' }],
          },
        ],
      },
    });

    const result = await insertNavigationItem({
      projectRoot,
      lang: 'en',
      parentPath: '0',
      index: 1,
      item: { type: 'page', pageId: 'guide' },
    });

    assert.deepEqual(result.navigation.items, [
      {
        type: 'section',
        title: 'Docs',
        children: [
          { type: 'page', pageId: 'welcome' },
          { type: 'page', pageId: 'guide' },
        ],
      },
    ]);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test('deleteNavigationItem removes only the targeted item path', async () => {
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
        content: createYooptaContent(),
      },
    });
    await setNavigation({
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

    const result = await deleteNavigationItem({
      projectRoot,
      lang: 'en',
      itemPath: '0/1',
    });

    assert.deepEqual(result.navigation.items, [
      {
        type: 'section',
        title: 'Docs',
        children: [{ type: 'page', pageId: 'welcome' }],
      },
    ]);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test('moveNavigationItem reorders a nested item into a different top-level group', async () => {
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
        content: createYooptaContent(),
      },
    });
    await setNavigation({
      projectRoot,
      lang: 'en',
      navigation: {
        version: 1,
        items: [
          {
            type: 'section',
            title: 'Getting Started',
            children: [{ type: 'page', pageId: 'welcome' }],
          },
          {
            type: 'section',
            title: 'Reference',
            children: [{ type: 'page', pageId: 'guide' }],
          },
        ],
      },
    });

    const result = await moveNavigationItem({
      projectRoot,
      lang: 'en',
      itemPath: '1/0',
      parentPath: '0',
      index: 1,
    });

    assert.deepEqual(result.navigation.items, [
      {
        type: 'section',
        title: 'Getting Started',
        children: [
          { type: 'page', pageId: 'welcome' },
          { type: 'page', pageId: 'guide' },
        ],
      },
      {
        type: 'section',
        title: 'Reference',
        children: [],
      },
    ]);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test('createPagesBatch creates multiple pages after validating the whole batch', async () => {
  const projectRoot = await createTempProjectRoot();

  try {
    await initializeProject({ repoRoot: projectRoot, languages: ['en'], defaultLanguage: 'en' });

    const result = await createPagesBatch({
      projectRoot,
      lang: 'en',
      pages: [
        {
          id: 'guide',
          slug: 'guide',
          title: 'Guide',
          content: createYooptaContent(),
        },
        {
          id: 'api',
          slug: 'api',
          title: 'API',
          content: createYooptaContent(),
        },
      ],
    });

    assert.equal(result.count, 2);
    assert.deepEqual(result.pages.map((page) => page.id), ['guide', 'api']);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test('updatePagesBatch applies multiple page patches atomically', async () => {
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
        content: createYooptaContent(),
      },
    });
    await createPage({
      projectRoot,
      lang: 'en',
      page: {
        id: 'api',
        slug: 'api',
        title: 'API',
        content: createYooptaContent(),
      },
    });

    const result = await updatePagesBatch({
      projectRoot,
      lang: 'en',
      updates: [
        {
          pageId: 'guide',
          patch: { title: 'Guide Updated' },
        },
        {
          pageId: 'api',
          patch: { description: 'API Reference' },
        },
      ],
    });

    assert.equal(result.count, 2);
    assert.equal(result.pages[0]?.title, 'Guide Updated');
    assert.equal(result.pages[1]?.description, 'API Reference');
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test('setPageStatusesBatch updates multiple page statuses in one validated batch', async () => {
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
        content: createYooptaContent(),
      },
    });
    await createPage({
      projectRoot,
      lang: 'en',
      page: {
        id: 'api',
        slug: 'api',
        title: 'API',
        content: createYooptaContent(),
      },
    });

    const result = await setPageStatusesBatch({
      projectRoot,
      lang: 'en',
      updates: [
        { pageId: 'guide', status: 'in_review' },
        { pageId: 'api', status: 'in_review' },
      ],
    });

    assert.equal(result.count, 2);
    assert.deepEqual(result.pages.map((page) => page.status), ['in_review', 'in_review']);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});
