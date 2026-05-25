// Mirror of Claude Design `LocalChip` (desktop-shell.jsx L23–44).
//
// The signature "your data lives here" pill. Used in title bar + status bar.
// Renders a green pulse SVG; the pulse is suppressed when the user prefers
// reduced motion (UX spec §8.4 / Story 13.1 AC + Technical Requirements).
//
// No props; pure presentational — safe as a Server Component.

export type LocalChipProps = Record<string, never>;

export function LocalChip() {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        height: 18,
        padding: '0 7px 0 6px',
        borderRadius: 999,
        fontSize: 10.5,
        fontWeight: 500,
        color: 'var(--ok-700)',
        background: 'var(--ok-50)',
        border: '1px solid color-mix(in oklch, var(--ok-500) 22%, transparent)',
        letterSpacing: '0.02em',
      }}
    >
      <svg
        width="9"
        height="9"
        viewBox="0 0 9 9"
        aria-hidden
        // The inline <style> below scopes the prefers-reduced-motion rule to
        // this SVG only so the chip can render inside Server Components
        // without a `'use client'` boundary.
      >
        <style>
          {`@media (prefers-reduced-motion: reduce) {
            .anydocs-local-chip-pulse { animation: none !important; }
          }`}
        </style>
        <circle cx="4.5" cy="4.5" r="3" fill="var(--ok-500)" />
        <circle
          className="anydocs-local-chip-pulse"
          cx="4.5"
          cy="4.5"
          r="3"
          fill="var(--ok-500)"
          opacity="0.4"
        >
          <animate attributeName="r" values="3;5;3" dur="2.4s" repeatCount="indefinite" />
          <animate
            attributeName="opacity"
            values="0.5;0;0.5"
            dur="2.4s"
            repeatCount="indefinite"
          />
        </circle>
      </svg>
      Local
    </span>
  );
}
