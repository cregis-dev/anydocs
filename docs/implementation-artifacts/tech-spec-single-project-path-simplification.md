---
title: 'Single-Project Path Simplification'
slug: 'single-project-path-simplification'
created: '2026-03-13T12:02:19+0800'
status: 'Implementation Complete'
stepsCompleted: [1, 2, 3, 4]
tech_stack:
  - 'TypeScript'
  - 'Node.js'
  - 'Next.js'
  - 'node:test'
files_to_modify:
  - 'packages/core/src/config/project-config.ts'
  - 'packages/core/src/fs/project-paths.ts'
  - 'packages/core/src/services/init-service.ts'
  - 'packages/core/src/fs/content-repository.ts'
  - 'packages/core/src/publishing/build-artifacts.ts'
  - 'packages/web/lib/docs/fs.ts'
  - 'packages/core/tests/project-contract.test.ts'
  - 'packages/core/tests/build-preview-service.test.ts'
  - 'examples/demo-docs/**'
  - 'docs/04-usage-manual.md'
  - 'docs/05-dev-guide.md'
code_patterns:
  - 'Canonical path resolution is centralized in project-config.ts and project-paths.ts and consumed through ProjectContract'
  - 'CLI init/build/preview flow delegates to @anydocs/core service layer'
  - 'Published artifact writing is centralized in publishing/build-artifacts.ts and depends on artifactRoot-relative calculations'
  - 'Studio local file access resolves contracts through packages/web/lib/docs/fs.ts using customPath plus DEFAULT_PROJECT_ID'
test_patterns:
  - 'Node test suites use node:test plus assert/strict and create temporary repo roots'
  - 'Workflow tests validate init/build/preview contracts through core service outputs and direct filesystem assertions'
---

# Tech-Spec: Single-Project Path Simplification

**Created:** 2026-03-13T12:02:19+0800

## Overview

### Problem Statement

The current single-project CLI flow initializes content under `content/projects/default` and writes build artifacts under `dist/projects/default`. In real usage, each project directory only hosts one documentation site, so these extra `projects/default` path segments make the source layout, generated output, and CLI logs unnecessarily long and harder to understand.

### Solution

Redefine the canonical single-project contract so the repository root itself is the project root. Source files should live directly under `anydocs.config.json`, `anydocs.workflow.json`, `pages/`, and `navigation/`, while default build output should write directly into `dist/` or the directory supplied by `--output`. Remove compatibility fallback for the old nested `content/projects/default` and `dist/projects/default` structure.

### Scope

**In Scope:**
- Change `init` so a new project is created directly in the target directory
- Change project contract resolution so repo root is treated as the canonical single-project root
- Change default artifact layout from `dist/projects/default` to `dist/`
- Update build, preview, Studio local file helpers, and tests to use the shorter contract
- Update developer and usage docs to describe the new single-project structure

**Out of Scope:**
- Removing the `projectId` field from project config or domain types
- Designing or preserving multi-project workspace directory behavior
- Changing docs reader route structure or publication semantics
- Adding migration tooling for old nested projects

## Context for Development

### Codebase Patterns

- `resolveProjectRoot()` currently prefers repo-root config if present, otherwise silently falls back to `content/projects/{projectId}`. Flattening the contract means removing that fallback instead of adding another branch.
- `createProjectPathContract()` is the single source of truth for `pages/`, `navigation/`, `artifactRoot`, `llms.txt`, `mcp/`, and language search-index paths. Output flattening should happen here first.
- `initializeProject()` does not invent paths on its own; it writes exactly what the contract resolves, then eagerly creates `artifactRoot`, `machineReadableRoot`, and `importsRoot`.
- `loadProjectContract()` validates workflow/config/pages/navigation from the resolved contract root, so changing canonical root semantics automatically affects build, preview, Studio, and update-config flows.
- `writePublishedArtifacts()` currently derives `outputRoot` by walking two directories up from `artifactRoot` and stamps the build manifest with `structure: 'multi-project'`. That logic must be rewritten for flat output.
- `packages/web/lib/docs/fs.ts` treats a user-selected folder as a workspace root and forces `DEFAULT_PROJECT_ID` through `loadProjectContract()`. In the new model, that selected folder should simply be the canonical project root.
- No `project-context.md` file exists in this repository, so code conventions come from the implementation itself plus existing tests/docs.

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `packages/core/src/config/project-config.ts` | Defines default project config and current project root resolution logic |
| `packages/core/src/fs/project-paths.ts` | Defines canonical source and artifact path contract |
| `packages/core/src/services/init-service.ts` | Creates initial project structure and starter content |
| `packages/core/src/fs/content-repository.ts` | Loads and validates project contracts from repo roots |
| `packages/core/src/publishing/build-artifacts.ts` | Writes manifest and published artifacts using current artifactRoot assumptions |
| `packages/web/lib/docs/fs.ts` | Studio-side local project resolution and project creation wrapper |
| `packages/core/tests/project-contract.test.ts` | Contract-level assertions for resolved paths |
| `packages/core/tests/build-preview-service.test.ts` | End-to-end expectations for build and preview outputs |
| `docs/04-usage-manual.md` | User-facing path and workflow documentation |
| `docs/05-dev-guide.md` | Developer examples that currently reference nested paths |

