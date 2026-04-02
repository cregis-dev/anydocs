import path from 'node:path';

import { ValidationError } from '../errors/validation-error.ts';
import { isPageApprovedForPublication } from '../publishing/publication-filter.ts';
import { validatePageDoc } from '../schemas/docs-schema.ts';
import { validatePageAgainstProjectTemplates } from './page-template-service.ts';
import {
  createDocsRepository,
  deletePage as deletePageFromRepository,
  findPageBySlug,
  listPages,
  loadPage,
  loadProjectContract,
  loadNavigation,
  updateProjectConfig,
  savePage,
  saveNavigation,
} from '../fs/index.ts';
import type { DocsLang, NavItem, NavigationDoc, PageDoc, PageRender, PageReview, PageStatus } from '../types/docs.ts';
import type { ProjectConfig } from '../types/project.ts';
import {
  DOCS_YOOPTA_ALLOWED_MARKS,
  DOCS_YOOPTA_ALLOWED_TYPES,
  assertValidYooptaContentValue,
  normalizeSlug,
  renderYooptaContent,
} from '../utils/index.ts';

export type CreatePageInput<TContent = unknown> = {
  projectRoot: string;
  lang: DocsLang;
  page: {
    id: string;
    slug: string;
    title: string;
    description?: string;
    template?: string;
    metadata?: Record<string, unknown>;
    tags?: string[];
    status?: PageStatus;
    content?: TContent;
    render?: PageRender;
    review?: PageReview;
  };
};

export type UpdatePagePatch<TContent = unknown> = {
  slug?: string;
  title?: string;
  description?: string;
  template?: string;
  metadata?: Record<string, unknown>;
  tags?: string[];
  content?: TContent;
  render?: PageRender;
  review?: PageReview;
};

export type UpdatePageInput<TContent = unknown> = {
  projectRoot: string;
  lang: DocsLang;
  pageId: string;
  patch: UpdatePagePatch<TContent>;
  regenerateRender?: boolean;
};

export type SetPageStatusInput = {
  projectRoot: string;
  lang: DocsLang;
  pageId: string;
  status: PageStatus;
};

export type DeletePageInput = {
  projectRoot: string;
  lang: DocsLang;
  pageId: string;
};

export type BatchCreatePagesInput<TContent = unknown> = {
  projectRoot: string;
  lang: DocsLang;
  pages: Array<CreatePageInput<TContent>['page']>;
};

export type BatchUpdatePagesInput<TContent = unknown> = {
  projectRoot: string;
  lang: DocsLang;
  updates: Array<{
    pageId: string;
    patch: UpdatePagePatch<TContent>;
    regenerateRender?: boolean;
  }>;
};

export type BatchSetPageStatusesInput = {
  projectRoot: string;
  lang: DocsLang;
  updates: Array<{
    pageId: string;
    status: PageStatus;
  }>;
};

export type AuthoringPageResult<TContent = unknown> = {
  filePath: string;
  page: PageDoc<TContent>;
};

export type AuthoringDeletePageResult = {
  filePath: string;
  pageId: string;
  lang: DocsLang;
  removedNavigationRefs: number;
};

export type AuthoringBatchPagesResult<TContent = unknown> = {
  count: number;
  files: string[];
  pages: Array<PageDoc<TContent>>;
};

export type AuthoringNavigationResult = {
  filePath: string;
  navigation: NavigationDoc;
};

export type SetNavigationInput = {
  projectRoot: string;
  lang: DocsLang;
  navigation: NavigationDoc;
};

export type ReplaceNavigationItemsInput = {
  projectRoot: string;
  lang: DocsLang;
  items: NavigationDoc['items'];
};

export type InsertNavigationItemInput = {
  projectRoot: string;
  lang: DocsLang;
  item: NavItem;
  parentPath?: string;
  index?: number;
};

export type DeleteNavigationItemInput = {
  projectRoot: string;
  lang: DocsLang;
  itemPath: string;
};

export type MoveNavigationItemInput = {
  projectRoot: string;
  lang: DocsLang;
  itemPath: string;
  parentPath?: string;
  index?: number;
};

export type SetProjectLanguagesInput = {
  projectRoot: string;
  languages: DocsLang[];
  defaultLanguage?: DocsLang;
};

export type AuthoringProjectConfigResult = {
  filePath: string;
  config: ProjectConfig;
};

