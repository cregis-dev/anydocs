---
stepsCompleted:
  - 1
  - 2
  - 3
  - 4
  - phase2-vnext-addendum
inputDocuments:
  - artifacts/bmad/planning-artifacts/prd.md
  - artifacts/bmad/planning-artifacts/architecture.md
  - artifacts/bmad/planning-artifacts/prd-validation-report.md
  - artifacts/bmad/planning-artifacts/prd-validation-report-rerun.md
  - artifacts/bmad/planning-artifacts/prd-validation-report-rerun-2.md
  - artifacts/bmad/planning-artifacts/prd-validation-report-rerun-3.md
sourcePrdRevisions:
  - '2026-03-11 — Phase 1 baseline (50 FR / 25 NFR)'
  - '2026-05-24 — Phase 2 single-user vNext (+ FR51–FR60 + NFR26–NFR33, Phase 3 anchors FR61–FR64 + NFR34, Journey 4)'
phase2VNextAddendumCompletedAt: '2026-05-24'
editHistory:
  - date: '2026-03-11'
    changes: 'Phase 1 epics 1–5 completed (5 epics, ~30 stories covering FR1–FR50).'
  - date: '2026-05-24'
    changes: 'Phase 2 vNext addendum: epics 6–12 covering FR51–FR60 + NFR26–NFR33 (@anydocs/editor extraction, Plate migration, runtime mode, desktop fs via Tauri, audit log, three-scope Agent, scope escalation). Phase 3 anchors recorded but not decomposed.'
---

# anydocs - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for anydocs, decomposing the requirements from the PRD, UX Design if it exists, and Architecture requirements into implementable stories.

## Requirements Inventory

### Functional Requirements

FR1: Documentation maintainers can initialize a new Anydocs project with a standard project structure.
FR2: Documentation maintainers can create a project that includes default configuration required for authoring, orchestration, and site generation.
FR3: Documentation maintainers can inspect and modify project configuration after initialization.
FR4: Documentation maintainers can manage project configuration through Studio.
FR5: Documentation maintainers can run core project lifecycle commands without relying on manual repository setup steps outside the product workflow.
FR6: Documentation maintainers can create documentation content using a standardized content model.
FR7: Documentation maintainers can organize documentation content into a structured information architecture.
FR8: Documentation maintainers can maintain stable document structure independent of final rendering format.
FR9: Documentation maintainers can revise document structure without rebuilding the entire documentation model from scratch.
FR10: Documentation maintainers can manage documentation content in a way that supports later AI-assisted generation and revision.
FR11: The system can preserve a reusable standard workflow for how documentation is created, organized, reviewed, and built.
FR12: The system can expose the standard workflow in a form that can be reused externally as a skill or equivalent workflow artifact.
FR13: Documentation maintainers can view documentation structure and content inside Studio.
FR14: Documentation maintainers can modify documentation structure inside Studio.
FR15: Documentation maintainers can modify documentation content inside Studio.
FR16: Documentation maintainers can use Studio as the primary workspace for documentation review and adjustment.
FR17: Documentation maintainers can use Studio to validate whether generated or imported content conforms to the project’s standard structure.
FR18: Documentation maintainers can trigger project actions from Studio that are consistent with CLI-driven workflows.
FR19: Documentation maintainers can bring externally generated content into the Anydocs standard workflow for further review and orchestration.
FR20: Documentation maintainers can import legacy documentation files into Anydocs for conversion into the standard workflow.
FR21: Documentation maintainers can review and revise AI-generated structure before building and publishing.
FR22: Documentation maintainers can convert imported legacy documentation into the standardized content model before build and publication.
FR23: Documentation maintainers can review and correct converted legacy documentation before it enters the published workflow.
FR24: Documentation maintainers can build a documentation project into a static site.
FR25: Documentation maintainers can preview the generated documentation site locally before publishing.
FR26: Documentation maintainers can use the same project content and configuration across authoring, build, and preview workflows.
FR27: The system can generate a site that reflects the standardized content structure maintained in the project.
FR28: Documentation maintainers can repeat build and preview workflows reliably throughout project iteration.
FR29: Documentation readers can access documentation as a browsable static site.
FR30: Documentation readers can navigate documentation through a structured site hierarchy.
FR31: Documentation readers can consume documentation content rendered from the same underlying content model used in authoring.
FR32: Documentation readers can access documentation pages through stable routes derived from the project structure.
FR33: Documentation maintainers can control which documentation content is included in published output.
FR34: Documentation maintainers can use CLI commands interactively.
FR35: Tools, CI workflows, and AI agents can use CLI commands non-interactively.
FR36: Users can invoke project initialization, build, and preview through a stable command surface.
FR37: CLI users can receive human-readable feedback about command progress, outcomes, and failures.
FR38: Automation workflows can determine whether a CLI command succeeded or failed.
FR39: Documentation maintainers can run iterative workflows that support repeated local changes and verification.
FR40: Documentation readers can search documentation content within the generated site.
FR41: Documentation maintainers can configure the language variants published for a project.
FR42: Documentation readers can switch between available language variants of published documentation.
FR43: Documentation maintainers can generate published AI-friendly documentation artifacts, including `llms.txt`, alongside the documentation site.
FR44: External AI tools and agents can read published machine-readable documentation artifacts exposed by the project.
FR45: Documentation maintainers can ensure that AI-friendly outputs follow the same publication boundaries as reader-facing content.
FR46: Documentation maintainers can maintain documentation in a local-first workflow where project content remains under their direct control.
FR47: Documentation maintainers can use the product without depending on a cloud-only authoring workflow.
FR48: The system can keep Studio workflows and CLI workflows aligned to the same project model and configuration source.
FR49: Documentation maintainers can apply the Anydocs workflow standard across multiple documentation projects without redefining the workflow each time.
FR50: Documentation maintainers can evolve from a minimal Phase 1 workflow to richer later-phase capabilities without replacing the core project structure.

### NonFunctional Requirements

NFR1: The system shall allow a documentation maintainer to initialize a new project in 5 minutes or less on a standard local development machine, as verified by workflow timing tests.
NFR2: The system shall build a documentation site for a typical project of up to 100 pages in less than 30 seconds on a standard local development machine.
NFR3: The system shall start a local preview workflow in 10 seconds or less for a typical project of up to 100 pages, as measured from command invocation to server readiness.
NFR4: The generated documentation site shall render primary page content in 2 seconds or less on broadband connections for the 95th percentile of page loads, as measured by Lighthouse or equivalent browser profiling.
NFR5: The system shall support 20 consecutive local build and preview cycles for a typical project without failures caused by residual process state, as verified by automated workflow tests.
NFR6: The build process shall produce byte-for-byte identical output for three repeated builds from the same project content and configuration on the same supported environment, excluding explicitly documented timestamped metadata.
NFR7: The system shall ensure that 100% of save operations either persist valid content/configuration or fail without partial writes, as verified by integration tests.
NFR8: A change saved in Studio shall be reflected unchanged in the next CLI build or preview run in 100% of source-of-truth regression tests for supported project fixtures.
NFR9: At least 95% of simulated build, preview, and validation failures shall return an error message containing the failure source and at least one remediation hint, as verified by automated error-handling tests.
NFR10: Publication-boundary tests shall confirm that 100% of content marked outside the publication rules is excluded from generated sites and published artifacts.
NFR11: After dependencies are installed, 100% of normal authoring, save, build, and preview workflows shall execute on a supported local machine without requiring an active network connection, as verified by offline workflow tests.
NFR12: Production deployments shall return a non-success response for Studio editing routes and local write APIs in 100% of deployment smoke tests.
NFR13: Publication-boundary tests shall confirm that 100% of AI-friendly outputs and machine-readable interfaces expose only content allowed by the project’s publication rules.
NFR14: 100% of supported authoring, save, build, and preview workflows shall complete without requiring a cloud account, hosted authoring service, or remote storage dependency, as verified by local environment acceptance tests.
NFR15: The generated documentation site shall meet WCAG 2.1 AA for core reading surfaces, as verified by automated accessibility checks plus manual keyboard review.
NFR16: Keyboard-only tests shall complete primary reading flows, including navigation, page reading, search access, and language switching, with 100% task completion across supported browser smoke tests.
NFR17: Automated accessibility checks and manual semantic review shall report zero critical violations for missing headings, landmark structure, labels, or color-only meaning on core reading surfaces.
NFR18: The generated documentation site shall support the latest stable versions of Chrome, Firefox, Safari, and Edge on desktop, plus Safari on iOS and Chrome on Android, as verified by release smoke tests.
NFR19: The CLI shall support macOS and Linux local environments and Linux-based CI runners used in JavaScript workflows, as verified by automated command execution tests.
NFR20: The project structure and configuration shall execute unchanged across supported macOS and Linux environments and Linux CI runners, as verified by build and preview tests on each target.
NFR21: A project created for human-invoked workflows shall execute successfully in non-interactive CLI workflows without requiring a separate project model or configuration format, as verified by CI smoke tests.
NFR22: Projects created from the current documentation standard shall remain compatible across the next minor product release without requiring content-model migration, as verified by release compatibility tests.
NFR23: Reference project fixtures shall produce equivalent content and configuration results when edited in Studio and executed through CLI workflows in 100% of cross-workflow regression tests.
NFR24: Later native AI capabilities shall consume the same project content model and configuration format introduced in Phase 1 without requiring full project reinitialization, as verified by migration compatibility tests.
NFR25: A single maintainer shall be able to execute the documented Phase 1 workflow from project initialization through build and preview using one repository and one local machine, as verified by an end-to-end maintainer workflow test.

### Additional Requirements

- Starter decision: retain the existing brownfield `pnpm` monorepo as the architectural foundation; Epic 1 should begin with shared-core extraction rather than repository re-scaffolding.
- Use the local file system as the Phase 1 system of record; do not introduce a database.
- Extract a shared documentation domain core into `@anydocs/core`.
- Keep `@anydocs/cli` as a thin command layer over shared core services.
- Keep `@anydocs/web` as the primary Studio and reader-facing surface.
- Standardize published-only filtering and publication rules in one shared layer reused by site output, search output, and AI-facing output.
- Target Node.js 22 LTS for development and CI compatibility.
- Use schema-first validation for pages, navigation, and project configuration.
- Keep API style minimal and task-oriented; do not introduce GraphQL for Phase 1.
- Use build-time static search indexing for Phase 1.
- Keep frontend state management lightweight and local-first.
- Treat current MCP and AI-oriented outputs as compatibility-preserving adapters over the same publication model.
- Phase 1 does not include user authentication or role-based authorization.
- Production deployments must not expose editing routes or local write APIs.
- Shared domain behavior must live in `@anydocs/core`; `web`, `cli`, and `desktop` are adapter surfaces.
- Shared domain logic must not remain duplicated under `packages/web/lib/docs` after extraction.
- Shared core functions should return typed results or throw typed domain errors; user-facing layers translate them into CLI/UI messaging.
- Persisted JSON uses `camelCase`; timestamps use ISO 8601 strings; published filtering follows canonical status rules only.
- All project, page, navigation, and publication operations should pass through shared core services.
- Validate at all workflow boundaries: config load, content load, save, build input, and artifact generation.
- `init`, `build`, and `preview` must be deterministic and idempotent where practical.
- Shared build steps run in a stable order: load config, load content, validate, filter published outputs, generate artifacts, report result.
- Architecture target structure introduces explicit `core/config`, `core/schemas`, `core/types`, `core/fs`, `core/services`, `core/publishing`, and `core/errors` ownership areas.
- Web route handlers must delegate business rules to `@anydocs/core`.
- Generated outputs live in build/public artifact directories and are never edited by hand.
- Core tests live in `packages/core/tests`; workflow E2E coverage lives in `packages/web/tests/e2e`.
- Brownfield legacy docs are implementation context only; PRD and architecture are the target-state source of truth.
- Important migration note: move current `packages/web/lib/docs/*` logic and the broader `packages/web/scripts/gen-public-assets.mjs` behavior into `@anydocs/core`.
- First implementation priority from architecture: define canonical schemas and shared content/build services in `@anydocs/core`, then migrate existing `packages/web/lib/docs/*` behavior into that shared layer before expanding CLI or Studio capabilities further.

