# Agent Integration Guide

本文说明如何让外部 agent 清楚、稳定地使用 Anydocs。

核心原则：

- `MCP` 负责“能做什么”
- 项目内 guide 文件负责“应该怎么做”
- resources / resourceTemplates 负责“补充只读 guidance 和 canonical 示例”

推荐做法不是只给 agent 一份长 prompt，而是同时提供：

1. `@anydocs/mcp` 的 `stdio` MCP server
2. 项目根目录里的 agent guide 文件

如果你是通过 npm 安装使用 Anydocs，而不是从仓库源码运行，推荐命令是：

```bash
npx @anydocs/cli <command>
npx -y @anydocs/mcp
```

如果你更喜欢全局命令，也可以：

```bash
npm install -g @anydocs/cli @anydocs/mcp
anydocs <command>
anydocs-mcp
```

## 1. 推荐集成方式

对 Codex、Claude Code 这类 coding agent，推荐使用：

- `MCP` 作为主能力边界
- resources / resourceTemplates 作为只读知识暴露层
- `AGENTS.md` / `Claude.md` / `skill.md` 作为工作流提示层

原因：

- MCP 可以提供稳定、可测试、可版本化的 Anydocs domain tools
- resources 可以降低 agent 发现模板、Yoopta block 和 canonical 示例的上下文成本
- `project_open` 可以作为第一跳，把后续建议读取的 resource URI 一并告诉 agent
- guide 文件可以告诉 agent 先后顺序、约束和默认操作方式
- 这样能减少 agent 直接改 JSON 源文件造成的漂移

## 2. Codex

### 2.1 注册 MCP server

在 Codex 中把 Anydocs 作为一个 `stdio` MCP server 注册：

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

如果你已经全局安装，也可以把 `command` 直接写成 `anydocs-mcp`：

```json
{
  "mcpServers": {
    "anydocs": {
      "command": "anydocs-mcp",
      "args": []
    }
  }
}
```

如果你是在 Anydocs 仓库里开发 MCP 本身，才推荐继续使用源码入口：

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

### 2.2 项目内 guide

对于 Codex，推荐在文档项目根目录生成 `AGENTS.md`。

可以直接这样初始化项目：

```bash
npx @anydocs/cli init ./my-docs-project --agent codex
```

或：

```bash
npx @anydocs/cli project create ./my-docs-project --agent codex
```

这样生成的 `AGENTS.md` 会指导 Codex：

- 先 `project_open`
- 需要时先 `project_set_languages`
- 再读页面
- 需要时先读 `anydocs://authoring/guidance`、`anydocs://templates/index` 或相关 template/block resource
- 需要 richer 初稿时优先 `page_create_from_template`
- 需要按模板重整已有页面时用 `page_update_from_template`
- 改 `content` 且需要同步 reader 文本摘要时，用 `page_update(..., regenerateRender: true)`
- 再通过 `page_create` / `page_update` / `page_delete` / `page_set_status` 变更内容
- 批量内容维护时优先 `page_batch_create` / `page_batch_update` / `page_batch_set_status`
- 通过 `nav_get` / `nav_insert` / `nav_delete` / `nav_move` 处理日常导航
- 只有整体重排时再用 `nav_replace_items` / `nav_set`
- 不直接编辑 `pages/*.json` 与 `navigation/*.json`

## 3. Claude Code

对 Claude Code，建议同样注册 `@anydocs/mcp` 的 `stdio` server，并在项目根目录生成 `Claude.md`。

初始化项目时：

```bash
npx @anydocs/cli init ./my-docs-project --agent claude-code
```

或：

```bash
npx @anydocs/cli project create ./my-docs-project --agent claude-code
```

这样项目会带上一份 `Claude.md`，内容与标准 guide 模板一致，但文件名更适合 Claude Code 的约定式读取。

## 4. guide 文件应该写什么

guide 文件不应该再重复完整数据模型细节；这些能力现在由 MCP 承担。

guide 文件应只强调：

- 什么时候优先使用 MCP
- 哪些 resources 可以先读来获得 guidance 或 canonical 示例
- 标准调用顺序
- Yoopta block 能力、推荐页面模板和默认写法
- 哪些文件不要直接改
- 哪些字段只能通过特定工具改
- MCP 校验错误不可绕过

## 5. 推荐默认工作流

无论是 Codex 还是 Claude Code，都推荐把下面流程作为默认执行策略：

1. `project_open(projectRoot)`
2. 需要时 `project_set_languages(projectRoot, languages, defaultLanguage?)`
3. 必要时 `project_validate(projectRoot)`
4. 从 `project_open` 的 `authoring` 字段读取 Yoopta 能力、模板、写作建议，以及推荐的 resource / resourceTemplate 引用
5. 需要时读取 `anydocs://authoring/guidance`、`anydocs://templates/{templateId}`、`anydocs://blocks/{blockType}/example`
6. `page_list` / `page_find` / `page_get`
7. 需要 richer 初稿时优先 `page_create_from_template`
8. 需要按模板重整已有页面时用 `page_update_from_template`
9. `page_update` 在变更 `content` 后，若需要同步 `render.markdown` / `render.plainText`，显式传 `regenerateRender: true`
10. `page_create` / `page_update` / `page_delete` / `page_set_status`
11. 多页操作时 `page_batch_create` / `page_batch_update` / `page_batch_set_status`
12. `nav_get`
13. `nav_insert` / `nav_delete` / `nav_move`
14. 需要整体重排时再用 `nav_replace_items` / `nav_set`

## 6. 何时不要用 MCP

以下情况不要强行走 Anydocs MCP：

- 你在修改 Anydocs 仓库本身的实现代码
- 你在补测试、改 CLI、改 web UI
- 当前目标操作尚未被 MCP 工具覆盖

这些场景应使用普通代码编辑流程。
