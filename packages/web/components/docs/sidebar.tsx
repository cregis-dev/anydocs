'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

import type { DocsLang, NavItem, NavigationDoc, PageDoc } from '@/lib/docs/types';
import { SearchPanel } from '@/components/docs/search-panel';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';

function findPage(pages: PageDoc[], pageId: string) {
  return pages.find((p) => p.id === pageId) ?? null;
}

const LANGUAGE_META: Record<string, { label: string }> = {
  en: { label: 'English' },
  es: { label: 'Español' },
  fr: { label: 'Français' },
  zh: { label: '简体中文' },
};

function getLanguageMeta(language: DocsLang) {
  return LANGUAGE_META[language] ?? { label: language.toUpperCase() };
}

function buildLanguageHref(pathname: string, currentLang: DocsLang, nextLang: DocsLang) {
  if (!pathname || pathname === `/${currentLang}`) {
    return `/${nextLang}`;
  }

  if (pathname.startsWith(`/${currentLang}/`)) {
    return `/${nextLang}${pathname.slice(currentLang.length + 1)}`;
  }

  return `/${nextLang}`;
}

function normalizeRoutePath(pathname: string) {
  if (!pathname || pathname === '/') {
    return '/';
  }

  return pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
}

function NavNode({
  lang,
  item,
  pages,
  activePageId,
  depth,
  rootFolderDisplay,
}: {
  lang: DocsLang;
  item: NavItem;
  pages: PageDoc[];
  activePageId: string | null;
  depth: number;
  rootFolderDisplay: 'collapsible' | 'section';
}) {
  if (item.type === 'section') {
    return (
      <div className="mt-6 first:mt-0">
        <div className="px-1 pb-3 text-[11px] font-semibold tracking-[0.01em] text-[color:var(--docs-sidebar-section,var(--fd-muted-foreground))]">
          {item.title}
        </div>
        <div className="space-y-1">
          {item.children.map((c, idx) => (
            <NavNode
              key={`${item.title}-${idx}`}
              lang={lang}
              item={c}
              pages={pages}
              activePageId={activePageId}
              depth={depth + 1}
              rootFolderDisplay={rootFolderDisplay}
            />
          ))}
        </div>
      </div>
    );
  }

  if (item.type === 'folder') {
    if (rootFolderDisplay === 'section' && depth === 0) {
      return (
        <div className="mt-8 first:mt-0">
          <div className="px-2 pb-3 text-[15px] font-semibold tracking-[-0.02em] text-[color:var(--docs-sidebar-group-title,var(--fd-foreground))]">
            {item.title}
          </div>
          <div className="space-y-1">
            {item.children.map((c, idx) => (
              <NavNode
                key={`${item.title}-${idx}`}
                lang={lang}
                item={c}
                pages={pages}
                activePageId={activePageId}
                depth={depth + 1}
                rootFolderDisplay={rootFolderDisplay}
              />
            ))}
          </div>
        </div>
      );
    }

    return (
      <details className="group" open>
        <summary className="cursor-pointer select-none rounded-lg px-3 py-2 text-[14px] leading-5 text-[color:var(--docs-sidebar-link-subtle,var(--fd-muted-foreground))] transition hover:bg-[color:var(--docs-sidebar-hover,var(--fd-muted))] hover:text-[color:var(--docs-sidebar-link,var(--fd-foreground))]">
          {item.title}
        </summary>
        <div className="ml-4 mt-2 space-y-1 border-l border-fd-border pl-3">
          {item.children.map((c, idx) => (
            <NavNode
              key={`${item.title}-${idx}`}
              lang={lang}
              item={c}
              pages={pages}
              activePageId={activePageId}
              depth={depth + 1}
              rootFolderDisplay={rootFolderDisplay}
            />
          ))}
        </div>
      </details>
    );
  }

  if (item.type === 'link') {
    return (
      <a
        href={item.href}
        target="_blank"
        rel="noopener noreferrer"
        className="block rounded-lg px-3 py-2 text-[14px] leading-5 text-[color:var(--docs-sidebar-link-subtle,var(--fd-muted-foreground))] transition hover:bg-[color:var(--docs-sidebar-hover,var(--fd-muted))] hover:text-[color:var(--docs-sidebar-link,var(--fd-foreground))]"
      >
        {item.title}
      </a>
    );
  }

  const page = findPage(pages, item.pageId);
  if (!page) return null;
  const active = activePageId === page.id;
  const title = item.titleOverride ?? page.title;
  return (
    <Link
      href={`/${lang}/${page.slug}`}
      className={
        (rootFolderDisplay === 'section'
          ? 'block rounded-md border border-transparent px-3 py-2 text-[13px] leading-5 transition '
          : 'block rounded-r-md rounded-l-none px-3 py-2 text-[14px] leading-5 transition ') +
        (active
          ? rootFolderDisplay === 'section'
            ? 'border-l-2 border-l-[color:var(--docs-sidebar-active-border,var(--fd-foreground))] bg-[color:var(--docs-sidebar-active-background,var(--fd-muted))] font-medium text-[color:var(--docs-sidebar-active-foreground,var(--fd-foreground))]'
            : 'border-l-4 border-[color:var(--docs-sidebar-active-border,var(--fd-foreground))] bg-[color:var(--docs-sidebar-active-background,var(--fd-muted))] font-medium text-[color:var(--docs-sidebar-active-foreground,var(--fd-foreground))]'
          : rootFolderDisplay === 'section'
            ? 'text-[color:var(--docs-sidebar-link-subtle,var(--fd-muted-foreground))] hover:bg-[color:var(--docs-sidebar-hover,var(--fd-muted))] hover:text-[color:var(--docs-sidebar-link,var(--fd-foreground))]'
            : 'border-l-4 border-transparent text-[color:var(--docs-sidebar-link-subtle,var(--fd-muted-foreground))] hover:bg-[color:var(--docs-sidebar-hover,var(--fd-muted))] hover:text-[color:var(--docs-sidebar-link,var(--fd-foreground))]')
      }
      aria-current={active ? 'page' : undefined}
    >
      {title}
    </Link>
  );
}

