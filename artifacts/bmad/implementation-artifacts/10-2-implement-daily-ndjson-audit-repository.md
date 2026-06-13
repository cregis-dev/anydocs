# Story 10.2: Implement Daily NDJSON Audit Repository

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer agent,
I want a repository that persists audit entries as daily NDJSON shards under `<projectRoot>/.anydocs/audit/`,
so that retention and query operations are file-system simple.

## Acceptance Criteria

1. A new module `packages/core/src/fs/audit-repository.ts` exposes an append function that, given a validated `AuditEntry`, appends it to `<projectRoot>/.anydocs/audit/YYYY-MM-DD.ndjson` where the shard date is derived (UTC) from the entry's `timestamp`.
2. The append is one complete newline-terminated JSON line written via a single append call (no partial line under normal single-writer operation); each entry occupies exactly one line.
3. On a missing audit directory (first write), the directory is created recursively with default permissions and the write succeeds without manual setup.
4. The entry is validated with Story 10.1's `assertValidAuditEntry` **before** any filesystem write — an invalid entry is rejected and nothing is persisted.
5. `ProjectPathContract` gains a canonical `auditRoot` (`<projectRoot>/.anydocs/audit`) populated by `createProjectPathContract`, so audit consumers resolve the path from the contract rather than re-deriving it. (Additive field; the only constructor is updated.)
6. Read primitives exist to support tests and the future query API (Story 10.4): read a single day's shard into `AuditEntry[]` (missing shard → `[]`, not an error) and list available shard dates (`YYYY-MM-DD`, sorted). These are foundational reads only — the filtered query API is Story 10.4.
7. Entries with different `timestamp` days route to different shard files; multiple entries on the same day append to the same shard in order.
8. The module is exported through `packages/core/src/fs/index.ts` (already wired into the root barrel). No new dependencies.
9. Unit tests under `packages/core/tests/` (FLAT file per the Story 8.1 test-glob constraint) cover: append creates the dir + shard, line is valid round-trippable JSON, same-day appends accumulate in order, cross-day entries split shards, missing-shard read returns `[]`, shard-date listing is sorted, and invalid-entry append rejects before writing. Tests use a temp directory and clean up.
10. `pnpm --filter @anydocs/core typecheck` + `test` and root `pnpm typecheck` + `pnpm test` pass.

## Tasks / Subtasks

- [x] Extend the path contract (AC: 5)
  - [x] Add `auditRoot: string` to `ProjectPathContract` in `packages/core/src/types/project.ts`.
  - [x] Populate it in `createProjectPathContract` (`packages/core/src/fs/project-paths.ts`) as `path.join(projectRoot, '.anydocs', 'audit')`.
- [x] Implement the repository (AC: 1, 2, 3, 4, 6, 7)
  - [x] Create `packages/core/src/fs/audit-repository.ts` importing `node:fs/promises`, `node:path`, `assertValidAuditEntry` (10.1), and the `AuditEntry` type.
  - [x] `auditShardFileName(date: Date): string` → `YYYY-MM-DD.ndjson` from UTC components (`getUTCFullYear`/`getUTCMonth`+1/`getUTCDate`, zero-padded).
  - [x] `auditShardPath(auditRoot: string, date: Date): string`.
  - [x] `appendAuditEntry(auditRoot: string, entry: AuditEntry): Promise<void>` — validate first (`assertValidAuditEntry`), derive the shard from `new Date(entry.timestamp)`, `fs.mkdir(auditRoot, { recursive: true })`, then `fs.appendFile(shard, JSON.stringify(entry) + '\n', 'utf8')`.
  - [x] `readAuditShard(auditRoot: string, date: Date): Promise<AuditEntry[]>` — read the day's file, split on newline, drop blanks, `JSON.parse` each; ENOENT → `[]`.
  - [x] `listAuditShardDates(auditRoot: string): Promise<string[]>` — `readdir`, keep files matching `^\d{4}-\d{2}-\d{2}\.ndjson$`, strip extension, sort ascending; ENOENT → `[]`.
- [x] Wire the barrel (AC: 8)
  - [x] `export * from './audit-repository.ts';` in `packages/core/src/fs/index.ts`.
