# Desktop Tauri Migration Plan

## Decision Summary

- Replace the legacy desktop shell directly; do not keep a compatibility layer.
- Keep the desktop business backend in Node.js.
- Keep `packages/web` as the only Studio frontend.
- Introduce a dedicated `packages/desktop-server` package for local desktop APIs.
- Rebuild `packages/desktop` as a Tauri shell responsible only for native desktop concerns.

## Target Architecture

### Packages

- `packages/web`
  - The only Studio UI.
  - Uses a desktop host client in desktop runtime.
- `packages/desktop-server`
  - Local Node.js HTTP service for project CRUD, build, and preview.
  - Owns preview lifecycle and desktop-only backend state.
- `packages/desktop`
  - Tauri application shell.
  - Starts and stops the local Node server.
  - Provides native directory picker and menu events.

### Runtime Responsibilities

- Web frontend:
  - Renders Studio.
  - Calls the desktop server over localhost HTTP.
- Desktop server:
  - Reuses current desktop IPC business logic.
  - Exposes `/health` and `/studio/*` HTTP routes.
- Tauri:
  - Starts sidecar processes.
  - Loads the Studio frontend.
  - Emits menu events.
  - Provides native dialogs.

## Delivery Phases

### Phase 0: Host Abstraction

Goal: Remove legacy desktop-shell assumptions from the frontend.

Tasks:

- Introduce a neutral desktop host contract.
- Replace legacy desktop host file naming with runtime-neutral host names.
- Replace direct legacy dialog bridge assumptions with a native bridge abstraction.
- Preserve current `desktop` Studio mode semantics.

Acceptance:

- No legacy desktop-shell naming remains in the `packages/web/components/studio` desktop host path.
- Desktop mode can be wired to a different host implementation without UI changes.

### Phase 1: Desktop Server

Goal: Extract desktop backend behavior into a standalone Node.js service.

Tasks:

- Create `packages/desktop-server`.
- Add a small HTTP server with a shared JSON response shape.
- Add `/health`.
- Add placeholder `/studio/*` routes matching the existing desktop IPC surface.
- Extract preview lifecycle handling into its own runtime module.

Acceptance:

- The desktop server starts independently.
- `/health` responds successfully.
- Route surface matches the intended desktop API contract.

### Phase 2: Frontend HTTP Host

Goal: Switch desktop Studio API calls from the legacy preload bridge to localhost HTTP.

Tasks:

- Add a desktop HTTP host in `packages/web`.
- Route desktop Studio requests through the HTTP host.
- Add a native bridge for directory picker and menu events.
- Keep recent project storage in browser storage for now.

Acceptance:

- The frontend can construct a desktop host without legacy preload bridge globals.
- Native directory picking is abstracted behind a bridge.

### Phase 3: Tauri Shell

Goal: Replace the legacy desktop shell with a Tauri shell.

Tasks:

- Convert `packages/desktop` into a Tauri package.
- Add `src-tauri` configuration and Rust entrypoint.
- Provide a small native bridge for:
  - directory selection
  - desktop context
  - menu events
- Prepare the shell to receive the desktop server base URL.

Acceptance:

- `packages/desktop` is Tauri-based instead of using the legacy desktop shell.
- The package has dev and build scripts suitable for later root integration.

### Phase 4: Full Desktop Loop

Goal: Run the complete desktop workflow in development.

Tasks:

- Update root `dev:desktop` orchestration.
- Start `packages/web`, `packages/desktop-server`, and Tauri together.
- Inject desktop server URL into the frontend runtime.
- Verify project open, edit, save, build, and preview.

Acceptance:

- `pnpm dev:desktop` opens a working Tauri app backed by the Node desktop server.

### Phase 5: Packaging

Goal: Build a distributable desktop app.

Tasks:

- Export static web assets for desktop packaging.
- Bundle desktop server output for Tauri.
- Decide how Node runtime is packaged with the app.
- Validate app startup without the development environment.

Acceptance:

- `pnpm build:desktop` produces an installable desktop artifact.
- The packaged app starts its local backend successfully.

## Desktop Server API Contract

### Response Shape

```ts
type DesktopServerResponse<T> = {
  ok: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
};
```

### Routes

- `GET /health`
- `POST /studio/project/get`
- `POST /studio/project/update`
- `POST /studio/pages/get`
- `POST /studio/page/get`
- `POST /studio/page/save`
- `POST /studio/page/create`
- `POST /studio/page/delete`
- `POST /studio/navigation/get`
- `POST /studio/navigation/save`
- `POST /studio/api-sources/get`
- `POST /studio/api-sources/put`
- `POST /studio/build`
- `POST /studio/preview`

## Backlog

### Track A: Desktop Server

- A1. Scaffold package metadata and TypeScript config.
- A2. Add HTTP server entrypoint.
- A3. Add shared response helpers and error mapping.
- A4. Add `/health`.
- A5. Add Studio route placeholders.
- A6. Port current desktop backend logic from the legacy desktop IPC modules.
- A7. Add preview registry tests.

### Track B: Web Host Migration

- B1. Add neutral desktop host naming.
- B2. Add HTTP desktop host client.
- B3. Add native bridge abstraction.
- B4. Replace current desktop backend host selection.
- B5. Validate recent project flow.

### Track C: Tauri Shell

- C1. Replace legacy desktop package metadata and scripts.
- C2. Add Tauri config and Rust entrypoint.
- C3. Add minimal menu wiring.
- C4. Add directory picker command.
- C5. Add sidecar launch wiring.

### Track D: Root Integration

- D1. Add workspace entry for `packages/desktop-server`.
- D2. Rewrite `scripts/dev-desktop.mjs`.
- D3. Update root `build:desktop`.
- D4. Add desktop verification steps.

## Execution Order

1. A1-A5
2. C1-C4
3. B1-B4
4. A6
5. C5
6. D1-D4
7. A7

## Risks

- The main technical risk is packaging a Node-powered sidecar with the Tauri app.
- Preview lifecycle management must stay inside the Node desktop server to avoid split ownership.
- `packages/web` already has in-flight changes, so integration work there must be done carefully.
