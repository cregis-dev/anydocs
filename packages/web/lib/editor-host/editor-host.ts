// =============================================================================
// editor-host — React adapter wrapping `@anydocs/editor` (Story 7.1)
// -----------------------------------------------------------------------------
// Studio screens mount the new editor through this adapter. The adapter is
// the ONLY path from `packages/web/` into `@anydocs/editor`; Studio call
// sites must NOT import from the package internals (enforced by
// studio-callgraph.test.ts).
//
// Story 7.1 scope: build the adapter only. Studio still defaults to
// `<YooptaDocEditor>`; Story 7.2 wires a feature flag to switch between
// implementations; Story 7.3 removes Yoopta entirely.
//
// File extension: `.ts` (not `.tsx`) because Story 7.1's unit tests run via
// Node's `--experimental-strip-types` test runner which doesn't process JSX.
// The component uses `React.createElement` instead — Next.js bundles either
// form identically.
// =============================================================================

import * as React from 'react';

import type { DocContentV1 } from '@anydocs/core';
import { renderPageContent } from '@anydocs/core';
import { createEditor, type EditorInstance } from '@anydocs/editor';

import { normalizeEditorInput } from './normalize-input.ts';

export type EditorHostDerived = {
  markdown: string;
  plainText: string;
};

export type EditorHostProps = {
  /**
   * Unique identifier for the editor instance. Pass `key={id}` from the parent
   * to force a full remount on page change — the adapter does NOT track id
   * internally because Studio already relies on React's key-based remount for
   * page navigation.
   */
  id: string;
  /** Initial / current editor value. May be `DocContentV1`, legacy Yoopta, or nullish. */
  value: unknown;
  /**
   * Fires after host-triggered content changes via `setContent`. Receives the
   * canonical DocContentV1 payload plus derived `{ markdown, plainText }`
   * computed by `renderPageContent` from `@anydocs/core` — keeps the prop
   * shape identical to the legacy `<YooptaDocEditor>` so Story 7.2 can swap
   * components without changing Studio's onChange handler.
   *
   * Story 6.2 AC6 limitation: user-input change events are NOT delivered
   * (Story 6.4 follow-up tracks the plugin-handler refactor). Only
   * host-triggered `setContent` fires this callback.
   */
  onChange: (content: DocContentV1, derived: EditorHostDerived) => void;
  /** Optional className for the host `<div>`. */
  className?: string;
};

/**
 * Imperative state owned by a single `EditorHost` instance. Tracked outside
 * React state because re-renders shouldn't touch the editor — we only react
 * to value identity changes via a useEffect.
 */
type HostState = {
  instance: EditorInstance | null;
  unmount: (() => void) | null;
  unsubscribeChange: (() => void) | null;
  lastAppliedValue: DocContentV1 | null;
};

function createHostState(): HostState {
  return {
    instance: null,
    unmount: null,
    unsubscribeChange: null,
    lastAppliedValue: null,
  };
}

/**
 * React component that mounts an `@anydocs/editor` instance into a host
 * `<div>`. Use as a drop-in replacement for `<YooptaDocEditor>` once Story
 * 7.2's feature flag is wired.
 *
 * Delegates to {@link useEditorHost} for the lifecycle so the two entry
 * surfaces (component + hook) share a single implementation. Avoids the
 * M2 maintenance hazard surfaced in the Story 7.1 code review.
 */
export function EditorHost(props: EditorHostProps): React.ReactElement {
  const { className } = props;
  const { hostRef } = useEditorHost(props);
  return React.createElement('div', {
    ref: hostRef,
    className,
    'data-anydocs-editor-host': 'true',
  });
}

/**
 * Imperative variant for callers that prefer hooks-only integration. The
 * hook owns the same lifecycle as `<EditorHost>` but lets the caller render
 * the host element directly. Returns `{ hostRef, instance }`; the caller
 * spreads `hostRef` onto a `<div>`.
 *
 * Story 7.1 ships this as a thin layer alongside `<EditorHost>` so future
 * Studio surfaces (toolbar, slash menu — Story 13.x) can reach the editor
 * instance without going through props.
 */
export function useEditorHost(props: EditorHostProps): {
  hostRef: React.RefObject<HTMLDivElement | null>;
  getInstance: () => EditorInstance | null;
} {
  const { value, onChange } = props;
  const hostRef = React.useRef<HTMLDivElement | null>(null);
  const stateRef = React.useRef<HostState>(createHostState());
  const onChangeRef = React.useRef(onChange);
  React.useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  React.useEffect(() => {
    if (hostRef.current === null) return;
    const initial = normalizeEditorInput(value);
    const instance = createEditor({ initialContent: initial });
    const unmountHandle = instance.mount(hostRef.current);
    const unsubscribe = instance.on('change', (payload) => {
      const content = payload as DocContentV1;
      stateRef.current.lastAppliedValue = content;
      const rendered = renderPageContent(content);
      // `renderPageContent` returns `markdown?` / `plainText?`. The editor-
      // host onChange contract guarantees strings (callers — Studio in
      // particular — don't want to thread optionality through the entire
      // page save pipeline). Coalesce undefined to empty string here.
      onChangeRef.current(content, {
        markdown: rendered.markdown ?? '',
        plainText: rendered.plainText ?? '',
      });
    });
    stateRef.current.instance = instance;
    stateRef.current.unmount = unmountHandle;
    stateRef.current.unsubscribeChange = unsubscribe;
    stateRef.current.lastAppliedValue = initial;
    return () => {
      stateRef.current.unsubscribeChange?.();
      stateRef.current.unmount?.();
      stateRef.current = createHostState();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    const state = stateRef.current;
    if (state.instance === null) return;
    const nextValue = normalizeEditorInput(value);
    if (state.lastAppliedValue !== null && isDocContentDeepEqual(state.lastAppliedValue, nextValue)) {
      return;
    }
    state.lastAppliedValue = nextValue;
    state.instance.setContent(nextValue);
  }, [value]);

  return {
    hostRef,
    getInstance: () => stateRef.current.instance,
  };
}

function isDocContentDeepEqual(a: DocContentV1, b: DocContentV1): boolean {
  // JSON stringify is sufficient for canonical DocContentV1 — the schema is
  // a tree of plain JSON-compatible objects with deterministic key order
  // (the converter emits keys in declaration order). Avoids pulling in a
  // deep-equality dependency.
  return JSON.stringify(a) === JSON.stringify(b);
}
