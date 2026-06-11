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

// ---------------------------------------------------------------------------
// User-input change dispatch — the Studio editing fix.
//
// Story 6.2 scoped `change` delivery to host-triggered `setContent` calls and
// deferred user-input wiring to "Story 6.4 plugin handlers" — which never
// landed, so Studio's EditorHost received no events when the user typed and
// edits were silently lost on save. The runtime now passes the <Plate>
// component's controlled `onValueChange` callback through to the change bus,
// deduped by serialized content so host `setContent` still dispatches exactly
// once (the M3 regression tests above stay green).
//
// We simulate "user input" by applying a raw Slate operation through the
// editor's real op pipeline via the test-only `getRawPlateEditorForTesting`
// accessor — slate-react then routes editor.onChange → <Slate onValueChange>
// in a microtask, exactly like a keystroke in the browser.
// ---------------------------------------------------------------------------

const { getRawPlateEditorForTesting } = await import('../src/runtime/plate-runtime.ts');

type RawSlateEditor = {
  apply: (op: { type: string; path: number[]; offset: number; text: string }) => void;
};

function flushSlateOnChange(): Promise<void> {
  // Slate defers editor.onChange to a microtask after `apply`; a macrotask
  // tick guarantees it (and Plate's store sync) has run.
  return new Promise((resolve) => setTimeout(resolve, 0));
}

test('user-input op dispatches `change` with the updated payload (mounted)', async () => {
  const host = createHost();
  const instance = editorModule.createEditor({ initialContent: paragraphDoc('hello') });
  const dispose = instance.mount(host);

  const events: DocContentV1[] = [];
  instance.on('change', (payload) => {
    events.push(payload as DocContentV1);
  });

  const raw = getRawPlateEditorForTesting(instance) as RawSlateEditor;
  assert.ok(raw, 'test accessor must resolve the raw Plate editor');
  raw.apply({ type: 'insert_text', path: [0, 0], offset: 5, text: ' world' });
  await flushSlateOnChange();

  assert.equal(events.length, 1, 'user-input op must dispatch change exactly once');
  const block = events[0]?.blocks[0];
  assert.equal(block?.type, 'paragraph');
  assert.deepEqual(
    (block as { children?: Array<{ text?: string }> }).children?.[0]?.text,
    'hello world',
    'change payload must carry the post-edit content',
  );

  dispose();
});

test('setContent still dispatches exactly once after user-input wiring (M3 stays green, async-safe)', async () => {
  const host = createHost();
  const instance = editorModule.createEditor({ initialContent: paragraphDoc('start') });
  const dispose = instance.mount(host);

  let count = 0;
  instance.on('change', () => {
    count += 1;
  });

  instance.setContent(paragraphDoc('replaced'));
  // Wait past Slate's deferred onChange microtask: if tf.setValue routes
  // through Plate's onValueChange, the content dedupe must swallow it.
  await flushSlateOnChange();

  assert.equal(count, 1, 'setContent must dispatch exactly once even after the async Plate onValueChange settles');

  dispose();
});

test('mount-time normalization does not surface a spurious change event', async () => {
  const host = createHost();
  const instance = editorModule.createEditor({ initialContent: paragraphDoc('stable') });

  let count = 0;
  instance.on('change', () => {
    count += 1;
  });

  const dispose = instance.mount(host);
  await flushSlateOnChange();

  assert.equal(count, 0, 'mounting must not dispatch change (lastNotifiedJson seeded from initial content)');

  dispose();
});

test('user-input change events keep flowing after a host setContent remount', async () => {
  const host = createHost();
  const instance = editorModule.createEditor({ initialContent: paragraphDoc('one') });
  const dispose = instance.mount(host);

  const events: DocContentV1[] = [];
  instance.on('change', (payload) => {
    events.push(payload as DocContentV1);
  });

  instance.setContent(paragraphDoc('two'));
  await flushSlateOnChange();
  assert.equal(events.length, 1, 'setContent dispatched once');

  const raw = getRawPlateEditorForTesting(instance) as RawSlateEditor;
  raw.apply({ type: 'insert_text', path: [0, 0], offset: 3, text: '!' });
  await flushSlateOnChange();

  assert.equal(events.length, 2, 'user input after remount must still dispatch');
  const block = events[1]?.blocks[0] as { children?: Array<{ text?: string }> };
  assert.equal(block.children?.[0]?.text, 'two!');

  dispose();
});

