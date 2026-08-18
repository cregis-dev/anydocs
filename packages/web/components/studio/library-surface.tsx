'use client';

import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { Clock, FilePlus2, FileText, FolderOpen, Sparkles, LibraryBig } from 'lucide-react';

import { LocalChip } from '@/lib/desktop-shell';
import type { PageDoc, PageStatus } from '@/lib/docs/types';

/**
 * LibrarySurface (Story 13.4) — the post-project-open landing surface shown in
 * the editor region when a project is open but no page is selected. Restyled to
 * the Claude Design desktop handoff vocabulary: warm neutral `--n-*` surfaces,
 * brand/AI accents, mono filenames + numerals, near-black primary CTA. Matches
 * the handoff `ScreenLibrary` composition (Continue / Recent / Stats) and the
 * `ds-library-empty` empty state.
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

const STATUS_COLOR: Record<PageStatus, string> = {
  draft: 'var(--warn-500)',
  in_review: 'var(--info-500)',
  published: 'var(--ok-500)',
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

function StatusDot({ status }: { status: PageStatus }) {
  return (
    <span
      style={{ width: 6, height: 6, borderRadius: 999, background: STATUS_COLOR[status], display: 'inline-block', flex: 'none' }}
    />
  );
}

function SectionCaption({ children }: { children: ReactNode }) {
  return (
    <h2
      style={{
        margin: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 11,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        color: 'var(--n-600)',
      }}
    >
      {children}
    </h2>
  );
}

function PageCard({ page, onSelect }: { page: PageDoc; onSelect: (id: string) => void }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={() => onSelect(page.id)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="flex w-full items-start gap-3 p-3 text-left"
      style={{
        borderRadius: 'var(--r-8)',
        border: `1px solid ${hover ? 'color-mix(in oklch, var(--brand-500) 45%, transparent)' : 'var(--n-200)'}`,
        background: hover ? 'var(--n-100)' : 'var(--n-0)',
        transition: 'background 120ms var(--ease), border-color 120ms var(--ease)',
      }}
      data-testid="library-page-card"
      data-page-id={page.id}
    >
      <FileText className="mt-0.5 size-4 shrink-0" style={{ color: 'var(--n-400)' }} />
      <span className="min-w-0 flex-1">
        <span
          className="block truncate"
          style={{ fontSize: 'var(--t-13)', fontWeight: 500, color: 'var(--n-900)' }}
        >
          {page.title || page.slug}
        </span>
        <span className="mt-1 flex items-center gap-2" style={{ fontSize: 11, color: 'var(--n-500)' }}>
          <StatusDot status={page.status} />
          {STATUS_LABEL[page.status]}
          {page.updatedAt ? <span style={{ color: 'var(--n-400)' }}>· {formatWhen(page.updatedAt)}</span> : null}
        </span>
        {page.slug ? (
          <span
            className="mt-1 block truncate"
            style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--n-400)' }}
          >
            {page.slug}
          </span>
        ) : null}
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
  const [hover, setHover] = useState(false);
  const disabled = !onClick;

  let style: CSSProperties;
  if (primary) {
    style = {
      border: '1px solid var(--n-900)',
      background: hover && !disabled ? 'var(--n-800)' : 'var(--n-900)',
      color: 'var(--n-0)',
      boxShadow: 'var(--sh-1)',
    };
  } else {
    style = {
      border: '1px solid var(--n-200)',
      background: hover && !disabled ? 'var(--n-100)' : 'var(--n-0)',
      color: 'var(--n-800)',
      boxShadow: 'var(--sh-1)',
    };
  }

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      disabled={disabled}
      title={disabled ? hint : undefined}
      className="flex items-center gap-3 p-3 text-left"
      style={{
        borderRadius: 'var(--r-8)',
        transition: 'background 120ms var(--ease), border-color 120ms var(--ease)',
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        ...style,
      }}
      data-testid="library-cta"
    >
      <span className="shrink-0" style={{ opacity: primary ? 1 : 0.8 }}>
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block" style={{ fontSize: 'var(--t-13)', fontWeight: 500 }}>
          {label}
        </span>
        {hint ? (
          <span
            className="block"
            style={{ fontSize: 11, marginTop: 1, color: primary ? 'color-mix(in oklch, var(--n-0) 75%, transparent)' : 'var(--n-500)' }}
          >
            {hint}
          </span>
        ) : null}
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
      <div className="ax mx-auto w-full max-w-2xl py-10" data-testid="studio-library-empty">
        <div className="mb-2 flex items-center gap-2" style={{ color: 'var(--n-500)' }}>
          <LibraryBig className="size-4" />
          <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Library
          </span>
          <LocalChip />
        </div>
        <h1 style={{ margin: 0, fontSize: 'var(--t-24)', fontWeight: 600, color: 'var(--n-900)', letterSpacing: '-0.005em' }}>
          {projectName ?? 'Your project'} is empty
        </h1>
        <p style={{ margin: '6px 0 24px', fontSize: 'var(--t-13)', color: 'var(--n-500)' }}>
          Create your first page or bring in existing content.
        </p>
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
    <div className="ax mx-auto w-full max-w-4xl py-10" data-testid="studio-library">
      <div className="mb-6 flex items-center gap-2" style={{ color: 'var(--n-500)' }}>
        <LibraryBig className="size-4" />
        <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          Library
        </span>
        {projectName ? <span style={{ fontSize: 'var(--t-13)', color: 'var(--n-600)' }}>· {projectName}</span> : null}
        <LocalChip />
      </div>

      {continuePages.length > 0 ? (
        <section className="mb-8" data-testid="library-continue">
          <SectionCaption>
            <Clock className="size-3.5" /> Continue
          </SectionCaption>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {continuePages.map((page) => (
              <PageCard key={page.id} page={page} onSelect={onSelectPage} />
            ))}
          </div>
        </section>
      ) : null}

      <section className="mb-8" data-testid="library-recent">
        <SectionCaption>Recent edits</SectionCaption>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {recentPages.map((page) => (
            <PageCard key={page.id} page={page} onSelect={onSelectPage} />
          ))}
        </div>
      </section>

      <section data-testid="library-stats">
        <SectionCaption>At a glance</SectionCaption>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Pages" value={stats.total} />
          <StatCard label="Draft" value={stats.draft} status="draft" />
          <StatCard label="In review" value={stats.in_review} status="in_review" />
          <StatCard label="Published" value={stats.published} status="published" />
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value, status }: { label: string; value: number; status?: PageStatus }) {
  return (
    <div
      style={{
        borderRadius: 'var(--r-8)',
        border: '1px solid var(--n-200)',
        background: 'var(--n-0)',
        padding: '10px 12px',
      }}
    >
      <div className="flex items-center gap-2" style={{ fontSize: 11, color: 'var(--n-500)' }}>
        {status ? <StatusDot status={status} /> : null}
        {label}
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-20)', fontWeight: 600, color: 'var(--n-900)', marginTop: 2 }}>
        {value}
      </div>
    </div>
  );
}
