import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { ReactNode } from "react";

import { ScalarApiReference } from "@/components/docs/scalar-api-reference";
import {
  getPublishedApiSourceById,
  getPublishedApiSourceSpec,
} from "@/lib/docs/api-sources";
import { DocContentView } from "@/components/docs/doc-content-view";
import { getDocsUiCopy } from "@/components/docs/docs-ui-copy";
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
  extractTocFromDocContent,
  getRenderableDocContent,
} from "@/lib/docs/canonical-reader";
import {
  extractTocFromLegacyYooptaContent,
  getRenderableLegacyYooptaContent,
} from "@/lib/docs/legacy-yoopta-reader";
import { cn } from "@/lib/utils";
import {
  formatBlueprintDate,
  formatBlueprintList,
  formatBlueprintValue,
  getBlueprintDocTypeLabel,
  inferBlueprintPageMode,
  getBlueprintReviewStateLabel,
  getBlueprintStatusLabel,
} from "@/lib/themes/blueprint-review";
import { BLUEPRINT_REVIEW_THEME_ID } from "@/themes/blueprint-review/manifest";
import { BlueprintMobileTocButton, BlueprintTocRail } from "@/themes/blueprint-review/toc-rail";
import { ATLAS_DOCS_THEME_ID } from "@/themes/atlas-docs/manifest";
import { CLASSIC_DOCS_THEME_ID } from "@/themes/classic-docs/manifest";

const EMPTY_EXPORT_PLACEHOLDER = "__anydocs-empty__";

function BlueprintMetaItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <span className="inline-flex items-baseline gap-2 whitespace-nowrap">
      <span className="text-[color:var(--docs-body-copy-subtle,var(--fd-muted-foreground))]">{label}</span>
      <span className="font-semibold text-fd-foreground">{value}</span>
    </span>
  );
}

function BlueprintSectionPath({
  crumbs,
}: {
  crumbs: string[];
}) {
  if (crumbs.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--docs-body-copy-subtle,var(--fd-muted-foreground))]">
      {crumbs.map((crumb, index) => (
        <div key={`${crumb}-${index}`} className="inline-flex items-center gap-2">
          {index > 0 ? (
            <span aria-hidden="true" className="text-[color:var(--fd-border)]">
              /
            </span>
          ) : null}
          <span>{crumb}</span>
        </div>
      ))}
    </div>
  );
}

function BlueprintInfoPanel({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-[18px] border bg-[color:var(--blueprint-surface)] p-4",
        className,
      )}
      data-blueprint-divider
    >
      <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--docs-body-copy-subtle,var(--fd-muted-foreground))]">
        {title}
      </div>
      {children}
    </section>
  );
}

