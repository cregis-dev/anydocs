import { mkdir, mkdtemp, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { ValidationError } from '../errors/validation-error.ts';
import { loadProjectContract } from '../fs/content-repository.ts';
import type {
  LegacyImportFormat,
  LegacyImportFrontmatterValue,
  LegacyImportItem,
  LegacyImportManifest,
  LegacyImportManifestItem,
  LegacyImportResult,
} from '../types/legacy-import.ts';
import type { DocsLanguage } from '../types/project.ts';

export type ImportLegacyDocumentationOptions = {
  repoRoot: string;
  sourceRoot: string;
  projectId?: string;
  lang?: DocsLanguage;
};

type ParsedFrontmatter = {
  body: string;
  frontmatter: Record<string, LegacyImportFrontmatterValue>;
};

type LegacySourceFile = {
  absolutePath: string;
  relativePath: string;
  format: LegacyImportFormat;
  rawContent: string;
  body: string;
  frontmatter: Record<string, LegacyImportFrontmatterValue>;
};

function createImportValidationError(
  message: string,
  rule: string,
  remediation: string,
  metadata?: Record<string, unknown>,
): ValidationError {
  return new ValidationError(message, {
    entity: 'legacy-import',
    rule,
    remediation,
    metadata,
  });
}

function normalizeImportSlug(relativePath: string): string {
  const withoutExtension = relativePath.replace(/\.(md|mdx)$/i, '');
  return withoutExtension
    .split(path.sep)
    .join('/')
    .split('/')
    .map((segment) =>
      segment
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, ''),
    )
    .filter(Boolean)
    .join('/');
}

