// =============================================================================
// Builtin plugin: blockquote (Story 6.4)
// =============================================================================

import type { BlockquoteBlock } from '@anydocs/core';
import { BlockquotePlugin as PlateBlockquotePlugin } from '@udecode/plate-block-quote/react';

import type { EditorPlugin } from '../../../contract/public-api.ts';
import { PLATE_BLOCKQUOTE } from '../../converters/element-types.ts';
import {
  inlineChildrenToPlate,
  plateChildrenToInline,
  withId,
  withOptionalId,
  type PlateElementNode,
} from '../../converters/inline-shared.ts';

function blockquoteToPlate(block: BlockquoteBlock): PlateElementNode {
  return withId(
    {
      type: PLATE_BLOCKQUOTE,
      children: inlineChildrenToPlate(block.children),
    },
    block.id,
  );
}

function blockquoteFromPlate(node: PlateElementNode): BlockquoteBlock {
  return withOptionalId(
    {
      type: 'blockquote' as const,
      children: plateChildrenToInline(node.children),
    },
    node,
  );
}

export const blockquotePlugin: EditorPlugin & { platePlugin: unknown } = {
  blockType: 'blockquote',
  plateElementTypes: [PLATE_BLOCKQUOTE],
  schemaFragment: { kind: 'blockquote', allowsInline: true },
  docContentToPlate: (block: unknown) => blockquoteToPlate(block as BlockquoteBlock),
  plateToDocContent: (node: unknown) => blockquoteFromPlate(node as PlateElementNode),
  platePlugin: PlateBlockquotePlugin,
};
