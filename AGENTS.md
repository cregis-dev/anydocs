# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project Overview

**Anydocs** is an AI-era documentation site editor with a local-first approach. It's designed to evolve from a single-project editor into a **multi-project documentation workspace**.

### Current Capabilities

The system consists of three main components:

1. **Docs Site**: the reading site built from edited documentation structure and theme.
   - Route shape: `/[lang]/docs/[...slug]`
   - Navigation, TOC, breadcrumbs, prev/next links
   - Internal search via build-time static indexes
   - Only displays `status=published` pages
   - Current code disables Docs Site routes outside production

2. **Studio**: the project's editing feature for visual document editing and structure orchestration.
   - Route: `/studio`
   - Three-column layout: navigation orchestration + Yoopta editor + metadata panel
   - Reads/writes project files through `/api/local/*`
   - Supports all page statuses (draft/in_review/published)
   - Includes recent-project and local-folder opening flows
   - Disabled in production

3. **CLI**: the command-line tool centered on building Docs Site artifacts.
   - Primary command: `build`
   - Supporting commands: `init`, `preview`, `import`, `convert-import`
   - Produces search indexes, `llms.txt`, and WebMCP static artifacts

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
pnpm check            # Full validation: gen:public + typecheck + lint
```

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
node --experimental-strip-types packages/cli/src/index.ts build . --output /var/www/docs
node --experimental-strip-types packages/cli/src/index.ts build . --watch
```

## Architecture

### Separation of Concerns

**IMPORTANT**: Anydocs follows a strict separation between tool code and documentation projects:

- **Anydocs Tool** (`/packages/`): The editor, CLI, and build system
- **Docs Projects**: Independent project directories, or workspace-style projects under `content/projects/{projectId}/`
- **Build Artifacts** (`/dist/` or custom): Deployable static sites

### Project Structure

```text
anydocs/                                     # Tool repository
├── packages/
│   ├── cli/                                 # CLI tool
│   ├── core/                                # Core library
│   ├── web/                                 # Next.js Studio + Docs Site
│   └── desktop/                             # Electron app
├── examples/
│   └── demo-docs/                           # Example independent docs project
│       ├── anydocs.config.json
│       ├── anydocs.workflow.json
│       ├── pages/
│       ├── navigation/
│       ├── imports/
│       └── dist/
│           ├── build-manifest.json
│           └── projects/default/
│               ├── llms.txt
│               ├── mcp/
│               └── site/assets/
└── docs/                                    # Project documentation
```

**Compatibility Notes:**
- Legacy flat paths (`public/llms.txt`, `public/search-index.*.json`, `public/mcp/*`) are generated for the default project
- Current implementation still has single-project constraints in public routing and HTTP surfaces

### Routes

| Route | Description | Environment |
|-------|-------------|-------------|
| `/` | Editor homepage → Studio | Development only |
| `/studio` | Studio editing interface | Development only |
| `/[lang]/docs/[...slug]` | Docs Site reading route (published only) | Production / preview context |
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
   - Content written to a project's `pages/` and `navigation/`
   - All page statuses visible in Studio

2. **Build Flow**:
   - CLI `build` is the primary artifact-generation path
   - Input: project `pages/` + `navigation/`
   - Output: `{projectRoot}/dist/projects/<projectId>/` (search indexes, `llms.txt`, WebMCP artifacts)
   - Only `status=published` pages included in build artifacts

3. **Reading Flow**:
   - Docs Site reads from the selected project context
   - Filters to `status=published` only
   - Search UI consumes generated static search indexes

### Key Files & Directories

- **Docs Index**: `docs/README.md` (entrypoint for current documentation structure)
- **Architecture**: `docs/planning-artifacts/architecture.md` (planning and architectural decisions)
- **PRD**: `docs/planning-artifacts/prd.md` (product requirements)
- **Epics**: `docs/planning-artifacts/epics.md` (delivery breakdown)
- **Usage Manual**: `docs/04-usage-manual.md` (detailed operational guide)
- **Dev Guide**: `docs/05-dev-guide.md` (developer workflow guide)
- **Data Layer**:
  - `packages/web/lib/docs/fs.ts` - Studio-side local read/write bridge
  - `packages/web/lib/docs/data.ts` - Published-only Docs Site data layer
- **Studio**: `packages/web/components/studio/` - Editor components
- **Reading Site**: `packages/web/app/[lang]/docs/[[...slug]]/page.tsx`
- **Build Script**: `packages/web/scripts/gen-public-assets.mjs` - Generate default-project public assets for the web app

## Production Constraints (Critical)

**Security & Privacy:**
- `/` and `/studio` MUST return 404 in production
- `/api/local/*` MUST be disabled in production
- `llms.txt` and WebMCP artifacts MUST only expose `published` content
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

### Workflow A: Open External Project In Studio
```bash
pnpm install
pnpm dev                                          # Start Studio
# Open an external project root in Studio at http://localhost:3000/studio
pnpm --filter @anydocs/cli cli build /absolute/path/to/project
```

### Workflow B: Create New Project
```bash
pnpm --filter @anydocs/cli cli init ./workspace/my-docs
pnpm --filter @anydocs/cli cli build ./workspace/my-docs
pnpm --filter @anydocs/cli preview ./workspace/my-docs
```

### Workflow C: Import Legacy Docs
```bash
pnpm --filter @anydocs/cli cli import ./legacy-docs . zh
# Review import at ./imports/<importId>/ when running against a project root
pnpm --filter @anydocs/cli cli convert-import <importId> .
# Generated draft pages will be in ./pages/zh/
# Review and publish in Studio
```

## Current Gaps (vs Multi-Project Target)

- **Studio routing**: project selection exists, but context still rides on `/studio?p=...` and local storage rather than a canonical `/studio/{projectId}` route
- **Docs Site routing**: reading routes are not explicitly project-scoped; preview currently bridges context with cookies
- **Machine-readable HTTP surface**: there is no `/api/mcp/*` implementation yet; WebMCP is currently artifact-first
- **Validation**: minimal block set and duplicate slug checks still need stricter enforcement

For the current documentation map, see: `docs/README.md`
