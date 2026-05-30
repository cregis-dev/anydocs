// =============================================================================
// doc-content-v1 ↔ Plate converter tests (Story 6.3).
//
// Pure logic tests — no DOM needed. Mount/unmount lifecycle and event
// semantics are covered separately by `plate-runtime.test.ts`.
//
// Story 6.3 expands the suite from Story 6.2's paragraph+heading-only scope
// to cover all 11 canonical DocContentV1 block types plus the `link` inline
// node. The fixture suite under `tests/fixtures/doc-content/` doubles as
// living documentation of the canonical shape for each block type.
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { DocContentV1 } from '@anydocs/core';

import { docContentToPlate, type PlateValue } from '../src/converters/doc-content-to-plate.ts';
import { plateToDocContent } from '../src/converters/plate-to-doc-content.ts';
import { registerBuiltinPluginsOnce } from '../src/plugins/builtin/index.ts';

// Builtin plugins must be registered before any converter dispatch. Calling
// once per test file is idempotent (the registration helper short-circuits
// on subsequent calls).
registerBuiltinPluginsOnce();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = path.join(__dirname, 'fixtures', 'doc-content');

function loadFixture(name: string): DocContentV1 {
  return JSON.parse(readFileSync(path.join(FIXTURE_DIR, name), 'utf8')) as DocContentV1;
}

function paragraph(text: string): DocContentV1['blocks'][number] {
  return { type: 'paragraph', children: [{ type: 'text', text }] };
}

function heading(level: 1 | 2 | 3, text: string): DocContentV1['blocks'][number] {
  return { type: 'heading', level, children: [{ type: 'text', text }] };
}

function roundTrip(payload: DocContentV1): DocContentV1 {
  return plateToDocContent(docContentToPlate(payload));
}

// ---------------------------------------------------------------------------
// Fixture-driven round-trip suite (Story 6.3 AC4)
// ---------------------------------------------------------------------------

const fixtureFiles = readdirSync(FIXTURE_DIR).filter((file) => file.endsWith('.json')).sort();

for (const file of fixtureFiles) {
  test(`round-trip fixture: ${file}`, () => {
    const input = loadFixture(file);
    const output = roundTrip(input);
    assert.deepEqual(output, input);
  });
}

// ---------------------------------------------------------------------------
// Smoke tests for in-memory paragraph + heading payloads (kept from 6.2)
// ---------------------------------------------------------------------------

test('round-trip: paragraph-only payload preserves structure', () => {
  const input: DocContentV1 = {
    version: 1,
    blocks: [paragraph('hello world'), paragraph('second paragraph')],
  };
  assert.deepEqual(roundTrip(input), input);
});

test('round-trip: heading levels 1/2/3 map to h1/h2/h3 and back', () => {
  const input: DocContentV1 = {
    version: 1,
    blocks: [heading(1, 'Top'), heading(2, 'Mid'), heading(3, 'Sub')],
  };
  assert.deepEqual(roundTrip(input), input);
});

test('round-trip: mixed paragraph + heading content', () => {
  const input: DocContentV1 = {
    version: 1,
    blocks: [
      heading(1, 'Title'),
      paragraph('Intro paragraph.'),
      heading(2, 'Section'),
      paragraph('Body text.'),
    ],
  };
  assert.deepEqual(roundTrip(input), input);
});

test('round-trip: all five supported marks survive', () => {
  const input: DocContentV1 = {
    version: 1,
    blocks: [
      {
        type: 'paragraph',
        children: [
          { type: 'text', text: 'b', marks: ['bold'] },
          { type: 'text', text: 'i', marks: ['italic'] },
          { type: 'text', text: 'u', marks: ['underline'] },
          { type: 'text', text: 's', marks: ['strike'] },
          { type: 'text', text: 'c', marks: ['code'] },
        ],
      },
    ],
  };
  assert.deepEqual(roundTrip(input), input);
});

