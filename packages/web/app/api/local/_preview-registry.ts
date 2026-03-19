import path from 'node:path';

import type { PreviewWorkflowResult } from '@anydocs/core';

type PreviewRegistryEntry = {
  key: string;
  result: PreviewWorkflowResult;
  docsPath: string;
  previewUrl: string;
  exited: boolean;
  exitPromise: Promise<void>;
};

const previewRegistry = new Map<string, PreviewRegistryEntry>();

export function getPreviewRegistryKey(projectRoot: string): string {
  return path.resolve(projectRoot);
}

export function getActivePreview(projectRoot: string): PreviewRegistryEntry | null {
  const key = getPreviewRegistryKey(projectRoot);
  const entry = previewRegistry.get(key);
  if (!entry) {
    return null;
  }

  if (entry.exited) {
    previewRegistry.delete(key);
    return null;
  }

  return entry;
}

export function registerPreview(projectRoot: string, result: PreviewWorkflowResult): PreviewRegistryEntry {
  const key = getPreviewRegistryKey(projectRoot);
  const entry: PreviewRegistryEntry = {
    key,
    result,
    docsPath: result.docsPath,
    previewUrl: new URL(result.docsPath, `${result.url}/`).toString(),
    exited: false,
    exitPromise: Promise.resolve(),
  };

  entry.exitPromise = result.waitUntilExit().then(() => {
    entry.exited = true;
    if (previewRegistry.get(key) === entry) {
      previewRegistry.delete(key);
    }
  });

  previewRegistry.set(key, entry);
  return entry;
}

export async function stopActivePreview(projectRoot: string): Promise<boolean> {
  const entry = getActivePreview(projectRoot);
  if (!entry) {
    return false;
  }

  previewRegistry.delete(entry.key);
  await entry.result.stop();
  await entry.exitPromise;
  return true;
}
