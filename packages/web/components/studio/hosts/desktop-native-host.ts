'use client';

import {
  createApiSourceRepository,
  createDesktopFsPort,
  createDocsRepository,
  deleteApiSource as deleteApiSourceFromRepository,
  deletePage as deletePageFromRepository,
  listApiSources as listApiSourcesInRepository,
  listPages as listPagesInRepository,
  loadNavigation as loadNavigationFromRepository,
  loadPage as loadPageFromRepository,
  saveApiSource as saveApiSourceToRepository,
  saveNavigation as saveNavigationToRepository,
  savePage as savePageToRepository,
  type ApiSourceRepository,
  type DocsRepository,
  type FileSystemPort,
} from '@anydocs/core/client-fs';
import type { ApiSourceDoc } from '@anydocs/core';

import type { DocsLang, NavigationDoc, PageDoc } from '@/lib/docs/types';

import { createDesktopHttpHost } from './desktop-http-host.ts';
import type {
  DeletePageResponse,
  StudioApiSourcesResponse,
  StudioBuildResponse,
  StudioHost,
  StudioProjectCreateInput,
  StudioProjectCreateResponse,
  StudioPreviewResponse,
  StudioPreviewStopResponse,
  StudioProjectResponse,
  StudioProjectSettingsPatch,
} from './host-types';

type DesktopInvoke = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;

export type DesktopNativeHostOptions = {
  /** Raw Tauri `invoke` (from `getDesktopInvoke()`). */
  invoke: DesktopInvoke;
  /** Local desktop server base URL — used for the delegated (Node-backed) methods. */
  serverBaseUrl: string;
};

/**
 * Inlined copy of `@anydocs/core`'s `normalizeSlug` — it lives behind the main
 * (node-laden) barrel and is not re-exported from the node-free `client-fs`
 * entry, so the renderer host carries its own pure copy.
 */
function normalizeSlug(slug?: string): string {
  if (!slug) return '';
  return slug
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean)
    .join('/');
}

/** Mirrors `derivePageIdFromSlug` in `packages/web/lib/docs/fs.ts`. */
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

/**
 * Native renderer StudioHost (Story 9.5). Document I/O (pages, navigation, API
 * sources) runs entirely through the native Tauri fs commands via
 * `@anydocs/core/client-fs` — no HTTP round-trip. Project-contract and
 * build/preview operations still need Node/subprocess work that is not ported
 * to the renderer yet, so they are delegated to the local desktop HTTP server.
 */
