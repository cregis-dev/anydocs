---
title: 'Fix Markdown inline parsing and --- divider conversion'
type: 'bugfix'
created: '2026-04-27'
status: 'done'
route: 'one-shot'
---

# Fix Markdown inline parsing and --- divider conversion

## Intent

**Problem:** `page_update_from_markdown` (and related tools) produced two bugs: `---` was stored as literal paragraph text instead of a divider block (#54), and inline Markdown syntax (`**bold**`, `[link](url)`, `` `code` ``, `*italic*`) was stored as raw text strings instead of structured inline nodes (#53), causing Reader to display raw Markdown syntax.

**Approach:** Added `parseInlineMarkdown()` tokenizer in `markdown-content.ts` that converts inline tokens to Yoopta leaf/link nodes; updated all block constructors to use it. Added `toYooptaDividerBlock()` and thematic-break detection (`/^[-*_]{3,}\s*$/`) before the paragraph fallback.

## Design Notes

Known limitation: nested `**[bold link](url)**` — the bold wrapper is applied but the inner link is not parsed as a link node (stored as bold text). Setext headings (`text\n---`) produce `paragraph + divider` — a pre-existing gap since setext headings were never supported.

## Suggested Review Order

1. [packages/core/src/utils/markdown-content.ts](../../packages/core/src/utils/markdown-content.ts) — `parseInlineMarkdown`, `toYooptaDividerBlock`, updated block constructors, divider detection in main loop