// ---------------------------------------------------------------------------
// Inline link rendering — pages containing `link` inlines crashed the whole
// editor before the InlineLinkPlugin landed: with no Plate plugin for the
// `a` element type, Slate treated links as unknown BLOCK elements, rendered
// a <div> inside the parent <p> (invalid nesting → hydration error) and threw
// "Objects are not valid as a React child". Found via the e2e editor-typing
// spec against the staged Studio runtime's `editor-regression` fixture page.
// ---------------------------------------------------------------------------

test('mounting a doc with an inline link renders an <a> inside the paragraph (no crash)', () => {
  const doc: DocContentV1 = {
    version: 1,
    blocks: [
      {
        type: 'paragraph',
        children: [
          { type: 'text', text: 'Open the ' },
          {
            type: 'link',
            href: '/studio',
            title: 'Studio',
            children: [{ type: 'text', text: 'Studio route' }],
          },
          { type: 'text', text: ' now.' },
        ],
      },
    ],
  };

  const host = createHost();
  const instance = editorModule.createEditor({ initialContent: doc });
  const dispose = instance.mount(host);

  const anchor = host.querySelector('p a');
  assert.ok(anchor, 'link must render as an <a> nested inside the <p>, not a block <div>');
  assert.match(anchor?.textContent ?? '', /Studio route/);
  assert.equal(anchor?.getAttribute('href'), '/studio');

  // Round-trip stays lossless with the runtime plugin present.
  const roundTripped = instance.getContent();
  assert.deepEqual(roundTripped, doc);

  dispose();
});

// ---------------------------------------------------------------------------
// Kitchen-sink mount — mirrors the e2e `editor-regression` fixture page (all
// 11 DocContentV1 block types + inline link + captioned image). Two runtime
// crashes shipped because nothing mounted a full-coverage doc in jsdom:
//   1. link inlines rendered as unknown BLOCK elements (no Plate plugin) and
//      crashed the tree — fixed by InlineLinkPlugin;
//   2. `image.caption` (an inline-node array) was rendered directly as a
//      React child by ImageElement → "Objects are not valid as a React
//      child" — fixed by flattening to plain text.
// ---------------------------------------------------------------------------

