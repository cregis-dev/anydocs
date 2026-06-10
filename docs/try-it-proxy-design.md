# 通用 Try-it Proxy 设计

> 状态：已实现 — M4a（面板 + dev 引擎 + 内置鉴权）、M4b（清单 + 独立服务 + 部署）、M4c（cregis-sign 签名适配器）均已落地并单测；Cregis 真实下单待用真实 API Key 端到端核对签名。
> 目标：为自建 OpenAPI 参考提供"在页面上测试 API"的能力，且**通用**——一套 proxy 引擎服务任意项目/任意鉴权，换 API 只改配置，仅"自定义签名"才写一小段适配器。
> 关联：`docs/openapi-self-rendering-plan.md` 的 M4。

## 1. 背景与约束

- reader 站是**静态导出**（如 Cregis：`nginx:alpine` + `COPY dist/`，无 Next 运行时），所以 Anydocs 的 Next `/api/*` 路由在生产**不会被部署**。
- 浏览器**不能直发**真实 API，三个原因：
  1. **CORS**：目标 API 不会给文档域名放行；
  2. **签名**：支付类接口需 HMAC 签名，secret 不能进浏览器；
  3. **SSRF**：不能让代理变成任意 URL 的开放转发。
- 结论：Try-it 必须有一个**服务端代理**；生产形态是**独立服务 + nginx 反代**（复刻 Cregis 现有 `/ask-api/ → :3100` 的模式）。

## 2. 设计原则

**引擎项目无关 + 适配器/配置项目特定。**

- 引擎（协议、SSRF、超时、脱敏、转发、配置加载、适配器注册）完全不认识任何具体项目。
- 项目通过**配置**（`runtime.tryIt`）声明 baseUrl/鉴权方式；只有**自定义签名**才补一个适配器函数。
- 一个 proxy 实例可同时服务多个 source / 多个项目（按 `sourceId` 路由配置）。

## 3. 架构总览

```
┌─ 静态文档站 (nginx) ─────────────────┐
│  Try-it 面板（通用前端组件）           │  按 operation schema 生成表单
│   收集业务参数 → 统一请求协议          │  用户只填业务参数，绝不填项目 secret
└───────────────┬───────────────────────┘
                │ POST /try-it/invoke   (nginx 反代)
                ▼
┌─ Try-it Proxy 引擎（项目无关，独立服务）──────────────────┐
│  1. 按 sourceId 查配置（baseUrl / auth / 白名单）          │
│  2. 校验：enabled？method 合法？目标 host ∈ SSRF 白名单？   │
│  3. 组装真实请求（path/query/body）                        │
│  4. 应用鉴权 → 内置(none/apiKey/bearer/basic) 或 适配器     │ ← 唯一项目特定处
│  5. 注入凭证（服务端 env，按 credentialRef）               │
│  6. 转发 + 超时/限流/脱敏日志 → 回传                       │
└───────────────┬────────────────────────────────────────────┘
                ▼
        真实 API（{baseUrl} 由服务端配置注入，不由浏览器决定）
```

## 4. 组件与契约

### 4.1 统一请求 / 响应协议（前端 ↔ proxy，所有项目一致）

请求：
```jsonc
POST /try-it/invoke
{
  "sourceId": "payment-engine-api",
  "operationId": "createOrder",
  "method": "POST",
  "path": "/api/v2/checkout",
  "pathParams": {},
  "query": {},
  "headers": {},                  // 仅用户可填的非敏感头（如自带 token）
  "body": { "order_amount": "5.00" }  // 纯业务参数
}
```

响应：
```jsonc
{
  "ok": true,
  "status": 200,
  "statusText": "OK",
  "headers": { "content-type": "application/json" },
  "body": { /* 真实 API 返回，已按 content-type 解析 */ },
  "durationMs": 412
}
// 失败：{ "ok": false, "error": { "code": "ssrf_blocked"|"timeout"|"upstream_error"|..., "message": "..." } }
```

**前端永远不传 `baseUrl`、不传项目 secret**——这两样由服务端决定，从源头杜绝 SSRF 与密钥泄露。

### 4.2 Source 配置（扩展 `api-source` 的 `runtime.tryIt`）

```jsonc
"runtime": {
  "tryIt": {
    "enabled": true,
    "auth": {
      "type": "signed",            // none | apiKey | bearer | basic | signed
      "adapter": "cregis-sign"     // 仅 type=signed 时指定自定义适配器名
    },
    "credentialRef": "CREGIS_PAYMENT",       // 指向服务端凭证（不含值）
    "baseUrlRef": "CREGIS_PAYMENT_BASEURL",  // 真实 baseUrl 从 env 注入
    "methods": ["POST"],           // 可选：方法白名单（默认取 spec 中声明的）
    "allowedHosts": []             // 可选：额外 host 白名单（默认从 spec servers 派生）
  }
}
```

