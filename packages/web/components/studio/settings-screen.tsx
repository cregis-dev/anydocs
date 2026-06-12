'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Cpu, DownloadCloud, FolderGit2, Info, Keyboard, Settings2, X } from 'lucide-react';

import { cn } from '@/lib/utils';
import { ONBOARDING_MODEL_PREF_STORAGE_KEY, type ModelPreference } from '@/components/studio/onboarding-stepper';

/**
 * SettingsScreen (Story 13.6) — the six-sub-page Settings surface matching the
 * Claude Design `ScreenSettings*` set: General / Models / Vault / Shortcuts /
 * About / Models-Pulling, sharing a left navigation strip.
 *
 * TEST-SAFE: this is an ADDITIVE full-window overlay. The General sub-page reuses
 * the EXISTING project-settings component (passed in via `general`) — single source
 * of truth, same fields/`data-testid`s — and the existing right-aside settings panel
 * (which Phase 1 acceptance tests drive) is left untouched. No Phase 1 setting is
 * dropped; General hosts them all.
 *
 * The active provider/model in About/Models reads the localStorage placeholder from
 * Story 13.5 (the real provider-port is Story 11.1 / Epic 11, not yet built).
 */

type SettingsTab = 'general' | 'models' | 'vault' | 'shortcuts' | 'about' | 'models-pulling';

const TABS: Array<{ id: SettingsTab; label: string; icon: ReactNode }> = [
  { id: 'general', label: 'General', icon: <Settings2 className="size-4" /> },
  { id: 'models', label: 'Models', icon: <Cpu className="size-4" /> },
  { id: 'vault', label: 'Vault', icon: <FolderGit2 className="size-4" /> },
  { id: 'shortcuts', label: 'Shortcuts', icon: <Keyboard className="size-4" /> },
  { id: 'about', label: 'About', icon: <Info className="size-4" /> },
  { id: 'models-pulling', label: 'Model downloads', icon: <DownloadCloud className="size-4" /> },
];

export type SettingsScreenProps = {
  /** The existing project-settings UI, reused verbatim as the General sub-page. */
  general: ReactNode;
  runtimeMode: string;
  projectName?: string;
  projectPath?: string;
  onClose: () => void;
};

function readModelPreference(): ModelPreference | null {
  try {
    const raw = window.localStorage.getItem(ONBOARDING_MODEL_PREF_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ModelPreference;
    if (typeof parsed?.provider === 'string' && typeof parsed?.model === 'string') {
      return parsed;
    }
  } catch {
    // ignore malformed / unavailable storage
  }
  return null;
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-fd-border py-2 last:border-0">
      <span className="text-sm text-fd-muted-foreground">{label}</span>
      <span className="min-w-0 truncate text-sm font-medium text-fd-foreground">{value}</span>
    </div>
  );
}

