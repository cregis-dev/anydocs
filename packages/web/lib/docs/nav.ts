import type { NavItem, NavigationDoc } from '@/lib/docs/types';

export function filterNavPublished(items: NavItem[], publishedIds: Set<string>): NavItem[] {
  const out: NavItem[] = [];
  for (const item of items) {
    if (item.type === 'page') {
      if (publishedIds.has(item.pageId) && !item.hidden) out.push(item);
      continue;
    }
    if (item.type === 'link') {
      out.push(item);
      continue;
    }
    const children = filterNavPublished(item.children, publishedIds);
    if (children.length === 0) continue;
    out.push({ ...item, children } as NavItem);
  }
  return out;
}

export function buildBreadcrumbsByPageId(nav: NavigationDoc) {
  const map = new Map<string, string[]>();
  const walk = (items: NavItem[], trail: string[]) => {
    for (const item of items) {
      if (item.type === 'page') {
        map.set(item.pageId, trail);
        continue;
      }
      if (item.type === 'link') continue;
      const nextTrail = item.title ? [...trail, item.title] : trail;
      walk(item.children, nextTrail);
    }
  };
  walk(nav.items, []);
  return map;
}

export function findNextPrevPageIds(nav: NavItem[], currentPageId: string) {
  const flat: string[] = [];
  const walk = (items: NavItem[]) => {
    for (const item of items) {
      if (item.type === 'page') {
        flat.push(item.pageId);
        continue;
      }
      if (item.type === 'link') continue;
      walk(item.children);
    }
  };
  walk(nav);
  const idx = flat.indexOf(currentPageId);
  return {
    prev: idx > 0 ? flat[idx - 1] : null,
    next: idx >= 0 && idx < flat.length - 1 ? flat[idx + 1] : null,
  };
}

