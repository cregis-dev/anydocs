---
stepsCompleted:
  - 1
  - 2
  - 3
  - 4
  - 5
  - 6
  - 7
  - 8
inputDocuments:
  - artifacts/bmad/planning-artifacts/prd.md
  - artifacts/bmad/planning-artifacts/prd-validation-report.md
  - artifacts/bmad/planning-artifacts/prd-validation-report-rerun.md
  - artifacts/bmad/planning-artifacts/prd-validation-report-rerun-2.md
  - docs/README.md
  - docs/04-usage-manual.md
  - docs/05-dev-guide.md
workflowType: 'architecture'
project_name: 'anydocs'
user_name: 'Shawn'
date: '2026-03-11'
lastStep: 8
status: 'complete'
completedAt: '2026-03-11'
phase2VNextAddendumCompletedAt: '2026-05-24'
sourcePrdRevisions:
  - '2026-03-11 — Phase 1 baseline'
  - '2026-05-24 — Phase 2 single-user vNext expansion (FR51–FR60 + NFR26–NFR33, FR61–FR64 + NFR34 Phase 3 anchors, Journey 4)'
editHistory:
  - date: '2026-03-11'
    changes: 'Phase 1 architecture completed (8/8 steps).'
  - date: '2026-05-24'
    changes: 'Appended Phase 2 vNext Architecture Addendum: @anydocs/editor package contract, Plate migration path, Tauri runtime + native fs, runtime mode (web/desktop), built-in Agent (inline/page/workspace) + audit log JSON schema, scope escalation enforcement, Phase 3 anchors.'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**
The PRD defines 50 functional requirements centered on a constrained Phase 1 workflow: initialize a documentation project, manage documentation through a standardized orchestration model, inspect and adjust structure/content in Studio, and build/preview a static documentation site. Architecturally, the requirements cluster into six capability areas: project initialization and configuration, content modeling and orchestration, Studio-based review and editing, build and preview workflows, published reading experience, and CLI automation. Although the product vision is AI-First, the current Phase 1 scope intentionally defers native AI-heavy interactions and instead emphasizes a reusable workflow standard that external AI tools can follow.

**Non-Functional Requirements:**
The PRD defines 25 non-functional requirements that materially shape the architecture. The strongest drivers are deterministic local builds, local-first content ownership, portability across local and CI environments, published-only output boundaries, shared project state across Studio and CLI, and maintainability for a single-founder Phase 1 delivery. Performance constraints such as sub-30-second builds for a typical 100-page site, fast preview startup, and responsive generated documentation also imply a lightweight build and rendering pipeline. Security and deployment constraints are equally important: production deployments must not expose local editing or write APIs, and AI-facing outputs must respect the same publication boundaries as the reader-facing site.

**Scale & Complexity:**
This is a medium-complexity brownfield developer-tooling project. The product is not a large multi-tenant SaaS, but it does combine several interacting surfaces: a Studio UI, a static documentation site, a CLI workflow, local file-based content management, and future AI-oriented workflow extensions. The current PRD deliberately narrows Phase 1 scope to reduce delivery risk, but the existing repository already contains broader capabilities and experiments that influence migration and reuse decisions.

- Primary domain: Full-stack developer tooling for documentation authoring and static publishing
- Complexity level: Medium
- Estimated architectural components: 8-10 major components or subsystems

### Technical Constraints & Dependencies

The repository is a pnpm monorepo with four primary packages: `@anydocs/web`, `@anydocs/desktop`, `@anydocs/cli`, and `@anydocs/core`. The strongest brownfield baseline exists in `@anydocs/web`, which already includes a Next.js-based reading site, Studio-related UI, local file-system document persistence, generated public search assets, and AI-facing artifacts such as `llms.txt` and MCP JSON outputs. The web package currently uses React 19, Next.js 16, Tailwind 4, Radix/shadcn-style UI primitives, Yoopta-based Studio editing over a shared canonical content model, and MiniSearch-based local search indexing.

The current legacy project documents describe a broader target shape than the PRD, including multi-project workspace behavior, richer multilingual support, and stronger first-class AI output requirements. For architecture purposes, those documents should be treated as implementation context and migration background, not as the source of current scope. The PRD is the authoritative source for target-state architecture decisions.

A further constraint is that current brownfield data models and paths already exist in the web package, including content storage, navigation metadata, public search assets, and published-only filtering rules. Architectural decisions should therefore prefer extracting and stabilizing a shared content-and-build core over introducing a parallel system that would duplicate existing logic.

### Cross-Cutting Concerns Identified

- A single canonical project model must be shared by Studio, CLI, and build workflows
- Local file-system content ownership is a core architectural assumption, not an implementation detail
- Publication boundaries must consistently exclude unpublished content from public site and AI-facing outputs
- Brownfield reuse must be selective: preserve useful web/editor foundations without inheriting out-of-scope roadmap commitments
- Phase 1 architecture must stay intentionally small enough for a single-founder implementation while preserving extension points for future AI-native workflows
- The system must support both human-driven interactive flows and deterministic automation-friendly command execution

## Starter Template Evaluation

### Primary Technology Domain

Full-stack developer tooling based on a web application foundation, with supporting CLI workflows and an existing desktop shell in the repository.

### Starter Options Considered

**Option 1: Continue with the existing brownfield pnpm workspace foundation**
This repository already has the core structural characteristics a new starter would normally provide: a pnpm workspace, separate web/cli/core/desktop packages, a working Next.js application, and package boundaries that can support extraction of shared logic. Because the project is brownfield and Phase 1 is intentionally scope-constrained, preserving this foundation minimizes migration churn and keeps architectural focus on standardizing the content/build core.

**Option 2: Re-bootstrap around `create-turbo`**
Turborepo's official starter remains the standard monorepo starting point for a new TypeScript repository and would be a strong choice for a greenfield implementation. However, for this project it would mainly replace repository scaffolding that already exists and would not directly solve the core architectural problem of aligning Studio, CLI, and build workflows around a shared documentation model.

**Option 3: Re-bootstrap the web app using `create-next-app`**
Next.js official starters are current, well-maintained, and aligned with the existing web stack. They are useful as a reference point for current defaults and conventions, but replacing the current web package with a fresh starter would create avoidable migration work without materially improving the architectural baseline for Phase 1.

### Selected Starter: Existing Brownfield pnpm Monorepo Foundation

**Rationale for Selection:**
The project already contains the most important foundations a modern starter would provide, including a monorepo layout, a working Next.js web application, a CLI package boundary, and a desktop package boundary. The highest-value architectural move is therefore not re-scaffolding, but extracting and stabilizing a shared documentation orchestration core from the existing codebase. This also aligns with the PRD's single-founder, Phase 1 delivery strategy by reducing unnecessary churn.

**Initialization Command:**

```bash
N/A - existing repository retained as the architectural starter foundation
```

**Architectural Decisions Provided by Starter:**

**Language & Runtime:**
TypeScript across packages, Node.js-based tooling, and a React-based web surface already exist as repository defaults.

**Styling Solution:**
The web package already uses Tailwind CSS and Radix/shadcn-style primitives, which establishes a practical UI baseline for Studio and reader-facing surfaces.

**Build Tooling:**
The current workspace already has package-scoped build scripts, Next.js build behavior for the web app, and a static asset generation script for documentation outputs.

**Testing Framework:**
The existing web package includes Playwright-based end-to-end testing, giving the architecture an immediate path for validating core documentation workflows.

**Code Organization:**
The repository is already separated into web, cli, core, and desktop packages, which is a useful foundation for introducing a more explicit shared documentation domain layer.

**Development Experience:**
The existing monorepo already supports local package-oriented development with pnpm workspaces, and current framework defaults remain close to official ecosystem guidance.

**Reference Starter Commands Considered:**
- `pnpm dlx create-turbo@latest`
- `pnpm create next-app@latest`
- `npx oclif generate mynewcli`

These are useful reference points for conventions, but not recommended as the actual starting move for this brownfield architecture effort.

