import Link from 'next/link';
import type { NavigationDoc, NavItem, PageDoc } from '@anydocs/core';
import { ArrowRight, BookOpen, Search, Sparkles } from 'lucide-react';

import { getDocsUiCopy } from '@/components/docs/docs-ui-copy';
import { SearchPanel } from '@/components/docs/search-panel';
import type { DocsLang } from '@/lib/docs/types';
import { cn } from '@/lib/utils';

type ClassicDocsLandingProps = {
  lang: DocsLang;
  nav: NavigationDoc;
  pages: PageDoc[];
  siteTitle: string;
  showSearch: boolean;
};

type LandingLink = {
  id: string;
  title: string;
  href: string;
  description?: string;
};

type LandingSection = {
  title: string;
  href: string | null;
  links: LandingLink[];
};

function pageHref(lang: DocsLang, slug: string) {
  return `/${lang}/${slug}`;
}

function findPageById(pages: PageDoc[], pageId: string) {
  return pages.find((page) => page.id === pageId) ?? null;
}

function flattenPageLinks(items: NavItem[], pages: PageDoc[], lang: DocsLang, acc: LandingLink[] = []) {
  for (const item of items) {
    if (item.type === 'page') {
      const page = findPageById(pages, item.pageId);
      if (page) {
        acc.push({
          id: page.id,
          title: item.titleOverride ?? page.title,
          href: pageHref(lang, page.slug),
          description: page.description,
        });
      }
      continue;
    }

    if ('children' in item && item.children.length > 0) {
      flattenPageLinks(item.children, pages, lang, acc);
    }
  }

  return acc;
}

function dedupeLinks(links: LandingLink[]) {
  const seen = new Set<string>();

  return links.filter((link) => {
    if (seen.has(link.id)) {
      return false;
    }
    seen.add(link.id);
    return true;
  });
}

function getSectionTitle(item: NavItem, copy: ReturnType<typeof getDocsUiCopy>) {
  if (item.type === 'section' || item.type === 'folder') {
    return item.title;
  }

  if (item.type === 'page') {
    return copy.common.docs;
  }

  return copy.common.categoryFallback;
}

function buildSections(nav: NavigationDoc, pages: PageDoc[], lang: DocsLang, copy: ReturnType<typeof getDocsUiCopy>) {
  return nav.items
    .map((item): LandingSection | null => {
      if (item.type === 'link') {
        return null;
      }

      if (item.type === 'page') {
        const page = findPageById(pages, item.pageId);
        if (!page) {
          return null;
        }

        return {
          title: getSectionTitle(item, copy),
          href: pageHref(lang, page.slug),
          links: [
            {
              id: page.id,
              title: item.titleOverride ?? page.title,
              href: pageHref(lang, page.slug),
              description: page.description,
            },
          ],
        };
      }

      const links = dedupeLinks(flattenPageLinks(item.children, pages, lang)).slice(0, 3);
      return {
        title: getSectionTitle(item, copy),
        href: links[0]?.href ?? null,
        links,
      };
    })
    .filter((section): section is LandingSection => section !== null);
}

