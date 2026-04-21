import { assertValidDocContentV1 } from './content-schema.ts';
import { assertValidYooptaContentValue } from './yoopta-content.ts';
import type {
  CalloutTone,
  DocBlock,
  DocContentV1,
  InlineNode,
  ListItem,
  TextMark,
  TextNode,
} from '../types/content.ts';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function readBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

function readChildren(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function readLinkHref(value: unknown): string | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  return readString(value.href) ?? readString(value.url);
}

function trimUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as T;
}

function getBlockOrder(value: unknown): number {
  if (!isRecord(value) || !isRecord(value.meta) || typeof value.meta.order !== 'number') {
    return Number.POSITIVE_INFINITY;
  }

  return value.meta.order;
}

function extractMarks(node: Record<string, unknown>): TextMark[] | undefined {
  const marks = (['bold', 'italic', 'underline', 'strike', 'code'] as const).filter((mark) => node[mark] === true);
  return marks.length > 0 ? [...marks] : undefined;
}

function yooptaLeafToTextNode(node: unknown): TextNode {
  if (!isRecord(node)) {
    return { type: 'text', text: '' };
  }

  return trimUndefined({
    type: 'text' as const,
    text: readString(node.text) ?? '',
    marks: extractMarks(node),
  });
}

function yooptaInlineToCanonical(node: unknown): InlineNode[] {
  if (!isRecord(node)) {
    return [];
  }

  if (typeof node.text === 'string') {
    return [yooptaLeafToTextNode(node)];
  }

  if (node.type === 'link') {
    return [
      trimUndefined({
        type: 'link' as const,
        href: readLinkHref(node.props) ?? '',
        title: readString(isRecord(node.props) ? node.props.title : undefined),
        children: readChildren(node.children).flatMap((child) => yooptaInlineToCanonical(child)).filter((child): child is TextNode => child.type === 'text'),
      }),
    ];
  }

  return readChildren(node.children).flatMap((child) => yooptaInlineToCanonical(child));
}

function yooptaInlineChildrenToCanonical(value: unknown): InlineNode[] {
  return readChildren(value).flatMap((child) => yooptaInlineToCanonical(child));
}

function yooptaListItemInlineChildrenToCanonical(value: unknown): InlineNode[] {
  return readChildren(value)
    .filter((entry) => !(isRecord(entry) && entry.type === 'list-item'))
    .flatMap((child) => yooptaInlineToCanonical(child));
}

function yooptaListItemsToCanonical(value: unknown, style: 'bulleted' | 'numbered' | 'todo'): ListItem[] {
  return readChildren(value)
    .filter((entry): entry is Record<string, unknown> => isRecord(entry) && entry.type === 'list-item')
    .map((item, index) => {
      const childItems = yooptaListItemsToCanonical(item.children, style);
      return trimUndefined({
        id: readString(item.id) ?? `list-item-${index + 1}`,
        children: yooptaListItemInlineChildrenToCanonical(item.children),
        checked: style === 'todo' ? readBoolean(isRecord(item.props) ? item.props.checked : undefined) : undefined,
        items: childItems.length > 0 ? childItems : undefined,
      });
    });
}

function yooptaListBlockToCanonical(
  entries: Record<string, unknown>[],
  style: 'bulleted' | 'numbered' | 'todo',
  blockId: string,
): ListItem[] {
  const items: ListItem[] = [];

  for (const entry of entries) {
    const structuredItems = yooptaListItemsToCanonical(entry.children, style);
    if (structuredItems.length > 0) {
      items.push(...structuredItems);
      continue;
    }

    const children = yooptaInlineChildrenToCanonical(entry.children);
    if (children.length === 0) {
      continue;
    }

    items.push(
      trimUndefined({
        id: readString(entry.id) ?? `${blockId}-item-${items.length + 1}`,
        children,
        checked: style === 'todo' ? readBoolean(isRecord(entry.props) ? entry.props.checked : undefined) : undefined,
      }),
    );
  }

  return items;
}

function yooptaValueEntries(block: Record<string, unknown>): Record<string, unknown>[] {
  return readChildren(block.value).filter(isRecord);
}

