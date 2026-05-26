// Minimal subset of the Claude Design `Ic` icon helpers required by the six
// desktop-shell primitives (MacWindow, LocalTopbar, LocalStatusBar). Source:
// /Users/shawn/Downloads/anydocs-desktop-handoff/shell.jsx
//
// Icons follow the single-stroke, currentColor convention so consumers can
// retint via the surrounding text color.

import type { ReactNode } from 'react';

type IcBaseOpts = {
  sw?: number;
};

function icBase(d: ReactNode, size = 16, opts: IcBaseOpts = {}): ReactNode {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={opts.sw ?? 1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {d}
    </svg>
  );
}

// Re-exported through the module entry only when downstream stories need
// additional icons; kept internal for now.
export const Ic = {
  base: icBase,
  folder: (s?: number): ReactNode =>
    icBase(
      <path d="M2.5 4.5a1 1 0 0 1 1-1h2.5l1.5 1.5h5a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1z" />,
      s,
    ),
  hist: (s?: number): ReactNode =>
    icBase(
      <>
        <path d="M3.5 8a4.5 4.5 0 1 0 1.3-3.2" />
        <path d="M3 3v2.5h2.5" />
        <path d="M8 5.5V8l1.5 1.5" />
      </>,
      s,
    ),
  ai: (s?: number): ReactNode => (
    <svg width={s ?? 14} height={s ?? 14} viewBox="0 0 16 16" aria-hidden>
      <path
        d="M8 1.5l1.7 4.6L14.3 8 9.7 9.9 8 14.5 6.3 9.9 1.7 8l4.6-1.9z"
        fill="currentColor"
      />
    </svg>
  ),
} as const;
