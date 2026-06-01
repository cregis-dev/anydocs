'use client';

// =============================================================================
// editor-host — public surface (Story 7.1)
// -----------------------------------------------------------------------------
// Studio screens import `EditorHost` from this module. Internal modules
// (`editor-host.ts`, `normalize-input.ts`) are implementation details — they
// SHOULD be re-exported via this entry only when needed.
//
// The boundary discipline matches the `@anydocs/editor` package contract:
// callers depend on the surface here, never on internals. The
// `studio-callgraph.test.ts` test asserts that no other web module reaches
// past this entry into the underlying files.
// =============================================================================

export { EditorHost, useEditorHost } from './editor-host.ts';
export type { EditorHostProps, EditorHostDerived } from './editor-host.ts';
export { normalizeEditorInput } from './normalize-input.ts';
// Story 7.3 retired the `NEXT_PUBLIC_STUDIO_EDITOR` feature flag along with
// the dual-mount machinery; flag-resolver exports (`STUDIO_EDITOR_MODE`,
// `resolveStudioEditorMode`, `StudioEditorMode`) no longer exist.
