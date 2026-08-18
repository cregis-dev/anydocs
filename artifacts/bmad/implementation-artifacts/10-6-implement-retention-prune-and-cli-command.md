# Story 10.6: Implement Retention Prune (≥30 days) and CLI Command

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a documentation maintainer,
I want audit entries beyond the retention window pruned automatically,
so that local disk usage stays bounded per NFR30.

## Acceptance Criteria

1. `packages/core/src/fs/audit-repository.ts` exposes `pruneAuditShards(auditRoot, options): Promise<PruneAuditResult>` that deletes every daily shard whose UTC date is **older than the retention window** (default 30 days; `options.retentionDays` overridable). A shard exactly at the boundary is **kept** (retention is "≥ N days": delete iff `shardDate < (now − retentionDays)`'s UTC date).
2. When ≥1 shard is pruned, a single **system audit entry** is appended summarizing the prune: `actor.kind: 'system'`, `operation: 'structural'`, `status: 'committed'`, `scope: 'workspace'`, a `diff.summary` naming the count + cutoff + pruned dates. The entry is appended via `appendAuditEntry` (so it is validated, Story 10.1) and lands in `now`'s shard (always within retention, never self-pruned).
3. When **no shard is old enough** (project under the retention window), **no shard is deleted and no system audit entry is appended** — `pruneAuditShards` returns `{ prunedDates: [], ... }` and writes nothing.
4. `PruneAuditResult` reports `{ prunedDates: string[]; retentionDays: number; cutoff: string; auditEntryId?: string }` (`auditEntryId` present only when something was pruned). `options`: `{ projectId, runtimeMode, retentionDays?, now?, entryId? }` — `projectId`/`runtimeMode` are required for the system entry's required fields; `now` + `entryId` are overridable for deterministic tests (id defaults to `system-prune-<now ISO>`; core has no ULID generator per Story 10.2). An invalid `retentionDays` (negative or non-integer) throws a typed `ValidationError`.
5. A CLI command `anydocs audit prune [targetDir] [--retention-days <n>] [--json]` is added: it loads the project contract (resolving `paths.auditRoot` + `config.projectId`), resolves the runtime mode, runs `pruneAuditShards`, and reports the outcome (human-readable lines or `--json` structured payload). Exit `0` on success (including the no-op case), `1` on contract/validation failure.
6. The CLI resolves `runtimeMode` for the system entry through `@anydocs/core`'s resolver (`resolveRuntimeMode`): a valid `ANYDOCS_RUNTIME_MODE` env is honored, otherwise it defaults to `'web'` (a CLI/local prune operates on a local project; `RuntimeMode` has no CLI member, and `'desktop'` would be wrong). No inline `runtimeMode === ...` comparison (respects the Story 8.2 capability-matrix guard).
7. `audit` is wired into the CLI dispatch (`index.ts`) with a `prune` subcommand, an arg parser (`parseAuditPruneCommandArgs`), `audit prune` entries in `printCommandHelp` + the general help command list, and `pruneAuditShards` + `AUDIT_RETENTION_DAYS` + `PruneAuditResult` exported from `@anydocs/core`. No new dependencies.
8. Unit tests cover — **core** (FLAT `packages/core/tests/audit-prune.test.ts`, `mkdtemp`): old shards deleted + a system `structural`/`system` entry appended summarizing them; boundary shard (exactly `retentionDays` old) kept; under-retention project → nothing deleted + no entry; `prunedDates`/`cutoff`/`auditEntryId` shape; custom `retentionDays`; invalid `retentionDays` → `ValidationError`; the appended summary entry itself is NOT pruned (it is in today's shard). **CLI** (`command-args.test.ts` for the parser; a command test scaffolding a temp project via `initializeProject`, seeding an old + a recent shard, running `runAuditPruneCommand`, asserting the old shard is gone, the recent shard survives, and a summary entry exists). `pnpm typecheck` + `pnpm test` (core + cli + root) pass.

## Tasks / Subtasks

- [x] Implement `pruneAuditShards` in core (AC: 1, 2, 3, 4)
  - [x] Added `AUDIT_RETENTION_DAYS = 30` + `PruneAuditOptions` / `PruneAuditResult` to `audit-repository.ts` (imports `AUDIT_SCHEMA_VERSION` + `RuntimeMode` + `ValidationError`).
  - [x] Computes `cutoffKey` = UTC `YYYY-MM-DD` of `now − retentionDays` (reuses `auditShardFileName(...).slice(0,10)`); prunes `dates.filter(d => d < cutoffKey)`.
  - [x] Deletes each pruned shard via `overwriteAuditShard(auditRoot, new Date(\`${d}T00:00:00.000Z\`), [])` (empty array removes the file — Story 10.3 primitive).
  - [x] On ≥1 pruned: builds + `appendAuditEntry` the system `structural` entry (`scope: 'workspace'`, `target: { resourceKind: 'project-config' }`, `actor: { kind: 'system' }`, `diff.summary`). Returns result with `auditEntryId`.
  - [x] Validates `retentionDays` (non-negative integer) → `ValidationError` otherwise.
  - [x] New symbols reachable through `fs/index.ts` → root barrel.
- [x] Add the CLI command (AC: 5, 6, 7)
  - [x] `parseAuditPruneCommandArgs(args)` in `command-args.ts` → `{ targetDir?, retentionDays? }` (`--retention-days <n>` non-negative-integer-validated, `--target`/positional targetDir).
  - [x] `packages/cli/src/commands/audit-command.ts` → `runAuditPruneCommand(...)`: `resolveRepoRoot` → `loadProjectContract` (fail → exit 1) → `pruneAuditShards(...)` → human/`--json` report. `resolveCliRuntimeMode()` honors a valid `ANYDOCS_RUNTIME_MODE`, else injects `'web'`.
  - [x] Wired `case 'audit':` → `runAuditCommand` sub-dispatch on `prune`; `audit` added to `resolveHelpTarget` + `failUnknownSubcommand` union.
  - [x] Added `audit prune` help to `printCommandHelp` + a general-help command line.
- [x] Add tests (AC: 8)
  - [x] Core: `packages/core/tests/audit-prune.test.ts` (FLAT, `mkdtemp`) — 6 cases.
  - [x] CLI: 2 parser cases in `command-args.test.ts`; 3 command tests in `audit-command.test.ts` (scaffold via `initializeProject`, seed shards, run `runAuditPruneCommand`).
- [x] Validate (AC: 8): `pnpm --filter @anydocs/core test`, `pnpm --filter @anydocs/cli test`, root `pnpm typecheck` + `pnpm test` green.
- [x] Update `sprint-status.yaml` `10-6-...` → `review`.

## Dev Notes

- **Depends on 10.1** (`AuditEntry` + validator + `AUDIT_SCHEMA_VERSION`), **10.2** (`appendAuditEntry`, `listAuditShardDates`, `auditShardFileName`/`auditShardPath`, `paths.auditRoot`), **10.3** (`overwriteAuditShard` empty-removal primitive). First Epic 10 story to touch the CLI package.
- **`prune()` location.** Architecture names `audit-repository.ts.prune()`, so the prune lives in the repository (it is shard-file mechanics + one validated append), NOT a new service. Reuses 10.3's `overwriteAuditShard(auditRoot, date, [])` for deletion (empty array removes the shard).
- **Retention boundary (NFR30 "≥ 30 days").** Keep the last `retentionDays`; delete strictly older. `cutoff = now − retentionDays` (UTC date); delete shards with `dateKey < cutoffKey`. A shard exactly `retentionDays` old is on the cutoff date and is KEPT. Document so 10.7 forward-compat tests agree.
- **System entry `resourceKind`.** The audit-entry schema's `target.resourceKind` enum is `block|page|navigation|project-config` — there is no dedicated "audit-log" kind. A prune is a project-level maintenance op, so `'project-config'` is the least-wrong choice; `scope: 'workspace'`, `operation: 'structural'`, `actor.kind: 'system'`. (A dedicated resourceKind would be a schema change — defer to Story 10.7 if ever wanted.) The entry is appended to `now`'s shard, which is always within retention and never self-pruned in the same run.
- **Runtime mode in the CLI.** The system entry requires a `runtimeMode`, but `getRuntimeMode()` fails-fast in a bare CLI/node process (no injection/env/Tauri). So the CLI bootstraps it: honor a valid `ANYDOCS_RUNTIME_MODE`, else inject `'web'` (a local/CLI prune is a web-mode operation). Goes through `resolveRuntimeMode` — no inline literal comparison (Story 8.2 guard). `new Date()` is allowed in core lib + CLI (the no-`Date.now()` rule is Workflow-script-only, per 10.2 Dev Notes).
- **Id generation.** No ULID lib in core (10.2); the system entry id defaults to `system-prune-<now ISO>` (overridable via `options.entryId` for tests). A readable non-ULID id is fine — its ordering in 10.4 query is by unique `timestamp`, not the id tiebreak.
- **Scope:** prune + CLI command only. NOT Studio-startup auto-prune wiring (the architecture mentions it; the web/Studio call site belongs to Epic 13 / a web task — `pruneAuditShards` is the reusable primitive both call). NOT schema-versioning forward-compat (10.7), NOT agent-service (Epic 11).
- Core test FLAT under `tests/` (Story 8.1 glob constraint).

### Architecture Compliance

- Implements architecture.md §"Retention" / NFR30 (≥30-day retention, daily-shard deletion) and the epic's "system audit entry summarizing the prune" requirement. `pruneAuditShards` is the primitive invoked by both the `anydocs audit prune` CLI (this story) and Studio startup (Epic 13).
- CLI follows the existing thin-adapter pattern (`loadProjectContract` → core call → structured/human output + exit codes), mirroring `project paths` / `nav get`.
- Naming: `pruneAuditShards` (camelCase), `AUDIT_RETENTION_DAYS` (SCREAMING_SNAKE const), `audit prune` (CLI verb). Zero-Zod (`ValidationError` for bad input).

### File Structure Requirements

**To create:**
- `packages/cli/src/commands/audit-command.ts`
- `packages/core/tests/audit-prune.test.ts` (FLAT)

**To modify:**
- `packages/core/src/fs/audit-repository.ts` — `pruneAuditShards` + `AUDIT_RETENTION_DAYS` + result/options types
- `packages/cli/src/index.ts` — `audit` dispatch + `prune` sub-dispatch + help target
- `packages/cli/src/commands/command-args.ts` — `parseAuditPruneCommandArgs`
- `packages/cli/src/help.ts` — `audit prune` help + general-help line
- `packages/cli/tests/command-args.test.ts` — parser cases
- `artifacts/bmad/implementation-artifacts/sprint-status.yaml` — status transitions

**Reference-only:**
- `packages/cli/src/commands/project-command.ts` (thin-adapter + structured-output pattern)
- `packages/cli/src/commands/read-command-helpers.ts` (`resolveRepoRoot`)
- `packages/core/src/fs/audit-repository.ts` (10.2/10.3 primitives), `packages/core/src/runtime/runtime-mode.ts` (resolver)

**Out of scope:** Studio-startup auto-prune wiring (Epic 13), schema-versioning forward-compat (10.7), agent-service (Epic 11).

### Testing Requirements

- **Core** (`node:test` + `node:assert/strict`, FLAT, `mkdtemp` + `rm`): seed shards via `appendAuditEntry` across multiple UTC dates using a pinned `now`. Assert: shards older than the cutoff are deleted while in-window shards survive; a system `structural`/`system`/`workspace` entry with the summary is appended and itself survives (in `now`'s shard); under-retention → empty `prunedDates` + no new entry + shard count unchanged; custom `retentionDays`; boundary shard kept; invalid `retentionDays` → `ValidationError`.
- **CLI**: parser tests in `command-args.test.ts` (targetDir, `--retention-days`, bad value rejected); a command test that `initializeProject({ repoRoot, languages:['en'], defaultLanguage:'en' })`, writes an old shard (e.g. 400 days back) + a recent shard into `<repoRoot>/.anydocs/audit`, runs `runAuditPruneCommand({ targetDir: repoRoot })`, and asserts exit 0, the old shard removed, the recent shard intact, a summary entry present. Clean up the temp dir.

### References

- Architecture: [Source: artifacts/bmad/planning-artifacts/architecture.md#Audit Log Architecture] (daily shards simplify retention; `<projectRoot>/.anydocs/audit/`)
- Architecture: [Source: artifacts/bmad/planning-artifacts/architecture.md#Retention] / NFR30 (≥30-day window)
- Epics: [Source: artifacts/bmad/planning-artifacts/epics.md#Epic 10 → Story 10.6]
- Predecessors: [Source: artifacts/bmad/implementation-artifacts/10-2-implement-daily-ndjson-audit-repository.md] (repo reads + `auditRoot`), [Source: artifacts/bmad/implementation-artifacts/10-3-implement-write-ahead-lifecycle.md] (`overwriteAuditShard`)
- CLI conventions: [Source: packages/cli/src/commands/project-command.ts], [Source: packages/cli/src/index.ts]
- Runtime resolver: [Source: packages/core/src/runtime/runtime-mode.ts] (`resolveRuntimeMode`/`isRuntimeMode`)
- Gate: [Source: CLAUDE.md#Pre-GitHub Submission Gate] (touches CLI → `pnpm test`)

## Dev Agent Record

### Agent Model Used

Claude Opus 4.8 (`claude-opus-4-8`)

### Debug Log References

- None. Core test FLAT at `packages/core/tests/audit-prune.test.ts` per the Story 8.1 glob constraint.

### Completion Notes List

- **Core:** `pruneAuditShards(auditRoot, options)` in `audit-repository.ts` — computes a UTC cutoff (`now − retentionDays`, default 30), deletes shards with `dateKey < cutoffKey` via `overwriteAuditShard(..., [])` (10.3 empty-removal primitive), and on ≥1 prune appends one validated system `structural`/`system`/`workspace` summary entry (lands in `now`'s shard → never self-pruned). Boundary shard (exactly `retentionDays` old) is kept (≥N retention). Under-retention → no-op (no delete, no entry). Invalid `retentionDays` → `ValidationError`. `AUDIT_RETENTION_DAYS = 30` + `PruneAuditOptions`/`PruneAuditResult` exported.
- **`target.resourceKind: 'project-config'`** — the schema enum has no audit-log kind, so the project-level prune records the least-wrong `project-config` (documented; a dedicated kind would be a 10.7 schema change).
- **CLI:** `anydocs audit prune [targetDir] [--retention-days <n>] [--json]` (`audit-command.ts` + `parseAuditPruneCommandArgs` + `index.ts` `audit`/`prune` dispatch + help). Thin adapter: `loadProjectContract` → `pruneAuditShards(paths.auditRoot, …)` → human/JSON report; exit 0 (incl. no-op), 1 on contract failure. Runtime mode for the entry resolved via `resolveRuntimeMode` (env `ANYDOCS_RUNTIME_MODE` honored, else inject `'web'`) — no inline literal comparison (Story 8.2 guard).
- **Studio-startup auto-prune** is intentionally out of scope — `pruneAuditShards` is the reusable primitive the Studio call site (Epic 13) will also use. No new dependencies.

### Validation Evidence

- `pnpm --filter @anydocs/core test` → **260 pass / 0 fail** (10.6 adds 6 prune cases). `pnpm --filter @anydocs/cli test` → **41 pass / 0 fail / 2 skipped** (10.6 adds 2 parser + 3 command cases; the 2 skips are the pre-existing packaging-smoke skips). Core rebuilt (`pnpm --filter @anydocs/core build`) so the CLI's `@anydocs/core` dist resolves `pruneAuditShards`.
- Root `pnpm typecheck` → exit 0. Root `pnpm test`: core **260** + editor **162** + cli **41 pass + 2 skip** + mcp **44** + web **77** = **584 pass / 0 fail / 2 skipped**.

### File List

**New files**

- `packages/core/tests/audit-prune.test.ts`
- `packages/cli/src/commands/audit-command.ts`
- `packages/cli/tests/audit-command.test.ts`

**Modified files**

- `packages/core/src/fs/audit-repository.ts` — `pruneAuditShards` + `AUDIT_RETENTION_DAYS` + `PruneAuditOptions`/`PruneAuditResult` (+ `ValidationError`/`RuntimeMode`/`AUDIT_SCHEMA_VERSION` imports)
- `packages/cli/src/index.ts` — `audit` dispatch + `runAuditCommand` + `resolveHelpTarget`/`failUnknownSubcommand` widened
- `packages/cli/src/commands/command-args.ts` — `parseAuditPruneCommandArgs` + `AuditPruneCommandArgs`
- `packages/cli/src/help.ts` — `audit prune` help + general-help line
- `packages/cli/tests/command-args.test.ts` — parser cases
- `artifacts/bmad/implementation-artifacts/10-6-...md` — status ready-for-dev → review → done; tasks ticked; Dev Agent Record + Senior Developer Review populated
- `artifacts/bmad/implementation-artifacts/sprint-status.yaml` — `10-6-...` backlog → ready-for-dev → review → done

## Senior Developer Review (AI)

**Date:** 2026-06-12 · **Outcome:** Approve (review → done)

**Verification:** File List matches git (core `audit-repository.ts` + cli `audit-command.ts`/`command-args.ts`/`help.ts`/`index.ts` + 2 new test files). All 8 ACs verified IMPLEMENTED against code + the 6 core + 5 CLI tests. Boundary correctness checked: `cutoff = now − retentionDays` with `dateKey < cutoffKey` keeps the exactly-N-days-old shard (≥N retention) — confirmed by the boundary test (30-days-old shard kept). System summary entry is `structural`/`system`/`workspace`, appended via validated `appendAuditEntry`, lands in `now`'s shard (never self-pruned). Under-retention is a true no-op. No CRITICAL / HIGH / MEDIUM.

**Findings (all LOW — documented design; no code change):**

- **L1 (`resourceKind` semantics):** the prune records `target.resourceKind: 'project-config'` because the closed schema enum has no audit-log kind. Documented as least-wrong; a dedicated kind would be a 10.7 schema change deliberately not taken.
- **L2 (non-atomic prune):** shards are deleted then the summary is appended — a crash between loses only the informational summary, not correctness (re-running prune is safe; deletions are the intended outcome). Delete-first is the honest order (summary only written if deletes succeeded).
- **L3 (theoretical id collision):** the default summary id is `system-prune-<now ISO>` — two prunes in the same millisecond would collide. Negligible for a manual/startup op; id uniqueness is the producer's contract (per 10.2). Overridable via `options.entryId`.
- **L4 (env fallback):** an invalid `ANYDOCS_RUNTIME_MODE` silently falls back to `'web'` (via `isRuntimeMode` guard) rather than erroring — harmless for a local prune, and avoids an unrelated command failing on a global env typo.

**Gate at review:** core **266** + editor 162 + cli **41 pass + 2 skip** + mcp 44 + web 77 = **590 pass / 0 fail / 2 skipped**; root `pnpm typecheck` exit 0. (No 10.6 code changed during review; count reflects the post-10.7-review tree.)
