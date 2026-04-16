# Anydocs  

本地优先文档编辑器，面向两件事：

- 在 `Studio` 里编辑文档页面、导航和项目设置
- 让 `agent` 通过 `MCP` 稳定地读写文档项目，而不是直接改 JSON

如果你只想直接使用已发布的 CLI 和 MCP，而不是先从源码运行，可以用：

```bash
npx @anydocs/cli version
npx -y @anydocs/mcp
```

或全局安装：

```bash
npm install -g @anydocs/cli @anydocs/mcp
anydocs version
anydocs-mcp
```

如果你是第一次进入仓库，先看下面两个路径：

1. 想先把示例项目跑起来：看“快速启动”
2. 想直接开始 agent 写作：看“Agent 写作优先路径”

## 快速启动

### 方式 A：先跑示例项目

先启动 Studio：

```bash
pnpm install
pnpm dev
```

然后按你要理解的主题，选一个 example 跑 `preview`：

```bash
pnpm --filter @anydocs/cli cli preview examples/starter-docs
pnpm --filter @anydocs/cli cli preview examples/page-template-docs
pnpm --filter @anydocs/cli cli preview examples/openapi-reference-docs
pnpm --filter @anydocs/cli cli preview examples/import-staging-docs
pnpm --filter @anydocs/cli cli preview examples/codex-authoring-docs
pnpm --filter @anydocs/cli cli preview examples/codex-mcp-docs
```

怎么选：

- 想先看最小工程骨架：`examples/starter-docs`
- 想看页面模板和 metadata：`examples/page-template-docs`
- 想看 OpenAPI / reference 路由：`examples/openapi-reference-docs`
- 想看导入暂存和 `convert-import`：`examples/import-staging-docs`
- 想看 Codex 的完整写作站点：`examples/codex-authoring-docs`
- 想只看 Codex + MCP 接入：`examples/codex-mcp-docs`

然后：

- 打开 `http://localhost:3000/studio`
- 在 Studio 里选择你刚才 preview 的 example 路径
- 终端里的 `preview` 会输出阅读站 URL，用来查看已发布页面

如果你只想先跑一个，默认从 `examples/starter-docs` 开始。
完整索引见 [examples/README.md](examples/README.md)。

### 方式 B：创建你自己的文档项目

如果你准备直接写自己的文档项目，而不是先玩示例：

```bash
pnpm install
npx @anydocs/cli init ./my-docs-project --agent codex
pnpm dev
npx @anydocs/cli preview ./my-docs-project
```

然后：

- 打开 `http://localhost:3000/studio`
- 在 Studio 里选择 `./my-docs-project`
- 让 agent 通过 MCP 操作这个项目

如果你主要使用 Claude Code，可以把初始化命令里的 `--agent codex` 换成 `--agent claude-code`。
如果不传 `--project-id` / `--name`，`init` 会根据目标目录名自动推导项目 ID 和项目名称，并把 `site.theme.branding.siteTitle`、`build.outputDir` 这类常用字段一并写入 `anydocs.config.json`。

## Agent 写作优先路径

这是当前推荐的工作方式：

- 用 `Studio` 做人工编辑、检查和发布
- 用 `MCP` 让 agent 做页面创建、批量更新、导航维护
- 不让 agent 直接修改 `pages/*.json` 和 `navigation/*.json`

### 1. 初始化项目

```bash
npx @anydocs/cli init ./my-docs-project --agent codex
```

或：

```bash
npx @anydocs/cli init ./my-docs-project --agent claude-code
```

生成结果：

- `--agent codex` 会生成 `AGENTS.md`
- `--agent claude-code` 会生成 `CLAUDE.md` 和 `.claude/commands/`
- 不显式指定时，默认 guide 文件是 `skill.md`
- 仓库内统一模板来源是 [docs/agent.md](docs/agent.md)

### 2. 启动 MCP server

```bash
npx -y @anydocs/mcp
```

仓库本地开发 MCP 时：

```bash
pnpm --filter @anydocs/mcp dev
```

### 3. 配到 agent

Codex 的 `stdio` 示例：

```json
{
  "mcpServers": {
    "anydocs": {
      "command": "npx",
      "args": ["-y", "@anydocs/mcp"]
    }
  }
}
```

Claude Code 同理：注册 `@anydocs/mcp` 为 `stdio` MCP server，并让项目根目录的 `CLAUDE.md` 作为最小入口文件。

### 4. 执行原则

- 第一跳始终是 `project_open(projectRoot)`
- 写入前先读现状，写入后再回读确认
- 页面涉及 `template` / `metadata` 时，先看 `project_open.authoring.templates`
- 需要详细规则时读 `anydocs://authoring/guidance`
- 优先用 MCP，最后才考虑直接改文件

Markdown 迁移优先级：

- 整页迁移用 `page_create_from_markdown`
- 片段补录或追加用 `page_update_from_markdown`
- richer 初稿用 `page_create_from_template`

日常闭环：

```bash
pnpm dev
npx @anydocs/cli preview ./my-docs-project
npx @anydocs/cli build ./my-docs-project
```

## 最常用命令

```bash
pnpm dev
pnpm dev:desktop
npx @anydocs/cli init ./my-docs-project
npx @anydocs/cli build ./my-docs-project
npx @anydocs/cli preview ./my-docs-project
npx @anydocs/cli import ./legacy-docs ./my-docs-project zh
npx @anydocs/cli convert-import <importId> ./my-docs-project
npx -y @anydocs/mcp
```

补充：

- `pnpm dev` 只启动 Studio 开发环境，不直接开放 Reader
- 阅读站请用 `preview` 或构建后的静态产物查看
- `preview` 默认就是 live 模式，`--watch` 只是兼容旧用法

## 一个文档项目长什么样

```text
my-docs-project/
├── anydocs.config.json
├── anydocs.workflow.json
├── AGENTS.md / CLAUDE.md / skill.md
├── .claude/commands/           # Claude Code 项目会额外生成
├── pages/
├── navigation/
├── imports/
└── dist/
```

说明：

- `pages/` 和 `navigation/` 是 canonical source
- 页面文件里的 `content` 使用 canonical `DocContentV1`；`render.markdown` 和 `render.plainText` 是派生输出
- `dist/` 是构建产物
- 只有 `published` 页面会进入 Reader、搜索索引、`llms.txt` 和 `mcp/*.json`

## Anydocs 里有什么

- `Studio`：本地编辑台，负责页面、导航、元数据和项目设置
- `CLI`：初始化、预览、构建、导入
- `Docs Reader`：只读已发布内容的阅读站
- `MCP Server`：给 agent 的稳定 authoring 接口

## 什么时候用什么

| 目标 | 用什么 |
| --- | --- |
| 编辑页面和导航 | `Studio` |
| 批量维护页面、让 agent 写作 | `MCP Server` |
| 本地看阅读站效果 | `preview` |
| 生成部署产物 | `build` |
| 导入旧 Markdown / MDX | `import` + `convert-import` |

## 详细文档

如果你已经能跑起来，后续按场景查这些文档：

- [docs/usage-manual.md](docs/usage-manual.md)：详细操作手册
- [docs/agent.md](docs/agent.md)：项目根最小 agent guide 模板
- [docs/developer-guide.md](docs/developer-guide.md)：开发与验证流程
- [docs/classic-docs-theme-config.md](docs/classic-docs-theme-config.md)：`classic-docs` 阅读主题配置
- [docs/README.md](docs/README.md)：`docs/` 目录索引
- [artifacts/bmad/README.md](artifacts/bmad/README.md)：规划、技术规格和测试产物索引
