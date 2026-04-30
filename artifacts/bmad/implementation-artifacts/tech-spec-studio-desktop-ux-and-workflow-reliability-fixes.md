---
title: 'Studio Desktop UX and Workflow Reliability Fixes'
slug: 'studio-desktop-ux-and-workflow-reliability-fixes'
created: '2026-04-28T00:00:00-04:00'
status: 'Completed'
stepsCompleted: [1, 2, 3, 4]
tech_stack: ['TypeScript', 'React', 'Next.js App Router', 'Tauri', 'Rust', 'Node.js desktop server', 'Yoopta editor', 'Tailwind CSS v4', 'Radix/shadcn UI', 'Playwright', 'node:test']
files_to_modify: ['packages/desktop-server/src/services/studio-service.ts', 'packages/desktop-server/src/routes/studio-routes.ts', 'packages/desktop-server/src/types.ts', 'packages/desktop/src-tauri/src/lib.rs', 'packages/web/components/studio/hosts/host-types.ts', 'packages/web/components/studio/hosts/desktop-http-host.ts', 'packages/web/components/studio/hosts/web-local-host.ts', 'packages/web/components/studio/local-studio-app.tsx', 'packages/web/components/studio/welcome-screen.tsx', 'packages/web/components/studio/project-switcher.tsx', 'packages/web/components/studio/project-path-dialog.tsx', 'packages/web/components/studio/local-studio-settings.tsx', 'packages/web/components/studio/navigation-tree.tsx', 'packages/web/components/studio/navigation-composer.tsx', 'packages/web/components/studio/yoo-components/floating-block-actions.tsx', 'packages/web/components/docs/markdown-view.tsx', 'packages/web/components/docs/doc-reader-classnames.ts', 'packages/web/lib/docs/markdown.ts', 'packages/core/src/utils/markdown-content.ts', 'packages/core/src/utils/canonical-render.ts']
code_patterns: ['Shared StudioHost interface abstracts CLI Studio and desktop HTTP hosts', 'Desktop HTTP routes wrap service functions and return { success, data, error } envelopes', 'Desktop Preview/Build currently spawn CLI JSON commands through resolveCliInvocation', 'Studio state is centralized in LocalStudioApp with autosave and workflow state hooks', 'Project Settings is a single scrollable right sidebar composed from SettingsSection blocks', 'Page publishing/deletion exists in page settings and navigation menu, but status actions are not surfaced as page menu commands', 'Canonical DocContentV1 is the source of truth; render.markdown/plainText are derived by renderPageContent', 'Markdown import uses createMarkdownYooptaContent then yooptaToDocContent', 'Reader Markdown uses ReactMarkdown plus remark-gfm and shared reader classnames']
test_patterns: ['Playwright e2e under packages/web/tests/e2e with CLI/desktop mode guards', 'Desktop workflow tests route or hit /studio/build/post and /studio/preview/post', 'Project settings persistence is covered by studio-project-settings.spec.ts', 'Page operations are covered by studio-page-operations.spec.ts', 'Editor block round trip is covered by studio-yoopta-blocks.spec.ts', 'Core rendering/parsing uses node:test under packages/core/tests']
---

# Tech-Spec: Studio Desktop UX and Workflow Reliability Fixes

**Created:** 2026-04-28T00:00:00-04:00

## Overview

### Problem Statement

Studio desktop currently has several blocking and high-friction issues: Preview and Build fail because the desktop runtime cannot find the Anydocs CLI, first-time users cannot create a project from the desktop home screen, Project Settings is too dense for a narrow right sidebar, settings copy and branding are inconsistent, Markdown inline formatting and internal links leak as source text, and common page/block operations are incomplete or hard to discover. These issues prevent the desktop app from feeling like a complete local-first documentation authoring workflow.

### Solution

Fix the desktop Preview/Build CLI discovery path, add a first-class desktop project creation path, reorganize Project Settings into a more scannable structure, remove duplicate theme explanation, correct conflicting copy, repair Markdown inline/link rendering, align branding and visible language, and improve discoverability for workspace tools, page operations, block controls, and code blocks.

### Scope

