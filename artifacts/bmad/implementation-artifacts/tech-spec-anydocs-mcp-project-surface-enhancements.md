---
title: 'Anydocs MCP Project-Surface Enhancements'
slug: 'anydocs-mcp-project-surface-enhancements'
created: '2026-04-03T00:00:00+08:00'
status: 'ready-for-dev'
stepsCompleted: [1, 2, 3, 4]
tech_stack:
  - 'TypeScript'
  - 'Node.js'
  - 'pnpm workspace monorepo'
  - 'ESM packages with strip-types execution'
  - 'node:test'
  - '@modelcontextprotocol/sdk'
  - 'Next.js 16 App Router'
files_to_modify:
  - 'packages/core/src/types/project.ts'
  - 'packages/core/src/types/workflow-standard.ts'
  - 'packages/core/src/services/index.ts'
  - 'packages/core/src/services/build-service.ts'
  - 'packages/core/src/services/theme-capabilities-service.ts'
  - 'packages/core/src/services/workflow-sync-service.ts'
  - 'packages/core/src/services/multilingual-service.ts'
  - 'packages/mcp/src/tools/project-tools.ts'
  - 'packages/mcp/src/tools/page-tools.ts'
  - 'packages/core/tests/project-contract.test.ts'
  - 'packages/core/tests/build-preview-service.test.ts'
  - 'packages/core/tests/workflow-standard-service.test.ts'
  - 'packages/core/tests/multilingual-service.test.ts'
  - 'packages/mcp/tests/tool-handlers.test.ts'
  - 'packages/mcp/tests/server.test.ts'
code_patterns:
  - 'MCP tools remain thin adapters over @anydocs/core and return stable JSON envelopes with ok/data/error/meta fields.'
  - 'Project config mutation already flows through canonical core validation and write helpers, so MCP should reuse that boundary rather than bypass it.'
  - 'Build orchestration already exists in core; MCP should expose it as a tool instead of duplicating artifact generation logic.'
  - 'Workflow compatibility is currently fail-fast, so sync support needs a diff-oriented layer instead of reusing the existing boolean validation path directly.'
  - 'Theme capabilities are already modeled in theme manifests, but MCP currently exposes only authoring guidance, not the active theme’s actual capability boundary.'
  - 'Page creation/update/status operations already enforce slug uniqueness, publication approval, and template validation in core authoring services.'
  - 'Navigation validation already supports stable top-level group ids, which is the right anchor for multilingual structure checks.'
test_patterns:
  - 'node:test suites use temp directories via mkdtemp and assert structured ValidationError details and filesystem side effects.'
  - 'MCP tool handler tests invoke handlers directly and assert stable envelope payloads.'
  - 'Build tests verify deployable filesystem artifacts, root-level output paths, and published-only machine-readable outputs.'
  - 'Workflow tests assert canonical workflow standard fields and compatibility behavior across init, import, conversion, and build paths.'
  - 'Authoring tests cover page lifecycle, language setup, slug uniqueness, and navigation reference validation.'
---

# Tech-Spec: Anydocs MCP Project-Surface Enhancements

**Created:** 2026-04-03T00:00:00+08:00

## Overview

### Problem Statement

Anydocs MCP already covers core authoring workflows such as project inspection, page CRUD, navigation editing, and language toggling, but it still leaves key project-surface operations outside the MCP boundary. Agent workflows must currently fall back to direct file edits for project configuration changes, cannot trigger a canonical build from MCP, cannot reconcile workflow contract drift through MCP, and cannot discover theme capability boundaries from the same project contract used for authoring. Multilingual support also lacks a non-AI way to clone page structure into another language and inspect translation readiness.

### Solution

Extend the MCP surface with a small set of project-level tools that close the operational gaps without introducing new platform abstractions. Add safe project config updates, a build trigger, workflow synchronization, theme capability disclosure through `project_open`, and multilingual page-skeleton cloning plus translation-status inspection. Keep all changes grounded in existing core services and adapter patterns, and explicitly exclude API source management, AI/content translation, and broader asset-system redesign.

### Scope

