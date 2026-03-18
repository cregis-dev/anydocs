'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  MoreVertical,
  FileText,
  Folder,
  Link2,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';

import type { NavItem, NavigationDoc, PageDoc } from '@/lib/docs/types';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type IndexPath = number[];

const IconBtn = ({ onClick, children }: { onClick: () => void; children: React.ReactNode }) => (
  <Button type="button" variant="ghost" size="icon" className="size-8" onClick={onClick}>
    {children}
  </Button>
);

const Menu = ({
  open,
  onOpenChange,
  trigger,
  children,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  trigger: (args: { onClick: () => void }) => React.ReactNode;
  children: React.ReactNode;
}) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (rootRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      onOpenChange(false);
    };
    const onDocKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    document.addEventListener('keydown', onDocKeyDown);
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown);
      document.removeEventListener('keydown', onDocKeyDown);
    };
  }, [open, onOpenChange]);

  return (
    <div ref={rootRef} className="relative">
      {trigger({ onClick: () => onOpenChange(!open) })}
      {open ? (
        <div
          ref={menuRef}
          className="absolute right-0 top-9 z-50 w-56 rounded-lg border border-fd-border bg-fd-card p-1 shadow-sm"
          role="menu"
        >
          {children}
        </div>
      ) : null}
    </div>
  );
};

const MenuItem = ({
  onClick,
  children,
  destructive,
}: {
  onClick: () => void;
  children: React.ReactNode;
  destructive?: boolean;
}) => (
  <button
    type="button"
    role="menuitem"
    className={cn(
      'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition',
      destructive ? 'text-fd-error hover:bg-fd-muted' : 'hover:bg-fd-muted',
    )}
    onClick={onClick}
  >
    {children}
  </button>
);

const MenuSep = () => <div className="my-1 h-px bg-fd-border" role="separator" />;

function promptGroupId(currentId: string | undefined, title: string) {
  const next = window.prompt('Group ID (empty to clear)', currentId ?? title.toLowerCase().replace(/\s+/g, '-')) ?? '';
  const normalized = next
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');

  return normalized || undefined;
}

