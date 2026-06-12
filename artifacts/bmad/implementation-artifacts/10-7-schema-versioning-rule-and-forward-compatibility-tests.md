# Story 10.7: Schema Versioning Rule and Forward-Compatibility Tests (NFR30)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer agent,
I want explicit rules and tests for audit schema evolution,
so that additive changes remain forward-compatible while breaking changes are caught.

## Acceptance Criteria

1. The schema-versioning rule is operationalized in code as a frozen, append-only `AUDIT_SCHEMA_CHANGE_HISTORY` exported from `audit-entry-schema.ts`: an ordered list of `{ version, date, summary }` records seeded with the v1 genesis entry (Story 10.1). The rule (additive optional field → no bump, recorded in history; backward-incompatible change → `schemaVersion` bump + migration) is documented at the change-history declaration, cross-referencing architecture.md §"Schema Versioning Rule".
2. **Given an additive (optional) field change**, existing v1 entries remain valid: a canonical **required-fields-only** entry validates against the current schema. This is the guard that catches a breaking change disguised as additive — adding a *required* field (or making an optional one required) breaks the minimal-entry test, forcing a `schemaVersion` bump.
3. **Given a backward-incompatible change attempt**, a machine-enforced guard test fails until the change is made deliberate: the test pins the exact v1 contract (`AUDIT_ENTRY_JSON_SCHEMA_V1.required` set + `schemaVersion` const + the top-level allowed-key set) to frozen expected values and `deepEqual`s the live schema against them. Changing the required set / version / allowed keys fails the test until the developer updates the pinned expectation **and** appends an `AUDIT_SCHEMA_CHANGE_HISTORY` record (and, for a breaking change, bumps the version + documents a migration).
4. An entry whose `schemaVersion` is not the current version (e.g. `2`) is **explicitly rejected** by the v1 validator (`assertValidAuditEntry`) — proving the "migrated or marked unreadable explicitly" half: a future-version entry is never silently accepted under v1.
5. The validator and the JSON Schema are proven in-sync by a guard test: the JSON Schema's `properties` keys equal the validator's allowed top-level keys (`AUDIT_ENTRY_ALLOWED_KEYS`, newly exported), and `AUDIT_ENTRY_JSON_SCHEMA_V1.required` ⊆ those keys. This makes the existing "validator and JSON Schema MUST stay in sync" comment machine-enforced, so an additive change to one without the other is caught.
6. `AUDIT_SCHEMA_CHANGE_HISTORY` consistency is tested: versions are non-decreasing, the genesis `version: 1` record is present, and the latest record's `version` equals `AUDIT_SCHEMA_VERSION` — so the documented history can never drift behind the code's actual version.
7. `AUDIT_ENTRY_ALLOWED_KEYS` (frozen) + `AUDIT_SCHEMA_CHANGE_HISTORY` (frozen) are exported through the existing `schemas/index.ts` → root barrel. The private `ALLOWED_KEYS` Set is derived from `AUDIT_ENTRY_ALLOWED_KEYS` (single source of truth — no duplicated key list). **No new dependencies; no behavior change to the validator.**
8. Unit tests (FLAT `packages/core/tests/audit-schema-versioning.test.ts`) cover AC2–AC6: minimal required-only entry validates; required-set + version + allowed-keys snapshot guard; `schemaVersion: 2` rejected; validator↔JSON-Schema key parity; change-history monotonicity + latest-equals-current + genesis present. `pnpm typecheck` + `pnpm test` (core + root) pass.

## Tasks / Subtasks

- [x] Refactor allowed-keys to a single exported source (AC: 5, 7)
  - [x] In `audit-entry-schema.ts`, declared `export const AUDIT_ENTRY_ALLOWED_KEYS = Object.freeze([...] as const)` (14 top-level keys); derived `const ALLOWED_KEYS = new Set<string>(AUDIT_ENTRY_ALLOWED_KEYS)` from it. No validator behavior change.
