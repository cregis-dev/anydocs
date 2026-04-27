---
title: 'Fix preview crash: switch from Turbopack to webpack'
type: 'bugfix'
created: '2026-04-27'
status: 'done'
route: 'one-shot'
---

# Fix preview crash: switch from Turbopack to webpack

## Intent

**Problem:** `anydocs preview` crashed immediately with "FATAL: An unexpected Turbopack error occurred. Symlink node_modules is invalid" because the preview server used Next.js default (Turbopack), which cannot resolve symlinked node_modules in the CLI runtime layout.

**Approach:** Add `--webpack` to the Next.js dev spawn args in `runPreviewProxy()`, matching the flag already used by the studio command.

## Suggested Review Order

1. [packages/web/scripts/gen-public-assets.mjs](../../packages/web/scripts/gen-public-assets.mjs) — `--webpack` added to preview spawn args
