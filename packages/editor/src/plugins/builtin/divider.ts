// =============================================================================
// Builtin plugin: divider (Story 6.4)
// =============================================================================

import type { DividerBlock } from '@anydocs/core';
import { HorizontalRulePlugin as PlateHorizontalRulePlugin } from '@udecode/plate-horizontal-rule/react';

import type { EditorPlugin } from '../../../contract/public-api.ts';
import { PLATE_DIVIDER } from '../../converters/element-types.ts';
import { withId, type PlateElementNode } from '../../converters/inline-shared.ts';

function dividerToPlate(block: DividerBlock): PlateElementNode {
  return withId(
    {
      type: PLATE_DIVIDER,
      children: [{ text: '' }],
    },
    block.id,
  );
}

function dividerFromPlate(node: PlateElementNode): DividerBlock {
  const block = { type: 'divider' as const } as DividerBlock;
  if (typeof node.id === 'string') {
    return { ...block, id: node.id };
  }
  return block;
}

export const dividerPlugin: EditorPlugin & { platePlugin: unknown } = {
  blockType: 'divider',
  plateElementTypes: [PLATE_DIVIDER],
  schemaFragment: { kind: 'divider', void: true },
  docContentToPlate: (block: unknown) => dividerToPlate(block as DividerBlock),
  plateToDocContent: (node: unknown) => dividerFromPlate(node as PlateElementNode),
  platePlugin: PlateHorizontalRulePlugin,
};
