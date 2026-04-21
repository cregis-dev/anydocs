import 'server-only';

import { cookies } from 'next/headers';

import {
  buildPublishedSiteLanguageContent,
  isPageApprovedForPublication,
  type ProjectSiteTopNavItem,
  type ProjectSiteNavigation,
  type ProjectSiteTheme,
} from '@anydocs/core';

import {
  findPublishedPageBySlugRaw,
  listPublishedPagesRaw,
  loadNavigation,
  loadStudioProjectContract,
} from '@/lib/docs/fs';
import { getPublishedApiSources } from '@/lib/docs/api-sources';
import { sanitizeCookieDocsSource, type DocsRuntimeSource } from '@/lib/docs/request-source';
import type { DocsLang, NavigationDoc, PublishedPageDoc } from '@/lib/docs/types';
import { readCliDocsRuntimeMode, readRuntimeConfig } from '@/lib/runtime/runtime-config';
export type { DocsRuntimeSource } from '@/lib/docs/request-source';

export type PublishedStaticParam = {
  lang: DocsLang;
  slug: string[];
};

export type PublishedContext = {
  nav: NavigationDoc;
  pages: PublishedPageDoc[];
};

export function isDesktopRuntimeEnabled(): boolean {
  return readRuntimeConfig().isDesktopRuntime;
}

export function getCliDocsRuntimeMode(): 'export' | 'preview' | null {
  return readCliDocsRuntimeMode();
}

export function getCliDocsSourceFromEnv(): DocsRuntimeSource | null {
  const runtime = readRuntimeConfig();

  if (!runtime.docs) {
    return null;
  }

  return {
    projectId: runtime.docs.projectId,
    customPath: runtime.docs.projectRoot,
  };
}

export function isExplicitCliDocsRuntimeEnabled(): boolean {
  return getCliDocsSourceFromEnv() !== null;
}

export function isDocsReaderAvailable(): boolean {
  if (isDesktopRuntimeEnabled()) {
    return false;
  }

  return process.env.NODE_ENV === 'production' || isExplicitCliDocsRuntimeEnabled();
}

function resolveDataSource(projectId: string = '', customPath?: string): DocsRuntimeSource {
  if (projectId || customPath !== undefined) {
    return { projectId, customPath };
  }

  return getCliDocsSourceFromEnv() ?? { projectId: '' };
}

export async function resolveRequestDocsSource(): Promise<DocsRuntimeSource> {
  const explicit = getCliDocsSourceFromEnv();
  if (explicit) {
    return explicit;
  }

  const cookieStore = await cookies();
  return sanitizeCookieDocsSource(
    cookieStore.get('anydocs_preview_project_id')?.value,
    cookieStore.get('anydocs_preview_path')?.value,
  );
}

export async function getPublishedLanguages(projectId: string = '', customPath?: string): Promise<DocsLang[]> {
  const source = resolveDataSource(projectId, customPath);
  const contract = await loadStudioProjectContract(source.projectId, source.customPath);
  return contract.config.languages;
}

export async function getDefaultPublishedLanguage(projectId: string = '', customPath?: string): Promise<DocsLang> {
  const source = resolveDataSource(projectId, customPath);
  const contract = await loadStudioProjectContract(source.projectId, source.customPath);
  return contract.config.defaultLanguage;
}

export async function getPublishedThemeId(projectId: string = '', customPath?: string): Promise<string> {
  return (await getPublishedSiteTheme(projectId, customPath)).id;
}

export async function getPublishedProjectName(projectId: string = '', customPath?: string): Promise<string> {
  const source = resolveDataSource(projectId, customPath);
  const contract = await loadStudioProjectContract(source.projectId, source.customPath);
  return contract.config.name;
}

export async function getPublishedSiteUrl(projectId: string = '', customPath?: string): Promise<string | undefined> {
  const source = resolveDataSource(projectId, customPath);
  const contract = await loadStudioProjectContract(source.projectId, source.customPath);
  return contract.config.site.url;
}

export async function getPublishedSiteTheme(projectId: string = '', customPath?: string): Promise<ProjectSiteTheme> {
  const source = resolveDataSource(projectId, customPath);
  const contract = await loadStudioProjectContract(source.projectId, source.customPath);
  return contract.config.site.theme;
}

