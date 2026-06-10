# 自建 OpenAPI 参考渲染 + 在线测试（Try-it）技术方案

> 状态：实施中 — **M1 数据层 ✅ / M2 共享 reader 渲染 ✅ / M3 搜索集成 ✅**（均已用真实 Cregis spec build + 截图验证）/ M4 Try-it 待办。
>
> **M3 落地**：core 新增 `loadPublishedOpenApiDocs` + `buildOpenApiReaderSearchChunks`（operation → `ReaderSearchChunkSource`，深链到独立 operation 页 + 参数/schema 名增强检索）；`build-artifacts.ts` 在生成 `search-find.<lang>.json` 时并入 OpenAPI operation chunks。实测：Cregis 站内搜索"创建订单"命中接口并排最佳匹配第一。schema 级 chunk 与 search-index v1 fallback 暂未并入（search-find v2 为 reader 主检索路径，已覆盖）。
> 目标：用 Anydocs 自有渲染管线替换 reader 侧嵌入的 `@scalar/api-reference-react`，统一外壳、提升体验，并支持在页面上测试 API。
>
> **M2 落地补充**：reference 路由自管两栏布局（`ReferenceShell` + `ReferenceNav`，按 URL 高亮），不复用主题 `DocsSidebar`（避免 layout 变重 + link 高亮改造）；operation/请求体描述用轻量 `InlineMarkdown`（react-markdown）渲染。`@scalar/*` 依赖与 `scalar-api-reference.tsx`、globals.css scalar 样式块已删除。`classic`/`blueprint` 主题（server 组件）reference 路由让出侧栏待后续 client wrapper 处理；`atlas` 已正确。

## 1. 目标与非目标

**目标**
- reader 侧 OpenAPI 参考由 Anydocs 自渲染，外壳/导航/搜索与普通文档完全一致（去掉套娃卡片、双标题、双搜索框、内容裁切）。
- 每个 operation 拥有独立 URL，可深链、可被站内搜索精确命中、可 prev/next、可生成 TOC。
- SSR 直出、轻量，删除依赖 Scalar 内部 DOM 的脆弱同步脚本。
- 支持"在页面上测试 API"（Try-it），覆盖无签名 / 简单鉴权场景；为需签名的 API 预留可插拔适配器。

**非目标（本期不做）**
- 不做完整的 mock server / 流量录制。
- 不在浏览器侧实现任意 API 的签名（密钥不进浏览器）。
- 不追求 100% 对齐 Scalar 的所有边角特性（如多 example 切换器的全部形态），按需迭代。

## 2. 现状与问题（摘要）

- 渲染：[`packages/web/components/docs/scalar-api-reference.tsx`](../packages/web/components/docs/scalar-api-reference.tsx) 用 `@scalar/api-reference-react@0.9.11` 整块嵌入一个带边框卡片，卡片自带 header，与 Scalar 内部标题/搜索/侧栏重复 → 套娃、双搜索、被挤窄。
- 还有约 100 行 JS 靠 MutationObserver 改 Scalar 内部 class 名（`bg-sidebar-b-active` 等）同步滚动高亮 → 脆弱、易随升级失效。
- 路由：[`packages/web/app/[lang]/reference/[[...slug]]/page.tsx`](../packages/web/app/[lang]/reference/[[...slug]]/page.tsx) 把整份 spec 渲染在单一路由，所有 `href` 指向 `routeBase`，无法精确定位单个接口。
- 数据：`build` 期已产出 `dist/mcp/openapi/{source,operations,schemas,chunks,index}.*.json`（[`build-openapi-artifacts.ts`](../packages/core/src/publishing/build-openapi-artifacts.ts)，由 [`build-service.ts:108`](../packages/core/src/services/build-service.ts) 调用），但抽取是**浅层**（仅 summary/description/tag + schema 一层 properties），面向搜索/LLM，不足以驱动完整渲染。

## 3. 架构总览

