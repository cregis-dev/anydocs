'use client';

import { useMemo, useState } from 'react';

import type { NavItem, NavigationDoc, PageDoc } from '@/lib/docs/types';
import { NavigationItemDialog, type NavigationItemDialogValues } from '@/components/studio/navigation-item-dialog';
import { NavigationTree } from '@/components/studio/navigation-tree';

type IndexPath = number[];
type CreatePageInput = { slug: string; title: string };
type NavigationDialogState =
  | { type: 'create-page'; parentPath: IndexPath }
  | { type: 'create-group'; parentPath: IndexPath }
  | { type: 'create-link'; parentPath: IndexPath }
  | { type: 'rename-group'; path: IndexPath; title: string }
  | { type: 'edit-link'; path: IndexPath; title: string; href: string };

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

export function NavigationComposer({
  nav,
  pages,
  activePageId,
  onSelectPage,
  onOpenPageSettings,
  onCreatePage,
  onChange,
  onDeletePage,
  onApprovePage,
  onDuplicatePage,
  onSetPageStatus,
}: {
  nav: NavigationDoc;
  pages: PageDoc[];
  activePageId: string | null;
  onSelectPage: (pageId: string) => void;
  onOpenPageSettings: (pageId: string) => void;
  onCreatePage: (input: CreatePageInput) => Promise<PageDoc | null>;
  onChange: (next: NavigationDoc) => void;
  onDeletePage: (pageId: string) => void;
  onApprovePage: (pageId: string) => void;
  onDuplicatePage: (pageId: string) => void;
  onSetPageStatus: (pageId: string, status: PageDoc['status']) => void;
}) {
  const [dialog, setDialog] = useState<NavigationDialogState | null>(null);

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

  const addChild = async (parentPath: IndexPath, kind: 'group' | 'page' | 'link') => {
    setDialog(
      kind === 'group'
        ? { type: 'create-group', parentPath }
        : kind === 'link'
          ? { type: 'create-link', parentPath }
          : { type: 'create-page', parentPath },
    );
  };

  const dialogConfig = useMemo(() => {
    if (!dialog) {
      return null;
    }

    if (dialog.type === 'create-page') {
      return {
        kind: 'page' as const,
        title: 'Add Page',
        description: 'Create a new page and insert it into this group.',
        submitLabel: 'Create Page',
        initialValues: {
          title: 'Untitled',
          slug: 'getting-started/new-page',
        },
      };
    }

    if (dialog.type === 'create-group') {
      return {
        kind: 'group' as const,
        title: 'Add Group',
        description: 'Create a nested group inside the current navigation section.',
        submitLabel: 'Create Group',
        initialValues: {
          title: 'Group',
        },
      };
    }

    if (dialog.type === 'create-link') {
      return {
        kind: 'link' as const,
        title: 'Add Link',
        description: 'Add an external link to this group.',
        submitLabel: 'Create Link',
        initialValues: {
          title: 'Link',
          href: 'https://',
        },
      };
    }

    if (dialog.type === 'rename-group') {
      return {
        kind: 'group' as const,
        title: 'Rename Group',
        description: 'Update the display title for this navigation group.',
        submitLabel: 'Save',
        initialValues: {
          title: dialog.title,
        },
      };
    }

    return {
      kind: 'link' as const,
      title: 'Edit Link',
      description: 'Update the external link label and destination.',
      submitLabel: 'Save',
      initialValues: {
        title: dialog.title,
        href: dialog.href,
      },
    };
  }, [dialog]);

  const handleDialogSubmit = async (values: NavigationItemDialogValues) => {
    if (!dialog) {
      return;
    }

    if (dialog.type === 'create-page') {
      const created = await onCreatePage({ slug: values.slug, title: values.title || 'Untitled' });
      if (!created) {
        throw new Error('Failed to create page');
      }

      apply((draft) => {
        const parent = getNode(draft, dialog.parentPath);
        if (!parent || parent.type === 'page' || parent.type === 'link') return;
        parent.children.push({ type: 'page', pageId: created.id });
      });
      return;
    }

    if (dialog.type === 'create-group') {
      apply((draft) => {
        const parent = getNode(draft, dialog.parentPath);
        if (!parent || parent.type === 'page' || parent.type === 'link') return;
        parent.children.push({ type: 'folder', title: values.title, children: [] });
      });
      return;
    }

    if (dialog.type === 'create-link') {
      apply((draft) => {
        const parent = getNode(draft, dialog.parentPath);
        if (!parent || parent.type === 'page' || parent.type === 'link') return;
        parent.children.push({ type: 'link', title: values.title, href: values.href });
      });
      return;
    }

    if (dialog.type === 'rename-group') {
      updateAt(dialog.path, (node) =>
        node.type === 'section' || node.type === 'folder' ? { ...node, title: values.title } : node,
      );
      return;
    }

    updateAt(dialog.path, (node) => (node.type === 'link' ? { ...node, title: values.title, href: values.href } : node));
  };

  return (
    <div className="space-y-3">
      <NavigationTree
        nav={nav}
        pages={pages}
        activePageId={activePageId}
        onSelectPage={onSelectPage}
        onOpenPageSettings={onOpenPageSettings}
        moveUp={moveUp}
        moveDown={moveDown}
        addChild={addChild}
        onRequestRenameGroup={(path, title) => setDialog({ type: 'rename-group', path, title })}
        onRequestEditLink={(path, title, href) => setDialog({ type: 'edit-link', path, title, href })}
        onDeletePage={onDeletePage}
        onApprovePage={onApprovePage}
        onDuplicatePage={onDuplicatePage}
        onSetPageStatus={onSetPageStatus}
      />
      <NavigationItemDialog
        open={dialog !== null}
        config={dialogConfig}
        onOpenChange={(next) => {
          if (!next) {
            setDialog(null);
          }
        }}
        onSubmit={handleDialogSubmit}
      />
    </div>
  );
}
