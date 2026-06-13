# Story 10.1: Define Versioned Audit Entry JSON Schema in `@anydocs/core`

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer agent,
I want a versioned audit entry schema in `@anydocs/core/src/schemas/audit-entry-schema.ts`,
so that every audit producer and consumer agrees on one shape before any audit-writing code exists.

## Acceptance Criteria

1. A new module `packages/core/src/schemas/audit-entry-schema.ts` (with its `AuditEntry` types in `packages/core/src/types/audit.ts`) defines the v1 audit entry shape exactly matching architecture.md §"Audit Entry JSON Schema (v1)".
2. The module exports **both**: (a) a runtime validator `assertValidAuditEntry(value: unknown): asserts value is AuditEntry` (and/or `validateAuditEntry(value): AuditEntry`) that throws on violation, and (b) a frozen JSON Schema constant `AUDIT_ENTRY_JSON_SCHEMA_V1` (draft-07) reproducing the architecture spec verbatim, including `$id: "anydocs://schemas/audit-entry/v1"` and `additionalProperties: false`.
3. Required fields are enforced: `schemaVersion` (const `1`), `id`, `timestamp`, `scope`, `operation`, `status`, `projectId`, `target`, `actor`, `runtimeMode`. Optional fields are accepted when present and valid: `diff`, `rejectionReason`, `rollbackOf`, `promptDigest`.
4. Enumerated fields validate against their domains: `scope ∈ {inline, page, workspace}`, `operation ∈ {create, update, delete, rollback, structural}`, `status ∈ {pending, committed, rejected}`, `runtimeMode ∈ {web, desktop}`, `actor.kind ∈ {agent, human, system}`, `target.resourceKind ∈ {block, page, navigation, project-config}`.
5. When an entry violates the schema, validation rejects it **before persistence** and the error identifies the offending field (via the existing `ValidationError` `details` — `entity`/`rule`/`metadata`), e.g. a missing `projectId` or an out-of-domain `operation` names the field.
6. Unknown / extra top-level properties are rejected (`additionalProperties: false` parity), and `schemaVersion` values other than `1` are rejected with a clear message pointing at the schema-versioning rule (Story 10.7 owns evolution).
7. The `runtimeMode` field reuses the `RuntimeMode` type from Story 8.1's `@anydocs/core/src/runtime/runtime-mode.ts`; the `scope` field type is shared/aligned with the Agent scope union (`inline | page | workspace`) so Epic 11 reuses the same type.
8. The module is exported through the existing `packages/core/src/schemas/index.ts` and `packages/core/src/types/index.ts` barrels (already wired into root `src/index.ts`); no new package subpath export is required.
9. Unit tests under `packages/core/tests/` cover: a fully-valid entry (all required + a sampling of optional fields) passes; each required field missing → rejected naming that field; each enum field with an out-of-domain value → rejected; an unknown top-level field → rejected; `schemaVersion: 2` → rejected; and structural checks on `AUDIT_ENTRY_JSON_SCHEMA_V1` (correct `$id`, `required` array, `additionalProperties: false`). Tests run under the Node built-in runner and are part of `pnpm test`.
10. `pnpm --filter @anydocs/core typecheck` + `test` and root `pnpm typecheck` + `pnpm test` pass; no audit-writing/repository/service code is added in this story.

## Tasks / Subtasks

- [x] Define the `AuditEntry` types (AC: 1, 3, 4, 7)
  - [x] Create `packages/core/src/types/audit.ts` declaring:
    - [x] `AuditScope = 'inline' | 'page' | 'workspace'` (shared with Epic 11 agent scopes — exported for reuse).
    - [x] `AuditOperation = 'create' | 'update' | 'delete' | 'rollback' | 'structural'`.
    - [x] `AuditStatus = 'pending' | 'committed' | 'rejected'`.
    - [x] `AuditActorKind = 'agent' | 'human' | 'system'`; `AuditActor = { kind: AuditActorKind; agentProvider?: string }`.
    - [x] `AuditResourceKind = 'block' | 'page' | 'navigation' | 'project-config'`; `AuditTarget = { resourceKind: AuditResourceKind; pageId?: string; blockId?: string; navigationId?: string }`.
    - [x] `AuditDiff = { before?: unknown; after?: unknown; summary?: string }`.
    - [x] `AuditEntry = { schemaVersion: 1; id: string; timestamp: string; scope: AuditScope; operation: AuditOperation; status: AuditStatus; projectId: string; target: AuditTarget; actor: AuditActor; runtimeMode: RuntimeMode; diff?: AuditDiff; rejectionReason?: string; rollbackOf?: string; promptDigest?: string }` — import `RuntimeMode` from `../runtime/runtime-mode.ts`.
  - [x] Add lightweight type guards (`isAuditScope`, `isAuditOperation`, etc.) following the `isPageStatus`/`isDocsLang` pattern in `src/types/docs.ts`.
