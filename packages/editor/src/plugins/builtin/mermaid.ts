// =============================================================================
// Builtin plugin: mermaid (Story 6.4)
// -----------------------------------------------------------------------------
// Extended (non-essential) block type — Plate ecosystem has no plugin for
// mermaid diagrams. `platePlugin` is `undefined`. Data shape round-trips
// correctly; render UI lands in a future story.
// =============================================================================

import type { MermaidBlock } from '@anydocs/core';

import type { EditorPlugin } from '../../../contract/public-api.ts';
import { PLATE_MERMAID } from '../../converters/element-types.ts';
import type { PlateElementNode } from '../../converters/inline-shared.ts';

function mermaidToPlate(block: MermaidBlock): PlateElementNode {
  const node: PlateElementNode = {
    type: PLATE_MERMAID,
    code: block.code,
    children: [{ text: '' }],
  };
  if (block.title !== undefined) node.title = block.title;
  if (block.id !== undefined) node.id = block.id;
  return node;
}

function mermaidFromPlate(node: PlateElementNode): MermaidBlock {
  if (typeof node.code !== 'string') {
    throw new Error(`mermaid-plugin: missing string 'code' property.`);
  }
  const block: MermaidBlock = {
    type: 'mermaid',
    code: node.code,
  };
  if (typeof node.id === 'string') block.id = node.id;
  if (typeof node.title === 'string') block.title = node.title;
  return block;
}

export const mermaidPlugin: EditorPlugin & { platePlugin: unknown } = {
  blockType: 'mermaid',
  plateElementTypes: [PLATE_MERMAID],
  schemaFragment: { kind: 'mermaid', void: true, requiresCode: true },
  docContentToPlate: (block: unknown) => mermaidToPlate(block as MermaidBlock),
  plateToDocContent: (node: unknown) => mermaidFromPlate(node as PlateElementNode),
  platePlugin: undefined,
};
