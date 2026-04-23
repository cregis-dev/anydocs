# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Anydocs** is an AI-era documentation site editor with a local-first approach. It's designed to evolve from a single-project editor into a **multi-project documentation workspace**.

### Current Capabilities

The system consists of four main components:

1. **Docs Site** (Reading): GitBook-style reading experience at `/[lang]/docs/[...slug]`
   - Navigation, TOC, breadcrumbs, prev/next links
   - Internal search (build-time static index + `search-find` artifact, browser-side retrieval)
   - Only displays `status=published` pages

2. **Studio** (Local Editing): Notion-like editor at `/studio`
   - Three-column layout: navigation orchestration + Yoopta editor + metadata panel
   - Writes directly to the active project's filesystem (`<projectRoot>/pages/<lang>/`, `<projectRoot>/navigation/`)
   - Supports all page statuses (draft/in_review/published)
   - **Disabled in production** (returns 404)

3. **CLI** (`@anydocs/cli`, bin `anydocs`): Project lifecycle and authoring automation
   - `init`: Scaffold a new documentation project
   - `build`: Generate search indexes, `llms.txt`, and build artifacts under `dist/`
   - `preview`: Serve the built site / print entry URL
   - `studio`: Launch Studio pointed at a project directory
   - `project` (`create`|`inspect`|`validate`|`paths`): Inspect/validate project contract and paths
   - `page` (`list`|`get`|`find`): Read-side page queries
   - `nav get`: Read navigation document
   - `workflow inspect`: Inspect `anydocs.workflow.json`
   - `import` / `convert-import`: Stage and convert legacy Markdown/MDX docs

4. **MCP Server** (`@anydocs/mcp`, bin `anydocs-mcp`): Authoring MCP over **stdio** (`@modelcontextprotocol/sdk`)
   - 33 tools: `project_*` (9), `page_*` (18), `nav_*` (6) covering CRUD, batch, templates, translation, build, preview
   - Resources under `anydocs://` URIs: authoring guidance, templates, allowed block types, block examples
   - JSON-RPC only, **no HTTP transport**. Not currently mountable as a remote service without an adapter.

### Future Direction (vNext)

Upgrading to a **multi-project workspace**:
- Support opening and editing multiple documentation projects in parallel
- Each project maintains independent content, navigation, search index, llms.txt, and WebMCP outputs
- Project-level isolation for routing, building, and publishing

## Common Commands

### Development
```bash
pnpm install          # Install dependencies
pnpm dev              # Start development server (Next.js)
pnpm dev:desktop      # Start Tauri desktop app
```

### Build & Validation
```bash
pnpm build            # Full workspace build (pnpm -r build)
pnpm build:web        # Build Next.js app
pnpm build:cli        # Build @anydocs/cli
pnpm build:mcp        # Build @anydocs/mcp
pnpm build:desktop    # Build Tauri desktop app (web export + desktop-server + tauri)
pnpm typecheck        # TypeScript type checking (pnpm -r)
pnpm lint             # ESLint (pnpm -r)
pnpm test             # Regression gate: runs core + cli + mcp unit tests
pnpm test:web         # Web package tests
pnpm test:e2e:p0      # Critical-path Playwright gate
pnpm test:acceptance  # GitHub submission gate (pnpm test + test:e2e:p0)
pnpm test:full        # test + test:web
```
Note: there is no `pnpm check` script; use `pnpm typecheck && pnpm lint` (optionally with `pnpm test`) for a full local gate.

## Pre-GitHub Submission Gate

- Before any commit, push, or PR intended for GitHub, run the relevant automated tests locally.
- Minimum required gate for repository code changes: `pnpm test`
- If the change touches `packages/web`, Studio, reader routes, local APIs, build/preview flows, or other user-facing authoring behavior, also run `pnpm test:acceptance`.
- Do not submit to GitHub with known failing tests unless the user explicitly accepts the risk and the failing scope is documented in the handoff.

