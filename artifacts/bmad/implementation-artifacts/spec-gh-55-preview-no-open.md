---
title: 'Add --no-open flag to anydocs preview command'
type: 'feature'
created: '2026-04-27'
status: 'done'
route: 'one-shot'
---

# Add --no-open flag to anydocs preview command

## Intent

**Problem:** `anydocs preview` did not recognize `--no-open`, throwing "Unknown option" — and unlike `anydocs studio`, it never opened a browser after the server started, making the commands inconsistent.

**Approach:** Add `parsePreviewCommandArgs` with `--no-open` support; auto-open browser after preview server starts by default (`open=true`); suppress with `--no-open`. Mirrors the existing studio command pattern.

## Suggested Review Order

1. [packages/cli/src/commands/command-args.ts](../../packages/cli/src/commands/command-args.ts) — `PreviewCommandArgs` type + `parsePreviewCommandArgs`
2. [packages/cli/src/commands/preview-command.ts](../../packages/cli/src/commands/preview-command.ts) — `tryOpenBrowser` + `open` option wiring
3. [packages/cli/src/index.ts](../../packages/cli/src/index.ts) — switched `preview` case to use new parser
4. [packages/cli/src/help.ts](../../packages/cli/src/help.ts) — `--no-open` added to preview help text
