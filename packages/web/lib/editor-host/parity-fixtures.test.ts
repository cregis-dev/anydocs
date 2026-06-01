// =============================================================================
// Cross-editor parity matrix (Story 7.2 AC5/AC6 — kept as historical gate
// after Story 7.3 cutover).
// -----------------------------------------------------------------------------
// Drives every fixture in `packages/editor/tests/fixtures/doc-content/`
// through BOTH converter paths and asserts each round-trips to the same
// canonical DocContentV1:
//
//   Legacy path:  DocContentV1 → docContentToYoopta → yooptaToDocContent → DocContentV1
//   New path:     DocContentV1 → docContentToPlate  → plateToDocContent  → DocContentV1
//
// **Status after Story 7.3 (cutover landed)**: the legacy editor is gone
// from Studio, but `yooptaToDocContent` stays in `@anydocs/core` to
// support `packages/web/lib/docs/fs.ts`'s lazy migration of legacy
// on-disk pages. This matrix therefore continues to run as a **historical
// regression gate**: if a future change breaks the legacy converter,
// pages still saved in Yoopta shape would fail to migrate forward — and
// the parity assertions here would surface that breakage at test time
// rather than at user-facing read time.
//
// If a fixture legitimately can't round-trip through Yoopta (e.g. Yoopta
// never supported a block type the schema added later), record it in
// KNOWN_LEGACY_DIVERGENCES with an inline reason — and there's a separate
// test asserting the skip list is empty so the divergence stays visible.
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { DocContentV1 } from '@anydocs/core';
// Use the leaf-module subpath `@anydocs/core/doc-content-adapter` rather
// than the barrel — keeps this new file consistent with the subpath
// discipline established elsewhere in `lib/editor-host/` (`editor-host.ts`,
// `normalize-input.ts`). Tests aren't bundled by webpack so the barrel
// would still work here, but the discipline only earns its keep when
// applied uniformly. See Story 7.2 review M2.
import { docContentToYoopta, yooptaToDocContent } from '@anydocs/core/doc-content-adapter';
import { createEditor } from '@anydocs/editor';

