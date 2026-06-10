/**
 * 渲染就绪的 OpenAPI 文档契约（主题无关）。
 *
 * 由 build 期一次性从原始 spec 解析产出（`doc.<id>.<lang>.json`），reader 侧零解析、纯渲染。
 * 解析策略：命名 schema（`#/components/schemas/X`）一律转为 `{ ref: 'X' }` 引用、不内联展开，
 * 既保证产物体积可控，又天然规避循环引用——环的解引用交给渲染层按需进行并自行防护。
 */

export const OPENAPI_DOC_ARTIFACT_VERSION = 1 as const;

/** 解析后的 schema 节点。命名引用以 `ref` 表达，渲染层用 `schemas` 字典解引用。 */
export type ResolvedSchema = {
  /** 指向命名 schema（`OpenApiDocArtifact.schemas` 的 key）；存在时通常不再内联其它字段。 */
  ref?: string;
  type?: string;
  format?: string;
  title?: string;
  description?: string;
  required?: string[];
  properties?: Record<string, ResolvedSchema>;
  items?: ResolvedSchema;
  enum?: unknown[];
  default?: unknown;
  example?: unknown;
  nullable?: boolean;
  deprecated?: boolean;
  readOnly?: boolean;
  writeOnly?: boolean;
  /** 组合模式：allOf 已尽量浅合并到顶层 properties/required，members 保留供渲染层展示。 */
  composition?: {
    kind: 'allOf' | 'oneOf' | 'anyOf';
    members: ResolvedSchema[];
  };
  /** 渲染层解引用时检测到环可置位（build 期默认不置位，预留给渲染层标注）。 */
  cyclic?: boolean;
};

export type ResolvedMediaType = {
  mediaType: string;
  schema?: ResolvedSchema;
  example?: unknown;
};

export type ResolvedParameter = {
  in: 'path' | 'query' | 'header' | 'cookie';
  name: string;
  required: boolean;
  deprecated?: boolean;
  description?: string;
  schema?: ResolvedSchema;
  example?: unknown;
};

export type ResolvedRequestBody = {
  required: boolean;
  description?: string;
  contents: ResolvedMediaType[];
};

export type ResolvedResponse = {
  status: string;
  description?: string;
  contents: ResolvedMediaType[];
};

export type ResolvedSecurityRequirement = {
  scheme: string;
  type?: string;
  in?: string;
  name?: string;
  scopes?: string[];
};

export type OpenApiOperation = {
  /** operationId 或由 method+path 派生。 */
  id: string;
  /** `endpoint`=可调用接口（来自 paths）；`webhook`=Cregis 主动推送的回调（来自 OAS 3.1 webhooks，不可主动调用）。 */
  kind: 'endpoint' | 'webhook';
  method: string;
  /** endpoint 为 URL path；webhook 为事件名（如 orderCallback）。 */
  path: string;
  summary: string;
  description?: string;
  tag: string;
  deprecated?: boolean;
  parameters: ResolvedParameter[];
  requestBody?: ResolvedRequestBody;
  responses: ResolvedResponse[];
  security?: ResolvedSecurityRequirement[];
  /** 独立深链：`/<lang>/reference/<source>/<operationId>`。 */
  href: string;
};

export type OpenApiServerVariable = {
  default: string;
  enum?: string[];
  description?: string;
};

export type OpenApiServer = {
  url: string;
  description?: string;
  variables?: Record<string, OpenApiServerVariable>;
};

export type OpenApiInfo = {
  title: string;
  version?: string;
  description?: string;
};

/** reference 侧导航树：operations 按 tag 分组（主题无关，渲染层喂给 DocsSidebar）。 */
export type OpenApiNavGroup = {
  tag: string;
  description?: string;
  items: Array<{
    operationId: string;
    method: string;
    path: string;
    title: string;
    href: string;
  }>;
};

export type OpenApiDocArtifact = {
  version: typeof OPENAPI_DOC_ARTIFACT_VERSION;
  sourceId: string;
  lang: string;
  /** source 概览页路由（无 operationId）。 */
  href: string;
  info: OpenApiInfo;
  servers: OpenApiServer[];
  nav: OpenApiNavGroup[];
  operations: OpenApiOperation[];
  /** 命名 schema 字典，渲染层用于解引用 `ResolvedSchema.ref`。 */
  schemas: Record<string, ResolvedSchema>;
};
