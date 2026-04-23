import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { initializeProject } from '@anydocs/core';

const SERVER_ENTRY = fileURLToPath(new URL('../src/index.ts', import.meta.url));
const SERVER_WORKDIR = fileURLToPath(new URL('..', import.meta.url));

async function createTempProjectRoot(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), 'anydocs-mcp-server-'));
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

function parseEnvelope<TData>(result: Awaited<ReturnType<Client['callTool']>>) {
  const toolResult = result as { content?: Array<{ type: string; text?: string }> };
  const textContent = toolResult.content?.find((item) => item.type === 'text');
  assert.ok(textContent && typeof textContent.text === 'string', 'Expected tool result text content');
  return JSON.parse(textContent.text) as {
    ok: boolean;
    data?: TData;
    error?: Record<string, unknown>;
    meta: { tool: string; requestedTool?: string };
  };
}

test('stdio server registers tools plus read-only resource capabilities', async () => {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ['--experimental-strip-types', SERVER_ENTRY],
    cwd: SERVER_WORKDIR,
    stderr: 'pipe',
  });
  const client = new Client(
    { name: 'anydocs-mcp-test-client', version: '1.0.0' },
    { capabilities: {} },
  );

  try {
    await client.connect(transport);

    const capabilities = client.getServerCapabilities();
    assert.deepEqual(capabilities?.tools, {});
    assert.deepEqual(capabilities?.resources, {});
    assert.equal(capabilities?.prompts, undefined);

    const tools = await client.listTools();
    const toolNames = tools.tools.map((tool) => tool.name).sort();
    assert.deepEqual(toolNames, [
      'nav_delete',
      'nav_get',
      'nav_insert',
      'nav_move',
      'nav_replace_items',
      'nav_set',
      'page_batch_create',
      'page_batch_set_status',
      'page_batch_update',
      'page_clone_to_language',
      'page_create',
      'page_create_from_markdown',
      'page_create_from_template',
      'page_delete',
      'page_find',
      'page_get',
      'page_list',
      'page_list_translation_status',
      'page_set_status',
      'page_template_query',
      'page_template_save',
      'page_update',
      'page_update_from_markdown',
      'page_update_from_template',
      'project_build',
      'project_open',
      'project_preview_start',
      'project_preview_status',
      'project_preview_stop',
      'project_set_languages',
      'project_sync_workflow',
      'project_update_config',
      'project_validate',
    ]);

    const resources = await client.listResources();
    const resourceUris = resources.resources.map((resource) => resource.uri).sort();
    assert.deepEqual(resourceUris, [
      'anydocs://authoring/guidance',
      'anydocs://content/allowed-types',
      'anydocs://templates/index',
    ]);

    const resourceTemplates = await client.listResourceTemplates();
    const resourceTemplateUris = resourceTemplates.resourceTemplates
      .map((resource) => resource.uriTemplate)
      .sort();
    assert.deepEqual(resourceTemplateUris, [
      'anydocs://blocks/{blockType}/example',
      'anydocs://templates/{templateId}',
    ]);
  } finally {
    await client.close();
  }
});