**In Scope:**
- Fix desktop Preview and Build failure when the desktop server reports that the Anydocs CLI was not found.
- Add a New Project / Create Project / Init Project entry from the desktop home and project switching flow.
- Reorganize Project Settings so General, Reader, Branding, API, and Build settings are easier to scan and do not overload one narrow panel.
- Reduce repeated Reader theme summary text and keep only decision-critical theme details near the form.
- Correct the Show Sidebar Search helper copy so it matches the switch semantics.
- Fix internal relative links such as `[Provider Runtime](./provider-routing)` and `[Tools & Toolsets](./tools)` so they render as clickable links.
- Fix Markdown inline style leakage such as `**Warning**` rendering as raw Markdown.
- Replace stale `DocEditor Studio` naming with Anydocs-consistent branding.
- Resolve obvious Chinese/English mixing on the desktop home screen.
- Improve discoverability and feedback for Workspace tools and Project Settings icon buttons.
- Improve code block contrast and long command readability.
- Make page delete, duplicate, and status/publishing actions discoverable from the page management UI where supported by the data model.
- Improve Add block feedback and Drag to reorder disabled-state affordance in the editor.

**Out of Scope:**
- Do not expand Studio into a layout-heavy page builder.
- Do not implement first-class multi-project workspace routing/build architecture.
- Do not rewrite Yoopta editor internals.
- Do not change reader safety boundaries: draft and in_review content must remain excluded from public reader, search, LLM, and MCP artifacts.

## Context for Development

### Codebase Patterns

