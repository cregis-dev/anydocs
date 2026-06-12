# Story 13.4: Implement Library Surface (Continue + Recent + Stats)

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a documentation maintainer,
I want a Library start page that shows Continue (recent in-progress pages), Recent edits, and project stats,
so that opening Studio gives me an immediate work surface matching the Claude Design `ds-library` screen.

## Acceptance Criteria

1. A new `packages/web/components/studio/library-surface.tsx` renders, in the editor region when a project is open but **no page is active**, three panels matching `ds-library`: **Continue** (recent non-published pages by `updatedAt`), **Recent edits** (all pages by `updatedAt`), and **Stats** (total + per-status counts). Clicking any page card opens it in the editor (`changeActivePage`).
2. For a project with **no pages**, the surface renders the `ds-library-empty` empty state with primary CTAs — **New page** (wired to the real create-page action), plus **Scaffold from prompt**, **Open Markdown folder**, and **Open example vault** (rendered as disabled affordances with honest hints since their backing features are pending: Agent = Epic 11, import = CLI flow, example vault = desktop runtime).
3. The `welcome-screen.tsx` continues to handle first-launch project selection (the existing early-return path); the Library is now the **post-project-open landing** (it replaces the prior "Select or create a page" empty editor state).
4. `pnpm --filter @anydocs/web typecheck` + `pnpm --filter @anydocs/web test` stay green (8 passed / 23 skipped — unchanged baseline; no acceptance test depended on the prior empty-editor text).

## Tasks / Subtasks

- [x] Build the LibrarySurface component (AC: 1, 2)
  - [x] `library-surface.tsx`: pure projection of `PageDoc[]` sorted by `updatedAt` → Continue (non-published, top 4) / Recent edits (top 6) / Stats (total + draft/in_review/published). `PageCard` opens via `onSelectPage`. Empty state with CTAs (`New page` wired; others disabled-with-hint).
- [x] Wire into the editor region (AC: 1, 3)
  - [x] Replaced the `{active ? <EditorHost/> : <div>Select or create a page</div>}` empty branch with `<LibrarySurface pages={filteredPages} projectName={projectState?.name} onSelectPage={…} onCreatePage={() => onCreate('page')} />`.
- [x] Validate (AC: 4)
  - [x] `pnpm --filter @anydocs/web typecheck` exit 0; `pnpm --filter @anydocs/web test` → 8 passed / 23 skipped (baseline unchanged).
- [x] Update `sprint-status.yaml` `13-4-...` → `review`.

## Dev Notes

- **Depends on 13.2/13.3** (shell + rail) and the page-load/select plumbing (`filteredPages`, `changeActivePage`, `onCreate`). No new backend: Library is a projection of already-loaded pages.
- **Landing semantics:** Library shows whenever a project is open and `active` is null (the AC's "without a specific file selected"). First-launch project selection still flows through `welcome-screen.tsx` (unchanged early return). Existing auto-select-on-load behavior (if any) is not modified — Library fills the no-active-page state rather than forcing a redirect.
- **Empty-state CTAs honesty:** only **New page** has a real backing action today. **Scaffold from prompt** (Agent, Epic 11), **Open Markdown folder** (CLI import flow), **Open example vault** (desktop runtime) are rendered disabled with tooltips rather than fake-wired; wire them as those features land. (Follow-up.)
- **Scope:** the Library surface + wiring. NOT the onboarding stepper (13.5), NOT real Agent/import/example actions (their epics), NOT changing auto-select-on-load.

## Review Follow-ups (AI)

- [ ] [Low] Wire the three secondary CTAs once their features exist: Scaffold-from-prompt → Epic 11 Agent; Open-Markdown-folder → import flow; Open-example-vault → desktop create/open.
- [ ] [Verification] Owner: run `pnpm test:acceptance` + visually confirm the Library renders on project-open-without-selection and the empty state shows for a fresh project.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.8 (`claude-opus-4-8`)

### Completion Notes List

- `library-surface.tsx` (`'use client'`): Continue / Recent edits / Stats from `PageDoc[]` by `updatedAt`; status dots + relative date; empty state (`data-testid="studio-library-empty"`) with CTAs; populated state (`data-testid="studio-library"`). New page wired to `onCreate('page')`; secondary CTAs disabled-with-hint (honest — features pending).
- `local-studio-app.tsx`: replaced the no-active-page "Select or create a page" empty editor state with `<LibrarySurface>`. welcome-screen still owns first-launch project selection (AC3).
- Test-safe: no acceptance test referenced the prior empty-editor text; default flows (which select a page) unaffected.

### Validation Evidence

- `pnpm --filter @anydocs/web typecheck` → exit 0
- `pnpm --filter @anydocs/web test` → **8 passed / 23 skipped** (unchanged baseline). Core/cli/mcp untouched.
- Verification gap: the Library landing + empty state are not exercised by the non-gated suite (cli-studio `@p0` flows select a page) — owner to run `pnpm test:acceptance` + visual check.

### File List

**New files**
- `packages/web/components/studio/library-surface.tsx`

**Modified files**
- `packages/web/components/studio/local-studio-app.tsx` — LibrarySurface import + replaced the no-active-page empty editor state
- `artifacts/bmad/implementation-artifacts/13-4-implement-library-surface.md` — status review; Dev Agent Record + Review Follow-ups
- `artifacts/bmad/implementation-artifacts/sprint-status.yaml` — `13-4-...` backlog → review

## References

- Epics: [Source: artifacts/bmad/planning-artifacts/epics.md#Epic 13 → Story 13.4]
- Predecessors: [Source: artifacts/bmad/implementation-artifacts/13-2-recompose-studio-shell-to-desktop-four-region-layout.md], [Source: artifacts/bmad/implementation-artifacts/13-3-replace-navigation-composer-with-vault-sidebar-file-tree.md]
- Design source: `/Users/shawn/Downloads/anydocs-desktop-handoff/desktop-screens-main.jsx` / `desktop-screens-extra.jsx` (`ds-library`, `ds-library-empty`)
- Gate: [Source: CLAUDE.md#Pre-GitHub Submission Gate] (touches Studio → `pnpm test:acceptance` recommended)
