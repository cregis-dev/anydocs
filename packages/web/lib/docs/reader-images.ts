import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { cache } from 'react';
import type { DocContentV1 } from '@anydocs/core';

export type ReaderImage = { width: number; height: number; preview?: string };
export type ReaderImages = Record<string, ReaderImage>;

const previewPath = /^\/assets\/\.reader-images\/[a-f0-9]{64}\.webp$/;
const manifestReads = new Map<string, Promise<Record<string, unknown> | null>>();

async function readManifest(projectRoot: string): Promise<Record<string, unknown> | null> {
  try {
    const manifest = JSON.parse(await readFile(path.join(projectRoot, 'assets', '.reader-images', 'manifest.json'), 'utf8'));
    if (manifest?.version !== 1 || !manifest.images || typeof manifest.images !== 'object' || Array.isArray(manifest.images)) {
      return null;
    }
    return manifest.images;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.warn('Ignoring an invalid Reader image manifest.');
    }
    return null;
  }
}

const readReaderImageManifest = cache((projectRoot: string) => {
  // An export reads the same manifest for every route in a worker.
  if (process.env.ANYDOCS_DOCS_RUNTIME !== 'export') return readManifest(projectRoot);
  let manifest = manifestReads.get(projectRoot);
  if (!manifest) {
    manifest = readManifest(projectRoot);
    manifestReads.set(projectRoot, manifest);
  }
  return manifest;
});

export async function loadReaderImages(projectRoot: string, content: DocContentV1 | null): Promise<ReaderImages | undefined> {
  if (!content?.blocks.some((block) => block.type === 'image')) return undefined;
  const manifest = await readReaderImageManifest(projectRoot);
  if (!manifest) return undefined;
  const result: ReaderImages = {};
  for (const block of content.blocks) {
    if (block.type !== 'image' || !block.src.startsWith('/assets/')) continue;
    let key: string;
    try {
      key = decodeURIComponent(new URL(block.src, 'https://docs.invalid').pathname);
    } catch {
      continue;
    }
    if (!Object.hasOwn(manifest, key)) continue;
    const entry = manifest[key] as Partial<ReaderImage> | null;
    if (typeof entry?.width !== 'number' || !Number.isSafeInteger(entry.width) || entry.width < 1 ||
        typeof entry.height !== 'number' || !Number.isSafeInteger(entry.height) || entry.height < 1) continue;
    result[block.src] = {
      width: entry.width,
      height: entry.height,
      ...(typeof entry.preview === 'string' && previewPath.test(entry.preview) ? { preview: entry.preview } : {}),
    };
  }
  return Object.keys(result).length ? result : undefined;
}
