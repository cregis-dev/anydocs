import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';

import {
  getPublishedContext,
  getPublishedLanguages,
  getPublishedProjectName,
  getReaderSearchFindHref,
  getReaderSearchIndexHref,
  getPublishedSiteNavigation,
  getPublishedSiteTheme,
  isDocsReaderAvailable,
  resolveRequestDocsSource,
} from '@/lib/docs/data';
import type { DocsLang } from '@/lib/docs/types';
import { resolveDocsLocale } from '@/lib/docs/seo';
import { resolveDocsTheme } from '@/lib/themes/resolve-theme';

import '../globals.css';

const fallbackMetadata: Metadata = {
  title: {
    default: 'Dev Docs',
    template: '%s | Dev Docs',
  },
  description: '面向开发者的产品/组件文档与示例',
};

function buildReaderMetadata(siteTitle: string, faviconSrc?: string): Metadata {
  const normalizedFaviconSrc = faviconSrc?.trim();

  return {
    title: {
      default: siteTitle,
      template: `%s | ${siteTitle}`,
    },
    description: '面向开发者的产品/组件文档与示例',
    ...(normalizedFaviconSrc
      ? {
          icons: {
            icon: [{ url: normalizedFaviconSrc }],
            shortcut: [{ url: normalizedFaviconSrc }],
          },
        }
      : {}),
  };
}

export async function generateMetadata(): Promise<Metadata> {
  if (!isDocsReaderAvailable()) {
    return fallbackMetadata;
  }

  const source = await resolveRequestDocsSource();
  const [projectName, siteTheme] = await Promise.all([
    getPublishedProjectName(source.projectId, source.customPath),
    getPublishedSiteTheme(source.projectId, source.customPath),
  ]);
  const siteTitle = siteTheme.branding?.siteTitle?.trim() || projectName || 'Dev Docs';

  return buildReaderMetadata(siteTitle, siteTheme.branding?.faviconSrc);
}

export default async function Layout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ lang: string }>;
}) {
  if (!isDocsReaderAvailable()) {
    return notFound();
  }

  const { lang } = await params;
  const source = await resolveRequestDocsSource();
  const availableLanguages = await getPublishedLanguages(source.projectId, source.customPath);
  if (!availableLanguages.includes(lang as DocsLang)) {
    notFound();
  }
  const docsLang = lang as DocsLang;

  const { nav, pages } = await getPublishedContext(docsLang, source.projectId, source.customPath);
  const [projectName, siteTheme, siteNavigation] = await Promise.all([
    getPublishedProjectName(source.projectId, source.customPath),
    getPublishedSiteTheme(source.projectId, source.customPath),
    getPublishedSiteNavigation(docsLang, source.projectId, source.customPath),
  ]);
  const theme = resolveDocsTheme(siteTheme.id);
  const ReaderLayout = theme.ReaderLayout;

  return (
    <html lang={resolveDocsLocale(docsLang)} className="cregis-theme" suppressHydrationWarning>
      <body className="antialiased" suppressHydrationWarning>
        <ReaderLayout
          lang={docsLang}
          availableLanguages={availableLanguages}
          nav={nav}
          pages={pages}
          searchFindHref={getReaderSearchFindHref(docsLang)}
          searchIndexHref={getReaderSearchIndexHref(docsLang)}
          projectName={projectName}
          siteTheme={siteTheme}
          siteNavigation={siteNavigation}
        >
          {children}
        </ReaderLayout>
      </body>
    </html>
  );
}
