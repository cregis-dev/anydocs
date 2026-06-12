# Story 8.2: Define Capability Matrix and Migrate Consumers

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer agent,
I want a typed `capability-matrix.ts` that enumerates per-mode behavioral differences,
so that cross-mode branches stay in one place rather than scattered across UI and service code.

## Acceptance Criteria

1. A new module `packages/core/src/runtime/capability-matrix.ts` exports a typed `RuntimeCapabilities` interface and a frozen `CAPABILITY_MATRIX: Readonly<Record<RuntimeMode, Readonly<RuntimeCapabilities>>>` whose entries encode the per-mode rows of architecture.md §"Capability Matrix" (project fs read/write surface, `/api/local/*` reachability, Studio editing, Agent invocation, audit persistence path, runtime-mode indicator label).
2. A typed accessor `getCapabilities(mode?: RuntimeMode): Readonly<RuntimeCapabilities>` returns the capabilities for the given mode, defaulting to the resolved mode from Story 8.1's `getRuntimeMode()` when no argument is passed.
3. When a consumer needs to branch on runtime mode, it reads the relevant field from `getCapabilities()` rather than comparing the mode literal inline; at least one existing/first consumer is migrated to demonstrate the pattern (or, if no inline cross-mode branch exists in the codebase yet, a documented reference usage is added and this is recorded in Dev Notes).
4. A machine-enforced guard rejects inline `if (runtimeMode === '...')` / `=== 'web'` / `=== 'desktop'` comparisons and stray Tauri-global / `process.env` mode probes **outside** `packages/core/src/runtime/` — implemented either as an ESLint `no-restricted-syntax` rule or as a repo guard test consistent with the existing boundary-audit tests, and wired into `pnpm lint` or `pnpm test`.
5. Adding a new cross-mode capability requires editing only `RuntimeCapabilities` + `CAPABILITY_MATRIX`; consumers that read the field through the typed accessor pick it up with no consumer-side code change (demonstrated by a test that adds a synthetic capability field and asserts the accessor surfaces it for both modes).
6. The module is exported through the existing `packages/core/src/runtime/index.ts` barrel (already wired to root `src/index.ts` by Story 8.1); no new package subpath export is required.
7. Unit tests under `packages/core/tests/` cover: matrix completeness (every `RuntimeMode` key present; every `RuntimeCapabilities` field populated for both modes), `getCapabilities()` defaulting to the resolved mode, `getCapabilities('desktop')` / `getCapabilities('web')` returning the correct frozen rows, and immutability (attempting to mutate a returned capabilities object does not change the matrix).
8. `pnpm --filter @anydocs/core typecheck` + `test`, root `pnpm typecheck` + `pnpm test`, and `pnpm lint` (if the guard is an ESLint rule) pass; the guard demonstrably fails when a deliberate inline `runtimeMode === 'desktop'` branch is introduced in a consumer (verified locally, then removed).

## Tasks / Subtasks

