'use client';

// =============================================================================
// Cold-start reporting — Story 9.7 (NFR26).
//
// Signals "process-start → editable" to the desktop shell exactly once, the
// first time the Studio editor is mounted and interactive. On the desktop
// runtime this invokes the Rust `report_cold_start` command (which, in the
// launcher's bench mode, prints the `ANYDOCS_COLD_START_MS=<n>` sample). On the
// web runtime there is no Tauri bridge, so this is a no-op.
// =============================================================================

// Relative (not `@/`) so the headless node test runner can load this module —
// native-desktop-bridge is dependency-free, so the chain stays resolvable.
import { getDesktopInvoke } from '../../components/studio/native-desktop-bridge.ts';

let reported = false;

/**
 * Report that the editor has reached an editable state. Safe to call on every
 * render — it fires the underlying IPC at most once per renderer lifetime and
 * does nothing outside the desktop runtime.
 */
export function reportColdStartReached(): void {
  if (reported) return;
  const invoke = getDesktopInvoke();
  if (!invoke) return;
  reported = true;
  void invoke('report_cold_start').catch(() => {
    // Best-effort metric: never let a missing/failed command surface to the UI.
  });
}

/** Test-only: reset the once-guard so the reporter can be re-exercised. */
export function __resetColdStartReporterForTests(): void {
  reported = false;
}
