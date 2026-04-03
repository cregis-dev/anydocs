# Anydocs 详细操作手册

本文面向文档项目使用者、内容编辑者和 CLI 使用者，聚焦“如何使用 Anydocs 管理与发布文档项目”。根 `README` 优先解决“如何快速启动”和“如何进入 agent 写作流程”，这里则展开说明项目初始化、Studio 使用、构建发布、旧文档导入与 Markdown 快速迁移。若你要开发 Anydocs 仓库本身，请改看 [developer-guide.md](developer-guide.md)。

## 1. 你可以用 Anydocs 做什么

Anydocs 当前提供三类使用方式：

- Docs Site：将编辑好的文档按指定结构与主题构建出的阅读站
- Studio：本项目的编辑功能，负责可视化文档编辑与结构编排
- CLI：围绕 Docs Site 构建链路工作的命令行工具，核心职责是 `build`

如果你要本地编辑内容，优先启动 Studio。  
如果你要生成 Docs Site、搜索索引、`llms.txt`、`llms-full.txt` 或机器可读产物，请用 CLI。

## 2. 环境要求

- Node.js `>= 18`
- pnpm `>= 9`

安装依赖：

```bash
pnpm install
```

## 3. 仓库主要入口

根目录脚本：

```bash
pnpm dev
pnpm build
pnpm build:web
pnpm build:desktop
pnpm build:cli
pnpm typecheck
pnpm lint
pnpm test
pnpm test:web
pnpm test:full
```

各入口适用场景：

| 场景 | 命令 | 说明 |
| --- | --- | --- |
| Web 开发 | `pnpm dev` | 启动 Next.js，本地开发时会先生成公开产物 |
| 桌面端开发 | `pnpm dev:desktop` | 启动 Electron 客户端 |
| 全量构建 | `pnpm build` | 递归构建 workspace |
| 仅构建 Web | `pnpm build:web` | 先生成公开产物，再执行 Next.js build |
| 仅构建 CLI | `pnpm build:cli` | 编译 `@anydocs/cli` |

## 4. 当前目录结构

Anydocs 遵循”工具与内容分离”原则，核心目录如下：

```text
anydocs/                     # 工具仓库
├── packages/                # 工具代码
│   ├── cli/                # CLI 工具
│   ├── core/               # 核心库
│   ├── desktop/            # Electron 应用
│   └── web/                # Next.js Studio & 阅读站
│
├── examples/               # 示例项目
│   └── demo-docs/          # 演示项目（独立的文档项目）
│       ├── anydocs.config.json
│       ├── anydocs.workflow.json
│       ├── pages/
│       │   ├── zh/*.json
│       │   └── en/*.json
│       ├── navigation/
│       │   ├── zh.json
│       │   └── en.json
│       ├── imports/        # 导入暂存区
│       ├── dist/           # 构建产物（git-ignored）
│       │   ├── index.html
│       │   ├── docs/index.html
│       │   ├── zh/docs/.../index.html
│       │   ├── en/docs/.../index.html
│       │   ├── _next/
│       │   ├── build-manifest.json
│       │   ├── llms.txt
│       │   ├── llms-full.txt
│       │   ├── mcp/
│       │   │   ├── chunks.<lang>.json
│       │   ├── search-index.zh.json
│       │   └── search-index.en.json
│       └── .gitignore
│
└── docs/                   # 工具文档
```

**重要说明：**

- **工具代码**：`packages/` 目录包含编辑器、CLI 和构建系统
- **文档项目**：独立存在（如 `examples/demo-docs/`），可以在任何位置
- **构建产物**：默认输出到项目的 `dist/` 目录（可通过 `--output` 自定义）
- **项目结构**：当前 canonical 结构是单工程目录，项目根目录直接包含 `anydocs.config.json`
- 只有 `status = "published"` 的页面会出现在 Docs Site、搜索索引、`llms.txt`、`llms-full.txt` 和机器可读产物中

## 5. Web 与 Studio 的使用方式

启动本地开发：

```bash
pnpm dev
```

常用地址：

