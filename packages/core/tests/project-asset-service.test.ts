import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  resolveProjectAssetAbsolutePath,
  saveProjectImageAsset,
} from '../src/services/project-asset-service.ts';

test('saveProjectImageAsset stores image bytes under /assets/images with a stable hashed filename', async () => {
  const repoRoot = await mkdtemp(path.join(os.tmpdir(), 'anydocs-project-assets-'));

  try {
    const saved = await saveProjectImageAsset(repoRoot, {
      bytes: Buffer.from('test-image-bytes'),
      filename: 'My Hero Image.PNG',
      mimeType: 'image/png',
    });

    assert.match(saved.src, /^\/assets\/images\/my-hero-image-[a-f0-9]{12}\.png$/);
    assert.equal(
      await readFile(path.join(repoRoot, saved.src.slice(1)), 'utf8'),
      'test-image-bytes',
    );
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
});

test('resolveProjectAssetAbsolutePath only allows safe /assets paths inside the project root', async () => {
  const repoRoot = await mkdtemp(path.join(os.tmpdir(), 'anydocs-project-assets-'));

  try {
    const safe = resolveProjectAssetAbsolutePath(repoRoot, '/assets/images/hero-image.png');
    assert.equal(safe, path.join(repoRoot, 'assets', 'images', 'hero-image.png'));

    assert.equal(resolveProjectAssetAbsolutePath(repoRoot, '/assets/../secrets.txt'), null);
    assert.equal(resolveProjectAssetAbsolutePath(repoRoot, '/images/hero-image.png'), null);
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
});
