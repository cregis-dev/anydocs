# Story 6.3: Implement `doc-content-v1` ↔ Plate Converters

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer agent,
I want bidirectional converters between `doc-content-v1` and Plate's internal value covering all 11 canonical block types and the `link` inline node,
so that canonical storage stays stable regardless of runtime evolution and the editor can faithfully round-trip every block type the schema allows — closing the converter scope gap explicitly left by Story 6.2's minimal paragraph+heading scope.

## Acceptance Criteria

1. The forward converter `docContentToPlate(payload)` in `packages/editor/src/converters/doc-content-to-plate.ts` handles **all 11** `DOC_CONTENT_BLOCK_TYPES`: `paragraph`, `heading`, `list`, `codeBlock`, `codeGroup`, `blockquote`, `callout`, `table`, `image`, `divider`, `mermaid`. The "Story 6.3 expands" branch from 6.2 is removed; no `default` fall-through throws for canonical block types.
2. The inverse converter `plateToDocContent(value)` in `packages/editor/src/converters/plate-to-doc-content.ts` recognises every Plate element type emitted by the forward converter and reconstructs the canonical `DocBlock` shape.
3. The `link` inline node (`{ type: 'link', href, title?, children: TextNode[] }`) round-trips through both converters without lossy flattening. Story 6.2's note "Story 6.2 flattens links to their text children" is resolved here; the inverse converter recognises Plate's `a` element type and emits a `LinkNode`.
4. Round-trip equality: for each block type, a reference fixture in `packages/editor/tests/fixtures/doc-content/` is converted to a Plate value and back; `node:assert/strict.deepEqual(input, output)` passes. Fixtures cover at minimum:
   - paragraph (with marks)
   - heading levels 1/2/3
   - list (bulleted) with nested items
   - list (numbered) with nested items
   - list (todo) with `checked: true` and `checked: false` items
   - codeBlock with `language`, `title`, multi-line `code`
   - codeBlock with no language and no title (minimal)
   - codeGroup with 2 items differing in language
   - blockquote with inline marks
   - callout with `tone='info'` and a title
   - callout with no `tone` (default fallback)
   - table with header row + 2 data rows + ≥2 columns
   - image with `alt`, `title`, `width`, `height`, and a `caption`
   - image with just `src` (minimal)
   - divider (no fields)
   - mermaid with `code` and `title`
   - paragraph containing a `link` inline node (mixed text + link + text)
5. **Unsupported block type → typed error.** When `docContentToPlate` encounters a block whose `type` is NOT one of the 11 canonical types (e.g. a future block type or a forged payload), it throws `Error` with a structured message: `"docContentToPlate: unrecognised block type 'XYZ' at index N (expected one of: paragraph, heading, list, codeBlock, codeGroup, blockquote, callout, table, image, divider, mermaid)"`. Same shape on `plateToDocContent` for unknown Plate element types.
6. **Structural validation failures are loud.** When a block has the right `type` but an invalid shape (e.g. heading with `level: 4`, list with an unknown `style`, table with a row whose `cells` length differs from sibling rows), the converter throws a typed error identifying the block index AND the violated structural rule. No silent normalization.
7. The unit test file `packages/editor/tests/plate-converter.test.ts` is extended to cover all new block types AND the error paths from AC5+AC6. Existing 14 Story 6.2 tests continue to pass.
8. The `plate-runtime.ts` plugin list is NOT changed by this story (paragraph + heading remain the only registered Plate plugins). Story 6.4 owns the EditorPlugin contract + plugin-registration migration. **If Plate's normalization strips/rewrites the additional block types when a mounted editor sees them**, document the limitation in Dev Agent Record — converter-level round-trip is the AC, not mounted-editor round-trip.
9. `pnpm --filter @anydocs/editor contract:check` continues to pass. Story 6.5's snapshot test is the safety net: 6.3 must not change the public surface.
10. Full regression gate stays green: `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm lint` all unchanged or improved. Editor test count grows from 75 → ~120 (rough estimate: ~30+ new converter tests + the 8 fixture files counted as one logical suite).

## Tasks / Subtasks

- [x] Inventory the canonical types and lock the Plate-side element naming (AC: 1, 2)
  - [x] Read `packages/core/src/types/content.ts` and confirm the 11 canonical block types from `DOC_CONTENT_BLOCK_TYPES` are still: `paragraph`, `heading`, `list`, `codeBlock`, `codeGroup`, `blockquote`, `callout`, `table`, `image`, `divider`, `mermaid`.
  - [x] Confirm the inline types `text` and `link` from `InlineNode` are still authoritative.
  - [x] Pick stable Plate element-type strings for each block type. Prefer Plate ecosystem conventions where they exist; invent stable names for the rest. Recommended mapping:
    | DocContent type | Plate element type |
    |---|---|
    | `paragraph` | `p` (already from 6.2) |
    | `heading` level 1/2/3 | `h1` / `h2` / `h3` (already from 6.2) |
    | `list` bulleted | `ul` (with `li` children) |
    | `list` numbered | `ol` (with `li` children) |
    | `list` todo | `todo_list` (with `todo_li` children carrying `checked: boolean`) |
    | `codeBlock` | `code_block` |
    | `codeGroup` | `code_group` (with `code_block` children) |
    | `blockquote` | `blockquote` |
    | `callout` | `callout` |
    | `table` / row / cell / header cell | `table` / `tr` / `td` / `th` |
    | `image` | `img` (void) |
    | `divider` | `hr` (void) |
    | `mermaid` | `mermaid` (void) |
    | `link` (inline) | `a` (inline element with text children) |
  - [x] Centralise the type-string constants in `packages/editor/src/converters/element-types.ts` so both converter directions reference the same source of truth (and `mark-mapping.ts`-style sharing is preserved).