function BlueprintInfoList({
  items,
}: {
  items: Array<{ label: string; value: string }>;
}) {
  return (
    <dl className="space-y-2.5">
      {items.map((item) => (
        <div
          key={`${item.label}-${item.value}`}
          className="grid grid-cols-[92px_minmax(0,1fr)] gap-3 text-[13px] leading-6"
        >
          <dt className="text-[color:var(--docs-body-copy-subtle,var(--fd-muted-foreground))]">
            {item.label}
          </dt>
          <dd className="min-w-0 font-medium text-fd-foreground">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function normalizeBlueprintToken(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, " ")
    .trim();
}

function getBlueprintNonRedundantTags(tags: string[] | undefined, crumbs: string[], title: string) {
  if (!tags || tags.length === 0) {
    return [];
  }

  const redundantTokens = new Set(
    [...crumbs, title]
      .map(normalizeBlueprintToken)
      .flatMap((value) => value.split(/\s+/))
      .filter(Boolean),
  );

  return tags.filter((tag) => {
    const normalized = normalizeBlueprintToken(tag);
    if (!normalized) {
      return false;
    }

    const words = normalized.split(/\s+/).filter(Boolean);
    return words.some((word) => !redundantTokens.has(word));
  });
}

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

  // Render OpenAPI-backed pages inline using Scalar
  if (page.template === "api-source") {
    const sourceId =
      typeof (page.metadata as Record<string, unknown> | undefined)?.["api-source"] === "string"
        ? ((page.metadata as Record<string, unknown>)["api-source"] as string)
        : null;
    if (!sourceId) notFound();
    const [apiSource, spec] = await Promise.all([
      getPublishedApiSourceById(lang, sourceId, source.projectId, source.customPath),
      getPublishedApiSourceSpec(lang, sourceId, source.projectId, source.customPath),
    ]);
    if (!apiSource || !spec) notFound();
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

  const siteTheme = await getPublishedSiteTheme(
    source.projectId,
    source.customPath,
  );
  const isClassicTheme = siteTheme.id === CLASSIC_DOCS_THEME_ID;
  const isAtlasTheme = siteTheme.id === ATLAS_DOCS_THEME_ID;
  const isBlueprintReviewTheme = siteTheme.id === BLUEPRINT_REVIEW_THEME_ID;
  const classicMarkdownClassName =
    "prose-p:my-3 prose-p:text-[15px] prose-p:leading-7 prose-li:text-[15px] prose-li:leading-7 prose-h2:mb-3 prose-h2:mt-10 prose-h3:mb-2 prose-h3:mt-7 prose-table:mt-6 prose-code:rounded-sm prose-code:bg-[color:var(--classic-muted)] prose-pre:rounded-lg prose-pre:border-[color:var(--docs-divider,var(--fd-border))] prose-pre:bg-[#171717] prose-pre:shadow-none prose-blockquote:border-l-2 prose-blockquote:border-[color:var(--docs-divider,var(--fd-border))] prose-blockquote:pl-4 prose-blockquote:text-[15px] prose-blockquote:leading-7 [&_pre_code]:block [&_pre_code]:px-4 [&_pre_code]:py-3.5 [&_pre_code]:text-[13px] [&_pre_code]:leading-6 [&_table]:w-full [&_table]:rounded-none [&_table]:border-x-0 [&_table]:border-y [&_table]:border-[color:var(--docs-divider,var(--fd-border))] [&_th]:border-x-0 [&_th]:bg-transparent [&_th]:px-3 [&_th]:py-2.5 [&_th]:text-[12px] [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-[0.08em] [&_th]:text-[color:var(--docs-body-copy-subtle,var(--fd-muted-foreground))] [&_td]:border-x-0 [&_td]:px-3 [&_td]:py-2.5 [&_td]:text-[14px] [&_td]:leading-6 [&_hr]:my-10 [&_img]:rounded-lg [&_img]:shadow-none";
  const classicStructuredClassName =
    "[&_h2]:mb-3 [&_h2]:mt-10 [&_h3]:mb-2 [&_h3]:mt-7 [&_li]:text-[15px] [&_li]:leading-7 [&_p]:my-3 [&_p]:text-[15px] [&_p]:leading-7 [&_blockquote]:my-6 [&_blockquote]:border-l-2 [&_blockquote]:border-[color:var(--docs-divider,var(--fd-border))] [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-[15px] [&_blockquote]:leading-7 [&_code]:rounded-sm [&_code]:bg-[color:var(--classic-muted)] [&_code]:px-1.5 [&_code]:py-0.5 [&_pre]:my-6 [&_pre]:rounded-lg [&_pre]:border [&_pre]:border-[color:var(--docs-divider,var(--fd-border))] [&_pre]:bg-[#171717] [&_pre]:px-0 [&_pre]:py-0 [&_pre]:shadow-none [&_pre_code]:block [&_pre_code]:px-4 [&_pre_code]:py-3.5 [&_pre_code]:text-[13px] [&_pre_code]:leading-6 [&_table]:mt-6 [&_table]:w-full [&_table]:rounded-none [&_table]:border-x-0 [&_table]:border-y [&_table]:border-[color:var(--docs-divider,var(--fd-border))] [&_th]:border-x-0 [&_th]:bg-transparent [&_th]:px-3 [&_th]:py-2.5 [&_th]:text-[12px] [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-[0.08em] [&_th]:text-[color:var(--docs-body-copy-subtle,var(--fd-muted-foreground))] [&_td]:border-x-0 [&_td]:px-3 [&_td]:py-2.5 [&_td]:text-[14px] [&_td]:leading-6 [&_hr]:my-10 [&_img]:rounded-lg [&_img]:shadow-none [&_[data-doc-callout]]:rounded-lg [&_[data-doc-callout]]:border-[color:var(--docs-divider,var(--fd-border))] [&_[data-doc-callout]]:bg-transparent [&_[data-doc-callout]]:px-4 [&_[data-doc-callout]]:py-3.5 [&_[data-doc-callout]]:shadow-none [&_[data-doc-callout-title]]:mb-2 [&_[data-doc-callout-title]]:text-[11px] [&_[data-doc-callout-title]]:font-semibold [&_[data-doc-callout-title]]:uppercase [&_[data-doc-callout-title]]:tracking-[0.12em] [&_[data-doc-callout-title]]:text-[color:var(--docs-body-copy-subtle,var(--fd-muted-foreground))] [&_[data-doc-callout-body]]:text-[15px] [&_[data-doc-callout-body]]:leading-7 [&_[data-doc-code-group]]:my-8 [&_[data-doc-code-panel]]:border-t [&_[data-doc-code-panel]]:border-[color:var(--docs-divider,var(--fd-border))] [&_[data-doc-code-panel]]:pt-3.5 [&_[data-doc-code-group]_[data-doc-code-panel]:first-child]:border-t-0 [&_[data-doc-code-group]_[data-doc-code-panel]:first-child]:pt-0 [&_[data-doc-code-title]]:mb-2 [&_[data-doc-code-title]]:text-[11px] [&_[data-doc-code-title]]:font-semibold [&_[data-doc-code-title]]:uppercase [&_[data-doc-code-title]]:tracking-[0.12em] [&_[data-doc-code-title]]:text-[color:var(--docs-body-copy-subtle,var(--fd-muted-foreground))]";
  const markdown = normalizeMarkdownForRendering(
    stripLeadingTitleHeading(page.render?.markdown ?? "", page.title),
  );
  const docContent = getRenderableDocContent(page.content, page.title);
  const legacyYooptaContent = docContent ? null : getRenderableLegacyYooptaContent(page.content, page.title);
  const toc = docContent ? extractTocFromDocContent(docContent) : extractTocFromMarkdown(markdown);
  const effectiveToc =
    toc.length > 0 ? toc : extractTocFromLegacyYooptaContent(legacyYooptaContent);
  const hasBlueprintToc = effectiveToc.length > 0;
  const crumbs = buildBreadcrumbsByPageId(nav).get(page.id) ?? [];
  const showBreadcrumbs = crumbs.length > 0;
  const { prev, next } = findNextPrevPageIds(nav.items, page.id);
  const prevPage = prev ? (pages.find((p) => p.id === prev) ?? null) : null;
  const nextPage = next ? (pages.find((p) => p.id === next) ?? null) : null;

  const metadata = page.metadata ?? {};
  const blueprintCopy = getDocsUiCopy(lang).blueprint;
  const owner = formatBlueprintValue(metadata.owner ?? metadata.author);
  const reviewer = formatBlueprintValue(metadata.reviewer);
  const reviewState = formatBlueprintValue(metadata["review-state"]);
  const docType = formatBlueprintValue(metadata["doc-type"]);
  const updatedAt = formatBlueprintDate(page.updatedAt, lang);
  const dueDate = formatBlueprintDate(formatBlueprintValue(metadata["due-date"]) ?? undefined, lang);
  const decisionSummary = [
    ...formatBlueprintList(metadata["decision-summary"]),
    ...formatBlueprintList(metadata.decisionSummary),
    ...formatBlueprintList(metadata["key-decisions"]),
    ...formatBlueprintList(metadata.decisions),
  ].filter(Boolean);
  const reviewWarnings = [
    ...(page.review?.warnings?.map((warning) => warning.message).filter(Boolean) ?? []),
    ...formatBlueprintList(metadata["open-questions"]),
    ...formatBlueprintList(metadata.reviewNotes),
  ].filter(Boolean);
  const nonRedundantTags = getBlueprintNonRedundantTags(page.tags, crumbs, page.title);
  const hasReviewSignals =
    page.status !== "published" ||
    Boolean(reviewState || reviewer || owner || dueDate || reviewWarnings.length > 0);
  const blueprintPageMode = inferBlueprintPageMode({
    title: page.title,
    docType,
    tags: page.tags,
    hasReviewSignals,
    hasDecisionSummary: decisionSummary.length > 0,
  });
  const isBlueprintOverviewPage = blueprintPageMode === "overview";

  if (isBlueprintReviewTheme) {
    const statusLabel = getBlueprintStatusLabel(page.status, lang);
    const metadataItems = isBlueprintOverviewPage
      ? ([
          { label: blueprintCopy.statusLabel, value: statusLabel },
          updatedAt ? { label: blueprintCopy.updatedLabel, value: updatedAt } : null,
        ].filter(Boolean) as Array<{ label: string; value: string }>)
      : ([
          docType ? { label: blueprintCopy.typeLabel, value: getBlueprintDocTypeLabel(docType, lang) } : null,
          { label: blueprintCopy.statusLabel, value: statusLabel },
          reviewState
            ? { label: blueprintCopy.reviewStateLabel, value: getBlueprintReviewStateLabel(reviewState, lang) }
            : null,
          owner ? { label: blueprintCopy.createdByLabel, value: owner } : null,
          reviewer ? { label: blueprintCopy.reviewerLabel, value: reviewer } : null,
          dueDate ? { label: blueprintCopy.dueLabel, value: dueDate } : null,
          updatedAt ? { label: blueprintCopy.updatedLabel, value: updatedAt } : null,
        ].filter(Boolean) as Array<{ label: string; value: string }>);
    const docContextItems = [
      nonRedundantTags.length > 0
        ? { label: blueprintCopy.tagsLabel, value: nonRedundantTags.join(" · ") }
        : null,
    ].filter(Boolean) as Array<{ label: string; value: string }>;
    const reviewItems = [
      page.status !== "published"
        ? { label: blueprintCopy.statusLabel, value: statusLabel }
        : null,
      reviewState
        ? {
            label: blueprintCopy.reviewStateLabel,
            value: getBlueprintReviewStateLabel(reviewState, lang),
          }
        : null,
      reviewer ? { label: blueprintCopy.reviewerLabel, value: reviewer } : null,
      owner ? { label: blueprintCopy.createdByLabel, value: owner } : null,
      dueDate ? { label: blueprintCopy.dueLabel, value: dueDate } : null,
    ].filter(Boolean) as Array<{ label: string; value: string }>;
    const showDecisionPanel = !isBlueprintOverviewPage && decisionSummary.length > 0;
    const showReviewPanel = !isBlueprintOverviewPage && (reviewItems.length > 0 || reviewWarnings.length > 0);
    const showContextPanel =
      !isBlueprintOverviewPage &&
      docContextItems.length > 0 &&
      (!showBreadcrumbs || showReviewPanel || showDecisionPanel);

    return (
      <div className="min-w-0">
        <div className="mx-auto max-w-[1560px]">
          <div
            className={cn(
              "grid min-w-0 items-start gap-y-0 xl:gap-x-8 2xl:gap-x-12",
              hasBlueprintToc
                ? "xl:grid-cols-[minmax(0,1fr)_min-content]"
                : "xl:grid-cols-[minmax(0,1fr)]",
            )}
          >
            <article
              className={cn(
                "min-w-0",
                hasBlueprintToc && "xl:col-start-1 xl:row-start-1",
              )}
            >
              <div className="px-5 py-6 sm:px-8 lg:px-9 lg:py-8 xl:px-12 xl:py-10">
                <div className="max-w-[940px] 2xl:max-w-[980px]">
                  <header
                    className={cn(
                      "border-b",
                      isBlueprintOverviewPage ? "space-y-4 pb-6" : "space-y-5 pb-8",
                    )}
                    data-blueprint-divider
                  >
                    <div className={cn(isBlueprintOverviewPage ? "space-y-3" : "space-y-4")}>
                      <BlueprintSectionPath crumbs={crumbs} />

                      <h1 className="text-[34px] font-bold leading-[1.08] tracking-[-0.04em] text-fd-foreground sm:text-[38px] lg:text-[40px]">
                        {page.title}
                      </h1>

                      {metadataItems.length > 0 ? (
                        <div
                          className={cn(
                            "flex flex-wrap items-center gap-y-2 tracking-[0.01em]",
                            isBlueprintOverviewPage
                              ? "gap-x-3 text-[12px] leading-5 text-[color:var(--docs-body-copy-subtle,var(--fd-muted-foreground))]"
                              : "gap-x-4 text-[13px] leading-6",
                          )}
                        >
                          {metadataItems.map((item, index) => (
                            <div
                              key={`${item.label}-${item.value}`}
                              className={cn(
                                "inline-flex items-center",
                                isBlueprintOverviewPage ? "gap-x-3" : "gap-x-4",
                              )}
                            >
                              {index > 0 ? (
                                <span
                                  aria-hidden="true"
                                  className={cn(
                                    isBlueprintOverviewPage
                                      ? "text-[color:color-mix(in_srgb,var(--fd-border)_86%,white)]"
                                      : "text-[color:var(--fd-border)]",
                                  )}
                                >
                                  ·
                                </span>
                              ) : null}
                              <BlueprintMetaItem label={item.label} value={item.value} />
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>

                    {page.description ? (
                      <p
                        className={cn(
                          "tracking-[-0.01em] text-[color:var(--docs-body-copy,var(--fd-muted-foreground))]",
                          isBlueprintOverviewPage
                            ? "max-w-[720px] text-[14px] leading-6 text-[color:color-mix(in_srgb,var(--docs-body-copy-subtle,var(--fd-muted-foreground))_92%,white)]"
                            : "max-w-[860px] text-[16px] leading-[1.75]",
                        )}
                      >
                        {page.description}
                      </p>
                    ) : null}

                    <BlueprintMobileTocButton toc={effectiveToc} lang={lang} className="pt-1" />
                  </header>

                  {showContextPanel || showReviewPanel || showDecisionPanel ? (
                    <div className="grid gap-4 border-b py-6 lg:grid-cols-2" data-blueprint-divider>
                      {showContextPanel ? (
                        <BlueprintInfoPanel title={blueprintCopy.contextTitle}>
                          <BlueprintInfoList items={docContextItems} />
                        </BlueprintInfoPanel>
                      ) : null}

                      {showReviewPanel ? (
                        <BlueprintInfoPanel title={blueprintCopy.reviewTitle}>
                          <div className="space-y-3">
                            {reviewItems.length > 0 ? <BlueprintInfoList items={reviewItems} /> : null}
                            {reviewWarnings.length > 0 ? (
                              <div className="space-y-2 border-t pt-3" data-blueprint-divider>
                                <div className="text-[12px] font-medium text-[color:var(--docs-body-copy-subtle,var(--fd-muted-foreground))]">
                                  {blueprintCopy.warningsLabel}
                                </div>
                                <ul className="space-y-1.5 text-[13px] leading-6 text-fd-foreground">
                                  {reviewWarnings.slice(0, 4).map((warning, index) => (
                                    <li key={`${warning}-${index}`} className="flex gap-2">
                                      <span
                                        aria-hidden="true"
                                        className="pt-[2px] text-[color:var(--blueprint-accent)]"
                                      >
                                        •
                                      </span>
                                      <span>{warning}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ) : null}
                          </div>
                        </BlueprintInfoPanel>
                      ) : null}

                      {showDecisionPanel ? (
                        <BlueprintInfoPanel
                          title={blueprintCopy.decisionsTitle}
                          className={cn((showContextPanel || showReviewPanel) && "lg:col-span-2")}
                        >
                          <ul className="space-y-2 text-[14px] leading-6 text-fd-foreground">
                            {decisionSummary.slice(0, 6).map((decision, index) => (
                              <li key={`${decision}-${index}`} className="flex gap-3">
                                <span className="mt-[1px] inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[color:var(--blueprint-accent-soft)] text-[12px] font-semibold text-[color:var(--blueprint-accent)]">
                                  {index + 1}
                                </span>
                                <span>{decision}</span>
                              </li>
                            ))}
                          </ul>
                        </BlueprintInfoPanel>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="pt-8">
                    <DocContentView
                      docContent={docContent}
                      markdown={markdown}
                      legacyYooptaContent={legacyYooptaContent}
                      markdownClassName="prose-p:my-3 prose-p:text-[16px] prose-p:leading-7 prose-li:text-[16px] prose-li:leading-7 prose-h2:mb-4 prose-h2:mt-10 prose-h3:mb-3 prose-h3:mt-8 prose-table:mt-6"
                      legacyYooptaClassName="[&_h2]:mb-4 [&_h2]:mt-10 [&_h3]:mb-3 [&_h3]:mt-8 [&_li]:text-[16px] [&_li]:leading-7 [&_p]:my-3 [&_p]:text-[16px] [&_p]:leading-7 [&_table]:mt-6"
                    />
                  </div>
                </div>
              </div>
            </article>

            {hasBlueprintToc ? (
              <BlueprintTocRail toc={effectiveToc} lang={lang} className="xl:col-start-2 xl:row-start-1 xl:self-start" />
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex min-w-0",
        isClassicTheme && "bg-[color:var(--classic-background)]",
        isAtlasTheme && "bg-[color:var(--atlas-body-background)]",
      )}
    >
      <div
        className={cn(
          "min-w-0 flex-1 px-6 py-8 sm:px-8 lg:px-10 lg:py-0",
          isClassicTheme && "px-5 py-6 sm:px-7 lg:px-9 lg:py-0",
          isAtlasTheme && "px-4 py-4 sm:px-6 lg:px-8 lg:py-6",
        )}
      >
        <div
          className={cn(
            "mx-auto max-w-[670px] pb-16 pt-8 lg:pb-20",
            isClassicTheme && "max-w-[760px] pb-16 pt-8",
            isAtlasTheme && "max-w-[820px] pb-20 pt-10",
          )}
        >
          {showBreadcrumbs ? (
            <div
              className={cn(
                "mb-8 text-[14px] leading-5 text-[color:var(--docs-body-copy-subtle,var(--fd-muted-foreground))]",
                isClassicTheme && "mb-7 text-[12px] leading-5 tracking-[0.02em]",
                isAtlasTheme &&
                  "mb-8 text-[11px] font-medium uppercase tracking-[0.08em] text-[color:color-mix(in_srgb,var(--docs-body-copy-subtle,var(--fd-muted-foreground))_88%,white)]",
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
            className={cn(
              "mb-10 space-y-4",
              isClassicTheme && "mb-8 space-y-3.5 border-b border-fd-border pb-8",
              isAtlasTheme &&
                "mb-10 space-y-4 border-b border-[color:color-mix(in_srgb,var(--docs-divider,var(--fd-border))_74%,white)] pb-8",
            )}
          >
            <h1
              className={cn(
                "text-[36px] font-bold leading-[1.12] tracking-[-0.03em] text-fd-foreground",
                isClassicTheme && "text-[34px] font-semibold leading-[1.08] tracking-[-0.04em]",
                isAtlasTheme && "text-[36px] font-semibold leading-[1.04] tracking-[-0.04em]",
              )}
            >
              {page.title}
            </h1>
            {page.description ? (
              <p
                className={cn(
                  "max-w-[590px] text-[18px] font-light leading-[1.75] text-[color:var(--docs-body-copy,var(--fd-muted-foreground))]",
                  isClassicTheme &&
                    "max-w-[720px] text-[16px] font-normal leading-7 tracking-[-0.01em]",
                  isAtlasTheme &&
                    "max-w-[760px] text-[16px] font-normal leading-7 tracking-[-0.01em] text-[color:color-mix(in_srgb,var(--docs-body-copy,var(--fd-muted-foreground))_94%,white)]",
                )}
              >
                {page.description}
              </p>
            ) : null}
          </header>

          <DocContentView
            docContent={docContent}
            markdown={markdown}
            legacyYooptaContent={legacyYooptaContent}
            markdownClassName={cn(
              isClassicTheme &&
                classicMarkdownClassName,
              isAtlasTheme &&
                "prose-p:my-3.5 prose-p:text-[15px] prose-p:leading-7 prose-li:text-[15px] prose-li:leading-7 prose-h2:mb-4 prose-h2:mt-12 prose-h2:text-[1.55rem] prose-h2:font-semibold prose-h2:tracking-[-0.025em] prose-h3:mb-2.5 prose-h3:mt-8 prose-h3:text-[1.05rem] prose-h3:font-semibold prose-h3:tracking-[-0.02em] prose-table:mt-7 [&_table]:w-full [&_table]:overflow-hidden [&_table]:rounded-[18px] [&_table]:border [&_table]:border-[color:var(--atlas-content-border)] [&_table]:bg-white [&_table]:shadow-[0_10px_30px_rgba(15,23,42,0.05)] [&_thead]:bg-[color:color-mix(in_srgb,var(--atlas-panel-subtle)_82%,white)] [&_th]:border-b [&_th]:border-[color:var(--atlas-content-border)] [&_th]:px-4 [&_th]:py-3 [&_th]:text-left [&_th]:text-[12px] [&_th]:font-semibold [&_th]:normal-case [&_th]:tracking-[0.01em] [&_th]:text-[color:var(--docs-body-copy-subtle,var(--fd-muted-foreground))] [&_td]:border-b [&_td]:border-[color:color-mix(in_srgb,var(--atlas-content-border)_92%,white)] [&_td]:px-4 [&_td]:py-3.5 [&_td]:align-top [&_td]:text-[14px] [&_td]:leading-6 [&_tbody_tr:last-child_td]:border-b-0 [&_pre]:my-7 [&_pre]:overflow-x-auto [&_pre]:rounded-[18px] [&_pre]:border [&_pre]:border-[color:var(--atlas-content-border)] [&_pre]:shadow-[0_14px_32px_rgba(15,23,42,0.08)] [&_code]:rounded-md [&_code]:px-1.5 [&_code]:py-0.5",
            )}
            legacyYooptaClassName={cn(
              isClassicTheme &&
                classicStructuredClassName,
              isAtlasTheme &&
                "[&_h2]:mb-4 [&_h2]:mt-12 [&_h2]:text-[1.55rem] [&_h2]:font-semibold [&_h2]:tracking-[-0.025em] [&_h3]:mb-2.5 [&_h3]:mt-8 [&_h3]:text-[1.05rem] [&_h3]:font-semibold [&_h3]:tracking-[-0.02em] [&_li]:text-[15px] [&_li]:leading-7 [&_p]:my-3.5 [&_p]:text-[15px] [&_p]:leading-7 [&_table]:mt-7 [&_table]:w-full [&_table]:overflow-hidden [&_table]:rounded-[18px] [&_table]:border [&_table]:border-[color:var(--atlas-content-border)] [&_table]:bg-white [&_table]:shadow-[0_10px_30px_rgba(15,23,42,0.05)] [&_thead]:bg-[color:color-mix(in_srgb,var(--atlas-panel-subtle)_82%,white)] [&_th]:border-b [&_th]:border-[color:var(--atlas-content-border)] [&_th]:px-4 [&_th]:py-3 [&_th]:text-left [&_th]:text-[12px] [&_th]:font-semibold [&_th]:normal-case [&_th]:tracking-[0.01em] [&_th]:text-[color:var(--docs-body-copy-subtle,var(--fd-muted-foreground))] [&_td]:border-b [&_td]:border-[color:color-mix(in_srgb,var(--atlas-content-border)_92%,white)] [&_td]:px-4 [&_td]:py-3.5 [&_td]:align-top [&_td]:text-[14px] [&_td]:leading-6 [&_tbody_tr:last-child_td]:border-b-0 [&_pre]:my-7 [&_pre]:overflow-x-auto [&_pre]:rounded-[18px] [&_pre]:border [&_pre]:border-[color:var(--atlas-content-border)] [&_pre]:shadow-[0_14px_32px_rgba(15,23,42,0.08)] [&_code]:rounded-md [&_code]:px-1.5 [&_code]:py-0.5",
            )}
          />

          <div
            className={cn(
              "mt-14 flex items-center justify-between border-t border-fd-border pt-6",
              isClassicTheme && "mt-12 pt-5",
              isAtlasTheme &&
                "mt-14 border-t border-[color:color-mix(in_srgb,var(--docs-divider,var(--fd-border))_72%,white)] pt-5",
            )}
          >
            {prevPage ? (
              <Link
                href={`/${lang}/${prevPage.slug}`}
                className={cn(
                  "rounded-xl border border-fd-border px-4 py-2.5 text-sm text-[color:var(--docs-body-copy,var(--fd-foreground))] transition hover:bg-fd-muted",
                  isClassicTheme &&
                    "rounded-lg px-3.5 py-2 text-[13px]",
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
                  isClassicTheme &&
                    "rounded-lg px-3.5 py-2 text-[13px]",
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

      {!isBlueprintReviewTheme ? (
        <DocsToc
          toc={effectiveToc}
          className={cn(
            isClassicTheme &&
              "sticky top-[92px] self-start w-[236px] shrink-0 border-l-0 bg-transparent px-0 py-6 lg:-ml-2",
            isAtlasTheme &&
              "sticky top-[124px] self-start w-[236px] shrink-0 border-l-0 bg-transparent px-0 py-8 lg:-ml-2",
          )}
          contentClassName={cn(
            isClassicTheme &&
              "bg-transparent px-0 py-0",
            isAtlasTheme &&
              "rounded-[20px] border border-[color:color-mix(in_srgb,var(--docs-toc-border)_74%,white)] bg-[color:color-mix(in_srgb,var(--atlas-panel)_92%,transparent)] px-4 py-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)] backdrop-blur-sm",
          )}
          hideTitle={false}
          hideDivider={isClassicTheme || isAtlasTheme}
          disableInnerScroll={isClassicTheme || isAtlasTheme}
          disableDefaultDepthStyles={isClassicTheme || isAtlasTheme}
          titleClassName={cn(
            isClassicTheme &&
              "mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--docs-toc-title,var(--fd-muted-foreground))]",
            isAtlasTheme &&
              "mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:var(--docs-toc-title,var(--fd-muted-foreground))]",
          )}
          listClassName={cn(
            isClassicTheme &&
              "space-y-0 [&_[data-depth='2']]:py-1 [&_[data-depth='2']]:pl-0 [&_[data-depth='2']]:text-[13px] [&_[data-depth='2']]:leading-6 [&_[data-depth='3']]:pl-3 [&_[data-depth='3']]:text-[11px] [&_[data-depth='3']]:leading-5 [&_[data-depth='4']]:pl-5 [&_[data-depth='4']]:text-[11px] [&_[data-depth='4']]:leading-5",
            isAtlasTheme &&
              "relative space-y-0.5 pl-3 before:absolute before:bottom-2 before:left-0 before:top-2 before:w-px before:bg-[color:color-mix(in_srgb,var(--docs-toc-divider)_82%,white)] [&_[data-depth='2']]:py-1.5 [&_[data-depth='2']]:pl-3 [&_[data-depth='2']]:text-[13px] [&_[data-depth='2']]:font-medium [&_[data-depth='2']]:leading-6 [&_[data-depth='3']]:pl-5 [&_[data-depth='3']]:text-[11px] [&_[data-depth='3']]:leading-5 [&_[data-depth='4']]:pl-6 [&_[data-depth='4']]:text-[10px] [&_[data-depth='4']]:leading-5",
          )}
          activeLinkClassName={cn(
            isClassicTheme &&
              "rounded-none border-l-0 bg-transparent py-1 pl-0 pr-0 font-medium break-words text-[color:var(--docs-toc-link-active,var(--fd-foreground))]",
            isAtlasTheme &&
              "relative rounded-r-xl border-l-0 bg-[color:var(--docs-toc-active-background,var(--fd-muted))] py-1.5 pl-3 pr-2 font-semibold tracking-[-0.01em] break-words text-[color:var(--docs-toc-link-active,var(--fd-foreground))] before:absolute before:bottom-2 before:-left-3 before:top-2 before:w-[2px] before:rounded-full before:bg-[color:var(--docs-toc-link-active,var(--fd-foreground))]",
          )}
          inactiveLinkClassName={cn(
            isClassicTheme &&
              "rounded-none border-l-0 bg-transparent py-1 pl-0 pr-0 font-normal break-words text-[color:var(--docs-toc-link,var(--fd-muted-foreground))] hover:text-[color:var(--docs-toc-link-hover,var(--fd-foreground))]",
            isAtlasTheme &&
              "rounded-r-xl border-l-0 bg-transparent py-1.5 pl-3 pr-2 font-normal tracking-[-0.01em] break-words text-[color:color-mix(in_srgb,var(--docs-toc-link,var(--fd-muted-foreground))_92%,white)] hover:bg-[color:color-mix(in_srgb,var(--docs-toc-active-background,var(--fd-muted))_58%,white)] hover:text-[color:var(--docs-toc-link-hover,var(--fd-foreground))]",
          )}
        />
      ) : null}
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
