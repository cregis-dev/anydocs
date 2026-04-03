import type { DocsLang, PageStatus } from '../types/docs.ts';
import { ValidationError } from '../errors/validation-error.ts';
import { loadProjectContract } from '../fs/content-repository.ts';
import { createDocsRepository, listPages, loadPage } from '../fs/docs-repository.ts';
import { createPage, type AuthoringPageResult } from './authoring-service.ts';

export type ClonePageToLanguageInput = {
  projectRoot: string;
  sourceLang: DocsLang;
  targetLang: DocsLang;
  sourcePageId: string;
  includeContent?: boolean;
};

export type TranslationStatusEntry = {
  pageId: string;
  sourcePageId?: string;
  targetPageId?: string;
  sourceStatus?: PageStatus;
  targetStatus?: PageStatus;
  relation: 'matched' | 'missing_target' | 'missing_source';
};

function assertLanguagePair(sourceLang: DocsLang, targetLang: DocsLang) {
  if (sourceLang === targetLang) {
    throw new ValidationError('Source and target languages must differ for multilingual operations.', {
      entity: 'page-doc',
      rule: 'multilingual-language-pair-must-differ',
      remediation: 'Choose different sourceLang and targetLang values.',
      metadata: { sourceLang, targetLang },
    });
  }
}

async function loadProjectLanguages(projectRoot: string): Promise<DocsLang[]> {
  const contractResult = await loadProjectContract(projectRoot);
  if (!contractResult.ok) {
    throw contractResult.error;
  }

  return contractResult.value.config.languages;
}

function assertLanguageEnabled(languages: DocsLang[], lang: DocsLang, role: 'sourceLang' | 'targetLang') {
  if (!languages.includes(lang)) {
    throw new ValidationError(`Language "${lang}" is not enabled for ${role}.`, {
      entity: 'project-config',
      rule: 'project-language-must-be-enabled',
      remediation: `Enable "${lang}" in the project before running multilingual page operations.`,
      metadata: { role, lang, enabledLanguages: languages },
    });
  }
}

export async function clonePageToLanguage<TContent = unknown>(
  input: ClonePageToLanguageInput,
): Promise<AuthoringPageResult<TContent>> {
  assertLanguagePair(input.sourceLang, input.targetLang);
  const languages = await loadProjectLanguages(input.projectRoot);
  assertLanguageEnabled(languages, input.sourceLang, 'sourceLang');
  assertLanguageEnabled(languages, input.targetLang, 'targetLang');

  const repository = createDocsRepository(input.projectRoot);
  const sourcePage = await loadPage<TContent>(repository, input.sourceLang, input.sourcePageId);
  if (!sourcePage) {
    throw new ValidationError(`Source page "${input.sourcePageId}" does not exist.`, {
      entity: 'page-doc',
      rule: 'page-source-must-exist',
      remediation: 'Create the source page before cloning it into another language.',
      metadata: {
        sourceLang: input.sourceLang,
        sourcePageId: input.sourcePageId,
      },
    });
  }

  return createPage<TContent>({
    projectRoot: input.projectRoot,
    lang: input.targetLang,
    page: {
      id: sourcePage.id,
      slug: sourcePage.slug,
      title: sourcePage.title,
      ...(sourcePage.description ? { description: sourcePage.description } : {}),
      ...(sourcePage.template ? { template: sourcePage.template } : {}),
      ...(sourcePage.metadata ? { metadata: sourcePage.metadata } : {}),
      ...(sourcePage.tags ? { tags: sourcePage.tags } : {}),
      ...(input.includeContent ? { content: sourcePage.content } : {}),
      ...(input.includeContent && sourcePage.render ? { render: sourcePage.render } : {}),
      status: 'draft',
    },
  });
}

export async function listTranslationStatus(
  projectRoot: string,
  sourceLang: DocsLang,
  targetLang: DocsLang,
): Promise<TranslationStatusEntry[]> {
  assertLanguagePair(sourceLang, targetLang);
  const languages = await loadProjectLanguages(projectRoot);
  assertLanguageEnabled(languages, sourceLang, 'sourceLang');
  assertLanguageEnabled(languages, targetLang, 'targetLang');

  const repository = createDocsRepository(projectRoot);
  const [sourcePages, targetPages] = await Promise.all([
    listPages(repository, sourceLang),
    listPages(repository, targetLang),
  ]);
  const sourceById = new Map(sourcePages.map((page) => [page.id, page]));
  const targetById = new Map(targetPages.map((page) => [page.id, page]));
  const pageIds = [...new Set([...sourceById.keys(), ...targetById.keys()])].sort();

  return pageIds.map((pageId) => {
    const sourcePage = sourceById.get(pageId);
    const targetPage = targetById.get(pageId);

    return {
      pageId,
      ...(sourcePage ? { sourcePageId: sourcePage.id, sourceStatus: sourcePage.status } : {}),
      ...(targetPage ? { targetPageId: targetPage.id, targetStatus: targetPage.status } : {}),
      relation: sourcePage && targetPage ? 'matched' : sourcePage ? 'missing_target' : 'missing_source',
    } satisfies TranslationStatusEntry;
  });
}
