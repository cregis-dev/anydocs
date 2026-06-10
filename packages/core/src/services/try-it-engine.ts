import type { TryItAuth } from '../types/api-source.ts';

/**
 * Try-it proxy 引擎（项目无关）。
 * 被 dev 的 Next route 与生产的独立 proxy 服务共用：组装请求 → SSRF 校验 → 应用鉴权 → 转发。
 * 项目特定的部分只有：source 运行时配置（baseUrl/auth/白名单）与自定义签名适配器。
 */

export type TryItInvokeRequest = {
  sourceId: string;
  operationId?: string;
  method: string;
  /** operation 的 path（可含 {param} 占位）。 */
  path: string;
  pathParams?: Record<string, string>;
  query?: Record<string, string>;
  /** 仅用户可填的非敏感头（如自带 token）。 */
  headers?: Record<string, string>;
  body?: unknown;
};

/** 由调用方（route/服务）准备好的、已解析的 source 运行时配置。 */
export type TryItSourceRuntimeConfig = {
  /** 真实 baseUrl（服务端解析，可能来自 env）。 */
  baseUrl: string;
  auth: TryItAuth;
  /** SSRF 白名单（hostname，不含端口）。 */
  allowedHosts: string[];
  /** 方法白名单；缺省不限制。 */
  methods?: string[];
};

export type NormalizedRequest = {
  sourceId: string;
  operationId?: string;
  method: string;
  url: string;
  headers: Record<string, string>;
  body: unknown;
};

export interface TryItAuthAdapter {
  name: string;
  apply(
    req: NormalizedRequest,
    credentials: Record<string, string>,
  ): Promise<{ headers?: Record<string, string>; query?: Record<string, string>; body?: unknown }>;
}

export type TryItInvokeResult =
  | {
      ok: true;
      status: number;
      statusText: string;
      headers: Record<string, string>;
      body: unknown;
      durationMs: number;
    }
  | { ok: false; error: { code: string; message: string } };

// --- 纯函数（可单测）---------------------------------------------------------

