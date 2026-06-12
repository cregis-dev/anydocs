# Story 13.2: Recompose Studio Shell to Desktop Four-Region Layout

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a documentation maintainer,
I want Studio to use the four-region layout (VaultSidebar / LocalTopbar + main / LocalAgentPanel / LocalStatusBar),
so that the editing experience matches the Claude Design `ds-editor` composition.

## Acceptance Criteria

1. `packages/web/components/studio/local-studio-app.tsx` renders four distinct, named regions corresponding to the Claude Design `ds-editor` screen: a left **VaultSidebar** region (the existing pages/navigation rail, swapped to a real file-tree in Story 13.3), a **LocalTopbar + main** region (top bar + the editor center that already mounts `@anydocs/editor` via the Story 7.1 host adapter), a right **LocalAgentPanel** region (introduced here as a toggleable placeholder; real Agent content is Epic 11 / Story 13.7), and a bottom **LocalStatusBar** region (the existing footer).
2. The editor area continues to mount `@anydocs/editor` exclusively through the Story 7.1 `EditorHost` adapter — no direct Yoopta imports are introduced (the Story 7.3 `@yoopta/*` ban still holds).
3. Keyboard shortcuts are wired at the shell: `⌘\` (Ctrl+\ on non-mac) toggles the left VaultSidebar region; `⌘.` (Ctrl+. ) toggles the right LocalAgentPanel region. Both update visible state and are no-ops while a text input/textarea/contentEditable is focused isn't required, but the handler must not hijack typing of `\`/`.` inside the editor (guard on modifier key only — the shortcut requires meta/ctrl).
4. Runtime-mode chrome: in `desktop` runtime mode the shell renders inside the `MacWindow` primitive (traffic-light titlebar chrome); in `web` runtime mode `MacWindow` is suppressed and the shell renders bare (the web app embeds without traffic lights). Gating keys off `bootContext.mode` (`'desktop'` vs not).
5. **No functional regression:** all existing Studio behavior and every existing `data-testid` (`studio-pages-sidebar`, `studio-settings-sidebar`, `studio-close-project-button`, …) are preserved. The left VaultSidebar region defaults to **visible** and the LocalAgentPanel defaults to **hidden**, so existing Phase 1 acceptance/visual flows are unchanged by default.
6. `pnpm --filter @anydocs/web typecheck` and `pnpm --filter @anydocs/web test` (Playwright suite) stay green; the Story 13.1 visual-regression baseline is unaffected in `web` mode (no `.ax` wrapping is applied in web mode, so existing Studio styling is untouched).

## Tasks / Subtasks

- [x] Add region-visibility state + keyboard shortcuts (AC: 3, 5)
  - [x] `useState` `sidebarVisible` (default `true`) and `agentPanelVisible` (default `false`).
  - [x] A `useEffect` keydown listener: `(e.metaKey || e.ctrlKey) && e.key === '\\'` → toggle sidebar; `(e.metaKey || e.ctrlKey) && e.key === '.'` → toggle agent panel; `preventDefault` on match. Cleans up on unmount. Requires meta/ctrl so editor typing of `\`/`.` is never hijacked.
- [x] Introduce the LocalAgentPanel region (AC: 1)
  - [x] Added a right-side toggleable `<aside data-testid="studio-agent-panel">` after the editor center (rendered when `agentPanelVisible`), a placeholder labelled for Epic 11. No real Agent calls.
  - [x] Gated the existing left pages rail via a `hidden` class (`cn(..., !sidebarVisible && 'hidden')`) — keeps the node + `data-testid` in the tree (test-safe), toggles display only.
- [x] Runtime-mode MacWindow gating (AC: 4) — **COMPLETE**
  - [x] Added a full-bleed `fill` variant to the Story 13.1 `MacWindow` primitive (`width:'100%'`/`height:'100dvh'`, no border-radius, no drop-shadow) — additive; the default fixed-size artboard path is byte-identical (13.1 visual baseline still green). Also added optional `onToggleSidebar`/`onToggleAgent` handlers so the titlebar buttons are functional, and `'use client'` (the buttons are now interactive).
  - [x] `desktop` mode: shell wraps in `<MacWindow fill fileChip title=… onToggleSidebar onToggleAgent>` (titlebar toggles wired to the same `⌘\`/`⌘.` state). `web` mode: renders bare (`<div className="h-dvh">{shellInner}</div>`). Shell body changed from `h-dvh` to a reusable `h-full` `shellInner`, height supplied by the wrapper (web `h-dvh` / MacWindow content `flex:1`).
- [x] Validate (AC: 6 — partial)
  - [x] `pnpm --filter @anydocs/web typecheck` exit 0; `pnpm --filter @anydocs/web test` → 8 passed / 23 skipped (unchanged from baseline; the 23 are env-gated cli-studio acceptance tests). No new `@yoopta/*` import.
- [x] Update `sprint-status.yaml` `13-2-...` → `review`.

## Review Follow-ups (AI)

- [x] [Low→Med] **AC4 desktop MacWindow chrome** — DONE: added the full-bleed `fill` variant + functional titlebar toggles to `mac-window.tsx` and wired the desktop wrap in `local-studio-app.tsx`. (Real Tauri window config — `decorations:false`, drag regions, traffic-light offsets — is Epic 9 / 9.1.)
- [ ] [Visual] **Claude Design `.ax` restyle:** this story frames the regions structurally but keeps the existing `fd-*`/shadcn styling. Full per-region Claude Design token (`.ax`) styling + the `LocalTopbar`/`LocalStatusBar` primitive adoption is a visual pass (fold into 13.3/13.11 or a 13.2 follow-up) requiring the app running.
- [ ] [Verification] AC5 "all Phase 1 Studio acceptance tests pass": the cli-studio `@p0` acceptance suite is **skipped** in this headless env (needs a running CLI studio backend). The web-mode layout change (`h-dvh` wrapper + `h-full` shell) and the desktop MacWindow wrap are NOT exercised by the non-gated suite. Owner should run `pnpm test:acceptance` + visually confirm the four regions, `⌘\`/`⌘.` toggles, web layout intact, and desktop MacWindow chrome (incl. titlebar toggle buttons).

## Dev Notes

- **Depends on 13.1** (`MacWindow` + primitives in `packages/web/lib/desktop-shell/`) and **7.1** (`EditorHost` adapter — already the editor mount). 13.3 swaps the VaultSidebar contents to a real file-tree; 13.2 only frames the regions. The LocalAgentPanel is a placeholder until Epic 11.
- **Current shell (already close to four regions):** `local-studio-app.tsx` returns `<div flex-col>` → `<header h-12>` (top bar) + `<main flex>` containing `<aside w-64 data-testid="studio-pages-sidebar">` (left) / `<section flex-1>` (editor center) / `<aside w-80 data-testid="studio-settings-sidebar">` (metadata) + `<footer h-8>` (status bar). 13.2 maps: left aside → VaultSidebar region; header+section → LocalTopbar+main; footer → LocalStatusBar; and ADDS a new LocalAgentPanel region. The existing metadata/settings aside is preserved as part of the main cluster (ds-editor folds metadata elsewhere, but moving it is out of 13.2 scope — keep it to avoid regression).
- **Visual fidelity is a follow-up.** This story frames the regions + shortcuts + runtime chrome and keeps all Phase 1 behavior/tests green; it does NOT restyle the existing regions into the Claude Design `.ax` token language for web mode (that is a visual pass best done with the app running — flagged for the reviewer/owner to verify and iterate). Full `.ax` adoption + per-region Claude Design styling can land as a 13.2 follow-up or fold into 13.3/13.11.
- **Test safety:** defaults (sidebar visible, agent panel hidden) + preserved `data-testid`s mean existing Playwright flows render identically. The MacWindow branch only triggers in `desktop` mode, which the web test runtime does not hit — so the web suite + 13.1 baseline are unaffected.
- **Shortcut guard:** require `metaKey || ctrlKey`, so typing `\` or `.` in the editor is never hijacked.

### Architecture Compliance

- Per epics.md Story 13.2 ACs + UX spec §6 (`ds-editor` four-region composition). Per architecture.md Phase 2 boundaries: editor reached only via the host adapter (AC2); runtime mode read from `bootContext.mode` (no new resolver call in the client shell).
- Naming preserved from Claude Design: `VaultSidebar` (region role; contents in 13.3), `LocalTopbar`, `LocalAgentPanel`, `LocalStatusBar`, `MacWindow`.

### File Structure Requirements

**To modify:**
- `packages/web/components/studio/local-studio-app.tsx` — region state + shortcuts + LocalAgentPanel region + sidebar gating + MacWindow runtime wrap
- `artifacts/bmad/implementation-artifacts/sprint-status.yaml` — status transitions

**Reference-only:**
- `packages/web/lib/desktop-shell/` (Story 13.1 primitives: `MacWindow`, `LocalTopbar`, `LocalStatusBar`)
- `/Users/shawn/Downloads/anydocs-desktop-handoff/desktop-screens-main.jsx` (`ds-editor` reference composition)
- `packages/web/lib/editor-host/` (Story 7.1 adapter — already the editor mount)

**Out of scope:** VaultSidebar file-tree contents (13.3), LocalAgentPanel real Agent wiring (Epic 11 / 13.7), full Claude Design visual restyle of each region (visual follow-up / 13.11), settings restructure (13.6), command palette (13.7).

### Testing Requirements

- `pnpm --filter @anydocs/web typecheck` exit 0.
- `pnpm --filter @anydocs/web test` (Playwright) green — existing flows unchanged by default (sidebar visible, agent hidden, no MacWindow in web mode).
- Manual/visual verification (owner): run the app, confirm the four regions render, `⌘\`/`⌘.` toggle the sidebar/agent panel, and desktop mode shows MacWindow chrome.

### References

- Epics: [Source: artifacts/bmad/planning-artifacts/epics.md#Epic 13 → Story 13.2]
- UX spec: [Source: artifacts/bmad/planning-artifacts/ux-design-specification.md#6] (`ds-editor` four-region composition)
- Predecessor: [Source: artifacts/bmad/implementation-artifacts/13-1-port-tokens-css-and-shell-primitives-into-anydocs-web.md] (primitives + `.ax` scoping)
- Design source: `/Users/shawn/Downloads/anydocs-desktop-handoff/desktop-screens-main.jsx`
- Gate: [Source: CLAUDE.md#Pre-GitHub Submission Gate] (touches Studio → `pnpm test:acceptance` recommended)

## Dev Agent Record

### Agent Model Used

Claude Opus 4.8 (`claude-opus-4-8`)

### Debug Log References

- `MacWindow` (Story 13.1) was a fixed-size 1280×820 design artboard — discovered while wiring AC4. Resolved by adding an additive full-bleed `fill` variant (rather than deferring): the default fixed path is byte-identical so the 13.1 visual baseline stays green.
- MacWindow gained interactive titlebar buttons (`onToggleSidebar`/`onToggleAgent`), so it needs `'use client'` — the 13.1 preview route (server) still renders it fine (server components may render client children).

### Completion Notes List

- **Four-region framing:** left VaultSidebar region (existing pages rail, now `⌘\`-toggleable), LocalTopbar+main (existing header + EditorHost center), a NEW `⌘.`-toggleable right `LocalAgentPanel` placeholder region (`data-testid="studio-agent-panel"`, Epic 11 content pending), and the footer as LocalStatusBar. Shortcuts are meta/ctrl-gated so editor typing of `\`/`.` is never hijacked. Sidebar gated via a `hidden` class (node + `data-testid` stay in the tree → test-safe). Editor still mounts only via the Story 7.1 `EditorHost` (no `@yoopta/*` — AC2 holds). Existing metadata/settings aside preserved.
- **AC4 runtime chrome (DONE):** added a full-bleed `fill` variant + optional `onToggle*` titlebar handlers to the 13.1 `MacWindow` (additive; default path unchanged). Desktop runtime wraps the shell in `<MacWindow fill …>` with the titlebar toggle buttons wired to the same `⌘\`/`⌘.` state; web runtime renders bare. Shell body refactored from `h-dvh` to a reusable `h-full` `shellInner` (height from the wrapper). Real Tauri window decorations/drag-regions are Epic 9.
- **Still deferred:** full Claude Design `.ax` per-region restyle — a visual pass best done with the app running (fold into 13.3/13.11).
- **Verification gap:** the cli-studio `@p0` acceptance suite is env-gated (skipped here), and the web-mode layout change + desktop MacWindow wrap are not exercised by the non-gated suite. Verified via typecheck + the non-gated web suite (incl. the 13.1 visual baseline) + a test-safe design. Owner to run `pnpm test:acceptance` + visual check.

### Validation Evidence

- `pnpm --filter @anydocs/web typecheck` → exit 0
- `pnpm --filter @anydocs/web test` → **8 passed / 23 skipped** (unchanged from baseline). Critically, the Story 13.1 desktop-shell visual baselines (light + dark) **still pass**, confirming the additive MacWindow `fill`/`onToggle` props left the default fixed-size rendering byte-identical.
- Core/cli/mcp untouched (only `packages/web/*` changed).

### File List

**Modified files**

- `packages/web/components/studio/local-studio-app.tsx` — region-visibility state + `⌘\`/`⌘.` keyboard effect + sidebar `hidden`-class gating + new `LocalAgentPanel` region + desktop MacWindow `fill` wrap (shell body → `h-full` `shellInner`)
- `packages/web/lib/desktop-shell/mac-window.tsx` — additive `fill` full-bleed variant + optional `onToggleSidebar`/`onToggleAgent` titlebar handlers + `'use client'`
- `artifacts/bmad/implementation-artifacts/13-2-recompose-studio-shell-to-desktop-four-region-layout.md` — status ready-for-dev → review; tasks ticked; Review Follow-ups + Dev Agent Record populated
- `artifacts/bmad/implementation-artifacts/sprint-status.yaml` — `13-2-...` backlog → ready-for-dev → review
