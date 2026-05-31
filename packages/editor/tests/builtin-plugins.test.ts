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
  for (const plugin of BUILTIN_PLUGINS) {
    if (!ESSENTIAL_BLOCK_TYPES.has(plugin.blockType)) continue;
    const builtin = plugin as BuiltinPlugin;
    assert.ok(
      builtin.platePlugin !== undefined && builtin.platePlugin !== null,
      `essential plugin '${plugin.blockType}' must declare platePlugin`,
    );
  }
});

test('extended block types (codeGroup, mermaid) have no Plate render plugin', () => {
  for (const plugin of BUILTIN_PLUGINS) {
    if (!EXTENDED_BLOCK_TYPES.has(plugin.blockType)) continue;
    const builtin = plugin as BuiltinPlugin;
    assert.equal(
      builtin.platePlugin,
      undefined,
      `extended plugin '${plugin.blockType}' should not declare platePlugin (Story 6.4 scope; Story 13.x adds render UI)`,
    );
  }
});

test('every essential blockType is represented in BUILTIN_PLUGINS', () => {
  const builtinBlockTypes = new Set(BUILTIN_PLUGINS.map((p) => p.blockType));
  for (const essential of ESSENTIAL_BLOCK_TYPES) {
    assert.ok(builtinBlockTypes.has(essential), `essential blockType '${essential}' is missing a builtin plugin`);
  }
});
