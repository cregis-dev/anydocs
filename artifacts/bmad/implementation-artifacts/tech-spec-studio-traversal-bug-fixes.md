---
title: 'Studio Traversal Bug Fixes'
slug: 'studio-traversal-bug-fixes'
created: '2026-04-25T05:37:03Z'
status: 'Completed'
stepsCompleted: [1, 2, 3, 4]
tech_stack: ['TypeScript', 'React 19', 'Next.js 16 App Router', 'Yoopta editor', 'Playwright e2e', 'node:test core tests']
files_to_modify: ['packages/web/components/studio/local-studio-app.tsx', 'packages/web/components/studio/yoopta-doc-editor.tsx', 'packages/web/components/studio/use-workflow-state.ts', 'packages/web/scripts/gen-public-assets.mjs', 'packages/web/scripts/start-e2e-studio.mjs', 'packages/web/tests/e2e/desktop-runtime.spec.ts', 'packages/web/tests/e2e/studio-workflow-smoke.spec.ts', 'packages/web/tsconfig.json', 'packages/core/package.json', 'packages/core/tests/canonical-render.test.ts', 'packages/core/tests/package-artifact.test.ts']
code_patterns: ['Local Studio keeps canonical page state in LocalStudioApp and autosaves dirty active pages after a debounce', 'YooptaDocEditor bridges editor content changes to Studio through onChange(nextContent, derived)', 'Workflow state is split between LocalStudioApp execution callbacks and useWorkflowState display/persistence helpers', 'CLI preview/build wrappers snapshot and restore tsconfig around Next runtime invocations', 'E2E tests use stable data-testid selectors and route stubs for desktop workflow assertions']
test_patterns: ['Core tests use node:test with assert from node:assert/strict', 'Web Studio behavior tests use Playwright @playwright/test under packages/web/tests/e2e', 'Acceptance gate for Studio workflow changes is pnpm test:acceptance']
---

# Tech-Spec: Studio Traversal Bug Fixes

**Created:** 2026-04-25T05:37:03Z

## Overview

### Problem Statement

Browser traversal of Anydocs Studio surfaced four usability and correctness issues: passive browsing or language switching can trigger page PUTs that update `updatedAt` and write derived `render` fields, Yoopta-generated markdown for canonical list blocks can lose list item text, selecting a workflow menu item immediately runs Build or Preview instead of only selecting the default action, the Open Preview button relies on programmatic window handling that did not create a visible Browser Use tab, and starting the Studio/build workflow can leave unrelated `packages/web/tsconfig.json` changes in the working tree.

### Solution

Make Studio distinguish initial hydration from user edits, prevent passive changes from being persisted, make workflow menu selection non-executing, expose the preview URL as a normal link action, and harden local tooling so generated Next type includes do not mutate tracked tsconfig state. Fix canonical list render generation at the source used by authoring/build paths.

### Scope

**In Scope:**
- Prevent no-op Studio page saves caused by opening pages, switching languages, or editor hydration.
- Ensure rendered markdown/plain text for canonical list blocks preserves list item text.
- Change the workflow dropdown so menu items select Build or Preview without immediately running them; the main workflow button remains the execution control.
- Make Preview success state open through a robust user-visible link/button path.
- Prevent tracked `packages/web/tsconfig.json` from being rewritten by local Studio/build traversal.
- Add focused tests for changed serialization and workflow/save behavior where practical.

**Out of Scope:**
- Redesigning the Studio editor or navigation composer.
- Changing public reader routes or artifact formats beyond fixing derived render text.
- Adding new workflow actions or changing CLI command semantics.
- Removing page `render` support from the content model.

## Context for Development

### Codebase Patterns

