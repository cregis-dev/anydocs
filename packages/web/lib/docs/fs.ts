import 'server-only';

import { promises as fs } from 'node:fs';
import path from 'node:path';

import {
  createApiSourceRepository,
  createDocsRepository,
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
  query as queryAuditLogInService,
  rollback as rollbackAuditInService,
  type AuditEntry,
  type AuditQuery,
  type AuditQueryResult,
  // `yooptaToDocContent` + `assertValidYooptaContentValue` stay in the
  // dep graph for the Story 7.3 lazy-migration path — pages still on
  // disk in legacy Yoopta shape are converted forward on read. The
  // forward converter (`docContentToYoopta`) is gone — every save now
  // emits canonical DocContentV1 verbatim.
  yooptaToDocContent,
  assertValidYooptaContentValue,
  type ApiSourceDoc,
  type PageDoc as CorePageDoc,
  type ProjectConfig,
  type ProjectSiteTopNavItem,
  updateProjectConfig,
} from '@anydocs/core';
import type { DocContentV1 } from '@anydocs/core/content';
import type { DocsLang, NavigationDoc, PageDoc } from '@/lib/docs/types';

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

  // Story 7.3: legacy on-disk pages still in Yoopta shape are migrated
  // forward on read (see `toStudioPageDoc`). The Yoopta-shape branch
  // here is the validator that gates that migration — if the content is
  // neither DocContentV1 nor legacy Yoopta, the page is rejected so we
  // never silently lose data.
  assertValidYooptaContentValue(value);
}

function toStudioPageDoc(page: CorePageDoc<unknown>): PageDoc {
  // Story 7.3 cutover: editor + storage are both DocContentV1 now. The
  // happy path is "disk is already DocContentV1; pass through". The
  // legacy branch handles pages saved by the old Yoopta-backed Studio
  // — convert them forward via `yooptaToDocContent` exactly once on
  // read; the next save writes DocContentV1 so the migration is
  // permanent for that page.
  const canonical = validateDocContentV1(page.content);
  if (canonical.ok) {
    return { ...page, content: page.content as DocContentV1 } as PageDoc;
  }
  // Story 7.3 review M1: defensive re-validation on the migration branch.
  // `assertValidStoredPageContent` already gates the load path so the
  // input here is known-valid Yoopta; but if `yooptaToDocContent` ever
  // produces malformed DocContentV1 (missing `version: 1`, unknown block
  // type, etc.) we want a typed error rather than silently handing junk
  // to the editor.
  const migrated = yooptaToDocContent(page.content);
  const validated = validateDocContentV1(migrated);
  if (!validated.ok) {
    throw new ValidationError(
      `Lazy migration of legacy Yoopta-shape page '${page.id ?? '<unknown>'}' produced invalid DocContentV1. ` +
      `This indicates a bug in @anydocs/core's yoopta-to-doc-content adapter; please file an issue with the offending page id. ` +
      `Validation failure at ${validated.path}: ${validated.error}`,
      {
        entity: 'page-content',
        rule: 'doc-content-v1-migration',
        remediation: 'Inspect the offending page JSON on disk and report the converter regression to @anydocs/core maintainers.',
        metadata: { pageId: page.id ?? null, path: validated.path, error: validated.error },
      },
    );
  }
  return { ...page, content: migrated } as PageDoc;
}

function toStoredPageDoc(page: PageDoc): CorePageDoc<unknown> {
  // After Story 7.3, the editor emits canonical DocContentV1 directly;
  // no forward conversion on write is required. The repository
  // serializes the page as-is.
  return { ...page, content: page.content };
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

// ─── Story 13.10: Audit Log Query view server bridge ───
// Wraps the core audit query (Story 10.4) + rollback (Story 10.5) against the
// active project's auditRoot, so the Studio Audit Log view can reach them over
// the dev-only /api/local/audit route.

export async function queryAuditLog(
  filter: AuditQuery,
  projectId: string = '',
  customPath?: string,
): Promise<AuditQueryResult> {
  const contract = await loadStudioProjectContract(projectId, customPath);
  return queryAuditLogInService(contract.paths.auditRoot, filter);
}

function isPageDocSnapshot(value: unknown): value is PageDoc {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { id?: unknown }).id === 'string' &&
    typeof (value as { lang?: unknown }).lang === 'string' &&
    typeof (value as { content?: unknown }).content === 'object'
  );
}

export async function rollbackAuditEntry(
  entryId: string,
  projectId: string = '',
  customPath?: string,
): Promise<AuditEntry> {
  const contract = await loadStudioProjectContract(projectId, customPath);
  const result = await rollbackAuditInService(contract.paths.auditRoot, entryId, {
    rollbackEntryId: `rollback-${crypto.randomUUID()}`,
    actor: { kind: 'human' },
    // Re-apply the pre-change snapshot. The exact snapshot shape is finalized by
    // the Epic 11 agent-service; for a page target carrying a page-doc snapshot we
    // write it back via the content repository. Other targets are refused until
    // their snapshot contract lands (Epic 11) — the audit lifecycle still records
    // the rejection.
    applyRollback: async (snapshot, original) => {
      if (original.target.resourceKind === 'page' && isPageDocSnapshot(snapshot)) {
        await savePage(snapshot.lang as DocsLang, snapshot, projectId, customPath);
        return;
      }
      throw new ValidationError('Rollback content re-apply is not supported for this entry yet.', {
        entity: 'audit-rollback',
        rule: 'rollback-snapshot-shape-supported',
        remediation: 'Page-doc snapshots are supported; other target snapshots arrive with the Epic 11 agent-service.',
        metadata: { entryId, resourceKind: original.target.resourceKind },
      });
    },
  });
  return result.entry;
}
