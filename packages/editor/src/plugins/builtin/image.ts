// =============================================================================
// Builtin plugin: image (Story 6.4)
// -----------------------------------------------------------------------------
// Plate plugin from @udecode/plate-media owns the `img` element type.
// =============================================================================

import type { ImageBlock } from '@anydocs/core';
import { ImagePlugin as PlateImagePlugin } from '@udecode/plate-media/react';

import type { EditorPlugin } from '../../../contract/public-api.ts';
import { PLATE_IMAGE } from '../../converters/element-types.ts';
import {
  inlineChildrenToPlate,
  plateChildrenToInline,
  type PlateElementNode,
  type PlateInlineNode,
} from '../../converters/inline-shared.ts';

function imageToPlate(block: ImageBlock): PlateElementNode {
  const node: PlateElementNode = {
    type: PLATE_IMAGE,
    src: block.src,
    children: [{ text: '' }],
  };
  if (block.alt !== undefined) node.alt = block.alt;
  if (block.title !== undefined) node.title = block.title;
  if (block.width !== undefined) node.width = block.width;
  if (block.height !== undefined) node.height = block.height;
  if (block.caption !== undefined) node.caption = inlineChildrenToPlate(block.caption);
  if (block.id !== undefined) node.id = block.id;
  return node;
}

function imageFromPlate(node: PlateElementNode): ImageBlock {
  if (typeof node.src !== 'string') {
    throw new Error(`image-plugin: missing string 'src' property.`);
  }
  const block: ImageBlock = {
    type: 'image',
    src: node.src,
  };
  if (typeof node.id === 'string') block.id = node.id;
  if (typeof node.alt === 'string') block.alt = node.alt;
  if (typeof node.title === 'string') block.title = node.title;
  if (typeof node.width === 'number') block.width = node.width;
  if (typeof node.height === 'number') block.height = node.height;
  if (Array.isArray(node.caption)) {
    block.caption = plateChildrenToInline(node.caption as Array<PlateInlineNode | PlateElementNode>);
  }
  return block;
}

export const imagePlugin: EditorPlugin & { platePlugin: unknown } = {
  blockType: 'image',
  plateElementTypes: [PLATE_IMAGE],
  schemaFragment: { kind: 'image', requiresSrc: true },
  docContentToPlate: (block: unknown) => imageToPlate(block as ImageBlock),
  plateToDocContent: (node: unknown) => imageFromPlate(node as PlateElementNode),
  platePlugin: PlateImagePlugin,
};
