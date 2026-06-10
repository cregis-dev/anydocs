import { createHash } from 'node:crypto';

import type { TryItAuthAdapter } from './try-it-engine.ts';

/**
 * 内置示例签名适配器。其它项目可参照此实现注册自己的 `signed` 适配器。
 *
 * Cregis 签名规则（https://developer.cregis.com/api-reference/signature）：
 *   1. 排除 `sign` 字段与所有空/null 值参数；
 *   2. 剩余参数按 key 字典序排序；
 *   3. 拼接为 `key1value1key2value2...`（无分隔符）；
 *   4. 在拼接串前 prepend API Key（32 位 hex）；
 *   5. 整串取 md5（小写）得到 sign，放入请求体。
 *
 * 注意：官方文档以简单键值对为例。对数组/对象类字段（如 order_details/tokens）本实现按 JSON.stringify
 * 处理——若 Cregis 服务端对复杂字段的拼接方式不同，需在此调整后再用真实密钥端到端核对。
 */
export function cregisCanonicalString(body: Record<string, unknown>): string {
  return Object.entries(body)
    .filter(([key, value]) => key !== 'sign' && value !== null && value !== undefined && value !== '')
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([key, value]) => `${key}${typeof value === 'object' ? JSON.stringify(value) : String(value)}`)
    .join('');
}

export function cregisSign(body: Record<string, unknown>, apiKey: string): string {
  return createHash('md5')
    .update(apiKey + cregisCanonicalString(body))
    .digest('hex');
}

export const cregisSignAdapter: TryItAuthAdapter = {
  name: 'cregis-sign',
  async apply(req, credentials) {
    const apiKey = credentials.apikey ?? credentials.apiKey ?? credentials.secret ?? '';
    const body =
      req.body && typeof req.body === 'object' && !Array.isArray(req.body)
        ? (req.body as Record<string, unknown>)
        : {};
    return { body: { ...body, sign: cregisSign(body, apiKey) } };
  },
};

/** 内置示例签名适配器注册表（dev route 与独立服务共用）。 */
export const builtinSignedAdapters: Record<string, TryItAuthAdapter> = {
  'cregis-sign': cregisSignAdapter,
};
