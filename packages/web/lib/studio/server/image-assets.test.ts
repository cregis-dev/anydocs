import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { readStudioImage } from './image-assets.ts';

test('Studio reads only images inside the project assets directory', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'studio-images-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const nested = path.join(root, 'assets', 'guide');
  await mkdir(nested, { recursive: true });
  await writeFile(path.join(nested, 'screen (1).PNG'), 'image fixture');
  await writeFile(path.join(root, 'outside.png'), 'outside the asset root');
  await writeFile(path.join(nested, 'note.txt'), 'not an image');
  await symlink(path.join(root, 'outside.png'), path.join(nested, 'outside.png'));
  await symlink(path.join(nested, 'note.txt'), path.join(nested, 'fake.png'));

  const image = await readStudioImage(root, ['guide', 'screen (1).PNG']);
  assert.equal(image?.type, 'image/png');
  assert.equal(image.bytes.toString(), 'image fixture');
  for (const segments of [['..', 'outside.png'], ['../outside.png'], ['guide', 'outside.png'],
    ['guide', 'note.txt'], ['guide', 'fake.png'], ['guide', 'missing.png']]) {
    assert.equal(await readStudioImage(root, segments), null);
  }
});
