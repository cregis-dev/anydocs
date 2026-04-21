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
import { projectTools } from './tools/project-tools.ts';
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
        createToolError('call_tool', new Error(`Unknown tool "${request.params.name}".`), {
          requestedTool: request.params.name,
        }),
      );
    }

    try {
      return renderToolResult(await definition.handler(request.params.arguments));
    } catch (caughtError: unknown) {
      return renderToolResult(
        createToolError(request.params.name, caughtError, {
          requestedTool: request.params.name,
        }),
      );
    }
  });

  return server;
}

export async function startStdioServer(): Promise<void> {
  const server = createAnydocsMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