export function createDesktopNativeHost(options: DesktopNativeHostOptions): StudioHost {
  const { invoke, serverBaseUrl } = options;
  const httpHost = createDesktopHttpHost(serverBaseUrl);

  let activeRoot: string | null = null;

  async function ensureActiveRoot(projectPath: string): Promise<void> {
    if (activeRoot === projectPath) {
      return;
    }
    await invoke('set_active_project_root', { path: projectPath });
    activeRoot = projectPath;
  }

  function portFor(projectPath: string): FileSystemPort {
    return createDesktopFsPort({ projectRoot: projectPath, invoke });
  }

  async function docsRepoFor(projectPath?: string): Promise<DocsRepository> {
    const root = requireProjectPath(projectPath);
    await ensureActiveRoot(root);
    return createDocsRepository(root, portFor(root));
  }

  async function apiSourceRepoFor(projectPath?: string): Promise<ApiSourceRepository> {
    const root = requireProjectPath(projectPath);
    await ensureActiveRoot(root);
    return createApiSourceRepository(root, portFor(root));
  }

  function requireProjectPath(projectPath?: string): string {
    if (!projectPath) {
      throw new Error('Desktop native Studio requires an absolute project path for document operations.');
    }
    return projectPath;
  }

  return {
    // ── Delegated to the local desktop HTTP server (Node-backed) ──
    getProject(projectId: string, projectPath?: string): Promise<StudioProjectResponse> {
      return httpHost.getProject(projectId, projectPath);
    },
    createProject(input: StudioProjectCreateInput): Promise<StudioProjectCreateResponse> {
      return httpHost.createProject(input);
    },
    updateProject(
      patch: StudioProjectSettingsPatch,
      projectId: string,
      projectPath?: string,
    ): Promise<StudioProjectResponse> {
      return httpHost.updateProject(patch, projectId, projectPath);
    },
    runBuild(projectId: string, projectPath?: string): Promise<StudioBuildResponse> {
      return httpHost.runBuild(projectId, projectPath);
    },
    runPreview(projectId: string, projectPath?: string): Promise<StudioPreviewResponse> {
      return httpHost.runPreview(projectId, projectPath);
    },
    stopPreview(projectId: string, projectPath?: string): Promise<StudioPreviewStopResponse> {
      return httpHost.stopPreview(projectId, projectPath);
    },

    // ── Native document I/O via @anydocs/core/client-fs ──
    async getPages(lang: DocsLang, _projectId: string, projectPath?: string): Promise<{ pages: PageDoc[] }> {
      const repository = await docsRepoFor(projectPath);
      const pages = await listPagesInRepository<PageDoc['content']>(repository, lang);
      return { pages: pages as PageDoc[] };
    },
    async getPage(lang: DocsLang, pageId: string, _projectId: string, projectPath?: string): Promise<PageDoc> {
      const repository = await docsRepoFor(projectPath);
      const page = await loadPageFromRepository<PageDoc['content']>(repository, lang, pageId);
      if (!page) {
        throw new Error(`Page "${pageId}" not found.`);
      }
      return page as PageDoc;
    },
    async savePage(lang: DocsLang, page: PageDoc, _projectId: string, projectPath?: string): Promise<PageDoc> {
      const repository = await docsRepoFor(projectPath);
      const saved = await savePageToRepository<PageDoc['content']>(repository, lang, page);
      return saved as PageDoc;
    },
    async createPage(
      lang: DocsLang,
      input: { slug: string; title: string },
      _projectId: string,
      projectPath?: string,
    ): Promise<PageDoc> {
      const repository = await docsRepoFor(projectPath);
      const normalizedSlug = normalizeSlug(input.slug);
      const title = input.title.trim() || 'Untitled';
      const pageId = derivePageIdFromSlug(normalizedSlug);

      const existing = await loadPageFromRepository(repository, lang, pageId);
      if (existing !== null) {
        throw new Error(`Page "${pageId}" already exists.`);
      }

      const saved = await savePageToRepository<PageDoc['content']>(repository, lang, {
        id: pageId,
        lang,
        slug: normalizedSlug,
        title,
        status: 'draft',
        updatedAt: new Date().toISOString(),
        content: {
          version: 1,
          blocks: [],
        } as PageDoc['content'],
        render: {
          markdown: `# ${title}`,
          plainText: title,
        },
      });
      return saved as PageDoc;
    },
    async deletePage(
      lang: DocsLang,
      pageId: string,
      _projectId: string,
      projectPath?: string,
    ): Promise<DeletePageResponse> {
      const repository = await docsRepoFor(projectPath);
      return deletePageFromRepository(repository, lang, pageId);
    },
    async getNavigation(lang: DocsLang, _projectId: string, projectPath?: string): Promise<NavigationDoc> {
      const repository = await docsRepoFor(projectPath);
      return (await loadNavigationFromRepository(repository, lang)) as NavigationDoc;
    },
    async saveNavigation(
      lang: DocsLang,
      navigation: NavigationDoc,
      _projectId: string,
      projectPath?: string,
    ): Promise<NavigationDoc> {
      const repository = await docsRepoFor(projectPath);
      return (await saveNavigationToRepository(repository, lang, navigation)) as NavigationDoc;
    },
    async getApiSources(_projectId: string, projectPath?: string): Promise<StudioApiSourcesResponse> {
      const repository = await apiSourceRepoFor(projectPath);
      return { sources: await listApiSourcesInRepository(repository) };
    },
    async replaceApiSources(
      sources: ApiSourceDoc[],
      _projectId: string,
      projectPath?: string,
    ): Promise<StudioApiSourcesResponse> {
      const repository = await apiSourceRepoFor(projectPath);
      const existing = await listApiSourcesInRepository(repository);
      const nextIds = new Set(sources.map((source) => source.id));

      for (const source of sources) {
        await saveApiSourceToRepository(repository, source);
      }

      for (const source of existing) {
        if (!nextIds.has(source.id)) {
          await deleteApiSourceFromRepository(repository, source.id);
        }
      }

      return { sources: await listApiSourcesInRepository(repository) };
    },
  };
}
