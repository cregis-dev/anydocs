'use client';

import type { CSSProperties, MouseEvent } from 'react';
import { useEffect, useMemo, useState, useTransition } from 'react';
import type { ProjectSiteTopNavItem } from '@anydocs/core';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Menu } from 'lucide-react';

import { getDocsUiCopy } from '@/components/docs/docs-ui-copy';
import { SearchPanel } from '@/components/docs/search-panel';
import { DocsSidebar } from '@/components/docs/sidebar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import type { DocsThemeReaderLayoutProps } from '@/lib/themes/types';
import { cn } from '@/lib/utils';
import {
  buildTopNavHref,
  buildLanguageHref,
  filterNavigationToGroup,
  normalizeRoutePath,
  resolveFilteredNavigation,
  resolveTopNavLabel,
} from '@/lib/themes/atlas-nav';
import { ATLAS_DOCS_THEME_CLASS_NAME } from '@/themes/atlas-docs/manifest';

function isPlainLeftClick(event: MouseEvent<HTMLAnchorElement>) {
  return !event.defaultPrevented && event.button === 0 && !(event.metaKey || event.ctrlKey || event.shiftKey || event.altKey);
}

function getAtlasDocsThemeStyle(siteTheme: DocsThemeReaderLayoutProps['siteTheme']) {
  const colors = siteTheme.colors ?? {};
  const style: CSSProperties & Record<string, string> = {};

  if (colors.primary) style['--atlas-primary'] = colors.primary;
  if (colors.primaryForeground) style['--atlas-primary-foreground'] = colors.primaryForeground;
  if (colors.accent) style['--atlas-accent'] = colors.accent;
  if (colors.accentForeground) style['--atlas-accent-foreground'] = colors.accentForeground;

  return style;
}

const LANGUAGE_META: Record<string, { label: string }> = {
  en: { label: 'English' },
  es: { label: 'Español' },
  fr: { label: 'Français' },
  zh: { label: '简体中文' },
};

function getLanguageLabel(language: string) {
  return LANGUAGE_META[language]?.label ?? language.toUpperCase();
}

type TopNavLinkEntry = {
  item: ProjectSiteTopNavItem;
  label: string;
  href: string;
};

type TopNavGroupEntry = TopNavLinkEntry & {
  item: Extract<ProjectSiteTopNavItem, { type: 'nav-group' }>;
};

type TopNavExternalEntry = TopNavLinkEntry & {
  item: Extract<ProjectSiteTopNavItem, { type: 'external' }>;
};

