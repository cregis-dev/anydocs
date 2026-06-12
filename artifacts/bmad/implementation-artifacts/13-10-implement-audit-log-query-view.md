# Story 13.10: Implement Audit Log Query View

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a documentation maintainer,
I want a dedicated Audit Log Query view with filter bar, list, detail panel, and per-entry rollback,
so that I can inspect Writer history and recover from unwanted edits matching UX Specification §6.2.

## Acceptance Criteria

1. A dev-only `/api/local/audit` route bridges the browser view to the core services: **GET** maps query params to the `audit-log-service.query()` filter axes (Story 10.4) and returns the filtered/paginated reverse-chronological result; **POST** `{ entryId }` invokes `rollback()` (Story 10.5). Both resolve the active project's `auditRoot` via the existing project policy.
2. A new `packages/web/components/studio/audit-log-view.tsx` renders a filter bar with **Scope / Resource / When / Status / Search** axes mapping to the query filters, a reverse-chronological **list** (timestamp, scope badge, summary, status icon), and a **detail panel** for the selected entry. A **"Retention: 30 days"** hint sits on the right of the filter bar (UX spec §6.2.7).
3. Committed entries show a **"Roll back this change"** destructive affordance (`--bad-500` styling, UX spec §6.2.5); rejected/pending entries do not. Confirming calls the rollback endpoint (Story 10.5) and re-loads the list (a new `operation: 'rollback'` entry then appears at the top).
4. The view is reachable from the command palette's **"Audit log…"** entry (Story 13.7), which is now enabled. Empty state is shown when no entries exist (the log is populated by Agent ops + audited writes — Epic 11).
5. `pnpm --filter @anydocs/web typecheck` + `pnpm --filter @anydocs/web test` green; **live-verified** end-to-end against a running cli-mode Studio (seeded entries) with zero console errors.

## Tasks / Subtasks

- [x] Server bridge (AC: 1)
  - [x] `packages/web/lib/docs/fs.ts`: `queryAuditLog(filter, projectId, customPath)` (→ core `query` on `contract.paths.auditRoot`) + `rollbackAuditEntry(entryId, …)` (→ core `rollback` with a producer id + a best-effort page-snapshot `applyRollback`).
  - [x] `packages/web/app/api/local/audit/route.ts`: GET (parse filter axes from query params) + POST (`{ entryId }` → rollback). Reuses `_shared` (`readProjectQuery`/`json`/`jsonError`/`handleRouteError`).
- [x] View (AC: 2, 3, 4)
  - [x] `audit-log-view.tsx`: filter bar (scope/resource/when/status/search) + retention hint + list (reverse-chron, scope badge, status icon) + detail panel + committed-only `--bad-500` rollback button; empty state. Fetches GET on filter change; POST on rollback.
  - [x] Wired into `local-studio-app.tsx`: `auditViewOpen` state + overlay; command palette `onAuditLog` enables the "Audit log…" entry to open it.
- [x] Validate (AC: 5)
  - [x] core rebuilt (web dist needs `query`/`rollback`); `pnpm --filter @anydocs/web typecheck` exit 0; `pnpm --filter @anydocs/web test` → 8 passed / 23 skipped; live Playwright (seeded 2 entries) — API 200/total 2 reverse-chron, filter bar 5 axes + retention hint, list rows + badges, rollback only on committed, status filter re-queries — **0 console errors**.
- [x] Update `sprint-status.yaml` `13-10-...` → `review`.

## Dev Notes

- **Built on Stories 10.4 (query) + 10.5 (rollback)** — the core services already exist; 13.10 adds the dev-only HTTP bridge + the UI. No Epic 11 dependency for query/inspect; the log itself is filled by Agent ops + audited human writes (Epic 11), so in a fresh project the view shows its empty state.
- **Rollback content re-apply** is delegated through core `rollback`'s `applyRollback` seam: the fs wrapper writes a **page-doc snapshot** back via `savePage` for `resourceKind: 'page'`; other target snapshots are refused with a typed error until their shape is finalized by the Epic 11 agent-service (the audit lifecycle still records the rejection). Live verification seeded summary-only entries (no page-doc snapshot), so the rollback content-write path itself is exercised once Epic 11 produces real snapshots (Review Follow-up).
- **Run Inspector reuse (AC2 in epic):** Story 13.8 (Run Inspector) is not built; the detail panel is a self-contained layout. Aligning it with the Run Inspector is a follow-up when 13.8 lands.
- **Dev-only:** the route lives under `/api/local/*` (disabled in production per CLAUDE.md) and resolves the locked/active project via the existing studio project policy.
- **Test-safe:** new route + new overlay reached only via the palette; no existing flow/`data-testid` touched.

