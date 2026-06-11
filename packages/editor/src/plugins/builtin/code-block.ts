// =============================================================================
// Builtin plugin: codeBlock (Story 6.4)
// =============================================================================

import type { CodeBlock } from '@anydocs/core';
import { CodeBlockPlugin as PlateCodeBlockPlugin } from '@udecode/plate-code-block/react';

import type { EditorPlugin } from '../../../contract/public-api.ts';
import { PLATE_CODE_BLOCK } from '../../converters/element-types.ts';
import { isPlateElement, isPlateText, type PlateElementNode, type PlateTextNode } from '../../converters/inline-shared.ts';

function codeBlockToPlate(block: CodeBlock): PlateElementNode {
  const node: PlateElementNode = {
    type: PLATE_CODE_BLOCK,
    children: [{ text: block.code }],
  };
  if (block.language !== undefined) node.lang = block.language;
  if (block.title !== undefined) node.title = block.title;
  if (block.id !== undefined) node.id = block.id;
  return node;
}

function codeBlockFromPlate(node: PlateElementNode): CodeBlock {
  // `@udecode/plate-code-block` models code blocks as `code_line` element
  // children (its Enter-key override inserts new code_line nodes). Our
  // canonical Plate shape is raw text children, but once the user edits a
  // code block the plugin's shape takes over — accept both: text children
  // concatenate directly, code_line elements contribute one line each.
  const lines: string[] = [];
  let pendingText = '';
  for (const child of node.children) {
    // Treat ANY node carrying a string `text` as a text leaf. The plugin's
    // normalizer tags text leaves inside code blocks with `type:
    // "code_line"` (a text node with a stray type marker, NOT an element) —
    // the strict `isPlateText` guard (`type === undefined`) misses those and
    // the user's code would silently convert to ''.
    const maybeText = (child as { text?: unknown }).text;
    if (typeof maybeText === 'string') {
      pendingText += maybeText;
      continue;
    }
    if (isPlateElement(child) && child.type === 'code_line') {
      if (pendingText !== '') {
        lines.push(pendingText);
        pendingText = '';
      }
      lines.push(
        child.children
          .filter((grand): grand is PlateTextNode => isPlateText(grand))
          .map((grand) => grand.text)
          .join(''),
      );
    }
  }
  if (pendingText !== '') {
    lines.push(pendingText);
  }
  const code = lines.join('\n');
  const block: CodeBlock = {
    type: 'codeBlock',
    code,
  };
  if (typeof node.id === 'string') block.id = node.id;
  if (typeof node.lang === 'string') block.language = node.lang;
  if (typeof node.title === 'string') block.title = node.title;
  return block;
}

export const codeBlockPlugin: EditorPlugin & { platePlugin: unknown } = {
  blockType: 'codeBlock',
  plateElementTypes: [PLATE_CODE_BLOCK],
  schemaFragment: { kind: 'codeBlock', allowsLanguage: true },
  docContentToPlate: (block: unknown) => codeBlockToPlate(block as CodeBlock),
  plateToDocContent: (node: unknown) => codeBlockFromPlate(node as PlateElementNode),
  platePlugin: PlateCodeBlockPlugin,
};

// Re-exports for cross-plugin reuse (codeGroup composes codeBlock).
export { codeBlockToPlate, codeBlockFromPlate };