### FR Coverage Map

FR1: Epic 1 - initialize standard project structure
FR2: Epic 1 - create default project configuration
FR3: Epic 1 - inspect and modify project configuration
FR4: Epic 2 - manage configuration through Studio
FR5: Epic 1 - run core lifecycle without manual setup hacks
FR6: Epic 1 - create content in the standardized model
FR7: Epic 1 - organize structured information architecture
FR8: Epic 1 - preserve stable structure independent of rendering
FR9: Epic 1 - revise structure without rebuilding the whole model
FR10: Epic 1 - keep content AI-ready for later workflows
FR11: Epic 1 - preserve reusable workflow standard
FR12: Epic 1 - expose workflow as reusable skill or artifact
FR13: Epic 2 - view structure and content in Studio
FR14: Epic 2 - modify structure in Studio
FR15: Epic 2 - modify content in Studio
FR16: Epic 2 - use Studio as primary review workspace
FR17: Epic 2 - validate conformance inside Studio
FR18: Epic 2 - trigger project actions from Studio
FR19: Epic 5 - bring external AI-generated content into workflow
FR20: Epic 5 - import legacy documentation
FR21: Epic 5 - review and revise AI-generated structure
FR22: Epic 5 - convert legacy documentation into the standardized model
FR23: Epic 5 - review and correct converted legacy documentation
FR24: Epic 3 - build a static documentation site
FR25: Epic 3 - preview generated site locally
FR26: Epic 3 - reuse the same content and configuration across authoring, build, and preview
FR27: Epic 3 - generate site output from the standardized content structure
FR28: Epic 3 - repeat build and preview reliably
FR29: Epic 3 - provide a browsable static site
FR30: Epic 3 - provide a structured site hierarchy
FR31: Epic 3 - render published content from the same authoring model
FR32: Epic 3 - provide stable routes derived from project structure
FR33: Epic 3 - control what content is published
FR34: Epic 4 - support interactive CLI usage
FR35: Epic 4 - support non-interactive tool and CI usage
FR36: Epic 4 - provide a stable command surface for init, build, and preview
FR37: Epic 4 - provide human-readable CLI feedback
FR38: Epic 4 - provide machine-detectable command success and failure
FR39: Epic 4 - support iterative local verification workflows
FR40: Epic 3 - support site search
FR41: Epic 3 - configure published language variants
FR42: Epic 3 - support language switching for readers
FR43: Epic 5 - generate AI-friendly documentation artifacts
FR44: Epic 5 - expose machine-readable published artifacts to external AI tools
FR45: Epic 5 - keep AI-friendly outputs within publication boundaries
FR46: Epic 1 - maintain a local-first workflow
FR47: Epic 1 - avoid cloud-only authoring dependency
FR48: Epic 1 - align Studio and CLI on the same project model
FR49: Epic 5 - allow the workflow standard to be reused across future projects
FR50: Epic 5 - evolve beyond Phase 1 without replacing the core project structure

## Epic List

### Epic 1: Initialize and Standardize a Documentation Project
Documentation maintainers can create a new Anydocs project, adopt the standard content model and workflow, and manage a reusable project foundation that later Studio, build, and automation flows can rely on.
**FRs covered:** FR1, FR2, FR3, FR5, FR6, FR7, FR8, FR9, FR10, FR11, FR12, FR46, FR47, FR48

### Epic 2: Review and Adjust Documentation in Studio
Documentation maintainers can use Studio as the primary workspace to inspect structure and content, make controlled updates, validate conformance to the standard workflow, and trigger core project actions.
**FRs covered:** FR4, FR13, FR14, FR15, FR16, FR17, FR18

### Epic 3: Build, Preview, and Publish a Reader-Facing Documentation Site
Documentation maintainers can build and preview a static documentation site from the standardized project, control published output, and deliver a usable reader experience with navigation, stable routes, search, and language switching.
**FRs covered:** FR24, FR25, FR26, FR27, FR28, FR29, FR30, FR31, FR32, FR33, FR40, FR41, FR42

### Epic 4: Automate the Workflow Through CLI and Shared Execution Rules
Documentation maintainers, tools, CI pipelines, and AI agents can execute the same documentation workflow through a stable CLI surface with human-readable output, non-interactive operation, repeatable local iteration, and reliable success/failure signaling.
**FRs covered:** FR34, FR35, FR36, FR37, FR38, FR39

### Epic 5: Ingest External Content and Produce AI-Friendly Published Outputs
Documentation maintainers can bring AI-generated or legacy documentation into the Anydocs workflow, review and normalize it before publication, and generate published machine-readable artifacts that follow the same publication boundaries as the reader-facing site.
**FRs covered:** FR19, FR20, FR21, FR22, FR23, FR43, FR44, FR45, FR49, FR50

<!-- Repeat for each epic in epics_list (N = 1, 2, 3...) -->

## Epic 1: Initialize and Standardize a Documentation Project

Documentation maintainers can create a new Anydocs project, adopt the standard content model and workflow, and manage a reusable project foundation that later Studio, build, and automation flows can rely on.

<!-- Repeat for each story (M = 1, 2, 3...) within epic N -->

### Story 1.1: Create the Canonical Project Configuration and Workspace Contract

As a documentation maintainer,
I want Anydocs to define one canonical project configuration and directory contract,
So that every workflow starts from the same local-first project model.

**Acceptance Criteria:**

**Given** a repository using Anydocs
**When** the canonical project contract is introduced
**Then** the expected project config file, page storage layout, navigation layout, and artifact output conventions are documented in code and architecture-aligned types
**And** the contract supports local authoring, build, and preview without requiring a cloud account

**Given** an invalid or incomplete project configuration
**When** core project loading is attempted
**Then** the system identifies the missing or invalid contract fields
**And** returns a structured validation failure instead of using silent fallback behavior

### Story 1.2: Define Shared Schemas and Domain Types in `@anydocs/core`

As a developer agent,
I want page, navigation, and project types plus validation schemas to live in `@anydocs/core`,
So that Studio, CLI, and build workflows share one source of truth.

**Acceptance Criteria:**

**Given** the new `@anydocs/core` package boundary
**When** shared content contracts are implemented
**Then** canonical TypeScript types and schema validators exist for project config, page documents, navigation documents, and publication status values
**And** persisted values follow the agreed `camelCase`, ISO date, and enum conventions

**Given** a consuming surface such as web or CLI
**When** it needs project model types
**Then** it imports them from `@anydocs/core`
**And** no duplicate local copies are introduced for the same domain contracts

### Story 1.3: Implement Core File-System Repositories and Validation Boundaries

As a documentation maintainer,
I want Anydocs core services to load and save project files through shared repositories,
So that content operations remain local-first, validated, and consistent across workflows.

**Acceptance Criteria:**

**Given** a valid Anydocs project on disk
**When** core repository functions load or save pages, navigation, or config
**Then** they use shared path resolution, slug normalization, and schema validation rules
**And** invalid writes fail without partial persistence

**Given** duplicate slugs, missing referenced pages, or invalid page payloads
**When** repository validation runs
**Then** the failure identifies the violating entity and rule
**And** the repository does not persist invalid state

### Story 1.4: Implement `anydocs init` on Top of Core Services

As a documentation maintainer,
I want to initialize a new project with one command,
So that I can start from a ready-to-edit standard documentation workspace.

**Acceptance Criteria:**

**Given** an empty target directory
**When** I run `anydocs init`
**Then** the command creates the standard project structure, default config, and starter content/navigation files
**And** the generated project is immediately usable by Studio, build, and preview workflows

**Given** a target directory with conflicting project files
**When** `anydocs init` is executed
**Then** the command reports the conflict clearly
**And** exits without corrupting existing user content

### Story 1.5: Expose the Reusable Workflow Standard for External AI and Future Phases

As a documentation maintainer,
I want the Anydocs project model and workflow standard to be reusable outside the UI,
So that external AI tools and later product phases can follow the same contract.

**Acceptance Criteria:**

**Given** the canonical project contract and shared schemas
**When** workflow metadata or exportable guidance is produced
**Then** it describes the standard content model, required project files, publication statuses, and orchestration expectations
**And** it is consumable by external automation without depending on Studio-specific behavior

**Given** a future workflow using the same standard
**When** it creates or modifies project content
**Then** the resulting files remain compatible with the same Phase 1 content model and configuration format
**And** no project reinitialization is required

## Epic 2: Review and Adjust Documentation in Studio

Documentation maintainers can use Studio as the primary workspace to inspect structure and content, make controlled updates, validate conformance to the standard workflow, and trigger core project actions.

### Story 2.1: Load Projects and Content in Studio Through Core Adapters

As a documentation maintainer,
I want Studio to load project configuration, pages, and navigation through core services,
So that the UI reflects the same source of truth used by CLI and build workflows.

**Acceptance Criteria:**

**Given** a valid Anydocs project
**When** Studio opens the workspace
**Then** it loads project config, navigation, and page data through `@anydocs/core`
**And** the displayed state matches what the next CLI build would use

**Given** a project loading error
**When** Studio requests data from core
**Then** the UI shows a user-actionable error message
**And** does not create local shadow state that differs from the project files

### Story 2.2: Edit and Save Page Content with Shared Validation

As a documentation maintainer,
I want to edit page content in Studio and save it safely,
So that document updates remain valid and immediately reusable by build and preview.

**Acceptance Criteria:**

**Given** an existing page in Studio
**When** I modify its content or metadata and save
**Then** the save operation runs through shared core validation before persistence
**And** successful saves write only valid page documents to disk

**Given** invalid content or metadata
**When** I attempt to save
**Then** Studio surfaces the validation failure with the reason and remediation context
**And** leaves the previously valid persisted file unchanged

### Story 2.3: Manage Navigation, Publication State, and Project Settings in Studio

