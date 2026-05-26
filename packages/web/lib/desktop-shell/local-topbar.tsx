'use client';

// Mirror of Claude Design `LocalTopbar` (desktop-shell.jsx L268–309).
//
// Slim 40px bar with path crumbs (mono) + minimal actions (Reveal, History,
// Agent). Per UX spec §2.4 single-user removals: no Share, no Presence.
// Client Component because it takes action callbacks.

import { Fragment, type CSSProperties } from 'react';

import { Ic } from './icons';

export type LocalTopbarProps = {
  crumbs?: string[];
  dirty?: boolean;
  agentToggled?: boolean;
  onRevealInFinder?: () => void;
  onToggleHistory?: () => void;
  onToggleAgent?: () => void;
};

const revealBtn: CSSProperties = {
  height: 26,
  padding: '0 8px',
  color: 'var(--n-600)',
};

const iconBtn: CSSProperties = {
  width: 26,
  padding: 0,
  justifyContent: 'center',
};

const agentBtnBase: CSSProperties = {
  height: 26,
};

export function LocalTopbar({
  crumbs = ['guides', 'quick-start.md'],
  dirty = false,
  agentToggled = true,
  onRevealInFinder,
  onToggleHistory,
  onToggleAgent,
}: LocalTopbarProps) {
  return (
    <div
      style={{
        height: 40,
        padding: '0 14px',
        borderBottom: '1px solid var(--n-200)',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        background: 'var(--n-0)',
      }}
    >
      {/* Path crumbs in mono */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
          color: 'var(--n-500)',
          minWidth: 0,
        }}
      >
        <span style={{ color: 'var(--n-400)' }}>~/Anydocs/</span>
        {crumbs.map((c, i) => (
          <Fragment key={`${i}-${c}`}>
            <span
              style={{
                color: i === crumbs.length - 1 ? 'var(--n-900)' : 'var(--n-600)',
                fontWeight: i === crumbs.length - 1 ? 500 : 400,
              }}
            >
              {c}
            </span>
            {i < crumbs.length - 1 && (
              <span style={{ color: 'var(--n-300)' }}>/</span>
            )}
          </Fragment>
        ))}
        {dirty && (
          <span
            title="Unsaved"
            aria-label="Unsaved changes"
            style={{
              width: 6,
              height: 6,
              borderRadius: 999,
              background: 'var(--warn-500)',
              marginLeft: 4,
            }}
          />
        )}
      </div>
      <div style={{ flex: 1 }} />
      {/* Minimal actions — no Share / no Presence */}
      <button
        type="button"
        className="btn ghost sm"
        title="Show in Finder"
        style={revealBtn}
        onClick={onRevealInFinder}
      >
        {Ic.folder(13)}
        <span style={{ fontSize: 11.5 }}>Reveal</span>
      </button>
      <button
        type="button"
        className="btn ghost sm"
        title="History"
        aria-label="History"
        style={iconBtn}
        onClick={onToggleHistory}
      >
        {Ic.hist(13)}
      </button>
      <span style={{ width: 1, height: 18, background: 'var(--n-200)', margin: '0 2px' }} />
      <button
        type="button"
        className={'btn sm ' + (agentToggled ? 'ai' : 'ghost')}
        style={agentBtnBase}
        onClick={onToggleAgent}
        aria-pressed={agentToggled}
      >
        {Ic.ai(12)} Agent
      </button>
    </div>
  );
}
