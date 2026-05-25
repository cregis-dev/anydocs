// Dev-only preview route for desktop-shell primitives.
//
// Per CLAUDE.md "Production Constraints" this route MUST 404 in production.
// The check at the top short-circuits before any module-level side effects
// (e.g. the `tokens.css` import in `@/lib/desktop-shell`) have observable
// runtime impact in a production build. The page is grouped under
// `(internal)` so future dev-only routes can land beside it.
//
// Designer review + Playwright visual regression baseline (Story 13.1
// AC4/AC7) target this route. Compose every primitive in both light and
// dark themes; vary state combinations so the snapshot exercises each
// branch in the prop matrix.

import { notFound } from 'next/navigation';

import {
  KBD,
  LocalChip,
  LocalStatusBar,
  LocalTopbar,
  MacWindow,
  ModelBadge,
} from '@/lib/desktop-shell';

export const dynamic = 'force-static';

export default function DesktopShellPreviewPage() {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }

  return (
    <div
      style={{
        minHeight: '100dvh',
        padding: '32px clamp(16px, 4vw, 48px)',
        display: 'flex',
        flexDirection: 'column',
        gap: 32,
        background: 'var(--n-50)',
        fontFamily: 'var(--font-ui)',
      }}
    >
      <header style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0 }}>
          desktop-shell preview
        </h1>
        <p style={{ margin: 0, color: 'var(--n-600)', fontSize: 13, lineHeight: 1.6 }}>
          Story 13.1 — Claude Design tokens + 6 shell primitives. This route is
          gated to <code style={{ fontFamily: 'var(--font-mono)' }}>NODE_ENV !== &quot;production&quot;</code>{' '}
          and exists for designer review and Playwright visual regression
          baseline capture.
        </p>
      </header>

      <ThemedColumn label="Light theme" theme="light" />
      <ThemedColumn label="Dark theme" theme="dark" />
    </div>
  );
}

type ThemedColumnProps = {
  label: string;
  theme: 'light' | 'dark';
};

function ThemedColumn({ label, theme }: ThemedColumnProps) {
  return (
    <section
      data-theme={theme}
      data-testid={`desktop-shell-${theme}`}
      className="ax"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        padding: 20,
        borderRadius: 12,
        background: 'var(--n-0)',
        border: '1px solid var(--n-200)',
      }}
    >
      <h2 style={{ fontSize: 14, fontWeight: 600, margin: 0, color: 'var(--n-700)' }}>
        {label}
      </h2>

      <PrimitiveBlock title="KBD">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <KBD>⌘K</KBD>
          <KBD mono={false}>Esc</KBD>
          <KBD dim>⌘↵</KBD>
        </div>
      </PrimitiveBlock>

      <PrimitiveBlock title="LocalChip">
        <LocalChip />
      </PrimitiveBlock>

      <PrimitiveBlock title="ModelBadge">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
          <ModelBadge />
          <ModelBadge running />
          <ModelBadge provider="anthropic" model="claude-3-5-sonnet" />
          <ModelBadge provider="openai" model="gpt-4o" compact />
        </div>
      </PrimitiveBlock>

      <PrimitiveBlock title="LocalTopbar — dirty + agent on">
        <LocalTopbar crumbs={['guides', 'quick-start.md']} dirty agentToggled />
      </PrimitiveBlock>

      <PrimitiveBlock title="LocalTopbar — clean + agent off">
        <LocalTopbar
          crumbs={['reference', 'api.md']}
          dirty={false}
          agentToggled={false}
        />
      </PrimitiveBlock>

      <PrimitiveBlock title="LocalStatusBar">
        <LocalStatusBar />
      </PrimitiveBlock>

      <PrimitiveBlock title="LocalStatusBar — with agent">
        <LocalStatusBar agent="Tightening intro…" />
      </PrimitiveBlock>

      <PrimitiveBlock title="MacWindow">
        <MacWindow width={640} height={360} subtitle="quick-start.md" fileChip>
          <div
            style={{
              flex: 1,
              padding: 24,
              fontSize: 13,
              color: 'var(--n-700)',
            }}
          >
            <p style={{ margin: 0 }}>
              Window chrome wraps any docs content. Designer / visual regression
              baseline focuses on the titlebar geometry, traffic lights, and
              centered title slot.
            </p>
          </div>
        </MacWindow>
      </PrimitiveBlock>
    </section>
  );
}

type PrimitiveBlockProps = {
  title: string;
  children: React.ReactNode;
};

function PrimitiveBlock({ title, children }: PrimitiveBlockProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--n-500)',
        }}
      >
        {title}
      </div>
      <div
        style={{
          padding: 16,
          background: 'var(--n-50)',
          border: '1px solid var(--n-200)',
          borderRadius: 8,
        }}
      >
        {children}
      </div>
    </div>
  );
}
