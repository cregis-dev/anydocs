import assert from 'node:assert/strict';
import test from 'node:test';

import { extractTocFromDocContent, getRenderableDocContent } from '../lib/docs/canonical-reader.ts';

test('getRenderableDocContent removes a leading H1 that duplicates the page title', () => {
  const content = {
    version: 1,
    blocks: [
      {
        type: 'heading',
        id: 'hero',
        level: 1,
        children: [{ type: 'text', text: 'Guide' }],
      },
      {
        type: 'paragraph',
        id: 'body',
        children: [{ type: 'text', text: 'Body copy' }],
      },
    ],
  };

  assert.deepEqual(getRenderableDocContent(content, 'Guide'), {
    version: 1,
    blocks: [
      {
        type: 'paragraph',
        id: 'body',
        children: [{ type: 'text', text: 'Body copy' }],
      },
    ],
  });
});

test('extractTocFromDocContent derives stable heading ids from canonical headings', () => {
  const content = {
    version: 1,
    blocks: [
      {
        type: 'heading',
        id: 'overview',
        level: 2,
        children: [{ type: 'text', text: 'Overview' }],
      },
      {
        type: 'heading',
        id: 'details',
        level: 3,
        children: [{ type: 'text', text: 'Details' }],
      },
      {
        type: 'heading',
        id: 'details-2',
        level: 3,
        children: [{ type: 'text', text: 'Details' }],
      },
    ],
  };

  assert.deepEqual(extractTocFromDocContent(content), [
    { depth: 2, title: 'Overview', id: 'overview' },
    { depth: 3, title: 'Details', id: 'details' },
    { depth: 3, title: 'Details', id: 'details-2' },
  ]);
});
