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

export type ApiSourceRuntime = {
  routeBase?: string;
  tryIt?: {
    enabled: boolean;
  };
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
