// =============================================================================
// Shared inline-conversion utilities (Story 6.4)
// -----------------------------------------------------------------------------
// Builtin plugin modules under `src/plugins/builtin/` import these helpers
// instead of duplicating the inline + mark conversion logic. The forward and
// inverse converters (`doc-content-to-plate.ts` / `plate-to-doc-content.ts`)
// also re-export them for backward compatibility with Story 6.3-style imports.
// =============================================================================

import type { InlineNode, LinkNode, TextNode } from '@anydocs/core';

import { marksToPlateFlags, plateFlagsToMarks } from './mark-mapping.ts';
import { PLATE_LINK, PLATE_PARAGRAPH, PLATE_SLASH_INPUT } from './element-types.ts';

export type PlateTextNode = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  code?: boolean;
};

export type PlateLinkNode = {
  type: typeof PLATE_LINK;
  href: string;
  title?: string;
  children: PlateTextNode[];
};

export type PlateInlineNode = PlateTextNode | PlateLinkNode;

export type PlateElementNode = {
  type: string;
  children: Array<PlateInlineNode | PlateElementNode>;
  [extraProp: string]: unknown;
};

export type PlateValue = PlateElementNode[];

// ---------------------------------------------------------------------------
// Forward (DocContentV1 → Plate)
// ---------------------------------------------------------------------------

export function inlineChildrenToPlate(children: InlineNode[]): PlateInlineNode[] {
  if (children.length === 0) {
    return [emptyText()];
  }
  const flattened: PlateInlineNode[] = [];
  for (const node of children) {
    if (node.type === 'text') {
      flattened.push(textNodeToPlate(node));
      continue;
    }
    if (node.type === 'link') {
      flattened.push(linkNodeToPlate(node));
      continue;
    }
    throw new Error(
      `inline-shared: inline node of type '${(node as { type: string }).type}' is not a recognised InlineNode shape.`,
    );
  }
  return flattened.length > 0 ? flattened : [emptyText()];
}

export function textNodeToPlate(node: TextNode): PlateTextNode {
  return {
    text: node.text,
    ...marksToPlateFlags(node.marks),
  };
}

export function linkNodeToPlate(node: LinkNode): PlateLinkNode {
  const result: PlateLinkNode = {
    type: PLATE_LINK,
    href: node.href,
    children: node.children.map(textNodeToPlate),
  };
  if (node.title !== undefined) result.title = node.title;
  return result;
}

export function emptyText(): PlateTextNode {
  return { text: '' };
}

export function emptyParagraphElement(): PlateElementNode {
  return { type: PLATE_PARAGRAPH, children: [emptyText()] };
}

export function withId<T extends PlateElementNode>(node: T, id: string | undefined): T {
  if (id !== undefined) {
    (node as Record<string, unknown>).id = id;
  }
  return node;
}

// ---------------------------------------------------------------------------
// Inverse (Plate → DocContentV1)
// ---------------------------------------------------------------------------

export function plateChildrenToInline(children: Array<PlateInlineNode | PlateElementNode>): InlineNode[] {
  const inline: InlineNode[] = [];
  for (const child of children) {
    if (isPlateText(child)) {
      inline.push(plateTextToTextNode(child));
      continue;
    }
    if (isPlateLink(child)) {
      inline.push(plateLinkToLinkNode(child));
      continue;
    }
    // Transient slash-command input node — dropped, never persisted. The
    // plugin normally removes it before save, but a content read mid-edit
    // (e.g. autosave while the menu is open) must not crash.
    if ((child as PlateElementNode).type === PLATE_SLASH_INPUT) {
      continue;
    }
    throw new Error(
      `inline-shared: nested element of type '${(child as PlateElementNode).type}' inside a block is not a recognised inline node.`,
    );
  }
  if (inline.length === 0) {
    inline.push({ type: 'text', text: '' });
  }
  return inline;
}

export function plateTextToTextNode(node: PlateTextNode): TextNode {
  const marks = plateFlagsToMarks(node as Record<string, unknown>);
  const result: TextNode = { type: 'text', text: node.text };
  if (marks !== undefined) result.marks = marks;
  return result;
}

export function plateLinkToLinkNode(node: PlateLinkNode): LinkNode {
  const result: LinkNode = {
    type: 'link',
    href: node.href,
    children: node.children.map(plateTextToTextNode),
  };
  if (typeof node.title === 'string') result.title = node.title;
  return result;
}

export function withOptionalId<T extends { type: string }>(block: T, node: PlateElementNode): T & { id?: string } {
  if (typeof node.id === 'string') {
    return { ...block, id: node.id };
  }
  return block;
}

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

export function isPlateElement(value: unknown): value is PlateElementNode {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof (value as { type?: unknown }).type === 'string' &&
    Array.isArray((value as { children?: unknown }).children)
  );
}

export function isPlateText(value: unknown): value is PlateTextNode {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof (value as { text?: unknown }).text === 'string' &&
    (value as { type?: unknown }).type === undefined
  );
}

export function isPlateLink(value: unknown): value is PlateLinkNode {
  return (
    value !== null &&
    typeof value === 'object' &&
    (value as { type?: unknown }).type === PLATE_LINK
  );
}

export function isPlateInline(value: unknown): value is PlateInlineNode {
  return isPlateText(value) || isPlateLink(value);
}
