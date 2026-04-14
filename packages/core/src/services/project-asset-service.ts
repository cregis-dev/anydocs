import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

export const PROJECT_ASSETS_DIRNAME = 'assets';
export const PROJECT_IMAGE_ASSETS_DIRNAME = 'images';
export const PROJECT_ASSET_URL_PREFIX = '/assets/';
export const PROJECT_IMAGE_ASSET_URL_PREFIX = '/assets/images/';

const MIME_TYPE_TO_EXTENSION = new Map<string, string>([
  ['image/apng', '.apng'],
  ['image/avif', '.avif'],
  ['image/bmp', '.bmp'],
  ['image/gif', '.gif'],
  ['image/heic', '.heic'],
  ['image/heif', '.heif'],
  ['image/jpeg', '.jpg'],
  ['image/jpg', '.jpg'],
  ['image/png', '.png'],
  ['image/svg+xml', '.svg'],
  ['image/webp', '.webp'],
]);

export type SaveProjectImageAssetInput = {
  bytes: Uint8Array | ArrayBuffer;
  filename?: string;
  mimeType?: string;
};

export type SaveProjectImageAssetResult = {
  src: string;
  absolutePath: string;
};

function normalizeOptionalString(value?: string | null): string | undefined {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function slugifyFilenameStem(value: string): string {
  return (
    value
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/-{2,}/g, '-') || 'image'
  );
}

function getPreferredImageExtension(filename?: string, mimeType?: string): string {
  const normalizedFilename = normalizeOptionalString(filename);
  const fromFilename = normalizedFilename ? path.extname(normalizedFilename).toLowerCase() : '';
  if (fromFilename) {
    return fromFilename;
  }

  const normalizedMimeType = normalizeOptionalString(mimeType)?.toLowerCase();
  if (normalizedMimeType) {
    return MIME_TYPE_TO_EXTENSION.get(normalizedMimeType) ?? '.bin';
  }

  return '.bin';
}

function toBuffer(bytes: Uint8Array | ArrayBuffer): Buffer {
  if (bytes instanceof Uint8Array) {
    return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }

  return Buffer.from(bytes);
}

function getProjectAssetsRoot(projectRoot: string): string {
  return path.join(projectRoot, PROJECT_ASSETS_DIRNAME);
}

export function isProjectAssetUrl(value: string): boolean {
  if (!value.startsWith(PROJECT_ASSET_URL_PREFIX)) {
    return false;
  }

  const normalized = value.replace(/^\/+/, '');
  const segments = normalized.split('/').filter(Boolean);
  if (segments.length < 2) {
    return false;
  }

  return !segments.includes('..');
}

export function resolveProjectAssetAbsolutePath(projectRoot: string, assetUrl: string): string | null {
  if (!isProjectAssetUrl(assetUrl)) {
    return null;
  }

  const relativeAssetPath = assetUrl.replace(/^\/+/, '');
  const projectAssetsRoot = getProjectAssetsRoot(projectRoot);
  const absolutePath = path.resolve(projectRoot, relativeAssetPath);
  const relativeToAssetsRoot = path.relative(projectAssetsRoot, absolutePath);

  if (
    relativeToAssetsRoot.startsWith('..') ||
    path.isAbsolute(relativeToAssetsRoot) ||
    relativeToAssetsRoot.length === 0
  ) {
    return null;
  }

  return absolutePath;
}

export async function saveProjectImageAsset(
  projectRoot: string,
  input: SaveProjectImageAssetInput,
): Promise<SaveProjectImageAssetResult> {
  const bytes = toBuffer(input.bytes);
  const extension = getPreferredImageExtension(input.filename, input.mimeType);
  const normalizedFilename = path.basename(input.filename ?? '');
  const filenameStem = slugifyFilenameStem(
    normalizedFilename.toLowerCase().endsWith(extension) && extension
      ? normalizedFilename.slice(0, -extension.length)
      : normalizedFilename,
  );
  const hash = createHash('sha256').update(bytes).digest('hex').slice(0, 12);
  const assetFileName = `${filenameStem}-${hash}${extension}`;
  const absolutePath = path.join(
    projectRoot,
    PROJECT_ASSETS_DIRNAME,
    PROJECT_IMAGE_ASSETS_DIRNAME,
    assetFileName,
  );

  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, bytes);

  return {
    src: `${PROJECT_IMAGE_ASSET_URL_PREFIX}${assetFileName}`,
    absolutePath,
  };
}