- Studio is a client component centered in `packages/web/components/studio/local-studio-app.tsx`. It owns active page state, dirty flags, debounced autosave, page/language switching, and workflow execution callbacks.
- The Yoopta editor reports content and render metadata through `packages/web/components/studio/yoopta-doc-editor.tsx`. The component currently calls `editor.setEditorValue(...)` when `id` changes and then forwards every Yoopta `onChange` to Studio; this is the likely source of passive dirty state during hydration.
- `LocalStudioApp` currently marks a page dirty inside the `YooptaDocEditor` `onChange` handler and patches `content`, `render`, and `updatedAt` immediately. That means any editor-originated hydration change can become a source-file PUT after the autosave debounce.
- Canonical DocContentV1 render helpers live in `packages/core/src/utils/canonical-render.ts`; `renderPageContent` already dispatches canonical content to `renderDocContent`. The existing canonical render test covers todo list item text, so the lossy `- ` output observed during traversal is likely from Yoopta `editor.getMarkdown(next)`, not from core canonical rendering.
- Workflow state is split between execution callbacks in `local-studio-app.tsx` and display/session persistence in `packages/web/components/studio/use-workflow-state.ts`. The dropdown handler `selectWorkflowAction` currently sets the selected action and immediately runs it.
- Preview startup in `runPreview` pre-opens `about:blank`, then navigates or opens a window after the preview service returns. `handleOpenWorkflowPreview` also uses `window.open`. This is fragile under controlled browser runtimes; a plain link with `href={workflowSuccess.previewUrl}` is more observable.
- `packages/web/scripts/gen-public-assets.mjs` intentionally snapshots and rewrites the tracked `packages/web/tsconfig.json` for `runPreviewProxy`, then restores it only when the child exits. While Studio is running, the working tree is dirty by design.

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `packages/web/components/studio/local-studio-app.tsx` | Studio save, language switch, workflow action, and success UI behavior. |
| `packages/web/components/studio/yoopta-doc-editor.tsx` | Editor hydration/change bridge that currently reports markdown/plainText to Studio. |
| `packages/web/components/studio/use-workflow-state.ts` | Workflow state helpers and existing programmatic preview opener. |
| `packages/core/src/utils/canonical-render.ts` | Canonical DocContentV1 markdown/plainText rendering for lists and other blocks. |
| `packages/core/src/utils/render-page-content.ts` | Dispatch point that already chooses canonical render for valid DocContentV1. |
| `packages/core/src/utils/yoopta-render.ts` | Legacy Yoopta render fallback and possible list behavior reference. |
| `packages/web/scripts/gen-public-assets.mjs` | Existing tsconfig snapshot/restore pattern for generated public asset builds. |
| `packages/web/tsconfig.json` | Tracked config that should not be mutated by Studio traversal. |
| `packages/core/tests/canonical-render.test.ts` | Existing unit coverage for canonical rendering. |
| `packages/web/tests/e2e/desktop-runtime.spec.ts` | Existing Studio workflow and language-switch e2e coverage to update for non-executing menu selection. |
| `packages/web/tests/e2e/studio-workflow-smoke.spec.ts` | CLI Studio P0 workflow smoke test to update for explicit execution. |

### Technical Decisions

- Treat editor initialization and language/page hydration as non-dirty until the user actually edits content.
- Prefer canonical render helpers over Yoopta `getMarkdown` output when persisting canonical DocContentV1-derived page render metadata.
- Workflow dropdown items should be selection controls. Execution stays on the primary workflow button and explicit success follow-up buttons.
- Preview success should contain a normal URL/link target so browsers and automation can open it without depending on preserved `window.open` handles.
- The preview tooling fix should avoid keeping tracked `packages/web/tsconfig.json` modified while a dev server is running. Acceptable implementation directions are using an untracked runtime tsconfig/workspace for preview or restoring the tracked file immediately after Next has consumed the generated include paths, as long as Next generated type output still works.
- Existing e2e tests assume clicking dropdown items runs workflows. Those tests must be updated to select the action and then click `studio-workflow-action-button`, or use a helper that models the new two-step interaction.

## Implementation Plan

### Tasks

- [x] Task 1: Add an editor hydration guard so passive Yoopta initialization does not mark the page dirty.
  - File: `packages/web/components/studio/yoopta-doc-editor.tsx`
  - Action: Track programmatic `editor.setEditorValue(...)` and empty-block initialization with a ref flag or version token so the next Yoopta `onChange` caused by hydration is ignored. Only call `onChange` for user-originated content changes after the editor has fully accepted the current `id` and `value`.
  - Notes: Preserve current behavior that inserts an empty paragraph for truly empty editable documents, but do not autosave that initialization unless the user edits. Reset the guard when `id` changes.

- [x] Task 2: Make Studio save canonical render metadata from core render helpers instead of Yoopta-derived markdown for canonical pages.
  - File: `packages/web/components/studio/local-studio-app.tsx`
  - Action: Import or otherwise use `renderPageContent` from `@anydocs/core` for the active page `onChange` patch when the page content is canonical DocContentV1. Patch `content`, derive `render` from the resulting content, and update `updatedAt` only for actual user edits.
  - Notes: The current `derived` object from `YooptaDocEditor` can remain useful for legacy/Yoopta content if needed, but canonical pages must not persist lossy `editor.getMarkdown(next)` output. Keep `applyPagePatch(..., true)` behavior for review invalidation.

