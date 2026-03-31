# Anydocs Agent Guide

本文是给 AI agent 的轻量项目内指南。

如果你在 Codex、Claude Code 或其他支持 MCP 的 agent 环境中工作，请优先通过 `@anydocs/mcp` 操作 Anydocs 文档项目，而不是直接改写 `pages/*.json` 或 `navigation/*.json`。

## 1. 适用范围

这份指南只约束“文档项目内容 authoring”：

- 页面读取与查找
- 页面创建、更新、状态变更
- 导航读取与变更
- 项目 contract 校验

如果你在修改 Anydocs 工具仓库本身的源代码、测试、CLI 或 web UI，仍然使用正常的代码编辑流程。

## 2. 第一跳与能力发现

处理一个 Anydocs 文档项目时，默认把 `project_open(projectRoot)` 作为第一跳。

如果是本轮第一次使用 Anydocs MCP，或你不确定 server 当前暴露了哪些能力，再继续做 discovery：

1. `project_open(projectRoot)`
2. `listTools`
3. `listResources`
4. `listResourceTemplates`
5. 先看 `project_open.authoring`
6. 再按需读取 `anydocs://authoring/guidance`、`anydocs://templates/{templateId}`、`anydocs://blocks/{blockType}/example`

发现阶段的规则：

- 不要假设某个工具、resource 或 resourceTemplate 一定存在；先看运行时 discovery
- 如果 `project_open` 已经返回 `authoring.resources` 和 `authoring.resourceTemplates`，优先复用这些引用
- 如果你不确定某个操作有没有对应 MCP 工具，先看 `listTools`，不要靠记忆猜
- 如果你不确定页面模板、Yoopta block 示例或 authoring 约束，先看 `listResources` / `listResourceTemplates`
- 如果 server 暴露的能力与这份指南不完全一致，以运行时 discovery 结果为准
- 如果某个工具不存在，不要伪造调用；先退回到同等 MCP 能力，只有确认没有表达能力时才考虑直接改文件

## 3. 默认工作流

处理一个 Anydocs 文档项目时，默认按下面顺序执行：

1. `project_open(projectRoot)`
2. 必要时做 discovery：`listTools`、`listResources`、`listResourceTemplates`
3. 必要时读取 `anydocs://authoring/guidance`、相关 template resource 或 block example
4. 如果需要调整启用语言，调用 `project_set_languages(projectRoot, languages, defaultLanguage?)`
5. 如果项目状态不确定，或做了结构性变更，调用 `project_validate(projectRoot)`
6. 用 `page_list`、`page_find`、`page_get` 或 `nav_get` 读取现状，先确认目标对象存在且状态正确
7. 需要 richer 初稿时优先用 `page_create_from_template`
8. 需要按模板重整已有页面时优先用 `page_update_from_template`
9. 常规页面变更用 `page_create`、`page_update`、`page_delete`、`page_set_status`
10. 当 `page_update` 或 `page_batch_update` 改了 `content` 且需要同步 `render.markdown` / `render.plainText` 时，显式传 `regenerateRender: true`
11. 一次处理多页时优先用 `page_batch_create`、`page_batch_update`、`page_batch_set_status`
12. 导航优先用 `nav_insert`、`nav_delete`、`nav_move` 做细粒度变更；只有整体重排时再用 `nav_replace_items` 或 `nav_set`
13. 写入后重新读取目标页面或导航，确认结果与预期一致；必要时再次执行 `project_validate(projectRoot)`

## 4. 使用规则

- 始终显式传入 `projectRoot`
- 处理页面时始终显式传入 `lang`
- 先读目标，再写目标；不要在未确认现状前直接创建、覆盖、删除或移动
- 写入后必须重新读取目标对象做确认；不要假设写入一定成功
- 先看 `project_open` 返回的 `authoring` 能力与 resource 引用，再决定使用哪些 Yoopta block 或先读哪些 guidance/example resource
- 需要 guidance 或格式参考时，优先读 `anydocs://authoring/guidance`、`anydocs://templates/{templateId}`、`anydocs://blocks/{blockType}/example`
- 不要直接编辑 `pages/<lang>/*.json`
- 不要直接编辑 `navigation/*.json`
- 如果 MCP 返回 `VALIDATION_ERROR`，把它当作 Anydocs 的 canonical domain feedback，不要绕过它直接改文件
- 只有当 MCP 当前能力无法表达目标操作时，才退回到原始文件编辑；退回前先明确指出 MCP 缺口

