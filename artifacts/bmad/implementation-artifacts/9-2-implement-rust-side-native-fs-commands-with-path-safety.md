# Story 9.2: Implement Rust-Side Native fs Commands with Path Safety

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer agent,
I want Rust-side fs commands (read, write, list, delete) that enforce project-root containment and write atomically,
so that the desktop renderer can perform filesystem operations through native IPC without an HTTP layer, with no path-escape or partial-write risk.

## Context (builds on Story 9.1 — done)

Story 9.1 landed the scaffold this story fills in:
- **`packages/desktop/src-tauri/src/commands/mod.rs`** exists and is the command-module home (seam comment reserves it for `fs_commands.rs`). The 4 bridge commands (`get_bridge_state`, `get_desktop_context`, `pick_project_directory`, `open_path`) live there.
- **`lib.rs`** registers commands via `tauri::generate_handler![commands::...]`, manages `Arc<DesktopRuntimeState>` (`pub(crate)`, with `pub(crate) context`), and injects runtime mode + the `/api/local/*` block via the `anydocs-bootstrap` plugin (`bootstrap.rs`).
- Runtime mode = `desktop` is signalled to the renderer and consumed by `@anydocs/core` `resolveRuntimeMode()`.

This story is **additive/non-breaking**: the managed `@anydocs/desktop-server` stays untouched, and the TypeScript `desktop-fs-adapter.ts` that *calls* these commands is **Story 9.3** (not here). The exhaustive atomic fault-injection proof (NFR27, 100% of injected runs) is **Story 9.4** — 9.2 implements the atomic mechanism and basic behavioral tests; 9.4 hardens and proves it.

## Acceptance Criteria

From `epics.md:1061` (Story 9.2):

1. **AC1 — Path containment.** A renderer-invoked fs command canonicalizes the resolved target and **rejects any target outside the active project root** (returns a typed error, performs no I/O).
2. **AC2 — No cross-boundary symlink traversal.** A symbolic link whose canonical target resolves outside the project root is rejected (not followed). Canonicalization-then-prefix-check is the enforcement.
3. **AC3 — Atomic writes.** A write command writes via **write-temp-then-rename** (temp file in the same directory as the target, flushed, then `rename` over the target).
4. **AC4 — Failed writes leave the original unchanged.** If any step of a write fails, the original file (if present) is byte-for-byte unchanged and the temp artifact is cleaned up; the caller receives a typed error.

Implied by "read, write, list, delete project files" (story statement) + architecture: all four commands (`fs_read`, `fs_write`, `fs_list`, `fs_delete`) exist and route through the same containment guard.

## Tasks / Subtasks

- [x] **Task 1 — Establish an authoritative active-project-root in Rust state (enables AC1/AC2)**
  - [x] Path safety MUST be enforced against a root the renderer cannot spoof per-call. Add managed state for the active project root, e.g. `pub(crate) struct ActiveProjectRoot(Mutex<Option<PathBuf>>)` (or extend `DesktopRuntimeState`). Store the **canonicalized** root.
  - [x] Add a `set_active_project_root(path)` command that canonicalizes + stores the root (this is the trusted root; the existing `pick_project_directory` returns a path to the renderer, which then calls this setter). Register it in `generate_handler!`.
  - [x] fs commands take a **relative** path (relative to the active root) — NOT an absolute path from the renderer — then join + canonicalize + containment-check. Document this contract for Story 9.3's adapter.
  - [x] If no root is set when an fs command is invoked → typed error (`NoActiveProjectRoot`), no I/O.
- [x] **Task 2 — Create `commands/fs_commands.rs` with the shared safety guard (AC1, AC2)**
  - [x] New module `packages/desktop/src-tauri/src/commands/fs_commands.rs`; `mod fs_commands;` in `commands/mod.rs` and re-export the commands.
  - [x] Implement a private `resolve_within_root(root: &Path, rel: &str) -> Result<PathBuf, FsError>` helper: reject absolute `rel` and `..`/`.`-escaping components defensively, `root.join(rel)`, then **canonicalize** (resolves symlinks) and assert the canonical path `starts_with` the canonical root. For **non-existent targets** (writes/creates), canonicalize the **parent directory** and join the final component (canonicalize requires existence). Reject if the parent is outside root.
  - [x] Centralize: every command (read/write/list/delete) goes through this one helper — no per-command ad-hoc checks.