/** 私网 / 本地地址判定（SSRF 防护）。 */
export function isPrivateHost(host: string): boolean {
  const h = host.toLowerCase();
  if (h === 'localhost' || h.endsWith('.localhost')) return true;
  if (h === '::1' || h === '0.0.0.0') return true;
  if (/^127\./.test(h) || /^10\./.test(h) || /^192\.168\./.test(h) || /^169\.254\./.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true;
  // IPv6 ULA / link-local
  if (h.startsWith('fc') || h.startsWith('fd') || h.startsWith('fe80')) return true;
  return false;
}

export function isHostAllowed(host: string, allowedHosts: string[]): boolean {
  if (isPrivateHost(host)) return false;
  return allowedHosts.includes(host.toLowerCase());
}

/** 组装真实 URL：替换 path 占位 + 拼 baseUrl + query。可能抛错（baseUrl 非法）。 */
export function assembleUrl(
  baseUrl: string,
  path: string,
  pathParams: Record<string, string> = {},
  query: Record<string, string> = {},
): string {
  let resolvedPath = path;
  for (const [key, value] of Object.entries(pathParams)) {
    resolvedPath = resolvedPath.replace(`{${key}}`, encodeURIComponent(value));
  }
  const base = baseUrl.replace(/\/+$/, '');
  const rel = resolvedPath.startsWith('/') ? resolvedPath : `/${resolvedPath}`;
  const url = new URL(`${base}${rel}`);
  for (const [key, value] of Object.entries(query)) {
    if (value != null && value !== '') {
      url.searchParams.set(key, value);
    }
  }
  return url.toString();
}

/** 内置鉴权：用用户级凭证注入 header/query。signed 不在此处（走适配器）。 */
export function applyBuiltinAuth(
  auth: TryItAuth,
  credentials: Record<string, string>,
): { headers?: Record<string, string>; query?: Record<string, string> } {
  switch (auth.type) {
    case 'apiKey': {
      const key = credentials.apiKey;
      if (!key) return {};
      return auth.in === 'header' ? { headers: { [auth.name]: key } } : { query: { [auth.name]: key } };
    }
    case 'bearer': {
      const token = credentials.token;
      return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
    }
    case 'basic': {
      const { username, password } = credentials;
      if (!username) return {};
      const encoded = Buffer.from(`${username}:${password ?? ''}`).toString('base64');
      return { headers: { Authorization: `Basic ${encoded}` } };
    }
    case 'none':
    case 'signed':
    default:
      return {};
  }
}

// --- 编排（含网络）-----------------------------------------------------------

export async function invokeTryIt(
  req: TryItInvokeRequest,
  config: TryItSourceRuntimeConfig,
  credentials: Record<string, string> = {},
  adapters: Record<string, TryItAuthAdapter> = {},
  options: { timeoutMs?: number; maxBytes?: number } = {},
): Promise<TryItInvokeResult> {
  const { timeoutMs = 15000, maxBytes = 5_000_000 } = options;

  // 方法白名单
  if (config.methods && config.methods.length > 0) {
    const allowed = config.methods.map((method) => method.toUpperCase());
    if (!allowed.includes(req.method.toUpperCase())) {
      return { ok: false, error: { code: 'method_not_allowed', message: `Method ${req.method} not allowed` } };
    }
  }

  // 组装鉴权（先算可能改写 query 的鉴权，再拼 URL）
  let authResult: { headers?: Record<string, string>; query?: Record<string, string>; body?: unknown };
  if (config.auth.type === 'signed') {
    const adapter = adapters[config.auth.adapter];
    if (!adapter) {
      return { ok: false, error: { code: 'adapter_missing', message: `No adapter "${config.auth.adapter}"` } };
    }
    // 自定义签名需要 URL，先用未加签的 URL 组装一个传入
    let preUrl: string;
    try {
      preUrl = assembleUrl(config.baseUrl, req.path, req.pathParams, req.query);
    } catch {
      return { ok: false, error: { code: 'bad_url', message: 'Failed to assemble target URL' } };
    }
    authResult = await adapter.apply(
      { sourceId: req.sourceId, operationId: req.operationId, method: req.method, url: preUrl, headers: { ...req.headers }, body: req.body },
      credentials,
    );
  } else {
    authResult = applyBuiltinAuth(config.auth, credentials);
  }

  const finalQuery = { ...(req.query ?? {}), ...(authResult.query ?? {}) };
  let url: string;
  try {
    url = assembleUrl(config.baseUrl, req.path, req.pathParams, finalQuery);
  } catch {
    return { ok: false, error: { code: 'bad_url', message: 'Failed to assemble target URL' } };
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, error: { code: 'bad_url', message: 'Invalid target URL' } };
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { ok: false, error: { code: 'bad_protocol', message: 'Only http(s) allowed' } };
  }
  if (!isHostAllowed(parsed.hostname, config.allowedHosts)) {
    return { ok: false, error: { code: 'ssrf_blocked', message: `Host ${parsed.hostname} not allowed` } };
  }

  const headers: Record<string, string> = { ...(req.headers ?? {}), ...(authResult.headers ?? {}) };
  const body = authResult.body !== undefined ? authResult.body : req.body;
  const method = req.method.toUpperCase();
  const hasBody = method !== 'GET' && method !== 'HEAD' && body !== undefined;
  if (hasBody && !Object.keys(headers).some((key) => key.toLowerCase() === 'content-type')) {
    headers['Content-Type'] = 'application/json';
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();
  try {
    const response = await fetch(url, {
      method,
      headers,
      body: hasBody ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
      signal: controller.signal,
    });
    const text = await response.text();
    const clipped = text.length > maxBytes ? text.slice(0, maxBytes) : text;
    let parsedBody: unknown = clipped;
    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      try {
        parsedBody = JSON.parse(clipped);
      } catch {
        parsedBody = clipped;
      }
    }
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });
    return {
      ok: true,
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      body: parsedBody,
      durationMs: Date.now() - startedAt,
    };
  } catch (error) {
    const aborted = error instanceof Error && error.name === 'AbortError';
    return {
      ok: false,
      error: {
        code: aborted ? 'timeout' : 'upstream_error',
        message: aborted ? `Request timed out after ${timeoutMs}ms` : (error as Error).message,
      },
    };
  } finally {
    clearTimeout(timer);
  }
}

/** 从 spec servers 的 url 列表派生 SSRF 白名单 hostname。 */
export function deriveAllowedHosts(serverUrls: string[], extra: string[] = []): string[] {
  const hosts = new Set<string>();
  for (const raw of serverUrls) {
    try {
      hosts.add(new URL(raw).hostname.toLowerCase());
    } catch {
      // 含 {baseUrl} 模板等无法解析的，忽略；真实 host 由 extra/env 提供
    }
  }
  // extra 视为裸 hostname（来自 config.allowedHosts / env），直接加入
  for (const host of extra) {
    const trimmed = host.trim().toLowerCase();
    if (trimmed) {
      hosts.add(trimmed);
    }
  }
  return [...hosts];
}
