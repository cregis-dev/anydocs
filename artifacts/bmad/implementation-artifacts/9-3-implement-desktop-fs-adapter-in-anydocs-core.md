# Story 9.3: Implement `desktop-fs-adapter.ts` in `@anydocs/core`

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer agent,
I want a `desktop-fs-adapter.ts` in `@anydocs/core` that performs project file I/O over Tauri IPC behind the same injectable filesystem abstraction the web/CLI repositories use,
so that desktop mode reuses the exact same core service entry points as web mode, with no service-level branching on the runtime.

## ⚠️ Reality Reconciliation (READ FIRST — the epic AC is aspirational)

The epic AC says "implement the **`ContentRepository` interface** over Tauri IPC; every existing repository method has a desktop equivalent." **That interface does not exist.** Verified reality (2026-06-14):

- There is **no `ContentRepository` interface**. The fs layer is plain config objects (`DocsRepository = {projectRoot, pagesRoot, navigationRoot}`, `ApiSourceRepository`) + module-level functions.
- **All fs I/O is hardcoded to `node:fs/promises`** in `docs-repository.ts`, `api-source-repository.ts`, `content-repository.ts`, `audit-repository.ts`. There is **no injectable IO seam** today.
- `@anydocs/core` has **zero framework deps** and **must not** import `@tauri-apps/api`.

**Chosen approach (user-confirmed): introduce an injectable `FileSystemPort` in core.** Define the seam, refactor repos to use it (default = behavior-preserving node port → web/CLI unchanged), and add `desktop-fs-adapter.ts` as a port implementation that calls Rust commands through an **injected `invoke`** (keeps core framework-agnostic). This is what makes AC2 ("services don't branch on adapter") actually true: services call the port, not `node:fs`.

**Scope (this story):** `FileSystemPort` + node port + **`docs-repository.ts` and `api-source-repository.ts`** refactored to DI + `desktop-fs-adapter.ts` + typed `FsReadError`/`FsWriteError`. **Deferred:** `content-repository.ts` (project contract/config I/O) and `audit-repository.ts` → follow-up (note below); renderer wiring + `set_active_project_root` call + unifying `isDesktopRuntime` → **Story 9.5**; exhaustive atomic fault-injection → **Story 9.4**.

## Acceptance Criteria

Reconciled from `epics.md:1079` (Story 9.3):

1. **AC1 — Injectable fs seam.** `@anydocs/core` exposes a `FileSystemPort` interface covering the operations the repositories need (read text, atomic write, ensure-dir, exists, read-dir, remove). A default node-backed implementation (`createNodeFsPort()`) preserves today's exact behavior and error semantics.
2. **AC2 — Repos use the port; no service branching.** `docs-repository.ts` and `api-source-repository.ts` perform all I/O through an injected `FileSystemPort` (default = node port). No repository/service contains code that branches on which adapter is active. **All existing core/web/cli tests pass unchanged** (behavior-preserving refactor).
3. **AC3 — Desktop adapter over Tauri IPC.** `@anydocs/core/src/fs/desktop-fs-adapter.ts` exports `createDesktopFsPort({ projectRoot, invoke })` implementing `FileSystemPort` by mapping absolute paths → project-root-relative paths and calling the Rust commands (`fs_read`/`fs_write`/`fs_list`/`fs_delete`/`fs_mkdir`). It imports no framework packages — `invoke` is injected.
4. **AC4 — Typed domain errors.** Rust `FsError {kind, message}` is mapped to typed `FsReadError` / `FsWriteError` (extending `DomainError`). A "not found" result is surfaced so the repositories' existing missing-file handling continues to work in desktop mode (see Dev Notes).
5. **AC5 — Unit-tested with a stub `invoke`.** Because `invoke` is injected, the desktop port is unit-tested in core `node:test` with a fake `invoke` (no real Tauri runtime): path abs→rel mapping, command dispatch/args, FsError→typed-error mapping, and not-found behavior.

## Tasks / Subtasks