**Note:** The first implementation story should not be repository scaffolding. It should focus on extracting or formalizing the shared project/content/build core that both Studio and CLI will use.

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**
- Use the local file system, not a database, as the Phase 1 system of record
- Extract a shared documentation domain core into `@anydocs/core`
- Keep `@anydocs/cli` as a thin execution layer over the shared core
- Keep `@anydocs/web` as the primary Studio and reader-facing surface
- Standardize published-only filtering and publication rules in one shared layer
- Target Node.js 22 LTS for development and CI compatibility

**Important Decisions (Shape Architecture):**
- Use schema-first validation for pages, navigation, and project configuration
- Keep API style minimal and task-oriented rather than introducing GraphQL or a broader service platform
- Use build-time static search indexing for Phase 1
- Keep frontend state management lightweight and local-first
- Treat current MCP and AI-oriented outputs as compatibility-preserving adapters over the same publication model

**Deferred Decisions (Post-MVP):**
- User authentication and role-based authorization
- Cloud-hosted editing workflows
- Multi-project workspace architecture as a first-class Phase 1 concern
- Native AI chat and AI-driven authoring orchestration inside the product
- More complex deployment automation or hosted control-plane capabilities

### Data Architecture

Phase 1 will use the local file system as the system of record. Pages, navigation, and project configuration remain file-based artifacts stored in the project workspace rather than in a database. This matches the PRD's local-first model and current brownfield implementation.

The main structural change is that the canonical content model, schema validation, publication filtering rules, and build-oriented document orchestration logic should move into `@anydocs/core`. The current web-layer implementation provides the source material for this extraction, but the resulting rules should become package-shared domain logic rather than remain embedded in `@anydocs/web`.

Data validation should follow a schema-first approach so Studio, CLI, and build flows all validate the same page, navigation, and config artifacts consistently. Migration should be incremental: preserve compatibility with the existing repository structure first, then move responsibility into the shared core without introducing a breaking storage redesign.

### Authentication & Security

Phase 1 will not introduce user authentication or role-based authorization. The primary security model is environment-boundary enforcement:
- local workflows may write project files
- production deployments must not expose editing or local write APIs
- only published content may appear in public site outputs or AI-facing artifacts

This keeps the security architecture aligned with the PRD and avoids introducing a premature account system.

### API & Communication Patterns

The architecture will use a minimal task-oriented communication model. No GraphQL layer is needed. CLI commands, Studio actions, and build routines should all call shared core services and shared validation logic.

Errors should be modeled as typed domain or application errors within the shared core and translated into human-readable messages in CLI and Studio surfaces. AI-facing outputs such as machine-readable site artifacts should be generated from the same shared publication logic rather than by parallel custom pipelines.

### Frontend Architecture

The web package remains the main product surface for both the documentation site and the lightweight Studio. The architecture should continue using Next.js App Router with a server-first default, while interactive Studio regions remain client components where needed.

Frontend state management should stay lightweight in Phase 1. Prefer React state and context scoped to Studio concerns rather than adding a dedicated global state library. Search should remain build-time generated and browser-executed, which is already compatible with the performance and local-first goals in the PRD.

Docs Site theming should be modeled as an explicit project-level contract, not as a runtime toggle. Each documentation project should declare exactly one required theme identifier in project configuration, for example `site.theme.id`, and build/preview should fail fast if that identifier is missing or unregistered. This keeps theme choice deterministic across local preview, static export, and future CI flows.

The same project-level theme contract can safely carry a small set of reader-facing overrides such as `site.theme.branding.siteTitle`, `site.theme.branding.homeLabel`, and `site.theme.codeTheme`. These values should remain presentation metadata owned by the site shell and build manifest, not by page content or navigation files.

Some reader themes may also need a project-level site-shell navigation contract that is separate from the page tree itself. A future-safe example is `site.navigation.topNav`, which can describe first-level reader navigation items such as external links or references to stable top-level navigation groups. In that model, top-nav metadata still belongs to project configuration, while the referenced group ids belong to the canonical navigation schema. This keeps theme-specific shell composition explicit without polluting page content.

Theme ownership should stay intentionally narrow:
- `@anydocs/core` owns the project-config type and schema fields that declare the selected theme
- `@anydocs/web` owns theme resolution, theme-specific reader composition, and theme assets
- Page content, navigation, publication rules, and generated machine-readable artifacts remain theme-agnostic

Generated artifacts should still carry the selected theme as build metadata. In practice that means `build-manifest.json` and machine-readable artifact indexes should include the resolved `site.theme.id`, so deployment tooling and external automation can verify which reader theme a static output was built against without coupling page payloads to theme-specific rendering details.

To preserve maintainability, reader themes should live in isolated package-local directories such as `packages/web/themes/<themeId>/`. Each theme directory should own its own manifest, token definitions, layout shell, and optional theme-specific reader components. The web app should expose a small registry layer that maps `site.theme.id` values to these theme modules. This allows one project to select one theme explicitly while keeping theme implementations independent enough for future growth.

### Infrastructure & Deployment

The Phase 1 output remains a static documentation site plus local editing and preview workflows. Build and preview should be deterministic and runnable both locally and in CI. CI should validate schema correctness, deterministic build behavior, and the critical end-to-end flows that prove the documentation workflow works as designed.

No additional hosted infrastructure, multi-tenant backend, or orchestration platform is required for Phase 1.

### Decision Impact Analysis

**Implementation Sequence:**
1. Define the canonical project, page, navigation, and publication schemas in `@anydocs/core`
2. Move shared file-system, validation, and publication logic from `@anydocs/web` into `@anydocs/core`
3. Rebuild `@anydocs/cli` as a thin command layer over core services
4. Update `@anydocs/web` to consume core services instead of local duplicated logic
5. Normalize build, preview, and generated artifact flows around the shared core
6. Add CI checks that validate the shared workflow end to end

**Cross-Component Dependencies:**
- CLI correctness depends on shared core extraction
- Studio consistency depends on using the same schemas and publication logic as build
- Published site correctness depends on the same filtering rules used by artifact generation
- Future AI workflows depend on the stability of the shared documentation model rather than on web-specific behavior

## Implementation Patterns & Consistency Rules

### Pattern Categories Defined

**Critical Conflict Points Identified:**
6 major areas where AI agents could make incompatible implementation choices: domain model ownership, file and symbol naming, module boundaries, error/result formats, publication filtering behavior, and test placement.

### Naming Patterns

**Domain and Data Naming Conventions:**
- Use `camelCase` for all TypeScript fields, variables, function names, and object properties
- Use singular PascalCase for TypeScript types and interfaces such as `PageDoc`, `NavigationDoc`, and `ProjectConfig`
- Use lower-case string literal unions for domain enums and persisted values such as `draft`, `in_review`, and `published`
- Use ISO 8601 strings for persisted timestamps such as `updatedAt`
- Persisted document filenames use stable IDs, for example `<pageId>.json`

**CLI and Command Naming Conventions:**
- CLI commands use lower-case kebab or bare verbs at the command surface, for example `init`, `build`, `preview`
- CLI flags use kebab-case, for example `--project-root`, `--output-dir`, `--watch`
- Command handler functions in code use verb-first camelCase names such as `runBuildCommand`

**Code Naming Conventions:**
- React components use PascalCase filenames and symbols, for example `LocalStudioApp.tsx`
- Non-component modules use lower-case kebab-case filenames, especially in `@anydocs/core` and CLI command modules
- Utility functions use verb-first camelCase names
- Avoid abbreviated domain names unless already established in the shared model

### Structure Patterns

**Project Organization:**
- `@anydocs/core` owns shared domain types, schemas, validation, file-system adapters, publication rules, and build orchestration
- `@anydocs/cli` owns command parsing, human-readable logs, exit codes, and process lifecycle only
- `@anydocs/web` owns reader-facing rendering and Studio UI composition only
- `@anydocs/desktop` must consume shared services and must not become the source of truth for domain logic