### Technical Decisions

- The target directory passed to `init` becomes the actual project root with no implicit `content/projects/default` nesting.
- Default artifacts go directly into `{repoRoot}/dist`; when `--output` is provided, artifacts go directly into that resolved output directory.
- Old nested single-project layouts are not supported as compatibility inputs for this change.
- `projectId` remains in the config model as a logical project identifier, but it no longer participates in source or artifact path derivation for the single-project contract.
- `build-manifest.json` must describe a flat output directory instead of a multi-project structure, and every `artifacts.*` path recorded in the manifest must be calculated relative to that flat output root.
- Core tests and manual flow validation must be updated to construct repositories at repo root instead of manually joining `content/projects/default`.
- Example/demo fixtures that encode the old nested layout should be updated alongside tests and docs so the repository does not preserve contradictory canonical examples.

## Implementation Plan

### Tasks

- [x] Task 1: Flatten canonical project root resolution in core contract helpers
  - File: `packages/core/src/config/project-config.ts`
  - Action: Replace the current fallback-based `resolveProjectRoot()` behavior so it always resolves the canonical project root to the provided `repoRoot`, while retaining `projectId` validation but not using it for directory nesting.
  - Notes: Remove comments and semantics that describe `content/projects/{projectId}` as the default structure.

- [x] Task 2: Redefine canonical source and artifact paths for single-project mode
  - File: `packages/core/src/fs/project-paths.ts`
  - Action: Update `createProjectPathContract()` so `projectRoot === repoRoot`, source files resolve under `pages/`, `navigation/`, and `imports/` at repo root, and `artifactRoot` resolves directly to `{repoRoot}/dist` or the directory passed through `outputDir` / config.
  - Notes: Ensure `llmsFile`, `machineReadableRoot`, and `languageRoots[lang].searchIndexFile` point to `dist/llms.txt`, `dist/mcp/*`, and `dist/site/assets/search-index.<lang>.json`.

- [x] Task 3: Align initialization flow with the flattened contract
  - File: `packages/core/src/services/init-service.ts`
  - Action: Keep `initializeProject()` using the contract-derived paths, but verify the created-files list and eager directory creation reflect the new flat root and flat `dist/` layout.
  - Notes: Starter content behavior should remain unchanged; only path expectations change.

- [x] Task 4: Update project loading and config persistence to require repo-root project files
  - File: `packages/core/src/fs/content-repository.ts`
  - Action: Remove comments and assumptions about standalone-vs-multi-project fallback and ensure validation/remediation text consistently refers to repo-root canonical files.
  - Notes: `loadProjectContract()` and `updateProjectConfig()` must continue to work when called by CLI and Studio with a repo-root project directory.

- [x] Task 5: Rewrite published artifact emission for flat output directories
  - File: `packages/core/src/publishing/build-artifacts.ts`
  - Action: Update artifact directory calculations so manifest generation, `llms.txt`, `mcp`, and site assets write relative to a flat output root instead of inferring `dist/` by walking up from `artifactRoot`.
  - Notes: Replace manifest metadata that currently reports `structure: 'multi-project'` with wording that matches the flattened layout.

- [x] Task 6: Verify build workflow return values still describe the correct artifact roots
  - File: `packages/core/src/services/build-service.ts`
  - Action: Update `runBuildWorkflow()` return-value expectations and any dependent code if the flattened contract changes the meaning of `artifactRoot` or `machineReadableRoot`, then lock the behavior with tests.
  - Notes: Downstream CLI logging, docs, and tests depend on these fields, so this cannot remain an implicit “check it later” task.

- [x] Task 7: Flatten Studio local project resolution around user-selected folders
  - File: `packages/web/lib/docs/fs.ts`
  - Action: Update local project resolution and project creation helpers so a selected folder is treated as the canonical project root directly, without relying on nested `content/projects/default` layout assumptions.
  - Notes: Preserve the current customPath flow and `DEFAULT_PROJECT_ID` usage where needed for config semantics, but explicitly cover both `createProject()` and `loadProjectContract()` call paths.

- [x] Task 8: Rewrite contract-level tests for the flattened layout
  - File: `packages/core/tests/project-contract.test.ts`
  - Action: Update temp fixture creation and path assertions to place config/pages/navigation at repo root and assert `artifactRoot` points directly to the chosen output root.
  - Notes: Remove manual fixture setup under `content/projects/default`.