## 5. 高影响操作

下面这些操作属于高影响或破坏性操作：

- `page_delete`
- `project_set_languages`
- `nav_set`
- `nav_replace_items`

处理这些操作时，遵守额外规则：

- 只有在用户意图明确时才执行，不要基于猜测主动做
- 执行前先读取现状，并说明会影响哪些页面、语言或导航结构
- 执行后必须重新读取并验证结果

## 6. Yoopta 写作规则

- 支持的 block 类型：`Paragraph`、`HeadingOne`、`HeadingTwo`、`HeadingThree`、`BulletedList`、`NumberedList`、`TodoList`、`Blockquote`、`Code`、`CodeGroup`、`Divider`、`Callout`、`Image`、`Table`、`Link`
- 支持的 marks：`bold`、`italic`、`underline`、`strike`、`code`
- `project_open.authoring.templates` 会返回当前推荐模板，默认包括 `concept`、`how_to`、`reference`
- 默认不要输出空 `content` 或伪结构，例如 `content: { blocks: [] }`
- 文档正文优先用 `HeadingTwo` / `HeadingThree` 建立层次，这样 reader 才能提取 TOC
- 只有在正文真的需要列表、提示、代码、表格、图片、链接时才插入对应 block，不要把页面堆成 block 展示墙
- `HeadingOne` 只在确实需要页面内主标题时使用；页面标题本身已经在 page metadata 中存在
- 多语言安装命令、不同 SDK 示例、多个包管理器命令，优先用 `CodeGroup`
- 说明性警告、提示、注意事项，优先用 `Callout`
- 简单过渡分隔才用 `Divider`，不要把它当成布局工具

## 7. 工具与约束

常见的 Anydocs MCP 能力包括：

- 项目：`project_open`、`project_set_languages`、`project_validate`
- resources：`anydocs://authoring/guidance`、`anydocs://templates/index`、`anydocs://yoopta/allowed-types`
- resourceTemplates：`anydocs://templates/{templateId}`、`anydocs://blocks/{blockType}/example`
- 页面：`page_list`、`page_get`、`page_find`、`page_create`、`page_update`、`page_delete`、`page_set_status`
- 模板化页面：`page_create_from_template`、`page_update_from_template`
- 批量页面：`page_batch_create`、`page_batch_update`、`page_batch_set_status`
- 导航：`nav_get`、`nav_insert`、`nav_delete`、`nav_move`、`nav_set`、`nav_replace_items`

约束：

- 以运行时 discovery 结果为准；不要把这份文档当成精确的工具清单
- `page_update` 只允许浅合并字段；不要用它改 `status`
- 状态变更必须使用 `page_set_status`
- `page_update` 和 `page_batch_update` 默认不会重算 `render`；如果这轮更新改了 `content`，且你希望 `render.markdown` / `render.plainText` 与正文同步，传 `regenerateRender: true`
- `project_set_languages` 必须传完整的启用语言集合；如果提供 `defaultLanguage`，它必须包含在 `languages` 中
- 批量页面工具会先整体校验，再批量写入
- MCP 会校验写入的 `content` 是否符合受支持的 Yoopta block 结构
- `nav_insert`、`nav_delete`、`nav_move` 使用 slash-separated 零基路径，例如 `0/1/2`

## 8. 何时直接改文件

只有下面两类情况才优先直接编辑文件：

- 你在修改 Anydocs 仓库本身的源码、测试或文档
- 目标操作当前没有 MCP 工具支持

如果你处理的是“文档项目内容”，默认先用 MCP。