**In Scope:**
- Add a safe MCP write path for project config updates
- Add a MCP build trigger for the canonical build workflow
- Add MCP workflow diff/sync support for canonical contract drift
- Surface theme capability boundaries through `project_open`
- Add multilingual page skeleton cloning and translation-status inspection
- Keep the implementation aligned with existing core-first adapter patterns

**Out of Scope:**
- `api_source_*` tools or API source lifecycle management
- Any real AI/content translation or external translation service integration
- Asset upload/resource system design beyond a future placeholder note
- Broad platform redesign, session state, or speculative MCP resource architecture

## Context for Development

### Codebase Patterns

- The workspace is a TypeScript/Node.js pnpm monorepo, and the MCP package already uses ESM plus `node --experimental-strip-types` tests.
- MCP adapters are intentionally thin; they convert domain errors into a stable JSON envelope and delegate persistence logic to `@anydocs/core`.
- Project-scoped flows already require explicit `projectRoot` inputs, so the new tools should continue to avoid hidden session state.
- Core services own the canonical project config, page authoring, build, and workflow contract behavior. MCP should wrap those services, not fork them.
- Theme capability boundaries are already expressed in theme manifests, but the current MCP authoring surface only returns generic block guidance.
- Multilingual work should stay within the existing content model: clone page skeletons, inspect source/target status, and do not introduce translation execution or new document formats.
- Navigation and language validation already provide stable group ids and enabled-language checks, which are the right primitives for cross-language status reporting.

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `packages/mcp/src/tools/project-tools.ts` | Current project-level MCP tool surface, authoring payload shape, and response envelope pattern |
| `packages/mcp/src/tools/page-tools.ts` | Existing page CRUD tool conventions, patch whitelist behavior, and validation style |
| `packages/mcp/src/tools/shared.ts` | Shared MCP envelope, error conversion, and project context loading helpers |
| `packages/core/src/types/project.ts` | Canonical project config and theme contract types |
| `packages/core/src/schemas/project-schema.ts` | Project config validation for theme, navigation, and build fields |
| `packages/core/src/services/build-service.ts` | Canonical build workflow entrypoint and published-artifact orchestration |
| `packages/core/src/services/workflow-compatibility-service.ts` | Existing workflow compatibility validation path and error semantics |
| `packages/core/src/types/workflow-standard.ts` | Canonical workflow standard content-model and artifact contract types |
| `packages/core/src/services/authoring-service.ts` | Page create/update/status logic and language-scoped authoring patterns |
| `packages/web/lib/themes/types.ts` | Theme manifest capability contract mirrored by the reader layer |
| `packages/web/themes/atlas-docs/manifest.ts` | Example theme capability metadata for a top-nav-capable theme |
| `packages/web/themes/classic-docs/manifest.ts` | Baseline theme capability metadata for a non-top-nav theme |
| `packages/core/tests/project-contract.test.ts` | Project config validation and persistence contract coverage |
| `packages/core/tests/authoring-service.test.ts` | Page authoring, language setup, and navigation validation coverage |
| `packages/core/tests/build-preview-service.test.ts` | Build output and published-artifact contract coverage |
| `packages/core/tests/workflow-standard-service.test.ts` | Workflow standard generation and compatibility coverage |
| `packages/mcp/tests/tool-handlers.test.ts` | MCP tool handler envelope and behavior coverage |
| `packages/mcp/tests/server.test.ts` | MCP server registration and integration coverage |

### Technical Decisions

- Keep the first implementation focused on MCP/product-surface gaps, not a wider platform redesign.
- Prefer reuse of existing core services over new MCP-side business logic.
- Add a core-owned theme capability resolver or equivalent shared contract so MCP can surface theme capabilities without depending on web internals.
- Expose theme capability boundaries through `project_open` rather than introducing a new MCP resource in the first slice.
- Treat multilingual support as page skeleton cloning and status inspection only; do not add any translation execution layer.
- Implement workflow sync as a diff/apply wrapper around canonical workflow data, because the current compatibility check is fail-fast and does not produce a usable diff.
- Defer asset/resource management to a future slice so this spec stays implementation-ready and shippable.

## Implementation Plan

### Tasks

