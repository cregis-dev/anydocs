'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import MiniSearch from 'minisearch';

import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type SearchDoc = {
  id: string;
  slug: string;
  title: string;
  description?: string;
  breadcrumbs?: string[];
  text?: string;
};

type SearchIndex = {
  lang: string;
  docs: SearchDoc[];
};

export function SearchPanel({
  lang,
  placeholder = 'Search docs...',
  className,
  inputClassName,
  resultsClassName,
}: {
  lang: 'zh' | 'en';
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  resultsClassName?: string;
}) {
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState<SearchIndex | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/search-index.${lang}.json`, { cache: 'force-cache' })
      .then((r) => r.json())
      .then((data: SearchIndex) => {
        if (cancelled) return;
        setIdx(data);
      })
      .catch(() => {
        if (cancelled) return;
        setIdx({ lang, docs: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [lang]);

  const mini = useMemo(() => {
    if (!idx) return null;
    const ms = new MiniSearch({
      fields: ['title', 'description', 'text'],
      storeFields: ['id', 'slug', 'title', 'description', 'breadcrumbs'],
      searchOptions: {
        boost: { title: 4, description: 2, text: 1 },
        prefix: true,
        fuzzy: 0.2,
      },
    });
    ms.addAll(idx.docs);
    return ms;
  }, [idx]);

  const results = useMemo(() => {
    const query = q.trim();
    if (!mini || !query) return [];
    return mini.search(query, { combineWith: 'AND' }).slice(0, 12) as unknown as SearchDoc[];
  }, [mini, q]);

  return (
    <div className={cn('space-y-2', className)}>
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder}
        className={cn(
          'h-10 rounded-lg border-fd-border bg-fd-muted px-4 text-sm text-[color:var(--docs-body-copy,var(--fd-foreground))] shadow-none placeholder:text-fd-muted-foreground',
          inputClassName,
        )}
      />
      {q.trim() ? (
        <div
          className={cn(
            'max-h-[50dvh] overflow-y-auto rounded-xl border border-fd-border bg-fd-card p-2 shadow-lg shadow-slate-900/5',
            resultsClassName,
          )}
        >
          {results.length ? (
            <div className="space-y-1">
              {results.map((r) => (
                <Link
                  key={r.id}
                  href={`/${lang}/${r.slug}`}
                  className="block rounded-lg px-3 py-2 text-sm transition hover:bg-fd-muted"
                >
                  <div className="truncate font-medium text-fd-foreground">{r.title}</div>
                  {r.breadcrumbs?.length ? (
                    <div className="truncate text-xs text-fd-muted-foreground">{r.breadcrumbs.join(' › ')}</div>
                  ) : null}
                </Link>
              ))}
            </div>
          ) : (
            <div className="px-2 py-3 text-sm text-fd-muted-foreground">No results</div>
          )}
        </div>
      ) : null}
    </div>
  );
}