- `http://localhost:3000/`：本地首页，开发环境下直接进入 Studio
- `http://localhost:3000/studio`：Studio 编辑台

Docs Site 说明：
- 普通 `pnpm dev` 仍以 Studio 开发为主，未显式进入 CLI preview/export 上下文时，`/[lang]/docs/*` 阅读站路由不会对外开放。
- 如需验证真实阅读站，请使用 CLI `preview` 启动本地动态阅读站，或使用 CLI `build` 生成可部署静态站点后再用任意静态服务器验证。

你在 Studio 里可以做的事：

- 打开一个已有的本地项目，或从最近项目列表重新进入项目
- 从最近项目列表中移除历史记录项（只影响本地历史，不删除磁盘上的项目）
- 编辑页面内容与元数据
- 删除当前语言下的页面，并同步清理该语言导航中的页面引用
- 编辑导航树，包括新增根级分组、根级页面引用、根级外链，以及在分组内新增页面引用或外链
- 修改项目基础设置，包括项目名、默认语言、启用语言、主题品牌文案、代码主题和构建输出目录
- 触发 Preview 和 Build

当前限制：
- Studio 目前只能打开已有项目，不能直接创建新项目；如需新建项目，请使用 CLI `init`
- 导航节点菜单里的 `Delete` 只删除导航节点本身，不会删除对应页面文件

Studio 走本地写文件接口，相关接口位于 `/api/local/*`。这些接口依赖 Node.js 文件系统能力，只适合本地或受控环境。

## 6. CLI 使用方式

### 6.1 运行 CLI

对直接使用已发布包的用户，推荐两种方式：

```bash
npx @anydocs/cli <command>
```

或先全局安装：

```bash
npm install -g @anydocs/cli
anydocs <command>
```

如果你是在仓库源码里开发 Anydocs，再使用下面两种方式：

```bash
pnpm --filter @anydocs/cli cli <command>
```

或：

```bash
node --experimental-strip-types packages/cli/src/index.ts <command>
```

下面示例统一使用 `npx @anydocs/cli`。若只想启动预览，也可以直接运行 `anydocs preview <targetDir>`。

CLI 的定位补充：
- `build` 是核心命令，负责生成 Docs Site 公开产物。
- `init`、`preview`、`import`、`convert-import` 是围绕构建流程的辅助命令。

### 6.2 CLI 命令总览

```text
init [targetDir]
build [targetDir] [--watch]
preview [targetDir] [--watch]
import <sourceDir> [targetDir] [lang]
convert-import <importId> [targetDir]
```

### 6.3 初始化一个新项目

在指定目录创建一个标准 Anydocs 项目：

```bash
npx @anydocs/cli init ./my-docs-project
```

执行后会创建独立项目：

- `anydocs.config.json`
- `anydocs.workflow.json`
- `skill.md`，或按 `--agent` 生成 `AGENTS.md` / `CLAUDE.md`
- Claude Code 项目还会额外生成 `.claude/commands/anydocs-new-page.md` 与 `.claude/commands/anydocs-publish-page.md`
- `navigation/zh.json`
- `navigation/en.json`
- `pages/zh/welcome.json`
- `pages/en/welcome.json`

初始化特点：

- 默认语言是 `zh`
- 默认启用 `zh` 和 `en`
- 自动创建欢迎页和起始导航
- 生成的项目是独立的，可以在任何位置
- 如果不传 `--project-id` 和 `--name`，会根据目标目录名自动推导项目 ID 和显示名称
- 生成的 `anydocs.config.json` 会显式写出常用项目字段，例如 `site.theme.branding.siteTitle` 和 `build.outputDir`
- 根 guide 文件只保留最小约束；详细 authoring 流程通过 `anydocs://authoring/guidance` 按需读取

如果目标目录下已经存在 `anydocs.config.json`，初始化会失败，避免覆盖已有项目。

### 6.3a 页面 template 与 metadata

Anydocs 的页面除了正文 `content`，还支持 template 驱动的结构化 metadata。

典型页面字段现在包括：

