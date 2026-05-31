// =============================================================================
// Plate runtime — mount/unmount lifecycle + content + event-bus integration
// tests (Story 6.2 AC2, AC3, AC5, AC6, AC8).
//
// DOM is provided by jsdom — set up once at module load and mounted onto
// globalThis so React-DOM, Plate, and slate-react can resolve `document`,
// `window`, and the standard DOM constructors. Tests then construct a fresh
// host element per case via `document.createElement('div')`.
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';

import { JSDOM } from 'jsdom';

// Stand up a global DOM BEFORE importing anything that touches React-DOM.
// React-DOM 19 reads `globalThis.document` at module init when running in a
// non-browser environment, so the order matters: set up jsdom, then import.
const jsdom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'http://localhost/',
  pretendToBeVisual: true,
});

// IS_REACT_ACT_ENVIRONMENT silences React 19's warning about state updates
// outside `act()`. We assert synchronous mount/unmount behavior here, not
// async flushing, so the warning is noise.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Mount the jsdom Window's full surface onto globalThis. React-DOM 19 reads
// many constructors (Document, Node, HTMLElement, Range, ...) and timing
// helpers (requestAnimationFrame, cancelAnimationFrame) directly from the
// global namespace when running outside a real browser.
const jsdomGlobals = [
  'window',
  'document',
  'HTMLElement',
  'HTMLDivElement',
  'HTMLDocument',
  'Document',
  'Node',
  'Element',
  'Range',
  'NodeList',
  'Event',
  'CustomEvent',
  'MouseEvent',
  'KeyboardEvent',
  'DocumentFragment',
  'Text',
  'DOMRect',
  'MutationObserver',
  'ShadowRoot',
  'DocumentType',
  'AbortController',
  'AbortSignal',
] as const;

for (const key of jsdomGlobals) {
  const value = (jsdom.window as unknown as Record<string, unknown>)[key];
  if (value === undefined) continue;
  try {
    Object.defineProperty(globalThis, key, {
      value,
      configurable: true,
      writable: true,
    });
  } catch {
    // Some properties (like `navigator` on Node 22) are accessor-only on the
    // global object and can't be redefined. Skipping them is safe — the
    // jsdom-managed ones we need (`document`, `window`, ...) succeed.
  }
}

// `getComputedStyle` needs `this` bound to the jsdom window.
Object.defineProperty(globalThis, 'getComputedStyle', {
  value: jsdom.window.getComputedStyle.bind(jsdom.window),
  configurable: true,
  writable: true,
});

// jsdom 29 does not ship ResizeObserver / requestAnimationFrame /
// cancelAnimationFrame, but slate-react + React-DOM 19 both call them.
// Provide minimal shims so renders don't crash.
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

// Dynamic import AFTER the DOM is mounted onto globalThis so React-DOM picks
// up the jsdom Window when it initializes.
const { createEditor } = await import('../src/index.ts');
const editorModule = { createEditor };

import type { DocContentV1 } from '@anydocs/core';

// Intentionally NOT cleaning up jsdom globals in an after-hook. The Node test
// runner spawns one process per test file (no inter-file global leakage), and
// React-DOM 19's async cleanup microtasks fire AFTER our after-hook would
// have torn down `globalThis.window` — yanking the global mid-cleanup triggers
// `ReferenceError: window is not defined` uncaught exceptions that fail tests
// whose assertions already passed. Leaving the globals in place is the
// pragmatic fix.

function paragraphDoc(text: string): DocContentV1 {
  return {
    version: 1,
    blocks: [{ type: 'paragraph', children: [{ type: 'text', text }] }],
  };
}

function headingDoc(level: 1 | 2 | 3, text: string): DocContentV1 {
  return {
    version: 1,
    blocks: [{ type: 'heading', level, children: [{ type: 'text', text }] }],
  };
}

function createHost(): HTMLElement {
  return document.createElement('div');
}

// ---------------------------------------------------------------------------
// AC2 + AC8 — mount / unmount lifecycle
// ---------------------------------------------------------------------------