```
┌──────────────────────── build 期（@anydocs/core）────────────────────────┐
│ build-openapi-artifacts.ts（扩展）                                        │
│   原始 spec ─► 解析($ref/组合/去环) ─► 渲染就绪结构                          │
│   产出: dist/mcp/openapi/                                                  │
│     ├ source.<id>.json          (原始 spec, 保留)                          │
│     ├ doc.<id>.<lang>.json       (新增: 渲染就绪的 operation/schema 树)     │
│     ├ operations.<id>.<lang>.json(保留, 列表/导航/搜索)                     │
│     ├ schemas.<id>.<lang>.json   (保留)                                    │
│     ├ chunks.<id>.<lang>.json    (保留, 并入站内搜索)                        │
│     └ index.<lang>.json          (保留, source 列表)                       │
└───────────────────────────────────────────────────────────────────────────┘
                                   │ 静态读取
┌──────────────────────────── reader 侧（@anydocs/web）──────────────────────┐
│ 路由 /[lang]/reference/<source>[/<operationId>]                            │
│   page.tsx (SSR) ─► lib/docs/openapi.ts 读 doc.<id>.<lang>.json            │
│   组件: <ApiReferenceLayout> / <OperationView> / <SchemaTree> / <ParamTable>│
│   导航: 复用主题 DocsSidebar（operations 按 tag 分组）                       │
│   搜索: chunks 并入全局 MiniSearch                                          │
│                                                                            │
│ Try-it: 客户端面板 ─► POST /api/reference/try (代理, 生产开启, 带 SSRF 白名单)│
│           └► 可插拔签名适配器(按 sourceId, 密钥仅在服务端 env)               │
└───────────────────────────────────────────────────────────────────────────┘
```

## 3.1 责任分层（核心 / 共享 reader / 主题）

主题契约（[`packages/web/lib/themes/types.ts`](../packages/web/lib/themes/types.ts)）很窄：主题只提供 `ReaderLayout`，**只负责外壳**（顶栏 / 侧栏 / 搜索），把 `{children}` 塞进 `<main>`。真正的内容渲染是 `components/docs/` 里的**共享组件**（如 [`doc-content-view.tsx`](../packages/web/components/docs/doc-content-view.tsx)），靠 CSS token 适配主题。现有的 [`scalar-api-reference.tsx`](../packages/web/components/docs/scalar-api-reference.tsx) 也在这一共享层，由路由直接渲染，**未进任何主题**。

因此本方案严格分三层，OpenAPI 渲染**几乎没有需要"主题自己写"的部分**：

