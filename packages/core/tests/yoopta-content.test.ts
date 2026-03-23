import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DOCS_YOOPTA_ALLOWED_MARKS,
  DOCS_YOOPTA_ALLOWED_TYPES,
  validateYooptaContentValue,
} from '../src/utils/yoopta-content.ts';

test('validateYooptaContentValue accepts a supported paragraph block map', () => {
  const result = validateYooptaContentValue({
    'block-1': {
      id: 'block-1',
      type: 'Paragraph',
      value: [
        {
          id: 'paragraph-1',
          type: 'paragraph',
          children: [{ text: 'Hello' }],
          props: { nodeType: 'block' },
        },
      ],
      meta: {
        order: 0,
        depth: 0,
      },
    },
  });

  assert.deepEqual(result, { ok: true });
  assert.ok(DOCS_YOOPTA_ALLOWED_TYPES.includes('Paragraph'));
  assert.ok(DOCS_YOOPTA_ALLOWED_MARKS.includes('bold'));
});

test('validateYooptaContentValue rejects disallowed block shapes', () => {
  const result = validateYooptaContentValue({
    blocks: [],
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.error, /content\.blocks must be an object/);
  }
});
