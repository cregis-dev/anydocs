'use client';

import type { ComponentPropsWithoutRef } from 'react';
import { Children, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

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

function splitCitationMarkers(text: string): ReactNode {
  const parts: ReactNode[] = [];
  const markerPattern = /\[cit_(\d+)\]/g;
  let lastIndex = 0;

  for (const match of text.matchAll(markerPattern)) {
    if (match.index === undefined) continue;
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    parts.push(
      <sup
        key={`${match[0]}-${match.index}`}
        className="mx-0.5 inline-flex min-w-5 translate-y-[-0.08em] items-center justify-center rounded-md bg-[color:var(--atlas-primary,var(--fd-primary))]/10 px-1.5 py-0.5 text-[11px] font-semibold leading-none text-[color:var(--atlas-primary,var(--fd-primary))]"
      >
        {match[1]}
      </sup>,
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : text;
}

function renderCitationMarkers(children: ReactNode): ReactNode {
  return Children.map(children, (child) =>
    typeof child === 'string' ? splitCitationMarkers(child) : child,
  );
}

function MarkdownParagraph({ children, ...props }: ComponentPropsWithoutRef<'p'>) {
  return <p {...props}>{renderCitationMarkers(children)}</p>;
}

function MarkdownListItem({ children, ...props }: ComponentPropsWithoutRef<'li'>) {
  return <li {...props}>{renderCitationMarkers(children)}</li>;
}

export function AskAIMarkdown({ content }: { content: string }) {
  return (
    <div className="prose prose-sm max-w-none text-[color:var(--docs-body-copy,var(--fd-foreground))] prose-headings:mb-2 prose-headings:mt-4 prose-headings:text-fd-foreground prose-p:my-2 prose-p:leading-6 prose-p:text-[color:var(--docs-body-copy,var(--fd-foreground))] prose-ul:my-2 prose-ol:my-2 prose-li:my-1 prose-li:pl-0.5 prose-li:leading-6 prose-li:text-[color:var(--docs-body-copy,var(--fd-foreground))] prose-strong:font-semibold prose-strong:text-fd-foreground prose-a:text-[color:var(--atlas-primary,var(--fd-primary))] hover:prose-a:text-[color:var(--atlas-primary,var(--fd-primary))] prose-code:rounded-md prose-code:bg-white/80 prose-code:px-1.5 prose-code:py-0.5 prose-code:text-[0.92em] prose-code:font-medium prose-code:text-[color:var(--atlas-primary,var(--fd-primary))] prose-code:before:content-none prose-code:after:content-none prose-pre:my-3 prose-pre:overflow-x-auto prose-pre:rounded-xl prose-pre:border prose-pre:border-fd-border prose-pre:bg-[#102018] prose-pre:p-3 prose-pre:text-[13px] prose-pre:leading-6 prose-pre:text-slate-100 prose-hr:my-3 prose-hr:border-[color:var(--docs-divider,var(--fd-border))] [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_ol]:pl-5 [&_ul]:pl-5">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{ a: MarkdownLink, p: MarkdownParagraph, li: MarkdownListItem }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