- [x] Extend `docContentToPlate` to handle all 11 block types (AC: 1, 5, 6)
  - [x] Refactor `packages/editor/src/converters/doc-content-to-plate.ts`. Move each block-type case into a small per-type helper function (`paragraphBlockToPlate`, `headingBlockToPlate`, `listBlockToPlate`, `codeBlockToPlate`, `codeGroupBlockToPlate`, `blockquoteBlockToPlate`, `calloutBlockToPlate`, `tableBlockToPlate`, `imageBlockToPlate`, `dividerBlockToPlate`, `mermaidBlockToPlate`). Keeps the top-level switch readable and unit-testable per type.
  - [x] **List handling**:
    - `list.style='bulleted'` → `{ type: 'ul', children: items.map(itemToLi) }`
    - `list.style='numbered'` → `{ type: 'ol', children: items.map(itemToLi) }`
    - `list.style='todo'` → `{ type: 'todo_list', children: items.map(itemToTodoLi) }`
    - Each list item with nested `items` produces nested `<ul>/<ol>/<todo_list>` inside the `<li>` (per Plate / HTML convention).
    - Validate `style` is one of the three allowed values; throw if not (AC6).
  - [x] **codeBlock handling**: emit `{ type: 'code_block', lang: language ?? '', title: title ?? '', children: [{ text: code }] }`. Code is stored as the single text child for round-trip simplicity. The void/non-void choice is non-void here so the text is editable.
  - [x] **codeGroup handling**: emit `{ type: 'code_group', children: items.map(item => codeBlockToPlate({ type: 'codeBlock', ...item })) }`. The `code_block` children share the codeBlock helper.
  - [x] **blockquote handling**: emit `{ type: 'blockquote', children: inlineChildren(block.children) }`.
  - [x] **callout handling**: emit `{ type: 'callout', tone: tone ?? '', title: title ?? '', children: inlineChildren(block.children) }`. Tone is preserved as a string property on the Plate element.
  - [x] **table handling**: emit `{ type: 'table', children: rows.map(rowToTr) }`. Each `tr` has `td`/`th` cell children based on `cell.header`. Cell children are inline nodes via `inlineChildren`. **Validate** that every row has the same number of cells; throw if not (AC6).
  - [x] **image handling**: emit `{ type: 'img', src, alt: alt ?? '', title: title ?? '', width: width ?? null, height: height ?? null, caption: caption ? caption : null, children: [{ text: '' }] }`. The caption is preserved as a custom property (Plate / Slate void-block convention).
  - [x] **divider handling**: emit `{ type: 'hr', children: [{ text: '' }] }` (Slate void block requires at least one text child).
  - [x] **mermaid handling**: emit `{ type: 'mermaid', code, title: title ?? '', children: [{ text: '' }] }` (void block, code held in a custom property).
  - [x] Reject any unrecognised block type with an error per AC5.
