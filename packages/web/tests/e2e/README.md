# Studio Regression Tests

This directory holds the Playwright layer for repository acceptance checks. It is intentionally split between:

- shell and authoring journeys that exercise the Studio UI
- local API contract checks that verify the browser-facing filesystem bridge
- shared helpers under `tests/e2e/support/`

## Test Structure

```text
tests/e2e/
├── support/
│   └── studio.ts
├── blueprint-review-reader.spec.ts
├── studio-navigation-operations.spec.ts
├── studio.spec.ts
├── studio-authoring-flow.spec.ts
├── studio-local-api.spec.ts
├── studio-page-operations.spec.ts
├── studio-workflow-smoke.spec.ts
├── studio-yoopta-blocks.spec.ts
└── README.md
```

## Prerequisites

1. Install Playwright browsers:

```bash
pnpm --filter @anydocs/web exec playwright install chromium
```

2. Start a Studio runtime only if you want to reuse an already running instance. In practice this usually means a CLI Studio server:

```bash
pnpm --filter @anydocs/cli cli studio examples/starter-docs
```

## Commands

Run the full Playwright suite:

```bash
pnpm --filter @anydocs/web test:e2e
```

Run the critical-path gate used for delivery acceptance:

```bash
pnpm --filter @anydocs/web test:e2e:p0
```

Run only the local API contract regression:

```bash
pnpm --filter @anydocs/web test:api
```

Run a single spec:

```bash
npx playwright test tests/e2e/studio-authoring-flow.spec.ts
```

Run the Blueprint reader regression against an explicit preview:

```bash
ANYDOCS_DOCS_PROJECT_ROOT=/Users/shawn/workspace/code/anydocs/examples/page-template-docs node packages/web/scripts/gen-public-assets.mjs preview --hostname 127.0.0.1 --port 4010
STUDIO_SKIP_WEBSERVER=1 DOCS_PREVIEW_URL=http://127.0.0.1:4010/en/blueprint-review npx playwright test tests/e2e/blueprint-review-reader.spec.ts
```

Open Playwright UI:

```bash
pnpm --filter @anydocs/web test:ui
```

## Coverage Model

`@p0`

- welcome-screen entry into Studio
- open external project
- create, edit, publish, and delete pages in Studio
- create and edit navigation groups and external links
- preview/build flows and generated artifact checks
- supported Yoopta block regression coverage for seeded documents
- local authoring API contract checks

`@p1`

- explicit preview smoke checks
- structured error handling for missing pages

## Environment Variables

| Variable | Default | Description |
| --- | --- | --- |
| `STUDIO_URL` | `http://127.0.0.1:3000` | Base URL for the local Studio server |
| `ANYDOCS_E2E_PROJECT_ROOT` | `packages/.tmp/playwright-anydocs-project` equivalent under repo root | External project root used by the tests |
| `DOCS_PREVIEW_URL` | unset | Optional explicit reader preview URL for smoke validation |
| `STUDIO_SKIP_WEBSERVER` | unset | Reuse an already running Studio server when set to `1` |

## Notes

- The support layer is based on stable `data-testid` hooks rather than CSS selectors.
- Browser tests intentionally avoid page-object indirection and keep assertions explicit in the spec bodies.
- `studio-local-api.spec.ts` uses Playwright's `request` fixture so API regressions can be caught without a full browser journey.
- By default the Playwright config starts `pnpm dev` automatically; set `STUDIO_SKIP_WEBSERVER=1` only when you are intentionally reusing an existing server.
- The default Playwright web server behavior depends on `ANYDOCS_E2E_STUDIO_MODE`: `cli` starts the CLI Studio helper, otherwise it falls back to plain `pnpm dev` for standalone 404 assertions.
- `blueprint-review-reader.spec.ts` is an explicit preview smoke test for reader-only routes, so it expects `DOCS_PREVIEW_URL` to point at a running docs preview.
