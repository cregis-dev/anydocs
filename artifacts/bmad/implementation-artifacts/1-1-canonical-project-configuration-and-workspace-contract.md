# Story 1.1: Create the Canonical Project Configuration and Workspace Contract

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a documentation maintainer,
I want Anydocs to define one canonical project configuration and directory contract,
so that every workflow starts from the same local-first project model.

## Acceptance Criteria

1. A canonical Phase 1 project contract is defined in code for project config, page storage, navigation storage, and generated artifact locations, aligned with the architecture decision that local files are the system of record.
2. Core project loading identifies missing or invalid contract fields and returns structured validation failures instead of silent fallback behavior.
3. The contract supports local authoring, build, and preview without requiring a cloud account or remote storage dependency.
4. The contract is expressed in shared types and validation logic that can later be consumed by Studio, CLI, and build workflows through `@anydocs/core`.

## Tasks / Subtasks

- [x] Establish the canonical Phase 1 project contract in `@anydocs/core` (AC: 1, 4)
  - [x] Define the config shape for the project contract, including project-level settings needed by authoring, build, and preview.
  - [x] Define canonical path expectations for pages, navigation, and generated outputs, matching the architecture target rather than current transitional variants.
  - [x] Add exported types for the canonical project contract so future packages can consume a single source of truth.
- [x] Add project contract validation and structured error handling (AC: 2, 4)
  - [x] Implement validation for missing config fields, invalid directory assumptions, and malformed contract values.
  - [x] Return typed validation failures from `@anydocs/core` rather than silently defaulting to legacy paths.
  - [x] Ensure error payloads identify the failing entity, violated rule, and remediation hint.
- [x] Normalize brownfield path assumptions into an explicit Phase 1 contract (AC: 1, 2)
  - [x] Audit current path conventions in `packages/web/lib/docs/fs.ts` and `packages/web/scripts/gen-public-assets.mjs`.
  - [x] Preserve compatibility only where explicitly intended, but do not let transitional logic remain the canonical contract.
  - [x] Document or encode the preferred default project layout so future stories build on a stable base.
- [x] Add automated tests for the contract and validation boundaries (AC: 2, 3, 4)
  - [x] Add core package tests for valid contract loading.
  - [x] Add negative tests for missing or malformed project config.
  - [x] Verify the validated contract can support local-only authoring/build assumptions with no cloud dependency.

## Dev Notes

- This story is the first implementation priority from the architecture document. It is intentionally about defining the contract, not implementing full CLI or Studio behavior yet.
- Do not treat current `packages/web` path logic as the final truth. This story exists to promote that logic into an explicit, shared Phase 1 contract in `@anydocs/core`.
- Keep scope tight: do not introduce databases, auth, multi-project workspace behavior, hosted services, or full build orchestration here.

### Developer Context

**Business objective**
- Create the one canonical local-first project contract that every later story depends on.
- Reduce ambiguity between current brownfield path variants and the architecture target structure.

**Current code baseline**
- `packages/core/src/index.ts` is effectively a placeholder export surface today.
- `packages/cli/src/index.ts` is a stub command entry and should not become the place where project-contract rules live.
- Existing project/data logic is concentrated in `packages/web/lib/docs/fs.ts`, `packages/web/lib/docs/types.ts`, and `packages/web/scripts/gen-public-assets.mjs`.

**Relevant existing data model**
- `packages/web/lib/docs/types.ts` already defines `PageDoc`, `NavigationDoc`, `DocsLang`, and `PageStatus`.
- `packages/web/lib/docs/fs.ts` currently contains path resolution, local config loading, save/load logic, slug checks, and project root behavior.
- `packages/web/scripts/gen-public-assets.mjs` currently contains additional source/build root assumptions and broader brownfield behavior that the architecture explicitly wants migrated into shared core over time.

### Technical Requirements

- Use the local file system as the Phase 1 system of record.
- The canonical contract must live in `@anydocs/core`.
- Shared contracts must use `camelCase` persisted JSON fields and ISO 8601 timestamp conventions.
- Shared core functions should return typed results or typed domain errors, not ad hoc string-only failures.
- Validation must happen at project load boundaries and must fail explicitly for invalid contracts.
- The result must remain compatible with local authoring, build, and preview workflows on one machine.

### Architecture Compliance

- `@anydocs/core` owns shared domain types, schemas, validation, file-system adapters, publication rules, and build orchestration. This story should begin that ownership move.
- `@anydocs/web`, `@anydocs/cli`, and `@anydocs/desktop` are adapter surfaces and must not become the new home for canonical project contract logic.
- Brownfield reuse must be selective: reuse existing `web` behavior where valuable, but do not inherit out-of-scope multi-project or transitional logic as the new source of truth.
- The architecture explicitly calls out a normalized Phase 1 layout under a default project workspace and notes that historical path variants still exist. This story should define the preferred contract clearly enough for later migration work.

