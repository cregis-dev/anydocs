import path from 'node:path';

import {
  createApiSourceRepository,
  createDefaultProjectConfig,
  createDocsRepository,
  deleteApiSource,
  deletePage,
  docContentToYoopta,
  DEFAULT_PROJECT_ID,
  initializeApiSourceRepository,
  initializeProject,
  listApiSources,
  listPages,
  loadNavigation,
  loadPage,
  loadProjectContract,
  normalizeSlug,
  runBuildWorkflow,
  runPreviewWorkflow,
  saveApiSource,
  saveNavigation,
  savePage,
  updateProjectConfig,
  validateDocContentV1,
  yooptaToDocContent,
  type ApiSourceDoc,
  type ApiSourceRepository,
  type BuildWorkflowResult,
  type DeletePageResult,
  type DocsLang,
  type DocsRepository,
  type NavigationDoc,
  type PageDoc,
  type ProjectConfig,
  type ProjectContract,
} from '../../../core/dist/index.js';

import type { StudioPageCreateInput, StudioProjectScope, StudioProjectSettingsPatch } from '../types.ts';
import { getActivePreviewEntry, registerPreview, stopAllActivePreviews } from '../runtime/preview-registry.ts';

function resolveRepoRoot(scope: StudioProjectScope = {}, defaultProjectRoot?: string): string {
  if (!scope.projectPath && !defaultProjectRoot) {
    return process.cwd();
  }

  return path.resolve(scope.projectPath ?? defaultProjectRoot ?? process.cwd());
}

function resolveProjectId(scope: StudioProjectScope = {}): string {
  return scope.projectId || DEFAULT_PROJECT_ID;
}

async function resolveProjectContract(
  scope: StudioProjectScope = {},
  defaultProjectRoot?: string,
): Promise<ProjectContract> {
  const result = await loadProjectContract(
    resolveRepoRoot(scope, defaultProjectRoot),
    scope.projectPath ? undefined : resolveProjectId(scope),
  );
  if (!result.ok) {
    throw result.error;
  }

  return result.value;
}

async function getDocsRepository(
  scope: StudioProjectScope = {},
  defaultProjectRoot?: string,
): Promise<DocsRepository> {
  const contract = await resolveProjectContract(scope, defaultProjectRoot);
  return createDocsRepository(contract.paths.projectRoot);
}

function derivePageIdFromSlug(slug: string): string {
  const normalized = normalizeSlug(slug);
  const fallback = `page-${Date.now().toString(36)}`;
  const leaf = normalized.split('/').filter(Boolean).at(-1) ?? fallback;
  const safe = leaf
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return safe || fallback;
}

function toStudioPageDoc(page: PageDoc<unknown>): PageDoc {
  const canonical = validateDocContentV1(page.content);

  return {
    ...page,
    content: canonical.ok ? docContentToYoopta(page.content as Parameters<typeof docContentToYoopta>[0]) : page.content,
  };
}

function toStoredPageDoc(page: PageDoc): PageDoc<unknown> {
  return {
    ...page,
    content: yooptaToDocContent(page.content),
  };
}

export async function getProject(
  scope: StudioProjectScope = {},
  defaultProjectRoot?: string,
): Promise<ProjectContract> {
  return resolveProjectContract(scope, defaultProjectRoot);
}

export async function getPages(
  lang: DocsLang,
  scope: StudioProjectScope = {},
  defaultProjectRoot?: string,
): Promise<{ pages: PageDoc[] }> {
  return {
    pages: (await listPages(await getDocsRepository(scope, defaultProjectRoot), lang)).map((page) => toStudioPageDoc(page)),
  };
}

export async function getPage(
  lang: DocsLang,
  pageId: string,
  scope: StudioProjectScope = {},
  defaultProjectRoot?: string,
): Promise<PageDoc> {
  const page = await loadPage(await getDocsRepository(scope, defaultProjectRoot), lang, pageId);
  if (!page) {
    throw new Error(`Page "${pageId}" not found.`);
  }

  return toStudioPageDoc(page);
}

export async function putPage(
  lang: DocsLang,
  page: PageDoc,
  scope: StudioProjectScope = {},
  defaultProjectRoot?: string,
): Promise<PageDoc> {
  const saved = await savePage(await getDocsRepository(scope, defaultProjectRoot), lang, toStoredPageDoc(page));

  return toStudioPageDoc(saved);
}

export async function postPage(
  lang: DocsLang,
  input: StudioPageCreateInput,
  scope: StudioProjectScope = {},
  defaultProjectRoot?: string,
): Promise<PageDoc> {
  const normalizedSlug = normalizeSlug(input.slug);
  const title = input.title.trim() || 'Untitled';

  return savePage(await getDocsRepository(scope, defaultProjectRoot), lang, {
    id: derivePageIdFromSlug(normalizedSlug),
    lang,
    slug: normalizedSlug,
    title,
    status: 'draft',
    content: {
      version: 1,
      blocks: [],
    },
    render: {
      markdown: `# ${title}`,
      plainText: title,
    },
  }).then((page) => toStudioPageDoc(page));
}

export async function removePage(
  lang: DocsLang,
  pageId: string,
  scope: StudioProjectScope = {},
  defaultProjectRoot?: string,
): Promise<DeletePageResult> {
  return deletePage(await getDocsRepository(scope, defaultProjectRoot), lang, pageId);
}

export async function getNavigation(
  lang: DocsLang,
  scope: StudioProjectScope = {},
  defaultProjectRoot?: string,
): Promise<NavigationDoc> {
  return loadNavigation(await getDocsRepository(scope, defaultProjectRoot), lang);
}

