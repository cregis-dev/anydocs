// =============================================================================
// THIS FILE IS A THIN RE-EXPORT — DO NOT EDIT BY HAND.
// Public surface is governed by contract/public-api.ts (single source of
// truth). Story 6.5 will derive contract.json from that file and run a CI
// diff; any change must originate in the contract file.
// =============================================================================

export { createEditor, registerPlugin } from '../contract/public-api.ts';
export type { EditorConfig, EditorInstance, EditorPlugin } from '../contract/public-api.ts';
