// =============================================================================
// doc-content-v1 → Plate value converter (Story 6.4 dispatch refactor)
// -----------------------------------------------------------------------------
// Thin dispatcher: looks up the EditorPlugin that owns each block's
// `blockType` and delegates the per-type conversion to the plugin's
// `docContentToPlate` hook. Per-type helpers now live inside the builtin
// plugin modules under `src/plugins/builtin/`.
//
// Backward-compatible exports preserve the Story 6.2 / 6.3 type aliases so
// callers that already imported `PlateValue`, `PlateElementNode`, etc.
// continue to work — the actual definitions live in `inline-shared.ts`.
// =============================================================================

import type { DocContentV1 } from '@anydocs/core';

import { emptyParagraphElement, type PlateValue } from './inline-shared.ts';
import { getPluginForBlockType, listRegisteredBlockTypes } from '../plugins/plugin-contract.ts';

export type {
  PlateElementNode,
  PlateInlineNode,
  PlateLinkNode,
  PlateTextNode,
  PlateValue,
} from './inline-shared.ts';

export {
  PLATE_PARAGRAPH as PLATE_PARAGRAPH_TYPE,
  PLATE_HEADING as PLATE_HEADING_TYPES,
} from './element-types.ts';

/**
 * Convert a canonical doc-content-v1 payload into a Plate value. Dispatches
 * each block to the EditorPlugin registered for its `blockType` (builtin
 * plugins are auto-registered by `plate-runtime` on first `createEditor`
 * call; host plugins can be registered via the public `registerPlugin` API).
 */
export function docContentToPlate(payload: DocContentV1): PlateValue {
  if (payload.version !== 1) {
    throw new Error(
      `docContentToPlate: unsupported DocContentV1 version ${String(payload.version)}; expected 1.`,
    );
  }

  // Empty payload normalization — Plate refuses to render an empty value;
  // emit a single empty paragraph so `<Editable />` mounts cleanly.
  if (payload.blocks.length === 0) {
    return [emptyParagraphElement()];
  }

  return payload.blocks.map((block, index) => {
    const plugin = getPluginForBlockType(block.type);
    if (!plugin || !plugin.docContentToPlate) {
      const offendingType = (block as { type: string }).type;
      const known = listRegisteredBlockTypes();
      throw new Error(
        `docContentToPlate: no plugin registered for blockType '${offendingType}' at index ${index}. ` +
        `Allowed (registered) blockTypes: ${known.join(', ')}. ` +
        `If this is a custom block type, register a plugin via registerPlugin() before calling docContentToPlate.`,
      );
    }
    const result = plugin.docContentToPlate(block);
    return result as PlateValue[number];
  });
}
