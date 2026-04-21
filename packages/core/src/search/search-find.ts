import MiniSearch, { type AsPlainObject } from 'minisearch';

import type { DocsLanguage } from '../types/project.ts';

export const READER_SEARCH_ARTIFACT_VERSION = 2 as const;
export const READER_SEARCH_CHUNK_MAX_CHARS = 800;
export const READER_SEARCH_CHUNK_OVERLAP_CHARS = 100;

export const READER_SEARCH_FIELDS = ['title', 'sectionTitle', 'description', 'breadcrumbsText', 'tagsText', 'text'] as const;
export const READER_SEARCH_STORE_FIELDS = [
  'id',
  'pageId',
  'slug',
  'href',
  'title',
  'sectionTitle',
  'breadcrumbs',
  'snippet',
  'order',
] as const;

export const READER_SEARCH_FIELD_BOOSTS = {
  title: 6,
  sectionTitle: 4,
  description: 2.5,
  tagsText: 2,
  breadcrumbsText: 1.5,
  text: 1,
} as const;

export type ReaderSearchTokenizerId = 'latin-v1' | 'cjk-bigram-v1';

export type ReaderSearchQueryOptions = {
  combineWith: 'AND' | 'OR';
  prefix: boolean;
  fuzzy: number | false;
};

export type ReaderSearchRuntimeConfig = {
  language: DocsLanguage;
  tokenizerId: ReaderSearchTokenizerId;
  tokenize: (text: string) => string[];
  fields: readonly string[];
  storeFields: readonly string[];
  boosts: Record<(typeof READER_SEARCH_FIELDS)[number], number>;
  strict: ReaderSearchQueryOptions;
  fallback: ReaderSearchQueryOptions;
};

export type ReaderSearchArtifactConfig = Omit<ReaderSearchRuntimeConfig, 'tokenize'>;

export type ReaderSearchChunkSource = {
  id: string;
  pageId: string;
  slug: string;
  href: string;
  title: string;
  pageTitle: string;
  description: string;
  headingPath: string[];
  breadcrumbs: string[];
  navPath: string[];
  order: number;
  tags: string[];
  updatedAt: string | null;
  text: string;
  enrichedText: string;
  chunkHash: string;
  tokenEstimate: number;
};

export type ReaderSearchFindDoc = {
  id: string;
  pageId: string;
  slug: string;
  href: string;
  title: string;
  sectionTitle: string;
  headingPath: string[];
  breadcrumbs: string[];
  breadcrumbsText: string;
  description: string;
  tags: string[];
  tagsText: string;
  text: string;
  snippet: string;
  order: number;
  updatedAt: string | null;
  chunkHash: string;
  tokenEstimate: number;
};

export type ReaderSearchFindArtifact = {
  version: typeof READER_SEARCH_ARTIFACT_VERSION;
  generatedAt: string;
  builtAt: string;
  projectId: string;
  lang: DocsLanguage;
  engine: 'minisearch';
  docType: 'chunk';
  publicationRule: 'published-only';
  chunking: {
    strategy: 'heading-aware';
    maxChars: number;
    overlapChars: number;
  };
  search: ReaderSearchArtifactConfig;
  index: AsPlainObject;
};

function normalizeSearchText(value: string): string {
  return value.normalize('NFKC').replace(/\s+/g, ' ').trim();
}

function isCjkCharacter(char: string): boolean {
  return /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(char);
}

function pushUnique(tokens: string[], seen: Set<string>, token: string): void {
  const normalized = token.trim();
  if (!normalized || seen.has(normalized)) {
    return;
  }

  seen.add(normalized);
  tokens.push(normalized);
}

export function tokenizeLatinSearchText(value: string): string[] {
  const normalized = normalizeSearchText(value).toLowerCase();
  if (!normalized) {
    return [];
  }

  const tokens = normalized.match(/[a-z0-9]+/g) ?? [];
  return Array.from(new Set(tokens));
}

export function tokenizeCjkSearchText(value: string): string[] {
  const normalized = normalizeSearchText(value).toLowerCase();
  if (!normalized) {
    return [];
  }

  const tokens: string[] = [];
  const seen = new Set<string>();
  let latinBuffer = '';
  let cjkBuffer = '';

  const flushLatinBuffer = () => {
    if (!latinBuffer) {
      return;
    }

    for (const token of tokenizeLatinSearchText(latinBuffer)) {
      pushUnique(tokens, seen, token);
    }
    latinBuffer = '';
  };

  const flushCjkBuffer = () => {
    if (!cjkBuffer) {
      return;
    }

    for (const char of cjkBuffer) {
      pushUnique(tokens, seen, char);
    }

    if (cjkBuffer.length > 1) {
      for (let index = 0; index < cjkBuffer.length - 1; index += 1) {
        pushUnique(tokens, seen, cjkBuffer.slice(index, index + 2));
      }
    }

    cjkBuffer = '';
  };

  for (const char of normalized) {
    if (isCjkCharacter(char)) {
      flushLatinBuffer();
      cjkBuffer += char;
      continue;
    }

    if (/[a-z0-9]/.test(char)) {
      flushCjkBuffer();
      latinBuffer += char;
      continue;
    }

    flushLatinBuffer();
    flushCjkBuffer();
  }

  flushLatinBuffer();
  flushCjkBuffer();

  return tokens;
}