function pageFilePath(projectRoot: string, lang: DocsLang, pageId: string): string {
  return path.join(projectRoot, 'pages', lang, `${pageId}.json`);
}

function currentTimestamp(): string {
  return new Date().toISOString();
}

function assertValidAuthoringContent(content: unknown, pageId?: string): void {
  try {
    assertValidYooptaContentValue(content);
  } catch (error: unknown) {
    throw new ValidationError('Page content must use the supported Yoopta block structure.', {
      entity: 'page-doc',
      rule: 'page-content-must-be-valid-yoopta',
      remediation:
        'Provide content as a Yoopta block map using supported block types, block ids, block value arrays, and numeric meta.order/meta.depth fields.',
      metadata: {
        pageId: pageId ?? null,
        cause: error instanceof Error ? error.message : String(error),
        allowedBlockTypes: [...DOCS_YOOPTA_ALLOWED_TYPES],
        allowedMarks: [...DOCS_YOOPTA_ALLOWED_MARKS],
      },
    });
  }
}

function ensureUniqueBatchPageIds(pageIds: string[], rule: string): void {
  const seen = new Set<string>();
  for (const pageId of pageIds) {
    if (!seen.has(pageId)) {
      seen.add(pageId);
      continue;
    }

    throw new ValidationError(`Duplicate page id "${pageId}" in batch operation.`, {
      entity: 'page-doc',
      rule,
      remediation: 'Provide each page id at most once in a single batch request.',
      metadata: { pageId },
    });
  }
}

function collectRequiredTopLevelGroupIds(contract: Awaited<ReturnType<typeof loadAuthoringContext>>['contract']): string[] {
  return (contract.config.site.navigation?.topNav ?? [])
    .filter((item) => item.type === 'nav-group')
    .map((item) => item.groupId);
}

function navigationFilePath(projectRoot: string, lang: DocsLang): string {
  return path.join(projectRoot, 'navigation', `${lang}.json`);
}

function createNavigationPathError(
  rule: string,
  remediation: string,
  metadata: Record<string, unknown>,
): ValidationError {
  return new ValidationError(`Navigation path validation failed for rule "${rule}".`, {
    entity: 'navigation-doc',
    rule,
    remediation,
    metadata,
  });
}

function parseNavigationItemPath(pathValue: string | undefined, key: string): number[] {
  if (pathValue == null || pathValue.trim().length === 0) {
    return [];
  }

  const segments = pathValue.split('/');
  if (segments.some((segment) => !/^\d+$/.test(segment))) {
    throw createNavigationPathError(
      'navigation-item-path-format',
      `Provide "${key}" as slash-separated zero-based indexes, for example "0/1/2".`,
      { key, path: pathValue },
    );
  }

  return segments.map((segment) => Number.parseInt(segment, 10));
}

function assertValidInsertIndex(index: number, length: number, key: string): void {
  if (!Number.isInteger(index) || index < 0 || index > length) {
    throw createNavigationPathError(
      'navigation-insert-index-range',
      `Provide "${key}" as an integer between 0 and ${length}.`,
      { key, index, maxInclusive: length },
    );
  }
}

function cloneNavItems(items: NavigationDoc['items']): NavigationDoc['items'] {
  return items.map((item) => {
    if (item.type === 'section' || item.type === 'folder') {
      return {
        ...item,
        children: cloneNavItems(item.children),
      };
    }

    return { ...item };
  });
}

function updateNavItemsAtParent(
  items: NavigationDoc['items'],
  parentPath: number[],
  update: (children: NavigationDoc['items']) => NavigationDoc['items'],
  originalPath = '',
): NavigationDoc['items'] {
  if (parentPath.length === 0) {
    return update(items);
  }

  const [index, ...rest] = parentPath;
  const target = items[index];
  const pathLabel = originalPath ? `${originalPath}/${index}` : String(index);
  if (!target) {
    throw createNavigationPathError(
      'navigation-item-path-must-exist',
      'Use an existing navigation item path.',
      { path: pathLabel },
    );
  }

  if (target.type !== 'section' && target.type !== 'folder') {
    throw createNavigationPathError(
      'navigation-parent-path-must-target-group',
      'Use a section or folder path as the navigation parent target.',
      { path: pathLabel, itemType: target.type },
    );
  }

  const nextItems = [...items];
  nextItems[index] = {
    ...target,
    children: updateNavItemsAtParent(target.children, rest, update, pathLabel),
  };
  return nextItems;
}

