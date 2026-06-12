# Story 13.7: Implement Command Palette with Workspace Agent Entry

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a documentation maintainer,
I want a command palette (⌘P) with explicit Agent invocation entries (inline / page / workspace) and shared actions,
so that I have a single keyboard-first entry matching the Claude Design `ds-palette` and UX Specification §6.4.

## Acceptance Criteria (as implemented — dependency-honest slice)

1. A new `packages/web/components/studio/command-palette.tsx` renders an overlay invoked by **⌘P** (and ⌘O) with a search box, keyboard navigation (↑/↓/Enter/Esc), and three sections: **ASK WRITER** (three scope-labeled entries — inline `⌘I` / page `⌘⇧I` / workspace `⌘⌥I`), **NAVIGATION** ("Switch file" — the actual pages), and **ACTIONS** ("Build & Publish", "Audit log… `⌘⇧A`", "Toggle dark mode"). _(Verified live: palette opens, fuzzy filter works, sections + shortcuts render.)_
2. The ASK WRITER entries are **rendered with their shortcuts (AC1) but disabled with honest hints** — Agent invocation requires the built-in Agent (Epic 11), and the workspace entry's Scope Escalation Modal + signed token require Stories 12.2/12.3, none of which exist yet. AC2's escalation→token→`agent-service.invokeAgent()` flow is therefore **deferred** (Review Follow-up).
3. The "Audit log…" entry is **disabled with a hint** because it must route to the Audit Log Query view (Story 13.10), which is not built yet (AC3 deferred).
4. The functional entries work: **Switch file** opens the selected page (`changeActivePage`), **Build & Publish** runs the existing `runBuild`, **Toggle dark mode** flips the Tailwind `.dark` class on `<html>`. The palette closes after running an action.
5. `pnpm --filter @anydocs/web typecheck` + `pnpm --filter @anydocs/web test` stay green (8 passed / 23 skipped — unchanged baseline). **Live-verified** in a real browser (cli-mode Studio): zero console errors.

## Tasks / Subtasks

- [x] Build the CommandPalette component (AC: 1, 2, 3, 4)
  - [x] `command-palette.tsx` (`'use client'`): overlay + search + ↑/↓/Enter/Esc keyboard nav; sections ASK WRITER / NAVIGATION / ACTIONS; fuzzy filter; disabled entries with hints; `data-testid` on palette/input/items.
  - [x] Functional: Switch-file → `onSelectPage`; Build & Publish → `onBuild`; Toggle dark mode → `document.documentElement.classList.toggle('dark')`. Disabled: ASK WRITER ×3 (Epic 11/12), Audit log (13.10).
- [x] Wire ⌘P/⌘O + overlay (AC: 1, 4)
  - [x] `paletteOpen` state; added `⌘P`/`⌘O` to the existing 13.2 keyboard effect (meta/ctrl-gated, `preventDefault`); rendered `<CommandPalette pages={filteredPages} onSelectPage onBuild={runBuild} />` as an overlay.
- [x] Validate (AC: 5)
  - [x] `pnpm --filter @anydocs/web typecheck` exit 0; `pnpm --filter @anydocs/web test` → 8 passed / 23 skipped; live Playwright check (palette opens, 7 entries incl. 3 Ask-Writer w/ shortcuts, filter, dark-toggle, closes) — **0 console errors**.
- [x] Update `sprint-status.yaml` `13-7-...` → `review`.

## Dev Notes

