---
title: 'Docs Site Build And Dynamic Preview'
slug: 'docs-site-build-and-dynamic-preview'
created: '2026-03-13T12:41:00+0800'
status: 'ready-for-dev'
stepsCompleted: [1, 2, 3, 4]
tech_stack:
  - 'TypeScript'
  - 'Node.js'
  - 'Next.js 16 App Router'
  - 'React 19'
  - 'node:test'
  - 'Playwright'
files_to_modify:
  - 'packages/core/src/fs/project-paths.ts'
  - 'packages/core/src/services/build-service.ts'
  - 'packages/core/src/publishing/build-artifacts.ts'
  - 'packages/core/src/services/preview-service.ts'
  - 'packages/cli/src/commands/build-command.ts'
  - 'packages/cli/src/commands/preview-command.ts'
  - 'packages/web/next.config.mjs'
  - 'packages/web/package.json'
  - 'packages/web/scripts/gen-public-assets.mjs'
  - 'packages/web/app/[lang]/page.tsx'
  - 'packages/web/app/[lang]/docs/layout.tsx'
  - 'packages/web/app/[lang]/docs/[[...slug]]/page.tsx'
  - 'packages/web/app/docs/[[...slug]]/page.tsx'
  - 'packages/web/lib/docs/data.ts'
  - 'packages/core/tests/build-preview-service.test.ts'
  - 'packages/cli/tests/watch-command.test.ts'
  - 'packages/web/tests/e2e/studio.spec.ts'
  - 'docs/04-usage-manual.md'
  - 'docs/05-dev-guide.md'
code_patterns:
  - 'CLI orchestration lives in @anydocs/core services with thin @anydocs/cli command wrappers'
  - 'Docs reader rendering already exists in Next.js App Router pages under packages/web/app/[lang]/docs'
  - 'Published docs data is loaded from filesystem-backed helpers in packages/web/lib/docs/data.ts'
  - 'Current preview context depends on anydocs_preview_project_id and anydocs_preview_path cookies'
  - 'Reader routes are hard-disabled outside production with process.env.NODE_ENV checks'
test_patterns:
  - 'Core workflow behavior is covered with node:test suites in packages/core/tests'
  - 'CLI long-running preview/build behavior is covered in packages/cli/tests/watch-command.test.ts'
  - 'Web user-facing preview affordances are lightly covered by Playwright Studio tests'
---

# Tech-Spec: Docs Site Build And Dynamic Preview

**Created:** 2026-03-13T12:41:00+0800

## Overview

### Problem Statement

The current CLI build workflow does not emit a complete, directly openable Docs Site as static HTML, and the current CLI preview workflow only prints a route instead of launching a browsable Docs Site. This leaves documentation teams unable to validate the real reader experience through the CLI alone and prevents `build` output from being used as a complete static site deployment artifact.

### Solution

Extend CLI `build` so it produces a complete static Docs Site that can be deployed and opened directly, with output paths that match deployment expectations without introducing an extra `/site` URL prefix. Redesign CLI `preview` so it starts a local dynamic Docs Site preview server that renders the reader experience without requiring static HTML compilation first.

### Scope

**In Scope:**
- Make CLI `build` generate complete static HTML pages for the Docs Site
- Ensure build output paths are deployment-safe and do not require an extra `/site` URL segment
- Make CLI `preview` start a local dynamic preview server and print the preview URL
- Reuse existing web reader rendering/data logic where practical
- Add tests and docs for buildable static output and dynamic preview behavior

**Out of Scope:**
- Reworking Studio editing workflows
- Adding SSR, auth, or hosted deployment infrastructure
- Multi-project workspace redesign
- Non-Docs-Site web application changes beyond what preview/build need

## Context for Development

### Codebase Patterns

