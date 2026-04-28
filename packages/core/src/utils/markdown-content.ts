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
          children: parseInlineMarkdown(text),
          props: { nodeType: 'block' },
        },
      ],
      meta: { order, depth: 0 },
    },
  };
}

function toYooptaBlockquoteBlock(blockId: string, elementId: string, text: string, order: number) {
  return {
    [blockId]: {
      id: blockId,
      type: 'Blockquote',
      value: [
        {
          id: elementId,
          type: 'blockquote',
          children: parseInlineMarkdown(text),
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
          children: parseInlineMarkdown(text),
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
  items: MarkdownParsedListItem[],
  blockType: 'BulletedList' | 'NumberedList' | 'TodoList',
  elementType: 'bulleted-list' | 'numbered-list' | 'todo-list',
  order: number,
) {
  const toYooptaListItems = (entries: MarkdownParsedListItem[], prefix: string): Array<Record<string, unknown>> =>
    entries.map((item, index) => ({
      id: `${prefix}-item-${index + 1}`,
      type: 'list-item',
      children: [
        ...parseInlineMarkdown(item.text),
        ...toYooptaListItems(item.items ?? [], `${prefix}-item-${index + 1}`),
      ],
      props: {
        nodeType: 'block',
        ...(item.checked == null ? {} : { checked: item.checked }),
      },
    }));

  return {
    [blockId]: {
      id: blockId,
      type: blockType,
      value: [
        {
          id: elementId,
          type: elementType,
          children: toYooptaListItems(items, elementId),
          props: { nodeType: 'block' },
        },
      ],
      meta: { order, depth: 0 },
    },
  };
}

function toYooptaCodeBlock(
  blockId: string,
  elementId: string,
  code: string,
  order: number,
  language?: string,
) {
  return {
    [blockId]: {
      id: blockId,
      type: 'Code',
      value: [
        {
          id: elementId,
          type: 'code',
          children: [{ text: code }],
          props: {
            nodeType: 'void',
            ...(language ? { language } : {}),
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
              type: 'table-data-cell',
              children: parseInlineMarkdown(cell),
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

// Parses inline Markdown tokens into Yoopta leaf/link nodes.
// Handles: `code`, **bold**, *italic*, [text](url). Nested bold+link not supported.
function parseInlineMarkdown(text: string): Array<Record<string, unknown>> {
  const TOKEN_RE = /(`[^`\n]+`|\*\*[^*\n]+\*\*|\*[^*\n]+\*|\[[^\]\n]+\]\([^)\n]+\))/g;
  const nodes: Array<Record<string, unknown>> = [];
  let lastIndex = 0;

  for (const match of text.matchAll(TOKEN_RE)) {
    const before = text.slice(lastIndex, match.index);
    if (before) {
      nodes.push({ text: before });
    }

    const token = match[0]!;
    if (token.startsWith('`')) {
      nodes.push({ text: token.slice(1, -1), code: true });
    } else if (token.startsWith('**')) {
      nodes.push({ text: token.slice(2, -2), bold: true });
    } else if (token.startsWith('*')) {
      nodes.push({ text: token.slice(1, -1), italic: true });
    } else {
      const linkMatch = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token);
      if (linkMatch) {
        nodes.push({ type: 'link', props: { href: linkMatch[2] }, children: [{ text: linkMatch[1] }] });
      } else {
        nodes.push({ text: token });
      }
    }

    lastIndex = (match.index ?? 0) + token.length;
  }

  const tail = text.slice(lastIndex);
  if (tail) {
    nodes.push({ text: tail });
  }

  return nodes.length > 0 ? nodes : [{ text }];
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

function toYooptaDividerBlock(blockId: string, elementId: string, order: number) {
  return {
    [blockId]: {
      id: blockId,
      type: 'Divider',
      value: [
        {
          id: elementId,
          type: 'divider',
          children: [{ text: '' }],
          props: { nodeType: 'void' },
        },
      ],
      meta: { order, depth: 0 },
    },
  };
}

function normalizeMarkdownBlockquoteText(lines: string[]): string {
  return lines
    .map((line) => line.replace(/^\s*>\s?/, '').trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

type MarkdownListStyle = 'bulleted' | 'numbered' | 'todo';

type MarkdownListItem = {
  indent: number;
  style: MarkdownListStyle;
  text: string;
  checked?: boolean;
};

type MarkdownParsedListItem = {
  text: string;
  checked?: boolean;
  items?: MarkdownParsedListItem[];
};

function getMarkdownIndentWidth(value: string): number {
  let width = 0;
  for (const char of value) {
    width += char === '\t' ? 4 : 1;
  }
  return width;
}

function parseMarkdownListItem(line: string): MarkdownListItem | null {
  const indent = getMarkdownIndentWidth((/^\s*/.exec(line)?.[0] ?? ''));
  const todoMatch = /^\s*[-*+]\s+\[( |x|X)\]\s+(.+)$/.exec(line);
  if (todoMatch) {
    const text = todoMatch[2]?.trim() ?? '';
    if (!text) {
      return null;
    }

    return {
      indent,
      style: 'todo',
      text,
      checked: todoMatch[1]?.toLowerCase() === 'x',
    };
  }

  const bulletMatch = /^\s*[-*+]\s+(.+)$/.exec(line);
  if (bulletMatch) {
    const text = bulletMatch[1]?.trim() ?? '';
    if (!text) {
      return null;
    }

    return {
      indent,
      style: 'bulleted',
      text,
    };
  }

  const numberedMatch = /^\s*\d+\.\s+(.+)$/.exec(line);
  if (numberedMatch) {
    const text = numberedMatch[1]?.trim() ?? '';
    if (!text) {
      return null;
    }

    return {
      indent,
      style: 'numbered',
      text,
    };
  }

  return null;
}

function parseMarkdownListSequence(
  lines: string[],
  startIndex: number,
  style: MarkdownListStyle,
  indent: number,
): { items: MarkdownParsedListItem[]; nextLineIndex: number } {
  const items: MarkdownParsedListItem[] = [];
  let index = startIndex;

  while (index < lines.length) {
    const line = lines[index] ?? '';
    if (!line.trim()) {
      break;
    }

    const item = parseMarkdownListItem(line);
    if (!item) {
      break;
    }

    if (item.indent < indent || item.style !== style) {
      break;
    }

    if (item.indent > indent) {
      if (items.length === 0) {
        break;
      }

      const nested = parseMarkdownListSequence(lines, index, style, item.indent);
      items[items.length - 1] = {
        ...items[items.length - 1],
        items: nested.items,
      };
      index = nested.nextLineIndex;
      continue;
    }

    items.push({
      text: item.text,
      checked: item.checked,
    });
    index += 1;
  }

  return { items, nextLineIndex: index };
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

    const codeFenceMatch = /^```([^`]*)$/.exec(trimmedLine);
    if (codeFenceMatch) {
      flushParagraph();
      const language = codeFenceMatch[1]?.trim() || undefined;
      const codeLines: string[] = [];
      lineIndex += 1;

      while (lineIndex < lines.length) {
        const codeLine = lines[lineIndex] ?? '';
        if (codeLine.trim() === '```') {
          break;
        }

        codeLines.push(codeLine);
        lineIndex += 1;
      }

      pushBlock(
        toYooptaCodeBlock(
          `block-${nextIndex}`,
          `element-${nextIndex}`,
          codeLines.join('\n'),
          blockOrder,
          language,
        ),
      );
      continue;
    }

    if (/^\s*>/.test(line)) {
      flushParagraph();
      const quoteLines = [line];
      while (lineIndex + 1 < lines.length && /^\s*>/.test(lines[lineIndex + 1] ?? '')) {
        lineIndex += 1;
        quoteLines.push(lines[lineIndex] ?? '');
      }

      const quoteText = normalizeMarkdownBlockquoteText(quoteLines);
      if (quoteText) {
        pushBlock(toYooptaBlockquoteBlock(`block-${nextIndex}`, `element-${nextIndex}`, quoteText, blockOrder));
      }
      continue;
    }

    const listItem = parseMarkdownListItem(line);
    if (listItem) {
      flushParagraph();
      const parsed = parseMarkdownListSequence(lines, lineIndex, listItem.style, listItem.indent);

      pushBlock(
        toYooptaListBlock(
          `block-${nextIndex}`,
          `element-${nextIndex}`,
          parsed.items,
          listItem.style === 'bulleted' ? 'BulletedList' : listItem.style === 'numbered' ? 'NumberedList' : 'TodoList',
          listItem.style === 'bulleted' ? 'bulleted-list' : listItem.style === 'numbered' ? 'numbered-list' : 'todo-list',
          blockOrder,
        ),
      );
      lineIndex = parsed.nextLineIndex - 1;
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

    if (/^[-*_]{3,}\s*$/.test(trimmedLine)) {
      flushParagraph();
      pushBlock(toYooptaDividerBlock(`block-${nextIndex}`, `element-${nextIndex}`, blockOrder));
      continue;
    }

    paragraphLines.push(trimmedLine);
  }

  flushParagraph();
  return content;
}
