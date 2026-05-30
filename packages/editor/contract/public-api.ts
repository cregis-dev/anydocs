// =============================================================================
// @anydocs/editor — Public API Contract (single source of truth)
// -----------------------------------------------------------------------------
// Aligns with architecture.md §`@anydocs/editor` Package Contract → Public API
// Surface (Phase 2 vNext Addendum). The package entry (`src/index.ts`) MUST
// re-export ONLY the symbols declared here. Story 6.5 will derive
// `contract/contract.json` from this file and run a CI diff against it; any
// addition, removal, or signature change must be intentional and reviewed.
//
// Design discipline:
//   * Five public symbols (per AC2): createEditor, EditorConfig, EditorInstance,
//     EditorPlugin, registerPlugin. Other named types referenced below
//     (UnmountHandle, AgentInvocation, runtime error classes, event/scope
//     unions) are intentionally internal — they appear inline in the public
//     signatures so consumers see structural shapes without depending on
//     additional named exports.
//   * No mention of Plate, Yoopta, or any vendor in this file. Runtime engine
//     details live under src/runtime/ and never leak through the contract.
//   * Phase 3 anchors (project mode, actorId, remote MCP, collaboration) are
//     deliberately absent and must not be added without architectural review.
// =============================================================================

import type { DocContentV1 } from '@anydocs/core';

import { createPlateEditorInstance } from '../src/runtime/plate-runtime.ts';
import { validateAndRegisterPlugin } from '../src/runtime/plugin-registry.ts';

/**
 * Declarative configuration accepted by {@link createEditor}.
 *
 * `initialContent` is a canonical `doc-content-v1` payload; the editor runtime
 * is responsible for converting it to its internal representation.
 *
 * `plugins` are evaluated in declaration order at mount time. Plugin shape is
 * validated lightly in Story 6.1 and tightened in Story 6.4.
 *
 * `agentAnchorsEnabled` toggles the inline / page / workspace agent entry
 * points consumed by Epic 11 (Built-in Agent).
 *
 * `theme` selects a high-level token preset. Fine-grained theming is delegated
 * to host CSS — the editor does not ship its own theme stylesheet.
 */
export type EditorConfig = {
  initialContent: DocContentV1;
  plugins?: ReadonlyArray<EditorPlugin>;
  agentAnchorsEnabled?: boolean;
  theme?: 'light' | 'dark' | 'auto';
};

/**
 * Opaque editor handle returned by {@link createEditor}. Consumers interact
 * with the editor exclusively through these methods; internal state is not
 * accessible from the outside.
 *
 * `mount` attaches the editor to a host element and returns a disposer.
 * `getContent` / `setContent` round-trip canonical `doc-content-v1` payloads.
 * `on` subscribes to lifecycle events; the returned disposer unsubscribes.
 * `triggerAgent` is the host-facing entry point for the three Phase 2 agent
 * scopes (Epic 11). The placeholder runtime throws until Story 6.2 wires the
 * Plate-backed implementation.
 */
export type EditorInstance = {
  mount(target: HTMLElement): () => void;
  getContent(): DocContentV1;
  setContent(payload: DocContentV1): void;
  on(
    event: 'change' | 'selection-change' | 'agent-anchor-triggered',
    handler: (payload: unknown) => void,
  ): () => void;
  triggerAgent(
    scope: 'inline' | 'page' | 'workspace',
    payload: unknown,
  ): {
    readonly id: string;
    readonly status: 'pending' | 'committed' | 'rejected';
  };
};

/**
 * Plugin contract for extending the editor with custom block types.
 *
 * `blockType` is the canonical `doc-content-v1` block identifier this plugin
 * handles. Must be one of the canonical types declared by `@anydocs/core`'s
 * `DOC_CONTENT_BLOCK_TYPES`; the runtime validator (Story 6.4) rejects any
 * value outside that set.
 *
 * `plateElementTypes` declares every runtime element-type string this plugin
 * owns on the editor side. A single plugin may own multiple types — e.g. the
 * heading plugin owns `['h1', 'h2', 'h3']`, the list plugin owns
 * `['ul', 'ol', 'todo_list', 'li', 'todo_li']`, the table plugin owns
 * `['table', 'tr', 'td', 'th']`. The inverse converter uses this list to
 * look up which plugin handles a given runtime node. Required and
 * non-empty (Story 6.4 AC4).
 *
 * `schemaFragment` is a structural description used by the converter
 * layer (Story 6.3) and the schema validator (Story 6.4); it is opaque from
 * the contract's perspective.
 *
 * `docContentToPlate` / `plateToDocContent` are the two conversion hooks that
 * keep the runtime engine isolated behind `doc-content-v1`. Both are
 * required (Story 6.4 review M1 fix: previously optional in the type but
 * required at runtime — the validator threw on missing hooks). The runtime
 * engine is referenced abstractly here so the contract stays vendor-neutral;
 * the actual engine value type is defined and consumed inside src/runtime/.
 *
 * `agentAnchor` declares whether the block exposes an inline, page, or
 * workspace agent anchor (Epic 11 / FR51).
 */
export type EditorPlugin = {
  blockType: string;
  plateElementTypes: ReadonlyArray<string>;
  schemaFragment: unknown;
  docContentToPlate: (block: unknown) => unknown;
  plateToDocContent: (node: unknown) => unknown;
  agentAnchor?: 'inline' | 'page' | 'workspace';
};

/**
 * Factory that produces an {@link EditorInstance}. Story 6.2 swaps the
 * Story 6.1 placeholder for a Plate-backed runtime; the public surface is
 * unchanged so the Story 6.5 contract-snapshot test stays in sync.
 */
export function createEditor(config: EditorConfig): EditorInstance {
  return createPlateEditorInstance(config);
}

/**
 * Registers a plugin in the package-local registry. The placeholder runtime
 * performs lightweight shape validation (presence of `blockType` and
 * `schemaFragment`); Story 6.4 will replace this with full schema-fragment
 * validation against `doc-content-v1` allowed block types.
 */
export function registerPlugin(plugin: EditorPlugin): void {
  validateAndRegisterPlugin(plugin);
}
