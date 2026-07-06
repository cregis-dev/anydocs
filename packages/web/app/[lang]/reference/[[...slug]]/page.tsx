import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { OperationView } from "@/components/docs/openapi/operation-view";
import { ReferenceOverview } from "@/components/docs/openapi/reference-overview";
import { ReferenceShell } from "@/components/docs/openapi/reference-shell";
import {
  getApiSourceRouteSlug,
  getPublishedApiSourceByRouteSlug,
  getPublishedApiSources,
} from "@/lib/docs/api-sources";
import { getPublishedOpenApiDoc } from "@/lib/docs/openapi";
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

type ApiReferenceIndexItem = {
  routeSlug: string;
  title: string;
  description: string;
};

function renderApiReferenceIndex(lang: DocsLang, items: ApiReferenceIndexItem[]) {
  return (
    <div className="mx-auto flex min-w-0 max-w-5xl flex-col gap-8 px-6 py-8 sm:px-8 lg:px-10">
      <header className="space-y-3">
        <p className="text-sm font-medium uppercase tracking-[0.12em] text-fd-muted-foreground">
          {lang === "zh" ? "API 参考" : "API Reference"}
        </p>
        <h1 className="text-4xl font-semibold tracking-[-0.03em] text-fd-foreground">
          {lang === "zh" ? "选择 API 文档" : "Choose an API Reference"}
        </h1>
        <p className="max-w-3xl text-base leading-7 text-fd-muted-foreground">
          {lang === "zh"
            ? "请选择下方产品线，查看对应接口的请求参数、返回字段、调用示例与错误码。"
            : "Choose a product area below to view request parameters, response fields, examples, and error codes."}
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        {items.map((item) => (
          <Link
            key={item.routeSlug}
            href={`/${lang}/reference/${item.routeSlug}`}
            className="rounded-2xl border border-fd-border bg-white p-5 shadow-sm transition hover:border-fd-foreground/20 hover:shadow-md"
          >
            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-fd-foreground">{item.title}</h2>
              {item.description ? (
                <p className="line-clamp-3 text-sm leading-6 text-fd-muted-foreground">
                  {item.description}
                </p>
              ) : null}
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
    // 卡片标题/描述来自各 spec 的 info（数据驱动），不在代码里按 sourceId 硬编码。
    const items = await Promise.all(
      apiSources.map(async (apiSource): Promise<ApiReferenceIndexItem> => {
        const routeSlug = getApiSourceRouteSlug(apiSource);
        const doc = await getPublishedOpenApiDoc(
          lang,
          routeSlug,
          source.projectId,
          source.customPath,
        );
        return {
          routeSlug,
          title: doc?.info.title ?? apiSource.display.title,
          description: doc?.info.description ?? "",
        };
      }),
    );
    return renderApiReferenceIndex(lang, items);
  }

  if (segments.length > 2) {
    notFound();
  }

  const routeSlug = segments[0]!;
  const doc = await getPublishedOpenApiDoc(
    lang,
    routeSlug,
    source.projectId,
    source.customPath,
  );
  if (!doc) {
    notFound();
  }

  const overviewLabel = lang === "zh" ? "概览" : "Overview";

  if (segments.length === 1) {
    return (
      <ReferenceShell
        lang={lang}
        nav={doc.nav}
        overviewHref={doc.href}
        overviewLabel={overviewLabel}
      >
        <ReferenceOverview doc={doc} lang={lang} />
      </ReferenceShell>
    );
  }

  const operation = doc.operations.find((item) => item.id === segments[1]);
  if (!operation) {
    notFound();
  }

  const apiSource = await getPublishedApiSourceByRouteSlug(
    lang,
    routeSlug,
    source.projectId,
    source.customPath,
  );

  return (
    <ReferenceShell
      lang={lang}
      nav={doc.nav}
      overviewHref={doc.href}
      overviewLabel={overviewLabel}
    >
      <OperationView
        operation={operation}
        schemas={doc.schemas}
        lang={lang}
        tryIt={apiSource?.runtime?.tryIt}
        sourceId={apiSource?.id}
      />
    </ReferenceShell>
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
      const routeSlug = getApiSourceRouteSlug(apiSource);
      params.push({ lang, slug: [routeSlug] });
      const doc = await getPublishedOpenApiDoc(
        lang,
        routeSlug,
        source.projectId,
        source.customPath,
      );
      for (const operation of doc?.operations ?? []) {
        params.push({ lang, slug: [routeSlug, operation.id] });
      }
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
      title: lang === "zh" ? "API 参考" : "API Reference",
      description:
        lang === "zh"
          ? "选择一个 API 文档查看接口说明、参数、示例与错误码。"
          : "Select an API reference to view endpoints, parameters, examples, and error codes.",
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

  if (segments.length === 2) {
    const doc = await getPublishedOpenApiDoc(
      lang,
      segments[0]!,
      source.projectId,
      source.customPath,
    );
    const operation = doc?.operations.find((item) => item.id === segments[1]);
    if (!doc || !operation) {
      return {};
    }
    const canonical = buildPublishedAbsoluteUrl(
      siteUrl,
      `${lang}/reference/${segments[0]}/${operation.id}`,
    );
    return {
      title: operation.summary,
      description: operation.kind === "webhook" ? "Webhook" : `${operation.method} ${operation.path}`,
      robots: buildPreviewRobotsMetadata(),
      ...(canonical ? { alternates: { canonical } } : {}),
      other: {
        "content-language": resolveDocsLocale(lang),
      },
    };
  }

  if (segments.length !== 1) {
    return {};
  }

  const apiSource = await getPublishedApiSourceByRouteSlug(
    lang,
    segments[0]!,
    source.projectId,
    source.customPath,
  );
  if (!apiSource) {
    return {};
  }
  const routeSlug = getApiSourceRouteSlug(apiSource);

  const languageAlternatesEntries = await Promise.all(
    languages.map(async (language) => {
      const localizedSource = await getPublishedApiSourceByRouteSlug(
        language,
        routeSlug,
        source.projectId,
        source.customPath,
      );
      const url = localizedSource
        ? buildPublishedAbsoluteUrl(
            siteUrl,
            `${language}/reference/${getApiSourceRouteSlug(localizedSource)}`,
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
    `${lang}/reference/${routeSlug}`,
  );

  return {
    title: apiSource.display.title,
    description:
      lang === "zh"
        ? `${apiSource.display.title} 的 API 参考`
        : `API Reference for ${apiSource.display.title}`,
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
