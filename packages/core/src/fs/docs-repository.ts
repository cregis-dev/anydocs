import { promises as fs } from 'node:fs';
import path from 'node:path';

import { ValidationError } from '../errors/validation-error.ts';
import { isPageApprovedForPublication } from '../publishing/publication-filter.ts';
import {
  validateNavigationDoc,
  validatePageDoc,
  type PageDocValidationOptions,
} from '../schemas/docs-schema.ts';
import type { DocsLang, NavigationDoc, PageDoc } from '../types/docs.ts';
import { assertValidPageId, normalizeSlug } from '../utils/slug.ts';

export type DocsRepository = {
  projectRoot: string;
  pagesRoot: string;
  navigationRoot: string;
};

export type NavigationValidationOptions = {
  existingPageIds?: Iterable<string>;
  requiredTopLevelGroupIds?: Iterable<string>;
};

export type DeletePageResult = {
  pageId: string;
  lang: DocsLang;
  removedNavigationRefs: number;
};

function createRepositoryValidationError(
  rule: string,
  remediation: string,
  metadata?: Record<string, unknown>,
): ValidationError {
  return new ValidationError(`Docs repository validation failed for rule "${rule}".`, {
    entity: 'docs-repository',
    rule,
    remediation,
    metadata,
  });
}

export function createDocsRepository(projectRoot: string): DocsRepository {
  if (!projectRoot || projectRoot.includes('..')) {
    throw createRepositoryValidationError(
      'project-root-safe-path',
      'Provide a project root without parent-directory traversal.',
      { projectRoot },
    );
  }

  return {
    projectRoot,
    pagesRoot: path.join(projectRoot, 'pages'),
    navigationRoot: path.join(projectRoot, 'navigation'),
  };
}

function pagesDir(repository: DocsRepository, lang: DocsLang): string {
  return path.join(repository.pagesRoot, lang);
}

function navigationFile(repository: DocsRepository, lang: DocsLang): string {
  return path.join(repository.navigationRoot, `${lang}.json`);
}

async function readJson<T>(filePath: string): Promise<T> {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw) as T;
}

function isMissingFileError(error: unknown): boolean {
  return !!error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT';
}

async function writeJsonAtomic(filePath: string, value: unknown): Promise<void> {
  const dir = path.dirname(filePath);
  const tempFilePath = path.join(
    dir,
    `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`,
  );

  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(tempFilePath, JSON.stringify(value, null, 2) + '\n', 'utf8');
  await fs.rename(tempFilePath, filePath);
}

function findDuplicateSlug<TContent>(
  pages: PageDoc<TContent>[],
  slug: string,
  pageId: string,
): PageDoc<TContent> | undefined {
  return pages.find((page) => page.slug === slug && page.id !== pageId);
}

function collectNavigationPageIds(items: NavigationDoc['items'], out: string[]) {
  for (const item of items) {
    if (item.type === 'page') {
      out.push(item.pageId);
      continue;
    }
    if (item.type === 'section' || item.type === 'folder') {
      collectNavigationPageIds(item.children, out);
    }
  }
}

function collectTopLevelGroupIds(items: NavigationDoc['items']): Set<string> {
  const ids = new Set<string>();

  for (const item of items) {
    if ((item.type === 'section' || item.type === 'folder') && item.id) {
      ids.add(item.id);
    }
  }

  return ids;
}

function removePageReferences(
  items: NavigationDoc['items'],
  pageId: string,
): { items: NavigationDoc['items']; removed: number } {
  let removed = 0;
  const nextItems: NavigationDoc['items'] = [];

  for (const item of items) {
    if (item.type === 'page') {
      if (item.pageId === pageId) {
        removed += 1;
        continue;
      }

      nextItems.push(item);
      continue;
    }

    if (item.type === 'section' || item.type === 'folder') {
      const cleaned = removePageReferences(item.children, pageId);
      removed += cleaned.removed;
      nextItems.push({ ...item, children: cleaned.items });
      continue;
    }

    nextItems.push(item);
  }

  return { items: nextItems, removed };
}

