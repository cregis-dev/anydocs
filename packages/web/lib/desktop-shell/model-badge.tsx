// Mirror of Claude Design `ModelBadge` (desktop-shell.jsx L46–70).
//
// Small monospace pill showing which model the agent uses. Providers in the
// `LOCAL_PROVIDERS` set are treated as on-device (green status dot);
// anything else is BYOK cloud (gray dot). `running` adds a soft glow ring.

const LOCAL_PROVIDERS = new Set(['ollama', 'llama.cpp', 'mlx']);

export type ModelBadgeProps = {
  model?: string;
  provider?: string;
  running?: boolean;
  compact?: boolean;
};

export function ModelBadge({
  model = 'llama-3.1-8b',
  provider = 'ollama',
  running,
  compact,
}: ModelBadgeProps) {
  const local = LOCAL_PROVIDERS.has(provider);
  const dotColor = local ? 'var(--ok-500)' : 'var(--n-400)';
  const title = local
    ? 'Runs on your machine'
    : 'BYOK cloud · key stored in Keychain';

  return (
    <span
      title={title}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        height: compact ? 20 : 22,
        padding: '0 8px 0 7px',
        borderRadius: 6,
        fontSize: 11,
        color: 'var(--n-700)',
        background: 'var(--n-100)',
        border: '1px solid var(--n-200)',
        fontFamily: 'var(--font-mono)',
        lineHeight: 1,
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: 999,
          background: dotColor,
          boxShadow: running
            ? `0 0 0 2px color-mix(in oklch, ${dotColor} 30%, transparent)`
            : 'none',
        }}
      />
      <span style={{ color: 'var(--n-500)' }}>{provider}</span>
      <span style={{ color: 'var(--n-400)' }}>/</span>
      <span>{model}</span>
    </span>
  );
}
