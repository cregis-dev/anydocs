'use client';

import { useEffect, useState } from 'react';
import type { YooptaContentValue } from '@yoopta/editor';

import { MarkdownView } from '@/components/docs/markdown-view';
import { YooptaDocView } from '@/components/docs/yoopta-doc-view';

export function DocContentView({
  markdown,
  markdownClassName,
  yooptaContent,
  yooptaClassName,
}: {
  markdown: string;
  markdownClassName?: string;
  yooptaContent: YooptaContentValue | null;
  yooptaClassName?: string;
}) {
  const [preferYoopta, setPreferYoopta] = useState(false);

  useEffect(() => {
    if (!yooptaContent) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      setPreferYoopta(true);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [yooptaContent]);

  if (!preferYoopta || !yooptaContent) {
    return <MarkdownView markdown={markdown} className={markdownClassName} />;
  }

  return <YooptaDocView content={yooptaContent} className={yooptaClassName ?? markdownClassName} />;
}
