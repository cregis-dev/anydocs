import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { DocContentView } from "@/components/docs/doc-content-view";
import { DocsToc } from "@/components/docs/toc";
import {
  getCliDocsSourceFromEnv,
  getPublishedContext,
  getPublishedDocStaticParams,
  getPublishedLanguages,
  getPublishedPageBySlug,
  getPublishedSiteUrl,
  getPublishedSiteTheme,
  isDocsReaderAvailable,
  resolveRequestDocsSource,
} from "@/lib/docs/data";
import { normalizeSlug } from "@/lib/docs/fs";
import {
  buildPreviewRobotsMetadata,
  buildPublishedAbsoluteUrl,
  resolveDocsLocale,
} from "@/lib/docs/seo";
import type { DocsLang } from "@/lib/docs/types";
import { buildBreadcrumbsByPageId, findNextPrevPageIds } from "@/lib/docs/nav";
import {
  extractTocFromMarkdown,
  normalizeMarkdownForRendering,
} from "@/lib/docs/markdown";
import {
  extractTocFromYooptaContent,
  getRenderableYooptaContent,
} from "@/lib/docs/yoopta-reader";
import { cn } from "@/lib/utils";
import { ATLAS_DOCS_THEME_ID } from "@/themes/atlas-docs/manifest";

const EMPTY_EXPORT_PLACEHOLDER = "__anydocs-empty__";

function stripLeadingTitleHeading(markdown: string, title: string) {
  const lines = markdown.split("\n");
  let index = 0;

  while (index < lines.length && lines[index]?.trim() === "") {
    index += 1;
  }

  const firstLine = lines[index]?.trim();
  if (!firstLine) {
    return markdown;
  }

  const expectedHeading = `# ${title.trim()}`;
  if (firstLine !== expectedHeading) {
    return markdown;
  }

  index += 1;
  while (index < lines.length && lines[index]?.trim() === "") {
    index += 1;
  }

  return lines.slice(index).join("\n");
}

