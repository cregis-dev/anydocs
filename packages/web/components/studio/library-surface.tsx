'use client';

import { useMemo, type ReactNode } from 'react';
import { Clock, FilePlus2, FileText, FolderOpen, Sparkles, LibraryBig } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { PageDoc, PageStatus } from '@/lib/docs/types';

/**
 * LibrarySurface (Story 13.4) — the post-project-open landing surface shown in
 * the editor region when a project is open but no page is selected. Matches the
 * Claude Design `ds-library` composition: Continue (recent in-progress), Recent
 * Edits, and Stats; or the `ds-library-empty` empty state with primary CTAs.
 *
 * Data is a pure projection of the already-loaded `PageDoc[]` (sorted by
 * `updatedAt`). The structural welcome screen still owns first-launch project
 * selection (Story 13.4 AC3); this is only the in-project landing.
 */

export type LibrarySurfaceProps = {
  pages: PageDoc[];
  projectName?: string;
  onSelectPage: (pageId: string) => void;
  onCreatePage: () => void;
  /** Optional CTAs — rendered disabled with a hint when not provided (feature pending). */
  onScaffoldFromPrompt?: () => void;
  onOpenMarkdownFolder?: () => void;
  onOpenExampleVault?: () => void;
};

const STATUS_LABEL: Record<PageStatus, string> = {
  draft: 'Draft',
  in_review: 'In review',
  published: 'Published',
};

const STATUS_DOT: Record<PageStatus, string> = {
  draft: 'bg-amber-400',
  in_review: 'bg-sky-400',
  published: 'bg-emerald-500',
};

function byUpdatedDesc(a: PageDoc, b: PageDoc): number {
  return (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '');
}

function formatWhen(iso?: string): string {
  if (!iso) return '';
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return '';
  return new Date(parsed).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function PageCard({ page, onSelect }: { page: PageDoc; onSelect: (id: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(page.id)}
      className="flex w-full items-start gap-3 rounded-lg border border-fd-border bg-fd-card p-3 text-left transition hover:border-fd-ring hover:bg-fd-muted/40"
      data-testid="library-page-card"
      data-page-id={page.id}
    >
      <FileText className="mt-0.5 size-4 shrink-0 text-fd-muted-foreground" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-fd-foreground">{page.title || page.slug}</span>
        <span className="mt-0.5 flex items-center gap-2 text-xs text-fd-muted-foreground">
          <span className={cn('size-1.5 rounded-full', STATUS_DOT[page.status])} />
          {STATUS_LABEL[page.status]}
          {page.updatedAt ? <span>· {formatWhen(page.updatedAt)}</span> : null}
        </span>
      </span>
    </button>
  );
}

function CTAButton({
  icon,
  label,
  hint,
  onClick,
  primary,
}: {
  icon: ReactNode;
  label: string;
  hint?: string;
  onClick?: () => void;
  primary?: boolean;
}) {
  const disabled = !onClick;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={disabled ? hint : undefined}
      className={cn(
        'flex items-center gap-3 rounded-lg border p-3 text-left text-sm transition',
        primary
          ? 'border-transparent bg-fd-primary text-fd-primary-foreground hover:opacity-90'
          : 'border-fd-border bg-fd-card hover:bg-fd-muted/40',
        disabled && 'cursor-not-allowed opacity-50 hover:bg-fd-card',
      )}
      data-testid="library-cta"
    >
      <span className="shrink-0">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{label}</span>
        {hint ? <span className="block text-xs opacity-70">{hint}</span> : null}
      </span>
    </button>
  );
}

export function LibrarySurface({
  pages,
  projectName,
  onSelectPage,
  onCreatePage,
  onScaffoldFromPrompt,
  onOpenMarkdownFolder,
  onOpenExampleVault,
}: LibrarySurfaceProps) {
  const { continuePages, recentPages, stats } = useMemo(() => {
    const sorted = [...pages].sort(byUpdatedDesc);
    const counts: Record<PageStatus, number> = { draft: 0, in_review: 0, published: 0 };
    for (const page of pages) {
      counts[page.status] += 1;
    }
    return {
      continuePages: sorted.filter((page) => page.status !== 'published').slice(0, 4),
      recentPages: sorted.slice(0, 6),
      stats: { total: pages.length, ...counts },
    };
  }, [pages]);

  if (pages.length === 0) {
    return (
      <div className="mx-auto w-full max-w-2xl py-10" data-testid="studio-library-empty">
        <div className="mb-1 flex items-center gap-2 text-fd-muted-foreground">
          <LibraryBig className="size-5" />
          <span className="text-sm font-semibold uppercase tracking-wider">Library</span>
        </div>
        <h1 className="mb-1 text-2xl font-semibold">{projectName ?? 'Your project'} is empty</h1>
        <p className="mb-6 text-sm text-fd-muted-foreground">Create your first page or bring in existing content.</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <CTAButton icon={<FilePlus2 className="size-5" />} label="New page" onClick={onCreatePage} primary />
          <CTAButton
            icon={<Sparkles className="size-5" />}
            label="Scaffold from prompt"
            hint="Available with the built-in Agent (Epic 11)"
            onClick={onScaffoldFromPrompt}
          />
          <CTAButton
            icon={<FolderOpen className="size-5" />}
            label="Open Markdown folder"
            hint="Use the CLI import flow"
            onClick={onOpenMarkdownFolder}
          />
          <CTAButton
            icon={<LibraryBig className="size-5" />}
            label="Open example vault"
            hint="Available in the desktop runtime"
            onClick={onOpenExampleVault}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl py-10" data-testid="studio-library">
      <div className="mb-6 flex items-center gap-2 text-fd-muted-foreground">
        <LibraryBig className="size-5" />
        <span className="text-sm font-semibold uppercase tracking-wider">Library</span>
        {projectName ? <span className="text-sm">· {projectName}</span> : null}
      </div>

      {continuePages.length > 0 ? (
        <section className="mb-8" data-testid="library-continue">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-fd-foreground">
            <Clock className="size-4" /> Continue
          </h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {continuePages.map((page) => (
              <PageCard key={page.id} page={page} onSelect={onSelectPage} />
            ))}
          </div>
        </section>
      ) : null}

      <section className="mb-8" data-testid="library-recent">
        <h2 className="mb-3 text-sm font-semibold text-fd-foreground">Recent edits</h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {recentPages.map((page) => (
            <PageCard key={page.id} page={page} onSelect={onSelectPage} />
          ))}
        </div>
      </section>

      <section data-testid="library-stats">
        <h2 className="mb-3 text-sm font-semibold text-fd-foreground">Stats</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Pages" value={stats.total} />
          <StatCard label="Draft" value={stats.draft} dot={STATUS_DOT.draft} />
          <StatCard label="In review" value={stats.in_review} dot={STATUS_DOT.in_review} />
          <StatCard label="Published" value={stats.published} dot={STATUS_DOT.published} />
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value, dot }: { label: string; value: number; dot?: string }) {
  return (
    <div className="rounded-lg border border-fd-border bg-fd-card p-3">
      <div className="flex items-center gap-2 text-xs text-fd-muted-foreground">
        {dot ? <span className={cn('size-1.5 rounded-full', dot)} /> : null}
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold text-fd-foreground">{value}</div>
    </div>
  );
}
