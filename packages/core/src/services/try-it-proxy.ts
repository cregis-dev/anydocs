import type { ApiSourceDoc, TryItAuth } from '../types/api-source.ts';
import type { OpenApiDocArtifact } from '../types/openapi-doc.ts';
import {
  deriveAllowedHosts,
  invokeTryIt,
  type TryItAuthAdapter,
  type TryItInvokeRequest,
  type TryItInvokeResult,
  type TryItSourceRuntimeConfig,
} from './try-it-engine.ts';

/**
 * Try-it proxy 清单：build 期产出（`dist/mcp/openapi/try-it.json`），独立 proxy 服务启动时读取。
 * 关键安全点：method/path 来自清单（spec 权威），proxy 不信任前端传来的 method/path——前端只提供
 * 业务参数（pathParams/query/headers/body）与用户级凭证。
 */
export const TRY_IT_MANIFEST_VERSION = 1 as const;

export type TryItManifestOperation = { method: string; path: string };

export type TryItManifestSource = {
  sourceId: string;
  lang: string;
  auth: TryItAuth;
  credentialRef?: string;
  baseUrlRef?: string;
  /** spec 中第一个非模板 server，用作无 env override 时的默认 baseUrl（如 dev）。 */
  defaultBaseUrl?: string;
  /** 从 spec servers 派生 + 配置 allowedHosts（不含 baseUrlRef 解析出的 host，由服务端补）。 */
  allowedHosts: string[];
  operations: Record<string, TryItManifestOperation>;
};

export type TryItManifest = {
  version: typeof TRY_IT_MANIFEST_VERSION;
  sources: TryItManifestSource[];
};

/** 从 source + 其 doc artifact 构造清单条目；未开启 Try-it 返回 null。 */
export function buildTryItManifestSource(source: ApiSourceDoc, doc: OpenApiDocArtifact): TryItManifestSource | null {
  const tryIt = source.runtime?.tryIt;
  if (!tryIt?.enabled) {
    return null;
  }
  const operations: Record<string, TryItManifestOperation> = {};
  for (const operation of doc.operations) {
    // 仅可调用接口可被 Try-it（webhook 不可主动调用）
    if (operation.kind === 'endpoint') {
      operations[operation.id] = { method: operation.method, path: operation.path };
    }
  }
  const serverUrls = doc.servers.map((server) => server.url);
  const defaultBaseUrl = serverUrls.find((url) => !url.includes('{'));
  return {
    sourceId: source.id,
    lang: source.lang,
    auth: tryIt.auth ?? { type: 'none' },
    ...(tryIt.credentialRef ? { credentialRef: tryIt.credentialRef } : {}),
    ...(tryIt.baseUrlRef ? { baseUrlRef: tryIt.baseUrlRef } : {}),
    ...(defaultBaseUrl ? { defaultBaseUrl } : {}),
    allowedHosts: deriveAllowedHosts(serverUrls, tryIt.allowedHosts ?? []),
    operations,
  };
}

export type TryItProxyPayload = {
  sourceId: string;
  operationId: string;
  pathParams?: Record<string, string>;
  query?: Record<string, string>;
  headers?: Record<string, string>;
  body?: unknown;
};

export type TryItResolution =
  | { ok: true; config: TryItSourceRuntimeConfig; request: TryItInvokeRequest }
  | { ok: false; error: { code: string; message: string } };

/**
 * 用清单 + 前端 payload + 服务端解析出的真实 baseUrl，组装出引擎可执行的 config/request。
 * method/path 取自清单（不信任前端）；allowedHosts 并入 baseUrl 的 host。
 */
export function resolveTryItInvocation(
  manifest: TryItManifest,
  payload: TryItProxyPayload,
  resolved: { baseUrl: string },
): TryItResolution {
  const source = manifest.sources.find((entry) => entry.sourceId === payload.sourceId);
  if (!source) {
    return { ok: false, error: { code: 'source_not_found', message: `Unknown source "${payload.sourceId}"` } };
  }
  const operation = source.operations[payload.operationId];
  if (!operation) {
    return { ok: false, error: { code: 'operation_not_found', message: `Unknown operation "${payload.operationId}"` } };
  }

  let baseHost: string;
  try {
    baseHost = new URL(resolved.baseUrl).hostname.toLowerCase();
  } catch {
    return { ok: false, error: { code: 'bad_base_url', message: 'Resolved baseUrl is invalid' } };
  }

  const config: TryItSourceRuntimeConfig = {
    baseUrl: resolved.baseUrl,
    auth: source.auth,
    allowedHosts: [...source.allowedHosts, baseHost],
    methods: [operation.method],
  };
  const request: TryItInvokeRequest = {
    sourceId: source.sourceId,
    operationId: payload.operationId,
    method: operation.method,
    path: operation.path,
    pathParams: payload.pathParams,
    query: payload.query,
    headers: payload.headers,
    body: payload.body,
  };
  return { ok: true, config, request };
}

export type TryItProxyEnv = Record<string, string | undefined>;

/** env 凭证命名约定：credentialRef "CREGIS_PAYMENT" → TRYIT_CREGIS_PAYMENT_SECRET 等。 */
export function resolveProjectCredentials(credentialRef: string | undefined, env: TryItProxyEnv): Record<string, string> {
  if (!credentialRef) {
    return {};
  }
  const prefix = `TRYIT_${credentialRef}_`;
  const credentials: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    if (value != null && key.startsWith(prefix)) {
      // TRYIT_CREGIS_PAYMENT_SECRET → secret
      credentials[key.slice(prefix.length).toLowerCase()] = value;
    }
  }
  return credentials;
}

/**
 * 完整装配并执行一次 Try-it 调用（独立 proxy 服务与 dev route 共用）：
 * 解析 baseUrl（env[baseUrlRef] ?? defaultBaseUrl）→ 合并项目级 + 用户级凭证 → resolve → invoke。
 */
export async function handleTryItProxyRequest(
  manifest: TryItManifest,
  payload: TryItProxyPayload & { credentials?: Record<string, string> },
  options: { env?: TryItProxyEnv; adapters?: Record<string, TryItAuthAdapter> } = {},
): Promise<TryItInvokeResult> {
  const env = options.env ?? {};
  const source = manifest.sources.find((entry) => entry.sourceId === payload.sourceId);
  if (!source) {
    return { ok: false, error: { code: 'source_not_found', message: `Unknown source "${payload.sourceId}"` } };
  }

  const baseUrl = (source.baseUrlRef ? env[source.baseUrlRef] : undefined) ?? source.defaultBaseUrl;
  if (!baseUrl) {
    return {
      ok: false,
      error: { code: 'baseurl_unresolved', message: `Set env ${source.baseUrlRef ?? '<baseUrlRef>'} or a concrete server` },
    };
  }

  const resolution = resolveTryItInvocation(manifest, payload, { baseUrl });
  if (!resolution.ok) {
    return { ok: false, error: resolution.error };
  }

  // 项目级凭证（服务端 env，给 signed 适配器）+ 用户级凭证（前端，apiKey/bearer/basic）
  const credentials = { ...resolveProjectCredentials(source.credentialRef, env), ...(payload.credentials ?? {}) };

  return invokeTryIt(resolution.request, resolution.config, credentials, options.adapters ?? {});
}
