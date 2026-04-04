import assert from 'node:assert/strict';
import test from 'node:test';

import { renderYooptaContent } from '../src/utils/yoopta-render.ts';

test('renderYooptaContent plainText ignores block props and preserves block separation', () => {
  const result = renderYooptaContent({
    heading: {
      id: 'heading',
      type: 'HeadingOne',
      value: [
        {
          id: 'heading-value',
          type: 'heading-one',
          props: {
            nodeType: 'HeadingOne',
            title: 'Ignored title metadata',
          },
          children: [{ text: 'Authentication API auth-123' }],
        },
      ],
      meta: { order: 0, depth: 0 },
    },
    paragraph: {
      id: 'paragraph',
      type: 'Paragraph',
      value: [
        {
          id: 'paragraph-value',
          type: 'paragraph',
          props: {
            classification: 'Ignored paragraph metadata',
          },
          children: [{ text: 'Authentication flow auth-123-body' }],
        },
      ],
      meta: { order: 1, depth: 0 },
    },
  });

  assert.equal(result.plainText, 'Authentication API auth-123\n\nAuthentication flow auth-123-body');
  assert.doesNotMatch(result.plainText, /Ignored title metadata|Ignored paragraph metadata/);
});

test('renderYooptaContent serializes Mermaid blocks as mermaid fences', () => {
  const result = renderYooptaContent({
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
            code: 'sequenceDiagram\n    A->>B: Hi',
          },
        },
      ],
      meta: { order: 0, depth: 0 },
    },
  });

  assert.equal(result.markdown, '```mermaid\nsequenceDiagram\n    A->>B: Hi\n```');
  assert.equal(result.plainText, 'sequenceDiagram A->>B: Hi');
});
