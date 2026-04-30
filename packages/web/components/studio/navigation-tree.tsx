'use client';

import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  MoreVertical,
  FileText,
  Folder,
  Link2,
  Pencil,
  Plus,
  Copy,
  Trash2,
  CheckCircle,
} from 'lucide-react';

import type { NavItem, NavigationDoc, PageDoc } from '@/lib/docs/types';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type IndexPath = number[];

function toTestIdSegment(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'item';
}

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
  testId,
}: {
  onClick: () => void;
  children: React.ReactNode;
  destructive?: boolean;
  testId?: string;
}) => (
  <button
    type="button"
    role="menuitem"
    data-testid={testId}
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

function handlePseudoButtonKeyDown(event: ReactKeyboardEvent<HTMLElement>, onActivate?: () => void) {
  if (!onActivate) {
    return;
  }

  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    onActivate();
  }
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
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(event) => handlePseudoButtonKeyDown(event, onClick)}
      className="flex min-w-0 flex-1 items-center gap-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring"
    >
      {leading}
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{title}</div>
        {subtitle ? <div className="truncate text-xs text-fd-muted-foreground">{subtitle}</div> : null}
      </div>
    </div>
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
  onOpenPageSettings,
  moveUp,
  moveDown,
  addChild,
  onRequestRenameGroup,
  onRequestEditLink,
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
  moveUp: (path: IndexPath) => void;
  moveDown: (path: IndexPath) => void;
  addChild: (parentPath: IndexPath, kind: 'group' | 'page' | 'link') => Promise<void> | void;
  onRequestRenameGroup: (path: IndexPath, title: string) => void;
  onRequestEditLink: (path: IndexPath, title: string, href: string) => void;
  onDeletePage: (pageId: string) => void;
  onApprovePage: (pageId: string) => void;
  onDuplicatePage: (pageId: string) => void;
  onSetPageStatus: (pageId: string, status: PageDoc['status']) => void;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [openMenuKey, setOpenMenuKey] = useState<string | null>(null);
  const [lastSelection, setLastSelection] = useState<{ pathKey: string; pageId: string } | null>(null);

  const pagesById = useMemo(() => new Map(pages.map((p) => [p.id, p])), [pages]);
  
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
      const rename = () => onRequestRenameGroup(path, item.title);

      return (
        <div key={k} className="pt-3">
          <div className="group flex items-center justify-between px-2">
            <div
              role="button"
              tabIndex={0}
              data-testid={`studio-nav-section-${toTestIdSegment(k)}`}
              className="flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring"
              onClick={() => toggleCollapsed(path)}
              onKeyDown={(event) => handlePseudoButtonKeyDown(event, () => toggleCollapsed(path))}
            >
              <span className="inline-flex size-8 items-center justify-center">
                {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
              </span>
              <div className="text-xs font-semibold tracking-wider text-fd-muted-foreground">{item.title}</div>
            </div>
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
                    data-testid={`studio-nav-section-menu-trigger-${toTestIdSegment(k)}`}
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
                    rename();
                    setMenuOpen(false);
                  }}
                  testId={`studio-nav-section-rename-button-${toTestIdSegment(k)}`}
                >
                  <Pencil className="size-4" /> Rename
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    void addChild(path, 'page');
                    setMenuOpen(false);
                  }}
                >
                  <Plus className="size-4" /> Add Page
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    void addChild(path, 'link');
                    setMenuOpen(false);
                  }}
                >
                  <Link2 className="size-4" /> Add Link
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    void addChild(path, 'group');
                    setMenuOpen(false);
                  }}
                >
                  <Plus className="size-4" /> Add Group
                </MenuItem>
                <MenuSep />
                <MenuItem
                  onClick={() => {
                    moveUp(path);
                    setMenuOpen(false);
                  }}
                >
                  <ArrowUp className="size-4" /> Move Up
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    moveDown(path);
                    setMenuOpen(false);
                  }}
                >
                  <ArrowDown className="size-4" /> Move Down
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
      const rename = () => onRequestRenameGroup(path, item.title);

      return (
        <div key={k} className={cn(depth ? 'border-l border-fd-border' : '')}>
          <Row
            depth={depth}
            leading={
              <>
                <span className="inline-flex size-8 items-center justify-center">
                  {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                </span>
                <Folder className="size-4 text-fd-muted-foreground" />
              </>
            }
            title={<span data-testid={`studio-nav-folder-${toTestIdSegment(k)}`}>{item.title}</span>}
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
                    data-testid={`studio-nav-folder-menu-trigger-${toTestIdSegment(k)}`}
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
                    rename();
                    setMenuOpen(false);
                  }}
                  testId={`studio-nav-folder-rename-button-${toTestIdSegment(k)}`}
                >
                  <Pencil className="size-4" /> Rename
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    void addChild(path, 'page');
                    setMenuOpen(false);
                  }}
                >
                  <Plus className="size-4" /> Add Page
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    void addChild(path, 'link');
                    setMenuOpen(false);
                  }}
                >
                  <Link2 className="size-4" /> Add Link
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    void addChild(path, 'group');
                    setMenuOpen(false);
                  }}
                >
                  <Plus className="size-4" /> Add Group
                </MenuItem>
                <MenuSep />
                <MenuItem
                  onClick={() => {
                    moveUp(path);
                    setMenuOpen(false);
                  }}
                >
                  <ArrowUp className="size-4" /> Move Up
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    moveDown(path);
                    setMenuOpen(false);
                  }}
                >
                  <ArrowDown className="size-4" /> Move Down
                </MenuItem>
              </Menu>
            }
          />
          {open ? <div className="space-y-1 pb-2">{item.children.map((c, idx) => renderNode(c, [...path, idx]))}</div> : null}
        </div>
      );
    }

    if (item.type === 'link') {
      const edit = () => onRequestEditLink(path, item.title, item.href);

      return (
        <div key={k}>
          <Row
            depth={depth}
            leading={<Link2 className="size-4 text-fd-muted-foreground" />}
            title={<span data-testid={`studio-nav-link-${toTestIdSegment(k)}`}>{item.title}</span>}
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
                    data-testid={`studio-nav-link-menu-trigger-${toTestIdSegment(k)}`}
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
                  testId={`studio-nav-link-edit-button-${toTestIdSegment(k)}`}
                >
                  <Pencil className="size-4" /> Edit
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    moveUp(path);
                    setMenuOpen(false);
                  }}
                >
                  <ArrowUp className="size-4" /> Move Up
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    moveDown(path);
                    setMenuOpen(false);
                  }}
                >
                  <ArrowDown className="size-4" /> Move Down
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

    const hasPendingReview = !!(p?.review?.required && !p?.review?.approvedAt);
    const statusIconClass =
      hasPendingReview ? 'size-4 text-orange-500' :
      p?.status === 'in_review' ? 'size-4 text-blue-500' :
      p?.status === 'draft' ? 'size-4 text-amber-500' :
      'size-4 text-fd-muted-foreground';


    const select = () => {
      onSelectPage(item.pageId);
      setLastSelection({ pathKey: k, pageId: item.pageId });
    };

    const edit = () => {
      onOpenPageSettings(item.pageId);
      setLastSelection({ pathKey: k, pageId: item.pageId });
    };

    return (
      <div key={k}>
        <Row
          depth={depth}
          selected={selected}
          hidden={hidden}
          leading={<FileText className={statusIconClass} />}
          title={title}
          onClick={select}
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
                  data-testid={`studio-nav-page-menu-trigger-${item.pageId}`}
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
                testId={`studio-nav-page-edit-button-${item.pageId}`}
              >
                  <Pencil className="size-4" /> Edit
              </MenuItem>
              <MenuItem
                onClick={() => {
                  onDuplicatePage(item.pageId);
                  setMenuOpen(false);
                }}
                testId={`studio-nav-page-duplicate-button-${item.pageId}`}
              >
                <Copy className="size-4" /> Duplicate Page
              </MenuItem>
              <MenuSep />
              <div className="px-2 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wide text-fd-muted-foreground">
                Page Status
              </div>
              {(['draft', 'in_review', 'published'] as const).map((nextStatus) => (
                <MenuItem
                  key={nextStatus}
                  onClick={() => {
                    onSetPageStatus(item.pageId, nextStatus);
                    setMenuOpen(false);
                  }}
                  testId={`studio-nav-page-status-${nextStatus}-button-${item.pageId}`}
                >
                  <CheckCircle className={cn('size-4', p?.status === nextStatus ? 'text-green-500' : 'text-fd-muted-foreground')} />
                  {nextStatus === 'draft' ? 'Draft' : nextStatus === 'in_review' ? 'In Review' : 'Published'}
                </MenuItem>
              ))}
              <MenuSep />
              <MenuItem
                onClick={() => {
                  moveUp(path);
                  setMenuOpen(false);
                }}
              >
                <ArrowUp className="size-4" /> Move Up
              </MenuItem>
              <MenuItem
                onClick={() => {
                  moveDown(path);
                  setMenuOpen(false);
                }}
              >
                <ArrowDown className="size-4" /> Move Down
              </MenuItem>
              {hasPendingReview ? (
                <>
                  <MenuSep />
                  <MenuItem
                    onClick={() => {
                      onApprovePage(item.pageId);
                      setMenuOpen(false);
                    }}
                    testId={`studio-nav-page-approve-button-${item.pageId}`}
                  >
                    <CheckCircle className="size-4 text-green-500" /> Approve
                  </MenuItem>
                </>
              ) : null}
              <MenuSep />
              <MenuItem
                onClick={() => {
                  onDeletePage(item.pageId);
                  setMenuOpen(false);
                }}
                testId={`studio-nav-page-delete-button-${item.pageId}`}
              >
                <Trash2 className="size-4 text-red-500" /> Delete
              </MenuItem>
            </Menu>
          }
        />
      </div>
    );
  };

  return (
    <div className="space-y-1">
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
