// =============================================================================
// Plugin registry behavior — Story 6.4 plugin-contract tests.
//
// Covers:
//   * `validateEditorPlugin` accepts a fully-shaped plugin
//   * Rejects on each individual field violation
//   * `registerPluginIntoRegistry` strict mode (default) throws on duplicate
//   * `allowReregister: true` makes duplicate registration a silent no-op
//   * Lookup by blockType / plateElementType
//   * Lookup miss returns `undefined`
//
// Builtin auto-registration is exercised by `builtin-plugins.test.ts`; here
// we use `clearRegistryForTests` to start from an empty registry per case.
// =============================================================================

import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import type { EditorPlugin } from '../contract/public-api.ts';
import {
  clearRegistryForTests,
  getPluginForBlockType,
  getPluginForPlateElement,
  listRegisteredBlockTypes,
  listRegisteredPlateElementTypes,
  registerPluginIntoRegistry,
  validateEditorPlugin,
} from '../src/plugins/plugin-contract.ts';
import { resetBuiltinRegistrationFlagForTests } from '../src/plugins/builtin/index.ts';

beforeEach(() => {
  clearRegistryForTests();
  resetBuiltinRegistrationFlagForTests();
});

function validPlugin(blockType: 'paragraph' | 'heading' = 'paragraph', plateType = 'p'): EditorPlugin {
  return {
    blockType,
    plateElementTypes: [plateType],
    schemaFragment: { kind: 'test' },
    docContentToPlate: (block) => ({ type: plateType, children: [{ text: '' }], _from: block }),
    plateToDocContent: (node) => ({ type: blockType, children: [{ type: 'text', text: '' }], _from: node }),
  };
}

test('validateEditorPlugin accepts a fully-shaped plugin', () => {
  assert.doesNotThrow(() => validateEditorPlugin(validPlugin()));
});

test('validateEditorPlugin rejects null', () => {
  assert.throws(() => validateEditorPlugin(null), /expected an object/);
});

test('validateEditorPlugin rejects non-string blockType', () => {
  assert.throws(
    () => validateEditorPlugin({ ...validPlugin(), blockType: 42 as unknown as string }),
    /blockType/,
  );
});

test('validateEditorPlugin rejects non-canonical blockType', () => {
  assert.throws(
    () => validateEditorPlugin({ ...validPlugin(), blockType: 'not-canonical' }),
    /not a canonical DocContentV1 block type/,
  );
});

test('validateEditorPlugin rejects empty plateElementTypes', () => {
  assert.throws(
    () => validateEditorPlugin({ ...validPlugin(), plateElementTypes: [] }),
    /plateElementTypes/,
  );
});

test('validateEditorPlugin rejects plateElementTypes containing a non-string', () => {
  assert.throws(
    () => validateEditorPlugin({ ...validPlugin(), plateElementTypes: ['p', 42 as unknown as string] }),
    /every entry must be a non-empty string/,
  );
});

test('validateEditorPlugin rejects missing schemaFragment', () => {
  const plugin = { ...validPlugin() };
  delete (plugin as { schemaFragment?: unknown }).schemaFragment;
  assert.throws(() => validateEditorPlugin(plugin), /schemaFragment/);
});

test('validateEditorPlugin rejects non-callable docContentToPlate', () => {
  assert.throws(
    () => validateEditorPlugin({ ...validPlugin(), docContentToPlate: 'not a function' as unknown as () => unknown }),
    /docContentToPlate/,
  );
});

test('validateEditorPlugin rejects non-callable plateToDocContent', () => {
  assert.throws(
    () => validateEditorPlugin({ ...validPlugin(), plateToDocContent: undefined }),
    /plateToDocContent/,
  );
});

test('validateEditorPlugin rejects invalid agentAnchor enum value', () => {
  assert.throws(
    () =>
      validateEditorPlugin({
        ...validPlugin(),
        agentAnchor: 'bogus' as unknown as 'inline',
      }),
    /agentAnchor/,
  );
});

test('validateEditorPlugin accepts agentAnchor=undefined', () => {
  assert.doesNotThrow(() => validateEditorPlugin({ ...validPlugin(), agentAnchor: undefined }));
});