- [x] Add unit tests (AC: 9)
  - [x] `packages/core/tests/audit-repository.test.ts` (FLAT, `node:test` + `node:assert/strict`): use `node:os` `tmpdir` + `fs.mkdtemp` for an isolated audit root; `afterEach` removes it (`fs.rm(dir, { recursive: true, force: true })`).
  - [x] Cover AC9 cases. Build valid `AuditEntry` fixtures (reuse the 10.1 shape); for cross-day routing use two entries with timestamps on different UTC dates and assert two shard files + correct `listAuditShardDates` ordering.
- [x] Validate (AC: 10)
  - [x] `pnpm --filter @anydocs/core typecheck` + `test` pass; root `pnpm typecheck` + `pnpm test` stay green.

## Dev Notes

- **Depends on Story 10.1** (`AuditEntry` type + `assertValidAuditEntry`). Validate-before-persist is the contract: 10.2 must never write an entry that 10.1 would reject (AC4). The write-ahead lifecycle (`pending → committed | rejected`) is **Story 10.3** — 10.2 is just durable append + read primitives.
- **Append model.** NDJSON daily shards. One `fs.appendFile` call writes one complete `JSON.stringify(entry) + '\n'` line. Phase 2 is single-writer (single-user, single process), so O_APPEND positioning + a single write of a complete line satisfies "no partial line" in practice. Full fault-injection hardening (mid-write failure leaves prior content intact) is exercised by Story 9.4 (desktop atomicity) / later audit fault tests — do not over-engineer here, but DO keep the write to a single `appendFile` of a complete line (never build a line incrementally across calls).
- **Shard date = entry timestamp (UTC).** Derive the shard from `entry.timestamp`, not wall-clock — this keeps replays/backfills deterministic and matches architecture ("appended to `YYYY-MM-DD.ndjson` matching the entry's timestamp"). Use UTC components so the same instant maps to the same shard regardless of host timezone.
- **`auditRoot` on the path contract** is the canonical resolution point for Stories 10.3–10.6 (lifecycle, query, rollback, prune). Put it in the contract now so later stories don't re-derive `.anydocs/audit`.
- **Read primitives are foundational, not the query API.** `readAuditShard` + `listAuditShardDates` exist so 10.2 is testable and 10.4 has a base to build the filtered/paginated `query(filter)` on. Do NOT add filtering/pagination here.
- **Normal code may use `new Date()` / `Date.parse`** — the no-`Date.now()` rule applies only to Workflow scripts, not core library code.
- Test file FLAT under `tests/` (no subdir) per Story 8.1's unquoted-glob finding.

### Project Structure Notes

- Lives in `packages/core/src/fs/` beside `docs-repository.ts` / `content-repository.ts` / `api-source-repository.ts`, following the same `node:fs/promises` + functional-module style (these repos are function collections, not classes). Mirror their `mkdir(..., { recursive: true })` directory-ensure pattern; the difference is **append** (not write-temp-then-rename, which is for full-file replacement).
- `auditRoot` is a sibling of `importsRoot` / `apiSourcesRoot` on `ProjectPathContract`.
- The `.anydocs/` directory is project-local and intentionally outside `dist/` and `node_modules/` (architecture §"Audit Log Architecture → Storage").

### Architecture Compliance

- Per architecture.md §"Audit Log Architecture → Storage": location `<projectRoot>/.anydocs/audit/`, append-only NDJSON sharded by day `YYYY-MM-DD.ndjson`; daily shards simplify retention (NFR30 ≥ 30 days, Story 10.6) and make query scans cheap (Story 10.4).
- Per architecture.md §"Write-Ahead Audit Integration": the audit service (Story 10.3) calls `persistPending` / `markCommitted` / `markRejected` — those lifecycle transitions are NOT in 10.2; 10.2 provides the durable append the service builds on.
- Naming: kebab-case filename (`audit-repository.ts`); camelCase functions (`appendAuditEntry`, `readAuditShard`, `listAuditShardDates`).

### Library / Framework Requirements

