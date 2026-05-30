// =============================================================================
// Builtin plugin: codeBlock (Story 6.4)
// =============================================================================

import type { CodeBlock } from '@anydocs/core';
import { CodeBlockPlugin as PlateCodeBlockPlugin } from '@udecode/plate-code-block/react';

import type { EditorPlugin } from '../../../contract/public-api.ts';
import { PLATE_CODE_BLOCK } from '../../converters/element-types.ts';
import { isPlateText, type PlateElementNode, type PlateTextNode } from '../../converters/inline-shared.ts';

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
  const code = node.children
    .filter((child): child is PlateTextNode => isPlateText(child))
    .map((child) => child.text)
    .join('');
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
