import type { CSSProperties } from 'react';
import Link from 'next/link';
import { Menu } from 'lucide-react';

import { getDocsUiCopy } from '@/components/docs/docs-ui-copy';
import { DocsSidebar } from '@/components/docs/sidebar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import type { DocsThemeReaderLayoutProps } from '@/lib/themes/types';
import { CLASSIC_DOCS_THEME_CLASS_NAME } from '@/themes/classic-docs/manifest';

function getClassicDocsThemeStyle(siteTheme: DocsThemeReaderLayoutProps['siteTheme']) {
  const colors = siteTheme.colors ?? {};
  const style: CSSProperties & Record<string, string> = {};

  if (colors.primary) style['--classic-primary'] = colors.primary;
  if (colors.primaryForeground) style['--classic-primary-foreground'] = colors.primaryForeground;
  if (colors.accent) style['--classic-accent'] = colors.accent;
  if (colors.accentForeground) style['--classic-accent-foreground'] = colors.accentForeground;
  if (colors.sidebarActive) style['--classic-sidebar-active'] = colors.sidebarActive;
  if (colors.sidebarActiveForeground) {
    style['--classic-sidebar-active-foreground'] = colors.sidebarActiveForeground;
  }

  return style;
}

export function ClassicDocsReaderLayout({
  children,
  lang,
  availableLanguages,
  nav,
  pages,
  projectName,
  siteTheme,
}: DocsThemeReaderLayoutProps) {
  const copy = getDocsUiCopy(lang);
  const configuredSiteTitle = siteTheme.branding?.siteTitle?.trim();
  const homeLabel = siteTheme.branding?.homeLabel ?? copy.sidebar.homeLabel;
  const logoSrc = siteTheme.branding?.logoSrc;
  const logoAlt = siteTheme.branding?.logoAlt;
  const siteTitle = configuredSiteTitle ?? projectName?.trim() ?? (!logoSrc ? 'Anydocs Docs' : '');
  const showSearch = siteTheme.chrome?.showSearch ?? true;
  const themeStyle = getClassicDocsThemeStyle(siteTheme);
  const classicSidebarProps = {
    lang,
    nav,
    pages,
    homeLabel,
    showHomeLink: false,
    showSearch,
    availableLanguages,
    showLanguageSwitcher: true,
    branding: {
      siteTitle,
      logoSrc,
      logoAlt,
    },
    brandTitleClassName: 'text-[18px] font-semibold leading-6 tracking-[-0.02em]',
    searchInputClassName: 'h-9 rounded-md border bg-fd-background px-3.5 text-[13px]',
    searchResultsClassName: 'rounded-lg',
    groupSummaryClassName: 'rounded-md px-2 py-1.5',
    nestedGroupSummaryClassName: 'rounded-md px-2.5 py-1.5',
    groupTitleClassName: 'text-[13px] font-medium tracking-normal',
    groupBranchClassName: 'ml-2.5 mt-1.5 pl-2.5',
    linkClassName: 'px-2.5 py-1.5 text-[13px]',
    activeLinkClassName: 'rounded-none border-l-[3px] bg-transparent px-2.5 py-1.5 text-[13px]',
    inactiveLinkClassName: 'rounded-none border-l-[3px] px-2.5 py-1.5 text-[13px]',
    languageTriggerClassName: 'h-9 rounded-md px-3.5 text-[13px]',
    languageContentClassName: 'rounded-lg p-1.5',
    languageItemClassName: 'rounded-md py-2.5 pl-8 pr-3.5 text-[13px] font-medium',
  } as const;

  return (
    <div
      className={`${CLASSIC_DOCS_THEME_CLASS_NAME} min-h-dvh bg-fd-background text-fd-foreground`}
      style={themeStyle}
    >
      <div className="lg:grid lg:min-h-dvh lg:grid-cols-[288px_minmax(0,1fr)]">
        <div className="hidden lg:col-start-1 lg:!block">
          <DocsSidebar
            {...classicSidebarProps}
            className="sticky top-0 h-dvh"
          />
        </div>

        <div className="min-w-0 bg-fd-background lg:col-start-2">
          <div className="sticky top-0 z-30 border-b border-fd-border bg-fd-background lg:hidden">
            <div className="flex items-center justify-between px-4 py-3">
              <Link href={`/${lang}`} className="min-w-0">
                <span className="flex min-w-0 items-center gap-3">
                  {logoSrc ? (
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-fd-border bg-fd-card">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={logoSrc}
                        alt={logoAlt ?? (siteTitle ? `${siteTitle} logo` : copy.common.projectLogoAlt)}
                        className="h-full w-full object-contain"
                      />
                    </span>
                  ) : null}
                  {siteTitle ? (
                    <span className="truncate text-[15px] font-semibold leading-none tracking-[-0.01em] text-fd-foreground">
                      {siteTitle}
                    </span>
                  ) : null}
                </span>
              </Link>

              <Dialog>
                <DialogTrigger asChild>
                  <Button
                    variant="secondary"
                    size="icon"
                    className="size-8 rounded-md border-fd-border bg-fd-background shadow-none"
                  >
                    <Menu className="h-3.5 w-3.5" />
                    <span className="sr-only">{copy.common.openNavigation}</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="left-0 top-0 h-dvh max-w-[21rem] translate-x-0 translate-y-0 rounded-none border-r border-fd-border bg-fd-background p-0 shadow-none">
                  <DialogTitle className="sr-only">{copy.common.documentationNavigation}</DialogTitle>
                  <DialogDescription className="sr-only">{copy.common.navigationDialogDescription}</DialogDescription>
                  <DocsSidebar
                    {...classicSidebarProps}
                    className="h-full border-r-0 bg-fd-card"
                  />
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <main className="min-w-0">{children}</main>
        </div>
      </div>
    </div>
  );
}
