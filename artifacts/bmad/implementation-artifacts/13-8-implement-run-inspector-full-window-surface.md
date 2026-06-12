# Story 13.8: Implement Run Inspector Full-Window Surface

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a documentation maintainer,
I want a Run Inspector that shows the timeline, diff/preview/raw views, model badge, and token rate for any Agent run,
so that I can observe in-progress and recently completed runs matching the Claude Design `ds-inspector` screens.

## Acceptance Criteria (as implemented — dependency-honest slice)

1. A new `packages/web/components/studio/run-inspector.tsx` renders the `ds-inspector` composition: a **left-side step timeline** (steps with done / running / queued / failed indicators), a **right-side Diff / Preview / Raw tab set**, a **model badge** + optional **token rate**, and a committed-run **"Roll back this run"** affordance (`--bad-500`) wired to rollback (Story 10.5).
2. It is driven by a presentational `RunView` (title, model, status, steps, diff, raw). **Story 13.10's audit detail panel now reuses `RunInspector`** (epic 13.10 AC2 "reuses the Run Inspector layout for visual consistency") — each audit entry maps to a single-step run via `auditEntryToRun`. This gives the inspector a real, live consumer.
3. **LIVE multi-step Agent runs** (streaming step events as `agent-service.ts` emits them, per-file diffs, `⌘[`/`⌘]` file navigation, and the standalone full-window surface) are **deferred to Epic 11 / Story 11.6** — those runs + their data shape are produced by the agent-service which does not exist yet. The component's `RunView`/step model is the ready seam.
4. `pnpm --filter @anydocs/web typecheck` + `pnpm --filter @anydocs/web test` green; **live-verified** (a seeded audit entry rendered through the inspector) with zero console errors.

## Tasks / Subtasks

- [x] Build the RunInspector component (AC: 1, 2)
  - [x] `run-inspector.tsx` (`'use client'`): `RunView`/`RunStep` model; left timeline w/ state icons; right Diff (before/after blocks) / Preview / Raw (JSON) tabs; header title + model badge + token rate; committed-only `--bad-500` "Roll back this run". `auditEntryToRun(entry)` maps a Story 13.10 audit entry → a single-step run. `data-testid`: run-inspector / run-timeline / run-tab-* / run-pane / run-rollback.
- [x] Reuse it in the audit detail (AC: 2)
  - [x] `audit-log-view.tsx` detail panel now renders `<RunInspector run={auditEntryToRun(selected)} onRollback rollingBack />` instead of the bespoke field list (removed the old `Detail` helper + `RotateCcw`).
- [x] Validate (AC: 4)
  - [x] `pnpm --filter @anydocs/web typecheck` exit 0; `pnpm --filter @anydocs/web test` → 8 passed / 23 skipped; live Playwright (seeded committed page entry → audit detail): run-inspector + timeline + diff/preview/raw tabs + before/after diff + "Roll back this run" render; Raw tab shows entry JSON — **0 console errors** (screenshot 13).
- [x] Update `sprint-status.yaml` `13-8-...` → `review`.

## Dev Notes

- **Epic-11 blocked for live runs (the reason for the slice):** the inspector's purpose is observing Agent runs as `agent-service.ts` (Story 11.6) emits step events; that service + its run-data shape don't exist yet. Building a standalone always-empty full-window inspector would be speculative, so 13.8 ships the **reusable `RunInspector` layout** with a real consumer (the audit detail), and the live/streaming/full-window surface is deferred to Epic 11.
- **Closes a 13.10 follow-up:** the audit detail now uses the shared inspector layout (epic 13.10 AC2), replacing its bespoke field list — one source of truth for entry/run inspection.
- **Deferred (Epic 11):** streaming step timeline updates, per-file diffs for workspace runs, `⌘[`/`⌘]` cross-file navigation, real model/token-rate telemetry, the standalone full-window live-run surface + its palette/entry point.
- **Test-safe:** new presentational component + a refactor of the audit detail (already overlay-only, palette-reached). No Phase 1 flow/`data-testid` touched. (The audit rollback testid moved `audit-rollback` → `run-rollback` inside the inspector — internal to the audit overlay.)

## Review Follow-ups (AI)

- [ ] [Med] Feed live multi-step runs from `agent-service.ts` (Epic 11 / Story 11.6): streaming step events, per-file diffs, `⌘[`/`⌘]` navigation, model/token-rate telemetry; add the standalone full-window live-run surface + entry point.
- [ ] [Verification] Owner: run `pnpm test:acceptance`; exercise a real Agent run through the inspector once Epic 11 lands.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.8 (`claude-opus-4-8`)

### Completion Notes List

- `run-inspector.tsx`: `ds-inspector` layout (timeline + Diff/Preview/Raw + model badge + token rate + committed-only rollback), driven by a `RunView`; `auditEntryToRun` adapter.
- `audit-log-view.tsx`: detail panel reuses `<RunInspector>` (closes 13.10 AC2 reuse follow-up); removed the bespoke `Detail` field list + `RotateCcw` import.
- **Live-verified**: seeded committed page entry → audit detail renders the inspector (timeline `update (committed)`, Diff before/after, Raw JSON, "Roll back this run", `ref` model badge) — 0 console errors (screenshot 13). Seeded data cleaned.
- Honest deferral: live multi-step Agent runs + streaming + full-window standalone surface = Epic 11 (no agent-service yet).

### Validation Evidence

- `pnpm --filter @anydocs/web typecheck` → exit 0; `pnpm --filter @anydocs/web test` → **8 passed / 23 skipped** (unchanged baseline). Core/cli/mcp untouched.
- Live: `{ runInspector:true, timeline:true, tabs:{diff,preview,raw all true}, rollback:true, rawPaneText: entry JSON }`, `errs:[]`.

### File List

**New files**
- `packages/web/components/studio/run-inspector.tsx`

**Modified files**
- `packages/web/components/studio/audit-log-view.tsx` — detail panel reuses `RunInspector` (`auditEntryToRun`); removed `Detail`/`RotateCcw`
- `artifacts/bmad/implementation-artifacts/13-8-implement-run-inspector-full-window-surface.md` — status review; Dev Agent Record + Review Follow-ups
- `artifacts/bmad/implementation-artifacts/sprint-status.yaml` — `13-8-...` backlog → review

## References

- Epics: [Source: artifacts/bmad/planning-artifacts/epics.md#Epic 13 → Story 13.8]
- Consumer: [Source: artifacts/bmad/implementation-artifacts/13-10-implement-audit-log-query-view.md] (audit detail reuse)
- Rollback: [Source: artifacts/bmad/implementation-artifacts/10-5-implement-rollback-service.md]
- Dependency: [Source: epics.md#Epic 11 → Story 11.6] (agent-service step events — live runs)
- Design source: `ds-inspector` / `ds-inspector-done`
- Gate: [Source: CLAUDE.md#Pre-GitHub Submission Gate]
