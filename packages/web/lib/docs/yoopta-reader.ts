import type { YooptaContentValue } from '@yoopta/editor';

import type { TocItem } from './markdown.ts';
import { slugify } from './markdown.ts';
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

export function getRenderableYooptaContent(content: unknown, title: string): YooptaContentValue | null {
  const validation = validateYooptaContentValue(content);
  if (!validation.ok || !isRecord(content)) {
    return null;
  }

  if (hasLegacyMarkupInRenderableBlocks(content)) {
    return null;
  }

  const entries = Object.entries(content);
  if (entries.length === 0) {
    return null;
  }

  const orderedEntries = [...entries].sort((a, b) => getBlockOrder(a[1]) - getBlockOrder(b[1]));
  const [firstKey, firstBlock] = orderedEntries[0] ?? [];

  if (!firstKey || !isRecord(firstBlock) || firstBlock.type !== 'HeadingOne') {
    return content as YooptaContentValue;
  }

  const firstText = normalizeWhitespace(extractText(firstBlock.value));
  if (firstText !== normalizeWhitespace(title)) {
    return content as YooptaContentValue;
  }

  const nextEntries = entries.filter(([key]) => key !== firstKey);
  return Object.fromEntries(nextEntries) as YooptaContentValue;
}

export function extractTocFromYooptaContent(content: unknown): TocItem[] {
  const validation = validateYooptaContentValue(content);
  if (!validation.ok || !isRecord(content)) {
    return [];
  }

  return Object.values(content)
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

      return [{ depth, title, id: slugify(title) }];
    });
}