As a documentation maintainer,
I want to adjust navigation, page ordering, publication status, and project settings in Studio,
So that I can control what gets published and how the documentation is organized.

**Acceptance Criteria:**

**Given** a project opened in Studio
**When** I change navigation structure, page references, publication status, or project-level settings
**Then** the updates are validated through core services before being persisted
**And** invalid references such as missing page IDs or conflicting slugs are rejected clearly

**Given** pages in different publication states
**When** I save changes in Studio
**Then** the persisted state preserves those publication markers
**And** later build workflows can apply the same canonical publication rules

**Given** a page referenced by the current language navigation
**When** I delete that page from Studio
**Then** the current language page document is removed
**And** all matching navigation references for that language are removed in the same operation

**Given** project settings and navigation roots that need adjustment
**When** I update enabled languages, build output configuration, or add page and link references at the root or inside groups
**Then** the persisted project and navigation files remain valid for the next preview or build workflow

### Story 2.4: Trigger Build and Preview Actions from Studio

As a documentation maintainer,
I want Studio to trigger the same build and preview workflows exposed by CLI,
So that I can verify project output without leaving the primary workspace.

**Acceptance Criteria:**

**Given** a valid project in Studio
**When** I trigger build or preview from the UI
**Then** Studio calls the same underlying workflow functions used by CLI
**And** the resulting output or error state matches the shared core behavior

**Given** a build or preview failure
**When** Studio receives the failure
**Then** it displays a human-readable message derived from the structured core error
**And** identifies the failing step or input when available

## Epic 3: Build, Preview, and Publish a Reader-Facing Documentation Site

Documentation maintainers can build and preview a static documentation site from the standardized project, control published output, and deliver a usable reader experience with navigation, stable routes, search, and language switching.

### Story 3.1: Build the Published-Only Content Pipeline in Core

As a documentation maintainer,
I want the build pipeline to load validated project content and filter it by publication rules,
So that only intended content reaches the published site and generated artifacts.

**Acceptance Criteria:**

**Given** a project containing draft, in-review, and published content
**When** the build pipeline runs
**Then** core applies one canonical publication filter before generating site or machine-readable outputs
**And** unpublished content is excluded from all published outputs

**Given** repeated builds from unchanged input
**When** the build pipeline runs multiple times
**Then** the output is deterministic under the documented conditions
**And** the publication filter result is identical across runs

### Story 3.2: Render the Reader-Facing Documentation Site from the Shared Content Model

As a documentation reader,
I want to browse documentation pages with stable routes and navigation,
So that I can read the published content clearly and predictably.

**Acceptance Criteria:**

**Given** published project content and navigation
**When** the site is generated or served
**Then** routes, navigation hierarchy, and page rendering are derived from the same standardized model used in authoring
**And** page URLs remain stable based on the project structure and slug rules

**Given** a page that is not published or is missing
**When** a reader requests its route
**Then** the site does not expose unpublished content
**And** the reader receives the expected not-found or excluded outcome

### Story 3.3: Provide a Shared Preview Workflow for Local Verification

As a documentation maintainer,
I want to preview the generated site locally using the same core workflow as build,
So that I can verify published output before deployment.

**Acceptance Criteria:**

**Given** a valid project
**When** I run preview through the shared workflow
**Then** the preview server starts from the same validated content and publication pipeline as build
**And** the preview is ready within the documented performance boundary for a typical project

**Given** project content changes between runs
**When** I rerun preview or iterative preview checks
**Then** the visible output reflects the latest saved source-of-truth state
**And** no stale residual process state causes false results

### Story 3.4: Generate Search and Language-Aware Reader Navigation

As a documentation reader,
I want to search the published documentation and switch between available languages,
So that I can find the right content in the right language quickly.

**Acceptance Criteria:**

**Given** a project with published content in one or more languages
**When** the site build runs
**Then** search indexes and language-aware navigation data are generated from the published project content
**And** the site exposes only configured language variants for the project

**Given** a reader using the published site
**When** they search or switch language
**Then** the site returns results and routes that correspond to the published content set
**And** unavailable language variants are not presented as valid published destinations

### Story 3.5: Generate Published AI-Friendly Artifacts from the Same Build Model

As a documentation maintainer,
I want AI-friendly published artifacts to be generated alongside the site,
So that external tools can consume the same approved documentation corpus.

**Acceptance Criteria:**

**Given** a successful site build
**When** AI-friendly artifacts such as `llms.txt` and machine-readable indexes are generated
**Then** they are derived from the same validated and published-only content set as the reader-facing site
**And** they are emitted into generated artifact locations rather than hand-maintained source files

**Given** unpublished content in the source project
**When** AI-friendly artifacts are generated
**Then** that content is excluded
**And** the artifact output respects the same canonical publication boundaries as the site

## Epic 4: Automate the Workflow Through CLI and Shared Execution Rules

Documentation maintainers, tools, CI pipelines, and AI agents can execute the same documentation workflow through a stable CLI surface with human-readable output, non-interactive operation, repeatable local iteration, and reliable success/failure signaling.

### Story 4.1: Rebuild the CLI as a Thin Adapter Over Core Services

As a CLI user,
I want `init`, `build`, and `preview` commands to delegate to shared core services,
So that terminal workflows behave the same as Studio and build internals.

**Acceptance Criteria:**

**Given** the CLI package
**When** command handlers are implemented
**Then** each command performs argument parsing, logging, and exit handling only
**And** business rules execute through shared core services rather than local duplicated logic

**Given** a core workflow update
**When** the CLI command is run
**Then** command behavior reflects the updated shared implementation
**And** no separate CLI-only rule path is required

### Story 4.2: Support Interactive and Non-Interactive Command Execution

As a documentation maintainer or automation tool,
I want CLI commands to work both interactively and non-interactively,
So that local users, CI jobs, and AI agents can all run the same workflow.

**Acceptance Criteria:**

**Given** an interactive local shell
**When** I run `anydocs init`, `anydocs build`, or `anydocs preview`
**Then** the command provides readable progress feedback suitable for human operators
**And** explicit arguments suppress unnecessary prompting

**Given** a non-interactive environment such as CI
**When** the same commands are executed with explicit inputs
**Then** they complete without requiring interactive prompts
**And** they operate on the same project model and configuration format used for human-invoked workflows

### Story 4.3: Standardize CLI Output, Error Messages, and Exit Codes

As a tool or CLI user,
I want command outcomes to be readable for humans and unambiguous for automation,
So that failures can be understood quickly and detected reliably.

**Acceptance Criteria:**

**Given** a successful command run
**When** the CLI completes
**Then** it prints human-readable progress and result output
**And** returns a success exit code suitable for automation

**Given** a validation, build, or preview failure
**When** the CLI exits
**Then** it returns a non-success exit code
**And** the error output identifies the failure source plus at least one remediation hint when available

### Story 4.4: Support Repeatable Iteration and Watch-Friendly Workflow Execution

As a documentation maintainer,
I want CLI workflows to support repeated local verification and watch-style iteration,
So that I can update content and confirm results without process-state drift.

**Acceptance Criteria:**

**Given** a typical project under local development
**When** I run repeated build or preview cycles, including watch-style execution where supported
**Then** the workflows reuse the same validation and generation steps as one-shot commands
**And** they remain deterministic and free from residual-state failures across the documented regression cycles

**Given** saved Studio changes
**When** the next CLI build or preview executes
**Then** it reflects the same source-of-truth project state
**And** cross-workflow consistency tests continue to pass

## Epic 5: Ingest External Content and Produce AI-Friendly Published Outputs

Documentation maintainers can bring AI-generated or legacy documentation into the Anydocs workflow, review and normalize it before publication, and generate published machine-readable artifacts that follow the same publication boundaries as the reader-facing site.

### Story 5.1: Import Legacy Documentation into the Standard Workflow

As a documentation maintainer,
I want to import legacy documentation files into Anydocs,
So that existing documentation can enter the standardized workflow without manual recreation.

**Acceptance Criteria:**

**Given** a supported legacy documentation input
**When** I invoke the import workflow
**Then** the content is loaded into an Anydocs conversion path rather than being published directly
**And** the import result preserves enough source structure and metadata for later review

**Given** unsupported or malformed legacy input
**When** import is attempted
**Then** the system reports the conversion failure clearly
**And** does not introduce partially converted published content into the project

### Story 5.2: Convert Imported Content into the Standardized Content Model

As a documentation maintainer,
I want imported content to be converted into the canonical Anydocs model,
So that it can be reviewed, edited, and built like natively authored content.

**Acceptance Criteria:**

**Given** imported legacy content
**When** conversion runs
**Then** the result is expressed as the same page, navigation, and project model used by native Anydocs workflows
**And** converted content must pass the same schema validation boundaries before it is accepted

**Given** conversion ambiguities or unsupported constructs
**When** the converter cannot map them cleanly
**Then** the output is flagged for maintainer review
**And** the system avoids silently publishing uncertain transformations

### Story 5.3: Review and Correct External or AI-Generated Content Before Publication

As a documentation maintainer,
I want imported or AI-generated content to enter a review path before publication,
So that only verified content reaches the published workflow.

**Acceptance Criteria:**

**Given** external or AI-generated structure/content
**When** it enters the Anydocs workflow
**Then** it remains editable and reviewable before publication
**And** maintainers can correct structure, metadata, and publication status before build output includes it

**Given** reviewed imported or AI-generated content
**When** it is approved for publication
**Then** it follows the same status and publication rules as natively authored documentation
**And** later build outputs treat it no differently from standard project content

### Story 5.4: Expose Published Machine-Readable Artifacts for External AI Consumers

As an external AI tool or automation consumer,
I want machine-readable published artifacts to be available from the Anydocs project,
So that I can read approved documentation without depending on Studio internals.

**Acceptance Criteria:**

**Given** a successful published build
**When** machine-readable documentation artifacts are emitted
**Then** they expose only approved published content
**And** they are derived from the same core publication model as the site and `llms.txt`

**Given** an external consumer reading those artifacts
**When** it accesses the generated output
**Then** the artifact structure is stable enough for automation use
**And** it does not require product-internal UI state or private editing APIs

### Story 5.5: Preserve Forward Compatibility for Workflow Reuse and Future AI-Native Capabilities

As a product maintainer,
I want the Phase 1 workflow model to remain compatible with future projects and native AI features,
So that later capabilities can extend the platform without replacing its core structure.

**Acceptance Criteria:**

**Given** the Phase 1 project model and generated workflow standard
**When** the same standard is reused across additional documentation projects
**Then** the model can be applied without redefining the workflow contract each time
**And** the reuse does not require a different content or configuration format

**Given** a later product phase introducing native AI capabilities
**When** it consumes existing Anydocs projects
**Then** it uses the same core project model introduced in Phase 1
**And** compatibility tests confirm that full project reinitialization is not required

### Story 5.6: Expand AI-Readable Published Artifacts and Reposition Reader Search as Find

As a documentation maintainer,
I want richer AI-readable published artifacts alongside a Find-oriented reader search experience,
So that external agents can consume grounded published content while human readers still discover pages quickly without depending on in-product AI Ask.

