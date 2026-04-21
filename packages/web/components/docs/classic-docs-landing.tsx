import Link from 'next/link';
import type { NavigationDoc, NavItem, PageDoc } from '@anydocs/core';
import { ArrowRight, BookOpen, Search } from 'lucide-react';

import { getDocsUiCopy } from '@/components/docs/docs-ui-copy';
import { SearchPanel } from '@/components/docs/search-panel';
import type { DocsLang } from '@/lib/docs/types';

type ClassicDocsLandingProps = {
  lang: DocsLang;
  nav: NavigationDoc;
  pages: PageDoc[];
  siteTitle: string;
  showSearch: boolean;
  searchFindHref?: string;
  searchIndexHref?: string;
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

export function ClassicDocsLanding({
  lang,
  nav,
  pages,
  siteTitle,
  showSearch,
  searchFindHref,
  searchIndexHref,
}: ClassicDocsLandingProps) {
  const copy = getDocsUiCopy(lang);
  const orderedLinks = dedupeLinks(flattenPageLinks(nav.items, pages, lang));
  const quickStartLinks = orderedLinks.slice(0, 5);
  const recommendedLinks = orderedLinks.slice(5, 10);
  const sections = buildSections(nav, pages, lang, copy).slice(0, 6);
  const browseHref = orderedLinks[0]?.href ?? `/${lang}`;

  return (
    <div className="mx-auto w-full max-w-[1420px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="border border-fd-border bg-fd-card sm:px-1">
          <div className="px-6 py-7 sm:px-8 sm:py-8 lg:px-10">
            <div className="max-w-3xl space-y-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--docs-body-copy-subtle,var(--fd-muted-foreground))]">
                {copy.landing.eyebrow}
              </p>
              <h1 className="text-[34px] font-semibold tracking-[-0.05em] text-fd-foreground sm:text-[40px] sm:leading-[1.04]">
                {siteTitle}
              </h1>
              <div className="max-w-2xl space-y-3">
                <p className="text-[15px] font-medium text-fd-foreground">{copy.landing.title}</p>
                <p className="text-[16px] leading-7 text-[color:var(--docs-body-copy,var(--fd-muted-foreground))]">
                  {copy.landing.description}
                </p>
              </div>
            </div>
          </div>

          {showSearch ? (
            <div className="border-y border-fd-border bg-[color:var(--classic-panel-elevated,var(--fd-background))] px-6 py-5 sm:px-8 lg:px-10">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium text-fd-foreground">
                <Search className="h-4 w-4 text-fd-muted-foreground" />
                <span>{copy.landing.searchLabel}</span>
              </div>
              <div className="max-w-2xl">
                <SearchPanel
                  lang={lang}
                  findHref={searchFindHref}
                  indexHref={searchIndexHref}
                  placeholder={copy.sidebar.searchPlaceholder}
                  inputClassName="h-11 rounded-lg border border-fd-border bg-fd-background px-4 text-[15px]"
                  resultsClassName="rounded-xl"
                />
              </div>
            </div>
          ) : null}

          <div className="px-6 py-6 sm:px-8 lg:px-10">
            <div className="flex items-center justify-between gap-3 border-b border-fd-border pb-3">
              <div>
                <h2 className="text-sm font-semibold text-fd-foreground">{copy.landing.quickStartTitle}</h2>
                <p className="mt-1 text-sm leading-6 text-[color:var(--docs-body-copy-subtle,var(--fd-muted-foreground))]">
                  {copy.landing.quickStartDescription}
                </p>
              </div>
              <Link
                href={browseHref}
                className="hidden text-sm font-medium text-[color:var(--docs-sidebar-link,var(--fd-foreground))] transition hover:text-fd-primary sm:inline-flex sm:items-center sm:gap-2"
              >
                {copy.landing.browseAll}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="mt-2 divide-y divide-fd-border">
              {quickStartLinks.map((link) => (
                <Link
                  key={link.id}
                  href={link.href}
                  className="group flex items-start justify-between gap-4 py-4 transition hover:bg-[color:var(--docs-sidebar-hover,var(--fd-muted))] sm:px-2"
                >
                  <div className="min-w-0">
                    <div className="text-[15px] font-medium text-fd-foreground">{link.title}</div>
                    {link.description ? (
                      <div className="mt-1 max-w-2xl text-sm leading-6 text-[color:var(--docs-body-copy-subtle,var(--fd-muted-foreground))]">
                        {link.description}
                      </div>
                    ) : null}
                  </div>
                  <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-fd-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-fd-foreground" />
                </Link>
              ))}
            </div>

            <Link
              href={browseHref}
              className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-[color:var(--docs-sidebar-link,var(--fd-foreground))] transition hover:text-fd-primary sm:hidden"
            >
              {copy.landing.browseAll}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        <aside className="space-y-5">
          <div className="border border-fd-border bg-fd-card px-5 py-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-fd-foreground">
              <BookOpen className="h-4 w-4 text-fd-muted-foreground" />
              <span>{copy.landing.categoriesTitle}</span>
            </div>
            <p className="mt-2 text-sm leading-6 text-[color:var(--docs-body-copy-subtle,var(--fd-muted-foreground))]">
              {copy.landing.categoriesDescription}
            </p>
            <div className="mt-4 space-y-2">
              {sections.map((section) => (
                <div key={section.title} className="border border-fd-border bg-fd-background px-4 py-4">
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
                    <div className="mt-3 space-y-1.5">
                      {section.links.map((link) => (
                        <Link
                          key={link.id}
                          href={link.href}
                          className="block px-3 py-2 text-sm text-[color:var(--docs-body-copy,var(--fd-foreground))] transition hover:bg-fd-muted"
                        >
                          {link.title}
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-3 border border-dashed border-fd-border px-3 py-3 text-sm text-fd-muted-foreground">
                      {copy.landing.emptySections}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="border border-fd-border bg-fd-card px-5 py-5">
            <div className="text-sm font-semibold text-fd-foreground">{copy.landing.keepExploringTitle}</div>
            <p className="mt-2 text-sm leading-6 text-[color:var(--docs-body-copy-subtle,var(--fd-muted-foreground))]">
              {copy.landing.keepExploringDescription}
            </p>
            <div className="mt-4 divide-y divide-fd-border">
              {recommendedLinks.length ? (
                recommendedLinks.map((link) => (
                  <Link
                    key={link.id}
                    href={link.href}
                    className="block py-3 text-sm text-[color:var(--docs-body-copy,var(--fd-foreground))] transition hover:text-fd-foreground"
                  >
                    {link.title}
                  </Link>
                ))
              ) : (
                <div className="py-3 text-sm text-fd-muted-foreground">
                  {copy.landing.emptyRecommendations}
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
