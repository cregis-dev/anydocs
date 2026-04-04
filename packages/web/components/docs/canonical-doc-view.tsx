'use client';

import type { ReactNode } from 'react';
import type { CalloutTone, DocBlock, DocContentV1, InlineNode, ListItem, TextMark, TextNode } from '@anydocs/core';

import { DOC_READER_ROOT_CLASSNAME } from '@/components/docs/doc-reader-classnames';
import { MermaidViewer } from '@/components/studio/plugins/mermaid/mermaid-viewer';
import { createHeadingIdGenerator } from '@/lib/docs/markdown';
import { cn } from '@/lib/utils';

const DOC_ROOT_CLASSNAME = `docs-canonical-view ${DOC_READER_ROOT_CLASSNAME}`;

function applyMarks(text: ReactNode, marks: TextMark[] | undefined): ReactNode {
  if (!marks || marks.length === 0) {
    return text;
  }

  return marks.reduce<ReactNode>((current, mark) => {
    switch (mark) {
      case 'bold':
        return <strong>{current}</strong>;
      case 'italic':
        return <em>{current}</em>;
      case 'underline':
        return <u>{current}</u>;
      case 'strike':
        return <s>{current}</s>;
      case 'code':
        return <code>{current}</code>;
      default:
        return current;
    }
  }, text);
}

function renderTextNode(node: TextNode, key: string): ReactNode {
  return <span key={key}>{applyMarks(node.text, node.marks)}</span>;
}

function renderInline(nodes: InlineNode[], keyPrefix: string): ReactNode[] {
  return nodes.map((node, index) => {
    const key = `${keyPrefix}-${index + 1}`;
    if (node.type === 'text') {
      return renderTextNode(node, key);
    }

    return (
      <a key={key} href={node.href} title={node.title}>
        {node.children.map((child, childIndex) => renderTextNode(child, `${key}-${childIndex + 1}`))}
      </a>
    );
  });
}

function renderListItems(items: ListItem[], style: 'bulleted' | 'numbered' | 'todo', keyPrefix: string): ReactNode {
  const ListTag = style === 'numbered' ? 'ol' : 'ul';

  return (
    <ListTag>
      {items.map((item, index) => (
        <li key={item.id ?? `${keyPrefix}-${index + 1}`} className={style === 'todo' ? 'list-none' : undefined}>
          {style === 'todo' ? (
            <span className="inline-flex items-start gap-3">
              <span
                aria-hidden="true"
                className={cn(
                  'mt-[6px] inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] font-semibold',
                  item.checked
                    ? 'border-fd-foreground bg-fd-foreground text-fd-background'
                    : 'border-fd-border bg-transparent text-transparent',
                )}
              >
                ✓
              </span>
              <span>{renderInline(item.children, `${keyPrefix}-${index + 1}`)}</span>
            </span>
          ) : (
            renderInline(item.children, `${keyPrefix}-${index + 1}`)
          )}
          {item.items && item.items.length > 0 ? renderListItems(item.items, style, `${keyPrefix}-${index + 1}-nested`) : null}
        </li>
      ))}
    </ListTag>
  );
}

function calloutToneClasses(tone: CalloutTone | undefined) {
  switch (tone) {
    case 'warning':
      return 'border-amber-200 bg-amber-50/80 text-amber-950';
    case 'success':
      return 'border-emerald-200 bg-emerald-50/80 text-emerald-950';
    case 'danger':
      return 'border-rose-200 bg-rose-50/80 text-rose-950';
    case 'note':
    case 'info':
    default:
      return 'border-fd-border bg-fd-muted/50 text-[color:var(--docs-body-copy,var(--fd-foreground))]';
  }
}