- `node:fs/promises`, `node:path` only. No new dependencies. No ULID lib (id generation is the producer's concern; 10.2 persists whatever validated entry it is given).
- Reuse Story 10.1's `assertValidAuditEntry` + `AuditEntry`. Do not duplicate validation.

### File Structure Requirements

**To create:**

```
packages/core/src/fs/audit-repository.ts
packages/core/tests/audit-repository.test.ts        ← FLAT (no tests/ subdir)
```

**To modify:**

- `packages/core/src/types/project.ts` — add `auditRoot` to `ProjectPathContract`
- `packages/core/src/fs/project-paths.ts` — populate `auditRoot`
- `packages/core/src/fs/index.ts` — export the repository
- `artifacts/bmad/implementation-artifacts/sprint-status.yaml` — status transitions

**Reference-only:**

- `packages/core/src/fs/api-source-repository.ts` / `docs-repository.ts` — mkdir + write conventions
- `packages/core/src/schemas/audit-entry-schema.ts` + `types/audit.ts` — Story 10.1 dependency

**Out of scope:**

- Write-ahead lifecycle (`pending → committed | rejected`) — Story 10.3
- Query API (filters, pagination, reverse-chronological) — Story 10.4
- Rollback — Story 10.5; Retention prune + CLI — Story 10.6; Schema-version forward-compat — Story 10.7
- Any agent-service wiring — Epic 11

### Testing Requirements

- `node:test` + `node:assert/strict`, FLAT file `packages/core/tests/audit-repository.test.ts`, picked up by the core test glob + root `pnpm test`.
- Isolate filesystem state: `fs.mkdtemp(path.join(os.tmpdir(), 'anydocs-audit-'))` per test (or in `beforeEach`), removed in `afterEach` with `fs.rm(dir, { recursive: true, force: true })`.
- Assert: dir+shard created on first append; the persisted line `JSON.parse`s back to the original entry; same-day order preserved; cross-day entries produce two shards; `readAuditShard` on a missing day → `[]`; `listAuditShardDates` sorted ascending; invalid entry (e.g. bad enum) throws before any file is created.
- No integration with the agent service (doesn't exist yet).

### References

- Architecture: [Source: artifacts/bmad/planning-artifacts/architecture.md#Audit Log Architecture] (Storage location, daily NDJSON shards, retention/query rationale)
- Architecture: [Source: artifacts/bmad/planning-artifacts/architecture.md#Write-Ahead Audit Integration] (lifecycle owned by Story 10.3, not 10.2)
- Epics: [Source: artifacts/bmad/planning-artifacts/epics.md#Epic 10 → Story 10.2] (BDD acceptance criteria)
- Predecessor: [Source: artifacts/bmad/implementation-artifacts/10-1-define-versioned-audit-entry-json-schema-in-anydocs-core.md] (`AuditEntry` + `assertValidAuditEntry`)
- Repo fs conventions: [Source: packages/core/src/fs/api-source-repository.ts] (mkdir-recursive + atomic file write patterns)
- Test-glob constraint: [Source: artifacts/bmad/implementation-artifacts/8-1-implement-runtime-mode-resolver-in-anydocs-core.md#Review Follow-ups] (keep core test files flat)

## Dev Agent Record

### Agent Model Used

Claude Opus 4.8 (`claude-opus-4-8`)

### Debug Log References

- None. Test file FLAT at `packages/core/tests/audit-repository.test.ts` per the Story 8.1 unquoted-glob constraint.

### Completion Notes List

- `packages/core/src/fs/audit-repository.ts`: `appendAuditEntry` validates via 10.1's `assertValidAuditEntry` **before** any fs mutation, derives the shard from `new Date(entry.timestamp)` (UTC), `mkdir -p` the audit root, then writes one complete `JSON.stringify(entry) + '\n'` line via a single `fs.appendFile`. Read primitives `readAuditShard` (ENOENT → `[]`) and `listAuditShardDates` (regex-filtered, sorted; ENOENT → `[]`) added as the foundation for Story 10.4's query API. `auditShardFileName`/`auditShardPath` exported for reuse by 10.3/10.6.
- **Path contract:** added `auditRoot` (`<projectRoot>/.anydocs/audit`) to `ProjectPathContract` and populated it in `createProjectPathContract` — the single canonical resolution point for Stories 10.3–10.6. Additive field; `createProjectPathContract` is the only constructor, so no other consumer needed changes (root typecheck confirms no manually-built contract literals broke).
- Append-only NDJSON, single-writer model (Phase 2 single-user): one `appendFile` of a complete line satisfies the "no partial line" contract in practice; mid-write fault-injection hardening is deferred to Story 9.4 / later audit fault tests per scope. Lifecycle (`pending → committed | rejected`) is Story 10.3; filtered/paginated query is Story 10.4 — neither implemented here.
- No new dependencies; reuses 10.1 (`AuditEntry` + validator) and the existing `node:fs/promises` repo style.

### Validation Evidence

- `pnpm --filter @anydocs/core typecheck` → exit 0
- `pnpm --filter @anydocs/core test` → **225 pass / 0 fail / 0 skipped** (10.2 adds 7 audit-repository cases: shard-name UTC derivation, append-creates-dir+round-trip, same-day order, cross-day split + sorted listing, missing-shard → [], missing-dir → [], invalid-entry-rejected-before-write). Tests isolate fs state via `mkdtemp` + `rm`.
- Root `pnpm typecheck` → exit 0; root `pnpm test` regression gate green (core 225 + editor 162 + cli 36+2 skip + mcp 44 + web 77)

### File List

**New files**

- `packages/core/src/fs/audit-repository.ts`
- `packages/core/tests/audit-repository.test.ts`

**Modified files**

- `packages/core/src/types/project.ts` — added `auditRoot` to `ProjectPathContract`
- `packages/core/src/fs/project-paths.ts` — populate `auditRoot`
- `packages/core/src/fs/index.ts` — export the audit repository
- `artifacts/bmad/implementation-artifacts/10-2-...md` — status ready-for-dev → review → done; tasks ticked; Dev Agent Record + Senior Developer Review populated
- `artifacts/bmad/implementation-artifacts/sprint-status.yaml` — `10-2-...` backlog → ready-for-dev → review → done

## Senior Developer Review (AI)

**Date:** 2026-06-12 · **Outcome:** Approve (review → done)

**Verification:** File List matches the committed change (commit `36979d5`). All 10 ACs verified IMPLEMENTED against code + the 7 `audit-repository.test.ts` cases: validate-before-write ordering (AC4 — `assertValidAuditEntry` precedes `mkdir`/`appendFile`), single-`appendFile`-of-complete-line (AC2), UTC shard derivation (AC1/AC7), `auditRoot` on `ProjectPathContract` + `createProjectPathContract` (AC5, confirmed wired), foundational reads with ENOENT → `[]` (AC6), barrel export (AC8). No CRITICAL / HIGH / MEDIUM findings.

**Findings (all LOW — logged, by-design; no code change):**

- **L1 (error context):** `readAuditShard` does a raw `JSON.parse` per line with no try/catch — a single corrupt line throws an opaque `SyntaxError` with no shard/line context. Acceptable for a trusted single-writer foundational read; a wrapped error naming the shard would aid debugging if read-side corruption ever matters (consider alongside Story 10.7).
- **L2 (no read-side validation):** `readAuditShard` returns rows typed `AuditEntry` without re-running `assertValidAuditEntry` — a hand-edited shard yields unchecked data. By design (foundational read; entries are validated on write). Flag for Story 10.7's forward-compat work, which may want opt-in read validation.
- **L3 (concurrency note):** the single-writer / O_APPEND atomicity assumption lives in the story Dev Notes but not in the module docstring; a one-line comment on `appendAuditEntry` ("single-writer; concurrent multi-process appends may interleave") would prevent future misuse. Out of Phase 2 scope.

**Gate at review:** core **246** + editor 162 + cli 36 (+2 skip) + mcp 44 + web 77 = **565 pass / 0 fail / 2 skipped**; root `pnpm typecheck` exit 0. (No 10.2 code changed during review; count reflects the post-10.4/10.3-review tree.)
