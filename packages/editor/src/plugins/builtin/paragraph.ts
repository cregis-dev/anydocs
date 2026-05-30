// =============================================================================
// Builtin plugin: paragraph (Story 6.4)
// -----------------------------------------------------------------------------
// Migrates Story 6.3's `paragraphBlockToPlate` / `paragraphFromPlate` per-type
// helpers into the EditorPlugin contract introduced by Story 6.4.
// =============================================================================

import type { ParagraphBlock } from '@anydocs/core';
import { ParagraphPlugin as PlateParagraphPlugin } from '@udecode/plate/react';

import type { EditorPlugin } from '../../../contract/public-api.ts';
import { PLATE_PARAGRAPH } from '../../converters/element-types.ts';
import {
  inlineChildrenToPlate,
  plateChildrenToInline,
  withId,
  withOptionalId,
  type PlateElementNode,
} from '../../converters/inline-shared.ts';

function paragraphBlockToPlate(block: ParagraphBlock): PlateElementNode {
  return withId(
    {
      type: PLATE_PARAGRAPH,
      children: inlineChildrenToPlate(block.children),
    },
    block.id,
  );
}

function paragraphFromPlate(node: PlateElementNode): ParagraphBlock {
  return withOptionalId(
    {
      type: 'paragraph' as const,
      children: plateChildrenToInline(node.children),
    },
    node,
  );
}

export const paragraphPlugin: EditorPlugin & { platePlugin: unknown } = {
  blockType: 'paragraph',
  plateElementTypes: [PLATE_PARAGRAPH],
  schemaFragment: { kind: 'paragraph', allowsInline: true },
  docContentToPlate: (block: unknown) => paragraphBlockToPlate(block as ParagraphBlock),
  plateToDocContent: (node: unknown) => paragraphFromPlate(node as PlateElementNode),
  platePlugin: PlateParagraphPlugin,
};