// ---------------------------------------------------------------------------
// Mark normalization
// ---------------------------------------------------------------------------

test('plate→doc emits marks in canonical SUPPORTED_MARKS order regardless of property order', () => {
  const plateValue: PlateValue = [
    {
      type: 'p',
      children: [{ text: 'x', code: true, italic: true, bold: true }],
    },
  ];
  const result = plateToDocContent(plateValue);
  const para = result.blocks[0];
  assert.equal(para?.type, 'paragraph');
  if (para?.type === 'paragraph') {
    const text = para.children[0];
    assert.equal(text?.type, 'text');
    if (text?.type === 'text') {
      assert.deepEqual(text.marks, ['bold', 'italic', 'code']);
    }
  }
});

test('plate→doc omits marks key entirely when no marks are set (round-trip equality)', () => {
  const input: DocContentV1 = { version: 1, blocks: [paragraph('no marks')] };
  const output = roundTrip(input);
  const text = output.blocks[0]?.type === 'paragraph' ? output.blocks[0].children[0] : null;
  assert.ok(text && text.type === 'text');
  if (text?.type === 'text') {
    assert.equal('marks' in text, false, 'marks key must be absent when no marks are set');
  }
});

// ---------------------------------------------------------------------------
// Empty payload normalization
// ---------------------------------------------------------------------------

test('empty payload becomes a single empty paragraph in Plate value', () => {
  const plate = docContentToPlate({ version: 1, blocks: [] });
  assert.equal(plate.length, 1);
  assert.equal(plate[0]?.type, 'p');
  assert.deepEqual(plate[0]?.children, [{ text: '' }]);
});

// ---------------------------------------------------------------------------
// Story 6.3 — link round-trip is non-lossy
// (Replaces Story 6.2's "links are flattened" assertion.)
// ---------------------------------------------------------------------------

test('Story 6.3 fix: link inline nodes round-trip non-lossy (href + title preserved)', () => {
  const input: DocContentV1 = {
    version: 1,
    blocks: [
      {
        type: 'paragraph',
        children: [
          { type: 'text', text: 'see ' },
          {
            type: 'link',
            href: 'https://example.com',
            title: 'Example homepage',
            children: [{ type: 'text', text: 'this link' }],
          },
          { type: 'text', text: ' for more' },
        ],
      },
    ],
  };
  assert.deepEqual(roundTrip(input), input);
});

test('Story 6.3 fix: link without title round-trips without inventing a title key', () => {
  const input: DocContentV1 = {
    version: 1,
    blocks: [
      {
        type: 'paragraph',
        children: [
          { type: 'text', text: 'plain ' },
          {
            type: 'link',
            href: 'https://x.test',
            children: [{ type: 'text', text: 'tap', marks: ['italic'] }],
          },
        ],
      },
    ],
  };
  const output = roundTrip(input);
  assert.deepEqual(output, input);
  const linkNode = output.blocks[0]?.type === 'paragraph' ? output.blocks[0].children[1] : null;
  assert.ok(linkNode && linkNode.type === 'link');
  if (linkNode?.type === 'link') {
    assert.equal('title' in linkNode, false, 'title key must be absent when not provided');
  }
});

// ---------------------------------------------------------------------------
// Story 6.3 — per-type focused error paths (AC5, AC6)
// ---------------------------------------------------------------------------

