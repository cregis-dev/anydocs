import { ValidationError } from '../errors/validation-error.ts';

export function normalizeSlug(slug?: string[] | string): string {
  if (!slug) return '';
  const raw = Array.isArray(slug) ? slug.join('/') : slug;
  return raw
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean)
    .join('/');
}

export function assertValidPageId(pageId: string): void {
  if (!pageId || pageId.includes('/') || pageId.includes('..')) {
    throw new ValidationError(`Invalid page id "${pageId}".`, {
      entity: 'page-doc',
      rule: 'page-id-safe-filename',
      remediation: 'Use a non-empty page id without path separators or parent-directory traversal.',
      metadata: { pageId },
    });
  }
}
