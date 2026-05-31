// =============================================================================
// EditorPluginValidationError — thrown when `registerPlugin` / the internal
// plugin validator rejects a plugin shape.
//
// Internal class — NOT re-exported through the package entry (Story 6.4 AC2).
// Consumers branch on `error.name === 'EditorPluginValidationError'`. This
// closes Story 6.1 follow-up M1 (`plugin-registry.ts` was throwing
// `EditorNotImplementedError` for validation failures, conflating "not yet
// implemented" with "caller passed garbage").
// =============================================================================

export const EDITOR_PLUGIN_VALIDATION_ERROR_NAME = 'EditorPluginValidationError';

export class EditorPluginValidationError extends Error {
  override readonly name = EDITOR_PLUGIN_VALIDATION_ERROR_NAME;

  constructor(message: string) {
    super(message);
  }
}
