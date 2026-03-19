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

function parseEnvelope<TData>(result: Awaited<ReturnType<Client['callTool']>>) {
  const toolResult = result as { content?: Array<{ type: string; text?: string }> };
  const textContent = toolResult.content?.find((item) => item.type === 'text');
  assert.ok(textContent && typeof textContent.text === 'string', 'Expected tool result text content');
  return JSON.parse(textContent.text) as {
    ok: boolean;
    data?: TData;
    error?: Record<string, unknown>;
    meta: { tool: string };
  };
}

test('stdio server registers the v1 tool set and reports tools-only capabilities', async () => {
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
    assert.equal(capabilities?.resources, undefined);
    assert.equal(capabilities?.prompts, undefined);

    const tools = await client.listTools();
    const toolNames = tools.tools.map((tool) => tool.name).sort();
    assert.deepEqual(toolNames, [
      'nav_get',
      'nav_replace_items',
      'nav_set',
      'page_create',
      'page_find',
      'page_get',
      'page_list',
      'page_set_status',
      'page_update',
      'project_open',
      'project_validate',
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

    const projectOpenEnvelope = parseEnvelope<{
      config: { projectId: string };
    }>(
      await client.callTool({
        name: 'project_open',
        arguments: { projectRoot },
      }),
    );
    assert.equal(projectOpenEnvelope.ok, true);
    assert.equal(projectOpenEnvelope.data?.config?.projectId, 'default');

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
  } finally {
    await client.close();
    await rm(projectRoot, { recursive: true, force: true });
  }
});
