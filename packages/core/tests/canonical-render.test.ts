import assert from 'node:assert/strict';
import test from 'node:test';

import { createMarkdownYooptaContent, renderDocContent, renderPageContent, yooptaToDocContent } from '../src/utils/index.ts';

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

test('renderDocContent preserves bulleted and numbered list item text', () => {
  const render = renderDocContent({
    version: 1,
    blocks: [
      {
        type: 'list',
        style: 'bulleted',
        items: [
          {
            children: [
              { type: 'text', text: 'Install ' },
              { type: 'text', text: 'dependencies', marks: ['bold'] },
            ],
            items: [
              {
                children: [
                  {
                    type: 'link',
                    href: 'https://pnpm.io',
                    children: [{ type: 'text', text: 'pnpm' }],
                  },
                ],
              },
            ],
          },
          {
            children: [{ type: 'text', text: 'Start Studio' }],
          },
        ],
      },
      {
        type: 'list',
        style: 'numbered',
        items: [
          {
            children: [{ type: 'text', text: 'Build artifacts' }],
          },
          {
            children: [{ type: 'text', text: 'Open preview' }],
          },
        ],
      },
    ],
  });

  assert.match(render.markdown ?? '', /^- Install \*\*dependencies\*\*$/m);
  assert.match(render.markdown ?? '', /^  - \[pnpm\]\(https:\/\/pnpm\.io\)$/m);
  assert.match(render.markdown ?? '', /^- Start Studio$/m);
  assert.match(render.markdown ?? '', /^1\. Build artifacts$/m);
  assert.match(render.markdown ?? '', /^2\. Open preview$/m);
  assert.doesNotMatch(render.markdown ?? '', /^- $/m);
  assert.equal(render.plainText, 'Install dependencies\npnpm\nStart Studio\n\nBuild artifacts\nOpen preview');
});

test('markdown import preserves bold warnings and relative links through canonical rendering', () => {
  const content = yooptaToDocContent(
    createMarkdownYooptaContent([
      '**Warning**: review [Provider Runtime](./provider-routing) and [Tools & Toolsets](./tools).',
      '',
      '| Name | Link |',
      '| --- | --- |',
      '| **Warning** | [Tools & Toolsets](./tools) |',
    ].join('\n')),
  );

  const render = renderDocContent(content);
  assert.match(render.markdown ?? '', /\*\*Warning\*\*: review \[Provider Runtime\]\(\.\/provider-routing\)/);
  assert.match(render.markdown ?? '', /\[Tools & Toolsets\]\(\.\/tools\)/);
  assert.doesNotMatch(render.plainText, /\*\*/);
  assert.match(render.plainText, /Warning/);
});
