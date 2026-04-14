'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import MiniSearch from 'minisearch';

import { Input } from '@/components/ui/input';
import { getDocsUiCopy } from '@/components/docs/docs-ui-copy';
import {
  buildReaderSearchResults,
  findReaderFallbackHits,
  mergeReaderSearchHits,
  normalizeReaderSearchIndex,
  type ReaderSearchDoc,
  type ReaderSearchHit,
  type ReaderSearchIndex,
} from '@/lib/docs/search';
import { cn } from '@/lib/utils';

export function SearchPanel({
  lang,
  indexHref,
  placeholder,
  className,
  inputClassName,
  resultsClassName,
}: {
  lang: 'zh' | 'en';
  indexHref?: string;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  resultsClassName?: string;
}) {
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState<ReaderSearchIndex | null>(null);
  const copy = getDocsUiCopy(lang);
  const resolvedPlaceholder = placeholder ?? copy.sidebar.searchPlaceholder;
  const resolvedIndexHref = indexHref ?? `/search-index.${lang}.json`;

  useEffect(() => {
    let cancelled = false;
    fetch(resolvedIndexHref, { cache: 'force-cache' })
      .then((r) => r.json())
      .then((data: unknown) => {
        if (cancelled) return;
        setIdx(normalizeReaderSearchIndex(data, lang));
      })
      .catch(() => {
        if (cancelled) return;
        setIdx({ lang, docs: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [lang, resolvedIndexHref]);

  const mini = useMemo(() => {
    if (!idx) return null;
    const ms = new MiniSearch<ReaderSearchDoc>({
      fields: ['pageTitle', 'sectionTitle', 'text'],
      storeFields: ['id', 'pageId', 'pageSlug', 'pageTitle', 'sectionTitle', 'breadcrumbs', 'href', 'text'],
      searchOptions: {
        boost: { pageTitle: 8, sectionTitle: 5, text: 1 },
        prefix: true,
        fuzzy: 0.2,
      },
    });
    ms.addAll(idx.docs);
    return ms;
  }, [idx]);

  const results = useMemo(() => {
    const query = q.trim();
    if (!idx || !mini || !query) return [];
    const miniHits = mini.search(query, { combineWith: 'AND' }) as unknown as ReaderSearchHit[];
    const fallbackHits = findReaderFallbackHits(idx.docs, query);
    return buildReaderSearchResults(
      mergeReaderSearchHits(miniHits, fallbackHits),
      query,
    );
  }, [idx, mini, q]);

  return (
    <div className={cn('space-y-2', className)}>
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={resolvedPlaceholder}
        aria-label={resolvedPlaceholder}
        className={cn(
          'h-10 rounded-lg border-[color:var(--docs-search-border,var(--fd-border))] bg-[color:var(--docs-search-background,var(--fd-muted))] px-4 text-sm text-[color:var(--docs-body-copy,var(--fd-foreground))] shadow-none placeholder:text-[color:var(--docs-search-placeholder,var(--fd-muted-foreground))]',
          inputClassName,
        )}
      />
      {q.trim() ? (
        <div
          aria-live="polite"
          className={cn(
            'max-h-[50dvh] overflow-y-auto rounded-xl border border-fd-border bg-[color:var(--docs-search-results-background,var(--fd-card))] p-2 shadow-lg shadow-slate-900/5',
            resultsClassName,
          )}
        >
          {!idx ? (
            <div className="px-2 py-3 text-sm text-fd-muted-foreground">
              {copy.search.loading}
            </div>
          ) : results.length ? (
            <div className="space-y-1">
              {results.map((r) => (
                <Link
                  key={r.id}
                  href={r.href}
                  className="block rounded-lg px-3 py-2 text-sm transition hover:bg-[color:var(--docs-search-hover,var(--fd-muted))]"
                >
                  <div className="truncate font-medium text-fd-foreground">{r.pageTitle}</div>
                  {r.sectionTitle ? (
                    <div className="truncate text-xs font-medium text-[color:var(--docs-body-copy,var(--fd-foreground))]">
                      {r.sectionTitle}
                    </div>
                  ) : null}
                  {r.breadcrumbs?.length ? (
                    <div className="truncate text-xs text-fd-muted-foreground">{r.breadcrumbs.join(' › ')}</div>
                  ) : null}
                  {r.snippet ? (
                    <div className="mt-1 line-clamp-2 text-xs leading-5 text-[color:var(--docs-body-copy-subtle,var(--fd-muted-foreground))]">
                      {r.snippet}
                    </div>
                  ) : null}
                </Link>
              ))}
            </div>
          ) : (
            <div className="space-y-2 px-2 py-3">
              <div className="text-sm text-fd-muted-foreground">{copy.search.noResults}</div>
              <div className="text-xs leading-5 text-[color:var(--docs-body-copy-subtle,var(--fd-muted-foreground))]">
                {copy.search.noResultsHint}
              </div>
              <Link
                href={`/${lang}`}
                className="inline-flex rounded-full border border-fd-border px-3 py-1.5 text-xs font-medium text-fd-foreground transition hover:bg-fd-muted"
              >
                {copy.search.browseHome}
              </Link>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
