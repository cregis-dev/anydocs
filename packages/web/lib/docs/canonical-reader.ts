import type { DocContentV1, InlineNode } from '@anydocs/core';
import { normalizeDocContent, validateDocContentV1, yooptaToDocContent } from '@anydocs/core';

import { createHeadingIdGenerator, type TocItem } from './markdown.ts';
import { getRenderableLegacyYooptaContent } from './legacy-yoopta-reader.ts';

function inlineText(nodes: InlineNode[]): string {
  return nodes
    .map((node) => {
      if (node.type === 'text') {
        return node.text;
      }

      return inlineText(node.children);
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

export function getRenderableDocContent(content: unknown, title: string): DocContentV1 | null {
  const canonical = validateDocContentV1(content);
  let nextContent: DocContentV1 | null = canonical.ok ? (content as DocContentV1) : null;

  // Legacy Yoopta pages are still in circulation; normalize to canonical so
  // reader rendering can avoid Slate-specific DOM/layout quirks.
  if (!nextContent) {
    const legacyContent = getRenderableLegacyYooptaContent(content, title);
    if (!legacyContent) {
      return null;
    }

    try {
      nextContent = normalizeDocContent(yooptaToDocContent(legacyContent));
    } catch {
      return null;
    }
  }

  const normalizedTitle = title.trim();
  const blocks = [...nextContent.blocks];
  const [firstBlock] = blocks;

  if (
    firstBlock?.type === 'heading' &&
    firstBlock.level === 1 &&
    inlineText(firstBlock.children) === normalizedTitle
  ) {
    blocks.shift();
  }

  if (blocks.length === 0) {
    return null;
  }

  return {
    version: 1,
    blocks,
  };
}

export function extractTocFromDocContent(content: DocContentV1 | null): TocItem[] {
  if (!content) {
    return [];
  }

  const nextHeadingId = createHeadingIdGenerator();

  return content.blocks
    .filter(
      (block): block is Extract<DocContentV1['blocks'][number], { type: 'heading' }> =>
        block.type === 'heading' && block.level >= 2 && block.level <= 3,
    )
    .map((block) => {
      const title = inlineText(block.children).replace(/`/g, '').trim();
      return {
        depth: block.level,
        title,
        id: nextHeadingId(title),
      };
    })
    .filter((item) => item.title && item.id);
}