- [x] **Task 1 — Define `FileSystemPort` + node port (AC1)**
  - [x] New `packages/core/src/fs/file-system-port.ts`: `export interface FileSystemPort` with the minimal method set the repos use:
    - `readText(absPath: string): Promise<string>`
    - `writeFileAtomic(absPath: string, contents: string): Promise<void>` (ensures parent dir, then atomic write)
    - `ensureDir(absPath: string): Promise<void>`
    - `exists(absPath: string): Promise<boolean>`
    - `readDir(absPath: string): Promise<string[]>` (entry names)
    - `remove(absPath: string): Promise<void>`
  - [x] `createNodeFsPort(): FileSystemPort` wrapping `node:fs/promises` — **behavior-identical** to current helpers: `writeFileAtomic` = `mkdir(dir,{recursive}) → write temp (`.{base}.{pid}.{ts}.tmp`) → rename`; `readText` re-throws native errors (so `error.code==='ENOENT'` still works); `readDir` = `readdir`; `exists` = `access` try/catch; `remove` = `rm`.
  - [x] Export both from `fs/index.ts` and the core barrel.
- [x] **Task 2 — Typed fs errors + missing-file discriminator (AC4)**
  - [x] New `FsReadError` / `FsWriteError extends DomainError` (codes `FS_READ_ERROR` / `FS_WRITE_ERROR`) in `packages/core/src/errors/`; export from errors barrel.
  - [x] Decide and implement the missing-file signal so `isMissingFileError` works across both ports. Recommended: a shared `isMissingFileError(error)` (lift the existing private helper to a shared util) that returns true for **native `ENOENT`** (node port, unchanged) **and** the desktop not-found case. Make the desktop port surface not-found as an error that this helper recognizes (e.g. an `FsReadError` carrying `code:'ENOENT'` in metadata, or a dedicated not-found flag the helper checks). Keep node behavior byte-identical.
- [x] **Task 3 — Refactor `docs-repository.ts` to the port (AC2)**
  - [x] `createDocsRepository(projectRoot, port: FileSystemPort = createNodeFsPort())` — store `port` on the repository object (`DocsRepository.port`). Default keeps every existing caller working.
  - [x] Replace internal `readJson`/`writeJsonAtomic`/`fs.*` with `repository.port.*`: `readJson` → `JSON.parse(await port.readText(p))`; `writeJsonAtomic` → `port.writeFileAtomic(p, JSON.stringify(v,null,2)+'\n')`; `fs.readdir` → `port.readDir`; `fs.access` → `port.exists`; `fs.rm` → `port.remove`; `fs.mkdir` → `port.ensureDir`.
  - [x] Preserve all validation/error logic unchanged. `isMissingFileError` uses the shared util (Task 2).
- [x] **Task 4 — Refactor `api-source-repository.ts` to the port (AC2)**
  - [x] Same pattern: `createApiSourceRepository(projectRoot, port = createNodeFsPort())`, store + use `port`. Preserve behavior.
- [x] **Task 5 — Add contained `fs_mkdir` Rust command (enables desktop ensureDir)**
  - [x] In `packages/desktop/src-tauri/src/commands/fs_commands.rs`: `#[tauri::command] fs_mkdir(state, path) -> Result<(), FsError>` creating a directory (recursive) **within the active project root**, reusing the same containment guard. Register in `lib.rs` `generate_handler!`. Add a `cargo` test. _(Small, in-scope: the adapter's `ensureDir`/`writeFileAtomic` needs it because 9.2's `fs_write` requires an existing parent — see 9.2 L4.)_
- [x] **Task 6 — Implement `desktop-fs-adapter.ts` (AC3, AC4)**
  - [x] `createDesktopFsPort({ projectRoot, invoke }): FileSystemPort` where `invoke: (cmd, args) => Promise<unknown>` is injected (typed locally; no `@tauri-apps/api` import).
  - [x] Map each port method to a Rust command, converting the incoming **absolute** path to a **root-relative** path (strip `projectRoot` prefix; reject paths outside): `readText`→`fs_read`; `writeFileAtomic`→`ensureDir(dirname)` then `fs_write`; `ensureDir`→`fs_mkdir`; `exists`→`fs_read`/`fs_list` probe or a dedicated check (keep simple — try and catch not-found); `readDir`→`fs_list` then `entries.map(e=>e.name)`; `remove`→`fs_delete`.
  - [x] Catch the Rust `FsError` shape and rethrow typed `FsReadError`/`FsWriteError`; map `kind:'noActiveProjectRoot'|'pathEscapesRoot'|'invalidPath'|'notFound'|'io'` to appropriate domain errors / not-found signal.
  - [x] Export `createDesktopFsPort` + types from `fs/index.ts` + core barrel.