### CLI Commands
```bash
# Direct node execution (recommended in monorepo)
node --experimental-strip-types packages/cli/src/index.ts <command> [options]
# or after install:
pnpm --filter @anydocs/cli cli <command> [options]

# Project lifecycle
init     <targetDir> [--agent <codex|...>]
build    <targetDir> [--output <dir>] [--watch]
preview  <targetDir> [--watch]
studio   <targetDir> [--no-open]

# Project introspection
project create   <targetDir> [--project-id <id>]
project inspect  <targetDir> [--json]
project validate <targetDir>
project paths    <targetDir>

# Read-side queries
page list <targetDir> --lang <lang>
page get  <pageId>    <targetDir> --lang <lang>
page find <targetDir> --lang <lang> [--slug <slug>] [--tag <tag>]
nav  get  <targetDir> --lang <lang>
workflow inspect <targetDir>

# Legacy import
import         <sourceDir> <targetDir> [lang] [--convert]
convert-import <importId>  <targetDir>

# MCP server (separate package)
npx @anydocs/mcp            # starts stdio MCP server against cwd's project

# Common options
--output, -o <dir>    # Custom output directory (default: {targetDir}/dist)
--watch               # Watch for changes and rebuild
--json                # Structured JSON output
--target <dir>        # Alternative to positional <targetDir>

# Examples
node --experimental-strip-types packages/cli/src/index.ts build .
node --experimental-strip-types packages/cli/src/index.ts build . --output ./build-output
node --experimental-strip-types packages/cli/src/index.ts build . --watch
```

## Architecture

### Separation of Concerns

**IMPORTANT**: Anydocs follows a strict separation between tool code and documentation projects:

- **Anydocs Tool** (`/packages/`): The editor, CLI, and build system
- **Docs Projects** (`/content/projects/`): Pure content repositories
- **Build Artifacts** (`/dist/` or custom): Deployable static sites

### Project Structure

```
anydocs/                                     # Tool repository
├── packages/
│   ├── cli/                                 # @anydocs/cli — anydocs bin
│   ├── core/                                # @anydocs/core — shared types, fs repos, services
│   ├── mcp/                                 # @anydocs/mcp — stdio MCP server (anydocs-mcp bin)
│   ├── web/                                 # @anydocs/web — Next.js Studio & reader
│   ├── desktop/                             # @anydocs/desktop — Tauri app shell
│   └── desktop-server/                      # @anydocs/desktop-server — local HTTP server for Tauri
│
├── examples/                                # Sample projects (starter-docs, codex-authoring-docs,
│   │                                        #   codex-mcp-docs, openapi-reference-docs,
│   │                                        #   page-template-docs, import-staging-docs)
│   └── starter-docs/                        # Minimal reference project
│       ├── anydocs.config.json             # Project config (projectId, languages, site/theme)
│       ├── anydocs.workflow.json           # Workflow definition
│       ├── README.md
│       ├── pages/
│       │   ├── zh/*.json                   # doc-content-v1 blocks (JSON)
│       │   └── en/*.json
│       └── navigation/
│           ├── zh.json                     # Chinese nav tree
│           └── en.json                     # English nav tree
│
├── docs/                                    # Project-level docs (usage/developer guides)
├── artifacts/                               # BMAD planning artifacts (PRD, architecture, epics)
└── scripts/                                 # Repo-level scripts (dev-desktop, release-npm)

# Build output for a single project (written relative to that project, e.g. <projectRoot>/dist/)
dist/
├── build-manifest.json                     # Build metadata
├── <lang>/                                  # Per-language static reading site
├── assets/
│   ├── search-index.<lang>.json            # MiniSearch index
│   └── search-find.<lang>.json             # Retrieval artifact
├── mcp/
│   ├── index.json
│   ├── navigation.<lang>.json
│   └── pages.<lang>.json
└── llms.txt
```

**Notes:**
- There is **no** `content/projects/default/` at repo root. Each project is a standalone directory containing `anydocs.config.json`; the monorepo ships several under `examples/`.
- Project root is resolved by `@anydocs/core` `resolveProjectRoot(repoRoot, projectId)` and currently maps directly to the passed directory.
- The `@anydocs/web` app has its own `public/` directory used for local dev assets; Studio/reader read the active project via `packages/web/lib/docs/*`.

### Routes & Surfaces

HTTP routes (Next.js app under `packages/web/app/`):

| Route | Description | Environment |
|-------|-------------|-------------|
| `/` | Editor homepage → Studio | Development only |
| `/studio` | Studio editing interface | Development only |
| `/[lang]/docs/[[...slug]]` | Reading site (published only) | All environments |
| `/reference/...` | API reference pages | All environments |
| `/api/local/page` · `/pages` · `/navigation` · `/project` · `/api-sources` · `/preview` | Local read/write APIs used by Studio | Development only |
| `/api/docs/search-index` · `/api/docs/search-find` | Static search artifacts served for the reader | All environments |