- Studio desktop and CLI Studio share the React Studio surface under `packages/web/components/studio`; runtime-specific access is hidden behind `StudioHost`.
- Desktop HTTP APIs return `{ success: true, data }` or `{ success: false, error }` envelopes from `packages/desktop-server/src/routes/studio-routes.ts`.
- Desktop Preview and Build currently spawn CLI JSON commands through `resolveCliInvocation()` in `packages/desktop-server/src/services/studio-service.ts`; bundled CLI mode depends on `ANYDOCS_DESKTOP_CLI_ENTRY` or the default relative `../../../cli/dist/index.js`.
- Tauri starts the managed desktop server from `packages/desktop/src-tauri/src/lib.rs`, injects `ANYDOCS_NODE_BINARY`, chooses `ANYDOCS_DESKTOP_CLI_MODE`, and sets `ANYDOCS_DESKTOP_CLI_ENTRY` only when a bundled CLI resource is found.
- Full desktop bundles include `cli-runtime` and `node-runtime`; lite bundles include only desktop-server/core resources and fall back to system CLI behavior.
- There is already an `ensureProject(projectPath)` service that initializes a project if `anydocs.config.json` is missing, but no desktop HTTP route or StudioHost method exposes a deliberate "create project" flow.
- `LocalStudioApp` owns project selection, recent projects, workflow action state, page save state, and right sidebar mode. It already exposes desktop menu events for open project, new page, and save.
- `Project Settings` is a single scrollable right sidebar composed from `SettingsSection` blocks; Reader theme selection duplicates label, description, recommended use, "why", navigation logic, and preview copy.
- Page delete exists both in the right sidebar danger zone and page navigation menu. Page status publishing exists in Page Settings. Pending review approval exists in the page nav menu, but draft/in_review/published transitions are not surfaced there.
- Yoopta block actions exist through `YooptaFloatingBlockActions`: plus inserts a paragraph after the active block, and the drag handle opens block options on click while serving as a DnD handle.
- Canonical `DocContentV1` is the source of truth. Reader/build markdown is derived with `renderPageContent()` and canonical rendering in `packages/core/src/utils/canonical-render.ts`.
- Markdown import parses inline code, bold, italic, and links in `packages/core/src/utils/markdown-content.ts`, then converts to canonical content. The parser comment explicitly notes nested bold+link is unsupported.
- Reader Markdown rendering uses `ReactMarkdown` + `remark-gfm` in `packages/web/components/docs/markdown-view.tsx`; reader classnames in `doc-reader-classnames.ts` set code/pre contrast.

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `packages/desktop-server/src/services/studio-service.ts` | Desktop Preview/Build service path and CLI lookup failure source. |
| `packages/desktop-server/src/routes/studio-routes.ts` | Desktop server Studio API routes for workflow actions and new project/init endpoint. |
| `packages/desktop-server/src/types.ts` | Shared desktop server response/request types; add create-project response/input if needed. |
| `packages/desktop/src-tauri/src/lib.rs` | Tauri managed-server startup, bundled CLI env resolution, and desktop menu actions. |
| `scripts/prepare-desktop-runtime.mjs` | Packages CLI runtime and node runtime for the full desktop bundle. |
| `packages/desktop/src-tauri/tauri.full.conf.json` | Full desktop resource mapping for `cli-runtime` and `node-runtime`. |
| `packages/desktop/src-tauri/tauri.lite.conf.json` | Lite desktop resource mapping; important for system CLI fallback behavior. |
| `packages/core/src/services/init-service.ts` | Core project initialization behavior used by CLI init and potential desktop project creation. |
| `packages/cli/src/commands/init-command.ts` | CLI init options and JSON response shape to mirror or reuse. |
| `packages/web/components/studio/hosts/host-types.ts` | StudioHost contract; add create/ensure project method. |
| `packages/web/components/studio/hosts/desktop-http-host.ts` | Desktop HTTP StudioHost implementation; call new desktop project route. |
| `packages/web/components/studio/hosts/web-local-host.ts` | CLI Studio local API host; should either implement equivalent create project behavior or return unsupported clearly. |
| `packages/web/components/studio/local-studio-app.tsx` | Main Studio shell, workflow controls, icon buttons, right sidebar entry points, and workflow feedback. |
| `packages/web/components/studio/welcome-screen.tsx` | Desktop/Studio home screen branding, language, open recent projects, and new project entry. |
| `packages/web/components/studio/project-switcher.tsx` | Project switching/open project affordances and likely place for create project action. |
| `packages/web/components/studio/project-path-dialog.tsx` | Existing project path dialog that can be reused or generalized for create/open project. |
| `packages/web/components/studio/local-studio-settings.tsx` | Project Settings structure, Reader theme copy, Show Sidebar Search helper text, API and Build settings. |
| `packages/web/components/studio/navigation-tree.tsx` | Page/navigation item menu actions; already includes delete and pending-review approve, but needs duplicate/status discoverability. |
| `packages/web/components/studio/navigation-composer.tsx` | Navigation/page management orchestration; add duplicate/status callbacks if page menu actions are added. |
| `packages/web/components/studio/yoopta-doc-editor.tsx` | Editor integration and block controls. |
| `packages/web/components/studio/yoo-components/floating-block-actions.tsx` | Add block and drag affordances. |
| `packages/web/components/docs/markdown-view.tsx` | Reader Markdown rendering surface. |
| `packages/web/lib/docs/markdown.ts` | Markdown parsing/rendering helpers and likely internal-link/inline-mark handling. |
| `packages/core/src/utils/markdown-content.ts` | Markdown-to-Yoopta inline parser for imported/created markdown content. |
| `packages/core/src/utils/canonical-render.ts` | Canonical DocContentV1 markdown/plain-text renderer. |
| `packages/core/tests/canonical-render.test.ts` | Existing render tests for inline marks, links, callouts, lists, and code groups. |
| `packages/core/tests/doc-content-adapter.test.ts` | Existing adapter tests for Yoopta/canonical inline links and marks. |
| `packages/web/tests/e2e/desktop-runtime.spec.ts` | Desktop runtime workflow coverage for Build and Preview. |
| `packages/web/tests/e2e/studio-project-settings.spec.ts` | Project Settings coverage. |
| `packages/web/tests/e2e/studio-page-operations.spec.ts` | Page operations coverage. |
| `packages/web/tests/e2e/studio-yoopta-blocks.spec.ts` | Editor block interaction coverage. |

### Technical Decisions

- Prefer incremental fixes within the existing Studio components over broad UI rewrites.
- Keep the desktop app local-first: project creation should initialize a local docs project root using the existing CLI/core project initialization behavior where possible.
- Maintain published-only reader/build invariants while improving authoring UI affordances.
- Keep tests focused on the reported desktop workflows, settings copy/structure, Markdown rendering, and discoverability regressions.
- Desktop create project should use core `initializeProject()` through the desktop server rather than shelling out to `anydocs init`; this avoids depending on the CLI path before the user can create their first project.
- Preview/Build should continue using the CLI workflow path unless investigation during implementation proves a direct core workflow call is safer for desktop packaging; the immediate spec should require clearer bundled CLI resolution and actionable diagnostics.
- Treat the page management issue as discoverability plus missing duplicate/status shortcuts: deletion already exists, and publication status already exists in Page Settings.
- Do not add new editor block types while improving Add block and drag affordance feedback.