**File Structure Patterns:**
- Domain types, schemas, and core services must live together by feature area, not split arbitrarily by technical layer
- Shared domain logic must not be duplicated under `packages/web/lib/docs` after extraction into `@anydocs/core`
- Tests for shared domain logic should live close to the owning package, while end-to-end workflow tests remain in the web package
- Generated artifacts must never be hand-edited; only source content and config are edited directly
- Reader themes should be isolated under `packages/web/themes/<themeId>/` rather than appended into global app-level CSS or layout files
- Theme registration should happen through a single registry module, so new themes are added deliberately and unknown theme ids fail predictably

### Format Patterns

**Error and Result Formats:**
- Shared core functions should prefer returning typed results or throwing typed domain errors rather than ad hoc strings
- CLI output is human-readable, but error categories in code must remain structured
- Validation failures must include the failing entity, the violated rule, and enough context to fix the problem
- Public machine-readable artifacts must be derived from the canonical shared domain model, not custom ad hoc payloads

**Data Exchange Formats:**
- Persisted JSON uses `camelCase` field names
- Dates are serialized as ISO 8601 strings
- Missing optional values use omission or `undefined` at the TypeScript layer and explicit omission in persisted JSON where practical
- Published content filtering must be based on canonical status rules, not caller-specific filtering variations

### Communication Patterns

**Cross-Package Communication:**
- `web`, `cli`, and `desktop` may depend on `core`, but `core` must not depend on UI packages
- All project, page, navigation, and publication operations should pass through shared core services
- Package boundaries should communicate through typed function contracts, not duplicated helper logic
- Feature additions that affect more than one surface should start from `core` and then be wired outward

**State Management Patterns:**
- Studio UI state should remain local and feature-scoped unless multiple screens genuinely require shared state
- Persisted domain state and transient UI state must remain separate concepts
- Build state and CLI execution state must not be stored in long-lived global singletons
- Cache usage must be explicit and read-oriented, never a hidden second source of truth

### Process Patterns

**Error Handling Patterns:**
- Validate at boundaries: config load, content load, save, build input, and artifact generation
- Do not silently coerce invalid project data beyond explicitly defined normalization rules such as slug normalization
- User-facing messages should explain the fix, while internal error types preserve machine-distinguishable categories
- Production-disabled editing paths must fail explicitly and predictably

**Loading and Workflow Patterns:**
- `init`, `build`, and `preview` flows should be deterministic and idempotent where practical
- Shared build steps should execute in a stable order: load config, load content, validate, filter published outputs, generate artifacts, report result
- Studio-triggered actions and CLI-triggered actions should call the same underlying workflow functions
- `--watch` or iterative flows must reuse the same validation and generation steps as one-shot flows

### Enforcement Guidelines

**All AI Agents MUST:**
- Add or modify shared documentation rules in `@anydocs/core` before adapting UI or CLI surfaces
- Reuse canonical types and schemas rather than redefining local copies
- Preserve the single publication filter path for site output, search output, and AI-facing output

**Pattern Enforcement:**
- TypeScript strict mode remains enabled for all maintained packages
- Shared core changes should be covered by package-level tests
- End-to-end workflow tests should verify the happy path for init/edit/build/preview or the nearest current equivalent
- Code review should reject duplicated domain logic across `web`, `cli`, and `desktop`

### Pattern Examples

**Good Examples:**
- A page schema is defined once in `@anydocs/core` and reused by Studio save, CLI build, and static artifact generation
- A `published` filter helper is implemented once and reused by site rendering, search indexing, and AI-facing outputs
- A CLI command delegates to a core service and only handles argument parsing, log output, and exit code mapping

**Anti-Patterns:**
- Reimplementing page validation separately in Studio forms and CLI build logic
- Letting `web` and `cli` each define their own project config shape
- Filtering unpublished content differently in the docs site and generated machine-readable artifacts
- Hiding invalid persisted data through UI-only fixes without updating canonical validation rules

## Project Structure & Boundaries

### Complete Project Directory Structure

```text
anydocs/
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.json
├── README.md
├── .gitignore
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── release.yml
├── docs/
│   ├── README.md
│   ├── 04-usage-manual.md
│   ├── 05-dev-guide.md
│   ├── 06-classic-docs-theme-config.md
│   └── 07-agent-integration.md
├── artifacts/
│   └── bmad/
│       ├── planning-artifacts/
│       │   ├── prd.md
│       │   ├── architecture.md
│       │   └── epics.md
│       ├── implementation-artifacts/
│       └── test-artifacts/
├── packages/
│   ├── core/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── config/
│   │   │   │   ├── project-config.ts
│   │   │   │   └── runtime-env.ts
│   │   │   ├── schemas/
│   │   │   │   ├── page-schema.ts
│   │   │   │   ├── navigation-schema.ts
│   │   │   │   └── project-schema.ts
│   │   │   ├── types/
│   │   │   │   ├── docs.ts
│   │   │   │   ├── navigation.ts
│   │   │   │   └── project.ts
│   │   │   ├── fs/
│   │   │   │   ├── content-repository.ts
│   │   │   │   └── project-paths.ts
│   │   │   ├── services/
│   │   │   │   ├── init-service.ts
│   │   │   │   ├── build-service.ts
│   │   │   │   ├── preview-service.ts
│   │   │   │   ├── page-service.ts
│   │   │   │   └── navigation-service.ts
│   │   │   ├── publishing/
│   │   │   │   ├── publication-filter.ts
│   │   │   │   ├── search-index.ts
│   │   │   │   ├── llms-txt.ts
│   │   │   │   └── mcp-assets.ts
│   │   │   ├── errors/
│   │   │   │   ├── domain-error.ts
│   │   │   │   ├── validation-error.ts
│   │   │   │   └── build-error.ts
│   │   │   └── utils/
│   │   │       ├── slug.ts
│   │   │       └── dates.ts
│   │   └── tests/
│   │       ├── schemas/
│   │       ├── services/
│   │       └── publishing/
│   ├── cli/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts
│   │       ├── commands/
│   │       │   ├── init-command.ts
│   │       │   ├── build-command.ts
│   │       │   └── preview-command.ts
│   │       ├── output/
│   │       │   ├── logger.ts
│   │       │   └── exit-codes.ts
│   │       └── adapters/
│   │           └── core-runner.ts
│   ├── web/
│   │   ├── package.json
│   │   ├── next.config.mjs
│   │   ├── tsconfig.json
│   │   ├── app/
│   │   │   ├── layout.tsx
│   │   │   ├── globals.css
│   │   │   ├── [lang]/
│   │   │   │   └── docs/
│   │   │   ├── docs/
│   │   │   ├── studio/
│   │   │   └── api/
│   │   ├── components/
│   │   │   ├── docs/
│   │   │   ├── studio/
│   │   │   └── ui/
│   │   ├── lib/
│   │   │   ├── core-adapters/
│   │   │   ├── themes/
│   │   │   ├── presentation/
│   │   │   └── utils/
│   │   ├── themes/
│   │   │   └── <themeId>/
│   │   │       ├── manifest.ts
│   │   │       ├── tokens.css
│   │   │       ├── reader-layout.tsx
│   │   │       └── components/
│   │   ├── public/
│   │   ├── scripts/
│   │   │   └── gen-public-assets.mjs
│   │   └── tests/
│   │       └── e2e/
│   └── desktop/
│       ├── package.json
│       └── src/
│           ├── main/
│           ├── preload/
│           └── renderer/
└── content/
    └── projects/
        └── default/
            ├── pages/
            │   ├── zh/
            │   └── en/
            ├── navigation/
            │   ├── zh.json
            │   └── en.json
            └── anydocs.config.json
```

### Architectural Boundaries

**API Boundaries:**
- `packages/web/app/api/*` only exposes web-facing route handlers
- API handlers must delegate business rules to `@anydocs/core`
- No publication, validation, or content-model rules should live only in route handlers
- Production-disabled write paths must be enforced at the boundary before any mutation occurs

