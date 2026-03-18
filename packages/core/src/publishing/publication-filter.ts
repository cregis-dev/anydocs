import type { DocsLang, NavigationDoc, NavItem, PageDoc } from '../types/docs.ts';

export type PublishedLanguageContent<TContent = unknown> = {
  navigation: NavigationDoc;
  pages: PageDoc<TContent>[];
};

export type PublishedRoute = {
  pageId: string;
  slug: string;
  segments: string[];
  href: string;
  title: string;
};

export type PublishedSiteLanguageContent<TContent = unknown> = PublishedLanguageContent<TContent> & {
  routes: PublishedRoute[];
};

export function isPageApprovedForPublication<TContent>(page: PageDoc<TContent>): boolean {
  if (page.status !== 'published') {
    return false;
  }

  if (!page.review?.required) {
    return true;
  }

  return typeof page.review.approvedAt === 'string' && page.review.approvedAt.trim().length > 0;
}

export function filterPublishedPages<TContent>(pages: PageDoc<TContent>[]): PageDoc<TContent>[] {
  return pages
    .filter((page) => isPageApprovedForPublication(page))
    .sort((left, right) => left.slug.localeCompare(right.slug));
}

export function filterNavigationToPublished(
  items: NavItem[],
  publishedPageIds: Set<string>,
): NavItem[] {
  const filtered: NavItem[] = [];

  for (const item of items) {
    if (item.type === 'page') {
      if (publishedPageIds.has(item.pageId) && !item.hidden) {
        filtered.push(item);
      }
      continue;
    }

    if (item.type === 'link') {
      filtered.push(item);
      continue;
    }

    const children = filterNavigationToPublished(item.children, publishedPageIds);
    if (children.length === 0) {
      continue;
    }

    filtered.push({ ...item, children });
  }

  return filtered;
}

export function buildPublishedLanguageContent<TContent>(
  navigation: NavigationDoc,
  pages: PageDoc<TContent>[],
): PublishedLanguageContent<TContent> {
  const publishedPages = filterPublishedPages(pages);
  const publishedPageIds = new Set(publishedPages.map((page) => page.id));

  return {
    navigation: {
      version: navigation.version,
      items: filterNavigationToPublished(navigation.items, publishedPageIds),
    },
    pages: publishedPages,
  };
}

function collectNavigationPageIds(items: NavItem[]): string[] {
  const orderedPageIds: string[] = [];

  for (const item of items) {
    if (item.type === 'page') {
      orderedPageIds.push(item.pageId);
      continue;
    }

    if (item.type === 'link') {
      continue;
    }

    orderedPageIds.push(...collectNavigationPageIds(item.children));
  }

  return orderedPageIds;
}

export function orderPublishedPagesByNavigation<TContent>(
  navigation: NavigationDoc,
  pages: PageDoc<TContent>[],
): PageDoc<TContent>[] {
  const publishedContent = buildPublishedLanguageContent(navigation, pages);
  const orderedPageIds = collectNavigationPageIds(publishedContent.navigation.items);
  const pagesById = new Map(publishedContent.pages.map((page) => [page.id, page]));
  const orderedPages: PageDoc<TContent>[] = [];
  const seen = new Set<string>();

  for (const pageId of orderedPageIds) {
    const page = pagesById.get(pageId);
    if (!page || seen.has(pageId)) {
      continue;
    }

    seen.add(pageId);
    orderedPages.push(page);
  }

  for (const page of publishedContent.pages) {
    if (seen.has(page.id)) {
      continue;
    }

    seen.add(page.id);
    orderedPages.push(page);
  }

  return orderedPages;
}

export function buildPublishedSiteLanguageContent<TContent>(
  lang: DocsLang,
  navigation: NavigationDoc,
  pages: PageDoc<TContent>[],
): PublishedSiteLanguageContent<TContent> {
  const publishedContent = buildPublishedLanguageContent(navigation, pages);
  const orderedPages = orderPublishedPagesByNavigation(navigation, pages);

  return {
    navigation: publishedContent.navigation,
    pages: orderedPages,
    routes: orderedPages.map((page) => ({
      pageId: page.id,
      slug: page.slug,
      segments: page.slug.split('/').filter(Boolean),
      href: `/${lang}/${page.slug}`,
      title: page.title,
    })),
  };
}