export async function initializeDocsRepository(
  repository: DocsRepository,
  languages: DocsLang[] = ['en', 'zh'],
): Promise<void> {
  await fs.mkdir(repository.navigationRoot, { recursive: true });

  for (const lang of languages) {
    await fs.mkdir(pagesDir(repository, lang), { recursive: true });

    const navFile = navigationFile(repository, lang);
    try {
      await fs.access(navFile);
    } catch {
      await writeJsonAtomic(navFile, { version: 1, items: [] } satisfies NavigationDoc);
    }
  }
}

export async function loadNavigation(
  repository: DocsRepository,
  lang: DocsLang,
): Promise<NavigationDoc> {
  try {
    return validateNavigationDoc(await readJson<unknown>(navigationFile(repository, lang)));
  } catch (error: unknown) {
    if (isMissingFileError(error)) {
      return { version: 1, items: [] };
    }

    throw error;
  }
}

export async function saveNavigation(
  repository: DocsRepository,
  lang: DocsLang,
  navigation: NavigationDoc,
  options: NavigationValidationOptions = {},
): Promise<NavigationDoc> {
  const validated = validateNavigationDoc(navigation);
  if (options.existingPageIds) {
    const knownPageIds = new Set(options.existingPageIds);
    const referencedPageIds: string[] = [];
    collectNavigationPageIds(validated.items, referencedPageIds);
    const missingPageId = referencedPageIds.find((pageId) => !knownPageIds.has(pageId));
    if (missingPageId) {
      throw new ValidationError(`Navigation references missing page "${missingPageId}".`, {
        entity: 'navigation-doc',
        rule: 'navigation-page-reference-must-exist',
        remediation: 'Create the referenced page first or remove the missing page reference from navigation.',
        metadata: { lang, pageId: missingPageId },
      });
    }
  }
  if (options.requiredTopLevelGroupIds) {
    const availableGroupIds = collectTopLevelGroupIds(validated.items);
    for (const groupId of options.requiredTopLevelGroupIds) {
      if (availableGroupIds.has(groupId)) {
        continue;
      }

      throw new ValidationError(`Navigation is missing required top-level group "${groupId}".`, {
        entity: 'navigation-doc',
        rule: 'navigation-top-level-group-must-exist',
        remediation:
          'Create the referenced top-level section or folder, or update site.navigation.topNav to reference an existing group id.',
        metadata: { lang, groupId },
      });
    }
  }
  await writeJsonAtomic(navigationFile(repository, lang), validated);
  return validated;
}

export async function listPages<TContent = unknown>(
  repository: DocsRepository,
  lang: DocsLang,
  options: PageDocValidationOptions = {},
): Promise<PageDoc<TContent>[]> {
  let entries: string[] = [];
  try {
    entries = await fs.readdir(pagesDir(repository, lang));
  } catch {
    return [];
  }

  const pages: PageDoc<TContent>[] = [];
  for (const entry of entries) {
    if (!entry.endsWith('.json')) continue;

    try {
      const page = validatePageDoc<TContent>(
        await readJson<unknown>(path.join(pagesDir(repository, lang), entry)),
        options,
      );
      if (page.lang === lang) {
        pages.push(page);
      }
    } catch (error: unknown) {
      if (isMissingFileError(error)) {
        continue;
      }

      throw error;
    }
  }

  pages.sort((left, right) => left.slug.localeCompare(right.slug));
  return pages;
}

export async function loadPage<TContent = unknown>(
  repository: DocsRepository,
  lang: DocsLang,
  pageId: string,
  options: PageDocValidationOptions = {},
): Promise<PageDoc<TContent> | null> {
  assertValidPageId(pageId);

  try {
    const page = validatePageDoc<TContent>(
      await readJson<unknown>(path.join(pagesDir(repository, lang), `${pageId}.json`)),
      options,
    );
    return page.lang === lang && page.id === pageId ? page : null;
  } catch (error: unknown) {
    if (isMissingFileError(error)) {
      return null;
    }

    throw error;
  }
}

