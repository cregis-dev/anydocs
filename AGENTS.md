# AGENTS.md

This file provides guidance to Codex when working in this repository.

## Project Overview

**Anydocs** is a local-first documentation editor made of three main surfaces:

1. **Studio**: the authoring UI for editing project configuration, navigation, and page content.
2. **Docs Reader**: the published-content reading site.
3. **CLI**: the project init/build/preview/import toolchain.

The codebase still carries some future-facing multi-project concepts, but the current implementation is centered on opening one docs project root at a time.

## Current Capabilities

### Studio

- Primary routes: `/` and `/studio`
- Intended runtime: local development and desktop runtime
- UI shape: navigation + editor + metadata/settings workflow
- Data access: `/api/local/*` in web dev, or Electron IPC in desktop runtime
- Supports all authoring states: `draft`, `in_review`, `published`

### Docs Reader

- Canonical routes: `/{lang}` and `/{lang}/{slug}`
- Compatibility redirects still exist at `/docs/*` and `/{lang}/docs/*`
- Only published content is exposed to the reader
- Search uses static indexes generated during build
- Reader routes are available in production and CLI preview/export runtime
- Reader routes are not available in plain `pnpm dev`

### CLI

- Primary commands: `init`, `build`, `preview`, `import`, `convert-import`
- Recommended invocation in this monorepo: `pnpm --filter @anydocs/cli cli <command>`
- Direct entrypoint also works: `node --experimental-strip-types packages/cli/src/index.ts <command>`
- `preview` already runs live; `--watch` is a compatibility flag

## Common Commands

### Development

```bash
pnpm install
pnpm dev
pnpm dev:desktop
```

### Build, Lint, and Tests

```bash
pnpm build
pnpm build:web
pnpm build:cli
pnpm build:desktop
pnpm typecheck
pnpm lint
pnpm test
pnpm test:e2e:p0
pnpm test:acceptance
pnpm test:web
pnpm test:full
```

## Pre-GitHub Submission Gate

- Before any commit, push, or PR intended for GitHub, run the relevant automated tests locally.
- Minimum required gate for repository code changes: `pnpm test`
- If the change touches `packages/web`, Studio, reader routes, local APIs, build/preview flows, or other user-facing authoring behavior, also run: `pnpm test:acceptance`
- Do not submit to GitHub with known failing tests unless the user explicitly accepts the risk and the failing scope is documented in the handoff.

### CLI Commands

```bash
pnpm --filter @anydocs/cli cli init [targetDir]
pnpm --filter @anydocs/cli cli build [targetDir] [--output <dir>] [--watch]
pnpm --filter @anydocs/cli cli preview [targetDir] [--watch]
pnpm --filter @anydocs/cli cli import <sourceDir> [targetDir] [lang]
pnpm --filter @anydocs/cli cli convert-import <importId> [targetDir]
pnpm --filter @anydocs/cli cli help [command]
pnpm --filter @anydocs/cli cli version
```

## Architecture

### Separation of Concerns

- **Tooling repo**: this repository contains the editor, CLI, desktop shell, and shared build/runtime logic
- **Docs project**: a separate project root containing `anydocs.config.json`, `pages/`, `navigation/`, and related source files
- Newly initialized projects may also include `skill.md` as an AI-facing helper document
- **Artifacts**: build output written to the configured output directory, defaulting to `<projectRoot>/dist`

### Project Structure

```text
anydocs/
├── packages/
│   ├── cli/
│   ├── core/
│   ├── desktop/
│   └── web/
├── examples/
│   └── demo-docs/
│       ├── anydocs.config.json
│       ├── anydocs.workflow.json
│       ├── pages/
│       ├── navigation/
│       ├── imports/
│       └── dist/
│           ├── index.html
│           ├── llms.txt
│           ├── search-index.en.json
│           ├── search-index.zh.json
│           ├── mcp/
│           ├── en/
│           ├── zh/
│           └── docs/
└── docs/
```

### Routes

| Route | Description | Runtime |
|-------|-------------|---------|
| `/` | Studio home; redirects to default docs language in CLI docs runtime | Dev / desktop / CLI docs runtime |
| `/studio` | Studio authoring interface | Dev / desktop |
| `/docs/[...slug]` | Redirects to the default language reader route | Reader runtime |
| `/[lang]` | Canonical language landing route for the reader | Reader runtime |
| `/[lang]/[...slug]` | Canonical published docs reader route | Reader runtime |
| `/[lang]/docs/[...slug]` | Compatibility redirect to `/{lang}/...` | Reader runtime |
| `/api/local/*` | Local filesystem-backed Studio APIs | Local web dev only in intended deployments |

### Content Model

**Page JSON**

