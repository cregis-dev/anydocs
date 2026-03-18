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
  - docs/planning-artifacts/prd.md
  - docs/planning-artifacts/prd-validation-report.md
  - docs/planning-artifacts/prd-validation-report-rerun.md
  - docs/planning-artifacts/prd-validation-report-rerun-2.md
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

The repository is a pnpm monorepo with four primary packages: `@anydocs/web`, `@anydocs/desktop`, `@anydocs/cli`, and `@anydocs/core`. The strongest brownfield baseline exists in `@anydocs/web`, which already includes a Next.js-based reading site, Studio-related UI, local file-system document persistence, generated public search assets, and AI-facing artifacts such as `llms.txt` and MCP JSON outputs. The web package currently uses React 19, Next.js 16, Tailwind 4, Radix/shadcn-style UI primitives, Yoopta-based editing, and MiniSearch-based local search indexing.

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
│   ├── planning-artifacts/
│   │   ├── prd.md
│   │   ├── architecture.md
│   │   └── epics.md
│   └── implementation-artifacts/
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
