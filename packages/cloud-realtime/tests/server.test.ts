import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WebSocket } from 'ws';
import { createServer } from '../src/server.ts';

// Smoke: the Hocuspocus baseline boots and accepts a WebSocket connection.
test('cloud-realtime baseline boots and accepts a WS connection', async () => {
  const server = createServer(0); // 0 = OS-assigned ephemeral port (no fixed-port flakiness)
  await server.listen();
  const port = server.address.port;
  assert.ok(port > 0, 'server should be listening on an assigned port');

  await new Promise<void>((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    const timer = setTimeout(() => reject(new Error('WS connection timed out')), 4000);
    ws.on('open', () => {
      clearTimeout(timer);
      ws.close();
      resolve();
    });
    ws.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });

  await server.destroy();
});
