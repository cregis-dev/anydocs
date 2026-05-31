// =============================================================================
// Mark mapping — bidirectional helper between doc-content-v1 `TextMark[]` and
// Plate's boolean-keyed text-node representation.
//
// doc-content-v1:  { text: 'hi', marks: ['bold', 'italic'] }
// Plate / Slate :  { text: 'hi', bold: true, italic: true }
//
// Story 6.2 ships the five marks declared by `DOC_CONTENT_TEXT_MARKS`:
//   bold, italic, underline, strike, code
// Marks beyond this set DO NOT exist in the doc-content-v1 schema, so the
// converter intentionally refuses unknown marks rather than silently dropping.
// =============================================================================

import type { TextMark } from '@anydocs/core';

// Listing the marks as a tuple-typed const so the keys stay in sync with
// `DOC_CONTENT_TEXT_MARKS` from `@anydocs/core` and TypeScript can verify the
// exhaustiveness on both directions.
export const SUPPORTED_MARKS = ['bold', 'italic', 'underline', 'strike', 'code'] as const;
type SupportedMark = (typeof SUPPORTED_MARKS)[number];

const SUPPORTED_MARK_SET = new Set<string>(SUPPORTED_MARKS);

export type PlateTextMarkFlags = {
  [K in SupportedMark]?: boolean;
};

/** Convert a doc-content-v1 `marks` array into Plate's boolean-keyed flags. */
export function marksToPlateFlags(marks: ReadonlyArray<TextMark> | undefined): PlateTextMarkFlags {
  if (!marks || marks.length === 0) {
    return {};
  }
  const flags: PlateTextMarkFlags = {};
  for (const mark of marks) {
    if (!SUPPORTED_MARK_SET.has(mark)) {
      throw new Error(
        `mark-mapping: unsupported mark '${mark}' encountered while converting to Plate. ` +
        `Allowed marks: ${SUPPORTED_MARKS.join(', ')}.`,
      );
    }
    flags[mark as SupportedMark] = true;
  }
  return flags;
}

/**
 * Convert a Plate text node's boolean mark flags back to a doc-content-v1
 * `marks` array. Only emits the `marks` key when at least one mark is `true`
 * so round-trip equality holds for inputs that omit the field.
 *
 * Marks are emitted in `SUPPORTED_MARKS` order so the output is deterministic
 * regardless of property-iteration order in the source Plate node.
 */
export function plateFlagsToMarks(node: Record<string, unknown>): TextMark[] | undefined {
  const collected: TextMark[] = [];
  for (const mark of SUPPORTED_MARKS) {
    if (node[mark] === true) {
      collected.push(mark);
    }
  }
  return collected.length > 0 ? collected : undefined;
}