**There is no `/api/mcp/*` HTTP endpoint.** MCP is exposed out-of-band:

- **Stdio MCP server**: `npx @anydocs/mcp` (or `packages/mcp/src/index.ts` in dev) — proper JSON-RPC over stdio via `@modelcontextprotocol/sdk`.
- **Static MCP artifacts**: `dist/.../mcp/{index,navigation.<lang>,pages.<lang>}.json` produced by `build` for consumers who only need read-only snapshots.

### Content Model

**Page JSON Structure** — canonical storage is the `doc-content-v1` block format, not raw Yoopta. Yoopta is only used as the Studio editor runtime, with `docContentToYoopta` / `yooptaToDocContent` converters in `@anydocs/core` bridging storage ↔ editor.

```json
{
  "id": "getting-started-intro",
  "lang": "zh",
  "slug": "getting-started/introduction",
  "title": "Introduction",
  "description": "...",
  "tags": ["GUIDE", "CORE"],
  "status": "draft" | "in_review" | "published",
  "updatedAt": "2026-03-08T00:00:00.000Z",
  "content": {
    "version": 1,
    "blocks": [
      { "type": "heading", "id": "block-1", "level": 1,
        "children": [{ "type": "text", "text": "..." }] }
    ]
  }
}
```

Allowed block types and marks are defined by the `doc-content-v1` schema and published as the `anydocs://content/allowed-types` MCP resource.

**Navigation Tree Structure:**
```json
{
  "version": 1,
  "items": [
    {
      "type": "section",
      "title": "GETTING STARTED",
      "children": [
        { "type": "page", "pageId": "getting-started-intro" },
        { "type": "folder", "title": "Advanced", "children": [...] }
      ]
    }
  ]
}
```

Supported node types: `section`, `folder`, `page`, `link`

### Key Libraries

- **Editor**: Yoopta (Slate-based block editor, Notion-like) — Studio-only runtime, storage is `doc-content-v1`
- **UI**: shadcn/ui (Radix UI + Tailwind CSS v4)
- **Search**: MiniSearch — build-time static index + `search-find` artifact, retrieved client-side
- **Framework**: Next.js 15 App Router
- **MCP**: `@modelcontextprotocol/sdk` (stdio transport)
- **Desktop**: Tauri + `@anydocs/desktop-server` (local HTTP bridge to the web app export)

### Data Flow

1. **Editing Flow** (Development):
   - Studio reads/writes via `/api/local/*` (Node.js filesystem), which wraps `@anydocs/core` repositories
   - Content written under `<projectRoot>/pages/<lang>/*.json` and `<projectRoot>/navigation/<lang>.json`
   - All page statuses visible in Studio

2. **MCP Authoring Flow**:
   - External AI agents spawn `anydocs-mcp` (stdio) and call `project_*` / `page_*` / `nav_*` tools
   - Same underlying `@anydocs/core` repositories as Studio — authoring guidance and templates delivered via `anydocs://` resources
   - No auth, no HTTP transport — designed for local/trusted agent contexts

3. **Build Flow**:
   - `anydocs build <targetDir>` (CLI) or `packages/web/scripts/gen-public-assets.mjs` (web build)
   - Input: `<projectRoot>/pages/<lang>/` + `<projectRoot>/navigation/`
   - Output: `<projectRoot>/dist/` — per-language reader, `assets/search-index.*.json`, `assets/search-find.*.json`, `mcp/*.json`, `llms.txt`, `build-manifest.json`
   - Only `status=published` pages included in build artifacts

4. **Reading Flow** (All Environments):
   - Docs site reads the active project via `packages/web/lib/docs/data.ts` (published-only filter)
   - Search index and `search-find` artifacts served at `/api/docs/search-*`

### Key Files & Directories