test('mounting a doc covering ALL block types (incl. link + captioned image) does not crash', () => {
  const kitchenSink: DocContentV1 = {
    version: 1,
    blocks: [
      { type: 'heading', id: 'ks-h1', level: 1, children: [{ type: 'text', text: 'Kitchen Sink' }] },
      {
        type: 'paragraph',
        id: 'ks-p',
        children: [
          { type: 'text', text: 'Open the ' },
          { type: 'link', href: '/studio', title: 'Studio', children: [{ type: 'text', text: 'Studio route' }] },
          { type: 'text', text: ' now.' },
        ],
      },
      {
        type: 'list',
        id: 'ks-todo',
        style: 'todo',
        items: [{ id: 'ks-todo-1', checked: false, children: [{ type: 'text', text: 'Todo item' }] }],
      },
      { type: 'blockquote', id: 'ks-quote', children: [{ type: 'text', text: 'Quote' }] },
      { type: 'codeBlock', id: 'ks-code', language: 'bash', title: 'CLI', code: 'pnpm test' },
      {
        type: 'codeGroup',
        id: 'ks-code-group',
        items: [{ id: 'ks-cg-1', title: 'CLI', language: 'bash', code: 'pnpm build' }],
      },
      {
        type: 'image',
        id: 'ks-img',
        src: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg"/>',
        alt: 'img',
        caption: [{ type: 'text', text: 'Inline asset caption' }],
      },
      {
        type: 'table',
        id: 'ks-table',
        rows: [
          {
            id: 'ks-row-1',
            cells: [{ id: 'ks-cell-1', header: true, children: [{ type: 'text', text: 'Name' }] }],
          },
        ],
      },
      { type: 'callout', id: 'ks-callout', tone: 'warning', title: 'Warning', children: [{ type: 'text', text: 'Callout' }] },
      { type: 'divider', id: 'ks-divider' },
      { type: 'mermaid', id: 'ks-mermaid', title: 'Diagram', code: 'flowchart TD\n  A --> B' },
    ],
  };

  const host = createHost();
  const instance = editorModule.createEditor({ initialContent: kitchenSink });
  const dispose = instance.mount(host);

  // The whole doc must render — a single bad component crashes the entire
  // Plate tree, so presence of the LAST block's content proves full mount.
  assert.match(host.textContent ?? '', /Kitchen Sink/);
  assert.match(host.textContent ?? '', /flowchart TD/);
  // Captioned image renders the caption as plain text, not a crashed tree.
  const figcaption = host.querySelector('figcaption');
  assert.ok(figcaption, 'captioned image must render a figcaption');
  assert.match(figcaption?.textContent ?? '', /Inline asset caption/);
  // Inline link is a real <a> inside the paragraph.
  assert.ok(host.querySelector('p a'), 'link renders inline inside the paragraph');
  // Semantic structure — components apply only when each element type has a
  // Plate plugin; default fallback would render generic <div>s instead.
  assert.ok(host.querySelector('ul li'), 'todo list renders as <ul><li>');
  assert.ok(host.querySelector('table th'), 'table renders with a real <th> header cell');
  assert.ok(host.querySelector('table > tbody > tr'), 'table rows nest inside a <tbody> (hydration-safe DOM)');
  assert.ok(host.querySelector('blockquote'), 'blockquote renders as <blockquote>');
  assert.ok(host.querySelector('pre'), 'code block renders as <pre>');
  assert.ok(host.querySelector('hr'), 'divider renders an <hr>');

  // Round-trip stays non-lossy across the full block set.
  assert.deepEqual(instance.getContent(), kitchenSink);

  dispose();
});

// ---------------------------------------------------------------------------
// Slash command menu — item catalogue + apply transform.
//
// Keyboard interaction (capture-phase listener, caret positioning, portal
// dropdown) is exercised in the browser; these tests pin down the pure
// pieces: filtering, and — critically — that EVERY item's `createNode()`
// output survives `editor.tf.insertNodes` + plateToDocContent round-trip.
// A drifting node shape here would crash the editor or corrupt saves.
// ---------------------------------------------------------------------------

const { SLASH_MENU_ITEMS, filterSlashItems, applySlashItem } = await import('../src/runtime/slash-menu.ts');

test('filterSlashItems: empty query returns the full catalogue, queries narrow it', () => {
  assert.equal(filterSlashItems('').length, SLASH_MENU_ITEMS.length);
  const headings = filterSlashItems('heading');
  assert.deepEqual(headings.map((i) => i.key), ['h1', 'h2', 'h3']);
  assert.deepEqual(filterSlashItems('mermaid').map((i) => i.key), ['mermaid']);
  assert.deepEqual(filterSlashItems('表格').map((i) => i.key), ['table']);
  assert.equal(filterSlashItems('zzz-no-such-block').length, 0);
});

test('every slash menu item replaces the trigger block with a valid, round-trippable node', () => {
  for (const item of SLASH_MENU_ITEMS) {
    const instance = editorModule.createEditor({
      initialContent: {
        version: 1,
        blocks: [
          { type: 'paragraph', children: [{ type: 'text', text: '/query' }] },
          { type: 'paragraph', children: [{ type: 'text', text: 'untouched' }] },
        ],
      },
    });
    const raw = getRawPlateEditorForTesting(instance);
    applySlashItem(raw, 0, item);

    const content = instance.getContent();
    assert.equal(content.version, 1, `${item.key}: content stays DocContentV1`);
    assert.equal(content.blocks.length, 2, `${item.key}: block count preserved`);
    assert.notEqual(content.blocks[0]?.type, 'paragraph', `${item.key}: trigger paragraph replaced`);
    const second = content.blocks[1] as { children?: Array<{ text?: string }> };
    assert.equal(second.children?.[0]?.text, 'untouched', `${item.key}: sibling block untouched`);
  }
});

