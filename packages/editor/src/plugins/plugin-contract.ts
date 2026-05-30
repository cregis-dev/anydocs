// =============================================================================
// @anydocs/editor — Plugin contract runtime (Story 6.4)
// -----------------------------------------------------------------------------
// The validator + dispatch helpers that turn `EditorPlugin` (declared by
// `contract/public-api.ts`) into something the converters can actually call
// through.
//
// Two responsibilities:
//   1. `validateEditorPlugin(plugin)` — runtime shape check called from
//      `validateAndRegisterPlugin` (plugin-registry.ts) and from any host
//      plugin handed in via `EditorConfig.plugins`. Throws a typed
//      `EditorPluginValidationError` on any violation.
//   2. Registry dispatch — `getPluginForBlockType` (forward direction) and
//      `getPluginForPlateElement` (inverse direction) look up the plugin
//      that owns a given canonical block type or Plate runtime element type.
//      The converters call these instead of switching on type strings.
//
// Story 6.4 design notes:
//   * The registry is module-level (matches Story 6.1's existing API where
//     `registerPlugin` is a global side effect). Builtin plugins are
//     registered once via `registerPluginIntoRegistry(plugin, { allowReregister: true })`
//     from `plate-runtime`'s init path; host plugins go through the public
//     `registerPlugin` entry which forwards to `validateAndRegisterPlugin`.
//   * Duplicate `blockType` registration throws (closes Story 6.1 follow-up
//     L2), UNLESS the caller opts in with `allowReregister: true` (used by
//     builtin auto-registration so multiple `createEditor` calls in the
//     same process don't trip the duplicate guard).
//   * The inverse-lookup table is keyed by *every* string in
//     `plugin.plateElementTypes` — a single plugin can own multiple
//     element-type strings (heading owns `h1`/`h2`/`h3`, list owns
//     `ul`/`ol`/`todo_list`/`li`/`todo_li`, table owns `table`/`tr`/`td`/`th`).
//   * `clearRegistryForTests()` resets the registry; only test files import
//     it. NOT re-exported through the package entry (Story 6.5 snapshot
//     would diff if it were).
// =============================================================================

import { DOC_CONTENT_BLOCK_TYPES, type DocContentBlockType } from '@anydocs/core';

import type { EditorPlugin } from '../../contract/public-api.ts';
import { EditorPluginValidationError } from '../runtime/editor-plugin-validation-error.ts';

const CANONICAL_BLOCK_TYPES = new Set<string>(DOC_CONTENT_BLOCK_TYPES);

type RegisterOptions = {
  /**
   * When true, a duplicate `blockType` registration silently no-ops (used by
   * builtin auto-registration to survive repeat `createEditor` calls).
   * When false (default), a duplicate throws.
   */
  allowReregister?: boolean;
};

const pluginsByBlockType = new Map<string, EditorPlugin>();
const pluginsByPlateElement = new Map<string, EditorPlugin>();

/**
 * Runtime shape validator. Throws `EditorPluginValidationError` on any
 * structural violation. Use TypeScript's `asserts` narrowing so call sites
 * see the typed plugin afterwards.
 */