- **Three unbuilt dependencies (the reason for the slice):** ASK WRITER invocation = Epic 11 (Agent) + Stories 12.2/12.3 (escalation modal + signed token); "Audit log…" route = Story 13.10. All rendered as disabled entries with honest hints; the functional NAVIGATION/ACTIONS entries (Switch file, Build & Publish, Toggle dark mode) are wired to existing handlers.
- **Test-safe:** ⌘P/⌘O are new shortcuts (meta-gated, preventDefault) and the palette is a new default-closed overlay — no existing flow or `data-testid` is touched; the cli-studio acceptance suite does not use ⌘P. The 13.1 visual baseline is unaffected.
- **Dark mode:** the app uses Tailwind `dark:` variants (no theme provider / `next-themes`), so Toggle dark mode flips `.dark` on `<html>` — verified live to flip the class. (A persistent theme store is a future polish.)
- **Scope:** the palette UI + functional Switch-file/Build/Dark entries. NOT Agent invocation (Epic 11), NOT escalation modal/token (12.2/12.3), NOT the Audit-log route (13.10), NOT persisted theme.

## Review Follow-ups (AI)

- [ ] [Med] Wire ASK WRITER entries to `agent-service.invokeAgent()` once Epic 11 lands; the workspace entry must trigger the Story 12.3 Scope Escalation Modal → signed token (Story 12.2) before invocation (AC2).
- [ ] [Med] Wire "Audit log…" to route to the Audit Log Query view once Story 13.10 lands (AC3).
- [ ] [Low] Persist dark-mode choice (and reconcile with any reader/theme system) instead of a transient `.dark` toggle.
- [ ] [Verification] Owner: run `pnpm test:acceptance` (cli-studio) to confirm ⌘P doesn't disturb Phase 1 flows.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.8 (`claude-opus-4-8`)

### Completion Notes List

- `command-palette.tsx`: ds-palette overlay — search + ↑/↓/Enter/Esc nav + ASK WRITER/NAVIGATION/ACTIONS sections; disabled entries (Ask Writer ×3, Audit log) carry shortcuts + honest hints; functional entries (Switch file, Build & Publish, Toggle dark mode) wired. `data-testid`s for verification.
- `local-studio-app.tsx`: `paletteOpen` state + ⌘P/⌘O in the shared keyboard effect + overlay render fed `filteredPages` / `changeActivePage` / `runBuild`.
- **Live-verified** (cli-mode Studio, real browser): palette opens on ⌘P, renders 3 Ask-Writer scope entries with shortcuts + the nav/action entries, fuzzy filter narrows, Toggle dark mode flips `.dark`, palette closes after an action — **0 console errors** (screenshot `/tmp/anydocs-verify/06-palette.png`).
- Honest deferrals: Agent invocation (Epic 11), escalation modal/token (12.2/12.3), Audit-log route (13.10) — logged as follow-ups.

### Validation Evidence

- `pnpm --filter @anydocs/web typecheck` → exit 0
- `pnpm --filter @anydocs/web test` → **8 passed / 23 skipped** (unchanged baseline). Core/cli/mcp untouched.
- **Live**: Playwright against the running cli-mode Studio — `{ paletteOpens, hasInput, askWriterEntries:3, hasSwitchFile, hasBuild, hasAudit, hasDark, filteredToBuild:1, darkModeToggled, paletteClosedAfterAction }` all true; `consoleErrors: []`.

### File List

**New files**
- `packages/web/components/studio/command-palette.tsx`

**Modified files**
- `packages/web/components/studio/local-studio-app.tsx` — CommandPalette import + `paletteOpen` state + ⌘P/⌘O shortcut + overlay render
- `artifacts/bmad/implementation-artifacts/13-7-implement-command-palette-with-workspace-agent-entry.md` — status review; Dev Agent Record + Review Follow-ups
- `artifacts/bmad/implementation-artifacts/sprint-status.yaml` — `13-7-...` backlog → review

## References

- Epics: [Source: artifacts/bmad/planning-artifacts/epics.md#Epic 13 → Story 13.7]
- Dependencies: [Source: epics.md#Epic 11] (Agent), [Source: epics.md#Epic 12 → Stories 12.2/12.3] (escalation), [Source: epics.md#Epic 13 → Story 13.10] (audit view)
- Design source: `/Users/shawn/Downloads/anydocs-desktop-handoff/` (`ds-palette`) + UX spec §6.4
- Gate: [Source: CLAUDE.md#Pre-GitHub Submission Gate]