### Library / Framework Requirements

- Monorepo foundation stays as-is: `pnpm` workspace with `packages/core`, `packages/cli`, `packages/web`, `packages/desktop`.
- Runtime target should remain compatible with Node.js 22 LTS, while also satisfying Next.js 16 minimum Node 20.9 requirement.
- Web package remains on Next.js 16 / React 19 / Tailwind 4, but this story should avoid UI-coupled implementation.
- Do not add GraphQL, a database, or a hosted config service.
- If a schema validation library is introduced or reused, it must be justified by the shared-core-first architecture and not duplicate an existing contract system.

### File Structure Requirements

- Primary files to inspect or evolve:
  - `packages/core/src/index.ts`
  - new `packages/core/src/config/*`
  - new `packages/core/src/types/*`
  - new `packages/core/src/schemas/*`
  - optionally new `packages/core/src/errors/*`
- Reference-only existing behavior:
  - `packages/web/lib/docs/types.ts`
  - `packages/web/lib/docs/fs.ts`
  - `packages/web/scripts/gen-public-assets.mjs`
  - `packages/cli/src/index.ts`
- Do not leave the final canonical project contract defined only in `packages/web/lib/docs/*`.

### Testing Requirements

- Add package-level tests under `packages/core/tests`.
- Cover at least:
  - valid project contract loads successfully
  - missing required config field fails with structured validation error
  - malformed path or contract value fails explicitly
  - contract assumptions remain local-only and do not require network/cloud dependencies
- Keep tests focused on contract and validation boundaries; do not expand into full build or Studio integration in this story.

### Project Structure Notes

- Align with the architecture target structure, especially:
  - `packages/core/src/config/project-config.ts`
  - `packages/core/src/types/project.ts`
  - `packages/core/src/schemas/project-schema.ts`
  - `packages/core/src/fs/project-paths.ts`
- The current normalized Phase 1 target layout is a single-project repo-root contract (`anydocs.config.json`, `pages/`, `navigation/`, `dist/`) without `content/projects/default/...` nesting.
- Generated outputs are not source files and should be represented as artifact destinations in the contract, not as hand-edited content roots.

### Git Intelligence Summary

- Repository history is minimal at the commit level (`Initial commit from Create Next App`), so commit history does not provide useful implementation patterns yet.
- Current worktree is heavily brownfield and mid-migration. Avoid assuming root-level Next.js starter files represent the active product structure; the `packages/*` workspace is the active implementation base.

### Latest Tech Information

