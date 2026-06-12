'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, FileText, Folder, FolderOpen, Settings } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { PageDoc, PageStatus } from '@/lib/docs/types';

/**
 * VaultSidebar (Story 13.3) — a file-tree view of the project's pages, derived
 * from each page's `slug` path (e.g. `getting-started/introduction` →
 * folder `getting-started` › file `introduction`). Selecting a file opens it
 * in the editor. This is the "Files" alternate of the left rail; the structural
 * `NavigationComposer` remains the default "Nav" view (Story 13.3 test-safe
 * sequencing — the AC's "file tree as primary rail" default flip is a follow-up).
 *
 * Anydocs stores pages as `pages/<lang>/*.json` (doc-content-v1), not Markdown,
 * so the tree shows page files (JSON) + a read-only system area for the project
 * config — adapted from the Claude Design `VaultSidebar` which assumed a `.md`
 * vault with `anydocs.config.toml`.
 */

type FileNode = {
  kind: 'file';
  name: string;
  slug: string;
  pageId: string;
  status: PageStatus;
};

type FolderNode = {
  kind: 'folder';
  name: string;
  path: string;
  children: TreeNode[];
};

type TreeNode = FileNode | FolderNode;

export type VaultSidebarProps = {
  pages: PageDoc[];
  activePageId: string | null;
  onSelectPage: (pageId: string) => void;
  /** Language root the files live under (`pages/<lang>/`). */
  lang?: string;
  /** Project config file shown in the read-only system area. */
  configFileName?: string;
};

function buildTree(pages: PageDoc[]): TreeNode[] {
  const root: FolderNode = { kind: 'folder', name: '', path: '', children: [] };

  for (const page of pages) {
    const segments = page.slug.split('/').filter((segment) => segment.length > 0);
    if (segments.length === 0) {
      continue;
    }
    let cursor = root;
    for (let i = 0; i < segments.length - 1; i++) {
      const folderName = segments[i];
      const folderPath = segments.slice(0, i + 1).join('/');
      let next = cursor.children.find(
        (child): child is FolderNode => child.kind === 'folder' && child.name === folderName,
      );
      if (!next) {
        next = { kind: 'folder', name: folderName, path: folderPath, children: [] };
        cursor.children.push(next);
      }
      cursor = next;
    }
    cursor.children.push({
      kind: 'file',
      name: segments[segments.length - 1],
      slug: page.slug,
      pageId: page.id,
      status: page.status,
    });
  }

  sortChildren(root);
  return root.children;
}

function sortChildren(node: FolderNode): void {
  node.children.sort((a, b) => {
    if (a.kind !== b.kind) {
      return a.kind === 'folder' ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });
  for (const child of node.children) {
    if (child.kind === 'folder') {
      sortChildren(child);
    }
  }
}

const STATUS_DOT: Record<PageStatus, string> = {
  draft: 'bg-amber-400',
  in_review: 'bg-sky-400',
  published: 'bg-emerald-500',
};

function FileRow({
  node,
  depth,
  active,
  onSelect,
}: {
  node: FileNode;
  depth: number;
  active: boolean;
  onSelect: (pageId: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(node.pageId)}
      className={cn(
        'flex w-full items-center gap-2 rounded-md py-1 pr-2 text-left text-sm',
        active ? 'bg-fd-muted text-fd-foreground' : 'text-fd-muted-foreground hover:bg-fd-muted/60 hover:text-fd-foreground',
      )}
      style={{ paddingLeft: depth * 12 + 8 }}
      data-testid="vault-file"
      data-page-id={node.pageId}
      title={node.slug}
    >
      <FileText className="size-4 shrink-0 opacity-70" />
      <span className="min-w-0 flex-1 truncate">{node.name}</span>
      <span className={cn('size-1.5 shrink-0 rounded-full', STATUS_DOT[node.status])} title={node.status} />
    </button>
  );
}

function FolderRow({
  node,
  depth,
  activePageId,
  onSelect,
}: {
  node: FolderNode;
  depth: number;
  activePageId: string | null;
  onSelect: (pageId: string) => void;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-1 rounded-md py-1 pr-2 text-left text-sm text-fd-foreground hover:bg-fd-muted/60"
        style={{ paddingLeft: depth * 12 + 4 }}
        data-testid="vault-folder"
      >
        {open ? <ChevronDown className="size-3.5 shrink-0 opacity-60" /> : <ChevronRight className="size-3.5 shrink-0 opacity-60" />}
        {open ? <FolderOpen className="size-4 shrink-0 opacity-70" /> : <Folder className="size-4 shrink-0 opacity-70" />}
        <span className="min-w-0 flex-1 truncate font-medium">{node.name}</span>
      </button>
      {open ? (
        <div>
          {node.children.map((child) =>
            child.kind === 'folder' ? (
              <FolderRow key={`d:${child.path}`} node={child} depth={depth + 1} activePageId={activePageId} onSelect={onSelect} />
            ) : (
              <FileRow key={`f:${child.pageId}`} node={child} depth={depth + 1} active={child.pageId === activePageId} onSelect={onSelect} />
            ),
          )}
        </div>
      ) : null}
    </div>
  );
}

export function VaultSidebar({ pages, activePageId, onSelectPage, lang, configFileName }: VaultSidebarProps) {
  const tree = useMemo(() => buildTree(pages), [pages]);

  return (
    <div className="space-y-3" data-testid="studio-vault-sidebar">
      <div className="px-1 text-[10px] font-semibold uppercase tracking-wider text-fd-muted-foreground">
        {lang ? `pages/${lang}/` : 'pages/'}
      </div>
      {tree.length === 0 ? (
        <div className="px-2 py-3 text-sm text-fd-muted-foreground">No pages yet.</div>
      ) : (
        <div>
          {tree.map((node) =>
            node.kind === 'folder' ? (
              <FolderRow key={`d:${node.path}`} node={node} depth={0} activePageId={activePageId} onSelect={onSelectPage} />
            ) : (
              <FileRow key={`f:${node.pageId}`} node={node} depth={0} active={node.pageId === activePageId} onSelect={onSelectPage} />
            ),
          )}
        </div>
      )}
      <div className="border-t border-fd-border pt-2">
        <div className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-fd-muted-foreground">System</div>
        <div className="flex items-center gap-2 rounded-md px-2 py-1 text-sm text-fd-muted-foreground">
          <Settings className="size-4 shrink-0 opacity-60" />
          <span className="min-w-0 flex-1 truncate">{configFileName ?? 'anydocs.config.json'}</span>
        </div>
      </div>
    </div>
  );
}
