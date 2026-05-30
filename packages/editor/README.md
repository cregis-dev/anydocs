# `@anydocs/editor`

Contract-bound block editor package for Anydocs. Studio (web), Desktop (Tauri), and future embeds consume the editor exclusively through a small, machine-enforced public API surface.

> **Phase 2 status:** Scaffold + contract in place (Story 6.1). CI contract-diff (Story 6.5) locks the public surface. **Plate-based runtime (Story 6.2) ships paragraph + heading + marks.** Full converter coverage (Story 6.3), plugin contract migration (Story 6.4), and Studio cutover (Stories 7.1–7.3) follow.

## Runtime engine

The internal block runtime is [Plate](https://platejs.org) — a contract-bound Slate wrapper. Plate handles editing semantics; we own the contract and the `doc-content-v1` ↔ Plate converters.

- **Canonical storage stays `doc-content-v1`.** Plate values never escape the package — `getContent()` always returns a canonical payload.
- **Mount lifecycle** uses `react-dom/client.createRoot` + `flushSync` so mount/unmount commits land synchronously (no jsdom flakiness in tests).
- **`setContent` triggers a key-bumped re-mount** of Plate's React tree. Plate v49 has no public "rebuild from current children" hook, and a key change is the supported pattern for force-syncing the editor's internal store to programmatically-replaced `editor.children`.
- **Converters live under [`src/converters/`](src/converters/)**. All 11 `DocContentV1` block types and the `link` inline node round-trip through the converters. Plugin-driven editing UI for these types lands in Story 6.4.
- **Scope refusals are loud.** Unrecognised block types (forged payloads, future schema additions, …) throw a structured `Error` identifying the offending block index and listing the allowed types. Silent drops are explicitly forbidden so contract drift is visible at convert time.
- **`NodeIdPlugin` is disabled** (`nodeId: false` in `createPlateEditor`). Plate's default auto-id injection would make `getContent()` lossy round-trip — DocContentV1's optional `id` field would always be populated on output even when absent on input. The canonical id semantics belong to the host; the editor only preserves ids the caller supplied.

### Block-type mapping (DocContent ↔ Plate)

| DocContentV1 | Plate element type |
|---|---|
| `paragraph` | `p` |
| `heading` level 1 / 2 / 3 | `h1` / `h2` / `h3` |
| `list` (bulleted) | `ul` + `li` |
| `list` (numbered) | `ol` + `li` |
| `list` (todo) | `todo_list` + `todo_li` (carries `checked: boolean`) |
| `codeBlock` | `code_block` (text child = source code) |
| `codeGroup` | `code_group` (with `code_block` children) |
| `blockquote` | `blockquote` |
| `callout` | `callout` (carries `tone`, `title`) |
| `table` / `TableRow` / `TableCell` (header / body) | `table` / `tr` / `th` / `td` |
| `image` | `img` (void; carries `src`, `alt`, `title`, `width`, `height`, `caption`) |
| `divider` | `hr` (void) |
| `mermaid` | `mermaid` (void; carries `code`, `title`) |
| `link` (inline) | `a` (inline element with text children) |

The mapping table is locked in [`src/converters/element-types.ts`](src/converters/element-types.ts) — both directions of the converter import the same constants so adding/renaming an element type requires a single edit.

## Plugin contract

Custom block types integrate through the `EditorPlugin` contract introduced by Story 6.4. Each plugin declares:

- `blockType` — a canonical DocContentV1 block type from `@anydocs/core`'s `DOC_CONTENT_BLOCK_TYPES`
- `plateElementTypes` — every Plate runtime element-type string the plugin owns
- `schemaFragment` — opaque structural description (used by the validator + future schema tooling)
- `docContentToPlate` / `plateToDocContent` — bidirectional converter hooks
- `agentAnchor` (optional) — inline / page / workspace agent anchor declaration (Epic 11)

The 11 canonical DocContentV1 block types are auto-registered as builtin plugins under [`src/plugins/builtin/`](src/plugins/builtin/). Each registered plugin owns its `blockType` exclusively — duplicate registration through the public `registerPlugin(plugin)` API throws `EditorPluginValidationError`. This is by design: canonical blockTypes have one authoritative converter.

Hosts who want to **observe** the validator's behavior can call `registerPlugin` with a custom-shape plugin to surface validation errors at registration time:

```ts
import { registerPlugin } from '@anydocs/editor';

// All canonical blockTypes are already registered by builtins, so passing
// any canonical blockType here throws "already registered" — this is
// intentional and protects against accidental shadowing.
try {
  registerPlugin({
    blockType: 'paragraph',          // already taken by the builtin paragraph plugin
    plateElementTypes: ['__custom__'],
    schemaFragment: { kind: 'paragraph' },
    docContentToPlate: () => ({}),
    plateToDocContent: () => ({}),
  });
} catch (error) {
  // error.name === 'EditorPluginValidationError'
}
```

For per-editor extension, pass plugins via `EditorConfig.plugins`. The runtime validates each plugin shape but the global registry is the source of truth for canonical-blockType ownership — host plugins targeting a canonical blockType already owned by a builtin silently defer to the builtin (Story 6.4 design; see Story 6.4 follow-up M2 for the open question on whether hosts should be allowed to replace builtins per-editor).

The 9 essential block types (paragraph, heading, list, codeBlock, image, callout, table, divider, blockquote) ship with Plate render plugins from the corresponding `@udecode/plate-*` packages. The 2 extended types (codeGroup, mermaid) round-trip as data but render as generic Slate elements until Story 13.x adds custom render UI.

## Public API contract

The public surface is declared **only** in [`contract/public-api.ts`](contract/public-api.ts). Five symbols, no more:

| Symbol           | Kind     | Purpose                                                                 |
|------------------|----------|-------------------------------------------------------------------------|
| `createEditor`   | function | Factory returning an opaque `EditorInstance`.                           |
| `registerPlugin` | function | Registers an `EditorPlugin` for an extra `doc-content-v1` block type.   |
| `EditorConfig`   | type     | Declarative configuration consumed by `createEditor`.                   |
| `EditorInstance` | type     | Opaque editor handle (`mount` / `getContent` / `setContent` / `on` / `triggerAgent`). |
| `EditorPlugin`   | type     | Plugin contract for adding block types.                                  |

Supporting types (`UnmountHandle`, `AgentInvocation`, scope/event unions, `EditorNotImplementedError`) are intentionally inlined as anonymous shapes or kept internal under `src/runtime/`. Internal Plate types are never re-exported through the package entry.

## Contract snapshot (`contract/contract.json`)

[`contract/contract.json`](contract/contract.json) is a machine-readable snapshot of the declared public surface, generated from `contract/public-api.ts`. It is **committed to the repo** and acts as the authoritative declared surface for downstream consumers.

CI runs the snapshot diff in every PR via `pnpm test`. Any drift between `public-api.ts` and `contract.json` fails the regression gate, classifying the change as one of:

- `+ added` — a new exported symbol
- `- removed` — an exported symbol disappeared
- `~ renamed` — an added + removed pair share a signature (heuristic)
- `~ changed` — a symbol's signature changed (parameters, return type, type alias body)

## Evolving the contract

To make an intentional change to the public API:

1. **Edit the source of truth.** Open `contract/public-api.ts` and apply your change.
2. **Regenerate the snapshot.** From the repo root:
   ```bash
   pnpm --filter @anydocs/editor contract:update
   ```
   This rewrites `contract/contract.json`. Inspect the diff — it should match your intent.
3. **Commit both files in the same PR.** `public-api.ts` and `contract.json` MUST land together. Otherwise CI will reject the PR.
4. **CI will verify.** The snapshot test (`tests/contract-snapshot.test.ts`) runs as part of `pnpm test`. If you forgot step 2, the test fails with a structured diff pointing at the diverging symbol(s) and a hint to run `contract:update`.

To validate locally before pushing:
```bash
pnpm --filter @anydocs/editor contract:check   # prints in-sync message or structured diff
pnpm --filter @anydocs/editor test             # runs the full test gate
```

## Scripts

| Script                                              | Purpose                                              |
|-----------------------------------------------------|------------------------------------------------------|
| `pnpm --filter @anydocs/editor build`               | Compile the package (`dist/src/*` + `dist/contract/*`). |
| `pnpm --filter @anydocs/editor typecheck`           | Strict typecheck of `src/`, `contract/`, and `scripts/`. |
| `pnpm --filter @anydocs/editor test`                | Run all contract / extractor / diff-printer tests.   |
| `pnpm --filter @anydocs/editor contract:update`     | Regenerate `contract/contract.json` after a contract change. |
| `pnpm --filter @anydocs/editor contract:check`      | Verify the committed snapshot still matches.         |

## Build output layout

After `pnpm build`:

```
packages/editor/
├── contract/
│   ├── contract.json              ← committed snapshot
│   └── public-api.ts              ← source of truth
└── dist/
    ├── contract/
    │   ├── public-api.js
    │   └── public-api.d.ts
    └── src/
        ├── index.js
        ├── index.d.ts
        └── runtime/...
```

The package's `main`/`types`/`exports` resolve to `dist/src/index.{js,d.ts}` — consumers cannot accidentally import internal modules. The `scripts/` directory is **not** shipped to npm (it lives outside the build's `include` glob).

