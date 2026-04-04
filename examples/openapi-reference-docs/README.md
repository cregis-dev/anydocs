# OpenAPI Reference Example

This example is focused on Anydocs API source support.

Use it when you want a self-contained project that turns a local OpenAPI file into published reference artifacts and reference routes.

## What This Example Covers

- `api-sources/*.json`
- local file-based OpenAPI sources
- published API reference routes
- `dist/mcp/openapi/*` and `llms-openapi.txt`

## Quick Start

```bash
node --experimental-strip-types packages/cli/src/index.ts build examples/openapi-reference-docs
node --experimental-strip-types packages/cli/src/index.ts preview examples/openapi-reference-docs
```

Then open the reader route for `/en/reference/petstore` or `/zh/reference/petstore-zh`.
