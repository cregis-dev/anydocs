import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { MarkdownView } from '@/components/docs/markdown-view';
import { DocsToc } from '@/components/docs/toc';
import {
  getPublishedContext,
  getPublishedDocStaticParams,
  getPublishedLanguages,
  getPublishedPageBySlug,
  isDocsReaderAvailable,
  resolveRequestDocsSource,
} from '@/lib/docs/data';
import { normalizeSlug } from '@/lib/docs/fs';
import type { DocsLang } from '@/lib/docs/types';
import { buildBreadcrumbsByPageId, findNextPrevPageIds } from '@/lib/docs/nav';
import { extractTocFromMarkdown, normalizeMarkdownForRendering } from '@/lib/docs/markdown';

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

  const markdown = normalizeMarkdownForRendering(stripLeadingTitleHeading(page.render?.markdown ?? '', page.title));
  const toc = extractTocFromMarkdown(markdown);
  const crumbs = buildBreadcrumbsByPageId(nav).get(page.id) ?? [];
  const { prev, next } = findNextPrevPageIds(nav.items, page.id);
  const prevPage = prev ? pages.find((p) => p.id === prev) ?? null : null;
  const nextPage = next ? pages.find((p) => p.id === next) ?? null : null;

  return (
    <div className="flex min-w-0">
      <div className="min-w-0 flex-1 px-6 py-8 sm:px-8 lg:px-10 lg:py-0">
        <div className="mx-auto max-w-[670px] pb-16 pt-8 lg:pb-20">
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

          <header className="mb-10 space-y-4">
            <h1 className="text-[36px] font-bold leading-[1.12] tracking-[-0.03em] text-fd-foreground">{page.title}</h1>
            {page.description ? (
              <p className="max-w-[590px] text-[18px] font-light leading-[1.75] text-[color:var(--docs-body-copy,var(--fd-muted-foreground))]">
                {page.description}
              </p>
            ) : null}
          </header>

          <MarkdownView markdown={markdown} />

          <div className="mt-14 flex items-center justify-between border-t border-fd-border pt-6">
            {prevPage ? (
              <Link
                href={`/${lang}/${prevPage.slug}`}
                className="rounded-xl border border-fd-border px-4 py-2.5 text-sm text-[color:var(--docs-body-copy,var(--fd-foreground))] transition hover:bg-fd-muted"
              >
                ← {prevPage.title}
              </Link>
            ) : (
              <span />
            )}
            {nextPage ? (
              <Link
                href={`/${lang}/${nextPage.slug}`}
                className="rounded-xl border border-fd-border px-4 py-2.5 text-sm text-[color:var(--docs-body-copy,var(--fd-foreground))] transition hover:bg-fd-muted"
              >
                {nextPage.title} →
              </Link>
            ) : (
              <span />
            )}
          </div>
        </div>
      </div>

      <DocsToc toc={toc} />
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
