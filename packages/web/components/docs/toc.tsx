'use client';

import { useEffect, useState } from 'react';

import type { TocItem } from '@/lib/docs/markdown';

export function DocsToc({ toc }: { toc: TocItem[] }) {
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
    <aside className="hidden h-full w-[288px] shrink-0 border-l border-[color:#f3f4f6] bg-fd-background px-8 py-8 lg:block">
      <div className="sticky top-8">
        <div className="mb-6 text-[12px] font-bold uppercase tracking-[0.12em] text-fd-foreground">ON THIS PAGE</div>
        <div className="space-y-0.5">
          {toc.map((t) => (
            <a
              key={t.id}
              href={`#${t.id}`}
              className={
                'block border-l-2 py-2 pl-4 text-[13px] leading-[1.5] transition ' +
                (activeId === t.id
                  ? 'border-[color:var(--docs-sidebar-active-border,var(--fd-foreground))] font-medium text-fd-foreground'
                  : 'border-transparent text-[color:var(--docs-body-copy-subtle,var(--fd-muted-foreground))] hover:border-fd-border hover:text-[color:var(--docs-body-copy,var(--fd-foreground))] ') +
                (t.depth === 3 ? 'ml-4 text-[12px] leading-[18px]' : t.depth === 4 ? 'ml-8 text-[12px] leading-[18px]' : '')
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
