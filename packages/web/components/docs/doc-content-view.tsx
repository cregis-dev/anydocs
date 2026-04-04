'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import type { DocContentV1 } from '@anydocs/core';
import type { YooptaContentValue } from '@yoopta/editor';

import { CanonicalDocView } from '@/components/docs/canonical-doc-view';
import { MarkdownView } from '@/components/docs/markdown-view';

const LegacyYooptaDocView = dynamic(
  () => import('@/components/docs/legacy-yoopta-doc-view').then((module) => module.LegacyYooptaDocView),
  { ssr: false },
);

export function DocContentView({
  docContent,
  markdown,
  markdownClassName,
  legacyYooptaContent,
  legacyYooptaClassName,
}: {
  docContent: DocContentV1 | null;
  markdown: string;
  markdownClassName?: string;
  legacyYooptaContent: YooptaContentValue | null;
  legacyYooptaClassName?: string;
}) {
  const [preferYoopta, setPreferYoopta] = useState(false);

  useEffect(() => {
    if (!legacyYooptaContent) {
      setPreferYoopta(false);
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      setPreferYoopta(true);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [legacyYooptaContent]);

  if (docContent) {
    return <CanonicalDocView content={docContent} className={legacyYooptaClassName ?? markdownClassName} />;
  }

  // Legacy pages still start on markdown, then upgrade to the Yoopta fallback after hydration.
  if (!preferYoopta || !legacyYooptaContent) {
    return <MarkdownView markdown={markdown} className={markdownClassName} />;
  }

  return <LegacyYooptaDocView content={legacyYooptaContent} className={legacyYooptaClassName ?? markdownClassName} />;
}
