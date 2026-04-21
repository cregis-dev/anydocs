import MiniSearch, { type AsPlainObject, type Options, type SearchResult } from 'minisearch';

import type { DocsLang } from './types.ts';

export type ReaderSearchDoc = {
  id: string;
  slug: string;
  title: string;
  description?: string;
  breadcrumbs?: string[];
  text?: string;
  pageId?: string;
  href?: string;
  sectionTitle?: string;
  snippet?: string;
  order?: number;
  tags?: string[];
  breadcrumbsText?: string;
  tagsText?: string;
};

export type ReaderSearchIndexV1 = {
  lang: DocsLang;
  docs: ReaderSearchDoc[];
};

export type ReaderSearchIndexV2 = {
  version: 2;
  lang: DocsLang;
  generatedAt?: string;
  engine?: 'minisearch';
  docType?: 'chunk';
  search?: {
    language?: DocsLang;
    tokenizerId?: 'latin-v1' | 'cjk-bigram-v1';
    fields?: string[];
    storeFields?: string[];
    boosts?: Partial<Record<'title' | 'sectionTitle' | 'description' | 'tagsText' | 'breadcrumbsText' | 'text', number>>;
    strict?: { combineWith: 'AND' | 'OR'; prefix: boolean; fuzzy: number | false };
    fallback?: { combineWith: 'AND' | 'OR'; prefix: boolean; fuzzy: number | false };
  };
  index: unknown;
};

export type LoadedReaderSearchIndex = {
  source: 'v2' | 'v1';
  index: MiniSearch<ReaderSearchDoc>;
  config: ReaderSearchRuntimeConfig;
};

type ReaderSearchHrefOptions = {
  findHref?: string;
  indexHref?: string;
};

const LEGACY_SEARCH_FIELDS: Array<keyof ReaderSearchDoc> = ['title', 'description', 'text'];
const LEGACY_SEARCH_STORE_FIELDS: Array<keyof ReaderSearchDoc> = ['id', 'slug', 'title', 'description', 'breadcrumbs'];

const DEFAULT_SEARCH_FIELDS: Array<keyof ReaderSearchDoc> = [
  'title',
  'sectionTitle',
  'description',
  'breadcrumbsText',
  'tagsText',
  'text',
];

const DEFAULT_SEARCH_STORE_FIELDS: Array<keyof ReaderSearchDoc> = [
  'id',
  'slug',
  'title',
  'description',
  'breadcrumbs',
  'text',
  'pageId',
  'href',
  'sectionTitle',
  'snippet',
  'order',
  'tags',
  'breadcrumbsText',
  'tagsText',
];

