import path from 'node:path';

import { ValidationError } from '../errors/validation-error.ts';
import {
  createDocsRepository,
  findPageBySlug,
  listPages,
  loadPage,
  loadProjectContract,
  loadNavigation,
  savePage,
  saveNavigation,
} from '../fs/index.ts';
import type { DocsLang, NavigationDoc, PageDoc, PageRender, PageReview, PageStatus } from '../types/docs.ts';

export type CreatePageInput<TContent = unknown> = {
  projectRoot: string;
  lang: DocsLang;
  page: {
    id: string;
    slug: string;
    title: string;
    description?: string;
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
};

export type SetPageStatusInput = {
  projectRoot: string;
  lang: DocsLang;
  pageId: string;
  status: PageStatus;
};

export type AuthoringPageResult<TContent = unknown> = {
  filePath: string;
  page: PageDoc<TContent>;
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

function pageFilePath(projectRoot: string, lang: DocsLang, pageId: string): string {
  return path.join(projectRoot, 'pages', lang, `${pageId}.json`);
}

function currentTimestamp(): string {
  return new Date().toISOString();
}

function collectRequiredTopLevelGroupIds(contract: Awaited<ReturnType<typeof loadAuthoringContext>>['contract']): string[] {
  return (contract.config.site.navigation?.topNav ?? [])
    .filter((item) => item.type === 'nav-group')
    .map((item) => item.groupId);
}

function navigationFilePath(projectRoot: string, lang: DocsLang): string {
  return path.join(projectRoot, 'navigation', `${lang}.json`);
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

export async function createPage<TContent = unknown>(
  input: CreatePageInput<TContent>,
): Promise<AuthoringPageResult<TContent>> {
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
    id: input.page.id,
    lang: input.lang,
    slug: input.page.slug,
    title: input.page.title,
    description: input.page.description,
    tags: input.page.tags,
    status: input.page.status ?? 'draft',
    content: (input.page.content ?? {}) as TContent,
    render: input.page.render,
    review: input.page.review,
    updatedAt: currentTimestamp(),
  });

  return {
    filePath: pageFilePath(contract.paths.projectRoot, input.lang, page.id),
    page,
  };
}

export async function updatePage<TContent = unknown>(
  input: UpdatePageInput<TContent>,
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

  const nextSlug = input.patch.slug ?? existingPage.slug;
  await assertSlugAvailable(contract.paths.projectRoot, input.lang, existingPage.id, nextSlug, () =>
    findPageBySlug<TContent>(repository, input.lang, nextSlug),
  );

  const page = await savePage<TContent>(repository, input.lang, {
    ...existingPage,
    ...input.patch,
    lang: input.lang,
    id: existingPage.id,
    status: existingPage.status,
    updatedAt: currentTimestamp(),
  });

  return {
    filePath: pageFilePath(contract.paths.projectRoot, input.lang, page.id),
    page,
  };
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

  const page = await savePage<TContent>(repository, input.lang, {
    ...existingPage,
    status: input.status,
    updatedAt: currentTimestamp(),
  });

  return {
    filePath: pageFilePath(contract.paths.projectRoot, input.lang, page.id),
    page,
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