test('mount returns an unmount handle; unmount empties the host element (AC2, AC8)', () => {
  const host = createHost();
  const instance = editorModule.createEditor({ initialContent: paragraphDoc('hi') });
  const unmount = instance.mount(host);
  assert.equal(typeof unmount, 'function');
  assert.ok(host.childNodes.length > 0, 'mount must populate the host element');

  unmount();
  assert.equal(host.childNodes.length, 0, 'unmount must empty the host element');
});

test('mount → unmount → mount → unmount lifecycle leaves no orphan DOM (AC8)', () => {
  const host = createHost();
  const instance = editorModule.createEditor({ initialContent: paragraphDoc('round-trip') });

  for (let cycle = 0; cycle < 3; cycle += 1) {
    const unmount = instance.mount(host);
    assert.ok(host.childNodes.length > 0, `cycle ${cycle}: mount populated`);
    unmount();
    assert.equal(host.childNodes.length, 0, `cycle ${cycle}: unmount cleaned up`);
  }
});

test('double-mount without unmount throws to surface programmer error', () => {
  const host = createHost();
  const instance = editorModule.createEditor({ initialContent: paragraphDoc('x') });
  const dispose = instance.mount(host);
  assert.throws(() => instance.mount(host), /already mounted/);
  dispose();
});

test('unmount handle is idempotent (calling twice is safe)', () => {
  const host = createHost();
  const instance = editorModule.createEditor({ initialContent: paragraphDoc('x') });
  const dispose = instance.mount(host);
  dispose();
  assert.doesNotThrow(dispose);
});

// ---------------------------------------------------------------------------
// AC3 — rendered DOM reflects initial content
// ---------------------------------------------------------------------------

test('initial paragraph content appears in the rendered DOM (AC3)', () => {
  const host = createHost();
  const instance = editorModule.createEditor({ initialContent: paragraphDoc('hello rendered') });
  const dispose = instance.mount(host);
  assert.match(host.textContent ?? '', /hello rendered/);
  dispose();
});

test('initial heading content renders as the corresponding <h1>/<h2>/<h3> element (AC3)', () => {
  for (const level of [1, 2, 3] as const) {
    const host = createHost();
    const instance = editorModule.createEditor({ initialContent: headingDoc(level, `Heading L${level}`) });
    const dispose = instance.mount(host);
    const headingEl = host.querySelector(`h${level}`);
    assert.ok(headingEl, `h${level} element must be present in rendered DOM`);
    assert.match(headingEl?.textContent ?? '', new RegExp(`Heading L${level}`));
    dispose();
  }
});

// ---------------------------------------------------------------------------
// AC4 + AC5 — getContent / setContent round-trip
// ---------------------------------------------------------------------------

test('getContent immediately after construction returns the canonical initial payload (AC4)', () => {
  const initial = paragraphDoc('snapshot');
  const instance = editorModule.createEditor({ initialContent: initial });
  const content = instance.getContent();
  assert.deepEqual(content, initial);
});

test('setContent updates getContent for the next call (AC5)', () => {
  const instance = editorModule.createEditor({ initialContent: paragraphDoc('before') });
  instance.setContent(paragraphDoc('after'));
  const next = instance.getContent();
  assert.deepEqual(next, paragraphDoc('after'));
});

test('setContent → getContent cycle is stable across multiple invocations (AC5)', () => {
  const instance = editorModule.createEditor({ initialContent: paragraphDoc('initial') });
  const payload = paragraphDoc('cycle-stable');
  for (let i = 0; i < 5; i += 1) {
    instance.setContent(payload);
    assert.deepEqual(instance.getContent(), payload, `cycle ${i}: getContent stable`);
  }
});

test('setContent updates the rendered DOM after mount (AC5)', () => {
  const host = createHost();
  const instance = editorModule.createEditor({ initialContent: paragraphDoc('initial-render') });
  const dispose = instance.mount(host);
  instance.setContent(paragraphDoc('updated-render'));
  assert.match(host.textContent ?? '', /updated-render/);
  dispose();
});

