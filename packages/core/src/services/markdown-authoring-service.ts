import path from 'node:path';

import { ValidationError } from '../errors/validation-error.ts';
import { createDocsRepository, loadPage } from '../fs/index.ts';
import type {
  DocsLang,
  PageDoc,
  PageRender,
  PageReview,
  PageStatus,
} from '../types/docs.ts';
import type { DocBlock, DocContentV1 } from '../types/content.ts';
import type { LegacyImportFrontmatterValue } from '../types/legacy-import.ts';
import {
  createMarkdownYooptaContent,
  normalizeDocContent,
  renderPageContent,
  validateDocContentV1,
  yooptaToDocContent,
} from '../utils/index.ts';
import type {
  AuthoringPageResult,
  CreatePageInput,
  UpdatePageInput,
  UpdatePagePatch,
} from './authoring-service.ts';
import { createPage, updatePage } from './authoring-service.ts';

export type MarkdownInputMode = 'document' | 'fragment';
export type MarkdownSourceFormat = 'markdown' | 'mdx';

export type MarkdownConversionWarning = {
  code: string;
  message: string;
  remediation?: string;
  metadata?: Record<string, unknown>;
};

export type MarkdownConversionResult = {
  mode: MarkdownInputMode;
  format: MarkdownSourceFormat;
  sourcePath?: string;
  frontmatter: Record<string, LegacyImportFrontmatterValue>;
  body: string;
  title?: string;
  description?: string;
  tags?: string[];
  content: DocContentV1;
  render: PageRender;
  warnings: MarkdownConversionWarning[];
};

export type CreatePageFromMarkdownInput = {
  projectRoot: string;
  lang: DocsLang;
  markdown: string;
  inputMode?: MarkdownInputMode;
  format?: MarkdownSourceFormat;
  sourcePath?: string;
  page: {
    id: string;
    slug: string;
    title?: string;
    description?: string;
    template?: string;
    metadata?: Record<string, unknown>;
    tags?: string[];
    status?: PageStatus;
    review?: PageReview;
  };
};

export type UpdatePageFromMarkdownInput = {
  projectRoot: string;
  lang: DocsLang;
  pageId: string;
  markdown: string;
  operation?: 'replace' | 'append';
  inputMode?: MarkdownInputMode;
  format?: MarkdownSourceFormat;
  sourcePath?: string;
  patch?: Omit<UpdatePagePatch<Record<string, unknown>>, 'content' | 'render'>;
};

export type MarkdownAuthoringResult = AuthoringPageResult<DocContentV1> & {
  conversion: MarkdownConversionResult;
};