test('applySlashItem(table) produces a structurally valid table block', () => {
  const instance = editorModule.createEditor({
    initialContent: {
      version: 1,
      blocks: [{ type: 'paragraph', children: [{ type: 'text', text: '/ta' }] }],
    },
  });
  const tableItem = SLASH_MENU_ITEMS.find((i) => i.key === 'table');
  assert.ok(tableItem);
  applySlashItem(getRawPlateEditorForTesting(instance), 0, tableItem);
  const block = instance.getContent().blocks[0] as {
    type: string;
    rows: Array<{ cells: Array<{ header?: boolean }> }>;
  };
  assert.equal(block.type, 'table');
  assert.equal(block.rows.length, 2);
  assert.equal(block.rows[0]?.cells.length, 2);
  assert.equal(block.rows[0]?.cells[0]?.header, true, 'first row cells are header cells');
});

test('code block with code_line children (post-edit Plate shape) round-trips as newline-joined code', () => {
  // `@udecode/plate-code-block`'s Enter-key override produces `code_line`
  // element children. The converter must read both the canonical raw-text
  // shape and this post-edit shape — losing it silently wipes the user's
  // code on save.
  const instance = editorModule.createEditor({
    initialContent: { version: 1, blocks: [{ type: 'paragraph', children: [{ type: 'text', text: 'x' }] }] },
  });
  const raw = getRawPlateEditorForTesting(instance) as {
    tf: { removeNodes: (o: { at: number[] }) => void; insertNodes: (n: unknown, o: { at: number[] }) => void };
  };
  raw.tf.removeNodes({ at: [0] });
  raw.tf.insertNodes(
    {
      type: 'code_block',
      lang: 'bash',
      children: [
        { type: 'code_line', children: [{ text: 'pnpm install' }] },
        { type: 'code_line', children: [{ text: 'pnpm test' }] },
      ],
    },
    { at: [0] },
  );
  const block = instance.getContent().blocks[0] as { type: string; code?: string; language?: string };
  assert.equal(block.type, 'codeBlock');
  assert.equal(block.code, 'pnpm install\npnpm test');
  assert.equal(block.language, 'bash');
});

// ---------------------------------------------------------------------------
// Slash menu — keyboard interaction (jsdom). Synthetic keydown events through
// the capture-phase listener; the portal renders into document.body.
// ---------------------------------------------------------------------------

function dispatchKey(target: Element, key: string): void {
  target.dispatchEvent(
    new (globalThis as unknown as { KeyboardEvent: typeof KeyboardEvent }).KeyboardEvent('keydown', {
      key,
      bubbles: true,
      cancelable: true,
    }),
  );
}

function tick(ms = 30): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test('slash menu: "/" on an empty paragraph opens the menu; Escape closes it', async () => {
  const host = createHost();
  document.body.appendChild(host);
  const instance = editorModule.createEditor({
    initialContent: { version: 1, blocks: [{ type: 'paragraph', children: [{ type: 'text', text: '' }] }] },
  });
  const dispose = instance.mount(host);
  const raw = getRawPlateEditorForTesting(instance) as {
    tf: { select: (at: unknown) => void };
    api: { start: (at: number[]) => unknown };
  };
  raw.tf.select(raw.api.start([0]));

  const editable = host.querySelector('[contenteditable="true"]');
  assert.ok(editable, 'editable present');

  dispatchKey(editable, '/');
  await tick();
  const menu = document.body.querySelector('[data-anydocs-slash-menu]');
  assert.ok(menu, 'menu opens on slash');
  assert.equal(
    menu?.querySelectorAll('[data-slash-index]').length,
    SLASH_MENU_ITEMS.length,
    'empty query lists the full catalogue',
  );

  dispatchKey(editable, 'Escape');
  await tick();
  assert.equal(
    document.body.querySelector('[data-anydocs-slash-menu]'),
    null,
    'Escape closes the menu',
  );

  dispose();
  host.remove();
});

