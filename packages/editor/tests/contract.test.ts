import test from 'node:test';
import assert from 'node:assert/strict';

import * as editor from '../src/index.ts';
import type { DocContentV1 } from '@anydocs/core';
import type { EditorConfig, EditorPlugin } from '../contract/public-api.ts';

const MINIMAL_CONTENT: DocContentV1 = {
  version: 1,
  blocks: [
    {
      type: 'paragraph',
      children: [{ type: 'text', text: 'hello' }],
    },
  ],
};

const MINIMAL_CONFIG: EditorConfig = {
  initialContent: MINIMAL_CONTENT,
};

const MINIMAL_PLUGIN: EditorPlugin = {
  blockType: 'paragraph',
  schemaFragment: { kind: 'block', name: 'paragraph' },
};

// -----------------------------------------------------------------------------
// Exported keys snapshot (AC2, AC3) — early warning before Story 6.5 CI lands.
// Only runtime values appear at this snapshot layer; type-only exports
// (EditorConfig, EditorInstance, EditorPlugin) are erased at runtime and are
// covered by separate compile-time imports above.
// -----------------------------------------------------------------------------
test('@anydocs/editor exposes exactly the declared runtime symbols', () => {
  const expected = ['createEditor', 'registerPlugin'].sort();
  const actual = Object.keys(editor).sort();

  assert.deepEqual(
    actual,
    expected,
    `Public runtime exports drifted from the contract. Diff: actual=${JSON.stringify(actual)} expected=${JSON.stringify(expected)}`,
  );
});

test('@anydocs/editor runtime exports are typed correctly', () => {
  assert.equal(typeof editor.createEditor, 'function');
  assert.equal(typeof editor.registerPlugin, 'function');
});

// -----------------------------------------------------------------------------
// Placeholder runtime behaviour (AC4) — every EditorInstance method must throw
// an error whose `name` is `EditorNotImplementedError`. The class itself is
// intentionally internal (AC2); consumers branch on `error.name` instead.
// -----------------------------------------------------------------------------
test('createEditor returns an instance whose methods throw EditorNotImplementedError', () => {
  const instance = editor.createEditor(MINIMAL_CONFIG);

  assert.equal(typeof instance.mount, 'function');
  assert.equal(typeof instance.getContent, 'function');
  assert.equal(typeof instance.setContent, 'function');
  assert.equal(typeof instance.on, 'function');
  assert.equal(typeof instance.triggerAgent, 'function');

  const fakeElement = {} as HTMLElement;

  const cases: Array<{ label: string; call: () => unknown }> = [
    { label: 'mount', call: () => instance.mount(fakeElement) },
    { label: 'getContent', call: () => instance.getContent() },
    { label: 'setContent', call: () => instance.setContent(MINIMAL_CONTENT) },
    { label: 'on', call: () => instance.on('change', () => {}) },
    { label: 'triggerAgent', call: () => instance.triggerAgent('inline', {}) },
  ];

  for (const { label, call } of cases) {
    assert.throws(
      call,
      (err: unknown) => {
        assert.ok(err instanceof Error, `${label} did not throw an Error instance`);
        assert.equal(
          (err as Error).name,
          'EditorNotImplementedError',
          `${label} threw with unexpected error.name`,
        );
        assert.ok(
          (err as Error).message.length > 0,
          `${label} threw with an empty message`,
        );
        return true;
      },
      `${label} did not throw`,
    );
  }
});

// -----------------------------------------------------------------------------
// registerPlugin lightweight validation (AC4) — accepts a valid shape, rejects
// inputs missing the two required fields. Story 6.4 tightens this validation.
// -----------------------------------------------------------------------------
test('registerPlugin accepts a plugin matching the contract shape', () => {
  assert.doesNotThrow(() => editor.registerPlugin(MINIMAL_PLUGIN));
});

test('registerPlugin rejects a plugin missing the blockType field', () => {
  const invalid = { schemaFragment: {} } as unknown as EditorPlugin;
  assert.throws(
    () => editor.registerPlugin(invalid),
    (err: unknown) => {
      assert.ok(err instanceof Error);
      assert.equal((err as Error).name, 'EditorNotImplementedError');
      assert.match((err as Error).message, /blockType/);
      return true;
    },
  );
});

test('registerPlugin rejects a plugin missing the schemaFragment field', () => {
  const invalid = { blockType: 'paragraph' } as unknown as EditorPlugin;
  assert.throws(
    () => editor.registerPlugin(invalid),
    (err: unknown) => {
      assert.ok(err instanceof Error);
      assert.equal((err as Error).name, 'EditorNotImplementedError');
      assert.match((err as Error).message, /schemaFragment/);
      return true;
    },
  );
});

test('registerPlugin rejects non-object inputs', () => {
  assert.throws(
    () => editor.registerPlugin(null as unknown as EditorPlugin),
    (err: unknown) => {
      assert.ok(err instanceof Error);
      assert.equal((err as Error).name, 'EditorNotImplementedError');
      return true;
    },
  );
  assert.throws(
    () => editor.registerPlugin('paragraph' as unknown as EditorPlugin),
    (err: unknown) => {
      assert.ok(err instanceof Error);
      assert.equal((err as Error).name, 'EditorNotImplementedError');
      return true;
    },
  );
});
