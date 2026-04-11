import type { CSSProperties } from 'react';
import Link from 'next/link';
import { Menu } from 'lucide-react';

import { DocsSidebar } from '@/components/docs/sidebar';
import { getDocsUiCopy } from '@/components/docs/docs-ui-copy';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import type { DocsThemeReaderLayoutProps } from '@/lib/themes/types';
import { cn } from '@/lib/utils';
import { BLUEPRINT_REVIEW_THEME_CLASS_NAME } from '@/themes/blueprint-review/manifest';

function getBlueprintReviewThemeStyle(siteTheme: DocsThemeReaderLayoutProps['siteTheme']) {
  const colors = siteTheme.colors ?? {};
  const style: CSSProperties & Record<string, string> = {};

  // Keep this theme intentionally restrained: allow only a single accent override.
  if (colors.primary) style['--blueprint-accent'] = colors.primary;

  return style;
}

export function BlueprintReviewReaderLayout({
  children,
  lang,
  availableLanguages,
  nav,
  pages,
  searchIndexHref,
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
  const themeStyle = getBlueprintReviewThemeStyle(siteTheme);

  const desktopSidebar = (
    <DocsSidebar
      lang={lang}
      nav={nav}
      pages={pages}
      searchIndexHref={searchIndexHref}
      homeLabel={homeLabel}
      showHomeLink={false}
      showSearch={showSearch}
      availableLanguages={availableLanguages}
      showLanguageSwitcher
      rootFolderDisplay="collapsible"
      branding={{
        siteTitle,
        logoSrc,
        logoAlt,
      }}
      className="h-dvh border-r-0 bg-[color:color-mix(in_srgb,var(--blueprint-sidebar,#faf8f3)_92%,white)]"
      insetClassName="px-5 pt-5"
      searchWrapperClassName="pt-3"
      searchPlaceholder={copy.sidebar.searchPlaceholder}
      searchInputClassName="h-10 rounded-2xl border-[color:var(--docs-search-border,var(--fd-border))] bg-[color:var(--docs-search-background,var(--fd-muted))] px-3.5 text-[13px] shadow-none"
      searchResultsClassName="rounded-2xl border-[color:var(--docs-search-border,var(--fd-border))] bg-white p-1 shadow-[0_16px_50px_rgba(15,23,42,0.10)]"
      navWrapperClassName="pt-3"
      navListClassName="space-y-1"
      footerClassName="bg-transparent pb-4 pt-3 shadow-none"
    />
  );

  return (
    <div className={cn(BLUEPRINT_REVIEW_THEME_CLASS_NAME, 'min-h-dvh text-fd-foreground')} style={themeStyle}>
      <div className="xl:grid xl:min-h-dvh xl:grid-cols-[272px_minmax(0,1fr)] 2xl:grid-cols-[300px_minmax(0,1fr)]">
        <div className="hidden border-r xl:col-start-1 xl:!block" data-blueprint-divider>
          <div className="sticky top-0 h-dvh overflow-hidden">
            {desktopSidebar}
          </div>
        </div>

        <div className="min-w-0 xl:col-start-2 xl:px-8 2xl:px-12">
          <div
            className="sticky top-0 z-30 border-b bg-[color:color-mix(in_srgb,var(--fd-background)_72%,white)] backdrop-blur-xl xl:hidden"
            data-blueprint-divider
          >
            <div className="flex items-center justify-between px-4 py-3.5">
              <Link href={`/${lang}`} className="min-w-0">
                <span className="flex min-w-0 items-center gap-3">
                  {logoSrc ? (
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-fd-border bg-fd-card">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={logoSrc}
                        alt={logoAlt ?? (siteTitle ? `${siteTitle} logo` : copy.common.projectLogoAlt)}
                        className="h-full w-full object-contain"
                      />
                    </span>
                  ) : null}
                  {siteTitle ? (
                    <span className="truncate text-base font-semibold leading-none text-fd-foreground">{siteTitle}</span>
                  ) : null}
                </span>
              </Link>

              <Dialog>
                <DialogTrigger asChild>
                  <Button
                    variant="secondary"
                    size="icon"
                    className="rounded-xl border-[color:var(--blueprint-divider)] bg-fd-card shadow-sm"
                  >
                    <Menu className="h-4 w-4" />
                    <span className="sr-only">{copy.common.openNavigation}</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="left-0 top-0 h-dvh max-w-[23rem] translate-x-0 translate-y-0 rounded-none border-r border-[color:var(--blueprint-divider)] bg-fd-background p-0 shadow-[0_24px_80px_rgba(15,23,42,0.18)]">
                  <DialogTitle className="sr-only">{copy.common.documentationNavigation}</DialogTitle>
                  <DialogDescription className="sr-only">{copy.common.navigationDialogDescription}</DialogDescription>
                  <DocsSidebar
                    lang={lang}
                    nav={nav}
                    pages={pages}
                    searchIndexHref={searchIndexHref}
                    homeLabel={homeLabel}
                    showHomeLink={false}
                    showSearch={showSearch}
                    availableLanguages={availableLanguages}
                    showLanguageSwitcher
                    rootFolderDisplay="collapsible"
                    branding={{
                      siteTitle,
                      logoSrc,
                      logoAlt,
                    }}
                    className="h-full border-r-0 bg-[color:color-mix(in_srgb,var(--blueprint-sidebar,#faf8f3)_92%,white)]"
                    insetClassName="px-5 pt-5"
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