type ReaderSearchRuntimeConfig = {
  tokenizerId: 'latin-v1' | 'cjk-bigram-v1';
  tokenize: (text: string) => string[];
  fields: Array<keyof ReaderSearchDoc>;
  storeFields: Array<keyof ReaderSearchDoc>;
  boosts: Partial<Record<'title' | 'sectionTitle' | 'description' | 'tagsText' | 'breadcrumbsText' | 'text', number>>;
  strict: { combineWith: 'AND' | 'OR'; prefix: boolean; fuzzy: number | false };
  fallback: { combineWith: 'AND' | 'OR'; prefix: boolean; fuzzy: number | false };
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

function tokenizeLatinSearchText(value: string): string[] {
  const normalized = normalizeSearchText(value).toLowerCase();
  if (!normalized) {
    return [];
  }

  const tokens = normalized.match(/[a-z0-9]+/g) ?? [];
  return Array.from(new Set(tokens));
}

function tokenizeCjkSearchText(value: string): string[] {
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

function isReaderSearchIndexV2(value: unknown): value is ReaderSearchIndexV2 {
  return Boolean(
    value &&
      typeof value === 'object' &&
      (value as ReaderSearchIndexV2).version === 2 &&
      (value as ReaderSearchIndexV2).index,
  );
}

function isReaderSearchIndexV1(value: unknown): value is ReaderSearchIndexV1 {
  return Boolean(
    value &&
      typeof value === 'object' &&
      Array.isArray((value as ReaderSearchIndexV1).docs) &&
      typeof (value as ReaderSearchIndexV1).lang === 'string',
  );
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function toMiniSearchOptions(config: ReaderSearchRuntimeConfig): Options<ReaderSearchDoc> {
  return {
    fields: [...config.fields] as Array<keyof ReaderSearchDoc>,
    storeFields: [...config.storeFields] as Array<keyof ReaderSearchDoc>,
    tokenize: config.tokenize,
    searchOptions: {
      boost: config.boosts,
      combineWith: config.strict.combineWith,
      prefix: config.strict.prefix,
      fuzzy: config.strict.fuzzy,
    },
    autoVacuum: false,
  };
}

function createReaderSearchRuntimeConfig(
  lang: DocsLang,
  artifactConfig?: ReaderSearchIndexV2['search'],
): ReaderSearchRuntimeConfig {
  const isZh = lang === 'zh';
  const tokenizerId = artifactConfig?.tokenizerId ?? (isZh ? 'cjk-bigram-v1' : 'latin-v1');
  const tokenize = tokenizerId === 'cjk-bigram-v1' ? tokenizeCjkSearchText : tokenizeLatinSearchText;

  return {
    tokenizerId,
    tokenize,
    fields: (artifactConfig?.fields as Array<keyof ReaderSearchDoc> | undefined) ?? DEFAULT_SEARCH_FIELDS,
    storeFields:
      (artifactConfig?.storeFields as Array<keyof ReaderSearchDoc> | undefined) ?? DEFAULT_SEARCH_STORE_FIELDS,
    boosts: artifactConfig?.boosts ?? {
      title: 6,
      sectionTitle: 4,
      description: 2.5,
      tagsText: 2,
      breadcrumbsText: 1.5,
      text: 1,
    },
    strict: artifactConfig?.strict ?? {
      combineWith: 'AND',
      prefix: true,
      fuzzy: isZh ? false : 0.15,
    },
    fallback: artifactConfig?.fallback ?? {
      combineWith: 'OR',
      prefix: true,
      fuzzy: isZh ? false : 0.15,
    },
  };
}

type ReaderSearchVariant = 'v1' | 'v2';

export function getReaderSearchOptions(
  lang: DocsLang,
  variant: ReaderSearchVariant = 'v2',
): Options<ReaderSearchDoc> {
  if (variant === 'v1') {
    return {
      fields: [...LEGACY_SEARCH_FIELDS],
      storeFields: [...LEGACY_SEARCH_STORE_FIELDS],
      searchOptions: {
        boost: { title: 4, description: 2, text: 1 },
        prefix: true,
        fuzzy: 0.2,
      },
    };
  }

  return toMiniSearchOptions(createReaderSearchRuntimeConfig(lang));
}

function createEmptySearchIndex(lang: DocsLang): MiniSearch<ReaderSearchDoc> {
  return new MiniSearch(toMiniSearchOptions(createReaderSearchRuntimeConfig(lang)));
}

export async function loadReaderSearchIndex(
  lang: DocsLang,
  source: 'v2' | 'v1',
  hrefs: ReaderSearchHrefOptions = {},
): Promise<LoadedReaderSearchIndex> {
  if (source === 'v2') {
    const response = await fetch(hrefs.findHref ?? `/search-find.${lang}.json`, { cache: 'force-cache' });
    if (!response.ok) {
      throw new Error(`Failed to load v2 search index for ${lang}.`);
    }

    const artifact = (await response.json()) as unknown;
    if (!isReaderSearchIndexV2(artifact)) {
      throw new Error(`Invalid v2 search index for ${lang}.`);
    }

    const config = createReaderSearchRuntimeConfig(lang, artifact.search);
    const index =
      typeof artifact.index === 'string'
        ? await MiniSearch.loadJSONAsync(artifact.index, toMiniSearchOptions(config))
        : await MiniSearch.loadJSAsync(
            artifact.index as AsPlainObject,
            toMiniSearchOptions(config),
          );

    return {
      source: 'v2',
      index,
      config,
    };
  }

  const response = await fetch(hrefs.indexHref ?? `/search-index.${lang}.json`, { cache: 'force-cache' });
  if (!response.ok) {
    throw new Error(`Failed to load v1 search index for ${lang}.`);
  }

  const artifact = (await response.json()) as unknown;
  if (!isReaderSearchIndexV1(artifact)) {
    throw new Error(`Invalid v1 search index for ${lang}.`);
  }

  const miniSearch = new MiniSearch(getReaderSearchOptions(lang, 'v1'));
  miniSearch.addAll(artifact.docs);
  return {
    source: 'v1',
    index: miniSearch,
    config: createReaderSearchRuntimeConfig(lang),
  };
}

export async function loadPreferredReaderSearchIndex(
  lang: DocsLang,
  hrefs: ReaderSearchHrefOptions = {},
): Promise<LoadedReaderSearchIndex> {
  try {
    return await loadReaderSearchIndex(lang, 'v2', hrefs);
  } catch {
    try {
      return await loadReaderSearchIndex(lang, 'v1', hrefs);
    } catch {
      return {
        source: 'v1',
        index: createEmptySearchIndex(lang),
        config: createReaderSearchRuntimeConfig(lang),
      };
    }
  }
}

function resultSearchSignature(result: SearchResult): string {
  const href = normalizeWhitespace(result.href ?? `/${result.slug ?? ''}`);
  const sectionTitle = normalizeWhitespace(result.sectionTitle ?? '');
  const snippet = normalizeWhitespace(result.snippet ?? result.text ?? result.description ?? '');
  const stableSuffix = sectionTitle || snippet.slice(0, 120);
  return [href, stableSuffix].join('|');
}

export function dedupeReaderSearchResults(results: SearchResult[]): SearchResult[] {
  const bySignature = new Map<string, SearchResult>();

  for (const result of results) {
    const signature = resultSearchSignature(result);
    const existing = bySignature.get(signature);
    if (!existing || result.score > existing.score) {
      bySignature.set(signature, result);
    }
  }

  return [...bySignature.values()].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;

    const aOrder = a.order ?? Number.MAX_SAFE_INTEGER;
    const bOrder = b.order ?? Number.MAX_SAFE_INTEGER;
    if (aOrder !== bOrder) return aOrder - bOrder;

    return (a.title ?? '').localeCompare(b.title ?? '');
  });
}

export function searchReaderIndex(
  index: MiniSearch<ReaderSearchDoc>,
  query: string,
  _lang: DocsLang,
  source: LoadedReaderSearchIndex['source'],
  config?: ReaderSearchRuntimeConfig,
): SearchResult[] {
  const modeSearch = (mode: 'strict' | 'loose') =>
    index.search(query, {
      combineWith:
        source === 'v1'
          ? mode === 'strict'
            ? 'AND'
            : 'OR'
          : mode === 'strict'
            ? config!.strict.combineWith
            : config!.fallback.combineWith,
      prefix:
        source === 'v1'
          ? true
          : mode === 'strict'
            ? config!.strict.prefix
            : config!.fallback.prefix,
      fuzzy:
        source === 'v1'
          ? 0.2
          : mode === 'strict'
            ? config!.strict.fuzzy
            : config!.fallback.fuzzy,
    }) as SearchResult[];

  const strictResults = modeSearch('strict');
  if (strictResults.length >= 5) {
    return dedupeReaderSearchResults(strictResults);
  }

  return dedupeReaderSearchResults([...strictResults, ...modeSearch('loose')]);
}
