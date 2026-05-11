import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { ScalarApiReference } from "@/components/docs/scalar-api-reference";
import {
  getApiSourceRouteSlug,
  getPublishedApiSourceByRouteSlug,
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

function getApiSourceCategory(lang: DocsLang, sourceId: string) {
  const normalized = sourceId.toLowerCase();
  if (normalized.includes("payment-engine")) {
    return lang === "zh" ? "支付引擎 API" : "Payment Engine API";
  }
  if (normalized.includes("waas")) {
    return lang === "zh" ? "WaaS 钱包 API" : "WaaS API";
  }
  return lang === "zh" ? "API 文档" : "API Reference";
}

function getApiSourceSummary(lang: DocsLang, sourceId: string) {
  const normalized = sourceId.toLowerCase();
  if (normalized.includes("payment-engine")) {
    return lang === "zh"
      ? "用于创建订单、查询订单、接收支付回调等支付引擎场景。"
      : "Create orders, query order status, and receive payment callbacks.";
  }
  if (normalized.includes("waas")) {
    return lang === "zh"
      ? "用于创建地址、查询充值、发起提币与接收 WaaS 回调。"
      : "Create addresses, query deposits, submit payouts, and receive WaaS callbacks.";
  }
  return lang === "zh"
    ? "查看接口说明、请求参数、返回字段与调用示例。"
    : "View endpoints, request parameters, response fields, and examples.";
}

function renderApiReferenceIndex(
  lang: DocsLang,
  sources: Awaited<ReturnType<typeof getPublishedApiSources>>,
) {
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
        {sources.map((apiSource) => (
          <Link
            key={apiSource.id}
            href={`/${lang}/reference/${getApiSourceRouteSlug(apiSource)}`}
            className="rounded-2xl border border-fd-border bg-white p-5 shadow-sm transition hover:border-fd-foreground/20 hover:shadow-md"
          >
            <div className="space-y-2">
              <div className="text-xs font-medium uppercase tracking-[0.1em] text-fd-muted-foreground">
                {getApiSourceCategory(lang, apiSource.id)}
              </div>
              <h2 className="text-xl font-semibold text-fd-foreground">
                {apiSource.display.title}
              </h2>
              <p className="text-sm leading-6 text-fd-muted-foreground">
                {getApiSourceSummary(lang, apiSource.id)}
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

  const routeSlug = segments[0]!;
  const apiSource = await getPublishedApiSourceByRouteSlug(
    lang,
    routeSlug,
    source.projectId,
    source.customPath,
  );
  if (!apiSource) {
    notFound();
  }

  const spec = await getPublishedApiSourceSpec(
    lang,
    apiSource.id,
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
            ? lang === "zh"
              ? `${apiSource.display.title} 的交互式 API 参考。`
              : `Interactive API reference for ${apiSource.display.title}.`
            : lang === "zh"
              ? `查看 ${apiSource.display.title} 的接口说明、参数与示例。`
              : `View endpoints, parameters, and examples for ${apiSource.display.title}.`
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
      const routeSlug = getApiSourceRouteSlug(apiSource);
      params.push({ lang, slug: [routeSlug] });
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
