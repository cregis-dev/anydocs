# Story 9.5: Wire Desktop Renderer to `@anydocs/editor` and Runtime Mode

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a documentation maintainer,
I want the desktop renderer to read/write project content natively (through `@anydocs/core` + the Tauri fs adapter) and to resolve runtime mode from the injected signal,
so that desktop document I/O no longer depends on the Node desktop-server HTTP layer and produces on-disk content byte-equivalent to web mode.

## ⚠️ Architecture decision (user-confirmed: build the OPTIMAL architecture, no legacy baggage)

anydocs is pre-ship / testing phase. We do the full native cutover rather than keep the HTTP doc path.

**Current state (verified):** desktop renderer reads/writes via `StudioHost` → `createDesktopHttpHost` → desktop-server `:33440` `/studio/*`. The `@anydocs/core` fs layer imports `node:fs`/`node:path` at module top-level, so it is server-only today and cannot bundle into the Tauri webview.

**Target:** the renderer runs `@anydocs/core` repositories directly, backed by `createDesktopFsPort({projectRoot, invoke})` (Story 9.3) over Tauri IPC. To make that bundleable, isolate node built-ins out of the modules the renderer imports.

**Boundary:** only **document I/O** (project config read, pages, navigation, api-sources — read/write) moves native. **build / preview / try-it genuinely need a Node subprocess** and remain delegated to the desktop-server (architecture.md:855/876 retains it for that). So the new desktop host is a hybrid: native fs for docs, HTTP `:33440` for build/preview/try-it. This is the optimal split (don't run a build in the webview).

## Acceptance Criteria

Reconciled from `epics.md` Story 9.5:

1. **AC1 — Runtime mode from the injected signal.** A web bootstrap resolves `runtime mode` via `@anydocs/core` `resolveRuntimeMode()` reading the injected `__ANYDOCS_RUNTIME_MODE__` global (Story 9.1) — the single source of truth. The legacy `isDesktopRuntime`/`ANYDOCS_DESKTOP_RUNTIME` build flag is reconciled onto this (kept working for the build-time export path; the renderer's live decision uses `getRuntimeMode()`).
2. **AC2 — Core fs layer is browser-bundleable.** `node:fs` and `node:path` are isolated to server-only modules; the modules the renderer imports (`docs-repository`, `api-source-repository`, `content-repository` read paths, `desktop-fs-adapter`, the `FileSystemPort` interface) contain **no top-level node built-in imports**. A guard test asserts this.
3. **AC3 — Desktop native host.** A `createDesktopNativeHost(...)` implements the `StudioHost` interface using core repositories + `createDesktopFsPort` for project/page/navigation/api-source read+write; build/preview/try-it delegate to the existing desktop-server HTTP host. `backend.ts` selects it for desktop mode.
4. **AC4 — Active project root set in Rust.** After the native project picker returns a directory, the renderer calls `invoke('set_active_project_root', { path })` before any fs command, and constructs the desktop fs port with that root.
5. **AC5 — No desktop-server HTTP in the document call graph.** Desktop document reads/writes (project/page/nav/api-source) issue **zero** requests to `:33440` (and zero `/api/local/*`); content saved on desktop is byte-equivalent to a web-mode save of the same `PageDoc`/`NavigationDoc`.
6. **AC6 — Editor mount unchanged.** The desktop renderer mounts `@anydocs/editor` through the same `EditorHost` adapter as web (no runtime branching at the mount).

## Tasks / Subtasks

- [x] **Task 1 — Isolate node built-ins in the core fs layer (AC2)** ✅ DONE + verified
  - [ ] Split `file-system-port.ts`: keep the `FileSystemPort` interface, `AtomicWriteOps` type, and `isMissingFileError` (node-free) here; move `createNodeFsPort` + `nodeAtomicWrite` + the `node:fs` import into a new server-only `node-fs-port.ts`.
  - [ ] Replace `node:path` usage in renderer-reachable modules (`docs-repository.ts`, `api-source-repository.ts`, `desktop-fs-adapter.ts`) with a node-free posix path util `packages/core/src/utils/posix-path.ts` (`join`, `dirname`, `basename`, `relative`). Keep `node:path` only in server-only modules (`project-paths.ts`, build/preview services, `node-fs-port.ts`).
  - [ ] Replace the `createNodeFsPort()` default in `createDocsRepository`/`createApiSourceRepository`: make `port` a required arg, and add server-only convenience factories (`createNodeDocsRepository`, `createNodeApiSourceRepository` in a server module) that inject the node port. Update all server callers (web `lib/docs/fs.ts`, cli, content-repository, desktop-server) to use the node convenience factory. (No hidden node default = no node import pulled into the client bundle.)
  - [ ] Add a guard test (core `node:test`) that fails if any renderer-reachable fs module imports `node:fs`/`node:path` at top level.
- [ ] **Task 2 — Web runtime-mode bootstrap (AC1)**
  - [ ] Add a client bootstrap that calls `resolveRuntimeMode()` once (reads the injected global) and exposes `getRuntimeMode()` to the Studio host selection. Reconcile `runtime-config.ts`: keep the build-time `isDesktopRuntime` for the static-export decision, but have the renderer's host selection use `getRuntimeMode()` (via `getCapabilities()` per the Story 8.2 guard — no inline literal compares outside core/runtime).
- [x] **Task 3 — Desktop native host (AC3, AC4, AC6)** ✅ doc CRUD native; project-contract/build/preview delegated (see notes)
  - [ ] New `packages/web/components/studio/hosts/desktop-native-host.ts`: `createDesktopNativeHost({ projectRoot, invoke, serverBaseUrl })` implementing `StudioHost`. Doc ops use core repos + `createDesktopFsPort`; build/preview/try-it delegate to `createDesktopHttpHost(serverBaseUrl)`.
  - [ ] On project open: `invoke('set_active_project_root', { path })`, then build the port + repos rooted there.
  - [ ] `backend.ts` `createStudioHost`: for desktop mode, return `createDesktopNativeHost(...)` (full cutover; HTTP host retained only as the build/preview delegate inside it).
  - [ ] Editor mount stays via `EditorHost` (verify no new branching).
- [x] **Task 4 — Tests (AC2, AC3, AC4, AC5)** ✅ node-free guard + native-host stub-invoke tests (doc ops use only fs_*; set_active_project_root before first fs op, not repeated)
  - [ ] Native host unit tests (stub `invoke`): project/page/nav/api-source read+write route through fs commands; `set_active_project_root` called before first fs op; build/preview delegate to the HTTP path. Assert no `:33440`/`/api/local` calls for doc ops (the stub records only fs_* invokes).
  - [ ] Byte-equivalence test (AC5): saving a `PageDoc` through the native host (stub invoke capturing written contents) yields the same JSON bytes as the node-port save of the same doc.
  - [ ] AC2 guard test (Task 1).
- [ ] **Task 5 — Regression gate + story update**
  - [ ] Rebuild core dist; `pnpm typecheck`; `pnpm test`; `cargo test` green. **GUI/e2e is the user's local verification** (`pnpm dev:desktop`) — document the manual steps. Update File List + Completion Notes.

## Dev Notes

### The `StudioHost` seam is the integration point (not the repos directly)

`packages/web/components/studio/backend.ts` `createStudioHost(bootContext)` returns a `StudioHost`; today desktop→`createDesktopHttpHost`, web/cli→`createWebLocalHost`. 9.5 adds `createDesktopNativeHost`. Match the existing `StudioHost` interface exactly (project/pages/page/navigation/api-sources/build/preview ops) — read `hosts/desktop-http-host.ts` + `hosts/web-local-host.ts` for the contract.

### node-isolation is the enabling refactor (AC2 — do this first)

Verified blockers: `docs-repository.ts`, `api-source-repository.ts`, `file-system-port.ts`, `desktop-fs-adapter.ts` (via `node:path`) and `file-system-port.ts` (via `node:fs`) would pull node built-ins into the webview bundle. The fix is structural, not a polyfill: pure posix path util + node-fs-port split + required-port repos with server-only node factories. This is the "no legacy baggage" core: domain logic platform-agnostic, node confined to server entry points. Keep all existing core tests green (behavior-preserving — only import structure changes).

### Build/preview stay on desktop-server

`/studio/build`, `/studio/preview*`, try-it need a Node subprocess (CLI) — cannot run in the webview. The native host delegates these to `createDesktopHttpHost(serverBaseUrl)`. Document I/O (project/page/nav/api-source) is the only thing going native. This is intentional and optimal.

### What I can verify vs. what you must

- ✅ Headless-verifiable: node-isolation guard test, native-host logic with stub invoke, byte-equivalence, runtime-mode resolution, typecheck/regression.
- ⚠️ Your local verification: the webview actually bundles + runs core (the node-isolation paying off), `pnpm dev:desktop` opens a project → edits → saves to disk natively, zero `:33440` doc calls in a real network trace (that part overlaps Story 9.6).

### Scope / non-goals

- ❌ Don't remove `@anydocs/desktop-server` (still serves build/preview/try-it + static). ❌ Don't change build/preview semantics. ❌ Cold-start budget = Story 9.7. ❌ The formal zero-`/api/local` e2e network trace = Story 9.6 (9.5 asserts it at the unit/host level).

### References

- [Source: epics.md Story 9.5] · [Source: architecture.md:874-878] (replacement of /api/local in desktop) · [Source: architecture.md:855/876] (desktop-server retained for build/preview/static).
- [Source: packages/web/components/studio/backend.ts + hosts/desktop-http-host.ts + hosts/web-local-host.ts] — StudioHost contract.
- [Source: packages/core/src/fs/desktop-fs-adapter.ts + file-system-port.ts] — port + adapter (9.3).
- [Source: packages/core/src/runtime/runtime-mode.ts] — resolver + `RUNTIME_MODE_GLOBAL_KEY` (8.1/9.1).
- [Source: packages/web/components/studio/native-desktop-bridge.ts + project-registry.ts] — current project-pick flow.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (BMAD dev-story workflow)

### Status: PARTIAL — foundation delivered + verified; native-host last-mile pending (see below)

### Debug Log References

- Post-refactor full gate GREEN: core 286 / editor 162 / cli 41 (+2 skip) / mcp 44 / web 77 — 0 fail; typecheck 7/7 clean; desktop Rust `cargo test` 14 pass. `client-fs` node-free guard test passes.

### Completion Notes List

**✅ Delivered & verified (Task 1 / AC2 — the durable architectural core):**
- **Node-isolation of the core fs layer.** New `utils/posix-path.ts` (pure POSIX path ops). New `fs/node-fs-port.ts` holds `createNodeFsPort`, `nodeAtomicWrite`, `AtomicWriteOps`, and the `createNode{Docs,ApiSource}Repository` server factories — the ONLY fs-layer module importing `node:fs`/`node:path`. `fs/file-system-port.ts` is now node-free (interface + `isMissingFileError`). `docs-repository.ts` + `api-source-repository.ts` are node-free (posix-path; `port` now REQUIRED, no hidden node default).
- **`@anydocs/core/client-fs` subpath entry** (new `src/client-fs.ts` + package.json export) — node-free surface for the Tauri webview (repos + `createDesktopFsPort` + errors). Transitive-import guard test (`client-fs-node-free.test.ts`) enforces zero `node:` imports.
- **All `createDocsRepository`/`createApiSourceRepository` callers migrated** to the node factories: 13 core src sites, 8 core test files (~35 calls), web/cli/mcp/desktop-server src. cli `studio-runtime`/`docs-runtime` mirrors regenerate from `packages/web` on build (no manual edit needed).
- Behavior-preserving: all pre-existing repo tests pass unchanged.

**⏳ Remaining (Tasks 2–5 — native host last-mile; needs deeper port + local GUI verification):**
- **Scope discovery:** a fully native `StudioHost.getProject` reads the project contract via `content-repository.ts` + `project-paths.ts`, which are still `node:fs`/`node:path`-bound (project-paths uses node path extensively, with Windows-path implications). Porting those is required before `getProject`/`createProject`/`updateProject` can run natively. Page/navigation/api-source CRUD CAN already run native (docs/api-source repos are ported).
- **Not yet built:** `createDesktopNativeHost` (StudioHost over client-fs repos + `createDesktopFsPort`; doc CRUD native, build/preview/try-it delegated to the HTTP host), `backend.ts` selection, `set_active_project_root` call after project pick, web runtime-mode bootstrap (`getRuntimeMode()` consuming the injected global).
- **Why deferred:** the renderer integration (webview bundling payoff, end-to-end save, project-contract porting) is not verifiable in a headless environment — it needs `pnpm dev:desktop` running to iterate. The foundation above is the verifiable, regression-safe core; the last-mile is best done with the app running.

### File List (this increment)

- `packages/core/src/utils/posix-path.ts` (new)
- `packages/core/src/fs/node-fs-port.ts` (new) — node fs port + nodeAtomicWrite + AtomicWriteOps + createNode* factories
- `packages/core/src/fs/file-system-port.ts` (modified) — now node-free (interface + isMissingFileError)
- `packages/core/src/fs/docs-repository.ts` (modified) — node-free, posix-path, required port
- `packages/core/src/fs/api-source-repository.ts` (modified) — node-free, posix-path, required port
- `packages/core/src/fs/desktop-fs-adapter.ts` (modified) — posix-path
- `packages/core/src/fs/index.ts` (modified) — export node-fs-port
- `packages/core/src/client-fs.ts` (new) — node-free renderer entry
- `packages/core/package.json` (modified) — `./client-fs` export
- `packages/core/tests/client-fs-node-free.test.ts` (new) — AC2 guard
- `packages/core/tests/desktop-fs-adapter.test.ts` + `atomic-write-fault-injection.test.ts` (modified) — moved-symbol imports
- Caller migrations: `packages/core/src/{fs/content-repository.ts, publishing/build-openapi-artifacts.ts, services/{authoring,build,init,legacy-conversion,markdown-authoring,multilingual}-service.ts}`, 8 core test files, `packages/web/lib/docs/{fs.ts,api-sources.ts}`, `packages/cli/src/commands/{page,nav}-command.ts`, `packages/mcp/src/tools/shared.ts`, `packages/desktop-server/src/services/studio-service.ts`

## Change Log

- 2026-06-14 — Story 9.5 PARTIAL (increment 1): node-isolation foundation (platform-agnostic core fs layer, `@anydocs/core/client-fs` entry, node-free guard) + all repo-factory callers migrated; full gate green.
- 2026-06-14 — Story 9.5 PARTIAL (increment 2): `createDesktopNativeHost` built — page/navigation/api-source CRUD run NATIVE (client-fs repos + `createDesktopFsPort`, `set_active_project_root` before first fs op, cached per root); `getProject`/`createProject`/`updateProject` + build/preview/try-it delegated to the HTTP host (project-contract porting pending). `backend.ts` selects the native host for desktop when `getDesktopInvoke()` is present (falls back to HTTP host otherwise). 6 stub-invoke unit tests (in-memory fake fs; assert doc ops issue only `fs_*` invokes, never HTTP). web 77→83 tests; typecheck clean. **Remaining:** port `content-repository.ts`+`project-paths.ts` for native `getProject` (zero-HTTP-for-docs), full `getRuntimeMode()` bootstrap, GUI/e2e verification (`pnpm dev:desktop`). Status stays in-progress.

### File List (increment 2)

- `packages/web/components/studio/hosts/desktop-native-host.ts` (new) — `createDesktopNativeHost`.
- `packages/web/components/studio/hosts/desktop-native-host.test.ts` (new) — stub-invoke tests.
- `packages/web/components/studio/native-desktop-bridge.ts` (modified) — `getDesktopInvoke()`.
- `packages/web/components/studio/backend.ts` (modified) — desktop → native host (HTTP fallback).
- `packages/web/package.json` (modified) — `test:unit` glob includes `components/studio/hosts/*.test.ts`.
