import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DOC_CONTENT_BLOCK_TYPES,
  DOC_CONTENT_CALLOUT_TONES,
  DOC_CONTENT_TEXT_MARKS,
  DOC_CONTENT_VERSION,
} from '../src/types/content.ts';
import { validateDocContentV1 } from '../src/utils/content-schema.ts';

test('validateDocContentV1 accepts a minimal paragraph document', () => {
  const result = validateDocContentV1({
    version: DOC_CONTENT_VERSION,
    blocks: [
      {
        type: 'paragraph',
        children: [{ type: 'text', text: 'Hello world', marks: ['bold'] }],
      },
    ],
  });

  assert.deepEqual(result, { ok: true });
  assert.ok(DOC_CONTENT_BLOCK_TYPES.includes('paragraph'));
  assert.ok(DOC_CONTENT_TEXT_MARKS.includes('bold'));
  assert.ok(DOC_CONTENT_CALLOUT_TONES.includes('info'));
});

test('validateDocContentV1 rejects invalid nested shapes with a precise path', () => {
  const result = validateDocContentV1({
    version: DOC_CONTENT_VERSION,
    blocks: [
      {
        type: 'list',
        style: 'bulleted',
        items: [
          {
            children: [
              {
                type: 'link',
                href: '/guide',
                children: [{ type: 'link', href: '/bad', children: [] }],
              },
            ],
          },
        ],
      },
    ],
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.path, 'content.blocks[0].items[0].children[0].children[0].type');
    assert.match(result.error, /must equal "text"/);
  }
});

test('validateDocContentV1 rejects unsupported block types with the block path', () => {
  const result = validateDocContentV1({
    version: DOC_CONTENT_VERSION,
    blocks: [
      {
        type: 'embed',
      },
    ],
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.path, 'content.blocks[0].type');
    assert.match(result.error, /unsupported block type "embed"/);
  }
});

test('validateDocContentV1 rejects checked items outside todo lists', () => {
  const result = validateDocContentV1({
    version: DOC_CONTENT_VERSION,
    blocks: [
      {
        type: 'list',
        style: 'bulleted',
        items: [
          {
            checked: true,
            children: [{ type: 'text', text: 'Not allowed' }],
          },
        ],
      },
    ],
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.path, 'content.blocks[0].items[0].checked');
    assert.match(result.error, /only allowed for todo lists/);
  }
});

test('validateDocContentV1 rejects non-positive image dimensions', () => {
  const result = validateDocContentV1({
    version: DOC_CONTENT_VERSION,
    blocks: [
      {
        type: 'image',
        src: '/hero.png',
        width: 0,
        height: 240,
      },
    ],
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.path, 'content.blocks[0].width');
    assert.match(result.error, /positive integer/);
  }
});

test('validateDocContentV1 rejects version mismatches at the root', () => {
  const result = validateDocContentV1({
    version: 999,
    blocks: [],
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.path, 'content.version');
    assert.match(result.error, /must equal 1/);
  }
});

test('validateDocContentV1 rejects unsupported callout tones', () => {
  const result = validateDocContentV1({
    version: DOC_CONTENT_VERSION,
    blocks: [
      {
        type: 'callout',
        tone: 'critical',
        children: [{ type: 'text', text: 'Heads up' }],
      },
    ],
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.path, 'content.blocks[0].tone');
    assert.match(result.error, /must be one of/);
  }
});

test('validateDocContentV1 rejects malformed code group items', () => {
  const result = validateDocContentV1({
    version: DOC_CONTENT_VERSION,
    blocks: [
      {
        type: 'codeGroup',
        items: [
          {
            title: 'CLI',
            code: 123,
          },
        ],
      },
    ],
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.path, 'content.blocks[0].items[0].code');
    assert.match(result.error, /must be a string/);
  }
});

test('validateDocContentV1 rejects codeGroup with empty items array', () => {
  const result = validateDocContentV1({
    version: DOC_CONTENT_VERSION,
    blocks: [
      {
        type: 'codeGroup',
        items: [],
      },
    ],
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.path, 'content.blocks[0].items');
    assert.match(result.error, /at least one item/);
  }
});

test('validateDocContentV1 accepts codeGroup with empty code string', () => {
  const result = validateDocContentV1({
    version: DOC_CONTENT_VERSION,
    blocks: [
      {
        type: 'codeGroup',
        items: [{ id: 'item-1', code: '' }],
      },
    ],
  });

  assert.equal(result.ok, true);
});

test('validateDocContentV1 rejects codeBlock with empty code string', () => {
  const result = validateDocContentV1({
    version: DOC_CONTENT_VERSION,
    blocks: [{ type: 'codeBlock', code: '' }],
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.path, 'content.blocks[0].code');
    assert.match(result.error, /non-empty string/);
  }
});

test('validateDocContentV1 rejects codeBlock with whitespace-only code', () => {
  const result = validateDocContentV1({
    version: DOC_CONTENT_VERSION,
    blocks: [{ type: 'codeBlock', code: '   ' }],
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.path, 'content.blocks[0].code');
    assert.match(result.error, /non-empty string/);
  }
});

test('validateDocContentV1 rejects unsupported list styles', () => {
  const result = validateDocContentV1({
    version: DOC_CONTENT_VERSION,
    blocks: [
      {
        type: 'list',
        style: 'roman',
        items: [],
      },
    ],
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.path, 'content.blocks[0].style');
    assert.match(result.error, /must be "bulleted", "numbered", or "todo"/);
  }
});

test('validateDocContentV1 rejects malformed table rows and cells', () => {
  const result = validateDocContentV1({
    version: DOC_CONTENT_VERSION,
    blocks: [
      {
        type: 'table',
        rows: [
          {
            cells: [
              {
                children: 'bad-cell',
              },
            ],
          },
        ],
      },
    ],
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.path, 'content.blocks[0].rows[0].cells[0].children');
    assert.match(result.error, /must be an array/);
  }
});
