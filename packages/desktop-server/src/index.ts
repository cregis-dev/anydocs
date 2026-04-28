export * from './http.ts';
export * from './routes/studio-routes.ts';
export * from './runtime/preview-registry.ts';
export * from './server.ts';
export * from './services/studio-service.ts';
export * from './types.ts';

import path from 'node:path';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { startDesktopServer } from './server.ts';

function normalizeEntryPath(entryPath: string): string {
  try {
    return realpathSync(entryPath);
  } catch {
    return path.resolve(entryPath);
  }
}

function isMainModule(): boolean {
  const entryPoint = process.argv[1];
  if (!entryPoint) {
    return false;
  }

  return normalizeEntryPath(fileURLToPath(import.meta.url)) === normalizeEntryPath(entryPoint);
}

if (isMainModule()) {
  const runtime = await startDesktopServer({
    host: process.env.ANYDOCS_DESKTOP_SERVER_HOST,
    port: process.env.ANYDOCS_DESKTOP_SERVER_PORT ? Number(process.env.ANYDOCS_DESKTOP_SERVER_PORT) : undefined,
    projectRoot: process.env.ANYDOCS_PROJECT_ROOT ?? process.cwd(),
    logger: console,
  });

  process.on('SIGINT', async () => {
    await runtime.close();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await runtime.close();
    process.exit(0);
  });
}
