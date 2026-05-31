// =============================================================================
// Builtin plugin: list (Story 6.4)
// -----------------------------------------------------------------------------
// Migrates Story 6.3's list / item per-type helpers. Owns FIVE Plate element
// types — three container types (`ul`/`ol`/`todo_list`) and two item types
// (`li`/`todo_li`). The inverse converter routes ALL of them to this plugin,
// which then disambiguates container vs item internally.
// =============================================================================

import type { ListBlock, ListItem } from '@anydocs/core';
import { ListPlugin as PlateListPlugin } from '@udecode/plate-list/react';

import type { EditorPlugin } from '../../../contract/public-api.ts';
import {
  PLATE_LIST_BULLETED,
  PLATE_LIST_ITEM,
  PLATE_LIST_ITEM_TODO,
  PLATE_LIST_NUMBERED,
  PLATE_LIST_TODO,
} from '../../converters/element-types.ts';
import {
  inlineChildrenToPlate,
  isPlateElement,
  isPlateInline,
  plateChildrenToInline,
  withId,
  type PlateElementNode,
  type PlateInlineNode,
} from '../../converters/inline-shared.ts';

const LIST_STYLE_BY_TYPE: Record<string, ListBlock['style']> = {
  [PLATE_LIST_BULLETED]: 'bulleted',
  [PLATE_LIST_NUMBERED]: 'numbered',
  [PLATE_LIST_TODO]: 'todo',
};

const LIST_CONTAINER_TYPE_BY_STYLE: Record<ListBlock['style'], string> = {
  bulleted: PLATE_LIST_BULLETED,
  numbered: PLATE_LIST_NUMBERED,
  todo: PLATE_LIST_TODO,
};

function listBlockToPlate(block: ListBlock): PlateElementNode {
  if (LIST_CONTAINER_TYPE_BY_STYLE[block.style] === undefined) {
    throw new Error(
      `list-plugin: unsupported style '${String(block.style)}' (expected 'bulleted', 'numbered', or 'todo').`,
    );
  }
  return withId(
    {
      type: LIST_CONTAINER_TYPE_BY_STYLE[block.style],
      children: block.items.map((item) => listItemToPlate(item, block.style)),
    },
    block.id,
  );
}

function listItemToPlate(item: ListItem, style: ListBlock['style']): PlateElementNode {
  const isTodo = style === 'todo';
  const itemType = isTodo ? PLATE_LIST_ITEM_TODO : PLATE_LIST_ITEM;
  const node: PlateElementNode = {
    type: itemType,
    children: [...inlineChildrenToPlate(item.children)],
  };
  if (isTodo && typeof item.checked === 'boolean') {
    node.checked = item.checked;
  }
  if (item.id !== undefined) {
    node.id = item.id;
  }
  if (item.items && item.items.length > 0) {
    const nestedContainer: PlateElementNode = {
      type: LIST_CONTAINER_TYPE_BY_STYLE[style],
      children: item.items.map((nested) => listItemToPlate(nested, style)),
    };
    (node.children as Array<PlateInlineNode | PlateElementNode>).push(nestedContainer);
  }
  return node;
}

function listFromPlate(node: PlateElementNode): ListBlock {
  const style = LIST_STYLE_BY_TYPE[node.type];
  if (style === undefined) {
    throw new Error(`list-plugin: list container has unexpected type '${node.type}'.`);
  }
  const items = node.children
    .filter((child): child is PlateElementNode => isPlateElement(child))
    .map((child) => listItemFromPlate(child, style));
  const result: ListBlock = {
    type: 'list',
    style,
    items,
  };
  if (typeof node.id === 'string') result.id = node.id;
  return result;
}

function listItemFromPlate(node: PlateElementNode, style: ListBlock['style']): ListItem {
  const expectedItemType = style === 'todo' ? PLATE_LIST_ITEM_TODO : PLATE_LIST_ITEM;
  if (node.type !== expectedItemType) {
    throw new Error(
      `list-plugin: list item has type '${node.type}' but parent list is style '${style}' (expected '${expectedItemType}').`,
    );
  }
  const inlineChildren: PlateInlineNode[] = [];
  let nestedListNode: PlateElementNode | null = null;
  for (const child of node.children) {
    if (isPlateElement(child) && LIST_STYLE_BY_TYPE[child.type] !== undefined) {
      nestedListNode = child;
    } else if (isPlateInline(child)) {
      inlineChildren.push(child);
    } else if (isPlateElement(child)) {
      throw new Error(
        `list-plugin: list item contains unexpected nested element of type '${child.type}'.`,
      );
    }
  }
  const item: ListItem = {
    children: plateChildrenToInline(inlineChildren),
  };
  if (typeof node.id === 'string') item.id = node.id;
  if (style === 'todo' && typeof node.checked === 'boolean') item.checked = node.checked;
  if (nestedListNode !== null) {
    const nestedBlock = listFromPlate(nestedListNode);
    if (nestedBlock.style !== style) {
      throw new Error(
        `list-plugin: nested list style '${nestedBlock.style}' does not match parent list style '${style}'.`,
      );
    }
    item.items = nestedBlock.items;
  }
  return item;
}

// The inverse dispatch routes BOTH container (`ul`/`ol`/`todo_list`) AND
// item (`li`/`todo_li`) types here. Container nodes return a full
// `ListBlock`; item nodes should never arrive at the top level (they live
// inside their parent's children) but we throw clearly if they do.
function plateToDocContent(node: PlateElementNode): ListBlock {
  if (LIST_STYLE_BY_TYPE[node.type] !== undefined) {
    return listFromPlate(node);
  }
  throw new Error(
    `list-plugin: unexpected top-level list item of type '${node.type}'; ` +
    `items must be nested inside a list container.`,
  );
}

export const listPlugin: EditorPlugin & { platePlugin: unknown } = {
  blockType: 'list',
  plateElementTypes: [
    PLATE_LIST_BULLETED,
    PLATE_LIST_NUMBERED,
    PLATE_LIST_TODO,
    PLATE_LIST_ITEM,
    PLATE_LIST_ITEM_TODO,
  ],
  schemaFragment: { kind: 'list', styles: ['bulleted', 'numbered', 'todo'] },
  docContentToPlate: (block: unknown) => listBlockToPlate(block as ListBlock),
  plateToDocContent: (node: unknown) => plateToDocContent(node as PlateElementNode),
  platePlugin: PlateListPlugin,
};
