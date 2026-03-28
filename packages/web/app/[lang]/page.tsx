import { notFound } from "next/navigation";
import type { Metadata } from "next";

import {
  getCliDocsSourceFromEnv,
  getPublishedProjectName,
  getPublishedLanguages,
  getPublishedSiteTheme,
  getPublishedSiteUrl,
  isDocsReaderAvailable,
  resolveRequestDocsSource,
} from "@/lib/docs/data";
import {
  buildPreviewRobotsMetadata,
  buildPublishedAbsoluteUrl,
  resolveDocsLocale,
} from "@/lib/docs/seo";
import type { DocsLang } from "@/lib/docs/types";

export async function generateStaticParams() {
  if (!isDocsReaderAvailable()) {
    return [];
  }

  const source = getCliDocsSourceFromEnv();
  if (!source) {
    return [];
  }

  const languages = await getPublishedLanguages(
    source.projectId,
    source.customPath,
  );
  return languages.map((lang) => ({ lang }));
}

export default async function Page({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  if (!isDocsReaderAvailable()) {
    return notFound();
  }

  const { lang } = await params;
  const source = await resolveRequestDocsSource();
  const languages = await getPublishedLanguages(
    source.projectId,
    source.customPath,
  );
  if (!languages.includes(lang as (typeof languages)[number])) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-semibold">Docs</h1>
      <p className="mt-2 text-sm text-fd-muted-foreground">
        Select a document from the sidebar.
      </p>
    </div>
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  if (!isDocsReaderAvailable()) {
    return {};
  }

  const { lang: rawLang } = await params;
  const source = await resolveRequestDocsSource();
  const languages = await getPublishedLanguages(
    source.projectId,
    source.customPath,
  );
  if (!languages.includes(rawLang as DocsLang)) {
    return {};
  }

  const lang = rawLang as DocsLang;
  const [projectName, siteTheme, siteUrl] = await Promise.all([
    getPublishedProjectName(source.projectId, source.customPath),
    getPublishedSiteTheme(source.projectId, source.customPath),
    getPublishedSiteUrl(source.projectId, source.customPath),
  ]);
  const siteTitle = siteTheme.branding?.siteTitle?.trim() || projectName;
  const languageAlternates = Object.fromEntries(
    languages
      .map((language) => {
        const url = buildPublishedAbsoluteUrl(siteUrl, language);
        return url ? [language, url] : null;
      })
      .filter((entry): entry is [string, string] => entry !== null),
  );
  const canonical = buildPublishedAbsoluteUrl(siteUrl, lang);

  return {
    title: siteTitle,
    description: `Browse published documentation for ${siteTitle}.`,
    robots: buildPreviewRobotsMetadata(),
    ...(canonical || Object.keys(languageAlternates).length > 0
      ? {
          alternates: {
            ...(canonical ? { canonical } : {}),
            ...(Object.keys(languageAlternates).length > 0
              ? { languages: languageAlternates }
              : {}),
          },
        }
      : {}),
    other: {
      "content-language": resolveDocsLocale(lang),
    },
  };
}
