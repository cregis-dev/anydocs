import { Server } from '@hocuspocus/server';

// Baseline Hocuspocus (Yjs) WebSocket backend for the Cloud Team Edition.
// STORY C1.0 SCOPE: a bootable, connectable baseline only. Auth, Postgres persistence
// (ydoc_states), and the Y.Doc <-> doc-content-v1 materialization bridge are wired by
// later stories via the extensions/ stubs — they are intentionally NOT registered here.

export function createServer(port = Number(process.env.REALTIME_PORT ?? 1234)): Server {
  return new Server({ port });
}

// Entry point when run directly (pnpm dev / start).
const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const server = createServer();
  await server.listen();
  // eslint-disable-next-line no-console
  console.log(`[cloud-realtime] Hocuspocus baseline listening on ${server.webSocketURL}`);
}