// The new-path converter (Story 6.3/6.4 docContentToPlate / plateToDocContent
// internal dispatch) is exercised through `@anydocs/editor`'s PUBLIC surface
// — `createEditor` + `getContent` round-trips the input via the same
// internal dispatch the runtime uses at mount time. Keeps Story 7.1's
// call-graph audit ("only `@anydocs/editor` package entry") happy without
// reaching into internals.
function newConverterRoundTrip(input: DocContentV1): DocContentV1 {
  const instance = createEditor({ initialContent: input });
  return instance.getContent();
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = path.resolve(
  __dirname,
  '..',
  '..',
  '..',
  'editor',
  'tests',
  'fixtures',
  'doc-content',
);

const fixtureFiles = readdirSync(FIXTURE_DIR)
  .filter((name) => name.endsWith('.json'))
  .sort();

// Story 7.2 AC6 hard requirement: this list MUST be empty at story landing
// time. Each entry is a fixture file name + a documented reason; the
// "skip-list is empty" guard below enforces that any legacy divergence is
// visible in code review.
const KNOWN_LEGACY_DIVERGENCES: Array<{ fixture: string; reason: string }> = [
  // Example shape (do not add without explicit ack):
  // { fixture: 'some-fixture.json', reason: 'Yoopta v6 dropped X support; tracked as 7.2 follow-up' },
];

function loadFixture(name: string): DocContentV1 {
  return JSON.parse(readFileSync(path.join(FIXTURE_DIR, name), 'utf8')) as DocContentV1;
}

/**
 * Normalize a DocContentV1 payload by stripping EDITOR-MANAGED METADATA
 * before parity comparison. Two normalisations apply, both documented as
 * Story 7.3 cutover concerns:
 *
 * 1. **Auto-assigned `id` fields** — Yoopta's converter auto-assigns
 *    `id: 'block-N'` to every block on roundtrip (analogous to Plate's
 *    NodeIdPlugin, which Story 6.3 disabled via `nodeId: false`). The new
 *    editor preserves input ids verbatim. Stripping ids from both sides
 *    keeps the parity check focused on content equivalence.
 *
 * 2. **Falsy `header` flag on table cells** — Yoopta's converter
 *    materialises `header: false` on every non-header cell; the fixture
 *    schema treats absence and `false` as semantically equivalent
 *    (renders as `<td>` either way). Stripping `header: false` from both
 *    sides keeps the parity check focused on actual header-vs-body cell
 *    intent.
 *
 * Story 6.3 still proves that genuine `id` values round-trip CORRECTLY
 * through the new editor (`blocks preserve optional id fields across
 * round-trip` test). This helper does NOT undermine that — it only
 * normalises legacy auto-fill behaviors so the cross-editor matrix
 * compares ACTUAL CONTENT.
 */
function normalizeForParity(doc: DocContentV1): DocContentV1 {
  return {
    version: doc.version,
    blocks: doc.blocks.map((block) => normalizeNode(block as Record<string, unknown>)) as DocContentV1['blocks'],
  };
}

function normalizeNode(node: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    // Editor-managed metadata stripped from both sides of every comparison.
    if (key === 'id') continue;
    if (key === 'header' && value === false) continue;
    if (Array.isArray(value)) {
      result[key] = value.map((entry) =>
        entry !== null && typeof entry === 'object' && !Array.isArray(entry)
          ? normalizeNode(entry as Record<string, unknown>)
          : entry,
      );
    } else if (value !== null && typeof value === 'object') {
      result[key] = normalizeNode(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Sanity gates
// ---------------------------------------------------------------------------

test('parity fixture directory resolves and contains the Story 6.3 fixtures', () => {
  assert.ok(
    fixtureFiles.length >= 19,
    `expected >= 19 fixtures (Story 6.3 set), got ${fixtureFiles.length} from ${FIXTURE_DIR}`,
  );
});

test('KNOWN_LEGACY_DIVERGENCES is empty (Story 7.2 AC6 hard requirement)', () => {
  assert.equal(
    KNOWN_LEGACY_DIVERGENCES.length,
    0,
    `Story 7.2 AC6 requires zero block-level divergences. Documented divergences:\n${KNOWN_LEGACY_DIVERGENCES.map(
      (e) => `  - ${e.fixture}: ${e.reason}`,
    ).join('\n')}`,
  );
});

// ---------------------------------------------------------------------------
// Per-fixture parity assertions
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Documented behavioural divergences (not failures — invariants we ASSERT
// because they affect Story 7.3 cutover planning).
// ---------------------------------------------------------------------------

test('documented: legacy Yoopta converter auto-assigns block ids on roundtrip', () => {
  // The fixture has no `id` on its single paragraph block; after Yoopta
  // roundtrip, the block gains `id: 'block-1'`. The new editor preserves
  // input verbatim. Story 7.3 cutover must reckon with this transition:
  // existing-on-disk pages saved by Yoopta keep their ids; fresh pages
  // saved by the new editor have no auto-assigned ids unless the user
  // explicitly sets them.
  const input: DocContentV1 = {
    version: 1,
    blocks: [{ type: 'paragraph', children: [{ type: 'text', text: 'sentinel' }] }],
  };
  const legacyRoundTrip = yooptaToDocContent(docContentToYoopta(input));
  const newRoundTrip = newConverterRoundTrip(input);

  // Legacy ADDS an id; new preserves the absent id.
  assert.ok(
    typeof (legacyRoundTrip.blocks[0] as { id?: unknown }).id === 'string',
    'legacy Yoopta path is expected to auto-assign a block id (documents the Story 7.3 cutover concern)',
  );
  assert.equal(
    (newRoundTrip.blocks[0] as { id?: unknown }).id,
    undefined,
    'new editor path is expected to leave id absent when input has no id',
  );
});

for (const file of fixtureFiles) {
  const isLegacyExcluded = KNOWN_LEGACY_DIVERGENCES.some((entry) => entry.fixture === file);

  test(`parity (legacy Yoopta — id-stripped): ${file}`, { skip: isLegacyExcluded }, () => {
    const input = loadFixture(file);
    const yoopta = docContentToYoopta(input);
    const roundTripped = yooptaToDocContent(yoopta);
    // Yoopta auto-assigns block ids on roundtrip; the new editor preserves
    // input ids verbatim. AC6's "block-level divergence" is interpreted as
    // CONTENT divergence (text, marks, structure, types, props), NOT
    // EDITOR-MANAGED METADATA (ids). Strip ids from BOTH sides before
    // comparison so the matrix proves content equivalence.
    assert.deepStrictEqual(
      normalizeForParity(roundTripped),
      normalizeForParity(input),
      `Legacy Yoopta converter lost or mutated CONTENT (not just ids) for fixture '${file}'. ` +
        `If this divergence is acceptable for Story 7.2 (and only Story 7.2), ` +
        `add an entry to KNOWN_LEGACY_DIVERGENCES with a reason — but note that ` +
        `Story 7.3 (Yoopta retirement) requires the skip-list to be empty before cutover.`,
    );
  });

  test(`parity (new @anydocs/editor): ${file}`, () => {
    const input = loadFixture(file);
    const roundTripped = newConverterRoundTrip(input);
    assert.deepStrictEqual(
      roundTripped,
      input,
      `New @anydocs/editor converter dispatch lost or mutated content for fixture '${file}'. ` +
        `This is a Story 6.3/6.4 regression — Story 7.2's parity gate caught it.`,
    );
  });

  test(`parity (cross-editor equivalence — id-stripped): ${file}`, { skip: isLegacyExcluded }, () => {
    const input = loadFixture(file);
    const legacyRoundTrip = yooptaToDocContent(docContentToYoopta(input));
    const newRoundTrip = newConverterRoundTrip(input);
    // Compare CONTENT only (see stripBlockIds rationale above). The
    // user-facing guarantee is "switching editor mode preserves the page
    // content"; editor-managed ids are tracked separately in
    // `legacy editor auto-assigns block ids` below.
    assert.deepStrictEqual(
      normalizeForParity(legacyRoundTrip),
      normalizeForParity(newRoundTrip),
      `Cross-editor CONTENT mismatch for fixture '${file}'. Studio's dual-mount mode would persist different canonical DocContentV1 ` +
        `depending on which editor is active — block Story 7.3 cutover until resolved.`,
    );
  });
}
