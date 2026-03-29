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

如果你在修改工具仓库本身并涉及 release、发包、版本号或 tag，先阅读仓库根目录的 `RELEASE.md`，再执行相关操作。

## 2. 能力发现

第一次连接 Anydocs MCP server 时，不要假设当前暴露了哪些工具、resources 或 resourceTemplates。先做一轮 discovery，再决定如何执行。

推荐顺序：

1. 先执行 `listTools`
2. 再执行 `listResources`
3. 再执行 `listResourceTemplates`
4. 先读 `anydocs://authoring/guidance`
5. 再调用 `project_open(projectRoot)`

发现阶段的规则：

- 如果你不确定某个操作有没有对应 MCP 工具，先看 `listTools`，不要靠记忆猜
- 如果你不确定页面模板、Yoopta block 示例或 authoring 约束，先看 `listResources` / `listResourceTemplates`
- 如果 `project_open` 已经返回 `authoring.resources` 和 `authoring.resourceTemplates`，优先复用这些引用继续 discovery
- 如果 server 暴露的能力与这份指南不完全一致，以运行时 discovery 结果为准
- 如果某个工具不存在，不要伪造调用；先退回到同等 MCP 能力，只有确认没有表达能力时才考虑直接改文件

## 3. 默认工作流

处理一个 Anydocs 文档项目时，默认按下面顺序执行：

1. 先做 discovery：`listTools`、`listResources`、`listResourceTemplates`
2. 读 `anydocs://authoring/guidance`
3. 调用 `project_open(projectRoot)`
4. 如果需要调整启用语言，调用 `project_set_languages(projectRoot, languages, defaultLanguage?)`
5. 如果项目状态不确定，先调用 `project_validate(projectRoot)`
6. 用 `page_list`、`page_find` 或 `page_get` 读取现状
7. 如果要从结构化输入生成更像样的富文本正文，优先用 `page_create_from_template`
8. 如果要按模板重整已有页面，优先用 `page_update_from_template`
9. 用 `page_create`、`page_update`、`page_delete`、`page_set_status` 执行页面变更
10. 当 `page_update` 或 `page_batch_update` 改了 `content` 且需要同步 `render.markdown` / `render.plainText` 时，显式传 `regenerateRender: true`
11. 如果要一次处理多页，优先用 `page_batch_create`、`page_batch_update`、`page_batch_set_status`
12. 用 `nav_get` 读取导航
13. 优先用 `nav_insert`、`nav_delete`、`nav_move` 做细粒度导航变更
14. 只有在需要整体重排时再用 `nav_replace_items` 或 `nav_set`

## 4. 使用规则

- 始终显式传入 `projectRoot`
- 处理页面时始终显式传入 `lang`
- 如果是本轮第一次使用 Anydocs MCP，先完成 discovery，再进入读写流程
- 先看 `project_open` 返回的 `authoring` 能力与 resource 引用，再决定使用哪些 Yoopta block 或先读哪些 guidance/example resource
- 需要 guidance 或格式参考时，先读 `anydocs://authoring/guidance`、`anydocs://templates/{templateId}`、`anydocs://blocks/{blockType}/example`
- 不要直接编辑 `pages/<lang>/*.json`
- 不要直接编辑 `navigation/*.json`
- 只有当 MCP 当前能力无法表达目标操作时，才退回到原始文件编辑
- 如果 MCP 返回 `VALIDATION_ERROR`，把它当作 Anydocs 的 canonical domain feedback，不要绕过它直接改文件

## 5. Yoopta 写作规则

- 支持的 block 类型：`Paragraph`、`HeadingOne`、`HeadingTwo`、`HeadingThree`、`BulletedList`、`NumberedList`、`TodoList`、`Blockquote`、`Code`、`CodeGroup`、`Divider`、`Callout`、`Image`、`Table`、`Link`
- 支持的 marks：`bold`、`italic`、`underline`、`strike`、`code`
- `project_open.authoring.templates` 会返回当前推荐模板，默认包括 `concept`、`how_to`、`reference`
- 默认不要输出空 `content` 或伪结构，例如 `content: { blocks: [] }`
- 文档正文优先用 `HeadingTwo` / `HeadingThree` 建立层次，这样 reader 才能提取 TOC
- 只有在正文真的需要列表、提示、代码、表格、图片、链接时才插入对应 block，不要所有页面都堆满组件
- `HeadingOne` 只在确实需要页面内主标题时使用；页面标题本身已经在 page metadata 中存在
- 多语言安装命令、不同 SDK 示例、多个包管理器命令，优先用 `CodeGroup`
- 说明性警告、提示、注意事项，优先用 `Callout`
- 简单过渡分隔才用 `Divider`，不要把它当成布局工具

## 6. 工具约束

当前可用的 Anydocs MCP 工具：

- `project_open`
- `project_set_languages`
- `project_validate`
- resource: `anydocs://authoring/guidance`
- resource: `anydocs://templates/index`
- resource: `anydocs://yoopta/allowed-types`
- resourceTemplate: `anydocs://templates/{templateId}`
- resourceTemplate: `anydocs://blocks/{blockType}/example`
- `page_list`
- `page_get`
- `page_find`
- `page_batch_create`
- `page_create`
- `page_create_from_template`
- `page_update_from_template`
- `page_batch_update`
- `page_delete`
- `page_update`
- `page_batch_set_status`
- `page_set_status`
- `nav_insert`
- `nav_delete`
- `nav_move`
- `nav_get`
- `nav_set`
- `nav_replace_items`

其中：

- `page_update` 只允许浅合并这些字段：`slug`、`title`、`description`、`tags`、`content`、`render`、`review`
- `page_create_from_template` 会根据模板输入生成 `content` + `render`，适合从 summary / sections / steps 创建 richer 页面
- `page_update_from_template` 会基于模板重写已有页面的 `content` + `render`，适合把简单旧页重整成更完整的结构
- `page_update` 和 `page_batch_update` 默认不会重算 `render`；如果这轮更新改了 `content`，且你希望 `render.markdown` / `render.plainText` 与正文同步，传 `regenerateRender: true`
- `project_set_languages` 必须传完整的启用语言集合；如果提供 `defaultLanguage`，它必须包含在 `languages` 中
- 批量页面工具会先整体校验，再批量写入
- MCP 会校验写入的 `content` 是否符合受支持的 Yoopta block 结构
- 状态变更必须使用 `page_set_status`，不要通过 `page_update` 改 `status`
- 删除页面时优先用 `page_delete`，不要直接删除 `pages/<lang>/*.json`
- `nav_insert`、`nav_delete`、`nav_move` 使用 slash-separated 零基路径，例如 `0/1/2`
- 需要整体替换导航文档时用 `nav_set`
- 只改顶层 `navigation.items` 时优先用 `nav_replace_items`

## 7. 何时直接改文件

只有下面两类情况才优先直接编辑文件：

- 你在修改 Anydocs 仓库本身的源码、测试或文档
- 目标操作当前没有 MCP 工具支持

如果你处理的是“文档项目内容”，默认先用 MCP。