// ---------------------------------------------------------------------------
// Registry behavior
// ---------------------------------------------------------------------------

test('registerPluginIntoRegistry inserts a fresh plugin and is looked up by both blockType and plate type', () => {
  const plugin = validPlugin();
  registerPluginIntoRegistry(plugin);
  assert.equal(getPluginForBlockType('paragraph'), plugin);
  assert.equal(getPluginForPlateElement('p'), plugin);
});

test('registerPluginIntoRegistry throws on duplicate blockType in strict mode', () => {
  registerPluginIntoRegistry(validPlugin());
  assert.throws(
    () => registerPluginIntoRegistry(validPlugin()),
    /already registered/,
  );
});

test('registerPluginIntoRegistry with allowReregister: true silently no-ops on duplicate', () => {
  registerPluginIntoRegistry(validPlugin());
  assert.doesNotThrow(
    () => registerPluginIntoRegistry(validPlugin(), { allowReregister: true }),
  );
  // Lookup still resolves to the originally-registered plugin shape.
  assert.equal(getPluginForBlockType('paragraph')?.blockType, 'paragraph');
});

test('registerPluginIntoRegistry rejects plate-element-type collision across plugins', () => {
  registerPluginIntoRegistry(validPlugin('paragraph', 'p'));
  // Try to register a heading plugin that ALSO claims 'p' — must throw.
  const collidingHeading: EditorPlugin = {
    ...validPlugin('heading', 'h1'),
    plateElementTypes: ['h1', 'p'], // 'p' is already claimed by paragraph
  };
  assert.throws(
    () => registerPluginIntoRegistry(collidingHeading),
    /already owned by blockType/,
  );
});

test('listRegisteredBlockTypes returns every registered blockType', () => {
  registerPluginIntoRegistry(validPlugin('paragraph', 'p'));
  registerPluginIntoRegistry(validPlugin('heading', 'h1'));
  const types = listRegisteredBlockTypes().sort();
  assert.deepEqual(types, ['heading', 'paragraph']);
});

test('listRegisteredPlateElementTypes returns every Plate element type claimed', () => {
  registerPluginIntoRegistry(validPlugin('paragraph', 'p'));
  const headingPlugin: EditorPlugin = {
    ...validPlugin('heading', 'h1'),
    plateElementTypes: ['h1', 'h2', 'h3'],
  };
  registerPluginIntoRegistry(headingPlugin);
  const types = listRegisteredPlateElementTypes().sort();
  assert.deepEqual(types, ['h1', 'h2', 'h3', 'p']);
});

test('lookup misses return undefined (NOT throw)', () => {
  assert.equal(getPluginForBlockType('nonexistent'), undefined);
  assert.equal(getPluginForPlateElement('nonexistent'), undefined);
});

test('clearRegistryForTests wipes both lookup tables', () => {
  registerPluginIntoRegistry(validPlugin());
  assert.notEqual(getPluginForBlockType('paragraph'), undefined);
  clearRegistryForTests();
  assert.equal(getPluginForBlockType('paragraph'), undefined);
  assert.equal(getPluginForPlateElement('p'), undefined);
});

// ---------------------------------------------------------------------------
// Story 6.4 review-fix regression tests
// ---------------------------------------------------------------------------

test('regression M1: EditorPlugin contract type now requires converter hooks', () => {
  // Removing the converter from a valid plugin must surface as a TypeScript
  // error at compile time AND a validator throw at runtime. We exercise the
  // runtime side here (TS-side is enforced by the contract.json snapshot).
  const withoutForward = { ...validPlugin() } as unknown as { docContentToPlate?: unknown };
  delete withoutForward.docContentToPlate;
  assert.throws(
    () => validateEditorPlugin(withoutForward),
    /docContentToPlate/,
    'validator must throw when docContentToPlate is missing (contract is no longer optional)',
  );

  const withoutInverse = { ...validPlugin() } as unknown as { plateToDocContent?: unknown };
  delete withoutInverse.plateToDocContent;
  assert.throws(
    () => validateEditorPlugin(withoutInverse),
    /plateToDocContent/,
  );
});