- [ ] Task 1: Add shared theme-capability and workflow-diff contract types in core
  - File: `packages/core/src/types/project.ts`
  - Action: Add a core-owned `ProjectThemeCapabilities` type that describes the active theme’s project-surface capabilities, including at minimum the navigation and reader-feature signals needed by `project_open`.
  - Notes: Keep the shape small and serializable so MCP can return it directly.
  - File: `packages/core/src/types/workflow-standard.ts`
  - Action: Add diff types for workflow sync responses so the sync service can return a structured list of changes instead of a boolean compatibility result.
  - Notes: Model diff entries with path, expected, received, and action fields.
  - File: `packages/core/src/services/theme-capabilities-service.ts`
  - Action: Resolve theme capabilities from the active project theme id and expose a single shared helper for MCP and any future core callers.
  - Notes: Keep the resolver core-owned so `@anydocs/mcp` does not depend on web internals.
  - File: `packages/core/src/services/index.ts`
  - Action: Export the new theme capability service so downstream packages can consume it through the core package boundary.

- [ ] Task 2: Extend the build workflow to support a dry-run inspection path
  - File: `packages/core/src/services/build-service.ts`
  - Action: Add a dry-run mode that validates the project, computes the published artifact summary, and returns planned output metadata without writing files.
  - Notes: Preserve the current full-build behavior when dry-run is not requested, including artifact generation and published-only filtering.
  - File: `packages/mcp/src/tools/project-tools.ts`
  - Action: Add a `project_build` tool that invokes the build workflow and returns either a full build result or a dry-run inspection result.
  - Notes: Keep the tool input small for v1: `projectRoot` plus optional `dryRun`.

- [ ] Task 3: Add a workflow sync service that can diff and apply canonical workflow changes
  - File: `packages/core/src/services/workflow-sync-service.ts`
  - Action: Compare the persisted `anydocs.workflow.json` against the canonical definition and return a structured diff for contract drift, with an apply mode that rewrites the file from the canonical contract.
  - Notes: Preserve project-specific generated paths and keep unknown persisted fields from being silently discarded unless the diff explicitly reports them.
  - File: `packages/mcp/src/tools/project-tools.ts`
  - Action: Add a `project_sync_workflow` tool that exposes `dryRun` and `apply` modes over the new core sync service.
  - Notes: Use the same structured validation envelope as the existing project tools.

- [ ] Task 4: Add multilingual page skeleton cloning and translation-status inspection
  - File: `packages/core/src/services/multilingual-service.ts`
  - Action: Implement a helper that clones a source page into another enabled language by copying the page skeleton, optional content, and selected metadata while defaulting the target page to a draft state.
  - Notes: Do not introduce any translation engine; the service should only copy structure and report status.
  - File: `packages/mcp/src/tools/page-tools.ts`
  - Action: Add `page_clone_to_language` and `page_list_translation_status` tools that call the multilingual service and report per-language page pairing state.
  - Notes: Keep the contract page-id centric so it matches the current filesystem-backed page model.

- [ ] Task 5: Wire the MCP project surface to the new core helpers
  - File: `packages/mcp/src/tools/project-tools.ts`
  - Action: Expand `project_open` to return the new theme capability object alongside the existing authoring guidance, and register the new project-level tools.
  - Notes: Keep `project_open` read-only and avoid introducing session state.
  - File: `packages/mcp/src/tools/shared.ts`
  - Action: Preserve the current stable envelope/error mapping and extend it only if the new tool responses require additional structured metadata.
  - Notes: New tools should still return `ok`, `data`, `error`, and `meta` in the same shape as the existing handlers.