const SUPPORTED_FRONTMATTER_KEYS = new Set(['title', 'description', 'tags']);
const MARKDOWN_REVIEW_PATTERNS: Array<{ code: string; label: string; pattern: RegExp }> = [
  { code: 'code-fence', label: 'code fences', pattern: /^```/m },
  { code: 'blockquote', label: 'blockquotes', pattern: /^>\s+/m },
  { code: 'link', label: 'markdown links', pattern: /\[[^\]]+\]\([^)]+\)/m },
  { code: 'image', label: 'images', pattern: /!\[[^\]]*\]\([^)]+\)/m },
];

type ParsedFrontmatter = {
  body: string;
  frontmatter: Record<string, LegacyImportFrontmatterValue>;
};

function createMarkdownValidationError(
  message: string,
  rule: string,
  remediation: string,
  metadata?: Record<string, unknown>,
): ValidationError {
  return new ValidationError(message, {
    entity: 'markdown-authoring',
    rule,
    remediation,
    metadata,
  });
}

function parseFrontmatter(rawContent: string, sourcePath: string): ParsedFrontmatter {
  if (!rawContent.startsWith('---\n') && !rawContent.startsWith('---\r\n')) {
    return { body: rawContent, frontmatter: {} };
  }

  const frontmatterMatch = rawContent.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!frontmatterMatch) {
    throw createMarkdownValidationError(
      `Markdown source "${sourcePath}" contains an unclosed frontmatter block.`,
      'markdown-frontmatter-closed',
      'Close the frontmatter block with a terminating --- line or remove the malformed frontmatter.',
      { sourcePath },
    );
  }

  const rawFrontmatter = frontmatterMatch[1] ?? '';
  const body = rawContent.slice(frontmatterMatch[0].length);
  const frontmatter: Record<string, LegacyImportFrontmatterValue> = {};

  for (const line of rawFrontmatter.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf(':');
    if (separatorIndex <= 0) {
      throw createMarkdownValidationError(
        `Markdown source "${sourcePath}" contains malformed frontmatter.`,
        'markdown-frontmatter-key-value',
        'Use simple "key: value" frontmatter lines for markdown conversion.',
        { sourcePath, line: trimmed },
      );
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    if (!key) {
      throw createMarkdownValidationError(
        `Markdown source "${sourcePath}" contains malformed frontmatter.`,
        'markdown-frontmatter-key-required',
        'Provide a non-empty frontmatter key before the colon.',
        { sourcePath, line: trimmed },
      );
    }

    if (value.startsWith('[') && value.endsWith(']')) {
      frontmatter[key] = value
        .slice(1, -1)
        .split(',')
        .map((entry) => entry.trim().replace(/^['"]|['"]$/g, ''))
        .filter(Boolean);
      continue;
    }

    frontmatter[key] = value.replace(/^['"]|['"]$/g, '');
  }

  return { body, frontmatter };
}

function inferTitle(
  body: string,
  frontmatter: Record<string, LegacyImportFrontmatterValue>,
  sourcePath?: string,
): string | undefined {
  const title = frontmatter.title;
  if (typeof title === 'string' && title.trim()) {
    return title.trim();
  }

  const headingMatch = body.match(/^#\s+(.+)$/m);
  if (headingMatch?.[1]) {
    return headingMatch[1].trim();
  }

  if (!sourcePath) {
    return undefined;
  }

  const basename = path.basename(sourcePath).replace(/\.(md|mdx)$/i, '');
  const normalized = basename
    .split(/[-_\s]+/)
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');

  return normalized || undefined;
}

function inferDescription(frontmatter: Record<string, LegacyImportFrontmatterValue>): string | undefined {
  const description = frontmatter.description;
  return typeof description === 'string' && description.trim() ? description.trim() : undefined;
}

function inferTags(frontmatter: Record<string, LegacyImportFrontmatterValue>): string[] | undefined {
  const tags = frontmatter.tags;
  if (Array.isArray(tags)) {
    const normalized = tags.map((tag) => String(tag).trim()).filter(Boolean);
    return normalized.length > 0 ? normalized : undefined;
  }

  if (typeof tags === 'string' && tags.trim()) {
    const normalized = tags
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);
    return normalized.length > 0 ? normalized : undefined;
  }

  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function collectMarkdownWarnings(
  body: string,
  format: MarkdownSourceFormat,
  sourcePath?: string,
  frontmatter: Record<string, LegacyImportFrontmatterValue> = {},
): MarkdownConversionWarning[] {
  const warnings: MarkdownConversionWarning[] = [];

  if (format === 'mdx') {
    warnings.push({
      code: 'markdown-mdx-review-required',
      message: `Markdown conversion${sourcePath ? ` for "${sourcePath}"` : ''} originated from MDX and may contain unsupported JSX or component usage.`,
      remediation: 'Review the converted content and restore any JSX-backed semantics manually in supported Anydocs blocks.',
      metadata: { sourcePath: sourcePath ?? null },
    });
  }

  const unmappedFrontmatterKeys = Object.keys(frontmatter).filter((key) => !SUPPORTED_FRONTMATTER_KEYS.has(key));
  if (unmappedFrontmatterKeys.length > 0) {
    warnings.push({
      code: 'markdown-frontmatter-unmapped',
      message: `Markdown conversion${sourcePath ? ` for "${sourcePath}"` : ''} contains frontmatter keys that are not mapped to first-class page fields.`,
      remediation: 'Review the unmapped frontmatter keys and move important values into page metadata manually when needed.',
      metadata: {
        sourcePath: sourcePath ?? null,
        keys: unmappedFrontmatterKeys,
      },
    });
  }

  const detectedConstructs = MARKDOWN_REVIEW_PATTERNS.filter((entry) => entry.pattern.test(body));
  if (detectedConstructs.length > 0) {
    warnings.push({
      code: 'markdown-construct-review-required',
      message: `Markdown conversion${sourcePath ? ` for "${sourcePath}"` : ''} contains constructs that are simplified in editable docs content.`,
      remediation: 'Review code fences, links, blockquotes, and images after conversion and restore structured blocks when fidelity matters.',
      metadata: {
        sourcePath: sourcePath ?? null,
        constructs: detectedConstructs.map((entry) => ({
          code: entry.code,
          label: entry.label,
        })),
      },
    });
  }

  return warnings;
}

function cloneWithGeneratedIds(value: unknown, prefix: string, counter: { value: number }): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => cloneWithGeneratedIds(entry, prefix, counter));
  }

  if (!isRecord(value)) {
    return value;
  }

  const next: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (key === 'id' && typeof entry === 'string') {
      next[key] = `${prefix}-${counter.value++}`;
      continue;
    }

    next[key] = cloneWithGeneratedIds(entry, prefix, counter);
  }

  return next;
}

function appendRenderedText(existing: string, appended: string): string {
  const parts = [existing.trim(), appended.trim()].filter(Boolean);
  return parts.join('\n\n');
}

function normalizeToDocContent(value: unknown): DocContentV1 {
  const canonical = validateDocContentV1(value);
  if (canonical.ok) {
    return normalizeDocContent(value as DocContentV1);
  }

  return normalizeDocContent(yooptaToDocContent(value));
}

function deriveExistingRender(page: PageDoc<unknown>): PageRender {
  const rendered = renderPageContent(page.content);
  return {
    markdown: typeof page.render?.markdown === 'string' ? page.render.markdown : rendered.markdown,
    plainText: typeof page.render?.plainText === 'string' ? page.render.plainText : rendered.plainText,
  };
}

function appendDocContent(existingContent: unknown, appendedContent: DocContentV1): DocContentV1 {
  const existing = normalizeToDocContent(existingContent);
  const appendedBlocks = appendedContent.blocks.map((block, index) =>
    cloneWithGeneratedIds(block, `appended-block-${existing.blocks.length + index + 1}`, { value: 1 }) as DocBlock,
  );

  return {
    version: 1,
    blocks: [...existing.blocks, ...appendedBlocks],
  };
}

export function convertMarkdownToPageContent(options: {
  markdown: string;
  inputMode?: MarkdownInputMode;
  format?: MarkdownSourceFormat;
  sourcePath?: string;
}): MarkdownConversionResult {
  const mode = options.inputMode ?? 'document';
  const format = options.format ?? 'markdown';
  const sourcePath = options.sourcePath;
  const parsed =
    mode === 'document'
      ? parseFrontmatter(options.markdown, sourcePath ?? 'inline-markdown')
      : { body: options.markdown, frontmatter: {} };
  const normalizedBody = parsed.body.trim();
  const content = normalizeDocContent(yooptaToDocContent(createMarkdownYooptaContent(normalizedBody)));

  return {
    mode,
    format,
    ...(sourcePath ? { sourcePath } : {}),
    frontmatter: parsed.frontmatter,
    body: normalizedBody,
    ...(mode === 'document' ? { title: inferTitle(normalizedBody, parsed.frontmatter, sourcePath) } : {}),
    ...(mode === 'document' ? { description: inferDescription(parsed.frontmatter) } : {}),
    ...(mode === 'document' ? { tags: inferTags(parsed.frontmatter) } : {}),
    content,
    render: renderPageContent(content),
    warnings: collectMarkdownWarnings(normalizedBody, format, sourcePath, parsed.frontmatter),
  };
}

function requireCreateTitle(page: CreatePageFromMarkdownInput['page'], conversion: MarkdownConversionResult): string {
  const title = page.title ?? conversion.title;
  if (title && title.trim()) {
    return title.trim();
  }

  throw createMarkdownValidationError(
    'Markdown page creation requires a title or a document-level heading/frontmatter title that can be inferred.',
    'markdown-page-title-required',
    'Provide page.title explicitly, or convert a document that includes frontmatter title or a leading # heading.',
    {
      pageId: page.id,
      slug: page.slug,
      mode: conversion.mode,
    },
  );
}

export async function createPageFromMarkdown(
  input: CreatePageFromMarkdownInput,
): Promise<MarkdownAuthoringResult> {
  const conversion = convertMarkdownToPageContent({
    markdown: input.markdown,
    inputMode: input.inputMode,
    format: input.format,
    sourcePath: input.sourcePath,
  });

  const result = await createPage({
    projectRoot: input.projectRoot,
    lang: input.lang,
    page: {
      id: input.page.id,
      slug: input.page.slug,
      title: requireCreateTitle(input.page, conversion),
      description: input.page.description ?? conversion.description,
      template: input.page.template,
      metadata: input.page.metadata,
      tags: input.page.tags ?? conversion.tags,
      status: input.page.status,
      content: conversion.content,
      render: conversion.render,
      review: input.page.review,
    },
  } satisfies CreatePageInput<DocContentV1>);

  return {
    ...result,
    conversion,
  };
}

export async function updatePageFromMarkdown(
  input: UpdatePageFromMarkdownInput,
): Promise<MarkdownAuthoringResult> {
  const conversion = convertMarkdownToPageContent({
    markdown: input.markdown,
    inputMode: input.inputMode,
    format: input.format,
    sourcePath: input.sourcePath,
  });

  const repository = createDocsRepository(input.projectRoot);
  const existingPage = await loadPage(repository, input.lang, input.pageId);
  if (!existingPage) {
    throw new ValidationError(`Page "${input.pageId}" not found.`, {
      entity: 'page-doc',
      rule: 'page-must-exist',
      remediation: 'Create the page first or use page_find/page_list to inspect available ids before retrying.',
      metadata: {
        pageId: input.pageId,
        lang: input.lang,
        projectRoot: input.projectRoot,
      },
    });
  }

  const operation = input.operation ?? 'replace';
  const patch: UpdatePagePatch<DocContentV1> = {
    ...(input.patch ?? {}),
  };

  if (operation === 'append') {
    const existingRender = deriveExistingRender(existingPage);
    patch.content = appendDocContent(existingPage.content, conversion.content);
    patch.render = {
      markdown: appendRenderedText(existingRender.markdown ?? '', conversion.render.markdown ?? ''),
      plainText: appendRenderedText(existingRender.plainText ?? '', conversion.render.plainText ?? ''),
    };
  } else {
    patch.content = conversion.content;
    patch.render = conversion.render;

    if ((input.inputMode ?? 'document') === 'document') {
      if (patch.title == null && conversion.title) {
        patch.title = conversion.title;
      }
      if (patch.description == null && conversion.description) {
        patch.description = conversion.description;
      }
      if (patch.tags == null && conversion.tags) {
        patch.tags = conversion.tags;
      }
    }
  }

  const result = await updatePage({
    projectRoot: input.projectRoot,
    lang: input.lang,
    pageId: input.pageId,
    patch,
  } satisfies UpdatePageInput<DocContentV1>);

  return {
    ...result,
    conversion,
  };
}
