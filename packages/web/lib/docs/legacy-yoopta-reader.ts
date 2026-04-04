import type { YooptaContentValue } from '@yoopta/editor';

import type { TocItem } from './markdown.ts';
import { createHeadingIdGenerator } from './markdown.ts';
import { validateYooptaContentValue } from './yoopta-content.ts';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function extractText(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(extractText).join('');
  }

  if (!isRecord(value)) {
    return '';
  }

  if (typeof value.text === 'string') {
    return value.text;
  }

  if (Array.isArray(value.children)) {
    return value.children.map(extractText).join('');
  }

  return Object.values(value).map(extractText).join('');
}

function getBlockOrder(value: unknown): number {
  if (!isRecord(value) || !isRecord(value.meta) || typeof value.meta.order !== 'number') {
    return Number.POSITIVE_INFINITY;
  }

  return value.meta.order;
}

function normalizeLegacyTableCells(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(normalizeLegacyTableCells);
  }

  if (!isRecord(value)) {
    return value;
  }

  const normalized: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    normalized[key] = normalizeLegacyTableCells(entry);
  }

  if (typeof normalized.type === 'string') {
    if (normalized.type === 'table-header-cell' || normalized.type === 'table-cell' || normalized.type === 'table-data-cell') {
      normalized.type = 'table-data-cell';
    }

    if (normalized.type === 'Code' && Array.isArray(normalized.value)) {
      const firstValue = normalized.value[0];
      if (isRecord(firstValue) && isRecord(firstValue.props) && firstValue.props.language === 'mermaid') {
        const mermaidCode = extractText(firstValue.children ?? []);
        normalized.type = 'Mermaid';
        normalized.value = [
          {
            ...firstValue,
            type: 'mermaid',
            children: [{ text: mermaidCode }],
            props: {
              ...firstValue.props,
              nodeType: 'block',
              code: mermaidCode,
            },
          },
        ];
      }
    }
  }

  return normalized;
}

function getHeadingDepth(type: unknown): number | null {
  if (type === 'HeadingTwo') return 2;
  if (type === 'HeadingThree') return 3;
  if (type === 'HeadingFour') return 4;
  return null;
}

function containsLegacyMarkupText(value: unknown): boolean {
  if (typeof value === 'string') {
    return /<\/?(?:p|img|CardGroup|Card|Info|Accordion|Tabs|Steps|Embed)\b/i.test(value);
  }

  if (Array.isArray(value)) {
    return value.some(containsLegacyMarkupText);
  }

  if (!isRecord(value)) {
    return false;
  }

  if (typeof value.text === 'string') {
    return containsLegacyMarkupText(value.text);
  }

  if (Array.isArray(value.children)) {
    return value.children.some(containsLegacyMarkupText);
  }

  return Object.values(value).some(containsLegacyMarkupText);
}

function hasLegacyMarkupInRenderableBlocks(content: Record<string, unknown>): boolean {
  return Object.values(content).some((block) => {
    if (!isRecord(block) || typeof block.type !== 'string') {
      return false;
    }

    if (block.type === 'Code' || block.type === 'CodeGroup') {
      return false;
    }

    return containsLegacyMarkupText(block.value);
  });
}

export function getRenderableLegacyYooptaContent(content: unknown, title: string): YooptaContentValue | null {
  // Reader only uses this for legacy Yoopta-backed pages after canonical parsing has failed.
  const validation = validateYooptaContentValue(content);
  const nextContent = validation.ok && isRecord(content) ? (content as YooptaContentValue) : null;

  if (!nextContent || !isRecord(nextContent)) {
    return null;
  }

  if (hasLegacyMarkupInRenderableBlocks(nextContent)) {
    return null;
  }

  const entries = Object.entries(nextContent);
  if (entries.length === 0) {
    return null;
  }

  const orderedEntries = [...entries].sort((a, b) => getBlockOrder(a[1]) - getBlockOrder(b[1]));
  const [firstKey, firstBlock] = orderedEntries[0] ?? [];
  const normalizedContent = normalizeLegacyTableCells(nextContent) as YooptaContentValue;

  if (!firstKey || !isRecord(firstBlock) || firstBlock.type !== 'HeadingOne') {
    return normalizedContent;
  }

  const firstText = normalizeWhitespace(extractText(firstBlock.value));
  if (firstText !== normalizeWhitespace(title)) {
    return normalizedContent;
  }

  const nextEntries = entries.filter(([key]) => key !== firstKey);
  return normalizeLegacyTableCells(Object.fromEntries(nextEntries)) as YooptaContentValue;
}

export function extractTocFromLegacyYooptaContent(content: unknown): TocItem[] {
  // TOC extraction stays available for legacy pages that still render through Yoopta.
  const validation = validateYooptaContentValue(content);
  const nextContent = validation.ok && isRecord(content) ? (content as YooptaContentValue) : null;

  if (!nextContent || !isRecord(nextContent)) {
    return [];
  }

  const nextHeadingId = createHeadingIdGenerator();

  return Object.values(nextContent)
    .sort((a, b) => getBlockOrder(a) - getBlockOrder(b))
    .flatMap((block) => {
      if (!isRecord(block)) {
        return [];
      }

      const depth = getHeadingDepth(block.type);
      if (!depth) {
        return [];
      }

      const title = normalizeWhitespace(extractText(block.value));
      if (!title) {
        return [];
      }

      return [{ depth, title, id: nextHeadingId(title) }];
    });
}