- [x] Add the schema change-history record (AC: 1, 6)
  - [x] `export const AUDIT_SCHEMA_CHANGE_HISTORY` (frozen) seeded with the v1 genesis record + `AuditSchemaChangeRecord` type, doc comment stating the additive-vs-breaking rule + architecture.md cross-reference.
- [x] Add the forward-compatibility + guard tests (AC: 2, 3, 4, 5, 6, 8)
  - [x] `packages/core/tests/audit-schema-versioning.test.ts` (FLAT): minimal-entry validates; pinned required-set/version/allowed-keys `deepEqual` guard; `schemaVersion: 2`/`0` → throws; properties-keys parity with `AUDIT_ENTRY_ALLOWED_KEYS` + `required ⊆ keys`; history monotonic + latest === `AUDIT_SCHEMA_VERSION` + genesis present + records well-formed.
- [x] Validate (AC: 8): `pnpm --filter @anydocs/core typecheck` + `test`, then root `pnpm typecheck` + `pnpm test` green.
- [x] Update `sprint-status.yaml` `10-7-...` → `review`. (Last Epic 10 story — epic ready for `done` once 10.7 review clears.)

## Dev Notes

- **Depends on Story 10.1** (`audit-entry-schema.ts`: `assertValidAuditEntry`, `AUDIT_ENTRY_JSON_SCHEMA_V1`, `AUDIT_SCHEMA_VERSION`, the private `ALLOWED_KEYS`). 10.7 is the **governance/test** story for the schema — it adds two exported constants + a guard test suite, and does **not** change validation behavior. Closes Epic 10.
- **Rule (already in architecture.md §"Schema Versioning Rule"):** additive optional fields → no `schemaVersion` bump, recorded in change history; any backward-incompatible change (new required field, removed/renamed field, narrowed enum, changed type) → `schemaVersion` bump + migration plan in the architecture addendum. 10.7 makes this enforceable rather than merely documented.
- **Why the snapshot guard works.** The closed shape (`additionalProperties: false`) + `schemaVersion` const means the v1 contract is exactly: (allowed-key set, required set, version). Pinning those three in a test turns *any* schema edit into a deliberate, reviewed act: the developer must update the pinned expectation, which is the moment to decide "additive (add history record)" vs "breaking (bump version + migration)". This mirrors the editor contract-diff check (Story 6.5) at the audit-schema layer.
- **Forward-compat = minimal entry stays valid.** Backward compatibility toward old data means a new optional field must not invalidate entries written before it existed. The required-only entry test encodes that: optional additions keep it green; a new *required* field turns it red. (The closed shape means truly-unknown fields ARE rejected — additive evolution updates the schema's allowed keys as *optional*, it does not rely on silent tolerance. Document this so "forward-compatible" isn't misread as "accepts arbitrary unknown fields".)
- **"Marked unreadable explicitly"** (epic AC) = the v1 validator hard-rejects `schemaVersion !== 1` (already implemented in 10.1, line ~147). 10.7 adds the regression test pinning that guarantee.
- **Single source of truth.** Exporting `AUDIT_ENTRY_ALLOWED_KEYS` and deriving `ALLOWED_KEYS` from it removes the risk of the validator's key list and the test's expectation diverging.
- **Scope:** schema governance + tests only. No migration engine is built (there is only v1 — a migration is authored when v2 first lands). No validator behavior change. NOT agent-service (Epic 11). Core-only — no CLI/web rebuild needed.
- Core test FLAT under `tests/` (Story 8.1 glob constraint).

### Architecture Compliance

- Implements architecture.md §"Schema Versioning Rule" and the epic's forward-compatibility ACs. Operationalizes the rule via `AUDIT_SCHEMA_CHANGE_HISTORY` + guard tests rather than leaving it as prose.
- Satisfies NFR30/NFR-schema-evolution intent (additive evolution is safe + breaking changes are caught at test time). Closes Epic 10 (audit subsystem): 10.1 schema → 10.2 repo → 10.3 lifecycle → 10.4 query → 10.5 rollback → 10.6 retention → 10.7 versioning governance.
- Zero-Zod: hand-rolled validator unchanged; frozen constants; no schema library.

