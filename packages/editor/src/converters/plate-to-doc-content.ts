// =============================================================================
// Plate value → doc-content-v1 converter (Story 6.4 dispatch refactor)
// -----------------------------------------------------------------------------
// Thin dispatcher: looks up the EditorPlugin that owns each Plate element's
// `type` and delegates the per-type conversion to the plugin's
// `plateToDocContent` hook. Per-type helpers now live inside the builtin
// plugin modules under `src/plugins/builtin/`.
// =============================================================================

import type { DocBlock, DocContentV1 } from '@anydocs/core';

import { isPlateElement, type PlateValue } from './inline-shared.ts';
import {
  getPluginForPlateElement,
  listRegisteredPlateElementTypes,
} from '../plugins/plugin-contract.ts';

/**
 * Convert a Plate value back into a canonical doc-content-v1 payload. Used
 * by `EditorInstance.getContent()`.
 */
export function plateToDocContent(value: PlateValue): DocContentV1 {
  if (!Array.isArray(value)) {
    throw new Error('plateToDocContent: expected an array of Plate element nodes.');
  }
  return {
    version: 1,
    blocks: value.map((node, index) => plateElementToBlock(node, index)),
  };
}

function plateElementToBlock(node: unknown, index: number): DocBlock {
  if (!isPlateElement(node)) {
    throw new Error(`plateToDocContent: expected a Plate element node at index ${index}, got ${JSON.stringify(node)}.`);
  }
  const plugin = getPluginForPlateElement(node.type);
  if (!plugin || !plugin.plateToDocContent) {
    throw new Error(
      `plateToDocContent: unrecognised Plate element type '${node.type}' at index ${index}. ` +
      `Allowed types: ${listRegisteredPlateElementTypes().join(', ')}.`,
    );
  }
  const result = plugin.plateToDocContent(node);
  return result as DocBlock;
}
