# Anydocs Agent Guide

本文是给 AI agent 的轻量项目内指南。

如果你在 Codex、Claude Code 或其他支持 MCP 的 agent 环境中工作，请优先通过 `@anydocs/mcp` 操作 Anydocs 文档项目，而不是直接改写 `pages/*.json` 或 `navigation/*.json`。

## 1. 适用范围

这份指南只约束“文档项目内容 authoring”：

- 页面读取与查找
- 页面创建、更新、状态变更
- 导航读取
- 项目 contract 校验

如果你在修改 Anydocs 工具仓库本身的源代码、测试、CLI 或 web UI，仍然使用正常的代码编辑流程。

## 2. 默认工作流

处理一个 Anydocs 文档项目时，默认按下面顺序执行：

1. 调用 `project_open(projectRoot)`
2. 如果项目状态不确定，先调用 `project_validate(projectRoot)`
3. 用 `page_list`、`page_find` 或 `page_get` 读取现状
4. 用 `page_create`、`page_update`、`page_set_status` 执行页面变更
5. 用 `nav_get` 检查导航状态

## 3. 使用规则

- 始终显式传入 `projectRoot`
- 处理页面时始终显式传入 `lang`
- 不要直接编辑 `pages/<lang>/*.json`
- 不要直接编辑 `navigation/*.json`
- 只有当 MCP 当前能力无法表达目标操作时，才退回到原始文件编辑
- 如果 MCP 返回 `VALIDATION_ERROR`，把它当作 Anydocs 的 canonical domain feedback，不要绕过它直接改文件

## 4. 工具约束

当前可用的 Anydocs MCP 工具：

- `project_open`
- `project_validate`
- `page_list`
- `page_get`
- `page_find`
- `page_create`
- `page_update`
- `page_set_status`
- `nav_get`

其中：

- `page_update` 只允许浅合并这些字段：`slug`、`title`、`description`、`tags`、`content`、`render`、`review`
- 状态变更必须使用 `page_set_status`，不要通过 `page_update` 改 `status`

## 5. 何时直接改文件

只有下面两类情况才优先直接编辑文件：

- 你在修改 Anydocs 仓库本身的源码、测试或文档
- 目标操作当前没有 MCP 工具支持

如果你处理的是“文档项目内容”，默认先用 MCP。