- [x] **Task 3 — Implement the four fs commands**
  - [x] `fs_read(rel) -> Result<String, FsError>` (UTF-8 read; the content model is JSON/text).
  - [x] `fs_write(rel, contents) -> Result<(), FsError>` — atomic: create a temp file in the **target's directory** (same filesystem → atomic `rename`), write contents, flush + `sync_all`, then `std::fs::rename(temp, target)`. On any error, remove the temp file and return the error; original untouched (AC3, AC4).
  - [x] `fs_list(rel) -> Result<Vec<DirEntryInfo>, FsError>` — list a directory within root; each entry contained-checked; return name + is_dir (+ maybe size/mtime if cheap).
  - [x] `fs_delete(rel) -> Result<(), FsError>` — delete a file within root (reject directory delete unless explicitly needed; keep minimal for the content model).
  - [x] Define a serializable `FsError` (e.g. `#[derive(Serialize)]` enum with `kind` + `message`) so Story 9.3 can map to typed `FsReadError`/`FsWriteError` TS domain errors. Return `Result<T, FsError>` from commands (Tauri serializes the `Err`).
- [x] **Task 4 — Register + wire**
  - [x] Add all new commands (`set_active_project_root`, `fs_read`, `fs_write`, `fs_list`, `fs_delete`) to `tauri::generate_handler![...]` in `lib.rs`.
  - [x] `cargo build` + `cargo test` under `src-tauri/` pass.