**Component Boundaries:**
- Reader-facing docs UI lives under `packages/web/components/docs`
- Studio UI lives under `packages/web/components/studio`
- Shared visual primitives live under `packages/web/components/ui`
- UI components may format or present data, but must not become the canonical source of domain rules

**Service Boundaries:**
- `@anydocs/core` owns all document orchestration services
- `@anydocs/cli` calls core services and maps results to terminal UX
- `@anydocs/web` calls core services and maps results to HTTP/UI behavior
- `@anydocs/desktop` wraps existing surfaces and must not fork workflow logic

**Data Boundaries:**
- Project content, navigation, and config live in the project workspace on disk
- Generated outputs live in build/public artifact directories and are never edited by hand
- Validation happens before persistence and before publication
- Published-only filtering is centralized in core and reused everywhere

### Requirements to Structure Mapping

**Feature Mapping:**
- Project initialization and config → `packages/core/src/config`, `packages/core/src/services/init-service.ts`, `packages/cli/src/commands/init-command.ts`
- Content modeling and orchestration → `packages/core/src/types`, `packages/core/src/schemas`, `packages/core/src/services/page-service.ts`, `packages/core/src/services/navigation-service.ts`
- Studio review and adjustment → `packages/web/app/studio`, `packages/web/components/studio`, `packages/web/lib/core-adapters`
- Build and preview workflows → `packages/core/src/services/build-service.ts`, `packages/core/src/services/preview-service.ts`, `packages/cli/src/commands/build-command.ts`, `packages/cli/src/commands/preview-command.ts`
- Published reading experience → `packages/web/app/[lang]/docs`, `packages/web/components/docs`
- Reader theme declaration and resolution → `packages/core/src/types/project.ts`, `packages/core/src/schemas/project-schema.ts`, `packages/web/lib/themes`, `packages/web/themes/<themeId>`
- AI-friendly published artifacts → `packages/core/src/publishing`, `packages/web/scripts/gen-public-assets.mjs`

**Cross-Cutting Concerns:**
- Validation → `packages/core/src/schemas`, `packages/core/src/errors`
- Publication filtering → `packages/core/src/publishing/publication-filter.ts`
- Slug normalization and path safety → `packages/core/src/utils/slug.ts`, `packages/core/src/fs/project-paths.ts`
- Human-readable logs and deterministic exit behavior → `packages/cli/src/output/*`
- End-to-end workflow confidence → `packages/web/tests/e2e`

### Integration Points

**Internal Communication:**
- Web, CLI, and desktop all depend inward on `@anydocs/core`
- Core exposes typed service entry points, not UI-aware helpers
- Route handlers and command handlers are adapter layers, not business-rule layers

**External Integrations:**
- Static hosting consumes generated site output only
- External AI tools interact through generated published artifacts or future skill definitions
- No Phase 1 dependency on hosted auth, database, or third-party search platform

**Data Flow:**
- Source content/config on disk
- Core loads and validates project data
- Core applies publication rules and build orchestration
- Web renders reader/studio surfaces from core-backed data
- CLI executes init/build/preview against the same core services
- Generated site and machine-readable artifacts are emitted from the same validated model

### File Organization Patterns

**Configuration Files:**
- Workspace-wide config stays at repo root
- Project-specific config lives inside each documentation project
- Build/runtime environment flags stay close to the package that consumes them

**Source Organization:**
- Shared domain logic is organized by capability inside `core`
- UI code is organized by surface inside `web`
- Command entry points are organized by command in `cli`

**Test Organization:**
- Core tests live in `packages/core/tests`
- UI integration and E2E tests live in `packages/web/tests/e2e`
- Avoid duplicating the same workflow assertions in multiple packages

**Asset Organization:**
- Reader-facing static assets remain in `packages/web/public`
- Generated search/MCP/LLM artifacts are build outputs, not source assets
- Project content assets should live with the project workspace, not inside UI package internals

### Development Workflow Integration

**Development Server Structure:**
- Web dev server hosts reading and Studio surfaces
- CLI development runs as a package-local command layer over core
- Desktop remains optional during Phase 1 development

**Build Process Structure:**
- Core owns the deterministic content-to-artifact pipeline
- Web build consumes generated artifacts and reader routes
- CLI build triggers core services and reports results

**Deployment Structure:**
- Only generated static outputs are deployed publicly
- Production web deployments must not expose local editing workflows
- Desktop packaging remains separate from docs-site deployment

## Architecture Validation Results

### Coherence Validation ✅

**Decision Compatibility:**
The architectural decisions are internally coherent. The chosen Phase 1 model combines local-first file-based content, a shared documentation core, a thin CLI layer, and a lightweight Studio surface without introducing contradictory infrastructure or platform assumptions. The brownfield preservation strategy is also compatible with the monorepo foundation already present in the repository.

**Pattern Consistency:**
The implementation patterns support the architectural decisions well. Naming, package boundaries, publication filtering, schema ownership, and test placement all reinforce the same design principle: shared domain behavior must live in `@anydocs/core`, while `web`, `cli`, and `desktop` remain adapter surfaces.

**Structure Alignment:**
The proposed project structure supports the architectural decisions directly. Package responsibilities are explicit, the extraction path from existing `web` logic into `core` is clear, and the resulting structure supports both current Phase 1 requirements and later extension without forcing a platform rewrite.

### Requirements Coverage Validation ✅

**Feature Coverage:**
The architecture supports all core Phase 1 product capabilities described in the PRD: project initialization, standardized content orchestration, Studio-based review and modification, deterministic build and preview workflows, and published static-site output. The architecture also preserves a path for future AI-oriented outputs without making them the primary Phase 1 driver.

**Functional Requirements Coverage:**
The functional requirements are architecturally covered through the combination of shared schemas, orchestration services, CLI command adapters, Studio UI adapters, and static publishing services. Reader-facing output, content structure management, and workflow reuse all have clear architectural homes.

**Non-Functional Requirements Coverage:**
The architecture addresses the most important NFRs: deterministic build behavior, local-first ownership, publication boundary enforcement, compatibility across local and CI execution, maintainability for a single-founder Phase 1, and performance-friendly static output generation. Public write-surface restrictions are also reflected in the architecture.

### Implementation Readiness Validation ✅

**Decision Completeness:**
The architecture now documents the critical decisions required to begin implementation: source-of-truth model, shared package ownership, package responsibilities, validation strategy, command-layer behavior, and deployment boundaries.

**Structure Completeness:**
The project structure is sufficiently concrete for implementation planning. It identifies the intended future package layout, clarifies where shared logic should move, and distinguishes target structure from legacy brownfield areas.

**Pattern Completeness:**
The implementation rules are strong enough to keep multiple AI agents aligned. They address the major conflict points most likely to cause drift across packages, including naming, schema ownership, filtering rules, error handling, and testing boundaries.

### Gap Analysis Results

**Critical Gaps:** None identified.

**Important Gaps:**
- The architecture assumes a normalized Phase 1 project content layout, while the current repository still contains historical path variants and transitional scripts.
- The current public-asset generation script in `packages/web` contains broader brownfield logic than the Phase 1 architecture intends to preserve, so implementation should explicitly migrate this behavior into `@anydocs/core`.

**Nice-to-Have Gaps:**
- A future migration note could document how historical `web` content logic is retired once `core` becomes authoritative.
- A later architecture addendum could define the exact preview runtime model in more detail if preview evolves beyond the current local assumption.

### Validation Issues Addressed

- Brownfield legacy documents were treated as implementation context rather than target-state scope authority
- Shared-core extraction was made the center of the architecture instead of leaving logic fragmented in the web package
- Package boundaries, publication rules, and workflow ownership were specified clearly enough to guide implementation consistently

### Architecture Completeness Checklist

**✅ Requirements Analysis**
- [x] Project context thoroughly analyzed
- [x] Scale and complexity assessed
- [x] Technical constraints identified
- [x] Cross-cutting concerns mapped

