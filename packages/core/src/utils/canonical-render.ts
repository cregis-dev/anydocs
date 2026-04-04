import type {
  CalloutBlock,
  DocBlock,
  DocContentV1,
  InlineNode,
  ListBlock,
  ListItem,
  TextMark,
} from '../types/content.ts';
import type { PageRender } from '../types/docs.ts';

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function renderTextMarks(text: string, marks: TextMark[] | undefined): string {
  if (!marks || marks.length === 0) {
    return text;
  }

  return marks.reduce((current, mark) => {
    switch (mark) {
      case 'bold':
        return `**${current}**`;
      case 'italic':
        return `*${current}*`;
      case 'underline':
        return `<u>${current}</u>`;
      case 'strike':
        return `~~${current}~~`;
      case 'code':
        return `\`${current}\``;
      default:
        return current;
    }
  }, text);
}

function inlineToMarkdown(nodes: InlineNode[]): string {
  return nodes
    .map((node) => {
      if (node.type === 'text') {
        return renderTextMarks(node.text, node.marks);
      }

      const label = node.children.map((child) => renderTextMarks(child.text, child.marks)).join('');
      return `[${label}](${node.href})`;
    })
    .join('');
}

function inlineToPlainText(nodes: InlineNode[]): string {
  return collapseWhitespace(
    nodes
      .map((node) => {
        if (node.type === 'text') {
          return node.text;
        }

        return inlineToPlainText(node.children);
      })
      .join(''),
  );
}

function renderListItemMarkdown(item: ListItem, style: ListBlock['style'], index: number, depth: number): string {
  const indent = '  '.repeat(depth);
  const prefix =
    style === 'bulleted'
      ? '-'
      : style === 'numbered'
        ? `${index + 1}.`
        : `- [${item.checked ? 'x' : ' '}]`;
  const current = `${indent}${prefix} ${inlineToMarkdown(item.children)}`.trimEnd();
  const nested = item.items?.map((child, childIndex) => renderListItemMarkdown(child, style, childIndex, depth + 1)) ?? [];
  return [current, ...nested].filter(Boolean).join('\n');
}

function renderListMarkdown(block: ListBlock): string {
  return block.items.map((item, index) => renderListItemMarkdown(item, block.style, index, 0)).join('\n');
}

function renderListPlainText(items: ListItem[]): string {
  return items
    .flatMap((item) => [inlineToPlainText(item.children), ...(item.items ? [renderListPlainText(item.items)] : [])])
    .filter(Boolean)
    .join('\n');
}

function renderCalloutText(block: CalloutBlock): string {
  return [block.title?.trim(), inlineToPlainText(block.children)].filter(Boolean).join(': ');
}

function renderTableMarkdown(block: Extract<DocBlock, { type: 'table' }>): string {
  if (block.rows.length === 0) {
    return '| |\n| --- |\n| |';
  }

  const rows = block.rows.map((row) => row.cells.map((cell) => inlineToMarkdown(cell.children)));
  const header = rows[0] ?? [''];
  const separator = header.map(() => '---');
  const body = rows.slice(1);

  return [
    `| ${header.join(' | ')} |`,
    `| ${separator.join(' | ')} |`,
    ...body.map((row) => `| ${row.join(' | ')} |`),
  ].join('\n');
}

function renderTablePlainText(block: Extract<DocBlock, { type: 'table' }>): string {
  return block.rows
    .map((row) => row.cells.map((cell) => inlineToPlainText(cell.children)).join(' '))
    .filter(Boolean)
    .join('\n');
}

function renderBlockMarkdown(block: DocBlock): string {
  switch (block.type) {
    case 'paragraph':
      return inlineToMarkdown(block.children);
    case 'heading':
      return `${'#'.repeat(block.level)} ${inlineToMarkdown(block.children)}`.trim();
    case 'list':
      return renderListMarkdown(block);
    case 'codeBlock':
      return `\`\`\`${block.language ?? ''}\n${block.code}\n\`\`\``;
    case 'codeGroup':
      return block.items
        .map((item) => {
          const heading = item.title ? `#### ${item.title}\n\n` : '';
          return `${heading}\`\`\`${item.language ?? ''}\n${item.code}\n\`\`\``;
        })
        .join('\n\n');
    case 'blockquote':
      return inlineToPlainText(block.children)
        .split('\n')
        .filter(Boolean)
        .map((line) => `> ${line}`)
        .join('\n');
    case 'callout': {
      const text = renderCalloutText(block);
      return text ? `> ${text}` : '>';
    }
    case 'table':
      return renderTableMarkdown(block);
    case 'image':
      return `![${block.alt ?? ''}](${block.src})`;
    case 'divider':
      return '---';
    case 'mermaid':
      return `\`\`\`mermaid\n${block.code}\n\`\`\``;
    default:
      return '';
  }
}

function renderBlockPlainText(block: DocBlock): string {
  switch (block.type) {
    case 'paragraph':
    case 'heading':
    case 'blockquote':
      return inlineToPlainText(block.children);
    case 'list':
      return renderListPlainText(block.items);
    case 'codeBlock':
      return collapseWhitespace(block.code);
    case 'codeGroup':
      return block.items.map((item) => collapseWhitespace(item.code)).filter(Boolean).join('\n\n');
    case 'callout':
      return renderCalloutText(block);
    case 'table':
      return renderTablePlainText(block);
    case 'image':
      return [block.alt, block.title, block.caption ? inlineToPlainText(block.caption) : undefined]
        .filter(Boolean)
        .join(' ')
        .trim();
    case 'divider':
      return '';
    case 'mermaid':
      return collapseWhitespace(block.code);
    default:
      return '';
  }
}

export function renderDocContent(content: DocContentV1): PageRender {
  const markdown = content.blocks.map(renderBlockMarkdown).map((value) => value.trim()).filter(Boolean).join('\n\n');
  const plainText = content.blocks.map(renderBlockPlainText).map((value) => value.trim()).filter(Boolean).join('\n\n');
  return { markdown, plainText };
}