## Implementation Plan

### Tasks

- [x] Task 1: Harden desktop CLI resolution for Preview and Build
  - File: `packages/desktop-server/src/services/studio-service.ts`
  - Action: Update `resolveCliEntry()` / `resolveCliInvocation()` diagnostics so desktop can distinguish missing bundled CLI, missing system CLI, and invalid configured entry. Validate `ANYDOCS_DESKTOP_CLI_ENTRY` with `existsSync` before spawning and return an actionable error that includes the resolved mode and path.
  - Notes: Keep existing CLI JSON workflow. Do not bypass published-only build/preview behavior. Ensure `formatCliSpawnError()` includes whether bundled or system mode was attempted.

- [x] Task 2: Verify Tauri managed-server environment passes the bundled CLI entry whenever full bundle resources exist
  - File: `packages/desktop/src-tauri/src/lib.rs`
  - Action: Review `resolve_bundled_cli_entry()` and `spawn_managed_server()` so full desktop builds always pass `ANYDOCS_DESKTOP_CLI_ENTRY` when `Resources/cli/dist/index.js` exists. Add a managed-server startup log or error string that identifies node path, cli mode, and bundled cli entry presence.
  - Notes: Do not require a system `anydocs` binary for full desktop. Lite desktop may continue to require Node/system CLI, but its error must clearly say that.

- [x] Task 3: Expose a desktop create-project route backed by core initialization
  - File: `packages/desktop-server/src/services/studio-service.ts`
  - Action: Add `createProject(input)` or extend `ensureProject(projectPath)` to accept project name, project id, default language, languages, and agent if needed. Call core `initializeProject()` directly.
  - File: `packages/desktop-server/src/routes/studio-routes.ts`
  - Action: Add `POST /studio/project/create` that validates a JSON object body and returns the initialized `ProjectContract` plus created file paths.
  - File: `packages/desktop-server/src/types.ts`
  - Action: Add shared request/response types for desktop project creation if the file already centralizes API payload types.
  - Notes: Do not shell out to CLI init. Return validation errors from core as 400 through existing `resolveStatusCode()`.

- [x] Task 4: Add create-project to the StudioHost contract and desktop host
  - File: `packages/web/components/studio/hosts/host-types.ts`
  - Action: Add `createProject(input): Promise<StudioProjectCreateResponse>` to `StudioHost`, with fields matching the desktop route.
  - File: `packages/web/components/studio/hosts/desktop-http-host.ts`
  - Action: Implement the method by posting to `/studio/project/create`.
  - File: `packages/web/components/studio/hosts/web-local-host.ts`
  - Action: Implement either a CLI Studio local API equivalent if one exists, or throw a clear unsupported error for non-desktop runtimes.
  - Notes: The UI can hide create project when the host/runtime does not support it.

- [x] Task 5: Add first-class New Project entry on the desktop home screen
  - File: `packages/web/components/studio/welcome-screen.tsx`
  - Action: Replace `DocEditor Studio` with `Anydocs Studio`; use one visible language consistently for heading, help text, buttons, and recent projects. Add a primary or secondary `New Project` / `Create Project` action alongside `Open Project`.
  - File: `packages/web/components/studio/project-path-dialog.tsx`
  - Action: Generalize copy/help text so the dialog can be used for both opening an existing project and creating a new project. For create mode, allow an empty target directory that does not contain `anydocs.config.json`.
  - Notes: Preserve existing `data-testid="studio-open-project-button"` and add stable create-project test ids.

- [x] Task 6: Wire create-project into Studio project selection state
  - File: `packages/web/components/studio/local-studio-app.tsx`
  - Action: Add a `handleCreateProject(projectPath)` callback that calls `studioHost.createProject`, registers the resulting project path in recent projects, sets `projectId`, and loads the initialized project. Stop active previews before switching.
  - File: `packages/web/components/studio/project-switcher.tsx`
  - Action: Add `New Project` command item when the host/runtime supports project creation. Reuse or add a create dialog and register the newly created project.
  - Notes: Keep dirty-page flushing behavior before project changes. Do not auto-create projects when the user intended to open an existing folder.