- Next.js official installation guidance was updated on February 27, 2026 and states a minimum Node.js version of `20.9`; targeting Node 22 LTS remains architecture-compatible and safer for Phase 1. [Source: https://nextjs.org/docs/app/getting-started/installation]
- Next.js 16 no longer runs lint automatically during `next build`, so any future enforcement of config/schema standards should not assume build-time lint execution. [Source: https://nextjs.org/docs/app/getting-started/installation]
- The current repository already declares `react` and `react-dom` 19.x in `packages/web/package.json`, which is consistent with current Next.js documentation guidance. [Source: https://nextjs.org/docs/app/getting-started/installation]

### Project Context Reference

- No `project-context.md` file was discovered for this repo during story creation.
- Use these planning documents as source-of-truth for this story:
  - [`epics.md`](/Users/shawn/workspace/code/anydocs/artifacts/bmad/planning-artifacts/epics.md)
  - [`architecture.md`](/Users/shawn/workspace/code/anydocs/artifacts/bmad/planning-artifacts/architecture.md)
  - [`prd.md`](/Users/shawn/workspace/code/anydocs/artifacts/bmad/planning-artifacts/prd.md)

### References

- [`epics.md`](/Users/shawn/workspace/code/anydocs/artifacts/bmad/planning-artifacts/epics.md) - Epic 1, Story 1.1
- [`architecture.md`](/Users/shawn/workspace/code/anydocs/artifacts/bmad/planning-artifacts/architecture.md) - Core Architectural Decisions
- [`architecture.md`](/Users/shawn/workspace/code/anydocs/artifacts/bmad/planning-artifacts/architecture.md) - Implementation Patterns & Consistency Rules
- [`architecture.md`](/Users/shawn/workspace/code/anydocs/artifacts/bmad/planning-artifacts/architecture.md) - Project Structure & Boundaries
- [`architecture.md`](/Users/shawn/workspace/code/anydocs/artifacts/bmad/planning-artifacts/architecture.md) - Architecture Validation Results
- [`prd.md`](/Users/shawn/workspace/code/anydocs/artifacts/bmad/planning-artifacts/prd.md) - Functional Requirements FR1, FR2, FR3, FR5, FR6, FR7, FR8, FR9, FR10, FR11, FR12, FR46, FR47, FR48
- [`packages/web/lib/docs/types.ts`](/Users/shawn/workspace/code/anydocs/packages/web/lib/docs/types.ts)
- [`packages/web/lib/docs/fs.ts`](/Users/shawn/workspace/code/anydocs/packages/web/lib/docs/fs.ts)
- [`packages/web/scripts/gen-public-assets.mjs`](/Users/shawn/workspace/code/anydocs/packages/web/scripts/gen-public-assets.mjs)
- [`packages/core/src/index.ts`](/Users/shawn/workspace/code/anydocs/packages/core/src/index.ts)
- [`packages/cli/src/index.ts`](/Users/shawn/workspace/code/anydocs/packages/cli/src/index.ts)
- Next.js installation docs: https://nextjs.org/docs/app/getting-started/installation

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- No sprint status file existed, so this story was created directly from the approved epic/story breakdown using Epic 1 / Story 1.1.

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created
- This story intentionally establishes the contract boundary before any CLI or Studio expansion
- No previous story intelligence was available because this is the first story in the first epic
- Canonical project config, path contract, typed validation errors, and shared project loader now live in `@anydocs/core`
- Contract loading now returns structured validation errors for missing files, malformed JSON, invalid config values, and invalid `projectId` input
- Core package tests cover valid loads, missing config, malformed config JSON, missing workflow/navigation files, and invalid project ids
- Contract loading now rejects mismatched on-disk `projectId` values and stale workflow-standard metadata that drift from the canonical project contract
- Project config updates now regenerate `anydocs.workflow.json`, and Studio project loading now surfaces canonical validation failures instead of synthesizing fallback paths
- Root `pnpm test` now includes `@anydocs/core` contract tests so canonical contract regressions are covered by the default test path

### File List

- `/Users/shawn/workspace/code/anydocs/packages/core/src/config/project-config.ts`
- `/Users/shawn/workspace/code/anydocs/packages/core/src/types/project.ts`
- `/Users/shawn/workspace/code/anydocs/packages/core/src/config/index.ts`
- `/Users/shawn/workspace/code/anydocs/packages/core/src/schemas/project-schema.ts`
- `/Users/shawn/workspace/code/anydocs/packages/core/src/schemas/index.ts`
- `/Users/shawn/workspace/code/anydocs/packages/core/src/errors/domain-error.ts`
- `/Users/shawn/workspace/code/anydocs/packages/core/src/errors/validation-error.ts`
- `/Users/shawn/workspace/code/anydocs/packages/core/src/errors/index.ts`
- `/Users/shawn/workspace/code/anydocs/packages/core/src/fs/project-paths.ts`
- `/Users/shawn/workspace/code/anydocs/packages/core/src/fs/content-repository.ts`
- `/Users/shawn/workspace/code/anydocs/packages/core/src/fs/index.ts`
- `/Users/shawn/workspace/code/anydocs/packages/core/src/index.ts`
- `/Users/shawn/workspace/code/anydocs/packages/core/src/services/workflow-standard-service.ts`
- `/Users/shawn/workspace/code/anydocs/packages/core/tests/project-contract.test.ts`
- `/Users/shawn/workspace/code/anydocs/packages/web/lib/docs/fs.ts`
- `/Users/shawn/workspace/code/anydocs/packages/web/lib/docs/data.ts`
- `/Users/shawn/workspace/code/anydocs/packages/web/app/api/local/project/route.ts`
- `/Users/shawn/workspace/code/anydocs/package.json`
- `/Users/shawn/workspace/code/anydocs/artifacts/bmad/implementation-artifacts/1-1-canonical-project-configuration-and-workspace-contract.md`

### Change Log

- 2026-03-11: Implemented canonical Phase 1 project contract in `@anydocs/core`
- 2026-03-11: Added structured validation for malformed config JSON and invalid project ids after code review
- 2026-03-11: Fixed project-id redirection, stale workflow-standard drift, Studio fallback masking, and missing root test coverage after follow-up review

### Senior Developer Review (AI)

- 2026-03-11: Reviewed against Story 1.1 acceptance criteria and current implementation.
- Initial review found two High issues: malformed config JSON escaped typed validation, and `projectId` could influence path resolution before validation.
- Follow-up fixes were applied in `@anydocs/core`, and regression tests were added for both cases.
- Remaining traceability issue in this story artifact is resolved by updating status, completed tasks, completion notes, and file list.
- 2026-03-11: Additional follow-up fixes now enforce project-directory and workflow-standard consistency, remove Studio-side silent contract fallbacks, and include `@anydocs/core` in the default root test command.