export function validateEditorPlugin(plugin: unknown): asserts plugin is EditorPlugin {
  if (plugin === null || typeof plugin !== 'object') {
    throw new EditorPluginValidationError(
      `EditorPlugin: expected an object, got ${plugin === null ? 'null' : typeof plugin}.`,
    );
  }

  const candidate = plugin as Record<string, unknown>;

  if (typeof candidate.blockType !== 'string' || candidate.blockType.length === 0) {
    throw new EditorPluginValidationError(
      `EditorPlugin.blockType: expected a non-empty string, got ${describeValue(candidate.blockType)}.`,
    );
  }

  if (!CANONICAL_BLOCK_TYPES.has(candidate.blockType)) {
    throw new EditorPluginValidationError(
      `EditorPlugin.blockType: '${candidate.blockType}' is not a canonical DocContentV1 block type. ` +
      `Allowed: ${[...CANONICAL_BLOCK_TYPES].join(', ')}.`,
    );
  }

  if (!Array.isArray(candidate.plateElementTypes) || candidate.plateElementTypes.length === 0) {
    throw new EditorPluginValidationError(
      `EditorPlugin.plateElementTypes (blockType='${candidate.blockType}'): expected a non-empty array of element-type strings, got ${describeValue(candidate.plateElementTypes)}.`,
    );
  }
  for (const elementType of candidate.plateElementTypes) {
    if (typeof elementType !== 'string' || elementType.length === 0) {
      throw new EditorPluginValidationError(
        `EditorPlugin.plateElementTypes (blockType='${candidate.blockType}'): every entry must be a non-empty string, found ${describeValue(elementType)}.`,
      );
    }
  }

  if (!Object.prototype.hasOwnProperty.call(candidate, 'schemaFragment')) {
    throw new EditorPluginValidationError(
      `EditorPlugin.schemaFragment (blockType='${candidate.blockType}'): required field is missing.`,
    );
  }

  if (typeof candidate.docContentToPlate !== 'function') {
    throw new EditorPluginValidationError(
      `EditorPlugin.docContentToPlate (blockType='${candidate.blockType}'): required converter function is missing or not callable.`,
    );
  }

  if (typeof candidate.plateToDocContent !== 'function') {
    throw new EditorPluginValidationError(
      `EditorPlugin.plateToDocContent (blockType='${candidate.blockType}'): required converter function is missing or not callable.`,
    );
  }

  if (candidate.agentAnchor !== undefined) {
    const anchor = candidate.agentAnchor;
    if (anchor !== 'inline' && anchor !== 'page' && anchor !== 'workspace') {
      throw new EditorPluginValidationError(
        `EditorPlugin.agentAnchor (blockType='${candidate.blockType}'): expected 'inline' | 'page' | 'workspace' or undefined, got ${describeValue(anchor)}.`,
      );
    }
  }
}

/**
 * Insert a previously-validated plugin into the dispatch tables. Splits
 * into a separate entry point so builtin auto-registration can pass
 * `allowReregister: true` without going through the host-facing
 * `validateAndRegisterPlugin` API.
 */
export function registerPluginIntoRegistry(plugin: EditorPlugin, options: RegisterOptions = {}): void {
  validateEditorPlugin(plugin);

  if (pluginsByBlockType.has(plugin.blockType)) {
    if (options.allowReregister) {
      return;
    }
    throw new EditorPluginValidationError(
      `EditorPlugin: a plugin for blockType '${plugin.blockType}' is already registered. ` +
      `Pass { allowReregister: true } if a re-registration is intentional, or call clearRegistryForTests() in test setup.`,
    );
  }

  // Check Plate-element-type collisions too. The same element-type string
  // owned by two plugins would make the inverse lookup ambiguous.
  for (const elementType of plugin.plateElementTypes) {
    const existing = pluginsByPlateElement.get(elementType);
    if (existing && existing.blockType !== plugin.blockType) {
      throw new EditorPluginValidationError(
        `EditorPlugin: Plate element type '${elementType}' is already owned by blockType '${existing.blockType}'; ` +
        `cannot also be claimed by blockType '${plugin.blockType}'.`,
      );
    }
  }

  pluginsByBlockType.set(plugin.blockType, plugin);
  for (const elementType of plugin.plateElementTypes) {
    pluginsByPlateElement.set(elementType, plugin);
  }
}

export function getPluginForBlockType(blockType: string): EditorPlugin | undefined {
  return pluginsByBlockType.get(blockType);
}

export function getPluginForPlateElement(plateType: string): EditorPlugin | undefined {
  return pluginsByPlateElement.get(plateType);
}

export function listRegisteredBlockTypes(): string[] {
  return [...pluginsByBlockType.keys()];
}

export function listRegisteredPlateElementTypes(): string[] {
  return [...pluginsByPlateElement.keys()];
}

/**
 * Test-only reset hook. NOT re-exported through the package entry.
 */
export function clearRegistryForTests(): void {
  pluginsByBlockType.clear();
  pluginsByPlateElement.clear();
}

function describeValue(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return `'${value}'`;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return `array(${value.length})`;
  return typeof value;
}

// Re-export to break a cycle: builtin plugin modules need `DocContentBlockType`
// for narrow typing but importing from `@anydocs/core` in every file is
// noisy.
export type { DocContentBlockType };