export function AtlasDocsReaderLayout({
  children,
  lang,
  availableLanguages,
  nav,
  pages,
  searchIndexHref,
  projectName,
  siteTheme,
  siteNavigation,
}: DocsThemeReaderLayoutProps) {
  const copy = getDocsUiCopy(lang);
  const router = useRouter();
  const pathname = usePathname();
  const normalizedPathname = normalizeRoutePath(pathname);
  const referenceRoot = normalizeRoutePath(`/${lang}/reference`);
  const isReferenceRoute =
    normalizedPathname === referenceRoot || normalizedPathname.startsWith(`${referenceRoot}/`);
  const topNav = useMemo(() => siteNavigation?.topNav ?? [], [siteNavigation]);
  const [optimisticNavState, setOptimisticNavState] = useState<{ groupId: string; sourcePath: string } | null>(null);
  const [, startTransition] = useTransition();
  const showSearch = siteTheme.chrome?.showSearch ?? true;
  const configuredSiteTitle = siteTheme.branding?.siteTitle?.trim();
  const logoSrc = siteTheme.branding?.logoSrc;
  const logoAlt = siteTheme.branding?.logoAlt;
  const siteTitle = configuredSiteTitle ?? projectName?.trim() ?? (!logoSrc ? 'Atlas Docs' : '');
  const themeStyle = getAtlasDocsThemeStyle(siteTheme);
  const showLanguageSwitcher = availableLanguages.length > 1;
  const activeLanguageLabel = getLanguageLabel(lang);

  const activePageId = useMemo(() => {
    for (const page of pages) {
      const href = `/${lang}/${page.slug}`;
      if (normalizedPathname === normalizeRoutePath(href)) {
        return page.id;
      }
    }

    return null;
  }, [lang, normalizedPathname, pages]);

  const { activeGroupId, filteredNav } = useMemo(
    () => resolveFilteredNavigation(nav, topNav, activePageId),
    [activePageId, nav, topNav],
  );

  const topNavLinks = useMemo(
    () =>
      topNav.map((item) => ({
        item,
        label: resolveTopNavLabel(item.label, lang),
        href: buildTopNavHref(item, lang, nav, pages),
      })),
    [lang, nav, pages, topNav],
  );

  const domainNavLinks = useMemo(
    () => topNavLinks.filter(
      (entry): entry is TopNavGroupEntry | TopNavExternalEntry =>
        entry.item.type === 'nav-group' ||
        (entry.item.type === 'external' && entry.item.href.startsWith('/')),
    ),
    [topNavLinks],
  );

  const utilityNavLinks = useMemo(
    () => topNavLinks.filter(
      (entry): entry is TopNavExternalEntry =>
        entry.item.type === 'external' && !entry.item.href.startsWith('/'),
    ),
    [topNavLinks],
  );

  useEffect(() => {
    for (const entry of topNavLinks) {
      if (entry.item.type === 'nav-group') {
        router.prefetch(entry.href);
      }
    }
  }, [router, topNavLinks]);

  const effectiveActiveGroupId =
    optimisticNavState && optimisticNavState.sourcePath === pathname ? optimisticNavState.groupId : activeGroupId;
  const effectiveFilteredNav = useMemo(() => {
    if (!effectiveActiveGroupId) {
      return filteredNav;
    }

    return filterNavigationToGroup(nav, effectiveActiveGroupId);
  }, [effectiveActiveGroupId, filteredNav, nav]);

  const handleTopNavGroupNavigate = (event: MouseEvent<HTMLAnchorElement>, groupId: string, href: string) => {
    if (!isPlainLeftClick(event)) {
      return;
    }

    event.preventDefault();
    setOptimisticNavState({ groupId, sourcePath: pathname });
    router.prefetch(href);
    startTransition(() => {
      router.push(href);
    });
  };

  const isTopNavEntryActive = (entry: TopNavLinkEntry) =>
    (entry.item.type === 'nav-group' && entry.item.groupId === effectiveActiveGroupId) ||
    (entry.item.type === 'external' &&
      entry.item.href.startsWith('/') &&
      (normalizedPathname === normalizeRoutePath(entry.item.href) ||
        normalizedPathname.startsWith(`${normalizeRoutePath(entry.item.href)}/`)));

  const headerOffset = domainNavLinks.length > 0 ? 108 : 60;

  const desktopSidebar = (
    <DocsSidebar
      lang={lang}
      nav={effectiveFilteredNav}
      pages={pages}
      showHomeLink={false}
      showSearch={false}
      availableLanguages={availableLanguages}
      showLanguageSwitcher={false}
      rootFolderDisplay="section"
      className="h-full border-r-0 bg-[color:var(--atlas-sidebar-surface)]"
      navWrapperClassName="px-3 pb-8 pt-7"
      navListClassName="space-y-1"
      footerClassName="border-t-[color:color-mix(in_srgb,var(--fd-border)_82%,white)] bg-[color:var(--atlas-sidebar-surface)] pb-4 pt-3 shadow-none"
      groupSummaryClassName="rounded-2xl px-2.5 py-2.5"
      nestedGroupSummaryClassName="rounded-xl px-3 py-2"
      groupTitleClassName="tracking-[-0.01em]"
      groupBranchClassName="ml-4 pl-4"
      sectionHeadingClassName="px-2.5 pb-2 text-[15px] font-semibold tracking-[-0.02em] text-fd-foreground"
      linkClassName="rounded-xl px-3.5 py-2 text-[14px] tracking-[-0.01em]"
      activeLinkClassName="bg-[color:var(--atlas-sidebar-active-background)] text-[color:var(--docs-sidebar-active-foreground,var(--fd-foreground))] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--atlas-sidebar-active-border)_55%,white)]"
      inactiveLinkClassName="text-[color:var(--docs-sidebar-link,var(--fd-foreground))] hover:bg-[color:var(--atlas-sidebar-hover)] hover:text-fd-foreground"
    />
  );

  return (
    <div className={`${ATLAS_DOCS_THEME_CLASS_NAME} min-h-dvh bg-fd-background text-fd-foreground`} style={themeStyle}>
      <header className="sticky top-0 z-40 bg-[color:var(--atlas-header)] backdrop-blur">
        <div className="border-b border-[color:color-mix(in_srgb,var(--fd-border)_78%,white)]">
          <div className="mx-auto flex h-[64px] max-w-[1600px] items-center gap-4 px-4 sm:px-6 lg:px-8">
            <Link href={`/${lang}`} className="flex min-w-0 shrink-0 items-center gap-3">
              {logoSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoSrc}
                  alt={logoAlt ?? (siteTitle ? `${siteTitle} logo` : copy.common.projectLogoAlt)}
                  className="h-7 w-auto object-contain"
                />
              ) : null}
              {siteTitle ? <span className="truncate text-[15px] font-semibold text-fd-foreground sm:text-base">{siteTitle}</span> : null}
            </Link>

            {showSearch ? (
              <div className="hidden min-w-0 flex-1 lg:!flex lg:justify-center">
                <SearchPanel
                  lang={lang}
                  indexHref={searchIndexHref}
                  placeholder={copy.sidebar.searchPlaceholder}
                  className="relative w-full max-w-[520px]"
                  inputClassName="h-11 rounded-2xl border-[color:var(--docs-search-border,var(--fd-border))] bg-[color:var(--atlas-search-background)] px-4 text-[14px] shadow-[0_1px_2px_rgba(15,23,42,0.03)]"
                  resultsClassName="absolute left-0 right-0 top-full z-50 mt-2 max-h-[min(28rem,calc(100dvh-7rem))] rounded-2xl border-[color:var(--docs-search-border,var(--fd-border))] bg-white p-1 shadow-[0_18px_40px_rgba(15,23,42,0.10)]"
                />
              </div>
            ) : (
              <div className="hidden flex-1 lg:!block" />
            )}

            <div className="hidden shrink-0 items-center gap-1 lg:!flex">
              {utilityNavLinks.map((entry) => {
                const active = isTopNavEntryActive(entry);
                const className = cn(
                  'inline-flex h-9 items-center rounded-xl px-3 text-[13px] font-medium tracking-[-0.01em] transition-colors duration-200',
                  active
                    ? 'bg-[color:var(--atlas-top-nav-active-background)] text-fd-foreground ring-1 ring-inset ring-[color:var(--atlas-top-nav-active-border)]'
                    : 'text-[color:var(--atlas-top-nav-link)] hover:bg-[color:var(--atlas-sidebar-hover)] hover:text-fd-foreground',
                );

                if (entry.item.href.startsWith('/') && !entry.item.openInNewTab) {
                  return (
                    <Link key={entry.item.id} href={entry.item.href} className={className}>
                      {entry.label}
                    </Link>
                  );
                }

                return (
                  <a
                    key={entry.item.id}
                    href={entry.item.href}
                    target={entry.item.openInNewTab ? '_blank' : undefined}
                    rel={entry.item.openInNewTab ? 'noopener noreferrer' : undefined}
                    className={className}
                  >
                    {entry.label}
                  </a>
                );
              })}

              {showLanguageSwitcher ? (
                <Select
                  value={lang}
                  onValueChange={(value) => {
                    const nextLang = value as typeof lang;
                    if (nextLang === lang) {
                      return;
                    }

                    router.push(buildLanguageHref(pathname, lang, nextLang));
                  }}
                >
                  <SelectTrigger className="inline-flex h-9 min-w-[9.5rem] rounded-xl border-[color:var(--docs-divider,var(--fd-border))] bg-white px-3 text-[13px] font-medium text-[color:var(--atlas-top-nav-link)] shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
                    <span className="truncate pr-2">{activeLanguageLabel}</span>
                  </SelectTrigger>
                  <SelectContent className="min-w-[12rem] rounded-xl border-[color:var(--docs-divider,var(--fd-border))] bg-fd-popover p-2 shadow-lg">
                    {availableLanguages.map((language) => (
                      <SelectItem
                        key={language}
                        value={language}
                        className="rounded-lg py-2.5 pl-8 pr-4 text-sm font-medium focus:bg-[color:var(--docs-sidebar-hover,var(--fd-muted))]"
                      >
                        <span>{getLanguageLabel(language)}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}
            </div>

            <Dialog>
              <DialogTrigger asChild>
                <Button variant="secondary" size="icon" className="ml-auto rounded-lg lg:!hidden">
                  <Menu className="h-4 w-4" />
                  <span className="sr-only">{copy.common.openNavigation}</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="left-0 top-0 h-dvh max-w-[20.5rem] translate-x-0 translate-y-0 rounded-none border-r border-fd-border bg-fd-background p-0">
                <DialogTitle className="sr-only">{copy.common.documentationNavigation}</DialogTitle>
                <DialogDescription className="sr-only">{copy.common.navigationDialogDescription}</DialogDescription>
                <div className="space-y-3 border-b border-fd-border px-3 py-3">
                  {showSearch ? (
                    <SearchPanel
                      lang={lang}
                      placeholder={copy.sidebar.searchPlaceholder}
                      className="relative"
                      inputClassName="h-10 rounded-xl border-[color:var(--docs-search-border,var(--fd-border))] bg-[color:var(--atlas-search-background)] px-3.5 text-[13px] shadow-[0_1px_2px_rgba(15,23,42,0.03)]"
                      resultsClassName="absolute left-0 right-0 top-full z-50 mt-2 rounded-xl border-[color:var(--docs-search-border,var(--fd-border))] bg-white p-1 shadow-[0_18px_40px_rgba(15,23,42,0.10)]"
                    />
                  ) : null}

                  {showLanguageSwitcher ? (
                    <Select
                      value={lang}
                      onValueChange={(value) => {
                        const nextLang = value as typeof lang;
                        if (nextLang === lang) {
                          return;
                        }

                        router.push(buildLanguageHref(pathname, lang, nextLang));
                      }}
                    >
                      <SelectTrigger className="inline-flex h-10 w-full rounded-xl border-[color:var(--docs-divider,var(--fd-border))] bg-white px-3 text-[13px] font-medium text-[color:var(--atlas-top-nav-link)] shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
                        <span className="truncate pr-2">{activeLanguageLabel}</span>
                      </SelectTrigger>
                      <SelectContent className="min-w-[12rem] rounded-xl border-[color:var(--docs-divider,var(--fd-border))] bg-fd-popover p-2 shadow-lg">
                        {availableLanguages.map((language) => (
                          <SelectItem
                            key={language}
                            value={language}
                            className="rounded-lg py-2.5 pl-8 pr-4 text-sm font-medium focus:bg-[color:var(--docs-sidebar-hover,var(--fd-muted))]"
                          >
                            <span>{getLanguageLabel(language)}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : null}

                  {utilityNavLinks.length ? (
                    <div className="flex flex-wrap gap-2">
                      {utilityNavLinks.map((entry) => {
                        const active = isTopNavEntryActive(entry);
                        const className = cn(
                          'inline-flex min-h-10 items-center justify-center rounded-lg px-3 py-2 text-center text-[12px] font-medium leading-4 transition-colors duration-200',
                          active
                            ? 'bg-[color:var(--atlas-top-nav-active-background)] text-fd-foreground ring-1 ring-inset ring-[color:var(--atlas-top-nav-active-border)]'
                            : 'text-[color:var(--atlas-top-nav-link)] hover:bg-[color:var(--atlas-sidebar-hover)] hover:text-fd-foreground',
                        );

                        if (entry.item.href.startsWith('/') && !entry.item.openInNewTab) {
                          return (
                            <Link key={entry.item.id} href={entry.item.href} className={className}>
                              {entry.label}
                            </Link>
                          );
                        }

                        return (
                          <a
                            key={entry.item.id}
                            href={entry.item.href}
                            target={entry.item.openInNewTab ? '_blank' : undefined}
                            rel={entry.item.openInNewTab ? 'noopener noreferrer' : undefined}
                            className={className}
                          >
                            {entry.label}
                          </a>
                        );
                      })}
                    </div>
                  ) : null}

                  {domainNavLinks.length ? (
                    <div className="grid grid-cols-2 gap-2">
                      {domainNavLinks.map((entry) => {
                        const active = isTopNavEntryActive(entry);
                        const mobileLinkClassName = cn(
                          'flex min-h-10 items-center justify-center rounded-lg px-3 py-2 text-center text-[11px] font-medium leading-4 transition-colors duration-200',
                          active
                            ? 'bg-[color:var(--atlas-top-nav-active-background)] text-fd-foreground ring-1 ring-inset ring-[color:var(--atlas-top-nav-active-border)]'
                            : 'text-fd-muted-foreground hover:bg-[color:var(--atlas-sidebar-hover)] hover:text-fd-foreground',
                        );

                        if (entry.item.type === 'nav-group') {
                          return (
                            <Link
                              key={entry.item.id}
                              href={entry.href}
                              className={mobileLinkClassName}
                              onClick={(event) => handleTopNavGroupNavigate(event, (entry as TopNavGroupEntry).item.groupId, entry.href)}
                            >
                              {entry.label}
                            </Link>
                          );
                        }
                        if (entry.href.startsWith('/') && !entry.item.openInNewTab) {
                          return (
                            <Link key={entry.item.id} href={entry.href} className={mobileLinkClassName}>
                              {entry.label}
                            </Link>
                          );
                        }

                        return (
                          <a
                            key={entry.item.id}
                            href={entry.href}
                            target={entry.item.openInNewTab ? '_blank' : undefined}
                            rel={entry.item.openInNewTab ? 'noopener noreferrer' : undefined}
                            className={mobileLinkClassName}
                          >
                            {entry.label}
                          </a>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
                {!isReferenceRoute ? (
                  <DocsSidebar
                    lang={lang}
                    nav={effectiveFilteredNav}
                    pages={pages}
                    searchIndexHref={searchIndexHref}
                    showHomeLink={false}
                    showSearch={false}
                    availableLanguages={availableLanguages}
                    showLanguageSwitcher={false}
                    rootFolderDisplay="section"
                    className="h-full border-r-0 bg-[color:var(--atlas-sidebar-surface)]"
                    navWrapperClassName="pt-4"
                    navListClassName="space-y-1"
                    footerClassName="border-t-[color:color-mix(in_srgb,var(--fd-border)_82%,white)] bg-[color:var(--atlas-sidebar-surface)] pb-4 pt-3 shadow-none"
                  />
                ) : null}
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {domainNavLinks.length ? (
          <div className="hidden border-b border-[color:color-mix(in_srgb,var(--fd-border)_78%,white)] lg:!block">
            <div className="mx-auto flex h-[50px] max-w-[1600px] items-stretch px-4 sm:px-6 lg:px-8">
              <nav className="flex h-full min-w-0 items-stretch gap-7 overflow-x-auto">
                {domainNavLinks.map((entry) => {
                  const active = isTopNavEntryActive(entry);
                  const linkClassName = cn(
                    'inline-flex h-full shrink-0 items-center border-b-2 border-transparent px-0 pb-[8px] pt-[2px] text-[15px] tracking-[-0.015em] transition-colors duration-200',
                    active
                      ? 'border-[color:var(--atlas-foreground)] font-semibold text-fd-foreground'
                      : 'font-medium text-[color:var(--atlas-top-nav-link)] hover:text-fd-foreground',
                  );

                  if (entry.item.type === 'nav-group') {
                    return (
                      <Link
                        key={entry.item.id}
                        href={entry.href}
                        className={linkClassName}
                        onClick={(event) => handleTopNavGroupNavigate(event, (entry as TopNavGroupEntry).item.groupId, entry.href)}
                      >
                        {entry.label}
                      </Link>
                    );
                  }
                  if (entry.href.startsWith('/') && !entry.item.openInNewTab) {
                    return (
                      <Link key={entry.item.id} href={entry.href} className={linkClassName}>
                        {entry.label}
                      </Link>
                    );
                  }

                  return (
                    <a
                      key={entry.item.id}
                      href={entry.href}
                      target={entry.item.openInNewTab ? '_blank' : undefined}
                      rel={entry.item.openInNewTab ? 'noopener noreferrer' : undefined}
                      className={linkClassName}
                    >
                      {entry.label}
                    </a>
                  );
                })}
              </nav>
            </div>
          </div>
        ) : null}
      </header>

      <div
        className={cn(
          'mx-auto lg:!max-w-[1600px]',
          !isReferenceRoute && 'lg:!grid lg:!grid-cols-[296px_minmax(0,1fr)]',
        )}
        style={{ minHeight: `calc(100dvh - ${headerOffset}px)` }}
      >
        {!isReferenceRoute ? (
          <aside className="hidden border-r border-[color:color-mix(in_srgb,var(--fd-border)_74%,white)] bg-[color:var(--atlas-sidebar-surface)] lg:col-start-1 lg:!block">
            <div className="sticky overflow-hidden" style={{ top: `${headerOffset}px`, height: `calc(100dvh - ${headerOffset}px)` }}>
              {desktopSidebar}
            </div>
          </aside>
        ) : null}
        <main className={cn('min-w-0 bg-[color:var(--atlas-body-background)]', !isReferenceRoute && 'lg:col-start-2')}>
          {children}
        </main>
      </div>
    </div>
  );
}
