import { assertValidYooptaContentValue } from './yoopta-content.ts';

type YooptaRenderResult = {
  markdown: string;
  plainText: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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

  if (Array.isArray(value.value)) {
    return value.value.map(extractText).join('');
  }

  if (Array.isArray(value.children)) {
    return value.children.map(extractText).join('');
  }

  return '';
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function getBlockOrder(value: unknown): number {
  if (!isRecord(value) || !isRecord(value.meta) || typeof value.meta.order !== 'number') {
    return Number.POSITIVE_INFINITY;
  }

  return value.meta.order;
}

function getFirstValueEntry(block: unknown): Record<string, unknown> | null {
  if (!isRecord(block) || !Array.isArray(block.value)) {
    return null;
  }

  const entry = block.value[0];
  return isRecord(entry) ? entry : null;
}

function getStringProp(value: unknown, key: string): string | undefined {
  if (!isRecord(value) || !isRecord(value.props) || typeof value.props[key] !== 'string') {
    return undefined;
  }

  return value.props[key] as string;
}

function getBooleanProp(value: unknown, key: string): boolean | undefined {
  if (!isRecord(value) || !isRecord(value.props) || typeof value.props[key] !== 'boolean') {
    return undefined;
  }

  return value.props[key] as boolean;
}

function renderCodeGroupMarkdown(blockEntry: Record<string, unknown>): string {
  if (!Array.isArray(blockEntry.children)) {
    return '```text\n\n```';
  }

  const rendered = blockEntry.children
    .filter(isRecord)
    .map((child) => {
      const title = getStringProp(child, 'title');
      const language = getStringProp(child, 'language') ?? '';
      const code = extractText(child.children ?? []).trim();
      const heading = title ? `#### ${title}\n\n` : '';
      return `${heading}\`\`\`${language}\n${code}\n\`\`\``;
    })
    .filter(Boolean);

  return rendered.join('\n\n');
}

function renderTableMarkdown(blockEntry: Record<string, unknown>): string {
  if (!Array.isArray(blockEntry.children)) {
    return '| |\n| --- |\n| |';
  }

  const rows = blockEntry.children
    .filter(isRecord)
    .map((row) =>
      Array.isArray(row.children)
        ? row.children
            .filter(isRecord)
            .map((cell) => normalizeWhitespace(extractText(cell.children ?? [])))
        : [],
    )
    .filter((cells) => cells.length > 0);

  if (rows.length === 0) {
    return '| |\n| --- |\n| |';
  }

  const header = rows[0]!;
  const separator = header.map(() => '---');
  const body = rows.slice(1);

  return [
    `| ${header.join(' | ')} |`,
    `| ${separator.join(' | ')} |`,
    ...body.map((row) => `| ${row.join(' | ')} |`),
  ].join('\n');
}

function renderBlockMarkdown(block: Record<string, unknown>): string {
  const type = typeof block.type === 'string' ? block.type : '';
  const valueEntry = getFirstValueEntry(block);
  const text = normalizeWhitespace(extractText(block.value));

  switch (type) {
    case 'HeadingOne':
      return text ? `# ${text}` : '#';
    case 'HeadingTwo':
      return text ? `## ${text}` : '##';
    case 'HeadingThree':
      return text ? `### ${text}` : '###';
    case 'BulletedList':
      return text ? `- ${text}` : '-';
    case 'NumberedList':
      return text ? `1. ${text}` : '1.';
    case 'TodoList': {
      const checked = getBooleanProp(valueEntry, 'checked') === true;
      return `- [${checked ? 'x' : ' '}] ${text}`;
    }
    case 'Blockquote':
    case 'Callout':
      return text ? `> ${text}` : '>';
    case 'Code': {
      const language = getStringProp(valueEntry, 'language') ?? '';
      const code = extractText(valueEntry?.children ?? []).trim();
      return `\`\`\`${language}\n${code}\n\`\`\``;
    }
    case 'CodeGroup':
      return valueEntry ? renderCodeGroupMarkdown(valueEntry) : '```text\n\n```';
    case 'Divider':
      return '---';
    case 'Image': {
      const src = getStringProp(valueEntry, 'src') ?? '';
      const alt = getStringProp(valueEntry, 'alt') ?? '';
      return `![${alt}](${src})`;
    }
    case 'Table':
      return valueEntry ? renderTableMarkdown(valueEntry) : '| |\n| --- |\n| |';
    case 'Link': {
      const href = getStringProp(valueEntry, 'href');
      return href ? `[${text}](${href})` : text;
    }
    case 'Paragraph':
    default:
      return text;
  }
}

export function renderYooptaContent(value: unknown): YooptaRenderResult {
  assertValidYooptaContentValue(value);

  if (!isRecord(value)) {
    return { markdown: '', plainText: '' };
  }

  const blocks = Object.values(value).filter(isRecord).sort((left, right) => getBlockOrder(left) - getBlockOrder(right));
  const markdownBlocks = blocks.map(renderBlockMarkdown).map((block) => block.trim()).filter(Boolean);
  const plainTextBlocks = blocks
    .map((block) => normalizeWhitespace(extractText(block.value)))
    .filter(Boolean);

  return {
    markdown: markdownBlocks.join('\n\n'),
    plainText: plainTextBlocks.join('\n\n'),
  };
}