```json
{
  "id": "welcome",
  "lang": "en",
  "slug": "welcome",
  "title": "Welcome",
  "description": "Starter page created by anydocs init.",
  "status": "draft" | "in_review" | "published",
  "tags": ["GUIDE"],
  "updatedAt": "2026-03-18T00:00:00.000Z",
  "content": {},
  "render": {
    "markdown": "# Welcome",
    "plainText": "Welcome"
  }
}
```

**Navigation JSON**

```json
{
  "version": 1,
  "items": [
    {
      "type": "section",
      "title": "Getting Started",
      "children": [
        { "type": "page", "pageId": "welcome" }
      ]
    }
  ]
}
```

Supported navigation node types: `section`, `folder`, `page`, `link`

### Key Libraries

- **Editor**: Yoopta
- **UI**: Radix + shadcn/ui + Tailwind CSS v4
- **Search**: MiniSearch static indexes
- **Framework**: Next.js 16 App Router
- **Desktop shell**: Electron

### Data Flow

1. **Authoring**
   - Studio reads and writes canonical source files from the selected project root.
   - Web dev uses `/api/local/*`; desktop runtime uses IPC.
   - All page statuses remain visible in Studio.

2. **Build**
   - CLI `build` validates source files and emits static artifacts.
   - Output defaults to `<projectRoot>/dist`, or `--output <dir>` when provided.
   - The artifact structure is flat, with `llms.txt`, `search-index.<lang>.json`, `mcp/`, and language route directories written directly under the output root.
   - Only `published` pages are promoted into reader/search/LLM artifacts.

3. **Preview / Reader**
   - CLI `preview` starts a local reader runtime for the chosen project root.
   - Reader pages resolve the project from CLI runtime env or preview cookies.
   - The reader never serves `draft` or `in_review` pages.

## Key Files and Directories

- `README.md`: repository overview
- `docs/README.md`: docs index
- `artifacts/bmad/planning-artifacts/architecture.md`: architecture decisions and planning context
- `artifacts/bmad/planning-artifacts/prd.md`: product requirements
- `artifacts/bmad/planning-artifacts/epics.md`: delivery breakdown
- `packages/web/lib/docs/fs.ts`: Studio-side filesystem bridge
- `packages/web/lib/docs/data.ts`: published reader data/runtime selection
- `packages/web/app/[lang]/[...slug]/page.tsx`: canonical reader page
- `packages/web/app/[lang]/docs/[[...slug]]/page.tsx`: compatibility redirect route
- `packages/web/app/docs/[[...slug]]/page.tsx`: default-language redirect route
- `packages/web/components/studio/`: Studio UI
- `packages/core/src/publishing/build-artifacts.ts`: static artifact writer

## Runtime and Security Constraints

- In hosted web production, `/` and `/studio` should not expose the Studio unless explicitly running in desktop runtime.
- `/api/local/*` is a local-authoring surface and should not be exposed as a public deployment API.
- `llms.txt`, search indexes, and `mcp/` artifacts must remain `published`-only.
- Never expose `draft` or `in_review` pages through public reader or machine-readable outputs.

## Editing Constraints

### Studio Block Set

The current Studio editor setup includes these document-oriented Yoopta blocks:

- `paragraph`
- `heading` (H1/H2/H3)
- `blockquote`
- `list` (bulleted, numbered, todo)
- `code` and `code-group`
- `image`
- `table`
- `callout`
- `divider`
- `link`

Inline marks currently enabled:

- `bold`
- `italic`
- `underline`
- `strike`
- `code`

Avoid expanding the editor toward layout-heavy page-builder behavior unless the task explicitly requires it.

### Validation Expectations

- `slug` must be unique within a language
- page references in navigation must resolve to existing `pageId`s
- enabled languages must have both `pages/<lang>/` and `navigation/<lang>.json`
- only `published` content may enter build artifacts

## Workflow Examples

### Open the Demo Project in Studio

```bash
pnpm install
pnpm dev
```

Then open `http://localhost:3000/studio` and select `examples/demo-docs` as the demo project path.

### Create a New Project

```bash
pnpm --filter @anydocs/cli cli init ./my-docs-project
pnpm --filter @anydocs/cli cli preview ./my-docs-project
pnpm --filter @anydocs/cli cli build ./my-docs-project
```

### Import Legacy Markdown

```bash
pnpm --filter @anydocs/cli cli import ./legacy-docs ./my-docs-project zh
pnpm --filter @anydocs/cli cli convert-import <importId> ./my-docs-project
```

## Known Gaps

- Project-scoped web routes are not implemented; reader/project selection still depends on runtime env or preview cookie context.
- Multi-project workspace support is not yet a first-class routing/build abstraction.
- `/api/local/*` exists as a local surface, but production exposure relies on deployment discipline rather than a dedicated route-level rejection layer.