- [x] Implement the validator (AC: 2, 3, 4, 5, 6)
  - [x] Create `packages/core/src/schemas/audit-entry-schema.ts` mirroring the hand-rolled style of `src/schemas/docs-schema.ts` (use `isRecord`, `assertNonEmptyString`-style helpers, and `ValidationError` from `../errors/validation-error.ts`). **Do not introduce Zod** — see the variance note in Dev Notes.
  - [x] `assertValidAuditEntry(value: unknown): asserts value is AuditEntry`:
    - [x] Reject non-objects.
    - [x] Reject unknown top-level keys (enforce the closed shape — `additionalProperties: false` parity).
    - [x] Assert `schemaVersion === 1` (else a versioning-specific message referencing Story 10.7).
    - [x] Assert each required field present + correct primitive/enum type, naming the field in the `ValidationError` `details.metadata` on failure.
    - [x] Validate nested `actor` and `target` objects (required sub-fields + enum domains).
    - [x] Validate optional fields only when present.
  - [x] Optionally also export `validateAuditEntry(value): AuditEntry` returning the narrowed value (thin wrapper over the assert).
- [x] Export the JSON Schema constant (AC: 2, 6)
  - [x] In the same module, export `export const AUDIT_ENTRY_JSON_SCHEMA_V1 = Object.freeze({ ... }) ` reproducing the draft-07 schema from architecture.md verbatim ( `$schema`, `$id`, `title`, `type`, `required`, `properties`, `additionalProperties: false` ). This is the canonical machine-readable shape for external consumers and docs; the hand-rolled validator is the runtime enforcement.
  - [x] Add a brief comment that the validator and the JSON Schema constant MUST stay in sync, and that Story 10.7 governs versioned evolution.
- [x] Wire the barrels (AC: 8)
  - [x] Add `export * from './audit.ts';` to `packages/core/src/types/index.ts`.
  - [x] Add `export * from './audit-entry-schema.ts';` to `packages/core/src/schemas/index.ts`.
  - [x] Confirm no export-name collisions with existing schema/type symbols.
- [x] Add unit tests (AC: 9)
  - [x] `packages/core/tests/audit-entry-schema.test.ts` (node:test + node:assert/strict):
    - [x] A canonical valid fixture (all required fields, plus `diff`, `promptDigest`) passes.
    - [x] A table-driven set removing each required field in turn → each throws `ValidationError` whose `details` names the missing field.
    - [x] Out-of-domain enum values for `scope`, `operation`, `status`, `runtimeMode`, `actor.kind`, `target.resourceKind` → each rejected.
    - [x] Unknown top-level field (e.g. `foo: 1`) → rejected.
    - [x] `schemaVersion: 2` → rejected with the versioning message.
    - [x] `AUDIT_ENTRY_JSON_SCHEMA_V1` has `$id === 'anydocs://schemas/audit-entry/v1'`, the exact `required` array from architecture, and `additionalProperties === false`.
  - [x] Assert on `error.name`/`details` shape rather than full message strings.
- [x] Validate (AC: 10)
  - [x] `pnpm --filter @anydocs/core typecheck` + `test` pass.
  - [x] Root `pnpm typecheck`, `pnpm test`, `pnpm build` stay green.
  - [x] Confirm only `packages/core/src/types/audit.ts`, `packages/core/src/schemas/audit-entry-schema.ts`, the two barrels, the new test, and `sprint-status.yaml` were touched.

## Dev Notes

