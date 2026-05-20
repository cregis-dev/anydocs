import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveActiveTocId } from '../components/docs/toc-active.ts';

test('resolveActiveTocId selects the last heading at the bottom of short pages', () => {
  const active = resolveActiveTocId({
    candidates: [
      { id: 'intro', top: -82 },
      { id: 'step-1', top: -10 },
      { id: 'step-2', top: 121 },
      { id: 'step-3', top: 279 },
      { id: 'step-4', top: 466 },
      { id: 'step-5', top: 625 },
    ],
    scrollY: 570,
    viewportHeight: 927,
    scrollHeight: 1497,
  });

  assert.equal(active, 'step-5');
});

test('resolveActiveTocId selects the latest heading past the top offset', () => {
  const active = resolveActiveTocId({
    candidates: [
      { id: 'intro', top: -40 },
      { id: 'step-1', top: 80 },
      { id: 'step-2', top: 240 },
    ],
    scrollY: 300,
    viewportHeight: 800,
    scrollHeight: 2000,
  });

  assert.equal(active, 'step-1');
});

test('resolveActiveTocId keeps the first heading before any section reaches the top offset', () => {
  const active = resolveActiveTocId({
    candidates: [
      { id: 'intro', top: 360 },
      { id: 'step-1', top: 520 },
    ],
    scrollY: 0,
    viewportHeight: 800,
    scrollHeight: 2000,
  });

  assert.equal(active, 'intro');
});
