// =============================================================================
// RuntimeModeIndicator — Story 8.3 smoke test.
//
// AC: the status-bar indicator's text matches the resolved runtime mode for
// 100% of supported environments, conveys meaning via text (not colour alone),
// and is keyboard-reachable. Runs under Node's built-in test runner with jsdom,
// mirroring lib/editor-host/editor-host.test.ts.
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';

import { JSDOM } from 'jsdom';

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
    // Accessor-only props on Node — skip.
  }
}

import type { RuntimeMode } from '@anydocs/core';
import type { StudioMode } from './studio-boot.ts';

const React = await import('react');
const ReactDOMClient = await import('react-dom/client');
const ReactDOM = await import('react-dom');
const { RuntimeModeIndicator, bootModeToRuntimeMode } = await import('./runtime-mode-indicator.ts');

function render(mode: RuntimeMode): { host: HTMLDivElement; unmount: () => void } {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = ReactDOMClient.createRoot(host);
  ReactDOM.flushSync(() => {
    root.render(React.createElement(RuntimeModeIndicator, { mode }));
  });
  return {
    host,
    unmount: () => {
      ReactDOM.flushSync(() => root.unmount());
      host.remove();
    },
  };
}

test('bootModeToRuntimeMode maps boot mode to the canonical runtime mode', () => {
  const cases: Array<[StudioMode, RuntimeMode]> = [
    ['cli', 'web'],
    ['desktop', 'desktop'],
  ];
  for (const [boot, expected] of cases) {
    assert.equal(bootModeToRuntimeMode(boot), expected, `${boot} -> ${expected}`);
  }
});

test('indicator renders the mode as visible text for every runtime mode', () => {
  for (const mode of ['web', 'desktop'] as const) {
    const { host, unmount } = render(mode);
    const el = host.querySelector('[data-testid="studio-runtime-mode"]');
    assert.ok(el, `indicator must render for mode "${mode}"`);
    // Meaning is carried by text, not colour alone.
    assert.equal(el?.textContent?.trim(), mode, `visible label must equal "${mode}"`);
    assert.equal(el?.getAttribute('data-runtime-mode'), mode);
    unmount();
  }
});

test('indicator is keyboard-reachable and has an accessible name', () => {
  const { host, unmount } = render('desktop');
  const el = host.querySelector('[data-testid="studio-runtime-mode"]') as HTMLElement | null;
  assert.ok(el);
  assert.equal(el?.getAttribute('tabindex'), '0', 'must be focusable for keyboard users');
  assert.equal(el?.getAttribute('role'), 'status');
  assert.equal(el?.getAttribute('aria-label'), 'Runtime mode: desktop');
  // The coloured dot is decorative and must not be the sole carrier of meaning.
  const dot = el?.querySelector('[aria-hidden="true"]');
  assert.ok(dot, 'decorative dot present');
  unmount();
});
