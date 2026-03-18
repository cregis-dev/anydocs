import { isValidElement, type ComponentPropsWithoutRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

function toText(node: unknown): string {
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(toText).join('');
  if (isValidElement<{ children?: unknown }>(node)) {
    return toText(node.props.children);
  }
  return '';
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\u4e00-\u9fa5\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function withHeadingId(tag: 'h2' | 'h3' | 'h4') {
  return function Heading(props: ComponentPropsWithoutRef<'h2'>) {
    const title = toText(props.children);
    const id = slugify(title);
    const className = ['scroll-mt-24', props.className].filter(Boolean).join(' ');
    if (tag === 'h2') return <h2 {...props} id={id} className={className} />;
    if (tag === 'h3') return <h3 {...props} id={id} className={className} />;
    return <h4 {...props} id={id} className={className} />;
  };
}

export function MarkdownView({ markdown }: { markdown: string }) {
  return (
    <div className="prose prose-neutral max-w-none prose-headings:scroll-mt-24 prose-headings:font-bold prose-headings:tracking-[-0.025em] prose-headings:text-fd-foreground prose-h2:mb-4 prose-h2:mt-10 prose-h2:text-[30px] prose-h2:leading-[1.5] prose-h3:mb-3 prose-h3:mt-8 prose-h3:text-[20px] prose-h3:leading-[1.5] prose-h4:mb-3 prose-h4:mt-6 prose-h4:text-[16px] prose-h4:leading-7 prose-p:my-4 prose-p:text-[16px] prose-p:leading-7 prose-p:text-[color:var(--docs-body-copy,var(--fd-muted-foreground))] prose-li:text-[16px] prose-li:leading-7 prose-li:text-[color:var(--docs-body-copy,var(--fd-muted-foreground))] prose-strong:text-[color:var(--docs-body-copy,var(--fd-foreground))] prose-a:text-fd-foreground prose-a:underline-offset-4 hover:prose-a:text-fd-primary prose-code:rounded-md prose-code:bg-fd-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:text-[0.875em] prose-code:text-fd-foreground prose-pre:rounded-2xl prose-pre:border prose-pre:border-fd-border prose-pre:bg-[#0f172a] prose-pre:shadow-sm prose-blockquote:border-l-[3px] prose-blockquote:border-fd-border prose-blockquote:text-[color:var(--docs-body-copy,var(--fd-muted-foreground))] prose-hr:border-fd-border">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h2: withHeadingId('h2'),
          h3: withHeadingId('h3'),
          h4: withHeadingId('h4'),
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
