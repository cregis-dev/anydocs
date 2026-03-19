'use client';

import type { ProjectContract, ProjectSiteTopNavItem } from '@anydocs/core';

import type { DocsLang, NavigationDoc, PageDoc } from '@/lib/docs/types';
import { createLocalApiUrl } from '@/components/studio/local-api-url';

export type StudioProjectResponse = ProjectContract;

export type DeletePageResponse = {
  pageId: string;
  lang: DocsLang;
  removedNavigationRefs: number;
};

export type StudioPreviewResponse = {
  docsPath: string;
  previewUrl?: string;
};

export type StudioBuildResponse = {
  artifactRoot: string;
  languages: Array<{ lang: DocsLang; publishedPages: number }>;
};

type StudioProjectSettingsPatch = {
  name?: string;
  languages?: DocsLang[];
  defaultLanguage?: DocsLang;
  site?: {
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
};

type IpcResponse<T> = {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
};

type DesktopStudioApi = {
  getProject: (projectId: string, projectPath?: string) => Promise<IpcResponse<StudioProjectResponse>>;
  updateProject: (
    patch: StudioProjectSettingsPatch,
    projectId: string,
    projectPath?: string,
  ) => Promise<IpcResponse<StudioProjectResponse>>;
  getPages: (lang: string, projectId: string, projectPath?: string) => Promise<IpcResponse<{ pages: PageDoc[] }>>;
  getPage: (lang: string, pageId: string, projectId: string, projectPath?: string) => Promise<IpcResponse<PageDoc>>;
  savePage: (lang: string, page: PageDoc, projectId: string, projectPath?: string) => Promise<IpcResponse<PageDoc>>;
  createPage: (
    lang: string,
    input: { slug: string; title: string },
    projectId: string,
    projectPath?: string,
  ) => Promise<IpcResponse<PageDoc>>;
  deletePage: (
    lang: string,
    pageId: string,
    projectId: string,
    projectPath?: string,
  ) => Promise<IpcResponse<DeletePageResponse>>;
  getNavigation: (
    lang: string,
    projectId: string,
    projectPath?: string,
  ) => Promise<IpcResponse<NavigationDoc>>;
  saveNavigation: (
    lang: string,
    navigation: NavigationDoc,
    projectId: string,
    projectPath?: string,
  ) => Promise<IpcResponse<NavigationDoc>>;
  runBuild: (projectId: string, projectPath?: string) => Promise<IpcResponse<StudioBuildResponse>>;
  runPreview: (projectId: string, projectPath?: string) => Promise<IpcResponse<StudioPreviewResponse>>;
};

type DesktopWindow = Window & {
  api?: {
    studio?: DesktopStudioApi;
  };
};

function getDesktopStudioApi(): DesktopStudioApi | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return ((window as DesktopWindow).api?.studio as DesktopStudioApi | undefined) ?? null;
}

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

async function fromIpc<T>(promise: Promise<IpcResponse<T>>) {
  const response = await promise;
  if (!response.success) {
    throw new Error(response.error?.message ?? 'Desktop IPC request failed');
  }

  return response.data as T;
}

export async function getStudioProject(projectId: string, projectPath?: string): Promise<StudioProjectResponse> {
  const desktopApi = getDesktopStudioApi();
  if (desktopApi) {
    return fromIpc(desktopApi.getProject(projectId, projectPath));
  }

  return jsonFetch<StudioProjectResponse>(
    createLocalApiUrl('project', {
      projectId,
      path: projectPath,
    }),
  );
}

export async function updateStudioProject(
  patch: StudioProjectSettingsPatch,
  projectId: string,
  projectPath?: string,
): Promise<StudioProjectResponse> {
  const desktopApi = getDesktopStudioApi();
  if (desktopApi) {
    return fromIpc(desktopApi.updateProject(patch, projectId, projectPath));
  }

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
}

export async function getStudioPages(
  lang: DocsLang,
  projectId: string,
  projectPath?: string,
): Promise<{ pages: PageDoc[] }> {
  const desktopApi = getDesktopStudioApi();
  if (desktopApi) {
    return fromIpc(desktopApi.getPages(lang, projectId, projectPath));
  }

  return jsonFetch<{ pages: PageDoc[] }>(
    createLocalApiUrl('pages', {
      lang,
      projectId,
      path: projectPath,
    }),
  );
}

export async function getStudioPage(
  lang: DocsLang,
  pageId: string,
  projectId: string,
  projectPath?: string,
): Promise<PageDoc> {
  const desktopApi = getDesktopStudioApi();
  if (desktopApi) {
    return fromIpc(desktopApi.getPage(lang, pageId, projectId, projectPath));
  }

  return jsonFetch<PageDoc>(
    createLocalApiUrl('page', {
      lang,
      pageId,
      projectId,
      path: projectPath,
    }),
  );
}

export async function saveStudioPage(
  lang: DocsLang,
  page: PageDoc,
  projectId: string,
  projectPath?: string,
): Promise<PageDoc> {
  const desktopApi = getDesktopStudioApi();
  if (desktopApi) {
    return fromIpc(desktopApi.savePage(lang, page, projectId, projectPath));
  }

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
}

export async function createStudioPage(
  lang: DocsLang,
  input: { slug: string; title: string },
  projectId: string,
  projectPath?: string,
): Promise<PageDoc> {
  const desktopApi = getDesktopStudioApi();
  if (desktopApi) {
    return fromIpc(desktopApi.createPage(lang, input, projectId, projectPath));
  }

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
}

export async function deleteStudioPage(
  lang: DocsLang,
  pageId: string,
  projectId: string,
  projectPath?: string,
): Promise<DeletePageResponse> {
  const desktopApi = getDesktopStudioApi();
  if (desktopApi) {
    return fromIpc(desktopApi.deletePage(lang, pageId, projectId, projectPath));
  }

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
}

export async function getStudioNavigation(
  lang: DocsLang,
  projectId: string,
  projectPath?: string,
): Promise<NavigationDoc> {
  const desktopApi = getDesktopStudioApi();
  if (desktopApi) {
    return fromIpc(desktopApi.getNavigation(lang, projectId, projectPath));
  }

  return jsonFetch<NavigationDoc>(
    createLocalApiUrl('navigation', {
      lang,
      projectId,
      path: projectPath,
    }),
  );
}

export async function saveStudioNavigation(
  lang: DocsLang,
  navigation: NavigationDoc,
  projectId: string,
  projectPath?: string,
): Promise<NavigationDoc> {
  const desktopApi = getDesktopStudioApi();
  if (desktopApi) {
    return fromIpc(desktopApi.saveNavigation(lang, navigation, projectId, projectPath));
  }

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
}

export async function runStudioPreview(projectId: string, projectPath?: string): Promise<StudioPreviewResponse> {
  const desktopApi = getDesktopStudioApi();
  if (desktopApi) {
    return fromIpc(desktopApi.runPreview(projectId, projectPath));
  }

  return jsonFetch<StudioPreviewResponse>(
    createLocalApiUrl('preview', {
      projectId,
      path: projectPath,
    }),
    {
      method: 'POST',
    },
  );
}

export async function runStudioBuild(projectId: string, projectPath?: string): Promise<StudioBuildResponse> {
  const desktopApi = getDesktopStudioApi();
  if (desktopApi) {
    return fromIpc(desktopApi.runBuild(projectId, projectPath));
  }

  return jsonFetch<StudioBuildResponse>(
    createLocalApiUrl('build', {
      projectId,
      path: projectPath,
    }),
    {
      method: 'POST',
    },
  );
}
