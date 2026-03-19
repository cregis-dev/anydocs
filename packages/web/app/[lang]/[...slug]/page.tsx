import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { DocContentView } from '@/components/docs/doc-content-view';
import { DocsToc } from '@/components/docs/toc';
import {
  getPublishedContext,
  getPublishedDocStaticParams,
  getPublishedLanguages,
  getPublishedPageBySlug,
  getPublishedSiteTheme,
  isDocsReaderAvailable,
  resolveRequestDocsSource,
} from '@/lib/docs/data';
import { normalizeSlug } from '@/lib/docs/fs';
import type { DocsLang } from '@/lib/docs/types';
import { buildBreadcrumbsByPageId, findNextPrevPageIds } from '@/lib/docs/nav';
import { extractTocFromMarkdown, normalizeMarkdownForRendering } from '@/lib/docs/markdown';
import { extractTocFromYooptaContent, getRenderableYooptaContent } from '@/lib/docs/yoopta-reader';
import { cn } from '@/lib/utils';
import { ATLAS_DOCS_THEME_ID } from '@/themes/atlas-docs/manifest';

export const dynamicParams = false;
const EMPTY_EXPORT_PLACEHOLDER = '__anydocs-empty__';

function stripLeadingTitleHeading(markdown: string, title: string) {
  const lines = markdown.split('\n');
  let index = 0;

  while (index < lines.length && lines[index]?.trim() === '') {
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
  while (index < lines.length && lines[index]?.trim() === '') {
    index += 1;
  }

  return lines.slice(index).join('\n');
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

  const languages = await getPublishedLanguages(source.projectId, source.customPath);
  if (!languages.includes(rawLang as DocsLang)) {
    notFound();
  }
  const lang = rawLang as DocsLang;
  const slugStr = normalizeSlug(slug);
  if (slugStr === EMPTY_EXPORT_PLACEHOLDER) {
    notFound();
  }
  const { nav, pages } = await getPublishedContext(lang, source.projectId, source.customPath);

  const page = await getPublishedPageBySlug(lang, slugStr, source.projectId, source.customPath);
  if (!page) {
    notFound();
  }

  const siteTheme = await getPublishedSiteTheme(source.projectId, source.customPath);
  const isAtlasTheme = siteTheme.id === ATLAS_DOCS_THEME_ID;
  const markdown = normalizeMarkdownForRendering(stripLeadingTitleHeading(page.render?.markdown ?? '', page.title));
  const yooptaContent = getRenderableYooptaContent(page.content, page.title);
  const toc = extractTocFromMarkdown(markdown);
  const effectiveToc = toc.length > 0 ? toc : extractTocFromYooptaContent(yooptaContent);
  const showBreadcrumbs = !isAtlasTheme;
  const crumbs = showBreadcrumbs ? buildBreadcrumbsByPageId(nav).get(page.id) ?? [] : [];
  const { prev, next } = findNextPrevPageIds(nav.items, page.id);
  const prevPage = prev ? pages.find((p) => p.id === prev) ?? null : null;
  const nextPage = next ? pages.find((p) => p.id === next) ?? null : null;

  return (
    <div className={cn('flex min-w-0', isAtlasTheme && 'bg-[color:var(--atlas-body-background)]')}>
      <div
        className={cn(
          'min-w-0 flex-1 px-6 py-8 sm:px-8 lg:px-10 lg:py-0',
          isAtlasTheme && 'px-4 py-4 sm:px-6 lg:px-8 lg:py-6',
        )}
      >
        <div
          className={cn(
            'mx-auto max-w-[670px] pb-16 pt-8 lg:pb-20',
            isAtlasTheme &&
              'max-w-none rounded-[10px] border border-[color:var(--atlas-content-border)] bg-white px-6 py-6 shadow-[0_1px_0_var(--atlas-content-shadow)] sm:px-8 lg:px-11 lg:py-6',
          )}
        >
          {showBreadcrumbs ? (
            <div className="mb-8 text-[14px] leading-5 text-[color:var(--docs-body-copy-subtle,var(--fd-muted-foreground))]">
              <span className="inline-flex max-w-full items-center gap-2">
                <Link href={`/${lang}`} className="hover:underline">
                  Documentation
                </Link>
                {crumbs.length ? <span>›</span> : null}
                {crumbs.map((c, i) => (
                  <span key={`${c}-${i}`} className="inline-flex items-center gap-2">
                    <span className="truncate">{c}</span>
                    {i < crumbs.length - 1 ? <span>›</span> : null}
                  </span>
                ))}
              </span>
            </div>
          ) : null}

          <header className={cn('mb-10 space-y-4', isAtlasTheme && 'mb-8 space-y-3')}>
            <h1
              className={cn(
                'text-[36px] font-bold leading-[1.12] tracking-[-0.03em] text-fd-foreground',
                isAtlasTheme && 'text-[34px] font-semibold tracking-[-0.03em]',
              )}
            >
              {page.title}
            </h1>
            {page.description ? (
              <p
                className={cn(
                  'max-w-[590px] text-[18px] font-light leading-[1.75] text-[color:var(--docs-body-copy,var(--fd-muted-foreground))]',
                  isAtlasTheme && 'max-w-[760px] text-[13px] font-normal leading-6',
                )}
              >
                {page.description}
              </p>
            ) : null}
          </header>

          {isAtlasTheme ? <div className="mb-6 h-px w-full bg-[color:var(--atlas-border)]" /> : null}

          <DocContentView
            markdown={markdown}
            yooptaContent={yooptaContent}
            markdownClassName={cn(
              isAtlasTheme &&
                'prose-p:my-2.5 prose-p:text-[13px] prose-p:leading-6 prose-li:text-[13px] prose-li:leading-6 prose-h2:mb-2 prose-h2:mt-6 prose-h3:mb-1.5 prose-h3:mt-3 prose-table:mt-4',
            )}
            yooptaClassName={cn(
              isAtlasTheme &&
                '[&_h2]:mb-2 [&_h2]:mt-6 [&_h3]:mb-1.5 [&_h3]:mt-3 [&_li]:text-[13px] [&_li]:leading-6 [&_p]:my-2.5 [&_p]:text-[13px] [&_p]:leading-6 [&_table]:mt-4',
            )}
          />

          <div className={cn('mt-14 flex items-center justify-between border-t border-fd-border pt-6', isAtlasTheme && 'mt-12')}>
            {prevPage ? (
              <Link
                href={`/${lang}/${prevPage.slug}`}
                className={cn(
                  'rounded-xl border border-fd-border px-4 py-2.5 text-sm text-[color:var(--docs-body-copy,var(--fd-foreground))] transition hover:bg-fd-muted',
                  isAtlasTheme && 'rounded-lg bg-white hover:bg-[color:var(--atlas-sidebar-hover)]',
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
                  'rounded-xl border border-fd-border px-4 py-2.5 text-sm text-[color:var(--docs-body-copy,var(--fd-foreground))] transition hover:bg-fd-muted',
                  isAtlasTheme && 'rounded-lg bg-white hover:bg-[color:var(--atlas-sidebar-hover)]',
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
        className={cn(isAtlasTheme && 'w-[240px] border-l-0 bg-transparent px-4 py-4')}
        contentClassName={cn(
          isAtlasTheme &&
            'rounded-xl border border-[color:var(--docs-toc-border)] bg-[color:var(--docs-toc-background)] px-4 py-5 shadow-[0_2px_12px_rgba(0,0,0,0.06)]',
        )}
      />
    </div>
  );
}

export async function generateStaticParams() {
  if (!isDocsReaderAvailable()) {
    return [];
  }

  const params = await getPublishedDocStaticParams();
  const pageParams = params.filter((entry) => entry.slug.length > 0);
  if (pageParams.length > 0) {
    return pageParams;
  }

  const languages = await getPublishedLanguages();
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
  const languages = await getPublishedLanguages(source.projectId, source.customPath);
  if (!languages.includes(rawLang as DocsLang)) {
    return {};
  }
  const lang = rawLang as DocsLang;

  const slugStr = normalizeSlug(slug);
  const page = await getPublishedPageBySlug(lang, slugStr, source.projectId, source.customPath);
  if (!page) {
    return {};
  }
  return { title: page.title, description: page.description };
}
