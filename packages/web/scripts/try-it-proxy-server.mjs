#!/usr/bin/env node
// 独立 Try-it proxy 服务（生产静态站用，nginx 反代到它）。
// 读 build 期产出的 try-it.json 清单 + 进程 env，调用 @anydocs/core 引擎转发并签名。
//
// 用法：
//   TRYIT_MANIFEST=./dist/mcp/openapi/try-it.json \
//   TRYIT_<CRED>_SECRET=... <BASEURL_REF>=https://real.api \
//   node try-it-proxy-server.mjs
//
// 自定义签名（M4c）：在下方 adapters 注册 { 'cregis-sign': { name, async apply(req, cred) {...} } }。

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

import { builtinSignedAdapters, handleTryItProxyRequest } from '@anydocs/core';

const MANIFEST_PATH = process.env.TRYIT_MANIFEST ?? './dist/mcp/openapi/try-it.json';
const PORT = Number(process.env.PORT ?? 3200);
const ALLOW_ORIGIN = process.env.TRYIT_ALLOW_ORIGIN ?? '';

// 内置示例签名适配器（含 cregis-sign）。项目可在此扩展自己的 signed 适配器。
const adapters = { ...builtinSignedAdapters };

const manifest = JSON.parse(await readFile(MANIFEST_PATH, 'utf8'));

function send(res, status, payload) {
  const headers = { 'content-type': 'application/json' };
  if (ALLOW_ORIGIN) headers['access-control-allow-origin'] = ALLOW_ORIGIN;
  res.writeHead(status, headers);
  res.end(JSON.stringify(payload));
}

const server = createServer(async (req, res) => {
  const url = req.url ?? '';
  if (req.method !== 'POST' || !url.replace(/\/+$/, '').endsWith('/invoke')) {
    send(res, 404, { ok: false, error: { code: 'not_found', message: 'POST /invoke only' } });
    return;
  }

  let raw = '';
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1_000_000) {
      send(res, 413, { ok: false, error: { code: 'payload_too_large', message: 'Request too large' } });
      return;
    }
    raw += chunk;
  }

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    send(res, 400, { ok: false, error: { code: 'bad_json', message: 'Invalid JSON body' } });
    return;
  }

  try {
    const result = await handleTryItProxyRequest(manifest, payload, { env: process.env, adapters });
    send(res, result.ok ? 200 : 400, result);
  } catch (error) {
    send(res, 500, { ok: false, error: { code: 'proxy_error', message: error?.message ?? String(error) } });
  }
});

server.listen(PORT, () => {
  console.log(`[try-it-proxy] listening on :${PORT} (manifest: ${MANIFEST_PATH}, sources: ${manifest.sources?.length ?? 0})`);
});