function removeNavItemAtPath(
  items: NavigationDoc['items'],
  itemPath: number[],
  originalPath = '',
): { items: NavigationDoc['items']; removedItem: NavItem; parentPath: number[]; removedIndex: number } {
  if (itemPath.length === 0) {
    throw createNavigationPathError(
      'navigation-item-path-required',
      'Provide a non-empty navigation item path for delete or move operations.',
      { path: originalPath },
    );
  }

  const [index, ...rest] = itemPath;
  const pathLabel = originalPath ? `${originalPath}/${index}` : String(index);
  const target = items[index];
  if (!target) {
    throw createNavigationPathError(
      'navigation-item-path-must-exist',
      'Use an existing navigation item path.',
      { path: pathLabel },
    );
  }

  if (rest.length === 0) {
    return {
      items: items.filter((_, itemIndex) => itemIndex !== index),
      removedItem: target,
      parentPath: itemPath.slice(0, -1),
      removedIndex: index,
    };
  }

  if (target.type !== 'section' && target.type !== 'folder') {
    throw createNavigationPathError(
      'navigation-item-path-must-target-group-for-descendants',
      'Only section and folder items can contain nested navigation children.',
      { path: pathLabel, itemType: target.type },
    );
  }

  const nested = removeNavItemAtPath(target.children, rest, pathLabel);
  const nextItems = [...items];
  nextItems[index] = {
    ...target,
    children: nested.items,
  };

  return {
    items: nextItems,
    removedItem: nested.removedItem,
    parentPath: [index, ...nested.parentPath],
    removedIndex: nested.removedIndex,
  };
}

function insertNavItemAtParent(
  items: NavigationDoc['items'],
  parentPath: number[],
  item: NavItem,
  index?: number,
): NavigationDoc['items'] {
  return updateNavItemsAtParent(items, parentPath, (children) => {
    const nextChildren = [...children];
    const insertIndex = index ?? nextChildren.length;
    assertValidInsertIndex(insertIndex, nextChildren.length, 'index');
    nextChildren.splice(insertIndex, 0, item);
    return nextChildren;
  });
}

function isSamePath(left: number[], right: number[]): boolean {
  return left.length === right.length && left.every((segment, index) => segment === right[index]);
}

function isDescendantPath(pathValue: number[], ancestor: number[]): boolean {
  return ancestor.length < pathValue.length && ancestor.every((segment, index) => segment === pathValue[index]);
}

async function loadAuthoringContext(projectRoot: string, lang: DocsLang) {
  const contractResult = await loadProjectContract(projectRoot);
  if (!contractResult.ok) {
    throw contractResult.error;
  }

  const contract = contractResult.value;
  if (!contract.config.languages.includes(lang)) {
    throw new ValidationError(`Language "${lang}" is not enabled for the project.`, {
      entity: 'page-doc',
      rule: 'page-language-must-be-enabled-for-project',
      remediation: 'Use one of the enabled languages from anydocs.config.json before mutating pages.',
      metadata: {
        lang,
        enabledLanguages: contract.config.languages,
        projectRoot: contract.paths.projectRoot,
      },
    });
  }

  return {
    contract,
    repository: createDocsRepository(contract.paths.projectRoot),
  };
}

async function assertSlugAvailable<TContent>(
  projectRoot: string,
  lang: DocsLang,
  pageId: string,
  slug: string,
  findExisting: () => Promise<PageDoc<TContent> | null>,
) {
  const existing = await findExisting();
  if (!existing || existing.id === pageId) {
    return;
  }

  throw new ValidationError(`Duplicate slug "${slug}" detected.`, {
    entity: 'page-doc',
    rule: 'page-slug-unique-per-language',
    remediation: 'Choose a unique slug for the page within the same language.',
    metadata: {
      pageId,
      duplicatePageId: existing.id,
      slug,
      lang,
      projectRoot,
    },
  });
}

function validateAndNormalizePageCandidate<TContent>(
  page: PageDoc<TContent>,
  lang: DocsLang,
): PageDoc<TContent> {
  const validatedPage = validatePageDoc<TContent>(page);
  if (validatedPage.lang !== lang) {
    throw new ValidationError(`Page language "${validatedPage.lang}" does not match requested language "${lang}".`, {
      entity: 'page-doc',
      rule: 'page-language-matches-target-language',
      remediation: 'Save the page under the same language as its page.lang field.',
      metadata: { pageId: validatedPage.id, pageLang: validatedPage.lang, targetLang: lang },
    });
  }

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

  return normalizedPage;
}

