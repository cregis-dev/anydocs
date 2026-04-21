import type { IncomingMessage, ServerResponse } from 'node:http';

export async function readJsonBody<T = unknown>(request: IncomingMessage): Promise<T | null> {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }

  if (chunks.length === 0) {
    return null as T;
  }

  const raw = Buffer.concat(chunks).toString('utf8');

  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error('Request body must be valid JSON.');
  }
}

export function sendJson(
  response: ServerResponse,
  statusCode: number,
  body: unknown,
  headers: Record<string, string> = {},
): void {
  response.writeHead(statusCode, {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=utf-8',
    ...headers,
  });
  response.end(JSON.stringify(body));
}