**Acceptance Criteria:**

**Given** a successful published build
**When** AI-readable artifacts are generated
**Then** the output includes `llms.txt`, `llms-full.txt`, machine-readable page and navigation indexes, and per-language chunk artifacts
**And** all of them are derived from the same canonical published-only content set as the reader-facing site

**Given** an external consumer reading the generated artifacts
**When** it inspects the machine-readable output
**Then** it can discover chunk-level content through stable artifact metadata
**And** it does not require Studio internals, private APIs, or reader HTML state to use the published corpus

**Given** a human reader using the docs site
**When** they use site search
**Then** the experience remains focused on quickly finding pages and sections
**And** the UI does not imply in-product AI answer generation

<!-- End story repeat -->

---

# Phase 2 — Single-User vNext Addendum

**Appended:** 2026-05-24
**Source PRD:** Phase 2 single-user vNext expansion (FR51–FR60 + NFR26–NFR33; Phase 3 anchors FR61–FR64 + NFR34; Journey 4)
**Source Architecture:** `architecture.md` Phase 2 vNext Architecture Addendum
**Relationship to Phase 1 Epics:** Additive. Epics 1–5 remain authoritative for Phase 1 capabilities. Epics 6–12 decompose Phase 2 vNext requirements without modifying Phase 1 scope. Phase 3 requirements (FR61–FR64, NFR34) are **not decomposed**; they remain architectural anchors per the addendum.

## Phase 2 Requirements Inventory

### Phase 2 Functional Requirements

FR51: Documentation maintainers can invoke inline, page, and workspace scope Agent interactions from inside the Studio editor against the active content.
FR52: Documentation maintainers on the desktop runtime (runtime mode = `desktop`) can read and write project files directly through native filesystem access without going through the web local APIs.
FR53: Documentation maintainers can trigger an inline Agent whose write scope is restricted to the currently edited content block; writes outside the block are rejected.
FR54: Documentation maintainers can trigger a page Agent whose write scope is restricted to a single pageId; writes outside the targeted page are rejected.
FR55: Documentation maintainers can trigger a workspace Agent whose write scope covers multiple pages and navigation within the project, with every targeted resource recorded.
FR56: The system persists a structured audit log entry before any Agent write takes effect (write-ahead); if audit persistence fails, the Agent write must roll back or be rejected so no audit-missing write can occur.
FR57: Documentation maintainers can query the audit log by scope, target resource, and time range, and can roll back any individual logged Agent operation to its pre-change state.
FR58: Documentation maintainers can observe the active runtime mode (`web` or `desktop`) via an explicit indicator in Studio, and the system applies the corresponding capability boundary consistently.
FR59: Agent write scope is explicitly visible in Studio at the time of invocation, and any scope escalation (inline → page, page → workspace) requires explicit user confirmation before execution.
FR60: The system exposes the editor as an independent package (`@anydocs/editor`) with a declared public API contract; consumers (Studio, desktop shell, future embeds) integrate only through that contract.

**Phase 3 anchors (not decomposed in Phase 2):**

FR61 *(Phase 3)*: project-level `mode` field (`single` / `team`)
FR62 *(Phase 3)*: multi-maintainer collaboration with authorship attribution
FR63 *(Phase 3)*: remote MCP service with authentication + read-only profile
FR64 *(Phase 3)*: team-mode Agent permission boundaries + audit retention governance

### Phase 2 Non-Functional Requirements

NFR26: The desktop runtime shall transition from cold start to an editable state in 3 seconds or less for the 95th percentile on a standard local development machine, as measured by desktop end-to-end startup timing tests.
NFR27: 100% of desktop filesystem write operations shall complete atomically (either fully persisted or invisibly failed) without partial writes, as verified by integration tests with injected write failures.
NFR28: Agent end-to-end response time shall meet the following 95th-percentile bounds under normal upstream conditions: inline Agent ≤ 3 seconds, page Agent ≤ 8 seconds, workspace Agent single-step streaming feedback ≤ 2 seconds. Under degraded upstream conditions, all bounds are allowed to increase by up to 50%.
NFR29: 100% of Agent write operations shall follow write-ahead audit semantics: an audit log entry must be persisted before the Agent write takes effect; if audit persistence fails, the Agent write shall be rolled back or rejected.
NFR30: The audit log schema shall be defined as a versioned JSON schema anchored in architecture documentation; any schema change shall require a schema version bump; audit entries shall be retained for at least 30 days on the local project store.
NFR31: The `@anydocs/editor` package shall ship a public API contract file in the repository; CI shall fail when the declared contract diverges from the actual exported surface.
NFR32: Switching between runtime modes (`web` ↔ `desktop`) shall not break previously saved doc-content-v1 content or navigation structures in 100% of cross-mode round-trip fixture tests.
NFR33: 100% of Agent scope escalations (inline → page, page → workspace) shall require explicit user confirmation; unconfirmed escalation writes shall be rejected.

**Phase 3 anchor (not decomposed in Phase 2):**

NFR34 *(Phase 3)*: remote MCP service returns 401/403 on missing auth and 405 on write-tool calls against read-only profile.

### Phase 2 Additional Requirements (from Architecture Addendum)

- Introduce new package `@anydocs/editor` with a contract file at `packages/editor/contract/public-api.ts` and generated `contract.json` diffed in CI.
- Add new core modules: `@anydocs/core/src/agent/`, `@anydocs/core/src/audit/`, `@anydocs/core/src/runtime/`, `@anydocs/core/src/schemas/audit-entry-schema.ts`.
- Add Tauri shell under `packages/desktop/src-tauri/` with Rust-side native fs commands and atomic write-temp-then-rename semantics.
- Add `desktop-fs-adapter.ts` in `@anydocs/core/src/fs/` implementing `ContentRepository` over Tauri IPC.
- Preserve `doc-content-v1` as canonical storage; Plate is the runtime engine, never the storage format.
- Editor consumers (`@anydocs/web`, `@anydocs/desktop`) must import only from the declared package contract — no reaching into internal modules.
- Runtime mode resolution occurs exactly once at process bootstrap; consumers read from a typed getter, never probe the environment.
- Audit log lives at `<projectRoot>/.anydocs/audit/` as daily NDJSON shards (`YYYY-MM-DD.ndjson`).
- Scope escalation enforcement is dual-layer: UI confirmation modal + signed escalation token verified by `agent-service.ts`.
- LLM provider concerns are abstracted behind `provider-port.ts`; no vendor name appears in `@anydocs/core`.
- Phase 3 anchors are forward-compatible extension points only (optional schema fields, reserved directory layouts) — Phase 2 must not implement Phase 3 capabilities.

### Phase 2 FR Coverage Map

FR51: Epic 11 - editor agent anchors + Epic 6 contract surface for `triggerAgent`
FR52: Epic 9 - desktop native filesystem access bypassing `/api/local/*`
FR53: Epic 11 - inline Agent scope orchestrator
FR54: Epic 11 - page Agent scope orchestrator
FR55: Epic 11 - workspace Agent scope orchestrator
FR56: Epic 10 - write-ahead audit lifecycle + Epic 11 wiring through agent-service
FR57: Epic 10 - audit query API + rollback service
FR58: Epic 8 - runtime mode resolver + Studio RuntimeModeIndicator
FR59: Epic 12 - scope escalation confirmation enforcement (UI + token)
FR60: Epic 6 - `@anydocs/editor` package extraction + public API contract

NFR26: Epic 9 - desktop startup budget enforcement
NFR27: Epic 9 - atomic write-temp-then-rename pattern + fault injection
NFR28: Epic 11 - per-scope Agent latency budgets + integration tests
NFR29: Epic 10 - write-ahead enforcement + Epic 11 fault-injection regression
NFR30: Epic 10 - schema versioning + retention prune
NFR31: Epic 6 - editor API contract diff in CI
NFR32: Epic 8 - cross-mode round-trip fixture tests
NFR33: Epic 12 - escalation confirmation e2e

### Phase 2 Epic List

#### Epic 6: Extract Editor as `@anydocs/editor` Package
Documentation maintainers gain a contract-bound editor package that Studio, desktop, and future embeds consume only through a declared public API, with Plate as the internal runtime and `doc-content-v1` preserved as canonical storage.
**FRs covered:** FR60
**NFRs covered:** NFR31

#### Epic 7: Migrate Studio from Yoopta to `@anydocs/editor`
Studio cuts over from the embedded Yoopta integration to the new `@anydocs/editor` package via a feature-flagged dual-mount with parity fixtures, then retires the legacy integration.
**FRs covered:** FR60 (consumer side)

#### Epic 8: Runtime Mode Model and Capability Matrix
The system declares `runtime mode` (`web` | `desktop`) once at process bootstrap, surfaces it visibly in Studio, applies the matching capability boundary consistently across consumers, and proves cross-mode content compatibility through round-trip fixtures.
**FRs covered:** FR58
**NFRs covered:** NFR32

#### Epic 9: Desktop Runtime with Native Filesystem
A Tauri-based desktop shell hosts the same web bundle, signals runtime mode = `desktop`, and routes all read/write through native fs commands with atomic write semantics — eliminating any call to `/api/local/*` from the desktop call graph.
**FRs covered:** FR52
**NFRs covered:** NFR26, NFR27

#### Epic 10: Audit Log Subsystem with Write-Ahead Semantics
A project-local audit log records every Agent write under a versioned JSON schema with `pending → committed | rejected` lifecycle, supports queries by scope/resource/time, exposes rollback, and prunes entries past the 30-day retention window.
**FRs covered:** FR56 (partial), FR57
**NFRs covered:** NFR29 (partial), NFR30

#### Epic 11: Built-in Agent Subsystem (Inline / Page / Workspace)
Three Agent scope orchestrators enforce write boundaries at the core layer, route every write through the audit log via `agent-service.ts`, expose anchors in `@anydocs/editor`, and meet per-scope latency budgets.
**FRs covered:** FR51, FR53, FR54, FR55, FR56 (complete)
**NFRs covered:** NFR28, NFR29 (complete)

#### Epic 12: Scope Escalation Confirmation Enforcement
Studio renders scope as a visible badge, demands explicit confirmation for any scope escalation, and signs an escalation token that `agent-service.ts` re-verifies server-side — so UI bypass cannot silently widen Agent reach.
**FRs covered:** FR59
**NFRs covered:** NFR33

<!-- End Phase 2 epic list -->

## Epic 6: Extract Editor as `@anydocs/editor` Package

Documentation maintainers gain a contract-bound editor package that Studio, desktop, and future embeds consume only through a declared public API, with Plate as the internal runtime and `doc-content-v1` preserved as canonical storage.

### Story 6.1: Scaffold `@anydocs/editor` Package and Public API Contract File

As a developer agent,
I want a new `@anydocs/editor` package with an explicit public API contract file,
So that consumers integrate through a stable, diff-checkable surface from day one.

**Acceptance Criteria:**

**Given** the existing pnpm workspace
**When** the editor package is scaffolded
**Then** a new `packages/editor/` directory exists with `package.json`, `tsconfig.json`, `src/index.ts`, and `contract/public-api.ts`
**And** the package builds and emits typings under TypeScript strict mode