export async function getPublishedSiteNavigation(
  lang?: DocsLang,
  projectId: string = '',
  customPath?: string,
): Promise<ProjectSiteNavigation | undefined> {
  const source = resolveDataSource(projectId, customPath);
  const contract = await loadStudioProjectContract(source.projectId, source.customPath);
  const configuredNavigation = contract.config.site.navigation;
  const targetLang = lang ?? contract.config.defaultLanguage;
  const apiSources = await getPublishedApiSources(targetLang, source.projectId, source.customPath);
  if (apiSources.length === 0) {
    return configuredNavigation;
  }

  const topNav = [...(configuredNavigation?.topNav ?? [])];
  const hasReferenceEntry = topNav.some((item) => item.type === 'external' && item.href === `/${targetLang}/reference`);
  if (!hasReferenceEntry) {
    const referenceItem: ProjectSiteTopNavItem = {
      id: 'api-reference',
      type: 'external',
      href: `/${targetLang}/reference`,
      label: {
        en: 'API Reference',
        zh: 'API 参考',
      },
    };
    topNav.push(referenceItem);
  }

  return topNav.length > 0 ? { topNav } : configuredNavigation;
}

export async function getPublishedSite(lang: DocsLang, projectId: string = '', customPath?: string) {
  const source = resolveDataSource(projectId, customPath);
  const [nav, pages] = await Promise.all([
    loadNavigation(lang, source.projectId, source.customPath),
    getAllPages(lang, source.projectId, source.customPath),
  ]);
  return buildPublishedSiteLanguageContent(lang, nav, pages);
}

export async function getAllPages(lang: DocsLang, projectId: string = '', customPath?: string) {
  const source = resolveDataSource(projectId, customPath);
  return listPublishedPagesRaw(lang, source.projectId, source.customPath);
}

export async function getPublishedPages(lang: DocsLang, projectId: string = '', customPath?: string) {
  return (await getPublishedSite(lang, projectId, customPath)).pages as PublishedPageDoc[];
}

export async function getPublishedNavigation(lang: DocsLang, projectId: string = '', customPath?: string) {
  return (await getPublishedSite(lang, projectId, customPath)).navigation as NavigationDoc;
}

export async function getPublishedPageBySlug(lang: DocsLang, slug: string, projectId: string = '', customPath?: string) {
  const source = resolveDataSource(projectId, customPath);
  const page = await findPublishedPageBySlugRaw(lang, slug, source.projectId, source.customPath);
  if (!page) return null;
  if (!isPageApprovedForPublication(page)) return null;
  return page;
}

export async function getPublishedContext(
  lang: DocsLang,
  projectId: string = '',
  customPath?: string,
): Promise<PublishedContext> {
  const site = await getPublishedSite(lang, projectId, customPath);
  return { nav: site.navigation as NavigationDoc, pages: site.pages as PublishedPageDoc[] };
}

export async function getPublishedDocStaticParams(projectId: string = '', customPath?: string): Promise<PublishedStaticParam[]> {
  const source = resolveDataSource(projectId, customPath);
  const languages = await getPublishedLanguages(source.projectId, source.customPath);
  const params: PublishedStaticParam[] = [];

  for (const lang of languages) {
    params.push({ lang, slug: [] });
    const site = await getPublishedSite(lang, source.projectId, source.customPath);

    for (const route of site.routes) {
      params.push({ lang, slug: route.segments });
    }
  }

  return params;
}

export async function getDefaultLanguageStaticParams(
  projectId: string = '',
  customPath?: string,
): Promise<Array<{ slug: string[] }>> {
  const source = resolveDataSource(projectId, customPath);
  const defaultLanguage = await getDefaultPublishedLanguage(source.projectId, source.customPath);
  const site = await getPublishedSite(defaultLanguage, source.projectId, source.customPath);

  return [{ slug: [] }, ...site.routes.map((route) => ({ slug: route.segments }))];
}

export function getReaderSearchIndexHref(lang: DocsLang): string {
  return getCliDocsRuntimeMode() === 'preview'
    ? `/api/docs/search-index?lang=${lang}`
    : `/search-index.${lang}.json`;
}

export function getReaderSearchFindHref(lang: DocsLang): string {
  return getCliDocsRuntimeMode() === 'preview'
    ? `/api/docs/search-find?lang=${lang}`
    : `/search-find.${lang}.json`;
}