function renderBlock(block: DocBlock, nextHeadingId: (title: string) => string, index: number): ReactNode {
  const key = block.id ?? `block-${index + 1}`;

  switch (block.type) {
    case 'paragraph':
      return <p key={key}>{renderInline(block.children, key)}</p>;
    case 'heading': {
      const title = block.children
        .map((node) => (node.type === 'text' ? node.text : node.children.map((child) => child.text).join('')))
        .join('')
        .trim();
      const id = nextHeadingId(title);
      if (block.level === 1) return <h1 key={key} id={id}>{renderInline(block.children, key)}</h1>;
      if (block.level === 2) return <h2 key={key} id={id}>{renderInline(block.children, key)}</h2>;
      return <h3 key={key} id={id}>{renderInline(block.children, key)}</h3>;
    }
    case 'list':
      return <div key={key}>{renderListItems(block.items, block.style, key)}</div>;
    case 'codeBlock':
      return (
        <div key={key} data-doc-code-block>
          {block.title ? (
            <div className="mb-2 text-sm font-medium text-fd-foreground" data-doc-code-title>
              {block.title}
            </div>
          ) : null}
          <pre>
            <code className={block.language ? `language-${block.language}` : undefined}>{block.code}</code>
          </pre>
        </div>
      );
    case 'codeGroup':
      return (
        <div key={key} className="my-6 space-y-4" data-doc-code-group>
          {block.items.map((item, itemIndex) => (
            <section key={item.id ?? `${key}-item-${itemIndex + 1}`} data-doc-code-panel>
              {item.title ? (
                <div className="mb-2 text-sm font-medium text-fd-foreground" data-doc-code-title>
                  {item.title}
                </div>
              ) : null}
              <pre>
                <code className={item.language ? `language-${item.language}` : undefined}>{item.code}</code>
              </pre>
            </section>
          ))}
        </div>
      );
    case 'blockquote':
      return <blockquote key={key}>{renderInline(block.children, key)}</blockquote>;
    case 'callout':
      return (
        <div
          key={key}
          className={cn('my-6 rounded-2xl border px-4 py-4 shadow-sm', calloutToneClasses(block.tone))}
          data-doc-callout
        >
          {block.title ? (
            <div className="mb-2 text-sm font-semibold text-fd-foreground" data-doc-callout-title>
              {block.title}
            </div>
          ) : null}
          <div className="text-[15px] leading-7" data-doc-callout-body>
            {renderInline(block.children, key)}
          </div>
        </div>
      );
    case 'table':
      return (
        <table key={key}>
          <tbody>
            {block.rows.map((row, rowIndex) => (
              <tr key={row.id ?? `${key}-row-${rowIndex + 1}`}>
                {row.cells.map((cell, cellIndex) =>
                  cell.header ? (
                    <th key={cell.id ?? `${key}-cell-${rowIndex + 1}-${cellIndex + 1}`}>
                      {renderInline(cell.children, `${key}-cell-${rowIndex + 1}-${cellIndex + 1}`)}
                    </th>
                  ) : (
                    <td key={cell.id ?? `${key}-cell-${rowIndex + 1}-${cellIndex + 1}`}>
                      {renderInline(cell.children, `${key}-cell-${rowIndex + 1}-${cellIndex + 1}`)}
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      );
    case 'image':
      return (
        <figure key={key} className="my-6 space-y-3">
          <img src={block.src} alt={block.alt ?? ''} title={block.title} width={block.width} height={block.height} />
          {block.caption && block.caption.length > 0 ? (
            <figcaption className="text-sm leading-6 text-[color:var(--docs-body-copy-subtle,var(--fd-muted-foreground))]">
              {renderInline(block.caption, `${key}-caption`)}
            </figcaption>
          ) : null}
        </figure>
      );
    case 'divider':
      return <hr key={key} />;
    case 'mermaid':
      return (
        <section key={key} className="my-6">
          {block.title ? <div className="mb-2 text-sm font-medium text-fd-foreground">{block.title}</div> : null}
          <MermaidViewer code={block.code} />
        </section>
      );
    default:
      return null;
  }
}

export function CanonicalDocView({
  content,
  className,
}: {
  content: DocContentV1;
  className?: string;
}) {
  const nextHeadingId = createHeadingIdGenerator();

  return (
    <div className={cn(DOC_ROOT_CLASSNAME, className)}>
      {content.blocks.map((block, index) => renderBlock(block, nextHeadingId, index))}
    </div>
  );
}