export default async function Page({
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
  const slugStr = normalizeSlug(slug);
  if (slugStr === EMPTY_EXPORT_PLACEHOLDER) {
    notFound();
  }
  const { nav, pages } = await getPublishedContext(
    lang,
    source.projectId,
    source.customPath,
  );

  const page = await getPublishedPageBySlug(
    lang,
    slugStr,
    source.projectId,
    source.customPath,
  );
  if (!page) {
    notFound();
  }

  const siteTheme = await getPublishedSiteTheme(
    source.projectId,
    source.customPath,
  );
  const isAtlasTheme = siteTheme.id === ATLAS_DOCS_THEME_ID;
  const markdown = normalizeMarkdownForRendering(
    stripLeadingTitleHeading(page.render?.markdown ?? "", page.title),
  );
  const yooptaContent = getRenderableYooptaContent(page.content, page.title);
  const toc = extractTocFromMarkdown(markdown);
  const effectiveToc =
    toc.length > 0 ? toc : extractTocFromYooptaContent(yooptaContent);
  const crumbs = buildBreadcrumbsByPageId(nav).get(page.id) ?? [];
  const showBreadcrumbs = crumbs.length > 0;
  const { prev, next } = findNextPrevPageIds(nav.items, page.id);
  const prevPage = prev ? (pages.find((p) => p.id === prev) ?? null) : null;
  const nextPage = next ? (pages.find((p) => p.id === next) ?? null) : null;

  return (
    <div
      className={cn(
        "flex min-w-0",
        isAtlasTheme && "bg-[color:var(--atlas-body-background)]",
      )}
    >
      <div
        className={cn(
          "min-w-0 flex-1 px-6 py-8 sm:px-8 lg:px-10 lg:py-0",
          isAtlasTheme && "px-4 py-4 sm:px-6 lg:px-8 lg:py-6",
        )}
      >
        <div
          className={cn(
            "mx-auto max-w-[670px] pb-16 pt-8 lg:pb-20",
            isAtlasTheme && "max-w-[760px] pb-16 pt-8",
          )}
        >
          {showBreadcrumbs ? (
            <div
              className={cn(
                "mb-8 text-[14px] leading-5 text-[color:var(--docs-body-copy-subtle,var(--fd-muted-foreground))]",
                isAtlasTheme && "mb-7 text-[12px] leading-5 tracking-[0.01em]",
              )}
            >
              <span className="inline-flex max-w-full items-center gap-2">
                {crumbs.map((c, i) => (
                  <span
                    key={`${c}-${i}`}
                    className="inline-flex items-center gap-2"
                  >
                    <span className="truncate">{c}</span>
                    {i < crumbs.length - 1 ? <span>›</span> : null}
                  </span>
                ))}
              </span>
            </div>
          ) : null}

          <header
            className={cn("mb-10 space-y-4", isAtlasTheme && "mb-8 space-y-3")}
          >
            <h1
              className={cn(
                "text-[36px] font-bold leading-[1.12] tracking-[-0.03em] text-fd-foreground",
                isAtlasTheme && "text-[34px] font-semibold tracking-[-0.03em]",
              )}
            >
              {page.title}
            </h1>
            {page.description ? (
              <p
                className={cn(
                  "max-w-[590px] text-[18px] font-light leading-[1.75] text-[color:var(--docs-body-copy,var(--fd-muted-foreground))]",
                  isAtlasTheme &&
                    "max-w-[720px] text-[15px] font-normal leading-7 tracking-[-0.01em]",
                )}
              >
                {page.description}
              </p>
            ) : null}
          </header>

          <DocContentView
            markdown={markdown}
            yooptaContent={yooptaContent}
            markdownClassName={cn(
              isAtlasTheme &&
                "prose-p:my-3 prose-p:text-[15px] prose-p:leading-7 prose-li:text-[15px] prose-li:leading-7 prose-h2:mb-3 prose-h2:mt-10 prose-h3:mb-2 prose-h3:mt-7 prose-table:mt-6",
            )}
            yooptaClassName={cn(
              isAtlasTheme &&
                "[&_h2]:mb-3 [&_h2]:mt-10 [&_h3]:mb-2 [&_h3]:mt-7 [&_li]:text-[15px] [&_li]:leading-7 [&_p]:my-3 [&_p]:text-[15px] [&_p]:leading-7 [&_table]:mt-6",
            )}
          />

          <div
            className={cn(
              "mt-14 flex items-center justify-between border-t border-fd-border pt-6",
              isAtlasTheme && "mt-12 border-t-0 pt-0",
            )}
          >
            {prevPage ? (
              <Link
                href={`/${lang}/${prevPage.slug}`}
                className={cn(
                  "rounded-xl border border-fd-border px-4 py-2.5 text-sm text-[color:var(--docs-body-copy,var(--fd-foreground))] transition hover:bg-fd-muted",
                  isAtlasTheme &&
                    "rounded-none border-0 bg-transparent px-0 py-0 text-[13px] text-[color:var(--docs-body-copy,var(--fd-foreground))] hover:text-fd-primary",
                )}
              >
                ← {prevPage.title}
              </Link>
            ) : (
              <span />
            )}
            {nextPage ? (
              <Link
                href={`/${lang}/${nextPage.slug}`}
                className={cn(
                  "rounded-xl border border-fd-border px-4 py-2.5 text-sm text-[color:var(--docs-body-copy,var(--fd-foreground))] transition hover:bg-fd-muted",
                  isAtlasTheme &&
                    "rounded-none border-0 bg-transparent px-0 py-0 text-[13px] text-[color:var(--docs-body-copy,var(--fd-foreground))] hover:text-fd-primary",
                )}
              >
                {nextPage.title} →
              </Link>
            ) : (
              <span />
            )}
          </div>
        </div>
      </div>

      <DocsToc
        toc={effectiveToc}
        className={cn(
          isAtlasTheme &&
            "sticky top-[60px] self-start h-[calc(100dvh-60px)] w-[280px] overflow-hidden border-l-0 bg-transparent px-5 py-6",
        )}
        contentClassName={cn(
          isAtlasTheme &&
            "rounded-[22px] border border-[color:color-mix(in_srgb,var(--fd-border)_82%,white)] bg-white px-6 py-7 shadow-[0_14px_40px_rgba(15,23,42,0.06)]",
        )}
        hideTitle={isAtlasTheme}
        listClassName={cn(
          isAtlasTheme &&
            "relative space-y-4 pl-10 before:absolute before:bottom-2 before:left-0 before:top-2 before:w-px before:bg-[color:color-mix(in_srgb,var(--docs-toc-divider)_92%,white)]",
        )}
        activeLinkClassName={cn(
          isAtlasTheme &&
            "relative -ml-10 rounded-none border-l-0 bg-transparent py-0 pl-10 text-[14px] font-medium leading-6 text-[color:var(--docs-toc-link-active,var(--fd-foreground))] before:absolute before:left-0 before:top-1/2 before:h-10 before:w-[3px] before:-translate-y-1/2 before:rounded-full before:bg-[color:var(--docs-toc-link-active,var(--fd-foreground))]",
        )}
        inactiveLinkClassName={cn(
          isAtlasTheme &&
            "rounded-none border-l-0 bg-transparent py-0 pl-10 text-[14px] font-normal leading-6 text-[color:var(--docs-toc-link,var(--fd-muted-foreground))] hover:text-[color:var(--docs-toc-link-hover,var(--fd-foreground))]",
        )}
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

  const params = await getPublishedDocStaticParams(
    source.projectId,
    source.customPath,
  );
  const pageParams = params.filter((entry) => entry.slug.length > 0);
  if (pageParams.length > 0) {
    return pageParams;
  }

  const languages = await getPublishedLanguages(
    source.projectId,
    source.customPath,
  );
  return languages.map((lang) => ({
    lang,
    slug: [EMPTY_EXPORT_PLACEHOLDER],
  }));
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

  const slugStr = normalizeSlug(slug);
  if (slugStr === EMPTY_EXPORT_PLACEHOLDER) {
    return {};
  }
  const page = await getPublishedPageBySlug(
    lang,
    slugStr,
    source.projectId,
    source.customPath,
  );
  if (!page) {
    return {};
  }

  const siteUrl = await getPublishedSiteUrl(
    source.projectId,
    source.customPath,
  );
  const languageAlternatesEntries = await Promise.all(
    languages.map(async (language) => {
      const localizedPage = await getPublishedPageBySlug(
        language,
        slugStr,
        source.projectId,
        source.customPath,
      );
      const url = localizedPage
        ? buildPublishedAbsoluteUrl(
            siteUrl,
            `${language}/${localizedPage.slug}`,
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
  const canonical = buildPublishedAbsoluteUrl(siteUrl, `${lang}/${page.slug}`);

  return {
    title: page.title,
    description: page.description,
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