- **This is the single most important early decision in the audit subsystem** (sprint plan: "Story 10.1 (audit schema) is the single most important early decision... implementation is mostly transcription"). The architecture addendum specifies the v1 schema fully — your job is faithful transcription + repo-idiomatic validation, not redesign.
- **🚩 Zod variance (important).** The epic AC says "exports a Zod schema and a JSON Schema (v1)", and architecture.md §"Audit Log Architecture" says the schema reference is a "Zod schema + JSON Schema export." **But `@anydocs/core` does not depend on Zod** — every existing schema (`docs-schema.ts`, `project-schema.ts`, `api-source-schema.ts`) is hand-rolled with type guards + `ValidationError`. Introducing Zod here would add a new runtime dependency to a package that has deliberately stayed dependency-light (current deps: only `minisearch`). **Recommendation: implement the runtime validator hand-rolled, matching the existing schemas, and export the JSON Schema (v1) as a frozen constant** — this satisfies the *intent* of the epic AC (a validating schema + a JSON Schema export) without the dependency. If the team prefers Zod, that is a deliberate dependency decision to raise before implementing. This story is written for the hand-rolled path; flag-and-confirm if you diverge.
- **Schema-only story.** No repository (10.2), no write-ahead lifecycle (10.3), no query (10.4), no rollback (10.5), no retention/CLI (10.6), no versioning-evolution tests (10.7). Resist implementing any persistence — 10.1 just locks the shape and its validator.
- **`id` is a ULID per the spec, but do not add a ULID dependency or generator here.** ID *generation* belongs to the repository/service (Story 10.2). The 10.1 validator only checks `id` is a non-empty string; a strict ULID-format check is optional and, if added, should be lenient (Story 10.2 decides the generator).
- **Reuse, don't redeclare.** `runtimeMode` reuses 8.1's `RuntimeMode`. `scope` (`inline|page|workspace`) is the same union Epic 11 uses for agent scopes — export `AuditScope` so 11.x imports it rather than redefining.
- **The validator and the JSON Schema constant must agree.** They are two encodings of one truth. Keep them adjacent in the file and cross-comment. Story 10.7 will add forward-compatibility tests that lean on this co-location.

### Project Structure Notes

