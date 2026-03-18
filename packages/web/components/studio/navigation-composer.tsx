'use client';

import type { NavItem, NavigationDoc, PageDoc } from '@/lib/docs/types';
import { NavigationTree } from '@/components/studio/navigation-tree';

type IndexPath = number[];

function cloneNav(nav: NavigationDoc): NavigationDoc {
  return JSON.parse(JSON.stringify(nav)) as NavigationDoc;
}

function getSiblingsRef(root: NavigationDoc, path: IndexPath): NavItem[] | null {
  if (path.length === 1) return root.items;
  const parentPath = path.slice(0, -1);
  let items: NavItem[] = root.items;
  for (const idx of parentPath) {
    const node = items[idx];
    if (!node || node.type === 'page' || node.type === 'link') return null;
    items = node.children;
  }
  return items;
}

function getNode(root: NavigationDoc, path: IndexPath): NavItem | null {
  let items: NavItem[] = root.items;
  for (let i = 0; i < path.length; i++) {
    const idx = path[i];
    const node = items[idx];
    if (!node) return null;
    if (i === path.length - 1) return node;
    if (node.type === 'page' || node.type === 'link') return null;
    items = node.children;
  }
  return null;
}

function moveInArray<T>(arr: T[], from: number, to: number) {
  if (to < 0 || to >= arr.length) return;
  const [it] = arr.splice(from, 1);
  arr.splice(to, 0, it);
}

function promptPageReference(pages: PageDoc[]) {
  const input = window.prompt('Enter page Slug or ID');
  if (!input) return null;
  const page = pages.find((p) => p.slug === input || p.id === input);
  if (!page) {
    window.alert('Page not found');
    return null;
  }
  return page.id;
}

function promptLinkItem() {
  const title = (window.prompt('Link title', 'Link') ?? '').trim();
  if (!title) return null;
  const href = (window.prompt('Link href', 'https://') ?? '').trim();
  if (!href) return null;
  return { type: 'link' as const, title, href };
}

function slugifyGroupId(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/-{2,}/g, '-') || `group-${Date.now().toString(36)}`
  );
}

export function NavigationComposer({
  nav,
  pages,
  activePageId,
  onSelectPage,
  onChange,
}: {
  nav: NavigationDoc;
  pages: PageDoc[];
  activePageId: string | null;
  onSelectPage: (pageId: string) => void;
  onChange: (next: NavigationDoc) => void;
}) {
  const apply = (fn: (draft: NavigationDoc) => void) => {
    const next = cloneNav(nav);
    fn(next);
    onChange(next);
  };

  const updateAt = (path: IndexPath, updater: (node: NavItem) => NavItem) => {
    apply((draft) => {
      const siblings = getSiblingsRef(draft, path);
      if (!siblings) return;
      const idx = path[path.length - 1];
      const node = siblings[idx];
      if (!node) return;
      siblings[idx] = updater(node);
    });
  };

  const removeAt = (path: IndexPath) => {
    apply((draft) => {
      const siblings = getSiblingsRef(draft, path);
      if (!siblings) return;
      siblings.splice(path[path.length - 1], 1);
    });
  };

  const moveUp = (path: IndexPath) => {
    apply((draft) => {
      const siblings = getSiblingsRef(draft, path);
      if (!siblings) return;
      const idx = path[path.length - 1];
      moveInArray(siblings, idx, idx - 1);
    });
  };

  const moveDown = (path: IndexPath) => {
    apply((draft) => {
      const siblings = getSiblingsRef(draft, path);
      if (!siblings) return;
      const idx = path[path.length - 1];
      moveInArray(siblings, idx, idx + 1);
    });
  };

  const addRootItem = (kind: 'section' | 'page' | 'link') => {
    apply((draft) => {
      if (kind === 'section') {
        const title = (window.prompt('Group title', 'GROUP') ?? '').trim();
        if (!title) return;
        draft.items.push({ type: 'section', id: slugifyGroupId(title), title, children: [] });
        return;
      }

      if (kind === 'link') {
        const link = promptLinkItem();
        if (!link) return;
        draft.items.push(link);
        return;
      }

      const pageId = promptPageReference(pages);
      if (!pageId) return;
      draft.items.push({ type: 'page', pageId });
    });
  };

  const addChild = (parentPath: IndexPath, kind: 'folder' | 'page' | 'link') => {
    apply((draft) => {
      const parent = getNode(draft, parentPath);
      if (!parent || parent.type === 'page' || parent.type === 'link') return;
      if (kind === 'folder') parent.children.push({ type: 'folder', title: 'Folder', children: [] });
      if (kind === 'link') {
        const link = promptLinkItem();
        if (!link) return;
        parent.children.push(link);
      }
      if (kind === 'page') {
        const pageId = promptPageReference(pages);
        if (!pageId) return;
        parent.children.push({ type: 'page', pageId });
      }
    });
  };

  return (
    <div className="space-y-3">
      <NavigationTree
        nav={nav}
        pages={pages}
        activePageId={activePageId}
        onSelectPage={onSelectPage}
        updateAt={updateAt}
        removeAt={removeAt}
        moveUp={moveUp}
        moveDown={moveDown}
        addRootItem={addRootItem}
        addChild={addChild}
      />
    </div>
  );
}
