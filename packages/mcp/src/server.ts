import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListResourceTemplatesRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { listResourceDefinitions, listResourceTemplateDefinitions, readResource } from './resources.ts';
import { navigationTools } from './tools/navigation-tools.ts';
import { pageTools } from './tools/page-tools.ts';
import { projectTools, shutdownAllPreviewSessions } from './tools/project-tools.ts';
import { createToolError, renderToolResult, type ToolDefinition } from './tools/shared.ts';

export const ANYDOCS_MCP_SERVER_NAME = 'anydocs-mcp';
export const ANYDOCS_MCP_SERVER_VERSION = '1.3.0';

const toolDefinitions: ToolDefinition[] = [...projectTools, ...pageTools, ...navigationTools];
const toolDefinitionByName = new Map(toolDefinitions.map((definition) => [definition.name, definition]));

export function listToolDefinitions(): ToolDefinition[] {
  return toolDefinitions;
}

export function createAnydocsMcpServer(): Server {
  const server = new Server(
    {
      name: ANYDOCS_MCP_SERVER_NAME,
      version: ANYDOCS_MCP_SERVER_VERSION,
    },
    {
      capabilities: {
        resources: {},
        tools: {},
      },
    },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: toolDefinitions.map((definition) => ({
      name: definition.name,
      description: definition.description,
      inputSchema: definition.inputSchema,
      ...(definition.annotations ? { annotations: definition.annotations } : {}),
    })),
  }));

  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: listResourceDefinitions(),
  }));

  server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => ({
    resourceTemplates: listResourceTemplateDefinitions(),
  }));

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => readResource(request.params.uri));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const definition = toolDefinitionByName.get(request.params.name);
    if (!definition) {
      return renderToolResult(
        createToolError(request.params.name, new Error(`Unknown tool "${request.params.name}".`), {
          knownTools: [...toolDefinitionByName.keys()],
        }),
      );
    }

    try {
      return renderToolResult(await definition.handler(request.params.arguments));
    } catch (caughtError: unknown) {
      return renderToolResult(
        createToolError(request.params.name, caughtError),
      );
    }
  });

  return server;
}

type ShutdownDeps = {
  server: Server;
  transport: StdioServerTransport;
};

function registerShutdownHandlers({ server, transport }: ShutdownDeps): void {
  let shuttingDown = false;

  async function shutdown(reason: string): Promise<void> {
    if (shuttingDown) return;
    shuttingDown = true;

    try {
      await shutdownAllPreviewSessions();
    } catch (error) {
      process.stderr.write(
        `[anydocs-mcp] preview shutdown error during ${reason}: ${
          error instanceof Error ? error.message : String(error)
        }\n`,
      );
    }

    try {
      await server.close();
    } catch {
      /* best-effort */
    }

    try {
      await transport.close();
    } catch {
      /* best-effort */
    }
  }

  const SIGNALS: NodeJS.Signals[] = ['SIGINT', 'SIGTERM', 'SIGHUP'];
  for (const signal of SIGNALS) {
    process.once(signal, () => {
      void shutdown(signal).finally(() => {
        process.exit(0);
      });
    });
  }

  process.once('beforeExit', () => {
    void shutdown('beforeExit');
  });
}

export async function startStdioServer(): Promise<void> {
  const server = createAnydocsMcpServer();
  const transport = new StdioServerTransport();
  registerShutdownHandlers({ server, transport });
  await server.connect(transport);
}
