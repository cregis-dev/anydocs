import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { createPage } from '../src/services/authoring-service.ts';
import { initializeProject } from '../src/services/init-service.ts';
import { clonePageToLanguage, listTranslationStatus } from '../src/services/multilingual-service.ts';

async function createTempProjectRoot(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), 'anydocs-multilingual-'));
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

test('clonePageToLanguage creates a draft skeleton unless content copying is requested', async () => {
  const projectRoot = await createTempProjectRoot();

  try {
    await initializeProject({ repoRoot: projectRoot, languages: ['en', 'zh'], defaultLanguage: 'en' });
    await createPage({
      projectRoot,
      lang: 'en',
      page: {
        id: 'guide',
        slug: 'guide',
        title: 'Guide',
        content: createYooptaContent('English body'),
      },
    });
    await createPage({
      projectRoot,
      lang: 'en',
      page: {
        id: 'with-content',
        slug: 'with-content',
        title: 'With Content',
        content: createYooptaContent('Copied body'),
      },
    });

    const skeleton = await clonePageToLanguage({
      projectRoot,
      sourceLang: 'en',
      targetLang: 'zh',
      sourcePageId: 'guide',
    });
    assert.equal(skeleton.page.status, 'draft');
    assert.deepEqual(skeleton.page.content, {});

    const copied = await clonePageToLanguage({
      projectRoot,
      sourceLang: 'en',
      targetLang: 'zh',
      sourcePageId: 'with-content',
      includeContent: true,
    });
    assert.equal(Object.keys(copied.page.content as Record<string, unknown>).length > 0, true);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test('listTranslationStatus reports matched, missing target, and missing source page ids', async () => {
  const projectRoot = await createTempProjectRoot();

  try {
    await initializeProject({ repoRoot: projectRoot, languages: ['en', 'zh'], defaultLanguage: 'en' });
    await createPage({
      projectRoot,
      lang: 'en',
      page: {
        id: 'guide',
        slug: 'guide',
        title: 'Guide',
        content: createYooptaContent('Guide'),
      },
    });
    await clonePageToLanguage({
      projectRoot,
      sourceLang: 'en',
      targetLang: 'zh',
      sourcePageId: 'guide',
    });
    await createPage({
      projectRoot,
      lang: 'zh',
      page: {
        id: 'target-only',
        slug: 'target-only',
        title: 'Target Only',
        content: createYooptaContent('Only target'),
      },
    });

    const status = await listTranslationStatus(projectRoot, 'en', 'zh');

    assert.ok(status.some((entry) => entry.pageId === 'guide' && entry.relation === 'matched'));
    assert.ok(status.some((entry) => entry.pageId === 'welcome' && entry.relation === 'matched'));
    assert.ok(status.some((entry) => entry.pageId === 'target-only' && entry.relation === 'missing_source'));
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});
