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

test('getRenderableDocContent merges adjacent canonical numbered lists to preserve sequence numbering', () => {
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
        type: 'list',
        id: 'step1',
        style: 'numbered',
        items: [
          {
            id: 'item-1',
            children: [{ type: 'text', text: '第一步' }],
          },
        ],
      },
      {
        type: 'list',
        id: 'step2',
        style: 'numbered',
        items: [
          {
            id: 'item-2',
            children: [{ type: 'text', text: '第二步' }],
          },
        ],
      },
    ],
  };

  assert.deepEqual(getRenderableDocContent(content, 'Guide'), {
    version: 1,
    blocks: [
      {
        type: 'list',
        id: 'step1',
        style: 'numbered',
        items: [
          {
            id: 'item-1',
            children: [{ type: 'text', text: '第一步' }],
          },
          {
            id: 'item-2',
            children: [{ type: 'text', text: '第二步' }],
          },
        ],
      },
    ],
  });
});
test('getRenderableDocContent converts renderable legacy Yoopta content to canonical blocks', () => {
  const legacyContent = {
    intro: {
      id: 'intro',
      type: 'HeadingOne',
      value: [
        {
          id: 'heading',
          type: 'heading-one',
          children: [{ text: 'Guide' }],
          props: { nodeType: 'block' },
        },
      ],
      meta: { order: 0, depth: 0 },
    },
    steps: {
      id: 'steps',
      type: 'NumberedList',
      value: [
        {
          id: 'steps-value',
          type: 'numbered-list',
          children: [
            {
              id: 'item-1',
              type: 'list-item',
              children: [{ text: '和空值参数外，其他参数按字典序排序。' }],
              props: { nodeType: 'block' },
            },
          ],
          props: { nodeType: 'block' },
        },
      ],
      meta: { order: 1, depth: 0 },
    },
  };

  assert.deepEqual(getRenderableDocContent(legacyContent, 'Guide'), {
    version: 1,
    blocks: [
      {
        type: 'list',
        id: 'steps',
        style: 'numbered',
        items: [
          {
            id: 'item-1',
            children: [{ type: 'text', text: '和空值参数外，其他参数按字典序排序。' }],
          },
        ],
      },
    ],
  });
});

test('getRenderableDocContent converts legacy numbered-list entry arrays with url links', () => {
  const legacyContent = {
    steps: {
      id: 'steps',
      type: 'NumberedList',
      value: [
        {
          id: 'item-1',
          type: 'numbered-list',
          children: [
            { text: '访问 ' },
            {
              id: 'link-1',
              type: 'link',
              children: [{ text: 'https://www.cregis.com/download' }],
              props: {
                url: 'https://www.cregis.com/download',
                title: '下载地址',
              },
            },
            { text: ' 下载客户端' },
          ],
          props: { nodeType: 'block' },
        },
        {
          id: 'item-2',
          type: 'numbered-list',
          children: [{ text: '安装并启动 Cregis App' }],
          props: { nodeType: 'block' },
        },
      ],
      meta: { order: 0, depth: 0 },
    },
  };

  assert.deepEqual(getRenderableDocContent(legacyContent, 'Guide'), {
    version: 1,
    blocks: [
      {
        type: 'list',
        id: 'steps',
        style: 'numbered',
        items: [
          {
            id: 'item-1',
            children: [
              { type: 'text', text: '访问 ' },
              {
                type: 'link',
                href: 'https://www.cregis.com/download',
                title: '下载地址',
                children: [{ type: 'text', text: 'https://www.cregis.com/download' }],
              },
              { type: 'text', text: ' 下载客户端' },
            ],
          },
          {
            id: 'item-2',
            children: [{ type: 'text', text: '安装并启动 Cregis App' }],
          },
        ],
      },
    ],
  });
});
test('getRenderableDocContent merges adjacent converted numbered lists to preserve sequence numbering', () => {
  const legacyContent = {
    step1: {
      id: 'step1',
      type: 'NumberedList',
      value: [
        {
          id: 'step1-value',
          type: 'numbered-list',
          children: [
            {
              id: 'item-1',
              type: 'list-item',
              children: [{ text: '第一步' }],
              props: { nodeType: 'block' },
            },
          ],
          props: { nodeType: 'block' },
        },
      ],
      meta: { order: 0, depth: 0 },
    },
    step2: {
      id: 'step2',
      type: 'NumberedList',
      value: [
        {
          id: 'step2-value',
          type: 'numbered-list',
          children: [
            {
              id: 'item-2',
              type: 'list-item',
              children: [{ text: '第二步' }],
              props: { nodeType: 'block' },
            },
          ],
          props: { nodeType: 'block' },
        },
      ],
      meta: { order: 1, depth: 0 },
    },
  };

  assert.deepEqual(getRenderableDocContent(legacyContent, 'Guide'), {
    version: 1,
    blocks: [
      {
        type: 'list',
        id: 'step1',
        style: 'numbered',
        items: [
          {
            id: 'item-1',
            children: [{ type: 'text', text: '第一步' }],
          },
          {
            id: 'item-2',
            children: [{ type: 'text', text: '第二步' }],
          },
        ],
      },
    ],
  });
});

test('getRenderableDocContent keeps legacy markup payloads on markdown fallback path', () => {
  const legacyMarkupContent = {
    body: {
      id: 'body',
      type: 'Paragraph',
      value: [
        {
          id: 'paragraph',
          type: 'paragraph',
          children: [{ text: '<Card>legacy block</Card>' }],
          props: { nodeType: 'block' },
        },
      ],
      meta: { order: 0, depth: 0 },
    },
  };

  assert.equal(getRenderableDocContent(legacyMarkupContent, 'Guide'), null);
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

test('extractTocFromDocContent preserves shared heading id behavior for punctuation and CJK text', () => {
  const content = {
    version: 1,
    blocks: [
      {
        type: 'heading',
        id: 'post-register',
        level: 2,
        children: [{ type: 'text', text: 'POST /register' }],
      },
      {
        type: 'heading',
        id: 'params-1',
        level: 3,
        children: [{ type: 'text', text: '请求参数' }],
      },
      {
        type: 'heading',
        id: 'params-2',
        level: 3,
        children: [{ type: 'text', text: '请求参数' }],
      },
    ],
  };

  assert.deepEqual(extractTocFromDocContent(content), [
    { depth: 2, title: 'POST /register', id: 'post-register' },
    { depth: 3, title: '请求参数', id: '请求参数' },
    { depth: 3, title: '请求参数', id: '请求参数-2' },
  ]);
});
