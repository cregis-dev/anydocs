# Import Staging Example

This example is focused on the legacy Markdown import pipeline.

Use it when you want to inspect the staged import shape before `convert-import` turns items into canonical draft pages.

## What This Example Covers

- `legacy-docs/*.md`
- `imports/<importId>/manifest.json`
- `imports/<importId>/items/*.json`
- the handoff point into `convert-import`

## Quick Start

```bash
node --experimental-strip-types packages/cli/src/index.ts build examples/import-staging-docs
node --experimental-strip-types packages/cli/src/index.ts preview examples/import-staging-docs
node --experimental-strip-types packages/cli/src/index.ts convert-import legacy-2026-04-04-demo examples/import-staging-docs
```

The repository keeps this example in the pre-conversion staged state; the `convert-import` command above was verified locally and will generate draft pages plus `conversion-report.json`.
