'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

import type { OpenApiNavGroup } from '@anydocs/core';

import { MethodBadge } from '@/components/docs/openapi/method-badge';
import { cn } from '@/lib/utils';
import type { DocsLang } from '@/lib/docs/types';

function normalize(path: string): string {
  return path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
}

export function ReferenceNav({
  lang,
  nav,
  overviewHref,
  overviewLabel,
}: {
  lang: DocsLang;
  nav: OpenApiNavGroup[];
  overviewHref: string;
  overviewLabel: string;
}) {
  const pathname = normalize(usePathname());
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const visiblePendingHref = pendingHref === pathname ? null : pendingHref;

  const linkBase =
    'flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] leading-5 transition';
  const active =
    'bg-[color:var(--docs-sidebar-hover,var(--fd-muted))] font-medium text-[color:var(--docs-sidebar-link,var(--fd-foreground))]';
  const inactive =
    'text-[color:var(--docs-sidebar-link-subtle,var(--fd-muted-foreground))] hover:bg-[color:var(--docs-sidebar-hover,var(--fd-muted))] hover:text-[color:var(--docs-sidebar-link,var(--fd-foreground))]';

  return (
    <nav aria-label={lang === 'zh' ? 'API 导航' : 'API navigation'} className="space-y-4 text-sm">
      <Link
        href={`/${lang}/reference`}
        prefetch={false}
        className="inline-flex items-center gap-1 text-[12px] font-medium text-fd-muted-foreground transition hover:text-fd-foreground"
      >
        <span aria-hidden>←</span>
        {lang === 'zh' ? '所有 API' : 'All APIs'}
      </Link>

      <Link
        href={overviewHref}
        prefetch={false}
        onClick={() => setPendingHref(normalize(overviewHref))}
        className={cn(
          linkBase,
          normalize(overviewHref) === pathname || visiblePendingHref === normalize(overviewHref) ? active : inactive,
          visiblePendingHref === normalize(overviewHref) && 'opacity-75',
        )}
      >
        {overviewLabel}
      </Link>

      {nav.map((group) => (
        <div key={group.tag} className="space-y-1">
          <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-fd-muted-foreground">
            {group.tag}
          </p>
          <ul className="m-0 list-none space-y-0.5 p-0">
            {group.items.map((item) => {
              const isActive = normalize(item.href) === pathname;
              const isPending = visiblePendingHref === normalize(item.href) && !isActive;
              return (
                <li key={item.operationId}>
                  <Link
                    href={item.href}
                    prefetch={false}
                    aria-current={isActive ? 'page' : undefined}
                    aria-busy={isPending ? 'true' : undefined}
                    onClick={() => setPendingHref(normalize(item.href))}
                    className={cn(linkBase, isActive || isPending ? active : inactive, isPending && 'opacity-75')}
                  >
                    <MethodBadge method={item.kind === 'webhook' ? 'WEBHOOK' : item.method} className="scale-90" />
                    <span className="min-w-0 truncate">{item.title}</span>
                    {isPending ? (
                      <span
                        aria-hidden="true"
                        className="ml-auto size-1.5 shrink-0 rounded-full bg-current opacity-70 motion-safe:animate-pulse"
                      />
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
