'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import YooptaEditor, {
  createYooptaEditor,
  useYooptaEditor,
  type SlateElement,
  type YooptaContentValue,
  type YooptaPlugin,
  type RenderBlockProps,
} from '@yoopta/editor';
import { FloatingToolbar } from '@yoopta/ui';
// @ts-ignore
import { BlockDndContext, SortableBlock } from '@yoopta/ui/block-dnd';
import { applyTheme } from '@yoopta/themes-shadcn';
import { YooptaFloatingBlockActions } from './yoo-components/floating-block-actions';
import { YooptaSlashCommandMenu } from './yoo-components/yoopta-slash-command-menu';

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

export function YooptaDocEditor({
  id,
  value,
  onChange,
}: {
  id: string;
  value: unknown;
  onChange: (
    nextValue: YooptaContentValue,
    derived: {
      markdown: string;
      plainText: string;
    },
  ) => void;
}) {
  const editorRef = useRef<ReturnType<typeof createYooptaEditor> | null>(null);
  const isInitializedRef = useRef(false);
  const previousIdRef = useRef(id);

  const plugins = useMemo(
    () => {
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
          upload: async (file) => {
            // For local development, we just use object URL
            return {
              id: Math.random().toString(36).slice(2),
              src: URL.createObjectURL(file),
              alt: file.name,
              sizes: {
                width: 0, // dynamic
                height: 0, // dynamic
              },
            };
          },
        },
      }) as unknown as AnyPlugin;

      const themed = applyTheme([
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
      ]);

      return themed;
    },
    [],
  );

  const marks = useMemo(() => [Bold, Italic, Underline, Strike, CodeMark], []);

  const editor = useMemo(() => {
    if (!editorRef.current) {
      editorRef.current = createYooptaEditor({ 
        plugins, 
        marks, 
        value: (value ?? {}) as YooptaContentValue, 
        readOnly: false 
      });
    }
    return editorRef.current;
  }, [plugins, marks]);

  useEffect(() => {
    if (!isInitializedRef.current) {
      isInitializedRef.current = true;
      const timer = setTimeout(() => {
        try {
          if (editor.isEmpty()) {
            editor.insertBlock('Paragraph', { focus: true });
          } else {
            editor.focus();
          }
        } catch (e) {
          console.error('[YooptaEditor] Initialization error:', e);
        }
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [editor]);

  useEffect(() => {
    if (editor) {
      editor.setEditorValue((value ?? {}) as YooptaContentValue);
      setTimeout(() => {
        if (editor.isEmpty()) {
          editor.insertBlock('Paragraph', { focus: true });
        }
      }, 100);
    }
  }, [id, editor]); // Removed value from dependencies to prevent resetting editor on every change

  const handleChange = useCallback(
    (next: YooptaContentValue) => {
      const markdown = editor.getMarkdown(next);
      const plainText = editor.getPlainText(next);
      onChange(next, { markdown, plainText });
    },
    [editor, onChange],
  );

  const renderBlock = useCallback(({ children, blockId }: RenderBlockProps) => {
    return <SortableBlock id={blockId} useDragHandle>{children}</SortableBlock>;
  }, []);

  return (
    <div className="w-full max-w-4xl mx-auto" style={{ paddingBottom: 100 }}>
      <BlockDndContext editor={editor}>
        <YooptaEditor
          editor={editor}
          placeholder="Type / to open menu, or start typing..."
          onChange={handleChange}
          className="yoopta-editor"
          renderBlock={renderBlock}
        >
          <FloatingToolbar />
          <YooptaFloatingBlockActions />
          <YooptaSlashCommandMenu />
        </YooptaEditor>
      </BlockDndContext>
    </div>
  );
}
