import test from 'node:test';
import assert from 'node:assert/strict';

import * as editor from '../src/index.ts';
import type { DocContentV1 } from '@anydocs/core';
import type { EditorConfig, EditorPlugin } from '../contract/public-api.ts';
import { registerBuiltinPluginsOnce } from '../src/plugins/builtin/index.ts';

// Pre-register builtins so the duplicate-blockType test (Story 6.4 AC11) has
// a populated registry to collide against. Without this, the test would
// require an arbitrary first registration call inside its body.
registerBuiltinPluginsOnce();

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
// Story 6.2 runtime behaviour — `mount` / `getContent` / `setContent` / `on`
// now do real work (mount/lifecycle is exercised by `plate-runtime.test.ts`
// under a jsdom DOM). `triggerAgent` continues to throw `EditorNotImplementedError`
// per Story 6.2 AC7 — Agent runtime lands in Story 11.x.
//
// This test ONLY asserts the contract surface (methods exist, return shapes
// are correct types) and the still-throws semantic of `triggerAgent`. The
// DOM-side mount-lifecycle assertions live in `plate-runtime.test.ts`.
// -----------------------------------------------------------------------------
test('createEditor returns an instance whose methods are real functions (Story 6.2)', () => {
  const instance = editor.createEditor(MINIMAL_CONFIG);

  assert.equal(typeof instance.mount, 'function');
  assert.equal(typeof instance.getContent, 'function');
  assert.equal(typeof instance.setContent, 'function');
  assert.equal(typeof instance.on, 'function');
  assert.equal(typeof instance.triggerAgent, 'function');
});

test('getContent returns the canonical DocContentV1 payload after construction (Story 6.2)', () => {
  const instance = editor.createEditor(MINIMAL_CONFIG);
  const content = instance.getContent();
  assert.equal(content.version, 1);
  assert.ok(Array.isArray(content.blocks));
  assert.ok(content.blocks.length >= 1, 'editor must surface at least one block');
});

test('on() returns a disposer (Story 6.2)', () => {
  const instance = editor.createEditor(MINIMAL_CONFIG);
  const disposer = instance.on('change', () => {});
  assert.equal(typeof disposer, 'function');
  assert.doesNotThrow(disposer);
});

test('triggerAgent continues to throw EditorNotImplementedError (Story 6.2 AC7)', () => {
  const instance = editor.createEditor(MINIMAL_CONFIG);
  assert.throws(
    () => instance.triggerAgent('inline', {}),
    (err: unknown) => {
      assert.ok(err instanceof Error);
      assert.equal((err as Error).name, 'EditorNotImplementedError');
      assert.match((err as Error).message, /Story 11/);
      return true;
    },
    'triggerAgent must continue to throw until Story 11.x lands',
  );
});

// -----------------------------------------------------------------------------
// registerPlugin validation (Story 6.4 strict mode) — every validation error
// now throws `EditorPluginValidationError` (was `EditorNotImplementedError`
// in Story 6.1 — closed by Story 6.4 follow-up).
// -----------------------------------------------------------------------------
test('registerPlugin rejects a plugin missing the blockType field', () => {
  const invalid = { schemaFragment: {} } as unknown as EditorPlugin;
  assert.throws(
    () => editor.registerPlugin(invalid),
    (err: unknown) => {
      assert.ok(err instanceof Error);
      assert.equal((err as Error).name, 'EditorPluginValidationError');
      assert.match((err as Error).message, /blockType/);
      return true;
    },
  );
});

test('registerPlugin rejects a plugin missing the schemaFragment field', () => {
  const invalid = {
    blockType: 'paragraph',
    plateElementTypes: ['p'],
  } as unknown as EditorPlugin;
  assert.throws(
    () => editor.registerPlugin(invalid),
    (err: unknown) => {
      assert.ok(err instanceof Error);
      assert.equal((err as Error).name, 'EditorPluginValidationError');
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
      assert.equal((err as Error).name, 'EditorPluginValidationError');
      return true;
    },
  );
  assert.throws(
    () => editor.registerPlugin('paragraph' as unknown as EditorPlugin),
    (err: unknown) => {
      assert.ok(err instanceof Error);
      assert.equal((err as Error).name, 'EditorPluginValidationError');
      return true;
    },
  );
});

// Story 6.4 AC11 new tests — canonical-blockType validation + duplicate detection.

test('registerPlugin rejects a plugin whose blockType is not canonical', () => {
  const invalid = {
    blockType: 'forged-block-type',
    plateElementTypes: ['forged'],
    schemaFragment: {},
    docContentToPlate: () => ({}),
    plateToDocContent: () => ({}),
  } as unknown as EditorPlugin;
  assert.throws(
    () => editor.registerPlugin(invalid),
    (err: unknown) => {
      assert.ok(err instanceof Error);
      assert.equal((err as Error).name, 'EditorPluginValidationError');
      assert.match((err as Error).message, /not a canonical DocContentV1 block type/);
      assert.match((err as Error).message, /forged-block-type/);
      return true;
    },
  );
});

test('registerPlugin rejects a duplicate blockType registration', () => {
  // Builtin paragraph is already registered (by other test files or by
  // plate-runtime init). Registering another plugin with blockType
  // 'paragraph' through the public registerPlugin entry must reject.
  const duplicate = {
    blockType: 'paragraph',
    plateElementTypes: ['__test_dup__'],
    schemaFragment: {},
    docContentToPlate: () => ({ type: '__test_dup__', children: [{ text: '' }] }),
    plateToDocContent: () => ({ type: 'paragraph', children: [{ type: 'text', text: '' }] }),
  } as unknown as EditorPlugin;
  assert.throws(
    () => editor.registerPlugin(duplicate),
    (err: unknown) => {
      assert.ok(err instanceof Error);
      assert.equal((err as Error).name, 'EditorPluginValidationError');
      assert.match((err as Error).message, /already registered/);
      return true;
    },
  );
});
