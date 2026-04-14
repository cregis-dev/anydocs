# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Anydocs** is an AI-era documentation site editor with a local-first approach. It's designed to evolve from a single-project editor into a **multi-project documentation workspace**.

### Current Capabilities

The system consists of three main components:

1. **Docs Site** (Reading): GitBook-style reading experience at `/[lang]/docs/[...slug]`
   - Navigation, TOC, breadcrumbs, prev/next links
   - Internal search (build-time static index with browser-based retrieval)
   - Only displays `status=published` pages

2. **Studio** (Local Editing): Notion-like editor at `/studio`
   - Three-column layout: navigation orchestration + Yoopta editor + metadata panel
   - Writes directly to local filesystem (`content/projects/*/pages/`, `navigation/`)
   - Supports all page statuses (draft/in_review/published)
   - **Disabled in production** (returns 404)

3. **CLI**: Project initialization, build, preview, and legacy import
   - `init`: Create new documentation projects
   - `build`: Generate search indexes, llms.txt, and MCP files
   - `preview`: Show entry URL for published content
   - `import`: Convert Markdown/MDX to Yoopta JSON

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
pnpm dev:desktop      # Start Electron desktop app
```

### Build & Validation
```bash
pnpm build            # Full workspace build
pnpm build:web        # Build Next.js app (includes gen:public)
pnpm build:cli        # Build CLI package
pnpm build:desktop    # Build Electron app
pnpm typecheck        # TypeScript type checking
pnpm lint             # ESLint
pnpm test             # Package-level regression gate
pnpm test:e2e:p0      # Critical-path Playwright gate
pnpm test:acceptance  # GitHub submission gate
pnpm check            # Full validation: gen:public + typecheck + lint
```

## Pre-GitHub Submission Gate

- Before any commit, push, or PR intended for GitHub, run the relevant automated tests locally.
- Minimum required gate for repository code changes: `pnpm test`
- If the change touches `packages/web`, Studio, reader routes, local APIs, build/preview flows, or other user-facing authoring behavior, also run `pnpm test:acceptance`.
- Do not submit to GitHub with known failing tests unless the user explicitly accepts the risk and the failing scope is documented in the handoff.

### CLI Commands
```bash
# Direct node execution (recommended in monorepo)
node --experimental-strip-types packages/cli/src/index.ts <command> [options]

# Project lifecycle
node --experimental-strip-types packages/cli/src/index.ts init <targetDir>
node --experimental-strip-types packages/cli/src/index.ts build <targetDir> [--output <dir>] [--watch]
node --experimental-strip-types packages/cli/src/index.ts preview <targetDir> [--watch]

# Build options
--output, -o <dir>   # Custom output directory (default: {targetDir}/dist)
--watch              # Watch for changes and rebuild