**✅ Architectural Decisions**
- [x] Critical decisions documented with versions
- [x] Technology stack fully specified
- [x] Integration patterns defined
- [x] Performance considerations addressed

**✅ Implementation Patterns**
- [x] Naming conventions established
- [x] Structure patterns defined
- [x] Communication patterns specified
- [x] Process patterns documented

**✅ Project Structure**
- [x] Complete directory structure defined
- [x] Component boundaries established
- [x] Integration points mapped
- [x] Requirements to structure mapping complete

### Architecture Readiness Assessment

**Overall Status:** READY FOR IMPLEMENTATION

**Confidence Level:** High

**Key Strengths:**
- Strong alignment with the narrowed Phase 1 PRD
- Clear shared-core-first architecture for consistent implementation
- Brownfield-aware without being trapped by legacy roadmap assumptions
- Concrete package and workflow boundaries that reduce AI agent divergence

**Areas for Future Enhancement:**
- Explicit migration plan from legacy `web` logic into `core`
- More detailed preview/runtime model if Phase 2 expands local-dev workflows
- Future architecture extension for native AI capabilities and broader machine-readable outputs

### Implementation Handoff

**AI Agent Guidelines:**
- Follow all architectural decisions exactly as documented
- Use implementation patterns consistently across all components
- Respect project structure and boundaries
- Refer to this document for all architectural questions

**First Implementation Priority:**
Define the canonical schemas and shared content/build services in `@anydocs/core`, then migrate existing `packages/web/lib/docs/*` behavior into that shared layer before expanding CLI or Studio capabilities further.

---

# Phase 2 — Single-User vNext Architecture Addendum

**Appended:** 2026-05-24
**Source PRD:** `artifacts/bmad/planning-artifacts/prd.md` (Phase 2 single-user vNext expansion, FR51–FR60 + NFR26–NFR33, Phase 3 anchors FR61–FR64 + NFR34, Journey 4)
**Relationship to Phase 1 Architecture:** Additive. Phase 1 decisions (local-first file system, shared `@anydocs/core`, thin CLI, web Studio + reader, deterministic build) remain authoritative. This addendum extends the architecture along five vNext axes without retracting any Phase 1 decision.

## Addendum Scope

This addendum covers the architectural surface introduced by the Phase 2 single-user vNext PRD expansion:

1. **`@anydocs/editor` package contract** — extract the block editor from the web app into a consumable, contract-bound package
2. **Editor block runtime migration (Yoopta → Plate)** — modernize the underlying block runtime while preserving `doc-content-v1` as the canonical storage format
3. **Runtime mode model (`web` / `desktop`)** — explicit declaration of which runtime is active, with capability-boundary differences enforced consistently
4. **Desktop runtime with native filesystem access (Tauri)** — desktop shell that bypasses `/api/local/*` and reads/writes project files directly
5. **Built-in Agent subsystem** — three-scope Agent contract (inline / page / workspace) with write-ahead audit log, scope escalation enforcement, and rollback API
6. **Phase 3 anchors** — reserved extension points for team mode, remote MCP service, multi-author audit, and theme marketplace, without Phase 2 implementation

## Updated Package Topology

```text
packages/
├── core/                       # extended — Phase 2 additions
│   └── src/
│       ├── (Phase 1 modules unchanged)
│       ├── agent/                          # NEW — Agent scope contracts + audit hooks
│       │   ├── agent-service.ts
│       │   ├── inline-agent.ts
│       │   ├── page-agent.ts
│       │   ├── workspace-agent.ts
│       │   ├── scope-validator.ts
│       │   └── provider-port.ts            # abstract LLM provider port (no vendor binding)
│       ├── audit/                          # NEW — write-ahead audit log
│       │   ├── audit-log-service.ts
│       │   ├── audit-schema.ts             # versioned JSON schema (see §Audit Log)
│       │   ├── audit-repository.ts         # fs persistence under <projectRoot>/.anydocs/audit/
│       │   └── rollback-service.ts
│       ├── runtime/                        # NEW — runtime mode model
│       │   ├── runtime-mode.ts             # 'web' | 'desktop' type + resolver
│       │   └── capability-matrix.ts
│       └── schemas/
│           └── audit-entry-schema.ts        # NEW
├── editor/                     # NEW PACKAGE — @anydocs/editor
│   ├── package.json
│   ├── contract/
│   │   ├── public-api.ts                   # declared contract (CI-checked by NFR31)
│   │   └── contract.json                   # generated diff target
│   ├── src/
│   │   ├── index.ts                        # re-exports from public-api
│   │   ├── runtime/
│   │   │   └── plate-runtime.ts            # Plate-based block runtime
│   │   ├── converters/
│   │   │   ├── doc-content-to-plate.ts
│   │   │   └── plate-to-doc-content.ts     # canonical = doc-content-v1
│   │   ├── plugins/
│   │   │   ├── plugin-contract.ts          # extensibility contract
│   │   │   └── builtin/
│   │   │       ├── heading.ts
│   │   │       ├── paragraph.ts
│   │   │       ├── list.ts
│   │   │       ├── code.ts
│   │   │       ├── image.ts
│   │   │       ├── callout.ts
│   │   │       ├── table.ts
│   │   │       └── divider.ts
│   │   └── agent-anchors/                  # Agent invocation entry points
│   │       ├── inline-anchor.tsx           # selection-bound trigger
│   │       ├── page-anchor.tsx
│   │       └── workspace-anchor.tsx
│   └── tests/
├── web/                        # consumes @anydocs/editor; runtime mode = 'web'
│   └── lib/
│       └── editor-host/                    # NEW — Studio hosts @anydocs/editor
├── desktop/                    # extended — runtime mode = 'desktop'
│   └── src-tauri/                          # NEW — Tauri shell
│       ├── tauri.conf.json
│       └── src/
│           ├── main.rs
│           └── commands/
│               ├── fs_commands.rs          # native fs bridge
│               └── audit_commands.rs       # audit log bridge
└── desktop-server/             # existing local HTTP bridge — extended for runtime mode signaling
```

**New package:** `@anydocs/editor` (independent, contract-bound).
**Extended packages:** `@anydocs/core` (agent + audit + runtime modules), `@anydocs/desktop` (Tauri shell + native fs adapter), `@anydocs/web` (editor host adapter).
**Unchanged packages:** `@anydocs/cli`, `@anydocs/mcp`, `@anydocs/desktop-server` (only runtime-mode signaling added).

## `@anydocs/editor` Package Contract

### Purpose

Extract the block editor as a portable, contract-bound package that Studio (web), Desktop (Tauri), and future embeds consume through a single declared public API. This stabilizes editor evolution against consumer churn and enables the Plate migration without coupling consumers to internal runtime details.

### Public API Surface

The package exports a minimal, capability-oriented surface. Consumers receive opaque editor instances and interact through declared functions and events; internal Plate state and plugin internals are not exported.

**Exported types and entry points:**

- `createEditor(config: EditorConfig): EditorInstance` — factory returning an opaque editor instance
- `EditorConfig` — declarative configuration (initial `doc-content-v1` payload, registered plugins, agent anchors enabled, theme tokens)
- `EditorInstance.mount(target: HTMLElement): UnmountHandle` — host-side mount API
- `EditorInstance.getContent(): DocContentV1` — produces canonical content snapshot
- `EditorInstance.setContent(payload: DocContentV1): void`
- `EditorInstance.on(event, handler)` — events: `change`, `selection-change`, `agent-anchor-triggered`
- `EditorInstance.triggerAgent(scope: 'inline' | 'page' | 'workspace', payload): AgentInvocation`
- `registerPlugin(plugin: EditorPlugin): void` — extensibility entry point
- `EditorPlugin` — plugin contract (block type, marks, conversion hooks, agent-anchor capability)

**Contract enforcement:**

- `contract/public-api.ts` is the single source of truth; `contract.json` is generated from it
- CI runs an API diff tool against `contract.json`; any divergence (added/removed/renamed exports, signature changes) **fails CI** (satisfies NFR31)
- `@anydocs/editor` is forbidden from re-exporting internal Plate types directly; consumers see only contract-declared types