### File Structure Requirements

**To create:**
- `packages/core/tests/audit-schema-versioning.test.ts` (FLAT)

**To modify:**
- `packages/core/src/schemas/audit-entry-schema.ts` — export `AUDIT_ENTRY_ALLOWED_KEYS` (derive `ALLOWED_KEYS` from it) + `AUDIT_SCHEMA_CHANGE_HISTORY`
- `artifacts/bmad/implementation-artifacts/sprint-status.yaml` — status transitions

**Reference-only:**
- `packages/core/src/types/audit.ts` (`AUDIT_SCHEMA_VERSION`, enums)
- `packages/editor/contract/*` + Story 6.5 (the contract-snapshot-guard pattern this mirrors)

**Out of scope:** a v1→v2 migration engine (authored when v2 first lands), validator behavior changes, agent-service (Epic 11).

### Testing Requirements

- `node:test` + `node:assert/strict`, FLAT `packages/core/tests/audit-schema-versioning.test.ts`.
- Build the canonical minimal entry from required fields only (`schemaVersion, id, timestamp, scope, operation, status, projectId, target:{resourceKind}, actor:{kind}, runtimeMode`) and assert `validateAuditEntry` accepts it.
- Pin `EXPECTED_REQUIRED = [...]`, `EXPECTED_VERSION = 1`, `EXPECTED_ALLOWED_KEYS = [...]`; `assert.deepEqual` against the live schema/exports (sort key arrays for order-independence).
- `assert.throws(() => assertValidAuditEntry({ ...minimal, schemaVersion: 2 }))`.
- `assert.deepEqual(Object.keys(AUDIT_ENTRY_JSON_SCHEMA_V1.properties).sort(), [...AUDIT_ENTRY_ALLOWED_KEYS].sort())` and every `required` entry ∈ properties.
- History: versions non-decreasing; `AUDIT_SCHEMA_CHANGE_HISTORY.at(-1).version === AUDIT_SCHEMA_VERSION`; a `version === 1` record exists.

### References

