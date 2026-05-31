# Story 6.2: Implement Plate-Based Block Runtime Inside the Package

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer agent,
I want `@anydocs/editor` to host a real Plate-based block runtime internally,
so that the contract-bound `EditorInstance` returned by `createEditor` actually edits documents — replacing the placeholder runtime from Story 6.1 with a Slate/Plate-backed engine that downstream stories (6.3 converters, 6.4 plugin contract, 7.x Studio dual-mount) can integrate against.

## Acceptance Criteria

1. `packages/editor/src/runtime/plate-runtime.ts` exists and is the internal implementation backing `createEditor`. The placeholder runtime (`placeholder-editor.ts`) is removed or relegated to a no-op path that the public factory no longer selects. `createEditor(config)` returns a Plate-backed `EditorInstance`, NOT the Story 6.1 placeholder.
2. `EditorInstance.mount(target: HTMLElement)` renders a Plate-backed editor surface into `target` and returns an `UnmountHandle`. After calling the handle, `target` contains no Plate-injected DOM and no React-managed event listeners attached by Plate to `target` or its descendants.
3. After mount with `EditorConfig.initialContent`, the editor renders the initial document to the host element. For the block types covered by this story (paragraph, heading levels 1–3), the rendered DOM contains the expected elements (`<p>` for paragraph, `<h1>`/`<h2>`/`<h3>` for headings) with the configured text content present.
4. `EditorInstance.getContent()` returns a `DocContentV1` payload that matches the canonical `doc-content-v1` shape from `@anydocs/core` (`{ version: 1, blocks: [...] }`). For documents composed only of paragraph and heading blocks, calling `setContent(payload)` followed by `getContent()` returns a structurally equivalent payload (same block type ordering, same heading levels, same text children, same text marks).
5. `EditorInstance.setContent(payload)` updates the rendered surface. After `setContent`, `getContent()` reflects the new payload. Repeated `setContent → getContent` cycles produce stable output for the same input.
6. `EditorInstance.on('change', handler)` fires the registered handler at least once when content changes via `setContent` (i.e. host-triggered changes), passing the new content payload (or a payload-derivable signal — implementation choice; documented in story). The returned disposer unsubscribes the handler. `on('selection-change', ...)` and `on('agent-anchor-triggered', ...)` MAY remain placeholders that throw `EditorNotImplementedError` or accept but never fire — Story 6.4 / Story 11.7 own these.
7. `EditorInstance.triggerAgent(scope, payload)` continues to throw `EditorNotImplementedError`. Agent runtime is explicitly out of scope for Story 6.2 (Stories 11.3–11.5 implement it). The story must explicitly preserve the existing error behavior so consumers cannot mistakenly assume Agent invocations are wired up.
8. Mount/unmount lifecycle is leak-free across cycles: a sequence `instance.mount(target) → unmount() → instance.mount(target) → unmount()` leaves `target.childNodes.length === 0` and `target.outerHTML === '<host-element></host-element>'` (modulo intrinsic attributes). Verified via DOM assertions in a jsdom-backed unit test.
9. The internal Plate runtime is NOT re-exported through the package entry. `packages/editor/src/index.ts` continues to expose only the five symbols frozen by Story 6.1, and Story 6.5's `contract:check` regression test continues to pass (no contract drift).
10. The full repo regression gate (`pnpm test` + `pnpm typecheck` + `pnpm build`) remains green. Lint warnings are not increased. The bundle-size growth from adding Plate is acknowledged and accepted at this story; an enforceable size budget can land in a later cleanup task if desired.

## Tasks / Subtasks

- [x] Decide the Plate package set and add devDependencies (AC: 1, 10)
  - [x] Adopt Plate's current stable major (verify `@udecode/plate` latest at pickup; current as of 2026-05 is v45+). Pin to a single major across all `@udecode/plate-*` packages to avoid version skew.
  - [x] Required runtime packages (minimum viable set for paragraph + heading):
    - `@udecode/plate` (umbrella entry; provides `createPlateEditor`, `Plate`, `Editable` re-exports)
    - `@udecode/plate-heading` (heading 1–3 plugin)
    - `slate` (Slate core; required peer of Plate)
    - `slate-react` (Slate React renderer; required peer of Plate)
    - `slate-history` (Slate undo/redo; required peer for default Plate stack)
  - [x] Required devDependencies for testing:
    - `jsdom` — DOM environment for mount/unmount lifecycle tests. Editor tests use Node built-in test runner; jsdom is invoked manually via `new JSDOM(...)` inside test cases, NOT as a global test runner replacement.
    - `@types/jsdom` — TypeScript types.
  - [x] Add the packages to `packages/editor/package.json` `dependencies` (Plate + slate trio — these ship to consumers and must NOT be peer-only because the editor is the trusted internal owner of the runtime) and `devDependencies` (jsdom + types).
  - [x] Run `pnpm install` and verify the lockfile diff: no version conflicts with the existing Yoopta / Slate-0.123.0 pins from `packages/web`.
  - [x] Verify the bundle stays reasonable (`pnpm --filter @anydocs/editor build` succeeds; `dist/` size is not enforced but document the post-build size in Dev Agent Record for reference).