## Internal layout

```
packages/editor/
├── contract/
│   ├── public-api.ts          ← single source of truth (DO NOT split)
│   └── contract.json          ← generated; never hand-edit
├── src/
│   ├── index.ts               ← thin re-export shim (auto-generated header)
│   ├── runtime/
│   │   ├── plate-runtime.ts   ← Plate-backed EditorInstance factory (Story 6.2)
│   │   ├── plugin-registry.ts ← in-memory placeholder; full validation in Story 6.4
│   │   └── not-implemented-error.ts
│   ├── converters/
│   │   ├── doc-content-to-plate.ts  ← all 11 DocContentV1 block types + link
│   │   ├── plate-to-doc-content.ts  ← inverse mapping
│   │   ├── element-types.ts         ← shared Plate element-type constants
│   │   └── mark-mapping.ts          ← shared mark ⇄ boolean-flag util
│   └── plugins/builtin/       ← Story 6.4 lands here
├── scripts/                   ← build-side tooling (not shipped)
│   ├── extract-contract.ts    ← TS compiler API extractor
│   ├── contract-cli.ts        ← update / check entry points
│   ├── contract-diff.ts       ← diff engine + structured printer
│   └── tsconfig.json          ← noEmit typecheck for scripts/
└── tests/
    ├── contract.test.ts                ← Story 6.1 runtime-export smoke
    ├── contract-snapshot.test.ts       ← load-bearing CI gate (this story)
    ├── contract-extractor.test.ts      ← stability + drift unit tests
    └── contract-diff-printer.test.ts   ← diff message structure tests
```

## Design notes

- **No `@microsoft/api-extractor`.** The public surface is five symbols; a ~200-LOC bespoke extractor built on the TypeScript compiler API matches the repo's minimal-dependency policy. If the surface grows beyond ~20 symbols, revisit.
- **Pure syntactic extraction.** The extractor parses `contract/public-api.ts` with `ts.createSourceFile` — it does NOT resolve types via `ts.createProgram`/`ts.TypeChecker`. This keeps the extractor self-contained: no need to build `@anydocs/core` first, no node_modules dependency walking.
- **Deterministic snapshot.** Symbols are sorted by name. JSON output uses two-space indent with a trailing newline. No timestamps, no absolute paths.
- **Rename detection.** A removed + added pair sharing the same kind and (name-normalized) signature is classified as `~ renamed`. This is a heuristic — the dev can always run `contract:update` to bless the change.
