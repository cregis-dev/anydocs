'use client';

// Type-level contract probe: proves @anydocs/editor resolves through its PUBLIC CONTRACT only
// (no deep src/* imports, no fork). Verified at typecheck; the real Plate+Yjs-bound editor host
// that actually renders/bundles the editor is built in Stories C2.5 / C6.1.
import { createEditor, type EditorConfig, type EditorInstance } from '@anydocs/editor';

export type { EditorConfig, EditorInstance };

export function createCloudEditor(config: EditorConfig): EditorInstance {
  return createEditor(config);
}