- [x] Implement `plate-runtime.ts` — the editor instance factory (AC: 1, 2, 3, 5, 8)
  - [x] Create `packages/editor/src/runtime/plate-runtime.ts`. Export `createPlateEditorInstance(config: EditorConfig): EditorInstance`.
  - [x] Inside the factory:
    - Build a Plate editor via `createPlateEditor({ plugins: [headingPlugin(), ...] })`. Plugins for paragraph (Plate default), heading.
    - Convert `config.initialContent` (DocContentV1) into the Plate value via the minimal converter from Task 4. Pass the result as the editor's initial state.
    - Set up an internal event bus (`Map<'change' | 'selection-change' | 'agent-anchor-triggered', Set<handler>>`).
    - Hook the Plate editor's `onChange` to dispatch the `change` event to all subscribed handlers with the freshly-converted DocContentV1 payload.
    - Track the React root created during `mount()` so `unmount()` can call `root.unmount()` cleanly.
  - [x] Implement the five `EditorInstance` methods:
    - `mount(target)`: dynamically import `react-dom/client.createRoot` (the import is safe at module load time, but `createRoot` requires DOM — keep the call inside `mount`). Render `<Plate editor={editor}><Editable /></Plate>`. Return an `UnmountHandle` that:
      - Calls `root.unmount()` — releases the React tree.
      - Resets the tracked root reference so a subsequent `mount` reinitializes cleanly.
      - Throws if called when not mounted.
    - `getContent()`: read `editor.children` and convert to `DocContentV1` via the converter from Task 4. Throw a clear error if called before any `setContent` / mount has produced a usable Plate value (defensive: should not happen if `initialContent` is always required by `EditorConfig`).
    - `setContent(payload)`: validate `payload.version === 1` (cheap shape check; full validation lands with Story 6.4). Convert to Plate value. Apply via `editor.children = newValue` + trigger a re-render through Slate's normalization or Plate's `editor.tf.reset` (whichever the current Plate version exposes). Dispatch the `change` event.
    - `on(event, handler)`: register in the event bus. Return a disposer that removes the handler. For `selection-change` and `agent-anchor-triggered`, MAY accept the subscription but NEVER fire (document in code comment).
    - `triggerAgent(scope, payload)`: throw `EditorNotImplementedError` with a message pointing at Stories 11.3–11.5 + 11.7.
- [x] Wire `createEditor` to the Plate runtime (AC: 1, 9)
  - [x] In `contract/public-api.ts`, replace the call to `createPlaceholderEditor(config)` with `createPlateEditorInstance(config)`.
  - [x] **Critical**: Do NOT modify the function signature or any other contract symbol — only swap the internal call. Story 6.5's `contract:check` test will fail loudly if the signature drifts; this is the desired safety net.
  - [x] Decide the fate of `packages/editor/src/runtime/placeholder-editor.ts`: delete it OR keep it for explicit test use of the placeholder (e.g. unit tests of the not-implemented error path). Recommended: delete to reduce surface area; the `EditorNotImplementedError` class remains for `triggerAgent` path.
  - [x] Run `pnpm --filter @anydocs/editor contract:check` after the swap — expected output: "contract is in sync". If it diverges, you accidentally changed a contract type; revert and investigate.
- [x] Implement minimal `doc-content-v1` ↔ Plate converters for paragraph + heading (AC: 3, 4, 5)
  - [x] Create `packages/editor/src/converters/doc-content-to-plate.ts`:
    - Export `docContentToPlateValue(payload: DocContentV1): Value` (where `Value` is the Slate value type re-exported from `slate`).
    - Map `paragraph` blocks to Plate `{ type: 'p', children: [...inline] }`.
    - Map `heading` blocks (level 1/2/3) to Plate `{ type: 'h1' | 'h2' | 'h3', children: [...inline] }`.
    - Map inline `text` nodes to Plate `{ text: string, ...marks }` (marks as boolean keys: `bold`, `italic`, `underline`, `strike`, `code`).
    - Map inline `link` nodes — for Story 6.2, paragraph/heading-only scope. Links may be deferred to Story 6.3 if Plate's default link plugin is not included here; if you defer, the converter should treat link children as plain text (lossy but typed). Document the choice in Dev Agent Record.
    - For any UNKNOWN block type (list, code, image, etc.), throw a typed error referencing Story 6.3 / 6.4 ("Block type 'X' is not yet supported by the Story 6.2 minimal converter. Story 6.3 expands coverage."). DO NOT silently drop blocks.
  - [x] Create `packages/editor/src/converters/plate-to-doc-content.ts`:
    - Export `plateValueToDocContent(value: Value): DocContentV1`.
    - Inverse mapping of the above. For unknown Plate node types, throw the symmetric typed error.
    - Mark normalization: emit `marks` only when at least one mark is `true` to keep `getContent` output minimal and round-trip-equal to inputs that omit `marks`.
  - [x] Both files MAY share a `mark-mapping.ts` utility for the bidirectional `marks?: TextMark[]` ↔ `{ bold?, italic?, ... }` conversion.
  - [x] These converters are deliberately scoped to "what 6.2 needs to satisfy its AC". Story 6.3 expands them to all 11 block types from `DOC_CONTENT_BLOCK_TYPES`. Note this in code comments — DO NOT prematurely add stubs for unsupported types.
- [x] Implement the event bus (AC: 6)
  - [x] Inline within `plate-runtime.ts` (small enough not to warrant its own file).
  - [x] Type: `EventName = 'change' | 'selection-change' | 'agent-anchor-triggered'`.
  - [x] `change` events fire on every Plate `onChange` invocation. Each handler receives the freshly-converted DocContentV1 payload (computed lazily — only convert once even if multiple handlers are subscribed).
  - [x] Subscribing the same handler twice produces two registrations (matches Set-of-handler semantics where identity is reference-based).
  - [x] Disposing a handler is idempotent (calling the disposer twice is safe).
- [x] Bump `packages/editor/contract/contract.json` if and only if the contract surface changed (AC: 9)
  - [x] **Expected**: contract.json is UNCHANGED. The five exports stay byte-identical because we only swap internal wiring.
  - [x] If the contract:check test reports drift after the swap, you have accidentally changed an exported type or function signature — investigate and revert before continuing.