- `template`：页面使用的模板 id
- `metadata`：模板定义的结构化字段值
- `review`：内容审核状态与来源信息

关于 `metadata` 的关键约束：

- 只有设置了 `template`，页面才能保存 `metadata`
- `metadata` 不是自由对象，字段集合由项目模板的 `metadataSchema` 决定
- 当前支持的 metadata 字段类型包括：`string`、`text`、`enum`、`boolean`、`date`、`string[]`
- 未在 schema 中声明的 metadata 字段会被拒绝
- required metadata 字段缺失时会返回校验错误
- 发布后的 `mcp/pages.<lang>.json` 只会暴露 visibility 为 `public` 的 metadata；`internal` 字段不会进入公开机器可读产物

如果你通过 MCP 让 agent 写页面，建议先查看 `project_open.authoring.templates` 返回的 template 定义；其中会包含可用模板及其 `metadataSchema`。

### 6.4 构建公开产物

```bash
# 构建到默认位置（项目目录下的 dist/）
npx @anydocs/cli build ./my-docs-project

# 构建到自定义位置
npx @anydocs/cli build ./my-docs-project --output ./build-output

# 监听模式
npx @anydocs/cli build ./my-docs-project --watch
```

构建会校验项目合同并生成：

**输出目录结构**（以默认 `dist/` 为例）：
```text
dist/
├── index.html                   # 站点入口
├── docs/index.html              # 默认语言 docs 入口
├── zh/docs/.../index.html       # 中文阅读页
├── en/docs/.../index.html       # 英文阅读页
├── _next/                       # Next 导出的静态资源
├── build-manifest.json          # 构建元信息
├── llms.txt                     # 轻量 AI 索引入口
├── llms-full.txt                # 全站 AI fallback 文本导出
├── mcp/                         # 机器可读产物
│   ├── index.json
│   ├── navigation.<lang>.json
│   ├── chunks.<lang>.json
│   └── pages.<lang>.json
├── search-index.zh.json         # 中文搜索索引
└── search-index.en.json         # 英文搜索索引
```

输出约束：

- `dist/` 中只保留 Docs Site 部署真正需要的内容。
- `studio/`、`admin/`、`projects/` 这类非阅读站目录不会保留在最终构建产物中。
- Next export 产生的内部辅助文件也会被清理，例如 `_not-found/` 和调试用 `.txt` 文件。
- `llms.txt` 与 `llms-full.txt` 是构建输出中预期保留的 `.txt` 文件。

搜索与 AI 产物的分工：

- `search-index.<lang>.json` 服务阅读站中的查找体验，目标是帮助读者快速找到页面或章节入口。
- `llms.txt` 提供轻量目录式入口，方便外部 agent 先发现站点内容。
- `llms-full.txt` 提供全站顺序文本导出，适合作为粗粒度 fallback。
- `mcp/pages.<lang>.json`、`mcp/navigation.<lang>.json`、`mcp/chunks.<lang>.json` 提供结构化机器可读接口，适合外部 agent 按需读取。

**输出位置优先级：**
1. `--output` 参数
2. `anydocs.config.json` 中的 `build.outputDir`
3. 默认：`{项目目录}/dist/`

监听模式适合内容编辑或调试构建规则时持续监听 `pages/`、`navigation/` 和工作流定义文件变化，并持续刷新整套静态站点输出。

### 6.5 启动本地动态阅读站

```bash
npx @anydocs/cli preview ./my-docs-project
```

这个命令会启动一个本地动态 Docs Site 预览服务，并打印可直接打开的 URL。它的作用是：

- 校验项目结构
- 读取默认语言
- 找到第一个已发布页面
- 启动阅读站服务，例如 `http://127.0.0.1:3000/zh/docs/welcome`
- 在服务运行期间持续读取磁盘上的已发布内容变化

监听模式：

```bash
npx @anydocs/cli preview examples/demo-docs --watch
```

说明：

- `preview` 默认就是 live preview；`--watch` 目前只是兼容旧用法的保留参数。
- 服务会一直运行到你按 `Ctrl+C` 停止。
- 只会展示 `published` 页面；草稿和审核中页面不会进入阅读站。

