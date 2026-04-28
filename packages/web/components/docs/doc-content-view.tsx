'use client';

import type { DocContentV1 } from '@anydocs/core';

import { CanonicalDocView } from '@/components/docs/canonical-doc-view';
import { MarkdownView } from '@/components/docs/markdown-view';

export function DocContentView({
  docContent,
  markdown,
  markdownClassName,
  hasUnsupportedLegacyContent,
}: {
  docContent: DocContentV1 | null;
  markdown: string;
  markdownClassName?: string;
  hasUnsupportedLegacyContent?: boolean;
}) {
  if (docContent) {
    return <CanonicalDocView content={docContent} className={markdownClassName} />;
  }

  if (hasUnsupportedLegacyContent) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-5 py-4 text-sm leading-6 text-amber-950">
        <div className="font-semibold">This page uses the legacy Yoopta content format.</div>
        <p className="mt-2">
          The reader no longer renders legacy content directly. Open this page in Studio and save it again to write the
          canonical DocContentV1 format. For imported documentation, run <code>anydocs import --convert</code> or{' '}
          <code>anydocs convert-import &lt;importId&gt;</code>, then review and publish the converted page.
        </p>
      </div>
    );
  }

  return <MarkdownView markdown={markdown} className={markdownClassName} />;
}
