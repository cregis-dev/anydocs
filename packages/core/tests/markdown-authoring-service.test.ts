import assert from 'node:assert/strict';
import test from 'node:test';

import { convertMarkdownToPageContent } from '../src/services/markdown-authoring-service.ts';

test('convertMarkdownToPageContent preserves list, todo, and table blocks as structured Yoopta content', () => {
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
  assert.deepEqual(Object.values(result.content).map((block) => (block as { type: string }).type), [
    'HeadingOne',
    'BulletedList',
    'NumberedList',
    'TodoList',
    'Table',
  ]);
  assert.equal(result.warnings.some((warning) => warning.code === 'markdown-construct-review-required'), false);

  const todoBlock = result.content['block-4'] as {
    value: Array<{ type: string; children: Array<{ text: string }>; props: { checked?: boolean } }>;
  };
  assert.equal(todoBlock.value[0]?.type, 'todo-list');
  assert.equal(todoBlock.value[0]?.props.checked, false);

  const tableBlock = result.content['block-5'] as {
    value: Array<{
      type: string;
      children: Array<{
        type: string;
        children: Array<{
          type: string;
          children: Array<{ text: string }>;
        }>;
      }>;
    }>;
  };
  assert.equal(tableBlock.value[0]?.type, 'table');
  assert.deepEqual(
    tableBlock.value[0]?.children.map((row) =>
      row.children.map((cell) => cell.children.map((entry) => entry.text).join('')),
    ),
    [
      ['Header', 'Value'],
      ['Row', 'Data'],
    ],
  );
});