类型（core，扩展现有 `ApiSourceRuntime.tryIt`）：
```ts
type TryItAuth =
  | { type: 'none' }
  | { type: 'apiKey'; in: 'header' | 'query'; name: string }
  | { type: 'bearer' }
  | { type: 'basic' }
  | { type: 'signed'; adapter: string };

type TryItConfig = {
  enabled: boolean;
  auth?: TryItAuth;
  credentialRef?: string;
  baseUrlRef?: string;
  methods?: string[];
  allowedHosts?: string[];
};
```

**换一个项目/API：只改这段配置。** 内置鉴权类型零代码。

### 4.3 鉴权适配器接口（可插拔）

引擎内置 `none / apiKey / bearer / basic`。自定义签名实现该接口并注册：

```ts
export interface NormalizedRequest {
  sourceId: string;
  operationId: string;
  method: string;
  url: string;                       // 已拼好的真实 URL（baseUrl + path + query）
  headers: Record<string, string>;
  body: unknown;
}

export interface TryItAuthAdapter {
  name: string;
  apply(
    req: NormalizedRequest,
    credentials: Record<string, string>,  // 服务端按 credentialRef 注入
  ): Promise<{
    headers?: Record<string, string>;
    query?: Record<string, string>;
    body?: unknown;                  // 允许改写 body（如加 sign 字段）
  }>;
}
```

示例（Cregis 签名，**唯一会随项目增加的代码，且仅在需要自定义签名时**）：
```ts
const cregisSign: TryItAuthAdapter = {
  name: 'cregis-sign',
  async apply(req, cred) {
    const sign = hmacSha256(canonicalize(req.body), cred.secret); // ← Cregis 签名规则待补
    return { body: { ...(req.body as object), sign } };
  },
};
```

### 4.4 凭证模型

| 类型 | 来源 | 例子 | 能否前端填 |
|------|------|------|-----------|
| **项目级密钥** | proxy 服务端 env（按 `credentialRef`） | Cregis 签名 secret | ❌ 绝不进浏览器 |
| **用户级凭证** | 用户在面板临时填 | 自己的 API Key / Bearer Token | ✅ 随请求传，proxy 不存储 |

约定：`credentialRef: "CREGIS_PAYMENT"` → 服务端读 `TRYIT_CREGIS_PAYMENT_SECRET` 等环境变量（命名规则可配）。用户级凭证通过请求的 `headers` 透传，proxy 不落盘、不记日志。

### 4.5 安全约束（必须）

1. **SSRF 白名单**：最终目标 host 必须 ∈（spec `servers[].url` 派生 host ∪ `allowedHosts`）。拒绝内网网段（`127/8`、`10/8`、`172.16/12`、`192.168/16`、`169.254/16`、`::1`、`fc00::/7`）与非 http(s)。
2. **仅 published + enabled**：未发布或 `tryIt.enabled=false` 的 source 拒绝。
3. **方法白名单**：仅允许该 operation 在 spec 中声明的 method（或 `methods` 覆盖）。
4. **超时 + 体积上限**：请求/响应超时（如 15s）、响应体上限（如 5MB）。
5. **脱敏**：`Authorization` / `X-Api-Key` / 签名头 / secret 不进日志。
6. **CORS**：proxy 只接受同源（文档站）调用。

## 5. 前端 Try-it 面板（通用）

- `packages/web/components/docs/openapi/try-it-panel.tsx`（client）。
- 根据 operation 的 `parameters` / `requestBody` schema **自动生成表单**（复用已有 `schema-example` 合成默认值作为预填）。
- 按 `runtime.tryIt.auth` 决定是否展示"用户凭证"输入（apiKey/bearer）；`signed` 类型不展示密钥输入（服务端签名）。
- 组装 §4.1 请求 → `POST /try-it/invoke` → 渲染响应（状态码/耗时/headers/格式化 body）。
- 仅当 `runtime.tryIt.enabled` 时出现；webhook（`kind==='webhook'`）不展示 Try-it。

## 5.1 实现落点（M4a/M4b 已实现）

| 部分 | 位置 |
|------|------|
| 引擎（SSRF/鉴权/转发/超时） | `packages/core/src/services/try-it-engine.ts` |
| 清单 + 装配（manifest/resolve/handle/凭证） | `packages/core/src/services/try-it-proxy.ts` |
| 签名适配器（含 cregis-sign） | `packages/core/src/services/try-it-adapters.ts` |
| 清单产出（build 期 → `dist/mcp/openapi/try-it.json`） | `packages/core/src/publishing/build-openapi-artifacts.ts` |
| 面板（client） | `packages/web/components/docs/openapi/try-it-panel.tsx` |
| dev 引擎 route | `packages/web/app/api/local/try-it/route.ts` |
| 独立 proxy 服务 | `packages/web/scripts/try-it-proxy-server.mjs` |

**端点统一**：面板始终调 `/try-it/invoke`。dev 由 `next.config.mjs` 的 rewrite 转到 `/api/local/try-it`；生产由 nginx 把 `/try-it/` 反代到独立服务。

**清单 `try-it.json`**：每个 `tryIt.enabled` 的 source 一条，含 `auth/credentialRef/baseUrlRef/defaultBaseUrl/allowedHosts/operations{opId→{method,path}}`。proxy **只信任清单的 method/path**，前端只提供业务参数。

