import type { ApiSourceDoc, ProjectContract, ProjectSiteTopNavItem } from '@anydocs/core';

import type { DocsLang, NavigationDoc, PageDoc } from '@/lib/docs/types';

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

export type StudioPreviewStopResponse = {
  stopped: number;
};

export type StudioBuildResponse = {
  artifactRoot: string;
  languages: Array<{ lang: DocsLang; publishedPages: number }>;
};

export type StudioApiSourcesResponse = {
  sources: ApiSourceDoc[];
};

export type StudioProjectSettingsPatch = {
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
};

export interface StudioHost {
  getProject(projectId: string, projectPath?: string): Promise<StudioProjectResponse>;
  updateProject(
    patch: StudioProjectSettingsPatch,
    projectId: string,
    projectPath?: string,
  ): Promise<StudioProjectResponse>;
  getPages(lang: DocsLang, projectId: string, projectPath?: string): Promise<{ pages: PageDoc[] }>;
  getPage(lang: DocsLang, pageId: string, projectId: string, projectPath?: string): Promise<PageDoc>;
  savePage(lang: DocsLang, page: PageDoc, projectId: string, projectPath?: string): Promise<PageDoc>;
  createPage(
    lang: DocsLang,
    input: { slug: string; title: string },
    projectId: string,
    projectPath?: string,
  ): Promise<PageDoc>;
  deletePage(lang: DocsLang, pageId: string, projectId: string, projectPath?: string): Promise<DeletePageResponse>;
  getNavigation(lang: DocsLang, projectId: string, projectPath?: string): Promise<NavigationDoc>;
  saveNavigation(
    lang: DocsLang,
    navigation: NavigationDoc,
    projectId: string,
    projectPath?: string,
  ): Promise<NavigationDoc>;
  getApiSources(projectId: string, projectPath?: string): Promise<StudioApiSourcesResponse>;
  replaceApiSources(
    sources: ApiSourceDoc[],
    projectId: string,
    projectPath?: string,
  ): Promise<StudioApiSourcesResponse>;
  runBuild(projectId: string, projectPath?: string): Promise<StudioBuildResponse>;
  runPreview(projectId: string, projectPath?: string): Promise<StudioPreviewResponse>;
  stopPreview(projectId: string, projectPath?: string): Promise<StudioPreviewStopResponse>;
}