- [x] Task 7: Improve Workspace tools and settings icon affordances
  - File: `packages/web/components/studio/local-studio-app.tsx`
  - Action: Replace the inert `Workspace tools` icon with a visible popover/menu or disable it with explanatory tooltip/copy. Ensure Project Settings has active visual state, accessible label, and a visible sidebar title when open.
  - Notes: If Workspace tools has no implemented actions, the menu should say no workspace tools are available yet and should visibly open/close.

- [x] Task 8: Reorganize Project Settings into a scannable structure
  - File: `packages/web/components/studio/local-studio-settings.tsx`
  - Action: Split project settings into compact sections or tabs/segmented navigation inside the right sidebar: General, Reader, Branding, API Sources, Build. Keep the right sidebar width usable by avoiding full preview content above core form fields.
  - Notes: Do not put cards inside cards. Preserve existing inputs and persistence behavior. Existing `SettingsSection` may be retained but should not create excessive nested panels.

- [x] Task 9: Remove duplicate Reader theme copy and fix conflicting helper text
  - File: `packages/web/components/studio/local-studio-settings.tsx`
  - Action: Collapse Reader theme explanation to one concise summary plus optional preview. Remove repeated label/description/best-for/why/navigation text blocks. Change `Show Sidebar Search` helper from `Hide the sidebar search input.` to copy that matches enabled semantics.
  - Notes: Keep test ids for theme, code theme, logo, color, and search inputs unchanged.

- [x] Task 10: Improve reader code block readability
  - File: `packages/web/components/docs/markdown-view.tsx`
  - Action: Ensure Markdown code blocks use high-contrast foreground, readable line height, and horizontal scroll for long commands.
  - File: `packages/web/components/docs/doc-reader-classnames.ts`
  - Action: Align canonical/Yoopta reader code block classnames with the improved contrast.
  - File: `packages/web/themes/*/tokens.css`
  - Action: If theme tokens override code/pre colors, update only the minimal selectors required to keep text readable.
  - Notes: Avoid broad theme redesign.

- [x] Task 11: Fix Markdown inline style and internal link rendering from imported Markdown
  - File: `packages/core/src/utils/markdown-content.ts`
  - Action: Expand `parseInlineMarkdown()` coverage enough to handle reported cases such as `**Warning**` and relative links like `[Provider Runtime](./provider-routing)` reliably in paragraph/list/table cells. Add tests for adjacent text and punctuation.
  - File: `packages/core/src/utils/canonical-render.ts`
  - Action: Ensure canonical rendering preserves inline marks and link hrefs without escaping them into raw Markdown source.
  - File: `packages/web/components/docs/markdown-view.tsx`
  - Action: If the reader receives stored Markdown, ensure ReactMarkdown handles relative links as clickable anchors and does not render raw markdown for supported inline syntax.
  - Notes: Nested bold-inside-link may remain out of scope unless trivial; document any remaining limitation in tests.

- [x] Task 12: Add page duplicate and status shortcuts to page menu
  - File: `packages/web/components/studio/navigation-tree.tsx`
  - Action: Add visible menu items for Duplicate Page and Set Status / Page Status on page nodes. Keep Delete visible and destructive. Keep Approve visible only for pending review pages.
  - File: `packages/web/components/studio/navigation-composer.tsx`
  - Action: Add callbacks for duplicate/status actions and route them up to `LocalStudioApp`.
  - File: `packages/web/components/studio/local-studio-app.tsx`
  - Action: Implement duplicate by creating a new page from the selected page with unique id/slug/title, then inserting it near the source page in navigation. Implement status shortcuts by reusing the same publication confirmations used in Page Settings.
  - Notes: Slug uniqueness is required within a language. Publishing must still enforce review approval.

- [x] Task 13: Improve editor block action feedback
  - File: `packages/web/components/studio/yoo-components/floating-block-actions.tsx`
  - Action: Make Add block feedback more obvious by opening/focusing the inserted paragraph and ensuring the button has accessible label/test id. Make drag affordance clearly draggable; if click opens options, title/aria-label should not imply click-only drag failure.
  - File: `packages/web/components/studio/yoopta-doc-editor.tsx`
  - Action: Ensure editor placeholder and block action UI do not overlap content and remain discoverable at common viewport sizes.
  - Notes: Do not add unsupported Yoopta blocks.