**Given** the contract file `contract/public-api.ts`
**When** it declares the public API
**Then** it exports only `createEditor`, `EditorConfig`, `EditorInstance`, `EditorPlugin`, and the `registerPlugin` entry point
**And** internal Plate types are not re-exported through the package entry

### Story 6.2: Implement Plate-Based Block Runtime Inside the Package

As a developer agent,
I want the editor package to host a Plate-based block runtime internally,
So that the public contract is backed by a modern, extensible runtime.

**Acceptance Criteria:**

**Given** the `@anydocs/editor/src/runtime/plate-runtime.ts` module
**When** `createEditor` is called with a valid `EditorConfig`
**Then** an `EditorInstance` is returned that mounts a Plate-backed editor view to the provided host element
**And** mount/unmount cycles leave no orphan DOM nodes or event listeners

**Given** an `EditorInstance`
**When** the host calls `getContent()`
**Then** the returned value matches the canonical `doc-content-v1` shape
**And** the value is deterministic for the same editor state

### Story 6.3: Implement `doc-content-v1` ↔ Plate Converters

As a developer agent,
I want bidirectional converters between `doc-content-v1` and Plate's internal value,
So that canonical storage stays stable regardless of runtime evolution.

**Acceptance Criteria:**

**Given** a reference fixture set of `doc-content-v1` payloads
**When** each fixture is converted to Plate value and back to `doc-content-v1`
**Then** the round-trip output is structurally equivalent to the input for 100% of fixtures
**And** any unsupported block type triggers a typed conversion error rather than silent data loss

**Given** an invalid block type in `doc-content-v1`
**When** conversion runs
**Then** the converter rejects the payload with a structured validation error identifying the offending block

### Story 6.4: Define `EditorPlugin` Contract and Migrate Built-in Block Types

As a developer agent,
I want a declarative `EditorPlugin` contract,
So that built-in and future block types integrate through one extensibility surface.

**Acceptance Criteria:**

**Given** the `EditorPlugin` contract in `@anydocs/editor/src/plugins/plugin-contract.ts`
**When** a plugin is registered via `registerPlugin`
**Then** the contract enforces block type id, schema fragment aligned with `doc-content-v1` allowed types, and converter hooks
**And** plugins that emit invalid blocks are rejected by the converter layer

**Given** the documentation-essential block set (heading, paragraph, list, code, image, callout, table, divider)
**When** built-in plugins are migrated
**Then** all eight block types are implemented as plugins under `@anydocs/editor/src/plugins/builtin/`
**And** the resulting editor matches the existing Phase 1 minimal block-set policy

### Story 6.5: Add CI Contract-Diff Check for `@anydocs/editor`

As a developer agent,
I want CI to fail when the declared public API contract diverges from actual exports,
So that consumers detect breaking changes before they ship.

**Acceptance Criteria:**

**Given** the `contract/public-api.ts` source and a generated `contract.json` snapshot
**When** the contract-diff CI step runs
**Then** any addition, removal, rename, or signature change relative to the snapshot causes CI to fail
**And** the failure message points to the diverging symbol

**Given** an intentional contract change committed alongside an updated snapshot
**When** CI runs
**Then** the diff matches and the step passes
**And** the snapshot serves as the authoritative declared surface for downstream consumers

## Epic 7: Migrate Studio from Yoopta to `@anydocs/editor`

Studio cuts over from the embedded Yoopta integration to the new `@anydocs/editor` package via a feature-flagged dual-mount with parity fixtures, then retires the legacy integration.

### Story 7.1: Build `editor-host` Adapter in `@anydocs/web`

As a developer agent,
I want a host adapter in `packages/web/lib/editor-host/` that consumes `@anydocs/editor`,
So that Studio screens can mount the new editor without touching internal package modules.

**Acceptance Criteria:**

**Given** the new `editor-host` adapter
**When** Studio code requests an editor instance
**Then** the adapter calls `createEditor` from `@anydocs/editor` only through the declared contract
**And** the Studio call graph contains no direct imports from `@anydocs/editor` internal modules

**Given** an existing Studio fixture
**When** the host adapter is used
**Then** save/load operations remain compatible with existing repository services in `@anydocs/core`
**And** content read via `getContent()` round-trips through `setContent()` without divergence

### Story 7.2: Studio Dual-Mount with Feature Flag and Parity Fixtures

As a documentation maintainer,
I want Studio to host both the legacy Yoopta integration and the new editor behind a feature flag,
So that the migration can be validated in production-equivalent conditions before cutover.

**Acceptance Criteria:**

**Given** the feature flag `STUDIO_EDITOR=anydocs-editor`
**When** Studio loads
**Then** the editor surface is rendered by `@anydocs/editor` through the host adapter
**And** the legacy Yoopta surface is fully bypassed in this mode

**Given** a reference project fixture set
**When** parity tests run across both modes (legacy vs `@anydocs/editor`)
**Then** content produced in either mode round-trips identically through `doc-content-v1`
**And** zero block-level divergences are observed across all fixtures

### Story 7.3: Studio Cutover and Retire Yoopta Integration

As a documentation maintainer,
I want the new editor to become the default in Studio after parity passes,
So that Yoopta-specific code can be removed cleanly.

**Acceptance Criteria:**

**Given** parity fixtures pass for 100% of reference projects
**When** the feature flag default is flipped to `anydocs-editor`
**Then** Studio mounts `@anydocs/editor` by default in all environments where Studio is enabled
**And** the legacy Yoopta integration code paths and dependencies are removed from `packages/web`

**Given** Studio runs after cutover
**When** automated regression tests execute
**Then** all Phase 1 Studio acceptance criteria still pass
**And** no remaining import or runtime dependency on Yoopta exists in the web package

## Epic 8: Runtime Mode Model and Capability Matrix

The system declares `runtime mode` (`web` | `desktop`) once at process bootstrap, surfaces it visibly in Studio, applies the matching capability boundary consistently across consumers, and proves cross-mode content compatibility through round-trip fixtures.

### Story 8.1: Implement Runtime Mode Resolver in `@anydocs/core`

As a developer agent,
I want a single runtime mode resolver in `@anydocs/core/src/runtime/`,
So that all consumers read mode from one immutable source.

**Acceptance Criteria:**

**Given** the `runtime-mode.ts` module
**When** `resolveRuntimeMode()` is called at process bootstrap
**Then** it returns one of `'web' | 'desktop'` based on explicit host injection or a defensive capability probe
**And** subsequent reads via the typed getter return the same value for the process lifetime

**Given** an ambiguous environment where mode cannot be determined
**When** the resolver runs
**Then** it fails fast with a typed error rather than defaulting silently
**And** consumers cannot start in an undefined mode

### Story 8.2: Define Capability Matrix and Migrate Consumers

As a developer agent,
I want a typed `capability-matrix.ts` that enumerates per-mode behavioral differences,
So that cross-mode branches stay in one place rather than scattered across UI code.

**Acceptance Criteria:**

**Given** the capability matrix
**When** consumers branch on runtime mode
**Then** every branch reads from the matrix
**And** lint or code-review rejects inline `if (runtimeMode === ...)` branches in consumer code

**Given** a new cross-mode capability is added
**When** the matrix is updated
**Then** consumers automatically pick up the new capability through the typed contract
**And** no consumer code change is required for matrix-driven behaviors

### Story 8.3: Surface `RuntimeModeIndicator` in Studio

As a documentation maintainer,
I want Studio to display the active runtime mode in the status bar,
So that I never confuse web-mode behavior with desktop-mode behavior.

**Acceptance Criteria:**

**Given** Studio mounted in any runtime mode
**When** the status bar renders
**Then** a `RuntimeModeIndicator` component is visible with a label ("web" or "desktop") and matching badge
**And** the indicator is keyboard-accessible and uses text + color (no color-only meaning)

**Given** an automated smoke test against Studio
**When** the test loads the status bar
**Then** the indicator's text matches the resolved runtime mode for 100% of supported environments

### Story 8.4: Cross-Mode Content Round-Trip Fixture Tests (NFR32)

As a developer agent,
I want fixture tests that confirm `doc-content-v1` content and navigation survive `web` ↔ `desktop` round trips,
So that mode switching is content-safe by construction.

**Acceptance Criteria:**

**Given** a reference project fixture authored in web mode
**When** the same project is opened in desktop mode and saved without intentional changes
**Then** the resulting `doc-content-v1` payloads are byte-equivalent for 100% of fixtures
**And** navigation files remain unchanged across the round trip

**Given** a project authored in desktop mode
**When** opened in web mode and saved without intentional changes
**Then** the round trip is byte-equivalent for 100% of fixtures

## Epic 9: Desktop Runtime with Native Filesystem

A Tauri-based desktop shell hosts the same web bundle, signals runtime mode = `desktop`, and routes all read/write through native fs commands with atomic write semantics — eliminating any call to `/api/local/*` from the desktop call graph.

### Story 9.1: Scaffold Tauri Shell in `packages/desktop/src-tauri/`

As a developer agent,
I want a Tauri shell scaffolded under `packages/desktop/src-tauri/`,
So that desktop builds package the web bundle plus a Rust-side bridge for native operations.

**Acceptance Criteria:**

**Given** the desktop package
**When** the Tauri scaffolding is added
**Then** `packages/desktop/src-tauri/` contains `tauri.conf.json`, `src/main.rs`, and a command module directory
**And** `pnpm build:desktop` produces a runnable shell that loads the existing web export

**Given** the Tauri shell configuration
**When** it boots
**Then** it signals runtime mode = `desktop` to the renderer before any application code runs
**And** network calls from the renderer to `/api/local/*` are configured to be blocked at the shell layer

### Story 9.2: Implement Rust-Side Native fs Commands with Path Safety

As a developer agent,
I want Rust-side fs commands that read, write, list, and delete project files,
So that the renderer can perform fs operations without an HTTP layer.

**Acceptance Criteria:**

**Given** the `fs_commands.rs` module
**When** a renderer invokes a command with a path
**Then** the command canonicalizes the path and rejects any target outside the active project root
**And** symbolic links across the project boundary are not followed

**Given** a write command
**When** it executes
**Then** the file is written using a write-temp-then-rename pattern
**And** failed writes leave the original file unchanged

### Story 9.3: Implement `desktop-fs-adapter.ts` in `@anydocs/core`

As a developer agent,
I want a `desktop-fs-adapter.ts` in `@anydocs/core/src/fs/`,
So that desktop mode reuses the same `ContentRepository` abstractions as web mode.

**Acceptance Criteria:**

**Given** the `ContentRepository` interface in `@anydocs/core`
**When** the desktop adapter is implemented over Tauri IPC
**Then** every existing repository method has a desktop adapter equivalent that calls a Rust fs command
**And** the adapter exposes typed `FsWriteError` / `FsReadError` domain errors on failure

**Given** existing core services
**When** they execute in desktop mode
**Then** they call the same service entry points as in web mode
**And** no service contains code that branches on adapter implementation details

