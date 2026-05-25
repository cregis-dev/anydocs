// =============================================================================
// @anydocs/web — desktop-shell module entry.
//
// This is the only public surface of the desktop-shell module. Consumers
// (Story 13.2 onwards) MUST import from `@/lib/desktop-shell` and never
// reach into internal files like `./mac-window` directly.
//
// Token vocabulary is sealed in `./tokens.css` — primitives reference only
// `var(--n-*)`, `var(--brand-*)`, `var(--ai-*)`, `var(--ok-*)`, `var(--warn-*)`,
// `var(--bad-*)`, `var(--info-*)`, `var(--r-*)`, `var(--sh-*)`, `var(--ease)`,
// `var(--font-ui)`, `var(--font-mono)`, `var(--t-*)`. See Story 13.1 AC5.
//
// CSS is imported here so a single consumer-side import of this module is
// enough to pull tokens + utility classes (`.ax`, `.btn`, `.dot`, `.chip`,
// etc.) into the page's stylesheet.
// =============================================================================

import './tokens.css';

export { KBD, type KBDProps } from './kbd';
export { LocalChip, type LocalChipProps } from './local-chip';
export { ModelBadge, type ModelBadgeProps } from './model-badge';
export { MacWindow, type MacWindowProps } from './mac-window';
export { LocalTopbar, type LocalTopbarProps } from './local-topbar';
export { LocalStatusBar, type LocalStatusBarProps } from './local-status-bar';
