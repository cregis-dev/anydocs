import { pathToFileURL } from 'node:url';

import { createAnydocsMcpServer, listToolDefinitions, startStdioServer } from './server.ts';

export { ANYDOCS_MCP_SERVER_NAME, ANYDOCS_MCP_SERVER_VERSION } from './server.ts';
export {
  listAuthoringResourceReferences,
  listAuthoringResourceTemplateReferences,
  listResourceDefinitions,
  listResourceTemplateDefinitions,
  readResource,
} from './resources.ts';
export { navigationTools } from './tools/navigation-tools.ts';
export { pageTools } from './tools/page-tools.ts';
export { projectTools } from './tools/project-tools.ts';
export * from './tools/shared.ts';
export { createAnydocsMcpServer, listToolDefinitions, startStdioServer };

async function main() {
  await startStdioServer();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main().catch((error: unknown) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
