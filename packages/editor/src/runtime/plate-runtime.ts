// =============================================================================
// @anydocs/editor — Plate-backed runtime (Story 6.2 + 6.2 review fixes)
// -----------------------------------------------------------------------------
// Provides `createPlateEditorInstance(config)` — the real implementation that
// backs `createEditor` from the public contract. Replaces the placeholder
// runtime from Story 6.1.
//
// Public surface is unchanged (the five exports from contract/public-api.ts
// stay byte-identical — Story 6.5's contract-snapshot test enforces this).
//
// Scope (Story 6.2):
//   * Mount/unmount lifecycle (React 19 + Plate v49 via slate-react).
//   * `getContent` / `setContent` round-trips paragraph + heading + supported
//     marks. Other DocContentV1 block types are out of scope (Story 6.3).
//   * `on('change', handler)` fires on every host-triggered `setContent` call
//     AND on user-input edits (typing, deletes, block ops) via the <Plate>
//     component's controlled `onValueChange` callback. Dispatches are deduped
//     by serialized content so a single setContent never double-fires (see
//     M3 note below + `lastNotifiedJson`).
//   * `selection-change` / `agent-anchor-triggered` accept subscriptions but
//     never fire — Story 6.4 / Story 11.7 wire them.
//   * `triggerAgent` still throws `EditorNotImplementedError`. Story 11.x.
//
// 6.2 review fixes (M2 / M3 / M4):
//   * M3: removed the `editor.onChange = ...` mutation. Change events are
//     now dispatched ONLY from `setContent`'s explicit `notifyChange()` call.
//     Eliminates the latent double-dispatch when Plate's tf.setValue routes
//     through editor.onChange.
//   * M2: investigated whether the `setContent` key-bump remount could be
//     dropped after Story 6.3's `nodeId: false` fix. Confirmed by experiment
//     that it CANNOT — Plate v49's zustand-x React store is seeded from
//     `editor.children` at mount time and does not re-read after a
//     `tf.setValue` call. The key-bump remount stays; the trade-off
//     (focus/undo loss on programmatic setContent) is documented inline.
//     Story 6.4 / 7.x can revisit if Plate exposes a public "rebuild from
//     current children" API.
//   * M4: wrapped `flushSync(renderTree)` in try/catch so a render failure
//     during `mount()` rolls back the runtime to an un-mounted state and
//     re-throws — instead of leaving `mountedRoot`/`mountedTarget` populated
//     so the next `mount()` call would refuse with "already mounted".
// =============================================================================

import * as React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';

import { createPlateEditor, Plate, PlateContent } from '@udecode/plate/react';

import type { DocContentV1 } from '@anydocs/core';

import type { EditorConfig, EditorInstance, EditorPlugin } from '../../contract/public-api.ts';
import { docContentToPlate, type PlateValue } from '../converters/doc-content-to-plate.ts';
import { BUILTIN_ELEMENT_COMPONENTS } from './element-components.ts';
import { plateToDocContent } from '../converters/plate-to-doc-content.ts';
import { BUILTIN_PLUGINS, registerBuiltinPluginsOnce, type BuiltinPlugin } from '../plugins/builtin/index.ts';
import {
  registerPluginIntoRegistry,
  validateEditorPlugin,
} from '../plugins/plugin-contract.ts';
import { EditorNotImplementedError } from './not-implemented-error.ts';
import { InlineLinkPlugin } from './inline-link-plugin.ts';
import { SlashMenuController } from './slash-menu.ts';
import { BlockHandleController } from './block-handle.ts';