- [x] **Task 5 — Rust tests (behavioral, tempdir-based)**
  - [x] Containment: a `rel` resolving outside root (`../escape`, absolute path) is rejected with no I/O (AC1).
  - [x] Symlink: create a symlink inside root pointing outside; access through it is rejected (AC2). (Use `std::os::unix::fs::symlink`; gate on unix or use `#[cfg(unix)]`.)
  - [x] Atomic happy-path: `fs_write` produces a file with exactly the expected bytes; no leftover temp files in the dir.
  - [x] Atomic safety: writing over an existing file with valid contents replaces it wholesale (no partial mix). (Exhaustive mid-flight fault injection at 100% is **Story 9.4** — keep 9.2's test to the observable contract.)
  - [x] `NoActiveProjectRoot` error when commands run before `set_active_project_root`.
- [x] **Task 6 — Regression gate**
  - [x] `cargo test` (src-tauri) green. `pnpm typecheck` clean. Run `pnpm test` (core+cli+mcp) to confirm no regressions (no TS changed here, but keep the gate honest). **Prereq:** build `desktop-server/dist` + `core/dist` before `cargo build` — `generate_context!` validates bundle resources (see Dev Notes).
  - [x] Update File List + Completion Notes.

## Dev Notes

### Where things live (verified, post-9.1)

- `packages/desktop/src-tauri/src/commands/mod.rs` — command module; add `mod fs_commands;` + re-exports here. Pattern to follow: each handler is `#[tauri::command] pub fn ...`; shared state via `tauri::State<'_, Arc<...>>` (see `get_desktop_context`).
- `packages/desktop/src-tauri/src/lib.rs` — `tauri::Builder` setup; `manage(...)` the new root state alongside `Arc<DesktopRuntimeState>`; extend `generate_handler!`.
- `packages/desktop/src-tauri/Cargo.toml` — `tauri = "2"`, `serde = { version = "1", features = ["derive"] }`, `rfd = "0.15"`. **No new crates required** (std `fs`/`path` + a temp file in-dir is enough). If you reach for `tempfile`, that's a new dependency → call it out (story budget prefers std: create `target.with_extension("tmp-<unique>")` in the same dir).

### Path-safety design (the heart of AC1/AC2)

- **Trust boundary:** the active project root must be authoritative in Rust state, set once via `set_active_project_root` (canonicalized). Never derive containment from a root passed in the same call as the target — that defeats the check.
- **Relative-path contract:** commands accept paths *relative to* the active root. Reject absolute inputs and any component that is `..`. After `root.join(rel)`, `canonicalize()` and verify `canonical.starts_with(canonical_root)`.
- **Canonicalize resolves symlinks** → a symlink escaping the root yields a canonical path outside root → prefix check fails → AC2 satisfied for free. Don't hand-roll symlink detection.
- **Writes to new files:** `canonicalize()` errors if the path doesn't exist. Canonicalize the **parent dir**, containment-check the parent, then operate on `parent.join(file_name)`.
- Use `std::path::Path::starts_with` on canonicalized `PathBuf`s (component-wise, not string prefix — avoids `/root` vs `/root-evil` false matches).

### Atomic write (AC3/AC4)

- Temp file in the **same directory** as the target (cross-dir rename may cross filesystems and not be atomic). Write → `flush()` → `File::sync_all()` → `std::fs::rename(temp, target)` (atomic replace on the same fs).
- On any failure before rename: `let _ = std::fs::remove_file(&temp);` and return the error — original target untouched.
- This is the mechanism; **Story 9.4** injects failures at temp-write and rename steps and asserts the 100%-unchanged guarantee (NFR27). Keep 9.2 tests to the observable contract so 9.4 has room.

### Scope boundaries (do NOT do here)

- ❌ `@anydocs/core/src/fs/desktop-fs-adapter.ts` (TS side calling these commands) → **Story 9.3**.
- ❌ Exhaustive fault-injection / NFR27 proof → **Story 9.4**.
- ❌ Renderer cutover / unifying `isDesktopRuntime` → **Story 9.5**; zero-`/api/local/*` e2e → **Story 9.6**.
- ❌ Removing/altering `@anydocs/desktop-server` — leave it running (architecture.md:876 retains it for static + signaling).

### Architecture compliance

- [Source: architecture.md:858-872] Native fs adapter + **atomicity contract** (write-temp-then-rename; failed writes leave original intact; typed `FsWriteError`) + **path safety** (canonicalization + prefix check; no cross-boundary symlink traversal) + **no duplicate domain logic** (commands adapt I/O only — validation/publication/content-modeling stay in `@anydocs/core`).
- [Source: architecture.md:852-856] Shell exposes a *small* set of Rust commands for native fs; keep the surface minimal (read/write/list/delete + root setter).
- Commands must not embed domain logic (no doc-content validation, no publication filtering) — they are byte/path I/O only.

### Testing standards

- Rust: `cargo test` under `src-tauri/` with `#[cfg(test)]` modules using `std::env::temp_dir()` + unique subdirs (or a tiny tempdir helper). `#[cfg(unix)]`-gate the symlink test. Mirror the existing `bootstrap::tests` style.
- Build prereq (project memory): `pnpm --filter @anydocs/desktop-server build` (rebuilds core too) before any bare `cargo build`/`cargo test` — `generate_context!` validates `tauri.conf.json` `bundle.resources` (`../../desktop-server/dist`, `../../core/dist`). See [[desktop-cargo-build-prereqs]].

### Project Structure Notes

- New file: `packages/desktop/src-tauri/src/commands/fs_commands.rs`. No other new files expected (state can live in `lib.rs` or a small `state.rs` — keep it simple). Matches architecture.md:760 (`fs_commands.rs` under the command dir).

### References

- [Source: artifacts/bmad/planning-artifacts/epics.md#Story 9.2] (epics.md:1061-1077) — ACs.
- [Source: artifacts/bmad/planning-artifacts/architecture.md#Native Filesystem Adapter] (architecture.md:858-872).
- [Source: artifacts/bmad/implementation-artifacts/9-1-scaffold-tauri-shell-in-packages-desktop-src-tauri.md] — command module + state patterns (done).
- [Source: packages/desktop/src-tauri/src/commands/mod.rs] — command/state idioms to follow.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (BMAD dev-story workflow)

### Debug Log References

- `cargo test --lib` (src-tauri): 10 pass (6 fs + 3 bootstrap + 1 require_root), 0 warnings.
- `pnpm typecheck`: 7/7 packages clean.
- Regression gate: core 270 / editor 162 / cli 41 (+2 skip) / mcp 44 / web 77 — 0 fail. :3000 free (prior orphan cleared), CLI Studio test passed.

### Completion Notes List

- **AC1/AC2 (path safety):** `commands/fs_commands.rs` centralizes containment in `resolve_existing` (read/list/delete) and `resolve_for_write` (create — canonicalizes the parent dir since `canonicalize` requires existence). Both `canonicalize()` (resolving symlinks) then assert `starts_with(canonical_root)`. `validate_relative` rejects absolute paths and `..`/prefix components up front. Symlink-escape test (`#[cfg(unix)]`) confirms AC2.
- **AC3/AC4 (atomic write):** `atomic_write` writes a uniquely-named temp file in the **same directory** (pid + atomic counter), `flush` + `sync_all`, then `fs::rename` over target; temp removed on any failure → original untouched. Tests cover exact-contents + no-leftover-temp and wholesale overwrite. Exhaustive mid-flight fault injection remains Story 9.4.
- **Trust model:** authoritative `ActiveProjectRoot(Mutex<Option<PathBuf>>)` managed in Rust, set (canonicalized) via `set_active_project_root`; commands take **paths relative to** that root (renderer cannot spoof root per-call). `NoActiveProjectRoot` error before it's set (testable `require_root` helper).
- **Errors:** serializable `FsError { kind, message }` with `FsErrorKind` (camelCase) for Story 9.3 to map to typed `FsReadError`/`FsWriteError`.
- **Design note vs story:** the planned single `resolve_within_root` helper was split into `resolve_existing` + `resolve_for_write` because `canonicalize()` requires the target to exist — writes must canonicalize the parent instead. Same guarantee, correct semantics.
- **Scope held:** desktop-server untouched; no TS adapter (9.3), no fault-injection (9.4), no renderer cutover (9.5). `fs_write` requires an existing parent dir (no auto-mkdir) — documented; revisit in 9.3/9.5 if new-directory creation is needed.

### File List

- `packages/desktop/src-tauri/src/commands/fs_commands.rs` (new) — `set_active_project_root` + `fs_read`/`fs_write`/`fs_list`/`fs_delete`, path-safety helpers, atomic write, `FsError`, 7 `cargo` tests.
- `packages/desktop/src-tauri/src/commands/mod.rs` (modified) — `pub mod fs_commands;`.
- `packages/desktop/src-tauri/src/lib.rs` (modified) — `ActiveProjectRoot` state + `.manage(...)` + 5 new handlers in `generate_handler!`.

## Change Log

- 2026-06-14 — Story 9.2 implemented: native Rust fs commands (read/write/list/delete) with authoritative project-root containment, symlink-escape rejection, and atomic write-temp-then-rename; serializable `FsError`. Rust 10 tests pass; full gate green. Status ready-for-dev → review.
- 2026-06-14 — Senior Developer Review (AI) → done. 0 CRITICAL/HIGH/MEDIUM. 5 LOW accepted/deferred (see review). No code changes required.

## Senior Developer Review (AI)

**Reviewer:** Shawn (AI adversarial review) · **Date:** 2026-06-14 · **Outcome:** Approve → done

**Scope verified:** All 4 ACs implemented and traced against escape vectors. Every `[x]` task backed by code; File List honest vs git. Additive/non-breaking confirmed (desktop-server untouched; TS adapter correctly left to 9.3, fault-injection to 9.4). Tests are real behavioral assertions (tempdir, actual fs ops), not placeholders.

**Escape-vector trace (all rejected):** parent traversal `..` / absolute paths (pre-I/O in `validate_relative`); direct symlink targets escaping root (`canonicalize` + `starts_with`); writes through a symlinked parent dir (`resolve_for_write` canonicalizes the parent); overwrite of a symlinked target (`fs::rename` replaces the link, never writes through it). AC4 holds by construction — only a successful atomic `rename` mutates the original; both failure branches clean the temp and leave the original intact.

**Findings (all LOW — accepted/deferred, no fixes):**

- 🟢 **L1** — root re-`canonicalize()` on every fs call (redundant syscall). Defensive; perf-only. Accepted.
- 🟢 **L2** — symlink-escape test `#[cfg(unix)]` only; logic is cross-platform but Windows untested (app targets macOS/Linux).
- 🟢 **L3** — AC4 injected-failure proof deferred to **Story 9.4** (NFR27); mechanism correct by construction.
- 🟢 **L4** — `fs_write` requires an existing parent dir (no auto-mkdir); new-language-dir creation would fail. Documented; revisit in 9.3/9.5 if required.
- 🟢 **L5** — TOCTOU window between canonicalize and read/rename; not a realistic single-user-desktop threat. Informational.

**Gate:** desktop Rust `cargo test` 10 pass / 0 warnings · core 270 / editor 162 / cli 41 (+2 skip) / mcp 44 / web 77 — 0 fail · typecheck 7/7 clean.
