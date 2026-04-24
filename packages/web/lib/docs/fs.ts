import 'server-only';

import { promises as fs } from 'node:fs';
import path from 'node:path';

import {
  createApiSourceRepository,
  createDocsRepository,
  docContentToYoopta,
  deleteApiSource as deleteApiSourceFromRepository,
  deletePage as deletePageFromRepository,
  findPageBySlug as findPageBySlugInRepository,
  DEFAULT_PROJECT_ID,
  initializeProject,
  initializeApiSourceRepository,
  listApiSources as listApiSourcesInRepository,
  listPages as listPagesInRepository,
  loadProjectContract,
  loadNavigation as loadNavigationFromRepository,
  loadPage as loadPageFromRepository,
  normalizeSlug,
  saveApiSource as saveApiSourceToRepository,
  saveNavigation as saveNavigationToRepository,
  savePage as savePageToRepository,
  validateDocContentV1,
  ValidationError,
  yooptaToDocContent,
  type ApiSourceDoc,
  type PageDoc as CorePageDoc,
  type ProjectConfig,
  type ProjectSiteTopNavItem,
  updateProjectConfig,
} from '@anydocs/core';
import type { DocsLang, NavigationDoc, PageDoc } from '@/lib/docs/types';
import { assertValidYooptaContentValue } from '@/lib/docs/yoopta-content';

export const runtime = 'nodejs';

const CONFIG_FILE = '.docstudio.json';

interface StudioConfig {
  projectsRoot?: string;
}

interface ConfigCacheEntry {
  config: StudioConfig;
  mtime: number;
}

let configCache: ConfigCacheEntry | null = null;

async function loadConfig(): Promise<StudioConfig> {
  const configPath = path.join(process.cwd(), CONFIG_FILE);
  try {
    const stat = await fs.stat(configPath);
    const mtime = stat.mtimeMs;
    if (configCache && configCache.mtime === mtime) {
      return configCache.config;
    }
    const content = await fs.readFile(configPath, 'utf-8');
    const config = JSON.parse(content) as StudioConfig;
    configCache = { config, mtime };
    return config;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
      configCache = { config: {}, mtime: 0 };
      return {};
    }
    throw e;
  }
}

function repoRoot() {
  return process.cwd();
}

function resolveWorkspaceRoot(config: StudioConfig, customPath?: string): string {
  if (!customPath) {
    return repoRoot();
  }

  if (path.isAbsolute(customPath)) {
    return customPath;
  }

  return config.projectsRoot ? path.join(config.projectsRoot, customPath) : customPath;
}

async function resolveCanonicalProject(projectId: string = DEFAULT_PROJECT_ID, customPath?: string) {
  const config = await loadConfig();
  const workspaceRoot = resolveWorkspaceRoot(config, customPath);
  const resolvedProjectId = customPath ? undefined : projectId || undefined;
  const contract = await loadProjectContract(workspaceRoot, resolvedProjectId);

  if (contract.ok) {
    return contract.value;
  }

  throw contract.error;
}

export type StudioProjectContract = Awaited<ReturnType<typeof resolveCanonicalProject>>;

export async function getStudioExecutionContext(projectId: string = '', customPath?: string) {
  const config = await loadConfig();
  const contract = await resolveCanonicalProject(projectId || DEFAULT_PROJECT_ID, customPath);
  return {
    repoRoot: resolveWorkspaceRoot(config, customPath),
    projectId: contract.config.projectId,
  };
}

// 获取项目根目录
// customPath 是用户选择的文件夹名称，与配置的 projectsRoot 拼接
async function getProjectRoot(projectId: string = '', customPath?: string) {
  return (await resolveCanonicalProject(projectId || DEFAULT_PROJECT_ID, customPath)).paths.projectRoot;
}

// 获取项目构建产物目录
export async function getProjectBuildRoot(projectId: string = '', customPath?: string) {
  return (await resolveCanonicalProject(projectId || DEFAULT_PROJECT_ID, customPath)).paths.artifactRoot;
}

export async function loadStudioProjectContract(projectId: string = '', customPath?: string) {
  return resolveCanonicalProject(projectId || DEFAULT_PROJECT_ID, customPath);
}

async function getDocsRepository(projectId: string = '', customPath?: string) {
  return createDocsRepository(await getProjectRoot(projectId, customPath));
}

