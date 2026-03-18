import Link from 'next/link';

import { DocsSidebar } from '@/components/docs/sidebar';
import type { DocsThemeReaderLayoutProps } from '@/lib/themes/types';
import { PAPER_DOCS_THEME_CLASS_NAME } from '@/themes/paper-docs/manifest';

export function PaperDocsReaderLayout({
  children,
  lang,
  availableLanguages,
  nav,
  pages,
  siteTheme,
}: DocsThemeReaderLayoutProps) {
  const siteTitle = siteTheme.branding?.siteTitle ?? 'Paper Docs';
  const homeLabel = siteTheme.branding?.homeLabel ?? 'Docs Home';

  return (
    <div className={`${PAPER_DOCS_THEME_CLASS_NAME} min-h-dvh bg-fd-background text-fd-foreground`}>
      <header className="border-b border-fd-border bg-[color:var(--paper-header)]">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <Link href={`/${lang}`} className="text-base font-semibold tracking-[0.08em] uppercase">
              {siteTitle}
            </Link>
            <div className="hidden text-xs text-fd-muted-foreground md:block">
              Editorial reader theme
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm">
            {availableLanguages
              .filter((language) => language !== lang)
              .map((language) => (
                <Link
                  key={language}
                  href={`/${language}`}
                  className="rounded-full border border-fd-border px-3 py-1 text-fd-muted-foreground hover:bg-fd-muted"
                >
                  {language === 'zh' ? '中文' : language.toUpperCase()}
                </Link>
              ))}
          </div>
        </div>
      </header>

      <div className="mx-auto grid min-h-[calc(100dvh-64px)] max-w-7xl grid-cols-[300px_1fr]">
        <aside className="border-r border-fd-border bg-[color:var(--paper-sidebar)]">
          <DocsSidebar lang={lang} nav={nav} pages={pages} homeLabel={homeLabel} />
        </aside>
        <main className="min-w-0 overflow-y-auto bg-fd-background">
          <div className="mx-auto max-w-4xl px-8 py-10">{children}</div>
        </main>
      </div>
    </div>
  );
}