- `packages/web/next.config.mjs` already uses `output: 'export'`, so the web package has a static-export orientation, but that export path is currently tied to the web app build and not to arbitrary CLI target directories.
- Reader route rendering already exists in `packages/web/app/[lang]/docs/...` and is backed by `packages/web/lib/docs/data.ts`, so build and preview should prefer reusing the existing reader rather than reimplementing HTML rendering from scratch.
- Current CLI build behavior lives in `@anydocs/core` and only writes search indexes, `llms.txt`, MCP artifacts, and manifest metadata; it does not invoke Next build/export or emit HTML.
- Current CLI preview behavior is validation-only and returns `docsPath`, but does not run an HTTP server.
- Current preview project selection relies on cookies (`anydocs_preview_project_id`, `anydocs_preview_path`) set by the Studio-local preview API, which is not directly usable by a standalone CLI preview command without extra bootstrapping.
- Reader routes in `packages/web/app/[lang]/page.tsx`, `packages/web/app/[lang]/docs/layout.tsx`, `packages/web/app/[lang]/docs/[[...slug]]/page.tsx`, and `packages/web/app/docs/[[...slug]]/page.tsx` explicitly return `notFound()` outside production, so a CLI preview server cannot rely on plain `next dev` unless that gating changes.
- `packages/web/scripts/gen-public-assets.mjs` currently shells out to the CLI build for the repository root, which confirms the current web export flow is oriented around the tool repo’s own project context rather than arbitrary external docs projects.

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `packages/core/src/services/build-service.ts` | Current build entrypoint and artifact loading |
| `packages/core/src/publishing/build-artifacts.ts` | Current non-HTML artifact emission |
| `packages/core/src/services/preview-service.ts` | Current route-only preview workflow |
| `packages/cli/src/commands/build-command.ts` | CLI build UX and logging |
| `packages/cli/src/commands/preview-command.ts` | CLI preview UX and watch behavior |
| `packages/web/next.config.mjs` | Static export settings already enabled in web package |
| `packages/web/package.json` | Web build/start/dev scripts that may need reuse by CLI workflows |
| `packages/web/scripts/gen-public-assets.mjs` | Existing bridge between web build and core CLI-generated artifacts |
| `packages/web/app/[lang]/page.tsx` | Language root redirect behavior and production-only reader gate |
| `packages/web/app/[lang]/docs/layout.tsx` | Reader layout and language switching |
| `packages/web/app/[lang]/docs/[[...slug]]/page.tsx` | Reader page rendering and static params |
| `packages/web/app/docs/[[...slug]]/page.tsx` | Default-language docs redirect behavior |
| `packages/web/lib/docs/data.ts` | Published docs data loading for the reader |
| `packages/core/tests/build-preview-service.test.ts` | Existing build/preview workflow contract tests |
| `packages/cli/tests/watch-command.test.ts` | Existing CLI watch-mode behavior tests |

### Technical Decisions

- Static HTML output must be deployable without an extra `/site` URL prefix in public paths.
- CLI preview should start a real local preview server by default and print a URL.
- Dynamic preview should not require precompiled static HTML.
- Existing search index, MCP, and `llms.txt` outputs should remain available alongside the HTML site output.
- Public HTML routes and public reader assets should be emitted directly under the selected output root, for example `dist/index.html`, `dist/en/docs/.../index.html`, `_next/*`, and `search-index.<lang>.json`, rather than under `dist/site/...`.
- The final exported docs-site artifact must be pruned to docs-reader deliverables only; non-reader routes/directories such as `studio/`, `admin/`, and `projects/`, along with internal Next export metadata like `_not-found/` and debug `.txt` files, must not remain in the deployable output. `llms.txt` is the only expected `.txt` artifact at the root.
- Because current reader routes are production-gated and cookie-driven, implementation will likely need an explicit CLI preview mode and/or environment-backed project context rather than trying to use the current Studio preview cookies unchanged.
- Static export for arbitrary docs projects is not solved by current `next build` alone; the implementation must decide how the web export process receives the target project root and target output directory in a reproducible way.
- CLI preview should treat the docs project directory as live source-of-truth and render from filesystem data without requiring a preceding `build`; if the implementation keeps `--watch`, it should either map to the same live-preview behavior or be clearly deprecated.
- Production-only protections for the normal Studio/web app must remain intact; reader routes should only become available outside production when an explicit CLI preview/export execution context is present.

## Implementation Plan

### Tasks

- [ ] Task 1: Redefine the public artifact path contract around a deployable output root
  - File: `packages/core/src/fs/project-paths.ts`
  - Action: Change the build path contract so public reader artifacts resolve directly under the selected output root instead of under `site/`, including the per-language search index location used by the docs reader.
  - Notes: Keep machine-readable artifacts under `mcp/` and `llms.txt` at the output root; ensure the contract still supports both default `dist/` and explicit output directories.

- [ ] Task 2: Split build orchestration into data-artifact generation plus static docs-site export
  - File: `packages/core/src/services/build-service.ts`
  - Action: Extend `runBuildWorkflow()` so it first prepares published docs data, then invokes a reusable web-export bridge that produces the static HTML docs site for an arbitrary docs project root and arbitrary output directory.
  - Notes: The workflow result should continue exposing the final output root, and may need extra metadata for exported HTML entrypoints to support CLI logging and tests.

- [ ] Task 3: Align generated search, MCP, llms, and manifest artifacts with the deployable HTML layout
  - File: `packages/core/src/publishing/build-artifacts.ts`
  - Action: Update artifact emission and manifest metadata so public assets referenced by the reader no longer point at `site/assets`, and manifest paths describe the final root-level HTML/static layout accurately.
  - Notes: `build-manifest.json`, `mcp/index.json`, and any relative file references must match the new exported site structure exactly.