**凭证约定**：`credentialRef: "CREGIS_PAYMENT"` → 服务端读 `TRYIT_CREGIS_PAYMENT_*` 环境变量（如 `TRYIT_CREGIS_PAYMENT_SECRET` → `secret`）。`baseUrlRef` 直接是 env key（值为真实 baseUrl）。

**启动独立服务**：
```bash
TRYIT_MANIFEST=./dist/mcp/openapi/try-it.json \
PORT=3200 \
CREGIS_PAYMENT_BASEURL=https://real.cregis.api \
TRYIT_CREGIS_PAYMENT_SECRET=*** \
node packages/web/scripts/try-it-proxy-server.mjs
```

**nginx**（复刻现有 `/ask-api/` 模式）：
```nginx
location ^~ /try-it/ {
    proxy_pass http://172.17.0.1:3200/;
    proxy_set_header Host $host;
    proxy_read_timeout 30s;
}
```

## 6. 部署形态

- **生产（静态站）**：proxy 作为独立服务（像 Cregis 现有 AI `:3100`）。nginx 加：
  ```nginx
  location ^~ /try-it/ {
      proxy_pass http://172.17.0.1:PORT/;
      proxy_set_header Host $host;
      proxy_read_timeout 30s;
  }
  ```
  secret / baseUrl 走容器 env。
- **本地 dev（Studio）**：Anydocs 有 Next 运行时，把同一引擎挂成 `/api/local/try-it` route，免起独立服务。**引擎代码两处复用，配置一致。**

## 7. Anydocs 工具侧 vs 项目侧 分工

| 层 | 归属 | 内容 |
|----|------|------|
| Try-it 面板（前端） | **Anydocs 工具** | 通用组件，自动生成表单 + 调协议 + 渲染响应 |
| Proxy 引擎 + 内置鉴权 + 协议/适配器接口 + SSRF | **Anydocs 工具**（建议 `@anydocs/try-it-proxy` 包，dev route 与独立服务共用） | 项目无关 |
| Source 配置（`runtime.tryIt`） | **项目**（数据） | 声明 enabled/auth/credentialRef/baseUrlRef |
| 自定义签名适配器 | **项目**（仅需签名时） | 实现 `TryItAuthAdapter` 一个文件 |
| 部署：起服务 + nginx 反代 + 配 env | **项目** | 复刻 `/ask-api/` 模式 |

## 8. Cregis 实例（落地示例）

**签名规则**（https://developer.cregis.com/api-reference/signature）：排除 `sign`+空值 → 按 key 字典序 → `key1value1key2value2` 拼接 → prepend API Key → md5 小写 → 放入 body 的 `sign`。已实现为 `cregis-sign` 适配器（`try-it-adapters.ts`，内置注册）。

**配置**（`api-sources/payment-engine-api.json`）：
```jsonc
"runtime": {
  "routeBase": "/zh/reference/payment-engine-api",
  "tryIt": {
    "enabled": true,
    "auth": { "type": "signed", "adapter": "cregis-sign" },
    "credentialRef": "CREGIS_PAYMENT",
    "baseUrlRef": "CREGIS_PAYMENT_BASEURL"
  }
}
```

**部署 env**（独立 proxy 服务）：
- `CREGIS_PAYMENT_BASEURL=https://<项目专属 baseUrl>`
- `TRYIT_CREGIS_PAYMENT_APIKEY=<32位 API Key>` → 适配器读 `credentials.apikey`

webhook（orderCallback）不开 Try-it（`kind==='webhook'` 自动排除）。

> 复杂字段提示：`order_details`/`sub_merchant` 在 spec 中是 JSON **字符串**（直接参与拼接，无需特殊处理）；`tokens` 是数组，本适配器按 `JSON.stringify` 处理——首次接入请用真实 API Key 对一次签名，确认与 Cregis 服务端一致。

## 9. 分阶段实现

| 阶段 | 内容 | 依赖 |
|------|------|------|
| **M4a 前端面板 + dev 引擎** | Try-it 面板组件 + Next `/api/local/try-it` 引擎 + 内置鉴权（none/apiKey/bearer）+ SSRF。覆盖无签名/简单鉴权 API，本地可跑 | 无（不阻塞） |
| **M4b 独立 proxy 服务** | 把引擎抽成 `@anydocs/try-it-proxy`，提供独立服务入口 + nginx 配置模板 + 部署文档 | M4a |
| **M4c 自定义签名适配器** | `cregis-sign` 实现 + 注册；按 source 接入 | Cregis 签名规则 |

无签名场景 M4a 即可体验；Cregis 需 M4c（签名规则）。

## 10. 风险与取舍

- **签名是唯一持续成本**：每个需自定义签名的 source 写一个适配器（一次性）。这是 Scalar/Redoc 对这类 API 做不到的部分。
- **proxy 是新增运行组件**：静态站需额外部署一个服务 + 维护 env/白名单。SSRF 是最高优先级，白名单 + 内网拦截不可省。
- **baseUrl 多环境**：测试/生产 baseUrl 不同，通过 `baseUrlRef` env 切换，不写进 spec/前端。