- Architecture: [Source: artifacts/bmad/planning-artifacts/architecture.md#Schema Versioning Rule] (additive vs breaking; migration plan in addendum)
- Architecture: [Source: artifacts/bmad/planning-artifacts/architecture.md#Audit Entry JSON Schema (v1)] (the v1 shape being governed)
- Epics: [Source: artifacts/bmad/planning-artifacts/epics.md#Epic 10 → Story 10.7]
- Predecessor: [Source: artifacts/bmad/implementation-artifacts/10-1-define-versioned-audit-entry-json-schema-in-anydocs-core.md] (validator + frozen JSON Schema + `schemaVersion` const)
- Pattern: [Source: artifacts/bmad/implementation-artifacts/6-5-add-ci-contract-diff-check-for-anydocs-editor.md] (snapshot-guard-on-a-frozen-contract approach)
- Gate: [Source: CLAUDE.md#Pre-GitHub Submission Gate] (core-only → `pnpm test`)

## Dev Agent Record

### Agent Model Used

Claude Opus 4.8 (`claude-opus-4-8`)

### Debug Log References

- None. Test FLAT at `packages/core/tests/audit-schema-versioning.test.ts` per the Story 8.1 glob constraint.

### Completion Notes List

- **Governance/test story — no validator behavior change.** Exported two frozen constants from `audit-entry-schema.ts` and added a guard test suite; closes Epic 10.
- `AUDIT_ENTRY_ALLOWED_KEYS` (frozen, 14 keys) is now the single source of truth — the private `ALLOWED_KEYS` Set is derived from it, removing the validator/test divergence risk.
- `AUDIT_SCHEMA_CHANGE_HISTORY` (frozen, `AuditSchemaChangeRecord[]`) seeded with the v1 genesis record + a doc comment operationalizing architecture.md §"Schema Versioning Rule" (additive optional → same version + history record; breaking → bump `schemaVersion` + migration).
- **Guard tests** turn any v1-contract edit into a deliberate act: required-only entry must validate (a new *required* field breaks it → signals breaking change); pinned required-set + version + allowed-keys snapshot; `schemaVersion: 2`/`0` explicitly rejected ("marked unreadable explicitly"); validator↔JSON-Schema key parity (`properties` keys === allowed keys, `required ⊆ keys`); change-history monotonic + latest === `AUDIT_SCHEMA_VERSION` + genesis present. Mirrors the Story 6.5 editor contract-diff approach at the audit-schema layer.
- No migration engine built (only v1 exists; a v1→v2 migration is authored when v2 first lands). No new dependencies. Core-only.

### Validation Evidence

- `pnpm --filter @anydocs/core typecheck` → exit 0
- `pnpm --filter @anydocs/core test` → **266 pass / 0 fail / 0 skipped** (10.7 adds 6: forward-compat minimal entry; v1 contract guard; non-current schemaVersion rejected; validator↔JSON-Schema key sync; **enum-domain parity (review M1)**; change-history consistency).
- Root `pnpm typecheck` → exit 0. Root `pnpm test`: core **266** + editor **162** + cli **41 pass + 2 skip** + mcp **44** + web **77** = **590 pass / 0 fail / 2 skipped**. Core-only change.

### File List

**New files**

- `packages/core/tests/audit-schema-versioning.test.ts`

**Modified files**

- `packages/core/src/schemas/audit-entry-schema.ts` — exported `AUDIT_ENTRY_ALLOWED_KEYS` (derives `ALLOWED_KEYS`) + `AUDIT_SCHEMA_CHANGE_HISTORY` + `AuditSchemaChangeRecord` type
- `artifacts/bmad/implementation-artifacts/10-7-...md` — status ready-for-dev → review → done; tasks ticked; Dev Agent Record + Senior Developer Review populated
- `artifacts/bmad/implementation-artifacts/sprint-status.yaml` — `10-7-...` backlog → ready-for-dev → review → done

## Senior Developer Review (AI)

**Date:** 2026-06-12 · **Outcome:** Approve after fix (review → done) — **closes Epic 10**

**Verification:** File List matches git (`audit-entry-schema.ts` modified + `audit-schema-versioning.test.ts` new; other working-tree changes belong to 10.4/10.5/10.6). All 8 ACs verified IMPLEMENTED: `AUDIT_SCHEMA_CHANGE_HISTORY` + `AUDIT_ENTRY_ALLOWED_KEYS` exported (single source of truth, `ALLOWED_KEYS` derived); required-only entry validates; pinned required/version/allowed-keys snapshot; `schemaVersion` 2/0 rejected; validator↔JSON-Schema key parity; history monotonic + latest === current. Validator behavior unchanged. No CRITICAL/HIGH.

**Findings:**

- **M1 (MEDIUM, guard completeness) — FIXED IN-LINE:** the contract guard pinned the required set, version, and allowed-key set, but NOT the enum domains. Removing a value from the `scope`/`operation`/`status`/`actor.kind`/`target.resourceKind` enum is a backward-incompatible change that would slip past every 10.7 guard — undercutting the epic's "breaking changes are caught" guarantee. Added an enum-parity test tying each `AUDIT_ENTRY_JSON_SCHEMA_V1` enum to its canonical `AUDIT_*` array (single source), so narrowing/expansion now forces a deliberate, reviewed edit. core 265 → **266**.
- **L1 (LOW):** the snapshot's `EXPECTED_*` lists are hand-maintained — an additive key change requires updating them AND appending a history record, but the "history record was added" step can't be mechanically tied to the key change (only the human checkpoint + latest-version assertion enforce it). Acceptable by design; logged.
- **L2 (LOW):** no v1→v2 migration engine exists — intentional (only v1 ships; a migration is authored when v2 first lands, per the documented rule). No change.

**Post-fix gate:** core **266** (+1 regression test) + editor 162 + cli 41 (+2 skip) + mcp 44 + web 77 = **590 pass / 0 fail / 2 skipped**; root `pnpm typecheck` exit 0.