- [x] Task 14: Update and add regression tests
  - File: `packages/web/tests/e2e/desktop-runtime.spec.ts`
  - Action: Add desktop route/UI coverage for creating a new project, then running Build and Preview without a globally installed CLI in full bundled mode or with mocked route responses when runtime packaging cannot be exercised.
  - File: `packages/web/tests/e2e/studio-project-settings.spec.ts`
  - Action: Assert Project Settings still persists key fields and no longer contains the conflicting `Hide the sidebar search input.` text.
  - File: `packages/web/tests/e2e/studio-page-operations.spec.ts`
  - Action: Cover Duplicate Page and page status menu discoverability, including review-gated publish behavior.
  - File: `packages/web/tests/e2e/studio-yoopta-blocks.spec.ts`
  - Action: Cover Add block and block options affordance visibility at least at smoke-test level.
  - File: `packages/core/tests/canonical-render.test.ts`
  - Action: Add tests for bold warning text and relative internal links surviving conversion/rendering.
  - Notes: Run `pnpm test`; run `pnpm test:acceptance` before GitHub submission because this touches Studio, reader rendering, and desktop workflows.

### Acceptance Criteria

- [ ] AC 1: Given the full desktop runtime includes bundled CLI resources, when a user clicks Build, then the desktop server resolves the bundled CLI entry and the workflow reaches either a successful build result or a build validation error, not `Anydocs CLI was not found`.
- [ ] AC 2: Given the full desktop runtime includes bundled CLI resources, when a user clicks Preview, then the desktop server resolves the bundled CLI entry and returns a preview URL or actionable workflow validation error, not `Anydocs CLI was not found`.
- [ ] AC 3: Given the lite desktop runtime has no bundled CLI and no system CLI, when a user clicks Preview or Build, then the error clearly explains that lite mode requires a system CLI or configured direct entry path.
- [ ] AC 4: Given the desktop home screen has no recent projects, when a first-time user opens Studio, then they can choose New Project/Create Project without using a terminal.
- [ ] AC 5: Given a target directory without `anydocs.config.json`, when the user creates a new project from desktop Studio, then `anydocs.config.json`, `anydocs.workflow.json`, language navigation files, starter pages, and local project folders are initialized.
- [ ] AC 6: Given a project is created from desktop Studio, when initialization succeeds, then the project is registered as recent, opened in Studio, and the pages sidebar becomes available.
- [ ] AC 7: Given a user opens the Studio home screen, when they read the main title and buttons, then visible product naming uses Anydocs consistently and the screen does not mix Chinese explanatory text with English action labels in the same flow.
- [ ] AC 8: Given Project Settings is open, when the user scans settings, then General, Reader, Branding, API Sources, and Build are separated by clear navigation/sections and core form fields are not pushed below repeated theme explanation.
- [ ] AC 9: Given Classic Docs settings are visible, when the Show Sidebar Search toggle is enabled, then its helper text describes showing/enabling the search input rather than hiding it.
- [ ] AC 10: Given Reader theme selection is visible, when a theme is selected, then the UI shows one concise explanation and preview without repeated theme name, best-for, why, navigation logic, and preview summary blocks.
- [ ] AC 11: Given stored Markdown contains `[Provider Runtime](./provider-routing)` or `[Tools & Toolsets](./tools)`, when rendered in the reader, then each appears as a clickable relative link instead of raw Markdown source text.
- [ ] AC 12: Given stored Markdown contains `**Warning**`, when rendered in the reader, then `Warning` is visually bold and the literal `**` delimiters are not visible.
- [ ] AC 13: Given a reader page contains a long command in a code block, when viewed in desktop-width and narrow-width layouts, then the code text remains readable with sufficient contrast and horizontal scrolling instead of clipping.
- [ ] AC 14: Given the Workspace tools icon is clicked, when no workspace tools are implemented, then visible feedback appears instead of no-op behavior.
- [ ] AC 15: Given the Project Settings icon is toggled, when settings open or close, then active state and accessible labels communicate the current state.
- [ ] AC 16: Given a page row menu is opened, when the user scans available actions, then Delete, Duplicate, and Page Status/Set Status are discoverable from that menu.
- [ ] AC 17: Given a page requiring review approval is not approved, when the user attempts to publish it from a page menu shortcut, then publishing is blocked with the same approval requirement enforced by Page Settings.
- [ ] AC 18: Given a page is duplicated from the page menu, when the action completes, then a new page file with a unique id/slug/title is created and a navigation item is inserted near the source page.
- [ ] AC 19: Given the user clicks Add block in the editor, when the block is inserted, then focus moves to the inserted block and the user sees a clear editing target.
- [ ] AC 20: Given the user hovers or focuses the editor drag handle, when drag is available, then the affordance communicates drag-to-reorder; if clicking opens block options, that behavior is also clear.
- [ ] AC 21: Given the implementation is complete, when `pnpm test` runs, then the repository test suite passes.
- [ ] AC 22: Given the implementation touches Studio, reader rendering, and desktop workflows, when preparing for GitHub submission, then `pnpm test:acceptance` also passes or any failure is explicitly documented.
- [ ] AC 23: Given a target directory contains conflicting Anydocs files, when Create Project runs, then it fails without overwriting files and shows the conflicting path plus remediation.
- [ ] AC 24: Given a page already has `copy` variants, when Duplicate Page runs again, then the new page still gets unique `pageId` and `slug`.
- [ ] AC 25: Given Project Settings has unsaved edits, when the user switches between settings sections, then edits are preserved and autosave still writes the expected patch.

