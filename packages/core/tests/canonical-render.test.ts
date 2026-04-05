import assert from 'node:assert/strict';
import test from 'node:test';

import { renderDocContent, renderPageContent } from '../src/utils/index.ts';

test('renderDocContent serializes canonical lists, callouts, and code groups without Yoopta intermediates', () => {
  const content = {
    version: 1,
    blocks: [
      {
        type: 'heading',
        level: 2,
        children: [{ type: 'text', text: 'Steps' }],
      },
      {
        type: 'list',
        style: 'todo',
        items: [
          {
            children: [{ type: 'text', text: 'Open the project' }],
            checked: false,
          },
          {
            children: [{ type: 'text', text: 'Publish the page' }],
            checked: true,
          },
        ],
      },
      {
        type: 'callout',
        title: 'Warning',
        tone: 'warning',
        children: [{ type: 'text', text: 'Do not bypass review.' }],
      },
      {
        type: 'codeGroup',
        items: [
          {
            title: 'CLI',
            language: 'bash',
            code: 'pnpm build',
          },
          {
            title: 'API',
            language: 'typescript',
            code: 'page_set_status()',
          },
        ],
      },
    ],
  } as const;

  const render = renderDocContent(content);
  assert.match(render.markdown ?? '', /^## Steps/m);
  assert.match(render.markdown ?? '', /- \[ \] Open the project/);
  assert.match(render.markdown ?? '', /> Warning: Do not bypass review\./);
  assert.match(render.markdown ?? '', /#### CLI/);
  assert.equal(
    render.plainText,
    'Steps\n\nOpen the project\nPublish the page\n\nWarning: Do not bypass review.\n\npnpm build\n\npage_set_status()',
  );
});

test('renderPageContent uses canonical rendering directly for DocContentV1', () => {
  const render = renderPageContent({
    version: 1,
    blocks: [
      {
        type: 'mermaid',
        code: 'flowchart LR\nA-->B',
      },
    ],
  });

  assert.equal(render.markdown, '```mermaid\nflowchart LR\nA-->B\n```');
  assert.equal(render.plainText, 'flowchart LR A-->B');
});