- **Docs Index**: `docs/README.md` (entrypoint for current documentation structure)
- **Architecture**: `artifacts/bmad/planning-artifacts/architecture.md` (planning and architectural decisions)
- **PRD**: `artifacts/bmad/planning-artifacts/prd.md` (product requirements)
- **Epics**: `artifacts/bmad/planning-artifacts/epics.md` (delivery breakdown)
- **Usage Manual**: `docs/usage-manual.md` (detailed operational guide)
- **Dev Guide**: `docs/developer-guide.md` (developer workflow guide)
- **Agent guidance**: `AGENTS.md` (mirrored into the MCP `anydocs://authoring/guidance` resource)
- **Core data layer**: `packages/core/src/fs/` — `docs-repository.ts`, `content-repository.ts`, `api-source-repository.ts`, `project-paths.ts`
- **Core services**: `packages/core/src/services/` — build, preview, authoring, markdown authoring, templates, legacy import, workflow sync
- **Core schemas**: `packages/core/src/schemas/` — `doc-content-v1` and related validators
- **Web data adapter**:
  - `packages/web/lib/docs/fs.ts` — Studio-side read/write wrapper over core repositories (also runs Yoopta ↔ doc-content conversion)
  - `packages/web/lib/docs/data.ts` — published-only data layer for the reader
- **Studio**: `packages/web/components/studio/` — Editor components (`local-studio-app.tsx`, `navigation-composer.tsx`, ...)
- **Reading Site**: `packages/web/app/[lang]/docs/[[...slug]]/page.tsx`
- **Local APIs**: `packages/web/app/api/local/*/route.ts`
- **Search API**: `packages/web/app/api/docs/search-index/`, `packages/web/app/api/docs/search-find/`
- **Build Script**: `packages/web/scripts/gen-public-assets.mjs` — generates static assets
- **MCP Server**: `packages/mcp/src/` — `server.ts`, `resources.ts`, `tools/{project,page,navigation}-tools.ts`

## Production Constraints (Critical)

**Security & Privacy:**
- `/` and `/studio` MUST return 404 in production
- `/api/local/*` MUST be disabled in production
- Build artifacts (`llms.txt`, `dist/.../mcp/*.json`, `assets/search-*.json`) MUST only derive from `status=published` content
- The stdio MCP server grants full read/write access to the project filesystem — treat it as local-trust only; do not expose it over a network without adding auth + a read-only tool profile
- Never expose `draft` or `in_review` pages to public consumers

**Git Management:**
- This project does NOT provide commit/review/publish APIs
- Users must use external Git tools for version control

## Content Constraints

### Minimal Block Set
Studio should restrict available Yoopta plugins to documentation essentials:
- `heading`, `paragraph`, `list`, `code`, `image`, `callout`, `table`, `divider`
- Avoid complex layout blocks to reduce export/index/render complexity

### Validation Requirements
- `slug` must be unique within each language
- `pageId` is consistent across languages (for i18n associations)
- Navigation references must point to valid `pageId` values
- Duplicate slug detection during save

## Workflow Examples

### Workflow A: Edit a sample project
```bash
pnpm install
pnpm --filter @anydocs/cli cli studio ./examples/starter-docs   # Launch Studio against that project
# Edit at http://localhost:3000/studio
pnpm --filter @anydocs/cli cli build ./examples/starter-docs    # Generate dist/ artifacts
```

### Workflow B: Create a new project
```bash
pnpm --filter @anydocs/cli cli init ./my-docs-project
pnpm --filter @anydocs/cli cli build ./my-docs-project
pnpm --filter @anydocs/cli cli preview ./my-docs-project
```

### Workflow C: Import legacy docs
```bash
pnpm --filter @anydocs/cli cli import ./legacy-docs ./my-docs-project zh
# Review import at <projectRoot>/imports/<importId>/
pnpm --filter @anydocs/cli cli convert-import <importId> ./my-docs-project
# Generated draft pages land under ./my-docs-project/pages/zh/
# Review and publish in Studio
```

### Workflow D: Drive authoring via MCP
```bash
# Most clients spawn the server themselves; run directly to sanity-check:
npx @anydocs/mcp                                  # from inside the project directory
# Then a client calls project_open, page_create, nav_insert, project_build, etc.
```

## Current Gaps

- **Data Layer**: `resolveProjectRoot()` currently returns the passed directory directly; multi-project in a single workspace is not yet modeled at the data layer
- **Studio**: Single-context only (`/studio`), no project switcher or session isolation
- **Routing**: Reader and local APIs assume one active project per server process
- **Validation**: Minimal block-set enforcement is schema-driven (doc-content-v1), but tooling to surface violations in Studio is still catching up
- **MCP as a service**: Stdio only — no HTTP transport, no auth, no pagination, no read-only tool profile; not ready for public/remote exposure without an adapter layer

For the current documentation map, see: `docs/README.md`