function validateAndNormalizeProjectPageCandidate<TContent>(
  page: PageDoc<TContent>,
  lang: DocsLang,
  config: ProjectConfig,
): PageDoc<TContent> {
  const normalizedPage = validateAndNormalizePageCandidate(page, lang);
  return validatePageAgainstProjectTemplates(normalizedPage, config);
}

function resolveNextRender<TContent>(
  existingPage: PageDoc<TContent>,
  patch: UpdatePagePatch<TContent>,
  regenerateRender: boolean | undefined,
) {
  if (patch.render) {
    return patch.render;
  }

  if (!regenerateRender) {
    return existingPage.render;
  }

  const nextContent = 'content' in patch ? patch.content : existingPage.content;
  return renderYooptaContent(nextContent);
}

function assertSlugAvailableInPageMap<TContent>(
  pagesById: Map<string, PageDoc<TContent>>,
  candidate: PageDoc<TContent>,
  projectRoot: string,
  lang: DocsLang,
): void {
  const duplicate = [...pagesById.values()].find(
    (page) => page.id !== candidate.id && page.slug === candidate.slug,
  );
  if (!duplicate) {
    return;
  }

  throw new ValidationError(`Duplicate slug "${candidate.slug}" detected.`, {
    entity: 'page-doc',
    rule: 'page-slug-unique-per-language',
    remediation: 'Choose a unique slug for the page within the same language.',
    metadata: {
      pageId: candidate.id,
      duplicatePageId: duplicate.id,
      slug: candidate.slug,
      lang,
      projectRoot,
    },
  });
}

async function persistBatchPages<TContent>(
  repository: ReturnType<typeof createDocsRepository>,
  projectRoot: string,
  lang: DocsLang,
  pages: Array<PageDoc<TContent>>,
): Promise<AuthoringBatchPagesResult<TContent>> {
  const persistedPages: Array<PageDoc<TContent>> = [];
  const files: string[] = [];

  for (const page of pages) {
    const persisted = await savePage(repository, lang, page);
    persistedPages.push(persisted);
    files.push(pageFilePath(projectRoot, lang, persisted.id));
  }

  return {
    count: persistedPages.length,
    files,
    pages: persistedPages,
  };
}

export async function createPage<TContent = unknown>(
  input: CreatePageInput<TContent>,
): Promise<AuthoringPageResult<TContent>> {
  assertValidAuthoringContent(input.page.content ?? {}, input.page.id);
  const { contract, repository } = await loadAuthoringContext(input.projectRoot, input.lang);
  const existingPage = await loadPage(repository, input.lang, input.page.id);
  if (existingPage) {
    throw new ValidationError(`Page "${input.page.id}" already exists.`, {
      entity: 'page-doc',
      rule: 'page-create-target-must-not-exist',
      remediation: 'Use a new page id for page_create, or use page_update to modify an existing page.',
      metadata: {
        lang: input.lang,
        pageId: input.page.id,
        projectRoot: contract.paths.projectRoot,
      },
    });
  }

  await assertSlugAvailable(contract.paths.projectRoot, input.lang, input.page.id, input.page.slug, () =>
    findPageBySlug<TContent>(repository, input.lang, input.page.slug),
  );

  const page = await savePage<TContent>(repository, input.lang, {
    ...validateAndNormalizeProjectPageCandidate<TContent>(
      {
        id: input.page.id,
        lang: input.lang,
        slug: input.page.slug,
        title: input.page.title,
        ...(input.page.description ? { description: input.page.description } : {}),
        ...(input.page.template ? { template: input.page.template } : {}),
        ...(input.page.metadata ? { metadata: input.page.metadata } : {}),
        ...(input.page.tags ? { tags: input.page.tags } : {}),
        status: input.page.status ?? 'draft',
        content: (input.page.content ?? {}) as TContent,
        ...(input.page.render ? { render: input.page.render } : {}),
        ...(input.page.review ? { review: input.page.review } : {}),
        updatedAt: currentTimestamp(),
      },
      input.lang,
      contract.config,
    ),
  });

  return {
    filePath: pageFilePath(contract.paths.projectRoot, input.lang, page.id),
    page,
  };
}