- [x] Author unit tests for the converter layer (AC: 4, 5)
  - [x] Create `packages/editor/tests/plate-converter.test.ts`:
    - Round-trip a paragraph-only DocContentV1 fixture → Plate value → back to DocContentV1; assert deep equality.
    - Round-trip a heading-only fixture (one block at each of levels 1/2/3).
    - Round-trip a mixed paragraph + heading fixture.
    - Round-trip a paragraph with marked text (bold + italic + code) and assert mark preservation.
    - Assert that an unsupported block type (`{ type: 'image', src: 'x' }`) throws a typed error from the doc→plate converter.
    - Assert that an unknown Plate node type (`{ type: 'unknown', children: [] }`) throws from the plate→doc converter.
    - Snapshot equivalence: a known DocContentV1 fixture serialized to Plate is deeply equal to a hand-written expected Plate value (one or two key cases — exhaustive Plate-shape snapshots belong to Story 6.3's converter expansion).
- [x] Author DOM-backed mount/unmount lifecycle tests (AC: 2, 3, 8)
  - [x] Create `packages/editor/tests/plate-runtime.test.ts`:
    - Set up a jsdom DOM at the top of each test (or in a `beforeEach`-style hook — the Node built-in test runner uses `t.beforeEach`).
    - Test: `createEditor({...paragraph-only initial content...}).mount(target)` populates `target.childNodes.length > 0` and the DOM contains the initial text.
    - Test: `mount(target)` returns a disposer; calling the disposer reduces `target.childNodes.length` to 0.
    - Test: `mount → unmount → mount → unmount` cycle leaves `target.childNodes.length === 0` and no listener leaks (use `target.cloneNode().toString()` before/after to compare snapshots).
    - Test: `getContent()` after mount returns the same payload structurally as the initial content.
    - Test: `setContent(newPayload)` updates the rendered DOM (assert new text appears in `target.textContent`) AND `getContent()` returns the new payload.
    - Test: `on('change', handler)` fires the handler after `setContent`. Returns a disposer; after disposing, subsequent `setContent` does NOT fire the handler.
    - Test: `on('selection-change', handler)` accepts the subscription (no throw) but does NOT fire when content changes (the placeholder event behavior is documented and acceptable for 6.2).
    - Test: `triggerAgent('inline', {})` throws `EditorNotImplementedError` with a message naming Stories 11.x.
  - [x] Use `globalThis.document = jsdom.window.document` / `globalThis.window = jsdom.window` at the start of the test file (and restore in an `after`-hook) so React-DOM can find a DOM. Alternatively, wrap the React-DOM imports inside the test setup so they only resolve when DOM is present.
- [x] Confirm the contract-snapshot regression test still passes (AC: 9)
  - [x] Run `pnpm --filter @anydocs/editor test` and confirm the existing 39 tests still pass alongside the new ones.
  - [x] If `contract-snapshot.test.ts` fails, you accidentally widened the contract — revert and investigate.
- [x] Update Dev Agent Record + README (AC: 10)
  - [x] Update `packages/editor/README.md`:
    - In the "Internal layout" section, change `src/runtime/` from "placeholder runtime now; Plate in Story 6.2" to "Plate-based runtime (Story 6.2)".
    - Add a short "Runtime engine" section noting that Plate is the chosen engine, why (Slate-based, plugin-extensible, mature React 19 support), and that converters live under `src/converters/`.
  - [x] In Story 6.1's File List (`packages/editor/src/runtime/placeholder-editor.ts`) note its removal if you delete it.
- [x] Run the full regression gate (AC: 10)
  - [x] `pnpm --filter @anydocs/editor typecheck` → exit 0
  - [x] `pnpm --filter @anydocs/editor test` → all tests pass (39 from Story 6.5 + ~12 new = ~51)
  - [x] `pnpm --filter @anydocs/editor build` → emits `dist/src/runtime/plate-runtime.*` plus the existing surface; verify no `dist/scripts/*` leakage
  - [x] `pnpm --filter @anydocs/editor contract:check` → in sync
  - [x] `pnpm typecheck` (root) → all 7 packages clean
  - [x] `pnpm test` (root) → all packages green
  - [x] `pnpm lint` → no new errors / no new warnings beyond existing 18
  - [x] `pnpm build` (root) → all packages build clean (NB: `@anydocs/web` still depends on Yoopta until Story 7.x; the editor package adding Plate must NOT break the web build)

## Dev Notes

- **This is the largest Phase 2 editor story.** Story 6.1 was scaffolding; 6.2 is the actual runtime engine. Expected scope: ~600–1000 LOC implementation + ~300 LOC tests + ~30 transitive devDependencies for Plate.
- **Plate version pinning matters.** Plate has had API churn between major versions (notably v30 → v34 → v40). Pin to a single current-stable major across all `@udecode/plate-*` packages. Reference `platejs.org` (Plate's docs) at pickup time for the canonical setup example.
- **Coexistence with Yoopta during Phase 2.** `packages/web` still uses Yoopta for Studio until Story 7.3 cutover. Adding Plate to `packages/editor` is additive — no Yoopta packages are touched in 6.2. Lockfile may show new pnpm peer-dep warnings; verify these are NEW warnings caused by Plate, not regressions in Yoopta.
- **Bundle-size discipline.** Plate brings in significant code. Story 6.2 does NOT enforce a budget, but Dev Agent Record should record the post-build `dist/` size (run `du -sh packages/editor/dist`) as a baseline for future cleanup stories.
- **No bundler config changes.** The editor's `tsconfig.json` (`module: ESNext`, `target: ES2020`) is sufficient — Plate ships ESM and supports tree-shaking. Do not add Vite/esbuild/etc. unless Plate refuses to compile under plain `tsc`.
- **DOM testing strategy.** This repo has not previously needed DOM testing in unit tests (Playwright handles e2e). Story 6.2 introduces `jsdom` as a devDep for `packages/editor`. Use it locally inside test cases via `new JSDOM(...)`; do NOT set up jsdom as a global test environment because the Node built-in test runner does not have a "test environment" concept like Jest/Vitest.

### Developer Context

**Business objective**
- Replace Story 6.1's placeholder with a real editor runtime so the contract from 6.1 + 6.5 is actually exercised against working code.
- Unblock Story 6.3 (full converter coverage) and Story 6.4 (plugin contract migration) — both need a working Plate runtime as their substrate.
- Unblock Studio dual-mount (Story 7.2) — Studio needs a mountable Plate-backed editor to compare against Yoopta in parity fixtures.

**Current code baseline (post Stories 6.1 + 6.5)**
- `packages/editor/contract/public-api.ts` declares five symbols. `createEditor` currently calls `createPlaceholderEditor(config)` (line 109).
- `packages/editor/src/runtime/placeholder-editor.ts` returns an `EditorInstance` whose every method throws `EditorNotImplementedError`. This is what gets swapped out.
- `packages/editor/src/runtime/plugin-registry.ts` exists from Story 6.1 (still in-memory placeholder; full plugin contract validation lands in Story 6.4 — out of scope here).
- `packages/editor/contract/contract.json` is the locked snapshot. Story 6.2 must NOT cause drift; the snapshot test from 6.5 enforces this.
- `pnpm test` regression gate is currently 274 tests green. After 6.2 it should be ~286+.

**Current code baseline (Yoopta — reference only, do not touch)**
- `packages/web/components/studio/yoopta-doc-editor.tsx` shows the existing editor host pattern: how marks/plugins/themes are composed, how Studio hands off content. Useful for INSPIRATION on which plate plugins to choose, but do not copy code into the editor package.
- `packages/core/src/utils/doc-content-adapter.ts` already has `yooptaToDocContent` / `docContentToYoopta` — the SHAPE of the bidirectional adapter is a useful template. The new `plate-runtime.ts` converter is structurally similar but maps to Plate values, not Yoopta.

**Phase scope discipline**
- Out of scope: List / code / image / callout / table / divider / mermaid / blockquote / codeGroup converters → Story 6.3.
- Out of scope: EditorPlugin contract / plugin auto-registration → Story 6.4.
- Out of scope: Agent anchors / `triggerAgent` real implementation → Story 11.x.
- Out of scope: Studio integration / feature flag / dual-mount → Story 7.x.
- Out of scope: Performance budgets, bundle-size assertions → future cleanup story.
- Out of scope: Touching `packages/web/components/studio/yoopta-doc-editor.tsx` or any other web-side editor surface — Story 7.x retires Yoopta, not 6.2.

### Technical Requirements

- **TypeScript strict mode**: Plate + Slate types are well-typed. `noUnusedLocals` / `noUnusedParameters` (set by Story 6.1) MUST stay passing. If a Plate plugin requires an underscore-prefixed unused parameter, that is acceptable.
- **No vendor name leakage in the contract**: `contract/public-api.ts` MUST not import from `@udecode/plate` or `slate`. The runtime / converter modules may import freely. Story 6.5's contract-snapshot diff is the safety net.
- **SSR safety (importability in Node)**: `import('@anydocs/editor')` must succeed in Node without DOM. This means the import GRAPH of the package entry must not transitively execute Plate code that requires DOM at module-load time. Strategy: `react-dom/client` is imported at module load (the import is DOM-free), but `createRoot` is only CALLED inside `mount()`.
- **Determinism for `getContent`**: For the same Plate `editor.children`, `getContent()` must return the same DocContentV1 payload — no JSON-stringify with timestamps, no random UUIDs (block IDs are optional in DocContentV1; if you generate them, persist them in the Plate node and re-use across `getContent` calls).
- **Event bus semantics**: handlers are called synchronously in registration order. Errors thrown by a handler do not block other handlers (wrap in try/catch and log via `console.error`, or document the chosen semantics — Plate users will expect at-least-once delivery).

### Architecture Compliance

- Implements Migration Strategy Phase 1 ("Foundation: Create `@anydocs/editor` package with the public API contract. Internally implemented over Plate."). [Source: architecture.md → Migration Strategy: Yoopta → Plate]
- Canonical storage stays `doc-content-v1` — Plate is RUNTIME only. The converters under `src/converters/` are the boundary; nothing outside `@anydocs/editor` ever sees a Plate value. [Source: architecture.md → Canonical storage stays `doc-content-v1`. Plate is the runtime engine, never the storage format.]
- Internal Plate types MUST NOT be re-exported through the package entry. Story 6.5's contract-snapshot test enforces this. [Source: architecture.md → Contract enforcement; Story 6.1 AC5]
- Architectural boundary: `@anydocs/editor` may depend on `@anydocs/core` for `doc-content-v1` types; it must NOT depend on `@anydocs/web` or `@anydocs/desktop`. Plate + slate are external NPM packages, not internal workspace packages — adding them does not violate the architectural boundary. [Source: architecture.md → Phase 2 Architectural Boundaries (Updates)]
- Naming conventions: kebab-case filenames (`plate-runtime.ts`, `doc-content-to-plate.ts`), camelCase functions (`createPlateEditorInstance`), PascalCase types (`EditorInstance`). [Source: Phase 1 architecture Naming Patterns]

### Library / Framework Requirements

- **Plate** — current stable major. Recommended package set:
  - `@udecode/plate` (umbrella; re-exports core + commonly used APIs)
  - `@udecode/plate-heading` (heading element plugin)
  - The full plugin set (list/code/image/callout/table/divider) is deferred to Story 6.4.
- **Slate** — Plate's underlying engine. Pull `slate`, `slate-react`, `slate-history` as direct deps (peer of Plate). Pin to versions compatible with the chosen Plate major.
- **React 19** — already peerDependency from Story 6.1. No change.
- **jsdom + @types/jsdom** — devDep ONLY. Used in `tests/plate-runtime.test.ts` for DOM-backed lifecycle assertions.
- **No new build tooling**: still `tsc` build, `node --experimental-strip-types` for tests. If Plate ships TypeScript that `tsc` can't consume directly, raise it as a HALT condition — do NOT smuggle in Vite/esbuild.

### File Structure Requirements

**To create:**

```
packages/editor/
├── src/
│   ├── runtime/
│   │   └── plate-runtime.ts            ← NEW: Plate-backed EditorInstance factory + event bus
│   └── converters/
│       ├── doc-content-to-plate.ts     ← NEW: minimal paragraph + heading + marks
│       ├── plate-to-doc-content.ts     ← NEW: inverse mapping
│       └── mark-mapping.ts             ← NEW (optional): shared mark <-> boolean key util
└── tests/
    ├── plate-converter.test.ts         ← NEW: round-trip + error-path tests
    └── plate-runtime.test.ts           ← NEW: jsdom-backed mount/unmount/lifecycle tests
```

**To modify:**

- `packages/editor/contract/public-api.ts` — swap `createPlaceholderEditor(config)` for `createPlateEditorInstance(config)` (one line; DO NOT change function signature)
- `packages/editor/package.json` — add Plate + slate deps, jsdom devDep
- `packages/editor/README.md` — update "Internal layout" section, add "Runtime engine" subsection
- `packages/editor/src/runtime/placeholder-editor.ts` — **delete** (recommended) OR retain as `/* @deprecated */` reference. Recommendation: delete to reduce surface area; `EditorNotImplementedError` remains useful for `triggerAgent` and lives in `not-implemented-error.ts` (separate file from `placeholder-editor.ts`).

**Reference-only (do not modify):**

- `packages/editor/contract/contract.json` — auto-regenerated by `contract:update` if surface ever changes. Should NOT change in this story.
- `packages/editor/scripts/extract-contract.ts` — Story 6.5 tooling; no edits needed.
- `packages/web/components/studio/yoopta-doc-editor.tsx` — Yoopta integration; reference for plugin patterns only.
- `packages/core/src/utils/doc-content-adapter.ts` — Yoopta converter pattern; reference shape.

**Out of scope for this story:**

- `packages/editor/src/plugins/builtin/*` — Story 6.4 lands these.
- `packages/web/lib/editor-host/*` — Story 7.1 introduces this.
- Any change to `packages/desktop/*` — Story 9.5 wires desktop to editor.
- Any change to `packages/web/components/studio/*` — Studio cutover is Story 7.3.

### Testing Requirements

- All new tests live in `packages/editor/tests/` and use the Node built-in test runner.
- `tests/plate-converter.test.ts` — pure unit tests, no DOM. Round-trip + error-path assertions.
- `tests/plate-runtime.test.ts` — jsdom-backed integration. Set up DOM in `t.beforeEach`-style hooks; tear down in `t.afterEach`.
- Coverage targets:
  - Every converter branch (paragraph, heading×3 levels, marks) covered by at least one test.
  - Every `EditorInstance` method touched by at least one mount/unmount-cycle test.
  - The unsupported-block-type error path explicitly asserted (otherwise Story 6.3 would have to fix a silent-drop regression).
- Performance: tests should complete in < 5s total. If jsdom mount is slow (~100ms per test is normal), keep the test count tight.
- The existing 39 tests must continue to pass. The contract-snapshot test (`tests/contract-snapshot.test.ts`) is the canary — if it fails, the public surface drifted.

### Previous Story Intelligence (Stories 6.1 + 6.5)

- **Story 6.1 established**: 5-symbol contract, `dist/src/*` build layout, Node built-in test runner pattern, strict-mode-friendly typecheck script (`pnpm --filter @anydocs/core build && tsc --noEmit -p tsconfig.json`).
- **Story 6.5 added**: contract-snapshot regression test (load-bearing), `scripts/tsconfig.json` noEmit typecheck path, `contract:update` / `contract:check` CLI. The `contract:check` is the SAFETY NET for this story — if 6.2 accidentally widens the public surface (e.g. by re-exporting a Plate type from `src/index.ts`), the test fails immediately.
- **Open follow-ups not blocking this story**:
  - Story 6.1 M1 (`EditorNotImplementedError` semantic misuse in plugin-registry) → Story 6.4 cleanup
  - Story 6.5 L1 (normalizeSignature regex robustness) → independent
  - Story 6.5 L2 (interface/class drift test coverage) → expand when Story 6.4 introduces interfaces
- **Plate selection rationale**: Architecture document already commits to Plate (architecture.md → Migration Strategy: Yoopta → Plate). This story does NOT re-litigate that choice; it implements it.

### Git Intelligence Summary

- Story 6.1 merged in `288ae19` (PR #85). Commit pattern: `feat(editor): <description> (Story 6.X)`.
- Story 6.5 will merge as a follow-up `feat(editor): add CI contract-diff check (Story 6.5)` — possibly part of this same PR sequence depending on landing strategy.
- Recent root-level changes (Story 5.6, Story 6.1, Story 6.5) demonstrate the pattern: small contracts → small commits; runtime/infrastructure → larger commits with dedicated reviews. Story 6.2 is a "large commit" — expect ~40 files changed, ~30 new transitive deps in pnpm-lock.

### Latest Tech Information

- **Plate v40+** is the documented current stable line as of 2026-05. Verify the latest at https://platejs.org at pickup. Key APIs to know:
  - `createPlateEditor({ plugins, value })` — returns a Plate editor instance (a Slate editor extended with Plate behaviors).
  - `<Plate editor={editor}>{children}</Plate>` — the React provider component.
  - `<Editable />` — the content-editable surface, rendered inside `<Plate>`.
  - Plugins are plain objects with `key`, `node` (element type config), optional `handlers`, `injectChildren`, etc.
  - Marks (bold/italic/etc.) are represented as boolean keys on Slate text nodes: `{ text: '...', bold: true, italic: true }`.
- **React 19** is the target — Plate v40+ supports React 19. If you encounter strict-mode double-render issues, document them; they are React 19 + Slate-react interaction, not a Story 6.2 bug.
- **Node 22 LTS** — `react-dom/client` is server/browser dual-mode. The static import is safe.
- **jsdom v22+** — works with React 19 + React-DOM 19. If you hit "ReactDOM not defined", the test setup needs `globalThis.window = jsdom.window; globalThis.document = jsdom.window.document; globalThis.HTMLElement = jsdom.window.HTMLElement;` before importing the editor module.

### Project Structure Notes

- This story is the keystone of Sprint 2 (Editor Runtime + Desktop Scaffold) per the sprint plan, but technically only depends on Sprint 1 stories that are already done (6.1, 6.5). It can ship before 8.1 / 10.1 land.
- After 6.2 lands, Story 6.3 (full converter coverage for all 11 block types) is the natural next pickup — it slots in cleanly because the converter module structure (`src/converters/`) is already created here.
- Story 6.4 (EditorPlugin contract migration) follows; it refactors Story 6.2's hardcoded Plate plugins into the formal EditorPlugin contract.

### Project Context Reference

- No `project-context.md` file was found in this repository.
- Source-of-truth artifacts for this story:
  - `artifacts/bmad/planning-artifacts/prd.md` — FR60 (independent package + contract)
  - `artifacts/bmad/planning-artifacts/architecture.md` — `@anydocs/editor` Package Contract + Migration Strategy: Yoopta → Plate
  - `artifacts/bmad/planning-artifacts/epics.md` — Epic 6, Story 6.2 (lines 836-852)
  - `artifacts/bmad/implementation-artifacts/6-1-...md` — contract baseline
  - `artifacts/bmad/implementation-artifacts/6-5-...md` — CI safety net
  - `packages/core/src/types/content.ts` — canonical DocContentV1 type definitions (paragraph / heading / mark shapes)
  - `packages/web/components/studio/yoopta-doc-editor.tsx` — Yoopta integration (REFERENCE pattern, do not copy)
  - `packages/core/src/utils/doc-content-adapter.ts` — Yoopta ↔ doc-content shape template

### References

- [`prd.md` FR60](../planning-artifacts/prd.md) — independent editor package with declared public API contract
- [`architecture.md` Migration Strategy: Yoopta → Plate](../planning-artifacts/architecture.md)
- [`epics.md` Story 6.2](../planning-artifacts/epics.md)
- [`6-1-...md`](6-1-scaffold-anydocs-editor-package-and-public-api-contract-file.md) — contract surface baseline
- [`6-5-...md`](6-5-add-ci-contract-diff-check-for-anydocs-editor.md) — contract-snapshot regression test
- [`packages/core/src/types/content.ts`](../../../packages/core/src/types/content.ts) — DocContentV1 schema
- [`packages/editor/contract/public-api.ts`](../../../packages/editor/contract/public-api.ts) — symbol declarations
- [`packages/editor/src/runtime/placeholder-editor.ts`](../../../packages/editor/src/runtime/placeholder-editor.ts) — what gets swapped out
- [`packages/web/components/studio/yoopta-doc-editor.tsx`](../../../packages/web/components/studio/yoopta-doc-editor.tsx) — reference for plugin selection
- [`packages/core/src/utils/doc-content-adapter.ts`](../../../packages/core/src/utils/doc-content-adapter.ts) — converter shape reference
- Plate docs: https://platejs.org (verify current major at pickup)

## Dev Agent Record

### Agent Model Used

Claude Opus 4.7 (`claude-opus-4-7`)

### Debug Log References

- 2026-05-27: Plate v49 chosen (current stable major). Plate's umbrella package + `@udecode/plate-heading` together pull `slate`, `slate-react`, `slate-history`, `@udecode/slate` transitively — direct installs of slate/* are unnecessary.
- 2026-05-27: Initial `Error(message, { cause })` constructor in `contract-cli.ts` (from Story 6.5) is reused via `cause.message` composition because the editor's `lib: ["ES2020", "DOM"]` does not include the `Error.cause` overload. Same pattern is reused throughout 6.2 (no `{ cause }` options bag).
- 2026-05-27: First mount attempt rendered an empty host element. Root cause: React 19's concurrent scheduler defers the initial commit; wrapped `root.render(...)` in `flushSync(...)` to force synchronous commit and match the AC2 contract that `mount(target)` populates `target` before returning.
- 2026-05-27: First `setContent`-after-mount attempt failed to update the rendered DOM even though `getContent()` reflected the new payload. Root cause: Plate v49's React tree subscribes to an internal zustand-x store seeded from `editor.children` at mount time; `editor.tf.setValue(...)` updates the Slate value but does NOT refresh the React store. Fix: bump a `renderKey` counter on every `setContent` and re-render with `<Plate key={renderKey} editor={...}>` — Plate's official "rebuild from current children" pattern. Wrapped the re-render in `flushSync` so the DOM update lands before `setContent` returns.
- 2026-05-27: First jsdom-driven test run hit `ReferenceError: ShadowRoot is not defined` inside slate-dom's `findDocumentOrShadowRoot`. jsdom 29 exposes `ShadowRoot` on the window but only as a getter — fixed by explicitly copying it (and several siblings: `DocumentType`, `AbortController`, `MutationObserver`) onto `globalThis` via `defineProperty`.
- 2026-05-27: jsdom 29 does not implement `requestAnimationFrame` / `cancelAnimationFrame`; slate-react calls them. Provided minimal shims backed by `setTimeout`/`clearTimeout`.
- 2026-05-27: Attempted `after()` hook to restore globals between tests; removed because React-DOM 19's async cleanup microtasks fire AFTER our hook and reference the torn-down globals, surfacing "ReferenceError: window is not defined" uncaught exceptions that mark already-passing tests as failed. Node test runner spawns one process per file so inter-file global leakage is not an issue.

### Completion Notes List

- **Plate v49 chosen.** Documented in Dev Notes and pinned via `"^49.0.0"` on `@udecode/plate` + `@udecode/plate-heading`. Plate's deps pull slate/slate-react/slate-history transitively — no direct slate installs needed (cleaner lockfile diff).
- **Pure-`ts` source, no JSX.** Used `React.createElement(...)` throughout `plate-runtime.ts` so the editor `tsconfig.json` doesn't need `"jsx"` and the package keeps its current build-pipeline simplicity.
- **Bidirectional converters under `src/converters/`** (3 files: `mark-mapping.ts`, `doc-content-to-plate.ts`, `plate-to-doc-content.ts`). Scope is paragraph + heading + 5 supported marks per Story 6.2's explicit boundary. All unsupported block types throw with a Story-6.3 hint.
- **Mount/unmount lifecycle uses `flushSync`** to make both mount and unmount commits synchronous (matches the contract that `mount` returns after the DOM is populated). Belt-and-braces `removeChild` loop in the unmount disposer keeps the AC8 "no orphan DOM nodes after unmount" invariant resilient to React render edge cases.
- **`setContent` uses key-bumped re-mount, NOT direct `editor.children = ...`**. Plate v49's React store is decoupled from `editor.children`; bumping a `renderKey` and re-rendering is the documented pattern for force-syncing on programmatic value changes.
- **Event bus** is a small Map<event, Set<handler>> inside `plate-runtime.ts`. Per-handler try/catch isolates failures so one bad listener doesn't block siblings (matches browser EventTarget semantics).
- **`triggerAgent` still throws `EditorNotImplementedError`** per AC7, with a message naming Stories 11.3/11.4/11.5/11.7 so future devs find the right ticket.
- **Contract snapshot unchanged.** `pnpm --filter @anydocs/editor contract:check` returns "in sync" after the swap — Story 6.5's safety net validates that 6.2 did NOT widen the public surface (the 5 symbols are byte-identical).
- **Placeholder runtime deleted.** `src/runtime/placeholder-editor.ts` removed; `not-implemented-error.ts` retained for `triggerAgent`.
- **Test runtime additions:** 1 new test file (plate-converter — 14 tests) + 1 new test file (plate-runtime — 19 tests, jsdom-backed) + updated `contract.test.ts` (replaced 1 "throws everything" test with 4 method-shape + still-throws-on-triggerAgent tests). Editor total: 39 → **75 tests**.
- **`contract.test.ts` rewrite:** Story 6.1's load-bearing test ("every method throws EditorNotImplementedError") is no longer accurate post-6.2. Split into: methods-exist, getContent-returns-DocContentV1, on()-returns-disposer, triggerAgent-still-throws. The mount-lifecycle assertions are owned by `plate-runtime.test.ts` (jsdom is needed; `contract.test.ts` stays DOM-free).

### Validation Evidence

- `pnpm install` — 0 install errors. Pre-existing peer-dep warnings (`@yoopta/*` ↔ slate 0.123, react-18 vs 19) reproduced from `main`; new warning about `slate-dom@0.123 ↔ slate@0.114 in @udecode/slate` is expected (different slate versions hoist independently in pnpm).
- `pnpm --filter @anydocs/editor typecheck` → exit 0 (both `tsconfig.json` + `scripts/tsconfig.json` clean)
- `pnpm --filter @anydocs/editor build` → emits `dist/src/runtime/plate-runtime.{js,d.ts}`, `dist/src/converters/*.{js,d.ts}`, no `dist/scripts/*` leakage
- `pnpm --filter @anydocs/editor test` → **75/75 passing** (39 from prior stories + 14 converter + 19 runtime + 3 net delta from `contract.test.ts` rewrite)
- `pnpm --filter @anydocs/editor contract:check` → "in sync" (Story 6.5 snapshot safety net validates AC9)
- `pnpm typecheck` (root, 7 packages) → all clean
- `pnpm test` (root regression gate) → core 155 + editor 75 + cli 36+2 skip + mcp 44 = **310 pass / 0 fail** (up from 274 → +36 new tests for Story 6.2)
- `pnpm lint` → 0 errors, 18 pre-existing warnings (no new)
- `pnpm build` (root, 8 packages) → all clean; `@anydocs/web` (still on Yoopta) builds unaffected by Plate addition
- `packages/editor/dist` size: 104K (excluding node_modules). Bundle including Plate transitives is unmeasured at this story; future cleanup can quantify if a budget is wanted.

### File List

**New files**

- `packages/editor/src/runtime/plate-runtime.ts` — Plate-backed `EditorInstance` factory + mount/unmount + event bus
- `packages/editor/src/converters/mark-mapping.ts` — `TextMark[]` ⇄ Plate boolean-flag utility
- `packages/editor/src/converters/doc-content-to-plate.ts` — paragraph + heading + marks (forward direction)
- `packages/editor/src/converters/plate-to-doc-content.ts` — paragraph + heading + marks (inverse direction)
- `packages/editor/tests/plate-converter.test.ts` — 14 unit tests for converter round-trip + error paths
- `packages/editor/tests/plate-runtime.test.ts` — 19 jsdom-backed tests for mount/unmount/getContent/setContent/on/triggerAgent

**Modified files**

- `packages/editor/package.json` — added `@udecode/plate` + `@udecode/plate-heading` as dependencies; `jsdom` + `@types/jsdom` + `react` + `react-dom` + `@types/react` + `@types/react-dom` as devDependencies; `react-dom` added as peerDependency
- `packages/editor/contract/public-api.ts` — swapped `createPlaceholderEditor(config)` → `createPlateEditorInstance(config)`; contract surface byte-identical
- `packages/editor/src/runtime/placeholder-editor.ts` — **deleted** (placeholder no longer needed; `not-implemented-error.ts` retained for `triggerAgent`)
- `packages/editor/tests/contract.test.ts` — rewrote the "every method throws EditorNotImplementedError" test for post-6.2 reality: methods are real functions, `getContent()` returns canonical payload, `on()` returns disposer, `triggerAgent()` still throws
- `packages/editor/README.md` — added "Runtime engine" section, updated "Internal layout" tree to reflect Plate-backed runtime + converters
- `pnpm-lock.yaml` — Plate transitive deps (~30 new packages: `@udecode/plate-core`, `@udecode/plate-utils`, `slate`, `slate-react`, `slate-history`, `slate-dom`, `jotai`, `jotai-x`, `zustand`, `zustand-x`, ... )
- `artifacts/bmad/implementation-artifacts/sprint-status.yaml` — `6-2-...` status transitions

### Review Follow-ups (AI)

- [ ] [AI-Review][Low] Refactor `change` event delivery to a Plate plugin-level handler so user-input changes also fire `on('change')`. Story 6.2 AC6 only required host-triggered (setContent) change events, but Story 7.x (Studio dual-mount) will need user-typing events too. The cleanest path: register a `handlers.onChange` plugin instead of mutating `editor.onChange`. [packages/editor/src/runtime/plate-runtime.ts:88-117]
- [ ] [AI-Review][Low] Extract jsdom global setup into a reusable `tests/setup-jsdom.ts` so future test files needing DOM don't duplicate the ~20 globals + 3 shims. Add `typeof === 'undefined'` guards around each property-define so a future jsdom that ships rAF/cAF natively doesn't conflict. [packages/editor/tests/plate-runtime.test.ts:14-78]
- [ ] [AI-Review][Low] Wrap mount/setContent React-state changes in `act()` to future-proof against React 19+ strict-mode tightening. Currently `flushSync` + `IS_REACT_ACT_ENVIRONMENT=true` works but is one React minor away from breaking. A small `actSync(fn)` helper would be enough.
- [ ] [AI-Review][Low] Replace the `PlateLikeEditor` `as unknown as` coercion with Plate's actual `PlateEditor` type. Loose typing means a Plate API rename (`tf.setValue` → `tf.replaceValue` etc.) surfaces as a runtime error rather than a compile error. [packages/editor/src/runtime/plate-runtime.ts:38-52]
- [ ] [AI-Review][Low] Add a one-line note to the dev guide (or `packages/editor/README.md`) documenting the key-bump remount trade-off in `setContent`: focus, selection, and Slate undo history are discarded on every programmatic content swap. Worth surfacing for Studio/dual-mount work (Story 7.x).

## Senior Developer Review (AI)

**Reviewer:** Claude Opus 4.7 (adversarial pass)
**Review Date:** 2026-05-27
**Review Outcome:** Approve — transition to `done` after M2 / M3 / M4 fixes landed
**Severity Breakdown:** 0 High · 4 Medium (all addressed) · 5 Low (logged as Review Follow-ups)

### Summary

All 10 acceptance criteria satisfied. Plate-backed runtime mounts/unmounts cleanly under jsdom, `getContent`/`setContent` round-trip canonical `doc-content-v1`, change events fire on host-triggered mutations, `triggerAgent` continues to throw per AC7, contract surface byte-identical (Story 6.5 snapshot safety net validates AC9). 108 editor tests pass (75 original 6.2 + 30 from 6.3 expansion + 3 new review-fix regression tests).

**4 MEDIUM findings — all addressed:**

- **M1** (silent DocContentV1 `id` loss in both converter directions) → **closed by Story 6.3** (`withOptionalId` helpers + `nodeId: false` in createPlateEditor). 6.3 added an explicit regression test (`blocks preserve optional id fields across round-trip`).
- **M2** (`setContent` key-bump remount possibly unnecessary after `nodeId: false`) → **investigated, confirmed necessary**. Experimentally removed the key-bump → mounted-DOM-update test failed because Plate v49's zustand-x React store seeds from `editor.children` at mount time and does NOT re-read on `tf.setValue` operations. Restored the key-bump; trade-off documented inline (focus/selection/undo discarded on programmatic setContent — acceptable for Studio host-triggered swaps; Story 6.4/7.x can revisit).
- **M3** (potential double-dispatch via `editor.onChange` hook + explicit call) → **fixed in-line**. Removed the `editor.onChange = ...` mutation entirely; change events dispatched ONLY from `setContent`'s explicit `notifyChange()` call. AC6 only requires host-triggered changes; user-input change events deferred to Story 6.4. Added 2 regression tests (`regression M3: setContent dispatches change EXACTLY ONCE` for both unmounted and mounted cases).
- **M4** (mount() doesn't roll back state when initial render throws) → **fixed in-line**. Wrapped `flushSync(renderTree)` in try/catch: on render failure the runtime calls `root.unmount()` (best-effort), clears `mountedRoot`/`mountedTarget`, and re-throws. A subsequent `mount(realTarget)` succeeds instead of tripping the "already mounted" guard. Added 1 regression test.

LOW findings (L1 plugin-handler onChange refactor, L2 jsdom setup extraction, L3 act() wrapping, L4 PlateEditor type tightening, L5 README key-bump trade note) logged as Review Follow-ups.

### Action Items

- [x] [Medium] M1 → closed by Story 6.3 (no 6.2 action needed at review time)
- [x] [Medium] M2 → verified necessary + documented; key-bump retained
- [x] [Medium] M3 → fixed in `plate-runtime.ts`: single-source dispatch via `notifyChange()`
- [x] [Medium] M4 → fixed in `plate-runtime.ts`: mount() rolls back on render failure
- [x] [Low] L1–L5 → tracked as Review Follow-ups (non-blocking)

## Change Log

| Date       | Version | Change                                                                                                                                                                                                                | Author |
|------------|---------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|--------|
| 2026-05-26 | 0.1.0   | Initial story file created via `create-story` workflow. Pulls Plate runtime requirements from architecture.md Migration Strategy section, DocContentV1 schema from `packages/core/src/types/content.ts`, and lessons-learned from Stories 6.1 + 6.5. Story explicitly scopes minimal converter (paragraph + heading only); Story 6.3 expands. | Claude Opus 4.7 (story writer) |
| 2026-05-27 | 0.2.0   | Implementation landed. Plate v49 + minimal paragraph/heading converters + jsdom-backed mount/unmount lifecycle + event bus. Contract surface byte-identical (Story 6.5 snapshot safety net validates). All 10 ACs satisfied. Editor tests 39 → 75 (+36); root regression gate 274 → 310 pass / 0 fail. Status `in-progress → review`. | Claude Opus 4.7 (dev agent) |
| 2026-05-27 | 0.3.0   | Senior Developer Review (AI) completed. 4 MEDIUM findings addressed: M1 closed by Story 6.3; M2 verified key-bump remount is necessary + trade-off documented; M3 removed `editor.onChange` mutation, dispatch now single-source via `notifyChange()`; M4 wrapped mount() flushSync in try/catch with state rollback. +3 regression tests (M3×2 + M4). Editor tests 105 → 108; root regression 340 → 343 pass / 0 fail. 5 LOW findings logged as Review Follow-ups. Status `review → done`. | Claude Opus 4.7 (reviewer + fixer) |
