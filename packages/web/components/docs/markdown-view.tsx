import type { ComponentPropsWithoutRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { createHeadingIdGenerator } from '@/lib/docs/markdown';
import { cn } from '@/lib/utils';

function extractHeadingText(node: unknown): string {
  if (!node || typeof node !== 'object') {
    return '';
  }

  const value = 'value' in node && typeof node.value === 'string' ? node.value : '';
  const children = 'children' in node && Array.isArray(node.children) ? node.children : [];
  return `${value}${children.map(extractHeadingText).join('')}`;
}

function remarkDeduplicateHeadingIds() {
  return (tree: unknown) => {
    const nextHeadingId = createHeadingIdGenerator();

    const visit = (node: unknown) => {
      if (!node || typeof node !== 'object') {
        return;
      }

      const depth = 'depth' in node && typeof node.depth === 'number' ? node.depth : null;
      if ('type' in node && node.type === 'heading' && depth && depth >= 2 && depth <= 4) {
        const title = extractHeadingText(node).replace(/`/g, '').trim();
        const id = nextHeadingId(title);
        if (id) {
          const data =
            'data' in node && node.data && typeof node.data === 'object'
              ? (node.data as Record<string, unknown>)
              : {};
          const hProperties =
            data.hProperties && typeof data.hProperties === 'object'
              ? (data.hProperties as Record<string, unknown>)
              : {};

          hProperties.id = id;
          data.hProperties = hProperties;
          (node as Record<string, unknown>).data = data;
        }
      }

      const children = 'children' in node && Array.isArray(node.children) ? node.children : [];
      for (const child of children) {
        visit(child);
      }
    };

    visit(tree);
  };
}

function withHeadingClass(tag: 'h2' | 'h3' | 'h4') {
  return function Heading(props: ComponentPropsWithoutRef<'h2'>) {
    const className = ['scroll-mt-24', props.className].filter(Boolean).join(' ');
    if (tag === 'h2') return <h2 {...props} className={className} />;
    if (tag === 'h3') return <h3 {...props} className={className} />;
    return <h4 {...props} className={className} />;
  };
}

export function MarkdownView({ markdown, className }: { markdown: string; className?: string }) {
  return (
    <div
      className={cn(
        'prose prose-neutral max-w-none prose-headings:scroll-mt-24 prose-headings:font-bold prose-headings:tracking-[-0.025em] prose-headings:text-fd-foreground prose-h2:mb-4 prose-h2:mt-10 prose-h2:text-[30px] prose-h2:leading-[1.5] prose-h3:mb-3 prose-h3:mt-8 prose-h3:text-[20px] prose-h3:leading-[1.5] prose-h4:mb-3 prose-h4:mt-6 prose-h4:text-[16px] prose-h4:leading-7 prose-p:my-4 prose-p:pr-px prose-p:text-[16px] prose-p:leading-7 prose-p:text-[color:var(--docs-body-copy,var(--fd-muted-foreground))] prose-li:pr-px prose-li:text-[16px] prose-li:leading-7 prose-li:text-[color:var(--docs-body-copy,var(--fd-muted-foreground))] prose-strong:text-[color:var(--docs-body-copy,var(--fd-foreground))] prose-a:text-fd-foreground prose-a:underline-offset-4 hover:prose-a:text-fd-primary prose-code:rounded-md prose-code:bg-fd-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:text-[0.875em] prose-code:text-fd-foreground prose-pre:rounded-2xl prose-pre:border prose-pre:border-fd-border prose-pre:bg-[#0f172a] prose-pre:shadow-sm prose-blockquote:border-l-[3px] prose-blockquote:border-fd-border prose-blockquote:text-[color:var(--docs-body-copy,var(--fd-muted-foreground))] prose-hr:border-fd-border',
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkDeduplicateHeadingIds]}
        components={{
          h2: withHeadingClass('h2'),
          h3: withHeadingClass('h3'),
          h4: withHeadingClass('h4'),
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
