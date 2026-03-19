'use client';

import { useEffect, useState } from 'react';

import type { TocItem } from '@/lib/docs/markdown';
import { cn } from '@/lib/utils';

export function DocsToc({
  toc,
  className,
  contentClassName,
}: {
  toc: TocItem[];
  className?: string;
  contentClassName?: string;
}) {
  const [activeId, setActiveId] = useState<string | null>(toc[0]?.id ?? null);

  useEffect(() => {
    if (!toc.length) return;

    const updateActive = () => {
      const candidates = toc
        .map((item) => {
          const element = document.getElementById(item.id);
          if (!element) return null;

          return {
            id: item.id,
            top: element.getBoundingClientRect().top,
          };
        })
        .filter((item): item is { id: string; top: number } => item !== null);

      const visible = candidates.filter((item) => item.top <= 180);
      const next = visible.at(-1)?.id ?? candidates[0]?.id ?? null;
      setActiveId(next);
    };

    updateActive();
    window.addEventListener('scroll', updateActive, { passive: true });

    return () => {
      window.removeEventListener('scroll', updateActive);
    };
  }, [toc]);

  if (!toc.length) return null;
  return (
    <aside
      className={cn(
        'hidden h-full w-[288px] shrink-0 border-l border-[color:var(--docs-toc-border,var(--fd-border))] bg-[color:var(--docs-toc-background,var(--fd-background))] px-8 py-8 lg:!block',
        className,
      )}
    >
      <div className={cn('sticky top-8', contentClassName)}>
        <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[color:var(--docs-toc-title,var(--fd-foreground))]">
          ON THIS PAGE
        </div>
        <div className="my-3 h-px w-full bg-[color:var(--docs-toc-divider,var(--fd-border))]" />
        <div className="space-y-1">
          {toc.map((t) => (
            <a
              key={t.id}
              href={`#${t.id}`}
              className={
                'block rounded-r-md border-l-2 py-1.5 pl-3 text-[12px] leading-5 transition ' +
                (activeId === t.id
                  ? 'border-[color:var(--docs-sidebar-active-border,var(--fd-foreground))] bg-[color:var(--docs-toc-active-background,var(--fd-muted))] font-medium text-[color:var(--docs-toc-link-active,var(--fd-foreground))]'
                  : 'border-transparent text-[color:var(--docs-toc-link,var(--fd-muted-foreground))] hover:border-fd-border hover:text-[color:var(--docs-toc-link-hover,var(--fd-foreground))] ') +
                (t.depth === 3 ? 'ml-3 text-[11px] leading-[18px]' : t.depth === 4 ? 'ml-6 text-[11px] leading-[18px]' : '')
              }
            >
              {t.title}
            </a>
          ))}
        </div>
      </div>
    </aside>
  );
}