test('setContent throws on payloads that are not DocContentV1', () => {
  const instance = editorModule.createEditor({ initialContent: paragraphDoc('x') });
  assert.throws(() => instance.setContent(null as unknown as DocContentV1));
  assert.throws(() => instance.setContent({ version: 2, blocks: [] } as unknown as DocContentV1), /version 2/);
});

// ---------------------------------------------------------------------------
// AC6 — change event
// ---------------------------------------------------------------------------

test('on("change") fires after setContent and receives the new payload (AC6)', () => {
  const instance = editorModule.createEditor({ initialContent: paragraphDoc('x') });
  const received: DocContentV1[] = [];
  instance.on('change', (payload) => {
    received.push(payload as DocContentV1);
  });
  instance.setContent(paragraphDoc('y'));
  assert.equal(received.length, 1);
  assert.deepEqual(received[0], paragraphDoc('y'));
});

test('on("change") disposer unsubscribes the handler (AC6)', () => {
  const instance = editorModule.createEditor({ initialContent: paragraphDoc('x') });
  let count = 0;
  const dispose = instance.on('change', () => {
    count += 1;
  });
  instance.setContent(paragraphDoc('y'));
  assert.equal(count, 1);
  dispose();
  instance.setContent(paragraphDoc('z'));
  assert.equal(count, 1, 'handler must not fire after dispose');
});

test('on("change") supports multiple subscribers; each receives the same event', () => {
  const instance = editorModule.createEditor({ initialContent: paragraphDoc('x') });
  let a = 0;
  let b = 0;
  instance.on('change', () => {
    a += 1;
  });
  instance.on('change', () => {
    b += 1;
  });
  instance.setContent(paragraphDoc('y'));
  assert.equal(a, 1);
  assert.equal(b, 1);
});

// ---------------------------------------------------------------------------
// Story 6.2 review-fix regression tests
// ---------------------------------------------------------------------------

test('regression M3: setContent dispatches `change` EXACTLY ONCE (unmounted)', () => {
  const instance = editorModule.createEditor({ initialContent: paragraphDoc('x') });
  let count = 0;
  instance.on('change', () => {
    count += 1;
  });
  instance.setContent(paragraphDoc('y'));
  assert.equal(count, 1, 'unmounted setContent must dispatch change exactly once (no double-dispatch via editor.onChange)');
});

test('regression M3: setContent dispatches `change` EXACTLY ONCE (mounted)', () => {
  const host = createHost();
  const instance = editorModule.createEditor({ initialContent: paragraphDoc('x') });
  const dispose = instance.mount(host);
  let count = 0;
  instance.on('change', () => {
    count += 1;
  });
  instance.setContent(paragraphDoc('y'));
  assert.equal(count, 1, 'mounted setContent must dispatch change exactly once (M3: no implicit Plate-internal dispatch path)');
  dispose();
});

test('regression 6.4 M3: config.plugins registration is transactional (all-or-nothing)', () => {
  // If config.plugins contains an invalid plugin, NONE of the host plugins
  // should be registered — earlier valid plugins must NOT leak into the
  // global registry on createEditor failure.
  const validHost = {
    blockType: 'paragraph',
    plateElementTypes: ['__host_valid_p__'],
    schemaFragment: { kind: 'host-paragraph' },
    docContentToPlate: () => ({ type: '__host_valid_p__', children: [{ text: '' }] }),
    plateToDocContent: () => ({ type: 'paragraph', children: [{ type: 'text', text: '' }] }),
  };
  const invalidHost = {
    blockType: 'not-canonical', // validator rejects non-canonical types
    plateElementTypes: ['__host_invalid__'],
    schemaFragment: {},
    docContentToPlate: () => ({}),
    plateToDocContent: () => ({}),
  } as unknown as typeof validHost;

  assert.throws(
    () =>
      editorModule.createEditor({
        initialContent: paragraphDoc('x'),
        plugins: [validHost, invalidHost],
      }),
    /EditorPluginValidationError/,
  );
  // After the failed createEditor, NO additional createEditor call should
  // observe `__host_valid_p__` as a registered element type — the
  // transactional validate-then-register flow must have rolled back.
  // We assert this by passing the same valid plugin alone in a follow-up
  // createEditor; if the prior registration leaked, the
  // plate-element-type collision check would throw.
  assert.doesNotThrow(() =>
    editorModule.createEditor({
      initialContent: paragraphDoc('y'),
      plugins: [validHost],
    }),
  );
});

