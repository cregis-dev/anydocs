import type { EditorPlugin } from '../../contract/public-api.ts';
import { EditorNotImplementedError } from './not-implemented-error.ts';

// Module-local registry. Sufficient for the contract surface delivered in
// Story 6.1; replaced by a per-instance, validated registry once the Plate
// runtime (Story 6.2) and converter layer (Story 6.3) land.
const registeredPlugins: EditorPlugin[] = [];

export function validateAndRegisterPlugin(plugin: EditorPlugin): void {
  if (plugin === null || typeof plugin !== 'object') {
    throw new EditorNotImplementedError(
      'Invalid plugin: expected an object. Comprehensive plugin validation lands in Story 6.4.',
    );
  }

  if (typeof plugin.blockType !== 'string' || plugin.blockType.length === 0) {
    throw new EditorNotImplementedError(
      "Invalid plugin: required field 'blockType' must be a non-empty string. Comprehensive plugin validation lands in Story 6.4.",
    );
  }

  if (!Object.prototype.hasOwnProperty.call(plugin, 'schemaFragment')) {
    throw new EditorNotImplementedError(
      "Invalid plugin: required field 'schemaFragment' is missing. Comprehensive plugin validation lands in Story 6.4.",
    );
  }

  registeredPlugins.push(plugin);
}

export function getRegisteredPluginsForTests(): ReadonlyArray<EditorPlugin> {
  return registeredPlugins;
}

export function resetRegisteredPluginsForTests(): void {
  registeredPlugins.length = 0;
}
