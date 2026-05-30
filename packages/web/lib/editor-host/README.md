# `@anydocs/web` editor-host adapter

Bridges Studio screens to `@anydocs/editor` (Plate-backed editor, Epic 6). Lives at `packages/web/lib/editor-host/` and is the ONLY module under `packages/web/` that imports `@anydocs/editor` — the [`studio-callgraph.test.ts`](./studio-callgraph.test.ts) audit enforces the boundary.

## Surface

```ts
import {
  EditorHost,               // React component — the sole Studio editor (post-7.3)
  useEditorHost,            // Imperative hook variant
  normalizeEditorInput,     // value → DocContentV1 normaliser
} from '@/lib/editor-host';
```

## Cutover history

Studio's editor evolved through three Phase 2 stories:

| Story | Action |
|---|---|
| 7.1 ✅ | Built `<EditorHost>` adapter wrapping `@anydocs/editor` |
| 7.2 ✅ | Dual-mounted behind `NEXT_PUBLIC_STUDIO_EDITOR` flag; parity matrix asserted content-level equivalence across both converter paths |
| 7.3 ✅ | Cutover: deleted `<YooptaDocEditor>` + every `@yoopta/*` package from `packages/web`; `<EditorHost>` is now the sole editor surface |

The `NEXT_PUBLIC_STUDIO_EDITOR` env var no longer has any effect — the feature-flag resolver retired together with the dual-mount machinery in Story 7.3.

Verifying the editor in dev mode:

```bash
pnpm --filter @anydocs/web dev
```

Open `http://localhost:3000/studio`, pick a page, and inspect the DOM for `data-anydocs-editor-host="true"` on the editor's host `<div>` — that's the new Plate-backed editor.

## Parity matrix

[`parity-fixtures.test.ts`](./parity-fixtures.test.ts) drives every fixture in `packages/editor/tests/fixtures/doc-content/` (19 reference shapes from Story 6.3) through BOTH converter paths:

- **Legacy**: `docContentToYoopta(input)` → `yooptaToDocContent(…)`
- **New**: `createEditor({ initialContent: input }).getContent()` (exercises the Story 6.3/6.4 internal dispatch through the public surface)

Both outputs are compared via `deepStrictEqual` after `normalizeForParity` strips editor-managed metadata:

- Yoopta auto-assigns `id: 'block-N'` on roundtrip (analogous to Plate's `NodeIdPlugin`, which the new editor disables via `nodeId: false`).
- Yoopta materialises `header: false` on every non-header table cell (semantically equivalent to absence).

Both behaviors are documented as Story 7.3 cutover concerns. The parity gate proves that ALL other content (text, marks, structure, types, props) is byte-equivalent across editor implementations.

## Tests

| File | Purpose |
|---|---|
| [`editor-host.test.ts`](./editor-host.test.ts) | jsdom mount/unmount lifecycle, value normalisation, change-event delivery, id/key remount semantics |
| [`studio-callgraph.test.ts`](./studio-callgraph.test.ts) | Boundary audits — only `lib/editor-host/` imports `@anydocs/editor` (Story 7.1) + no source under `packages/web` imports `@yoopta/*` (Story 7.3) |
| [`parity-fixtures.test.ts`](./parity-fixtures.test.ts) | Cross-editor content-equivalence across 19 reference fixtures — historical gate kept after Story 7.3 cutover to catch converter regressions if legacy on-disk content needs to migrate forward through `fs.ts` |

Run with `pnpm --filter @anydocs/web test:unit`.
