// =============================================================================
// Plugin registry — Story 6.4 refactor.
//
// Story 6.1 shipped a minimal placeholder registry that:
//   - validated only that the input was an object with a non-empty blockType
//     + a schemaFragment field;
//   - threw `EditorNotImplementedError` for validation failures (Story 6.1
//     review found this semantically wrong);
//   - did not detect duplicate blockType registrations.
//
// Story 6.4 replaces the placeholder:
//   - validation flows through `validateEditorPlugin` from plugin-contract.ts
//     (canonical blockType set, plateElementTypes shape, converter callability,
//     agent-anchor enum);
//   - duplicate blockType throws `EditorPluginValidationError` (closes Story
//     6.1 follow-up L2);
//   - all validation failures use `EditorPluginValidationError` (closes
//     Story 6.1 follow-up M1).
//
// `validateAndRegisterPlugin` is the function the public `registerPlugin`
// contract entry calls into. Builtin plugins use the lower-level
// `registerPluginIntoRegistry(plugin, { allowReregister: true })` directly.
// =============================================================================

import type { EditorPlugin } from '../../contract/public-api.ts';
import {
  getPluginForBlockType,
  registerPluginIntoRegistry,
} from '../plugins/plugin-contract.ts';

export function validateAndRegisterPlugin(plugin: EditorPlugin): void {
  // Host-facing entry: full validation + reject duplicate blockType.
  // Builtin plugins use registerPluginIntoRegistry with allowReregister: true.
  registerPluginIntoRegistry(plugin, { allowReregister: false });
}

export function getRegisteredPlugin(blockType: string): EditorPlugin | undefined {
  return getPluginForBlockType(blockType);
}