function yooptaBlockToCanonical(block: Record<string, unknown>, index: number): DocBlock | null {
  const entries = yooptaValueEntries(block);
  const [entry] = entries;
  const blockId = readString(block.id) ?? `block-${index + 1}`;

  switch (block.type) {
    case 'Paragraph':
      return { type: 'paragraph', id: blockId, children: yooptaInlineChildrenToCanonical(entry?.children) };
    case 'HeadingOne':
      return { type: 'heading', id: blockId, level: 1, children: yooptaInlineChildrenToCanonical(entry?.children) };
    case 'HeadingTwo':
      return { type: 'heading', id: blockId, level: 2, children: yooptaInlineChildrenToCanonical(entry?.children) };
    case 'HeadingThree':
      return { type: 'heading', id: blockId, level: 3, children: yooptaInlineChildrenToCanonical(entry?.children) };
    case 'BulletedList':
      return { type: 'list', id: blockId, style: 'bulleted', items: yooptaListBlockToCanonical(entries, 'bulleted', blockId) };
    case 'NumberedList':
      return { type: 'list', id: blockId, style: 'numbered', items: yooptaListBlockToCanonical(entries, 'numbered', blockId) };
    case 'TodoList':
      return { type: 'list', id: blockId, style: 'todo', items: yooptaListBlockToCanonical(entries, 'todo', blockId) };
    case 'Blockquote':
      return { type: 'blockquote', id: blockId, children: yooptaInlineChildrenToCanonical(entry?.children) };
    case 'Callout':
      return trimUndefined({
        type: 'callout' as const,
        id: blockId,
        tone: themeToCalloutTone(isRecord(entry?.props) ? entry.props.theme : undefined),
        title: readString(isRecord(entry?.props) ? entry.props.title : undefined),
        children: yooptaInlineChildrenToCanonical(entry?.children),
      }) as DocBlock;
    case 'Code':
      return trimUndefined({
        type: 'codeBlock' as const,
        id: blockId,
        language: readString(isRecord(entry?.props) ? entry.props.language : undefined),
        title: readString(isRecord(entry?.props) ? entry.props.title : undefined),
        code: yooptaInlineChildrenToCanonical(entry?.children)
          .map((node) => ('text' in node ? node.text : ''))
          .join(''),
      }) as DocBlock;
    case 'CodeGroup':
      return {
        type: 'codeGroup',
        id: blockId,
        items: readChildren(entry?.children)
          .filter(isRecord)
          .map((item, itemIndex) =>
            trimUndefined({
              id: readString(item.id) ?? `${blockId}-item-${itemIndex + 1}`,
              language: readString(isRecord(item.props) ? item.props.language : undefined),
              title: readString(isRecord(item.props) ? item.props.title : undefined),
              code: yooptaInlineChildrenToCanonical(item.children)
                .map((node) => ('text' in node ? node.text : ''))
                .join(''),
            }),
          ),
      };
    case 'Divider':
      return { type: 'divider', id: blockId };
    case 'Image':
      return trimUndefined({
        type: 'image' as const,
        id: blockId,
        src: readString(isRecord(entry?.props) ? entry.props.src : undefined) ?? '',
        alt: readString(isRecord(entry?.props) ? entry.props.alt : undefined),
        title: readString(isRecord(entry?.props) ? entry.props.title : undefined),
        width: readNumber(isRecord(entry?.props) ? entry.props.width : undefined),
        height: readNumber(isRecord(entry?.props) ? entry.props.height : undefined),
        caption: yooptaInlineChildrenToCanonical(entry?.children).length > 0 ? yooptaInlineChildrenToCanonical(entry?.children) : undefined,
      }) as DocBlock;
    case 'Table':
      return {
        type: 'table',
        id: blockId,
        rows: readChildren(entry?.children)
          .filter(isRecord)
          .map((row, rowIndex) => ({
            id: readString(row.id) ?? `${blockId}-row-${rowIndex + 1}`,
            cells: readChildren(row.children)
              .filter(isRecord)
              .map((cell, cellIndex) =>
                trimUndefined({
                  id: readString(cell.id) ?? `${blockId}-cell-${rowIndex + 1}-${cellIndex + 1}`,
                  header: rowIndex === 0 || cell.type === 'table-header-cell',
                  children: yooptaInlineChildrenToCanonical(cell.children),
                }),
              ),
          })),
      };
    case 'Link': {
      const href = readLinkHref(entry?.props) ?? '';
      const title = readString(isRecord(entry?.props) ? entry.props.title : undefined);
      return {
        type: 'paragraph',
        id: blockId,
        children: [
          trimUndefined({
            type: 'link' as const,
            href,
            title,
            children: yooptaInlineChildrenToCanonical(entry?.children).filter((node): node is TextNode => node.type === 'text'),
          }),
        ],
      };
    }
    case 'Mermaid':
      return trimUndefined({
        type: 'mermaid' as const,
        id: blockId,
        code:
          readString(isRecord(entry?.props) ? entry.props.code : undefined) ??
          yooptaInlineChildrenToCanonical(entry?.children)
            .map((node) => ('text' in node ? node.text : ''))
            .join(''),
        title: readString(isRecord(entry?.props) ? entry.props.title : undefined),
      }) as DocBlock;
    default:
      return null;
  }
}