- [x] Task 3: Add or extend canonical render tests for list item preservation.
  - File: `packages/core/tests/canonical-render.test.ts`
  - Action: Add explicit coverage for bulleted and numbered canonical `list` blocks, including nested list items and inline marks/links if practical.
  - Notes: Existing todo-list coverage already proves part of this path. The new assertions should prevent regressions matching the observed `- ` empty-list render.

- [x] Task 4: Change workflow dropdown selection to be non-executing.
  - File: `packages/web/components/studio/local-studio-app.tsx`
  - Action: Update `selectWorkflowAction` so it only calls `setWorkflowAction(action)` and closes the menu. Do not call `triggerWorkflowAction(action)` from this handler.
  - Notes: The primary `studio-workflow-action-button` remains the only top-bar execution control. Success follow-up buttons such as Run Preview can still execute immediately because they are explicit commands.

- [x] Task 5: Make Preview success opening robust and link-based.
  - File: `packages/web/components/studio/local-studio-app.tsx`
  - File: `packages/web/components/studio/use-workflow-state.ts`
  - Action: Render the Preview success action as an anchor or anchor-backed button with `href={workflowSuccess.previewUrl}`, `target="_blank"`, and `rel="noopener noreferrer"` while preserving the existing `data-testid="studio-workflow-open-preview-button"`.
  - Action: Keep `handleOpenWorkflowPreview` only if needed for desktop fallback, but avoid relying exclusively on `window.open` for the visible success action.
  - Notes: Browser automation should be able to inspect the `href` without relying on a programmatic popup. If the component uses the `Button` abstraction, use an `asChild` pattern if available or a styled `<a>`.

- [x] Task 6: Stop `runPreviewProxy` from leaving tracked `packages/web/tsconfig.json` modified while Studio is running.
  - File: `packages/web/scripts/gen-public-assets.mjs`
  - Action: Replace the long-lived direct tsconfig mutation in `runPreviewProxy` with a non-dirty approach. Preferred approach: prepare an untracked runtime workspace similar to `prepareExportWorkspace()`, run Next dev from that workspace with symlinked `node_modules`, mutate only that workspace tsconfig, and clean it up on exit. Alternative: restore tracked tsconfig immediately after Next dev starts if verified that Next does not require the mutation later.
  - Notes: The current export path already uses a copied runtime workspace and restores its tsconfig in `finally`; mirror that pattern for preview if feasible. Maintain `ANYDOCS_NEXT_DIST_DIR='.next-cli-preview'` behavior.

- [x] Task 7: Update Studio workflow e2e tests for two-step workflow selection.
  - File: `packages/web/tests/e2e/desktop-runtime.spec.ts`
  - File: `packages/web/tests/e2e/studio-workflow-smoke.spec.ts`
  - Action: Change tests that currently click `studio-build-button` or `studio-preview-button` and expect immediate POST/progress. They should click the dropdown item, assert the primary action button label changed, then click `studio-workflow-action-button` to execute.
  - Notes: Add a focused assertion that selecting Build does not call the build endpoint until the primary action button is clicked. Keep existing success and error assertions after explicit execution.

- [x] Task 8: Add a regression check that passive language/page traversal does not dirty source files.
  - File: `packages/web/tests/e2e/desktop-runtime.spec.ts`
  - Action: In the existing language-switch test or a new focused test, copy `examples/starter-docs` to a temp project, record the raw `pages/en/welcome.json` and `pages/zh/welcome.json`, open Studio, switch between languages, wait for `All changes saved`, then read both files and assert they are unchanged.
  - Notes: This catches both `updatedAt` churn and unwanted `render` insertion. Use temp project copies to avoid touching fixtures.

- [x] Task 9: Verify and document local gates.
  - File: no source file required unless test scripts need adjustment.
  - Action: Run `pnpm --filter @anydocs/core test` for render coverage, targeted Playwright e2e if practical, then repository gate `pnpm test`. Because Studio workflow behavior changes, run `pnpm test:acceptance` before GitHub submission.
  - Notes: If a browser/runtime limitation blocks e2e locally, document exact command and failure scope in the handoff.

### Acceptance Criteria

