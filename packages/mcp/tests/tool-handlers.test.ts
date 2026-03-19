import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { createPage as createCorePage, initializeProject } from '@anydocs/core';

import { navigationTools } from '../src/tools/navigation-tools.ts';
import { pageTools } from '../src/tools/page-tools.ts';
import { projectTools } from '../src/tools/project-tools.ts';
import type {
  ToolDefinition,
  ToolEnvelope,
  ToolSuccessEnvelope,
} from '../src/tools/shared.ts';

function getTool(name: string): ToolDefinition {
  const definition = [...projectTools, ...pageTools, ...navigationTools].find((tool) => tool.name === name);
  assert.ok(definition, `Missing tool definition for ${name}`);
  return definition;
}

async function createTempProjectRoot(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), 'anydocs-mcp-tools-'));
}

async function invokeTool(name: string, args: Record<string, unknown>): Promise<ToolEnvelope> {
  return getTool(name).handler(args);
}

function expectSuccess<T>(result: ToolEnvelope): ToolSuccessEnvelope<T> {
  assert.equal(result.ok, true);
  return result as ToolSuccessEnvelope<T>;
}

test('project_open returns canonical config, paths, and enabled languages', async () => {
  const projectRoot = await createTempProjectRoot();

  try {
    await initializeProject({ repoRoot: projectRoot, languages: ['en'], defaultLanguage: 'en' });

    const result = await invokeTool('project_open', { projectRoot });

    const success = expectSuccess<{
      config: { projectId: string };
      enabledLanguages: string[];
      paths: { projectRoot: string };
    }>(result);
    assert.equal(success.meta.tool, 'project_open');
    assert.equal(success.data.config.projectId, 'default');
    assert.deepEqual(success.data.enabledLanguages, ['en']);
    assert.equal(success.data.paths.projectRoot, projectRoot);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test('project_validate returns workflow compatibility details', async () => {
  const projectRoot = await createTempProjectRoot();

  try {
    await initializeProject({ repoRoot: projectRoot, languages: ['en'], defaultLanguage: 'en' });

    const result = await invokeTool('project_validate', { projectRoot });

    const success = expectSuccess<{
      valid: boolean;
      workflowCompatibility: { compatible: boolean };
    }>(result);
    assert.equal(success.data.valid, true);
    assert.equal(success.data.workflowCompatibility.compatible, true);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test('page_list and page_find return summarized page metadata with file paths', async () => {
  const projectRoot = await createTempProjectRoot();

  try {
    await initializeProject({ repoRoot: projectRoot, languages: ['en'], defaultLanguage: 'en' });
    await createCorePage({
      projectRoot,
      lang: 'en',
      page: {
        id: 'guide',
        slug: 'guide',
        title: 'Guide',
        tags: ['GUIDE'],
        content: { blocks: [] },
      },
    });

    const listResult = expectSuccess<{
      count: number;
      pages: Array<{ id: string; file: string }>;
    }>(await invokeTool('page_list', { projectRoot, lang: 'en' }));
    assert.equal(listResult.data.count, 2);
    assert.ok(listResult.data.pages.some((page) => page.id === 'guide' && /pages\/en\/guide\.json$/.test(page.file)));

    const findResult = expectSuccess<{
      matches: Array<{ id: string }>;
    }>(await invokeTool('page_find', { projectRoot, lang: 'en', slug: 'guide' }));
    assert.equal(findResult.data.matches.length, 1);
    assert.equal(findResult.data.matches[0]?.id, 'guide');
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test('page_get returns the canonical page document and file path', async () => {
  const projectRoot = await createTempProjectRoot();

  try {
    await initializeProject({ repoRoot: projectRoot, languages: ['en'], defaultLanguage: 'en' });
    await createCorePage({
      projectRoot,
      lang: 'en',
      page: {
        id: 'guide',
        slug: 'guide',
        title: 'Guide',
        content: { blocks: [] },
      },
    });

    const result = expectSuccess<{
      file: string;
      page: { id: string };
    }>(await invokeTool('page_get', {
      projectRoot,
      lang: 'en',
      pageId: 'guide',
    }));
    assert.equal(result.data.page.id, 'guide');
    assert.match(result.data.file, /pages\/en\/guide\.json$/);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test('page_create writes a canonical page through the shared authoring service', async () => {
  const projectRoot = await createTempProjectRoot();

  try {
    await initializeProject({ repoRoot: projectRoot, languages: ['en'], defaultLanguage: 'en' });

    const result = expectSuccess<{
      filePath: string;
      page: { id: string };
    }>(await invokeTool('page_create', {
      projectRoot,
      lang: 'en',
      pageId: 'guide',
      slug: 'guide',
      title: 'Guide',
      content: { blocks: [] },
    }));
    assert.equal(result.data.page.id, 'guide');
    assert.match(result.data.filePath, /pages\/en\/guide\.json$/);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test('page_update returns a structured validation error for unsupported patch fields', async () => {
  const projectRoot = await createTempProjectRoot();

  try {
    await initializeProject({ repoRoot: projectRoot, languages: ['en'], defaultLanguage: 'en' });
    await createCorePage({
      projectRoot,
      lang: 'en',
      page: {
        id: 'guide',
        slug: 'guide',
        title: 'Guide',
        content: { blocks: [] },
      },
    });

    const result = await invokeTool('page_update', {
      projectRoot,
      lang: 'en',
      pageId: 'guide',
      patch: {
        status: 'published',
      },
    });

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, 'VALIDATION_ERROR');
      assert.equal(result.error.rule, 'page-update-patch-fields-must-be-supported');
      assert.deepEqual(result.error.details?.unsupportedFields, ['status']);
    }
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test('page_set_status preserves publication validation behavior', async () => {
  const projectRoot = await createTempProjectRoot();

  try {
    await initializeProject({ repoRoot: projectRoot, languages: ['en'], defaultLanguage: 'en' });
    await createCorePage({
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

    const result = await invokeTool('page_set_status', {
      projectRoot,
      lang: 'en',
      pageId: 'imported-guide',
      status: 'published',
    });

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, 'VALIDATION_ERROR');
      assert.equal(result.error.rule, 'page-review-must-be-approved-before-publication');
    }
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test('nav_get returns the canonical navigation document and file path', async () => {
  const projectRoot = await createTempProjectRoot();

  try {
    await initializeProject({ repoRoot: projectRoot, languages: ['en'], defaultLanguage: 'en' });

    const result = expectSuccess<{
      file: string;
      navigation: { version: number; items: unknown[] };
    }>(await invokeTool('nav_get', {
      projectRoot,
      lang: 'en',
    }));
    assert.match(result.data.file, /navigation\/en\.json$/);
    assert.equal(result.data.navigation.version, 1);
    assert.ok(Array.isArray(result.data.navigation.items));
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test('nav_set replaces the canonical navigation document through shared validation', async () => {
  const projectRoot = await createTempProjectRoot();

  try {
    await initializeProject({ repoRoot: projectRoot, languages: ['en'], defaultLanguage: 'en' });
    await createCorePage({
      projectRoot,
      lang: 'en',
      page: {
        id: 'guide',
        slug: 'guide',
        title: 'Guide',
        content: { blocks: [] },
      },
    });

    const result = expectSuccess<{
      filePath: string;
      navigation: { version: number; items: Array<{ type: string; title?: string }> };
    }>(await invokeTool('nav_set', {
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
    }));
    assert.match(result.data.filePath, /navigation\/en\.json$/);
    assert.equal(result.data.navigation.items[0]?.type, 'section');
    assert.equal(result.data.navigation.items[0]?.title, 'Docs');
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test('nav_replace_items preserves version while replacing top-level navigation items', async () => {
  const projectRoot = await createTempProjectRoot();

  try {
    await initializeProject({ repoRoot: projectRoot, languages: ['en'], defaultLanguage: 'en' });

    const result = expectSuccess<{
      navigation: { version: number; items: Array<{ type: string; title?: string }> };
    }>(await invokeTool('nav_replace_items', {
      projectRoot,
      lang: 'en',
      items: [
        {
          type: 'section',
          title: 'Reference',
          children: [{ type: 'page', pageId: 'welcome' }],
        },
      ],
    }));
    assert.equal(result.data.navigation.version, 1);
    assert.equal(result.data.navigation.items[0]?.type, 'section');
    assert.equal(result.data.navigation.items[0]?.title, 'Reference');
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});