export async function createPagesBatch<TContent = unknown>(
  input: BatchCreatePagesInput<TContent>,
): Promise<AuthoringBatchPagesResult<TContent>> {
  const { contract, repository } = await loadAuthoringContext(input.projectRoot, input.lang);
  ensureUniqueBatchPageIds(
    input.pages.map((page) => page.id),
    'page-batch-create-page-ids-must-be-unique',
  );

  const existingPages = await listPages<TContent>(repository, input.lang);
  const pagesById = new Map(existingPages.map((page) => [page.id, page]));
  const timestamp = currentTimestamp();
  const plannedPages: Array<PageDoc<TContent>> = [];

  for (const pageInput of input.pages) {
    assertValidAuthoringContent(pageInput.content ?? {}, pageInput.id);
    if (pagesById.has(pageInput.id)) {
      throw new ValidationError(`Page "${pageInput.id}" already exists.`, {
        entity: 'page-doc',
        rule: 'page-create-target-must-not-exist',
        remediation: 'Use a new page id for page_batch_create, or use page_batch_update to modify existing pages.',
        metadata: {
          lang: input.lang,
          pageId: pageInput.id,
          projectRoot: contract.paths.projectRoot,
        },
      });
    }

    const candidate = validateAndNormalizeProjectPageCandidate<TContent>(
      {
        id: pageInput.id,
        lang: input.lang,
        slug: pageInput.slug,
        title: pageInput.title,
        ...(pageInput.description ? { description: pageInput.description } : {}),
        ...(pageInput.template ? { template: pageInput.template } : {}),
        ...(pageInput.metadata ? { metadata: pageInput.metadata } : {}),
        ...(pageInput.tags ? { tags: pageInput.tags } : {}),
        status: pageInput.status ?? 'draft',
        content: (pageInput.content ?? {}) as TContent,
        ...(pageInput.render ? { render: pageInput.render } : {}),
        ...(pageInput.review ? { review: pageInput.review } : {}),
        updatedAt: timestamp,
      },
      input.lang,
      contract.config,
    );
    assertSlugAvailableInPageMap(pagesById, candidate, contract.paths.projectRoot, input.lang);
    pagesById.set(candidate.id, candidate);
    plannedPages.push(candidate);
  }

  return persistBatchPages(repository, contract.paths.projectRoot, input.lang, plannedPages);
}

export async function updatePage<TContent = unknown>(
  input: UpdatePageInput<TContent>,
): Promise<AuthoringPageResult<TContent>> {
  if ('content' in input.patch) {
    assertValidAuthoringContent(input.patch.content, input.pageId);
  }
  const { contract, repository } = await loadAuthoringContext(input.projectRoot, input.lang);
  const existingPage = await loadPage<TContent>(repository, input.lang, input.pageId);
  if (!existingPage) {
    throw new ValidationError(`Page "${input.pageId}" not found.`, {
      entity: 'page-doc',
      rule: 'page-must-exist',
      remediation: 'Use page_list or page_find to inspect available pages before retrying.',
      metadata: {
        lang: input.lang,
        pageId: input.pageId,
        projectRoot: contract.paths.projectRoot,
      },
    });
  }

  const nextSlug = input.patch.slug ?? existingPage.slug;
  await assertSlugAvailable(contract.paths.projectRoot, input.lang, existingPage.id, nextSlug, () =>
    findPageBySlug<TContent>(repository, input.lang, nextSlug),
  );

  const page = await savePage<TContent>(
    repository,
    input.lang,
    validateAndNormalizeProjectPageCandidate<TContent>(
      {
        ...existingPage,
        ...input.patch,
        lang: input.lang,
        id: existingPage.id,
        status: existingPage.status,
        render: resolveNextRender(existingPage, input.patch, input.regenerateRender),
        updatedAt: currentTimestamp(),
      },
      input.lang,
      contract.config,
    ),
  );

  return {
    filePath: pageFilePath(contract.paths.projectRoot, input.lang, page.id),
    page,
  };
}

