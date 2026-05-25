'use client';

// Tiny client wrapper that owns the pathname → activePageId derivation for the
// classic-docs sidebar Search + Ask AI panel. Extracted from `reader-layout.tsx`
// so the layout itself can stay a Server Component (and benefit from RSC
// streaming) — the only piece of the layout that actually needed `usePathname`
// was this slot.

import { useMemo } from 'react';
import { usePathname } from 'next/navigation';

import { SearchAskPanel } from '@/components/docs/search-ask-panel';
import type { DocsLang, PublishedPageDoc } from '@/lib/docs/types';
import { CLASSIC_DOCS_THEME_CLASS_NAME } from '@/themes/classic-docs/manifest';

function normalizeRoutePath(pathname: string) {
  if (!pathname || pathname === '/') {
    return '/';
  }
  return pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
}

type ClassicDocsSearchAskSlotProps = {
  lang: DocsLang;
  pages: PublishedPageDoc[];
  findHref?: string;
  indexHref?: string;
  documentationName: string;
  endpointBaseUrl?: string;
};

export function ClassicDocsSearchAskSlot({
  lang,
  pages,
  findHref,
  indexHref,
  documentationName,
  endpointBaseUrl,
}: ClassicDocsSearchAskSlotProps) {
  const pathname = usePathname();
  const normalizedPathname = normalizeRoutePath(pathname);
  const activePageId = useMemo(() => {
    for (const page of pages) {
      const href = `/${lang}/${page.slug}`;
      if (normalizedPathname === normalizeRoutePath(href)) {
        return page.id;
      }
    }
    return null;
  }, [lang, normalizedPathname, pages]);

  return (
    <SearchAskPanel
      lang={lang}
      findHref={findHref}
      indexHref={indexHref}
      currentPageId={activePageId}
      documentationName={documentationName}
      endpointBaseUrl={endpointBaseUrl}
      portalClassName={CLASSIC_DOCS_THEME_CLASS_NAME}
      inputClassName="h-9 rounded-md border bg-fd-background px-3.5 text-[13px]"
      resultsClassName="rounded-lg"
    />
  );
}
