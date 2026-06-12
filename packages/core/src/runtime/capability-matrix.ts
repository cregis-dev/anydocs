import { getRuntimeMode, type RuntimeMode } from './runtime-mode.ts';

/**
 * The single source of truth for cross-mode behavioral differences. Consumers
 * that need to vary behavior by runtime mode MUST read the relevant field from
 * {@link getCapabilities} — never compare the mode literal inline. See
 * architecture.md §"Capability Matrix" + §"Pattern: Capability Matrix as Single
 * Source". A machine-enforced guard (runtime-mode-guard test) rejects inline
 * `runtimeMode === ...` branches in consumer code.
 */
export interface RuntimeCapabilities {
  /** Where project files are READ from in this mode. */
  readonly projectFsReadSurface: 'local-api' | 'native-fs';
  /** Where project files are WRITTEN in this mode. */
  readonly projectFsWriteSurface: 'local-api' | 'native-fs';
  /** Whether `/api/local/*` route handlers are reachable. */
  readonly localApiReachable: boolean;
  /** Studio editing enabled (true for both modes today; kept for forward-extensibility). */
  readonly studioEditing: boolean;
  /** Agent invocation enabled (true for both modes today). */
  readonly agentInvocation: boolean;
  /**
   * Audit persistence strategy. Identical across modes — the core service +
   * `<projectRoot>/.anydocs/audit/` path are the same; only the underlying fs
   * adapter differs (Epic 9). Encoded as a constant so consumers never branch
   * on mode for the audit path.
   */
  readonly auditPersistence: 'core-service-over-fs-adapter';
  /** Badge text for Story 8.3's `RuntimeModeIndicator`. */
  readonly runtimeModeLabel: RuntimeMode;
}

export const CAPABILITY_MATRIX: Readonly<Record<RuntimeMode, RuntimeCapabilities>> = Object.freeze({
  web: Object.freeze({
    projectFsReadSurface: 'local-api',
    projectFsWriteSurface: 'local-api',
    localApiReachable: true,
    studioEditing: true,
    agentInvocation: true,
    auditPersistence: 'core-service-over-fs-adapter',
    runtimeModeLabel: 'web',
  }),
  desktop: Object.freeze({
    projectFsReadSurface: 'native-fs',
    projectFsWriteSurface: 'native-fs',
    localApiReachable: false,
    studioEditing: true,
    agentInvocation: true,
    auditPersistence: 'core-service-over-fs-adapter',
    runtimeModeLabel: 'desktop',
  }),
});

/**
 * Read the capability row for the given mode, defaulting to the process-resolved
 * mode ({@link getRuntimeMode}). Cheap O(1) — returns the shared frozen row.
 */
export function getCapabilities(mode: RuntimeMode = getRuntimeMode()): Readonly<RuntimeCapabilities> {
  return CAPABILITY_MATRIX[mode];
}
