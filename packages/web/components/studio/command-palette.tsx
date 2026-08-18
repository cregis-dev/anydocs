'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Boxes, FileText, Hammer, Moon, ScrollText, Sparkles } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { PageDoc } from '@/lib/docs/types';

/**
 * CommandPalette (Story 13.7) — ⌘P keyboard-first entry matching the Claude Design
 * `ds-palette` / UX spec §6.4: an ASK WRITER section (inline / page / workspace
 * scope entries), plus NAVIGATION (Switch file) and ACTIONS (Build & Publish,
 * Audit log…, Toggle dark mode).
 *
 * TEST-SAFE / dependency-honest:
 * - ASK WRITER invocation needs the built-in Agent (Epic 11) + Scope Escalation
 *   Modal/token (Story 12.2/12.3) — NOT built. The three scope entries render with
 *   their shortcuts (AC1) but are DISABLED with a hint until those land (AC2 deferred).
 * - "Audit log…" routes to the Audit Log Query view (Story 13.10) — NOT built; entry
 *   is DISABLED with a hint.
 * - "Switch file", "Build & Publish", "Toggle dark mode" are wired to real actions.
 */

type Section = 'ask-writer' | 'navigation' | 'actions';

type PaletteItem = {
  id: string;
  label: string;
  section: Section;
  icon: ReactNode;
  shortcut?: string;
  hint?: string;
  disabled?: boolean;
  run?: () => void;
};

const SECTION_LABEL: Record<Section, string> = {
  'ask-writer': 'Ask Writer',
  navigation: 'Navigation',
  actions: 'Actions',
};

const SECTION_ORDER: Section[] = ['ask-writer', 'navigation', 'actions'];

export type CommandPaletteProps = {
  // Mounted only while open (the host conditionally renders it), so each open is a
  // fresh mount with clean state — no open-driven reset effect needed.
  onClose: () => void;
  pages: PageDoc[];
  onSelectPage: (pageId: string) => void;
  onBuild: () => void;
  /** Opens the Audit Log Query view (Story 13.10). When absent the entry is disabled. */
  onAuditLog?: () => void;
};

function toggleDarkMode() {
  if (typeof document === 'undefined') return;
  // Toggle Tailwind's `.dark` (for `dark:` variants) AND `data-theme` (so the
  // Claude Design `--n-*` tokens behind the .studio-ax bridge flip too).
  const isDark = document.documentElement.classList.toggle('dark');
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
}

export function CommandPalette({ onClose, pages, onSelectPage, onBuild, onAuditLog }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const items = useMemo<PaletteItem[]>(() => {
    const askWriter: PaletteItem[] = [
      { id: 'ask-inline', label: 'Ask Writer · inline', section: 'ask-writer', icon: <Sparkles className="size-4" />, shortcut: '⌘I', hint: 'Agent (Epic 11)', disabled: true },
      { id: 'ask-page', label: 'Ask Writer · page', section: 'ask-writer', icon: <Sparkles className="size-4" />, shortcut: '⌘⇧I', hint: 'Agent (Epic 11)', disabled: true },
      { id: 'ask-workspace', label: 'Ask Writer · workspace', section: 'ask-writer', icon: <Sparkles className="size-4" />, shortcut: '⌘⌥I', hint: 'Agent + scope escalation (Epic 11/12)', disabled: true },
    ];
    const navigation: PaletteItem[] = pages.map((page) => ({
      id: `file:${page.id}`,
      label: `Switch file · ${page.title || page.slug}`,
      section: 'navigation',
      icon: <FileText className="size-4" />,
      run: () => {
        onSelectPage(page.id);
        onClose();
      },
    }));
    const actions: PaletteItem[] = [
      { id: 'build', label: 'Build & Publish', section: 'actions', icon: <Hammer className="size-4" />, run: () => { onBuild(); onClose(); } },
      { id: 'audit', label: 'Audit log…', section: 'actions', icon: <ScrollText className="size-4" />, shortcut: '⌘⇧A', hint: onAuditLog ? undefined : 'Audit view (Story 13.10)', disabled: !onAuditLog, run: onAuditLog ? () => { onAuditLog(); onClose(); } : undefined },
      { id: 'dark', label: 'Toggle dark mode', section: 'actions', icon: <Moon className="size-4" />, run: () => { toggleDarkMode(); onClose(); } },
    ];
    return [...askWriter, ...navigation, ...actions];
  }, [pages, onSelectPage, onBuild, onClose, onAuditLog]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => item.label.toLowerCase().includes(q));
  }, [items, query]);

  // Selectable (non-disabled) items, in filtered order, for keyboard navigation.
  const selectable = useMemo(() => filtered.filter((item) => !item.disabled), [filtered]);

  // Focus the input on mount (the palette is only mounted while open). DOM
  // side-effect only — no setState in the effect body.
  useEffect(() => {
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, []);

  const activeId = selectable[activeIndex]?.id;

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, Math.max(selectable.length - 1, 0)));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      selectable[activeIndex]?.run?.();
    }
  }

  const bySection = SECTION_ORDER.map((section) => ({
    section,
    entries: filtered.filter((item) => item.section === section),
  })).filter((group) => group.entries.length > 0);

  return (
    <div className="absolute inset-0 z-50 flex items-start justify-center bg-black/30 pt-[12vh]" data-testid="studio-command-palette" onClick={onClose}>
      <div
        className="w-full max-w-xl overflow-hidden rounded-xl border border-fd-border bg-fd-popover shadow-2xl"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(0);
          }}
          placeholder="Type a command or search files…"
          className="w-full border-b border-fd-border bg-transparent px-4 py-3 text-sm outline-none"
          data-testid="command-palette-input"
        />
        <div className="max-h-80 overflow-y-auto p-2">
          {bySection.length === 0 ? (
            <div className="px-2 py-6 text-center text-sm text-fd-muted-foreground">No matches.</div>
          ) : (
            bySection.map((group) => (
              <div key={group.section} className="mb-2 last:mb-0">
                <div className="flex items-center gap-1 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-fd-muted-foreground">
                  {group.section === 'ask-writer' ? <Boxes className="size-3" /> : null}
                  {SECTION_LABEL[group.section]}
                </div>
                {group.entries.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    disabled={item.disabled}
                    onClick={() => item.run?.()}
                    title={item.disabled ? item.hint : undefined}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm',
                      item.disabled
                        ? 'cursor-not-allowed text-fd-muted-foreground opacity-60'
                        : item.id === activeId
                          ? 'bg-fd-muted text-fd-foreground'
                          : 'text-fd-foreground hover:bg-fd-muted/60',
                    )}
                    data-testid="command-palette-item"
                    data-item-id={item.id}
                  >
                    <span className="shrink-0 opacity-70">{item.icon}</span>
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {item.hint ? <span className="shrink-0 text-[10px] text-fd-muted-foreground">{item.hint}</span> : null}
                    {item.shortcut ? <kbd className="shrink-0 rounded bg-fd-muted px-1.5 py-0.5 font-mono text-[10px]">{item.shortcut}</kbd> : null}
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
