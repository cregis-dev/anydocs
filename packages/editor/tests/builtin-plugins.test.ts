// =============================================================================
// Builtin plugins — Story 6.4 AC10 shape + coverage assertions.
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';

import { DOC_CONTENT_BLOCK_TYPES } from '@anydocs/core';

import {
  BUILTIN_PLUGINS,
  type BuiltinPlugin,
} from '../src/plugins/builtin/index.ts';
import { validateEditorPlugin } from '../src/plugins/plugin-contract.ts';
import {
  PLATE_BLOCKQUOTE,
  PLATE_CALLOUT,
  PLATE_CODE_BLOCK,
  PLATE_CODE_GROUP,
  PLATE_DIVIDER,
  PLATE_HEADING,
  PLATE_IMAGE,
  PLATE_LINK,
  PLATE_LIST_BULLETED,
  PLATE_LIST_ITEM,
  PLATE_LIST_ITEM_TODO,
  PLATE_LIST_NUMBERED,
  PLATE_LIST_TODO,
  PLATE_MERMAID,
  PLATE_PARAGRAPH,
  PLATE_TABLE,
  PLATE_TABLE_CELL,
  PLATE_TABLE_HEADER_CELL,
  PLATE_TABLE_ROW,
} from '../src/converters/element-types.ts';

// ---------------------------------------------------------------------------
// AC10 — every builtin plugin passes the runtime validator
// ---------------------------------------------------------------------------

test('every builtin plugin passes validateEditorPlugin', () => {
  for (const plugin of BUILTIN_PLUGINS) {
    assert.doesNotThrow(
      () => validateEditorPlugin(plugin),
      `builtin plugin for blockType '${plugin.blockType}' must satisfy the runtime validator`,
    );
  }
});

test('every builtin blockType is canonical (in DOC_CONTENT_BLOCK_TYPES)', () => {
  const canonical = new Set<string>(DOC_CONTENT_BLOCK_TYPES);
  for (const plugin of BUILTIN_PLUGINS) {
    assert.ok(
      canonical.has(plugin.blockType),
      `builtin plugin blockType '${plugin.blockType}' is not a canonical DocContentV1 type`,
    );
  }
});

test('no duplicate blockType across BUILTIN_PLUGINS', () => {
  const seen = new Set<string>();
  for (const plugin of BUILTIN_PLUGINS) {
    assert.ok(!seen.has(plugin.blockType), `duplicate blockType '${plugin.blockType}' in BUILTIN_PLUGINS`);
    seen.add(plugin.blockType);
  }
});

test('BUILTIN_PLUGINS covers every canonical block type', () => {
  const builtinBlockTypes = new Set(BUILTIN_PLUGINS.map((p) => p.blockType));
  for (const canonical of DOC_CONTENT_BLOCK_TYPES) {
    assert.ok(
      builtinBlockTypes.has(canonical),
      `canonical DocContentV1 block type '${canonical}' is missing a builtin plugin`,
    );
  }
});

test('paragraph plugin sits first in BUILTIN_PLUGINS (canonical default ordering)', () => {
  assert.equal(BUILTIN_PLUGINS[0]?.blockType, 'paragraph');
});

// ---------------------------------------------------------------------------
// AC10 — plateElementTypes union covers every type the converters emit
// ---------------------------------------------------------------------------

