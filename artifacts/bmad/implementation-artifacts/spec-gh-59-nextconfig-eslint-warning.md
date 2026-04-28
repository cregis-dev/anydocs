---
title: 'Remove deprecated eslint config from next.config.mjs'
type: 'bugfix'
created: '2026-04-27'
status: 'done'
route: 'one-shot'
---

# Remove deprecated eslint config from next.config.mjs

## Intent

**Problem:** `next.config.mjs` contained an `eslint.ignoreDuringBuilds` field that Next.js 15+ no longer supports, causing warning noise on every `anydocs build` and `anydocs studio` invocation.

**Approach:** Remove the 3-line `eslint` block. In Next.js 16, ESLint is not run during `next build` by default — the key was already a no-op, so removal causes no behavioral change.

## Suggested Review Order

1. [packages/web/next.config.mjs](../../packages/web/next.config.mjs) — removed eslint block
