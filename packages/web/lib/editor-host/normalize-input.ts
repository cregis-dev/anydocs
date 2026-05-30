// =============================================================================
// editor-host — value normalisation (Story 7.1 AC4)
// -----------------------------------------------------------------------------
// Studio currently passes a mix of shapes into the editor: canonical
// DocContentV1, legacy Yoopta `YooptaContentValue` objects, and occasionally
// `null` / `undefined` / `{}` for new pages. The host adapter accepts all of
// these and normalises to a valid `DocContentV1` before handing it to
// `createEditor`'s `initialContent`. Story 7.2's dual-mount can swap editor
// implementations without changing Studio's input shape contract.
// =============================================================================

import type { DocContentV1 } from '@anydocs/core';
import { yooptaToDocContent } from '@anydocs/core';

const EMPTY_DOC: DocContentV1 = { version: 1, blocks: [] };

/**
 * Convert an arbitrary editor input shape into canonical DocContentV1.
 *
 * - `null` / `undefined` / `{}` → empty document
 * - `{ version: 1, blocks: [...] }` → returned as-is
 * - Legacy `YooptaContentValue` (object keyed by ids with `type` + `value`
 *   children) → converted via `yooptaToDocContent` from `@anydocs/core`
 * - Anything else → `TypeError` naming the unrecognised shape
 */
export function normalizeEditorInput(value: unknown): DocContentV1 {
  if (value === null || value === undefined) {
    return cloneEmpty();
  }
  if (typeof value !== 'object') {
    throw new TypeError(
      `editor-host: normalizeEditorInput expected an object, got ${typeof value}.`,
    );
  }

  const candidate = value as Record<string, unknown>;

  if (isDocContentV1(candidate)) {
    return candidate;
  }

  // Plain empty object — treat as a fresh page.
  if (Object.keys(candidate).length === 0) {
    return cloneEmpty();
  }

  if (looksLikeYooptaContent(candidate)) {
    const converted = yooptaToDocContent(candidate);
    // `yooptaToDocContent` returns DocContentV1; defensive guard in case the
    // helper ever changes shape.
    if (isDocContentV1(converted)) {
      return converted;
    }
    throw new TypeError(
      `editor-host: yooptaToDocContent produced an unexpected shape — expected DocContentV1, got ${describeShape(converted)}.`,
    );
  }

  throw new TypeError(
    `editor-host: unrecognised editor input shape ${describeShape(candidate)}. ` +
    `Expected DocContentV1 ({ version: 1, blocks: [...] }) or a legacy YooptaContentValue.`,
  );
}

function isDocContentV1(candidate: unknown): candidate is DocContentV1 {
  return (
    candidate !== null &&
    typeof candidate === 'object' &&
    (candidate as { version?: unknown }).version === 1 &&
    Array.isArray((candidate as { blocks?: unknown }).blocks)
  );
}

function looksLikeYooptaContent(candidate: Record<string, unknown>): boolean {
  // Yoopta values are objects keyed by block ids. Each value has `id` + `type`
  // + `value` (an array of slate nodes). We sample a few entries to avoid
  // false positives on small unrelated objects.
  const entries = Object.values(candidate);
  if (entries.length === 0) return false;
  return entries.every(
    (entry) =>
      entry !== null &&
      typeof entry === 'object' &&
      typeof (entry as { type?: unknown }).type === 'string' &&
      'value' in (entry as object),
  );
}

function cloneEmpty(): DocContentV1 {
  return { version: 1, blocks: [...EMPTY_DOC.blocks] };
}

function describeShape(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'object' && value !== null) {
    const keys = Object.keys(value as Record<string, unknown>).slice(0, 3);
    return `object with keys [${keys.join(', ')}${Object.keys(value as Record<string, unknown>).length > 3 ? ', ...' : ''}]`;
  }
  return typeof value;
}
