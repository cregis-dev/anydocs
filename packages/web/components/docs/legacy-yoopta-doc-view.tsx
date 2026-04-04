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

import { DOC_READER_ROOT_CLASSNAME } from '@/components/docs/doc-reader-classnames';
import { MermaidPlugin } from '@/components/studio/plugins/mermaid';

import { createHeadingIdGenerator } from '@/lib/docs/markdown';
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
    MermaidPlugin,
  ]) as unknown as AnyPlugin[];
}

export function LegacyYooptaDocView({
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

      const nextHeadingId = createHeadingIdGenerator();
      for (const heading of root.querySelectorAll('h2, h3, h4')) {
        const title = heading.textContent?.trim();
        if (!title) {
          continue;
        }
        heading.id = nextHeadingId(title);
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, [content]);

  return (
    <div
      ref={rootRef}
      className={cn(
        `docs-yoopta-view [&_.YooptaEditor]:w-full ${DOC_READER_ROOT_CLASSNAME}`,
        className,
      )}
    >
      <YooptaEditor editor={editor} style={{ width: '100%' }} />
    </div>
  );
}