- [ ] Task 6: Add core and MCP tests for the new MCP surface
  - File: `packages/core/tests/project-contract.test.ts`
  - Action: Add assertions for supported config updates, theme capability inputs, and invalid project-surface configuration values.
  - Notes: Cover both happy path config persistence and validation failures.
  - File: `packages/core/tests/build-preview-service.test.ts`
  - Action: Add build dry-run coverage and keep assertions for deployable output root behavior.
  - Notes: Ensure dry-run does not emit files.
  - File: `packages/core/tests/workflow-standard-service.test.ts`
  - Action: Add workflow sync-related coverage for canonical diff/apply behavior and drift preservation expectations.
  - Notes: Include a case where the persisted workflow is stale relative to the current contract.
  - File: `packages/core/tests/multilingual-service.test.ts`
  - Action: Add page-clone and translation-status coverage for enabled/disabled language combinations, missing target pages, and pre-existing target conflicts.
  - Notes: Verify the target page remains a draft skeleton unless content copying is explicitly requested.
  - File: `packages/mcp/tests/tool-handlers.test.ts`
  - Action: Add handler-level tests for `project_update_config`, `project_build`, `project_sync_workflow`, `page_clone_to_language`, and `page_list_translation_status`.
  - Notes: Assert stable MCP envelopes and structured validation errors.
  - File: `packages/mcp/tests/server.test.ts`
  - Action: Add server-level registration coverage for the expanded tool list and confirm the new tools are discoverable through the MCP server.
  - Notes: Keep the server test focused on tool availability and a representative call path.

### Acceptance Criteria

- [ ] AC 1: Given a valid Anydocs project with a supported theme id, when `project_open` is called, then the response includes the canonical config, the existing authoring guidance, and a `themeCapabilities` object that reflects the active theme’s project-surface support.
- [ ] AC 2: Given a config patch that updates supported project-surface fields, when `project_update_config` is called, then the project config is written through the canonical validation path and the updated config is returned; when the patch is invalid, then the tool returns a structured validation error and does not write partial changes.
- [ ] AC 3: Given a valid project root, when `project_build` is called with `dryRun: true`, then the tool returns planned build metadata and artifact paths without creating files; when `dryRun` is omitted, then the full build writes deployable artifacts to the output root.
- [ ] AC 4: Given a project whose persisted workflow file is out of sync with the canonical contract, when `project_sync_workflow` is called in `dryRun` mode, then the tool returns a structured diff; when called in `apply` mode, then it rewrites the workflow file and a subsequent project validation reflects the canonical contract.
- [ ] AC 5: Given a source page in an enabled language and an enabled target language, when `page_clone_to_language` is called, then a target-language page skeleton is created without invoking any translation engine and the target page defaults to draft state unless explicitly told to copy content.
- [ ] AC 6: Given source and target languages with partially missing page pairs, when `page_list_translation_status` is called, then the tool returns the paired status for matched page ids and clearly reports pages that exist only in one language.
- [ ] AC 7: Given an unsupported theme id, invalid project config, an unknown workflow state, or a missing target language/page, when the corresponding MCP tool is called, then the tool returns a stable structured error envelope instead of throwing raw exceptions or writing partial data.
- [ ] AC 8: Given the MCP server starts, when tools are listed, then the expanded project and page tool set is discoverable and the new handlers remain callable through the same stdio transport used by the existing MCP server.

## Additional Context

### Dependencies

- `@anydocs/core` remains the only business-logic dependency for the MCP package.
- `@modelcontextprotocol/sdk` is required for tool registration and stdio transport.
- The existing project config, build workflow, and authoring services are the functional base for the new surface.
- The current filesystem-backed project model assumes page ids are language-scoped and compatible with a page-id-centric translation-status view.

### Testing Strategy

- Add focused `node:test` coverage for the new core services before or alongside MCP adapter tests.
- Use temp project roots and filesystem assertions to verify dry-run vs write behavior, diff/apply behavior, and cloned-page persistence.
- Keep MCP tool tests handler-level where possible so the contract can be validated without spinning up a full interactive client.
- Add one server-level test to ensure the expanded tool list is registered and discoverable through the stdio server.
- Verify that error paths return structured `ValidationError` or domain-error payloads instead of raw stack traces.

### Notes

- The highest-risk area is the new theme-capability contract: it must stay core-owned and stable enough for MCP without depending on web package internals.
- The second risk is workflow sync drift handling: the diff must be explicit enough to help agents repair the contract without silently discarding custom fields.
- Multilingual support deliberately stops at structural cloning and status inspection; no translation engine, memory, or post-edit workflow should be added in this slice.
- Asset/resource management stays out of scope on purpose so this spec can be implemented without opening a larger content-asset redesign.
