'use client';

import type { ApiSourceDoc } from '@anydocs/core';

import type { DocsLang, NavigationDoc, PageDoc } from '@/lib/docs/types';

import type {
  DeletePageResponse,
  StudioApiSourcesResponse,
  StudioBuildResponse,
  StudioHost,
  StudioPreviewResponse,
  StudioPreviewStopResponse,
  StudioProjectResponse,
  StudioProjectSettingsPatch,
} from './host-types';

type DesktopServerResponse<T> = {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
};

async function jsonPost<T>(baseUrl: string, pathname: string, body?: Record<string, unknown>) {
  const response = await fetch(new URL(pathname, `${baseUrl}/`).toString(), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(body ?? {}),
  });

  const payload = (await response.json().catch(() => null)) as DesktopServerResponse<T> | null;
  if (!response.ok) {
    throw new Error(payload?.error?.message ?? `Request failed: ${response.status} ${response.statusText}`);
  }

  if (!payload?.success) {
    throw new Error(payload?.error?.message ?? 'Desktop server request failed');
  }

  return payload.data as T;
}

export function createDesktopHttpHost(baseUrl: string): StudioHost {
  return {
    getProject(projectId: string, projectPath?: string): Promise<StudioProjectResponse> {
      return jsonPost(baseUrl, '/studio/project/get', { projectId, projectPath });
    },
    updateProject(
      patch: StudioProjectSettingsPatch,
      projectId: string,
      projectPath?: string,
    ): Promise<StudioProjectResponse> {
      return jsonPost(baseUrl, '/studio/project/put', { patch, projectId, projectPath });
    },
    getPages(lang: DocsLang, projectId: string, projectPath?: string): Promise<{ pages: PageDoc[] }> {
      return jsonPost(baseUrl, '/studio/pages/get', { lang, projectId, projectPath });
    },
    getPage(lang: DocsLang, pageId: string, projectId: string, projectPath?: string): Promise<PageDoc> {
      return jsonPost(baseUrl, '/studio/page/get', { lang, pageId, projectId, projectPath });
    },
    savePage(lang: DocsLang, page: PageDoc, projectId: string, projectPath?: string): Promise<PageDoc> {
      return jsonPost(baseUrl, '/studio/page/put', { lang, page, projectId, projectPath });
    },
    createPage(
      lang: DocsLang,
      input: { slug: string; title: string },
      projectId: string,
      projectPath?: string,
    ): Promise<PageDoc> {
      return jsonPost(baseUrl, '/studio/page/post', { lang, input, projectId, projectPath });
    },
    deletePage(lang: DocsLang, pageId: string, projectId: string, projectPath?: string): Promise<DeletePageResponse> {
      return jsonPost(baseUrl, '/studio/page/delete', { lang, pageId, projectId, projectPath });
    },
    getNavigation(lang: DocsLang, projectId: string, projectPath?: string): Promise<NavigationDoc> {
      return jsonPost(baseUrl, '/studio/navigation/get', { lang, projectId, projectPath });
    },
    saveNavigation(
      lang: DocsLang,
      navigation: NavigationDoc,
      projectId: string,
      projectPath?: string,
    ): Promise<NavigationDoc> {
      return jsonPost(baseUrl, '/studio/navigation/put', { lang, navigation, projectId, projectPath });
    },
    getApiSources(projectId: string, projectPath?: string): Promise<StudioApiSourcesResponse> {
      return jsonPost(baseUrl, '/studio/api-sources/get', { projectId, projectPath });
    },
    replaceApiSources(
      sources: ApiSourceDoc[],
      projectId: string,
      projectPath?: string,
    ): Promise<StudioApiSourcesResponse> {
      return jsonPost(baseUrl, '/studio/api-sources/put', { sources, projectId, projectPath });
    },
    runBuild(projectId: string, projectPath?: string): Promise<StudioBuildResponse> {
      return jsonPost(baseUrl, '/studio/build/post', { projectId, projectPath });
    },
    runPreview(projectId: string, projectPath?: string): Promise<StudioPreviewResponse> {
      return jsonPost(baseUrl, '/studio/preview/post', { projectId, projectPath });
    },
    stopPreview(projectId: string, projectPath?: string): Promise<StudioPreviewStopResponse> {
      return jsonPost(baseUrl, '/studio/preview/stop', { projectId, projectPath });
    },
  };
}