- [ ] Task 4: Add a web-export bridge that can render the docs reader for arbitrary project roots
  - File: `packages/web/package.json`
  - Action: Add or adjust scripts so the web package can be launched in a CLI-controlled export mode, with project root and output directory supplied explicitly by environment variables or command arguments.
  - Notes: This should be designed for reuse by `@anydocs/core`, not only for the repository-root demo project.

- [ ] Task 5: Rework the current repo-root-only asset generation script into a reusable export entrypoint
  - File: `packages/web/scripts/gen-public-assets.mjs`
  - Action: Replace the current hardcoded repo-root `build` bridge with a CLI-oriented export/bootstrap script that can receive a docs project root and export destination from the calling workflow.
  - Notes: The resulting script should support both the web package's own build needs and external docs-project builds without duplicating logic.

- [ ] Task 6: Make reader routes load published docs from explicit CLI preview/export context
  - File: `packages/web/lib/docs/data.ts`
  - Action: Introduce a shared context-resolution path that can read project identity and custom project root from explicit CLI preview/export signals before falling back to Studio cookie-based preview behavior.
  - Notes: This is the seam that lets the same reader code serve exported HTML and live CLI preview without hardcoding the tool repo root.

- [ ] Task 7: Relax production-only route gating only for explicit CLI preview/export mode
  - File: `packages/web/app/[lang]/page.tsx`
  - Action: Update the language-root route to allow docs reader behavior when the process is running in a trusted CLI preview/export context instead of unconditional `NODE_ENV === 'production'`.
  - Notes: Normal development access without explicit preview/export context must remain blocked.

- [ ] Task 8: Apply the same explicit preview/export gate to the docs layout and page routes
  - File: `packages/web/app/[lang]/docs/layout.tsx`
  - Action: Update the docs layout to use the shared preview/export context and no longer rely exclusively on preview cookies for loading languages, nav, and pages.
  - Notes: Preserve current language switcher, sidebar, breadcrumbs, and published-only filtering behavior.

- [ ] Task 9: Make the docs page and default-language redirect routes export- and preview-aware
  - File: `packages/web/app/[lang]/docs/[[...slug]]/page.tsx`
  - Action: Update reader page rendering, `generateStaticParams()`, and metadata generation so they work for CLI export and live CLI preview using the same explicit project context.
  - Notes: The default-language redirect in `packages/web/app/docs/[[...slug]]/page.tsx` must also be validated so exported routes and preview routes land on the correct pages.

- [ ] Task 10: Implement a real preview-server workflow in core
  - File: `packages/core/src/services/preview-service.ts`
  - Action: Replace the current route-only preview result with a workflow that validates the project, resolves the initial docs route, starts a local docs preview server, and returns the chosen URL plus lifecycle metadata.
  - Notes: The service should define the contract for host/port selection, process cleanup, and behavior when there are zero published pages.

- [ ] Task 11: Update CLI build and preview commands to reflect the new workflows
  - File: `packages/cli/src/commands/build-command.ts`
  - Action: Expand build logging so it reports the deployable output root and exported docs entrypoint clearly, and ensure failures from the export phase surface as build failures.
  - Notes: The companion preview command in `packages/cli/src/commands/preview-command.ts` must become a long-running local-server command, print the final URL, and reconcile existing `--watch` behavior with live preview semantics.

- [ ] Task 12: Rewrite build/preview workflow tests around exported HTML and live preview URLs
  - File: `packages/core/tests/build-preview-service.test.ts`
  - Action: Update tests to assert root-level HTML output, root-level search index paths, manifest correctness, preview-server metadata, zero-published-page behavior, and invalid-project failures.
  - Notes: Remove assertions that only validated route strings or `site/assets` paths.

- [ ] Task 13: Rewrite CLI watch/preview tests for the long-running preview server model
  - File: `packages/cli/tests/watch-command.test.ts`
  - Action: Update CLI tests so build assertions cover HTML export output and preview assertions cover startup URL logging, clean shutdown, and whichever live-update semantics are chosen for preview mode.
  - Notes: If `preview --watch` becomes a compatibility alias or deprecation path, tests must pin that behavior explicitly.

- [ ] Task 14: Add browser-level verification for exported and previewed docs routes
  - File: `packages/web/tests/e2e/studio.spec.ts`
  - Action: Add or refocus an end-to-end check so a real docs page can be loaded in preview/export mode and the rendered reader shell matches the expected published content.
  - Notes: This can stay lightweight, but it must validate the user-visible route instead of only Studio chrome.