### Migration Strategy: Yoopta → Plate

**Canonical storage stays `doc-content-v1`.** Plate is the runtime engine, never the storage format.

**Migration phases:**

1. **Foundation:** Create `@anydocs/editor` package with the public API contract. Internally implemented over Plate. Ship `doc-content-v1 ↔ plate-value` converters under `src/converters/`.
2. **Studio dual-mount (transitional):** `packages/web/lib/editor-host/` hosts the new `@anydocs/editor` behind a feature flag. Existing Yoopta-based Studio remains the default. Cross-mount round-trip fixture tests assert byte-equivalence after `getContent` → `setContent` cycles.
3. **Studio cutover:** Flip the default to `@anydocs/editor`. Yoopta integration retired from `packages/web` once cross-mount fixtures pass for 100% of reference fixtures.
4. **Desktop adoption:** Desktop renderer hosts the same `@anydocs/editor` package — runtime is identical across `web` and `desktop` modes; only host capabilities differ.

**Rollback plan:** During Studio dual-mount phase, the feature flag toggles back to Yoopta with no content loss because `doc-content-v1` is canonical.

### Plugin Contract for Extensibility

`EditorPlugin` declares: block type identifier, schema fragment (must align with `doc-content-v1` allowed block types), conversion hooks (`docContentToPlate`, `plateToDocContent`), optional agent-anchor capability declaration. Plugins added at runtime via `registerPlugin` must not bypass `doc-content-v1` validation — invalid block emissions are rejected by the converter layer.

## Runtime Mode Model

### Definition

`RuntimeMode = 'web' | 'desktop'` declared in `@anydocs/core/src/runtime/runtime-mode.ts`. Resolved at process startup, **immutable** for the lifetime of the runtime instance.

### Resolution Rules

- `web`: process runs inside Next.js dev server / browser context; local APIs (`/api/local/*`) are the write surface (Phase 1 behavior)
- `desktop`: process runs inside Tauri shell; native fs commands are the write surface; `/api/local/*` is not contacted

Resolution sources (in priority order):
1. Explicit injection from host bootstrap (Tauri main process sets `desktop`; Next.js sets `web`)
2. Capability probe (presence of Tauri global) — defensive fallback only
3. Fail-fast if neither resolves — runtime must not start in ambiguous mode

### Capability Matrix

| Capability | `web` mode | `desktop` mode |
|---|---|---|
| Project fs read | via `/api/local/*` route handlers | direct native fs through Tauri commands |
| Project fs write | via `/api/local/*` route handlers (dev only; production-disabled) | direct native fs through Tauri commands |
| `/api/local/*` reachable | yes | no (network calls disabled in shell config) |
| Studio editing | enabled | enabled |
| Agent invocation | enabled | enabled |
| Audit log persistence | `<projectRoot>/.anydocs/audit/` via core service over fs adapter | identical path, identical service; only fs adapter differs |
| UI runtime mode indicator | shows "web" badge | shows "desktop" badge |

`capability-matrix.ts` exports a typed map consumed by both Studio adapters and Agent service. Diverging from this map at any consumer site is an architectural violation.

### UI Surfacing (satisfies FR58, NFR32)

Studio status bar renders a `RuntimeModeIndicator` component fed from `@anydocs/core` resolver. The indicator is mandatory across all editor views — keyboard-accessible, color + text label (no color-only meaning per NFR17).

## Desktop Runtime with Native Filesystem Access

### Tauri Shell Architecture

`packages/desktop/src-tauri/` hosts a thin Tauri shell that:
1. Initializes runtime mode = `desktop` and signals it to the renderer
2. Loads the same web export bundle (`packages/web` static export) that Phase 1 desktop already uses
3. Exposes a small set of Rust-side commands for native fs operations and audit log persistence
4. Configures Tauri to **disable** network calls to `/api/local/*` (browser-equivalent fetch is allowed only to the in-process renderer)

### Native Filesystem Adapter

`@anydocs/core/src/fs/` already defines `ContentRepository` and `ProjectPaths` abstractions. Phase 2 adds a `desktop-fs-adapter.ts` that implements these abstractions over Tauri's IPC `invoke` calls to the Rust side.

**Atomicity contract (NFR27):**
- Every write goes through a `write-temp-then-rename` pattern on the Rust side
- Failed writes leave the original file intact (no partial-write visibility)
- Adapter exposes a single async function per repository method; failure surfaces as a typed `FsWriteError` domain error

**Path safety:**
- Rust commands reject any path outside the project root (path canonicalization + prefix check)
- No symbolic link traversal across the project boundary

**No duplicate domain logic:**
- `desktop-fs-adapter.ts` only adapts I/O calls; publication filtering, validation, and content modeling remain in shared core (preserves Phase 1 architectural rule)

### Replacement of `/api/local/*` in Desktop Mode

When runtime mode = `desktop`, the editor host (`packages/web/lib/editor-host/` and `packages/desktop/src/`) routes all read/write through `@anydocs/core` services backed by `desktop-fs-adapter.ts`. The local Express server bundled with `@anydocs/desktop-server` is **retained** but serves only static assets and the runtime-mode signaling endpoint; write routes are not registered in desktop mode.

This satisfies FR52: the desktop call graph contains zero requests to `/api/local/*`, verifiable in desktop e2e fixtures.

## Built-in Agent Subsystem

### Three-Scope Contract

| Scope | Write target | Authoritative entity | Enforcement point |
|---|---|---|---|
| `inline` | a single content block within a single page | block id | `inline-agent.ts` rejects writes outside the active block |
| `page` | a single page (content + status) | pageId | `page-agent.ts` rejects writes to any pageId other than the invocation target |
| `workspace` | multiple pages and navigation within a single project | projectId | `workspace-agent.ts` rejects writes to any project other than the invocation target |

### Architecture Layout

```text
@anydocs/core/src/agent/
├── agent-service.ts              # public entry: invokeAgent(scope, target, prompt) → AgentInvocation
├── scope-validator.ts            # pure functions: assertScopeBoundary(scope, write)
├── inline-agent.ts               # scope=inline orchestrator
├── page-agent.ts                 # scope=page orchestrator
├── workspace-agent.ts            # scope=workspace orchestrator
├── provider-port.ts              # abstract LLM provider port — no vendor binding
└── invocation-types.ts           # AgentInvocation, AgentWrite, AgentResult types
```

**Scope enforcement is server-side / core-side.** UI-side scope visibility (FR59) is necessary but **not sufficient**; `scope-validator.ts` re-asserts boundaries before any write reaches the audit log or fs layer. Out-of-scope writes are rejected with a typed `AgentScopeViolationError`.

### Write-Ahead Audit Integration