export function ClassicDocsLanding({ lang, nav, pages, siteTitle, showSearch }: ClassicDocsLandingProps) {
  const copy = getDocsUiCopy(lang);
  const orderedLinks = dedupeLinks(flattenPageLinks(nav.items, pages, lang));
  const quickStartLinks = orderedLinks.slice(0, 4);
  const recommendedLinks = orderedLinks.slice(4, 8);
  const sections = buildSections(nav, pages, lang, copy).slice(0, 6);
  const browseHref = quickStartLinks[0]?.href ?? `/${lang}`;

  return (
    <div className="mx-auto w-full max-w-[1520px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_380px]">
        <section className="rounded-[30px] border border-fd-border bg-fd-card px-6 py-7 shadow-[0_1px_0_rgba(15,23,42,0.03)] sm:px-8 sm:py-8 lg:px-10">
          <div className="max-w-3xl space-y-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--docs-body-copy-subtle,var(--fd-muted-foreground))]">
              {copy.landing.eyebrow}
            </p>
            <h1 className="text-[34px] font-semibold tracking-[-0.045em] text-fd-foreground sm:text-[42px] sm:leading-[1.05]">
              {siteTitle}
            </h1>
            <div className="max-w-2xl space-y-3">
              <p className="text-[15px] font-medium text-fd-foreground">{copy.landing.title}</p>
              <p className="text-[16px] leading-7 text-[color:var(--docs-body-copy,var(--fd-muted-foreground))] sm:text-[18px] sm:leading-[1.8]">
                {copy.landing.description}
              </p>
            </div>
          </div>

          {showSearch ? (
            <div className="mt-7 max-w-2xl rounded-[24px] border border-fd-border bg-[color:var(--classic-panel-elevated,var(--fd-background))] p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium text-fd-foreground">
                <Search className="h-4 w-4 text-fd-muted-foreground" />
                <span>{copy.landing.searchLabel}</span>
              </div>
              <SearchPanel
                lang={lang}
                placeholder={copy.sidebar.searchPlaceholder}
                inputClassName="h-11 rounded-xl bg-fd-muted px-4 text-[15px]"
                resultsClassName="rounded-2xl"
              />
            </div>
          ) : null}

          <div className="mt-8">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-fd-muted-foreground" />
              <h2 className="text-sm font-semibold text-fd-foreground">{copy.landing.quickStartTitle}</h2>
            </div>
            <p className="mt-2 text-sm leading-6 text-[color:var(--docs-body-copy-subtle,var(--fd-muted-foreground))]">
              {copy.landing.quickStartDescription}
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {quickStartLinks.map((link) => (
                <Link
                  key={link.id}
                  href={link.href}
                  className={cn(
                    'group rounded-2xl border border-fd-border bg-fd-background px-4 py-4 transition',
                    'hover:border-[color:var(--docs-sidebar-active-border,var(--fd-foreground))] hover:bg-fd-muted',
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-[15px] font-medium text-fd-foreground">{link.title}</div>
                      {link.description ? (
                        <div className="mt-1 line-clamp-2 text-sm leading-6 text-fd-muted-foreground">
                          {link.description}
                        </div>
                      ) : null}
                    </div>
                    <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-fd-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-fd-foreground" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <aside className="space-y-6">
          <div className="rounded-[30px] border border-fd-border bg-fd-card px-6 py-6 shadow-[0_1px_0_rgba(15,23,42,0.03)]">
            <div className="flex items-center gap-2 text-sm font-semibold text-fd-foreground">
              <BookOpen className="h-4 w-4 text-fd-muted-foreground" />
              <span>{copy.landing.categoriesTitle}</span>
            </div>
            <p className="mt-2 text-sm leading-6 text-[color:var(--docs-body-copy-subtle,var(--fd-muted-foreground))]">
              {copy.landing.categoriesDescription}
            </p>
            <div className="mt-4 space-y-3">
              {sections.map((section) => (
                <div key={section.title} className="rounded-2xl border border-fd-border bg-fd-background px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-[15px] font-medium text-fd-foreground">{section.title}</div>
                    {section.href ? (
                      <Link
                        href={section.href}
                        className="text-xs font-medium text-[color:var(--docs-sidebar-link,var(--fd-foreground))] transition hover:text-fd-primary"
                      >
                        {copy.landing.moreInSection}
                      </Link>
                    ) : null}
                  </div>
                  {section.links.length ? (
                    <div className="mt-3 space-y-2">
                      {section.links.map((link) => (
                        <Link
                          key={link.id}
                          href={link.href}
                          className="block rounded-xl px-3 py-2 text-sm text-[color:var(--docs-body-copy,var(--fd-foreground))] transition hover:bg-fd-muted"
                        >
                          {link.title}
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-3 rounded-xl border border-dashed border-fd-border px-3 py-3 text-sm text-fd-muted-foreground">
                      {copy.landing.emptySections}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[30px] border border-fd-border bg-fd-card px-6 py-6 shadow-[0_1px_0_rgba(15,23,42,0.03)]">
            <div className="text-sm font-semibold text-fd-foreground">{copy.landing.keepExploringTitle}</div>
            <p className="mt-2 text-sm leading-6 text-[color:var(--docs-body-copy-subtle,var(--fd-muted-foreground))]">
              {copy.landing.keepExploringDescription}
            </p>
            <div className="mt-4 space-y-2">
              {recommendedLinks.length ? (
                recommendedLinks.map((link) => (
                  <Link
                    key={link.id}
                    href={link.href}
                    className="block rounded-xl px-3 py-2 text-sm text-[color:var(--docs-body-copy,var(--fd-foreground))] transition hover:bg-fd-muted"
                  >
                    {link.title}
                  </Link>
                ))
              ) : (
                <div className="rounded-xl px-3 py-2 text-sm text-fd-muted-foreground">
                  {copy.landing.emptyRecommendations}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-[30px] border border-fd-border bg-[color:var(--fd-muted)] px-6 py-6">
            <div className="text-sm font-semibold text-fd-foreground">{copy.landing.browseAll}</div>
            <p className="mt-2 text-sm leading-6 text-fd-muted-foreground">{copy.landing.keepExploringDescription}</p>
            <div className="mt-4">
              <Link
                href={browseHref}
                className="inline-flex items-center gap-2 rounded-full border border-fd-border bg-fd-background px-4 py-2 text-sm font-medium text-fd-foreground transition hover:bg-fd-muted"
              >
                {copy.landing.openPage}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
