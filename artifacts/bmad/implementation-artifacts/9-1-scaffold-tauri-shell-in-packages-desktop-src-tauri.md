# Story 9.1: Scaffold Tauri Shell in `packages/desktop/src-tauri/`

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer agent,
I want a Tauri shell scaffolded under `packages/desktop/src-tauri/` that boots with an explicit `runtime mode = desktop` signal and blocks `/api/local/*` at the shell layer,
so that desktop builds package the web bundle plus a Rust-side bridge for native operations, and later Epic 9 stories (9.2 native fs commands, 9.3 desktop-fs-adapter) can land on a clean, mode-aware foundation.

## ⚠️ Brownfield Reconciliation (READ FIRST)

The epic was authored as a greenfield "scaffold" story, but **`packages/desktop/src-tauri/` already exists and builds today** (committed in `ce19b70 refactor: migrate desktop runtime to tauri`, hardened in `#69`/`#72`). The existing shell uses a **managed Node `@anydocs/desktop-server` (HTTP :33440)** architecture — which Epic 9 intends to progressively replace with native Rust fs IPC.

**Chosen direction (user-confirmed):** Implement Epic 9 *as written* — native Rust fs, progressively retiring the desktop-server write path. **BUT Story 9.1 is scaffold/foundation only** and MUST stay **additive and non-breaking**:

- ✅ DO: align the existing shell to the Epic 9 shape (command **module directory**), add **explicit `runtime mode = desktop` injection before app code**, add **shell-layer `/api/local/*` blocking + a guard test**.
- ❌ DO NOT (this story): rip out `@anydocs/desktop-server`, remove the managed-server spawn, or implement native fs read/write commands. Those belong to **9.2** (`fs_commands.rs`), **9.3** (`desktop-fs-adapter.ts`), **9.5** (renderer cutover), **9.6** (zero-`/api/local/*` validation).
- 📌 Architecture is explicit (`architecture.md:876`): the desktop-server is **retained** for static asset serving + runtime-mode signaling; only *write routes* get stripped in later stories. "Retiring" = trajectory across 9.x, not a 9.1 deletion.

Keep `pnpm dev:desktop` and `pnpm build:desktop` green throughout.

## Acceptance Criteria

From `epics.md:1043` (Story 9.1), reconciled with current code:

1. **AC1 — Scaffold shape.** `packages/desktop/src-tauri/` contains `tauri.conf.json`, `src/main.rs`, **and a command module directory** (e.g. `src/commands/` with `mod.rs`). The existing inline `#[tauri::command]` handlers in `src/lib.rs` (`get_bridge_state`, `get_desktop_context`, `pick_project_directory`, `open_path`) are moved into this module directory and re-exported; `lib.rs` keeps only `run()` + setup wiring. _(Existing `tauri.conf.json` and `main.rs` already satisfy their part — verify, don't recreate.)_
2. **AC2 — Buildable shell loads web export.** `pnpm build:desktop` (full) produces a runnable shell that loads the existing web static export (`../../web/out` per `tauri.conf.json` `build.frontendDist`). No regression to the existing full/lite build chain.
3. **AC3 — Explicit desktop-mode signal before app code.** When the shell boots, the renderer resolves `runtime mode = desktop` **before any application JS runs** — via an explicit injected global (Tauri `initialization_script`), not solely the defensive `__TAURI_INTERNALS__` probe. The injected signal is consumable by `@anydocs/core`'s `resolveRuntimeMode()` resolution path (Epic 8.1) at the web bootstrap.
4. **AC4 — `/api/local/*` blocked at shell layer.** Renderer-originated network calls to `/api/local/*` are configured to be blocked/denied at the shell layer, and a guard test asserts a desktop-shell-config request to such a path does not reach a handler. _(Control: this story does not change web-mode behavior, where `/api/local/*` remains the dev write surface.)_

## Tasks / Subtasks

- [x] **Task 1 — Extract commands into a command module directory (AC1)**
  - [x] Create `packages/desktop/src-tauri/src/commands/mod.rs`.
  - [x] Move `get_bridge_state`, `get_desktop_context`, `pick_project_directory`, `open_path` into `commands/mod.rs`, keeping `#[tauri::command]` attributes and signatures byte-identical (state injection unchanged). `BridgeState` moved with `get_bridge_state`; shared `DesktopContext`/`DesktopRuntimeState` made `pub(crate)` (with `context` field `pub(crate)`) and stay in `lib.rs`.
  - [x] In `lib.rs`, `mod commands;` and reference `commands::*` in `tauri::generate_handler![...]`. Seam comment in `commands/mod.rs` notes `fs_commands.rs` (Story 9.2) lands in this directory.
  - [x] `cargo build` + `cargo test --lib` under `src-tauri/` pass; handler set unchanged (4 commands).
- [x] **Task 2 — Inject explicit `runtime mode = desktop` before app code (AC3)**
  - [x] Registered a Tauri **plugin `js_init_script`** (`anydocs-bootstrap`, `bootstrap::desktop_bootstrap_script()`) that runs before page scripts and sets `globalThis.__ANYDOCS_RUNTIME_MODE__ = 'desktop'`. (Plugin init script chosen over `WebviewWindowBuilder::initialization_script` because the window is config-defined; see Dev Notes.)
  - [x] Made the injected global consumable by `resolveRuntimeMode()`: added `RUNTIME_MODE_GLOBAL_KEY` + a renderer-global read to `computeCandidate`, ranked **explicit injection → env → injected global → Tauri probe**. Invalid global value throws `RUNTIME_MODE_INVALID_INJECTION` (parity with env). Browser context can't read `process.env`, so this global is the renderer mechanism; the probe remains backstop only.
  - [x] Kept legacy `isDesktopRuntime` working; added a `TODO(Story 9.5)` in `runtime-config.ts` pointing to the unification onto `getRuntimeMode()` + the new global. No legacy refactor.
- [x] **Task 3 — Block `/api/local/*` at the shell layer (AC4)**
  - [x] The same shell-injected bootstrap script wraps `fetch` and `XMLHttpRequest.open`, rejecting any request whose path matches `^/api/local/` — an explicit, shell-controlled deny that runs before app code (not an implicit 404). Seeds Story 9.6's zero-`/api/local/*` validation (FR52).
  - [x] CSP unchanged; the guard matches by **path** (`/api/local/`), so the managed desktop-server (`http://127.0.0.1:33440/studio/*`) is unaffected.
- [x] **Task 4 — Tests + verification**
  - [x] Guard tests added: `cargo test` (`bootstrap::tests`, 3 tests) asserts the injected script sets the desktop mode global and installs the fetch + XHR `/api/local/` guard; core `node:test` (`runtime-mode.test.ts`, +5 tests) covers global recognition, priority ordering, and invalid-value rejection. CI-runnable headless.
  - [x] AC2 verified at the automated level: `cargo build` compiles the shell (incl. `generate_context!` validating `frontendDist: ../../web/out` + bundle resources), and `pnpm --filter @anydocs/web desktop:export` produced `packages/web/out` (with `index.html`) — the bundle the shell loads. Packaged `.app`/DMG build + GUI launch is the gated manual smoke (`docs/desktop-packaged-runtime-smoke-test.md`), not runnable headless here.
  - [~] `pnpm dev:desktop` GUI smoke — gated manual step (requires a desktop session/windowing); not runnable in this headless environment. Documented for the reviewer.
- [x] **Task 5 — Regression gate**
  - [x] `pnpm typecheck` clean (all 7 packages). Regression gate green: core 270 pass / mcp 44 pass / cli 41 pass + 2 skip / 0 fail (core dist rebuilt before cli/mcp consume it). Desktop Rust `cargo test` 3 pass. One CLI Studio test (`studio starts a locked CLI Studio server…`) initially failed due to a pre-existing 13h orphan `next-server` squatting on :3000 (environmental, unrelated to this diff); cleared the port and it passed. `test:acceptance` Playwright e2e NOT run — the only `packages/web` change is a comment-only TODO with zero runtime behavior; typecheck + the web export build cover it (flagged for reviewer).
  - [x] Updated this story's File List + Completion Notes.

## Dev Notes

### Current state of the files you'll touch (verified)

- `packages/desktop/src-tauri/tauri.conf.json` — Tauri **v2** config. `build.devUrl = http://127.0.0.1:3000`, `build.frontendDist = ../../web/out`. Security CSP allows `:33440` (desktop-server). Bundles desktop-server + core dist as resources. **AC1's `tauri.conf.json` requirement is already met — verify only.**
- `packages/desktop/src-tauri/src/main.rs` — 3-line passthrough calling `anydocs_desktop::run()`. **Already satisfies AC1's `main.rs` requirement.**
- `packages/desktop/src-tauri/src/lib.rs` — 388 lines: app menu, **managed Node desktop-server spawn** (`spawn_managed_server`, `create_runtime_state`), 4 inline `#[tauri::command]` handlers, `run()` with `setup` + `invoke_handler` + cleanup. **This is where Tasks 1-3 land.** Keep the managed-server spawn intact (not 9.1's job to remove).
- `packages/desktop/src/native-bridge.ts` — renderer-side Tauri `invoke` wrapper; probes `window.__TAURI_INTERNALS__?.invoke`. Reuse for any renderer signal read.
- `packages/desktop/src/env.d.ts` — declares `__TAURI_INTERNALS__` on window.

### Runtime mode signaling — the crux of AC3

- Epic 8.1 `packages/core/src/runtime/runtime-mode.ts` is DONE and is the single source of truth. Priority: **(1) explicit `injectedMode`** → (2) `ANYDOCS_RUNTIME_MODE` env → (3) Tauri global probe (`__TAURI_INTERNALS__` / `__TAURI__`) as *defensive fallback only*. `resolveRuntimeMode()` resolves once and is immutable; reads via `getRuntimeMode()`.
- The probe path (3) would already return `'desktop'` in a Tauri webview — but the AC and `architecture.md:826` require **explicit injection from host bootstrap**, so implement injection (Task 2) and treat the probe as backstop only.
- The renderer is a **browser context** → cannot read `process.env`. Therefore the host-bootstrap signal must be a **renderer global injected by Tauri before page JS** (`initialization_script`), then read into `resolveRuntimeMode({ injectedMode: 'desktop' })` at the web app's entry. Pick ONE global key and document it.
- ⚠️ **Two runtime concepts exist today and are NOT integrated:** the new Epic 8 `RuntimeMode` (`core`) and the legacy web `isDesktopRuntime` (`packages/web/lib/runtime/runtime-config.ts`, driven by `ANYDOCS_DESKTOP_RUNTIME` + `DEFAULT_DESKTOP_SERVER_BASE_URL = http://127.0.0.1:33440`). Story 9.1 must NOT break the legacy path (desktop currently works through it). Add a TODO that **Story 9.5** unifies the web host onto `getRuntimeMode()`.

### `/api/local/*` blocking — AC4 notes

- In packaged desktop the web **static export** (`web/out`) has no Next.js API routes, so `/api/local/*` would 404 implicitly — but the AC wants an *explicit, testable* shell-layer deny so future regressions (e.g., a web code path re-introducing a `/api/local/*` fetch) fail fast. This directly seeds Story 9.6 (FR52 zero-`/api/local/*` validation).
- Tauri v2 mechanisms to consider: webview request interception / custom protocol handler, or `capabilities`/CSP tightening. Whatever you pick, do not break the legitimate `:33440` desktop-server connection.

### Testing standards

- Repo gate (CLAUDE.md): `pnpm test` minimum; `pnpm test:acceptance` if `packages/web`/Studio/local APIs touched. Rust side: `cargo test` under `src-tauri/`.
- Memory note: editor is consumed via `dist` (rebuild `@anydocs/editor`/`@anydocs/core` before web dev); the acceptance gate can be flaky under load. See [[anydocs-studio-dev-loop]].
- Keep the AC4 guard test CI-friendly; gate any test that needs a live Tauri window and document the manual smoke step (see `docs/desktop-packaged-runtime-smoke-test.md`).

### Project Structure Notes

- Target tree (architecture.md:754-760): `packages/desktop/src-tauri/{tauri.conf.json, src/main.rs, src/commands/…}` with `fs_commands.rs` arriving in 9.2. Story 9.1 establishes `src/commands/` so 9.2 has a home.
- Architectural rule (architecture.md:257, 871-872): `@anydocs/desktop` must NOT fork domain logic; the shell only adapts I/O. Commands stay thin; publication filtering/validation/content modeling remain in `@anydocs/core`.
- Variance from epic wording: epic says "scaffold" but shell exists → this story is **align + harden**, not create. Documented above; no scope expansion beyond the 4 ACs.

### References

- [Source: artifacts/bmad/planning-artifacts/epics.md#Story 9.1] (epics.md:1043-1059) — ACs.
- [Source: artifacts/bmad/planning-artifacts/epics.md#Epic 9] — Desktop Runtime with Native Filesystem; FR52, NFR26, NFR27.
- [Source: artifacts/bmad/planning-artifacts/architecture.md#Tauri Shell Architecture] (architecture.md:848-878) — shell responsibilities, native fs adapter, desktop-server retained for static + signaling.
- [Source: artifacts/bmad/planning-artifacts/architecture.md#Runtime Mode Model] (architecture.md:814-842) — injection priority, capability matrix.
- [Source: packages/core/src/runtime/runtime-mode.ts] — resolver (Epic 8.1, done).
- [Source: packages/desktop/src-tauri/src/lib.rs] — current shell (commands inline, managed-server spawn).
- [Source: packages/desktop/src-tauri/tauri.conf.json] — current Tauri v2 config + CSP.
- [Source: packages/web/lib/runtime/runtime-config.ts] — legacy `isDesktopRuntime` + desktop-server base URL (to be unified in 9.5).
- [Source: docs/desktop-packaged-runtime-smoke-test.md] — packaged-runtime smoke verification.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (BMAD dev-story workflow)

### Debug Log References

- `cargo test --lib` (src-tauri): 3 pass.
- core `node:test` runtime-mode.test.ts: 15 pass (5 new).
- `pnpm typecheck`: 7/7 packages clean.
- Regression gate: core 270 / mcp 44 / cli 41 (+2 skip) / 0 fail.
- Initial CLI flake root cause: orphan `next-server` (PID 30515, 13h uptime) on :3000 → `/api/local/project` returned 400; cleared port, test passed. Not caused by this diff (git showed only intended files changed).

### Completion Notes List

- **AC1 (command module dir):** `src-tauri/src/commands/mod.rs` now owns the 4 IPC commands; `lib.rs` keeps shared state types (`pub(crate)`) + `run()`. `cargo build`/`cargo test` green; handler set unchanged. `fs_commands.rs` (Story 9.2) has a home.
- **AC3 (desktop-mode signal before app code):** Tauri plugin `js_init_script` injects `__ANYDOCS_RUNTIME_MODE__='desktop'` before page JS; `@anydocs/core` `resolveRuntimeMode()` recognizes it as an explicit signal (priority: programmatic → env → injected global → Tauri probe), exported as `RUNTIME_MODE_GLOBAL_KEY`. Legacy `isDesktopRuntime` left intact with a `TODO(Story 9.5)` for unification.
- **AC4 (`/api/local/*` blocked at shell layer):** the same injected script wraps `fetch`/`XHR.open` to reject `^/api/local/` before app code runs; path-based so `:33440` desktop-server is unaffected. `cargo test` asserts the script's invariants. End-to-end network-trace validation is Story 9.6 (FR52).
- **AC2 (buildable shell loads web export):** shell compiles (`generate_context!` validated `frontendDist`), `web/out` builds with `index.html`. Packaged-app GUI launch = gated manual smoke.
- **Scope discipline:** additive/non-breaking per Brownfield Reconciliation — managed `@anydocs/desktop-server` untouched; no native fs read/write (9.2/9.3), no renderer cutover (9.5).
- **Follow-ups for reviewer:** (1) `dev:desktop` GUI smoke + (2) packaged `build:desktop` launch are gated manual steps not runnable headless; (3) `test:acceptance` Playwright e2e skipped (only web change is a comment).

### File List

- `packages/desktop/src-tauri/src/commands/mod.rs` (new) — IPC command module (4 commands + `BridgeState`).
- `packages/desktop/src-tauri/src/bootstrap.rs` (new) — shell bootstrap script (mode global + `/api/local/*` guard) + `cargo test`.
- `packages/desktop/src-tauri/src/lib.rs` (modified) — `mod bootstrap; mod commands;`, `pub(crate)` state types, register bootstrap plugin, handler list → `commands::*`, removed moved code.
- `packages/core/src/runtime/runtime-mode.ts` (modified) — `RUNTIME_MODE_GLOBAL_KEY` + injected-global recognition in `computeCandidate`.
- `packages/core/tests/runtime-mode.test.ts` (modified) — +5 tests for the injected global.
- `packages/web/lib/runtime/runtime-config.ts` (modified) — `TODO(Story 9.5)` unification note (comment only).
- `artifacts/bmad/implementation-artifacts/sprint-status.yaml` (modified) — `epic-9: in-progress`, `9-1: → review`.

## Change Log

- 2026-06-14 — Story 9.1 implemented (additive Tauri shell scaffold): command module extraction (AC1), desktop runtime-mode injection consumed by core resolver (AC3), shell-layer `/api/local/*` block (AC4), shell builds against web export (AC2). Status ready-for-dev → review.
- 2026-06-14 — Senior Developer Review (AI) → done. 0 CRITICAL/HIGH. 1 MEDIUM fixed in-line (M1: native `fetch` re-bound to `globalThis`). 3 LOW accepted/deferred (see review). Rust 3 pass post-fix.

## Senior Developer Review (AI)

**Reviewer:** Shawn (AI adversarial review) · **Date:** 2026-06-14 · **Outcome:** Approve → done

**Scope verified:** All 4 ACs implemented; every `[x]` task backed by code; File List matches `git status` exactly (no false claims, no undocumented changes). Additive/non-breaking confirmed — `@anydocs/desktop-server` and native fs untouched (correctly left to 9.2/9.3/9.5).

**Findings:**

- 🟡 **M1 (MEDIUM) — FIXED.** `bootstrap.rs` fetch guard invoked native `fetch` via `apply(this, …)`; relied on non-strict `this === globalThis`. Re-bound to `originalFetch.apply(globalThis, arguments)` to avoid WebKit "Illegal invocation" under a strict context. (XHR `apply(this, …)` left as-is — correct, `this` is the XHR instance.) Also set the runtime-mode global `enumerable: false` to shrink global footprint (core reads it by direct access, unaffected). `cargo test` 3 pass post-fix.
- 🟢 **L1 (LOW) — accepted/deferred.** `/api/local/*` guard covers `fetch` + `XMLHttpRequest` only (not `sendBeacon`/`EventSource`/form-submit). `/api/local/*` is fetch-based in this app; full network-trace surface validation is Story 9.6 (FR52).
- 🟢 **L2 (LOW) — accepted/deferred.** `cargo` tests assert injected-script content (shell-config level), not JS execution. Behavioral guard validation is e2e in Story 9.6; the core resolver's global recognition *is* behaviorally tested (`node:test`).
- 🟢 **L3 (LOW) — informational.** Block is shell-injected JS (runs before app code) rather than a Rust network-layer interceptor; acceptable for the scaffold, candidate for later hardening.

**Gate:** core 270 / mcp 44 / cli 41 (+2 skip) / 0 fail · desktop Rust 3 pass · typecheck 7/7 clean · web export builds. CLI :3000 flake was a pre-existing orphan server (environmental), resolved.
