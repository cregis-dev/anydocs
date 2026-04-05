import assert from 'node:assert/strict';
import test from 'node:test';

import { convertMarkdownToPageContent } from '../src/services/markdown-authoring-service.ts';
import { validateDocContentV1 } from '../src/utils/index.ts';

test('convertMarkdownToPageContent preserves list, todo, and table blocks as canonical content', () => {
  const result = convertMarkdownToPageContent({
    inputMode: 'document',
    markdown: [
      '# Guide',
      '',
      '- bullet item',
      '',
      '1. first step',
      '',
      '- [ ] follow up item',
      '',
      '| Header | Value |',
      '| --- | --- |',
      '| Row | Data |',
    ].join('\n'),
  });

  assert.equal(result.title, 'Guide');
  assert.equal(validateDocContentV1(result.content).ok, true);
  assert.deepEqual(result.content.blocks.map((block) => block.type), [
    'heading',
    'list',
    'list',
    'list',
    'table',
  ]);
  assert.equal(result.warnings.some((warning) => warning.code === 'markdown-construct-review-required'), false);

  const todoBlock = result.content.blocks[3];
  assert.equal(todoBlock?.type, 'list');
  assert.equal(todoBlock?.style, 'todo');
  assert.equal(todoBlock?.items[0]?.checked, false);

  const tableBlock = result.content.blocks[4];
  assert.equal(tableBlock?.type, 'table');
  assert.deepEqual(
    tableBlock?.rows.map((row) =>
      row.cells.map((cell) => cell.children.map((entry) => ('text' in entry ? entry.text : '')).join('')),
    ),
    [
      ['Header', 'Value'],
      ['Row', 'Data'],
    ],
  );
});

test('convertMarkdownToPageContent preserves fenced code blocks and blockquotes as canonical content', () => {
  const result = convertMarkdownToPageContent({
    inputMode: 'document',
    markdown: [
      '# Guide',
      '',
      '> Review the draft before publishing.',
      '',
      '```bash',
      'pnpm --filter @anydocs/cli cli build examples/starter-docs',
      '```',
    ].join('\n'),
  });

  assert.equal(validateDocContentV1(result.content).ok, true);
  assert.deepEqual(result.content.blocks.map((block) => block.type), [
    'heading',
    'blockquote',
    'codeBlock',
  ]);

  const quoteBlock = result.content.blocks[1];
  assert.equal(quoteBlock?.type, 'blockquote');
  assert.deepEqual(quoteBlock?.children, [{ type: 'text', text: 'Review the draft before publishing.' }]);

  const codeBlock = result.content.blocks[2];
  assert.equal(codeBlock?.type, 'codeBlock');
  assert.equal(codeBlock?.language, 'bash');
  assert.equal(codeBlock?.code, 'pnpm --filter @anydocs/cli cli build examples/starter-docs');
});

test('convertMarkdownToPageContent groups contiguous list items into a single canonical list block', () => {
  const result = convertMarkdownToPageContent({
    inputMode: 'document',
    markdown: [
      '# Guide',
      '',
      '1. Open the project',
      '2. Update the welcome page',
      '3. Build the docs',
      '',
      '- verify the preview route',
      '- verify the search index',
    ].join('\n'),
  });

  assert.equal(validateDocContentV1(result.content).ok, true);
  assert.deepEqual(result.content.blocks.map((block) => block.type), ['heading', 'list', 'list']);

  const numberedList = result.content.blocks[1];
  assert.equal(numberedList?.type, 'list');
  assert.equal(numberedList?.style, 'numbered');
  assert.deepEqual(
    numberedList?.items.map((item) => item.children.map((entry) => ('text' in entry ? entry.text : '')).join('')),
    ['Open the project', 'Update the welcome page', 'Build the docs'],
  );

  const bulletList = result.content.blocks[2];
  assert.equal(bulletList?.type, 'list');
  assert.equal(bulletList?.style, 'bulleted');
  assert.deepEqual(
    bulletList?.items.map((item) => item.children.map((entry) => ('text' in entry ? entry.text : '')).join('')),
    ['verify the preview route', 'verify the search index'],
  );
});

test('convertMarkdownToPageContent preserves nested same-style list items', () => {
  const result = convertMarkdownToPageContent({
    inputMode: 'document',
    markdown: [
      '# Guide',
      '',
      '- Parent item',
      '  - Child item',
      '  - Second child',
      '- Next parent',
    ].join('\n'),
  });

  assert.equal(validateDocContentV1(result.content).ok, true);
  assert.deepEqual(result.content.blocks.map((block) => block.type), ['heading', 'list']);

  const listBlock = result.content.blocks[1];
  assert.equal(listBlock?.type, 'list');
  assert.equal(listBlock?.style, 'bulleted');
  assert.equal(listBlock?.items.length, 2);
  assert.deepEqual(
    listBlock?.items[0],
    {
      id: 'element-2-item-1',
      children: [{ type: 'text', text: 'Parent item' }],
      items: [
        { id: 'element-2-item-1-item-1', children: [{ type: 'text', text: 'Child item' }] },
        { id: 'element-2-item-1-item-2', children: [{ type: 'text', text: 'Second child' }] },
      ],
    },
  );
  assert.deepEqual(
    listBlock?.items[1],
    {
      id: 'element-2-item-2',
      children: [{ type: 'text', text: 'Next parent' }],
    },
  );
});