### Story 9.4: Atomic Write Fault-Injection Tests (NFR27)

As a developer agent,
I want fault-injection tests that prove atomic write semantics on the desktop adapter,
So that NFR27's no-partial-write guarantee is verifiable in CI.

**Acceptance Criteria:**

**Given** a write operation simulated to fail mid-flight
**When** the test injects the failure at the temp-write or rename step
**Then** the original file is unchanged on disk in 100% of injected runs
**And** the caller receives a typed `FsWriteError`

**Given** a write operation that succeeds
**When** the test inspects the final file state
**Then** the file contains the full expected content with no partial bytes from a previous attempt

### Story 9.5: Wire Desktop Renderer to `@anydocs/editor` and Runtime Mode

As a documentation maintainer,
I want the desktop renderer to host `@anydocs/editor` under runtime mode = `desktop`,
So that the editing surface is identical across web and desktop while the host capabilities differ.

**Acceptance Criteria:**

**Given** the desktop shell running
**When** the renderer initializes
**Then** it reads runtime mode = `desktop` from the resolver
**And** it mounts `@anydocs/editor` through the same host adapter pattern used by web mode

**Given** an editing session in desktop mode
**When** content is saved
**Then** the save flows through `@anydocs/core` services backed by the desktop fs adapter
**And** the resulting on-disk content is byte-equivalent to a web-mode save of the same content

### Story 9.6: Validate Desktop Call Graph Contains Zero `/api/local/*` Calls (FR52)

As a developer agent,
I want an automated check that the desktop call graph does not contact `/api/local/*`,
So that FR52's "bypass web local APIs" guarantee is enforced rather than assumed.

**Acceptance Criteria:**

**Given** an end-to-end desktop fixture (init → edit → save → preview)
**When** network call tracing runs
**Then** zero calls to any `/api/local/*` route are recorded
**And** any future regression that reintroduces such a call causes the test to fail

**Given** the same fixture in web mode
**When** the trace runs
**Then** `/api/local/*` calls are observed as expected for web mode (control case)

### Story 9.7: Desktop Cold-Start Budget Enforcement (NFR26)

As a documentation maintainer,
I want desktop cold start to reach an editable state within 3 seconds for the 95th percentile,
So that the desktop experience does not degrade compared to the web baseline.

**Acceptance Criteria:**

**Given** a standard local development machine
**When** the desktop shell launches from cold start
**Then** time-to-editable for the 95th percentile across 20 runs is ≤ 3 seconds
**And** the test suite records each run's startup timing for trend analysis

**Given** a regression that pushes startup above the budget
**When** the budget test runs
**Then** CI fails and the failure message identifies the regressing change scope

## Epic 10: Audit Log Subsystem with Write-Ahead Semantics

A project-local audit log records every Agent write under a versioned JSON schema with `pending → committed | rejected` lifecycle, supports queries by scope/resource/time, exposes rollback, and prunes entries past the 30-day retention window.

### Story 10.1: Define Versioned Audit Entry JSON Schema in `@anydocs/core`

As a developer agent,
I want a versioned audit entry schema in `@anydocs/core/src/schemas/audit-entry-schema.ts`,
So that every audit producer and consumer agrees on the shape.

**Acceptance Criteria:**

**Given** the audit schema module
**When** it is loaded
**Then** it exports a Zod schema and a JSON Schema (v1) matching the architecture addendum spec
**And** required fields include `schemaVersion`, `id`, `timestamp`, `scope`, `operation`, `status`, `projectId`, `target`, `actor`, `runtimeMode`

**Given** an audit entry that violates the schema
**When** validation runs
**Then** the violating field is identified
**And** the entry is rejected before persistence

### Story 10.2: Implement Daily NDJSON Audit Repository

As a developer agent,
I want a repository that persists audit entries as daily NDJSON shards under `<projectRoot>/.anydocs/audit/`,
So that retention and query operations are file-system simple.

**Acceptance Criteria:**

**Given** an audit write request
**When** the repository persists it
**Then** the entry is appended to `<projectRoot>/.anydocs/audit/YYYY-MM-DD.ndjson` matching the entry's timestamp
**And** the append is atomic (no partial line on failure)

**Given** a missing audit directory on first write
**When** the repository runs
**Then** the directory is created with appropriate permissions
**And** the write succeeds without manual setup

### Story 10.3: Implement Write-Ahead Lifecycle (`pending → committed | rejected`)

As a developer agent,
I want a service that drives the `pending → committed | rejected` audit lifecycle,
So that Agent writes can be tied to a verifiable write-ahead record.

**Acceptance Criteria:**

**Given** an Agent write request
**When** `audit-log-service.ts.persistPending(entry)` runs
**Then** a `status: 'pending'` entry is durably persisted before any content write
**And** the entry's id is returned to the caller for follow-up commit or rejection

**Given** a successful content write
**When** `markCommitted(id)` runs
**Then** the entry's status is updated to `committed` durably
**And** the change is detectable by a subsequent query

**Given** a content write failure
**When** `markRejected(id, error)` runs
**Then** the entry's status is updated to `rejected` with `rejectionReason` populated
**And** the corresponding content write has been rolled back or was never partially applied

### Story 10.4: Implement Audit Query API

As a documentation maintainer,
I want to query the audit log by scope, target resource, and time range,
So that I can inspect Agent activity in support of FR57.

**Acceptance Criteria:**

**Given** persisted audit entries spanning multiple days
**When** I call `query({ scope, target.pageId, timestamp.from, timestamp.to, status })`
**Then** the result contains only entries matching all provided filters
**And** entries are returned in reverse chronological order with paginated access

**Given** a query that spans many shards
**When** it executes
**Then** the implementation reads only the shards intersecting the requested time range
**And** memory usage remains bounded for typical Phase 2 project sizes

### Story 10.5: Implement Rollback Service

As a documentation maintainer,
I want to roll back any logged Agent operation to its pre-change state,
So that I can recover quickly from unwanted AI edits per FR57.

**Acceptance Criteria:**

**Given** a committed audit entry with a captured pre-change snapshot
**When** I invoke `rollback(entryId)`
**Then** the affected content is re-applied to its pre-change state through `content-repository.write()`
**And** a new audit entry with `operation: 'rollback'` and `rollbackOf: entryId` is persisted

**Given** a rejected or pending entry
**When** rollback is requested
**Then** the operation is refused with a typed `RollbackNotApplicableError`
**And** no content change is attempted

### Story 10.6: Implement Retention Prune (≥30 days) and CLI Command

As a documentation maintainer,
I want audit entries beyond the retention window pruned automatically,
So that local disk usage stays bounded per NFR30.

**Acceptance Criteria:**

**Given** audit shards older than 30 days
**When** `audit-repository.ts.prune()` runs (Studio startup or `anydocs audit prune` CLI)
**Then** older shards are deleted
**And** a system audit entry with `actor.kind: 'system'` and `operation: 'structural'` is appended summarizing the prune

**Given** a project under the retention window
**When** prune runs
**Then** no shards are deleted
**And** no system audit entry is appended

### Story 10.7: Schema Versioning Rule and Forward-Compatibility Tests (NFR30)

As a developer agent,
I want explicit rules and tests for audit schema evolution,
So that additive changes remain forward-compatible while breaking changes are caught.

**Acceptance Criteria:**

**Given** the v1 schema
**When** an additive (optional) field change is made
**Then** existing v1 entries remain valid against the updated schema
**And** the change history records the addition without a `schemaVersion` bump

**Given** a backward-incompatible change attempt
**When** the schema-evolution test runs
**Then** the test fails until the `schemaVersion` is bumped and a migration is documented in the architecture addendum
**And** existing entries are migrated or marked unreadable explicitly

## Epic 11: Built-in Agent Subsystem (Inline / Page / Workspace)

Three Agent scope orchestrators enforce write boundaries at the core layer, route every write through the audit log via `agent-service.ts`, expose anchors in `@anydocs/editor`, and meet per-scope latency budgets.

### Story 11.1: Define Abstract `AgentProviderPort` Interface

As a developer agent,
I want an abstract `AgentProviderPort` interface in `@anydocs/core/src/agent/provider-port.ts`,
So that LLM provider concerns are isolated and `core` carries no vendor name.

**Acceptance Criteria:**

**Given** the provider port module
**When** it is loaded
**Then** it exports a `generate(prompt, context, scope)` function signature returning a typed `ProviderResponse`
**And** no concrete vendor or model name appears anywhere under `packages/core/src/agent/`

**Given** a host application
**When** it configures a concrete provider adapter
**Then** the adapter is wired at the host layer (outside `@anydocs/core`)
**And** the host can swap providers without changing any core code

### Story 11.2: Implement Scope Validator Pure Functions

As a developer agent,
I want pure scope-boundary assertion functions in `@anydocs/core/src/agent/scope-validator.ts`,
So that scope enforcement is testable in isolation.

**Acceptance Criteria:**

**Given** an inline-scope Agent write targeting a different block id than the active selection
**When** `assertScopeBoundary('inline', write)` runs
**Then** the function throws a typed `AgentScopeViolationError` identifying the offending target

**Given** a page-scope Agent write targeting a different pageId than the invocation target
**When** `assertScopeBoundary('page', write)` runs
**Then** the function throws `AgentScopeViolationError`

**Given** a valid in-scope write
**When** the assertion runs
**Then** it returns void without throwing

### Story 11.3: Implement Inline Agent Orchestrator (FR53)

As a documentation maintainer,
I want to invoke an inline Agent against the currently edited block,
So that I can get targeted, scoped AI assistance without affecting other content.

**Acceptance Criteria:**

**Given** an editor selection inside a single block
**When** I trigger the inline Agent through the editor anchor
**Then** the inline orchestrator routes the request through `agent-service.ts` with `scope: 'inline'`
**And** the resulting write is applied only to the active block

**Given** the Agent attempts to write outside the active block
**When** scope validation runs
**Then** the write is rejected with `AgentScopeViolationError`
**And** no content change is persisted

### Story 11.4: Implement Page Agent Orchestrator (FR54)

As a documentation maintainer,
I want to invoke a page Agent against a single pageId,
So that I can restructure or rewrite an entire page without risking other pages.

**Acceptance Criteria:**

**Given** an editor mounted on a specific pageId
**When** I trigger the page Agent
**Then** the orchestrator routes the request with `scope: 'page'` and the active pageId
**And** the resulting write is applied only to that pageId

**Given** the Agent attempts to write to any other pageId or navigation
**When** scope validation runs
**Then** the write is rejected with `AgentScopeViolationError`
**And** no content change is persisted

### Story 11.5: Implement Workspace Agent Orchestrator (FR55)

As a documentation maintainer,
I want to invoke a workspace Agent that can touch multiple pages and navigation within the project,
So that I can perform cross-page edits like terminology normalization.

**Acceptance Criteria:**

**Given** a workspace Agent invocation against a single projectId
**When** the orchestrator executes a multi-page plan
**Then** each individual write is recorded with its target page/navigation resource in the audit log
**And** all targets reside inside the invocation's projectId

