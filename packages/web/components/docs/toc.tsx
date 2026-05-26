'use client';

import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { usePathname } from 'next/navigation';

import type { TocItem } from '@/lib/docs/markdown';
import { getDocsUiCopy, inferDocsLangFromPathname } from '@/components/docs/docs-ui-copy';
import { resolveActiveTocId } from '@/components/docs/toc-active';
import { cn } from '@/lib/utils';

export function DocsToc({
  toc,
  className,
  contentClassName,
  hideTitle = false,
  hideDivider = false,
  listClassName,
  activeLinkClassName,
  inactiveLinkClassName,
  disableDefaultDepthStyles = false,
  disableInnerScroll = false,
  titleClassName,
  dividerClassName,
}: {
  toc: TocItem[];
  className?: string;
  contentClassName?: string;
  hideTitle?: boolean;
  hideDivider?: boolean;
  listClassName?: string;
  activeLinkClassName?: string;
  inactiveLinkClassName?: string;
  disableDefaultDepthStyles?: boolean;
  disableInnerScroll?: boolean;
  titleClassName?: string;
  dividerClassName?: string;
}) {
  const pathname = usePathname();
  const copy = getDocsUiCopy(inferDocsLangFromPathname(pathname));
  const [activeId, setActiveId] = useState<string | null>(toc[0]?.id ?? null);
  const contentRef = useRef<HTMLDivElement | null>(null);

  const handleTocLinkClick = (event: MouseEvent<HTMLAnchorElement>, id: string) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.altKey ||
      event.ctrlKey ||
      event.shiftKey
    ) {
      return;
    }

    const target = document.getElementById(id);
    if (!target) {
      return;
    }

    event.preventDefault();
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });

    const nextUrl = `${window.location.pathname}${window.location.search}#${id}`;
    const currentHash = (() => {
      try {
        return decodeURIComponent(window.location.hash.slice(1));
      } catch {
        return window.location.hash.slice(1);
      }
    })();

    if (currentHash === id) {
      window.history.replaceState(null, '', nextUrl);
    } else {
      window.history.pushState(null, '', nextUrl);
    }

    setActiveId(id);
  };

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

      const scrollElement = document.scrollingElement ?? document.documentElement;
      const next = resolveActiveTocId({
        candidates,
        scrollY: window.scrollY,
        viewportHeight: window.innerHeight,
        scrollHeight: scrollElement.scrollHeight,
      });
      setActiveId(next);
    };

    updateActive();
    window.addEventListener('scroll', updateActive, { passive: true });

    return () => {
      window.removeEventListener('scroll', updateActive);
    };
  }, [toc]);

  useEffect(() => {
    if (!activeId) return;

    const content = contentRef.current;
    if (!content) return;

    const activeLink = Array.from(
      content.querySelectorAll<HTMLAnchorElement>('a[href^="#"]'),
    ).find((link) => link.getAttribute('href') === `#${activeId}`);
    if (!activeLink) return;

    const contentRect = content.getBoundingClientRect();
    const activeRect = activeLink.getBoundingClientRect();
    const padding = 12;

    if (
      activeRect.top < contentRect.top + padding ||
      activeRect.bottom > contentRect.bottom - padding
    ) {
      activeLink.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }, [activeId]);

  if (!toc.length) return null;
  return (
    <aside
      aria-label={copy.toc.title}
      className={cn(
        'hidden h-full w-[288px] shrink-0 border-l border-[color:var(--docs-toc-border,var(--fd-border))] bg-[color:var(--docs-toc-background,var(--fd-background))] px-8 py-8 lg:!block',
        className,
      )}
    >
      <div
        ref={contentRef}
        className={cn(
          disableInnerScroll ? 'pr-0' : 'max-h-[calc(100dvh-10rem)] overflow-y-auto pr-1',
          contentClassName,
        )}
      >
        {!hideTitle ? (
          <>
            <div
              className={cn(
                'text-[10px] font-semibold uppercase tracking-[0.15em] text-[color:var(--docs-toc-title,var(--fd-foreground))]',
                titleClassName,
              )}
            >
              {copy.toc.title}
            </div>
            {!hideDivider ? (
              <div
                className={cn(
                  'my-3 h-px w-full bg-[color:var(--docs-toc-divider,var(--fd-border))]',
                  dividerClassName,
                )}
              />
            ) : null}
          </>
        ) : null}
        <div className={cn('space-y-1', listClassName)}>
          {toc.map((t) => (
            <a
              key={t.id}
              href={`#${t.id}`}
              onClick={(event) => handleTocLinkClick(event, t.id)}
              data-depth={t.depth}
              aria-current={activeId === t.id ? 'location' : undefined}
              className={cn(
                'block rounded-r-md border-l-2 py-1.5 pl-3 text-[12px] leading-5 transition',
                activeId === t.id
                  ? 'border-[color:var(--docs-sidebar-active-border,var(--fd-foreground))] bg-[color:var(--docs-toc-active-background,var(--fd-muted))] font-medium text-[color:var(--docs-toc-link-active,var(--fd-foreground))]'
                  : 'border-transparent text-[color:var(--docs-toc-link,var(--fd-muted-foreground))] hover:border-fd-border hover:text-[color:var(--docs-toc-link-hover,var(--fd-foreground))]',
                activeId === t.id ? activeLinkClassName : inactiveLinkClassName,
                !disableDefaultDepthStyles
                  ? t.depth === 3
                    ? 'ml-3 text-[11px] leading-[18px]'
                    : t.depth === 4
                      ? 'ml-6 text-[11px] leading-[18px]'
                      : ''
                  : '',
              )}
            >
              {t.title}
            </a>
          ))}
        </div>
      </div>
    </aside>
  );
}
