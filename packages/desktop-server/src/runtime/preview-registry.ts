import path from 'node:path';

import type { PreviewWorkflowResult } from '../types.ts';

type PreviewRegistryEntry = {
  key: string;
  result: PreviewWorkflowResult;
  docsPath: string;
  previewUrl: string;
  exited: boolean;
  exitPromise: Promise<void>;
};

const previewRegistry = new Map<string, PreviewRegistryEntry>();

function getPreviewRegistryKey(projectRoot: string): string {
  return path.resolve(projectRoot);
}

function createPlaceholderPreview(_projectRoot: string): PreviewWorkflowResult {
  const url = `http://127.0.0.1:3000`;

  return {
    projectId: 'default',
    language: 'en',
    docsPath: '/en',
    publishedPages: 0,
    host: '127.0.0.1',
    port: 3000,
    url,
    pid: process.pid,
    stop: async () => {},
    waitUntilExit: async () => ({ exitCode: 0, signal: null }),
  };
}

export function registerPreview(projectRoot: string, result?: PreviewWorkflowResult): PreviewRegistryEntry {
  const key = getPreviewRegistryKey(projectRoot);
  const entryResult = result ?? createPlaceholderPreview(projectRoot);
  const entry: PreviewRegistryEntry = {
    key,
    result: entryResult,
    docsPath: entryResult.docsPath,
    previewUrl: new URL(entryResult.docsPath, `${entryResult.url}/`).toString(),
    exited: false,
    exitPromise: Promise.resolve(),
  };

  entry.exitPromise = entryResult.waitUntilExit().then(() => {
    entry.exited = true;
    if (previewRegistry.get(key) === entry) {
      previewRegistry.delete(key);
    }
  });

  previewRegistry.set(key, entry);
  return entry;
}

export function getActivePreviewEntry(projectRoot: string): PreviewRegistryEntry | null {
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

export async function stopActivePreview(projectRoot: string): Promise<boolean> {
  const entry = getActivePreviewEntry(projectRoot);
  if (!entry) {
    return false;
  }

  previewRegistry.delete(entry.key);
  await entry.result.stop();
  await entry.exitPromise;
  return true;
}

export async function stopAllActivePreviews(): Promise<number> {
  const entries = [...previewRegistry.values()].filter((entry) => !entry.exited);
  previewRegistry.clear();

  await Promise.all(
    entries.map(async (entry) => {
      await entry.result.stop();
      await entry.exitPromise;
    }),
  );

  return entries.length;
}