**Given** the Agent attempts to write to any other projectId
**When** scope validation runs
**Then** the write is rejected with `AgentScopeViolationError`
**And** the workspace session terminates with a structured failure

### Story 11.6: Wire `agent-service.ts` Through Scope Validation and Write-Ahead Audit (FR56)

As a developer agent,
I want `agent-service.ts.invokeAgent()` to enforce the 7-step write-ahead sequence,
So that no Agent write bypasses audit semantics.

**Acceptance Criteria:**

**Given** an Agent write request
**When** `invokeAgent(scope, target, prompt)` runs
**Then** execution follows: scope assertion → audit persist-pending → content write → audit mark-committed
**And** any failure path uses audit mark-rejected and a content rollback (or never partially applies the content change)

**Given** an audit persist-pending failure
**When** `invokeAgent` continues
**Then** no content write is attempted
**And** the caller receives a typed `AuditPersistenceError`

### Story 11.7: Add Agent Anchors in `@anydocs/editor` (FR51)

As a documentation maintainer,
I want inline, page, and workspace Agent anchors inside the editor,
So that I can invoke each scope from the appropriate Studio surface.

**Acceptance Criteria:**

**Given** the editor mounted in Studio
**When** I select content inside a block
**Then** the inline Agent anchor is reachable via menu, keyboard, and command palette
**And** triggering it routes through `EditorInstance.triggerAgent('inline', payload)`

**Given** the editor mounted on a page
**When** I open the page-level actions surface
**Then** the page Agent anchor is reachable with the active pageId carried in the invocation payload

**Given** Studio's workspace command surface
**When** I open the workspace command palette
**Then** the workspace Agent anchor is reachable and carries the active projectId

### Story 11.8: Per-Scope Agent Latency Budgets and Integration Tests (NFR28)

As a documentation maintainer,
I want each Agent scope to meet its latency budget,
So that the Agent experience matches the PRD's performance commitments.

**Acceptance Criteria:**

**Given** integration tests with a stub provider and instrumented timings
**When** inline Agent invocations run
**Then** the 95th-percentile end-to-end response time is ≤ 3 seconds across the test set

**Given** the same test harness
**When** page Agent invocations run
**Then** the 95th-percentile end-to-end response time is ≤ 8 seconds

**Given** the same test harness
**When** workspace Agent runs
**Then** the 95th-percentile single-step streaming feedback interval is ≤ 2 seconds

**Given** a simulated degraded upstream condition
**When** the same tests run
**Then** budgets relax by up to 50% per NFR28 and the tests still pass

### Story 11.9: Audit-Failure Fault-Injection Tests (NFR29)

As a developer agent,
I want fault-injection tests proving that audit failure rejects the Agent write,
So that NFR29's write-ahead guarantee is enforced in CI.

**Acceptance Criteria:**

**Given** a simulated failure at `audit-log-service.ts.persistPending`
**When** an Agent invocation is attempted
**Then** the invocation aborts before any content write
**And** no on-disk content change is detectable after the run

**Given** a simulated failure at `markCommitted` after the content write succeeds
**When** the rollback path executes
**Then** the content is restored to its pre-write state
**And** the audit entry's final status is `rejected` with `rejectionReason` populated

## Epic 12: Scope Escalation Confirmation Enforcement

Studio renders scope as a visible badge, demands explicit confirmation for any scope escalation, and signs an escalation token that `agent-service.ts` re-verifies server-side — so UI bypass cannot silently widen Agent reach.

### Story 12.1: Implement Escalation Token Signing in Editor Host

As a developer agent,
I want the editor host to mint a signed escalation token upon explicit user confirmation,
So that scope widening intent is verifiable end-to-end.

**Acceptance Criteria:**

**Given** the editor host renders a scope-escalation confirmation modal
**When** the user explicitly confirms the escalation
**Then** the host mints a short-TTL signed token bound to the escalation source scope, target scope, and active resource
**And** the token is attached to the next Agent invocation payload

**Given** the user dismisses the modal or no confirmation is rendered
**When** an escalating Agent invocation is attempted
**Then** no token is minted
**And** the invocation carries no `escalationConfirmation` field

### Story 12.2: Implement `agent-service.ts` Escalation Token Verification

As a developer agent,
I want `agent-service.ts` to reject scope escalation without a valid token,
So that UI bypass cannot widen Agent reach silently.

**Acceptance Criteria:**

**Given** an Agent invocation whose detected scope is wider than the source scope
**When** `agent-service.ts` runs
**Then** the service requires a valid, unexpired `escalationConfirmation` token matching the source/target scopes and active resource
**And** missing, invalid, or expired tokens cause the invocation to fail with `EscalationConfirmationRequiredError`

**Given** a same-scope or narrower-scope invocation
**When** the service runs
**Then** no token is required and the invocation proceeds normally

### Story 12.3: Studio Escalation Confirmation Modal with Keyboard Accessibility (FR59)

As a documentation maintainer,
I want a clear escalation confirmation modal that I can operate by keyboard,
So that scope widening is informed and accessible.

**Acceptance Criteria:**

**Given** an inline → page or page → workspace escalation is initiated in Studio
**When** the modal appears
**Then** it states the source scope, target scope, and active resource in plain language
**And** the primary "Confirm" and secondary "Cancel" actions are reachable by keyboard with visible focus indicators

**Given** a confirmation
**When** the modal closes
**Then** the host attaches a signed escalation token to the next Agent invocation per Story 12.1
**And** the visible scope badge updates to reflect the new active scope

**Given** the user cancels
**When** the modal closes
**Then** no escalation token is minted
**And** the visible scope badge remains unchanged

### Story 12.4: End-to-End Test: Unconfirmed Escalation Rejected (NFR33)

As a developer agent,
I want an end-to-end test that proves unconfirmed escalation writes are rejected,
So that NFR33's explicit-confirmation guarantee is verifiable in CI.

**Acceptance Criteria:**

**Given** a Studio fixture configured to bypass the escalation modal (simulating UI tampering)
**When** an escalating Agent invocation is attempted
**Then** `agent-service.ts` rejects the invocation with `EscalationConfirmationRequiredError`
**And** the audit log contains no committed entry for the rejected escalation

**Given** the same fixture with the confirmation flow honored
**When** the user confirms the escalation
**Then** the invocation proceeds and a committed audit entry is recorded with the new scope

<!-- End original Phase 2 vNext addendum -->

---

# Phase 2 — Studio Desktop Shell Migration Addendum (Epic 13)

**Appended:** 2026-05-24
**Source:** Honest gap surfaced after Claude Design handoff review — Epic 6–12 covered editor runtime, audit, agent, runtime mode, and desktop fs, but did NOT formally cover the Studio UI shell migration (vault sidebar, library, onboarding, settings, palette, run inspector, build UI, audit log query view). Epic 13 closes this gap.
**Reference:** UX Design Specification `artifacts/bmad/planning-artifacts/ux-design-specification.md`
**Scope boundary:** Epic 13 is the UI/chrome layer. Service-layer work continues to live in Epic 6 (editor package), Epic 8 (runtime mode), Epic 10 (audit), Epic 11 (Agent), Epic 12 (escalation token). Epic 13 stories consume these services via host adapters.

## Phase 2 Studio Shell — Additional FR Coverage Map

Epic 13 does not introduce new FRs; it provides the **UI implementation surface** for already-defined FRs that previously had no UI story:

FR51: Epic 13 - editor anchors hosted in migrated Studio shell (UX spec §6.1 ScopeBadge implementation)
FR52: Epic 13 - desktop chrome (MacWindow) wraps web app in desktop runtime
FR55: Epic 13 - workspace Agent palette entry (UX spec §6.4)
FR57: Epic 13 - audit log query view UI (UX spec §6.2)
FR58: Epic 13 - RuntimeModeIndicator integrated into LocalStatusBar
FR59: Epic 13 - command palette renders scope-labeled Agent entries; modal hosted by Epic 12
FR60: Epic 13 - `@anydocs/editor` consumed only through host adapter in migrated shell

## Phase 2 Studio Shell — Epic Summary

#### Epic 13: Studio Desktop Shell Migration
Documentation maintainers experience Studio as the unified desktop-language application described in the Claude Design handoff (22 screens), with the four-region shell, file-tree vault sidebar, library start page, four-step onboarding, six-page settings, command palette, run inspector, build UI, audit log query view, and dark mode — all consuming services from Epic 6–12 without duplicating logic.
**FRs supported (via UX surfaces):** FR51, FR52, FR55, FR57, FR58, FR59, FR60
**NFRs supported:** NFR15 (a11y across migrated surfaces), NFR17 (no color-only meaning)
**Design source:** `/Users/shawn/Downloads/anydocs-desktop-handoff` + `ux-design-specification.md` §6.1–§6.4

## Epic 13: Studio Desktop Shell Migration

Documentation maintainers can use the migrated Studio with the desktop design language as the unified experience surface, replacing the existing browser three-column layout, navigation composer, single-page settings, and welcome screen with the Claude Design-defined shell, file-tree sidebar, library, onboarding stepper, segmented settings, command palette, run inspector, build UI, and audit log query view.

### Story 13.1: Port `tokens.css` and Shell Primitives into `@anydocs/web`

As a developer agent,
I want the Claude Design tokens and shell primitives ported into the project's component library,
So that every subsequent Studio surface consumes one design system from code.

**Acceptance Criteria:**

**Given** the Claude Design handoff at `/Users/shawn/Downloads/anydocs-desktop-handoff`
**When** the design assets are ported
**Then** `tokens.css` is copied verbatim into `packages/web/lib/desktop-shell/tokens.css` (no value mutation)
**And** a new module `packages/web/lib/desktop-shell/` exports React primitives: `MacWindow`, `LocalChip`, `ModelBadge`, `LocalTopbar`, `LocalStatusBar`, `KBD`, preserving the Claude Design naming

**Given** any consumer of the primitives
**When** it imports from `packages/web/lib/desktop-shell/`
**Then** the primitives render in both light and dark themes via `[data-theme="dark"]` switch
**And** no hand-tuned color or spacing values appear outside `tokens.css`

**Given** an automated audit
**When** lint or visual regression runs against the primitive set
**Then** every primitive renders the same visual output as the corresponding Claude Design reference within a configurable pixel tolerance

### Story 13.2: Recompose Studio Shell to Desktop Four-Region Layout

As a documentation maintainer,
I want Studio to use the four-region layout (VaultSidebar / LocalTopbar + main / LocalAgentPanel / LocalStatusBar),
So that the editing experience matches the Claude Design `ds-editor` composition.

**Acceptance Criteria:**

**Given** the existing `packages/web/components/studio/local-studio-app.tsx` three-column layout
**When** the shell is recomposed
**Then** the app renders four distinct regions matching the Claude Design `ds-editor` screen
**And** the editor area mounts `@anydocs/editor` through the host adapter from Story 7.1 (no direct Yoopta imports)

