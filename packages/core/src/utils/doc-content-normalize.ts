import type { DocBlock, DocContentV1 } from '../types/content.ts';
import { assertValidDocContentV1 } from './content-schema.ts';

function cloneBlock<T extends DocBlock>(block: T): T {
  return {
    ...block,
    ...(block.type === 'list' ? { items: block.items.map((item) => ({ ...item, ...(item.items ? { items: item.items } : {}) })) } : {}),
  } as T;
}

export function normalizeDocContent(content: DocContentV1): DocContentV1 {
  assertValidDocContentV1(content);

  const blocks: DocBlock[] = [];

  for (const block of content.blocks) {
    const current = cloneBlock(block);
    const previous = blocks[blocks.length - 1];

    if (previous?.type === 'list' && current.type === 'list' && previous.style === current.style) {
      previous.items.push(...current.items);
      continue;
    }

    blocks.push(current);
  }

  return {
    version: 1,
    blocks,
  };
}
