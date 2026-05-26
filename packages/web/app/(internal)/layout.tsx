// Root layout for the `(internal)` route group — dev-only previews,
// playgrounds, and visual regression fixtures. Pages under this group are
// expected to gate themselves to `NODE_ENV !== 'production'` (per CLAUDE.md
// production constraints) and to return 404 in production builds.

import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import '../globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Internal Preview',
    template: '%s · Internal Preview',
  },
  description: 'Anydocs internal dev-only previews. Returns 404 in production.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function InternalLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