function collectPlatePlugins(hostPlugins: ReadonlyArray<EditorPlugin> | undefined): unknown[] {
  // Baseline runtime plugins that don't map to a DocContentV1 BLOCK type.
  // The inline link plugin keeps `a` nodes inline — without it, Slate treats
  // links as unknown block elements and the editor crashes on any page
  // containing one (see inline-link-plugin.ts).
  const out: unknown[] = [InlineLinkPlugin];
  for (const plugin of BUILTIN_PLUGINS) {
    const builtin = plugin as BuiltinPlugin;
    if (builtin.platePlugin !== undefined) {
      out.push(builtin.platePlugin);
    }
    if (Array.isArray(builtin.extraPlatePlugins)) {
      for (const extra of builtin.extraPlatePlugins) {
        if (extra !== undefined) out.push(extra);
      }
    }
  }
  if (hostPlugins) {
    for (const plugin of hostPlugins) {
      const candidate = plugin as EditorPlugin & { platePlugin?: unknown };
      if (candidate.platePlugin !== undefined) {
        out.push(candidate.platePlugin);
      }
    }
  }
  return out;
}

type EditorEvent = 'change' | 'selection-change' | 'agent-anchor-triggered';
type EventHandler = (payload: unknown) => void;

// Module-level container → React root tracker. React-DOM warns whenever the
// same container is passed to `createRoot()` twice, and React 19 Strict Mode
// replays every effect (setup → cleanup → setup) synchronously to surface
// impurities. If we tear the root down inside the effect cleanup and the next
// setup races in before the cleanup commits, React-DOM still considers the
// container "owned" and logs the warning. We avoid the issue by reusing the
// same React root across `mount()` calls on the same target: the second
// mount() finds the existing root in this map and re-renders into it rather
// than constructing a new one.
//
// The pending-unmount flag is the cancellation token for the deferred
// teardown: when `unmount()` schedules the actual `root.unmount()` via a
// microtask, a re-mount that happens between schedule and execution flips
// the flag back to `false` and the microtask becomes a no-op.
//
// WeakMap keys = HTMLElement so the entries are GC'd if the host element
// disappears without a clean shutdown.
type ContainerState = { root: Root; pendingUnmount: boolean };
const containerStates: WeakMap<HTMLElement, ContainerState> = new WeakMap();

// Plate's editor type is sprawling and parameterized by the plugin pipeline.
// We use a structural minimum here so the runtime stays decoupled from the
// exact Plate generic — the only fields we read or write through documented
// extension points.
type PlateLikeEditor = {
  children: PlateValue;
  selection?: { anchor: { path: number[]; offset: number } } | null;
  tf: {
    // `setValue` is Plate's documented transform for replacing the editor
    // contents wholesale. Using it (rather than mutating `editor.children`
    // directly) routes through Slate's normalization + React-state pipeline
    // so the DOM re-renders.
    setValue: (value: PlateValue) => void;
    reset?: () => void;
    insertBreak: () => void;
    setNodes: (props: Record<string, unknown>, opts: { at: number[] }) => void;
  };
};

// Heading types reset to a paragraph when the user presses Enter at the end
// of the line (Notion convention). Without this, every Enter inside an h1-h3
// spawns ANOTHER heading and the author has to convert it back by hand.
const EXIT_BREAK_RESET_TYPES = new Set<string>(['h1', 'h2', 'h3']);

// Wraps `editor.tf.insertBreak` (the standard Slate `withX` extension
// pattern): after the break, if the NEW block is an empty heading, reset it
// to a paragraph. Empty-check matters — breaking in the MIDDLE of a heading
// moves the tail text into the new block, and that genuinely should stay a
// heading.
function withHeadingExitBreak(editor: PlateLikeEditor): void {
  const insertBreakBase = editor.tf.insertBreak.bind(editor.tf);
  editor.tf.insertBreak = () => {
    insertBreakBase();
    const selection = editor.selection;
    if (!selection) return;
    const blockIndex = selection.anchor.path[0];
    if (blockIndex === undefined) return;
    const block = editor.children[blockIndex] as
      | { type?: string; children?: Array<{ text?: string }> }
      | undefined;
    if (!block || typeof block.type !== 'string' || !EXIT_BREAK_RESET_TYPES.has(block.type)) return;
    const text = Array.isArray(block.children)
      ? block.children.map((child) => (typeof child.text === 'string' ? child.text : '')).join('')
      : '';
    if (text !== '') return;
    editor.tf.setNodes({ type: 'p' }, { at: [blockIndex] });
  };
}

