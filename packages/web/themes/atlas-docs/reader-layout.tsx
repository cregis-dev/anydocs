'use client';

import type { CSSProperties, MouseEvent } from 'react';
import { useEffect, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Menu } from 'lucide-react';

import { DocsSidebar } from '@/components/docs/sidebar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import type { DocsThemeReaderLayoutProps } from '@/lib/themes/types';
import {
  buildTopNavHref,
  filterNavigationToGroup,
  normalizeRoutePath,
  resolveFilteredNavigation,
  resolveTopNavLabel,
} from '@/lib/themes/atlas-nav';
import { ATLAS_DOCS_THEME_CLASS_NAME } from '@/themes/atlas-docs/manifest';

function isPlainLeftClick(event: MouseEvent<HTMLAnchorElement>) {
  return !event.defaultPrevented && event.button === 0 && !(event.metaKey || event.ctrlKey || event.shiftKey || event.altKey);
}

function looksLikePrimaryActionLabel(label: string) {
  return /start|build|get started|launch|try|开始|构建|立即|体验/i.test(label);
}

function getAtlasDocsThemeStyle(siteTheme: DocsThemeReaderLayoutProps['siteTheme']) {
  const colors = siteTheme.colors ?? {};
  const style: CSSProperties & Record<string, string> = {};

  if (colors.primary) style['--atlas-primary'] = colors.primary;
  if (colors.primaryForeground) style['--atlas-primary-foreground'] = colors.primaryForeground;
  if (colors.accent) style['--atlas-accent'] = colors.accent;
  if (colors.accentForeground) style['--atlas-accent-foreground'] = colors.accentForeground;
  if (colors.sidebarActive) style['--atlas-sidebar-active'] = colors.sidebarActive;
  if (colors.sidebarActiveForeground) {
    style['--atlas-sidebar-active-foreground'] = colors.sidebarActiveForeground;
  }

  return style;
}

