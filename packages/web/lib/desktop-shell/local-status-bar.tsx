// Mirror of Claude Design `LocalStatusBar` (desktop-shell.jsx L312–341).
//
// 24px bottom bar: save state · word count · `md · UTF-8 · LF` · agent
// activity (optional) · compact ModelBadge. Pure presentational — Server
// Component is fine.

import { Ic } from './icons';
import { ModelBadge } from './model-badge';

export type LocalStatusBarProps = {
  saved?: string;
  words?: number;
  model?: string;
  provider?: string;
  agent?: string;
};

export function LocalStatusBar({
  saved = 'Saved · just now',
  words = 842,
  model = 'llama-3.1-8b',
  provider = 'ollama',
  agent,
}: LocalStatusBarProps) {
  return (
    <div
      style={{
        height: 24,
        padding: '0 12px',
        borderTop: '1px solid var(--n-200)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        fontSize: 11,
        color: 'var(--n-500)',
        background: 'var(--n-50)',
        fontFamily: 'var(--font-mono)',
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
        <span className="dot ok" style={{ width: 6, height: 6 }} /> {saved}
      </span>
      {words != null && <span>{words.toLocaleString()}w</span>}
      {words != null && <span style={{ color: 'var(--n-400)' }}>·</span>}
      <span>md</span>
      <span style={{ color: 'var(--n-400)' }}>·</span>
      <span>UTF-8</span>
      <span style={{ color: 'var(--n-400)' }}>·</span>
      <span>LF</span>
      <div style={{ flex: 1 }} />
      {agent && (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            color: 'var(--ai-700)',
          }}
        >
          <span className="pulse" style={{ display: 'inline-flex' }}>
            {Ic.ai(10)}
          </span>{' '}
          {agent}
        </span>
      )}
      <ModelBadge model={model} provider={provider} compact />
    </div>
  );
}