function canonicalTextNodeToYoopta(node: TextNode): Record<string, unknown> {
  const marks = Object.fromEntries((node.marks ?? []).map((mark) => [mark, true]));
  return {
    text: node.text,
    ...marks,
  };
}

function canonicalInlineToYoopta(node: InlineNode, fallbackId: string): Record<string, unknown> {
  if (node.type === 'text') {
    return canonicalTextNodeToYoopta(node);
  }

  return {
    id: fallbackId,
    type: 'link',
    children: node.children.map((child) => canonicalTextNodeToYoopta(child)),
    props: trimUndefined({
      href: node.href,
      title: node.title,
    }),
  };
}

function canonicalInlineChildrenToYoopta(children: InlineNode[], prefix: string): Record<string, unknown>[] {
  return children.map((child, index) => canonicalInlineToYoopta(child, `${prefix}-inline-${index + 1}`));
}

function createYooptaBlock(
  blockId: string,
  type: string,
  elementType: string,
  children: Record<string, unknown>[],
  order: number,
  props: Record<string, unknown> = { nodeType: 'block' },
): Record<string, unknown> {
  const elementId = `${blockId}-element-1`;
  return {
    id: blockId,
    type,
    value: [
      {
        id: elementId,
        type: elementType,
        children,
        props,
      },
    ],
    meta: { order, depth: 0 },
  };
}

function listItemToYoopta(item: ListItem, style: 'bulleted' | 'numbered' | 'todo', fallbackId: string): Record<string, unknown> {
  const nestedChildren = item.items?.map((child, index) => listItemToYoopta(child, style, `${fallbackId}-child-${index + 1}`)) ?? [];
  return {
    id: item.id ?? fallbackId,
    type: 'list-item',
    children: [...canonicalInlineChildrenToYoopta(item.children, `${fallbackId}-text`), ...nestedChildren],
    props: trimUndefined({
      nodeType: 'block',
      checked: style === 'todo' ? item.checked ?? false : undefined,
    }),
  };
}

function calloutToneToTheme(tone: string | undefined): string | undefined {
  if (!tone) return undefined;
  return tone === 'note' ? 'info' : tone;
}

function themeToCalloutTone(value: unknown): CalloutTone | undefined {
  if (value === 'info' || value === 'warning' || value === 'success' || value === 'danger' || value === 'note') {
    return value;
  }

  return undefined;
}

export function yooptaToDocContent(value: unknown): DocContentV1 {
  assertValidYooptaContentValue(value);

  const entries = isRecord(value) ? Object.values(value).filter(isRecord).sort((left, right) => getBlockOrder(left) - getBlockOrder(right)) : [];
  const blocks = entries
    .map((block, index) => yooptaBlockToCanonical(block, index))
    .filter((block): block is DocBlock => block !== null);

  const content: DocContentV1 = {
    version: 1,
    blocks,
  };

  assertValidDocContentV1(content);
  return content;
}

