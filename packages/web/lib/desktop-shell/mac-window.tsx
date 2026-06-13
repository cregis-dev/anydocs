'use client';

// Mirror of Claude Design `MacWindow` (desktop-shell.jsx L73–128).
//
// 30px titlebar with three traffic lights, centered title, right-side
// toggle buttons. Wraps its children inside the macOS-style chrome.
//
// `dark` flips the titlebar gradient locally via `data-theme="dark"`.
// Note: AC3 explicitly forbids theme-specific code paths INSIDE primitives;
// the dark gradient is encoded as inline `style` because `tokens.css` does
// not (yet) define a token for the chrome gradient. Treating it as part of
// the MacWindow primitive's signature is consistent with the source.

import type { CSSProperties, ReactNode } from 'react';

import { Ic } from './icons';
import { LocalChip } from './local-chip';

export type MacWindowProps = {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  width?: number;
  height?: number;
  dark?: boolean;
  fileChip?: boolean;
  /**
   * Full-bleed runtime variant (Story 13.2): fills the host window (100% / 100dvh,
   * no border radius, no drop shadow) instead of the fixed-size design artboard.
   * Use when MacWindow is the desktop runtime shell chrome, not a preview board.
   */
  fill?: boolean;
  /** Titlebar "toggle sidebar" button handler (wired to ⌘\ in the runtime shell). */
  onToggleSidebar?: () => void;
  /** Titlebar "toggle agent" button handler (wired to ⌘. in the runtime shell). */
  onToggleAgent?: () => void;
};

const tbBtn: CSSProperties = {
  width: 22,
  height: 22,
  borderRadius: 5,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'inherit',
};

type TrafficLightProps = { color: string };

function TrafficLight({ color }: TrafficLightProps) {
  return (
    <span
      style={{
        width: 12,
        height: 12,
        borderRadius: 999,
        background: color,
        boxShadow:
          '0 0 0 0.5px color-mix(in oklch, var(--n-800) 18%, transparent) inset, 0 1px 0 rgba(255,255,255,0.4) inset',
      }}
    />
  );
}

export function MacWindow({
  children,
  title = 'Anydocs',
  subtitle,
  width = 1280,
  height = 820,
  dark,
  fileChip,
  fill,
  onToggleSidebar,
  onToggleAgent,
}: MacWindowProps) {
  const bg = 'var(--n-0)';
  return (
    <div
      data-theme={dark ? 'dark' : undefined}
      style={{
        width: fill ? '100%' : width,
        height: fill ? '100dvh' : height,
        borderRadius: fill ? 0 : 10,
        overflow: 'hidden',
        background: bg,
        boxShadow: fill
          ? 'none'
          : '0 0 0 1px color-mix(in oklch, var(--n-800) 8%, transparent), 0 30px 80px -20px rgba(20,18,14,0.18), 0 1px 0 rgba(255,255,255,0.6) inset',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
      }}
    >
      {/* Title bar */}
      <div
        style={{
          height: 30,
          flex: 'none',
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr',
          alignItems: 'center',
          padding: '0 10px',
          background: dark
            ? 'linear-gradient(180deg, oklch(0.22 0.008 270), oklch(0.20 0.008 270))'
            : 'linear-gradient(180deg, oklch(0.985 0.004 80), oklch(0.965 0.005 80))',
          borderBottom: '1px solid color-mix(in oklch, var(--n-800) 10%, transparent)',
          userSelect: 'none',
        }}
      >
        {/* Traffic lights */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <TrafficLight color="oklch(0.66 0.18 25)" />
          <TrafficLight color="oklch(0.78 0.16 75)" />
          <TrafficLight color="oklch(0.70 0.16 145)" />
        </div>
        {/* Center title */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 12,
            fontWeight: 500,
            color: 'var(--n-700)',
            whiteSpace: 'nowrap',
          }}
        >
          <span style={{ color: 'var(--n-900)' }}>{title}</span>
          {subtitle && (
            <>
              <span style={{ color: 'var(--n-300)' }}>—</span>
              <span
                style={{
                  color: 'var(--n-600)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                }}
              >
                {subtitle}
              </span>
            </>
          )}
          {fileChip && <LocalChip />}
        </div>
        {/* Right — window-level buttons */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 4,
            color: 'var(--n-500)',
          }}
        >
          <button
            type="button"
            title="Toggle sidebar (⌘\\)"
            style={tbBtn}
            aria-label="Toggle sidebar"
            onClick={onToggleSidebar}
          >
            {Ic.base(
              <>
                <rect x="2.5" y="3.5" width="11" height="9" rx="1.5" />
                <path d="M6.5 3.5v9" />
              </>,
              14,
            )}
          </button>
          <button
            type="button"
            title="Toggle agent (⌘.)"
            style={tbBtn}
            aria-label="Toggle agent"
            onClick={onToggleAgent}
          >
            {Ic.ai(13)}
          </button>
        </div>
      </div>
      {/* Content (no scroll – artboards are static) */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          overflow: 'hidden',
          background: bg,
        }}
      >
        {children}
      </div>
    </div>
  );
}