- [x] AC 1: Given a clean temp `starter-docs` project, when Studio opens `/studio` and loads the default page without user edits, then no page JSON file has changed on disk after autosave debounce time passes.
- [x] AC 2: Given a clean temp `starter-docs` project, when the user switches from `zh` to `EN` and back without editing content, then `pages/zh/welcome.json` and `pages/en/welcome.json` remain byte-for-byte unchanged.
- [x] AC 3: Given a canonical DocContentV1 page containing bulleted, numbered, and todo list items, when render metadata is generated, then `render.markdown` includes each list item text and does not produce empty `- ` list entries.
- [x] AC 4: Given the Studio workflow dropdown is open, when the user clicks `Build`, then the primary workflow button changes to `Build` and no build request is sent until the primary workflow button is clicked.
- [x] AC 5: Given the Studio workflow dropdown is open, when the user clicks `Preview`, then the primary workflow button changes to `Preview` and no preview request is sent until the primary workflow button is clicked.
- [x] AC 6: Given a successful build result, when the user clicks `Run Preview`, then Preview still runs and the success panel displays `Preview ready` with an `Open Preview` action.
- [x] AC 7: Given a successful preview result with `previewUrl`, when the success panel is rendered, then `studio-workflow-open-preview-button` exposes that URL as a normal `href` targeting a new tab.
- [x] AC 8: Given CLI Studio preview is running, when the process is active before shutdown, then `git diff -- packages/web/tsconfig.json` is empty.
- [x] AC 9: Given workflow endpoint failures are returned by the host, when the explicit primary workflow button is clicked, then existing actionable workflow error messages still render and the footer status reflects the failure.

## Additional Context

### Dependencies

- No new runtime dependency is expected.
- The implementation depends on existing `@anydocs/core` exports for `renderPageContent`.
- The Studio e2e updates depend on the existing Playwright setup and temp-project fixture pattern in `packages/web/tests/e2e/desktop-runtime.spec.ts`.

### Testing Strategy

- Unit: run `pnpm --filter @anydocs/core test` after extending `packages/core/tests/canonical-render.test.ts`.
- E2E targeted: run `pnpm --filter @anydocs/web test:e2e --grep "workflow|language switch|passive"` or equivalent targeted specs after updating Playwright tests.
- Repository gate: run `pnpm test`.
- User-facing Studio gate: run `pnpm test:acceptance` before committing, pushing, or opening a PR.
- Manual verification: start `pnpm --filter @anydocs/cli cli studio /Users/shawn/workspace/code/anydocs/examples/starter-docs`, open `/studio`, switch languages without editing, run `git status --short`, then confirm only intentional generated artifacts, if any, are present.

### Notes

- The initial browser traversal already verified that the reader page itself can render correctly when opened directly. The main correctness risk is source-file churn and lossy generated render metadata during Studio passive interactions.
- The tsconfig issue is not purely cosmetic: a long-running dev server currently keeps a tracked config file modified, which makes unrelated local work look dirty.
- Changing workflow menu semantics will intentionally break old test assumptions. Update tests and UX expectations together so users get predictable "select first, run second" behavior.
- Be careful not to suppress real user edits while fixing hydration. The guard must ignore only programmatic editor setup, not the first real keystroke after a page loads.

## Review Notes

- Adversarial review completed.
- Findings: 11 total, 8 fixed, 3 skipped as noise or uncertain.
- Resolution approach: auto-fix.
- Fixed: hydration guard no longer depends on a short timeout window; web typecheck has a source path for the new core render subpath; unused preview popup hook API was removed; passive traversal e2e asserts no page PUTs; preview runtime cleanup is idempotent; desktop runtime spec explicitly skips outside desktop mode; core package artifact coverage now includes the render-page-content subpath files; CLI Studio e2e now runs its copied web runtime at package-sibling depth so pnpm workspace symlinks still resolve while real `packages/web/tsconfig.json` stays clean.
- Skipped: existing lint warnings outside this change, uncertain click/focus edge-case risk after the stricter no-user-input guard, and old popup-opening expectations that are intentionally replaced by link-based preview opening.
- Validation: `pnpm test:acceptance`, `pnpm test`, `node --experimental-strip-types --test --test-concurrency=1 packages/core/tests/canonical-render.test.ts packages/core/tests/package-artifact.test.ts`, `node --experimental-strip-types --test --test-concurrency=1 packages/core/tests/build-preview-service.test.ts`, `pnpm --filter @anydocs/web typecheck`, `pnpm --filter @anydocs/web lint`, `ANYDOCS_E2E_STUDIO_MODE=cli pnpm --filter @anydocs/web exec playwright test tests/e2e/studio-workflow-smoke.spec.ts`, and targeted desktop-runtime regression tests outside desktop mode, which skipped by design after the runtime guard.
