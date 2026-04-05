import assert from 'node:assert/strict';
import test from 'node:test';

import {
  extractTocFromLegacyYooptaContent,
  getRenderableLegacyYooptaContent,
} from '../lib/docs/legacy-yoopta-reader.ts';

test('getRenderableLegacyYooptaContent returns null for invalid content', () => {
  assert.equal(getRenderableLegacyYooptaContent('not-an-object', 'Welcome'), null);
  assert.equal(getRenderableLegacyYooptaContent({}, 'Welcome'), null);
});

test('getRenderableLegacyYooptaContent removes the leading title heading when it matches the page title', () => {
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

  assert.deepEqual(getRenderableLegacyYooptaContent(content, 'Welcome to Yoopta Editor'), {
    body: content.body,
  });
});

test('getRenderableLegacyYooptaContent keeps the first block when it is not the page title heading', () => {
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

  assert.deepEqual(getRenderableLegacyYooptaContent(content, 'Welcome'), content);
});

test('getRenderableLegacyYooptaContent returns null for canonical docs content', () => {
  const content = {
    version: 1,
    blocks: [
      {
        type: 'heading',
        id: 'intro',
        level: 1,
        children: [{ type: 'text', text: 'Welcome' }],
      },
      {
        type: 'paragraph',
        id: 'body',
        children: [{ type: 'text', text: 'Canonical body copy.' }],
      },
    ],
  };

  assert.equal(getRenderableLegacyYooptaContent(content, 'Welcome'), null);
});

test('getRenderableLegacyYooptaContent normalizes legacy table cell types for reader rendering', () => {
  const content = {
    table: {
      id: 'table',
      type: 'Table',
      value: [
        {
          id: 'table-element',
          type: 'table',
          children: [
            {
              id: 'row-1',
              type: 'table-row',
              children: [
                {
                  id: 'cell-1',
                  type: 'table-header-cell',
                  children: [{ text: 'Header' }],
                  props: { nodeType: 'block' },
                },
                {
                  id: 'cell-2',
                  type: 'table-data-cell',
                  children: [{ text: 'Value' }],
                  props: { nodeType: 'block' },
                },
              ],
              props: { nodeType: 'block' },
            },
          ],
          props: { nodeType: 'block' },
        },
      ],
      meta: { order: 0, depth: 0 },
    },
  };

  assert.deepEqual(getRenderableLegacyYooptaContent(content, 'Welcome'), {
    table: {
      id: 'table',
      type: 'Table',
      value: [
        {
          id: 'table-element',
          type: 'table',
          children: [
            {
              id: 'row-1',
              type: 'table-row',
              children: [
                {
                  id: 'cell-1',
                  type: 'table-data-cell',
                  children: [{ text: 'Header' }],
                  props: { nodeType: 'block' },
                },
                {
                  id: 'cell-2',
                  type: 'table-data-cell',
                  children: [{ text: 'Value' }],
                  props: { nodeType: 'block' },
                },
              ],
              props: { nodeType: 'block' },
            },
          ],
          props: { nodeType: 'block' },
        },
      ],
      meta: { order: 0, depth: 0 },
    },
  });
});

test('getRenderableLegacyYooptaContent normalizes table-cell to table-data-cell for reader rendering', () => {
  const content = {
    table: {
      id: 'table',
      type: 'Table',
      value: [
        {
          id: 'table-element',
          type: 'table',
          children: [
            {
              id: 'row-1',
              type: 'table-row',
              children: [
                {
                  id: 'cell-1',
                  type: 'table-cell',
                  children: [{ text: 'Header' }],
                  props: { nodeType: 'block' },
                },
                {
                  id: 'cell-2',
                  type: 'table-cell',
                  children: [{ text: 'Value' }],
                  props: { nodeType: 'block' },
                },
              ],
              props: { nodeType: 'block' },
            },
          ],
          props: { nodeType: 'block' },
        },
      ],
      meta: { order: 0, depth: 0 },
    },
  };

  assert.deepEqual(getRenderableLegacyYooptaContent(content, 'Welcome'), {
    table: {
      id: 'table',
      type: 'Table',
      value: [
        {
          id: 'table-element',
          type: 'table',
          children: [
            {
              id: 'row-1',
              type: 'table-row',
              children: [
                {
                  id: 'cell-1',
                  type: 'table-data-cell',
                  children: [{ text: 'Header' }],
                  props: { nodeType: 'block' },
                },
                {
                  id: 'cell-2',
                  type: 'table-data-cell',
                  children: [{ text: 'Value' }],
                  props: { nodeType: 'block' },
                },
              ],
              props: { nodeType: 'block' },
            },
          ],
          props: { nodeType: 'block' },
        },
      ],
      meta: { order: 0, depth: 0 },
    },
  });
});

test('getRenderableLegacyYooptaContent upgrades mermaid code blocks into Mermaid blocks for reader rendering', () => {
  const content = {
    diagram: {
      id: 'diagram',
      type: 'Code',
      value: [
        {
          id: 'diagram-value',
          type: 'code',
          children: [{ text: 'sequenceDiagram\n    A->>B: Hi' }],
          props: {
            nodeType: 'block',
            language: 'mermaid',
            theme: 'github-dark',
          },
        },
      ],
      meta: { order: 0, depth: 0 },
    },
  };

  assert.deepEqual(getRenderableLegacyYooptaContent(content, 'Welcome'), {
    diagram: {
      id: 'diagram',
      type: 'Mermaid',
      value: [
        {
          id: 'diagram-value',
          type: 'mermaid',
          children: [{ text: 'sequenceDiagram\n    A->>B: Hi' }],
          props: {
            nodeType: 'block',
            language: 'mermaid',
            theme: 'github-dark',
            code: 'sequenceDiagram\n    A->>B: Hi',
          },
        },
      ],
      meta: { order: 0, depth: 0 },
    },
  });
});

test('extractTocFromLegacyYooptaContent returns ordered toc items from heading blocks', () => {
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

  assert.deepEqual(extractTocFromLegacyYooptaContent(content), [
    { depth: 2, title: 'Overview', id: 'overview' },
    { depth: 3, title: 'Details', id: 'details' },
  ]);
});

test('extractTocFromLegacyYooptaContent ignores canonical docs content', () => {
  const toc = extractTocFromLegacyYooptaContent({
    version: 1,
    blocks: [
      {
        type: 'heading',
        id: 'intro',
        level: 2,
        children: [{ type: 'text', text: 'Overview' }],
      },
      {
        type: 'heading',
        id: 'details',
        level: 3,
        children: [{ type: 'text', text: 'Install' }],
      },
    ],
  });

  assert.deepEqual(toc, []);
});

test('extractTocFromLegacyYooptaContent deduplicates repeated heading ids', () => {
  const content = {
    firstHeading: {
      id: 'firstHeading',
      type: 'HeadingThree',
      value: [{ children: [{ text: '请求参数' }] }],
      meta: { order: 0, depth: 0 },
    },
    secondHeading: {
      id: 'secondHeading',
      type: 'HeadingThree',
      value: [{ children: [{ text: '请求参数' }] }],
      meta: { order: 1, depth: 0 },
    },
  };

  assert.deepEqual(extractTocFromLegacyYooptaContent(content), [
    { depth: 3, title: '请求参数', id: '请求参数' },
    { depth: 3, title: '请求参数', id: '请求参数-2' },
  ]);
});

test('getRenderableLegacyYooptaContent returns null for legacy-import blocks that contain raw html or mdx text', () => {
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

  assert.equal(getRenderableLegacyYooptaContent(content, 'Introduction'), null);
});
