import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { createPage as createCorePage, initializeProject, updateProjectConfig, validateDocContentV1 } from '@anydocs/core';

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

async function invokeTool(name: string, args: Record<string, unknown>): Promise<ToolEnvelope> {
  return getTool(name).handler(args);
}

function expectSuccess<T>(result: ToolEnvelope): ToolSuccessEnvelope<T> {
  assert.equal(result.ok, true);
  return result as ToolSuccessEnvelope<T>;
}

function isPreviewRuntimeRestricted(result: ToolEnvelope): boolean {
  if (result.ok) {
    return false;
  }

  const message = result.error.message ?? '';
  return (
    /listen EPERM|listen EACCES|operation not permitted 127\.0\.0\.1/.test(message) ||
    /Unable to locate the docs web runtime/.test(message) ||
    /Timed out waiting for docs preview server/.test(message)
  );
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
      themeCapabilities: {
        navigation: { topNav: boolean; topNavGroupSwitching: boolean };
        features: { search: boolean; i18nSwitcher: boolean; darkMode: boolean };
        supportedBlockTypes: string[];
      };
      authoring: {
        contentFormat: string;
        allowedBlockTypes: string[];
        allowedMarks: string[];
        guidance: string[];
        legacyContentFormat: string;
        templates: Array<{
          id: string;
          baseTemplate: string;
          builtIn: boolean;
          recommendedInputs: string[];
          metadataSchema?: { fields: Array<{ id: string; visibility?: string }> };
        }>;
        resources: Array<{ uri: string }>;
        resourceTemplates: Array<{ uriTemplate: string }>;
      };
    }>(result);
    assert.equal(success.meta.tool, 'project_open');
    assert.equal(success.data.config.projectId, 'default');
    assert.deepEqual(success.data.enabledLanguages, ['en']);
    assert.equal(success.data.paths.projectRoot, projectRoot);
    assert.equal(success.data.themeCapabilities.navigation.topNav, false);
    assert.equal(success.data.themeCapabilities.features.search, true);
    assert.ok(success.data.themeCapabilities.supportedBlockTypes.includes('codeGroup'));
    assert.equal(success.data.authoring.contentFormat, 'doc-content-v1');
    assert.equal(success.data.authoring.legacyContentFormat, 'yoopta');
    assert.ok(success.data.authoring.allowedBlockTypes.includes('callout'));
    assert.ok(success.data.authoring.allowedMarks.includes('bold'));
    assert.ok(success.data.authoring.guidance.length > 0);
    assert.ok(success.data.authoring.templates.some((template) => template.id === 'how_to'));
    assert.ok(success.data.authoring.resources.some((resource) => resource.uri === 'anydocs://authoring/guidance'));
    assert.ok(
      success.data.authoring.resourceTemplates.some(
        (resourceTemplate) => resourceTemplate.uriTemplate === 'anydocs://templates/{templateId}',
      ),
    );
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test('project_open returns theme capabilities for blueprint-review projects', async () => {
  const projectRoot = await createTempProjectRoot();

  try {
    await initializeProject({ repoRoot: projectRoot, languages: ['en'], defaultLanguage: 'en' });
    await updateProjectConfig(projectRoot, {
      site: {
        theme: {
          id: 'blueprint-review',
        },
      },
    });

    const result = expectSuccess<{
      config: { site: { theme: { id: string } } };
      themeCapabilities: {
        navigation: { topNav: boolean; topNavGroupSwitching: boolean };
        features: { search: boolean; i18nSwitcher: boolean; darkMode: boolean };
      };
    }>(await invokeTool('project_open', { projectRoot }));

    assert.equal(result.data.config.site.theme.id, 'blueprint-review');
    assert.equal(result.data.themeCapabilities.navigation.topNav, false);
    assert.equal(result.data.themeCapabilities.navigation.topNavGroupSwitching, false);
    assert.equal(result.data.themeCapabilities.features.search, true);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test('project_update_config writes supported project fields through the canonical config path', async () => {
  const projectRoot = await createTempProjectRoot();

  try {
    await initializeProject({ repoRoot: projectRoot, languages: ['en'], defaultLanguage: 'en' });

    const result = expectSuccess<{
      filePath: string;
      config: {
        name: string;
        build?: { outputDir?: string };
        site: {
          url?: string;
          theme: { id: string; codeTheme?: string; branding?: { siteTitle?: string } };
          navigation?: { topNav?: Array<{ id: string }> };
        };
      };
    }>(await invokeTool('project_update_config', {
      projectRoot,
      patch: {
        name: 'Updated Docs',
        build: { outputDir: './public-docs' },
        site: {
          url: 'https://docs.example.com',
          theme: {
            id: 'atlas-docs',
            codeTheme: 'github-light',
            branding: { siteTitle: 'Updated Docs' },
          },
          navigation: {
            topNav: [
              {
                id: 'guides',
                type: 'external',
                href: 'https://example.com/start',
                label: 'Start',
              },
            ],
          },
        },
      },
    }));

    assert.match(result.data.filePath, /anydocs\.config\.json$/);
    assert.equal(result.data.config.name, 'Updated Docs');
    assert.equal(result.data.config.build?.outputDir, './public-docs');
    assert.equal(result.data.config.site.url, 'https://docs.example.com/');
    assert.equal(result.data.config.site.theme.id, 'atlas-docs');
    assert.equal(result.data.config.site.theme.codeTheme, 'github-light');
    assert.equal(result.data.config.site.theme.branding?.siteTitle, 'Updated Docs');
    assert.equal(result.data.config.site.navigation?.topNav?.[0]?.id, 'guides');
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test('project_build dryRun returns planned artifact metadata without writing files', async () => {
  const projectRoot = await createTempProjectRoot();

  try {
    await initializeProject({ repoRoot: projectRoot, languages: ['en'], defaultLanguage: 'en' });

    const result = expectSuccess<{
      dryRun: boolean;
      artifactRoot: string;
      artifacts: Array<{ id: string; path: string }>;
    }>(await invokeTool('project_build', { projectRoot, dryRun: true }));

    assert.equal(result.data.dryRun, true);
    assert.match(result.data.artifactRoot, /dist$/);
    assert.ok(result.data.artifacts.some((artifact) => artifact.id === 'machineReadableIndex'));
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test(
  'project_preview_start, project_preview_status, and project_preview_stop manage preview sessions',
  { timeout: 120_000, concurrency: false },
  async (t) => {
    const projectRoot = await createTempProjectRoot();
    let sessionId: string | undefined;

    try {
      await initializeProject({ repoRoot: projectRoot, languages: ['en'], defaultLanguage: 'en' });

      const startResult = await invokeTool('project_preview_start', {
        projectRoot,
        startTimeoutMs: 60_000,
      });
      if (isPreviewRuntimeRestricted(startResult)) {
        t.skip(`Skipping preview MCP tool test in restricted runtime: ${startResult.error?.message ?? 'unknown error'}`);
        return;
      }

      const started = expectSuccess<{
        session: {
          id: string;
          status: string;
          previewUrl: string;
          projectRoot: string;
          projectId: string;
        };
      }>(startResult);
      sessionId = started.data.session.id;
      assert.equal(started.data.session.status, 'running');
      assert.equal(started.data.session.projectRoot, projectRoot);
      assert.equal(started.data.session.projectId, 'default');
      assert.match(started.data.session.previewUrl, /^http:\/\/127\.0\.0\.1:\d+\//);
      const searchIndexExists = await readFile(path.join(projectRoot, 'dist', 'search-index.en.json'), 'utf8')
        .then(() => true)
        .catch(() => false);
      const searchFindExists = await readFile(path.join(projectRoot, 'dist', 'search-find.en.json'), 'utf8')
        .then(() => true)
        .catch(() => false);
      assert.equal(searchIndexExists || searchFindExists, true);

      const statusOne = expectSuccess<{
        session: { id: string; status: string };
      }>(await invokeTool('project_preview_status', { projectRoot, sessionId }));
      assert.equal(statusOne.data.session.id, sessionId);
      assert.equal(statusOne.data.session.status, 'running');

      const statusAll = expectSuccess<{
        count: number;
        sessions: Array<{ id: string; status: string }>;
      }>(await invokeTool('project_preview_status', { projectRoot }));
      assert.ok(statusAll.data.count >= 1);
      assert.ok(statusAll.data.sessions.some((session) => session.id === sessionId));

      await writeFile(path.join(projectRoot, 'anydocs.config.json'), '{', 'utf8');
      const stopped = expectSuccess<{
        stopped: number;
        sessions: Array<{ id: string; status: string }>;
      }>(await invokeTool('project_preview_stop', { projectRoot, sessionId }));
      assert.equal(stopped.data.stopped, 1);
      assert.equal(stopped.data.sessions[0]?.id, sessionId);
      assert.equal(stopped.data.sessions[0]?.status, 'stopped');
      sessionId = undefined;
    } finally {
      if (sessionId) {
        await invokeTool('project_preview_stop', { projectRoot, sessionId });
      }
      await rm(projectRoot, { recursive: true, force: true });
    }
  },
);

test('project_sync_workflow returns a diff for stale workflow files and can apply it', async () => {
  const projectRoot = await createTempProjectRoot();

  try {
    await initializeProject({ repoRoot: projectRoot, languages: ['en'], defaultLanguage: 'en' });
    const workflowFile = path.join(projectRoot, 'anydocs.workflow.json');
    const persisted = JSON.parse(await readFile(workflowFile, 'utf8')) as Record<string, unknown>;
    const persistedContentModel = persisted.contentModel as Record<string, unknown>;
    persisted.contentModel = {
      ...persistedContentModel,
      pageOptionalFields: ['description'],
    };
    await writeFile(workflowFile, `${JSON.stringify(persisted, null, 2)}\n`, 'utf8');

    const dryRun = expectSuccess<{
      applied: boolean;
      diff: Array<{ path: string; action: string }>;
    }>(await invokeTool('project_sync_workflow', { projectRoot }));
    assert.equal(dryRun.data.applied, false);
    assert.ok(dryRun.data.diff.some((entry) => entry.path === 'contentModel.pageOptionalFields'));

    const applied = expectSuccess<{
      applied: boolean;
      diff: Array<{ path: string; action: string }>;
    }>(await invokeTool('project_sync_workflow', { projectRoot, mode: 'apply' }));
    assert.equal(applied.data.applied, true);
    assert.ok(applied.data.diff.some((entry) => entry.path === 'contentModel.pageOptionalFields'));
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test('project_open returns custom templates alongside built-ins', async () => {
  const projectRoot = await createTempProjectRoot();

  try {
    await initializeProject({ repoRoot: projectRoot, languages: ['en'], defaultLanguage: 'en' });
    const configResult = await updateProjectConfig(projectRoot, {
      authoring: {
        pageTemplates: [
          {
            id: 'adr',
            label: 'ADR',
            baseTemplate: 'reference',
            defaultSummary: 'Document the architectural decision.',
            metadataSchema: {
              fields: [
                {
                  id: 'decision-status',
                  label: 'Decision Status',
                  type: 'enum',
                  required: true,
                  visibility: 'public',
                  options: ['proposed', 'accepted'],
                },
              ],
            },
          },
        ],
      },
    });
    assert.equal(configResult.ok, true);

    const success = expectSuccess<{
      authoring: {
        templates: Array<{
          id: string;
          baseTemplate: string;
          builtIn: boolean;
          defaultSummary?: string;
          metadataSchema?: { fields: Array<{ id: string; visibility?: string }> };
        }>;
      };
    }>(await invokeTool('project_open', { projectRoot }));

    const customTemplate = success.data.authoring.templates.find((template) => template.id === 'adr');
    assert.equal(customTemplate?.baseTemplate, 'reference');
    assert.equal(customTemplate?.builtIn, false);
    assert.equal(customTemplate?.defaultSummary, 'Document the architectural decision.');
    assert.equal(customTemplate?.metadataSchema?.fields[0]?.id, 'decision-status');
    assert.equal(customTemplate?.metadataSchema?.fields[0]?.visibility, 'public');
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test('page_template_save creates, updates, and page_template_query returns resolved templates', async () => {
  const projectRoot = await createTempProjectRoot();

  try {
    await initializeProject({ repoRoot: projectRoot, languages: ['en'], defaultLanguage: 'en' });

    const created = expectSuccess<{
      action: 'created' | 'updated';
      template: {
        id: string;
        builtIn: boolean;
        baseTemplate: string;
        defaultSummary?: string;
        defaultSections?: Array<{ title: string }>;
        metadataSchema?: { fields: Array<{ id: string }> };
      };
    }>(await invokeTool('page_template_save', {
      projectRoot,
      template: {
        id: 'adr',
        label: 'ADR',
        baseTemplate: 'reference',
        defaultSummary: 'Document architectural decisions.',
        defaultSections: [{ title: 'Context', body: 'Why this decision exists.' }],
        metadataSchema: {
          fields: [
            {
              id: 'decision-status',
              label: 'Decision Status',
              type: 'enum',
              required: true,
              options: ['proposed', 'accepted'],
            },
          ],
        },
      },
    }));
    assert.equal(created.data.action, 'created');
    assert.equal(created.data.template.id, 'adr');
    assert.equal(created.data.template.builtIn, false);
    assert.equal(created.data.template.baseTemplate, 'reference');
    assert.equal(created.data.template.defaultSummary, 'Document architectural decisions.');
    assert.equal(created.data.template.defaultSections?.[0]?.title, 'Context');
    assert.equal(created.data.template.metadataSchema?.fields[0]?.id, 'decision-status');

    const updated = expectSuccess<{
      action: 'created' | 'updated';
      template: { id: string; defaultSummary?: string };
    }>(await invokeTool('page_template_save', {
      projectRoot,
      template: {
        id: 'adr',
        label: 'Architecture Decision Record',
        baseTemplate: 'reference',
        defaultSummary: 'Track ADR context, alternatives, and outcomes.',
      },
    }));
    assert.equal(updated.data.action, 'updated');
    assert.equal(updated.data.template.id, 'adr');
    assert.equal(updated.data.template.defaultSummary, 'Track ADR context, alternatives, and outcomes.');

    const queryAll = expectSuccess<{
      templates: Array<{ id: string; builtIn: boolean }>;
    }>(await invokeTool('page_template_query', { projectRoot }));
    assert.ok(queryAll.data.templates.some((template) => template.id === 'concept' && template.builtIn));
    assert.ok(queryAll.data.templates.some((template) => template.id === 'adr' && !template.builtIn));

    const queryOne = expectSuccess<{
      template: {
        id: string;
        defaultSummary?: string;
        baseTemplate: string;
        builtIn: boolean;
        defaultSections?: Array<{ title: string }>;
        metadataSchema?: { fields: Array<{ id: string }> };
      };
    }>(await invokeTool('page_template_query', { projectRoot, templateId: 'adr' }));
    assert.equal(queryOne.data.template.id, 'adr');
    assert.equal(queryOne.data.template.baseTemplate, 'reference');
    assert.equal(queryOne.data.template.builtIn, false);
    assert.equal(queryOne.data.template.defaultSummary, 'Track ADR context, alternatives, and outcomes.');
    assert.equal(queryOne.data.template.defaultSections?.[0]?.title, 'Context');
    assert.equal(queryOne.data.template.metadataSchema?.fields[0]?.id, 'decision-status');
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
        template: 'reference',
        tags: ['GUIDE'],
        content: createYooptaContent(),
      },
    });

    const listResult = expectSuccess<{
      count: number;
      pages: Array<{ id: string; file: string; template?: string; metadata?: Record<string, unknown> }>;
    }>(await invokeTool('page_list', { projectRoot, lang: 'en' }));
    assert.equal(listResult.data.count, 2);
    assert.ok(listResult.data.pages.some((page) => page.id === 'guide' && /pages\/en\/guide\.json$/.test(page.file)));
    assert.equal(listResult.data.pages.find((page) => page.id === 'guide')?.template, 'reference');
    assert.equal('metadata' in (listResult.data.pages.find((page) => page.id === 'guide') ?? {}), false);

    const findResult = expectSuccess<{
      matches: Array<{ id: string; template?: string; metadata?: Record<string, unknown> }>;
    }>(await invokeTool('page_find', { projectRoot, lang: 'en', slug: 'guide' }));
    assert.equal(findResult.data.matches.length, 1);
    assert.equal(findResult.data.matches[0]?.id, 'guide');
    assert.equal(findResult.data.matches[0]?.template, 'reference');
    assert.equal('metadata' in (findResult.data.matches[0] ?? {}), false);
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
        content: createYooptaContent(),
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

test('page_clone_to_language creates a draft skeleton and page_list_translation_status reports missing pairs', async () => {
  const projectRoot = await createTempProjectRoot();

  try {
    await initializeProject({ repoRoot: projectRoot, languages: ['en', 'zh'], defaultLanguage: 'en' });
    await createCorePage({
      projectRoot,
      lang: 'en',
      page: {
        id: 'guide',
        slug: 'guide',
        title: 'Guide',
        content: createYooptaContent('English body'),
      },
    });

    const cloneResult = expectSuccess<{
      page: { id: string; lang: string; status: string; content: Record<string, unknown> };
    }>(await invokeTool('page_clone_to_language', {
      projectRoot,
      sourceLang: 'en',
      targetLang: 'zh',
      sourcePageId: 'guide',
    }));
    assert.equal(cloneResult.data.page.id, 'guide');
    assert.equal(cloneResult.data.page.lang, 'zh');
    assert.equal(cloneResult.data.page.status, 'draft');
    assert.deepEqual(cloneResult.data.page.content, {
      version: 1,
      blocks: [],
    });

    await createCorePage({
      projectRoot,
      lang: 'zh',
      page: {
        id: 'target-only',
        slug: 'target-only',
        title: 'Target Only',
        content: createYooptaContent('Only in target'),
      },
    });

    const statusResult = expectSuccess<{
      count: number;
      pages: Array<{ pageId: string; relation: string; sourceStatus?: string; targetStatus?: string }>;
    }>(await invokeTool('page_list_translation_status', {
      projectRoot,
      sourceLang: 'en',
      targetLang: 'zh',
    }));

    assert.equal(statusResult.data.count, 3);
    assert.ok(
      statusResult.data.pages.some(
        (page) => page.pageId === 'guide' && page.relation === 'matched' && page.targetStatus === 'draft',
      ),
    );
    assert.ok(
      statusResult.data.pages.some(
        (page) => page.pageId === 'target-only' && page.relation === 'missing_source' && page.targetStatus === 'draft',
      ),
    );
    assert.ok(statusResult.data.pages.some((page) => page.pageId === 'welcome' && page.relation === 'matched'));
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
      content: createYooptaContent(),
    }));
    assert.equal(result.data.page.id, 'guide');
    assert.match(result.data.filePath, /pages\/en\/guide\.json$/);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test('page_create accepts template and metadata for project-defined templates', async () => {
  const projectRoot = await createTempProjectRoot();

  try {
    await initializeProject({ repoRoot: projectRoot, languages: ['en'], defaultLanguage: 'en' });
    const configResult = await updateProjectConfig(projectRoot, {
      authoring: {
        pageTemplates: [
          {
            id: 'adr',
            label: 'ADR',
            baseTemplate: 'reference',
            metadataSchema: {
              fields: [
                {
                  id: 'decision-status',
                  label: 'Decision Status',
                  type: 'enum',
                  required: true,
                  options: ['proposed', 'accepted'],
                },
                {
                  id: 'author',
                  label: 'Author',
                  type: 'string',
                },
              ],
            },
          },
        ],
      },
    });
    assert.equal(configResult.ok, true);

    const result = expectSuccess<{
      filePath: string;
      page: { template?: string; metadata?: Record<string, unknown> };
    }>(await invokeTool('page_create', {
      projectRoot,
      lang: 'en',
      pageId: 'adr-001',
      slug: 'architecture/adr-001',
      title: 'Use static search indexes',
      template: 'adr',
      metadata: {
        'decision-status': 'accepted',
        author: '  shawn  ',
      },
      content: createYooptaContent(),
    }));

    assert.equal(result.data.page.template, 'adr');
    assert.deepEqual(result.data.page.metadata, {
      'decision-status': 'accepted',
      author: 'shawn',
    });
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test('page_create_from_markdown infers document fields and returns conversion warnings', async () => {
  const projectRoot = await createTempProjectRoot();

  try {
    await initializeProject({ repoRoot: projectRoot, languages: ['en'], defaultLanguage: 'en' });

    const result = expectSuccess<{
      page: {
        id: string;
        title: string;
        description?: string;
        tags?: string[];
        content: { version: number; blocks: Array<{ type: string }> };
        render?: { markdown?: string };
      };
      conversion: {
        title?: string;
        warnings: Array<{ code: string }>;
      };
    }>(await invokeTool('page_create_from_markdown', {
      projectRoot,
      lang: 'en',
      pageId: 'legacy-guide',
      slug: 'legacy-guide',
      format: 'markdown',
      sourcePath: 'legacy/guide.md',
      markdown: [
        '---',
        'description: Imported from markdown',
        'tags: [guide, migration]',
        'customField: preserve-me',
        '---',
        '',
        '# Legacy Guide',
        '',
        '- bullet item',
        '',
        'Imported body copy',
      ].join('\n'),
    }));

    assert.equal(result.data.page.id, 'legacy-guide');
    assert.equal(result.data.page.title, 'Legacy Guide');
    assert.equal(result.data.page.description, 'Imported from markdown');
    assert.deepEqual(result.data.page.tags, ['guide', 'migration']);
    assert.equal(validateDocContentV1(result.data.page.content).ok, true);
    assert.deepEqual(result.data.page.content.blocks.map((block) => block.type), [
      'heading',
      'list',
      'paragraph',
    ]);
    assert.match(result.data.page.render?.markdown ?? '', /# Legacy Guide/);
    assert.ok(result.data.conversion.warnings.some((warning) => warning.code === 'markdown-frontmatter-unmapped'));
    assert.equal(
      result.data.conversion.warnings.some((warning) => warning.code === 'markdown-construct-review-required'),
      false,
    );
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test('page_create_from_template writes a richer canonical page through template composition', async () => {
  const projectRoot = await createTempProjectRoot();

  try {
    await initializeProject({ repoRoot: projectRoot, languages: ['en'], defaultLanguage: 'en' });

    const result = expectSuccess<{
      filePath: string;
      page: { id: string; render?: { markdown?: string }; content: { version: number; blocks: unknown[] } };
    }>(await invokeTool('page_create_from_template', {
      projectRoot,
      lang: 'en',
      pageId: 'publish-guide',
      slug: 'publish-guide',
      title: 'Publish Guide',
      template: 'how_to',
      summary: 'Use this guide to publish content safely.',
      steps: [
        { title: 'Open the project', body: 'Call project_open first.' },
        {
          title: 'Promote the page',
          body: 'Use page_set_status after content review.',
          code: 'page_set_status({ pageId: "publish-guide", status: "published" })',
          language: 'typescript',
        },
      ],
      callouts: [{ theme: 'warning', body: 'Do not bypass review gates.' }],
    }));
    assert.equal(result.data.page.id, 'publish-guide');
    assert.match(result.data.page.render?.markdown ?? '', /## Steps/);
    assert.equal(validateDocContentV1(result.data.page.content).ok, true);
    assert.equal(result.data.page.content.blocks.length > 3, true);
    assert.match(result.data.filePath, /pages\/en\/publish-guide\.json$/);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test('page_create_from_template supports project-defined templates and default sections', async () => {
  const projectRoot = await createTempProjectRoot();

  try {
    await initializeProject({ repoRoot: projectRoot, languages: ['en'], defaultLanguage: 'en' });
    const configResult = await updateProjectConfig(projectRoot, {
      authoring: {
        pageTemplates: [
          {
            id: 'adr',
            label: 'ADR',
            baseTemplate: 'reference',
            defaultSummary: 'Document this decision with context and consequences.',
            defaultSections: [
              { title: 'Context', body: 'What changed and why now.' },
              { title: 'Decision', body: 'What we decided to do.' },
            ],
            metadataSchema: {
              fields: [
                {
                  id: 'decision-status',
                  label: 'Decision Status',
                  type: 'enum',
                  required: true,
                  options: ['proposed', 'accepted'],
                },
              ],
            },
          },
        ],
      },
    });
    assert.equal(configResult.ok, true);

    const result = expectSuccess<{
      page: {
        id: string;
        template?: string;
        metadata?: Record<string, unknown>;
        render?: { markdown?: string };
      };
    }>(await invokeTool('page_create_from_template', {
      projectRoot,
      lang: 'en',
      pageId: 'adr-001',
      slug: 'architecture/adr-001',
      title: 'Use static search index files',
      template: 'adr',
      metadata: {
        'decision-status': 'proposed',
      },
    }));

    assert.equal(result.data.page.id, 'adr-001');
    assert.equal(result.data.page.template, 'adr');
    assert.equal(result.data.page.metadata?.['decision-status'], 'proposed');
    assert.match(result.data.page.render?.markdown ?? '', /## Context/);
    assert.match(result.data.page.render?.markdown ?? '', /## Decision/);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test('page_update_from_template rewrites an existing page through template composition', async () => {
  const projectRoot = await createTempProjectRoot();

  try {
    await initializeProject({ repoRoot: projectRoot, languages: ['en'], defaultLanguage: 'en' });
    await createCorePage({
      projectRoot,
      lang: 'en',
      page: {
        id: 'publish-guide',
        slug: 'publish-guide',
        title: 'Publish Guide',
        content: createYooptaContent('Before template rewrite'),
      },
    });

    const result = expectSuccess<{
      page: { id: string; render?: { markdown?: string } };
    }>(await invokeTool('page_update_from_template', {
      projectRoot,
      lang: 'en',
      pageId: 'publish-guide',
      template: 'reference',
      title: 'Updated Publish Guide',
      summary: 'Reference the current publishing workflow.',
      sections: [
        {
          title: 'Allowed states',
          body: 'Pages move from draft to in_review to published.',
          items: ['draft', 'in_review', 'published'],
        },
      ],
    }));
    assert.equal(result.data.page.id, 'publish-guide');
    assert.match(result.data.page.render?.markdown ?? '', /## Allowed states/);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test('page_update_from_template can switch to a project-defined template id', async () => {
  const projectRoot = await createTempProjectRoot();

  try {
    await initializeProject({ repoRoot: projectRoot, languages: ['en'], defaultLanguage: 'en' });
    const configResult = await updateProjectConfig(projectRoot, {
      authoring: {
        pageTemplates: [
          {
            id: 'blueprint-review',
            label: 'Blueprint Review',
            baseTemplate: 'reference',
            defaultSummary: 'Capture decision context and review outcomes.',
            defaultSections: [{ title: 'Decision', body: 'Summarize the outcome.' }],
            metadataSchema: {
              fields: [
                {
                  id: 'review-state',
                  label: 'Review State',
                  type: 'enum',
                  required: true,
                  options: ['draft', 'approved'],
                },
              ],
            },
          },
        ],
      },
    });
    assert.equal(configResult.ok, true);

    await createCorePage({
      projectRoot,
      lang: 'en',
      page: {
        id: 'design-review',
        slug: 'design-review',
        title: 'Design Review',
        content: createYooptaContent('Before custom template rewrite'),
      },
    });

    const result = expectSuccess<{
      page: { id: string; template?: string; metadata?: Record<string, unknown>; render?: { markdown?: string } };
    }>(await invokeTool('page_update_from_template', {
      projectRoot,
      lang: 'en',
      pageId: 'design-review',
      template: 'blueprint-review',
      metadata: { 'review-state': 'approved' },
    }));

    assert.equal(result.data.page.id, 'design-review');
    assert.equal(result.data.page.template, 'blueprint-review');
    assert.equal(result.data.page.metadata?.['review-state'], 'approved');
    assert.match(result.data.page.render?.markdown ?? '', /## Decision/);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test('page_create returns a structured validation error for invalid content payloads', async () => {
  const projectRoot = await createTempProjectRoot();

  try {
    await initializeProject({ repoRoot: projectRoot, languages: ['en'], defaultLanguage: 'en' });

    const result = await invokeTool('page_create', {
      projectRoot,
      lang: 'en',
      pageId: 'guide',
      slug: 'guide',
      title: 'Guide',
      content: { blocks: [] },
    });

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, 'VALIDATION_ERROR');
      assert.equal(result.error.rule, 'page-content-must-be-valid-doc-content');
    }
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test('page_batch_create writes multiple canonical pages through the shared authoring service', async () => {
  const projectRoot = await createTempProjectRoot();

  try {
    await initializeProject({ repoRoot: projectRoot, languages: ['en'], defaultLanguage: 'en' });

    const result = expectSuccess<{
      count: number;
      pages: Array<{ id: string }>;
      files: string[];
    }>(await invokeTool('page_batch_create', {
      projectRoot,
      lang: 'en',
      pages: [
        { id: 'guide', slug: 'guide', title: 'Guide', content: createYooptaContent() },
        { id: 'api', slug: 'api', title: 'API', content: createYooptaContent() },
      ],
    }));
    assert.equal(result.data.count, 2);
    assert.deepEqual(result.data.pages.map((page) => page.id), ['guide', 'api']);
    assert.equal(result.data.files.length, 2);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test('page_update can regenerate render output from content when requested', async () => {
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
        content: createYooptaContent('Before render regeneration'),
      },
    });

    const result = expectSuccess<{
      page: { render?: { markdown?: string; plainText?: string } };
    }>(await invokeTool('page_update', {
      projectRoot,
      lang: 'en',
      pageId: 'guide',
      regenerateRender: true,
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
    }));
    assert.equal(result.data.page.render?.markdown, '## Updated Section\n\nUpdated body copy');
    assert.equal(result.data.page.render?.plainText, 'Updated Section\n\nUpdated body copy');
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test('page_update_from_markdown replaces a page from document markdown and can infer the title', async () => {
  const projectRoot = await createTempProjectRoot();

  try {
    await initializeProject({ repoRoot: projectRoot, languages: ['en'], defaultLanguage: 'en' });
    await createCorePage({
      projectRoot,
      lang: 'en',
      page: {
        id: 'guide',
        slug: 'guide',
        title: 'Before',
        content: createYooptaContent('Before body'),
      },
    });

    const result = expectSuccess<{
      page: {
        title: string;
        description?: string;
        tags?: string[];
        render?: { markdown?: string };
      };
      conversion: {
        warnings: Array<{ code: string }>;
      };
    }>(await invokeTool('page_update_from_markdown', {
      projectRoot,
      lang: 'en',
      pageId: 'guide',
      inputMode: 'document',
      markdown: ['---', 'description: Replaced description', 'tags: [updated]', '---', '', '# Replaced Title', '', 'Body copy'].join('\n'),
    }));

    assert.equal(result.data.page.title, 'Replaced Title');
    assert.equal(result.data.page.description, 'Replaced description');
    assert.deepEqual(result.data.page.tags, ['updated']);
    assert.equal(result.data.page.render?.markdown, '# Replaced Title\n\nBody copy');
    assert.deepEqual(result.data.conversion.warnings, []);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test('page_update_from_markdown appends fragment markdown without overwriting existing render', async () => {
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
        content: createYooptaContent('Existing body'),
        render: {
          markdown: '# Guide\n\nExisting body',
          plainText: 'Guide\n\nExisting body',
        },
      },
    });

    const result = expectSuccess<{
      page: {
        title: string;
        render?: { markdown?: string; plainText?: string };
        content: { version: number; blocks: Array<{ type: string }> };
      };
      conversion: {
        warnings: Array<{ code: string }>;
      };
    }>(await invokeTool('page_update_from_markdown', {
      projectRoot,
      lang: 'en',
      pageId: 'guide',
      operation: 'append',
      inputMode: 'fragment',
      markdown: ['## New Section', '', '- appended item'].join('\n'),
    }));

    assert.equal(result.data.page.title, 'Guide');
    assert.equal(result.data.page.render?.markdown, '# Guide\n\nExisting body\n\n## New Section\n\n- appended item');
    assert.equal(result.data.page.render?.plainText, 'Guide\n\nExisting body\n\nNew Section\n\nappended item');
    assert.equal(validateDocContentV1(result.data.page.content).ok, true);
    assert.deepEqual(result.data.page.content.blocks.map((block) => block.type), [
      'paragraph',
      'heading',
      'list',
    ]);
    assert.deepEqual(result.data.conversion.warnings, []);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test('page_update replaces metadata as a whole object for templated pages', async () => {
  const projectRoot = await createTempProjectRoot();

  try {
    await initializeProject({ repoRoot: projectRoot, languages: ['en'], defaultLanguage: 'en' });
    const configResult = await updateProjectConfig(projectRoot, {
      authoring: {
        pageTemplates: [
          {
            id: 'adr',
            label: 'ADR',
            baseTemplate: 'reference',
            metadataSchema: {
              fields: [
                {
                  id: 'decision-status',
                  label: 'Decision Status',
                  type: 'enum',
                  required: true,
                  options: ['proposed', 'accepted'],
                },
                {
                  id: 'author',
                  label: 'Author',
                  type: 'string',
                },
              ],
            },
          },
        ],
      },
    });
    assert.equal(configResult.ok, true);

    const created = expectSuccess<{
      filePath: string;
    }>(await invokeTool('page_create', {
      projectRoot,
      lang: 'en',
      pageId: 'adr-001',
      slug: 'architecture/adr-001',
      title: 'Use static search indexes',
      template: 'adr',
      metadata: {
        'decision-status': 'proposed',
        author: 'shawn',
      },
      content: createYooptaContent(),
    }));

    const result = expectSuccess<{
      page: { template?: string; metadata?: Record<string, unknown> };
    }>(await invokeTool('page_update', {
      projectRoot,
      lang: 'en',
      pageId: 'adr-001',
      patch: {
        metadata: {
          'decision-status': 'accepted',
        },
      },
    }));

    assert.equal(result.data.page.template, 'adr');
    assert.deepEqual(result.data.page.metadata, {
      'decision-status': 'accepted',
    });

    const persisted = JSON.parse(await readFile(created.data.filePath, 'utf8')) as {
      metadata?: Record<string, unknown>;
    };
    assert.deepEqual(persisted.metadata, {
      'decision-status': 'accepted',
    });
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
        content: createYooptaContent(),
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

test('page_batch_update applies multiple shallow patches in one validated batch', async () => {
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
        content: createYooptaContent(),
      },
    });
    await createCorePage({
      projectRoot,
      lang: 'en',
      page: {
        id: 'api',
        slug: 'api',
        title: 'API',
        content: createYooptaContent(),
      },
    });

    const result = expectSuccess<{
      count: number;
      pages: Array<{ id: string; title: string; description?: string }>;
    }>(await invokeTool('page_batch_update', {
      projectRoot,
      lang: 'en',
      updates: [
        { pageId: 'guide', patch: { title: 'Guide Updated' } },
        { pageId: 'api', patch: { description: 'API Reference' } },
      ],
    }));
    assert.equal(result.data.count, 2);
    assert.equal(result.data.pages[0]?.title, 'Guide Updated');
    assert.equal(result.data.pages[1]?.description, 'API Reference');
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test('page_batch_update fails atomically when any requested page is missing', async () => {
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
        content: createYooptaContent(),
      },
    });
    await createCorePage({
      projectRoot,
      lang: 'en',
      page: {
        id: 'api',
        slug: 'api',
        title: 'API',
        content: createYooptaContent(),
      },
    });

    const result = await invokeTool('page_batch_update', {
      projectRoot,
      lang: 'en',
      updates: [
        { pageId: 'guide', patch: { title: 'Guide Updated' } },
        { pageId: 'missing-page', patch: { description: 'Should fail' } },
      ],
    });

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, 'VALIDATION_ERROR');
      assert.equal(result.error.rule, 'page-must-exist');
      assert.equal(result.error.details?.pageId, 'missing-page');
    }

    const guidePage = expectSuccess<{
      page: { title: string; description?: string };
    }>(await invokeTool('page_get', {
      projectRoot,
      lang: 'en',
      pageId: 'guide',
    }));
    assert.equal(guidePage.data.page.title, 'Guide');
    assert.equal(guidePage.data.page.description, undefined);

    const apiPage = expectSuccess<{
      page: { title: string; description?: string };
    }>(await invokeTool('page_get', {
      projectRoot,
      lang: 'en',
      pageId: 'api',
    }));
    assert.equal(apiPage.data.page.title, 'API');
    assert.equal(apiPage.data.page.description, undefined);
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
        content: createYooptaContent(),
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

test('page_batch_set_status updates multiple page statuses in one validated batch', async () => {
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
        content: createYooptaContent(),
      },
    });
    await createCorePage({
      projectRoot,
      lang: 'en',
      page: {
        id: 'api',
        slug: 'api',
        title: 'API',
        content: createYooptaContent(),
      },
    });

    const result = expectSuccess<{
      count: number;
      pages: Array<{ id: string; status: string }>;
    }>(await invokeTool('page_batch_set_status', {
      projectRoot,
      lang: 'en',
      updates: [
        { pageId: 'guide', status: 'in_review' },
        { pageId: 'api', status: 'in_review' },
      ],
    }));
    assert.equal(result.data.count, 2);
    assert.deepEqual(result.data.pages.map((page) => page.status), ['in_review', 'in_review']);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test('page_delete removes the page file and matching navigation references', async () => {
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
        content: createYooptaContent(),
      },
    });
    await invokeTool('nav_set', {
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

    const result = expectSuccess<{
      pageId: string;
      removedNavigationRefs: number;
      filePath: string;
    }>(await invokeTool('page_delete', {
      projectRoot,
      lang: 'en',
      pageId: 'guide',
    }));
    assert.equal(result.data.pageId, 'guide');
    assert.equal(result.data.removedNavigationRefs, 1);
    assert.match(result.data.filePath, /pages\/en\/guide\.json$/);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test('project_set_languages returns a structured validation error when defaultLanguage is not enabled', async () => {
  const projectRoot = await createTempProjectRoot();

  try {
    await initializeProject({ repoRoot: projectRoot, languages: ['en'], defaultLanguage: 'en' });

    const result = await invokeTool('project_set_languages', {
      projectRoot,
      languages: ['en'],
      defaultLanguage: 'zh',
    });

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, 'VALIDATION_ERROR');
      assert.equal(result.error.rule, 'default-language-must-be-enabled');
      assert.deepEqual(result.error.details?.languages, ['en']);
      assert.equal(result.error.details?.defaultLanguage, 'zh');
    }
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test('project_set_languages updates the enabled language set through canonical project config logic', async () => {
  const projectRoot = await createTempProjectRoot();

  try {
    await initializeProject({ repoRoot: projectRoot, languages: ['en'], defaultLanguage: 'en' });

    const result = expectSuccess<{
      filePath: string;
      config: { defaultLanguage: string; languages: string[] };
    }>(await invokeTool('project_set_languages', {
      projectRoot,
      languages: ['en', 'zh'],
      defaultLanguage: 'zh',
    }));
    assert.match(result.data.filePath, /anydocs\.config\.json$/);
    assert.equal(result.data.config.defaultLanguage, 'zh');
    assert.deepEqual(result.data.config.languages, ['en', 'zh']);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test('nav_get rejects requests for languages that are not enabled for the project', async () => {
  const projectRoot = await createTempProjectRoot();

  try {
    await initializeProject({ repoRoot: projectRoot, languages: ['en'], defaultLanguage: 'en' });

    const result = await invokeTool('nav_get', {
      projectRoot,
      lang: 'zh',
    });

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, 'VALIDATION_ERROR');
      assert.equal(result.error.rule, 'mcp-tool-language-must-be-enabled');
      assert.deepEqual(result.error.details?.enabledLanguages, ['en']);
      assert.equal(result.error.details?.lang, 'zh');
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
        content: createYooptaContent(),
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

test('nav_insert appends a navigation item into a section by parentPath', async () => {
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
        content: createYooptaContent(),
      },
    });
    await invokeTool('nav_set', {
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

    const result = expectSuccess<{
      navigation: { items: Array<{ type: string; children?: Array<{ pageId: string }> }> };
    }>(await invokeTool('nav_insert', {
      projectRoot,
      lang: 'en',
      parentPath: '0',
      item: { type: 'page', pageId: 'guide' },
    }));
    assert.equal(result.data.navigation.items[0]?.type, 'section');
    assert.deepEqual(result.data.navigation.items[0]?.children?.map((item) => item.pageId), [
      'welcome',
      'guide',
    ]);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test('nav_delete removes a single navigation item by itemPath', async () => {
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
        content: createYooptaContent(),
      },
    });
    await invokeTool('nav_set', {
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

    const result = expectSuccess<{
      navigation: { items: Array<{ type: string; children?: Array<{ pageId: string }> }> };
    }>(await invokeTool('nav_delete', {
      projectRoot,
      lang: 'en',
      itemPath: '0/1',
    }));
    assert.deepEqual(result.data.navigation.items[0]?.children?.map((item) => item.pageId), [
      'welcome',
    ]);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test('nav_move moves an item into a different section by itemPath and parentPath', async () => {
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
        content: createYooptaContent(),
      },
    });
    await invokeTool('nav_set', {
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

    const result = expectSuccess<{
      navigation: { items: Array<{ type: string; children?: Array<{ pageId: string }> }> };
    }>(await invokeTool('nav_move', {
      projectRoot,
      lang: 'en',
      itemPath: '1/0',
      parentPath: '0',
      index: 1,
    }));
    assert.deepEqual(result.data.navigation.items[0]?.children?.map((item) => item.pageId), [
      'welcome',
      'guide',
    ]);
    assert.deepEqual(result.data.navigation.items[1]?.children, []);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});