// Test-only escape hatch: maps a public `EditorInstance` back to the raw
// Plate/Slate editor so tests can drive user-input ops (`editor.apply(...)`)
// through Slate's real op pipeline. NOT part of the public contract
// (contract/public-api.ts is the only contract surface; this module-level
// export is internal and must not be re-exported from src/index.ts).
const rawEditorByInstance = new WeakMap<EditorInstance, unknown>();

/** @internal Returns the raw Plate editor backing `instance`. Tests only. */
export function getRawPlateEditorForTesting(instance: EditorInstance): unknown {
  return rawEditorByInstance.get(instance);
}

/**
 * Real `EditorInstance` factory backing `createEditor`. Story 6.2 replaces
 * `createPlaceholderEditor` from Story 6.1.
 */
export function createPlateEditorInstance(config: EditorConfig): EditorInstance {
  // Build the Plate editor with the minimum plugin set Story 6.2 supports.
  // Story 6.4 will refactor this to be plugin-driven (consumers register
  // additional block plugins via `registerPlugin`).
  // Auto-register builtin plugins on first createEditor; idempotent on
  // subsequent calls. Host plugins supplied via `config.plugins` are
  // validated and registered alongside builtins so they participate in
  // converter dispatch.
  //
  // Story 6.4 review M3 fix: validate ALL host plugins before mutating the
  // global registry. Without this, a `config.plugins: [validA, invalidB]`
  // array would leave `validA` permanently registered globally before
  // throwing on `invalidB`, mutating shared state on a failed createEditor.
  registerBuiltinPluginsOnce();
  if (config.plugins && config.plugins.length > 0) {
    // Phase 1: validate every host plugin (pure check; no side effects).
    for (const hostPlugin of config.plugins) {
      validateEditorPlugin(hostPlugin);
    }
    // Phase 2: register only after all are known good.
    for (const hostPlugin of config.plugins) {
      // Host plugin registration uses allowReregister: true so a host calling
      // createEditor twice with the same plugin set doesn't trip duplicate
      // detection. Genuine duplicates with different shapes are caught by
      // the plate-element-type collision check inside the registry.
      registerPluginIntoRegistry(hostPlugin, { allowReregister: true });
    }
  }

  // Disable Plate's core NodeIdPlugin entirely. By default Plate assigns a
  // fresh nanoid to every block that lacks an `id` — both during initial
  // normalization AND during every `editor.tf.insertNode`/`setValue` call —
  // which would make `getContent()` lossy round-trip (DocContentV1's optional
  // `id` field would always be populated on output even when absent on
  // input). The canonical id semantics belong to the host; the editor only
  // preserves ids the caller supplied.
  //
  // `nodeId: false` is passed via the `withSlate` options that flow through
  // `createPlateEditor` → `createSlateEditor` → `getCorePlugins`.
  const editor = createPlateEditor({
    nodeId: false,
    plugins: collectPlatePlugins(config.plugins) as never,
    value: docContentToPlate(config.initialContent),
    // Without an `override.components` map every Plate plugin from
    // `@udecode/plate-*/react` falls back to an unstyled `<div
    // data-slate-element>` — the package ships behavior (key bindings,
    // serializers) but not UI components. `BUILTIN_ELEMENT_COMPONENTS`
    // provides the 11 canonical DocContentV1 block types + the `a` inline
    // with semantic HTML tags and Tailwind utility classes (Studio pipes
    // Tailwind through the editor host).
    override: { components: BUILTIN_ELEMENT_COMPONENTS as never },
  }) as unknown as PlateLikeEditor;

  withHeadingExitBreak(editor);

  // Event bus — Map<event, Set<handler>>. The Set semantics keep registration
  // identity-based and idempotent on duplicate disposer calls (removing an
  // already-removed handler is a no-op).
  const listeners: Record<EditorEvent, Set<EventHandler>> = {
    change: new Set(),
    'selection-change': new Set(),
    'agent-anchor-triggered': new Set(),
  };

  // Serialized form of the payload most recently delivered to `change`
  // subscribers. Used to dedupe the two dispatch paths:
  //
  //   1. Host path — `setContent` calls `notifyChange()` synchronously and
  //      unconditionally (preserves Story 6.2 AC6 / review M3 semantics:
  //      exactly one dispatch per setContent).
  //   2. User-input path — the <Plate> component's controlled `onValueChange`
  //      callback fires whenever `editor.children` changes through Slate's
  //      op pipeline (typing, deletes, block ops). Slate defers its
  //      `editor.onChange` to a microtask, so after a `setContent` the Plate
  //      callback observes content that `notifyChange()` already recorded
  //      here — `handlePlateValueChange` compares against this value and
  //      skips the duplicate.
  //
  // Seeded from the initial content so a mount-time normalization pass never
  // surfaces a spurious change event to the host.
  let lastNotifiedJson: string = JSON.stringify(plateToDocContent(editor.children));

  // Dispatch `change` to all subscribed handlers. Called from `setContent`
  // (host path, unconditional) and from `handlePlateValueChange` (user-input
  // path, deduped by the caller).
  //
  // We deliberately do NOT hook into Plate's `editor.onChange` directly
  // (Story 6.2 review M3): mutating `editor.onChange` creates two competing
  // dispatch paths with implementation-dependent counts. The <Plate>
  // component's documented `onValueChange` prop + content dedupe gives
  // deterministic exactly-once delivery instead.
  function notifyChange(): void {
    const payload = plateToDocContent(editor.children);
    lastNotifiedJson = JSON.stringify(payload);
    if (listeners.change.size === 0) {
      return;
    }
    for (const handler of listeners.change) {
      // Errors in one handler must not block siblings. Match the "events
      // are best-effort, host owns its own handlers" convention shared
      // with browser EventTarget semantics.
      try {
        handler(payload);
      } catch (cause) {
        // eslint-disable-next-line no-console
        console.error('[@anydocs/editor] change handler threw:', cause);
      }
    }
  }

  // User-input dispatch path. Invoked by the <Plate> component whenever
  // `editor.children` changes (controlled `onValueChange` callback). Skips
  // anything `notifyChange()` already delivered — in particular the deferred
  // Plate callback that follows a host `setContent` — by comparing serialized
  // content against `lastNotifiedJson`.
  function handlePlateValueChange(): void {
    if (listeners.change.size === 0) {
      return;
    }
    const payload = plateToDocContent(editor.children);
    const json = JSON.stringify(payload);
    if (json === lastNotifiedJson) {
      return;
    }
    lastNotifiedJson = json;
    for (const handler of listeners.change) {
      try {
        handler(payload);
      } catch (cause) {
        // eslint-disable-next-line no-console
        console.error('[@anydocs/editor] change handler threw:', cause);
      }
    }
  }

  // React-side state. `react-dom/client.createRoot` requires DOM, so we only
  // call it inside `mount`. The import at the top of this file is DOM-free
  // (per react-dom's docs) so this module is still safe to import in Node.
  let mountedRoot: Root | null = null;
  let mountedTarget: HTMLElement | null = null;
  // Re-render token bumped on every `setContent` so the React tree key
  // changes and Plate re-initializes its zustand-x store from the freshly-
  // updated `editor.children`. Verified experimentally that `tf.setValue`
  // alone — even with `nodeId: false` — does NOT propagate to Plate's
  // internal store (the store is seeded once at mount and doesn't re-read
  // on Slate operation events). Plate v49 has no public "rebuild from
  // current children" hook; key-bump remount is the supported pattern.
  //
  // Trade-off: every host-side `setContent` discards focus, selection, and
  // Slate's undo history because the new <Plate> instance starts fresh.
  // For Studio's host-triggered content swaps this is acceptable. User
  // typing — which goes through Slate's normal op pipeline — is unaffected.
  let renderKey = 0;

  function renderTree(): void {
    if (mountedRoot === null) return;
    mountedRoot.render(
      React.createElement(
        Plate,
        {
          editor: editor as unknown as Parameters<typeof Plate>[0]['editor'],
          // Controlled callback: fires when `editor.children` changes through
          // Slate's op pipeline (user typing, deletes, block ops). This is
          // the user-input half of the change-event contract; the host half
          // is `setContent` → `notifyChange()`. See `lastNotifiedJson`.
          onValueChange: handlePlateValueChange,
          children: React.createElement(React.Fragment, null, [
            React.createElement(PlateContent, {
              key: 'content',
              // Suppress the browser's default contenteditable focus ring —
              // without this the whole editing surface gets a conspicuous
              // blue outline whenever the editor has focus. Inline style
              // (not a Tailwind class) so the fix doesn't depend on the
              // host piping Tailwind into the editor.
              style: { outline: 'none' },
            }),
            React.createElement(SlashMenuController, { key: 'slash-menu' }),
            React.createElement(BlockHandleController, { key: 'block-handle' }),
          ]),
          key: renderKey,
        },
      ),
    );
  }

  // Test environments (jsdom + node:test) set `IS_REACT_ACT_ENVIRONMENT =
  // true` so React quiets its "not wrapped in act()" warning. We re-use that
  // flag as our "synchronous commit allowed" signal: tests assert DOM
  // contents immediately after `mount()`/`setContent()`, so the runtime must
  // commit before returning.
  //
  // In production (Studio + Desktop), the same `flushSync` call may execute
  // while the host React (Next.js Suspense from `next/dynamic`) is itself
  // mid-render — React 19 then logs the noisy `flushSync was called from
  // inside a lifecycle method` console error which Next.js dev surfaces as
  // a Console Error overlay. Defer the commit to a microtask in that case;
  // the inner React root still mounts within the same task as Studio's
  // useEffect callback, so the editor appears with no perceptible delay,
  // and React's render cycle has completed by the time `flushSync` fires.
  function isSyncCommitAllowed(): boolean {
    return (
      (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean })
        .IS_REACT_ACT_ENVIRONMENT === true
    );
  }

  function commitWithFlushSync(commit: () => void): void {
    if (isSyncCommitAllowed()) {
      flushSync(commit);
      return;
    }
    // Defer to a microtask. Staleness is each call site's responsibility:
    // `renderTree()` already no-ops when `mountedRoot === null`, and the
    // unmount path captures the local React root via closure so this
    // commit still tears down the right tree even after `mountedRoot` was
    // cleared synchronously.
    queueMicrotask(() => {
      flushSync(commit);
    });
  }

  const instance: EditorInstance = {
    mount(target: HTMLElement) {
      if (mountedRoot !== null) {
        throw new Error('createPlateEditorInstance: instance is already mounted; call the previous unmount handle first.');
      }
      // Reuse an existing React root if this container already has one
      // (Strict Mode replay scenario). Cancel any pending teardown so the
      // microtask scheduled by a prior `unmount()` becomes a no-op. The
      // editor closure-captures its own Plate `editor` value, so calling
      // `renderTree()` will re-render the shared root with this instance's
      // tree — exactly the behaviour Strict Mode is testing for.
      const existing = containerStates.get(target);
      let root: Root;
      if (existing !== undefined) {
        existing.pendingUnmount = false;
        root = existing.root;
      } else {
        root = createRoot(target);
        containerStates.set(target, { root, pendingUnmount: false });
      }
      mountedRoot = root;
      mountedTarget = target;
      // `React.createElement` keeps this file pure-`.ts` (no TSX needed) and
      // sidesteps the editor package's tsconfig not having `jsx: "react"`.
      //
      // The try/catch rolls back state on a render failure (M4 review fix):
      // a thrown render leaves the React tree partially committed; clearing
      // `mountedRoot`/`mountedTarget` lets the caller try again with a
      // different host element or surface the underlying error without the
      // runtime claiming to be "already mounted".
      try {
        commitWithFlushSync(() => {
          renderTree();
        });
      } catch (renderError) {
        try {
          root.unmount();
        } catch {
          // best-effort cleanup; ignore secondary failures.
        }
        containerStates.delete(target);
        mountedRoot = null;
        mountedTarget = null;
        throw renderError;
      }

      return function unmount() {
        if (mountedRoot !== root) {
          // Disposer for a previously-mounted React root that has already been
          // released. Be idempotent: silently no-op rather than throwing.
          return;
        }
        // Capture target via closure before clearing refs so a re-entrant
        // mount() during React 19 Strict Mode's effect replay sees a
        // fully-detached runtime state.
        const targetToClear = mountedTarget;
        mountedRoot = null;
        mountedTarget = null;
        const state = containerStates.get(targetToClear ?? target);
        if (isSyncCommitAllowed()) {
          // Tests: flushSync + manual cleanup loop so AC8's
          // `host.childNodes.length === 0` assertion holds without `await`.
          flushSync(() => {
            root.unmount();
          });
          if (state !== undefined) {
            containerStates.delete(targetToClear ?? target);
          }
          if (targetToClear !== null) {
            while (targetToClear.firstChild) {
              targetToClear.removeChild(targetToClear.firstChild);
            }
          }
          return;
        }
        // Production: defer `root.unmount()` to a microtask AND guard it
        // with a cancellation token. React 19 refuses synchronous unmount
        // from inside a render, and Strict Mode replays the effect
        // (cleanup → re-setup) before any microtask gets to run — so if
        // the re-setup happens, it flips `pendingUnmount` back to false
        // and this microtask becomes a no-op, leaving the shared root in
        // place. If no re-mount happens, the microtask runs the real
        // teardown once React's render cycle has completed.
        if (state === undefined) {
          // Defensive: state should always exist for a successfully
          // mounted root, but if it was already disposed elsewhere just
          // skip cleanly.
          return;
        }
        state.pendingUnmount = true;
        queueMicrotask(() => {
          if (!state.pendingUnmount) return;
          containerStates.delete(targetToClear ?? target);
          root.unmount();
        });
      };
    },

    getContent(): DocContentV1 {
      return plateToDocContent(editor.children);
    },

    setContent(payload: DocContentV1): void {
      if (payload === null || typeof payload !== 'object') {
        throw new Error('createPlateEditorInstance: setContent payload must be a DocContentV1 object.');
      }
      if (payload.version !== 1) {
        throw new Error(
          `createPlateEditorInstance: setContent payload version ${String(payload.version)} is not supported; expected 1.`,
        );
      }
      const nextValue = docContentToPlate(payload);
      // Update the underlying Slate value via the documented `tf.setValue`
      // transform (preferred over `editor.children = ...` which bypasses
      // Slate's normalization).
      editor.tf.setValue(nextValue);

      // When mounted, force Plate's React tree to re-mount so the zustand-x
      // store re-seeds from the new `editor.children` (see `renderKey`
      // docstring above for why this is necessary). `flushSync` makes the
      // DOM update visible before this method returns.
      if (mountedRoot !== null) {
        renderKey += 1;
        commitWithFlushSync(() => {
          renderTree();
        });
      }

      // Fire the `change` event exactly once per setContent (M3 review fix:
      // no longer relies on Plate's `editor.onChange` path, which had
      // implementation-dependent dispatch counts across mounted/unmounted).
      notifyChange();
    },

    on(event, handler) {
      if (event !== 'change' && event !== 'selection-change' && event !== 'agent-anchor-triggered') {
        throw new Error(`createPlateEditorInstance: unknown event '${String(event)}'`);
      }
      listeners[event].add(handler);
      return function dispose() {
        listeners[event].delete(handler);
      };
    },

    triggerAgent(scope, _payload) {
      throw new EditorNotImplementedError(
        `EditorInstance.triggerAgent('${scope}', ...) is not implemented yet. ` +
        `Agent runtime lands in Story 11.3 (Inline) / 11.4 (Page) / 11.5 (Workspace) / 11.7 (Agent anchors).`,
      );
    },
  };

  rawEditorByInstance.set(instance, editor);

  return instance;
}
