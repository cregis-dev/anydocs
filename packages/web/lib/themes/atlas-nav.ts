import type { ProjectSiteTopNavItem, ProjectSiteTopNavLabel } from '@anydocs/core';

import type { DocsLang, NavItem, NavigationDoc, PageDoc } from '@/lib/docs/types';

export function normalizeRoutePath(pathname: string) {
  if (!pathname || pathname === '/') {
    return '/';
  }

  return pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
}

export function resolveTopNavLabel(label: ProjectSiteTopNavLabel, lang: DocsLang) {
  if (typeof label === 'string') {
    return label;
  }

  return label[lang] ?? Object.values(label).find((value) => typeof value === 'string' && value.trim().length > 0) ?? '';
}

function findTopLevelGroup(items: NavigationDoc['items'], groupId: string) {
  return items.find((item) => (item.type === 'section' || item.type === 'folder') && item.id === groupId) ?? null;
}

export function filterNavigationToGroup(nav: NavigationDoc, groupId: string): NavigationDoc {
  const matchedGroup = findTopLevelGroup(nav.items, groupId);
  if (!matchedGroup || (matchedGroup.type !== 'section' && matchedGroup.type !== 'folder')) {
    return nav;
  }

  return {
    version: nav.version,
    items: matchedGroup.children,
  };
}

function walkForPageId(items: NavItem[], predicate: (item: Extract<NavItem, { type: 'page' }>) => boolean): string | null {
  for (const item of items) {
    if (item.type === 'page' && predicate(item)) {
      return item.pageId;
    }

    if ((item.type === 'section' || item.type === 'folder')) {
      const nested = walkForPageId(item.children, predicate);
      if (nested) {
        return nested;
      }
    }
  }

  return null;
}

export function pageBelongsToGroup(items: NavigationDoc['items'], groupId: string, pageId: string): boolean {
  const target = findTopLevelGroup(items, groupId);
  if (!target || (target.type !== 'section' && target.type !== 'folder')) {
    return false;
  }

  return walkForPageId(target.children, (item) => item.pageId === pageId) !== null;
}

export function findFirstPageIdInGroup(items: NavigationDoc['items'], groupId: string): string | null {
  const target = findTopLevelGroup(items, groupId);
  if (!target || (target.type !== 'section' && target.type !== 'folder')) {
    return null;
  }

  return walkForPageId(target.children, () => true);
}

export function resolveFilteredNavigation(
  nav: NavigationDoc,
  topNav: ProjectSiteTopNavItem[],
  activePageId: string | null,
) {
  const groupItems = topNav.filter((item): item is Extract<ProjectSiteTopNavItem, { type: 'nav-group' }> => item.type === 'nav-group');
  if (groupItems.length === 0) {
    return {
      activeGroupId: null,
      filteredNav: nav,
    };
  }

  const activeGroupId =
    (activePageId
      ? groupItems.find((item) => pageBelongsToGroup(nav.items, item.groupId, activePageId))?.groupId
      : null) ?? groupItems[0]?.groupId ?? null;

  if (!activeGroupId) {
    return {
      activeGroupId: null,
      filteredNav: nav,
    };
  }

  return {
    activeGroupId,
    filteredNav: filterNavigationToGroup(nav, activeGroupId),
  };
}

export function buildTopNavHref(
  item: ProjectSiteTopNavItem,
  lang: DocsLang,
  nav: NavigationDoc,
  pages: PageDoc[],
) {
  if (item.type === 'external') {
    return item.href;
  }

  const targetPageId = findFirstPageIdInGroup(nav.items, item.groupId);
  const targetPage = targetPageId ? pages.find((page) => page.id === targetPageId) : null;

  return targetPage ? `/${lang}/${targetPage.slug}` : `/${lang}`;
}

export function buildLanguageHref(pathname: string, currentLang: DocsLang, nextLang: DocsLang) {
  if (!pathname || pathname === `/${currentLang}`) {
    return `/${nextLang}`;
  }

  if (pathname.startsWith(`/${currentLang}/`)) {
    return `/${nextLang}${pathname.slice(currentLang.length + 1)}`;
  }

  return `/${nextLang}`;
}