Every Agent write flows through this sequence (atomic from the caller's perspective):

1. `agent-service.ts` receives `AgentWrite` from a scope orchestrator
2. `scope-validator.ts.assertScopeBoundary()` runs — violation aborts immediately
3. `audit-log-service.ts.persistPending(entry)` writes a pending audit entry to disk
4. `content-repository.write(payload)` applies the actual content change
5. `audit-log-service.ts.markCommitted(entry.id)` updates the pending entry to committed
6. If step 4 fails → `audit-log-service.ts.markRejected(entry.id, error)` + content change rolled back (or never applied if not yet partially written)
7. If step 3 fails (audit persistence failure) → Agent write **rejected outright**, no content change attempted

This satisfies NFR29 (write-ahead + rollback semantics) and FR56 (no audit-missing writes).

### LLM Provider Port

`provider-port.ts` declares an abstract interface (`AgentProviderPort`) with `generate(prompt, context, scope) → ProviderResponse`. **No vendor name appears in core code.** Concrete adapters live outside `@anydocs/core` (in a Phase 2 implementation-detail package or in host-side configuration). This preserves the Phase 1 architectural rule that `core` owns capability, not vendor coupling.

### Rollback API (FR57)

`audit-log-service.ts.rollback(entryId)`:
1. Loads the audit entry's pre-change content snapshot (stored at audit time)
2. Re-applies the snapshot through `content-repository.write()`
3. Persists a new audit entry with `operation: 'rollback'` referencing the original entry's id

This makes rollback itself an auditable Agent operation, preserving traceability.

## Audit Log Architecture

### Storage

**Location:** `<projectRoot>/.anydocs/audit/` (project-local, version-controllable if user chooses, never inside `dist/` or `node_modules/`)

**File layout:** Append-only newline-delimited JSON (`.ndjson`) sharded by day: `YYYY-MM-DD.ndjson`. Daily shards simplify retention enforcement (NFR30: ≥ 30 days) and make file scans cheap for query API.

**Schema reference:** `@anydocs/core/src/schemas/audit-entry-schema.ts` — Zod schema + JSON Schema export.

### Audit Entry JSON Schema (v1)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "anydocs://schemas/audit-entry/v1",
  "title": "AuditEntry",
  "type": "object",
  "required": [
    "schemaVersion",
    "id",
    "timestamp",
    "scope",
    "operation",
    "status",
    "projectId",
    "target",
    "actor",
    "runtimeMode"
  ],
  "properties": {
    "schemaVersion": { "const": 1 },
    "id": { "type": "string", "description": "ULID for ordered uniqueness" },
    "timestamp": { "type": "string", "format": "date-time", "description": "ISO 8601" },
    "scope": { "enum": ["inline", "page", "workspace"] },
    "operation": {
      "enum": ["create", "update", "delete", "rollback", "structural"]
    },
    "status": {
      "enum": ["pending", "committed", "rejected"],
      "description": "Write-ahead lifecycle"
    },
    "projectId": { "type": "string" },
    "runtimeMode": { "enum": ["web", "desktop"] },
    "actor": {
      "type": "object",
      "required": ["kind"],
      "properties": {
        "kind": { "enum": ["agent", "human", "system"] },
        "agentProvider": {
          "type": "string",
          "description": "Provider port identifier; empty if kind != agent"
        }
      }
    },
    "target": {
      "type": "object",
      "required": ["resourceKind"],
      "properties": {
        "resourceKind": { "enum": ["block", "page", "navigation", "project-config"] },
        "pageId": { "type": "string" },
        "blockId": { "type": "string" },
        "navigationId": { "type": "string" }
      }
    },
    "diff": {
      "type": "object",
      "description": "Compact change summary",
      "properties": {
        "before": { "description": "Pre-change snapshot (canonical doc-content-v1 fragment or config object)" },
        "after": { "description": "Post-change snapshot" },
        "summary": { "type": "string", "description": "Short human-readable description" }
      }
    },
    "rejectionReason": {
      "type": "string",
      "description": "Populated only when status = 'rejected'"
    },
    "rollbackOf": {
      "type": "string",
      "description": "If operation = 'rollback', references the original entry id"
    },
    "promptDigest": {
      "type": "string",
      "description": "SHA-256 of the prompt that triggered the Agent invocation; PII-safe"
    }
  },
  "additionalProperties": false
}
```

### Schema Versioning Rule

Any backward-incompatible change to this schema requires `schemaVersion` bump and a migration plan in this addendum. Forward-compatible additions (new optional fields) do not require a version bump but should be recorded in schema-change history.

### Query API

`audit-log-service.ts.query(filter: AuditQuery): AuditEntry[]`:
- Filter axes: `scope`, `target.resourceKind`, `target.pageId`, `target.projectId`, `timestamp` range, `status`, `actor.kind`
- Returns entries in reverse chronological order, paginated
- Implementation reads daily shards in the requested range, applies filters in memory (sufficient for Phase 2 scale)

### Retention

NFR30 mandates ≥ 30 days. Daily shards older than the retention window are deleted by a `prune` operation invoked on Studio startup or via CLI `anydocs audit prune`. Pruning is logged as a system actor `audit-entry` (operation = `structural`).

## Scope Escalation Enforcement (FR59 / NFR33)

### UI Layer

Editor `agent-anchors/` declares the active scope to the editor host. When the user requests an Agent invocation, the host renders the active scope as a visible badge. Escalation from a narrower scope to a wider scope (`inline → page`, `page → workspace`, or `inline → workspace`) requires a modal confirmation step.

### Core Layer (defense in depth)

`agent-service.ts.invokeAgent()` accepts an `escalationConfirmation` token. The token is signed by the editor host upon user confirmation, with a short TTL. Invocations missing the token, or carrying an expired/invalid token, are rejected with `EscalationConfirmationRequiredError`.

This guarantees that even a bypassed UI cannot execute scope escalation silently — the architectural contract holds end-to-end.

## Phase 3 Architectural Anchors (Reserved, Not Implemented in Phase 2)

The following extension points are **declared** in Phase 2 architecture so Phase 3 can integrate without retrofitting:

### Project Mode Field (`single` / `team`)

`@anydocs/core/src/schemas/project-schema.ts` reserves `mode?: 'single' | 'team'` as an **optional** field. Phase 2 implementations treat absent/`single` identically; `team` is rejected with `ProjectModeNotSupportedError` until Phase 3 lands. This guarantees Phase 2 projects forward-migrate without rewrite.

### Remote MCP Service Adapter

`@anydocs/mcp` currently exposes stdio transport only. Phase 3 anchor: an `adapters/` directory in `@anydocs/mcp` will host alternative transports (HTTP). Phase 2 reserves the directory layout and a `transport-port.ts` interface that the stdio transport implements but does not yet need.

### Multi-Author Audit Entries

The `actor` object in the audit schema already supports `kind: 'human'` and is structured to admit a future `actorId` field. Phase 3 will add `actorId` as an additive (forward-compatible) schema change — no `schemaVersion` bump needed.

### Theme Marketplace

Phase 1 already established the theme registry pattern (`packages/web/themes/<themeId>/`). Phase 3 anchor: registry can be extended to discover external theme packages via a manifest convention. No Phase 2 implementation required.

### Read-Only MCP Tool Profile

`@anydocs/mcp` Phase 2 reserves a `tools/profiles/` directory and a `ToolProfile` type with `mode: 'full' | 'read-only'`. Default remains `full`. Phase 3 adds a `read-only` profile filtering write tools — no breaking change to existing tool definitions.

## Implementation Patterns Addendum

Phase 1 implementation patterns remain authoritative. Phase 2 adds the following:

### Pattern: Agent Scope Boundary Enforcement

**Rule:** Every Agent write must pass `scope-validator.ts.assertScopeBoundary(scope, write)` before any persistence side effect. UI-side scope rendering is necessary but never sufficient.

**Anti-pattern:** Calling `content-repository.write()` from an Agent code path without routing through `agent-service.invokeAgent()`.

### Pattern: Write-Ahead Audit

**Rule:** Order is fixed: `validate scope → persist pending audit → write content → mark committed`. Any deviation (e.g., writing content before audit) is an architectural violation.

**Anti-pattern:** Catching audit persistence errors and continuing the content write. Audit failure must propagate.

### Pattern: Runtime Mode Resolution

**Rule:** `runtime-mode.ts.resolveRuntimeMode()` is called exactly once at process bootstrap. The result is immutable and read via a typed getter elsewhere. No code reads `process.env` or probes Tauri globals outside this module.

**Anti-pattern:** Multiple runtime-mode probes scattered across packages.

### Pattern: Editor Contract Discipline

**Rule:** Consumers (`@anydocs/web`, `@anydocs/desktop`) import only from `@anydocs/editor` package entry, never reach into internal modules. CI enforces this via path-restriction lint rules.

**Anti-pattern:** Importing `@anydocs/editor/src/runtime/plate-runtime.ts` directly.

### Pattern: Capability Matrix as Single Source

**Rule:** Any code path that branches on runtime mode reads from `capability-matrix.ts`. New capabilities that differ across modes are added to the matrix, not inlined in consumers.

**Anti-pattern:** Inline `if (runtimeMode === 'desktop')` branches scattered across UI code.

## Phase 2 Architectural Boundaries (Updates)

Phase 1 boundaries remain. The following are appended:

**Package Boundaries:**
- `@anydocs/editor` may depend on `@anydocs/core` for `doc-content-v1` types and converters; it must not depend on `@anydocs/web` or `@anydocs/desktop`
- `@anydocs/web` and `@anydocs/desktop` depend on `@anydocs/editor` only through its declared contract
- Tauri Rust code (`packages/desktop/src-tauri/`) does not duplicate domain logic; it only adapts I/O

**Agent Boundaries:**
- Agent orchestrators (`inline-agent.ts`, `page-agent.ts`, `workspace-agent.ts`) compose scope validation + audit + content write; they do not own provider concerns
- Provider concerns are isolated behind `provider-port.ts`; host applications wire concrete providers

**Audit Boundaries:**
- Audit log is owned by `@anydocs/core/audit/`; no other package writes to `<projectRoot>/.anydocs/audit/`
- Audit schema changes require explicit version bump per the rule above

**Runtime Mode Boundaries:**
- Runtime mode resolution lives in `@anydocs/core/runtime/`; no consumer probes the environment independently
- The capability matrix is the single source of cross-mode behavioral differences

## Requirements-to-Structure Mapping (Phase 2)

| PRD Reference | Architectural Home |
|---|---|
| FR51 (three-scope Agent anchors) | `@anydocs/editor/src/agent-anchors/`, `@anydocs/core/src/agent/agent-service.ts` |
| FR52 (desktop native fs) | `packages/desktop/src-tauri/src/commands/fs_commands.rs`, `@anydocs/core/src/fs/desktop-fs-adapter.ts` |
| FR53 (inline Agent scope) | `@anydocs/core/src/agent/inline-agent.ts`, `scope-validator.ts` |
| FR54 (page Agent scope) | `@anydocs/core/src/agent/page-agent.ts`, `scope-validator.ts` |
| FR55 (workspace Agent scope) | `@anydocs/core/src/agent/workspace-agent.ts`, `scope-validator.ts` |
| FR56 (write-ahead audit + rollback) | `@anydocs/core/src/audit/audit-log-service.ts` |
| FR57 (audit query + rollback API) | `@anydocs/core/src/audit/audit-log-service.ts.query/rollback`, `rollback-service.ts` |
| FR58 (runtime mode indicator) | `@anydocs/core/src/runtime/`, Studio status bar `RuntimeModeIndicator` |
| FR59 (scope escalation confirmation) | `@anydocs/editor/src/agent-anchors/`, `@anydocs/core/src/agent/agent-service.ts` escalation token check |
| FR60 (`@anydocs/editor` package contract) | `packages/editor/contract/public-api.ts`, CI contract diff |
| NFR26 (desktop ≤3s startup) | Tauri shell minimal-deps configuration, `packages/desktop/src-tauri/tauri.conf.json` |
| NFR27 (atomic fs writes) | Tauri commands write-temp-then-rename pattern |
| NFR28 (Agent latency budgets per scope) | `agent-service.ts` per-scope timeout configuration |
| NFR29 (write-ahead + rollback enforcement) | `audit-log-service.ts` + fault-injection test harness |
| NFR30 (audit schema + 30-day retention) | `audit-entry-schema.ts`, `audit-repository.ts.prune()` |
| NFR31 (editor API contract diff in CI) | `packages/editor/contract/`, CI workflow |
| NFR32 (cross-mode content compatibility) | Identical `@anydocs/core` services in both modes, fixture round-trip tests |
| NFR33 (scope escalation confirmation enforcement) | `agent-service.ts` escalation token + UI confirmation flow |
| FR61–FR64, NFR34 (Phase 3 anchors) | See `## Phase 3 Architectural Anchors` above |

