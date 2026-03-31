import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { ScalarApiReference } from "@/components/docs/scalar-api-reference";
import {
  getPublishedApiSourceById,
  getPublishedApiSourceSpec,
  getPublishedApiSources,
} from "@/lib/docs/api-sources";
import {
  getCliDocsSourceFromEnv,
  getPublishedLanguages,
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

function renderApiReferenceIndex(
  lang: DocsLang,
  sources: Awaited<ReturnType<typeof getPublishedApiSources>>,
) {
  return (
    <div className="mx-auto flex min-w-0 max-w-5xl flex-col gap-8 px-6 py-8 sm:px-8 lg:px-10">
      <header className="space-y-3">
        <p className="text-sm font-medium uppercase tracking-[0.12em] text-fd-muted-foreground">
          API Reference
        </p>
        <h1 className="text-4xl font-semibold tracking-[-0.03em] text-fd-foreground">
          Published API Sources
        </h1>
        <p className="max-w-3xl text-base leading-7 text-fd-muted-foreground">
          OpenAPI-backed references rendered with Scalar. This MVP keeps the
          reader shell and serves one reference route per published API source.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        {sources.map((apiSource) => (
          <Link
            key={apiSource.id}
            href={`/${lang}/reference/${apiSource.id}`}
            className="rounded-2xl border border-fd-border bg-white p-5 shadow-sm transition hover:border-fd-foreground/20 hover:shadow-md"
          >
            <div className="space-y-2">
              <div className="text-xs font-medium uppercase tracking-[0.1em] text-fd-muted-foreground">
                {apiSource.id}
              </div>
              <h2 className="text-xl font-semibold text-fd-foreground">
                {apiSource.display.title}
              </h2>
              <p className="text-sm leading-6 text-fd-muted-foreground">
                {apiSource.source.kind === "url"
                  ? apiSource.source.url
                  : apiSource.source.path}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default async function ApiReferencePage({
  params,
}: {
  params: Promise<{ lang: string; slug?: string[] }>;
}) {
  if (!isDocsReaderAvailable()) {
    return notFound();
  }

  const { lang: rawLang, slug } = await params;
  const source = await resolveRequestDocsSource();
  const languages = await getPublishedLanguages(
    source.projectId,
    source.customPath,
  );
  if (!languages.includes(rawLang as DocsLang)) {
    notFound();
  }

  const lang = rawLang as DocsLang;
  const segments = slug ?? [];

  if (segments.length === 0) {
    const apiSources = await getPublishedApiSources(
      lang,
      source.projectId,
      source.customPath,
    );
    if (apiSources.length === 0) {
      notFound();
    }
    return renderApiReferenceIndex(lang, apiSources);
  }

  if (segments.length !== 1) {
    notFound();
  }

  const sourceId = segments[0]!;
  const apiSource = await getPublishedApiSourceById(
    lang,
    sourceId,
    source.projectId,
    source.customPath,
  );
  if (!apiSource) {
    notFound();
  }

  const spec = await getPublishedApiSourceSpec(
    lang,
    sourceId,
    source.projectId,
    source.customPath,
  );
  if (!spec) {
    notFound();
  }

  return (
    <div className="min-w-0 px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
      <ScalarApiReference
        specContent={spec}
        showTryIt={apiSource.runtime?.tryIt?.enabled ?? false}
        title={apiSource.display.title}
        description={
          apiSource.source.kind === "url"
            ? `Interactive OpenAPI reference for ${apiSource.display.title}.`
            : `Interactive OpenAPI reference built from ${apiSource.source.path}.`
        }
        sourceId={apiSource.id}
      />
    </div>
  );
}

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
  const params: Array<{ lang: DocsLang; slug?: string[] }> = [];

  for (const lang of languages) {
    params.push({ lang, slug: [] });
    const apiSources = await getPublishedApiSources(
      lang,
      source.projectId,
      source.customPath,
    );
    for (const apiSource of apiSources) {
      params.push({ lang, slug: [apiSource.id] });
    }
  }

  return params;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; slug?: string[] }>;
}): Promise<Metadata> {
  if (!isDocsReaderAvailable()) {
    return {};
  }

  const { lang: rawLang, slug } = await params;
  const source = await resolveRequestDocsSource();
  const languages = await getPublishedLanguages(
    source.projectId,
    source.customPath,
  );
  if (!languages.includes(rawLang as DocsLang)) {
    return {};
  }

  const lang = rawLang as DocsLang;
  const segments = slug ?? [];
  const siteUrl = await getPublishedSiteUrl(
    source.projectId,
    source.customPath,
  );

  if (segments.length === 0) {
    const apiSources = await getPublishedApiSources(
      lang,
      source.projectId,
      source.customPath,
    );
    if (apiSources.length === 0) {
      return {};
    }
    const languageAlternatesEntries = await Promise.all(
      languages.map(async (language) => {
        const apiSources = await getPublishedApiSources(
          language,
          source.projectId,
          source.customPath,
        );
        const url =
          apiSources.length > 0
            ? buildPublishedAbsoluteUrl(siteUrl, `${language}/reference`)
            : undefined;
        return url ? [language, url] : null;
      }),
    );
    const languageAlternates = Object.fromEntries(
      languageAlternatesEntries.filter(
        (entry): entry is [string, string] => entry !== null,
      ),
    );
    const canonical = buildPublishedAbsoluteUrl(siteUrl, `${lang}/reference`);
    return {
      title: "API Reference",
      description: "Published OpenAPI-backed API references.",
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

  if (segments.length !== 1) {
    return {};
  }

  const apiSource = await getPublishedApiSourceById(
    lang,
    segments[0]!,
    source.projectId,
    source.customPath,
  );
  if (!apiSource) {
    return {};
  }

  const languageAlternatesEntries = await Promise.all(
    languages.map(async (language) => {
      const localizedSource = await getPublishedApiSourceById(
        language,
        segments[0]!,
        source.projectId,
        source.customPath,
      );
      const url = localizedSource
        ? buildPublishedAbsoluteUrl(
            siteUrl,
            `${language}/reference/${localizedSource.id}`,
          )
        : undefined;
      return url ? [language, url] : null;
    }),
  );
  const languageAlternates = Object.fromEntries(
    languageAlternatesEntries.filter(
      (entry): entry is [string, string] => entry !== null,
    ),
  );
  const canonical = buildPublishedAbsoluteUrl(
    siteUrl,
    `${lang}/reference/${apiSource.id}`,
  );

  return {
    title: apiSource.display.title,
    description: `API Reference for ${apiSource.display.title}`,
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