export async function updatePagesBatch<TContent = unknown>(
  input: BatchUpdatePagesInput<TContent>,
): Promise<AuthoringBatchPagesResult<TContent>> {
  const { contract, repository } = await loadAuthoringContext(input.projectRoot, input.lang);
  ensureUniqueBatchPageIds(
    input.updates.map((entry) => entry.pageId),
    'page-batch-update-page-ids-must-be-unique',
  );

  const existingPages = await listPages<TContent>(repository, input.lang);
  const pagesById = new Map(existingPages.map((page) => [page.id, page]));
  const timestamp = currentTimestamp();
  const plannedPages: Array<PageDoc<TContent>> = [];

  for (const entry of input.updates) {
    if ('content' in entry.patch) {
      assertValidAuthoringContent(entry.patch.content, entry.pageId);
    }
    const existingPage = pagesById.get(entry.pageId);
    if (!existingPage) {
      throw new ValidationError(`Page "${entry.pageId}" not found.`, {
        entity: 'page-doc',
        rule: 'page-must-exist',
        remediation: 'Use page_list or page_find to inspect available pages before retrying.',
        metadata: {
          lang: input.lang,
          pageId: entry.pageId,
          projectRoot: contract.paths.projectRoot,
        },
      });
    }

    const candidate = validateAndNormalizeProjectPageCandidate<TContent>(
      {
        ...existingPage,
        ...entry.patch,
        lang: input.lang,
        id: existingPage.id,
        status: existingPage.status,
        render: resolveNextRender(existingPage, entry.patch, entry.regenerateRender),
        updatedAt: timestamp,
      },
      input.lang,
      contract.config,
    );
    assertSlugAvailableInPageMap(pagesById, candidate, contract.paths.projectRoot, input.lang);
    pagesById.set(candidate.id, candidate);
    plannedPages.push(candidate);
  }

  return persistBatchPages(repository, contract.paths.projectRoot, input.lang, plannedPages);
}

export async function setPageStatus<TContent = unknown>(
  input: SetPageStatusInput,
): Promise<AuthoringPageResult<TContent>> {
  const { contract, repository } = await loadAuthoringContext(input.projectRoot, input.lang);
  const existingPage = await loadPage<TContent>(repository, input.lang, input.pageId);
  if (!existingPage) {
    throw new ValidationError(`Page "${input.pageId}" not found.`, {
      entity: 'page-doc',
      rule: 'page-must-exist',
      remediation: 'Use page_list or page_find to inspect available pages before retrying.',
      metadata: {
        lang: input.lang,
        pageId: input.pageId,
        projectRoot: contract.paths.projectRoot,
      },
    });
  }

  const page = await savePage<TContent>(
    repository,
    input.lang,
    validateAndNormalizeProjectPageCandidate<TContent>(
      {
        ...existingPage,
        status: input.status,
        updatedAt: currentTimestamp(),
      },
      input.lang,
      contract.config,
    ),
  );

  return {
    filePath: pageFilePath(contract.paths.projectRoot, input.lang, page.id),
    page,
  };
}

export async function setPageStatusesBatch<TContent = unknown>(
  input: BatchSetPageStatusesInput,
): Promise<AuthoringBatchPagesResult<TContent>> {
  const { contract, repository } = await loadAuthoringContext(input.projectRoot, input.lang);
  ensureUniqueBatchPageIds(
    input.updates.map((entry) => entry.pageId),
    'page-batch-status-page-ids-must-be-unique',
  );

  const existingPages = await listPages<TContent>(repository, input.lang);
  const pagesById = new Map(existingPages.map((page) => [page.id, page]));
  const timestamp = currentTimestamp();
  const plannedPages: Array<PageDoc<TContent>> = [];

  for (const entry of input.updates) {
    const existingPage = pagesById.get(entry.pageId);
    if (!existingPage) {
      throw new ValidationError(`Page "${entry.pageId}" not found.`, {
        entity: 'page-doc',
        rule: 'page-must-exist',
        remediation: 'Use page_list or page_find to inspect available pages before retrying.',
        metadata: {
          lang: input.lang,
          pageId: entry.pageId,
          projectRoot: contract.paths.projectRoot,
        },
      });
    }

    const candidate = validateAndNormalizeProjectPageCandidate<TContent>(
      {
        ...existingPage,
        status: entry.status,
        updatedAt: timestamp,
      },
      input.lang,
      contract.config,
    );
    pagesById.set(candidate.id, candidate);
    plannedPages.push(candidate);
  }

  return persistBatchPages(repository, contract.paths.projectRoot, input.lang, plannedPages);
}

export async function deleteAuthoredPage(
  input: DeletePageInput,
): Promise<AuthoringDeletePageResult> {
  const { contract, repository } = await loadAuthoringContext(input.projectRoot, input.lang);
  const result = await deletePageFromRepository(repository, input.lang, input.pageId);

  return {
    filePath: pageFilePath(contract.paths.projectRoot, input.lang, input.pageId),
    ...result,
  };
}

