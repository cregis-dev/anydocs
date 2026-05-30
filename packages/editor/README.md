# `@anydocs/editor`

Contract-bound block editor package for Anydocs. Studio (web), Desktop (Tauri), and future embeds consume the editor exclusively through a small, machine-enforced public API surface.

> **Phase 2 status:** Scaffold + contract in place (Story 6.1). CI contract-diff (Story 6.5) locks the public surface. The Plate-based runtime (Story 6.2) and Studio cutover (Stories 7.1–7.3) follow.

## Public API contract

The public surface is declared **only** in [`contract/public-api.ts`](contract/public-api.ts). Five symbols, no more:

| Symbol           | Kind     | Purpose                                                                 |
|------------------|----------|-------------------------------------------------------------------------|
| `createEditor`   | function | Factory returning an opaque `EditorInstance`.                           |
| `registerPlugin` | function | Registers an `EditorPlugin` for an extra `doc-content-v1` block type.   |
| `EditorConfig`   | type     | Declarative configuration consumed by `createEditor`.                   |
| `EditorInstance` | type     | Opaque editor handle (`mount` / `getContent` / `setContent` / `on` / `triggerAgent`). |
| `EditorPlugin`   | type     | Plugin contract for adding block types.                                  |

Supporting types (`UnmountHandle`, `AgentInvocation`, scope/event unions, `EditorNotImplementedError`) are intentionally inlined as anonymous shapes or kept internal under `src/runtime/`. Internal runtime types are never re-exported through the package entry.

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
│   └── runtime/               ← placeholder runtime now; Plate-backed in Story 6.2
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