| 层 | 归属 | 内容 | 原因 |
|----|------|------|------|
| **① 核心** `@anydocs/core`（无 React、主题无关） | 数据 / 解析 / 契约 | • spec 解析 + `$ref`/组合/**去环**<br>• 类型 `OpenApiDocArtifact`/`ResolvedSchema`<br>• 产物 `doc.<id>.<lang>.json`<br>• operation chunk 并入搜索索引<br>• **reference 导航树计算**（operations 按 tag 分组，产出标准 nav 结构）<br>• 签名适配器*接口类型* | 纯数据，跨主题 / CLI / MCP 复用，一次解析处处用 |
| **② 共享 reader** `packages/web`（非 theme，靠 token 取色） | 渲染 + 服务端 | • 三段路由 `page.tsx`<br>• 数据加载 `lib/docs/openapi.ts`<br>• 渲染组件 `OperationView`/`SchemaTree`/`ParamTable`/`CodeSample`<br>• `TryItPanel`（客户端）<br>• 代理端点 `/api/reference/try` + SSRF/签名*实现* | 与 `doc-content-view` 同级——一套渲染，用 CSS var 适配所有主题，不按主题各写一遍 |
| **③ 主题** `packages/web/themes/*`（只管 chrome + 视觉 token） | 布局 / 外观 | • 各 `reader-layout.tsx` 的 `isReferenceRoute` 分支：reference 路由**是否显示侧栏 / 显示哪份 nav**<br>• 视觉 token（CSS vars、`theme-atlas-docs`），**删除 `--scalar-*`** | 主题只决定"接口导航怎么摆、长什么样"，不碰接口内容怎么渲染 |

**核心原则**：核心吐一份主题无关的"渲染就绪契约"（`OpenApiDocArtifact` + reference nav 树）；渲染与 Try-it 在共享 reader 层，用 token 适配；主题只决定外壳。

**对主题的关键优化**：现状 atlas 在 reference 路由 `!isReferenceRoute` **隐藏**自己的 `DocsSidebar`，改由 Scalar 自带侧栏。改造后反过来——**让 reference 路由也走主题现有的 `DocsSidebar`**，只是把 `nav` 换成核心算好的 operations-by-tag 树。这样主题几乎不用改（去掉特例即可），三主题自动一致。真正要动的只有：审查三个 `reader-layout.tsx` 对 reference 路由的特例分支（atlas 当前隐藏侧栏；classic/blueprint 需确认），让其渲染传入的 reference nav。

> 可选（未来）：若某主题想要**完全不同**的接口布局，再给 `DocsThemeDefinition` 加可选 `OperationView` 插槽。本期不做，保持与 doc content "共享渲染 + token" 一致。

## 4. 数据层：扩展 build 产物

新增**渲染就绪**产物 `doc.<id>.<lang>.json`（不动现有 5 个产物，保证 MCP/搜索/LLM 兼容）。在 [`build-openapi-artifacts.ts`](../packages/core/src/publishing/build-openapi-artifacts.ts) 内新增解析逻辑。

### 4.1 数据结构（TypeScript）

```ts
// packages/core/src/types/openapi-doc.ts (新增)
export type OpenApiDocArtifact = {
  version: 1;
  sourceId: string;
  lang: string;
  info: { title: string; version?: string; description?: string };
  servers: { url: string; description?: string;
             variables?: Record<string, { default: string; enum?: string[]; description?: string }> }[];
  tagGroups: { tag: string; description?: string; operationIds: string[] }[];
  operations: OpenApiOperation[];
  schemas: Record<string, ResolvedSchema>; // 已解析的命名 schema
};

export type OpenApiOperation = {
  id: string;            // operationId 或派生
  method: string;        // GET/POST/...
  path: string;          // /orders
  summary: string;
  description?: string;  // markdown
  tag: string;
  deprecated?: boolean;
  parameters: { in: 'path' | 'query' | 'header' | 'cookie'; name: string; required: boolean;
                description?: string; schema: ResolvedSchema; example?: unknown }[];
  requestBody?: { required: boolean; description?: string;
                  contents: { mediaType: string; schema: ResolvedSchema; example?: unknown }[] };
  responses: { status: string; description?: string;
               contents: { mediaType: string; schema: ResolvedSchema; example?: unknown }[] }[];
  security?: { scheme: string; type: string; in?: string; name?: string }[];
};

// 解析后的 schema 节点：$ref 已展开为 ref 名引用 + 去环标记
export type ResolvedSchema = {
  ref?: string;          // 指向命名 schema（用于折叠/跳转，避免内联展开循环引用）
  type?: string;         // object/array/string/...
  format?: string;
  description?: string;
  required?: string[];
  properties?: Record<string, ResolvedSchema>;
  items?: ResolvedSchema;
  enum?: unknown[];
  default?: unknown;
  example?: unknown;
  composition?: { kind: 'allOf' | 'oneOf' | 'anyOf'; members: ResolvedSchema[] };
  nullable?: boolean;
  cyclic?: boolean;      // 触发去环时标记，UI 渲染为"�目标 schema"链接而非继续展开
};
```

> **M1 实现说明**：最终类型以 [`packages/core/src/types/openapi-doc.ts`](../packages/core/src/types/openapi-doc.ts) 为准（上方为早期草稿）。实测真实 spec（Cregis Payment Engine, OAS 3.1）后，M1 已额外覆盖：
> - **OAS 3.1 顶层 `webhooks`**：与 path operation 同构解析，`OpenApiOperation.kind` 区分 `'endpoint'` / `'webhook'`（webhook 不可主动调用，Try-it 不适用）。
> - **顶层 `tags` 排序**：`nav` 按 spec `tags` 声明顺序分组并带 `description`，未声明的 tag 追加在后（对齐截图 Orders→Webhooks 顺序）。

### 4.2 $ref / 组合 / 去环策略（核心难点）

- **命名 schema**（`#/components/schemas/X`）→ 不内联，转成 `{ ref: 'X' }`；目标存入 `schemas` 字典。UI 中以可展开/可跳转的方式呈现。
- **内联 schema** → 递归解析为 `ResolvedSchema`。
- **去环**：解析时维护 `visitedRefs` 栈；再次遇到栈中 ref → 输出 `{ ref, cyclic: true }` 终止递归。UI 渲染为指向该 schema 的链接，点击展开。
- **组合**：`allOf` 合并 required/properties（浅合并 + 保留 members 以便展示）；`oneOf`/`anyOf` 保留 members，UI 用 tab/列表呈现。
- **解析在 build 期完成一次**，reader 侧零解析、纯渲染，避免运行时反复 resolve。

### 4.3 写入位置与清理

沿用现有 `openApiRoot = <artifactRoot>/mcp/openapi`（见 [`build-openapi-artifacts.ts:315`](../packages/core/src/publishing/build-openapi-artifacts.ts)），新增 `doc.<id>.<lang>.json`。`cleanupOpenApiArtifacts` 已 `rm -rf` 整个目录，无需额外清理改动。

## 5. 路由设计

```
/[lang]/reference                      → source 列表（沿用现有 renderApiReferenceIndex）
/[lang]/reference/<source>             → source 概览（info + servers + 接口分组目录）
/[lang]/reference/<source>/<opId>      → 单个 operation 详情页（独立 URL，可深链）
```

- 改造 [`page.tsx`](../packages/web/app/[lang]/reference/[[...slug]]/page.tsx)：`[[...slug]]` 接受 `[]` / `[source]` / `[source, opId]` 三种。
- `getApiSourceRouteSlug`（[`api-sources.ts:23`](../packages/web/lib/docs/api-sources.ts)）已处理 source → slug，复用。
- `generateStaticParams` 扩展：为每个 operation 追加 `[source, opId]` 组合，全量静态化（与 reader 静态导出一致）。

## 6. 组件拆分（reader）

新增 `packages/web/components/docs/openapi/`：

| 组件 | 职责 |
|------|------|
| `api-reference-layout.tsx` | 概览 + operation 详情的共享外壳（无卡片、铺满内容区，复用文档 token） |
| `operation-view.tsx` | 两栏：左侧 method/path/描述/params/request/response 表；右侧示例 + Try-it 触发 |
| `schema-tree.tsx` | 递归渲染 `ResolvedSchema`，可折叠嵌套对象，`ref`/`cyclic` 渲染为跳转链接 |
| `param-table.tsx` | path/query/header 参数表（名称/类型/必填/说明/示例） |
| `code-sample.tsx` | curl / JSON 示例（按 mediaType），复用站点代码块样式 |
| `try-it-panel.tsx` | 见 §8 |

- **删除** [`scalar-api-reference.tsx`](../packages/web/components/docs/scalar-api-reference.tsx) 及 [`globals.css`](../packages/web/app/globals.css) 中 `.anydocs-scalar-shell` / `--scalar-*` / `--refs-*` 相关样式块（约 178–250 行区间）。
- **导航**：[`reader-layout.tsx`](../packages/web/themes/atlas-docs/reader-layout.tsx) 当前在 reference 路由隐藏 `DocsSidebar`（`!isReferenceRoute`）。改为：reference 路由也显示 `DocsSidebar`，数据源换成"该 source 的 operations 按 tag 分组"的导航树。删除 §2 的脆弱滚动同步脚本，改用标准 active-by-URL 高亮（每个 op 独立 URL，天然可高亮）。

## 7. 搜索集成

- `chunks.<id>.<lang>.json` 已含 operation/schema 的 `title`/`text`/`href`。把这些 chunk 在 build 期并入 reader 搜索索引（[`search-find.ts`](../packages/core/src/search/search-find.ts) / `build-artifacts.ts` 的 chunk 聚合处），`href` 升级为 `/<lang>/reference/<source>/<opId>` 精确锚点。
- store fields 以 page 为中心（`pageId`/`slug`），为 operation 合成伪条目（`pageId = reference:<source>:<opId>`），保证现有检索 UI 不改即可命中接口。

## 8. Try-it（在线测试）设计

### 8.1 架构：服务端代理（绕过 CORS）

新增生产可用端点 `packages/web/app/api/reference/try/route.ts`（**注意**：与 dev-only 的 `/api/local/*` 不同，本端点需在生产开启）：

```
POST /api/reference/try
body: { sourceId, lang, operationId, method, url, headers, query, body }
→ 服务端校验 → (可选)签名 → fetch 目标 → 回传 { status, headers, body, durationMs }
```

### 8.2 安全约束（必须）

1. **SSRF 白名单**：目标 host 必须命中"已发布 api-source 的 servers[].url"解析出的 host 集合。拒绝 IP 直连内网网段（127/10/172.16-31/192.168/169.254、`::1` 等）。
2. **仅 published source**：未发布的 source 不可代理。
3. **超时 + 体积上限**：请求/响应超时（如 15s）、响应体大小上限（如 5MB）。
4. **不落盘不记日志敏感头**：`Authorization`/`X-Api-Key`/签名头脱敏。
5. **开关**：仅当对应 source `runtime.tryIt.enabled === true` 时端点才服务该 source（复用 [`api-source.ts`](../packages/core/src/types/api-source.ts) 已有字段）。
6. **方法白名单**：仅允许该 operation 在 spec 中声明的 method。

### 8.3 鉴权与签名适配器

- **简单鉴权**（API Key / Bearer）：用户在 `try-it-panel` 填入，随请求传给代理，代理透传。密钥不持久化。
- **需签名的 API**（如 Cregis Payment Engine：HMAC + secret 对 body 加签）：在服务端实现**可插拔适配器**，密钥仅来自服务端环境变量，**绝不进浏览器**。

```ts
// packages/web/lib/reference/signing/registry.ts (新增)
export type SigningAdapter = {
  sourceId: string;
  sign(req: { method: string; url: string; headers: Record<string,string>;
              body?: unknown }): { headers?: Record<string,string>; body?: unknown };
};
// 按 sourceId 注册；代理在转发前调用匹配的 adapter。无 adapter 则按"简单鉴权/无鉴权"处理。
```

> 取舍：签名算法是每个 API 自定义的，无法通用——这正是 Scalar/Redoc 也无法替你做的部分。每个需签名的 source 写一个 adapter，是唯一持续产生成本的点。

### 8.4 客户端面板

`try-it-panel.tsx`：根据 operation 的 params/requestBody 生成表单 → 组装请求 → POST 到代理 → 渲染响应（状态码/耗时/headers/格式化 body）。默认折叠，由 `runtime.tryIt.enabled` 控制是否出现。

## 9. 类型 / 配置扩展

- `ApiSourceRuntime`（[`api-source.ts`](../packages/core/src/types/api-source.ts)）已有 `tryIt.enabled`，无需改 schema。可选新增 `tryIt.signingAdapter?: string` 显式声明适配器 id。
- 无需改 `anydocs.config.json`：api-source 仍从 `api-sources/` 自动发现。

## 10. 迁移与回退

- `@scalar/*` 依赖在确认自渲染覆盖目标场景后，从 `packages/web` 移除（参考 Story 7.3 移除 Yoopta 的做法）。
- 过渡期可用一个开关（env 或 per-source flag）在"自渲染 / Scalar"之间切换，灰度验证后再删 Scalar。

## 11. 测试策略

- **core 单测**：扩展 [`packages/core/tests/openapi-artifacts.test.ts`](../packages/core/tests/openapi-artifacts.test.ts)，覆盖 `$ref`、`allOf/oneOf/anyOf`、循环引用去环、缺字段兜底。
- **web 单测**：`schema-tree` / `param-table` 渲染快照；SSR 不依赖浏览器 DOM hack。
- **代理单测**：SSRF 白名单（内网网段拒绝、非 published 拒绝、方法白名单）、签名 adapter 调用、脱敏。
- **e2e（P0）**：reference 列表 → source 概览 → operation 深链 → 站内搜索命中接口 → Try-it 成功/失败路径（mock 目标）。
- 提交前按 CLAUDE.md 门槛：触及 reader/web → `pnpm test:acceptance`。

## 12. 改动清单（文件级）

**core**
- `packages/core/src/types/openapi-doc.ts` — 新增渲染就绪类型
- `packages/core/src/publishing/build-openapi-artifacts.ts` — 新增解析 + 写 `doc.<id>.<lang>.json`
- `packages/core/src/search/*` / `build-artifacts.ts` — operation chunk 并入搜索索引
- `packages/core/tests/openapi-artifacts.test.ts` — 扩展用例

**web**
- `packages/web/lib/docs/openapi.ts` — 新增：读 `doc.*` 产物
- `packages/web/app/[lang]/reference/[[...slug]]/page.tsx` — 三段路由 + 静态参数
- `packages/web/components/docs/openapi/*` — 新增渲染组件
- `packages/web/app/api/reference/try/route.ts` — 新增代理端点
- `packages/web/lib/reference/signing/*` — 新增签名适配器注册表
- `packages/web/themes/atlas-docs/reader-layout.tsx` — reference 路由显示 DocsSidebar（按 tag 分组），移除滚动同步 hack
- 删除 `packages/web/components/docs/scalar-api-reference.tsx` + `globals.css` 中 scalar 样式
- 移除 `@scalar/*` 依赖（最后一步）

## 13. 分阶段交付

| 里程碑 | 内容 | 估时 |
|--------|------|------|
| **M1 数据层** | 扩展 build 产出 `doc.*`（含 $ref/组合/去环）+ core 单测 | ~0.5–1 天 |
| **M2 只读渲染** | 三段路由 + 渲染组件 + DocsSidebar 分组导航，删 Scalar 卡片/hack | ~1 天 |
| **M3 搜索集成** | operation chunk 并入站内搜索，深链锚点 | ~0.5 天 |
| **M4 Try-it（简单鉴权）** | 代理端点 + SSRF 白名单 + 客户端面板 | ~1 天 |
| **M5 签名适配器** | 适配器注册表 + Cregis Payment Engine adapter（如需） | 按 API 计，每个 ~0.5 天 |
| **M6 清理** | 移除 `@scalar/*`，灰度开关下线 | ~0.5 天 |

只读体验（M1–M3）约 2–2.5 天即可上线；Try-it（M4+）按需推进。

## 14. 风险与取舍

- **保真度**：深层嵌套 schema 折叠、组合模式展示需细打磨；先覆盖 80% 常见形态，边角按真实 spec 迭代。仓库示例 `petstore` 过简，需用真实 spec（如 Cregis Payment Engine）验证 §4.2。
- **Try-it 的本质限制**：需签名的 API 必须逐个写 adapter；无 adapter 时仅支持无签名/简单鉴权。
- **代理安全**：SSRF 是最高优先级，白名单 + 内网网段拦截不可省。
- **静态导出体积**：每 operation 一页会增加静态页数；可接受（与文档页同量级），必要时按 source 懒加载 `doc.*`。