## Additional Context

## Review Notes

- Adversarial review completed.
- Findings: 1 total, 1 fixed, 0 skipped.
- Resolution approach: auto-fix.
- Fixed finding: duplicate page slug generation now also avoids derived `pageId` collisions.

### Dependencies

- No new external runtime dependency is expected.
- Existing core `initializeProject()` is the required dependency for desktop project creation.
- Existing CLI build/preview JSON output remains the integration contract for desktop workflow execution.
- Tauri full bundle resource layout must continue to provide `Resources/cli/dist/index.js` and `Resources/node-runtime/<platform>/node`.
- Existing ReactMarkdown and `remark-gfm` should be sufficient for Markdown reader rendering.

### Testing Strategy

- Unit tests: add or extend `packages/core/tests/canonical-render.test.ts` and, if parser behavior changes, tests around `createMarkdownYooptaContent`/adapter behavior for bold text and relative links.
- Component/e2e tests: extend existing Playwright specs instead of creating a new harness.
- Desktop workflow tests: add coverage in `packages/web/tests/e2e/desktop-runtime.spec.ts` for create project and CLI-not-found diagnostics. Use route mocking where needed for UI-state checks; use real desktop runtime for packaging-sensitive behavior when available.
- Settings tests: extend `packages/web/tests/e2e/studio-project-settings.spec.ts` to verify persistence remains intact and the conflicting search helper text is gone.
- Page operations tests: extend `packages/web/tests/e2e/studio-page-operations.spec.ts` for duplicate and status menu actions.
- Editor tests: extend `packages/web/tests/e2e/studio-yoopta-blocks.spec.ts` for Add block focus/visibility and block action affordance.
- Manual smoke: launch desktop Studio, create a new project in a temp directory, edit starter page, run Build, run Preview, open preview URL, and verify reader links/code blocks visually.
- Required pre-GitHub gate: run `pnpm test`; because the work touches Studio, reader routes/rendering, local APIs, and preview/build flows, also run `pnpm test:acceptance`.

### Notes

- User reported these issues from hands-on Studio desktop usage.
- The spec should prioritize unblocking Preview/Build and New Project before lower-severity polish items.
- Highest risk: desktop packaging path differences between full and lite bundles can make CLI resolution pass in dev but fail in packaged app. Validate both env-driven and bundled-resource paths.
- Highest UX risk: Project Settings can become more complex if tabs are added without preserving autosave and dirty-state behavior. Keep the persistence model unchanged.
- Publishing safety remains mandatory: status shortcuts must not allow draft/in_review content into reader/build artifacts unless explicitly set to published and review requirements pass.
- Future consideration: a full Workspace tools panel can be designed later; this spec only requires visible feedback for the current icon.
- Failure mode: desktop project creation can encounter partially initialized or conflicting directories. Implementation must surface core validation errors with the conflicting path and remediation, never overwrite existing files silently.
- Failure mode: page duplication can collide on both `pageId` and `slug`. Implementation must generate and validate unique values within the current language before saving.
- Failure mode: Markdown rendering bugs may originate from import parsing, stored `render.markdown`, canonical render, or reader rendering. Implementation must verify the source before fixing only one layer.
- Failure mode: Project Settings reorganization can break autosave if tabs unmount stateful inputs incorrectly. Keep one project patch pipeline and preserve dirty-state behavior across section switches.