type DocsSidebarProps = {
  lang: DocsLang;
  nav: NavigationDoc;
  pages: PageDoc[];
  homeLabel?: string;
  showHomeLink?: boolean;
  showSearch?: boolean;
  branding?: {
    siteTitle?: string;
    logoSrc?: string;
    logoAlt?: string;
  };
  availableLanguages?: DocsLang[];
  showLanguageSwitcher?: boolean;
  className?: string;
  rootFolderDisplay?: 'collapsible' | 'section';
  insetClassName?: string;
  fillHeight?: boolean;
};

export function DocsSidebar({
  lang,
  nav,
  pages,
  homeLabel,
  showHomeLink = true,
  showSearch = true,
  branding,
  availableLanguages = [],
  showLanguageSwitcher = false,
  className,
  rootFolderDisplay = 'collapsible',
  insetClassName,
  fillHeight = true,
}: DocsSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const normalizedPathname = normalizeRoutePath(pathname);
  const activePageId = (() => {
    for (const p of pages) {
      const href = `/${lang}/${p.slug}`;
      if (normalizedPathname === normalizeRoutePath(href)) return p.id;
    }
    return null;
  })();
  const siteTitle = branding?.siteTitle?.trim() ?? '';
  const hasLogo = Boolean(branding?.logoSrc);
  const hasTitle = siteTitle.length > 0;
  const showBranding = hasLogo || hasTitle;
  const showLanguageLinks = showLanguageSwitcher && availableLanguages.length > 1;
  const activeLanguageMeta = getLanguageMeta(lang);

  return (
    <aside className={cn('flex flex-col border-r border-fd-border bg-fd-card', fillHeight && 'h-full', className)}>
      {showBranding ? (
        <Link
          href={`/${lang}`}
          className={cn(
            'px-6 pt-6 transition hover:opacity-85',
            insetClassName,
            hasLogo && hasTitle && 'flex items-center gap-3',
            hasLogo && !hasTitle && 'inline-flex items-center',
            !hasLogo && hasTitle && 'block',
          )}
        >
          {hasLogo ? (
            <span
              className={cn(
                'flex shrink-0 items-center justify-center overflow-hidden',
                hasTitle ? 'h-10 w-10 rounded-2xl' : 'h-12 w-12 rounded-2xl',
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={branding?.logoSrc}
                alt={branding?.logoAlt ?? (hasTitle ? `${siteTitle} logo` : 'Project logo')}
                className="h-full w-full object-contain"
              />
            </span>
          ) : null}

          {hasTitle ? (
            <span className={cn('min-w-0', !hasLogo && 'block')}>
              <span className="block break-words text-[20px] font-bold leading-7 tracking-[-0.025em] text-fd-foreground">
                {siteTitle}
              </span>
            </span>
          ) : null}
        </Link>
      ) : null}

      {showSearch ? (
        <div className={cn('px-6 pt-4', insetClassName)}>
          <SearchPanel
            lang={lang}
            inputClassName="h-10 rounded-lg border-[color:var(--docs-search-border,var(--fd-border))] bg-[color:var(--docs-search-background,var(--fd-muted))] px-4 text-sm text-[color:var(--docs-body-copy,var(--fd-foreground))] placeholder:text-[color:var(--docs-search-placeholder,var(--fd-muted-foreground))]"
            resultsClassName="rounded-xl border-fd-border bg-fd-background shadow-lg"
          />
        </div>
      ) : null}

      <div
        className={cn(
          'px-6 pb-6 pt-5',
          fillHeight ? 'flex-1 overflow-y-auto' : 'overflow-visible',
          insetClassName,
        )}
      >
        <div>
          {nav.items.map((item, idx) => (
            <NavNode
              key={idx}
              lang={lang}
              item={item}
              pages={pages}
              activePageId={activePageId}
              depth={0}
              rootFolderDisplay={rootFolderDisplay}
            />
          ))}
        </div>
      </div>

      <div className={cn('space-y-4 border-t border-fd-border px-6 py-6 text-xs text-fd-muted-foreground', insetClassName)}>
        {showHomeLink ? (
          <div className="flex items-center justify-between gap-3">
            <Link href={`/${lang}`} className="font-medium text-fd-foreground transition hover:text-fd-primary">
              {homeLabel ?? 'Docs Home'}
            </Link>
          </div>
        ) : null}

        {showLanguageLinks ? (
          <div>
            <Select
              value={lang}
              onValueChange={(value) => {
                const nextLang = value as DocsLang;
                if (nextLang === lang) {
                  return;
                }
                router.push(buildLanguageHref(pathname, lang, nextLang));
              }}
            >
              <SelectTrigger className="inline-flex h-10 w-full min-w-0 rounded-xl border-fd-border bg-[color:var(--docs-sidebar-brand-surface,var(--fd-background))] px-4 text-sm font-normal text-[color:var(--docs-sidebar-link,var(--fd-foreground))] shadow-none">
                <span className="truncate pr-2">{activeLanguageMeta.label}</span>
              </SelectTrigger>
              <SelectContent className="min-w-[12rem] rounded-[1.25rem] border-fd-border bg-fd-popover p-2 shadow-lg">
                {availableLanguages.map((language) => {
                  const languageMeta = getLanguageMeta(language);

                  return (
                    <SelectItem
                      key={language}
                      value={language}
                      className="rounded-xl py-3 pl-8 pr-4 text-sm font-medium focus:bg-[color:var(--docs-sidebar-hover,var(--fd-muted))]"
                    >
                      <span>{languageMeta.label}</span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
