"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import YooptaEditor, {
  createYooptaEditor,
  type RenderBlockProps,
  type SlateElement,
  type YooptaContentValue,
  type YooptaPlugin,
} from "@yoopta/editor";
import Image from "@yoopta/image";
import { Bold, CodeMark, Italic, Strike, Underline } from "@yoopta/marks";
import { applyTheme } from "@yoopta/themes-shadcn";
import { BlockDndContext, SortableBlock } from "@yoopta/ui/block-dnd";
import { FloatingToolbar } from "@yoopta/ui";
import Blockquote from "@yoopta/blockquote";
import Callout from "@yoopta/callout";
import Code from "@yoopta/code";
import Divider from "@yoopta/divider";
import Headings from "@yoopta/headings";
import Link from "@yoopta/link";
import Lists from "@yoopta/lists";
import Paragraph from "@yoopta/paragraph";
import Table from "@yoopta/table";

import { MermaidPlugin } from "./plugins/mermaid";
import { YooptaFloatingBlockActions } from "./yoo-components/floating-block-actions";
import { YooptaSlashCommandMenu } from "./yoo-components/yoopta-slash-command-menu";

function createLocalImageUploadResult(file: File) {
  return {
    id: crypto.randomUUID(),
    src: URL.createObjectURL(file),
    alt: file.name,
    sizes: {
      width: 0,
      height: 0,
    },
  };
}

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
  const isInitializedRef = useRef(false);
  const hydrationGuardRef = useRef<{ serializedValue: string }>({
    serializedValue: JSON.stringify(value ?? {}),
  });
  const sawUserInputRef = useRef(false);
  const latestValueRef = useRef(value);

  const plugins = useMemo(() => {
    type AnyPlugin = YooptaPlugin<
      Record<string, SlateElement>,
      Record<string, unknown>
    >;
    const headingPlugins: AnyPlugin[] = [
      Headings.HeadingOne,
      Headings.HeadingTwo,
      Headings.HeadingThree,
    ] as unknown as AnyPlugin[];
    const listPlugins: AnyPlugin[] = [
      Lists.BulletedList,
      Lists.NumberedList,
      Lists.TodoList,
    ] as unknown as AnyPlugin[];
    const codePlugins: AnyPlugin[] = [
      Code.Code,
      Code.CodeGroup,
    ] as unknown as AnyPlugin[];

    const imagePlugin = Image.extend({
      options: {
        upload: async (file) => createLocalImageUploadResult(file),
      },
    }) as unknown as AnyPlugin;

    return applyTheme([
      Paragraph,
      ...headingPlugins,
      ...listPlugins,
      Blockquote,
      ...codePlugins,
      imagePlugin,
      Table,
      Callout,
      Divider,
      Link,
      MermaidPlugin,
    ]);
  }, []);

  const marks = useMemo(() => [Bold, Italic, Underline, Strike, CodeMark], []);

  const [editor] = useState(() =>
    createYooptaEditor({
      plugins,
      marks,
      value: (value ?? {}) as YooptaContentValue,
      readOnly: false,
    }),
  );

  const startHydrationGuard = useCallback(
    (nextValue: unknown) => {
      hydrationGuardRef.current = {
        serializedValue: JSON.stringify(nextValue ?? {}),
      };
      sawUserInputRef.current = false;
    },
    [],
  );

  const markUserInput = useCallback(() => {
    sawUserInputRef.current = true;
  }, []);

  useEffect(() => {
    latestValueRef.current = value;
  }, [value]);

  useEffect(() => {
    if (!isInitializedRef.current) {
      isInitializedRef.current = true;
      const timer = setTimeout(() => {
        try {
          if (editor.isEmpty()) {
            startHydrationGuard(latestValueRef.current);
            editor.insertBlock("Paragraph", { focus: true });
          } else {
            editor.focus();
          }
        } catch (error) {
          console.error("[YooptaEditor] Initialization error:", error);
        }
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [editor, startHydrationGuard]);

  useEffect(() => {
    const nextValue = latestValueRef.current;
    startHydrationGuard(nextValue);
    editor.setEditorValue((nextValue ?? {}) as YooptaContentValue);
    const timer = setTimeout(() => {
      if (editor.isEmpty()) {
        startHydrationGuard(latestValueRef.current);
        editor.insertBlock("Paragraph", { focus: true });
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [editor, id, startHydrationGuard]);

  const handleChange = useCallback(
    (next: YooptaContentValue) => {
      const serializedNext = JSON.stringify(next ?? {});
      const hydrationGuard = hydrationGuardRef.current;
      if (!sawUserInputRef.current || serializedNext === hydrationGuard.serializedValue) {
        return;
      }

      const markdown = editor.getMarkdown(next);
      const plainText = editor.getPlainText(next);
      onChange(next, { markdown, plainText });
    },
    [editor, onChange],
  );

  const renderBlock = useCallback(({ blockId, children }: RenderBlockProps) => {
    return (
      <SortableBlock id={blockId} useDragHandle>
        {children}
      </SortableBlock>
    );
  }, []);

  return (
    <div
      className="mx-auto w-full max-w-4xl"
      style={{ paddingBottom: 100 }}
      data-testid="studio-yoopta-editor"
      onBeforeInput={markUserInput}
      onKeyDown={markUserInput}
      onPaste={markUserInput}
      onPointerDown={markUserInput}
    >
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