test('slash menu: Enter applies the highlighted item and replaces the block', async () => {
  const host = createHost();
  document.body.appendChild(host);
  const instance = editorModule.createEditor({
    initialContent: { version: 1, blocks: [{ type: 'paragraph', children: [{ type: 'text', text: '' }] }] },
  });
  const dispose = instance.mount(host);
  const raw = getRawPlateEditorForTesting(instance) as {
    tf: { select: (at: unknown) => void };
    api: { start: (at: number[]) => unknown };
  };
  raw.tf.select(raw.api.start([0]));

  const editable = host.querySelector('[contenteditable="true"]')!;
  dispatchKey(editable, '/');
  await tick();
  assert.ok(document.body.querySelector('[data-anydocs-slash-menu]'), 'menu open');

  // ArrowDown once → highlight moves to the second item (Heading 2).
  dispatchKey(editable, 'ArrowDown');
  await tick();
  dispatchKey(editable, 'Enter');
  await tick();

  assert.equal(document.body.querySelector('[data-anydocs-slash-menu]'), null, 'menu closed after apply');
  const block = instance.getContent().blocks[0] as { type: string; level?: number };
  assert.equal(block.type, 'heading');
  assert.equal(block.level, 2, 'ArrowDown+Enter applied the second item (Heading 2)');

  dispose();
  host.remove();
});

// ---------------------------------------------------------------------------
// Block handle — pure transforms (move / delete / turn-into). The hover/menu
// UI is exercised in the browser; these tests pin the editor mutations and
// the round-trip validity of every conversion target.
// ---------------------------------------------------------------------------

const { moveBlock, deleteBlock, turnBlockInto, TURN_INTO_ITEMS } = await import('../src/runtime/block-handle.ts');

function twoBlockDoc(): DocContentV1 {
  return {
    version: 1,
    blocks: [
      { type: 'paragraph', children: [{ type: 'text', text: 'first' }] },
      { type: 'paragraph', children: [{ type: 'text', text: 'second' }] },
    ],
  };
}

test('moveBlock swaps adjacent top-level blocks in both directions', () => {
  const instance = editorModule.createEditor({ initialContent: twoBlockDoc() });
  const raw = getRawPlateEditorForTesting(instance);

  moveBlock(raw, 0, 1);
  let texts = instance.getContent().blocks.map(
    (b) => ((b as { children?: Array<{ text?: string }> }).children?.[0]?.text),
  );
  assert.deepEqual(texts, ['second', 'first'], 'move down swaps');

  moveBlock(raw, 1, 0);
  texts = instance.getContent().blocks.map(
    (b) => ((b as { children?: Array<{ text?: string }> }).children?.[0]?.text),
  );
  assert.deepEqual(texts, ['first', 'second'], 'move up swaps back');

  // Out-of-range moves are no-ops.
  moveBlock(raw, 0, -1);
  moveBlock(raw, 1, 2);
  assert.equal(instance.getContent().blocks.length, 2);
});

test('deleteBlock removes the block; deleting the last block leaves one empty paragraph', () => {
  const instance = editorModule.createEditor({ initialContent: twoBlockDoc() });
  const raw = getRawPlateEditorForTesting(instance);

  deleteBlock(raw, 0);
  let blocks = instance.getContent().blocks;
  assert.equal(blocks.length, 1);
  assert.equal((blocks[0] as { children?: Array<{ text?: string }> }).children?.[0]?.text, 'second');

  deleteBlock(raw, 0);
  blocks = instance.getContent().blocks;
  assert.equal(blocks.length, 1, 'document never goes empty');
  assert.equal(blocks[0]?.type, 'paragraph');
  assert.equal((blocks[0] as { children?: Array<{ text?: string }> }).children?.[0]?.text, '');
});

