import assert from 'node:assert/strict';
import test from 'node:test';

import { extractTocFromYooptaContent, getRenderableYooptaContent } from '../lib/docs/yoopta-reader.ts';

test('getRenderableYooptaContent returns null for invalid content', () => {
  assert.equal(getRenderableYooptaContent('not-an-object', 'Welcome'), null);
  assert.equal(getRenderableYooptaContent({}, 'Welcome'), null);
});

test('getRenderableYooptaContent removes the leading title heading when it matches the page title', () => {
  const content = {
    intro: {
      id: 'intro',
      type: 'HeadingOne',
      value: [
        {
          id: 'heading',
          type: 'heading-one',
          children: [{ text: 'Welcome to Yoopta Editor' }],
          props: { nodeType: 'block' },
        },
      ],
      meta: { order: 0, depth: 0 },
    },
    body: {
      id: 'body',
      type: 'Paragraph',
      value: [
        {
          id: 'paragraph',
          type: 'paragraph',
          children: [{ text: 'Reader content stays rich.' }],
          props: { nodeType: 'block' },
        },
      ],
      meta: { order: 1, depth: 0 },
    },
  };

  assert.deepEqual(getRenderableYooptaContent(content, 'Welcome to Yoopta Editor'), {
    body: content.body,
  });
});

test('getRenderableYooptaContent keeps the first block when it is not the page title heading', () => {
  const content = {
    intro: {
      id: 'intro',
      type: 'HeadingTwo',
      value: [
        {
          id: 'heading',
          type: 'heading-two',
          children: [{ text: 'Overview' }],
          props: { nodeType: 'block' },
        },
      ],
      meta: { order: 0, depth: 0 },
    },
  };

  assert.deepEqual(getRenderableYooptaContent(content, 'Welcome'), content);
});

test('extractTocFromYooptaContent returns ordered toc items from heading blocks', () => {
  const content = {
    body: {
      id: 'body',
      type: 'Paragraph',
      value: [{ children: [{ text: 'Reader content stays rich.' }] }],
      meta: { order: 1, depth: 0 },
    },
    headingThree: {
      id: 'headingThree',
      type: 'HeadingThree',
      value: [{ children: [{ text: 'Details' }] }],
      meta: { order: 3, depth: 0 },
    },
    headingTwo: {
      id: 'headingTwo',
      type: 'HeadingTwo',
      value: [{ children: [{ text: 'Overview' }] }],
      meta: { order: 2, depth: 0 },
    },
  };

  assert.deepEqual(extractTocFromYooptaContent(content), [
    { depth: 2, title: 'Overview', id: 'overview' },
    { depth: 3, title: 'Details', id: 'details' },
  ]);
});
