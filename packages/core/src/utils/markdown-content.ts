function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toYooptaParagraphBlock(blockId: string, elementId: string, text: string, order: number) {
  return {
    [blockId]: {
      id: blockId,
      type: 'Paragraph',
      value: [
        {
          id: elementId,
          type: 'paragraph',
          children: [{ text }],
          props: { nodeType: 'block' },
        },
      ],
      meta: { order, depth: 0 },
    },
  };
}

function toYooptaHeadingBlock(
  blockId: string,
  elementId: string,
  text: string,
  headingType: 'HeadingOne' | 'HeadingTwo' | 'HeadingThree',
  elementType: 'h1' | 'h2' | 'h3',
  order: number,
) {
  return {
    [blockId]: {
      id: blockId,
      type: headingType,
      value: [
        {
          id: elementId,
          type: elementType,
          children: [{ text }],
          props: { nodeType: 'block' },
        },
      ],
      meta: { order, depth: 0 },
    },
  };
}

function toYooptaListBlock(
  blockId: string,
  elementId: string,
  text: string,
  blockType: 'BulletedList' | 'NumberedList' | 'TodoList',
  elementType: 'bulleted-list' | 'numbered-list' | 'todo-list',
  order: number,
  checked?: boolean,
) {
  return {
    [blockId]: {
      id: blockId,
      type: blockType,
      value: [
        {
          id: elementId,
          type: elementType,
          children: [{ text }],
          props: {
            nodeType: 'block',
            ...(checked == null ? {} : { checked }),
          },
        },
      ],
      meta: { order, depth: 0 },
    },
  };
}

function toYooptaTableBlock(blockId: string, elementId: string, rows: string[][], order: number) {
  return {
    [blockId]: {
      id: blockId,
      type: 'Table',
      value: [
        {
          id: elementId,
          type: 'table',
          children: rows.map((row, rowIndex) => ({
            id: `${elementId}-row-${rowIndex + 1}`,
            type: 'table-row',
            children: row.map((cell, cellIndex) => ({
              id: `${elementId}-cell-${rowIndex + 1}-${cellIndex + 1}`,
              type: 'table-cell',
              children: [{ text: cell }],
              props: { nodeType: 'block' },
            })),
            props: { nodeType: 'block' },
          })),
          props: { nodeType: 'block' },
        },
      ],
      meta: { order, depth: 0 },
    },
  };
}

function normalizeMarkdownParagraphText(lines: string[]): string {
  return lines.join(' ').replace(/\s+/g, ' ').trim();
}

function splitMarkdownTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

function isMarkdownTableRow(line: string): boolean {
  return /^\s*\|.*\|\s*$/.test(line.trim());
}

function isMarkdownTableSeparator(line: string): boolean {
  if (!isMarkdownTableRow(line)) {
    return false;
  }

  return splitMarkdownTableRow(line).every((cell) => /^:?-{3,}:?$/.test(cell));
}

export function stripMarkdownToPlainText(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/[#>*_~]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function createMarkdownYooptaContent(markdown: string): Record<string, unknown> {
  const trimmed = markdown.trim();
  if (!trimmed) {
    return toYooptaParagraphBlock('block-1', 'element-1', '', 0);
  }

  const lines = trimmed.replace(/\r\n/g, '\n').split('\n');
  const content: Record<string, unknown> = {};
  let blockOrder = 0;
  let nextIndex = 1;
  let paragraphLines: string[] = [];

  const pushBlock = (block: Record<string, unknown>) => {
    Object.assign(content, block);
    blockOrder += 1;
    nextIndex += 1;
  };

  const flushParagraph = () => {
    const text = normalizeMarkdownParagraphText(paragraphLines);
    paragraphLines = [];
    if (!text) {
      return;
    }

    pushBlock(toYooptaParagraphBlock(`block-${nextIndex}`, `element-${nextIndex}`, text, blockOrder));
  };

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex] ?? '';
    const trimmedLine = line.trim();

    if (!trimmedLine) {
      flushParagraph();
      continue;
    }

    const headingMatch = /^(#{1,3})\s+(.+)$/.exec(line);
    if (headingMatch) {
      flushParagraph();
      const headingLevel = headingMatch[1]?.length ?? 0;
      const headingText = headingMatch[2]?.trim() ?? '';
      if (!headingText) {
        continue;
      }

      if (headingLevel === 1) {
        pushBlock(toYooptaHeadingBlock(`block-${nextIndex}`, `element-${nextIndex}`, headingText, 'HeadingOne', 'h1', blockOrder));
      } else if (headingLevel === 2) {
        pushBlock(toYooptaHeadingBlock(`block-${nextIndex}`, `element-${nextIndex}`, headingText, 'HeadingTwo', 'h2', blockOrder));
      } else {
        pushBlock(toYooptaHeadingBlock(`block-${nextIndex}`, `element-${nextIndex}`, headingText, 'HeadingThree', 'h3', blockOrder));
      }
      continue;
    }

    const todoMatch = /^\s*[-*+]\s+\[( |x|X)\]\s+(.+)$/.exec(line);
    if (todoMatch) {
      flushParagraph();
      const checked = todoMatch[1]?.toLowerCase() === 'x';
      const todoText = todoMatch[2]?.trim() ?? '';
      if (todoText) {
        pushBlock(
          toYooptaListBlock(`block-${nextIndex}`, `element-${nextIndex}`, todoText, 'TodoList', 'todo-list', blockOrder, checked),
        );
      }
      continue;
    }

    const bulletMatch = /^\s*[-*+]\s+(.+)$/.exec(line);
    if (bulletMatch) {
      flushParagraph();
      const bulletText = bulletMatch[1]?.trim() ?? '';
      if (bulletText) {
        pushBlock(
          toYooptaListBlock(`block-${nextIndex}`, `element-${nextIndex}`, bulletText, 'BulletedList', 'bulleted-list', blockOrder),
        );
      }
      continue;
    }

    const numberedMatch = /^\s*\d+\.\s+(.+)$/.exec(line);
    if (numberedMatch) {
      flushParagraph();
      const numberedText = numberedMatch[1]?.trim() ?? '';
      if (numberedText) {
        pushBlock(
          toYooptaListBlock(`block-${nextIndex}`, `element-${nextIndex}`, numberedText, 'NumberedList', 'numbered-list', blockOrder),
        );
      }
      continue;
    }

    if (isMarkdownTableRow(line) && lineIndex + 1 < lines.length && isMarkdownTableSeparator(lines[lineIndex + 1] ?? '')) {
      flushParagraph();

      const rows: string[][] = [splitMarkdownTableRow(line)];
      lineIndex += 2;

      while (lineIndex < lines.length) {
        const tableLine = lines[lineIndex] ?? '';
        if (!tableLine.trim()) {
          lineIndex -= 1;
          break;
        }
        if (!isMarkdownTableRow(tableLine) || isMarkdownTableSeparator(tableLine)) {
          lineIndex -= 1;
          break;
        }

        rows.push(splitMarkdownTableRow(tableLine));
        lineIndex += 1;
      }

      if (rows.length > 0) {
        pushBlock(toYooptaTableBlock(`block-${nextIndex}`, `element-${nextIndex}`, rows, blockOrder));
      }
      continue;
    }

    paragraphLines.push(trimmedLine);
  }

  flushParagraph();
  return content;
}
