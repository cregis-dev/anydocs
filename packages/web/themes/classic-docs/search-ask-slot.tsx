'use client';

// Tiny client wrapper that owns the pathname → activePageId derivation for the
// classic-docs sidebar Search + Ask AI panel. Extracted from `reader-layout.tsx`
// so the layout itself can stay a Server Component (and benefit from RSC
// streaming) — the only piece of the layout that actually needed `usePathname`
// was this slot.

import { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';

import { SearchAskPanel } from '@/components/docs/search-ask-panel';
import { SearchPanel } from '@/components/docs/search-panel';
import { getDocsUiCopy } from '@/components/docs/docs-ui-copy';
import type { DocsLang, PublishedPageSummary } from '@/lib/docs/types';
import { CLASSIC_DOCS_THEME_CLASS_NAME } from '@/themes/classic-docs/manifest';

function normalizeRoutePath(pathname: string) {
  if (!pathname || pathname === '/') {
    return '/';
  }
  return pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
}

type ClassicDocsSearchAskSlotProps = {
  lang: DocsLang;
  pages: PublishedPageSummary[];
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
  const [runtimeAsk, setRuntimeAsk] = useState(false);
  useEffect(() => {
    if (endpointBaseUrl) return;
    const controller = new AbortController();
    fetch('/reader-runtime.json', { signal: controller.signal })
      .then((response) => response.ok ? response.json() : null)
      .then((config) => { if (config?.ask === true) setRuntimeAsk(true); })
      .catch(() => {});
    return () => controller.abort();
  }, [endpointBaseUrl]);
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

  if (!endpointBaseUrl && !runtimeAsk) {
    return <SearchPanel
      lang={lang}
      findHref={findHref}
      indexHref={indexHref}
      placeholder={getDocsUiCopy(lang).sidebar.searchPlaceholder}
      inputClassName="h-9 rounded-md border bg-fd-background px-3.5 text-[13px]"
      resultsClassName="rounded-lg"
    />;
  }

  return (
    <SearchAskPanel
      lang={lang}
      findHref={findHref}
      indexHref={indexHref}
      currentPageId={activePageId}
      documentationName={documentationName}
      endpointBaseUrl={endpointBaseUrl || '/ask-api'}
      portalClassName={CLASSIC_DOCS_THEME_CLASS_NAME}
      inputClassName="h-9 rounded-md border bg-fd-background px-3.5 text-[13px]"
      resultsClassName="rounded-lg"
    />
  );
}
