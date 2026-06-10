import {
  builtinSignedAdapters,
  deriveAllowedHosts,
  invokeTryIt,
  resolveProjectCredentials,
  type TryItConfig,
  type TryItSourceRuntimeConfig,
} from '@anydocs/core';
import { type NextRequest } from 'next/server';

import { getPublishedApiSourceById, getPublishedApiSourceSpec } from '@/lib/docs/api-sources';
import type { DocsLang } from '@/lib/docs/types';

import { handleRouteError, json, jsonError, readJsonBody, readProjectQuery } from '../_shared';

export const runtime = 'nodejs';

type TryItRequestBody = {
  lang: DocsLang;
  sourceId: string;
  operationId?: string;
  method: string;
  path: string;
  pathParams?: Record<string, string>;
  query?: Record<string, string>;
  headers?: Record<string, string>;
  body?: unknown;
  /** 用户级凭证（apiKey/bearer/basic）——非项目 secret。 */
  credentials?: Record<string, string>;
};

function extractServerUrls(spec: unknown): string[] {
  if (!spec || typeof spec !== 'object') {
    return [];
  }
  const servers = (spec as { servers?: unknown }).servers;
  if (!Array.isArray(servers)) {
    return [];
  }
  return servers
    .map((entry) => (entry && typeof entry === 'object' && typeof (entry as { url?: unknown }).url === 'string' ? (entry as { url: string }).url : null))
    .filter((url): url is string => url !== null);
}

/** dev 模式解析真实 baseUrl：优先 env[baseUrlRef]，否则取 spec 中第一个非模板 server。 */
function resolveBaseUrl(tryIt: TryItConfig, serverUrls: string[]): string | null {
  if (tryIt.baseUrlRef && process.env[tryIt.baseUrlRef]) {
    return process.env[tryIt.baseUrlRef] ?? null;
  }
  return serverUrls.find((url) => !url.includes('{')) ?? null;
}

export async function POST(request: NextRequest) {
  try {
    const { projectId, customPath } = readProjectQuery(request);
    const body = await readJsonBody<TryItRequestBody>(request);

    if (!body.lang || !body.sourceId || !body.method || !body.path) {
      return jsonError('lang, sourceId, method and path are required', 400);
    }

    const source = await getPublishedApiSourceById(body.lang, body.sourceId, projectId, customPath);
    if (!source) {
      return jsonError('API source not found', 404);
    }
    const tryIt = source.runtime?.tryIt;
    if (!tryIt?.enabled) {
      return jsonError('Try-it is not enabled for this source', 403, { code: 'tryit_disabled' });
    }

    const spec = await getPublishedApiSourceSpec(body.lang, body.sourceId, projectId, customPath);
    const serverUrls = extractServerUrls(spec);

    const baseUrl = resolveBaseUrl(tryIt, serverUrls);
    if (!baseUrl) {
      return jsonError('Base URL unresolved: set baseUrlRef env or a concrete server in the spec', 400, {
        code: 'baseurl_unresolved',
      });
    }

    let baseHost: string;
    try {
      baseHost = new URL(baseUrl).hostname;
    } catch {
      return jsonError('Invalid base URL', 400, { code: 'bad_base_url' });
    }

    const config: TryItSourceRuntimeConfig = {
      baseUrl,
      auth: tryIt.auth ?? { type: 'none' },
      allowedHosts: deriveAllowedHosts(serverUrls, [...(tryIt.allowedHosts ?? []), baseHost]),
      ...(tryIt.methods ? { methods: tryIt.methods } : {}),
    };

    const result = await invokeTryIt(
      {
        sourceId: body.sourceId,
        operationId: body.operationId,
        method: body.method,
        path: body.path,
        pathParams: body.pathParams,
        query: body.query,
        headers: body.headers,
        body: body.body,
      },
      config,
      // 项目级凭证（服务端 env，给 signed 适配器）+ 用户级凭证（前端）
      { ...resolveProjectCredentials(tryIt.credentialRef, process.env), ...(body.credentials ?? {}) },
      builtinSignedAdapters,
    );

    return json(result, result.ok ? 200 : 400);
  } catch (error) {
    return handleRouteError(error);
  }
}
