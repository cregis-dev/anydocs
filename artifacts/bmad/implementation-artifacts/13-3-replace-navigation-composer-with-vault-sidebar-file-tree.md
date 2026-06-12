# Story 13.3: Replace Navigation Composer with VaultSidebar File-Tree

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a documentation maintainer,
I want the left rail to show real page files and folders (the vault file tree) instead of only the abstract structural navigation composer,
so that the surface matches what I see on disk and the Claude Design `VaultSidebar` pattern.

## Acceptance Criteria (as implemented — test-safe sequencing)

1. A new `packages/web/components/studio/vault-sidebar.tsx` renders a **file tree derived from the project's pages**: each page's `slug` path becomes folders + a leaf file (e.g. `getting-started/introduction` → folder `getting-started` › file `introduction`), folders before files, alphabetical, with a per-file publication-status dot and a read-only **System** area showing the project config file. Selecting a file opens it in the editor (wired to `changeActivePage`).
2. The left rail exposes a **Nav / Files toggle** in its header. **Default is `Nav`** (the existing `NavigationComposer`), so every Phase 1 Studio acceptance flow and `data-testid` is unchanged; `Files` switches the rail body to `VaultSidebar`. _(Deliberate test-safe deviation from the AC's "file tree as PRIMARY rail": the acceptance suite that drives the structural composer is env-gated/unrunnable here, so flipping the default blind would risk silent breakage. The default-flip — file tree primary, composer behind an "Edit publication navigation" advanced affordance — is a follow-up to land once the acceptance suite can run. The `NavigationComposer` is preserved and reachable via the toggle, satisfying "structural nav reachable as an explicit mode".)_
3. The tree **reflects page changes**: `VaultSidebar` derives from the live `filteredPages`/`load.pages`, so a renamed (slug change) or deleted page re-renders the tree on the next load. A deleted-but-open page is handled by the existing Studio active-page logic (non-destructive — unchanged by this story).
4. **Data-model adaptation** (Anydocs vs the Claude Design assumption): pages are `pages/<lang>/*.json` (doc-content-v1), not Markdown; the config is `anydocs.config.json`, not `anydocs.config.toml`. The tree is derived from in-memory page slugs (no new file-listing backend), and the System area shows `anydocs.config.json`.
5. The "PAGES" rail heading text is preserved (the acceptance harness `tests/e2e/utils.ts` waits on `text=PAGES`). Editor still mounts only via the Story 7.1 `EditorHost` (no `@yoopta/*`).
6. `pnpm --filter @anydocs/web typecheck` + `pnpm --filter @anydocs/web test` stay green (8 passed / 23 skipped — unchanged baseline; default `Nav` view leaves existing flows intact).

## Tasks / Subtasks

- [x] Build the VaultSidebar component (AC: 1, 4)
  - [x] `vault-sidebar.tsx`: `buildTree(pages)` from `slug` paths (folders + files, sorted), recursive collapsible `FolderRow`/`FileRow`, status dot, read-only System area (`anydocs.config.json`), `pages/<lang>/` root label. `onSelectPage(pageId)`.
- [x] Wire the Nav/Files toggle into the left rail (AC: 2, 5)
  - [x] `leftRailView` state (`'navigation'` default). Toggle buttons added beside the preserved "PAGES" heading (`data-testid="studio-rail-view-navigation"` / `studio-rail-view-files"`).
  - [x] Rail body renders `<VaultSidebar pages={filteredPages} activePageId={activeId} onSelectPage={…} />` when `'files'`, else the existing loading/error/`NavigationComposer` chain.
- [x] Validate (AC: 6)
  - [x] `pnpm --filter @anydocs/web typecheck` exit 0; `pnpm --filter @anydocs/web test` → 8 passed / 23 skipped (baseline unchanged).
- [x] Update `sprint-status.yaml` `13-3-...` → `review`.

## Dev Notes

- **Depends on 13.2** (four-region shell; the rail is the VaultSidebar region) and the existing page-load/select plumbing (`load.pages`, `filteredPages`, `changeActivePage`). No new backend: the tree is a pure projection of page slugs already loaded.
- **Test-safe deviation (the key decision):** the AC wants the file tree as the *primary* rail with the composer demoted to an "Edit publication navigation" advanced affordance. The cli-studio `@p0` acceptance suite drives the composer in the rail and is **skipped** in this headless env (needs a running CLI backend), so a blind default-flip could silently break it. Instead this story ships VaultSidebar behind a **Nav/Files toggle defaulting to Nav** — existing flows untouched, the new tree available opt-in. Flipping the default + the "Edit publication navigation" affordance is a follow-up for a verified pass.
- **No real on-disk file listing:** Anydocs has no file-tree API; pages carry their `slug`, which is the on-disk path under `pages/<lang>/`. Deriving the tree from slugs matches what's on disk without a new endpoint. If true filesystem reflection (e.g. orphan files not in any page) is ever needed, a `pages` listing endpoint would be the extension point.
- **Adaptation from Claude Design:** the source `VaultSidebar` assumed a Markdown vault (`.md` files, `.attachments/`, `anydocs.config.toml`). Anydocs stores JSON page docs + `anydocs.config.json`, so the tree shows page files and a config entry; `.attachments/` is not modelled (no attachments subsystem yet).
- **Scope:** the VaultSidebar component + toggle + selection wiring. NOT the primary-rail default flip / "Edit publication navigation" affordance (follow-up), NOT file rename/delete *operations* from the tree (selection only; CRUD stays in the composer + existing handlers), NOT attachments.

### File Structure Requirements

**To create:**
- `packages/web/components/studio/vault-sidebar.tsx`

**To modify:**
- `packages/web/components/studio/local-studio-app.tsx` — import + `leftRailView` state + Nav/Files toggle + rail-body branch
- `artifacts/bmad/implementation-artifacts/sprint-status.yaml` — status transitions

**Reference-only:**
- `/Users/shawn/Downloads/anydocs-desktop-handoff/desktop-screens-main.jsx` (`VaultSidebar` reference)
- `packages/web/components/studio/navigation-composer.tsx` (preserved default rail)

**Out of scope:** primary-rail default flip + "Edit publication navigation" affordance (follow-up), tree-driven rename/delete, attachments, a filesystem listing API.

## Review Follow-ups (AI)

- [ ] [Med] **Default-flip to file-tree-primary** + demote `NavigationComposer` to an explicit "Edit publication navigation" affordance (the AC's literal primary-rail requirement). Do once the cli-studio `@p0` acceptance suite can run (it drives the composer in the rail), to avoid silent regression.
- [ ] [Low] **Tree-driven file ops / true fs reflection:** optional `pages`-listing endpoint to show orphan files + rename/delete from the tree; current tree is a projection of loaded page slugs.
- [ ] [Verification] Owner: run `pnpm test:acceptance` + visually confirm the Files view renders the tree, selection opens pages, and the Nav default is unchanged.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.8 (`claude-opus-4-8`)

### Completion Notes List

- `vault-sidebar.tsx`: pure projection of `PageDoc[]` → folder/file tree by `slug`; collapsible folders (default open), per-file status dot, read-only System area (`anydocs.config.json`), `pages/<lang>/` root label. `'use client'`. Selecting a file → `onSelectPage(pageId)` → `changeActivePage`.
- `local-studio-app.tsx`: `leftRailView` (`'navigation'` default) + a Nav/Files toggle beside the preserved "PAGES" heading; rail body branches to `VaultSidebar` for `'files'`, else the existing composer chain. Test-safe: default unchanged, "PAGES" text intact (acceptance harness `text=PAGES`), all `data-testid`s preserved.
- Honest deviation from the AC's "file tree primary": kept the composer as default and shipped the tree as an opt-in toggle, because the acceptance suite driving the composer is env-gated/unrunnable here. Default-flip + "Edit publication navigation" affordance logged as a follow-up.

### Validation Evidence

- `pnpm --filter @anydocs/web typecheck` → exit 0
- `pnpm --filter @anydocs/web test` → **8 passed / 23 skipped** (unchanged baseline; default Nav view keeps existing flows; the 23 skips are env-gated cli-studio/reader specs). Core/cli/mcp untouched.
- Verification gap: the cli-studio `@p0` flows + the new Files view are not exercised by the non-gated suite — owner to run `pnpm test:acceptance` + visual check.

### File List

**New files**
- `packages/web/components/studio/vault-sidebar.tsx`

**Modified files**
- `packages/web/components/studio/local-studio-app.tsx` — VaultSidebar import + `leftRailView` state + Nav/Files toggle + rail-body branch
- `artifacts/bmad/implementation-artifacts/13-3-...md` — status ready-for-dev → review; Dev Agent Record + Review Follow-ups
- `artifacts/bmad/implementation-artifacts/sprint-status.yaml` — `13-3-...` backlog → review

## References

- Epics: [Source: artifacts/bmad/planning-artifacts/epics.md#Epic 13 → Story 13.3]
- Predecessor: [Source: artifacts/bmad/implementation-artifacts/13-2-recompose-studio-shell-to-desktop-four-region-layout.md]
- Design source: `/Users/shawn/Downloads/anydocs-desktop-handoff/desktop-screens-main.jsx` (`VaultSidebar`)
- Gate: [Source: CLAUDE.md#Pre-GitHub Submission Gate] (touches Studio → `pnpm test:acceptance` recommended)