test('every turn-into target converts a paragraph and round-trips as valid DocContentV1', () => {
  for (const item of TURN_INTO_ITEMS) {
    const instance = editorModule.createEditor({
      initialContent: {
        version: 1,
        blocks: [
          { type: 'paragraph', children: [{ type: 'text', text: 'convert me' }] },
          { type: 'paragraph', children: [{ type: 'text', text: 'sibling' }] },
        ],
      },
    });
    const raw = getRawPlateEditorForTesting(instance);
    turnBlockInto(raw, 0, item);

    const content = instance.getContent();
    assert.equal(content.blocks.length, 2, `${item.key}: block count preserved`);
    const converted = content.blocks[0]!;
    const blob = JSON.stringify(converted);
    assert.ok(blob.includes('convert me'), `${item.key}: inline text carried over (got ${blob.slice(0, 120)})`);
    const sibling = content.blocks[1] as { children?: Array<{ text?: string }> };
    assert.equal(sibling.children?.[0]?.text, 'sibling', `${item.key}: sibling untouched`);
  }
});

test('turn-into from a structural block flattens to plain text (list → heading)', () => {
  const instance = editorModule.createEditor({
    initialContent: {
      version: 1,
      blocks: [
        {
          type: 'list',
          style: 'bulleted',
          items: [{ children: [{ type: 'text', text: 'item one' }] }],
        },
      ],
    },
  });
  const raw = getRawPlateEditorForTesting(instance);
  const h2 = TURN_INTO_ITEMS.find((i) => i.key === 'h2')!;
  turnBlockInto(raw, 0, h2);
  const block = instance.getContent().blocks[0] as {
    type: string;
    level?: number;
    children?: Array<{ text?: string }>;
  };
  assert.equal(block.type, 'heading');
  assert.equal(block.level, 2);
  assert.equal(block.children?.[0]?.text, 'item one');
});

test('turn-into preserves marks and links for text-container sources', () => {
  const instance = editorModule.createEditor({
    initialContent: {
      version: 1,
      blocks: [
        {
          type: 'paragraph',
          children: [
            { type: 'text', text: 'bold', marks: ['bold'] },
            { type: 'link', href: '/x', children: [{ type: 'text', text: 'lnk' }] },
          ],
        },
      ],
    },
  });
  const raw = getRawPlateEditorForTesting(instance);
  const quote = TURN_INTO_ITEMS.find((i) => i.key === 'blockquote')!;
  turnBlockInto(raw, 0, quote);
  const block = instance.getContent().blocks[0] as {
    type: string;
    children: Array<{ type?: string; text?: string; marks?: string[]; href?: string }>;
  };
  assert.equal(block.type, 'blockquote');
  assert.deepEqual(block.children[0]?.marks, ['bold'], 'bold mark carried');
  assert.equal(block.children[1]?.type, 'link', 'link inline carried');
  assert.equal(block.children[1]?.href, '/x');
});

test('slash menu: "/" triggers from an empty heading block too (post-Enter-on-heading state)', async () => {
  const host = createHost();
  document.body.appendChild(host);
  const instance = editorModule.createEditor({
    initialContent: { version: 1, blocks: [{ type: 'heading', level: 2, children: [{ type: 'text', text: '' }] }] },
  });
  const dispose = instance.mount(host);
  const raw = getRawPlateEditorForTesting(instance) as {
    tf: { select: (at: unknown) => void };
    api: { start: (at: number[]) => unknown };
  };
  raw.tf.select(raw.api.start([0]));

  const editable = host.querySelector('[contenteditable="true"]')!;
  dispatchKey(editable, '/');
  await tick();
  assert.ok(
    document.body.querySelector('[data-anydocs-slash-menu]'),
    'menu opens from an empty heading',
  );
  dispatchKey(editable, 'Escape');
  await tick();
  dispose();
  host.remove();
});