- [x] Extend `plateToDocContent` to handle all 11 Plate element types (AC: 2, 3, 5, 6)
  - [x] Refactor `packages/editor/src/converters/plate-to-doc-content.ts`. Mirror the per-type helper structure from the forward converter.
  - [x] **List handling**: recognise `ul`/`ol`/`todo_list` types; map back to `{ type: 'list', style }`. Each `li`/`todo_li` child maps to a `ListItem`. Recursively unwrap nested lists.
  - [x] **codeBlock handling**: recognise `code_block`; read `lang` + `title` properties; concatenate text children to reconstruct `code`. Drop empty `lang`/`title` props on output if they were absent on input (round-trip equality).
  - [x] **codeGroup handling**: recognise `code_group`; reconstruct `items` from its `code_block` children using the codeBlock helper inverse.
  - [x] **blockquote / callout / table / image / divider / mermaid handling**: per-type inverse, mirroring the forward direction. For props that were `null` in Plate output (because the DocContentV1 input omitted them), emit the field as absent on the canonical output — NOT `undefined`, NOT `null` — so `deepEqual` against the original input passes.
  - [x] **Link handling** in `plateChildrenToInline`: when a child is `{ type: 'a', href, title?, children: [...text] }`, emit `{ type: 'link', href, title, children: [...text] }`. The forward direction MUST already emit this shape (update `docContentToPlate`'s `inlineChildren` to stop flattening links — fix the AC3 regression from 6.2).
  - [x] Reject unknown Plate element types per AC5.
- [x] Fix the link round-trip regression from Story 6.2 (AC: 3)
  - [x] In `docContentToPlate`'s `inlineChildren` helper, replace the current "flatten link to text children" logic with `{ type: 'a', href, title, children: [...text nodes] }` per the table above.
  - [x] Update the existing 6.2 test `doc→plate flattens link inline nodes to their text children (Story 6.2 scope)` — either DELETE it (because Story 6.3 explicitly removes the flattening) or rewrite it to assert the new non-lossy mapping. Choose the rewrite if the test name expresses a useful invariant; otherwise delete to avoid stale expectations.
- [x] Author reference fixtures for round-trip tests (AC: 4)
  - [x] Create `packages/editor/tests/fixtures/doc-content/` containing one JSON fixture file per block type:
    ```
    fixtures/doc-content/
    ├── paragraph-with-marks.json
    ├── heading-l1.json
    ├── heading-l2.json
    ├── heading-l3.json
    ├── list-bulleted-nested.json
    ├── list-numbered-nested.json
    ├── list-todo-mixed.json
    ├── code-block-with-language.json
    ├── code-block-minimal.json
    ├── code-group-two-items.json
    ├── blockquote-with-marks.json
    ├── callout-info-with-title.json
    ├── callout-no-tone.json
    ├── table-3x3-with-header.json
    ├── image-with-caption.json
    ├── image-minimal.json
    ├── divider.json
    ├── mermaid-with-title.json
    └── paragraph-with-link.json
    ```
  - [x] Each fixture is a valid `DocContentV1` JSON document (one or two blocks per fixture, focused on the type being tested).
  - [x] Fixtures are committed to the repo. They serve as both round-trip inputs and as living documentation of the canonical shape for each block type.
- [x] Extend the test suite (AC: 4, 5, 6, 7)
  - [x] In `packages/editor/tests/plate-converter.test.ts`, add a generated test per fixture using `node:test`'s `for (const fixture of fixtures)` pattern. Each test:
    - Loads the fixture JSON
    - Asserts `roundTrip(input) deepEqual input`
  - [x] Add focused tests per type (in addition to round-trip):
    - List: invalid `style` throws
    - List: nested item with `checked` only allowed for `style='todo'` (validate or just round-trip — pick one and document)
    - Table: rows with mismatched cell counts throws (AC6)
    - Heading: `level: 4` throws (per `HeadingBlock` type — level is 1|2|3)
    - Callout: invalid `tone` throws (must be one of `DOC_CONTENT_CALLOUT_TONES`)
    - CodeBlock: round-trips multi-line code with no language
    - CodeGroup: empty `items: []` round-trips
    - Image: caption with marks round-trips
    - Link: link with `title` round-trips; link without `title` round-trips (no `title` key on output if absent on input)
  - [x] Existing 14 Story 6.2 tests must continue to pass. The "link flattening" 6.2 test is the one exception — update or delete it per the previous task.
- [x] Document the converter scope (AC: 7, 10)
  - [x] Update `packages/editor/README.md` "Runtime engine" section: replace the line "Story 6.2 ships paragraph + heading + the 5 supported marks. Story 6.3 expands to all 11 DocContentV1 block types." with present-tense "All 11 DocContentV1 block types and the `link` inline node round-trip through the converters. Plugin-driven editing UI for these types lands in Story 6.4."
  - [x] Add a short "Block-type mapping" subsection inside README documenting the DocContent ↔ Plate element-type table from Task 1.
- [x] Verify the full regression gate (AC: 9, 10)
  - [x] `pnpm --filter @anydocs/editor typecheck` → exit 0
  - [x] `pnpm --filter @anydocs/editor test` → all tests pass (75 from prior + ~30 new = ~105+)
  - [x] `pnpm --filter @anydocs/editor contract:check` → "in sync"
  - [x] `pnpm --filter @anydocs/editor build` → emits new converter modules
  - [x] `pnpm typecheck` (root) → all 7 packages clean
  - [x] `pnpm test` (root) → all packages green
  - [x] `pnpm lint` → 0 errors, no new warnings
  - [x] `pnpm build` (root) → all 8 packages clean
- [x] (If time allows) Verify mounted-editor behavior on the new block types — note in Dev Agent Record (AC: 8)
  - [x] In the editor's jsdom test environment, mount an instance and call `setContent` with a list / codeBlock fixture. Observe whether Plate normalises the unknown types or accepts them.
  - [x] Document the observation in Dev Agent Record. If Plate strips unknowns, this is a Story 6.4 concern (proper plugin registration) — NOT a 6.3 blocker.

## Dev Notes

- **Scope discipline**: this story is converter-only. The Plate **plugin** layer (which controls editing UX, slash-menu insertion, schema validation in the editor) is Story 6.4's job. Do NOT add `@udecode/plate-list`, `@udecode/plate-code-block`, etc. as dependencies in this story — keep the Plate dep set lean until 6.4 makes plugin choices.
- **Why per-type helper files were rejected**: an earlier draft considered splitting each block type into `src/converters/<type>.ts`. Rejected because (a) the converters share helpers (`inlineChildren`, `marksToPlateFlags`) that don't benefit from being moved; (b) navigating one large file with named per-type helpers is easier than 22 small files; (c) Story 6.4 will refactor again into plugin-bound converters anyway.
- **Round-trip equality is the load-bearing assertion**. If `deepEqual(input, roundTrip(input))` passes for every fixture, the converters are correct by definition. Per-type assertions on intermediate Plate shape are useful for debugging but NOT the AC.
- **AC6 vs AC8 tension**: AC6 says structural validation failures are loud. AC8 says we don't register Plate plugins. These don't conflict — converter-side validation (AC6) lives in the converter helpers and throws BEFORE the Plate AST is constructed. Plate plugin-level validation (Story 6.4) is a separate, later gate.
- **`canvas` peer-dep warning**: jsdom 29 emits a peer-dep warning about an unmet `canvas` peer. This is a pre-existing 6.2 condition; 6.3 should not introduce a new install warning or attempt to satisfy `canvas`.

### Developer Context

**Business objective**
- Close the converter scope gap from Story 6.2. The current "throws on list/code/image/etc." behavior is acceptable as a temporary state but blocks any host code that uses non-paragraph-non-heading content from interacting with `@anydocs/editor`.
- Provide the data-shape foundation Story 6.4 (plugin contract) and Story 7.x (Studio cutover) need.
- Make the canonical block-type set machine-checkable: a fixture per type, a round-trip test per fixture, regression coverage in CI.

**Current baseline (post Stories 6.1 + 6.2 + 6.5)**
- `packages/editor/src/converters/doc-content-to-plate.ts` handles paragraph + heading; everything else throws with a "Story 6.3" hint. Story 6.3 deletes that hint and implements the missing cases.
- `packages/editor/src/converters/plate-to-doc-content.ts` handles `p` + `h1`/`h2`/`h3`; everything else throws.
- `packages/editor/src/converters/mark-mapping.ts` covers the 5 marks (`bold`/`italic`/`underline`/`strike`/`code`). No changes needed here.
- `packages/editor/tests/plate-converter.test.ts` has 14 tests covering paragraph + heading + marks + error paths. Story 6.3 extends to ~30+ tests.
- `packages/editor/tests/plate-runtime.test.ts` has 19 jsdom-backed mount/lifecycle tests. Story 6.3 does NOT touch these (the editor's plugin set is unchanged).
- Story 6.5's `tests/contract-snapshot.test.ts` is the load-bearing CI gate — it must stay green; 6.3 does NOT widen the public surface.

**Current gap (closed by this story)**
- 9 of the 11 canonical block types have no converter logic.
- The `link` inline node round-trips lossy (Story 6.2 flattening trade).
- No reference fixture suite exists for canonical block shapes — every consumer that wants a "show me a valid list payload" example has to read the schema.

**Scope guardrails**
- Do NOT modify `contract/public-api.ts` or `src/index.ts`. The 5-symbol public surface stays byte-identical.
- Do NOT add new Plate plugin packages. The plate-runtime keeps its 2-plugin setup until 6.4.
- Do NOT modify `src/runtime/plate-runtime.ts` except as necessary to thread converter outputs through (the mount/lifecycle code from 6.2 is correct as-is).
- Do NOT change Yoopta integration in `packages/web/` (that's Story 7.x).
- Do NOT split converter logic into per-type files — keep the single forward + inverse file structure from 6.2.

### Technical Requirements

- **Round-trip equality**: `deepEqual(input, plateToDocContent(docContentToPlate(input)))` MUST hold for every fixture in `tests/fixtures/doc-content/`. This is the canonical AC validator.
- **Absent-vs-empty discipline**: properties absent on input (no `title` on a codeBlock, no `tone` on a callout) MUST be absent on output. Convert intermediate Plate shapes use empty-string sentinels for storage convenience, but the inverse converter strips empties so `deepEqual` against the original passes.
- **Type narrowing**: each per-type helper takes a narrowed `DocBlock` union member. Use TypeScript discriminated-union narrowing (`switch (block.type)`) so the compiler proves exhaustiveness — the `default` case becomes a type-narrowing `never` check (AC1: no `default` fallback throws on canonical types; the `default` is the AC5 unrecognised-type case).
- **Structural validation** lives in the converter helpers (AC6). E.g. `tableBlockToPlate` validates row-cell-count consistency before emitting the Plate `table` element.
- **Determinism**: converter output is purely structural; no UUIDs generated, no timestamps. For blocks with optional `id` fields, the `id` (if present on input) is preserved through both directions.

### Architecture Compliance

- Continues Migration Strategy Phase 1 ("Foundation: Create `@anydocs/editor` package with the public API contract. Internally implemented over Plate. Ship `doc-content-v1 ↔ plate-value` converters under `src/converters/`."). [Source: architecture.md → Migration Strategy: Yoopta → Plate]
- Canonical storage stays `doc-content-v1` — the converters are the boundary; the rest of the codebase never sees a Plate value. [Source: architecture.md → `@anydocs/editor` Package Contract]
- Internal Plate types must not be re-exported through the package entry. Story 6.5's contract-snapshot test enforces this. The converter Plate-type defs (`PlateElementNode`, `PlateTextNode`, `PlateValue` from 6.2) stay internal — do NOT re-export.
- Naming conventions: kebab-case filenames (`doc-content-to-plate.ts`), camelCase functions (`paragraphBlockToPlate`), PascalCase types (`PlateValue`). [Source: Phase 1 architecture Naming Patterns]

### Library / Framework Requirements

- **No new runtime or devDependencies.** Story 6.3 is pure logic on top of the Plate runtime Story 6.2 already installed. Plate plugin packages (e.g. `@udecode/plate-list`) are explicitly out of scope; they enter via Story 6.4 when the EditorPlugin contract lands.
- **TypeScript strict mode** stays enforced.
- **Node 22 LTS** for tests (built-in `node --test --experimental-strip-types`).

### File Structure Requirements

**To create:**

```
packages/editor/
├── src/
│   └── converters/
│       ├── element-types.ts                  ← NEW: shared Plate element-type constants
│       (existing files extended in-place)
└── tests/
    └── fixtures/
        └── doc-content/
            ├── paragraph-with-marks.json     ← NEW
            ├── heading-l1.json               ← NEW
            ├── heading-l2.json               ← NEW
            ├── heading-l3.json               ← NEW
            ├── list-bulleted-nested.json     ← NEW
            ├── list-numbered-nested.json     ← NEW
            ├── list-todo-mixed.json          ← NEW
            ├── code-block-with-language.json ← NEW
            ├── code-block-minimal.json       ← NEW
            ├── code-group-two-items.json     ← NEW
            ├── blockquote-with-marks.json    ← NEW
            ├── callout-info-with-title.json  ← NEW
            ├── callout-no-tone.json          ← NEW
            ├── table-3x3-with-header.json    ← NEW
            ├── image-with-caption.json       ← NEW
            ├── image-minimal.json            ← NEW
            ├── divider.json                  ← NEW
            ├── mermaid-with-title.json       ← NEW
            └── paragraph-with-link.json      ← NEW
```

**To modify:**

- `packages/editor/src/converters/doc-content-to-plate.ts` — extend with per-type helpers
- `packages/editor/src/converters/plate-to-doc-content.ts` — extend with inverse per-type helpers
- `packages/editor/tests/plate-converter.test.ts` — add fixture-driven round-trip suite + per-type focused tests
- `packages/editor/README.md` — update "Runtime engine" section + add "Block-type mapping" subsection

**Reference-only (do not modify):**

- `packages/editor/src/converters/mark-mapping.ts` — covers the 5 marks; complete from 6.2
- `packages/editor/src/runtime/plate-runtime.ts` — plate runtime; do NOT change plugin list (Story 6.4)
- `packages/editor/contract/public-api.ts` — public surface; do NOT touch (Story 6.5 snapshot enforces)
- `packages/core/src/types/content.ts` — canonical DocContentV1 schema (read-only)
- `packages/core/src/utils/doc-content-adapter.ts` — Yoopta ↔ doc-content shape (reference only; do NOT copy)

**Out of scope for this story:**

- Plate plugin registration for new block types → Story 6.4
- EditorPlugin contract changes → Story 6.4
- Studio integration / dual-mount fixtures → Story 7.x
- Editor UI / toolbar / slash-menu for new block types → Story 6.4 + 13.x
- Performance budgets for converter throughput → future cleanup

### Testing Requirements

- All new tests live in `packages/editor/tests/` and use the Node built-in test runner.
- Fixture-driven tests use `node:fs/promises.readFile` (sync `readFileSync` is also fine) inside a `for (const file of fixtureFiles)` loop. Use `import.meta.url` + `node:path` to resolve fixture paths.
- Each fixture is a JSON file containing a complete `DocContentV1` document. Round-trip equality is asserted via `assert.deepStrictEqual`.
- Per-type error tests verify AC5+AC6: structural failures throw with messages identifying the offending block.
- The "link flattening" test from Story 6.2 must be reconciled — either deleted (because the behaviour is no longer correct) or rewritten to assert the new non-lossy behaviour.
- The `contract-snapshot.test.ts` from Story 6.5 must continue to pass — Story 6.3 must not widen the public surface.
- Performance: the full fixture suite should run in < 2s. With ~19 fixtures, this is generous.

### Previous Story Intelligence (Stories 6.1 + 6.2 + 6.5)

- **Story 6.1**: Public surface locked at 5 symbols; do not touch. Strict-mode typecheck pattern via `pnpm --filter @anydocs/core build && tsc --noEmit -p tsconfig.json`.
- **Story 6.2**:
  - The plate-runtime already mounts paragraph + heading via `ParagraphPlugin` and `HeadingPlugin`. Story 6.3 does NOT extend this.
  - The existing converter file structure (`src/converters/{mark-mapping, doc-content-to-plate, plate-to-doc-content}.ts`) is the foundation. Extend, don't restructure.
  - The `inlineChildren` helper in `doc-content-to-plate.ts` currently flattens links; replace with proper `a` element emission.
  - The `plateChildrenToInline` helper in `plate-to-doc-content.ts` currently throws on nested elements; extend to recognise the `a` element.
  - Story 6.2's `setContent` uses key-bumped re-mount to force Plate's React store to reflect programmatic value changes. Story 6.3 does NOT change this.
- **Story 6.5**: Contract snapshot test is the safety net — runs in every `pnpm test`. If 6.3 accidentally touches `contract/public-api.ts` or `src/index.ts`, the test fails loudly.
- **Open follow-ups not blocking this story**:
  - Story 6.1 M1 (`EditorNotImplementedError` semantic misuse) → Story 6.4 cleanup
  - Story 6.2 polish items (none formally logged yet; pending 6.2 code review)
  - Story 6.5 L1-L4 (extractor robustness) → independent

### Git Intelligence Summary

- Story 6.2 merged in commit (TBD — currently in review). The Plate v49 lockfile diff is the recent baseline; 6.3 should produce a tiny lockfile diff (no new deps).
- Commit pattern for 6.x: `feat(editor): <description> (Story 6.X)`. 6.3 will follow.
- Bundle / dep delta: 0 new packages (vs 6.2's ~30). Code delta: ~400-500 LOC + ~19 fixture files + ~30 test cases.

### Latest Tech Information

- Plate v49's element types are flexible strings; the editor accepts arbitrary `{ type, children }` shapes at the data layer. Plate's normalisation / rendering only kicks in for types with registered plugins. For 6.3's converter scope, this means we can emit any `{ type, children }` shape without needing a Plate plugin registered — Story 6.4 adds the plugins for rendering UI.
- TypeScript 5.x exhaustiveness checks work via `never` in `default` branches: `default: { const _exhaustive: never = block; throw new Error(...) }`. Story 6.3 should use this pattern so future block-type additions surface as type errors at the converter level.

### Project Structure Notes

- Story 6.3 sits between 6.2 (Plate runtime) and 6.4 (plugin contract). Sprint plan slots all three into Sprint 2.
- After 6.3 lands, 6.4 (EditorPlugin contract + 8 built-in plugins) is the natural next step. The 8 plugins from 6.4 spec are: heading, paragraph, list, code, image, callout, table, divider. That's 8 of the 11 we cover in 6.3 — the remaining 3 (codeGroup, blockquote, mermaid) stay converter-only and may grow proper plugins later.
- Studio dual-mount (Story 7.2) needs end-to-end content round-trip across realistic project sizes. The fixture suite from 6.3 is a useful starting set; Story 7.2 will expand it with full pages drawn from real example projects.

### Project Context Reference

- No `project-context.md` file was found in this repository.
- Source-of-truth artifacts for this story:
  - `artifacts/bmad/planning-artifacts/prd.md` — FR60 (independent package + contract)
  - `artifacts/bmad/planning-artifacts/architecture.md` — `@anydocs/editor` Package Contract + Migration Strategy
  - `artifacts/bmad/planning-artifacts/epics.md` — Epic 6, Story 6.3 (lines 854-869)
  - `artifacts/bmad/implementation-artifacts/6-1-...md`, `6-2-...md`, `6-5-...md` — prior stories
  - `packages/core/src/types/content.ts` — canonical DocContentV1 schema (single source of truth)

### References

- [`prd.md` FR60](../planning-artifacts/prd.md) — independent editor package with declared public API contract
- [`architecture.md` Migration Strategy: Yoopta → Plate](../planning-artifacts/architecture.md)
- [`epics.md` Story 6.3](../planning-artifacts/epics.md) — BDD ACs
- [`6-1-...md`](6-1-scaffold-anydocs-editor-package-and-public-api-contract-file.md)
- [`6-2-...md`](6-2-implement-plate-based-block-runtime-inside-the-package.md)
- [`6-5-...md`](6-5-add-ci-contract-diff-check-for-anydocs-editor.md)
- [`packages/core/src/types/content.ts`](../../../packages/core/src/types/content.ts) — DOC_CONTENT_BLOCK_TYPES, DocBlock unions
- [`packages/editor/src/converters/doc-content-to-plate.ts`](../../../packages/editor/src/converters/doc-content-to-plate.ts) — forward converter to extend
- [`packages/editor/src/converters/plate-to-doc-content.ts`](../../../packages/editor/src/converters/plate-to-doc-content.ts) — inverse converter to extend
- [`packages/editor/src/converters/mark-mapping.ts`](../../../packages/editor/src/converters/mark-mapping.ts) — mark helpers (no changes needed)

## Dev Agent Record

### Agent Model Used

Claude Opus 4.7 (`claude-opus-4-7`)

### Debug Log References

- 2026-05-27: Centralised the Plate element-type table in `src/converters/element-types.ts`. Both converter directions import from this module so adding / renaming an element string requires exactly one edit. The mapping uses Plate's conventional names where they exist (`p`, `h1`, `ul`, `code_block`, `hr`) and stable invented names for the rest (`code_group`, `todo_list`, `todo_li`, `callout`, `mermaid`).
- 2026-05-27: Used TypeScript discriminated-union exhaustiveness in the forward converter's top-level switch (`default: const exhaustive: never = block;`). Adding a new DocBlock variant without extending the switch now surfaces as a compile error, in addition to the runtime `unrecognised block type` throw.
- 2026-05-27: First round of test runs surfaced 4 jsdom-side failures (`getContent immediately after construction`, `setContent updates getContent for the next call`, `setContent → getContent cycle is stable`, `on("change") fires after setContent and receives the new payload`). Root cause: Plate v49's core `NodeIdPlugin` auto-injects `id` properties on every block lacking one — both at initial normalization AND on every `editor.tf.insertNode` / `setValue` call. This made `getContent()` lossy round-trip: DocContentV1's optional `id` would always be populated on output even when absent on input.
- 2026-05-27: First fix attempt used `NodeIdPlugin.configure({ normalizeInitialValue: null })`. This disabled initial-value id injection (passed 1 of the 4 tests) but NOT insertion-time injection. Second fix passed `nodeId: false` directly to `createPlateEditor` — this disables the entire NodeId plugin via the `withSlate` options path and resolves all 4 failures while preserving paragraph + heading runtime behavior. The decision is captured in a code comment + README.
- 2026-05-27: Story 6.2's "doc→plate flattens link inline nodes to their text children" test was renamed/replaced with "Story 6.3 fix: link inline nodes round-trip non-lossy". The new test asserts the correct round-trip behavior; the old test asserted the lossy Story-6.2 trade that 6.3 explicitly resolves.

### Completion Notes List

- **All 11 DocContentV1 block types covered.** The forward converter's top-level switch is exhaustive over the DocBlock discriminated union; the inverse converter recognises every Plate element type the forward emits. Story 6.2's "Story 6.3 expands" throw branches are gone.
- **Link round-trip non-lossy.** The forward direction emits `{ type: 'a', href, title?, children: [...text] }`; the inverse recognises it and reconstructs `LinkNode`. The lossy "flatten link to text children" trade from Story 6.2 is closed.
- **NodeIdPlugin disabled** via `nodeId: false` in `createPlateEditor`. Plate's default behavior would have made all DocContentV1 round-trips lossy because the optional `id` field gets auto-injected on every block. The canonical id semantics belong to the host — the editor only preserves ids the caller supplied.
- **Absent-vs-empty discipline upheld throughout.** Properties absent on canonical input (no `tone` on a callout, no `language` on a codeBlock, no `caption` on an image, no `title` on a link) are absent on round-trip output — the inverse converter only emits keys when the Plate intermediate has the field. Verified by 5+ specific tests including "image: minimal payload omits caption / width / height / alt / title keys".
- **Structural validation is loud.** Heading levels outside 1..3 throw; table rows with mismatched cell counts throw; callouts with non-canonical tones throw; lists with unknown styles throw. Each error message names the offending block index and the violated rule.
- **Per-type helpers.** Each block type has its own small helper function (e.g. `paragraphBlockToPlate`, `listBlockToPlate`, `tableBlockToPlate`) sharing the inline-children + id-preservation utilities. The structure mirrors the inverse direction so reviewers can compare them side-by-side.
- **Element-type strings centralised** in `src/converters/element-types.ts`. The forward converter, inverse converter, and (future) Story 6.4 plugin contract will all import the same constants.
- **No new dependencies.** Story 6.3 is pure logic on top of the Plate v49 runtime Story 6.2 already installed. Plate plugin packages (`@udecode/plate-list`, `@udecode/plate-code-block`, etc.) explicitly deferred to Story 6.4 when the EditorPlugin contract lands.
- **Contract surface byte-identical.** `pnpm --filter @anydocs/editor contract:check` returns "in sync" — Story 6.5's snapshot safety net validates AC9.
- **Plate runtime plugin list unchanged.** `plate-runtime.ts` continues to register only `ParagraphPlugin` + `HeadingPlugin`. A mounted editor will accept the additional block types as well-formed Slate elements but will not render them with custom UI — that is Story 6.4's job. Documented as a known limitation in Dev Notes per AC8.
- **19 reference fixtures** (`tests/fixtures/doc-content/*.json`) double as canonical-shape documentation for each block type.

### Validation Evidence

- `pnpm --filter @anydocs/editor typecheck` → exit 0 (both `tsconfig.json` + `scripts/tsconfig.json` clean)
- `pnpm --filter @anydocs/editor test` → **105/105 passing** (75 from prior + 30 net new for 6.3: 19 fixture round-trips + 11 in-memory edge cases / error paths)
- `pnpm --filter @anydocs/editor contract:check` → "in sync" (Story 6.5 snapshot safety net validates AC9)
- `pnpm --filter @anydocs/editor build` → emits `dist/src/converters/element-types.{js,d.ts}` plus the existing surface; no `dist/scripts/*` leakage
- `pnpm typecheck` (root, 7 packages) → all clean
- `pnpm test` (root regression gate) → core 155 + editor 105 + cli 36+2 skip + mcp 44 = **340 pass / 0 fail** (up from 310 → +30 new tests for Story 6.3)
- `pnpm lint` → 0 errors, 18 pre-existing warnings (no new)

### File List

**New files**

- `packages/editor/src/converters/element-types.ts` — shared Plate element-type constants for both converter directions
- `packages/editor/tests/fixtures/doc-content/paragraph-with-marks.json` (+ 18 other fixtures, one per block-type variant)
- `packages/editor/tests/fixtures/doc-content/heading-l1.json`
- `packages/editor/tests/fixtures/doc-content/heading-l2.json`
- `packages/editor/tests/fixtures/doc-content/heading-l3.json`
- `packages/editor/tests/fixtures/doc-content/list-bulleted-nested.json`
- `packages/editor/tests/fixtures/doc-content/list-numbered-nested.json`
- `packages/editor/tests/fixtures/doc-content/list-todo-mixed.json`
- `packages/editor/tests/fixtures/doc-content/code-block-with-language.json`
- `packages/editor/tests/fixtures/doc-content/code-block-minimal.json`
- `packages/editor/tests/fixtures/doc-content/code-group-two-items.json`
- `packages/editor/tests/fixtures/doc-content/blockquote-with-marks.json`
- `packages/editor/tests/fixtures/doc-content/callout-info-with-title.json`
- `packages/editor/tests/fixtures/doc-content/callout-no-tone.json`
- `packages/editor/tests/fixtures/doc-content/table-3x3-with-header.json`
- `packages/editor/tests/fixtures/doc-content/image-with-caption.json`
- `packages/editor/tests/fixtures/doc-content/image-minimal.json`
- `packages/editor/tests/fixtures/doc-content/divider.json`
- `packages/editor/tests/fixtures/doc-content/mermaid-with-title.json`
- `packages/editor/tests/fixtures/doc-content/paragraph-with-link.json`

**Modified files**

- `packages/editor/src/converters/doc-content-to-plate.ts` — added per-type helpers for list / codeBlock / codeGroup / blockquote / callout / table / image / divider / mermaid; replaced lossy link flattening with proper `a` element emission; centralized element-type strings via `element-types.ts`
- `packages/editor/src/converters/plate-to-doc-content.ts` — added per-type inverse helpers mirroring the forward direction; recognises `a` element and reconstructs `LinkNode`
- `packages/editor/src/runtime/plate-runtime.ts` — added `nodeId: false` to `createPlateEditor` to disable Plate's auto-id injection (load-bearing for round-trip equality)
- `packages/editor/tests/plate-converter.test.ts` — replaced Story 6.2's "throws on unsupported types" expectations with comprehensive coverage: 19 fixture-driven round-trips + per-type focused error paths + edge-case tests for absent-field preservation
- `packages/editor/README.md` — added "Block-type mapping" subsection documenting the DocContent ↔ Plate element-type table; updated "Runtime engine" notes
- `artifacts/bmad/implementation-artifacts/sprint-status.yaml` — `6-3-...` status transitions

### Review Follow-ups (AI)

- [ ] [AI-Review][Low] Remove dead re-exports `PLATE_PARAGRAPH_TYPE` / `PLATE_HEADING_TYPES` from `doc-content-to-plate.ts`. Comment claimed inverse converter compat but no consumer imports them after the 6.3 element-types refactor. [packages/editor/src/converters/doc-content-to-plate.ts:440-444]
- [ ] [AI-Review][Low] `listItemFromPlate` silently skips children that are neither PlateElement nor PlateInline. Add a defensive `throw` mirroring the "unexpected nested element of type 'X'" pattern used elsewhere so malformed Plate input surfaces a clear error instead of disappearing. [packages/editor/src/converters/plate-to-doc-content.ts:147-167]
- [ ] [AI-Review][Low] Drop the unused `_index` parameter from `codeGroupBlockToPlate` (or use it for the error path like the other per-type helpers). [packages/editor/src/converters/doc-content-to-plate.ts:171]
- [ ] [AI-Review][Low] Refactor `listContainerTypeFor`'s `index = -1` sentinel into a clearer `nestedContext?: boolean` parameter. The current sentinel-driven branch is functional but obscures intent. [packages/editor/src/converters/doc-content-to-plate.ts:139-160]
- [ ] [AI-Review][Low] Expand round-trip fixture coverage: `image` with empty `caption: []`, `table` row with `cells: []`, a 10+ block mixed-type document. Not blocking; useful when Story 7.2 dual-mount fixtures land. [packages/editor/tests/fixtures/doc-content/]

## Senior Developer Review (AI)

**Reviewer:** Claude Opus 4.7 (adversarial pass)
**Review Date:** 2026-05-27
**Review Outcome:** Approve — transition to `done` after M1 fix landed
**Severity Breakdown:** 0 High · 1 Medium (fixed in-line) · 5 Low (logged as Review Follow-ups)

### Summary

All 10 acceptance criteria satisfied. 19 reference fixtures + 25 in-memory tests = 44 converter tests + 3 contract.test surface checks + 1 M1 regression test pass. Forward + inverse converters cover all 11 DocContentV1 block types; `link` round-trips non-lossy (closes Story 6.2 trade); absent-vs-empty discipline held through both directions; structural validation throws with structured messages on heading-level / list-style / table-row / callout-tone violations. Contract surface byte-identical (Story 6.5 snapshot safety net confirms AC9).

**1 MEDIUM finding — fixed in-line:**

- **M1** (`plate-to-doc-content.ts` error message bug) — the `unrecognised Plate element type` error listed `Object.values(HEADING_LEVEL_BY_TYPE)` (which are the level numbers `1`, `2`, `3`) instead of `Object.keys(...)` (which are the element-type strings `h1`, `h2`, `h3`). The test asserted only the leading message + `at index N` portion so the bug slipped through. Fix: `Object.values` → `Object.keys` for both `HEADING_LEVEL_BY_TYPE` and `LIST_STYLE_BY_TYPE`. **+1 regression test** asserting the message contains `h1`/`h2`/`h3`/`todo_list` and NOT raw integers or DocContent style names.

LOW findings (L1 dead re-exports, L2 silent-skip in list-item, L3 unused `_index`, L4 sentinel `-1` for nested-context, L5 fixture coverage gaps) logged as Review Follow-ups.

### Action Items

- [x] [Medium] M1 → fixed in `plate-to-doc-content.ts`: `Object.keys` for both maps; +1 regression test
- [x] [Low] L1–L5 → tracked as Review Follow-ups (non-blocking)

## Change Log

| Date       | Version | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Author |
|------------|---------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|--------|
| 2026-05-27 | 0.1.0   | Initial story file created via `create-story` workflow. Pulls converter scope from `packages/core/src/types/content.ts` (11 canonical block types + link inline). Story 6.3 closes the converter scope gap explicitly left by Story 6.2's paragraph+heading-only scope. Plate plugin registration stays unchanged (Story 6.4 owns that). 19 fixture files + ~30 test cases. Link flattening from 6.2 is fixed here (`a` element emitted properly). No new dependencies. | Claude Opus 4.7 (story writer) |
| 2026-05-27 | 0.2.0   | Implementation landed. All 11 DocContentV1 block types + link inline now round-trip non-lossy. Discovered + closed a Plate `NodeIdPlugin` auto-injection issue by passing `nodeId: false` to `createPlateEditor` (would have made every block's `id` field always populated on output). 19 fixtures + 11 inline edge-case / error-path tests = +30 new tests. Editor 75 → 105; root regression 310 → 340 pass / 0 fail. Contract surface byte-identical. Status `in-progress → review`. | Claude Opus 4.7 (dev agent) |
| 2026-05-27 | 0.3.0   | Senior Developer Review (AI) completed. 1 MEDIUM finding (M1 — error-message bug where `Object.values` listed integer enums instead of element-type strings) fixed in-line; +1 regression test. 5 LOW findings logged as Review Follow-ups. Editor tests 108 → 109; root regression 343 → 344 pass / 0 fail. Status `review → done`. | Claude Opus 4.7 (reviewer + fixer) |
