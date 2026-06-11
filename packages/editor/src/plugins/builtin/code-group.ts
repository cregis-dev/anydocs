// =============================================================================
// Builtin plugin: codeGroup (Story 6.4)
// -----------------------------------------------------------------------------
// Extended (non-essential) block type — the Plate ecosystem has no plugin
// for multi-language code groups, so we declare a minimal element plugin
// ourselves. Without ANY plugin for the element type, Plate skips the
// `override.components` map and renders an unstyled default `<div>` — the
// `CodeGroupElement` container component was wired in but never applied.
// Children are nested codeBlock ELEMENTS (not a void), so no `isVoid` here;
// tabbed group UX is Story 13.x scope.
// =============================================================================

import type { CodeGroupBlock, CodeGroupItem } from '@anydocs/core';
import { createPlatePlugin } from '@udecode/plate/react';

import type { EditorPlugin } from '../../../contract/public-api.ts';
import { PLATE_CODE_BLOCK, PLATE_CODE_GROUP } from '../../converters/element-types.ts';
import { isPlateElement, isPlateText, type PlateElementNode, type PlateTextNode } from '../../converters/inline-shared.ts';
import { codeBlockToPlate } from './code-block.ts';

const CodeGroupPlatePlugin = createPlatePlugin({
  key: PLATE_CODE_GROUP,
  node: {
    isElement: true,
  },
});

function codeGroupBlockToPlate(block: CodeGroupBlock): PlateElementNode {
  const result: PlateElementNode = {
    type: PLATE_CODE_GROUP,
    children: block.items.map((item) =>
      codeBlockToPlate({
        type: 'codeBlock',
        ...(item.id !== undefined ? { id: item.id } : {}),
        ...(item.language !== undefined ? { language: item.language } : {}),
        ...(item.title !== undefined ? { title: item.title } : {}),
        code: item.code,
      }),
    ),
  };
  if (block.id !== undefined) result.id = block.id;
  return result;
}

function codeBlockToGroupItem(node: PlateElementNode): CodeGroupItem {
  const code = node.children
    .filter((child): child is PlateTextNode => isPlateText(child))
    .map((child) => child.text)
    .join('');
  const item: CodeGroupItem = { code };
  if (typeof node.id === 'string') item.id = node.id;
  if (typeof node.lang === 'string') item.language = node.lang;
  if (typeof node.title === 'string') item.title = node.title;
  return item;
}

function codeGroupFromPlate(node: PlateElementNode): CodeGroupBlock {
  const result: CodeGroupBlock = {
    type: 'codeGroup',
    items: node.children
      .filter((child): child is PlateElementNode => isPlateElement(child) && child.type === PLATE_CODE_BLOCK)
      .map(codeBlockToGroupItem),
  };
  if (typeof node.id === 'string') result.id = node.id;
  return result;
}

export const codeGroupPlugin: EditorPlugin & { platePlugin: unknown } = {
  blockType: 'codeGroup',
  plateElementTypes: [PLATE_CODE_GROUP],
  schemaFragment: { kind: 'codeGroup', wrapsCodeBlocks: true },
  docContentToPlate: (block: unknown) => codeGroupBlockToPlate(block as CodeGroupBlock),
  plateToDocContent: (node: unknown) => codeGroupFromPlate(node as PlateElementNode),
  platePlugin: CodeGroupPlatePlugin,
};