### 6.6 导入历史 Markdown 或 MDX

第一步，导入旧文档到暂存区：

```bash
npx @anydocs/cli import ./legacy-docs ./my-docs-project zh
```

规则：

- `sourceDir` 必须是目录
- 只会读取 `.md` 和 `.mdx`
- 如果不传语言，默认使用项目默认语言
- frontmatter 支持简单 `key: value` 和数组格式

导入结果会写到：

```text
imports/<importId>/
├── manifest.json
└── items/*.json
```

第二步，把暂存内容转换为正式页面：

```bash
npx @anydocs/cli convert-import <importId> ./my-docs-project
```

转换后会发生这些事情：

- 在 `pages/<lang>/` 下生成草稿页
- 在对应语言导航末尾追加一个导入分组
- 在导入目录中写入 `conversion-report.json`
- 如果存在 slug 或 pageId 冲突，会自动生成唯一值并记录 warning

建议流程：

1. `import` 暂存旧文档
2. 检查 `manifest.json`
3. `convert-import` 生成草稿
4. 在 Studio 中逐页审核后再发布

如果你是通过外部 agent 或 MCP 直接把历史 Markdown 写入 Anydocs，而不是先走目录级导入，也可以使用：

- `page_create_from_markdown`：把整份 Markdown/MDX 文档直接创建为新页面
- `page_update_from_markdown`：把 Markdown 内容替换或追加到现有页面

推荐用法：

- 整页迁移使用 `inputMode: "document"`，这样会解析 frontmatter，并尽量推断 `title`、`description`、`tags`
- 局部补录使用 `inputMode: "fragment"`；追加到现有页面时配合 `operation: "append"`
- 转换完成后检查返回的 `conversion.warnings`，尤其是 MDX、未映射 frontmatter，以及代码块、链接、图片、引用块这类仍可能被简化的结构

## 7. 典型工作流

### 工作流 A：使用示例项目

```bash
pnpm install
pnpm dev
# 在 Studio 中编辑仓库内置示例项目 examples/demo-docs
npx @anydocs/cli build examples/demo-docs
```

适合场景：

- 了解 Anydocs 功能
- 测试编辑器和构建流程
- 学习项目结构

### 工作流 B：创建独立文档项目

```bash
# 初始化
npx @anydocs/cli init ./my-docs-project

# 构建
npx @anydocs/cli build ./my-docs-project

# 构建到自定义位置
npx @anydocs/cli build ./my-docs-project --output ./build-output

# 预览
npx @anydocs/cli preview ./my-docs-project
```

适合场景：

- 创建独立的文档站点
- 文档项目独立版本管理
- 部署到生产环境

### 工作流 C：导入旧站内容

```bash
npx @anydocs/cli import ./legacy-docs ./my-docs-project zh
npx @anydocs/cli convert-import <importId> ./my-docs-project
pnpm dev
# 在 Studio 中审核和发布导入的内容
```

适合场景：

- 把历史 Markdown/MDX 迁入当前内容模型
- 批量内容迁移

## 8. 文档项目的独立管理

### 8.1 项目结构

一个标准的独立文档项目应包含：

```text
my-docs-project/
├── anydocs.config.json       # 项目配置
├── anydocs.workflow.json     # 工作流定义
├── .gitignore               # 必须忽略 dist/
├── README.md                # 项目说明
├── pages/                   # 页面内容
│   ├── zh/*.json
│   └── en/*.json
├── navigation/              # 导航树
│   ├── zh.json
│   └── en.json
├── imports/                 # 导入暂存区（可选）
└── dist/                    # 构建产物（git-ignored）
    ├── index.html
    ├── docs/index.html
    ├── <lang>/docs/.../index.html
    ├── _next/
    ├── build-manifest.json
    ├── llms.txt
    ├── llms-full.txt
    ├── mcp/
    │   ├── chunks.<lang>.json
    └── search-index.<lang>.json
```

