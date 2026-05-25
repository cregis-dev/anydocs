// Internal error used by the placeholder runtime delivered in Story 6.1.
// The class is NOT re-exported through the package entry (AC2/AC3): consumers
// branch on `error.name === 'EditorNotImplementedError'`, which is guaranteed
// to remain stable across Phase 2 implementation work.
//
// The actual Plate-backed runtime in Story 6.2 should stop throwing this for
// every method and replace these stubs with real behavior.
export const EDITOR_NOT_IMPLEMENTED_ERROR_NAME = 'EditorNotImplementedError';

export class EditorNotImplementedError extends Error {
  override readonly name = EDITOR_NOT_IMPLEMENTED_ERROR_NAME;

  constructor(message: string) {
    super(message);
  }
}
