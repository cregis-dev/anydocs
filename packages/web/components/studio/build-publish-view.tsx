'use client';

import { useState, type ReactNode } from 'react';
import { CheckCircle2, Copy, Hammer, Loader2, Sparkles, XCircle } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * BuildPublishView (Story 13.9) — a full-window Build & Publish surface
 * (ScreenLocalBuild / ScreenLocalBuildFailed) over the existing Phase 1 build
 * service (`runBuild`). The underlying core build service is unchanged — this is
 * the same one the CLI uses; the UI just surfaces its result + status.
 *
 * NOTE: `runBuild` returns a single final result (artifactRoot + per-language
 * published counts), not a streaming log — so the "log" here is the final
 * status/summary rather than a live stream. The "Resolve with Writer" failure
 * affordance invokes the workspace Agent (Epic 11 / palette) and is deferred.
 */

export type BuildPublishViewProps = {
  onClose: () => void;
  onRunBuild: () => void;
  building: boolean;
  busyLabel?: string | null;
  elapsedLabel?: string | null;
  success: { artifactRoot: string; message: string } | null;
  error: string | null;
  errorTitle?: string | null;
  errorRemediation?: string | null;
  themeId?: string;
};

export function BuildPublishView({
  onClose,
  onRunBuild,
  building,
  busyLabel,
  elapsedLabel,
  success,
  error,
  errorTitle,
  errorRemediation,
  themeId,
}: BuildPublishViewProps) {
  const [copied, setCopied] = useState(false);

  function copyPath(path: string) {
    void navigator.clipboard?.writeText(path).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    });
  }

  const status: 'building' | 'success' | 'error' | 'idle' = building
    ? 'building'
    : error
      ? 'error'
      : success
        ? 'success'
        : 'idle';

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-fd-background" data-testid="studio-build-view">
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-fd-border px-4">
        <span className="flex items-center gap-2 text-sm font-semibold">
          <Hammer className="size-4" /> Build &amp; Publish
        </span>
        <button type="button" onClick={onClose} className="rounded-md p-1.5 text-sm hover:bg-fd-muted" data-testid="studio-build-close">
          Close
        </button>
      </div>

      <div className="mx-auto w-full max-w-2xl flex-1 overflow-y-auto p-8">
        {status === 'idle' ? (
          <div data-testid="build-idle">
            <h1 className="mb-1 text-2xl font-semibold">Build &amp; Publish</h1>
            <p className="mb-6 text-sm text-fd-muted-foreground">
              Generates the static reading site, search index, <code className="font-mono">llms.txt</code>, and MCP artifacts from
              <strong> published</strong> pages only.
            </p>
            <button type="button" onClick={onRunBuild} className="flex items-center gap-2 rounded-lg bg-fd-primary px-4 py-2 text-sm font-medium text-fd-primary-foreground hover:opacity-90" data-testid="build-run">
              <Hammer className="size-4" /> Run build
            </button>
          </div>
        ) : null}

        {status === 'building' ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center" data-testid="build-running">
            <Loader2 className="size-8 animate-spin text-fd-muted-foreground" />
            <div className="text-sm font-medium">{busyLabel ?? 'Building…'}</div>
            {elapsedLabel ? <div className="text-xs text-fd-muted-foreground">{elapsedLabel}</div> : null}
          </div>
        ) : null}

        {status === 'success' && success ? (
          <div data-testid="build-success">
            <div className="mb-4 flex items-center gap-2 text-emerald-600">
              <CheckCircle2 className="size-6" />
              <h1 className="text-2xl font-semibold">Build completed</h1>
            </div>
            <div className="space-y-3 rounded-lg border border-fd-border bg-fd-card p-4">
              <Row label="Summary" value={success.message} />
              <Row
                label="Output"
                value={
                  <span className="flex items-center gap-2">
                    <span className="min-w-0 truncate font-mono text-xs">{success.artifactRoot}</span>
                    <button type="button" onClick={() => copyPath(success.artifactRoot)} className="shrink-0 rounded p-1 hover:bg-fd-muted" title="Copy path" data-testid="build-copy-path">
                      <Copy className="size-3.5" />
                    </button>
                    {copied ? <span className="text-[10px] text-emerald-600">Copied</span> : null}
                  </span>
                }
              />
              {themeId ? <Row label="Reader theme" value={<span className="font-mono text-xs">{themeId}</span>} /> : null}
              <Row label="Publication boundary" value="published-only (draft / in_review excluded)" />
            </div>
            <button type="button" onClick={onRunBuild} className="mt-4 rounded-lg border border-fd-border px-3 py-1.5 text-sm hover:bg-fd-muted" data-testid="build-rerun">
              Rebuild
            </button>
          </div>
        ) : null}

        {status === 'error' ? (
          <div data-testid="build-failed">
            <div className="mb-4 flex items-center gap-2 text-red-600">
              <XCircle className="size-6" />
              <h1 className="text-2xl font-semibold">Build failed</h1>
            </div>
            <div className="rounded-lg border border-red-300/50 bg-red-50/40 p-4 dark:bg-red-950/20" data-testid="build-error-log">
              <div className="text-sm font-semibold text-red-700 dark:text-red-300">{errorTitle ?? 'Build failed'}</div>
              <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-xs text-fd-foreground">{error}</pre>
              {errorRemediation ? <div className="mt-2 text-xs text-fd-muted-foreground">Fix: {errorRemediation}</div> : null}
            </div>
            <div className="mt-4 flex items-center gap-2">
              <button type="button" onClick={onRunBuild} className="rounded-lg border border-fd-border px-3 py-1.5 text-sm hover:bg-fd-muted" data-testid="build-retry">
                Retry build
              </button>
              <button
                type="button"
                disabled
                title="Invokes the workspace Agent to attempt a fix (Epic 11)"
                className={cn('flex cursor-not-allowed items-center gap-1.5 rounded-lg border border-fd-border px-3 py-1.5 text-sm opacity-60')}
                data-testid="build-resolve-with-writer"
              >
                <Sparkles className="size-4" /> Resolve with Writer
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-fd-muted-foreground">{label}</div>
      <div className="text-sm text-fd-foreground">{value}</div>
    </div>
  );
}
