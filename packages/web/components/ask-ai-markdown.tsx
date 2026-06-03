'use client';

import type { ComponentPropsWithoutRef } from 'react';
import { Children, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import {
  ASK_AI_MARKDOWN_TABLE_CELL_CLASSNAME,
  ASK_AI_MARKDOWN_TABLE_CLASSNAME,
  ASK_AI_MARKDOWN_TABLE_HEAD_CLASSNAME,
  ASK_AI_MARKDOWN_TABLE_HEADER_CELL_CLASSNAME,
  ASK_AI_MARKDOWN_TABLE_ROW_CLASSNAME,
  ASK_AI_MARKDOWN_TABLE_WRAPPER_CLASSNAME,
} from '@/components/ask-ai-markdown-styles';
import { cn } from '@/lib/utils';

function MarkdownLink({
  className,
  href,
  ...props
}: ComponentPropsWithoutRef<'a'>) {
  const isExternal = typeof href === 'string' && /^https?:\/\//i.test(href);

  return (
    <a
      className={cn('font-medium underline underline-offset-4', className)}
      href={href}
      rel={isExternal ? 'noreferrer' : undefined}
      target={isExternal ? '_blank' : undefined}
      {...props}
    />
  );
}

function splitInlineMarkers(text: string): ReactNode {
  const parts: ReactNode[] = [];
  const markerPattern = /\[cit_(\d+)\]|<br\s*\/?>|&lt;br\s*\/?&gt;/gi;
  let lastIndex = 0;

  for (const match of text.matchAll(markerPattern)) {
    if (match.index === undefined) continue;
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    if (match[1]) {
      parts.push(
        <sup
          key={`${match[0]}-${match.index}`}
          className="mx-0.5 inline-flex min-w-5 translate-y-[-0.08em] items-center justify-center rounded-md bg-[color:var(--atlas-primary,var(--fd-primary))]/10 px-1.5 py-0.5 text-[11px] font-semibold leading-none text-[color:var(--atlas-primary,var(--fd-primary))]"
        >
          {match[1]}
        </sup>,
      );
    } else {
      parts.push(<br key={`${match[0]}-${match.index}`} />);
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : text;
}

function renderCitationMarkers(children: ReactNode): ReactNode {
  return Children.map(children, (child) =>
    typeof child === 'string' ? splitInlineMarkers(child) : child,
  );
}

function MarkdownParagraph({ children, ...props }: ComponentPropsWithoutRef<'p'>) {
  return <p {...props}>{renderCitationMarkers(children)}</p>;
}

function MarkdownListItem({ children, ...props }: ComponentPropsWithoutRef<'li'>) {
  return <li {...props}>{renderCitationMarkers(children)}</li>;
}

function MarkdownTable({ children, className, ...props }: ComponentPropsWithoutRef<'table'>) {
  return (
    <div className={ASK_AI_MARKDOWN_TABLE_WRAPPER_CLASSNAME}>
      <table className={cn(ASK_AI_MARKDOWN_TABLE_CLASSNAME, className)} {...props}>
        {children}
      </table>
    </div>
  );
}

function MarkdownTableHead({ className, ...props }: ComponentPropsWithoutRef<'thead'>) {
  return <thead className={cn(ASK_AI_MARKDOWN_TABLE_HEAD_CLASSNAME, className)} {...props} />;
}

function MarkdownTableRow({ className, ...props }: ComponentPropsWithoutRef<'tr'>) {
  return <tr className={cn(ASK_AI_MARKDOWN_TABLE_ROW_CLASSNAME, className)} {...props} />;
}

function MarkdownTableHeaderCell({ children, className, ...props }: ComponentPropsWithoutRef<'th'>) {
  return (
    <th className={cn(ASK_AI_MARKDOWN_TABLE_HEADER_CELL_CLASSNAME, className)} {...props}>
      {renderCitationMarkers(children)}
    </th>
  );
}

function MarkdownTableCell({ children, className, ...props }: ComponentPropsWithoutRef<'td'>) {
  return (
    <td className={cn(ASK_AI_MARKDOWN_TABLE_CELL_CLASSNAME, className)} {...props}>
      {renderCitationMarkers(children)}
    </td>
  );
}

export function AskAIMarkdown({ content }: { content: string }) {
  return (
    <div className="prose prose-sm max-w-none text-[color:var(--docs-body-copy,var(--fd-foreground))] prose-headings:mb-2 prose-headings:mt-4 prose-headings:text-fd-foreground prose-p:my-2 prose-p:leading-6 prose-p:text-[color:var(--docs-body-copy,var(--fd-foreground))] prose-ul:my-2 prose-ol:my-2 prose-li:my-1 prose-li:pl-0.5 prose-li:leading-6 prose-li:text-[color:var(--docs-body-copy,var(--fd-foreground))] prose-strong:font-semibold prose-strong:text-fd-foreground prose-a:text-[color:var(--atlas-primary,var(--fd-primary))] hover:prose-a:text-[color:var(--atlas-primary,var(--fd-primary))] prose-code:rounded-md prose-code:bg-white/80 prose-code:px-1.5 prose-code:py-0.5 prose-code:text-[0.92em] prose-code:font-medium prose-code:text-[color:var(--atlas-primary,var(--fd-primary))] prose-code:before:content-none prose-code:after:content-none prose-pre:my-3 prose-pre:overflow-x-auto prose-pre:rounded-xl prose-pre:border prose-pre:border-fd-border prose-pre:bg-[#102018] prose-pre:p-3 prose-pre:text-[13px] prose-pre:leading-6 prose-pre:text-slate-100 prose-table:my-0 prose-table:text-inherit prose-th:p-0 prose-td:p-0 prose-hr:my-3 prose-hr:border-[color:var(--docs-divider,var(--fd-border))] [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_ol]:pl-5 [&_ul]:pl-5">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: MarkdownLink,
          p: MarkdownParagraph,
          li: MarkdownListItem,
          table: MarkdownTable,
          thead: MarkdownTableHead,
          tr: MarkdownTableRow,
          th: MarkdownTableHeaderCell,
          td: MarkdownTableCell,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