async function getApiSourceRepository(projectId: string = '', customPath?: string) {
  return createApiSourceRepository(await getProjectRoot(projectId, customPath));
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

function assertValidStoredPageContent(value: unknown): void {
  const canonical = validateDocContentV1(value);
  if (canonical.ok) {
    return;
  }

  assertValidYooptaContentValue(value);
}

function toStudioPageDoc(page: CorePageDoc<unknown>): PageDoc {
  const canonical = validateDocContentV1(page.content);

  return {
    ...page,
    content: canonical.ok ? docContentToYoopta(page.content as Parameters<typeof docContentToYoopta>[0]) : page.content,
  } as PageDoc;
}

function toStoredPageDoc(page: PageDoc): CorePageDoc<unknown> {
  return {
    ...page,
    content: yooptaToDocContent(page.content),
  };
}

// 根据文件夹名称获取完整项目路径
export async function getProjectPathByFolderName(folderName: string): Promise<string> {
  const config = await loadConfig();
  if (config.projectsRoot) {
    return path.join(config.projectsRoot, folderName);
  }
  return folderName;
}

// Stub function for listProjects - used by API routes.
// Desktop mode resolves projects through the local desktop runtime instead.
export async function listProjects(): Promise<string[]> {
  return [];
}

export async function createProject(folderName: string) {
  const projectPath = await getProjectPathByFolderName(folderName);

  if (!projectPath || projectPath.includes('..')) throw new Error('invalid project path');

  const existingContract = await loadProjectContract(projectPath);
  if (existingContract.ok) {
    return existingContract.value;
  }

  return initializeProject({ repoRoot: projectPath });
}

export async function loadNavigation(lang: DocsLang, projectId: string = '', customPath?: string): Promise<NavigationDoc> {
  return loadNavigationFromRepository(await getDocsRepository(projectId, customPath), lang);
}

export async function saveNavigation(lang: DocsLang, nav: NavigationDoc, projectId: string = '', customPath?: string) {
  const repository = await getDocsRepository(projectId, customPath);
  const contract = await resolveCanonicalProject(projectId || DEFAULT_PROJECT_ID, customPath);
  const pages = await listPagesInRepository(repository, lang, {
    validateContent: assertValidStoredPageContent,
  });
  const requiredTopLevelGroupIds = (contract.config.site.navigation?.topNav ?? [])
    .filter((item): item is Extract<ProjectSiteTopNavItem, { type: 'nav-group' }> => item.type === 'nav-group')
    .map((item) => item.groupId);
  return saveNavigationToRepository(repository, lang, nav, {
    existingPageIds: pages.map((page) => page.id),
    requiredTopLevelGroupIds,
  });
}

export async function listPages(lang: DocsLang, projectId: string = '', customPath?: string): Promise<PageDoc[]> {
  const pages = await listPagesInRepository(await getDocsRepository(projectId, customPath), lang, {
    validateContent: assertValidStoredPageContent,
  });

  return pages.map((page) => toStudioPageDoc(page));
}

export async function listPublishedPagesRaw(
  lang: DocsLang,
  projectId: string = '',
  customPath?: string,
): Promise<CorePageDoc<unknown>[]> {
  return listPagesInRepository(await getDocsRepository(projectId, customPath), lang, {
    validateContent: assertValidStoredPageContent,
  });
}

export async function loadPage(lang: DocsLang, pageId: string, projectId: string = '', customPath?: string): Promise<PageDoc | null> {
  const page = await loadPageFromRepository(await getDocsRepository(projectId, customPath), lang, pageId, {
    validateContent: assertValidStoredPageContent,
  });

  return page ? toStudioPageDoc(page) : null;
}

export async function loadPublishedPageRaw(
  lang: DocsLang,
  pageId: string,
  projectId: string = '',
  customPath?: string,
): Promise<CorePageDoc<unknown> | null> {
  return loadPageFromRepository(await getDocsRepository(projectId, customPath), lang, pageId, {
    validateContent: assertValidStoredPageContent,
  });
}

export async function savePage(lang: DocsLang, page: PageDoc, projectId: string = '', customPath?: string) {
  const saved = await savePageToRepository(
    await getDocsRepository(projectId, customPath),
    lang,
    toStoredPageDoc(page),
    {
      validateContent: assertValidStoredPageContent,
    },
  );

  return toStudioPageDoc(saved);
}

export async function deletePage(lang: DocsLang, pageId: string, projectId: string = '', customPath?: string) {
  return deletePageFromRepository(await getDocsRepository(projectId, customPath), lang, pageId);
}

export async function createPage(
  lang: DocsLang,
  input: {
    slug: string;
    title: string;
    projectId?: string;
    customPath?: string;
  },
): Promise<PageDoc> {
  const normalizedSlug = normalizeSlug(input.slug);
  const title = input.title.trim() || 'Untitled';
  const repository = await getDocsRepository(input.projectId, input.customPath);
  const pageId = derivePageIdFromSlug(normalizedSlug);

  const existing = await loadPageFromRepository(repository, lang, pageId);
  if (existing !== null) {
    throw new ValidationError(`Page "${pageId}" already exists.`, {
      entity: 'page-doc',
      rule: 'page-id-unique-per-language',
      remediation: 'Use PUT /api/local/page to update an existing page, or choose a different slug.',
      metadata: { pageId, slug: normalizedSlug, lang },
    });
  }

  return savePageToRepository(
    repository,
    lang,
    {
      id: pageId,
      lang,
      slug: normalizedSlug,
      title,
      status: 'draft',
      updatedAt: new Date().toISOString(),
      content: {
        version: 1,
        blocks: [],
      },
      render: {
        markdown: `# ${title}`,
        plainText: title,
      },
    },
    {
      validateContent: assertValidStoredPageContent,
    },
  ).then((page) => toStudioPageDoc(page));
}

export async function updateStudioProjectSettings(
  patch: {
    name?: string;
    languages?: DocsLang[];
    defaultLanguage?: DocsLang;
    site?: {
      url?: string;
      theme?: {
        id?: string;
        branding?: {
          siteTitle?: string;
          homeLabel?: string;
          logoSrc?: string;
          logoAlt?: string;
        };
        chrome?: {
          showSearch?: boolean;
        };
        colors?: {
          primary?: string;
          primaryForeground?: string;
          accent?: string;
          accentForeground?: string;
          sidebarActive?: string;
          sidebarActiveForeground?: string;
        };
        codeTheme?: 'github-light' | 'github-dark';
      };
      navigation?: {
        topNav?: ProjectSiteTopNavItem[];
      };
    };
    build?: {
      outputDir?: string;
    };
  },
  projectId: string = '',
  customPath?: string,
) {
  const resolvedProject = await resolveCanonicalProject(projectId || DEFAULT_PROJECT_ID, customPath);
  const { url: currentUrl, ...currentSiteRest } = resolvedProject.config.site;
  const currentTheme = resolvedProject.config.site.theme;
  const themePatch = patch.site?.theme;
  const navigationPatch = patch.site?.navigation;
  const nextUrl =
    patch.site?.url !== undefined
      ? patch.site.url.trim() || undefined
      : currentUrl;
  const nextPatch: Partial<ProjectConfig> = {
    ...(patch.name !== undefined ? { name: patch.name } : {}),
    ...(patch.languages !== undefined ? { languages: patch.languages } : {}),
    ...(patch.defaultLanguage !== undefined ? { defaultLanguage: patch.defaultLanguage } : {}),
    ...(patch.build !== undefined ? { build: patch.build } : {}),
    ...((patch.site?.url !== undefined || themePatch || navigationPatch)
      ? {
          site: {
            ...currentSiteRest,
            ...(nextUrl !== undefined ? { url: nextUrl } : {}),
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
    resolveWorkspaceRoot(await loadConfig(), customPath),
    nextPatch,
    resolvedProject.config.projectId,
  );

  if (!result.ok) {
    throw result.error;
  }

  return result.value;
}

export async function listStudioApiSources(projectId: string = '', customPath?: string): Promise<ApiSourceDoc[]> {
  return listApiSourcesInRepository(await getApiSourceRepository(projectId, customPath));
}

export async function replaceStudioApiSources(
  apiSources: ApiSourceDoc[],
  projectId: string = '',
  customPath?: string,
): Promise<ApiSourceDoc[]> {
  const repository = await getApiSourceRepository(projectId, customPath);
  await initializeApiSourceRepository(repository);

  const existing = await listApiSourcesInRepository(repository);
  const nextIds = new Set(apiSources.map((source) => source.id));

  for (const source of apiSources) {
    await saveApiSourceToRepository(repository, source);
  }

  for (const source of existing) {
    if (!nextIds.has(source.id)) {
      await deleteApiSourceFromRepository(repository, source.id);
    }
  }

  return listApiSourcesInRepository(repository);
}

export async function findPageBySlug(lang: DocsLang, slug: string, projectId: string = '', customPath?: string): Promise<PageDoc | null> {
  const page = await findPageBySlugInRepository(await getDocsRepository(projectId, customPath), lang, slug, {
    validateContent: assertValidStoredPageContent,
  });

  return page ? toStudioPageDoc(page) : null;
}

export async function findPublishedPageBySlugRaw(
  lang: DocsLang,
  slug: string,
  projectId: string = '',
  customPath?: string,
): Promise<CorePageDoc<unknown> | null> {
  return findPageBySlugInRepository(await getDocsRepository(projectId, customPath), lang, slug, {
    validateContent: assertValidStoredPageContent,
  });
}

export { normalizeSlug };
