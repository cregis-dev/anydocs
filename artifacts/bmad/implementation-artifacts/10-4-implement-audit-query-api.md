# Story 10.4: Implement Audit Query API

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a documentation maintainer,
I want to query the audit log by scope, target resource, and time range,
so that I can inspect Agent activity in support of FR57.

## Acceptance Criteria

1. `audit-log-service.ts` exposes `query(auditRoot, filter): Promise<AuditQueryResult>` where `filter: AuditQuery` supports ALL of these optional filter axes (per architecture.md §Query API): `scope`, `status`, `operation`, `actor.kind` (as `actorKind`), `target.resourceKind` (as `resourceKind`), `target.pageId` (as `pageId`), `projectId`, and a timestamp range `from` / `to` (ISO 8601 strings). An absent axis does not filter on that axis.
2. The result contains ONLY entries matching **all** provided filters (AND semantics). Timestamp range is inclusive on both ends (`from <= entry.timestamp <= to`); either bound may be omitted (open-ended on that side).
3. Entries are returned in **reverse chronological order**: primary sort `timestamp` descending, tie-broken by `id` descending (ULIDs sort lexicographically by creation time, so this is a stable total order even for same-millisecond entries).
4. The result is **paginated**: `AuditQuery` accepts optional `limit` (default `50`, must be a positive integer) and `offset` (default `0`, must be `>= 0`). `query` returns `AuditQueryResult { entries: AuditEntry[]; total: number; hasMore: boolean }`, where `total` is the count of ALL entries matching the filters (pre-pagination) and `hasMore = offset + entries.length < total`.
5. **Shard pruning (bounded reads):** when `from` and/or `to` are provided, the implementation reads ONLY the daily shards whose UTC date intersects the requested range — shards strictly before `from`'s UTC date or strictly after `to`'s UTC date are never read. With no range, all shards are read. Within an intersecting boundary shard, entries are still filtered in memory by exact `timestamp` (a shard's date is derived from the entry timestamp, so a boundary shard can contain entries on both sides of the time-of-day cutoff).
6. Memory usage stays bounded for typical Phase 2 project sizes: only the matching range's shards are loaded, and the query never reads shards outside the range. (No streaming/cursor machinery required at Phase 2 scale — in-memory filter + sort + slice is sufficient per architecture.md §Query API.)
7. Invalid pagination inputs throw a typed `ValidationError` (e.g. `limit <= 0`, non-integer `limit`/`offset`, negative `offset`, or `from`/`to` not parseable as a date). An out-of-range `offset` (beyond `total`) is NOT an error — it returns `{ entries: [], total, hasMore: false }`.
8. `AuditQuery` and `AuditQueryResult` types are added to `packages/core/src/types/audit.ts` (re-exported via the existing `types/index.ts` → `src/index.ts` barrel). `query` is exported from `audit-log-service.ts` (already re-exported via `services/index.ts`). **No new dependencies.**
9. Unit tests (FLAT under `packages/core/tests/`) cover: single-axis filters (scope, status, pageId, resourceKind, actorKind, operation, projectId); combined AND filters; inclusive timestamp-range filtering across multiple days; reverse-chronological ordering incl. same-timestamp id tiebreak; pagination (`limit`/`offset`, `total`, `hasMore`); default limit/offset; empty result on out-of-range offset; shard-pruning assertion (a shard outside the range is not read — e.g. spy/instrument or assert via a poisoned/unreadable out-of-range shard that would throw if read); invalid-pagination `ValidationError` cases; empty audit dir → `{ entries: [], total: 0, hasMore: false }`. `pnpm typecheck` + `pnpm test` (core + root) pass.

## Tasks / Subtasks

- [x] Add query types to `types/audit.ts` (AC: 1, 8)
  - [x] Add `AuditQuery` type: all axes optional — `scope?: AuditScope`, `status?: AuditStatus`, `operation?: AuditOperation`, `actorKind?: AuditActorKind`, `resourceKind?: AuditResourceKind`, `pageId?: string`, `projectId?: string`, `from?: string`, `to?: string`, `limit?: number`, `offset?: number`.
  - [x] Add `AuditQueryResult` type: `{ entries: AuditEntry[]; total: number; hasMore: boolean }`.
  - [x] Confirm both are reachable via `@anydocs/core` barrel (types/index.ts already does `export * from './audit.ts'`).
- [x] Implement `query(auditRoot, filter)` in `audit-log-service.ts` (AC: 1–7)
  - [x] Validate pagination/date inputs first; throw `ValidationError` on `limit <= 0` / non-integer / negative `offset` / unparseable `from`/`to`. Apply defaults `limit = 50`, `offset = 0`.
  - [x] Compute the shard-date window: derive `fromKey` / `toKey` UTC `YYYY-MM-DD` strings via `auditShardFileName`. Filter `listAuditShardDates` to `[fromKey, toKey]` (string compare valid for `YYYY-MM-DD`). Omitted bound → open on that side.
  - [x] Read each in-window shard via `readAuditShard(auditRoot, shardDate(date))` (reused the existing private `shardDate` helper) and concatenate.
  - [x] Apply in-memory predicate matching all provided axes (AND). Timestamp range compared NUMERICALLY (`Date.parse`) — robust to ISO format/precision differences between caller bounds and stored timestamps.
  - [x] Sort reverse chronological: `timestamp` desc (numeric), then `id` desc.
  - [x] `total = matched.length`; `entries = matched.slice(offset, offset + limit)`; `hasMore = offset + entries.length < total`.
- [x] Add unit tests (AC: 9) — FLAT `packages/core/tests/audit-query.test.ts`, `mkdtemp` isolation; seed entries across 2 UTC days with varied scope/status/operation/actor/target/projectId; covers every AC9 bullet incl. the shard-pruning "out-of-range shard is never read" assertion.
- [x] Validate (AC: 9): `pnpm --filter @anydocs/core typecheck` + `pnpm --filter @anydocs/core test`, then root `pnpm typecheck` + `pnpm test` green.
- [x] Update `sprint-status.yaml` `10-4-implement-audit-query-api` → `review`.

## Dev Notes

- **Depends on Story 10.2** (`listAuditShardDates`, `readAuditShard`, `auditShardFileName`, `auditShardPath`) and **10.1** (`AuditEntry` shape + enums). Read-only over the repository — `query` performs NO writes, so no `appendAuditEntry` / `overwriteAuditShard` here.
- **Same file, additive.** `query` lives in the existing `packages/core/src/services/audit-log-service.ts` alongside `persistPending` / `markCommitted` / `markRejected` / `runWriteAhead` (Story 10.3). Reuse that file's existing `ValidationError` import and private `shardDate(date: string): Date` helper. Do NOT duplicate them.
- **One line per logical entry.** Story 10.3 deliberately keeps status transitions as an atomic read-modify-rewrite (one NDJSON line per entry, mutated in place) rather than appending transition records. So `query` sees exactly one row per logical entry with its current `status` — no transition-record de-duplication needed. (Recorded in 10.3 Dev Notes precisely so 10.4 can rely on it.)
- **Reverse-chronological + ULID.** `id` is a ULID (10.2), lexicographically sortable by creation time. Using `id` desc as the timestamp tiebreaker gives a stable total order even when two entries share an ISO timestamp at millisecond resolution. Sort on the string `timestamp` is ISO-8601 lexicographic = chronological; comparing as `Date` is equivalent but string compare avoids re-parsing — either is fine, be consistent.
- **Shard pruning is the AC2 "reads only intersecting shards" guarantee.** Derive the window from UTC dates and filter `listAuditShardDates` BEFORE reading. The boundary shard whose date equals `from`'s (or `to`'s) date must still be read and then in-memory filtered by exact timestamp, because a shard groups by UTC day, not by the exact `from`/`to` instant.
- **Pagination choice: offset + limit (not cursor).** Architecture only requires "paginated, reverse chronological"; offset/limit with `{ total, hasMore }` is the simplest testable contract at Phase 2 scale and matches "applies filters in memory" guidance. A cursor API would be over-engineering here; if a future story needs stable pagination under concurrent appends, that is a separate enhancement (note it, don't build it).
- **Scope:** query API only. NOT rollback (10.5), NOT retention prune (10.6), NOT schema-versioning tests (10.7), NOT agent-service wiring (Epic 11). No UI — Studio's audit-log query view is Story 13.10 (deferred to S6).
- Test file FLAT under `tests/` (Story 8.1 glob constraint — a nested subdir would shadow the flat suite count).

### Architecture Compliance

- Implements architecture.md §"Query API": `audit-log-service.ts.query(filter: AuditQuery)` — filter axes `scope`, `target.resourceKind`, `target.pageId`, `target.projectId`, `timestamp` range, `status`, `actor.kind`; reverse-chronological + paginated; reads daily shards in the requested range and filters in memory (sufficient for Phase 2 scale).
- Satisfies **FR57** (audit query + rollback API — the query half) at the service layer. Pairs with Story 10.5 (rollback) to complete FR57.
- Naming: existing kebab-case `audit-log-service.ts`; camelCase `query`; `AuditQuery` / `AuditQueryResult` PascalCase types in `types/audit.ts`.
- Zero-Zod convention holds: hand-rolled input validation via `ValidationError` (consistent with 10.1/10.3), no schema library.

### File Structure Requirements

**To modify:**
- `packages/core/src/types/audit.ts` — add `AuditQuery` + `AuditQueryResult` types.
- `packages/core/src/services/audit-log-service.ts` — add `query()` (reuse existing `ValidationError` import + private `shardDate`).
- `artifacts/bmad/implementation-artifacts/sprint-status.yaml` — `10-4-...` backlog → review on completion.

**To create:**
- `packages/core/tests/audit-query.test.ts` (FLAT).

**Reference-only (do not modify):**
- `packages/core/src/fs/audit-repository.ts` (10.2 reads: `listAuditShardDates`, `readAuditShard`, `auditShardFileName`).
- `packages/core/src/schemas/audit-entry-schema.ts` (10.1 validator — entries are already validated on write; `query` need not re-validate on read).
- `packages/core/src/errors/validation-error.ts` (`ValidationError` shape).

**Out of scope:** rollback service (10.5), retention prune (10.6), schema-versioning tests (10.7), agent-service wiring (Epic 11), Studio audit query UI (13.10).

### Testing Requirements

- `node:test` + `node:assert/strict`, FLAT `packages/core/tests/audit-query.test.ts`, `mkdtemp` per test + `rm` cleanup.
- Seed helper: append a spread of `AuditEntry` rows (varied `scope`, `status`, `operation`, `actor.kind`, `target.resourceKind`/`pageId`, `projectId`) across at least two distinct UTC shard dates using `appendAuditEntry` (or write shards directly). Use valid ULID-shaped ids ordered so timestamp-tie cases are exercised.
- Key cases:
  - Each single-axis filter returns exactly the matching subset.
  - Combined filters apply AND semantics.
  - Timestamp range is inclusive at both bounds; open-ended (only `from`, only `to`) works.
  - Reverse-chronological order incl. a same-`timestamp` pair ordered by `id` desc.
  - `limit`/`offset` slice correctly; `total` is the full match count; `hasMore` true mid-list, false on last page; defaults (`limit=50`, `offset=0`) applied when omitted.
  - Out-of-range `offset` → `{ entries: [], total, hasMore: false }` (not an error).
  - Invalid pagination (`limit <= 0`, non-integer, negative `offset`, unparseable `from`/`to`) → `ValidationError`.
  - **Shard pruning:** prove an out-of-range shard is never read — e.g. write a deliberately malformed/poisoned shard file for a date outside the query window and assert the query still succeeds (it would throw a `JSON.parse` error if that shard were read). Complement with a positive assertion that in-window shards are returned.
  - Empty audit dir → `{ entries: [], total: 0, hasMore: false }`.

### References

- Architecture: [Source: artifacts/bmad/planning-artifacts/architecture.md#Query API] (filter axes, reverse-chron + paginated, range-shard reads, in-memory filtering)
- Architecture: [Source: artifacts/bmad/planning-artifacts/architecture.md#Audit Log Architecture] (daily NDJSON shards `YYYY-MM-DD.ndjson`, UTC shard key)
- Epics: [Source: artifacts/bmad/planning-artifacts/epics.md#Epic 10 → Story 10.4]
- Predecessors: [Source: artifacts/bmad/implementation-artifacts/10-2-implement-daily-ndjson-audit-repository.md] (repository reads) + [Source: artifacts/bmad/implementation-artifacts/10-3-implement-write-ahead-lifecycle.md] (one-line-per-entry guarantee, `shardDate` helper)
- Schema: [Source: packages/core/src/types/audit.ts] (`AuditEntry`, `AuditScope`, `AuditStatus`, `AuditOperation`, `AuditActorKind`, `AuditResourceKind`)
- Repo conventions: [Source: CLAUDE.md#Pre-GitHub Submission Gate] (gate = `pnpm test`; core-only change)

## Dev Agent Record

### Agent Model Used

Claude Opus 4.8 (`claude-opus-4-8`)

### Debug Log References

- None. Test FLAT at `packages/core/tests/audit-query.test.ts` per the Story 8.1 glob constraint.

### Completion Notes List

- `query(auditRoot, filter)` added to `packages/core/src/services/audit-log-service.ts` — read-only over the 10.2 repository (no `appendAuditEntry`/`overwriteAuditShard`). Reuses the existing `ValidationError` import + private `shardDate` helper; added an `auditShardFileName` import for the UTC date-key derivation.
- **Shard pruning (AC5):** `fromKey`/`toKey` are UTC `YYYY-MM-DD` strings derived via `auditShardFileName`; `listAuditShardDates` is filtered to `[fromKey, toKey]` (lexicographic compare is valid for `YYYY-MM-DD`) BEFORE any shard is read. A poisoned out-of-range shard test proves out-of-range shards are never parsed.
- **Timestamp range + sort use NUMERIC compare (`Date.parse`)**, not string compare — deliberately robust to ISO format/precision differences between caller bounds and stored timestamps (a follow-up-proof choice; string compare would silently misbehave on mixed offsets/precisions). Reverse-chron sort: `timestamp` desc, `id` desc tiebreak (ULID lexical order = creation order → stable total order for same-millisecond entries).
- **Pagination:** offset + limit (default `limit=50`, `offset=0`); result `{ entries, total, hasMore }` where `total` is the pre-pagination match count. Out-of-range `offset` is NOT an error → `{ entries: [], total, hasMore: false }`. Invalid `limit`/`offset`/`from`/`to` throw a typed `ValidationError` (entity `audit-query`).
- `AuditQuery` + `AuditQueryResult` types added to `packages/core/src/types/audit.ts` (reachable via existing `types/index.ts` → `src/index.ts` barrel). No new dependencies.
- Scope held to the query API: NOT rollback (10.5), retention (10.6), schema-versioning tests (10.7), agent wiring (Epic 11), or Studio UI (13.10).

### Validation Evidence

- `pnpm --filter @anydocs/core typecheck` → exit 0
- `pnpm --filter @anydocs/core test` → **243 pass / 0 fail / 0 skipped** (10.4 adds 11: empty-dir result; 7 single-axis filters; AND combine; inclusive range across days; open-ended from/to; reverse-chron + id tiebreak; pagination total/hasMore; defaults; out-of-range offset; invalid-pagination ValidationError cases; shard-pruning poison-shard proof). `mkdtemp` isolation.
- Root `pnpm typecheck` → exit 0. Root `pnpm test`: core **243** + editor **162** + cli **36 pass + 2 skip** + mcp **44** + web **77** = **562 pass / 0 fail / 2 skipped**. The 2 cli skips are the pre-existing packaging-smoke skips (not a regression). Core-only change.

### File List

**New files**

- `packages/core/tests/audit-query.test.ts`

**Modified files**

- `packages/core/src/types/audit.ts` — added `AuditQuery` + `AuditQueryResult` types
- `packages/core/src/services/audit-log-service.ts` — added `query()` + `auditShardFileName` import + private `utcDateKey`/`idDesc`/`matchesFilter`/`paginationError` helpers
- `artifacts/bmad/implementation-artifacts/10-4-implement-audit-query-api.md` — status ready-for-dev → review → done; tasks ticked; Dev Agent Record + Senior Developer Review populated
- `artifacts/bmad/implementation-artifacts/sprint-status.yaml` — `10-4-...` ready-for-dev → review → done

## Senior Developer Review (AI)

**Date:** 2026-06-12 · **Outcome:** Approve (review → done)

**Verification:** File List matches git reality exactly (no discrepancies). All 9 ACs verified IMPLEMENTED against code + tests. Shard-pruning soundness proven: UTC date is monotonic in instant, so `entry instant ∈ [from, to] ⟹ entry shard ∈ [fromKey, toKey]` — no matching entry is ever pruned. No CRITICAL / HIGH / MEDIUM findings.

**Findings (all LOW) — L1, L2, L4, L5 fixed in-line; L3 addressed by documentation; L6 logged:**

- **L1 (perf) — FIXED:** sort comparator re-parsed timestamps O(n log n) times. Replaced with a Schwartzian transform — each entry's timestamp is parsed ONCE into `{ entry, ms }`, shared by both the range filter and the sort.
- **L2 (robustness) — FIXED:** a corrupt (unparseable) timestamp previously yielded a `NaN` comparator → undefined ordering. Now NaN sorts deterministically to the end (with `id` desc tiebreak among NaNs); a bounded range also excludes NaN timestamps. Regression test added.
- **L3 (no max-limit clamp) — DOCUMENTED:** `limit` is intentionally unbounded (local, single-writer, Phase 2 scale). Added an explicit code comment recording the decision rather than introducing a non-AC throwing behavior.
- **L4 (readability) — FIXED:** `utcDateKey`'s `.slice(0, 'YYYY-MM-DD'.length)` replaced with a named `SHARD_DATE_KEY_LENGTH = 10` constant + comment.
- **L5 (test gap) — FIXED:** added a `to`-only upper-bound shard-pruning test (poisoned later shard is never read).
- **L6 (doc nit) — LOGGED:** architecture.md §Query API lists the axis as `target.projectId`, but `projectId` is a top-level `AuditEntry` field; the implementation correctly filters `entry.projectId`. Architecture doc imprecision, not an impl bug — no code change.

**Post-fix gate:** core **245** (+2 regression tests) + editor 162 + cli 36 (+2 pre-existing skips) + mcp 44 + web 77 = **564 pass / 0 fail / 2 skipped**; root `pnpm typecheck` exit 0.
