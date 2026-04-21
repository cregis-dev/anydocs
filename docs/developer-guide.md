# Anydocs 开发指南

本文面向 Anydocs 仓库维护者与功能开发者，聚焦源码开发、调试和验证流程。文档项目的日常使用、CLI 命令语义、初始化、导入和 Markdown 迁移，请优先查看 [usage-manual.md](usage-manual.md)。

Studio / Reader 的运行时边界、env contract 与路由策略，统一见 [runtime-architecture.md](runtime-architecture.md)。

## 1. 环境准备

### 1.1 系统要求

- **Node.js**: >= 18
- **pnpm**: >= 9
- **操作系统**: macOS / Linux / Windows

### 1.2 克隆并安装

```bash
# 克隆仓库
git clone https://github.com/your-org/anydocs.git
cd anydocs

# 安装依赖
pnpm install
```

安装完成后，workspace 中的所有包将自动链接。

## 2. 开发模式启动

### 2.1 启动 Next.js 开发服务器

```bash
# 在项目根目录执行
pnpm dev
```

这个命令会：
1. 启动 Next.js 开发服务器
2. 监听文件变化并自动重载
3. 提供 web 代码的开发调试环境

**重要说明：**

- 普通 `pnpm dev` 默认不暴露 `/` 和 `/studio`
- 普通 `pnpm dev` 不会自动开放 `/[lang]/docs/*` 阅读站路由
- 如需进入 Studio，请使用 CLI Studio 或 Desktop 运行时
- 如需验证真实阅读站，请运行 CLI `preview` 启动本地动态阅读站，或运行 CLI `build` 生成完整静态站点后用静态服务器验证
- 详见 [4.5 场景五：端到端测试](#45-场景五端到端测试编辑--构建--预览)

### 2.2 启动 CLI Studio

```bash
pnpm --filter @anydocs/cli cli studio examples/starter-docs
```

访问地址：

- **Studio 编辑台**: http://localhost:3000/studio
- **首页**: http://localhost:3000/

### 2.3 启动 Tauri 桌面端

```bash
pnpm dev:desktop
```

这将启动 Tauri 桌面应用的开发模式。

## 3. 从源码调用 CLI

### 3.1 调用方式

仓库开发阶段推荐两种调用方式：

**方式一：通过 pnpm workspace**
```bash
pnpm --filter @anydocs/cli cli <command> [options]
```

**方式二：直接使用 Node.js**
```bash
node --experimental-strip-types packages/cli/src/index.ts <command> [options]
```

下面示例统一使用第二种方式。若你要查 `init`、`import`、`convert-import`、Markdown 迁移工具的用户侧行为，请直接看 [usage-manual.md](usage-manual.md)。

### 3.2 常用验证入口

仓库内最常用的验证项目是 `examples/starter-docs`：

```bash
# 验证静态构建
node --experimental-strip-types packages/cli/src/index.ts build examples/starter-docs

# 验证本地动态阅读站
node --experimental-strip-types packages/cli/src/index.ts preview examples/starter-docs

# 内容或构建链路联调时持续观察输出
node --experimental-strip-types packages/cli/src/index.ts build examples/starter-docs --watch
```

开发者关注点：
- `build` 是否能稳定产出 `dist/`、搜索索引、`llms.txt` 和 `mcp/*.json`
- `preview` 是否只暴露 `published` 页面，并正确解析默认语言入口
- `build --watch` 是否在内容变更后持续刷新公开产物
- 页面 `content` 是否仍保持 canonical `DocContentV1`，并能稳定导出 `render.markdown` / `render.plainText`

### 3.3 快速检查构建结果

```bash
ls -la examples/starter-docs/dist/
cat examples/starter-docs/dist/build-manifest.json
cat examples/starter-docs/dist/mcp/index.json
cat examples/starter-docs/dist/search-index.zh.json
cat examples/starter-docs/dist/llms.txt
```

这里不再重复完整产物结构与命令语义；这类信息以 [usage-manual.md](usage-manual.md) 为准。

## 4. 典型开发场景

### 4.1 场景一：开发 Studio 功能

```bash
# 启动 CLI Studio
pnpm --filter @anydocs/cli cli studio examples/starter-docs

# 在浏览器中打开
# http://localhost:3000/studio

# 编辑 packages/web/components/studio/ 下的文件
# 保存后自动热重载
```

### 4.2 场景二：开发阅读站功能

```bash
# 启动 Next.js 开发服务器
pnpm dev

# 编辑 packages/web/app/[lang]/[...slug]/ 下的文件
# 或编辑 packages/web/components/docs/ 下的组件
# 保存后通过 build / production 上下文验证
```

**注意**：
- 阅读站路由在普通开发模式下默认不会对外开放
- 如果需要验证阅读站，请运行：
  ```bash
  node --experimental-strip-types packages/cli/src/index.ts preview examples/starter-docs
  ```
- 如果需要验证静态部署产物，请运行：
  ```bash
  node --experimental-strip-types packages/cli/src/index.ts build examples/starter-docs
  ```
- 生成产物后，可检查 `dist/index.html`、`dist/<lang>/docs/.../index.html`、`dist/search-index.*.json`、`dist/llms.txt`、`dist/llms-full.txt` 与 `dist/mcp/*.json`

### 4.2.1 新增并注册一个阅读站主题

推荐把主题实现限制在 `packages/web` 内部，并保持目录独立，避免把主题代码继续堆进全局 `layout.tsx` 或 `globals.css`。

推荐目录：

```text
packages/web/
├── lib/
│   └── themes/
│       ├── registry.ts
│       └── resolve-theme.ts
└── themes/
    └── classic-docs/
        ├── manifest.ts
        ├── tokens.css
        ├── reader-layout.tsx
        └── components/
```

各文件职责建议：
- `manifest.ts`: 导出主题 id、显示名、默认选项、可选 brand 元数据
- `tokens.css`: 只定义这个主题的 CSS variables，不承载全局业务样式
- `reader-layout.tsx`: 主题自己的阅读站壳层，负责页头、侧边栏容器、内容区骨架等
- `components/`: 仅放这个主题专属的 reader 组件

注册流程建议：
1. 在 `packages/web/themes/<themeId>/` 下创建主题目录与基础文件。
   `manifest.ts` 至少应声明 `id`、`label`、`className`、`description`、`tone`、`recommendedFor`，保证 Studio 设置页和主题 registry 都能读取完整元数据。
2. 在 `packages/web/lib/themes/registry.ts` 中显式注册 `<themeId>` 到对应主题模块。
3. 在 `packages/web/lib/themes/resolve-theme.ts` 中实现“根据 `site.theme.id` 解析主题；未注册则抛错”。
4. 在 reader 根布局中读取项目配置的 `site.theme.id`，委托给对应主题的 `reader-layout.tsx`。
5. 在目标文档项目的 `anydocs.config.json` 中设置唯一主题，例如 `"site.theme.id": "classic-docs"`。
6. 如果需要项目级品牌覆盖，使用 `site.theme.branding.siteTitle` / `homeLabel` 和 `site.theme.codeTheme`，不要把这些站点展示配置混入页面或导航内容。
7. 运行 `preview` 与 `build`，确认同一主题在动态预览和静态产物中表现一致。

实现约束建议：
- 不要在运行时为同一个项目提供主题切换 UI
- 不要把主题选择写入 page 或 navigation 数据
- 不要让新主题通过修改全局硬编码 class 名来接入
- 未注册主题必须在加载配置或构建时显式失败

### 4.3 场景三：测试 CLI 构建流程

```bash
# 修改示例项目内容
vim examples/starter-docs/pages/zh/welcome.json

# 重新构建
node --experimental-strip-types packages/cli/src/index.ts build examples/starter-docs

# 验证构建产物
cat examples/starter-docs/dist/search-index.zh.json
cat examples/starter-docs/dist/llms.txt
cat examples/starter-docs/dist/llms-full.txt
cat examples/starter-docs/dist/mcp/index.json
cat examples/starter-docs/dist/mcp/chunks.zh.json
ls examples/starter-docs/dist/en/docs
```

### 4.4 场景四：调试 Core 库

```bash
# Core 库在 packages/core/src/

# 修改 Core 代码
vim packages/core/src/fs/content-repository.ts

# CLI 自动使用最新的 Core 代码（workspace link）
node --experimental-strip-types packages/cli/src/index.ts build examples/starter-docs

# 如果需要类型检查
pnpm --filter @anydocs/core typecheck
```

### 4.5 场景五：端到端测试（编辑 → 构建 → 预览）

```bash
# 1. 启动 CLI Studio
pnpm --filter @anydocs/cli cli studio examples/starter-docs

# 2. 在 Studio 中编辑内容
#    http://localhost:3000/studio

# 3. 保存后，内容写入 examples/starter-docs/pages/

# 4. 启动本地动态阅读站（新终端）
node --experimental-strip-types packages/cli/src/index.ts preview examples/starter-docs

# 5. 打开终端输出的 Preview URL，并确认页面可访问
#    例如：http://127.0.0.1:3000/zh/docs/welcome

# 6. 如需验证静态部署产物，再执行一次构建
node --experimental-strip-types packages/cli/src/index.ts build examples/starter-docs
```

## 5. 验证和测试

### 5.1 类型检查

```bash
# 检查所有包
pnpm typecheck

# 只检查特定包
pnpm --filter @anydocs/core typecheck
pnpm --filter @anydocs/cli typecheck
pnpm --filter @anydocs/web typecheck
```

### 5.2 代码检查

```bash
# ESLint 检查
pnpm lint
```

### 5.3 运行测试

```bash
# 运行所有测试
pnpm test

# 只运行 Web 包测试
pnpm test:web

# 完整测试套件
pnpm test:full
```

提交前最小门槛：
- 一般仓库代码变更至少运行 `pnpm test`
- 若改动影响 `packages/web`、Studio、reader、local API、build/preview 或其他用户可见行为，再补跑 `pnpm test:acceptance`

## 6. 构建仓库产物

### 6.1 构建所有包

```bash
# 完整构建
pnpm build
```

这将依次构建：
- `@anydocs/core`
- `@anydocs/cli`
- `@anydocs/web`
- `@anydocs/desktop`

### 6.2 单独构建

```bash
# 只构建 CLI
pnpm build:cli

# 只构建 Web（包含生成公开产物）
pnpm build:web

# 只构建 Desktop
pnpm build:desktop
```

### 6.3 验证构建产物

```bash
# 查看 CLI 构建产物
ls -la packages/cli/dist/

# 查看 Web 构建产物
ls -la packages/web/.next/

# 测试 CLI 构建版本
node packages/cli/dist/index.js build examples/starter-docs
```

## 7. 常见问题

### 7.1 CLI 命令找不到

**问题**: 执行 CLI 命令时报错 "command not found"

**解决**:
```bash
# 确保依赖已安装
pnpm install

# 使用完整路径
node --experimental-strip-types packages/cli/src/index.ts <command>
```

### 7.2 Studio 无法写入文件

**问题**: Studio 保存时报错

**检查**:
1. 确保你运行的是 `CLI Studio` 或 `Desktop`，例如 `pnpm --filter @anydocs/cli cli studio examples/starter-docs`
2. 检查文件权限
3. 查看浏览器控制台和终端日志

### 7.3 示例项目构建产物未生成

**问题**: 执行 build 命令后找不到 dist/ 目录

**排查**:
```bash
# 检查项目是否有 anydocs.config.json
ls examples/starter-docs/anydocs.config.json

# 查看构建日志
node --experimental-strip-types packages/cli/src/index.ts build examples/starter-docs

# 检查是否有错误输出
echo $?  # 应该返回 0
```

### 7.4 类型检查失败

**问题**: `pnpm typecheck` 报错

**解决**:
```bash
# 清理构建缓存
rm -rf packages/*/dist packages/*/.tsbuildinfo

# 重新安装
pnpm install

# 再次检查
pnpm typecheck
```

### 7.5 热重载不工作

**问题**: 修改代码后页面不自动刷新

**解决**:
1. 重启开发服务器 `pnpm dev`
2. 检查文件是否真的被保存
3. 清除浏览器缓存并硬刷新

## 8. 开发最佳实践

### 8.1 使用 Watch 模式

在编辑内容时，同时运行：
```bash
# 终端 1：CLI Studio
pnpm --filter @anydocs/cli cli studio examples/starter-docs

# 终端 2：动态阅读站预览
node --experimental-strip-types packages/cli/src/index.ts preview examples/starter-docs

# 终端 3：如果你还要持续验证静态产物，再开 watch build
node --experimental-strip-types packages/cli/src/index.ts build examples/starter-docs --watch
```

### 8.2 保持增量构建

修改代码后，只重新构建必要的包：
```bash
# 只修改了 Core，只构建 Core
pnpm --filter @anydocs/core build

# 修改了 Core 和 CLI，按依赖顺序构建
pnpm --filter @anydocs/core build
pnpm --filter @anydocs/cli build
```

### 8.3 使用 Git Hooks

建议配置 pre-commit hook：
```bash
# .husky/pre-commit
pnpm typecheck && pnpm lint
```

### 8.4 定期验证完整流程

```bash
# 完整验证流程
pnpm install
pnpm typecheck
pnpm lint
pnpm test
pnpm build
node --experimental-strip-types packages/cli/src/index.ts build examples/starter-docs
pnpm --filter @anydocs/cli cli studio examples/starter-docs
```

## 9. 快速参考

### 9.1 常用命令速查

| 任务 | 命令 |
|------|------|
| 安装依赖 | `pnpm install` |
| 启动 Next.js 开发服务器 | `pnpm dev` |
| 启动 CLI Studio | `pnpm --filter @anydocs/cli cli studio examples/starter-docs` |
| 启动桌面端开发 | `pnpm dev:desktop` |
| 类型检查 | `pnpm typecheck` |
| 代码检查 | `pnpm lint` |
| 运行最小提交门槛测试 | `pnpm test` |
| 完整构建 | `pnpm build` |
| 验证示例项目构建 | `node --experimental-strip-types packages/cli/src/index.ts build examples/starter-docs` |
| 监听示例项目构建 | `node --experimental-strip-types packages/cli/src/index.ts build examples/starter-docs --watch` |
| 预览示例项目阅读站 | `node --experimental-strip-types packages/cli/src/index.ts preview examples/starter-docs` |

### 9.2 快捷脚本（可选）

在 `package.json` 中添加：
```json
{
  "scripts": {
    "cli": "node --experimental-strip-types packages/cli/src/index.ts",
    "cli:build": "node --experimental-strip-types packages/cli/src/index.ts build examples/starter-docs",
    "cli:preview": "node --experimental-strip-types packages/cli/src/index.ts preview examples/starter-docs",
    "cli:watch": "node --experimental-strip-types packages/cli/src/index.ts build examples/starter-docs --watch"
  }
}
```

使用：
```bash
pnpm cli build examples/starter-docs
pnpm cli:build
pnpm cli:preview
pnpm cli:watch
```

## 10. 相关文档

- [文档索引](README.md) - 当前 `docs/` 目录入口
- [使用手册](usage-manual.md) - 文档项目使用、CLI 语义、导入与 Markdown 迁移
- [BMAD 产物索引](../artifacts/bmad/README.md) - 规划、实现与测试产物入口
- [架构文档](../artifacts/bmad/planning-artifacts/architecture.md) - 架构设计与技术边界
- [PRD](../artifacts/bmad/planning-artifacts/prd.md) - 产品需求定义
- [Epics](../artifacts/bmad/planning-artifacts/epics.md) - Epic 与 Story 拆分
- [README](../README.md) - 项目概览