const Row = ({
  depth,
  selected,
  hidden,
  leading,
  title,
  subtitle,
  onClick,
  actions,
}: {
  depth: number;
  selected?: boolean;
  hidden?: boolean;
  leading: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  onClick?: () => void;
  actions?: React.ReactNode;
}) => (
  <div
    className={cn(
      'group flex h-9 items-center gap-2 rounded-lg px-2 text-sm transition',
      'hover:bg-fd-muted',
      selected ? 'bg-fd-muted ring-1 ring-[color:var(--color-fd-ring)]' : '',
      hidden ? 'opacity-60' : '',
    )}
    style={{ paddingLeft: 8 + depth * 14 }}
  >
    <button type="button" onClick={onClick} className="flex min-w-0 flex-1 items-center gap-2 text-left">
      {leading}
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{title}</div>
        {subtitle ? <div className="truncate text-xs text-fd-muted-foreground">{subtitle}</div> : null}
      </div>
    </button>
    {actions ? (
      <div className={cn('flex items-center', selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100')}>
        {actions}
      </div>
    ) : null}
  </div>
);

export function NavigationTree({
  nav,
  pages,
  activePageId,
  onSelectPage,
  updateAt,
  removeAt,
  moveUp,
  moveDown,
  addRootItem,
  addChild,
}: {
  nav: NavigationDoc;
  pages: PageDoc[];
  activePageId: string | null;
  onSelectPage: (pageId: string) => void;
  updateAt: (path: IndexPath, updater: (node: NavItem) => NavItem) => void;
  removeAt: (path: IndexPath) => void;
  moveUp: (path: IndexPath) => void;
  moveDown: (path: IndexPath) => void;
  addRootItem: (kind: 'section' | 'page' | 'link') => void;
  addChild: (parentPath: IndexPath, kind: 'folder' | 'page' | 'link') => void;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [openMenuKey, setOpenMenuKey] = useState<string | null>(null);
  const [lastSelection, setLastSelection] = useState<{ pathKey: string; pageId: string } | null>(null);

  const pagesById = useMemo(() => new Map(pages.map((p) => [p.id, p])), [pages]);
  const pagesBySlug = useMemo(() => new Map(pages.map((p) => [p.slug, p])), [pages]);
  
  const pagePaths = useMemo(() => {
    const map = new Map<string, string[]>();
    const traverse = (items: NavItem[], prefix: number[] = []) => {
      items.forEach((item, idx) => {
        const path = [...prefix, idx];
        const k = path.join('.');
        
        if (item.type === 'page') {
          const list = map.get(item.pageId) ?? [];
          list.push(k);
          map.set(item.pageId, list);
        }
        
        if (item.type === 'section' || item.type === 'folder') {
          traverse(item.children, path);
        }
      });
    };
    traverse(nav.items);
    return map;
  }, [nav]);

  const keyOf = (path: IndexPath) => path.join('.');
  const isCollapsed = (path: IndexPath) => collapsed.has(keyOf(path));
  const toggleCollapsed = (path: IndexPath) => {
    const k = keyOf(path);
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };



  const renderNode = (item: NavItem, path: IndexPath): React.ReactNode => {
    const depth = path.length - 1;
    const k = keyOf(path);
    const isContainer = item.type === 'section' || item.type === 'folder';
    const open = isContainer ? !isCollapsed(path) : true;

    const isMenuOpen = openMenuKey === k;
    const setMenuOpen = (next: boolean) => setOpenMenuKey(next ? k : null);

    if (item.type === 'section') {
      const rename = () => {
        const next = (window.prompt('Group title', item.title) ?? '').trim();
        if (!next) return;
        updateAt(path, (n) => (n.type === 'section' ? { ...n, title: next } : n));
      };
      const editGroupId = () => {
        const nextId = promptGroupId(item.id, item.title);
        updateAt(path, (n) => (n.type === 'section' ? { ...n, id: nextId } : n));
      };
      const isTopLevel = path.length === 1;

      return (
        <div key={k} className="pt-3">
          <div className="group flex items-center justify-between px-2">
            <button type="button" className="flex items-center gap-1" onClick={() => toggleCollapsed(path)}>
              <span className="inline-flex size-8 items-center justify-center">
                {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
              </span>
              <div>
                <div className="text-xs font-semibold tracking-wider text-fd-muted-foreground">{item.title}</div>
                {isTopLevel && item.id ? (
                  <div className="text-[10px] uppercase tracking-[0.12em] text-fd-muted-foreground/80">ID: {item.id}</div>
                ) : null}
              </div>
            </button>
            <div className={cn('flex items-center', 'opacity-0 transition group-hover:opacity-100')}>
              <Menu
                open={isMenuOpen}
                onOpenChange={setMenuOpen}
                trigger={({ onClick }) => (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onClick={(e) => {
                      e.stopPropagation();
                      onClick();
                    }}
                  >
                    <MoreVertical className="size-4" />
                  </Button>
                )}
              >
                <MenuItem
                  onClick={() => {
                    addChild(path, 'page');
                    setMenuOpen(false);
                  }}
                >
                  <Plus className="size-4" /> Add page
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    addChild(path, 'folder');
                    setMenuOpen(false);
                  }}
                >
                  <Plus className="size-4" /> Add group
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    addChild(path, 'link');
                    setMenuOpen(false);
                  }}
                >
                  <Link2 className="size-4" /> Add link
                </MenuItem>
                <MenuSep />
                <MenuItem
                  onClick={() => {
                    rename();
                    setMenuOpen(false);
                  }}
                >
                  <Pencil className="size-4" /> Rename
                </MenuItem>
                {isTopLevel ? (
                  <MenuItem
                    onClick={() => {
                      editGroupId();
                      setMenuOpen(false);
                    }}
                  >
                    <Pencil className="size-4" /> Edit group ID
                  </MenuItem>
                ) : null}
                <MenuSep />
                <MenuItem
                  onClick={() => {
                    moveUp(path);
                    setMenuOpen(false);
                  }}
                >
                  <ArrowUp className="size-4" /> Move up
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    moveDown(path);
                    setMenuOpen(false);
                  }}
                >
                  <ArrowDown className="size-4" /> Move down
                </MenuItem>
                <MenuSep />
                <MenuItem
                  destructive
                  onClick={() => {
                    removeAt(path);
                    setMenuOpen(false);
                  }}
                >
                  <Trash2 className="size-4" /> Delete
                </MenuItem>
              </Menu>
            </div>
          </div>
          {open ? (
            <div className="space-y-1 pb-2 pt-2">{item.children.map((c, idx) => renderNode(c, [...path, idx]))}</div>
          ) : null}
        </div>
      );
    }

    if (item.type === 'folder') {
      const rename = () => {
        const next = (window.prompt('Group title', item.title) ?? '').trim();
        if (!next) return;
        updateAt(path, (n) => (n.type === 'folder' ? { ...n, title: next } : n));
      };
      const editGroupId = () => {
        const nextId = promptGroupId(item.id, item.title);
        updateAt(path, (n) => (n.type === 'folder' ? { ...n, id: nextId } : n));
      };
      const isTopLevel = path.length === 1;

      return (
        <div key={k} className={cn(depth ? 'border-l border-fd-border' : '')}>
          <Row
            depth={depth}
            leading={
              <>
                <IconBtn onClick={() => toggleCollapsed(path)}>
                  {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                </IconBtn>
                <Folder className="size-4 text-fd-muted-foreground" />
              </>
            }
            title={item.title}
            subtitle={isTopLevel && item.id ? `ID: ${item.id}` : undefined}
            onClick={() => toggleCollapsed(path)}
            actions={
              <Menu
                open={isMenuOpen}
                onOpenChange={setMenuOpen}
                trigger={({ onClick }) => (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onClick={(e) => {
                      e.stopPropagation();
                      onClick();
                    }}
                  >
                    <MoreVertical className="size-4" />
                  </Button>
                )}
              >
                <MenuItem
                  onClick={() => {
                    addChild(path, 'page');
                    setMenuOpen(false);
                  }}
                >
                  <Plus className="size-4" /> Add page
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    addChild(path, 'folder');
                    setMenuOpen(false);
                  }}
                >
                  <Plus className="size-4" /> Add group
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    addChild(path, 'link');
                    setMenuOpen(false);
                  }}
                >
                  <Link2 className="size-4" /> Add link
                </MenuItem>
                <MenuSep />
                <MenuItem
                  onClick={() => {
                    rename();
                    setMenuOpen(false);
                  }}
                >
                  <Pencil className="size-4" /> Rename
                </MenuItem>
                {isTopLevel ? (
                  <MenuItem
                    onClick={() => {
                      editGroupId();
                      setMenuOpen(false);
                    }}
                  >
                    <Pencil className="size-4" /> Edit group ID
                  </MenuItem>
                ) : null}
                <MenuSep />
                <MenuItem
                  onClick={() => {
                    moveUp(path);
                    setMenuOpen(false);
                  }}
                >
                  <ArrowUp className="size-4" /> Move up
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    moveDown(path);
                    setMenuOpen(false);
                  }}
                >
                  <ArrowDown className="size-4" /> Move down
                </MenuItem>
                <MenuSep />
                <MenuItem
                  destructive
                  onClick={() => {
                    removeAt(path);
                    setMenuOpen(false);
                  }}
                >
                  <Trash2 className="size-4" /> Delete
                </MenuItem>
              </Menu>
            }
          />
          {open ? <div className="space-y-1 pb-2">{item.children.map((c, idx) => renderNode(c, [...path, idx]))}</div> : null}
        </div>
      );
    }

    if (item.type === 'link') {
      const edit = () => {
        const nextTitle = (window.prompt('Link title', item.title) ?? '').trim();
        if (!nextTitle) return;
        const nextHref = (window.prompt('Link href', item.href) ?? '').trim();
        if (!nextHref) return;
        updateAt(path, (n) => (n.type === 'link' ? { ...n, title: nextTitle, href: nextHref } : n));
      };

      return (
        <div key={k}>
          <Row
            depth={depth}
            leading={<Link2 className="size-4 text-fd-muted-foreground" />}
            title={item.title}
            subtitle={item.href}
            onClick={edit}
            actions={
              <Menu
                open={isMenuOpen}
                onOpenChange={setMenuOpen}
                trigger={({ onClick }) => (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onClick={(e) => {
                      e.stopPropagation();
                      onClick();
                    }}
                  >
                    <MoreVertical className="size-4" />
                  </Button>
                )}
              >
                <MenuItem
                  onClick={() => {
                    edit();
                    setMenuOpen(false);
                  }}
                >
                  <Pencil className="size-4" /> Edit
                </MenuItem>
                <MenuSep />
                <MenuItem
                  onClick={() => {
                    moveUp(path);
                    setMenuOpen(false);
                  }}
                >
                  <ArrowUp className="size-4" /> Move up
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    moveDown(path);
                    setMenuOpen(false);
                  }}
                >
                  <ArrowDown className="size-4" /> Move down
                </MenuItem>
                <MenuSep />
                <MenuItem
                  destructive
                  onClick={() => {
                    removeAt(path);
                    setMenuOpen(false);
                  }}
                >
                  <Trash2 className="size-4" /> Delete
                </MenuItem>
              </Menu>
            }
          />
        </div>
      );
    }

    const p = pagesById.get(item.pageId);
    const title = item.titleOverride?.trim() || p?.title || item.pageId;
    
    // Check if this specific node should be selected
    let selected = false;
    if (activePageId === item.pageId) {
      if (lastSelection && lastSelection.pageId === activePageId) {
        selected = lastSelection.pathKey === k;
      } else {
        // Fallback: select the first occurrence if no specific selection
        const paths = pagePaths.get(item.pageId) || [];
        selected = paths[0] === k;
      }
    }
    
    const hidden = !!item.hidden;

    const edit = () => {
      onSelectPage(item.pageId);
      setLastSelection({ pathKey: k, pageId: item.pageId });
    };
    const setTitleOverride = () => {
      const next = window.prompt('Title override (empty to clear)', item.titleOverride ?? '') ?? '';
      updateAt(path, (n) => (n.type === 'page' ? { ...n, titleOverride: next.trim() ? next.trim() : undefined } : n));
    };
    const changePage = () => {
      const hint = p?.slug || item.pageId;
      const raw = (window.prompt('Change to page slug or pageId', hint) ?? '').trim();
      if (!raw) return;
      const found = pagesById.get(raw) ?? pagesBySlug.get(raw);
      if (!found) return;
      updateAt(path, (n) => (n.type === 'page' ? { ...n, pageId: found.id } : n));
    };

    return (
      <div key={k}>
        <Row
          depth={depth}
          selected={selected}
          hidden={hidden}
          leading={<FileText className="size-4 text-fd-muted-foreground" />}
          title={title}
          onClick={edit}
          actions={
            <Menu
              open={isMenuOpen}
              onOpenChange={setMenuOpen}
              trigger={({ onClick }) => (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  onClick={(e) => {
                    e.stopPropagation();
                    onClick();
                  }}
                >
                  <MoreVertical className="size-4" />
                </Button>
              )}
            >
              <MenuItem
                onClick={() => {
                  edit();
                  setMenuOpen(false);
                }}
              >
                <Pencil className="size-4" /> Edit
              </MenuItem>
              <MenuItem
                onClick={() => {
                  changePage();
                  setMenuOpen(false);
                }}
              >
                <Link2 className="size-4" /> Change linked page
              </MenuItem>
              <MenuItem
                onClick={() => {
                  setTitleOverride();
                  setMenuOpen(false);
                }}
              >
                <Pencil className="size-4" /> Title override
              </MenuItem>
              <MenuItem
                onClick={() => {
                  updateAt(path, (n) => (n.type === 'page' ? { ...n, hidden: !n.hidden } : n));
                  setMenuOpen(false);
                }}
              >
                {hidden ? <Eye className="size-4" /> : <EyeOff className="size-4" />} {hidden ? 'Show' : 'Hide'}
              </MenuItem>
              <MenuSep />
              <MenuItem
                onClick={() => {
                  moveUp(path);
                  setMenuOpen(false);
                }}
              >
                <ArrowUp className="size-4" /> Move up
              </MenuItem>
              <MenuItem
                onClick={() => {
                  moveDown(path);
                  setMenuOpen(false);
                }}
              >
                <ArrowDown className="size-4" /> Move down
              </MenuItem>
              <MenuSep />
              <MenuItem
                destructive
                onClick={() => {
                  removeAt(path);
                  setMenuOpen(false);
                }}
              >
                <Trash2 className="size-4" /> Delete
              </MenuItem>
            </Menu>
          }
        />
      </div>
    );
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 px-2 pb-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => addRootItem('section')}>
          <Plus className="size-4" />
          Group
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => addRootItem('page')}>
          <FileText className="size-4" />
          Existing Page
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => addRootItem('link')}>
          <Link2 className="size-4" />
          Link
        </Button>
      </div>
      {nav.items.length ? (
        nav.items.map((it, idx) => renderNode(it, [idx]))
      ) : (
        <div className="rounded-lg border border-dashed border-fd-border p-3 text-sm text-fd-muted-foreground">
          No navigation items
        </div>
      )}
    </div>
  );
}
