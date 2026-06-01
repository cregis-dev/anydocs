// =============================================================================
// editor-host — mount/unmount + round-trip + input-normalisation tests.
//
// Story 7.1 AC10 vehicle. Runs under Node's built-in test runner with jsdom
// providing DOM globals (matching packages/editor/tests/plate-runtime.test.ts).
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';

import { JSDOM } from 'jsdom';

// Set up jsdom globals BEFORE any import that touches React-DOM. Mirrors the
// Story 6.2 plate-runtime.test.ts setup verbatim — see that file for why
// each global is needed.
const jsdom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'http://localhost/',
  pretendToBeVisual: true,
});

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const jsdomGlobals = [
  'window', 'document', 'HTMLElement', 'HTMLDivElement', 'HTMLDocument',
  'Document', 'Node', 'Element', 'Range', 'NodeList', 'Event',
  'CustomEvent', 'MouseEvent', 'KeyboardEvent', 'DocumentFragment', 'Text',
  'DOMRect', 'MutationObserver', 'ShadowRoot', 'DocumentType',
  'AbortController', 'AbortSignal',
] as const;
for (const key of jsdomGlobals) {
  const value = (jsdom.window as unknown as Record<string, unknown>)[key];
  if (value === undefined) continue;
  try {
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  } catch {
    // Some properties (like `navigator`) are accessor-only on Node — skip.
  }
}
Object.defineProperty(globalThis, 'getComputedStyle', {
  value: jsdom.window.getComputedStyle.bind(jsdom.window),
  configurable: true,
  writable: true,
});
if (typeof (globalThis as { ResizeObserver?: unknown }).ResizeObserver === 'undefined') {
  class ResizeObserverShim {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  Object.defineProperty(globalThis, 'ResizeObserver', { value: ResizeObserverShim, configurable: true });
}
if (typeof (globalThis as { requestAnimationFrame?: unknown }).requestAnimationFrame === 'undefined') {
  Object.defineProperty(globalThis, 'requestAnimationFrame', {
    value: (cb: (timestamp: number) => void) => setTimeout(() => cb(Date.now()), 16) as unknown as number,
    configurable: true,
  });
  Object.defineProperty(globalThis, 'cancelAnimationFrame', {
    value: (id: number) => clearTimeout(id as unknown as ReturnType<typeof setTimeout>),
    configurable: true,
  });
}

import type { DocContentV1 } from '@anydocs/core';

const React = await import('react');
const ReactDOMClient = await import('react-dom/client');
const ReactDOM = await import('react-dom');
const { EditorHost, normalizeEditorInput } = await import('./index.ts');

function paragraphDoc(text: string): DocContentV1 {
  return { version: 1, blocks: [{ type: 'paragraph', children: [{ type: 'text', text }] }] };
}

function renderHost(props: Parameters<typeof EditorHost>[0]): {
  host: HTMLDivElement;
  root: ReturnType<typeof ReactDOMClient.createRoot>;
  unmount: () => void;
} {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = ReactDOMClient.createRoot(host);
  ReactDOM.flushSync(() => {
    root.render(React.createElement(EditorHost, props));
  });
  return {
    host,
    root,
    unmount: () => {
      ReactDOM.flushSync(() => {
        root.unmount();
      });
      host.remove();
    },
  };
}

// ---------------------------------------------------------------------------
// AC4 — normalizeEditorInput
// ---------------------------------------------------------------------------

test('normalizeEditorInput: passes DocContentV1 through unchanged', () => {
  const input = paragraphDoc('hello');
  assert.equal(normalizeEditorInput(input), input);
});

test('normalizeEditorInput: null / undefined / {} become empty doc', () => {
  for (const candidate of [null, undefined, {}]) {
    const result = normalizeEditorInput(candidate);
    assert.deepEqual(result, { version: 1, blocks: [] });
  }
});

test('normalizeEditorInput: legacy YooptaContentValue gets converted', () => {
  // Minimal Yoopta-shaped value — keyed by block ids, each entry has type + value.
  const yoopta = {
    'block-1': {
      id: 'block-1',
      type: 'Paragraph',
      value: [{ type: 'paragraph', children: [{ text: 'legacy yoopta' }] }],
      meta: { order: 0, depth: 0 },
    },
  };
  const result = normalizeEditorInput(yoopta);
  assert.equal(result.version, 1);
  assert.ok(Array.isArray(result.blocks));
});

test('normalizeEditorInput: rejects unrecognised shapes with TypeError', () => {
  assert.throws(() => normalizeEditorInput(42), TypeError);
  assert.throws(() => normalizeEditorInput('string'), TypeError);
  // An object that looks like neither DocContentV1 nor YooptaContentValue
  assert.throws(
    () => normalizeEditorInput({ random: 'shape', nope: true }),
    /unrecognised editor input shape/,
  );
});

// ---------------------------------------------------------------------------
// AC5 — mount / unmount lifecycle
// ---------------------------------------------------------------------------

test('EditorHost mounts into the host element and produces visible content (AC5)', () => {
  const { host, unmount } = renderHost({
    id: 'page-1',
    value: paragraphDoc('hello editor-host'),
    onChange: () => {},
  });
  // The component renders a marker div for grep-based discovery; the inner
  // editor mounts INSIDE it.
  const marker = host.querySelector('[data-anydocs-editor-host]');
  assert.ok(marker, 'EditorHost must render its marker <div>');
  assert.ok(
    marker && marker.childNodes.length > 0,
    'inner editor must populate the marker after mount',
  );
  unmount();
});

test('EditorHost unmount cleans up the host element (AC5)', () => {
  const { host, unmount } = renderHost({
    id: 'page-1',
    value: paragraphDoc('x'),
    onChange: () => {},
  });
  assert.ok(host.querySelector('[data-anydocs-editor-host]'));
  unmount();
  assert.equal(host.childNodes.length, 0, 'unmount must empty the host element');
});

// ---------------------------------------------------------------------------
// AC6 — round-trip via setContent + getContent / onChange
// ---------------------------------------------------------------------------

test('EditorHost fires onChange with canonical DocContentV1 + derived payload after setContent (AC3, AC6)', () => {
  const received: Array<{ content: DocContentV1; derived: { markdown: string; plainText: string } }> = [];
  const { host, root, unmount } = renderHost({
    id: 'page-1',
    value: paragraphDoc('initial'),
    onChange: (content, derived) => received.push({ content, derived }),
  });

  // Trigger a value change — the new value flows through setContent which
  // fires the on('change') subscription inside EditorHost.
  ReactDOM.flushSync(() => {
    root.render(
      React.createElement(EditorHost, {
        id: 'page-1',
        value: paragraphDoc('updated body'),
        onChange: (content, derived) => received.push({ content, derived }),
      }),
    );
  });

  assert.ok(received.length >= 1, 'onChange must fire at least once after a value change');
  const last = received[received.length - 1]!;
  assert.equal(last.content.version, 1);
  assert.ok(Array.isArray(last.content.blocks));
  assert.equal(typeof last.derived.markdown, 'string');
  assert.equal(typeof last.derived.plainText, 'string');
  // The plainText should contain the new body.
  assert.match(last.derived.plainText, /updated body/);

  void host;
  unmount();
});

test('EditorHost: re-render with the SAME value does not re-fire setContent (AC5)', () => {
  let changeCount = 0;
  const value = paragraphDoc('stable');
  const { root, unmount } = renderHost({
    id: 'page-1',
    value,
    onChange: () => {
      changeCount += 1;
    },
  });
  const baseline = changeCount;
  // Re-render with the SAME value object identity.
  ReactDOM.flushSync(() => {
    root.render(
      React.createElement(EditorHost, {
        id: 'page-1',
        value,
        onChange: () => {
          changeCount += 1;
        },
      }),
    );
  });
  assert.equal(changeCount, baseline, 're-render with same value must not trigger onChange');
  unmount();
});

test('EditorHost: re-render with deep-equal but distinct-identity value does not re-fire (AC5)', () => {
  let changeCount = 0;
  const { root, unmount } = renderHost({
    id: 'page-1',
    value: paragraphDoc('stable'),
    onChange: () => {
      changeCount += 1;
    },
  });
  const baseline = changeCount;
  ReactDOM.flushSync(() => {
    root.render(
      React.createElement(EditorHost, {
        id: 'page-1',
        value: paragraphDoc('stable'), // new object, same shape
        onChange: () => {
          changeCount += 1;
        },
      }),
    );
  });
  assert.equal(
    changeCount,
    baseline,
    're-render with deep-equal value must not trigger setContent (Story 7.1 AC5 efficiency requirement)',
  );
  unmount();
});

// ---------------------------------------------------------------------------
// Story 7.1 review M1: AC5 id/key remount semantics
// ---------------------------------------------------------------------------

test('regression M1: re-render with different `id` but SAME React key does NOT remount (state preserved)', () => {
  // Studio passes `key={id}` from the parent — when only the `id` PROP
  // changes (without a parent key change), React treats it as a normal
  // re-render and the inner editor stays mounted. The adapter does NOT
  // listen to `id` for remount; that is the parent's responsibility.
  const { host, root, unmount } = renderHost({
    id: 'page-A',
    value: paragraphDoc('initial'),
    onChange: () => {},
  });
  const markerBefore = host.querySelector('[data-anydocs-editor-host]');
  assert.ok(markerBefore, 'editor mounted on initial render');

  // Re-render with a different id prop, but the parent (root.render here)
  // does NOT supply a React key — React reuses the existing component
  // instance and the inner editor stays put.
  ReactDOM.flushSync(() => {
    root.render(
      React.createElement(EditorHost, {
        id: 'page-B',
        value: paragraphDoc('initial'),
        onChange: () => {},
      }),
    );
  });
  const markerAfter = host.querySelector('[data-anydocs-editor-host]');
  assert.equal(
    markerAfter,
    markerBefore,
    'host <div> DOM identity must be preserved across id-prop-only changes (parent owns key-based remount)',
  );
  unmount();
});

test('regression M1: re-render with a different React key DOES remount the editor', () => {
  // Mirrors how Studio actually mounts: `<EditorHost key={id} id={id} ... />`.
  // Changing the key forces React to unmount the old component instance
  // and mount a fresh one — the inner editor restarts.
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = ReactDOMClient.createRoot(host);

  ReactDOM.flushSync(() => {
    root.render(
      React.createElement(EditorHost, {
        key: 'page-A',
        id: 'page-A',
        value: paragraphDoc('A content'),
        onChange: () => {},
      }),
    );
  });
  const markerBefore = host.querySelector('[data-anydocs-editor-host]');
  assert.ok(markerBefore, 'editor mounted with key="page-A"');

  ReactDOM.flushSync(() => {
    root.render(
      React.createElement(EditorHost, {
        key: 'page-B',
        id: 'page-B',
        value: paragraphDoc('B content'),
        onChange: () => {},
      }),
    );
  });
  const markerAfter = host.querySelector('[data-anydocs-editor-host]');
  assert.ok(markerAfter, 'editor remounted with key="page-B"');
  assert.notEqual(
    markerAfter,
    markerBefore,
    'host <div> DOM identity MUST change when the React key changes — Studio uses key={id} to drive page-change remount',
  );

  ReactDOM.flushSync(() => {
    root.unmount();
  });
  host.remove();
});

// ---------------------------------------------------------------------------
// AC4 — Yoopta input round-trips through host adapter to canonical
// ---------------------------------------------------------------------------

test('EditorHost: Yoopta-shaped initial value is normalised before mount (AC4)', () => {
  const yoopta = {
    'block-1': {
      id: 'block-1',
      type: 'Paragraph',
      value: [{ type: 'paragraph', children: [{ text: 'legacy text' }] }],
      meta: { order: 0, depth: 0 },
    },
  };
  // Should not throw — the adapter normalises via yooptaToDocContent.
  assert.doesNotThrow(() => {
    const { unmount } = renderHost({
      id: 'page-1',
      value: yoopta,
      onChange: () => {},
    });
    unmount();
  });
});

// ---------------------------------------------------------------------------
// AC4 — null / undefined input becomes empty document
// ---------------------------------------------------------------------------

test('EditorHost: null/undefined value mounts as an empty document (AC4)', () => {
  for (const candidate of [null, undefined]) {
    assert.doesNotThrow(() => {
      const { unmount } = renderHost({
        id: 'page-empty',
        value: candidate,
        onChange: () => {},
      });
      unmount();
    });
  }
});
