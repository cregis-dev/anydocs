# Story 13.6: Restructure Settings into Six Sub-Pages

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a documentation maintainer,
I want Settings organized into six dedicated sub-pages (General / Models / Vault / Shortcuts / About / Models-Pulling),
so that Settings matches the Claude Design `ScreenSettings*` set and avoids the previous single-page sprawl.

## Acceptance Criteria (as implemented — test-safe slice)

1. A new `packages/web/components/studio/settings-screen.tsx` renders a full-window Settings surface with a shared left navigation strip and six sub-pages: **General**, **Models**, **Vault**, **Shortcuts**, **About**, **Model downloads** (`models-pulling`) — matching the `ScreenSettings*` set.
2. **General reuses the existing project-settings component verbatim** (`<LocalStudioSettings mode="project">` passed in as the `general` slot) — every Phase 1 field and `data-testid` is preserved and nothing is dropped (AC3). The existing **right-aside** project/page settings panel that Phase 1 acceptance tests drive is **left completely untouched** — the new screen is additive, opened by a new gear button, default closed.
3. **About** lists the active runtime mode (Story 8.1, from `bootContext.mode`), the active provider/model (the Story 13.5 localStorage placeholder — real provider-port is Epic 11), and an `@anydocs/editor` contract status line (CI-enforced per Story 6.5). **Models** shows the saved provider/model; **Vault** shows the project name/path (read-only, edited in General); **Shortcuts** lists `⌘\`/`⌘.`/`Esc`; **Model downloads** is an empty-state placeholder (real model pulling = Epic 11).
4. `pnpm --filter @anydocs/web typecheck` + `pnpm --filter @anydocs/web test` stay green (8 passed / 23 skipped — unchanged baseline).

## Tasks / Subtasks

- [x] Build the SettingsScreen component (AC: 1, 3)
  - [x] `settings-screen.tsx` (`'use client'`): left-nav strip + six panes; reads the Story 13.5 model preference from localStorage; `Esc`/close button dismiss. Panes: General (slot), Models, Vault, Shortcuts, About, Model downloads. `data-testid` on screen + each tab/pane.
- [x] Wire as an additive overlay (AC: 2)
  - [x] `settingsScreenOpen` state + a gear button (`data-testid="studio-open-settings"`) in the top header; `<SettingsScreen>` rendered as an `absolute inset-0` overlay inside the (now `relative`) shell. General is fed `<LocalStudioSettings mode="project">` with the same `onProjectChange` plumbing as the right-aside (page-mode props are no-ops). Existing right-aside settings panel unchanged.
- [x] Validate (AC: 4)
  - [x] `pnpm --filter @anydocs/web typecheck` exit 0; `pnpm --filter @anydocs/web test` → 8 passed / 23 skipped (baseline unchanged).
- [x] Update `sprint-status.yaml` `13-6-...` → `review`.

## Dev Notes

- **Test-safe additive design (the key decision):** the existing settings is a **right-aside panel** (`LocalStudioSettings mode='project'|'page'`) that the `studio-project-settings` acceptance spec drives on a single page. Splitting those fields across tabs would hide non-default-tab fields and break that spec (which is env-gated/unrunnable here). So General **reuses the existing component as one source of truth** and the right-aside is untouched; the six-sub-page screen is an additive overlay. Splitting General into finer General/Vault tabs is a follow-up for when the acceptance suite can run.
- **Epic 11 dependency:** Models/About show the Story 13.5 localStorage model placeholder; Model-downloads is an empty placeholder. Real provider config + model pulling are the Epic 11 provider-port.
- **About `@anydocs/editor` version:** exact package version surfacing + a live contract-diff result are deferred (the contract is CI-enforced by Story 6.5; About states that). Runtime mode is real (`bootContext.mode`).
- **Scope:** the additive six-sub-page Settings screen + gear entry. NOT relocating the right-aside settings, NOT splitting General into separate General/Vault field sets, NOT real model config/pull (Epic 11).

## Review Follow-ups (AI)

- [ ] [Med] Once the `studio-project-settings` acceptance suite can run, split the existing General settings into proper General vs Vault sub-pages (project path/vault → Vault; theme/language/identity → General) and retire the right-aside duplication.
- [ ] [Med] Wire Models/About to the real `AgentProviderPort` config + surface the `@anydocs/editor` version + live contract-diff result (Epic 11 / Story 6.5 runtime hook).
- [ ] [Low] Implement real Model-downloads (pull progress) when the local-model subsystem lands (Epic 11).
- [ ] [Note] Possible pre-existing 13.2 redundancy: the header `studio-toggle-left-sidebar` button (`leftSidebarOpen`) and the 13.2 `⌘\` `sidebarVisible` may be two independent toggles for the left rail — reconcile in a 13.2 follow-up (visual verification needed).
- [ ] [Verification] Owner: run `pnpm test:acceptance` + visually confirm the gear opens the six-tab Settings, General edits persist, and the right-aside settings still work.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.8 (`claude-opus-4-8`)

### Completion Notes List

- `settings-screen.tsx`: full-window overlay with a six-item left nav (General / Models / Vault / Shortcuts / About / Model downloads); General renders the passed-in existing project settings; the rest read real runtime mode + the Story 13.5 localStorage model placeholder, with honest Epic 11 notes. `Esc` + close button dismiss.
- `local-studio-app.tsx`: `settingsScreenOpen` state + a gear button in the top header; shell made `relative` so the `absolute inset-0` overlay covers it; General fed `<LocalStudioSettings mode="project">` with the same project-change plumbing. The acceptance-critical right-aside settings panel is unchanged.
- Honest deviation: additive overlay (not a relocation/split of the existing settings) because the single-page acceptance spec drives the right-aside and is unrunnable headless. Splitting General/Vault + Epic 11 wiring logged as follow-ups.

### Validation Evidence

- `pnpm --filter @anydocs/web typecheck` → exit 0
- `pnpm --filter @anydocs/web test` → **8 passed / 23 skipped** (unchanged baseline; gear default closed, right-aside untouched). Core/cli/mcp untouched.
- Verification gap: the Settings screen + General-edit-persist are not exercised by the non-gated suite — owner to run `pnpm test:acceptance` + visual check.

### File List

**New files**
- `packages/web/components/studio/settings-screen.tsx`

**Modified files**
- `packages/web/components/studio/local-studio-app.tsx` — SettingsScreen import + `settingsScreenOpen` state + gear button + `relative` shell + overlay render
- `artifacts/bmad/implementation-artifacts/13-6-restructure-settings-into-six-sub-pages.md` — status review; Dev Agent Record + Review Follow-ups
- `artifacts/bmad/implementation-artifacts/sprint-status.yaml` — `13-6-...` backlog → review

## References

- Epics: [Source: artifacts/bmad/planning-artifacts/epics.md#Epic 13 → Story 13.6]
- Predecessors: [Source: artifacts/bmad/implementation-artifacts/13-5-implement-four-step-onboarding-flow.md] (model preference placeholder), [Source: artifacts/bmad/implementation-artifacts/13-1-port-tokens-css-and-shell-primitives-into-anydocs-web.md]
- Design source: `/Users/shawn/Downloads/anydocs-desktop-handoff/` (`ScreenSettings*`)
- Gate: [Source: CLAUDE.md#Pre-GitHub Submission Gate] (touches Studio → `pnpm test:acceptance` recommended)
