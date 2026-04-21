# Runtime Architecture

本文说明 Anydocs 当前认可的运行时边界，以及 Studio 与 Docs Reader 如何根据运行时决定可用路由、数据源和本地能力。

## 1. 当前运行时模型

Anydocs 当前只保留两类 Studio 运行时：

- `CLI Studio`
- `Desktop`

Reader 相关能力则通过 CLI docs runtime 单独启用：

- `preview`
- `export`

普通 `pnpm dev` 只启动 Next.js 开发服务器本身，不再被视为一个独立的 Studio 运行时。

## 2. Studio 运行时

### 2.1 CLI Studio

典型入口：

```bash
pnpm --filter @anydocs/cli cli studio <projectRoot>
```

特点：

- 只服务一个锁定的 project root
- `/` 和 `/studio` 可用
- `/api/local/*` 可用
- 不能在 UI 内切换到其他项目
- host 使用本地 web API bridge

### 2.2 Desktop

典型入口：

```bash
pnpm dev:desktop
```

特点：

- `/` 和 `/studio` 可用
- 数据访问走本地 desktop server
- 支持最近项目、打开外部项目、切换项目
- 不依赖 `/api/local/*`

## 3. Docs Reader 运行时

Reader 路由不由 Studio runtime 决定，而是由 CLI docs runtime 决定。

### 3.1 Preview

典型入口：

```bash
pnpm --filter @anydocs/cli cli preview <projectRoot>
```

特点：

- 暴露 `/{lang}` 与 `/{lang}/{slug}`
- 只服务 `published` 页面
- 解析目标 project root 并加载已发布内容

### 3.2 Export / Build

典型入口：

```bash
pnpm --filter @anydocs/cli cli build <projectRoot>
```

特点：

- 生成静态阅读站产物
- 只导出 `published` 内容
- 产物中不保留 Studio 路由与本地 authoring API

## 4. Environment Contract

运行时环境变量 contract 已集中到：

- [packages/core/runtime-contract.mjs](../packages/core/runtime-contract.mjs)
- [packages/core/runtime-contract.d.ts](../packages/core/runtime-contract.d.ts)

这里统一定义了：

- env key 名称
- `cli` / `desktop` / `preview` / `export` 常量
- CLI Studio、Desktop、CLI Docs runtime 的 env 注入 helper

web、CLI 与测试脚本都应通过这份 contract 读写运行时环境，不应再散落硬编码字符串。

## 5. Runtime Resolution

web 侧统一从：

- [packages/web/lib/runtime/runtime-config.ts](../packages/web/lib/runtime/runtime-config.ts)

读取运行时配置。

这份模块负责：

- 解析当前 Studio runtime
- 解析当前 CLI docs runtime
- 暴露 `isDesktopRuntime` 等派生判断

Studio boot context 再由：

- [packages/web/components/studio/studio-boot.ts](../packages/web/components/studio/studio-boot.ts)

从 runtime config 映射到 UI 需要的能力开关。

## 6. Route Policy

当前约束如下：

- `/` 与 `/studio` 只有在 `CLI Studio` 或 `Desktop` 运行时才可进入 Studio
- `/api/local/*` 只允许 `CLI Studio`
- Reader canonical routes 只在 `preview` / `export` / production reader 场景下可用
- `pnpm dev` 默认不暴露 Studio，也不作为 Reader runtime

## 7. Maintenance Rules

后续改动时遵守下面几条：

- 不要新增第三种 Studio runtime，除非同时更新 runtime contract、runtime config、路由守卫和文档
- 不要在 web、CLI、脚本中直接散写 `ANYDOCS_*` 字面量；优先使用 runtime contract helper
- 不要让 Desktop 回退到 `/api/local/*`
- 不要让 Reader runtime 暴露 `draft` 或 `in_review` 内容
