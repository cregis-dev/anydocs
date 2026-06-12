'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock, ScrollText, X, XCircle } from 'lucide-react';

import { cn } from '@/lib/utils';
import { RunInspector, auditEntryToRun } from '@/components/studio/run-inspector';

/**
 * AuditLogView (Story 13.10) — a dedicated Audit Log Query surface: a filter bar
 * (Scope / Resource / When / Status / Search) mapping to the `audit-log-service.query()`
 * axes (Story 10.4), a reverse-chronological list, a detail panel, and per-entry
 * rollback (Story 10.5) — matching UX spec §6.2. Reaches the core services over the
 * dev-only `/api/local/audit` route.
 *
 * NOTE: the audit log is populated by Agent operations (Epic 11) + audited human
 * writes; until that wiring lands the log is typically empty (empty state shown).
 */

type AuditEntryView = {
  id: string;
  timestamp: string;
  scope: 'inline' | 'page' | 'workspace';
  operation: string;
  status: 'pending' | 'committed' | 'rejected';
  projectId: string;
  target: { resourceKind: string; pageId?: string };
  actor: { kind: string; agentProvider?: string };
  diff?: { summary?: string };
  rollbackOf?: string;
  promptDigest?: string;
};

type QueryResult = { entries: AuditEntryView[]; total: number; hasMore: boolean };

export type AuditLogViewProps = {
  onClose: () => void;
  /** Builds the `/api/local/audit` URL with the active project query params. */
  buildUrl: (params: Record<string, string | undefined>) => string;
};

const SCOPES = ['inline', 'page', 'workspace'] as const;
const RESOURCES = ['block', 'page', 'navigation', 'project-config'] as const;
const STATUSES = ['pending', 'committed', 'rejected'] as const;

function StatusIcon({ status }: { status: AuditEntryView['status'] }) {
  if (status === 'committed') return <CheckCircle2 className="size-4 text-emerald-500" />;
  if (status === 'rejected') return <XCircle className="size-4 text-red-500" />;
  return <Clock className="size-4 text-amber-500" />;
}

function ScopeBadge({ scope }: { scope: AuditEntryView['scope'] }) {
  return (
    <span className="rounded bg-fd-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-fd-muted-foreground">
      {scope}
    </span>
  );
}

export function AuditLogView({ onClose, buildUrl }: AuditLogViewProps) {
  const [scope, setScope] = useState('');
  const [resourceKind, setResourceKind] = useState('');
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [search, setSearch] = useState('');
  const [result, setResult] = useState<QueryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rollingBack, setRollingBack] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = buildUrl({
        scope: scope || undefined,
        resourceKind: resourceKind || undefined,
        status: status || undefined,
        from: from ? new Date(from).toISOString() : undefined,
        limit: '200',
      });
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Query failed (${response.status})`);
      setResult((await response.json()) as QueryResult);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setResult({ entries: [], total: 0, hasMore: false });
    } finally {
      setLoading(false);
    }
  }, [buildUrl, scope, resourceKind, status, from]);

  useEffect(() => {
    void load();
  }, [load]);

  const entries = useMemo(() => {
    const all = result?.entries ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return all;
    return all.filter((entry) =>
      `${entry.operation} ${entry.diff?.summary ?? ''} ${entry.target.pageId ?? ''}`.toLowerCase().includes(q),
    );
  }, [result, search]);

  const selected = entries.find((entry) => entry.id === selectedId) ?? null;

  async function onRollback(entryId: string) {
    setRollingBack(true);
    setError(null);
    try {
      const response = await fetch(buildUrl({}), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ entryId }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Rollback failed (${response.status})`);
      }
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setRollingBack(false);
    }
  }

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-fd-background" data-testid="studio-audit-log-view">
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-fd-border px-4">
        <span className="flex items-center gap-2 text-sm font-semibold">
          <ScrollText className="size-4" /> Audit log
        </span>
        <button type="button" onClick={onClose} className="rounded-md p-1.5 hover:bg-fd-muted" aria-label="Close audit log" data-testid="studio-audit-close">
          <X className="size-4" />
        </button>
      </div>

      {/* Filter bar */}
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-fd-border px-4 py-2" data-testid="audit-filter-bar">
        <select value={scope} onChange={(e) => setScope(e.target.value)} className="rounded-md border border-fd-border bg-fd-background px-2 py-1 text-xs" data-testid="audit-filter-scope">
          <option value="">All scopes</option>
          {SCOPES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={resourceKind} onChange={(e) => setResourceKind(e.target.value)} className="rounded-md border border-fd-border bg-fd-background px-2 py-1 text-xs" data-testid="audit-filter-resource">
          <option value="">All resources</option>
          {RESOURCES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-md border border-fd-border bg-fd-background px-2 py-1 text-xs" data-testid="audit-filter-when" aria-label="From date" />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-md border border-fd-border bg-fd-background px-2 py-1 text-xs" data-testid="audit-filter-status">
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" className="min-w-32 flex-1 rounded-md border border-fd-border bg-fd-background px-2 py-1 text-xs" data-testid="audit-filter-search" />
        <span className="ml-auto text-[10px] text-fd-muted-foreground" data-testid="audit-retention-hint">Retention: 30 days</span>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* List */}
        <div className="min-h-0 w-1/2 overflow-y-auto border-r border-fd-border" data-testid="audit-list">
          {loading ? (
            <div className="p-4 text-sm text-fd-muted-foreground">Loading…</div>
          ) : error ? (
            <div className="p-4 text-sm text-red-500">{error}</div>
          ) : entries.length === 0 ? (
            <div className="p-8 text-center text-sm text-fd-muted-foreground" data-testid="audit-empty">
              No audit entries.
              <div className="mt-1 text-xs">Entries appear once Agent operations + audited writes run (Epic 11).</div>
            </div>
          ) : (
            entries.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => setSelectedId(entry.id)}
                className={cn('flex w-full items-center gap-2 border-b border-fd-border px-3 py-2 text-left text-sm', entry.id === selectedId ? 'bg-fd-muted' : 'hover:bg-fd-muted/50')}
                data-testid="audit-row"
              >
                <StatusIcon status={entry.status} />
                <ScopeBadge scope={entry.scope} />
                <span className="min-w-0 flex-1 truncate">{entry.diff?.summary || `${entry.operation} · ${entry.target.resourceKind}`}</span>
                <span className="shrink-0 font-mono text-[10px] text-fd-muted-foreground">{entry.timestamp.slice(0, 16).replace('T', ' ')}</span>
              </button>
            ))
          )}
        </div>

        {/* Detail panel — reuses the Story 13.8 Run Inspector layout (epic AC2). */}
        <div className="min-h-0 w-1/2 overflow-hidden" data-testid="audit-detail">
          {selected ? (
            <RunInspector
              run={auditEntryToRun(selected)}
              rollingBack={rollingBack}
              onRollback={() => void onRollback(selected.id)}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-fd-muted-foreground">Select an entry to inspect.</div>
          )}
        </div>
      </div>
    </div>
  );
}

