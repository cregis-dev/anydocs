'use client';

// =============================================================================
// RuntimeModeIndicator — Story 8.3.
//
// Shows the active runtime mode ("web" | "desktop") in the Studio status bar so
// maintainers never confuse web-mode behaviour with desktop-mode behaviour.
//
// Authored as plain `.ts` using `React.createElement` (no JSX) so Node's
// `--experimental-strip-types` test runner can import and render it directly —
// same constraint as `lib/editor-host/editor-host.ts`.
//
// The meaning is carried by TEXT (the visible label), not by colour alone; the
// coloured dot is decorative (`aria-hidden`). The indicator is focusable so a
// keyboard user can reach it and read the accessible name / tooltip.
// =============================================================================

import * as React from 'react';
import type { RuntimeMode } from '@anydocs/core';

import type { StudioMode } from '@/components/studio/studio-boot';

/**
 * Maps the Studio boot mode to the canonical core runtime mode. The CLI Studio
 * is the browser/`web` runtime (Next.js + `/api/local/*`); only the Tauri shell
 * is the native `desktop` runtime.
 */
export function bootModeToRuntimeMode(bootMode: StudioMode): RuntimeMode {
  return bootMode === 'desktop' ? 'desktop' : 'web';
}

/** Decorative dot colour per mode — never the sole carrier of meaning. */
const MODE_DOT_CLASS: Record<RuntimeMode, string> = {
  web: 'bg-sky-500',
  desktop: 'bg-violet-500',
};

export type RuntimeModeIndicatorProps = {
  mode: RuntimeMode;
};

export function RuntimeModeIndicator({ mode }: RuntimeModeIndicatorProps): React.ReactElement {
  const label = `Runtime mode: ${mode}`;
  return React.createElement(
    'div',
    {
      'data-testid': 'studio-runtime-mode',
      'data-runtime-mode': mode,
      role: 'status',
      'aria-label': label,
      title: label,
      tabIndex: 0,
      className:
        'flex items-center gap-1 rounded px-1 outline-none focus-visible:ring-1 focus-visible:ring-fd-ring',
    },
    React.createElement('span', {
      'aria-hidden': 'true',
      className: `size-2 rounded-full ${MODE_DOT_CLASS[mode]}`,
    }),
    React.createElement('span', { className: 'uppercase tracking-wide' }, mode),
  );
}