## Review Follow-ups (AI)

- [ ] [Med] Exercise + finalize the rollback content re-apply once Epic 11 defines the `diff.before` snapshot shape (page-doc path is wired; other targets refused for now).
- [ ] [Low] Align the detail panel with the Run Inspector layout when Story 13.8 lands (epic AC2 visual-consistency).
- [ ] [Low] List meta currently shows summary/scope/status/timestamp; model/token/duration meta (epic AC) require those fields on the audit entry (Epic 11 enrichment).
- [ ] [Verification] Owner: run `pnpm test:acceptance`; exercise a real rollback once Epic 11 writes auditable page edits.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.8 (`claude-opus-4-8`)

### Completion Notes List

- `fs.ts`: `queryAuditLog` + `rollbackAuditEntry` wrappers over core `query`/`rollback` against `contract.paths.auditRoot`; rollback uses `crypto.randomUUID()` for the producer id, `actor:{kind:'human'}`, and a page-snapshot `applyRollback` (other targets refused with `ValidationError` pending Epic 11).
- `app/api/local/audit/route.ts`: GET (filter-axis parse → `queryAuditLog`) + POST (`{entryId}` → `rollbackAuditEntry`), dev-only, `_shared` helpers.
- `audit-log-view.tsx`: full §6.2 surface (filter bar + retention hint + reverse-chron list + detail + committed-only `--bad-500` rollback + empty state); fetches the route.
- `local-studio-app.tsx`: `auditViewOpen` overlay + command-palette `onAuditLog` (enables the previously-disabled "Audit log…" entry — closes a Story 13.7 follow-up).
- **Live-verified** (cli-mode Studio, seeded 2 entries): API 200 / 2 entries reverse-chron; palette Audit entry enabled → view opens; 5 filter axes + retention hint present; list reverse-chron with badges/status; rollback affordance only on the committed entry; status filter re-queries to 1 row — **0 console errors** (screenshots 07/08). Seeded data removed afterward (examples/ left clean).

### Validation Evidence

- core rebuilt; `pnpm --filter @anydocs/web typecheck` → exit 0; `pnpm --filter @anydocs/web test` → **8 passed / 23 skipped** (unchanged baseline). Core/cli/mcp untouched.
- Live Playwright result: `{ apiStatus:200, apiTotal:2, apiEntryIds:[seed-b,seed-a], auditEntryEnabled:true, auditViewOpen:true, filterBar:true, retentionHint:true, filterAxes:{all true}, rowCount:2, rollbackOnRejected:false, rollbackOnCommitted:true, rowsAfterRejectedFilter:1 }`, `consoleErrors:[]`.

### File List

**New files**
- `packages/web/app/api/local/audit/route.ts`
- `packages/web/components/studio/audit-log-view.tsx`

**Modified files**
- `packages/web/lib/docs/fs.ts` — `queryAuditLog` + `rollbackAuditEntry` wrappers + core `query`/`rollback` imports
- `packages/web/components/studio/command-palette.tsx` — `onAuditLog` prop enables the "Audit log…" entry
- `packages/web/components/studio/local-studio-app.tsx` — AuditLogView import + `auditViewOpen` state + overlay + palette wiring
- `artifacts/bmad/implementation-artifacts/13-10-implement-audit-log-query-view.md` — status review; Dev Agent Record + Review Follow-ups
- `artifacts/bmad/implementation-artifacts/sprint-status.yaml` — `13-10-...` backlog → review

## References

- Epics: [Source: artifacts/bmad/planning-artifacts/epics.md#Epic 13 → Story 13.10]
- Services: [Source: artifacts/bmad/implementation-artifacts/10-4-implement-audit-query-api.md] (query), [Source: artifacts/bmad/implementation-artifacts/10-5-implement-rollback-service.md] (rollback)
- UX spec: §6.2 (filter bar, list, detail, rollback, retention hint)
- Local API pattern: [Source: packages/web/app/api/local/pages/route.ts]
- Gate: [Source: CLAUDE.md#Pre-GitHub Submission Gate] (touches Studio + local API → `pnpm test:acceptance` recommended)
