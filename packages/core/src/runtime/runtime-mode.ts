import { RuntimeModeResolutionError } from './runtime-mode-error.ts';

/**
 * The runtime environment Anydocs is executing in.
 *
 * - `web`: Next.js dev server / browser context; `/api/local/*` is the write surface.
 * - `desktop`: Tauri shell; native fs commands are the write surface.
 *
 * Resolved exactly once at process bootstrap and immutable for the lifetime of
 * the runtime instance. See architecture.md §"Runtime Mode Model".
 */
export type RuntimeMode = 'web' | 'desktop';

const RUNTIME_MODES: readonly RuntimeMode[] = ['web', 'desktop'];

/** Environment channel used by host bootstraps that inject the mode via env. */
const RUNTIME_MODE_ENV_KEY = 'ANYDOCS_RUNTIME_MODE';

/** Type guard for {@link RuntimeMode}. */
export function isRuntimeMode(value: unknown): value is RuntimeMode {
  return typeof value === 'string' && (RUNTIME_MODES as readonly string[]).includes(value);
}

export type ResolveRuntimeModeOptions = {
  /** Explicit programmatic injection from the host bootstrap (highest priority). */
  injectedMode?: RuntimeMode;
  /** Environment source; defaults to `process.env`. Primarily for testability. */
  env?: Record<string, string | undefined>;
};

/**
 * Module-singleton cache. The resolver writes this exactly once; every read
 * goes through {@link getRuntimeMode}. This is the single source of truth — no
 * consumer may probe the environment for mode independently.
 */
let resolvedMode: RuntimeMode | undefined;

/**
 * Defensive capability probe — detects a Tauri global. Fallback ONLY; explicit
 * injection (param or env) is the intended resolution path.
 */
function detectTauriGlobal(): boolean {
  return (
    typeof globalThis !== 'undefined' &&
    ('__TAURI_INTERNALS__' in globalThis || '__TAURI__' in globalThis)
  );
}

/**
 * Compute the candidate mode in priority order:
 * 1. explicit programmatic injection
 * 2. explicit env injection (`ANYDOCS_RUNTIME_MODE`)
 * 3. Tauri capability probe (defensive fallback)
 * Returns `undefined` when nothing resolves. Throws on an explicitly-provided
 * but invalid injection value (never silently defaults).
 */
function computeCandidate(options: ResolveRuntimeModeOptions): RuntimeMode | undefined {
  // 1. explicit programmatic injection
  if (options.injectedMode !== undefined) {
    const injected: unknown = options.injectedMode;
    if (!isRuntimeMode(injected)) {
      throw new RuntimeModeResolutionError(
        'RUNTIME_MODE_INVALID_INJECTION',
        `Invalid injected runtime mode: ${String(injected)}.`,
        {
          entity: 'runtime-mode',
          rule: 'injected-mode-must-be-web-or-desktop',
          remediation: "Pass injectedMode: 'web' | 'desktop'.",
          metadata: { received: injected },
        },
      );
    }
    return injected;
  }

  // 2. explicit env injection
  const env = options.env ?? (typeof process !== 'undefined' ? process.env : undefined);
  const fromEnv = env?.[RUNTIME_MODE_ENV_KEY];
  if (fromEnv !== undefined && fromEnv !== '') {
    if (!isRuntimeMode(fromEnv)) {
      throw new RuntimeModeResolutionError(
        'RUNTIME_MODE_INVALID_INJECTION',
        `Invalid ${RUNTIME_MODE_ENV_KEY}: ${fromEnv}.`,
        {
          entity: 'runtime-mode',
          rule: 'env-mode-must-be-web-or-desktop',
          remediation: `Set ${RUNTIME_MODE_ENV_KEY} to 'web' or 'desktop'.`,
          metadata: { received: fromEnv, envKey: RUNTIME_MODE_ENV_KEY },
        },
      );
    }
    return fromEnv;
  }

  // 3. capability probe (defensive fallback only)
  if (detectTauriGlobal()) {
    return 'desktop';
  }

  return undefined;
}

/**
 * Resolve the runtime mode. Intended to be called exactly once at process
 * bootstrap. The result is cached and immutable; subsequent reads must use
 * {@link getRuntimeMode}.
 *
 * - Resolves in priority order (injection → env → Tauri probe).
 * - Fails fast with `RUNTIME_MODE_AMBIGUOUS` when nothing resolves.
 * - Rejects an invalid explicit injection with `RUNTIME_MODE_INVALID_INJECTION`.
 * - A second call that would change the resolved mode throws
 *   `RUNTIME_MODE_CONFLICT`; a call consistent with the cached mode returns it.
 */
export function resolveRuntimeMode(options: ResolveRuntimeModeOptions = {}): RuntimeMode {
  const candidate = computeCandidate(options);

  if (resolvedMode !== undefined) {
    if (candidate !== undefined && candidate !== resolvedMode) {
      throw new RuntimeModeResolutionError(
        'RUNTIME_MODE_CONFLICT',
        `Runtime mode already resolved to '${resolvedMode}'; refusing to re-resolve to '${candidate}'.`,
        {
          entity: 'runtime-mode',
          rule: 'runtime-mode-is-immutable-once-resolved',
          remediation:
            'Resolve runtime mode exactly once at process bootstrap; read it via getRuntimeMode().',
          metadata: { resolved: resolvedMode, attempted: candidate },
        },
      );
    }
    return resolvedMode;
  }

  if (candidate === undefined) {
    throw new RuntimeModeResolutionError(
      'RUNTIME_MODE_AMBIGUOUS',
      'Runtime mode could not be resolved from injection, environment, or capability probe.',
      {
        entity: 'runtime-mode',
        rule: 'runtime-mode-must-resolve-at-bootstrap',
        remediation:
          `Inject the mode explicitly: resolveRuntimeMode({ injectedMode }) or set ${RUNTIME_MODE_ENV_KEY}=web|desktop.`,
        metadata: {},
      },
    );
  }

  resolvedMode = candidate;
  return resolvedMode;
}

/**
 * Read the resolved runtime mode. Cheap O(1) cache read. Throws
 * `RUNTIME_MODE_NOT_RESOLVED` if called before {@link resolveRuntimeMode}.
 */
export function getRuntimeMode(): RuntimeMode {
  if (resolvedMode === undefined) {
    throw new RuntimeModeResolutionError(
      'RUNTIME_MODE_NOT_RESOLVED',
      'Runtime mode read before resolution.',
      {
        entity: 'runtime-mode',
        rule: 'resolve-before-read',
        remediation:
          'Call resolveRuntimeMode() once during bootstrap before any getRuntimeMode() read.',
        metadata: {},
      },
    );
  }
  return resolvedMode;
}

/**
 * TEST-ONLY: clear the module-singleton resolution cache. The cache is a process
 * singleton, so tests must reset it between cases. NOT part of the consumer API —
 * do not call from production code.
 */
export function __resetRuntimeModeForTests(): void {
  resolvedMode = undefined;
}