test('union of plateElementTypes covers every PLATE_* element-type constant the converters use', () => {
  const elementTypeUnion = new Set<string>();
  for (const plugin of BUILTIN_PLUGINS) {
    for (const type of plugin.plateElementTypes) {
      elementTypeUnion.add(type);
    }
  }
  // Every BLOCK-level Plate element-type constant must be covered. The
  // inline-only `PLATE_LINK` is intentionally NOT a block; the link plugin
  // is part of the inline-shared utilities, not a builtin plugin.
  const expectedBlockElementTypes = [
    PLATE_PARAGRAPH,
    PLATE_HEADING[1], PLATE_HEADING[2], PLATE_HEADING[3],
    PLATE_LIST_BULLETED, PLATE_LIST_NUMBERED, PLATE_LIST_TODO,
    PLATE_LIST_ITEM, PLATE_LIST_ITEM_TODO,
    PLATE_CODE_BLOCK, PLATE_CODE_GROUP,
    PLATE_BLOCKQUOTE,
    PLATE_CALLOUT,
    PLATE_TABLE, PLATE_TABLE_ROW, PLATE_TABLE_CELL, PLATE_TABLE_HEADER_CELL,
    PLATE_IMAGE,
    PLATE_DIVIDER,
    PLATE_MERMAID,
  ];
  for (const type of expectedBlockElementTypes) {
    assert.ok(elementTypeUnion.has(type), `Plate element type '${type}' is not owned by any builtin plugin`);
  }
  // PLATE_LINK is the inline link type — NOT expected in any builtin's
  // plateElementTypes (handled by inline-shared.ts utilities directly).
  assert.ok(!elementTypeUnion.has(PLATE_LINK), 'inline PLATE_LINK must not be claimed by a block plugin');
});

// ---------------------------------------------------------------------------
// AC6 — essential types carry Plate render plugins; extended types don't
// ---------------------------------------------------------------------------

const ESSENTIAL_BLOCK_TYPES = new Set([
  'paragraph', 'heading', 'list', 'codeBlock', 'image',
  'callout', 'table', 'divider', 'blockquote',
]);

const EXTENDED_BLOCK_TYPES = new Set([
  'codeGroup', 'mermaid',
]);

test('essential block types each have a Plate render plugin attached', () => {
  // Every essential type — including `list` — must declare a platePlugin:
  // without ANY plugin for an element type, Plate skips `override.components`
  // and renders an unstyled default `<div>`. `list` deliberately uses
  // MINIMAL self-declared plugins (node semantics only) instead of
  // `@udecode/plate-list/react`, whose indent-list normaliser mangles the
  // nested `<ul><li>` shape DocContentV1 stores — see list.ts.
  for (const plugin of BUILTIN_PLUGINS) {
    if (!ESSENTIAL_BLOCK_TYPES.has(plugin.blockType)) continue;
    const builtin = plugin as BuiltinPlugin;
    assert.ok(
      builtin.platePlugin !== undefined && builtin.platePlugin !== null,
      `essential plugin '${plugin.blockType}' must declare platePlugin`,
    );
  }
});

test('list plugin covers all five nested-list element types with plate plugins', () => {
  const listPlugin = BUILTIN_PLUGINS.find((p) => p.blockType === 'list') as BuiltinPlugin | undefined;
  assert.ok(listPlugin, 'list builtin plugin must exist');
  const declared = [listPlugin.platePlugin, ...(listPlugin.extraPlatePlugins ?? [])].filter(Boolean);
  assert.equal(
    declared.length,
    listPlugin.plateElementTypes.length,
    'every nested-list element type (ul/ol/todo_list/li/todo_li) needs its own minimal plate plugin so its render component applies',
  );
});

test('extended block types (codeGroup, mermaid) declare minimal Plate plugins', () => {
  // Story 6.4 originally shipped these with `platePlugin: undefined`, but
  // without ANY plugin for an element type Plate never consults the
  // `override.components` map — the wired render components (#93) were
  // silently skipped and the blocks fell back to unstyled default `<div>`s.
  // Each extended type now declares a minimal `createPlatePlugin` (node
  // semantics only) so its component actually renders; rich editing UX for
  // them is still Story 13.x scope.
  for (const plugin of BUILTIN_PLUGINS) {
    if (!EXTENDED_BLOCK_TYPES.has(plugin.blockType)) continue;
    const builtin = plugin as BuiltinPlugin;
    assert.ok(
      builtin.platePlugin !== undefined && builtin.platePlugin !== null,
      `extended plugin '${plugin.blockType}' must declare a minimal platePlugin so its render component applies`,
    );
  }
});

test('every essential blockType is represented in BUILTIN_PLUGINS', () => {
  const builtinBlockTypes = new Set(BUILTIN_PLUGINS.map((p) => p.blockType));
  for (const essential of ESSENTIAL_BLOCK_TYPES) {
    assert.ok(builtinBlockTypes.has(essential), `essential blockType '${essential}' is missing a builtin plugin`);
  }
});