## Phase 2 Validation

### Coherence Validation ✅

**Decision Compatibility:** All Phase 2 decisions extend Phase 1 without contradiction. Local-first remains the model (Tauri = local; web mode unchanged). Shared core remains the source of truth (Agent + audit + runtime live in core, not in UI surfaces). Publication boundary remains intact (audit log is a project-local artifact, never published).

**Pattern Consistency:** Phase 2 patterns mirror Phase 1 style — capability-language at architecture boundaries, schema-first validation, single-source rules per concern. No new architectural philosophy introduced.

**Structure Alignment:** New package (`@anydocs/editor`) and new core modules (`agent/`, `audit/`, `runtime/`) follow Phase 1 organization conventions (capability folders, not technical-layer folders).

### Requirements Coverage Validation ✅

All 14 new FRs (FR51–FR64) and 9 new NFRs (NFR26–NFR34) have explicit architectural homes (see mapping table above). Phase 3 FRs/NFRs have declared anchor points that allow forward integration without retrofit.

### Implementation Readiness Validation ✅

**Decision Completeness:** Core extensions are specified (agent + audit + runtime modules), new package contract is declared (`@anydocs/editor`), desktop fs strategy is concrete (Tauri shell + native adapter + atomicity contract), audit schema is defined with versioning rules.

**Structure Completeness:** Updated package topology, capability matrix, and requirements-to-structure mapping give epic/story workflows enough surface to break down.

**Pattern Completeness:** Five new patterns (scope enforcement, write-ahead audit, runtime mode resolution, editor contract discipline, capability matrix as single source) address the most likely cross-agent drift points.

### Gap Analysis Results

**Critical Gaps:** None.

**Important Gaps:**
- LLM provider concrete adapter is out of scope for this architecture (intentional — provider concerns live outside `core`). Host application configuration must specify the provider at deploy time; this is a Phase 2 implementation choice, not an architectural decision.
- UX details of scope escalation confirmation flow (modal copy, keyboard affordances) belong in a UX design pass; architecture only specifies the enforcement contract.

**Nice-to-Have Gaps:**
- A future addendum could specify the contract-diff tool selection (whether the CI check uses `api-extractor`, `arethetypeswrong`, or a bespoke diff).
- Audit log compression for long-retention scenarios is not addressed in Phase 2 (30 days is small enough that flat NDJSON suffices).

### Phase 2 Architecture Readiness Assessment

**Overall Status:** READY FOR IMPLEMENTATION (Phase 2)

**Confidence Level:** High

**Key Strengths:**
- Additive: zero Phase 1 retraction risk
- Contract-bound editor extraction reduces consumer coupling and enables future embeds
- Write-ahead audit semantics are encoded structurally, not as a convention
- Runtime mode model resolves a real source of cross-environment drift identified in PRD validation
- Phase 3 anchors are declared as forward-compatible extension points, avoiding future retrofits

**Areas for Future Enhancement:**
- Provider adapter strategy and observability of Agent invocations
- Audit log compression and cross-project audit aggregation (Phase 3 territory)
- Cross-runtime asset signing for desktop distribution

### Phase 2 Implementation Handoff

**AI Agent Guidelines (Phase 2 additions):**
- Always route Agent writes through `@anydocs/core/agent/agent-service.ts`
- Never bypass `scope-validator.ts.assertScopeBoundary()`
- Always read runtime mode from `@anydocs/core/runtime/runtime-mode.ts`
- Always import from `@anydocs/editor` package entry, never internal modules
- New cross-mode behaviors go into `capability-matrix.ts`, not inline branches

**First Phase 2 Implementation Priority:**
1. Create `@anydocs/editor` package skeleton with public API contract file and CI diff check (NFR31)
2. Implement `@anydocs/core/runtime/` and the capability matrix
3. Implement `@anydocs/core/audit/` with versioned schema and write-ahead semantics
4. Implement `@anydocs/core/agent/` scope orchestrators wired to audit
5. Build Tauri shell + native fs adapter in `packages/desktop/`
6. Studio dual-mount of `@anydocs/editor` behind feature flag; cross-mount fixture parity tests
7. Studio cutover; Yoopta retirement
8. Desktop adoption of `@anydocs/editor`
