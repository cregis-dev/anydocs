---
title: 'Fix preview server startup timeout for webpack mode'
type: 'fix'
created: '2026-04-27'
status: 'done'
route: 'one-shot'
---

# Fix preview server startup timeout for webpack mode

## Intent

**Problem:** `anydocs preview` starts `next dev --webpack` (forced in PR #63 to work around Turbopack symlink crash on npm-installed CLI). Webpack initial compilation is significantly slower than Turbopack. The default `startTimeoutMs` of 30 seconds is too short; the dev server times out before it's ready, reporting as "preview failed".

**Approach:** Increase the default `startTimeoutMs` in `startDocsPreviewServer` from 30 s to 120 s — matching the studio command's `STUDIO_READY_TIMEOUT_MS`. Closes #62.

## Suggested Review Order

1. [packages/core/src/services/web-runtime-bridge.ts](../../packages/core/src/services/web-runtime-bridge.ts) — line 376: `30_000` → `120_000`
