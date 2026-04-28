# Deferred Work

Items deferred during quick-dev workflow sessions. Pick up in a future session.

---

## Deferred 2026-04-27 — GitHub Issues Backlog

Deferred when splitting from multi-issue intent. Resume by passing an issue number to `/bmad-quick-dev`.

### Bugs
- **#50** [Bug] anydocs preview / Studio 内置预览必崩：Turbopack panic - Symlink node_modules invalid
- **#51** [Bug] anydocs import 后页面静默不出现在构建结果，且 Studio 无审批入口
- **#52** [Bug] MCP project_build 工具报错：Unable to locate the docs web runtime
- **#53** [Bug] page_update_from_markdown 不解析内联 Markdown 语法（粗体/链接/行内代码）
- **#54** [Bug] page_update_from_markdown 将 Markdown --- 转为 paragraph 而非 divider 块

### Refactor
- Extract `tryOpenBrowser()` from `studio-command.ts` and `preview-command.ts` into a shared CLI utility (e.g., `packages/cli/src/utils/browser.ts`) to avoid maintenance duplication.
- Add setext heading support to `createMarkdownYooptaContent` in `markdown-content.ts`: currently `text\n---` produces `paragraph("text") + divider` instead of `heading`. The divider behavior (from #53/#54 fix) is semantically better than the previous `paragraph("---")`, but setext H2 headings are lost.
- Consider restructuring `toYooptaListItems` children array to avoid mixing inline leaf nodes and `list-item` block nodes — currently works due to `yooptaListItemInlineChildrenToCanonical`'s filter, but is an undocumented structural contract.

### Features
- **#56** [Feature] Studio 侧边栏页面缺少删除/重命名操作入口
- **#57** [Feature] Studio 页面切换不更新 URL，无法深链接到具体页面
- **#58** [Feature] anydocs studio 支持 --port 参数，避免随机端口
- **#60** [Feature] Studio 缺少页面状态管理 UI（draft / in_review / published）
- **#61** [UX] Studio 底部状态栏 "2 Issues" 徽章无任何说明和跳转
