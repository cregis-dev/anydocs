// =============================================================================
// Builtin plugins — Story 6.4
// -----------------------------------------------------------------------------
// `BUILTIN_PLUGINS` is the ordered list of plugins auto-registered by
// `plate-runtime`'s init path. Order: paragraph first (canonical default
// for empty payloads), then alphabetical by `blockType`. Tests assert the
// order so future contributors don't accidentally reorder.
// =============================================================================

import type { EditorPlugin } from '../../../contract/public-api.ts';
import { registerPluginIntoRegistry } from '../plugin-contract.ts';

import { blockquotePlugin } from './blockquote.ts';
import { calloutPlugin } from './callout.ts';
import { codeBlockPlugin } from './code-block.ts';
import { codeGroupPlugin } from './code-group.ts';
import { dividerPlugin } from './divider.ts';
import { headingPlugin } from './heading.ts';
import { imagePlugin } from './image.ts';
import { listPlugin } from './list.ts';
import { mermaidPlugin } from './mermaid.ts';
import { paragraphPlugin } from './paragraph.ts';
import { tablePlugin } from './table.ts';

export type BuiltinPlugin = EditorPlugin & {
  platePlugin: unknown;
  extraPlatePlugins?: unknown[];
};

export const BUILTIN_PLUGINS: ReadonlyArray<BuiltinPlugin> = [
  paragraphPlugin,
  blockquotePlugin,
  calloutPlugin,
  codeBlockPlugin,
  codeGroupPlugin,
  dividerPlugin,
  headingPlugin,
  imagePlugin,
  listPlugin,
  mermaidPlugin,
  tablePlugin,
];

export {
  blockquotePlugin,
  calloutPlugin,
  codeBlockPlugin,
  codeGroupPlugin,
  dividerPlugin,
  headingPlugin,
  imagePlugin,
  listPlugin,
  mermaidPlugin,
  paragraphPlugin,
  tablePlugin,
};

let builtinsRegistered = false;

/**
 * Register every builtin plugin into the global registry exactly once per
 * process. Idempotent — subsequent calls no-op. Both `plate-runtime`'s
 * `createPlateEditorInstance` init path AND test files (whose imports of
 * the converters bypass plate-runtime) MUST call this before invoking
 * `docContentToPlate` / `plateToDocContent`.
 *
 * Keeping registration behind an explicit function (rather than a module-
 * load side effect) makes test setup deterministic and lets
 * `clearRegistryForTests()` re-run init when tests want a clean slate.
 */
export function registerBuiltinPluginsOnce(): void {
  if (builtinsRegistered) return;
  for (const plugin of BUILTIN_PLUGINS) {
    registerPluginIntoRegistry(plugin, { allowReregister: true });
  }
  builtinsRegistered = true;
}

/**
 * Test-only reset hook: clears the "already registered" flag so a test
 * suite that calls `clearRegistryForTests()` can re-prime the registry
 * with `registerBuiltinPluginsOnce()` on the next call. NOT re-exported
 * through the package entry.
 */
export function resetBuiltinRegistrationFlagForTests(): void {
  builtinsRegistered = false;
}