function inferTitle(slug: string, frontmatter: Record<string, LegacyImportFrontmatterValue>, body: string): string {
  const title = frontmatter.title;
  if (typeof title === 'string' && title.trim()) {
    return title.trim();
  }

  const headingMatch = body.match(/^#\s+(.+)$/m);
  if (headingMatch?.[1]) {
    return headingMatch[1].trim();
  }

  const leaf = slug.split('/').at(-1) ?? 'untitled';
  return leaf
    .split('-')
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

function inferDescription(frontmatter: Record<string, LegacyImportFrontmatterValue>): string | undefined {
  const description = frontmatter.description;
  return typeof description === 'string' && description.trim() ? description.trim() : undefined;
}

function inferTags(frontmatter: Record<string, LegacyImportFrontmatterValue>): string[] | undefined {
  const tags = frontmatter.tags;
  if (Array.isArray(tags)) {
    const normalized = tags.map((tag) => String(tag).trim()).filter(Boolean);
    return normalized.length ? normalized : undefined;
  }

  if (typeof tags === 'string' && tags.trim()) {
    return tags
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);
  }

  return undefined;
}

function parseFrontmatter(rawContent: string, sourcePath: string): ParsedFrontmatter {
  if (!rawContent.startsWith('---\n') && !rawContent.startsWith('---\r\n')) {
    return { body: rawContent, frontmatter: {} };
  }

  const frontmatterMatch = rawContent.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!frontmatterMatch) {
    throw createImportValidationError(
      `Legacy document "${sourcePath}" contains an unclosed frontmatter block.`,
      'legacy-frontmatter-closed',
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
      throw createImportValidationError(
        `Legacy document "${sourcePath}" contains malformed frontmatter.`,
        'legacy-frontmatter-key-value',
        'Use simple "key: value" frontmatter lines for supported legacy imports.',
        { sourcePath, line: trimmed },
      );
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();

    if (!key) {
      throw createImportValidationError(
        `Legacy document "${sourcePath}" contains malformed frontmatter.`,
        'legacy-frontmatter-key-required',
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

async function collectLegacyFiles(sourceRoot: string): Promise<LegacySourceFile[]> {
  const entries = await readdir(sourceRoot, { withFileTypes: true });
  const files: LegacySourceFile[] = [];

  for (const entry of entries) {
    const absolutePath = path.join(sourceRoot, entry.name);
    if (entry.isDirectory()) {
      const nestedFiles = await collectLegacyFiles(absolutePath);
      files.push(...nestedFiles);
      continue;
    }

    const extension = path.extname(entry.name).toLowerCase();
    if (extension !== '.md' && extension !== '.mdx') {
      continue;
    }

    const rawContent = await readFile(absolutePath, 'utf8');
    const { body, frontmatter } = parseFrontmatter(rawContent, absolutePath);
    files.push({
      absolutePath,
      relativePath: absolutePath,
      format: extension === '.mdx' ? 'mdx' : 'markdown',
      rawContent,
      body,
      frontmatter,
    });
  }

  return files;
}

function toRelativeFiles(sourceRoot: string, files: LegacySourceFile[]): LegacySourceFile[] {
  return files.map((file) => ({
    ...file,
    relativePath: path.relative(sourceRoot, file.absolutePath),
  }));
}

function createItemId(relativePath: string, index: number): string {
  const base = relativePath
    .replace(/\.(md|mdx)$/i, '')
    .split(path.sep)
    .join('-')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return base || `legacy-item-${index + 1}`;
}

function buildImportItems(
  files: LegacySourceFile[],
  lang: DocsLanguage,
  importedAt: string,
): LegacyImportItem[] {
  const seenSlugs = new Set<string>();

  return files.map((file, index) => {
    const slug = normalizeImportSlug(file.relativePath);
    if (!slug) {
      throw createImportValidationError(
        `Legacy document "${file.relativePath}" could not be normalized into a slug.`,
        'legacy-slug-normalized',
        'Rename the source file or move it into a directory structure that produces a non-empty slug.',
        { sourcePath: file.relativePath },
      );
    }

    if (seenSlugs.has(slug)) {
      throw createImportValidationError(
        `Legacy import contains duplicate slug "${slug}".`,
        'legacy-import-slug-unique',
        'Rename or move the conflicting source files so each imported document has a unique slug.',
        { slug, sourcePath: file.relativePath },
      );
    }
    seenSlugs.add(slug);

    return {
      id: createItemId(file.relativePath, index),
      sourcePath: file.relativePath.split(path.sep).join('/'),
      lang,
      slug,
      title: inferTitle(slug, file.frontmatter, file.body),
      description: inferDescription(file.frontmatter),
      tags: inferTags(file.frontmatter),
      format: file.format,
      importedAt,
      rawContent: file.rawContent,
      body: file.body,
      frontmatter: file.frontmatter,
      status: 'staged',
    };
  });
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export async function importLegacyDocumentation(
  options: ImportLegacyDocumentationOptions,
): Promise<LegacyImportResult> {
  const contractResult = await loadProjectContract(options.repoRoot, options.projectId);
  if (!contractResult.ok) {
    throw contractResult.error;
  }

  const contract = contractResult.value;
  const lang = options.lang ?? contract.config.defaultLanguage;
  const sourceStats = await stat(options.sourceRoot).catch(() => null);
  if (!sourceStats?.isDirectory()) {
    throw createImportValidationError(
      `Legacy source root "${options.sourceRoot}" does not exist or is not a directory.`,
      'legacy-source-root-directory',
      'Provide a directory containing .md or .mdx files for import.',
      { sourceRoot: options.sourceRoot },
    );
  }

  const collectedFiles = toRelativeFiles(options.sourceRoot, await collectLegacyFiles(options.sourceRoot));
  if (collectedFiles.length === 0) {
    throw createImportValidationError(
      `Legacy source root "${options.sourceRoot}" does not contain any supported files.`,
      'legacy-source-supported-files-required',
      'Add at least one .md or .mdx file before invoking the import workflow.',
      { sourceRoot: options.sourceRoot },
    );
  }

  const importedAt = new Date().toISOString();
  const items = buildImportItems(collectedFiles, lang, importedAt);
  const importId = `legacy-${importedAt.replace(/[:.]/g, '-').toLowerCase()}`;
  const importRoot = path.join(contract.paths.importsRoot, importId);
  const manifestFile = path.join(importRoot, 'manifest.json');
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'anydocs-legacy-import-'));

  try {
    const stagedImportRoot = path.join(tempRoot, importId);
    const stagedItemsRoot = path.join(stagedImportRoot, 'items');
    const manifest: LegacyImportManifest = {
      version: 1,
      importId,
      projectId: contract.config.projectId,
      sourceRoot: options.sourceRoot,
      importedAt,
      itemCount: items.length,
      status: 'staged',
      items: items.map<LegacyImportManifestItem>((item) => ({
        id: item.id,
        sourcePath: item.sourcePath,
        lang: item.lang,
        slug: item.slug,
        title: item.title,
        format: item.format,
        status: item.status,
      })),
    };

    await writeJson(path.join(stagedImportRoot, 'manifest.json'), manifest);
    for (const item of items) {
      await writeJson(path.join(stagedItemsRoot, `${item.id}.json`), item);
    }

    await mkdir(contract.paths.importsRoot, { recursive: true });
    await rename(stagedImportRoot, importRoot);

    return {
      importId,
      importRoot,
      manifestFile,
      itemCount: items.length,
      items: manifest.items,
    };
  } catch (error: unknown) {
    await rm(importRoot, { recursive: true, force: true }).catch(() => undefined);
    throw error;
  } finally {
    await rm(tempRoot, { recursive: true, force: true }).catch(() => undefined);
  }
}
