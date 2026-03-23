# Anydocs

本地优先文档编辑器，面向两件事：

- 在 `Studio` 里编辑文档页面、导航和项目设置
- 让 `agent` 通过 `MCP` 稳定地读写文档项目，而不是直接改 JSON

如果你是第一次进入仓库，先看下面两个路径：

1. 想先把示例项目跑起来：看“快速启动”
2. 想直接开始 agent 写作：看“Agent 写作优先路径”

## 快速启动

### 方式 A：先跑示例项目

```bash
pnpm install
pnpm dev
pnpm --filter @anydocs/cli cli preview examples/demo-docs
```

然后：

- 打开 `http://localhost:3000/studio`
- 在 Studio 里选择 `examples/demo-docs`
- 终端里的 `preview` 会输出阅读站 URL，用来查看已发布页面

这个路径适合先理解 Anydocs 的编辑方式、页面结构和发布边界。

### 方式 B：创建你自己的文档项目

如果你准备直接写自己的文档项目，而不是先玩示例：

```bash
pnpm install
pnpm --filter @anydocs/cli cli init ./my-docs-project --agent codex
pnpm dev
pnpm --filter @anydocs/cli cli preview ./my-docs-project
```

然后：

- 打开 `http://localhost:3000/studio`
- 在 Studio 里选择 `./my-docs-project`
- 让 agent 通过 MCP 操作这个项目

如果你主要使用 Claude Code，可以把初始化命令里的 `--agent codex` 换成 `--agent claude-code`。

## Agent 写作优先路径

这是当前推荐的工作方式。核心思路很简单：

- 用 `Studio` 做人工编辑、检查和发布
- 用 `MCP` 让 agent 做页面创建、批量更新、导航维护
- 不让 agent 直接修改 `pages/*.json` 和 `navigation/*.json`

### 1. 初始化一个带 guide 的项目

Codex：

```bash
pnpm --filter @anydocs/cli cli init ./my-docs-project --agent codex
```

Claude Code：

```bash
pnpm --filter @anydocs/cli cli init ./my-docs-project --agent claude-code
```

生成结果：

- `--agent codex` 会生成 `AGENTS.md`
- `--agent claude-code` 会生成 `Claude.md`
- 不显式指定时，默认 guide 文件是 `skill.md`

### 2. 启动 MCP server

在工具仓库根目录运行：

```bash
pnpm --filter @anydocs/mcp dev
```

也可以直接运行入口：

```bash
node --experimental-strip-types packages/mcp/src/index.ts
```

### 3. 把 MCP 配到 agent

Codex 的 `stdio` 配置示例：

```json
{
  "mcpServers": {
    "anydocs": {
      "command": "pnpm",
      "args": ["--filter", "@anydocs/mcp", "dev"],
      "cwd": "/path/to/anydocs"
    }
  }
}
```

### 4. 让 agent 按这个顺序工作

默认顺序建议：

1. `project_open(projectRoot)`
2. 需要时 `project_set_languages(...)`
3. 需要时 `project_validate(projectRoot)`
4. 先看 `project_open.authoring` 返回的 templates、resources、resourceTemplates
5. 需要 guidance 或 canonical 示例时，优先读 `anydocs://authoring/guidance`、`anydocs://templates/{templateId}`、`anydocs://blocks/{blockType}/example`
6. `page_list` / `page_find` / `page_get`
7. 需要 richer 初稿时优先 `page_create_from_template`
8. 需要按模板重整已有页面时用 `page_update_from_template`
9. 常规修改用 `page_update`；如果本轮改了 `content` 且需要同步 reader 文本摘要，可传 `regenerateRender: true`
10. `page_create` / `page_delete` / `page_set_status`
11. `nav_get`
12. `nav_insert` / `nav_delete` / `nav_move`
13. 只有整体重排时再用 `nav_replace_items` / `nav_set`

一句话原则：

- 先 `project_open`
- 优先用 MCP
- 最后才考虑直接改文件

### 5. 日常写作闭环

```bash
# 终端 1：Studio
pnpm dev

# 终端 2：Reader preview
pnpm --filter @anydocs/cli cli preview ./my-docs-project

# 终端 3：需要静态产物时再 build
pnpm --filter @anydocs/cli cli build ./my-docs-project
```

这个闭环里：

- Studio 负责编辑和项目设置
- Preview 负责看阅读站效果
- Build 负责生成最终静态产物和 AI 可读产物

## 最常用命令

```bash
pnpm dev
pnpm dev:desktop
pnpm --filter @anydocs/cli cli init ./my-docs-project
pnpm --filter @anydocs/cli cli build ./my-docs-project
pnpm --filter @anydocs/cli cli preview ./my-docs-project
pnpm --filter @anydocs/cli cli import ./legacy-docs ./my-docs-project zh
pnpm --filter @anydocs/cli cli convert-import <importId> ./my-docs-project
pnpm --filter @anydocs/mcp dev
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
├── AGENTS.md / Claude.md / skill.md
├── pages/
├── navigation/
├── imports/
└── dist/
```

说明：

- `pages/` 和 `navigation/` 是 canonical source
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

- [docs/04-usage-manual.md](docs/04-usage-manual.md)：详细操作手册
- [docs/07-agent-integration.md](docs/07-agent-integration.md)：Codex / Claude Code 与 MCP 的完整集成方式
- [docs/05-dev-guide.md](docs/05-dev-guide.md)：开发与验证流程
- [docs/README.md](docs/README.md)：`docs/` 目录索引
- [artifacts/bmad/README.md](artifacts/bmad/README.md)：规划、技术规格和测试产物索引
