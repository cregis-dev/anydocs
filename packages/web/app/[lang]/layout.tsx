import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';

import {
  getPublishedContext,
  getPublishedLanguages,
  getPublishedProjectName,
  getPublishedSiteNavigation,
  getPublishedSiteTheme,
  isDocsReaderAvailable,
  resolveRequestDocsSource,
} from '@/lib/docs/data';
import type { DocsLang } from '@/lib/docs/types';
import { resolveDocsLocale } from '@/lib/docs/seo';
import { resolveDocsTheme } from '@/lib/themes/resolve-theme';

import '../globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Dev Docs',
    template: '%s | Dev Docs',
  },
  description: '面向开发者的产品/组件文档与示例',
};

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
