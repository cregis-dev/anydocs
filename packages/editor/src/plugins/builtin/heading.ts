// =============================================================================
// Builtin plugin: heading (Story 6.4)
// -----------------------------------------------------------------------------
// Owns `h1`/`h2`/`h3` Plate element types; backs the DocContentV1 `heading`
// block. Validates `level ∈ {1, 2, 3}` (DocContentV1 schema constraint).
// =============================================================================

import type { HeadingBlock } from '@anydocs/core';
import { HeadingPlugin as PlateHeadingPlugin } from '@udecode/plate-heading/react';

import type { EditorPlugin } from '../../../contract/public-api.ts';
import { PLATE_HEADING } from '../../converters/element-types.ts';
import {
  inlineChildrenToPlate,
  plateChildrenToInline,
  withId,
  withOptionalId,
  type PlateElementNode,
} from '../../converters/inline-shared.ts';

const HEADING_LEVEL_BY_PLATE_TYPE: Record<string, 1 | 2 | 3> = {
  [PLATE_HEADING[1]]: 1,
  [PLATE_HEADING[2]]: 2,
  [PLATE_HEADING[3]]: 3,
};

function headingBlockToPlate(block: HeadingBlock): PlateElementNode {
  if (block.level !== 1 && block.level !== 2 && block.level !== 3) {
    throw new Error(
      `heading-plugin: invalid level ${String(block.level)}; expected 1, 2, or 3.`,
    );
  }
  return withId(
    {
      type: PLATE_HEADING[block.level],
      children: inlineChildrenToPlate(block.children),
    },
    block.id,
  );
}

function headingFromPlate(node: PlateElementNode): HeadingBlock {
  const level = HEADING_LEVEL_BY_PLATE_TYPE[node.type];
  if (level === undefined) {
    throw new Error(`heading-plugin: unexpected Plate type '${node.type}'.`);
  }
  return withOptionalId(
    {
      type: 'heading' as const,
      level,
      children: plateChildrenToInline(node.children),
    },
    node,
  );
}

export const headingPlugin: EditorPlugin & { platePlugin: unknown } = {
  blockType: 'heading',
  plateElementTypes: [PLATE_HEADING[1], PLATE_HEADING[2], PLATE_HEADING[3]],
  schemaFragment: { kind: 'heading', levels: [1, 2, 3] },
  docContentToPlate: (block: unknown) => headingBlockToPlate(block as HeadingBlock),
  plateToDocContent: (node: unknown) => headingFromPlate(node as PlateElementNode),
  platePlugin: PlateHeadingPlugin.configure({ options: { levels: [1, 2, 3] } }),
};
