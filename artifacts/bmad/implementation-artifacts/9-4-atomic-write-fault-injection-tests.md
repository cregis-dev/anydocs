# Story 9.4: Atomic Write Fault-Injection Tests (NFR27)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer agent,
I want fault-injection tests that prove the atomic write path leaves the original file untouched when a write fails mid-flight,
so that NFR27's no-partial-write guarantee is verifiable in CI rather than assumed.

## Context (builds on 9.2 + 9.3 — both done)

- **Rust** `atomic_write(target, bytes)` in `packages/desktop/src-tauri/src/commands/fs_commands.rs` (Story 9.2): unique temp in the same dir → `write_all` → `flush` → `sync_all` → `fs::rename`; on any failure `remove_file(temp)` and return `FsError`. Currently has happy-path + overwrite-wholesale tests, but **no injected-failure tests** (9.2 explicitly deferred them here).
- **Node port** `createNodeFsPort().writeFileAtomic` in `packages/core/src/fs/file-system-port.ts` (Story 9.3): `mkdir(recursive)` → write temp → `rename`. This is the web/CLI atomic write. Note: it currently does **not** remove the temp file on failure (inherited from the original `writeJsonAtomic`).
- **Desktop adapter** maps a Rust write failure → typed `FsWriteError` (verified in 9.3's `desktop-fs-adapter.test.ts`).

NFR27's primary subject is the **desktop (Rust) atomic write**; this story proves it deterministically and extends the same guarantee/coverage to the node port.

## Acceptance Criteria

From `epics.md:1097` (Story 9.4):

1. **AC1 — Original unchanged under injected failure (100%).** With a write failure injected at **either** the temp-write step **or** the rename step, the original file on disk is byte-for-byte unchanged in **100%** of injected runs (assert across N≥20 repetitions per injection point).
2. **AC2 — Typed error to the caller.** An injected write failure surfaces a typed error: Rust returns `FsError`; the TS caller (desktop adapter) receives `FsWriteError`.
3. **AC3 — Successful write is complete.** A successful write produces the full expected content with no partial/leftover bytes from a previous attempt, and no leftover temp artifact.
4. **AC4 — Deterministic, CI-runnable injection.** Failures are injected via a testable seam (injectable write/rename steps), not OS-dependent tricks (read-only dirs, disk-full), so the tests are deterministic and runnable headless in CI.

## Tasks / Subtasks

- [x] **Task 1 — Rust: extract an injectable seam in `atomic_write` (AC4)**
  - [x] Refactor `atomic_write` into `atomic_write_with(target, bytes, write_temp, rename)` where `write_temp: impl Fn(&Path, &[u8]) -> std::io::Result<()>` and `rename: impl Fn(&Path, &Path) -> std::io::Result<()>`. Keep the temp-naming, cleanup-on-failure, and error-mapping logic in the seam.
  - [x] `atomic_write(target, bytes)` delegates to `atomic_write_with(..., real_write_temp, real_rename)` (real ops = `File::create`+`write_all`+`flush`+`sync_all`, and `fs::rename`). **Public behavior unchanged.**
- [x] **Task 2 — Rust: fault-injection tests (AC1, AC2, AC3)**
  - [x] Temp-write failure: inject a `write_temp` that creates a partial temp then returns `Err`; assert (a) `atomic_write_with` returns `FsError`, (b) the pre-existing original file is byte-unchanged, (c) the temp artifact is cleaned up. Loop ≥20×.
  - [x] Rename failure: real `write_temp`, inject a `rename` returning `Err`; assert original byte-unchanged, `FsError` returned, temp cleaned up. Loop ≥20×.
  - [x] Both injection points run against a target that **already exists** (seed it first) so "original unchanged" is meaningful; assert exact byte equality to the seed.
  - [x] Success case via the real seam: full expected content, no `*.anydocs-tmp` leftovers.
- [x] **Task 3 — Node port: injectable seam + temp cleanup (AC4, parity)**
  - [x] Refactor `createNodeFsPort().writeFileAtomic` to delegate to an internal `nodeAtomicWrite(absPath, contents, ops)` where `ops` defaults to real `{ mkdir, writeFile, rename, rm }`. **Add temp cleanup on failure** (`rm(temp)` in a `catch`/`finally`) — additive hardening to match the Rust guarantee; behavior for successful writes is unchanged.
  - [x] Export the seam in a test-accessible way (e.g. an internal export used only by tests) without widening the public `FileSystemPort` surface.
- [x] **Task 4 — Core node:test fault-injection (AC1, AC2, AC3)**
  - [x] Node port: inject `writeFile` failure and `rename` failure (via the seam); assert the seeded original file is byte-unchanged across ≥20 runs each, the error propagates, and the temp file is cleaned up. Success case: full content, no leftover temp.
  - [x] Desktop adapter (AC2 end-to-end): a stub `invoke` that rejects `fs_write` with `{kind:'io'}` → `writeFileAtomic` throws `FsWriteError`; and the "original unchanged" guarantee is documented as enforced Rust-side (the adapter performs no partial write itself). (Extends 9.3's existing mapping test.)
- [x] **Task 5 — Regression gate**
  - [x] `cargo test` (src-tauri) green incl. new injection tests; build desktop-server/core dist first ([[desktop-cargo-build-prereqs]]). `pnpm typecheck` + `pnpm test` green — rebuild core dist before cli/mcp ([[cli-consumes-core-via-dist]]). Update File List + Completion Notes.

## Dev Notes

### Deterministic injection seam (the key idea)

Don't simulate failures with read-only directories or disk-full (flaky, OS-specific). Instead inject the failing operation:

**Rust:**
```rust
fn atomic_write_with<W, R>(target: &Path, bytes: &[u8], write_temp: W, rename: R) -> Result<(), FsError>
where W: Fn(&Path, &[u8]) -> std::io::Result<()>, R: Fn(&Path, &Path) -> std::io::Result<()> { /* temp name + cleanup + error map */ }
```
Tests pass a closure returning `Err(io::Error::other("injected"))` at the chosen step. To prove temp cleanup, the failing `write_temp` may create a partial temp first, then the seam's `remove_file(temp)` must delete it.

**Node:**
```ts
type AtomicWriteOps = { mkdir; writeFile; rename; rm };
async function nodeAtomicWrite(absPath, contents, ops: AtomicWriteOps = REAL_OPS) { /* mkdir → write temp → rename; rm(temp) on failure */ }
```

### "Original unchanged" assertion

Seed the target with known bytes (e.g. `"ORIGINAL"`), attempt an injected-failure write of different bytes, then read the target and assert it still equals `"ORIGINAL"` exactly. Repeat ≥20× (AC1's "100% of injected runs"). The rename step is the only mutation of the target; injecting before/at rename guarantees the original is untouched.

### Typed error (AC2)

- Rust returns `FsError{kind:'io', ...}` on injected failure (already the mapping in `atomic_write`).
- The **typed `FsWriteError`** the AC names is the TS caller's view: the desktop adapter maps Rust `FsError` → `FsWriteError` (9.3). 9.3 already has "Rust io error on write maps to FsWriteError"; 9.4 keeps/extends that as the AC2 anchor. The node port surfaces the native/injected error (web/CLI path) — note this distinction.

### Scope / non-goals

- ❌ No renderer wiring / `set_active_project_root` call (Story 9.5). ❌ No `@anydocs/desktop-server` changes. ❌ No new runtime behavior beyond the additive node-port temp-cleanup hardening.
- The refactors (Rust seam, node seam) must keep public behavior identical — existing 9.2/9.3 tests must still pass.

### Architecture compliance

- [Source: architecture.md:862-865] Atomicity contract (NFR27): write-temp-then-rename; failed writes leave the original intact; typed `FsWriteError`. This story is the CI proof of that contract.

### Testing standards

- Rust: `#[cfg(test)]` in `fs_commands.rs`, tempdir-based, loop the injection ≥20×. Build prereqs: [[desktop-cargo-build-prereqs]].
- Core: `node:test` flat in `packages/core/tests/` (e.g. `atomic-write-fault-injection.test.ts`). Rebuild core dist before cli/mcp ([[cli-consumes-core-via-dist]]).

### Project Structure Notes

- Modified: `packages/desktop/src-tauri/src/commands/fs_commands.rs` (seam + tests). `packages/core/src/fs/file-system-port.ts` (seam + temp cleanup).
- New: `packages/core/tests/atomic-write-fault-injection.test.ts` (+ possibly extend `desktop-fs-adapter.test.ts`).

### References

- [Source: artifacts/bmad/planning-artifacts/epics.md#Story 9.4] (epics.md:1097-1112) — ACs.
- [Source: artifacts/bmad/planning-artifacts/architecture.md#Native Filesystem Adapter] (architecture.md:862-865) — atomicity contract.
- [Source: packages/desktop/src-tauri/src/commands/fs_commands.rs] — `atomic_write` (Story 9.2).
- [Source: packages/core/src/fs/file-system-port.ts] — node port `writeFileAtomic` (Story 9.3).
- [Source: packages/core/tests/desktop-fs-adapter.test.ts] — existing FsWriteError mapping test (Story 9.3).

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (BMAD dev-story workflow)

### Debug Log References

- desktop Rust `cargo test`: 14 pass (3 new fault-injection), 0 warnings.
- core `node:test`: 285 pass (+4 atomic fault-injection). Full gate: core 285 / editor 162 / cli 41 (+2 skip) / mcp 44 / web 77 — 0 fail; typecheck 7/7 clean.

### Completion Notes List

- **AC1/AC4 (Rust, deterministic injection):** refactored `atomic_write` → `atomic_write_with(target, bytes, write_temp, rename)` injectable seam; `atomic_write` delegates to `real_write_temp` + `fs::rename` (public behavior unchanged — existing 9.2 tests pass). New cargo tests inject failure at temp-write and at rename (25× each): the seeded original file is byte-unchanged in 100% of runs, an `FsError` is returned, and the temp artifact is cleaned up.
- **AC1/AC4 (node port):** refactored `createNodeFsPort().writeFileAtomic` → internal `nodeAtomicWrite(absPath, contents, ops=REAL_OPS)` injectable seam **and added temp cleanup on failure** (the original inline helper leaked the temp; success-path behavior unchanged). New `node:test` injects writeFile/rename failure (25× each): original byte-unchanged, error rethrown, temp cleaned; success = full content wholesale.
- **AC2 (typed error):** desktop adapter test — a Rust `fs_write` failure (`{kind:'io'}`) surfaces a typed `FsWriteError`; original never partially written (adapter performs no write itself; atomicity is Rust-side).
- **AC3 (success complete):** both Rust and node success-case tests assert full expected content and no `*.anydocs-tmp` leftovers.
- **Behavior-preserving:** both seams keep success-path behavior identical; the only additive change is node-port temp cleanup on failure. All pre-existing 9.2/9.3 tests pass unchanged.
- **Scope held:** no renderer wiring (9.5), no `@anydocs/desktop-server` change.

### File List

- `packages/desktop/src-tauri/src/commands/fs_commands.rs` (modified) — `atomic_write_with` seam + `real_write_temp`; 3 fault-injection tests + `no_temp_leftovers` helper.
- `packages/core/src/fs/file-system-port.ts` (modified) — `nodeAtomicWrite(ops)` seam + `AtomicWriteOps`; node port temp cleanup on failure.
- `packages/core/tests/atomic-write-fault-injection.test.ts` (new) — 4 tests (node port write/rename injection + success + desktop FsWriteError).

## Change Log

- 2026-06-14 — Story 9.4 implemented: deterministic atomic-write fault-injection seams (Rust `atomic_write_with`, node `nodeAtomicWrite(ops)`) + tests proving original-unchanged in 100% of injected runs (NFR27); added node-port temp cleanup on failure. Rust 14 / core 285 pass; full gate green. Status ready-for-dev → review.
- 2026-06-14 — Senior Developer Review (AI) → done. 0 CRITICAL/HIGH/MEDIUM. 3 LOW informational. No code changes required.

## Senior Developer Review (AI)

**Reviewer:** Shawn (AI adversarial review) · **Date:** 2026-06-14 · **Outcome:** Approve → done

**Scope verified:** AC1–AC4 implemented. AC4 confirmed — injection is purely via seam closures (no `chmod`/read-only/disk-full OS tricks; the one "disk failure" string is a stub error message). Seam refactors behavior-preserving: `atomic_write` delegates to real ops, node `writeFileAtomic`→`nodeAtomicWrite` default-real-ops; existing 9.2/9.3 tests pass unchanged (Rust 14 / core 285). Adversarial soundness check: target mutates only via same-dir temp `rename` (atomic same-fs), so injecting before/at rename provably preserves the original; success tests prove full wholesale content; 25× loops verify the temp existed then was cleaned.

**Findings (all LOW — informational, no fixes):**
- 🟢 **L1** — deterministic injection path makes "100% of runs" structural; the loop guards temp-name nondeterminism. Matches AC wording.
- 🟢 **L2** — desktop on-disk "original unchanged" is proven Rust-side (cargo); the adapter test covers error-type mapping only (no Tauri runtime headless — correct).
- 🟢 **L3** — node-port temp-cleanup-on-failure is an additive fix (prior code leaked temp); success path + error type unchanged.

**Gate:** desktop Rust `cargo test` 14 pass / 0 warnings · core 285 / editor 162 / cli 41 (+2 skip) / mcp 44 / web 77 — 0 fail · typecheck 7/7 clean.