test('stdio server executes representative tool calls over MCP', async () => {
  const projectRoot = await createTempProjectRoot();
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ['--experimental-strip-types', SERVER_ENTRY],
    cwd: SERVER_WORKDIR,
    stderr: 'pipe',
  });
  const client = new Client(
    { name: 'anydocs-mcp-test-client', version: '1.0.0' },
    { capabilities: {} },
  );

  try {
    await initializeProject({ repoRoot: projectRoot, languages: ['en'], defaultLanguage: 'en' });
    await client.connect(transport);

    const authoringGuidance = await client.readResource({ uri: 'anydocs://authoring/guidance' });
    const authoringGuidanceText = authoringGuidance.contents[0] && 'text' in authoringGuidance.contents[0]
      ? authoringGuidance.contents[0].text
      : '';
    assert.match(String(authoringGuidanceText), /page_create_from_template/);

    const templateResource = await client.readResource({ uri: 'anydocs://templates/how_to' });
    const templateText = templateResource.contents[0] && 'text' in templateResource.contents[0]
      ? templateResource.contents[0].text
      : '';
    assert.match(String(templateText), /"template":/);
    assert.match(String(templateText), /"how_to"/);

    const allowedTypesResource = await client.readResource({ uri: 'anydocs://content/allowed-types' });
    const allowedTypesText = allowedTypesResource.contents[0] && 'text' in allowedTypesResource.contents[0]
      ? allowedTypesResource.contents[0].text
      : '';
    assert.match(String(allowedTypesText), /"format": "doc-content-v1"/);
    assert.match(String(allowedTypesText), /"callout"/);
    assert.match(String(allowedTypesText), /"codeGroup"/);
    assert.match(String(allowedTypesText), /"bold"/);

    const blockResource = await client.readResource({ uri: 'anydocs://blocks/callout/example' });
    const blockText = blockResource.contents[0] && 'text' in blockResource.contents[0]
      ? blockResource.contents[0].text
      : '';
    assert.match(String(blockText), /"blockType": "callout"/);
    assert.match(String(blockText), /"exampleContent"/);

    await assert.rejects(
      () => client.readResource({ uri: 'anydocs://templates/not-real' }),
      (error: unknown) =>
        error instanceof Error &&
        'code' in error &&
        error.code === -32002 &&
        'data' in error &&
        typeof error.data === 'object' &&
        error.data !== null &&
        'uri' in error.data &&
        error.data.uri === 'anydocs://templates/not-real',
    );

    const projectOpenEnvelope = parseEnvelope<{
      config: { projectId: string };
      authoring: {
        contentFormat: string;
        allowedBlockTypes: string[];
        allowedMarks: string[];
        guidance: string[];
        legacyContentFormat: string;
        templates: Array<{ id: string }>;
        resources: Array<{ uri: string }>;
        resourceTemplates: Array<{ uriTemplate: string }>;
      };
      themeCapabilities: {
        navigation: { topNav: boolean };
        features: { search: boolean };
      };
    }>(
      await client.callTool({
        name: 'project_open',
        arguments: { projectRoot },
      }),
    );
    assert.equal(projectOpenEnvelope.ok, true);
    assert.equal(projectOpenEnvelope.data?.config?.projectId, 'default');
    assert.equal(projectOpenEnvelope.data?.authoring?.contentFormat, 'doc-content-v1');
    assert.equal(projectOpenEnvelope.data?.authoring?.legacyContentFormat, 'yoopta');
    assert.equal(projectOpenEnvelope.data?.themeCapabilities?.navigation.topNav, false);
    assert.equal(projectOpenEnvelope.data?.themeCapabilities?.features.search, true);
    assert.ok(projectOpenEnvelope.data?.authoring?.allowedBlockTypes?.includes('codeGroup'));
    assert.ok(projectOpenEnvelope.data?.authoring?.templates?.some((template) => template.id === 'reference'));
    assert.ok(projectOpenEnvelope.data?.authoring?.resources?.some((resource) => resource.uri === 'anydocs://authoring/guidance'));
    assert.ok(
      projectOpenEnvelope.data?.authoring?.resourceTemplates?.some(
        (resourceTemplate) => resourceTemplate.uriTemplate === 'anydocs://blocks/{blockType}/example',
      ),
    );

    const pageGetEnvelope = parseEnvelope<{
      page: { id: string };
      file: string;
    }>(
      await client.callTool({
        name: 'page_get',
        arguments: {
          projectRoot,
          lang: 'en',
          pageId: 'welcome',
        },
      }),
    );
    assert.equal(pageGetEnvelope.ok, true);
    assert.equal(pageGetEnvelope.data?.page?.id, 'welcome');
    assert.match(String(pageGetEnvelope.data?.file), /pages\/en\/welcome\.json$/);

    const dryRunEnvelope = parseEnvelope<{
      dryRun: boolean;
      artifacts: Array<{ id: string; path: string }>;
    }>(
      await client.callTool({
        name: 'project_build',
        arguments: {
          projectRoot,
          dryRun: true,
        },
      }),
    );
    assert.equal(dryRunEnvelope.ok, true);
    assert.equal(dryRunEnvelope.data?.dryRun, true);
    assert.ok(dryRunEnvelope.data?.artifacts?.some((artifact) => artifact.id === 'llms'));

    const pageBatchCreateEnvelope = parseEnvelope<{
      count: number;
      pages: Array<{ id: string }>;
    }>(
      await client.callTool({
        name: 'page_batch_create',
        arguments: {
          projectRoot,
          lang: 'en',
          pages: [
            { id: 'guide', slug: 'guide', title: 'Guide', content: createYooptaContent() },
            { id: 'api', slug: 'api', title: 'API', content: createYooptaContent() },
          ],
        },
      }),
    );
    assert.equal(pageBatchCreateEnvelope.ok, true);
    assert.equal(pageBatchCreateEnvelope.data?.count, 2);

    const pageTemplateEnvelope = parseEnvelope<{
      page: { id: string; render?: { markdown?: string } };
    }>(
      await client.callTool({
        name: 'page_create_from_template',
        arguments: {
          projectRoot,
          lang: 'en',
          pageId: 'publish-guide',
          slug: 'publish-guide',
          title: 'Publish Guide',
          template: 'reference',
          summary: 'Reference the publish workflow.',
          sections: [
            {
              title: 'Allowed states',
              body: 'Pages move from draft to in_review to published.',
              items: ['draft', 'in_review', 'published'],
            },
          ],
        },
      }),
    );
    assert.equal(pageTemplateEnvelope.ok, true);
    assert.equal(pageTemplateEnvelope.data?.page?.id, 'publish-guide');
    assert.match(String(pageTemplateEnvelope.data?.page?.render?.markdown), /## Allowed states/);

    const pageTemplateUpdateEnvelope = parseEnvelope<{
      page: { id: string; render?: { markdown?: string } };
    }>(
      await client.callTool({
        name: 'page_update_from_template',
        arguments: {
          projectRoot,
          lang: 'en',
          pageId: 'publish-guide',
          template: 'how_to',
          summary: 'Use this page to walk through publishing.',
          steps: [
            { title: 'Open the project', body: 'Read the project contract first.' },
            { title: 'Promote the page', body: 'Set status after review.' },
          ],
        },
      }),
    );
    assert.equal(pageTemplateUpdateEnvelope.ok, true);
    assert.match(String(pageTemplateUpdateEnvelope.data?.page?.render?.markdown), /## Steps/);

    const pageRenderEnvelope = parseEnvelope<{
      page: { render?: { markdown?: string; plainText?: string } };
    }>(
      await client.callTool({
        name: 'page_update',
        arguments: {
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
        },
      }),
    );
    assert.equal(pageRenderEnvelope.ok, true);
    assert.equal(pageRenderEnvelope.data?.page?.render?.markdown, '## Updated Section\n\nUpdated body copy');

    const projectSetLanguagesEnvelope = parseEnvelope<{
      config: { defaultLanguage: string; languages: string[] };
    }>(
      await client.callTool({
        name: 'project_set_languages',
        arguments: {
          projectRoot,
          languages: ['en', 'zh'],
          defaultLanguage: 'zh',
        },
      }),
    );
    assert.equal(projectSetLanguagesEnvelope.ok, true);
    assert.equal(projectSetLanguagesEnvelope.data?.config?.defaultLanguage, 'zh');
    assert.deepEqual(projectSetLanguagesEnvelope.data?.config?.languages, ['en', 'zh']);

    const navReplaceEnvelope = parseEnvelope<{
      navigation: { version: number; items: Array<{ type: string; title?: string }> };
    }>(
      await client.callTool({
        name: 'nav_replace_items',
        arguments: {
          projectRoot,
          lang: 'en',
          items: [
            {
              type: 'section',
              title: 'Docs',
              children: [{ type: 'page', pageId: 'welcome' }],
            },
          ],
        },
      }),
    );
    assert.equal(navReplaceEnvelope.ok, true);
    assert.equal(navReplaceEnvelope.data?.navigation?.version, 1);
    assert.equal(navReplaceEnvelope.data?.navigation?.items?.[0]?.title, 'Docs');

    const navInsertEnvelope = parseEnvelope<{
      navigation: { items: Array<{ children?: Array<{ pageId: string }> }> };
    }>(
      await client.callTool({
        name: 'nav_insert',
        arguments: {
          projectRoot,
          lang: 'en',
          parentPath: '0',
          item: { type: 'page', pageId: 'welcome' },
        },
      }),
    );
    assert.equal(navInsertEnvelope.ok, true);
    assert.deepEqual(
      navInsertEnvelope.data?.navigation?.items?.[0]?.children?.map((item) => item.pageId),
      ['welcome', 'welcome'],
    );
  } finally {
    await client.close();
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test('stdio server returns a structured error envelope for unknown tool calls', async () => {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ['--experimental-strip-types', SERVER_ENTRY],
    cwd: SERVER_WORKDIR,
    stderr: 'pipe',
  });
  const client = new Client(
    { name: 'anydocs-mcp-test-client', version: '1.0.0' },
    { capabilities: {} },
  );

  try {
    await client.connect(transport);

    const result = await client.callTool({
      name: 'not_a_real_tool',
      arguments: {},
    });
    const envelope = parseEnvelope<never>(result);

    assert.equal(result.isError, true);
    assert.equal(envelope.ok, false);
    assert.equal(envelope.error?.code, 'MCP_TOOL_ERROR');
    assert.match(String(envelope.error?.message), /Unknown tool "not_a_real_tool"/);
    assert.equal(envelope.meta.tool, 'not_a_real_tool');
    assert.ok(
      Array.isArray(envelope.meta.knownTools) && envelope.meta.knownTools.length > 0,
      'knownTools should be a non-empty array',
    );
  } finally {
    await client.close();
  }
});

test('stdio server preserves resource-not-found semantics for invalid block examples', async () => {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ['--experimental-strip-types', SERVER_ENTRY],
    cwd: SERVER_WORKDIR,
    stderr: 'pipe',
  });
  const client = new Client(
    { name: 'anydocs-mcp-test-client', version: '1.0.0' },
    { capabilities: {} },
  );

  try {
    await client.connect(transport);

    await assert.rejects(
      () => client.readResource({ uri: 'anydocs://blocks/NotARealBlock/example' }),
      (error: unknown) =>
        error instanceof Error &&
        'code' in error &&
        error.code === -32002 &&
        'data' in error &&
        typeof error.data === 'object' &&
        error.data !== null &&
        'reason' in error.data &&
        error.data.reason === 'unknown-block-example',
    );
  } finally {
    await client.close();
  }
});
