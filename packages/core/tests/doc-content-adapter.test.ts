import assert from 'node:assert/strict';
import test from 'node:test';

import { docContentToYoopta, yooptaToDocContent } from '../src/utils/doc-content-adapter.ts';

test('yooptaToDocContent converts supported legacy blocks into canonical content', () => {
  const content = yooptaToDocContent({
    'block-1': {
      id: 'block-1',
      type: 'HeadingTwo',
      value: [
        {
          id: 'el-1',
          type: 'h2',
          children: [{ text: 'Install' }],
          props: { nodeType: 'block' },
        },
      ],
      meta: { order: 0, depth: 0 },
    },
    'block-2': {
      id: 'block-2',
      type: 'Paragraph',
      value: [
        {
          id: 'el-2',
          type: 'paragraph',
          children: [
            { text: 'Run ' },
            {
              id: 'inline-link-1',
              type: 'link',
              children: [{ text: 'pnpm docs' }],
              props: { href: '/docs', title: 'Docs' },
            },
            { text: ' first.', italic: true },
          ],
          props: { nodeType: 'block' },
        },
      ],
      meta: { order: 1, depth: 0 },
    },
    'block-3': {
      id: 'block-3',
      type: 'Callout',
      value: [
        {
          id: 'el-3',
          type: 'callout',
          children: [{ text: 'Published pages only.' }],
          props: { nodeType: 'block', theme: 'warning', title: 'Note' },
        },
      ],
      meta: { order: 2, depth: 0 },
    },
    'block-4': {
      id: 'block-4',
      type: 'Table',
      value: [
        {
          id: 'el-4',
          type: 'table',
          children: [
            {
              id: 'row-1',
              type: 'table-row',
              children: [
                { id: 'cell-1', type: 'table-header-cell', children: [{ text: 'Name' }], props: { nodeType: 'block' } },
                { id: 'cell-2', type: 'table-header-cell', children: [{ text: 'Value' }], props: { nodeType: 'block' } },
              ],
              props: { nodeType: 'block' },
            },
            {
              id: 'row-2',
              type: 'table-row',
              children: [
                { id: 'cell-3', type: 'table-data-cell', children: [{ text: 'Mode' }], props: { nodeType: 'block' } },
                { id: 'cell-4', type: 'table-data-cell', children: [{ text: 'Local' }], props: { nodeType: 'block' } },
              ],
              props: { nodeType: 'block' },
            },
          ],
          props: { nodeType: 'block' },
        },
      ],
      meta: { order: 3, depth: 0 },
    },
    'block-5': {
      id: 'block-5',
      type: 'Mermaid',
      value: [
        {
          id: 'el-5',
          type: 'mermaid',
          children: [{ text: 'graph TD\nA-->B' }],
          props: { nodeType: 'block', code: 'graph TD\nA-->B' },
        },
      ],
      meta: { order: 4, depth: 0 },
    },
  });

  assert.deepEqual(content, {
    version: 1,
    blocks: [
      {
        type: 'heading',
        id: 'block-1',
        level: 2,
        children: [{ type: 'text', text: 'Install' }],
      },
      {
        type: 'paragraph',
        id: 'block-2',
        children: [
          { type: 'text', text: 'Run ' },
          {
            type: 'link',
            href: '/docs',
            title: 'Docs',
            children: [{ type: 'text', text: 'pnpm docs' }],
          },
          { type: 'text', text: ' first.', marks: ['italic'] },
        ],
      },
      {
        type: 'callout',
        id: 'block-3',
        tone: 'warning',
        title: 'Note',
        children: [{ type: 'text', text: 'Published pages only.' }],
      },
      {
        type: 'table',
        id: 'block-4',
        rows: [
          {
            id: 'row-1',
            cells: [
              { id: 'cell-1', header: true, children: [{ type: 'text', text: 'Name' }] },
              { id: 'cell-2', header: true, children: [{ type: 'text', text: 'Value' }] },
            ],
          },
          {
            id: 'row-2',
            cells: [
              { id: 'cell-3', header: false, children: [{ type: 'text', text: 'Mode' }] },
              { id: 'cell-4', header: false, children: [{ type: 'text', text: 'Local' }] },
            ],
          },
        ],
      },
      {
        type: 'mermaid',
        id: 'block-5',
        code: 'graph TD\nA-->B',
      },
    ],
  });
});

test('docContentToYoopta round-trips canonical content through the legacy adapter', () => {
  const canonical = {
    version: 1 as const,
    blocks: [
      {
        type: 'paragraph' as const,
        id: 'intro',
        children: [
          { type: 'text' as const, text: 'Open the ' },
          {
            type: 'link' as const,
            href: '/studio',
            title: 'Studio',
            children: [{ type: 'text' as const, text: 'Studio' }],
          },
          { type: 'text' as const, text: ' and continue.' },
        ],
      },
      {
        type: 'list' as const,
        id: 'steps',
        style: 'todo' as const,
        items: [
          {
            id: 'step-1',
            checked: true,
            children: [{ type: 'text' as const, text: 'Create the page' }],
          },
        ],
      },
      {
        type: 'codeGroup' as const,
        id: 'install',
        items: [
          { id: 'npm', language: 'bash', title: 'npm', code: 'npm install' },
          { id: 'pnpm', language: 'bash', title: 'pnpm', code: 'pnpm install' },
        ],
      },
      {
        type: 'callout' as const,
        id: 'warning',
        tone: 'warning' as const,
        title: 'Warning',
        children: [{ type: 'text' as const, text: 'Do not publish drafts.' }],
      },
      {
        type: 'image' as const,
        id: 'hero',
        src: '/hero.png',
        alt: 'Hero',
        caption: [{ type: 'text' as const, text: 'Landing hero' }],
      },
      {
        type: 'divider' as const,
        id: 'break',
      },
    ],
  };

  const legacy = docContentToYoopta(canonical);
  const roundTrip = yooptaToDocContent(legacy);

  assert.deepEqual(roundTrip, canonical);
  assert.equal((legacy.install as { type: string }).type, 'CodeGroup');
  assert.equal(
    ((legacy.steps as { value: Array<{ props: { checked?: boolean }; children: Array<{ props: { checked?: boolean } }> }> }).value[0]?.children[0]?.props.checked),
    true,
  );
});

test('yooptaToDocContent preserves nested list items without leaking child text into the parent item', () => {
  const content = yooptaToDocContent({
    'block-1': {
      id: 'block-1',
      type: 'BulletedList',
      value: [
        {
          id: 'el-1',
          type: 'bulleted-list',
          children: [
            {
              id: 'item-1',
              type: 'list-item',
              children: [
                { text: 'Parent item' },
                {
                  id: 'item-1-child-1',
                  type: 'list-item',
                  children: [{ text: 'Child item' }],
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

  assert.deepEqual(content, {
    version: 1,
    blocks: [
      {
        type: 'list',
        id: 'block-1',
        style: 'bulleted',
        items: [
          {
            id: 'item-1',
            children: [{ type: 'text', text: 'Parent item' }],
            items: [
              {
                id: 'item-1-child-1',
                children: [{ type: 'text', text: 'Child item' }],
              },
            ],
          },
        ],
      },
    ],
  });
});