- [x] **Task 7 — Tests (AC2, AC5)**
  - [x] Desktop port unit tests (`packages/core/tests/desktop-fs-adapter.test.ts`, `node:test`) using a **stub invoke** recording `(cmd, args)`: asserts abs→rel mapping, correct command + args per method, `writeFileAtomic` calls `fs_mkdir` then `fs_write`, FsError(kind)→typed error mapping, not-found path satisfies `isMissingFileError`.
  - [x] Node-port parity: confirm existing `docs-repository`/`api-source-repository` tests still pass unchanged (the default-port refactor must not alter behavior). Add a focused test that `createNodeFsPort()` round-trips read/write/list/remove in a tempdir.
  - [x] `cargo test` for the new `fs_mkdir` command.
- [x] **Task 8 — Regression gate**
  - [x] `pnpm typecheck`; `pnpm test` (core+cli+mcp) green — **rebuild `@anydocs/core` dist** before cli/mcp consume it ([[cli-consumes-core-via-dist]]). `cargo test` (src-tauri) green ([[desktop-cargo-build-prereqs]]). Update File List + Completion Notes.

## Dev Notes

### The interface to build (the repos' real I/O needs — from docs-repository.ts)

`docs-repository.ts` uses exactly: `fs.readFile(p,'utf8')`, `fs.mkdir(dir,{recursive})`, `fs.writeFile(temp)`+`fs.rename(temp,p)` (atomic), `fs.access(p)`, `fs.readdir(dir)`, `fs.rm(p)`. `api-source-repository.ts` mirrors this. That maps 1:1 to the six `FileSystemPort` methods. Keep the port **path-in-absolute** (repos already compute absolute paths via `path.join(repository.pagesRoot, …)`) — the desktop port converts abs→rel internally so the repo refactor is mechanical.

### Critical: missing-file semantics (the most likely bug)

