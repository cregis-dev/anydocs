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

test('getRenderableYooptaContent returns null for legacy-import blocks that contain raw html or mdx text', () => {
  const content = {
    heading: {
      id: 'heading',
      type: 'HeadingTwo',
      value: [
        {
          id: 'element-1',
          type: 'h2',
          children: [{ text: 'What is Cregis\n<p align="center"><img src="/images/overview01.png" /></p>' }],
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
          id: 'element-2',
          type: 'paragraph',
          children: [{ text: '<CardGroup cols={2}><Card title="Demo">Example</Card></CardGroup>' }],
          props: { nodeType: 'block' },
        },
      ],
      meta: { order: 1, depth: 0 },
    },
  };

  assert.equal(getRenderableYooptaContent(content, 'Introduction'), null);
});