export async function setNavigation(
  input: SetNavigationInput,
): Promise<AuthoringNavigationResult> {
  const { contract, repository } = await loadAuthoringContext(input.projectRoot, input.lang);
  const pages = await listPages(repository, input.lang);
  const navigation = await saveNavigation(
    repository,
    input.lang,
    input.navigation,
    {
      existingPageIds: pages.map((page) => page.id),
      requiredTopLevelGroupIds: collectRequiredTopLevelGroupIds(contract),
    },
  );

  return {
    filePath: navigationFilePath(contract.paths.projectRoot, input.lang),
    navigation,
  };
}

export async function replaceNavigationItems(
  input: ReplaceNavigationItemsInput,
): Promise<AuthoringNavigationResult> {
  const { repository } = await loadAuthoringContext(input.projectRoot, input.lang);
  const existingNavigation = await loadNavigation(repository, input.lang);

  return setNavigation({
    projectRoot: input.projectRoot,
    lang: input.lang,
    navigation: {
      ...existingNavigation,
      items: input.items,
    },
  });
}

export async function insertNavigationItem(
  input: InsertNavigationItemInput,
): Promise<AuthoringNavigationResult> {
  const parentPath = parseNavigationItemPath(input.parentPath, 'parentPath');
  const { repository } = await loadAuthoringContext(input.projectRoot, input.lang);
  const existingNavigation = await loadNavigation(repository, input.lang);
  const nextItems = insertNavItemAtParent(
    cloneNavItems(existingNavigation.items),
    parentPath,
    input.item,
    input.index,
  );

  return setNavigation({
    projectRoot: input.projectRoot,
    lang: input.lang,
    navigation: {
      ...existingNavigation,
      items: nextItems,
    },
  });
}

export async function deleteNavigationItem(
  input: DeleteNavigationItemInput,
): Promise<AuthoringNavigationResult> {
  const itemPath = parseNavigationItemPath(input.itemPath, 'itemPath');
  const { repository } = await loadAuthoringContext(input.projectRoot, input.lang);
  const existingNavigation = await loadNavigation(repository, input.lang);
  const nextItems = removeNavItemAtPath(cloneNavItems(existingNavigation.items), itemPath).items;

  return setNavigation({
    projectRoot: input.projectRoot,
    lang: input.lang,
    navigation: {
      ...existingNavigation,
      items: nextItems,
    },
  });
}

export async function moveNavigationItem(
  input: MoveNavigationItemInput,
): Promise<AuthoringNavigationResult> {
  const itemPath = parseNavigationItemPath(input.itemPath, 'itemPath');
  const parentPath = parseNavigationItemPath(input.parentPath, 'parentPath');
  if (isDescendantPath(parentPath, itemPath) || isSamePath(parentPath, itemPath)) {
    throw createNavigationPathError(
      'navigation-move-target-must-not-be-source-descendant',
      'Move a navigation item to the root or to a different section/folder outside the moved subtree.',
      { itemPath: input.itemPath, parentPath: input.parentPath ?? '' },
    );
  }

  const { repository } = await loadAuthoringContext(input.projectRoot, input.lang);
  const existingNavigation = await loadNavigation(repository, input.lang);
  const removed = removeNavItemAtPath(cloneNavItems(existingNavigation.items), itemPath);
  let nextIndex = input.index;
  if (
    nextIndex != null &&
    isSamePath(removed.parentPath, parentPath) &&
    removed.removedIndex < nextIndex
  ) {
    nextIndex -= 1;
  }

  const nextItems = insertNavItemAtParent(
    removed.items,
    parentPath,
    removed.removedItem,
    nextIndex,
  );

  return setNavigation({
    projectRoot: input.projectRoot,
    lang: input.lang,
    navigation: {
      ...existingNavigation,
      items: nextItems,
    },
  });
}

export async function setProjectLanguages(
  input: SetProjectLanguagesInput,
): Promise<AuthoringProjectConfigResult> {
  const result = await updateProjectConfig(
    input.projectRoot,
    {
      languages: input.languages,
      ...(input.defaultLanguage ? { defaultLanguage: input.defaultLanguage } : {}),
    },
  );
  if (!result.ok) {
    throw result.error;
  }

  const contractResult = await loadProjectContract(input.projectRoot);
  if (!contractResult.ok) {
    throw contractResult.error;
  }

  return {
    filePath: contractResult.value.paths.configFile,
    config: result.value,
  };
}
