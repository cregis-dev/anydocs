// =============================================================================
// Inline link Plate plugin
// -----------------------------------------------------------------------------
// DocContentV1's `link` node is an INLINE (it lives inside block children),
// not a block type — so it has no `EditorPlugin` entry in the builtin plugin
// registry. But Plate still needs a runtime plugin for the `a` element type:
// without one, Slate treats every `a` node as an unknown BLOCK element,
// renders it as a `<div>` nested inside the parent `<p>` (invalid HTML →
// React hydration error), and crashes the whole editor tree with "Objects
// are not valid as a React child" on any page containing a link.
//
// This minimal plugin only declares the node semantics (`isElement` +
// `isInline`); the visual component lives in `element-components.ts`
// (`BUILTIN_ELEMENT_COMPONENTS[PLATE_LINK]`), keyed by the same plugin key.
// Link editing UX (toolbar, URL popover — `@udecode/plate-link`) is a future
// story; this plugin is only about rendering + caret behavior correctness.
// =============================================================================

import { createPlatePlugin } from '@udecode/plate/react';

import { PLATE_LINK } from '../converters/element-types.ts';

export const InlineLinkPlugin = createPlatePlugin({
  key: PLATE_LINK,
  node: {
    isElement: true,
    isInline: true,
  },
});
