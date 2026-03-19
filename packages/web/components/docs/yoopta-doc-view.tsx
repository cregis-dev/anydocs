'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import YooptaEditor, {
  createYooptaEditor,
  type SlateElement,
  type YooptaContentValue,
  type YooptaPlugin,
} from '@yoopta/editor';
import { applyTheme } from '@yoopta/themes-shadcn';
import Paragraph from '@yoopta/paragraph';
import Headings from '@yoopta/headings';
import Blockquote from '@yoopta/blockquote';
import Lists from '@yoopta/lists';
import Code from '@yoopta/code';
import Image from '@yoopta/image';
import Table from '@yoopta/table';
import Callout from '@yoopta/callout';
import Divider from '@yoopta/divider';
import Link from '@yoopta/link';
import { Bold, CodeMark, Italic, Strike, Underline } from '@yoopta/marks';

import { slugify } from '@/lib/docs/markdown';
import { cn } from '@/lib/utils';

function createReaderPlugins() {
  type AnyPlugin = YooptaPlugin<Record<string, SlateElement>, Record<string, unknown>>;
  const headingPlugins: AnyPlugin[] = [
    Headings.HeadingOne,
    Headings.HeadingTwo,
    Headings.HeadingThree,
  ] as unknown as AnyPlugin[];
  const listPlugins: AnyPlugin[] = [Lists.BulletedList, Lists.NumberedList, Lists.TodoList] as unknown as AnyPlugin[];
  const codePlugins: AnyPlugin[] = [Code.Code, Code.CodeGroup] as unknown as AnyPlugin[];
  const YImage = Image.extend({
    options: {
      // Reader is read-only, but Yoopta still validates that the plugin has upload configured.
      upload: async (file) => ({
        id: file.name,
        src: '',
        alt: file.name,
        sizes: {
          width: 0,
          height: 0,
        },
      }),
    },
  }) as unknown as AnyPlugin;

  return applyTheme([
    Paragraph,
    ...headingPlugins,
    ...listPlugins,
    Blockquote,
    ...codePlugins,
    YImage,
    Table,
    Callout,
    Divider,
    Link,
  ]) as unknown as AnyPlugin[];
}

export function YooptaDocView({
  content,
  className,
}: {
  content: YooptaContentValue;
  className?: string;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const plugins = useMemo(() => createReaderPlugins(), []);
  const marks = useMemo(() => [Bold, Italic, Underline, Strike, CodeMark], []);
  const [editor] = useState(() =>
    createYooptaEditor({
      plugins,
      marks,
      value: content,
      readOnly: true,
    }),
  );

  useEffect(() => {
    editor.setEditorValue(content);
  }, [content, editor]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const root = rootRef.current;
      if (!root) {
        return;
      }

      for (const heading of root.querySelectorAll('h2, h3, h4')) {
        const title = heading.textContent?.trim();
        if (!title) {
          continue;
        }
        heading.id = slugify(title);
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, [content]);

  return (
    <div
      ref={rootRef}
      className={cn(
        'docs-yoopta-view max-w-none text-[color:var(--docs-body-copy,var(--fd-muted-foreground))] [&_.YooptaEditor]:w-full [&_a]:text-fd-foreground [&_a]:underline-offset-4 hover:[&_a]:text-fd-primary [&_blockquote]:my-6 [&_blockquote]:border-l-[3px] [&_blockquote]:border-fd-border [&_blockquote]:pl-5 [&_blockquote]:italic [&_blockquote]:text-[color:var(--docs-body-copy,var(--fd-muted-foreground))] [&_code]:rounded-md [&_code]:bg-fd-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[0.875em] [&_code]:text-fd-foreground [&_h1]:mb-6 [&_h1]:mt-0 [&_h1]:text-[36px] [&_h1]:font-bold [&_h1]:leading-[1.12] [&_h1]:tracking-[-0.03em] [&_h1]:text-fd-foreground [&_h2]:mb-4 [&_h2]:mt-10 [&_h2]:scroll-mt-24 [&_h2]:text-[30px] [&_h2]:font-bold [&_h2]:leading-[1.5] [&_h2]:tracking-[-0.025em] [&_h2]:text-fd-foreground [&_h3]:mb-3 [&_h3]:mt-8 [&_h3]:scroll-mt-24 [&_h3]:text-[20px] [&_h3]:font-bold [&_h3]:leading-[1.5] [&_h3]:tracking-[-0.025em] [&_h3]:text-fd-foreground [&_h4]:mb-3 [&_h4]:mt-6 [&_h4]:scroll-mt-24 [&_h4]:text-[16px] [&_h4]:font-bold [&_h4]:leading-7 [&_h4]:tracking-[-0.025em] [&_h4]:text-fd-foreground [&_hr]:my-8 [&_hr]:border-fd-border [&_img]:rounded-xl [&_img]:border [&_img]:border-fd-border [&_img]:shadow-sm [&_li]:text-[16px] [&_li]:leading-7 [&_ol]:my-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-4 [&_p]:text-[16px] [&_p]:leading-7 [&_pre]:my-6 [&_pre]:overflow-x-auto [&_pre]:rounded-2xl [&_pre]:border [&_pre]:border-fd-border [&_pre]:bg-[#0f172a] [&_pre]:p-4 [&_pre]:text-sm [&_pre]:text-white [&_pre]:shadow-sm [&_table]:my-6 [&_table]:w-full [&_table]:border-collapse [&_table]:overflow-hidden [&_table]:rounded-xl [&_table]:border [&_table]:border-fd-border [&_td]:border [&_td]:border-fd-border [&_td]:px-3 [&_td]:py-2 [&_th]:border [&_th]:border-fd-border [&_th]:bg-fd-muted [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:text-fd-foreground [&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-6',
        className,
      )}
    >
      <YooptaEditor editor={editor} style={{ width: '100%' }} />
    </div>
  );
}
