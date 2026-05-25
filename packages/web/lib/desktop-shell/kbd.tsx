// Mirror of Claude Design `KBD` (desktop-shell.jsx L10–21).
// Pure presentational — no interactivity, safe as a Server Component.

import type { ReactNode } from 'react';

export type KBDProps = {
  children: ReactNode;
  mono?: boolean;
  dim?: boolean;
};

export function KBD({ children, mono = true, dim = false }: KBDProps) {
  return (
    <span
      style={{
        fontFamily: mono ? 'var(--font-mono)' : 'var(--font-ui)',
        fontSize: 10.5,
        color: dim ? 'var(--n-400)' : 'var(--n-600)',
        padding: '2px 5px',
        borderRadius: 4,
        background: 'var(--n-100)',
        border: '1px solid var(--n-200)',
        lineHeight: 1,
        display: 'inline-flex',
        alignItems: 'center',
        height: 16,
      }}
    >
      {children}
    </span>
  );
}
