# Story 10.5: Implement Rollback Service

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a documentation maintainer,
I want to roll back any logged Agent operation to its pre-change state,
so that I can recover quickly from unwanted AI edits per FR57.

## Acceptance Criteria

1. A new `packages/core/src/services/rollback-service.ts` exposes `rollback(auditRoot, entryId, options): Promise<WriteAheadResult<void>>` that, for a **committed** audit entry carrying a captured pre-change snapshot (`diff.before`), re-applies that snapshot to content and persists a new `operation: 'rollback'` audit entry referencing the original (`rollbackOf: entryId`).
2. The content re-application is performed by a caller-supplied `options.applyRollback(snapshot, original)` callback (the host wires the concrete `content-repository` / page write in Epic 11 — `@anydocs/core` stays decoupled from concrete repositories, mirroring Story 10.3's `runWriteAhead(applyContentWrite)` seam). The architecture's "re-applied through `content-repository.write()`" is satisfied by this host callback.
3. The new rollback audit entry is persisted **through the write-ahead lifecycle** (`runWriteAhead`): a `pending` rollback entry is durable before the content re-application runs, then `committed` on success or `rejected` (and the error re-thrown) on failure. The rollback is itself a fully auditable, write-ahead operation.
4. The rollback entry is derived from the original: same `projectId`, `scope`, `target`, `runtimeMode`; `operation: 'rollback'`; `rollbackOf: entryId`; a new `id` (caller-supplied via `options.rollbackEntryId` — core has no ULID generator, id generation is the producer's concern per Story 10.2); `timestamp` defaulting to now (ISO) but overridable via `options.timestamp` for deterministic tests; `actor` defaulting to `{ kind: 'system' }` (a rollback is a tool-initiated recovery — it must NOT impersonate the original actor) but overridable via `options.actor` when the host knows the initiator. Its `diff` records `{ before: original.diff.after, after: original.diff.before, summary: 'Rollback of <entryId>' }`. _(Senior Review M1: default changed from `original.actor` → `{ kind: 'system' }`.)_
5. **Given a rejected or pending entry**, rollback is refused with a typed `RollbackNotApplicableError` (code `ROLLBACK_NOT_COMMITTED`) and **no content change is attempted** (the `applyRollback` callback is never invoked and no new audit entry is persisted).
6. **Given a committed entry with no captured snapshot** (`diff?.before === undefined`), rollback is refused with `RollbackNotApplicableError` (code `ROLLBACK_NO_SNAPSHOT`); no content change attempted.
7. **Given an unknown `entryId`** (never persisted), rollback throws a typed `ValidationError` (distinct from `RollbackNotApplicableError` — the entry doesn't exist vs. exists-but-not-rollbackable); no content change attempted.
8. `RollbackNotApplicableError extends DomainError` (matching `RuntimeModeResolutionError`'s shape: stable `name`, machine-branchable `code`, structured `details`). A read helper `findAuditEntry(auditRoot, id): Promise<AuditEntry | undefined>` is added to `audit-log-service.ts` (scans shards newest-first; the rollback target is usually recent) and reused by the rollback service. Both `rollback` + `RollbackNotApplicableError` are exported via `services/index.ts`. **No new dependencies.**
9. Unit tests (FLAT under `packages/core/tests/`) cover: happy path (committed + snapshot → callback receives the `before` snapshot once, a committed rollback entry with `operation: 'rollback'` + `rollbackOf` is persisted, the original entry is left untouched); rejected entry → `RollbackNotApplicableError` (`ROLLBACK_NOT_COMMITTED`) + callback never called + no new entry; pending entry → same refusal; committed-but-no-snapshot → `RollbackNotApplicableError` (`ROLLBACK_NO_SNAPSHOT`); unknown id → `ValidationError`; `applyRollback` throws → rollback entry ends `rejected` (write-ahead) + original error re-thrown + original entry untouched; `findAuditEntry` locates an entry in an older shard. `pnpm typecheck` + `pnpm test` (core + root) pass.

## Tasks / Subtasks

- [x] Add the `findAuditEntry` read helper (AC: 8)
  - [x] In `packages/core/src/services/audit-log-service.ts`, add+export `findAuditEntry(auditRoot, id): Promise<AuditEntry | undefined>` — `listAuditShardDates` reversed (newest-first), read each shard, `entries.find(e => e.id === id)`, return on first hit else `undefined`. Reused the existing private `shardDate` helper.
- [x] Add the typed error (AC: 8)
  - [x] Created `RollbackNotApplicableError extends DomainError` with `RollbackErrorCode = 'ROLLBACK_NOT_COMMITTED' | 'ROLLBACK_NO_SNAPSHOT'` (co-located in `rollback-service.ts`, mirroring `runtime-mode-error.ts`).
- [x] Implement the rollback service (AC: 1–7)
  - [x] Created `packages/core/src/services/rollback-service.ts`.
  - [x] `rollback(auditRoot, entryId, options)`: `findAuditEntry` → not found ⇒ `ValidationError`; `status !== 'committed'` ⇒ `RollbackNotApplicableError(ROLLBACK_NOT_COMMITTED)`; `diff?.before === undefined` ⇒ `RollbackNotApplicableError(ROLLBACK_NO_SNAPSHOT)`. All guards run before any callback/write.
  - [x] Builds the derived rollback `AuditEntry` (AC4), then `return runWriteAhead(auditRoot, rollbackEntry, async () => { await options.applyRollback(snapshot, original); })`.
- [x] Wire the barrel (AC: 8)
  - [x] `export * from './rollback-service.ts';` in `packages/core/src/services/index.ts`.
- [x] Add unit tests (AC: 9) — FLAT `packages/core/tests/rollback-service.test.ts`, `mkdtemp` isolation; seeds committed/pending/rejected entries via `appendAuditEntry`; asserts callback invocation, persisted rollback entry shape, all refusal paths, and write-ahead rejection on a throwing callback.
- [x] Validate (AC: 9): `pnpm --filter @anydocs/core typecheck` + `test`, then root `pnpm typecheck` + `pnpm test` green.
- [x] Update `sprint-status.yaml` `10-5-implement-rollback-service` → `review`.

## Dev Notes

- **Depends on 10.1** (`AuditEntry`, validator), **10.2** (`appendAuditEntry`, `readAuditShard`, `listAuditShardDates`), **10.3** (`runWriteAhead`, `WriteAheadResult`, private `shardDate`). Rollback persists its new entry through 10.3's write-ahead seam so the rollback is itself audited and write-ahead-safe.
- **Decoupling (the key design decision).** Architecture says rollback "re-applies the snapshot through `content-repository.write()`". But `@anydocs/core` must not hard-wire which concrete repository/page write to call — that depends on `target.resourceKind` (block/page/navigation/project-config) and is the host's concern. So `rollback` takes an `applyRollback(snapshot, original)` callback, exactly mirroring Story 10.3's `runWriteAhead(applyContentWrite)` seam. Epic 11's agent-service supplies the concrete write. This keeps 10.5 unit-testable with a spy callback and zero fs-content coupling.
- **Id generation.** Core has no ULID library (10.2: "id generation is the producer's concern"). The new rollback entry's `id` is therefore caller-supplied (`options.rollbackEntryId`). `timestamp` defaults to `new Date().toISOString()` (allowed in core lib — the no-`Date.now()` rule is Workflow-script-only per 10.2 Dev Notes) but is overridable for deterministic tests.
- **Guard ordering matters (AC5/AC7).** Look up → status guard → snapshot guard, ALL before any `runWriteAhead`/callback. A non-applicable rollback must touch nothing: no content write, no pending audit entry. Unknown-id is a `ValidationError` (doesn't exist), distinct from `RollbackNotApplicableError` (exists but not rollbackable).
- **Rollback's own diff** swaps the original's: `before = original.diff.after` (the state we are leaving), `after = original.diff.before` (the restored state). `original.diff.after` may be `undefined`; `AuditDiff` fields are optional so this validates.
- **Scope:** rollback service only. NOT retention prune (10.6), NOT schema-versioning forward-compat (10.7), NOT the concrete content-write wiring or agent-service (Epic 11), NOT the Studio rollback UI (Epic 13). No new dependencies.
- Test file FLAT under `tests/` (Story 8.1 glob constraint).

### Architecture Compliance

- Implements architecture.md §"Rollback" (`audit-log-service.ts.rollback(entryId)` 3-step: load pre-change snapshot → re-apply via content write → persist `operation: 'rollback'` entry referencing the original) and the `rollback-service.ts` module named in the FR57 traceability row. The "re-apply through `content-repository.write()`" step is realized as the host-supplied `applyRollback` callback (the core/host boundary discipline established across Epic 6–10).
- Completes **FR57** (audit query + rollback API) together with Story 10.4 (query). Provides the NFR29 rollback-semantics half at the service layer.
- Naming: kebab-case `rollback-service.ts`; camelCase `rollback`/`findAuditEntry`; PascalCase `RollbackNotApplicableError`. Zero-Zod (typed `DomainError`/`ValidationError`, no schema lib).

### File Structure Requirements

**To create:**
- `packages/core/src/services/rollback-service.ts` (+ `RollbackNotApplicableError`)
- `packages/core/tests/rollback-service.test.ts` (FLAT)

**To modify:**
- `packages/core/src/services/audit-log-service.ts` — add+export `findAuditEntry`
- `packages/core/src/services/index.ts` — export the rollback service
- `artifacts/bmad/implementation-artifacts/sprint-status.yaml` — `10-5-...` transitions

**Reference-only (do not modify):**
- `packages/core/src/services/audit-log-service.ts` (10.3 `runWriteAhead`/`WriteAheadResult`, private `shardDate`)
- `packages/core/src/runtime/runtime-mode-error.ts` (the `DomainError` subclass pattern to mirror)
- `packages/core/src/types/audit.ts` (`AuditEntry`, `AuditDiff`, `AuditActor`, `AuditOperation`)

**Out of scope:** retention prune (10.6), schema-versioning tests (10.7), concrete content-write wiring + agent-service (Epic 11), Studio rollback UI (Epic 13).

### Testing Requirements

- `node:test` + `node:assert/strict`, FLAT `packages/core/tests/rollback-service.test.ts`, `mkdtemp` per test + `rm` cleanup.
- Seed entries via `appendAuditEntry` with explicit `status` + a `diff: { before, after }` snapshot. Use a spy callback capturing its `(snapshot, original)` args + invocation count.
- Key cases:
  - **Happy path:** committed entry w/ snapshot → callback invoked exactly once with `original.diff.before`; a new entry with `operation: 'rollback'`, `rollbackOf: <id>`, `status: 'committed'` is persisted (re-read confirms); the original entry is unchanged (still `committed`, still `operation: 'update'`).
  - **Rejected entry** → `RollbackNotApplicableError` with code `ROLLBACK_NOT_COMMITTED`; callback never called; no new entry persisted (shard count unchanged).
  - **Pending entry** → same refusal.
  - **Committed, no `diff.before`** → `RollbackNotApplicableError` code `ROLLBACK_NO_SNAPSHOT`; no content change.
  - **Unknown id** → `ValidationError` (not `RollbackNotApplicableError`).
  - **Throwing `applyRollback`** → the persisted rollback entry ends `status: 'rejected'` (write-ahead) with the error message; the original error re-propagates; original entry untouched.
  - **`findAuditEntry`** locates an entry living in an older (not the newest) shard.

### References

- Architecture: [Source: artifacts/bmad/planning-artifacts/architecture.md#Rollback] (3-step: load snapshot → re-apply via content write → persist `operation: 'rollback'` referencing original)
- Architecture: [Source: artifacts/bmad/planning-artifacts/architecture.md#Requirements Traceability] (FR57 → `rollback-service.ts`)
- Epics: [Source: artifacts/bmad/planning-artifacts/epics.md#Epic 10 → Story 10.5]
- Predecessors: [Source: artifacts/bmad/implementation-artifacts/10-3-implement-write-ahead-lifecycle.md] (`runWriteAhead` seam + `WriteAheadResult`), [Source: artifacts/bmad/implementation-artifacts/10-2-implement-daily-ndjson-audit-repository.md] (repo reads, id-is-producer's-concern)
- Error pattern: [Source: packages/core/src/runtime/runtime-mode-error.ts] (`DomainError` subclass with code + details)
- Types: [Source: packages/core/src/types/audit.ts] (`AuditEntry`, `AuditDiff`, `AuditActor`)

## Dev Agent Record

### Agent Model Used

Claude Opus 4.8 (`claude-opus-4-8`)

### Debug Log References

- None. Test FLAT at `packages/core/tests/rollback-service.test.ts` per the Story 8.1 glob constraint.

### Completion Notes List

- `packages/core/src/services/rollback-service.ts`: `rollback(auditRoot, entryId, options)` looks up the original via `findAuditEntry`, guards (not-found → `ValidationError`; non-committed → `RollbackNotApplicableError(ROLLBACK_NOT_COMMITTED)`; missing `diff.before` → `RollbackNotApplicableError(ROLLBACK_NO_SNAPSHOT)`) BEFORE any content/callback/audit write, then persists a derived `operation: 'rollback'` entry (`rollbackOf: entryId`, swapped diff) through `runWriteAhead` — re-applying the snapshot via the host-supplied `options.applyRollback` callback.
- **Decoupling:** the architecture's "re-apply through `content-repository.write()`" is realized by the `applyRollback(snapshot, original)` callback — `@anydocs/core` carries no concrete content-repo wiring (Epic 11's agent-service supplies it), exactly mirroring Story 10.3's `runWriteAhead(applyContentWrite)` seam. Makes the service unit-testable with a spy callback.
- **Id/timestamp:** new entry id is producer-supplied (`options.rollbackEntryId`; core has no ULID generator per 10.2); `timestamp` defaults to `new Date().toISOString()` (allowed in core lib) but is overridable for deterministic tests. `actor` defaults to the original's, overridable.
- `RollbackNotApplicableError extends DomainError` (stable `name`, machine-branchable `code`, structured `details`) — distinct from the not-found `ValidationError`. Added+exported `findAuditEntry` read helper (newest-first shard scan) to `audit-log-service.ts`.
- No new dependencies. Reuses 10.1 (validate via append), 10.2 (reads), 10.3 (`runWriteAhead`). Scope held to the rollback service: no retention (10.6), no schema-versioning (10.7), no concrete content wiring/agent-service (Epic 11), no UI (Epic 13).

### Validation Evidence

- `pnpm --filter @anydocs/core typecheck` → exit 0
- `pnpm --filter @anydocs/core test` → **253 pass / 0 fail / 0 skipped** (10.5 adds 7: happy-path snapshot re-apply + committed rollback entry + original untouched; rejected → ROLLBACK_NOT_COMMITTED + no callback/entry; pending → same; committed-no-snapshot → ROLLBACK_NO_SNAPSHOT; unknown id → ValidationError; throwing callback → rollback entry rejected + original error re-thrown; `findAuditEntry` finds an older-shard entry). `mkdtemp` isolation.
- Root `pnpm typecheck` → exit 0. Root `pnpm test`: core **253** + editor **162** + cli **36 pass + 2 skip** + mcp **44** + web **77** = **572 pass / 0 fail / 2 skipped**. Core-only change.

### File List

**New files**

- `packages/core/src/services/rollback-service.ts`
- `packages/core/tests/rollback-service.test.ts`

**Modified files**

- `packages/core/src/services/audit-log-service.ts` — added+exported `findAuditEntry`
- `packages/core/src/services/index.ts` — export the rollback service
- `artifacts/bmad/implementation-artifacts/10-5-implement-rollback-service.md` — status ready-for-dev → review → done; tasks ticked; Dev Agent Record + Senior Developer Review populated
- `artifacts/bmad/implementation-artifacts/sprint-status.yaml` — `10-5-...` backlog → ready-for-dev → review → done

## Senior Developer Review (AI)

**Date:** 2026-06-12 · **Outcome:** Approve after fix (review → done)

**Verification:** File List matches git reality (rollback-service.ts new; audit-log-service.ts + services/index.ts modified; rollback-service.test.ts new). All 9 ACs verified IMPLEMENTED against code + the rollback-service.test.ts cases: guard ordering (lookup → status → snapshot, ALL before any callback/write — AC5/AC6/AC7 proven by "callback never called / no new entry" assertions); write-ahead persistence via `runWriteAhead` (AC3); decoupled `applyRollback` seam (AC2); derived entry shape incl. swapped diff + `rollbackOf` (AC4); typed `RollbackNotApplicableError extends DomainError` distinct from not-found `ValidationError` (AC7/AC8); `findAuditEntry` older-shard lookup (AC8). No CRITICAL / HIGH.

**Findings:**

- **M1 (MEDIUM, audit provenance) — FIXED IN-LINE:** the rollback entry defaulted `actor: original.actor`, so a rollback of an agent's change was attributed to that agent — misrepresenting a tool-initiated *recovery* as the agent re-running, which corrupts the FR57 audit trail. Changed the default to `{ kind: 'system' }` (the `options.actor` override remains for when the host knows the initiating human/agent). AC4 wording updated; added a regression test asserting the default is `system` (no `agentProvider`) and that the override is honored. core 253 → **254**.
- **L1 (LOW):** `rollback` does not guard a reused `options.rollbackEntryId` — a duplicate id would `appendAuditEntry` a second same-id row (append is not dedup), and `findAuditEntry`/`markCommitted` would then resolve only the newest. Consistent with the established "producer supplies a unique ULID" contract (same assumption as 10.3's `persistPending`); logged, no change.
- **L2 (LOW):** rolling back a committed `operation: 'rollback'` entry is permitted with no cycle/chain guard. Currently this is correct "redo" semantics (re-applies the rollback's `diff.before`); flagged for awareness should chained-rollback policy ever be needed.
- **L3 (LOW):** atomicity of the content re-application itself on partial failure is the host `applyRollback` callback's responsibility (the rollback entry correctly ends `rejected` + re-throws via write-ahead) — same boundary as Story 10.3's content write / content-repository temp-rename. Documented, no change.

**Post-fix gate:** core **254** (+1 regression test) + editor 162 + cli 36 (+2 skip) + mcp 44 + web 77 = **573 pass / 0 fail / 2 skipped**; root `pnpm typecheck` exit 0.
