import type { DocsLang } from './docs.ts';

export const API_SOURCE_TYPES = ['openapi'] as const;
export type ApiSourceType = (typeof API_SOURCE_TYPES)[number];

export const API_SOURCE_STATUSES = ['draft', 'published'] as const;
export type ApiSourceStatus = (typeof API_SOURCE_STATUSES)[number];

export type ApiSourceInput =
  | {
      kind: 'url';
      url: string;
    }
  | {
      kind: 'file';
      path: string;
    };

export type ApiSourceDisplay = {
  title: string;
  groupId?: string;
};

/** Try-it 鉴权方式。内置 4 种由引擎处理；`signed` 走可插拔适配器（项目自定义签名）。 */
export type TryItAuth =
  | { type: 'none' }
  | { type: 'apiKey'; in: 'header' | 'query'; name: string }
  | { type: 'bearer' }
  | { type: 'basic' }
  | { type: 'signed'; adapter: string };

export type TryItConfig = {
  enabled: boolean;
  /** 默认 { type: 'none' }。 */
  auth?: TryItAuth;
  /** 指向 proxy 服务端凭证（不含值，按约定映射到 env）。 */
  credentialRef?: string;
  /** 真实 baseUrl 的服务端来源（env key）；缺省时用 spec servers。 */
  baseUrlRef?: string;
  /** 方法白名单；缺省取 spec 中该 operation 声明的方法。 */
  methods?: string[];
  /** 额外允许的目标 host；与 spec servers 派生的 host 取并集。 */
  allowedHosts?: string[];
};

export type ApiSourceRuntime = {
  routeBase?: string;
  tryIt?: TryItConfig;
};

export type ApiSourceDoc = {
  id: string;
  type: ApiSourceType;
  lang: DocsLang;
  status: ApiSourceStatus;
  source: ApiSourceInput;
  display: ApiSourceDisplay;
  runtime?: ApiSourceRuntime;
};

export function isApiSourceType(value: unknown): value is ApiSourceType {
  return typeof value === 'string' && API_SOURCE_TYPES.includes(value as ApiSourceType);
}

export function isApiSourceStatus(value: unknown): value is ApiSourceStatus {
  return typeof value === 'string' && API_SOURCE_STATUSES.includes(value as ApiSourceStatus);
}
