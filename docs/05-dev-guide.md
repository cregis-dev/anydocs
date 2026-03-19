# Anydocs 开发指南

本文面向 Anydocs 项目开发者，说明如何在开发阶段调用 CLI 命令、启动 Studio，以及如何验证 Docs Site 构建结果。

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

### 2.1 启动开发服务器

```bash
# 在项目根目录执行
pnpm dev
```

这个命令会：
1. 启动 Next.js 开发服务器
2. 监听文件变化并自动重载
3. 提供 Studio 编辑入口与本地写入 API

**访问地址：**

- **Studio 编辑台**: http://localhost:3000/studio
- **首页**: http://localhost:3000/ （开发环境下重定向到 Studio）

**重要说明**：
- 普通 `pnpm dev` 不会自动开放 `/[lang]/docs/*` 阅读站路由
- 如需验证真实阅读站，请运行 CLI `preview` 启动本地动态阅读站，或运行 CLI `build` 生成完整静态站点后用静态服务器验证
- 详见 [4.5 场景五：端到端测试](#45-场景五端到端测试编辑--构建--预览)

### 2.2 启动 Electron 桌面端

```bash
pnpm dev:desktop
```

这将启动 Electron 应用的开发模式。

## 3. 使用 CLI 命令

### 3.1 CLI 调用方式

在开发阶段，有两种方式调用 CLI。CLI 的核心职责是构建 Docs Site，其他命令用于初始化项目、检查预览入口和导入历史内容：

**方式一：通过 pnpm workspace（推荐）**
```bash
pnpm --filter @anydocs/cli cli <command> [options]
```

**方式二：直接使用 Node.js（更快）**
```bash
node --experimental-strip-types packages/cli/src/index.ts <command> [options]
```

下文示例统一使用方式二。

### 3.2 初始化新项目

```bash
# 在指定目录初始化新项目
node --experimental-strip-types packages/cli/src/index.ts init ~/my-docs-project

# 查看初始化结果
ls -la ~/my-docs-project
```

生成的项目包含：
- `anydocs.config.json` - 项目配置
- `anydocs.workflow.json` - 工作流定义
- `pages/` - 页面内容目录
- `navigation/` - 导航树文件
- `.gitignore` - 忽略 dist/ 和 .anydocs/

项目配置约束：
- Docs Site 主题应作为项目级显式配置存在于 `anydocs.config.json`
- 一个项目只能选择一个主题
- 主题配置推荐使用 `site.theme.id`

推荐形态：

```json
{
  "version": 1,
  "projectId": "default",
  "name": "My Docs",
  "defaultLanguage": "zh",
  "languages": ["zh", "en"],
  "site": {
    "theme": {
      "id": "classic-docs"
    }
  }
}
```

### 3.3 构建示例项目

```bash
# 构建到默认位置（examples/demo-docs/dist/）
node --experimental-strip-types packages/cli/src/index.ts build examples/demo-docs

# 查看构建产物
ls -la examples/demo-docs/dist/
cat examples/demo-docs/dist/build-manifest.json
cat examples/demo-docs/dist/llms-full.txt
cat examples/demo-docs/dist/mcp/index.json
cat examples/demo-docs/dist/mcp/chunks.en.json
```

**构建产物说明：**
```text
dist/
├── index.html                       # 站点入口
├── docs/index.html                  # 默认语言 docs 入口
├── zh/docs/.../index.html           # 语言阅读页
├── en/docs/.../index.html
├── _next/                           # Next 导出的静态资源
├── build-manifest.json              # 构建元信息
├── llms.txt                         # 轻量 AI 索引入口
├── llms-full.txt                    # 全站 AI fallback 文本导出
├── mcp/                             # 机器可读产物
│   ├── index.json
│   ├── navigation.zh.json
│   ├── navigation.en.json
│   ├── chunks.zh.json
│   ├── chunks.en.json
│   ├── pages.zh.json
│   └── pages.en.json
├── search-index.zh.json             # 搜索索引
└── search-index.en.json
```

补充约束：
- 最终 `dist/` 只保留 deployable docs-site 内容，不应出现 `studio/`、`admin/`、`projects/`。
- Next export 的内部辅助产物会被清理，例如 `_not-found/` 和调试用 `.txt` 文件。
- `llms.txt` 和 `llms-full.txt` 是预期保留的 `.txt` 产物。

**Reader Search 与 AI 产物分工：**
- `search-index.<lang>.json` 只服务阅读站里的 `Find` 场景，目标是帮助人快速找到页面或章节。
- 外部 agent 推荐优先读取 `mcp/index.json`、`pages.<lang>.json`、`navigation.<lang>.json` 和 `chunks.<lang>.json`。
- `llms-full.txt` 只作为全站粗粒度 fallback，不应替代结构化 JSON artifact。

### 3.4 自定义输出目录

```bash
# 构建到自定义位置
node --experimental-strip-types packages/cli/src/index.ts build examples/demo-docs --output /tmp/build-output

# 或使用短参数
node --experimental-strip-types packages/cli/src/index.ts build examples/demo-docs -o /tmp/build-output
```

### 3.5 监听模式（Watch）

```bash
# 监听内容变化并自动重新构建
node --experimental-strip-types packages/cli/src/index.ts build examples/demo-docs --watch

# 监听并输出到自定义目录
node --experimental-strip-types packages/cli/src/index.ts build examples/demo-docs --output /tmp/build --watch
```

适用场景：
- 内容编辑时持续验证构建产物
- 调试搜索索引生成
- 验证 `llms.txt`、`llms-full.txt` 与 `mcp/chunks.<lang>.json` 输出

### 3.6 启动本地动态阅读站

```bash
# 启动项目的本地阅读站
node --experimental-strip-types packages/cli/src/index.ts preview examples/demo-docs
```

输出示例：
```
Preview server started for project "default".
Preview URL: http://127.0.0.1:<port>/zh/docs/welcome
Published pages: 1
```

这个命令会：
1. 验证项目结构
2. 读取默认语言配置
3. 找到第一个已发布页面
4. 启动本地阅读站服务并输出最终 URL
5. 在服务运行期间反映已发布内容的磁盘变更

**注意**:
- `preview` 是长驻命令，会一直运行到你按 `Ctrl+C`
- `preview --watch` 仍可使用，但当前只是兼容旧用法的保留参数；live preview 默认已开启
- `published` 之外的页面不会进入阅读站

### 3.7 导入旧文档

**第一步：导入到暂存区**
```bash
# 从 Markdown/MDX 目录导入
node --experimental-strip-types packages/cli/src/index.ts import ./legacy-docs examples/demo-docs zh

# 查看导入清单
cat examples/demo-docs/imports/<importId>/manifest.json
```

**第二步：转换为正式页面**
```bash
# 转换导入的内容
node --experimental-strip-types packages/cli/src/index.ts convert-import <importId> examples/demo-docs

# 查看转换报告
cat examples/demo-docs/imports/<importId>/conversion-report.json
```

转换后：
- 在 `pages/{lang}/` 生成草稿页
- 在导航树末尾添加导入分组
- 生成包含 slug 冲突等信息的转换报告

## 4. 典型开发场景

### 4.1 场景一：开发 Studio 功能

```bash
# 启动开发服务器
pnpm dev

# 在浏览器中打开
# http://localhost:3000/studio

# 编辑 packages/web/components/studio/ 下的文件
# 保存后自动热重载
```

### 4.2 场景二：开发阅读站功能

```bash
# 启动开发服务器
pnpm dev

# 编辑 packages/web/app/[lang]/docs/ 下的文件
# 或编辑 packages/web/components/docs/ 下的组件
# 保存后通过 build / production 上下文验证
```

**注意**：
- 阅读站路由在普通开发模式下默认不会对外开放
- 如果需要验证阅读站，请运行：
  ```bash
  node --experimental-strip-types packages/cli/src/index.ts preview examples/demo-docs
  ```
- 如果需要验证静态部署产物，请运行：
  ```bash
  node --experimental-strip-types packages/cli/src/index.ts build examples/demo-docs
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
6. 运行 `preview` 与 `build`，确认同一主题在动态预览和静态产物中表现一致。

实现约束建议：
- 不要在运行时为同一个项目提供主题切换 UI
- 不要把主题选择写入 page 或 navigation 数据
- 不要让新主题通过修改全局硬编码 class 名来接入
- 未注册主题必须在加载配置或构建时显式失败

### 4.3 场景三：测试 CLI 构建流程

```bash
# 修改示例项目内容
vim examples/demo-docs/pages/zh/welcome.json

# 重新构建
node --experimental-strip-types packages/cli/src/index.ts build examples/demo-docs

# 验证构建产物
cat examples/demo-docs/dist/search-index.zh.json
cat examples/demo-docs/dist/llms.txt
cat examples/demo-docs/dist/llms-full.txt
cat examples/demo-docs/dist/mcp/index.json
cat examples/demo-docs/dist/mcp/chunks.zh.json
ls examples/demo-docs/dist/en/docs
```

### 4.4 场景四：调试 Core 库

```bash
# Core 库在 packages/core/src/

# 修改 Core 代码
vim packages/core/src/fs/content-repository.ts

# CLI 自动使用最新的 Core 代码（workspace link）
node --experimental-strip-types packages/cli/src/index.ts build examples/demo-docs

# 如果需要类型检查
pnpm --filter @anydocs/core typecheck
```

### 4.5 场景五：端到端测试（编辑 → 构建 → 预览）

```bash
# 1. 启动 Studio
pnpm dev

# 2. 在 Studio 中编辑内容
#    http://localhost:3000/studio

# 3. 保存后，内容写入 examples/demo-docs/pages/

# 4. 启动本地动态阅读站（新终端）
node --experimental-strip-types packages/cli/src/index.ts preview examples/demo-docs

# 5. 打开终端输出的 Preview URL，并确认页面可访问
#    例如：http://127.0.0.1:3000/zh/docs/welcome

# 6. 如需验证静态部署产物，再执行一次构建
node --experimental-strip-types packages/cli/src/index.ts build examples/demo-docs
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

# 完整检查（类型 + lint）
pnpm check
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

## 6. 构建生产版本

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
node packages/cli/dist/index.js build examples/demo-docs
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
1. 确保在开发模式下运行 `pnpm dev`
2. 检查文件权限
3. 查看浏览器控制台和终端日志

### 7.3 构建产物未生成

**问题**: 执行 build 命令后找不到 dist/ 目录

**排查**:
```bash
# 检查项目是否有 anydocs.config.json
ls examples/demo-docs/anydocs.config.json

# 查看构建日志
node --experimental-strip-types packages/cli/src/index.ts build examples/demo-docs

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
# 终端 1：Studio
pnpm dev

# 终端 2：动态阅读站预览
node --experimental-strip-types packages/cli/src/index.ts preview examples/demo-docs

# 终端 3：如果你还要持续验证静态产物，再开 watch build
node --experimental-strip-types packages/cli/src/index.ts build examples/demo-docs --watch
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
pnpm check
pnpm build
node --experimental-strip-types packages/cli/src/index.ts build examples/demo-docs
pnpm dev
```

## 9. 快速参考

### 9.1 常用命令速查

| 任务 | 命令 |
|------|------|
| 安装依赖 | `pnpm install` |
| 启动开发 | `pnpm dev` |
| 类型检查 | `pnpm typecheck` |
| 代码检查 | `pnpm lint` |
| 完整构建 | `pnpm build` |
| 初始化项目 | `node --experimental-strip-types packages/cli/src/index.ts init <dir>` |
| 构建产物 | `node --experimental-strip-types packages/cli/src/index.ts build <dir>` |
| 监听构建 | `node --experimental-strip-types packages/cli/src/index.ts build <dir> --watch` |
| 本地阅读站预览 | `node --experimental-strip-types packages/cli/src/index.ts preview <dir>` |

### 9.2 快捷脚本（可选）

在 `package.json` 中添加：
```json
{
  "scripts": {
    "cli": "node --experimental-strip-types packages/cli/src/index.ts",
    "cli:build": "node --experimental-strip-types packages/cli/src/index.ts build examples/demo-docs",
    "cli:preview": "node --experimental-strip-types packages/cli/src/index.ts preview examples/demo-docs",
    "cli:watch": "node --experimental-strip-types packages/cli/src/index.ts build examples/demo-docs --watch"
  }
}
```

使用：
```bash
pnpm cli build examples/demo-docs
pnpm cli:build
pnpm cli:preview
pnpm cli:watch
```

## 10. 相关文档

- [文档索引](README.md) - 当前 `docs/` 目录入口
- [架构文档](planning-artifacts/architecture.md) - 架构设计与技术边界
- [PRD](planning-artifacts/prd.md) - 产品需求定义
- [Epics](planning-artifacts/epics.md) - Epic 与 Story 拆分
- [使用手册](04-usage-manual.md) - 详细操作指南
- [README](../README.md) - 项目概览