export function AtlasDocsReaderLayout({
  children,
  lang,
  availableLanguages,
  nav,
  pages,
  projectName,
  siteTheme,
  siteNavigation,
}: DocsThemeReaderLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const normalizedPathname = normalizeRoutePath(pathname);
  const topNav = useMemo(() => siteNavigation?.topNav ?? [], [siteNavigation]);
  const [optimisticNavState, setOptimisticNavState] = useState<{ groupId: string; sourcePath: string } | null>(null);
  const [, startTransition] = useTransition();
  const showSearch = siteTheme.chrome?.showSearch ?? true;
  const configuredSiteTitle = siteTheme.branding?.siteTitle?.trim();
  const logoSrc = siteTheme.branding?.logoSrc;
  const logoAlt = siteTheme.branding?.logoAlt;
  const siteTitle = configuredSiteTitle ?? projectName?.trim() ?? (!logoSrc ? 'Atlas Docs' : '');
  const themeStyle = getAtlasDocsThemeStyle(siteTheme);

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

  const desktopSidebar = (
    <DocsSidebar
      lang={lang}
      nav={effectiveFilteredNav}
      pages={pages}
      showHomeLink={false}
      showSearch={showSearch}
      availableLanguages={availableLanguages}
      showLanguageSwitcher
      rootFolderDisplay="section"
      className="h-full border-r-0"
    />
  );

  return (
    <div className={`${ATLAS_DOCS_THEME_CLASS_NAME} min-h-dvh bg-fd-background text-fd-foreground`} style={themeStyle}>
      <header className="sticky top-0 z-40 border-b border-fd-border bg-[color:var(--atlas-header)] backdrop-blur">
        <div className="mx-auto flex h-[60px] max-w-[1600px] items-center gap-4 px-4 sm:px-6 lg:px-8">
          <Link href={`/${lang}`} className="flex min-w-0 shrink-0 items-center gap-3">
            {logoSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoSrc}
                alt={logoAlt ?? (siteTitle ? `${siteTitle} logo` : 'Project logo')}
                className="h-7 w-auto object-contain"
              />
            ) : null}
            {siteTitle ? <span className="truncate text-[15px] font-semibold text-fd-foreground sm:text-base">{siteTitle}</span> : null}
          </Link>

          <nav className="hidden min-w-0 flex-1 items-center justify-end gap-1 overflow-x-auto lg:!flex">
            {topNavLinks.map(({ item, label, href }) => {
              const active = item.type === 'nav-group' && item.groupId === effectiveActiveGroupId;
              const cta = item.type === 'external' && looksLikePrimaryActionLabel(label);
              const className =
                'inline-flex h-9 shrink-0 items-center rounded-md border px-3 text-[13px] transition ' +
                (cta
                  ? 'border-transparent bg-[color:var(--atlas-primary)] font-semibold text-[color:var(--atlas-primary-foreground)] hover:opacity-95'
                  : active
                    ? 'border-[color:var(--atlas-top-nav-active-border)] bg-[color:var(--atlas-top-nav-active-background)] font-semibold text-fd-foreground'
                    : 'border-transparent text-[color:var(--atlas-top-nav-link)] hover:bg-[color:var(--atlas-sidebar-hover)] hover:text-fd-foreground');

              if (item.type === 'external') {
                return (
                  <a
                    key={item.id}
                    href={item.href}
                    target={item.openInNewTab ? '_blank' : undefined}
                    rel={item.openInNewTab ? 'noopener noreferrer' : undefined}
                    className={className}
                  >
                    {label}
                  </a>
                );
              }

              return (
                <Link
                  key={item.id}
                  href={href}
                  className={className}
                  onClick={(event) => handleTopNavGroupNavigate(event, item.groupId, href)}
                >
                  {label}
                </Link>
              );
            })}
          </nav>

          <Dialog>
            <DialogTrigger asChild>
              <Button variant="secondary" size="icon" className="ml-auto rounded-lg lg:!hidden">
                <Menu className="h-4 w-4" />
                <span className="sr-only">Open navigation</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="left-0 top-0 h-dvh max-w-[22rem] translate-x-0 translate-y-0 rounded-none border-r border-fd-border bg-fd-background p-0">
              <DialogTitle className="sr-only">Documentation navigation</DialogTitle>
              <DialogDescription className="sr-only">
                Browse site sections, documentation pages, and language options.
              </DialogDescription>
              <div className="border-b border-fd-border px-4 py-4">
                <div className="flex flex-wrap gap-2">
                  {topNavLinks.map(({ item, label, href }) => {
                    const cta = item.type === 'external' && looksLikePrimaryActionLabel(label);
                    if (item.type === 'external') {
                      return (
                        <a
                          key={item.id}
                          href={item.href}
                          target={item.openInNewTab ? '_blank' : undefined}
                          rel={item.openInNewTab ? 'noopener noreferrer' : undefined}
                          className={
                            cta
                              ? 'rounded-full bg-[color:var(--atlas-primary)] px-3 py-1.5 text-xs font-semibold text-[color:var(--atlas-primary-foreground)]'
                              : 'rounded-lg border border-fd-border px-3 py-1.5 text-xs text-fd-muted-foreground'
                          }
                        >
                          {label}
                        </a>
                      );
                    }

                    return (
                      <Link
                        key={item.id}
                        href={href}
                        className={
                          'rounded-lg border px-3 py-1.5 text-xs transition ' +
                          (item.groupId === effectiveActiveGroupId
                            ? 'border-[color:var(--atlas-top-nav-active-border)] bg-[color:var(--atlas-top-nav-active-background)] font-medium text-fd-foreground'
                            : 'border-transparent bg-fd-muted text-fd-muted-foreground hover:bg-fd-accent hover:text-fd-foreground')
                        }
                        onClick={(event) => handleTopNavGroupNavigate(event, item.groupId, href)}
                      >
                        {label}
                      </Link>
                    );
                  })}
                </div>
              </div>
              <DocsSidebar
                lang={lang}
                nav={effectiveFilteredNav}
                pages={pages}
                showHomeLink={false}
                showSearch={showSearch}
                availableLanguages={availableLanguages}
                showLanguageSwitcher
                rootFolderDisplay="section"
                className="h-full border-r-0"
              />
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <div className="mx-auto lg:grid lg:min-h-[calc(100dvh-60px)] lg:max-w-[1600px] lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="hidden border-r border-fd-border bg-[color:var(--atlas-sidebar-surface)] lg:col-start-1 lg:!block">
          <div className="sticky top-[60px] h-[calc(100dvh-60px)] overflow-hidden">{desktopSidebar}</div>
        </aside>
        <main className="min-w-0 bg-[color:var(--atlas-body-background)] lg:col-start-2">{children}</main>
      </div>
    </div>
  );
}