test('regression M4: mount() rolls back state when initial render throws', () => {
  const host = createHost();
  const instance = editorModule.createEditor({ initialContent: paragraphDoc('x') });
  // Trigger a render failure by passing an invalid target — null forces
  // createRoot itself to throw on the first React commit, simulating any
  // post-create render-time exception (e.g. a misconfigured Plate plugin).
  // After the throw, `mount(target)` with a real target must succeed without
  // tripping the "already mounted" guard.
  let firstAttempt: unknown;
  try {
    instance.mount(null as unknown as HTMLElement);
  } catch (error) {
    firstAttempt = error;
  }
  assert.ok(firstAttempt instanceof Error, 'invalid mount() must throw');
  // The runtime must have rolled back state; mounting onto a real host
  // should now succeed without the "already mounted" guard tripping.
  const dispose = instance.mount(host);
  assert.equal(typeof dispose, 'function', 'mount() must succeed after a previous failure (M4: state rolled back)');
  dispose();
});

test('on("change") error from one handler does not block siblings', () => {
  const instance = editorModule.createEditor({ initialContent: paragraphDoc('x') });
  let siblingFired = false;
  instance.on('change', () => {
    throw new Error('handler-a boom');
  });
  instance.on('change', () => {
    siblingFired = true;
  });
  // Silence the console.error from the thrown handler.
  const origError = console.error;
  console.error = () => {};
  try {
    instance.setContent(paragraphDoc('y'));
  } finally {
    console.error = origError;
  }
  assert.equal(siblingFired, true);
});

test('on("selection-change") accepts the subscription but does not fire on setContent (placeholder per Story 6.2)', () => {
  const instance = editorModule.createEditor({ initialContent: paragraphDoc('x') });
  let fired = 0;
  const dispose = instance.on('selection-change', () => {
    fired += 1;
  });
  instance.setContent(paragraphDoc('y'));
  assert.equal(fired, 0, 'selection-change is a Story 6.4 placeholder; must not fire in 6.2');
  dispose();
});

test('on() throws on an unknown event name', () => {
  const instance = editorModule.createEditor({ initialContent: paragraphDoc('x') });
  assert.throws(
    () => instance.on('not-an-event' as unknown as 'change', () => {}),
    /unknown event/i,
  );
});

// ---------------------------------------------------------------------------
// AC7 — triggerAgent still throws
// ---------------------------------------------------------------------------

test('triggerAgent("inline" | "page" | "workspace") throws EditorNotImplementedError (Story 6.2 AC7)', () => {
  const instance = editorModule.createEditor({ initialContent: paragraphDoc('x') });
  for (const scope of ['inline', 'page', 'workspace'] as const) {
    assert.throws(
      () => instance.triggerAgent(scope, {}),
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.equal((err as Error).name, 'EditorNotImplementedError');
        assert.match((err as Error).message, /Story 11/);
        return true;
      },
      `triggerAgent('${scope}', ...) must still throw`,
    );
  }
});

// ---------------------------------------------------------------------------
// AC9 — public surface unchanged (the contract-snapshot test enforces the
// byte-level guarantee; we add a runtime smoke check here too).
// ---------------------------------------------------------------------------

test('module entry exposes exactly the five public symbols (AC9 smoke)', async () => {
  const exports = await import('../src/index.ts');
  assert.deepEqual(
    Object.keys(exports).sort(),
    ['createEditor', 'registerPlugin'].sort(),
    'public surface must remain the 5 contract symbols (2 runtime + 3 types erased)',
  );
});
