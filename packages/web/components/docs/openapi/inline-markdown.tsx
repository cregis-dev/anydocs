import type { CSSProperties } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { cn } from '@/lib/utils';

const markdownTableWrapperStyle: CSSProperties = {
  margin: '0.75rem 0',
  width: '100%',
  overflowX: 'auto',
  border: '1px solid var(--fd-border)',
  borderRadius: '0.5rem',
  background: 'var(--fd-card)',
};

const markdownTableStyle: CSSProperties = {
  width: '100%',
  borderCollapse: 'separate',
  borderSpacing: 0,
  fontSize: '14px',
  lineHeight: 1.5,
};

const markdownTableHeaderCellStyle: CSSProperties = {
  background: 'var(--fd-muted)',
  padding: '0.5rem 0.75rem',
  textAlign: 'left',
  fontWeight: 600,
  color: 'var(--fd-foreground)',
  whiteSpace: 'nowrap',
};

const markdownTableCellStyle: CSSProperties = {
  borderTop: '1px solid var(--fd-border)',
  padding: '0.5rem 0.75rem',
  color: 'var(--docs-body-copy,var(--fd-muted-foreground))',
  verticalAlign: 'top',
};

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
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          table({ node: _node, style, ...props }) {
            return (
              <div data-inline-markdown-table style={markdownTableWrapperStyle}>
                <table {...props} style={{ ...markdownTableStyle, ...style }} />
              </div>
            );
          },
          th({ node: _node, style, ...props }) {
            return <th {...props} style={{ ...markdownTableHeaderCellStyle, ...style }} />;
          },
          td({ node: _node, style, ...props }) {
            return <td {...props} style={{ ...markdownTableCellStyle, ...style }} />;
          },
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