export function docContentToYoopta(content: DocContentV1): Record<string, unknown> {
  assertValidDocContentV1(content);

  const next: Record<string, unknown> = {};

  content.blocks.forEach((block, index) => {
    const blockId = block.id ?? `block-${index + 1}`;

    switch (block.type) {
      case 'paragraph':
        next[blockId] = createYooptaBlock(
          blockId,
          'Paragraph',
          'paragraph',
          canonicalInlineChildrenToYoopta(block.children, blockId),
          index,
        );
        break;
      case 'heading':
        next[blockId] = createYooptaBlock(
          blockId,
          block.level === 1 ? 'HeadingOne' : block.level === 2 ? 'HeadingTwo' : 'HeadingThree',
          block.level === 1 ? 'h1' : block.level === 2 ? 'h2' : 'h3',
          canonicalInlineChildrenToYoopta(block.children, blockId),
          index,
        );
        break;
      case 'list':
        next[blockId] = createYooptaBlock(
          blockId,
          block.style === 'bulleted' ? 'BulletedList' : block.style === 'numbered' ? 'NumberedList' : 'TodoList',
          block.style === 'bulleted' ? 'bulleted-list' : block.style === 'numbered' ? 'numbered-list' : 'todo-list',
          block.items.map((item, itemIndex) => listItemToYoopta(item, block.style, `${blockId}-item-${itemIndex + 1}`)),
          index,
        );
        break;
      case 'blockquote':
        next[blockId] = createYooptaBlock(
          blockId,
          'Blockquote',
          'blockquote',
          canonicalInlineChildrenToYoopta(block.children, blockId),
          index,
        );
        break;
      case 'callout':
        next[blockId] = createYooptaBlock(
          blockId,
          'Callout',
          'callout',
          canonicalInlineChildrenToYoopta(block.children, blockId),
          index,
          trimUndefined({
            nodeType: 'block',
            theme: calloutToneToTheme(block.tone),
            title: block.title,
          }),
        );
        break;
      case 'codeBlock':
        next[blockId] = createYooptaBlock(
          blockId,
          'Code',
          'code',
          [{ text: block.code }],
          index,
          trimUndefined({
            nodeType: 'void',
            language: block.language,
            title: block.title,
          }),
        );
        break;
      case 'codeGroup':
        next[blockId] = createYooptaBlock(
          blockId,
          'CodeGroup',
          'code-group',
          block.items.map((item, itemIndex) => ({
            id: item.id ?? `${blockId}-snippet-${itemIndex + 1}`,
            type: 'code-snippet',
            children: [{ text: item.code }],
            props: trimUndefined({
              nodeType: 'void',
              language: item.language,
              title: item.title,
            }),
          })),
          index,
        );
        break;
      case 'table':
        next[blockId] = createYooptaBlock(
          blockId,
          'Table',
          'table',
          block.rows.map((row, rowIndex) => ({
            id: row.id ?? `${blockId}-row-${rowIndex + 1}`,
            type: 'table-row',
            children: row.cells.map((cell, cellIndex) => ({
              id: cell.id ?? `${blockId}-cell-${rowIndex + 1}-${cellIndex + 1}`,
              type: cell.header ? 'table-header-cell' : 'table-data-cell',
              children: canonicalInlineChildrenToYoopta(cell.children, `${blockId}-cell-${rowIndex + 1}-${cellIndex + 1}`),
              props: { nodeType: 'block' },
            })),
            props: { nodeType: 'block' },
          })),
          index,
        );
        break;
      case 'image':
        next[blockId] = createYooptaBlock(
          blockId,
          'Image',
          'image',
          canonicalInlineChildrenToYoopta(block.caption ?? [], blockId),
          index,
          trimUndefined({
            nodeType: 'void',
            src: block.src,
            alt: block.alt,
            title: block.title,
            width: block.width,
            height: block.height,
          }),
        );
        break;
      case 'divider':
        next[blockId] = createYooptaBlock(blockId, 'Divider', 'divider', [{ text: '' }], index);
        break;
      case 'mermaid':
        next[blockId] = createYooptaBlock(
          blockId,
          'Mermaid',
          'mermaid',
          [{ text: block.code }],
          index,
          trimUndefined({
            nodeType: 'block',
            code: block.code,
            title: block.title,
          }),
        );
        break;
    }
  });

  assertValidYooptaContentValue(next);
  return next;
}