`docs-repository.ts` relies on `isMissingFileError(error)` → `error.code === 'ENOENT'` to treat absent files as empty/`null` (`loadNavigation`, `loadPage`, `listPages`). The **node port must keep throwing native ENOENT** (don't wrap), so web/CLI behavior is byte-identical. The **desktop port** returns a Rust `FsError{kind:'notFound'}` — it must be surfaced so the SAME `isMissingFileError` returns true (else desktop reads of absent pages throw instead of returning null). Lift `isMissingFileError` to a shared util and teach it both signals. Cover both in tests.

### Atomic write + mkdir on desktop

9.2's `fs_write` writes atomically but **requires an existing parent dir** (9.2 L4). The node `writeFileAtomic` does `mkdir(recursive)` first. To match, the desktop `writeFileAtomic` must `ensureDir(dirname)` first → needs `fs_mkdir` (Task 5). Keep `fs_mkdir` behind the same containment guard as the other commands (reuse `resolve_for_write`/a dir variant).

### Framework-agnostic core (hard constraint)

`@anydocs/core` must not import `@tauri-apps/api` (zero framework deps; verified `package.json`). The desktop port takes an injected `invoke: (cmd: string, args?: Record<string, unknown>) => Promise<unknown>`. The host (web/desktop renderer, Story 9.5) passes `@tauri-apps/api/core`'s `invoke`. This also makes the adapter trivially unit-testable with a stub (AC5).

### Path mapping (abs → rel)

Rust commands take paths **relative to the active project root** (Story 9.2 contract). The desktop port is constructed with `projectRoot`; for each absolute path it computes `path.relative(projectRoot, absPath)` (use a posix-normalized relative; reject results starting with `..`). The Rust active root (set via `set_active_project_root` in 9.5) must equal this `projectRoot`.

### Scope / deferrals (don't do here)

- ❌ `content-repository.ts` (project contract load/validate, config write) and `audit-repository.ts` → follow-up. Rationale: docs + api-source are the page/nav/api-source content surface this story targets; project-contract + audit (Epic 10, agent-written) are separable. Note in completion that full desktop project-open (which reads the contract) completes with these + Story 9.5.
- ❌ Renderer wiring / constructing the desktop port in the host / `set_active_project_root` call → **Story 9.5**.
- ❌ Exhaustive atomic fault-injection (NFR27, 100% runs) → **Story 9.4**.
- ❌ Removing/altering `@anydocs/desktop-server`.

### Architecture compliance

- [Source: architecture.md:858-872] desktop-fs-adapter implements the repository abstraction over Tauri IPC; **adapter adapts I/O only** — validation/publication/content-modeling stay in shared core (the refactor keeps all that logic in the repos, swapping only the IO calls). Typed `FsWriteError` on failure.
- [Source: architecture.md:814-842] capability matrix: desktop fs read/write = native Tauri commands; web = `/api/local/*`. After this story the *seam* exists; 9.5 selects the port by runtime mode via `getCapabilities()`/`getRuntimeMode()` (no inline literal branching — respects the Story 8.2 guard test).

### Testing standards

- Core: `node:test` flat in `packages/core/tests/`. The injected-`invoke` design means the desktop adapter is fully testable headless (no Tauri). Rebuild core dist before cli/mcp ([[cli-consumes-core-via-dist]]).
- Rust: `cargo test` for `fs_mkdir`; build desktop-server/core dist first ([[desktop-cargo-build-prereqs]]).
- The behavior-preserving bar: the existing docs/api-source repository test suites must pass **without modification** (proves AC2's no-behavior-change).

### Project Structure Notes

- New: `packages/core/src/fs/file-system-port.ts`, `packages/core/src/fs/desktop-fs-adapter.ts`, `packages/core/src/errors/fs-error.ts` (or co-located), `packages/core/tests/desktop-fs-adapter.test.ts`.
- Modified: `docs-repository.ts`, `api-source-repository.ts` (DI), `fs/index.ts` + errors barrel + core `index.ts` (exports), `packages/desktop/src-tauri/src/commands/fs_commands.rs` + `lib.rs` (`fs_mkdir`).

### References

- [Source: artifacts/bmad/planning-artifacts/epics.md#Story 9.3] (epics.md:1079-1095) — original ACs (reconciled above).
- [Source: artifacts/bmad/planning-artifacts/architecture.md#Native Filesystem Adapter] (architecture.md:858-872).
- [Source: packages/core/src/fs/docs-repository.ts] — exact I/O surface to abstract (`readJson`/`writeJsonAtomic`/`fs.*`).
- [Source: packages/core/src/fs/api-source-repository.ts] — same pattern.
- [Source: packages/core/src/errors/domain-error.ts] — `DomainError` base for `FsReadError`/`FsWriteError`.
- [Source: packages/desktop/src-tauri/src/commands/fs_commands.rs] — Rust command contract + `FsError{kind,message}` (Story 9.2, done).
- [Source: artifacts/bmad/implementation-artifacts/9-2-implement-rust-side-native-fs-commands-with-path-safety.md] — relative-path contract + atomic write + L4 (no auto-mkdir).

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (BMAD dev-story workflow)

### Debug Log References

- core `node:test`: 281 pass (+11 desktop-fs-adapter/node-port tests), 0 fail.
- desktop Rust `cargo test`: 11 pass (added mkdir path-logic test), 0 warnings.
- `pnpm typecheck`: 7/7 clean. Full gate: core 281 / editor 162 / cli 41 (+2 skip) / mcp 44 / web 77 — 0 fail.

### Completion Notes List

- **AC1/AC2 (port seam, behavior-preserving):** `fs/file-system-port.ts` defines `FileSystemPort` + `createNodeFsPort()` (byte-identical to the prior inline node:fs helpers) + shared `isMissingFileError`. `docs-repository.ts` and `api-source-repository.ts` now take an injected `port` (default node) and route all I/O through it. The **entire existing core test suite passes unchanged** (270→281, only additions) — proves no behavior change and no service-level runtime branching.
- **AC3 (desktop adapter):** `fs/desktop-fs-adapter.ts` `createDesktopFsPort({projectRoot, invoke})` implements `FileSystemPort` over the Rust commands, converting absolute→root-relative (posix) paths and rejecting escapes pre-IPC. **No `@tauri-apps/api` import** — `invoke` is injected (`TauriInvoke` declared locally), keeping core framework-agnostic.
- **AC4 (typed errors):** `errors/fs-error.ts` adds `FsReadError`/`FsWriteError extends DomainError`. The Rust `FsError{kind}` maps through; `kind:'notFound'` sets `metadata.notFound`, and `isMissingFileError` recognizes both that and native `ENOENT`, so repos' missing-file handling works in both modes.
- **AC5 (headless unit tests):** injected-invoke design lets `desktop-fs-adapter.test.ts` verify abs→rel mapping, per-method command/args, `writeFileAtomic`→`fs_mkdir`+`fs_write` ordering, FsError→typed-error mapping, not-found→`isMissingFileError`, and escape rejection — all with a stub invoke, no Tauri runtime.
- **`fs_mkdir` (Rust):** added a contained `fs_mkdir` (reuses `resolve_for_write` containment + `create_dir_all`, idempotent) so the desktop `ensureDir`/`writeFileAtomic` works despite 9.2's no-auto-mkdir (`fs_write` requires existing parent). Registered in `generate_handler!`.
- **Scope held:** `content-repository.ts` + `audit-repository.ts` NOT refactored (deferred — full desktop project-open that reads the project contract completes with these + Story 9.5). Renderer wiring / `set_active_project_root` call / `isDesktopRuntime` unification → 9.5. Fault-injection → 9.4. `@anydocs/desktop-server` untouched.

### File List

- `packages/core/src/errors/fs-error.ts` (new) — `FsReadError`/`FsWriteError`.
- `packages/core/src/errors/index.ts` (modified) — export fs errors.
- `packages/core/src/fs/file-system-port.ts` (new) — `FileSystemPort`, `createNodeFsPort`, `isMissingFileError`.
- `packages/core/src/fs/desktop-fs-adapter.ts` (new) — `createDesktopFsPort` + `TauriInvoke`.
- `packages/core/src/fs/docs-repository.ts` (modified) — port DI; I/O via port.
- `packages/core/src/fs/api-source-repository.ts` (modified) — port DI; I/O via port.
- `packages/core/src/fs/index.ts` (modified) — export port + adapter.
- `packages/core/tests/desktop-fs-adapter.test.ts` (new) — 11 tests (adapter stub-invoke + node port).
- `packages/desktop/src-tauri/src/commands/fs_commands.rs` (modified) — `fs_mkdir` + test.
- `packages/desktop/src-tauri/src/lib.rs` (modified) — register `fs_mkdir`.

## Change Log

- 2026-06-14 — Story 9.3 implemented: injectable `FileSystemPort` (default node port, behavior-preserving) + `docs`/`api-source` repos refactored to DI + `desktop-fs-adapter.ts` (Tauri IPC via injected invoke) + `FsReadError`/`FsWriteError` + contained `fs_mkdir` Rust command. core 281 / Rust 11 pass; full gate green. Status ready-for-dev → review.
- 2026-06-14 — Senior Developer Review (AI) → done. 0 CRITICAL/HIGH/MEDIUM. 4 LOW accepted/deferred. No code changes required.

## Senior Developer Review (AI)

**Reviewer:** Shawn (AI adversarial review) · **Date:** 2026-06-14 · **Outcome:** Approve → done

**Scope verified:** AC1–AC5 implemented and traced. Hard constraint confirmed — **no real `@tauri-apps/api` import in core** (only a doc-comment mention); `desktop-fs-adapter.ts` imports only `node:path` + core internals; core deps unchanged. Repos no longer import `node:fs`. Git matches File List.

**Strongest evidence (AC2):** the entire pre-existing core suite passes unchanged (270→281, additions only) — the DI refactor altered no behavior. Node port's atomic write (temp-name pattern + `JSON.stringify(…,null,2)+'\n'`) is byte-identical to the prior inline helpers. AC4 not-found unification (`ENOENT` + `DomainError.metadata.notFound`) verified against both repos' missing-file branches. Escape paths rejected pre-IPC (0 invoke calls).

**Findings (all LOW — accepted/deferred, no fixes):**

- 🟢 **L1** — `exists()` on a root-level path (parent `'.'`) would throw rather than return a bool (9.2 `fs_list` rejects empty rel). Not exercised (only nested `navFile`); latent contract gap.
- 🟢 **L2** — extra `fs_mkdir` IPC per `writeFileAtomic` (parity with node per-write `mkdir`; one extra desktop round-trip). Perf nit.
- 🟢 **L3** — multi-level new-dir creation unsupported (`fs_mkdir` needs existing grandparent; inherited 9.2 L4). Fine for the content model.
- 🟢 **L4** — `content-repository.ts`/`audit-repository.ts` still `node:fs` (deferred); full desktop project-open completes with these + Story 9.5.

**Gate:** core 281 / editor 162 / cli 41 (+2 skip) / mcp 44 / web 77 — 0 fail · desktop Rust 11 pass / 0 warnings · typecheck 7/7 clean.