补充说明：
- 当前运行时 contract 已稳定覆盖页面、导航、构建产物与 published-only 发布边界。
- Docs Site 的项目级主题 contract 已要求在项目配置中显式声明唯一主题，并由 build/preview 读取同一个主题值。
- `build-manifest.json` 与 `mcp/index.json` 也会回写当前项目的 `site.theme.id`，方便部署校验、外部自动化和后续构建诊断。
- 主题不应写入页面内容或导航文件，而应归属于项目配置与阅读站展示层。

### 8.2 配置输出目录

可以在 `anydocs.config.json` 中配置默认输出目录：

```json
{
  "version": 1,
  "projectId": "default",
  "name": "My Docs",
  "defaultLanguage": "zh",
  "languages": ["zh", "en"],
  "site": {
    "theme": {
      "id": "classic-docs",
      "branding": {
        "siteTitle": "My Docs",
        "homeLabel": "Docs Home"
      },
      "codeTheme": "github-dark"
    }
  },
  "build": {
    "outputDir": "./dist"
  }
}
```

这些设置也可以在 Studio 的项目设置面板中维护：
- `defaultLanguage`
- `languages`
- `site.theme.branding.siteTitle`
- `site.theme.branding.homeLabel`
- `site.theme.codeTheme`
- `build.outputDir`

约束建议：
- 一个项目只能声明一个 Docs Site 主题
- 主题应显式指定，不做隐式推断
- 主题选择应对 `preview` 与 `build` 保持一致
- `site.theme.branding.*` 仅用于阅读站品牌文案覆盖，不进入页面内容模型
- `site.theme.codeTheme` 当前先作为项目与构建 contract 持久化，便于后续统一接入代码高亮主题

### 8.3 部署构建产物

构建产物是纯静态文件，可部署到任何静态托管服务：

```bash
# 构建
npx @anydocs/cli build ./my-docs-project --output ./build

# 复制到你的静态站点目录
cp -r ./build/* <your-static-site-dir>/

# 部署到 Vercel
cd ./build
vercel --prod
```

推荐的托管平台：
- Nginx / Apache
- Vercel / Netlify / Cloudflare Pages
- GitHub Pages
- AWS S3 / OSS

## 9. 常见问题

### 9.1 为什么阅读站里看不到刚写的页面

先检查页面 JSON 的 `status`。只有 `published` 会进入阅读站和构建产物。

### 9.1a 搜索和 AI 产物分别是干什么的

- 阅读站搜索是 `Find`，用于快速找到页面、章节和导航路径，不负责给出 AI 答案。
- `llms.txt` 和 `llms-full.txt` 是给外部 agent 的文本型输入。
- `mcp/*.json` 是给外部 agent 的结构化输入，其中 `chunks.<lang>.json` 最适合做按需内容读取。

### 9.1b 为什么 `mcp/pages.<lang>.json` 里看不到某些 metadata

先检查页面 template 的 `metadataSchema`。只有 visibility 标记为 `public` 的 metadata 字段会进入公开机器可读产物；`internal` 字段只保留在 canonical page source 中。

### 9.2 为什么 `preview` 没有打开浏览器

`preview` 会启动本地阅读站服务并打印 URL，但不会自动帮你打开浏览器。复制终端里的 `Preview URL` 即可访问。

### 9.3 为什么 `init` 执行失败

最常见原因是目标目录里已经存在 `anydocs.config.json`，CLI 会阻止覆盖已有项目。

### 9.4 为什么导入后页面是草稿

`convert-import` 的设计就是先生成 `draft` 页面，避免历史内容未经审核直接发布。

## 10. 建议的最小操作集

如果你只是想高效使用当前项目，记住下面几个命令就够了：

```bash
# 安装依赖
pnpm install

# 启动开发服务器（Studio）
pnpm dev

# 构建示例项目
npx @anydocs/cli build examples/demo-docs

# 启动本地预览
npx @anydocs/cli preview examples/demo-docs

# 创建新项目
npx @anydocs/cli init ./my-docs-project

# 导入旧文档
npx @anydocs/cli import ./legacy-docs ./my-docs-project zh
```