export function SettingsScreen({ general, runtimeMode, projectName, projectPath, onClose }: SettingsScreenProps) {
  const [tab, setTab] = useState<SettingsTab>('general');
  const modelPref = useMemo(() => readModelPreference(), []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-fd-background" data-testid="studio-settings-screen">
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-fd-border px-4">
        <span className="text-sm font-semibold">Settings</span>
        <button type="button" onClick={onClose} className="rounded-md p-1.5 hover:bg-fd-muted" aria-label="Close settings" data-testid="studio-settings-close">
          <X className="size-4" />
        </button>
      </div>
      <div className="flex min-h-0 flex-1">
        <nav className="flex w-52 shrink-0 flex-col gap-0.5 border-r border-fd-border p-2" aria-label="Settings sections">
          {TABS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => setTab(entry.id)}
              className={cn(
                'flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm',
                tab === entry.id ? 'bg-fd-muted text-fd-foreground' : 'text-fd-muted-foreground hover:bg-fd-muted/60 hover:text-fd-foreground',
              )}
              data-testid={`studio-settings-tab-${entry.id}`}
            >
              {entry.icon}
              <span className="min-w-0 flex-1 truncate">{entry.label}</span>
            </button>
          ))}
        </nav>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {tab === 'general' ? (
            <div data-testid="settings-pane-general">{general}</div>
          ) : null}

          {tab === 'models' ? (
            <div className="mx-auto max-w-2xl p-6" data-testid="settings-pane-models">
              <h2 className="mb-1 text-lg font-semibold">Models</h2>
              <p className="mb-4 text-sm text-fd-muted-foreground">Your model preference (saved locally from onboarding).</p>
              <div className="rounded-lg border border-fd-border bg-fd-card p-4">
                <Field label="Provider" value={modelPref?.provider ?? 'ollama'} />
                <Field label="Model" value={<span className="font-mono">{modelPref?.model ?? 'llama-3.1-8b'}</span>} />
              </div>
              <p className="mt-3 text-xs text-fd-muted-foreground">
                Full provider configuration (and secure BYOK keys) arrives with the built-in Agent provider-port (Epic 11).
              </p>
            </div>
          ) : null}

          {tab === 'vault' ? (
            <div className="mx-auto max-w-2xl p-6" data-testid="settings-pane-vault">
              <h2 className="mb-1 text-lg font-semibold">Vault</h2>
              <p className="mb-4 text-sm text-fd-muted-foreground">The active project on disk. Edit project fields in General.</p>
              <div className="rounded-lg border border-fd-border bg-fd-card p-4">
                <Field label="Project" value={projectName ?? '—'} />
                <Field label="Path" value={<span className="font-mono">{projectPath ?? '—'}</span>} />
              </div>
            </div>
          ) : null}

          {tab === 'shortcuts' ? (
            <div className="mx-auto max-w-2xl p-6" data-testid="settings-pane-shortcuts">
              <h2 className="mb-4 text-lg font-semibold">Keyboard shortcuts</h2>
              <div className="rounded-lg border border-fd-border bg-fd-card p-4">
                <Field label="Toggle sidebar" value={<kbd className="rounded bg-fd-muted px-1.5 py-0.5 font-mono text-xs">⌘\</kbd>} />
                <Field label="Toggle agent panel" value={<kbd className="rounded bg-fd-muted px-1.5 py-0.5 font-mono text-xs">⌘.</kbd>} />
                <Field label="Close settings" value={<kbd className="rounded bg-fd-muted px-1.5 py-0.5 font-mono text-xs">Esc</kbd>} />
              </div>
            </div>
          ) : null}

          {tab === 'about' ? (
            <div className="mx-auto max-w-2xl p-6" data-testid="settings-pane-about">
              <h2 className="mb-4 text-lg font-semibold">About</h2>
              <div className="rounded-lg border border-fd-border bg-fd-card p-4">
                <Field label="Runtime mode" value={<span className="font-mono">{runtimeMode}</span>} />
                <Field label="Active provider" value={modelPref?.provider ?? 'ollama'} />
                <Field label="Active model" value={<span className="font-mono">{modelPref?.model ?? 'llama-3.1-8b'}</span>} />
                <Field label="@anydocs/editor" value="contract CI-enforced (Story 6.5)" />
              </div>
              <p className="mt-3 text-xs text-fd-muted-foreground">
                Editor package version surfacing + live contract-diff result is a follow-up; runtime mode is from Story 8.1, provider/model from the Story 13.5 local placeholder (provider-port = Epic 11).
              </p>
            </div>
          ) : null}

          {tab === 'models-pulling' ? (
            <div className="mx-auto max-w-2xl p-6" data-testid="settings-pane-models-pulling">
              <h2 className="mb-4 text-lg font-semibold">Model downloads</h2>
              <div className="rounded-lg border border-dashed border-fd-border p-8 text-center text-sm text-fd-muted-foreground">
                No model downloads in progress.
                <div className="mt-1 text-xs">Local model pulling lands with the Agent provider-port (Epic 11).</div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
