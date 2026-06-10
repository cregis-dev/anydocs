import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { cn } from '@/lib/utils';

/**
 * 轻量内联 markdown 渲染，用于 operation/字段描述。
 * 与文档正文的 MarkdownView 区分：字号更小、无 heading 锚点逻辑，适配参考页的紧凑排版。
 */
export function InlineMarkdown({ children, className }: { children: string; className?: string }) {
  return (
    <div
      className={cn(
        'prose prose-neutral max-w-none',
        'prose-p:my-2 prose-p:text-[15px] prose-p:leading-7 prose-p:text-[color:var(--docs-body-copy,var(--fd-muted-foreground))]',
        'prose-li:my-0.5 prose-li:text-[14px] prose-li:leading-6 prose-li:text-[color:var(--docs-body-copy,var(--fd-muted-foreground))]',
        'prose-headings:text-[15px] prose-headings:font-semibold prose-headings:text-fd-foreground',
        'prose-strong:font-semibold prose-strong:text-fd-foreground',
        'prose-a:font-medium prose-a:text-[color:var(--docs-link,var(--fd-primary))] prose-a:underline prose-a:underline-offset-2',
        'prose-code:rounded prose-code:bg-fd-muted prose-code:px-1 prose-code:py-0.5 prose-code:text-[0.85em] prose-code:font-normal prose-code:text-fd-foreground prose-code:before:content-none prose-code:after:content-none',
        'prose-pre:overflow-x-auto prose-pre:rounded-lg prose-pre:border prose-pre:border-fd-border prose-pre:bg-[#0f172a] prose-pre:p-3 prose-pre:text-[12px] prose-pre:text-slate-100',
        className,
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}
