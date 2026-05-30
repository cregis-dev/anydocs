// =============================================================================
// Builtin plugin: callout (Story 6.4)
// -----------------------------------------------------------------------------
// Validates `tone` against `DOC_CONTENT_CALLOUT_TONES` from `@anydocs/core`
// (info / warning / success / danger / note).
// =============================================================================

import type { CalloutBlock, CalloutTone } from '@anydocs/core/content';
import { DOC_CONTENT_CALLOUT_TONES } from '@anydocs/core/content';
import { CalloutPlugin as PlateCalloutPlugin } from '@udecode/plate-callout/react';

import type { EditorPlugin } from '../../../contract/public-api.ts';
import { PLATE_CALLOUT } from '../../converters/element-types.ts';
import {
  inlineChildrenToPlate,
  plateChildrenToInline,
  type PlateElementNode,
} from '../../converters/inline-shared.ts';

const VALID_CALLOUT_TONES = new Set<string>(DOC_CONTENT_CALLOUT_TONES);

function calloutToPlate(block: CalloutBlock): PlateElementNode {
  if (block.tone !== undefined && !VALID_CALLOUT_TONES.has(block.tone)) {
    throw new Error(
      `callout-plugin: invalid tone '${String(block.tone)}' ` +
      `(expected one of: ${[...VALID_CALLOUT_TONES].join(', ')}).`,
    );
  }
  const node: PlateElementNode = {
    type: PLATE_CALLOUT,
    children: inlineChildrenToPlate(block.children),
  };
  if (block.tone !== undefined) node.tone = block.tone;
  if (block.title !== undefined) node.title = block.title;
  if (block.id !== undefined) node.id = block.id;
  return node;
}

function calloutFromPlate(node: PlateElementNode): CalloutBlock {
  const block: CalloutBlock = {
    type: 'callout',
    children: plateChildrenToInline(node.children),
  };
  if (typeof node.id === 'string') block.id = node.id;
  if (typeof node.tone === 'string') block.tone = node.tone as CalloutTone;
  if (typeof node.title === 'string') block.title = node.title;
  return block;
}

export const calloutPlugin: EditorPlugin & { platePlugin: unknown } = {
  blockType: 'callout',
  plateElementTypes: [PLATE_CALLOUT],
  schemaFragment: { kind: 'callout', tones: [...VALID_CALLOUT_TONES] },
  docContentToPlate: (block: unknown) => calloutToPlate(block as CalloutBlock),
  plateToDocContent: (node: unknown) => calloutFromPlate(node as PlateElementNode),
  platePlugin: PlateCalloutPlugin,
};
