import type { CSSProperties } from 'react';
import Link from 'next/link';
import { Menu } from 'lucide-react';

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
  const configuredSiteTitle = siteTheme.branding?.siteTitle?.trim();
  const homeLabel = siteTheme.branding?.homeLabel ?? 'Docs Home';
  const logoSrc = siteTheme.branding?.logoSrc;
  const logoAlt = siteTheme.branding?.logoAlt;
  const siteTitle = configuredSiteTitle ?? projectName?.trim() ?? (!logoSrc ? 'Anydocs Docs' : '');
  const showSearch = siteTheme.chrome?.showSearch ?? true;
  const themeStyle = getClassicDocsThemeStyle(siteTheme);

  return (
    <div
      className={`${CLASSIC_DOCS_THEME_CLASS_NAME} min-h-dvh bg-fd-background text-fd-foreground`}
      style={themeStyle}
    >
      <div className="lg:grid lg:min-h-dvh lg:grid-cols-[256px_minmax(0,1fr)]">
        <div className="hidden lg:block">
          <DocsSidebar
            lang={lang}
            nav={nav}
            pages={pages}
            homeLabel={homeLabel}
            showHomeLink={false}
            showSearch={showSearch}
            availableLanguages={availableLanguages}
            showLanguageSwitcher
            branding={{
              siteTitle,
              logoSrc,
              logoAlt,
            }}
            className="sticky top-0 h-dvh"
          />
        </div>

        <div className="min-w-0 bg-fd-background">
          <div className="sticky top-0 z-30 border-b border-fd-border bg-fd-background/90 backdrop-blur lg:hidden">
            <div className="flex items-center justify-between px-4 py-3">
              <Link href={`/${lang}`} className="min-w-0">
                <span className="flex min-w-0 items-center gap-3">
                  {logoSrc ? (
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={logoSrc}
                        alt={logoAlt ?? (siteTitle ? `${siteTitle} logo` : 'Project logo')}
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
                  <Button variant="secondary" size="icon" className="rounded-xl">
                    <Menu className="h-4 w-4" />
                    <span className="sr-only">Open navigation</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="left-0 top-0 h-dvh max-w-[22rem] translate-x-0 translate-y-0 rounded-none border-r border-fd-border bg-fd-background p-0">
                  <DialogTitle className="sr-only">Documentation navigation</DialogTitle>
                  <DialogDescription className="sr-only">
                    Browse pages, search the docs, and switch languages.
                  </DialogDescription>
                  <DocsSidebar
                    lang={lang}
                    nav={nav}
                    pages={pages}
                    homeLabel={homeLabel}
                    showHomeLink={false}
                    showSearch={showSearch}
                    availableLanguages={availableLanguages}
                    showLanguageSwitcher
                    branding={{
                      siteTitle,
                      logoSrc,
                      logoAlt,
                    }}
                    className="h-full border-r-0"
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
