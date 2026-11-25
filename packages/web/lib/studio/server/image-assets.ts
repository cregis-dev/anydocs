import { readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';

const imageTypes = new Map([
  ['.avif', 'image/avif'], ['.gif', 'image/gif'], ['.ico', 'image/x-icon'],
  ['.jpeg', 'image/jpeg'], ['.jpg', 'image/jpeg'], ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'], ['.webp', 'image/webp'],
]);

export async function readStudioImage(projectRoot: string, segments: string[]) {
  if (!segments.length || segments.some((part) => !part || part.startsWith('.') || /[/\\\0]/.test(part))) {
    return null;
  }

  const type = imageTypes.get(path.extname(segments.at(-1)!).toLowerCase());
  if (!type) return null;

  try {
    const root = path.join(await realpath(projectRoot), 'assets');
    const file = await realpath(path.join(root, ...segments));
    const relative = path.relative(root, file);
    if (path.isAbsolute(relative) || relative.split(path.sep).some((part) => part.startsWith('.')) ||
      imageTypes.get(path.extname(file).toLowerCase()) !== type || !(await stat(file)).isFile()) {
      return null;
    }
    return { type, bytes: await readFile(file) };
  } catch {
    return null;
  }
}
