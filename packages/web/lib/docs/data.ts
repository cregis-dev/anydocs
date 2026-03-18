import 'server-only';

import { cookies } from 'next/headers';

import {
  buildPublishedSiteLanguageContent,
  isPageApprovedForPublication,
  type ProjectSiteNavigation,
  type ProjectSiteTheme,
} from '@anydocs/core';

import { findPageBySlug, listPages, loadNavigation, loadStudioProjectContract } from '@/lib/docs/fs';
import { sanitizeCookieDocsSource, type DocsRuntimeSource } from '@/lib/docs/request-source';
import type { DocsLang, NavigationDoc, PageDoc } from '@/lib/docs/types';
export type { DocsRuntimeSource } from '@/lib/docs/request-source';

export type PublishedStaticParam = {
  lang: DocsLang;
  slug: string[];
};

export type PublishedContext = {
  nav: NavigationDoc;
  pages: PageDoc[];
};

function normalizeOptionalString(value?: string | null): string | undefined {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function isDesktopRuntimeEnabled(): boolean {
  return process.env.ANYDOCS_DESKTOP_RUNTIME === '1';
}

export function getCliDocsRuntimeMode(): 'export' | 'preview' | null {
  return process.env.ANYDOCS_DOCS_RUNTIME === 'export' || process.env.ANYDOCS_DOCS_RUNTIME === 'preview'
    ? process.env.ANYDOCS_DOCS_RUNTIME
    : null;
}

export function getCliDocsSourceFromEnv(): DocsRuntimeSource | null {
  if (!getCliDocsRuntimeMode()) {
    return null;
  }

  const customPath = normalizeOptionalString(process.env.ANYDOCS_DOCS_PROJECT_ROOT);
  if (!customPath) {
    return null;
  }

  return {
    projectId: normalizeOptionalString(process.env.ANYDOCS_DOCS_PROJECT_ID) ?? '',
    customPath,
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

export async function getPublishedSiteTheme(projectId: string = '', customPath?: string): Promise<ProjectSiteTheme> {
  const source = resolveDataSource(projectId, customPath);
  const contract = await loadStudioProjectContract(source.projectId, source.customPath);
  return contract.config.site.theme;
}

export async function getPublishedSiteNavigation(
  projectId: string = '',
  customPath?: string,
): Promise<ProjectSiteNavigation | undefined> {
  const source = resolveDataSource(projectId, customPath);
  const contract = await loadStudioProjectContract(source.projectId, source.customPath);
  return contract.config.site.navigation;
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
  return listPages(lang, source.projectId, source.customPath);
}

export async function getPublishedPages(lang: DocsLang, projectId: string = '', customPath?: string) {
  return (await getPublishedSite(lang, projectId, customPath)).pages as PageDoc[];
}

export async function getPublishedNavigation(lang: DocsLang, projectId: string = '', customPath?: string) {
  return (await getPublishedSite(lang, projectId, customPath)).navigation as NavigationDoc;
}

export async function getPublishedPageBySlug(lang: DocsLang, slug: string, projectId: string = '', customPath?: string) {
  const source = resolveDataSource(projectId, customPath);
  const page = await findPageBySlug(lang, slug, source.projectId, source.customPath);
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
  return { nav: site.navigation as NavigationDoc, pages: site.pages as PageDoc[] };
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