test('AC5: doc→plate throws on truly unrecognised block type with structured message', () => {
  assert.throws(
    () =>
      docContentToPlate({
        version: 1,
        blocks: [
          paragraph('first'),
          { type: 'future-block', children: [] } as unknown as DocContentV1['blocks'][number],
        ],
      }),
    (err: unknown) => {
      assert.ok(err instanceof Error);
      assert.match((err as Error).message, /(?:unrecognised|no plugin registered for) blockType ['"]?future-block/);
      assert.match((err as Error).message, /index 1/);
      // Story 6.4 lists registered (canonical) block types in DOC_CONTENT_BLOCK_TYPES order.
      assert.match((err as Error).message, /paragraph/);
      assert.match((err as Error).message, /heading/);
      assert.match((err as Error).message, /list/);
      assert.match((err as Error).message, /codeBlock/);
      return true;
    },
  );
});

test('AC5: plate→doc throws on unknown Plate element type with structured message', () => {
  assert.throws(
    () =>
      plateToDocContent([
        { type: 'unknown-thing', children: [{ text: '' }] } as Parameters<typeof plateToDocContent>[0][number],
      ]),
    (err: unknown) => {
      assert.ok(err instanceof Error);
      assert.match((err as Error).message, /unrecognised Plate element type 'unknown-thing'/);
      assert.match((err as Error).message, /at index 0/);
      return true;
    },
  );
});

test('regression M1: plate→doc error message lists element-type strings, not numeric enum values', () => {
  // Regression for Story 6.3 review finding M1: `Object.values(HEADING_LEVEL_BY_TYPE)`
  // returned [1, 2, 3] instead of ['h1', 'h2', 'h3'], producing a misleading
  // "Allowed types: p, 1, 2, 3, ..." error. Story 6.3 review fix switched
  // to `Object.keys`.
  try {
    plateToDocContent([
      { type: 'totally-unknown', children: [{ text: '' }] } as Parameters<typeof plateToDocContent>[0][number],
    ]);
    assert.fail('expected plateToDocContent to throw on unknown type');
  } catch (error) {
    assert.ok(error instanceof Error);
    const message = (error as Error).message;
    // Must include heading element-type strings (the keys of HEADING_LEVEL_BY_TYPE)…
    assert.match(message, /\bh1\b/, "error message must list 'h1' as an allowed type");
    assert.match(message, /\bh2\b/, "error message must list 'h2' as an allowed type");
    assert.match(message, /\bh3\b/, "error message must list 'h3' as an allowed type");
    // …and must NOT list raw integer enum values.
    assert.doesNotMatch(message, /Allowed types:[^.]*\b1,\s*2,\s*3\b/, "error message must NOT list raw integers 1/2/3");
    // Same discipline for the list-style table: keys are element types, values are DocContent styles.
    assert.match(message, /\btodo_list\b/, "error message must list 'todo_list' as an allowed type");
    assert.doesNotMatch(message, /\bbulleted\b/, "error message must NOT list DocContent style names");
  }
});

test('AC6: heading with level 4 throws (DocContentV1 only allows 1|2|3)', () => {
  assert.throws(
    () =>
      docContentToPlate({
        version: 1,
        blocks: [
          { type: 'heading', level: 4 as unknown as 1, children: [{ type: 'text', text: 'x' }] },
        ],
      }),
    /invalid level 4/,
  );
});

test('AC6: list with unknown style throws', () => {
  assert.throws(
    () =>
      docContentToPlate({
        version: 1,
        blocks: [
          { type: 'list', style: 'random' as 'bulleted', items: [] },
        ],
      }),
    /unsupported style 'random'/,
  );
});

test('AC6: table with mismatched row cell counts throws', () => {
  assert.throws(
    () =>
      docContentToPlate({
        version: 1,
        blocks: [
          {
            type: 'table',
            rows: [
              { cells: [{ children: [{ type: 'text', text: 'a' }] }, { children: [{ type: 'text', text: 'b' }] }] },
              { cells: [{ children: [{ type: 'text', text: 'c' }] }] },
            ],
          },
        ],
      }),
    /row 1 has 1 cells; expected 2/,
  );
});

test('AC6: callout with invalid tone throws', () => {
  assert.throws(
    () =>
      docContentToPlate({
        version: 1,
        blocks: [
          {
            type: 'callout',
            tone: 'critical' as unknown as 'info',
            children: [{ type: 'text', text: 'x' }],
          },
        ],
      }),
    /invalid tone 'critical'/,
  );
});

test('AC5: doc→plate throws on a forged future block type with structured guidance', () => {
  assert.throws(
    () =>
      docContentToPlate({
        version: 1,
        blocks: [{ type: 'video', children: [] } as unknown as DocContentV1['blocks'][number]],
      }),
    /(?:unrecognised|no plugin registered for) blockType ['"]?video/,
  );
});

test('doc→plate throws on unsupported DocContentV1 version', () => {
  assert.throws(
    () => docContentToPlate({ version: 99 as unknown as 1, blocks: [] }),
    /unsupported DocContentV1 version/,
  );
});

test('mark-mapping throws on an unknown mark name (defensive)', () => {
  assert.throws(
    () =>
      docContentToPlate({
        version: 1,
        blocks: [
          {
            type: 'paragraph',
            children: [
              { type: 'text', text: 'x', marks: ['blink' as unknown as 'bold'] },
            ],
          },
        ],
      }),
    /unsupported mark/,
  );
});

// ---------------------------------------------------------------------------
// Block-specific edge cases beyond fixtures
// ---------------------------------------------------------------------------

test('codeBlock: multi-line code with no language round-trips', () => {
  const input: DocContentV1 = {
    version: 1,
    blocks: [{ type: 'codeBlock', code: 'line 1\nline 2\nline 3' }],
  };
  const output = roundTrip(input);
  assert.deepEqual(output, input);
  const block = output.blocks[0];
  assert.equal(block?.type, 'codeBlock');
  if (block?.type === 'codeBlock') {
    assert.equal('language' in block, false);
    assert.equal('title' in block, false);
  }
});

test('codeGroup: empty items array round-trips', () => {
  const input: DocContentV1 = {
    version: 1,
    blocks: [{ type: 'codeGroup', items: [] }],
  };
  assert.deepEqual(roundTrip(input), input);
});

test('image: minimal payload omits caption / width / height / alt / title keys on output', () => {
  const input: DocContentV1 = {
    version: 1,
    blocks: [{ type: 'image', src: '/x.png' }],
  };
  const output = roundTrip(input);
  assert.deepEqual(output, input);
  const block = output.blocks[0];
  assert.equal(block?.type, 'image');
  if (block?.type === 'image') {
    for (const key of ['alt', 'title', 'width', 'height', 'caption', 'id']) {
      assert.equal(key in block, false, `image must omit '${key}' when absent on input`);
    }
  }
});

test('divider: round-trips as a single-field block', () => {
  const input: DocContentV1 = { version: 1, blocks: [{ type: 'divider' }] };
  const output = roundTrip(input);
  assert.deepEqual(output, input);
});

test('mermaid: code+title round-trips deterministically', () => {
  const input: DocContentV1 = {
    version: 1,
    blocks: [{ type: 'mermaid', code: 'graph LR\nA --> B', title: 'tiny' }],
  };
  assert.deepEqual(roundTrip(input), input);
});

test('blocks preserve optional id fields across round-trip', () => {
  const input: DocContentV1 = {
    version: 1,
    blocks: [
      { type: 'paragraph', id: 'p-1', children: [{ type: 'text', text: 'A' }] },
      { type: 'heading', id: 'h-1', level: 2, children: [{ type: 'text', text: 'B' }] },
      { type: 'divider', id: 'd-1' },
    ],
  };
  assert.deepEqual(roundTrip(input), input);
});

test('list items preserve optional id fields', () => {
  const input: DocContentV1 = {
    version: 1,
    blocks: [
      {
        type: 'list',
        style: 'bulleted',
        items: [
          { id: 'item-1', children: [{ type: 'text', text: 'one' }] },
          { id: 'item-2', children: [{ type: 'text', text: 'two' }] },
        ],
      },
    ],
  };
  assert.deepEqual(roundTrip(input), input);
});
