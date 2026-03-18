---
stepsCompleted:
  - 1
  - 2
  - 3
  - 4
inputDocuments:
  - docs/planning-artifacts/prd.md
  - docs/planning-artifacts/architecture.md
  - docs/planning-artifacts/prd-validation-report.md
  - docs/planning-artifacts/prd-validation-report-rerun.md
  - docs/planning-artifacts/prd-validation-report-rerun-2.md
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

**Given** {{precondition}}
**When** {{action}}
**Then** {{expected_outcome}}
**And** {{additional_criteria}}

<!-- End story repeat -->
