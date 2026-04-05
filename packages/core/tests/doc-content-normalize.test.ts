import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeDocContent } from '../src/utils/index.ts';

test('normalizeDocContent merges adjacent list blocks with the same style', () => {
  const normalized = normalizeDocContent({
    version: 1,
    blocks: [
      {
        type: 'heading',
        id: 'block-1',
        level: 1,
        children: [{ type: 'text', text: 'Guide' }],
      },
      {
        type: 'list',
        id: 'block-2',
        style: 'numbered',
        items: [
          {
            id: 'block-2-item-1',
            children: [{ type: 'text', text: 'Open the project' }],
          },
        ],
      },
      {
        type: 'list',
        id: 'block-3',
        style: 'numbered',
        items: [
          {
            id: 'block-3-item-1',
            children: [{ type: 'text', text: 'Update the page' }],
          },
        ],
      },
      {
        type: 'paragraph',
        id: 'block-4',
        children: [{ type: 'text', text: 'Done.' }],
      },
    ],
  });

  assert.deepEqual(normalized.blocks.map((block) => block.type), ['heading', 'list', 'paragraph']);
  const listBlock = normalized.blocks[1];
  assert.equal(listBlock?.type, 'list');
  assert.equal(listBlock?.style, 'numbered');
  assert.deepEqual(
    listBlock?.items.map((item) => item.children.map((entry) => ('text' in entry ? entry.text : '')).join('')),
    ['Open the project', 'Update the page'],
  );
});