- [x] Task 9: Rewrite build/preview workflow tests and repository setup helpers
  - File: `packages/core/tests/build-preview-service.test.ts`
  - Action: Update repository creation, artifact assertions, stale-artifact cleanup checks, and repeated workflow tests to use repo-root pages/navigation plus flat `dist/` output.
  - Notes: Any direct reads of `search-index.*.json`, `mcp/*.json`, and `llms.txt` must follow the new `dist/site/assets` and `dist/mcp` paths.

- [x] Task 10: Update user-facing and developer docs to the new canonical paths
  - File: `docs/04-usage-manual.md`
  - Action: Replace remaining references to workspace-style `content/projects/{projectId}` paths where they describe the default single-project flow.
  - Notes: Keep only the paths that remain true after the contract change.

- [x] Task 11: Update developer workflow examples and verification commands
  - File: `docs/05-dev-guide.md`
  - Action: Rewrite examples, expected init output, build artifact inspection commands, and any sample file paths to use repo-root content and flat `dist/`.
  - Notes: Ensure the docs match the actual manual validation flow used in this feature.

- [x] Task 12: Refresh example project fixtures to the flattened canonical layout
  - File: `examples/demo-docs/**`
  - Action: Update example project structure, generated artifact references, and any checked-in fixture files so they reflect repo-root content and flat `dist/`.
  - Notes: Avoid leaving old nested examples in the repo, since they would contradict the new canonical contract.

### Acceptance Criteria

- [ ] AC 1: Given a new empty target directory, when `anydocs init <targetDir>` runs, then `anydocs.config.json`, `anydocs.workflow.json`, `pages/<lang>/`, `navigation/<lang>.json`, and starter pages are created directly under `<targetDir>`.
- [ ] AC 2: Given a flattened canonical project root, when `loadProjectContract(<targetDir>)` runs, then it resolves `projectRoot` to `<targetDir>` and does not require or search for `content/projects/default`.
- [ ] AC 3: Given a flattened canonical project root, when `anydocs preview <targetDir>` runs, then preview validation succeeds and reports the first published docs route from the repo-root content model.
- [ ] AC 4: Given a flattened canonical project root, when `anydocs build <targetDir>` runs with no `--output`, then `llms.txt`, `mcp/index.json`, `mcp/navigation.<lang>.json`, `mcp/pages.<lang>.json`, and `site/assets/search-index.<lang>.json` are written under `<targetDir>/dist`.
- [ ] AC 5: Given a flattened canonical project root, when `anydocs build <targetDir> --output <dir>` runs, then the same artifact set is written directly under `<dir>` with no `projects/default` path segment anywhere in emitted paths or manifest references.
- [ ] AC 6: Given a user-selected local project folder in Studio, when local file helpers create or open the project, then they read and write `anydocs.config.json`, `pages/`, `navigation/`, and build outputs directly from that folder's canonical root.
- [ ] AC 7: Given the updated test suite, when contract and build/preview tests run, then they assert only the flattened single-project structure and no longer construct fixtures under `content/projects/default` or `dist/projects/default`.
- [ ] AC 8: Given a directory that is missing repo-root `anydocs.config.json`, when `loadProjectContract()`, `anydocs preview`, or `anydocs build` runs, then the error message refers only to repo-root canonical files and does not reference `content/projects/default`.
- [ ] AC 9: Given successful CLI init/build/preview flows and updated automated tests, when paths are logged or asserted, then no success-path output or repository fixture references `content/projects/default` or `dist/projects/default`.

## Additional Context

### Dependencies

- Core path-contract utilities in `@anydocs/core`
- CLI commands that report resolved project and artifact paths
- Studio local filesystem bridge in `packages/web/lib/docs/fs.ts`
- Existing workflow-standard generation and project config validation, which must remain consistent after path changes

### Testing Strategy

- Update contract tests in `packages/core/tests/project-contract.test.ts` to create repo-root fixtures and assert flat output paths.
- Update workflow tests in `packages/core/tests/build-preview-service.test.ts` to validate flat `dist/` artifacts, stale artifact cleanup, and watch-loop behavior.
- Add or update assertions for missing-config failure cases so remediation text references only repo-root canonical files.
- Run focused tests for `@anydocs/core` and `@anydocs/cli` after path changes.
- Manually validate the end-to-end flow: `init`, write sample pages, `preview`, `build`, inspect `dist/`, and repeat `build` with `--output <dir>`.
- Verify that tests, examples, and CLI success logs no longer contain old nested-path strings.

### Notes

- Existing planning docs still describe the nested multi-project contract as canonical; those references must be intentionally corrected rather than treated as implementation bugs.
- Because compatibility is explicitly out of scope, any old nested fixtures or examples should be updated or removed instead of supported conditionally.
- The highest-risk implementation detail is build-manifest generation, because it currently infers the output root by traversing upward from `artifactRoot`; flattening output without rewriting that logic would leave manifest metadata inconsistent with emitted files.