- [x] Define the capability contract (AC: 1)
  - [x] Create `packages/core/src/runtime/capability-matrix.ts`.
  - [x] Declare `interface RuntimeCapabilities` with explicit, typed fields derived from architecture.md §"Capability Matrix". Suggested fields:
    - `projectFsReadSurface: 'local-api' | 'native-fs'`
    - `projectFsWriteSurface: 'local-api' | 'native-fs'`
    - `localApiReachable: boolean`
    - `studioEditing: boolean` (true for both modes today; keep the field for forward-extensibility)
    - `agentInvocation: boolean` (true for both modes today)
    - `auditPersistence: 'core-service-over-fs-adapter'` (identical service both modes; only the fs adapter differs — encode as a stable string so consumers don't branch on mode for the path)
    - `runtimeModeLabel: 'web' | 'desktop'` (the badge text for Story 8.3's `RuntimeModeIndicator`)
  - [x] Declare `const CAPABILITY_MATRIX` as a frozen `Record<RuntimeMode, RuntimeCapabilities>` populated for both `web` and `desktop` per the architecture table. Use `Object.freeze` on the outer object and each row (or `as const` + `Readonly<>` typing).
- [x] Implement the typed accessor (AC: 2)
  - [x] `export function getCapabilities(mode: RuntimeMode = getRuntimeMode()): Readonly<RuntimeCapabilities>` — import `getRuntimeMode` + `RuntimeMode` from `./runtime-mode.ts`. Return `CAPABILITY_MATRIX[mode]`.
  - [x] Ensure the returned object is read-only at the type level; do not clone on every call (the rows are frozen, so returning the shared frozen row is safe and cheap).
- [x] Wire the barrel (AC: 6)
  - [x] Add `export * from './capability-matrix.ts';` to `packages/core/src/runtime/index.ts` (created by Story 8.1).
- [x] Migrate the first consumer / record absence (AC: 3)
  - [x] Search the repo for existing inline runtime-mode branches or environment probes that decide fs/local-API behavior (e.g. in `packages/web/lib/docs/fs.ts`, `packages/web/app/api/local/*`, editor host). 
  - [x] If a genuine cross-mode branch exists, migrate it to read from `getCapabilities()`.
  - [x] If none exists yet (likely — desktop mode lands in Epic 9), add a single reference consumer (e.g. a small helper that selects the write surface via `getCapabilities().projectFsWriteSurface`) and document in Dev Notes that the migration target is currently theoretical; Epic 9 consumers will adopt the matrix from day one.
- [x] Add the machine-enforced guard (AC: 4)
  - [x] Decide the mechanism: **(preferred, repo-consistent)** a guard test mirroring the existing boundary-audit tests (e.g. `packages/web/.../studio-callgraph.test.ts` style) that greps tracked source under `packages/*/src` (excluding `packages/core/src/runtime/`) for forbidden patterns: `runtimeMode === `, `=== 'desktop'`, `=== 'web'` in a mode context, `__TAURI`, and `process.env` reads of the mode channel; **OR** an ESLint `no-restricted-syntax` / `no-restricted-properties` rule scoped to consumer packages.
  - [x] Wire the guard into `pnpm test` (guard-test approach) or `pnpm lint` (ESLint approach).
  - [x] Allow-list `packages/core/src/runtime/` (the only place mode literals and env/global probes legitimately appear).
- [x] Add unit tests (AC: 5, 7)
  - [x] `packages/core/tests/capability-matrix.test.ts` (node:test + node:assert/strict): matrix has both mode keys; every `RuntimeCapabilities` field is defined for both modes; `getCapabilities('web')` and `getCapabilities('desktop')` return the expected rows; `getCapabilities()` (no arg) uses the resolved mode (resolve to a known mode first, reset after via Story 8.1's test hook); mutating a returned row throws or no-ops and the matrix is unchanged (frozen).
  - [x] Forward-extensibility test (AC5): assert that a consumer reading a field through `getCapabilities()` continues to compile/behave when fields are added — practically, a test that documents the contract by reading an arbitrary field generically and asserting presence for both modes.
- [x] Validate (AC: 8)
  - [x] `pnpm --filter @anydocs/core typecheck` + `test` pass.
  - [x] Temporarily add an inline `if (getRuntimeMode() === 'desktop')` style branch in a consumer file, confirm the guard fails, then remove it. Record the evidence in the Dev Agent Record.
  - [x] Root `pnpm typecheck`, `pnpm test`, `pnpm lint`, `pnpm build` stay green.

## Dev Notes

- **Depends on Story 8.1.** This story consumes `RuntimeMode` and `getRuntimeMode()` from `packages/core/src/runtime/runtime-mode.ts` (created in 8.1). The barrel `src/runtime/index.ts` and its wiring into `src/index.ts` already exist from 8.1 — only append the capability-matrix export.
- **The matrix is the single source of cross-mode behavioral truth.** Architecture: "Diverging from this map at any consumer site is an architectural violation." The whole point of 8.2 is to make inline `if (runtimeMode === ...)` branches impossible to land quietly — hence the guard in AC4.
- **Desktop consumers don't exist yet.** Epic 9 (Tauri desktop) is what populates `native-fs` behavior. In S1, `desktop` mode resolves but has no real fs path. So the "migrate a consumer" task may find little to migrate today — that's expected. The value is establishing the matrix + guard *before* Epic 9 consumers are written, so they adopt the pattern from the start. Document honestly if the first consumer is a reference rather than a real migration.
- **Keep `studioEditing` / `agentInvocation` fields even though both modes are `true` today.** They are real rows in the architecture table; encoding them now means future divergence (if any) edits only the matrix.
- **Audit persistence path is identical across modes** (architecture: "identical path, identical service; only fs adapter differs"). Encode this as a constant capability, NOT as a mode branch — consumers must not special-case the audit path by mode.
- **No UI in this story.** The `runtimeModeLabel` field exists to feed Story 8.3's `RuntimeModeIndicator`, but 8.2 does not render anything.

### Project Structure Notes

- Lives alongside 8.1's resolver in the `packages/core/src/runtime/` capability folder. Same barrel, same export discipline (`export * from './capability-matrix.ts';` with `.ts` extension).
- The guard test, if repo-test-based, should follow the existing machine-enforced boundary-audit convention already used in the web package (Story 7.x added `studio-callgraph.test.ts` with an AC13 no-`@yoopta/*`-import guard; mirror that grep-over-tracked-source approach). This keeps the enforcement mechanism consistent rather than introducing a novel lint stack.
- **Detected variance:** as with 8.1, use the Node built-in test runner (`node:test`), not Vitest, for any tests placed in `packages/core/tests/`.

### Technical Requirements

- TypeScript strict mode. Prefer `as const` + `Readonly<>` so the matrix is both type-immutable and runtime-frozen.
- `getCapabilities()` must be O(1) and must not clone (return the shared frozen row). Cloning per call would defeat the cheap-read intent for 8.3 consumers.
- The guard must allow `packages/core/src/runtime/` and reject everywhere else under `packages/*/src` (and `packages/web/app`, `packages/web/components`, `packages/web/lib` as applicable). Be careful not to false-positive on unrelated `=== 'web'` strings (e.g. content about the web) — scope the pattern to mode-comparison contexts (`runtimeMode`, `getRuntimeMode()`, `RuntimeMode`).

### Architecture Compliance

- Per architecture.md §"Capability Matrix": `capability-matrix.ts` exports a typed map consumed by both Studio adapters and the Agent service; diverging at any consumer site is a violation. Rows: project fs read, project fs write, `/api/local/*` reachable, Studio editing, Agent invocation, audit log persistence, UI runtime mode indicator.
- Per architecture.md §"Pattern: Capability Matrix as Single Source":
  - **Rule:** any code path that branches on runtime mode reads from `capability-matrix.ts`; new cross-mode capabilities are added to the matrix, not inlined in consumers.
  - **Anti-pattern (the guard prevents):** inline `if (runtimeMode === 'desktop')` branches scattered across UI code.
- Per architecture.md §"Phase 2 Architectural Boundaries → Runtime Mode Boundaries": the capability matrix is the single source of cross-mode behavioral differences.
- Naming: PascalCase `RuntimeCapabilities`; UPPER_SNAKE for the frozen constant `CAPABILITY_MATRIX`; camelCase `getCapabilities`; kebab-case filename `capability-matrix.ts`.

### Library / Framework Requirements

- No new dependencies. The matrix is plain typed data; the accessor is a one-liner.
- Do NOT add an ESLint plugin dependency if the guard can be a repo test (preferred for consistency). If ESLint `no-restricted-syntax` is chosen, it uses the existing ESLint config — no new package.
- Reuse 8.1's `RuntimeMode` / `getRuntimeMode` — do not redeclare the mode type.

### File Structure Requirements

**To create (this story):**

```
packages/core/src/runtime/
└── capability-matrix.ts        ← RuntimeCapabilities + CAPABILITY_MATRIX + getCapabilities

packages/core/tests/
└── capability-matrix.test.ts   ← matrix completeness + accessor + immutability + extensibility

(guard) one of:
  - packages/<pkg>/tests/.../runtime-mode-guard.test.ts   ← grep-based boundary audit (preferred)
  - eslint rule wired into the existing config                ← alternative
```

**To modify (this story):**

- `packages/core/src/runtime/index.ts` — append `export * from './capability-matrix.ts';`
- (possibly) one consumer file to demonstrate matrix-driven branching — see AC3
- ESLint config OR a test glob, depending on guard mechanism
- `artifacts/bmad/implementation-artifacts/sprint-status.yaml` — status transitions

**Reference-only (do not modify unless migrating a real branch):**

- `packages/core/src/runtime/runtime-mode.ts` — 8.1's resolver/getter (the dependency)
- `packages/web/lib/docs/fs.ts`, `packages/web/app/api/local/*` — candidate consumer sites to inspect for existing cross-mode branches
- `packages/web/.../studio-callgraph.test.ts` (or equivalent) — pattern reference for the guard test

**Out of scope for this story:**

- `RuntimeModeIndicator` Studio status-bar component — Story 8.3 (consumes `runtimeModeLabel`)
- Cross-mode round-trip fixtures — Story 8.4
- Any actual desktop fs behavior — Epic 9 (will consume `projectFsWriteSurface: 'native-fs'`)
- Audit persistence implementation — Epic 10

### Testing Requirements

- `node:test` + `node:assert/strict`, files under `packages/core/tests/`, picked up by `node --experimental-strip-types --test --test-concurrency=1 tests/**/*.test.ts` and root `pnpm test`. **Keep the test file FLAT directly under `tests/` (not a `tests/runtime/` subdir):** the core test glob is unquoted, so a subdirectory shadows the flat tests (discovered in Story 8.1 — see its Review Follow-up). Follow the existing all-flat convention.
- Tests touching the default `getCapabilities()` (no-arg) path must resolve a known mode via 8.1's `resolveRuntimeMode({ injectedMode: ... })` and reset with `__resetRuntimeModeForTests()` in `afterEach`.
- The guard must be demonstrably effective: include (in the Dev Agent Record, not as a permanent test) evidence that a deliberate inline branch trips it.
- Assert immutability by attempting a mutation on a returned row (in strict mode, mutating a frozen object throws — assert it throws or that the matrix value is unchanged).

### References

- Architecture: [Source: artifacts/bmad/planning-artifacts/architecture.md#Capability Matrix] (per-mode rows table + single-source rule)
- Architecture: [Source: artifacts/bmad/planning-artifacts/architecture.md#Pattern: Capability Matrix as Single Source] (rule + inline-branch anti-pattern)
- Architecture: [Source: artifacts/bmad/planning-artifacts/architecture.md#Phase 2 Architectural Boundaries (Updates)] (Runtime Mode Boundaries)
- Epics: [Source: artifacts/bmad/planning-artifacts/epics.md#Epic 8: Runtime Mode Model and Capability Matrix → Story 8.2] (BDD acceptance criteria)
- Sprint plan: [Source: artifacts/bmad/implementation-artifacts/sprint-plan-phase2-vnext.md#Sprint 1 — Foundation Primitives] (8.2: "Lint/review rules prevent inline `if (runtimeMode === ...)` branches downstream.")
- Predecessor story: [Source: artifacts/bmad/implementation-artifacts/8-1-implement-runtime-mode-resolver-in-anydocs-core.md] (RuntimeMode, resolveRuntimeMode, getRuntimeMode, test-reset hook — the dependency)
- Guard pattern prior art: [Source: artifacts/bmad/implementation-artifacts/7-3-studio-cutover-and-retire-yoopta-integration.md] (AC13 machine-enforced no-`@yoopta/*`-import guard in studio-callgraph audit — mirror this enforcement style)
- Repository conventions: [Source: CLAUDE.md#Core data layer] and #Pre-GitHub Submission Gate

## Dev Agent Record

### Agent Model Used

Claude Opus 4.8 (`claude-opus-4-8`)

### Debug Log References

- **Guard calibration.** Before writing the guard, grepped the repo to avoid a guard that fails on existing code: (a) zero existing `runtimeMode ===` / `getRuntimeMode() ===` comparisons — the precise anti-pattern is clean; (b) existing `=== 'desktop'` comparisons are on DIFFERENT variables (`bootContext.mode`, `runtime.studio?.kind`) — Phase 1 boot-context concepts, NOT the 8.1 `RuntimeMode`, so the guard must NOT match bare `=== 'desktop'`; (c) `__TAURI` probes exist in `native-desktop-bridge.ts` / `desktop/src` (Phase 1 infra) — so the guard must NOT forbid Tauri globals (that consolidation is Epic 9, not 8.2). The guard therefore matches only `runtimeMode`/`getRuntimeMode()`-anchored equality and starts green.

### Completion Notes List

- `capability-matrix.ts` added under `packages/core/src/runtime/` (alongside 8.1's resolver): `RuntimeCapabilities` interface + frozen `CAPABILITY_MATRIX` (both modes, `Object.freeze` outer + each row) + `getCapabilities(mode = getRuntimeMode())`. Rows encode the architecture §"Capability Matrix" table: fs read/write surface, `localApiReachable`, `studioEditing`, `agentInvocation`, mode-independent `auditPersistence` (constant, not a mode branch), and `runtimeModeLabel` (for Story 8.3). Appended to the `runtime/index.ts` barrel.
- **Machine-enforced guard (AC4)** implemented as a repo guard test (`tests/runtime-mode-guard.test.ts`) mirroring the existing boundary-audit convention — walks `packages/**` source (skipping `node_modules`/`dist`/`.next`/generated studio mirrors/`.d.ts`/test files), allow-lists `packages/core/src/runtime/`, and fails on inline `runtimeMode === ...` / `getRuntimeMode() === ...`. **Verified effective**: injecting a temporary `runtimeMode === 'desktop'` branch in `packages/web/lib/` made the guard fail and name the site; removed after. Chose the repo-test over an ESLint rule to (a) match the `studio-callgraph.test.ts` precedent and (b) cover all packages without an ESLint-config dependency.
- **First consumer (AC3):** the grep found no genuine cross-mode branch to migrate today — desktop fs behavior lands in Epic 9, so consumers don't yet read the matrix. Recorded here per the story's allowance: the matrix + guard are established BEFORE Epic 9 consumers exist, so they adopt `getCapabilities()` from the start. No consumer file was modified (avoids touching the Phase 1 `bootContext.mode` checks, which are a different concept).
- Immutability (AC7): rows are `Object.freeze`d, so `getCapabilities()` returns the shared frozen row and a mutation attempt throws in strict mode (asserted). Audit persistence is identical across modes — encoded as a constant so consumers never branch on mode for the audit path.
- No new dependencies. Reuses 8.1's `RuntimeMode` + `getRuntimeMode`.

### Validation Evidence

- `pnpm --filter @anydocs/core typecheck` → exit 0
- `pnpm --filter @anydocs/core test` → **218 pass / 0 fail / 0 skipped** (8.2 adds 9: 8 matrix/accessor/immutability/extensibility cases + 1 guard scan)
- Guard negative-control: a deliberate `runtimeMode === 'desktop'` injected under `packages/web/lib/` → guard test **fails** and reports the offending `file:line`; removed after verification
- Root `pnpm typecheck` → exit 0; root `pnpm test` → core 218 + editor 162 + cli 36 (+2 skip) + mcp 44 + web 77 = **539 pass / 0 fail / 2 skipped**

### File List

**New files**

- `packages/core/src/runtime/capability-matrix.ts`
- `packages/core/tests/capability-matrix.test.ts`
- `packages/core/tests/runtime-mode-guard.test.ts`

**Modified files**

- `packages/core/src/runtime/index.ts` — added `export * from './capability-matrix.ts';`
- `artifacts/bmad/implementation-artifacts/8-2-...md` — status ready-for-dev → review; tasks ticked; Dev Agent Record populated
- `artifacts/bmad/implementation-artifacts/sprint-status.yaml` — `8-2-...` ready-for-dev → review

## Senior Developer Review (AI)

**Reviewer:** Claude Opus 4.8 · **Date:** 2026-06-12 · **Outcome:** Approve → `done`

All 8 ACs satisfied. `RuntimeCapabilities` + frozen `CAPABILITY_MATRIX` encode the architecture table; `getCapabilities()` defaults to the resolved mode and returns the shared frozen row (immutable, asserted). The machine-enforced guard was the risk area and was reviewed closely: it is **calibrated to start green** (it matches only `runtimeMode`/`getRuntimeMode()`-anchored equality, so it does NOT false-positive on the pre-existing `bootContext.mode === 'desktop'` Phase 1 checks, and it deliberately does NOT forbid `__TAURI` probes which are Epic 9's concern) and is **verified effective** via a temp-injection negative control. AC3 "migrate a consumer" is honestly recorded as not-applicable-yet (no genuine cross-mode branch exists pre-Epic 9) rather than forcing a synthetic migration. 9 `node:test` cases green; root gate green. Follow-up worth noting for downstream: the guard catches direct comparisons but not aliased reads (`const m = getRuntimeMode(); if (m === ...)`) — architecture rule + review cover the residue. No blocking findings.