**Given** Phase 1 acceptance tests
**When** the recomposed Studio runs
**Then** all Phase 1 Studio acceptance tests continue to pass against the new shell
**And** keyboard shortcuts including `⌘\\` (toggle sidebar) and `⌘.` (toggle agent) are wired

**Given** the migrated shell
**When** it runs in `web` runtime mode
**Then** `MacWindow` chrome is suppressed (the Web shell embeds without traffic lights)
**And** the same shell in `desktop` runtime mode renders `MacWindow` chrome around itself

### Story 13.3: Replace Navigation Composer with VaultSidebar File-Tree

As a documentation maintainer,
I want the left rail to show real `.md` filenames and folders (the vault file tree) instead of the abstract structural navigation composer,
So that the surface matches what I see on disk and the Claude Design `VaultSidebar` pattern.

**Acceptance Criteria:**

**Given** a project on disk with `pages/<lang>/*.md` files and folders
**When** Studio loads
**Then** the VaultSidebar renders the actual file tree with folder paths, file names, and the system area (`.attachments/`, `anydocs.config.toml`)
**And** selecting a file opens it in the editor

**Given** a user who still needs to author the publication navigation (separate from the file tree)
**When** they open the navigation editor
**Then** the existing `navigation-composer.tsx` is reachable via an explicit "Edit publication navigation" affordance (preserved as an advanced mode), not as the primary left rail
**And** edits to publication navigation remain compatible with Phase 1 `navigation/<lang>.json` files

**Given** a renamed or deleted file in the vault
**When** Studio refreshes
**Then** the VaultSidebar reflects the change
**And** any open editor for a deleted file shows a non-destructive notice rather than silent state loss

### Story 13.4: Implement Library Surface (Continue + Recent + Stats)

As a documentation maintainer,
I want a Library start page that shows Continue (recent in-progress pages), Recent edits, and project stats,
So that opening Studio gives me an immediate work surface matching the Claude Design `ds-library` screen.

**Acceptance Criteria:**

**Given** a project with edit history
**When** Studio opens at the project root without a specific file selected
**Then** the Library surface renders Continue (sorted by recent), Recent Edits, and Stats panels matching the Claude Design `ds-library` composition
**And** clicking any page opens it in the editor

**Given** a freshly initialized project with no edit history
**When** Studio opens
**Then** the Library surface renders the empty state matching `ds-library-empty` with primary CTAs (New page, Scaffold from prompt, Open Markdown folder, Open example vault)
**And** each CTA routes to its respective action

**Given** the existing `welcome-screen.tsx`
**When** Library is implemented
**Then** the welcome screen continues to handle first-launch project selection, but is no longer the post-project-open landing surface
**And** post-project-open landing is the Library

### Story 13.5: Implement Four-Step Onboarding Flow

As a first-time user,
I want a four-step onboarding (Welcome → Vault → Model → Done) that establishes vault location and model preference before I see Studio,
So that the experience matches the Claude Design onboarding screens (`ds-welcome` → `ds-onboard-model` → `ds-onboard-done`).

**Acceptance Criteria:**

**Given** a fresh app launch with no prior vault selection
**When** Studio bootstraps
**Then** the onboarding stepper renders Step 1 Welcome and Vault picker, Step 2 Model picker (ollama default + cloud BYOK opt-in via `provider-port` from Story 11.1), Step 3 Done
**And** each step shows the stepper progress indicator matching `ScreenLocalOnboardingModel`

**Given** the onboarding completion
**When** the user clicks Done
**Then** the vault path is persisted to user config
**And** the selected model and provider are persisted to the provider-port configuration
**And** the user lands on the Library surface

**Given** the existing `welcome-screen.tsx`
**When** the onboarding stepper is implemented
**Then** the welcome screen is either replaced by Step 1 or kept as a wrapper that mounts the stepper
**And** Phase 1 acceptance tests covering welcome-to-project flow continue to pass against the new stepper

### Story 13.6: Restructure Settings into Six Sub-Pages

As a documentation maintainer,
I want Settings organized into the six dedicated sub-pages (General / Models / Vault / Shortcuts / About / Models-Pulling),
So that Settings matches the Claude Design `ScreenSettings*` set and avoids the previous single-page sprawl.

**Acceptance Criteria:**

**Given** the existing `local-studio-settings.tsx` single-page settings
**When** settings are restructured
**Then** Settings exposes six routable sub-pages matching `ScreenSettingsGeneral`, `ScreenSettingsModels`, `ScreenSettingsVault`, `ScreenSettingsShortcuts`, `ScreenSettingsAbout`, and the in-progress model download state (`ScreenSettingsModelsPulling`)
**And** the sub-pages share a left navigation strip following the Claude Design layout

**Given** an automated audit of the dependency list shown in `ScreenSettingsAbout`
**When** the About sub-page renders
**Then** it lists `@anydocs/editor` package version and contract status (per Story 6.5 contract diff result)
**And** it lists the active runtime mode (per Story 8.1) and the active provider/model (per Story 11.1)

**Given** Phase 1 settings flows
**When** users access General, Vault, or Shortcuts
**Then** Phase 1 functional behaviors (project path, theme color, language config) continue to work
**And** no Phase 1 setting is dropped silently — each is either migrated or explicitly deprecated with a notice

### Story 13.7: Implement Command Palette with Workspace Agent Entry

As a documentation maintainer,
I want a command palette (⌘P) with explicit Agent invocation entries (inline / page / workspace) and shared actions,
So that I have a single keyboard-first entry matching the Claude Design `ds-palette` and UX Specification §6.4.

**Acceptance Criteria:**

**Given** the palette overlay
**When** I invoke ⌘P
**Then** the palette renders the ASK WRITER section with three scope-labeled entries (inline / page / workspace) carrying their respective keyboard shortcuts
**And** the NAVIGATION and ACTIONS sections include "Switch file" (⌘O), "Audit log…" (⌘⇧A), "Build & Publish", "Toggle dark mode" entries

**Given** the user selects "Ask Writer · workspace" while the editor is mounted on a narrower scope
**When** the palette confirms the selection
**Then** the Scope Escalation Modal from Story 12.3 is triggered before the Agent invocation proceeds
**And** confirmation produces a signed escalation token consumed by `agent-service.invokeAgent()` per Story 12.2

**Given** the palette's `Audit log…` entry
**When** the user selects it
**Then** the application routes to the Audit Log Query view from Story 13.10

### Story 13.8: Implement Run Inspector Full-Window Surface

As a documentation maintainer,
I want a full-window Run Inspector that shows the timeline, diff/preview/raw views, model badge, and live token rate for any Agent run,
So that I can observe in-progress and recently completed runs matching the Claude Design `ds-inspector` and `ds-inspector-done` screens.

**Acceptance Criteria:**

**Given** a running Agent invocation
**When** the user opens Run Inspector
**Then** the inspector renders the left-side timeline (steps with check / spin / queued indicators) and the right-side diff/preview/raw tab set matching `ds-inspector`
**And** the timeline updates as `agent-service.ts` (Story 11.6) emits step events through the audit lifecycle

**Given** a completed Agent run
**When** the user opens Run Inspector for it
**Then** the inspector renders the `ds-inspector-done` state with final diff, applied changes summary, and "Roll back this run" affordance
**And** the rollback affordance calls `audit-log-service.rollback(entryId)` (Story 10.5)

**Given** a long-running workspace Agent across multiple files
**When** the inspector renders
**Then** per-file diffs are addressable in the right pane
**And** keyboard navigation (⌘[ / ⌘]) cycles between affected files

### Story 13.9: Implement Build & Publish UI (Success + Failure)

As a documentation maintainer,
I want Build & Publish exposed as a full-window UI (success and failure states) instead of CLI-only,
So that the experience matches the Claude Design `ScreenLocalBuild` and `ScreenLocalBuildFailed`.

**Acceptance Criteria:**

**Given** the existing `anydocs build` core service from Phase 1
**When** the user triggers Build & Publish from Studio or the palette
**Then** the build UI renders the streaming build log and a final status (success or failure) matching the Claude Design screens
**And** the underlying service is unchanged — the UI consumes the same core build service used by the CLI

**Given** a successful build
**When** the success state renders
**Then** the user can Reveal the output in Finder (desktop mode) or copy the static path (web mode)
**And** the build manifest's `site.theme.id` and resolved publication boundary status are surfaced

**Given** a failed build (e.g., broken internal links)
**When** the failure state renders
**Then** the red log highlights the failing entity with remediation hint per NFR9
**And** a "Resolve with Writer" affordance invokes the workspace Agent through the palette (Story 13.7) to attempt a fix

### Story 13.10: Implement Audit Log Query View

As a documentation maintainer,
I want a dedicated Audit Log Query view with filter bar, list, detail panel, and per-entry rollback,
So that I can inspect Writer history and recover from unwanted edits matching UX Specification §6.2.

**Acceptance Criteria:**

**Given** the audit query API (Story 10.4)
**When** the user opens the Audit Log Query view
**Then** the filter bar exposes Scope, Resource, When, Status, and Search axes that map to the `audit-log-service.query()` filter axes
**And** the list shows reverse-chronological entries with timestamp, scope badge, prompt summary, model/token/duration meta, and status icon

**Given** a selected list entry
**When** the detail panel renders
**Then** the panel reuses the Run Inspector layout (Story 13.8) for visual consistency
**And** committed entries show a "Roll back this change" affordance using `--bad-500` destructive primary styling per UX spec §6.2.5

**Given** the user confirms rollback
**When** `audit-log-service.rollback(entryId)` (Story 10.5) succeeds
**Then** a new audit entry with `operation: 'rollback'` appears at the top of the list
**And** the affected file content in the editor reflects the restored state

**Given** filter coverage extending past the 30-day retention window
**When** the filter bar renders
**Then** a "Retention: 30 days" hint appears on the right side of the filter bar per UX spec §6.2.7

### Story 13.11: Validate Dark Mode and Visual Regression Across Migrated Surfaces

As a developer agent,
I want automated visual regression coverage across all migrated Studio surfaces in both light and dark themes,
So that the design system stays consistent and regressions are caught in CI.

**Acceptance Criteria:**

**Given** the migrated Studio surfaces (shell, sidebar, library, onboarding, settings, palette, run inspector, build UI, audit log query, plus the 4 gap closure modals/views from UX spec §6.1–§6.4)
**When** visual regression tests run in both `data-theme=light` and `data-theme=dark`
**Then** each surface matches its baseline screenshot within a configurable tolerance
**And** zero color-only meaning violations are reported by the automated accessibility audit (per NFR17)

**Given** a `prefers-reduced-motion: reduce` simulation
**When** surfaces with motion (LocalChip pulse, Agent panel pulse, Run Inspector spinner) render
**Then** motion is suppressed per UX spec §8.4
**And** static fallbacks are visible

**Given** a keyboard-only walk-through of all migrated primary surfaces
**When** the walk-through runs
**Then** every interactive element is reachable, focus is visible, and tab order matches the documented reading order

<!-- End Epic 13 — Studio Desktop Shell Migration -->

<!-- End Phase 2 vNext addendum -->
