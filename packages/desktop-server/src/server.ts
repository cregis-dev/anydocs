import { createServer, type Server } from 'node:http';

import type { DesktopServerOptions, DesktopServerRuntime } from './types.ts';
import { createStudioRouteHandler } from './routes/studio-routes.ts';

function closeServer(server: Server): () => Promise<void> {
  return () =>
    new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
}

export function createDesktopServer(options: DesktopServerOptions = {}): Server {
  const defaultProjectRoot = options.projectRoot ?? process.cwd();
  const handler = createStudioRouteHandler({
    defaultProjectRoot,
    logger: options.logger,
  });

  return createServer((request, response) => {
    void handler(request, response);
  });
}

export async function startDesktopServer(options: DesktopServerOptions = {}): Promise<DesktopServerRuntime> {
  const host = options.host ?? '127.0.0.1';
  const port = options.port ?? 0;
  const server = createDesktopServer(options);

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => resolve());
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Desktop server failed to resolve a listen address.');
  }

  const runtime: DesktopServerRuntime = {
    server,
    host,
    port: address.port,
    url: `http://${host}:${address.port}`,
    close: closeServer(server),
  };

  options.logger?.info?.(`[desktop-server] listening on ${runtime.url}`);
  return runtime;
}