export async function savePage<TContent = unknown>(
  repository: DocsRepository,
  lang: DocsLang,
  page: PageDoc<TContent>,
  options: PageDocValidationOptions = {},
): Promise<PageDoc<TContent>> {
  const validatedPage = validatePageDoc<TContent>(page, options);

  if (validatedPage.lang !== lang) {
    throw new ValidationError(`Page language "${validatedPage.lang}" does not match requested language "${lang}".`, {
      entity: 'page-doc',
      rule: 'page-language-matches-target-language',
      remediation: 'Save the page under the same language as its page.lang field.',
      metadata: { pageId: validatedPage.id, pageLang: validatedPage.lang, targetLang: lang },
    });
  }

  assertValidPageId(validatedPage.id);

  const slug = normalizeSlug(validatedPage.slug);
  if (!slug) {
    throw new ValidationError('Page slug is required.', {
      entity: 'page-doc',
      rule: 'page-slug-required',
      remediation: 'Provide a non-empty slug before saving the page.',
      metadata: { pageId: validatedPage.id },
    });
  }

  const normalizedPage: PageDoc<TContent> = {
    ...validatedPage,
    slug,
  };

  if (normalizedPage.status === 'published' && !isPageApprovedForPublication(normalizedPage)) {
    throw new ValidationError('Page review must be explicitly approved before publication.', {
      entity: 'page-doc',
      rule: 'page-review-must-be-approved-before-publication',
      remediation: 'Use the explicit approve-for-publication action on reviewed imported or AI-generated content before setting status to published.',
      metadata: {
        pageId: normalizedPage.id,
        lang,
        reviewRequired: normalizedPage.review?.required ?? false,
        approvedAt: normalizedPage.review?.approvedAt ?? null,
      },
    });
  }

  const existingPages = await listPages<TContent>(repository, lang, options);
  const duplicate = findDuplicateSlug(existingPages, normalizedPage.slug, normalizedPage.id);
  if (duplicate) {
    throw new ValidationError(`Duplicate slug "${normalizedPage.slug}" detected.`, {
      entity: 'page-doc',
      rule: 'page-slug-unique-per-language',
      remediation: 'Choose a unique slug for the page within the same language.',
      metadata: {
        pageId: normalizedPage.id,
        duplicatePageId: duplicate.id,
        slug: normalizedPage.slug,
        lang,
      },
    });
  }

  await writeJsonAtomic(
    path.join(pagesDir(repository, lang), `${normalizedPage.id}.json`),
    normalizedPage,
  );

  return normalizedPage;
}

export async function findPageBySlug<TContent = unknown>(
  repository: DocsRepository,
  lang: DocsLang,
  slug: string,
  options: PageDocValidationOptions = {},
): Promise<PageDoc<TContent> | null> {
  const normalizedSlug = normalizeSlug(slug);
  const pages = await listPages<TContent>(repository, lang, options);
  return pages.find((page) => page.slug === normalizedSlug) ?? null;
}

export async function deletePage(
  repository: DocsRepository,
  lang: DocsLang,
  pageId: string,
): Promise<DeletePageResult> {
  const page = await loadPage(repository, lang, pageId);
  if (!page) {
    throw new ValidationError(`Page "${pageId}" not found.`, {
      entity: 'page-doc',
      rule: 'page-delete-target-must-exist',
      remediation: 'Delete an existing page or refresh the page list before retrying.',
      metadata: { lang, pageId },
    });
  }

  await fs.rm(path.join(pagesDir(repository, lang), `${pageId}.json`));

  const navigation = await loadNavigation(repository, lang);
  const cleaned = removePageReferences(navigation.items, pageId);
  await saveNavigation(repository, lang, {
    ...navigation,
    items: cleaned.items,
  });

  return {
    pageId,
    lang,
    removedNavigationRefs: cleaned.removed,
  };
}