export function tokenizeReaderSearchText(language: DocsLanguage, value: string): string[] {
  return language === 'zh' ? tokenizeCjkSearchText(value) : tokenizeLatinSearchText(value);
}

export function createReaderSearchRuntimeConfig(language: DocsLanguage): ReaderSearchRuntimeConfig {
  const tokenizerId: ReaderSearchTokenizerId = language === 'zh' ? 'cjk-bigram-v1' : 'latin-v1';
  const tokenize = (text: string) => tokenizeReaderSearchText(language, text);
  const strict: ReaderSearchQueryOptions = {
    combineWith: 'AND',
    prefix: true,
    fuzzy: language === 'zh' ? false : 0.15,
  };
  const fallback: ReaderSearchQueryOptions = {
    combineWith: 'OR',
    prefix: true,
    fuzzy: language === 'zh' ? false : 0.15,
  };

  return {
    language,
    tokenizerId,
    tokenize,
    fields: READER_SEARCH_FIELDS,
    storeFields: READER_SEARCH_STORE_FIELDS,
    boosts: READER_SEARCH_FIELD_BOOSTS,
    strict,
    fallback,
  };
}

export function serializeReaderSearchConfig(config: ReaderSearchRuntimeConfig): ReaderSearchArtifactConfig {
  return {
    language: config.language,
    tokenizerId: config.tokenizerId,
    fields: [...config.fields],
    storeFields: [...config.storeFields],
    boosts: { ...config.boosts },
    strict: { ...config.strict },
    fallback: { ...config.fallback },
  };
}

function buildSearchSnippet(text: string, length = 180): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= length) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(0, length - 1)).trimEnd()}...`;
}

function buildSectionTitle(chunk: ReaderSearchChunkSource): string {
  const headingPath = chunk.headingPath.filter((heading) => heading.trim().length > 0);
  if (headingPath.length > 0) {
    return headingPath[headingPath.length - 1] ?? chunk.pageTitle;
  }

  return chunk.pageTitle;
}

function buildBreadcrumbsText(breadcrumbs: string[]): string {
  return breadcrumbs.join(' > ');
}

function buildTagsText(tags: string[]): string {
  return tags.join(' ');
}

export function toReaderSearchFindDoc(chunk: ReaderSearchChunkSource): ReaderSearchFindDoc {
  return {
    id: chunk.id,
    pageId: chunk.pageId,
    slug: chunk.slug,
    href: chunk.href,
    title: chunk.title,
    sectionTitle: buildSectionTitle(chunk),
    headingPath: [...chunk.headingPath],
    breadcrumbs: [...chunk.breadcrumbs],
    breadcrumbsText: buildBreadcrumbsText(chunk.breadcrumbs),
    description: chunk.description,
    tags: [...chunk.tags],
    tagsText: buildTagsText(chunk.tags),
    text: chunk.text,
    snippet: buildSearchSnippet(chunk.text),
    order: chunk.order,
    updatedAt: chunk.updatedAt,
    chunkHash: chunk.chunkHash,
    tokenEstimate: chunk.tokenEstimate,
  };
}

export function toReaderSearchFindDocs(chunks: ReaderSearchChunkSource[]): ReaderSearchFindDoc[] {
  return chunks.map((chunk) => toReaderSearchFindDoc(chunk));
}

export function buildReaderSearchFindArtifact(input: {
  projectId: string;
  lang: DocsLanguage;
  generatedAt: string;
  chunks: ReaderSearchChunkSource[];
}): ReaderSearchFindArtifact {
  const searchConfig = createReaderSearchRuntimeConfig(input.lang);
  const docs = toReaderSearchFindDocs(input.chunks);
  const miniSearch = new MiniSearch<ReaderSearchFindDoc>({
    fields: [...searchConfig.fields],
    storeFields: [...searchConfig.storeFields],
    tokenize: searchConfig.tokenize,
    searchOptions: {
      boost: searchConfig.boosts,
      combineWith: searchConfig.strict.combineWith,
      prefix: searchConfig.strict.prefix,
      fuzzy: searchConfig.strict.fuzzy,
    },
  });
  miniSearch.addAll(docs);

  return {
    version: READER_SEARCH_ARTIFACT_VERSION,
    generatedAt: input.generatedAt,
    builtAt: input.generatedAt,
    projectId: input.projectId,
    lang: input.lang,
    engine: 'minisearch',
    docType: 'chunk',
    publicationRule: 'published-only',
    chunking: {
      strategy: 'heading-aware',
      maxChars: READER_SEARCH_CHUNK_MAX_CHARS,
      overlapChars: READER_SEARCH_CHUNK_OVERLAP_CHARS,
    },
    search: serializeReaderSearchConfig(searchConfig),
    index: miniSearch.toJSON(),
  };
}
