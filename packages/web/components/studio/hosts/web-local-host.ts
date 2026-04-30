'use client';

import type { ApiSourceDoc } from '@anydocs/core';

import { createLocalApiUrl } from '@/components/studio/local-api-url';
import type { DocsLang, NavigationDoc, PageDoc } from '@/lib/docs/types';

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

async function jsonFetch<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });
  const contentType = response.headers.get('content-type') ?? '';
  if (!response.ok) {
    if (contentType.includes('application/json')) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (payload?.error) {
        throw new Error(payload.error);
      }
    }

    const text = await response.text().catch(() => '');
    const normalized = text.trim();
    const looksLikeHtml = /^<!doctype html>/i.test(normalized) || /<html[\s>]/i.test(normalized);
    throw new Error(
      !looksLikeHtml && normalized ? normalized : `Request failed: ${response.status} ${response.statusText}`.trim(),
    );
  }
  if (!contentType.includes('application/json')) {
    const text = await response.text().catch(() => '');
    const normalized = text.trim();
    const looksLikeHtml = /^<!doctype html>/i.test(normalized) || /<html[\s>]/i.test(normalized);
    throw new Error(
      looksLikeHtml
        ? `Expected JSON response from ${url}, received HTML instead.`
        : normalized || `Expected JSON response from ${url}.`,
    );
  }
  return (await response.json()) as T;
}

export function createWebLocalHost(): StudioHost {
  return {
    getProject(projectId: string, projectPath?: string): Promise<StudioProjectResponse> {
      return jsonFetch<StudioProjectResponse>(
        createLocalApiUrl('project', {
          projectId,
          path: projectPath,
        }),
      );
    },
    createProject(_input: StudioProjectCreateInput): Promise<StudioProjectCreateResponse> {
      throw new Error('Create Project is available in the desktop Studio runtime. CLI Studio is locked to the opened project.');
    },
    updateProject(
      patch: StudioProjectSettingsPatch,
      projectId: string,
      projectPath?: string,
    ): Promise<StudioProjectResponse> {
      return jsonFetch<StudioProjectResponse>(
        createLocalApiUrl('project', {
          projectId,
          path: projectPath,
        }),
        {
          method: 'PUT',
          body: JSON.stringify(patch),
        },
      );
    },
    getPages(lang: DocsLang, projectId: string, projectPath?: string): Promise<{ pages: PageDoc[] }> {
      return jsonFetch<{ pages: PageDoc[] }>(
        createLocalApiUrl('pages', {
          lang,
          projectId,
          path: projectPath,
        }),
      );
    },
    getPage(lang: DocsLang, pageId: string, projectId: string, projectPath?: string): Promise<PageDoc> {
      return jsonFetch<PageDoc>(
        createLocalApiUrl('page', {
          lang,
          pageId,
          projectId,
          path: projectPath,
        }),
      );
    },
    savePage(lang: DocsLang, page: PageDoc, projectId: string, projectPath?: string): Promise<PageDoc> {
      return jsonFetch<PageDoc>(
        createLocalApiUrl('page', {
          lang,
          projectId,
          path: projectPath,
        }),
        {
          method: 'PUT',
          body: JSON.stringify(page),
        },
      );
    },
    createPage(
      lang: DocsLang,
      input: { slug: string; title: string },
      projectId: string,
      projectPath?: string,
    ): Promise<PageDoc> {
      return jsonFetch<PageDoc>(
        createLocalApiUrl('page', {
          lang,
          projectId,
          path: projectPath,
        }),
        {
          method: 'POST',
          body: JSON.stringify(input),
        },
      );
    },
    deletePage(lang: DocsLang, pageId: string, projectId: string, projectPath?: string): Promise<DeletePageResponse> {
      return jsonFetch<DeletePageResponse>(
        createLocalApiUrl('page', {
          lang,
          pageId,
          projectId,
          path: projectPath,
        }),
        {
          method: 'DELETE',
        },
      );
    },
    getNavigation(lang: DocsLang, projectId: string, projectPath?: string): Promise<NavigationDoc> {
      return jsonFetch<NavigationDoc>(
        createLocalApiUrl('navigation', {
          lang,
          projectId,
          path: projectPath,
        }),
      );
    },
    saveNavigation(
      lang: DocsLang,
      navigation: NavigationDoc,
      projectId: string,
      projectPath?: string,
    ): Promise<NavigationDoc> {
      return jsonFetch<NavigationDoc>(
        createLocalApiUrl('navigation', {
          lang,
          projectId,
          path: projectPath,
        }),
        {
          method: 'PUT',
          body: JSON.stringify(navigation),
        },
      );
    },
    getApiSources(projectId: string, projectPath?: string): Promise<StudioApiSourcesResponse> {
      return jsonFetch<StudioApiSourcesResponse>(
        createLocalApiUrl('api-sources', {
          projectId,
          path: projectPath,
        }),
      );
    },
    replaceApiSources(
      sources: ApiSourceDoc[],
      projectId: string,
      projectPath?: string,
    ): Promise<StudioApiSourcesResponse> {
      return jsonFetch<StudioApiSourcesResponse>(
        createLocalApiUrl('api-sources', {
          projectId,
          path: projectPath,
        }),
        {
          method: 'PUT',
          body: JSON.stringify({ sources }),
        },
      );
    },
    runBuild(projectId: string, projectPath?: string): Promise<StudioBuildResponse> {
      return jsonFetch<StudioBuildResponse>(
        createLocalApiUrl('build', {
          projectId,
          path: projectPath,
        }),
        {
          method: 'POST',
        },
      );
    },
    runPreview(projectId: string, projectPath?: string): Promise<StudioPreviewResponse> {
      return jsonFetch<StudioPreviewResponse>(
        createLocalApiUrl('preview', {
          projectId,
          path: projectPath,
        }),
        {
          method: 'POST',
        },
      );
    },
    stopPreview(projectId: string, projectPath?: string): Promise<StudioPreviewStopResponse> {
      return jsonFetch<StudioPreviewStopResponse>(
        createLocalApiUrl('preview', {
          projectId,
          path: projectPath,
        }),
        {
          method: 'DELETE',
        },
      );
    },
  };
}
