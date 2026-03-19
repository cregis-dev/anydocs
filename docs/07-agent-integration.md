# Agent Integration Guide

本文说明如何让外部 agent 清楚、稳定地使用 Anydocs。

核心原则：

- `MCP` 负责“能做什么”
- 项目内 guide 文件负责“应该怎么做”

推荐做法不是只给 agent 一份长 prompt，而是同时提供：

1. `@anydocs/mcp` 的 `stdio` MCP server
2. 项目根目录里的 agent guide 文件

## 1. 推荐集成方式

对 Codex、Claude Code 这类 coding agent，推荐使用：

- `MCP` 作为主能力边界
- `AGENTS.md` / `Claude.md` / `skill.md` 作为工作流提示层

原因：

- MCP 可以提供稳定、可测试、可版本化的 Anydocs domain tools
- guide 文件可以告诉 agent 先后顺序、约束和默认操作方式
- 这样能减少 agent 直接改 JSON 源文件造成的漂移

## 2. Codex

### 2.1 注册 MCP server

在 Codex 中把 Anydocs 作为一个 `stdio` MCP server 注册：

```json
{
  "mcpServers": {
    "anydocs": {
      "command": "pnpm",
      "args": ["--filter", "@anydocs/mcp", "dev"],
      "cwd": "/Users/shawn/workspace/code/anydocs"
    }
  }
}
```

如果你不想依赖 `pnpm` 子命令，也可以直接运行入口：

```json
{
  "mcpServers": {
    "anydocs": {
      "command": "node",
      "args": [
        "--experimental-strip-types",
        "/Users/shawn/workspace/code/anydocs/packages/mcp/src/index.ts"
      ],
      "cwd": "/Users/shawn/workspace/code/anydocs"
    }
  }
}
```

### 2.2 项目内 guide

对于 Codex，推荐在文档项目根目录生成 `AGENTS.md`。

可以直接这样初始化项目：

```bash
pnpm --filter @anydocs/cli cli init ./workspace/my-docs --agent codex
```

或：

```bash
pnpm --filter @anydocs/cli cli project create ./workspace/my-docs --agent codex
```

这样生成的 `AGENTS.md` 会指导 Codex：

- 先 `project_open`
- 再读页面
- 再通过 `page_create` / `page_update` / `page_set_status` 变更内容
- 通过 `nav_get` / `nav_replace_items` / `nav_set` 处理导航
- 不直接编辑 `pages/*.json` 与 `navigation/*.json`

## 3. Claude Code

对 Claude Code，建议同样注册 `@anydocs/mcp` 的 `stdio` server，并在项目根目录生成 `Claude.md`。

初始化项目时：

```bash
pnpm --filter @anydocs/cli cli init ./workspace/my-docs --agent claude-code
```

或：

```bash
pnpm --filter @anydocs/cli cli project create ./workspace/my-docs --agent claude-code
```

这样项目会带上一份 `Claude.md`，内容与标准 guide 模板一致，但文件名更适合 Claude Code 的约定式读取。

## 4. guide 文件应该写什么

guide 文件不应该再重复完整数据模型细节；这些能力现在由 MCP 承担。

guide 文件应只强调：

- 什么时候优先使用 MCP
- 标准调用顺序
- 哪些文件不要直接改
- 哪些字段只能通过特定工具改
- MCP 校验错误不可绕过

## 5. 推荐默认工作流

无论是 Codex 还是 Claude Code，都推荐把下面流程作为默认执行策略：

1. `project_open(projectRoot)`
2. 必要时 `project_validate(projectRoot)`
3. `page_list` / `page_find` / `page_get`
4. `page_create` / `page_update` / `page_set_status`
5. `nav_get`
6. `nav_replace_items` 或 `nav_set`

## 6. 何时不要用 MCP

以下情况不要强行走 Anydocs MCP：

- 你在修改 Anydocs 仓库本身的实现代码
- 你在补测试、改 CLI、改 web UI
- 当前目标操作尚未被 MCP 工具覆盖

这些场景应使用普通代码编辑流程。