- [ ] Task 15: Update CLI and developer documentation to the new build/preview model
  - File: `docs/04-usage-manual.md`
  - Action: Rewrite user-facing guidance so `build` is documented as generating a deployable static docs site and `preview` is documented as starting a live local docs server.
  - Notes: Update output path examples to show root-level HTML routes with no `/site` prefix.

- [ ] Task 16: Update developer workflow docs and repo-local build assumptions
  - File: `docs/05-dev-guide.md`
  - Action: Rewrite developer examples, verification commands, and any references to current route-only preview or data-only build artifacts.
  - Notes: Document how the web package export bridge is meant to be invoked by the CLI and by repository-local workflows.

### Acceptance Criteria

- [ ] AC 1: Given a docs project with published pages, when `anydocs build <targetDir>` runs successfully, then the output root contains deployable HTML pages directly at route-matching paths such as `index.html` and `<lang>/docs/.../index.html`, with no required `/site` URL prefix.
- [ ] AC 2: Given the same project, when the built site is served from the selected output root, then internal docs navigation, default-language redirects, and reader asset requests resolve correctly without any references to `site/assets` or `dist/site`.
- [ ] AC 3: Given a docs project with published pages, when `anydocs build <targetDir>` completes, then `llms.txt`, `mcp/index.json`, per-language MCP files, `build-manifest.json`, and public search indexes are emitted in locations that match the exported HTML site layout.
- [ ] AC 4: Given `anydocs build <targetDir> --output <dir>` or a configured build output directory, when build completes, then the entire static docs site and supporting artifacts are written directly into that chosen directory with the same route-safe structure.
- [ ] AC 4a: Given a successful static export, when inspecting the deployable output root, then non-docs-site directories such as `studio/`, `admin/`, and `projects/`, plus internal export artifacts such as `_not-found/` and debug `.txt` files, are absent; `llms.txt` remains available as the only expected `.txt` artifact.
- [ ] AC 5: Given a docs project with zero published pages, when `anydocs build <targetDir>` runs, then it still produces a valid docs shell and manifest output without crashing, and the default docs route resolves to an empty-state reader page.
- [ ] AC 6: Given a valid docs project, when `anydocs preview <targetDir>` runs, then it starts a local docs preview server, prints an openable URL, and serves the same published-only reader experience without requiring a prior static build.
- [ ] AC 7: Given the preview server is running, when published docs content changes on disk, then the previewed site reflects the updated content through the chosen live-preview mechanism without rerunning `anydocs build`.
- [ ] AC 8: Given the web app is running in normal development mode without explicit CLI preview/export context, when a user accesses docs reader routes, then they remain unavailable as they are today; only trusted CLI preview/export mode enables them outside production.
- [ ] AC 9: Given an invalid docs project root or missing required config/pages/navigation files, when `anydocs build` or `anydocs preview` runs, then the command fails with canonical repo-root remediation text and does not emit partial HTML/site output.

## Additional Context

### Dependencies

- `@anydocs/core`
- `@anydocs/cli`
- `@anydocs/web`
- Next.js static export and App Router reader pages
- Local file-backed published docs data loaders in the web package
- Node child-process orchestration between core workflows and web-package build/preview entrypoints
- Existing preview context infrastructure in the web app, which must be generalized rather than duplicated
- Current search index consumer in `packages/web/components/docs/search-panel.tsx`, which expects a deployable public search-index path and therefore constrains the final artifact layout

### Testing Strategy

- Extend core tests to assert HTML export at route-matching paths, root-level search index locations, manifest correctness, and preview workflow metadata.
- Extend CLI tests to cover build export logging, preview server startup/shutdown, URL printing, and the chosen behavior of `preview --watch`.
- Add or refocus browser-level tests so an exported or previewed docs page is actually rendered and navigable, not just syntactically generated.
- Manually validate `build` against both default `dist/` and a custom output directory, then serve the generated directory with a static server to confirm links and assets work.
- Manually validate `preview` on a real docs project by opening the emitted URL, editing a published page, and confirming the preview reflects the change without a separate build.

### Notes

- The final output structure must be unambiguous for static deployment and must not expose a mismatch between filesystem layout and public URL layout.
- Preview UX should match user expectations: the command should return a real URL and remain usable until the user stops it, not just validate a route.
- The highest-risk architecture point is bridging arbitrary external project roots into the web reader/export pipeline without reintroducing repository-root assumptions.
- A second high-risk area is preserving the current production-only security boundary for Studio and local APIs while still enabling CLI preview/export outside production through an explicit trusted context.
- If Next.js export cannot target arbitrary project roots cleanly with the current script structure, the implementation should prefer introducing a narrow CLI-facing bridge rather than forking a second reader renderer.
