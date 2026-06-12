'use client';

import { useState } from 'react';
import { CheckCircle2, CircleDashed, Loader2, RotateCcw, XCircle } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * RunInspector (Story 13.8) — the `ds-inspector` composition: a left-side step
 * timeline + a right-side Diff / Preview / Raw tab set, with an optional model
 * badge + token rate and a "Roll back this run" affordance (Story 10.5).
 *
 * It is a presentational component driven by a `RunView`. Story 13.10's audit
 * detail panel reuses it for visual consistency (each audit entry → a single-step
 * run). LIVE, multi-step Agent runs (with streaming step events + per-file diffs +
 * ⌘[/⌘] navigation) are fed by `agent-service.ts` once Epic 11 lands — that wiring
 * + the full-window live surface are deferred.
 */

export type RunStepState = 'done' | 'running' | 'queued' | 'failed';
export type RunStep = { label: string; state: RunStepState };

export type RunView = {
  title: string;
  subtitle?: string;
  model?: string;
  tokenRate?: string;
  status: 'committed' | 'rejected' | 'pending' | 'running';
  steps: RunStep[];
  diff?: { before?: unknown; after?: unknown; summary?: string };
  raw?: unknown;
};

export type RunInspectorProps = {
  run: RunView;
  onRollback?: () => void;
  rollingBack?: boolean;
};

function StepIcon({ state }: { state: RunStepState }) {
  if (state === 'done') return <CheckCircle2 className="size-4 text-emerald-500" />;
  if (state === 'running') return <Loader2 className="size-4 animate-spin text-sky-500" />;
  if (state === 'failed') return <XCircle className="size-4 text-red-500" />;
  return <CircleDashed className="size-4 text-fd-muted-foreground" />;
}

function pretty(value: unknown): string {
  if (value === undefined) return '—';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function RunInspector({ run, onRollback, rollingBack }: RunInspectorProps) {
  const [tab, setTab] = useState<'diff' | 'preview' | 'raw'>('diff');

  return (
    <div className="flex h-full min-h-0" data-testid="run-inspector">
      {/* Timeline */}
      <div className="w-44 shrink-0 border-r border-fd-border p-3" data-testid="run-timeline">
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-fd-muted-foreground">Timeline</div>
        <ol className="space-y-1.5">
          {run.steps.map((step, index) => (
            <li key={`${step.label}-${index}`} className="flex items-center gap-2 text-xs text-fd-foreground">
              <StepIcon state={step.state} />
              <span className="min-w-0 flex-1 truncate">{step.label}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* Main */}
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center gap-2 border-b border-fd-border px-3 py-2">
          <span className="min-w-0 flex-1 truncate text-sm font-medium">{run.title}</span>
          {run.model ? (
            <span className="shrink-0 rounded bg-fd-muted px-1.5 py-0.5 font-mono text-[10px] text-fd-muted-foreground">{run.model}</span>
          ) : null}
          {run.tokenRate ? <span className="shrink-0 text-[10px] text-fd-muted-foreground">{run.tokenRate}</span> : null}
        </div>

        <div className="flex shrink-0 gap-1 border-b border-fd-border px-3 py-1.5">
          {(['diff', 'preview', 'raw'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn('rounded px-2 py-0.5 text-xs', tab === t ? 'bg-fd-muted text-fd-foreground' : 'text-fd-muted-foreground hover:text-fd-foreground')}
              data-testid={`run-tab-${t}`}
            >
              {t === 'diff' ? 'Diff' : t === 'preview' ? 'Preview' : 'Raw'}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-3 text-xs" data-testid="run-pane">
          {tab === 'diff' ? (
            <div className="space-y-3">
              {run.diff?.summary ? <div className="text-sm text-fd-foreground">{run.diff.summary}</div> : null}
              <DiffBlock label="Before" value={run.diff?.before} tone="before" />
              <DiffBlock label="After" value={run.diff?.after} tone="after" />
            </div>
          ) : tab === 'preview' ? (
            <div className="whitespace-pre-wrap font-sans text-sm text-fd-foreground">
              {run.diff?.summary ?? 'No preview available for this run.'}
            </div>
          ) : (
            <pre className="whitespace-pre-wrap break-words font-mono text-[11px] text-fd-foreground">{pretty(run.raw)}</pre>
          )}
        </div>

        {onRollback && run.status === 'committed' ? (
          <div className="shrink-0 border-t border-fd-border p-3">
            <button
              type="button"
              disabled={rollingBack}
              onClick={onRollback}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
              style={{ background: 'var(--bad-500, #dc2626)' }}
              data-testid="run-rollback"
            >
              <RotateCcw className="size-4" />
              {rollingBack ? 'Rolling back…' : 'Roll back this run'}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function DiffBlock({ label, value, tone }: { label: string; value: unknown; tone: 'before' | 'after' }) {
  if (value === undefined) return null;
  return (
    <div>
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-fd-muted-foreground">{label}</div>
      <pre
        className={cn(
          'whitespace-pre-wrap break-words rounded-md border p-2 font-mono text-[11px]',
          tone === 'before' ? 'border-red-300/40 bg-red-50/30 dark:bg-red-950/15' : 'border-emerald-300/40 bg-emerald-50/30 dark:bg-emerald-950/15',
        )}
      >
        {pretty(value)}
      </pre>
    </div>
  );
}

/** Map a Story 13.10 audit entry into a single-step RunView for the inspector. */
export function auditEntryToRun(entry: {
  operation: string;
  status: 'committed' | 'rejected' | 'pending';
  scope: string;
  actor: { kind: string; agentProvider?: string };
  target: { resourceKind: string; pageId?: string };
  diff?: { before?: unknown; after?: unknown; summary?: string };
  promptDigest?: string;
}): RunView {
  const stepState: RunStepState = entry.status === 'committed' ? 'done' : entry.status === 'rejected' ? 'failed' : 'queued';
  return {
    title: entry.diff?.summary || `${entry.operation} · ${entry.target.resourceKind}${entry.target.pageId ? ` · ${entry.target.pageId}` : ''}`,
    subtitle: entry.scope,
    model: entry.actor.agentProvider,
    status: entry.status,
    steps: [{ label: `${entry.operation} (${entry.status})`, state: stepState }],
    diff: entry.diff,
    raw: entry,
  };
}