- Types in `src/types/audit.ts`, schema/validator in `src/schemas/audit-entry-schema.ts` — exactly mirroring the existing split where `schemas/docs-schema.ts` imports types from `types/docs.ts`. Barrels: `types/index.ts` and `schemas/index.ts` both re-export with `.ts` extensions and are already chained into `src/index.ts`.
- Storage location for entries will be `<projectRoot>/.anydocs/audit/YYYY-MM-DD.ndjson` (architecture §"Audit Log Architecture → Storage"), but **no fs path constants are needed in this story** — that's the repository's concern (10.2).
- **Detected variance (test runner):** use `node:test` + `node:assert/strict`, not Vitest (architecture's "Testing Standards" Vitest mention is stale; the live `@anydocs/core` gate is the Node built-in runner — confirmed by Story 6.1 Dev Agent Record and `package.json`).
- **Detected variance (Zod):** see the 🚩 note above — repo convention overrides the epic/architecture "Zod" wording.

### Technical Requirements

- TypeScript strict mode. The `AuditEntry` type uses `schemaVersion: 1` as a literal type (`const 1`), so the validator's `schemaVersion === 1` check and the type narrow agree.
- `ValidationError` (extends `DomainError`) is the rejection vehicle; populate `details` with `entity: 'audit-entry'`, a `rule` identifying the failed constraint, a `remediation`, and `metadata` carrying the offending field name/value. This matches `createDocsValidationError` in `docs-schema.ts`.
- `AUDIT_ENTRY_JSON_SCHEMA_V1` must be deeply frozen or declared `as const` to prevent accidental mutation by consumers.
- No I/O, no clock, no id generation, no fs — pure shape + validation.

### Architecture Compliance

- Per architecture.md §"Audit Entry JSON Schema (v1)": reproduce the draft-07 schema exactly — `$id`, all required fields, all property enums, nested `actor`/`target`/`diff` shapes, `additionalProperties: false`.
- Per architecture.md §"Schema Versioning Rule": backward-incompatible changes require a `schemaVersion` bump + migration plan (Story 10.7 enforces this — 10.1 just locks v1 and rejects non-1 versions).
- Per architecture.md §"Audit Log Architecture → Schema reference": the canonical location is `@anydocs/core/src/schemas/audit-entry-schema.ts` (this story creates it).
- Per architecture.md §"Phase 2 Architectural Boundaries → Write-Ahead Audit": the `status` lifecycle (`pending → committed | rejected`) is consumed by 10.3; 10.1 only defines the field domain, not the transitions.
- Naming: PascalCase types (`AuditEntry`, `AuditTarget`, `AuditActor`), camelCase validator (`assertValidAuditEntry`/`validateAuditEntry`), UPPER_SNAKE constant (`AUDIT_ENTRY_JSON_SCHEMA_V1`), kebab-case filenames (`audit-entry-schema.ts`, `audit.ts`).

### Library / Framework Requirements

- **No new dependencies** (no Zod, no ULID lib, no ajv). Hand-rolled validation reusing `ValidationError` + the `isRecord`/`assertNonEmptyString` helper style from `docs-schema.ts`.
- Node.js 22 LTS; `--experimental-strip-types` execution.
- Reuse `RuntimeMode` (Story 8.1) and the existing `DomainError`/`ValidationError` hierarchy.

### File Structure Requirements

**To create (this story):**

```
packages/core/src/types/audit.ts                    ← AuditEntry + sub-types + guards
packages/core/src/schemas/audit-entry-schema.ts     ← assertValidAuditEntry + AUDIT_ENTRY_JSON_SCHEMA_V1
packages/core/tests/audit-entry-schema.test.ts
```

**To modify (this story):**

- `packages/core/src/types/index.ts` — `export * from './audit.ts';`
- `packages/core/src/schemas/index.ts` — `export * from './audit-entry-schema.ts';`
- `artifacts/bmad/implementation-artifacts/sprint-status.yaml` — status transitions

**Reference-only (do not modify):**

- `packages/core/src/schemas/docs-schema.ts` — the hand-rolled validation pattern to follow (helpers, `ValidationError` usage)
- `packages/core/src/types/docs.ts` — the type-guard pattern (`isPageStatus`, `isDocsLang`)
- `packages/core/src/errors/validation-error.ts` / `domain-error.ts` — error vehicle
- `packages/core/src/runtime/runtime-mode.ts` — `RuntimeMode` import source (Story 8.1)
- `artifacts/bmad/planning-artifacts/architecture.md` §"Audit Entry JSON Schema (v1)" — the verbatim source of truth

**Out of scope for this story:**

- Daily NDJSON repository + atomic append — Story 10.2
- Write-ahead lifecycle (`persistPending`/`markCommitted`/`markRejected`) — Story 10.3
- Query API — Story 10.4; Rollback — Story 10.5; Retention prune + CLI — Story 10.6
- Schema-versioning forward-compat tests — Story 10.7
- ULID generation, any fs path constants, any service wiring

### Testing Requirements

- `node:test` + `node:assert/strict`, file under `packages/core/tests/`, picked up by the core test glob and root `pnpm test`. **Keep the test file FLAT directly under `tests/` (not a `tests/schemas/` subdir):** the core test glob is unquoted, so a subdirectory shadows the flat tests (discovered in Story 8.1 — see its Review Follow-up). Follow the existing all-flat convention.
- Prefer a table-driven approach for the required-field and enum-domain cases to keep coverage exhaustive and readable.
- Build the canonical valid fixture once and clone-and-mutate it per negative case (so each negative differs from a known-good baseline by exactly one violation).
- Assert that negative cases throw `ValidationError` (check `error instanceof ValidationError` / `error.name`) and that `details.metadata` (or `details.rule`) identifies the offending field.
- No integration/e2e tests (no persistence yet).

### References

- Architecture: [Source: artifacts/bmad/planning-artifacts/architecture.md#Audit Entry JSON Schema (v1)] (the verbatim v1 schema — required fields, enums, nested shapes, `additionalProperties: false`)
- Architecture: [Source: artifacts/bmad/planning-artifacts/architecture.md#Schema Versioning Rule] (version-bump policy — enforced by Story 10.7)
- Architecture: [Source: artifacts/bmad/planning-artifacts/architecture.md#Audit Log Architecture] (storage location + schema reference path)
- Epics: [Source: artifacts/bmad/planning-artifacts/epics.md#Epic 10: Audit Log Subsystem with Write-Ahead Semantics → Story 10.1] (BDD acceptance criteria; note the "Zod" wording — see Dev Notes variance)
- Sprint plan: [Source: artifacts/bmad/implementation-artifacts/sprint-plan-phase2-vnext.md#Implementation Notes for Sprint Master] (item 4: "Story 10.1 (audit schema) is the single most important early decision... mostly transcription")
- Repo schema prior art: [Source: packages/core/src/schemas/docs-schema.ts] and [Source: packages/core/src/types/docs.ts] (hand-rolled validation + type-guard patterns — the convention to match instead of Zod)
- Predecessor (type reuse): [Source: artifacts/bmad/implementation-artifacts/8-1-implement-runtime-mode-resolver-in-anydocs-core.md] (`RuntimeMode` for the `runtimeMode` field)
- Repository conventions: [Source: CLAUDE.md#Content Model] (doc-content-v1 fragments may appear in `diff.before/after`) and #Pre-GitHub Submission Gate

## Dev Agent Record

### Agent Model Used

Claude Opus 4.8 (`claude-opus-4-8`)

### Debug Log References

- None. Test file placed FLAT at `packages/core/tests/audit-entry-schema.test.ts` per the Story 8.1 test-glob finding (subdirectories under `tests/` shadow the flat suite while the core test glob is unquoted).

### Completion Notes List

- Implemented the **hand-rolled** validator path (the recommended Zod variance resolution): `@anydocs/core` stays zero-Zod. Types in `src/types/audit.ts`; validator + JSON Schema in `src/schemas/audit-entry-schema.ts`, mirroring the `docs-schema.ts` / `types/docs.ts` split and the `isRecord` + `ValidationError` style.
- `assertValidAuditEntry(value): asserts value is AuditEntry` + `validateAuditEntry(value): AuditEntry` enforce: closed shape (unknown top-level keys rejected — `additionalProperties: false` parity), `schemaVersion === 1` (other versions hard-rejected with a message pointing at Story 10.7), required-field presence/type, enum domains for `scope`/`operation`/`status`/`runtimeMode`/`actor.kind`/`target.resourceKind`, ISO-8601 `timestamp` (lenient `Date.parse` check), and optional-field typing. Every failure throws `ValidationError` with `details.metadata.field` naming the offender.
- `runtimeMode` reuses Story 8.1's `RuntimeMode` type + `isRuntimeMode` guard; `AuditScope` (`inline|page|workspace`) is exported for Epic 11 agent-scope reuse.
- `AUDIT_ENTRY_JSON_SCHEMA_V1` is a frozen (`Object.freeze` + `as const`) draft-07 reproduction of the architecture spec (`$id: anydocs://schemas/audit-entry/v1`, full `required`/`properties`, `additionalProperties: false`). Validator and JSON Schema are co-located and cross-commented to stay in sync (Story 10.7 governs evolution).
- `id` validated as a non-empty string only — ULID generation is Story 10.2's concern; no ULID dependency added. No fs, no clock, no persistence (schema-only story). No new dependencies.

### Validation Evidence

- `pnpm --filter @anydocs/core typecheck` → exit 0
- `pnpm --filter @anydocs/core test` → **218 pass / 0 fail / 0 skipped** (10.1 adds 23 audit cases: 1 full-valid + 1 minimal + 10 required-missing + 6 enum-domain + unknown-field + schemaVersion≠1 + non-ISO-timestamp + non-object + JSON-Schema-shape)
- Root `pnpm typecheck` → exit 0; root `pnpm test` regression gate green (core 218 + editor 162 + cli 36+2 skip + mcp 44 + web 77)

### File List

**New files**

- `packages/core/src/types/audit.ts`
- `packages/core/src/schemas/audit-entry-schema.ts`
- `packages/core/tests/audit-entry-schema.test.ts`

**Modified files**

- `packages/core/src/types/index.ts` — added `export * from './audit.ts';`
- `packages/core/src/schemas/index.ts` — added `export * from './audit-entry-schema.ts';`
- `artifacts/bmad/implementation-artifacts/10-1-...md` — status ready-for-dev → review; tasks ticked; Dev Agent Record populated
- `artifacts/bmad/implementation-artifacts/sprint-status.yaml` — `10-1-...` ready-for-dev → review

## Senior Developer Review (AI)

**Reviewer:** Claude Opus 4.8 · **Date:** 2026-06-12 · **Outcome:** Approve → `done`

All 10 ACs satisfied. The v1 shape matches the architecture spec field-for-field (verified the `required` array, enum domains, nested `actor`/`target`/`diff`, and `additionalProperties: false` against the source). The **Zod variance was resolved as recommended** — hand-rolled validator matching `docs-schema.ts`, zero new dependencies — and the epic's intent (a validating schema + a JSON Schema export) is met via `assertValidAuditEntry` + the frozen `AUDIT_ENTRY_JSON_SCHEMA_V1`. Reviewed for: closed-shape enforcement (unknown keys rejected), version pinning (`schemaVersion !== 1` hard-rejected with a 10.7 pointer), field-named errors (every failure carries `details.metadata.field`), and scope (schema-only — no repository/lifecycle/ULID/fs bleed). 23 `node:test` cases incl. table-driven required-field + enum-domain coverage; root gate green. One consistency note for Story 10.7: the validator and the JSON Schema constant are two encodings of one shape kept in sync by co-location — 10.7's forward-compat tests should assert they agree. No blocking findings.