test('Enter at the end of a heading resets the new block to a paragraph (exit break)', () => {
  const instance = editorModule.createEditor({
    initialContent: { version: 1, blocks: [{ type: 'heading', level: 2, children: [{ type: 'text', text: 'Title' }] }] },
  });
  const raw = getRawPlateEditorForTesting(instance) as {
    tf: { select: (at: unknown) => void; insertBreak: () => void };
    api: { end: (at: number[]) => unknown };
  };
  raw.tf.select(raw.api.end([0]));
  raw.tf.insertBreak();

  const blocks = instance.getContent().blocks;
  assert.equal(blocks.length, 2);
  assert.equal(blocks[0]?.type, 'heading', 'original heading intact');
  assert.equal(blocks[1]?.type, 'paragraph', 'new block resets to paragraph');
});

test('Enter in the MIDDLE of a heading keeps the tail as a heading (no reset)', () => {
  const instance = editorModule.createEditor({
    initialContent: { version: 1, blocks: [{ type: 'heading', level: 2, children: [{ type: 'text', text: 'AB' }] }] },
  });
  const raw = getRawPlateEditorForTesting(instance) as {
    tf: { select: (at: unknown) => void; insertBreak: () => void };
  };
  raw.tf.select({ anchor: { path: [0, 0], offset: 1 }, focus: { path: [0, 0], offset: 1 } });
  raw.tf.insertBreak();

  const blocks = instance.getContent().blocks;
  assert.equal(blocks.length, 2);
  assert.equal(blocks[0]?.type, 'heading');
  assert.equal(blocks[1]?.type, 'heading', 'split heading keeps its type when tail text moved down');
  const tail = blocks[1] as { children?: Array<{ text?: string }> };
  assert.equal(tail.children?.[0]?.text, 'B');
});

// ---------------------------------------------------------------------------
// Block handle — hover lifecycle (jsdom). Regression for "the grip vanished
// the instant the pointer moved toward it" — the grip is portaled to <body>
// (outside the container's DOM subtree), so moving onto it fires the
// container's `mouseleave`; without a relatedTarget guard that cleared the
// handle before the user could ever click it.
// ---------------------------------------------------------------------------

function dispatchMouse(target: Element, type: string, relatedTarget: EventTarget | null = null): void {
  target.dispatchEvent(
    new (globalThis as unknown as { MouseEvent: typeof MouseEvent }).MouseEvent(type, {
      bubbles: type !== 'mouseleave',
      cancelable: true,
      relatedTarget,
    }),
  );
}

test('block handle: grip survives the pointer moving toward it, clears on full leave', async () => {
  const host = createHost();
  document.body.appendChild(host);
  const instance = editorModule.createEditor({
    initialContent: {
      version: 1,
      blocks: [
        { type: 'paragraph', children: [{ type: 'text', text: 'one' }] },
        { type: 'paragraph', children: [{ type: 'text', text: 'two' }] },
      ],
    },
  });
  const dispose = instance.mount(host);
  await tick();

  const editable = host.querySelector('[data-slate-editor="true"]');
  assert.ok(editable, 'editable present');
  const block = editable!.querySelector('[data-slate-node="element"]')!;

  // Hover a block → grip appears.
  dispatchMouse(block, 'mousemove');
  await tick();
  const grip = document.body.querySelector('[data-anydocs-block-grip]');
  assert.ok(grip, 'grip appears on hover');

  const anchor = document.body.querySelector('[data-anydocs-block-anchor]')!;
  const container = anchor.parentElement!;

  // Pointer heads toward the grip (relatedTarget = grip) → handle must persist.
  dispatchMouse(container, 'mouseleave', grip);
  await tick();
  assert.ok(
    document.body.querySelector('[data-anydocs-block-grip]'),
    'grip must survive the pointer moving toward it (the reported bug)',
  );

  // Pointer leaves the editor entirely → handle clears.
  dispatchMouse(container, 'mouseleave', document.body);
  await tick();
  assert.equal(
    document.body.querySelector('[data-anydocs-block-grip]'),
    null,
    'grip clears when the pointer leaves the editor for unrelated space',
  );

  dispose();
  host.remove();
});