# Legacy import
node --experimental-strip-types packages/cli/src/index.ts import <sourceDir> <targetDir> [lang]
node --experimental-strip-types packages/cli/src/index.ts convert-import <importId> <targetDir>

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
│   ├── cli/                                 # CLI tool
│   ├── core/                                # Core library
│   ├── web/                                 # Next.js Studio & reader
│   └── desktop/                             # Electron app
│
└── content/projects/                        # Example docs projects
    └── default/                             # Demo project
        ├── anydocs.config.json             # Project config
        ├── anydocs.workflow.json           # Workflow definition
        ├── .gitignore                      # Ignores dist/, .anydocs/
        ├── README.md                       # Project documentation
        ├── pages/
        │   ├── zh/*.json                   # Chinese pages (Yoopta JSON)
        │   └── en/*.json                   # English pages
        ├── navigation/
        │   ├── zh.json                     # Chinese nav tree
        │   └── en.json                     # English nav tree
        └── imports/                        # Import staging area

dist/                                        # Build output (git-ignored)
└── projects/
    └── default/
        ├── build-manifest.json             # Build metadata
        ├── site/
        │   └── assets/
        │       ├── search-index.zh.json
        │       └── search-index.en.json
        ├── mcp/
        │   ├── index.json
        │   ├── navigation.*.json
        │   └── pages.*.json
        └── llms.txt
```
    ├── core/                                # Shared types & utilities
    ├── desktop/                             # Electron app
    └── web/                                 # Next.js web app
```

**Compatibility Notes:**
- Legacy flat paths (`public/llms.txt`, `public/search-index.*.json`, `public/mcp/*`) are generated for the default project
- Current implementation still has single-project constraints in routing and data layer

### Routes

| Route | Description | Environment |
|-------|-------------|-------------|
| `/` | Editor homepage → Studio | Development only |
| `/studio` | Studio editing interface | Development only |
| `/[lang]/docs/[...slug]` | Reading site (published only) | All environments |
| `/api/mcp/*` | Read-only WebMCP APIs | All environments |
| `/api/local/*` | Local write APIs | Development only |

### Content Model

**Page JSON Structure:**
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
    "yoopta": "...blocks..."
  }
}
```

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

- **Editor**: Yoopta (Slate-based block editor, Notion-like)
- **UI**: shadcn/ui (Radix UI + Tailwind CSS v4)
- **Search**: MiniSearch (build-time static index, client-side retrieval)
- **Framework**: Next.js 15 App Router

### Data Flow

1. **Editing Flow** (Development):
   - Studio reads/writes via `/api/local/*` (Node.js filesystem)
   - Content written to `content/projects/<projectId>/pages/` and `navigation/`
   - All page statuses visible in Studio

2. **Build Flow**:
   - CLI or build script generates static assets
   - Input: `content/projects/<projectId>/pages/` + `navigation/`
   - Output: `public/projects/<projectId>/` (search index, llms.txt, MCP files)
   - Only `status=published` pages included in build artifacts

3. **Reading Flow** (All Environments):
   - Docs site reads from `content/projects/<projectId>/pages/`
   - Filters to `status=published` only
   - MCP APIs serve only published content

### Key Files & Directories

- **Docs Index**: `docs/README.md` (entrypoint for current documentation structure)
- **Architecture**: `artifacts/bmad/planning-artifacts/architecture.md` (planning and architectural decisions)
- **PRD**: `artifacts/bmad/planning-artifacts/prd.md` (product requirements)
- **Epics**: `artifacts/bmad/planning-artifacts/epics.md` (delivery breakdown)
- **Usage Manual**: `docs/usage-manual.md` (detailed operational guide)
- **Dev Guide**: `docs/developer-guide.md` (developer workflow guide)
- **Data Layer**:
  - `packages/core/src/lib/docs/fs.ts` - Local read/write with validation
  - `packages/core/src/lib/docs/data.ts` - Published-only data layer
- **Studio**: `packages/web/src/components/studio/` - Editor components
- **Reading Site**: `packages/web/src/app/[lang]/docs/[[...slug]]/page.tsx`
- **Build Script**: `scripts/gen-public-assets.mjs` - Generate static assets
- **MCP APIs**: `packages/web/src/app/api/mcp/*` - Read-only endpoints

## Production Constraints (Critical)

**Security & Privacy:**
- `/` and `/studio` MUST return 404 in production
- `/api/local/*` MUST be disabled in production
- `/api/mcp/*`, `llms.txt`, and `public/mcp/*.json` MUST only expose `published` content
- Never expose `draft` or `in_review` pages to public

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

### Workflow A: Edit Default Project
```bash
pnpm install
pnpm dev                                          # Start Studio
# Edit in Studio at http://localhost:3000/studio
pnpm --filter @anydocs/cli cli build .        # Generate public assets
```

### Workflow B: Create New Project
```bash
pnpm --filter @anydocs/cli cli init ./my-docs-project
pnpm --filter @anydocs/cli cli build ./my-docs-project
pnpm --filter @anydocs/cli preview ./my-docs-project
```

### Workflow C: Import Legacy Docs
```bash
pnpm --filter @anydocs/cli cli import ./legacy-docs . zh
# Review import at content/projects/default/imports/<importId>/
pnpm --filter @anydocs/cli cli convert-import <importId> .
# Generated draft pages will be in content/projects/default/pages/zh/
# Review and publish in Studio
```

## Current Gaps (vs Multi-Project Target)

- **Data Layer**: `contentRoot()` currently fixed to `content/`, no `projectId` scoping
- **Studio**: Single-context only (`/studio`), no project selector or session isolation
- **Routing**: Reading site and APIs don't support project parameters
- **Build**: Search index, llms.txt, and MCP outputs not yet project-scoped
- **Validation**: Need to enforce minimal block set and add duplicate slug detection

For the current documentation map, see: `docs/README.md`

测试代码扫描
