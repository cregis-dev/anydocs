'use client';

import type { ComponentPropsWithoutRef } from 'react';
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

export function AskAIMarkdown({ content }: { content: string }) {
  return (
    <div className="prose prose-sm max-w-none text-[color:var(--docs-body-copy,var(--fd-foreground))] prose-headings:mb-2 prose-headings:mt-4 prose-headings:text-fd-foreground prose-p:my-2 prose-p:leading-6 prose-p:text-[color:var(--docs-body-copy,var(--fd-foreground))] prose-ul:my-2 prose-ol:my-2 prose-li:my-1 prose-li:pl-0.5 prose-li:leading-6 prose-li:text-[color:var(--docs-body-copy,var(--fd-foreground))] prose-strong:font-semibold prose-strong:text-fd-foreground prose-a:text-[color:var(--atlas-primary,var(--fd-primary))] hover:prose-a:text-[color:var(--atlas-primary,var(--fd-primary))] prose-code:rounded-md prose-code:bg-white/80 prose-code:px-1.5 prose-code:py-0.5 prose-code:text-[0.92em] prose-code:font-medium prose-code:text-[color:var(--atlas-primary,var(--fd-primary))] prose-code:before:content-none prose-code:after:content-none prose-pre:my-3 prose-pre:overflow-x-auto prose-pre:rounded-xl prose-pre:border prose-pre:border-fd-border prose-pre:bg-[#102018] prose-pre:p-3 prose-pre:text-[13px] prose-pre:leading-6 prose-pre:text-slate-100 prose-hr:my-3 prose-hr:border-[color:var(--docs-divider,var(--fd-border))] [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_ol]:pl-5 [&_ul]:pl-5">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ a: MarkdownLink }}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
