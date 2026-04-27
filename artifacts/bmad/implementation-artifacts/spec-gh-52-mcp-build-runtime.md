---
title: 'Fix MCP project_build: declare @anydocs/cli dependency'
type: 'bugfix'
created: '2026-04-27'
status: 'done'
route: 'one-shot'
---

# Fix MCP project_build: declare @anydocs/cli dependency

## Intent

**Problem:** `project_build` in the MCP server fails with "Unable to locate the docs web runtime" when run via `npx @anydocs/mcp`, because `@anydocs/core` looks for the web runtime at `@anydocs/cli/docs-runtime`, but that package was not a declared dependency of `@anydocs/mcp` and thus not installed in the npx environment.

**Approach:** Add `@anydocs/cli` as an explicit dependency of `@anydocs/mcp`. This ensures the CLI (and its bundled `docs-runtime`) is co-installed whenever MCP is installed or run via npx, satisfying core's runtime lookup.

## Suggested Review Order

1. [packages/mcp/package.json](../../packages/mcp/package.json) — added `@anydocs/cli` to dependencies
