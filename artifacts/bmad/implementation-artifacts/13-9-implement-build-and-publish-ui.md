# Story 13.9: Implement Build & Publish UI (Success + Failure)

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a documentation maintainer,
I want Build & Publish exposed as a full-window UI (success and failure states) instead of CLI-only,
so that the experience matches the Claude Design `ScreenLocalBuild` and `ScreenLocalBuildFailed`.

## Acceptance Criteria

1. A new `packages/web/components/studio/build-publish-view.tsx` is a full-window overlay over the **existing Phase 1 build service** (`runBuild` / `studioHost.runBuild`) — the underlying core build service is unchanged (same one the CLI uses). It renders idle / running / **success** / **failure** states matching the Claude Design build screens.
2. **Success** (`ScreenLocalBuild`): surfaces the summary, the output `artifactRoot` with a **copy-path** affordance, the resolved **reader theme id**, and the **publication-boundary** status ("published-only — draft / in_review excluded").
3. **Failure** (`ScreenLocalBuildFailed`): a red error log with the failing message + the workflow **remediation hint** (NFR9), a Retry, and a **"Resolve with Writer"** affordance (disabled — invokes the workspace Agent via the palette, Epic 11 / Story 13.7).
4. Reachable from the command palette's **"Build & Publish"** entry (Story 13.7), which now opens this view instead of running silently. The view's Run/Rebuild buttons call the same `runBuild`.
5. `pnpm --filter @anydocs/web typecheck` + `pnpm --filter @anydocs/web test` green; **live-verified** end-to-end (a real build ran against starter-docs) with zero console errors.

## Tasks / Subtasks

- [x] Build the view (AC: 1, 2, 3)
  - [x] `build-publish-view.tsx` (`'use client'`): idle (Run build) / running (spinner + busy + elapsed) / success (summary + copy-path + reader theme + publication boundary + Rebuild) / failure (red log + remediation + Retry + disabled Resolve-with-Writer). `data-testid` per state.
- [x] Wire (AC: 4)
  - [x] `buildViewOpen` state; command-palette `onBuild` now opens the view; the view is fed the existing `useWorkflowState` values (`workflowBusy === 'build'`, `workflowBusyLabel`, `workflowElapsedLabel`, `workflowSuccess`, `workflowError`, `workflowErrorDiagnostic`) + `projectState.themeId`; Run/Rebuild call `runBuild`.
- [x] Validate (AC: 5)
  - [x] `pnpm --filter @anydocs/web typecheck` exit 0; `pnpm --filter @anydocs/web test` → 8 passed / 23 skipped; live Playwright (palette → Build → Run): success state with `artifactRoot`, per-lang counts (zh:1, en:1), theme `classic-docs`, published-only boundary — **0 console errors** (cleaned the produced `dist/` after).
- [x] Update `sprint-status.yaml` `13-9-...` → `review`.

## Dev Notes

- **Service unchanged (AC1):** the view consumes the same `studioHost.runBuild` → core build service the CLI uses; no service change. `StudioBuildResponse` is `{ artifactRoot, languages[] }` — a **single final result, not a streaming log**, so the "log" is the final summary/status rather than a live stream (a real streaming surface would need a service change — noted).
- **Failure remediation** comes from the existing `workflowErrorDiagnostic` (title + remediation). **"Resolve with Writer"** needs the workspace Agent (Epic 11 / palette Story 13.7) → rendered disabled for now.
- **Reveal-in-Finder (desktop)** is not wired (no host reveal API surfaced here); a **copy-path** affordance works in both web + desktop. Desktop reveal is a follow-up.
- **Test-safe:** new overlay reached only via the palette (default closed); the existing inline footer build status + workflow success card are untouched.

## Review Follow-ups (AI)

- [ ] [Low] Streaming build log would need the build service to emit progress (currently a single final result).
- [ ] [Low] Desktop "Reveal in Finder" affordance (host reveal API) in addition to copy-path.
- [ ] [Med] Wire "Resolve with Writer" to the workspace Agent once Epic 11 + the palette Agent invocation land.
- [ ] [Verification] Owner: run `pnpm test:acceptance`; trigger a failing build (e.g. broken link) to see the failure state in situ.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.8 (`claude-opus-4-8`)

### Completion Notes List

- `build-publish-view.tsx`: full-window overlay; idle/running/success/failure states; success shows summary + copy-path + reader theme + publication boundary; failure shows red log + remediation + Retry + disabled Resolve-with-Writer.
- `local-studio-app.tsx`: `buildViewOpen` overlay; command-palette `onBuild` opens it; fed the existing workflow state + `projectState.themeId`; Run/Rebuild → `runBuild` (unchanged service).
- **Live-verified**: palette → Build & Publish → Run build → real build succeeded against starter-docs (artifactRoot `…/dist`, zh:1/en:1, theme classic-docs, published-only) — 0 console errors (screenshots 11/12). Produced `dist/` cleaned afterward.

### Validation Evidence

- `pnpm --filter @anydocs/web typecheck` → exit 0; `pnpm --filter @anydocs/web test` → **8 passed / 23 skipped** (unchanged baseline). Core/cli/mcp untouched.
- Live: `{ buildViewOpen:true, idleState:true, success:true, failed:false }`, outputText shows summary/output/theme/boundary; `errs:[]`.

### File List

**New files**
- `packages/web/components/studio/build-publish-view.tsx`

**Modified files**
- `packages/web/components/studio/local-studio-app.tsx` — BuildPublishView import + `buildViewOpen` state + palette `onBuild` opens it + overlay fed workflow state
- `artifacts/bmad/implementation-artifacts/13-9-implement-build-and-publish-ui.md` — status review; Dev Agent Record + Review Follow-ups
- `artifacts/bmad/implementation-artifacts/sprint-status.yaml` — `13-9-...` backlog → review

## References

- Epics: [Source: artifacts/bmad/planning-artifacts/epics.md#Epic 13 → Story 13.9]
- Service: existing Phase 1 build (`studioHost.runBuild` → core build service)
- Palette: [Source: artifacts/bmad/implementation-artifacts/13-7-implement-command-palette-with-workspace-agent-entry.md]
- Design source: `ScreenLocalBuild` / `ScreenLocalBuildFailed`
- Gate: [Source: CLAUDE.md#Pre-GitHub Submission Gate]