export async function putNavigation(
  lang: DocsLang,
  navigation: NavigationDoc,
  scope: StudioProjectScope = {},
  defaultProjectRoot?: string,
): Promise<NavigationDoc> {
  const repository = await getDocsRepository(scope, defaultProjectRoot);
  const pages = await listPages(repository, lang);

  return saveNavigation(repository, lang, navigation, {
    existingPageIds: pages.map((page) => page.id),
  });
}

async function getApiSourceRepository(
  scope: StudioProjectScope = {},
  defaultProjectRoot?: string,
): Promise<ApiSourceRepository> {
  const contract = await resolveProjectContract(scope, defaultProjectRoot);
  return createApiSourceRepository(contract.paths.projectRoot);
}

export async function getApiSources(
  scope: StudioProjectScope = {},
  defaultProjectRoot?: string,
): Promise<{ sources: ApiSourceDoc[] }> {
  return {
    sources: await listApiSources(await getApiSourceRepository(scope, defaultProjectRoot)),
  };
}

export async function putApiSources(
  input: { sources?: ApiSourceDoc[] } | ApiSourceDoc[],
  scope: StudioProjectScope = {},
  defaultProjectRoot?: string,
): Promise<{ sources: ApiSourceDoc[] }> {
  const repository = await getApiSourceRepository(scope, defaultProjectRoot);
  await initializeApiSourceRepository(repository);

  const nextSources = Array.isArray(input) ? input : (input.sources ?? []);
  const existing = await listApiSources(repository);
  const nextIds = new Set(nextSources.map((source) => source.id));

  for (const source of nextSources) {
    await saveApiSource(repository, source);
  }

  for (const source of existing) {
    if (!nextIds.has(source.id)) {
      await deleteApiSource(repository, source.id);
    }
  }

  return {
    sources: await listApiSources(repository),
  };
}

export async function putProject(
  patch: StudioProjectSettingsPatch,
  scope: StudioProjectScope = {},
  defaultProjectRoot?: string,
): Promise<ProjectContract> {
  const contract = await resolveProjectContract(scope, defaultProjectRoot);
  const themePatch = patch.site?.theme;
  const currentSite = contract.config.site;
  const currentTheme = contract.config.site.theme;
  const navigationPatch = patch.site?.navigation;
  const nextPatch: Partial<ProjectConfig> = {
    ...(patch.name !== undefined ? { name: patch.name } : {}),
    ...(patch.languages !== undefined ? { languages: patch.languages } : {}),
    ...(patch.defaultLanguage !== undefined ? { defaultLanguage: patch.defaultLanguage } : {}),
    ...(patch.build !== undefined ? { build: patch.build } : {}),
    ...((themePatch || navigationPatch)
      ? {
          site: {
            ...currentSite,
            theme: {
              ...currentTheme,
              ...(themePatch?.id !== undefined ? { id: themePatch.id } : {}),
              ...(themePatch?.branding !== undefined ? { branding: themePatch.branding } : {}),
              ...(themePatch?.chrome !== undefined ? { chrome: themePatch.chrome } : {}),
              ...(themePatch?.colors !== undefined ? { colors: themePatch.colors } : {}),
              ...(themePatch?.codeTheme !== undefined ? { codeTheme: themePatch.codeTheme } : {}),
            },
            ...(navigationPatch !== undefined
              ? {
                  navigation:
                    navigationPatch.topNav && navigationPatch.topNav.length > 0
                      ? { topNav: navigationPatch.topNav }
                      : undefined,
                }
              : {}),
          },
        }
      : {}),
  };
  const result = await updateProjectConfig(
    resolveRepoRoot(scope, defaultProjectRoot),
    nextPatch,
    contract.config.projectId,
  );
  if (!result.ok) {
    throw result.error;
  }

  return resolveProjectContract({ projectId: contract.config.projectId, projectPath: scope.projectPath }, defaultProjectRoot);
}

export async function postBuild(
  scope: StudioProjectScope = {},
  defaultProjectRoot?: string,
): Promise<Pick<BuildWorkflowResult, 'artifactRoot' | 'languages'>> {
  const contract = await resolveProjectContract(scope, defaultProjectRoot);
  await stopAllActivePreviews();

  const result = await runBuildWorkflow({
    repoRoot: contract.paths.repoRoot,
    projectId: contract.config.projectId,
  });

  return {
    artifactRoot: result.artifactRoot,
    languages: result.languages,
  };
}

export async function postPreview(
  scope: StudioProjectScope = {},
  defaultProjectRoot?: string,
): Promise<{ docsPath: string; previewUrl: string }> {
  const contract = await resolveProjectContract(scope, defaultProjectRoot);
  const projectRoot = contract.paths.projectRoot;

  await stopAllActivePreviews();

  const result = await runPreviewWorkflow({
    repoRoot: contract.paths.repoRoot,
    projectId: contract.config.projectId,
  });
  const entry = registerPreview(projectRoot, result);
  const activePreview = getActivePreviewEntry(projectRoot) ?? entry;

  return {
    docsPath: activePreview.docsPath,
    previewUrl: activePreview.previewUrl,
  };
}

export async function postPreviewStop(): Promise<{ stopped: number }> {
  const stopped = await stopAllActivePreviews();
  return { stopped };
}

export async function ensureProject(projectPath: string): Promise<ProjectContract> {
  const resolvedPath = path.resolve(projectPath);
  const contract = await loadProjectContract(resolvedPath);
  if (contract.ok) {
    return contract.value;
  }

  const result = await initializeProject({
    repoRoot: resolvedPath,
    projectId: createDefaultProjectConfig().projectId,
  });

  return result.contract;
}
