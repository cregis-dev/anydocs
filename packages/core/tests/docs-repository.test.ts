import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createDocsRepository,
  deletePage,
  findPageBySlug,
  initializeDocsRepository,
  listPages,
  loadNavigation,
  loadPage,
  saveNavigation,
  savePage,
} from '../src/fs/docs-repository.ts';
import { ValidationError } from '../src/errors/validation-error.ts';
import { writeFile } from 'node:fs/promises';

async function createTempProjectRoot(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), 'anydocs-docs-repo-'));
}

test('initializeDocsRepository creates canonical pages and navigation structure', async () => {
  const projectRoot = await createTempProjectRoot();
  const repository = createDocsRepository(projectRoot);

  try {
    await initializeDocsRepository(repository, ['en', 'zh']);
    const navigation = await loadNavigation(repository, 'en');
    assert.deepEqual(navigation, { version: 1, items: [] });
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test('savePage and loadPage persist validated page content through shared repository logic', async () => {
  const projectRoot = await createTempProjectRoot();
  const repository = createDocsRepository(projectRoot);

  try {
    await initializeDocsRepository(repository, ['en']);
    await savePage(repository, 'en', {
      id: 'welcome',
      lang: 'en',
      slug: ' getting-started / welcome ',
      title: 'Welcome',
      status: 'draft',
      content: { blocks: [] },
    });

    const page = await loadPage(repository, 'en', 'welcome');
    assert.equal(page?.slug, 'getting-started/welcome');

    const found = await findPageBySlug(repository, 'en', 'getting-started/welcome');
    assert.equal(found?.id, 'welcome');
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test('savePage canonicalizes legacy Yoopta content before writing page files', async () => {
  const projectRoot = await createTempProjectRoot();
  const repository = createDocsRepository(projectRoot);

  try {
    await initializeDocsRepository(repository, ['en']);
    await savePage(
      repository,
      'en',
      {
        id: 'welcome',
        lang: 'en',
        slug: 'welcome',
        title: 'Welcome',
        status: 'draft',
        content: {
          'block-1': {
            id: 'block-1',
            type: 'Paragraph',
            value: [
              {
                id: 'paragraph-1',
                type: 'paragraph',
                children: [{ text: 'Legacy body copy' }],
                props: { nodeType: 'block' },
              },
            ],
            meta: {
              order: 0,
              depth: 0,
            },
          },
        },
      },
      {
        validateContent(value) {
          const isCanonical = typeof value === 'object' && value !== null && 'version' in (value as Record<string, unknown>);
          if (!isCanonical) {
            return;
          }
        },
      },
    );

    const page = await loadPage(repository, 'en', 'welcome');
    assert.deepEqual(page?.content, {
      version: 1,
      blocks: [
        {
          type: 'paragraph',
          id: 'block-1',
          children: [{ type: 'text', text: 'Legacy body copy' }],
        },
      ],
    });
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test('savePage merges adjacent canonical list blocks before persisting', async () => {
  const projectRoot = await createTempProjectRoot();
  const repository = createDocsRepository(projectRoot);

  try {
    await initializeDocsRepository(repository, ['en']);
    await savePage(repository, 'en', {
      id: 'guide',
      lang: 'en',
      slug: 'guide',
      title: 'Guide',
      status: 'draft',
      content: {
        version: 1,
        blocks: [
          {
            type: 'list',
            id: 'block-1',
            style: 'bulleted',
            items: [{ id: 'item-1', children: [{ type: 'text', text: 'First item' }] }],
          },
          {
            type: 'list',
            id: 'block-2',
            style: 'bulleted',
            items: [{ id: 'item-2', children: [{ type: 'text', text: 'Second item' }] }],
          },
        ],
      },
    });

    const page = await loadPage(repository, 'en', 'guide');
    assert.deepEqual(page?.content, {
      version: 1,
      blocks: [
        {
          type: 'list',
          id: 'block-1',
          style: 'bulleted',
          items: [
            { id: 'item-1', children: [{ type: 'text', text: 'First item' }] },
            { id: 'item-2', children: [{ type: 'text', text: 'Second item' }] },
          ],
        },
      ],
    });
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test('savePage rejects duplicate slugs within the same language', async () => {
  const projectRoot = await createTempProjectRoot();
  const repository = createDocsRepository(projectRoot);

  try {
    await initializeDocsRepository(repository, ['en']);
    await savePage(repository, 'en', {
      id: 'welcome',
      lang: 'en',
      slug: 'getting-started/welcome',
      title: 'Welcome',
      status: 'draft',
      content: { blocks: [] },
    });

    await assert.rejects(
      () =>
        savePage(repository, 'en', {
          id: 'intro',
          lang: 'en',
          slug: 'getting-started/welcome',
          title: 'Intro',
          status: 'draft',
          content: { blocks: [] },
        }),
      /Duplicate slug/,
    );
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test('saveNavigation validates and persists structured navigation items', async () => {
  const projectRoot = await createTempProjectRoot();
  const repository = createDocsRepository(projectRoot);

  try {
    await initializeDocsRepository(repository, ['en']);
    await saveNavigation(repository, 'en', {
      version: 1,
      items: [
        {
          type: 'section',
          title: 'Getting Started',
          children: [{ type: 'page', pageId: 'welcome' }],
        },
      ],
    });

    const navigation = await loadNavigation(repository, 'en');
    assert.equal(navigation.items[0]?.type, 'section');
    const pages = await listPages(repository, 'en');
    assert.deepEqual(pages, []);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test('loadNavigation throws when persisted navigation is invalid instead of silently masking corruption', async () => {
  const projectRoot = await createTempProjectRoot();
  const repository = createDocsRepository(projectRoot);

  try {
    await initializeDocsRepository(repository, ['en']);
    await writeFile(
      path.join(projectRoot, 'navigation', 'en.json'),
      `${JSON.stringify({ version: 1, items: [{ type: 'page' }] }, null, 2)}\n`,
      'utf8',
    );

    await assert.rejects(() => loadNavigation(repository, 'en'), ValidationError);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test('loadPage throws when persisted page content is invalid instead of returning null', async () => {
  const projectRoot = await createTempProjectRoot();
  const repository = createDocsRepository(projectRoot);

  try {
    await initializeDocsRepository(repository, ['en']);
    await writeFile(
      path.join(projectRoot, 'pages', 'en', 'welcome.json'),
      `${JSON.stringify({ id: 'welcome', lang: 'en', slug: 'welcome' }, null, 2)}\n`,
      'utf8',
    );

    await assert.rejects(() => loadPage(repository, 'en', 'welcome'), ValidationError);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test('saveNavigation rejects references to missing pages', async () => {
  const projectRoot = await createTempProjectRoot();
  const repository = createDocsRepository(projectRoot);

  try {
    await initializeDocsRepository(repository, ['en']);

    await assert.rejects(
      () =>
        saveNavigation(
          repository,
          'en',
          {
            version: 1,
            items: [{ type: 'page', pageId: 'missing-page' }],
          },
          { existingPageIds: ['welcome'] },
        ),
      /missing page "missing-page"/i,
    );
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test('savePage rejects publishing reviewed content before explicit approval', async () => {
  const projectRoot = await createTempProjectRoot();
  const repository = createDocsRepository(projectRoot);

  try {
    await initializeDocsRepository(repository, ['en']);

    await assert.rejects(
      () =>
        savePage(repository, 'en', {
          id: 'imported-guide',
          lang: 'en',
          slug: 'imported-guide',
          title: 'Imported Guide',
          status: 'published',
          content: { blocks: [] },
          review: {
            required: true,
            sourceType: 'legacy-import',
            sourceId: 'legacy-1',
          },
        }),
      /explicitly approved before publication/i,
    );
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test('deletePage removes the page file and all matching navigation references', async () => {
  const projectRoot = await createTempProjectRoot();
  const repository = createDocsRepository(projectRoot);

  try {
    await initializeDocsRepository(repository, ['en']);
    await savePage(repository, 'en', {
      id: 'welcome',
      lang: 'en',
      slug: 'welcome',
      title: 'Welcome',
      status: 'draft',
      content: { blocks: [] },
    });
    await savePage(repository, 'en', {
      id: 'guide',
      lang: 'en',
      slug: 'guide',
      title: 'Guide',
      status: 'draft',
      content: { blocks: [] },
    });
    await saveNavigation(
      repository,
      'en',
      {
        version: 1,
        items: [
          {
            type: 'section',
            title: 'Getting Started',
            children: [
              { type: 'page', pageId: 'welcome' },
              {
                type: 'folder',
                title: 'Nested',
                children: [
                  { type: 'page', pageId: 'welcome' },
                  { type: 'page', pageId: 'guide' },
                ],
              },
            ],
          },
        ],
      },
      { existingPageIds: ['welcome', 'guide'] },
    );

    const result = await deletePage(repository, 'en', 'welcome');

    assert.deepEqual(result, {
      pageId: 'welcome',
      lang: 'en',
      removedNavigationRefs: 2,
    });
    assert.equal(await loadPage(repository, 'en', 'welcome'), null);
    assert.deepEqual(await listPages(repository, 'en'), [
      {
        id: 'guide',
        lang: 'en',
        slug: 'guide',
        title: 'Guide',
        status: 'draft',
        content: { blocks: [] },
      },
    ]);
    assert.deepEqual(await loadNavigation(repository, 'en'), {
      version: 1,
      items: [
        {
          type: 'section',
          title: 'Getting Started',
          children: [
            {
              type: 'folder',
              title: 'Nested',
              children: [{ type: 'page', pageId: 'guide' }],
            },
          ],
        },
      ],
    });
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test('deletePage rejects deleting a missing page', async () => {
  const projectRoot = await createTempProjectRoot();
  const repository = createDocsRepository(projectRoot);

  try {
    await initializeDocsRepository(repository, ['en']);

    await assert.rejects(
      () => deletePage(repository, 'en', 'missing-page'),
      (error: unknown) =>
        error instanceof ValidationError &&
        error.details.rule === 'page-delete-target-must-exist',
    );
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});
