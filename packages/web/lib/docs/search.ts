export type ReaderSearchDoc = {
  id: string;
  pageId: string;
  pageSlug: string;
  pageTitle: string;
  sectionTitle: string;
  breadcrumbs: string[];
  href: string;
  text: string;
};

export type ReaderSearchIndex = {
  lang: string;
  docs: ReaderSearchDoc[];
};

export type ReaderSearchHit = ReaderSearchDoc & {
  score?: number;
};

export type ReaderSearchResult = ReaderSearchDoc & {
  score: number;
  snippet: string;
};

const MAX_RESULTS = 8;
const MAX_RESULTS_PER_PAGE = 2;
const SNIPPET_LENGTH = 140;

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function collapseWhitespace(value: unknown): string {
  return asString(value).replace(/\s+/g, ' ').trim();
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === 'string');
}

function trimLeadingSlash(value: string): string {
  return value.replace(/^\/+/, '');
}

function buildPageHref(lang: string, slug: string): string {
  const normalizedSlug = trimLeadingSlash(slug);
  return normalizedSlug ? `/${lang}/${normalizedSlug}` : `/${lang}`;
}

type SearchIndexRecord = Partial<ReaderSearchDoc> & {
  title?: string;
  slug?: string;
  url?: string;
  description?: string;
 };

export function normalizeReaderSearchDoc(record: SearchIndexRecord, lang: string): ReaderSearchDoc {
  const pageSlug = collapseWhitespace(record.pageSlug ?? record.slug);
  const href = collapseWhitespace(record.href ?? record.url) || buildPageHref(lang, pageSlug);
  const pageId = collapseWhitespace(record.pageId ?? record.id) || pageSlug || href;
  const pageTitle = collapseWhitespace(record.pageTitle ?? record.title) || pageSlug || pageId;
  const text = collapseWhitespace(record.text ?? record.description) || pageTitle;

  return {
    id: collapseWhitespace(record.id) || `${pageId}:${href}`,
    pageId,
    pageSlug,
    pageTitle,
    sectionTitle: collapseWhitespace(record.sectionTitle),
    breadcrumbs: asStringArray(record.breadcrumbs),
    href,
    text,
  };
}

export function normalizeReaderSearchIndex(raw: unknown, fallbackLang: string): ReaderSearchIndex {
  const candidate =
    raw && typeof raw === 'object'
      ? (raw as { lang?: unknown; docs?: unknown })
      : {};

  const lang = collapseWhitespace(candidate.lang) || fallbackLang;
  const docs = Array.isArray(candidate.docs)
    ? candidate.docs
        .filter((entry): entry is SearchIndexRecord => !!entry && typeof entry === 'object')
        .map((entry) => normalizeReaderSearchDoc(entry, lang))
    : [];

  return { lang, docs };
}

function normalizeQuery(value: string): string {
  return collapseWhitespace(value).toLowerCase();
}

function getQueryTerms(query: string): string[] {
  const normalized = normalizeQuery(query);
  if (!normalized) {
    return [];
  }

  return [...new Set(normalized.split(/\s+/).filter(Boolean))];
}

function scoreField(value: string, query: string, weights: { exact: number; prefix: number; includes: number }): number {
  const normalizedValue = collapseWhitespace(value).toLowerCase();
  if (!normalizedValue || !query) {
    return 0;
  }

  if (normalizedValue === query) {
    return weights.exact;
  }

  if (normalizedValue.startsWith(query)) {
    return weights.prefix;
  }

  if (normalizedValue.includes(query)) {
    return weights.includes;
  }

  return 0;
}

function scoreTerms(value: string, terms: string[], weight: number): number {
  if (!terms.length) {
    return 0;
  }

  const normalizedValue = collapseWhitespace(value).toLowerCase();
  return terms.every((term) => normalizedValue.includes(term)) ? weight : 0;
}

function scoreResult(hit: ReaderSearchHit, query: string): number {
  const terms = getQueryTerms(query);

  return (hit.score ?? 0)
    + scoreField(hit.pageTitle, query, { exact: 140, prefix: 90, includes: 60 })
    + scoreField(hit.sectionTitle, query, { exact: 110, prefix: 70, includes: 45 })
    + scoreTerms(hit.pageTitle, terms, 40)
    + scoreTerms(hit.sectionTitle, terms, 25)
    + scoreTerms(hit.text, terms, 8);
}

function getDocSearchText(doc: ReaderSearchDoc): string {
  return collapseWhitespace([doc.pageTitle, doc.sectionTitle, doc.text].filter(Boolean).join(' ')).toLowerCase();
}

function matchesFallbackQuery(doc: ReaderSearchDoc, normalizedQuery: string, terms: string[]): boolean {
  const searchable = getDocSearchText(doc);
  if (!searchable) {
    return false;
  }

  if (searchable.includes(normalizedQuery)) {
    return true;
  }

  return terms.length > 1 && terms.every((term) => searchable.includes(term));
}

export function findReaderFallbackHits(docs: ReaderSearchDoc[], query: string): ReaderSearchHit[] {
  const normalizedQuery = normalizeQuery(query);
  if (!normalizedQuery) {
    return [];
  }

  const terms = getQueryTerms(normalizedQuery);
  return docs
    .filter((doc) => matchesFallbackQuery(doc, normalizedQuery, terms))
    .map((doc) => ({ ...doc, score: 0 }));
}

export function mergeReaderSearchHits(
  primaryHits: ReaderSearchHit[],
  secondaryHits: ReaderSearchHit[],
): ReaderSearchHit[] {
  const merged = new Map<string, ReaderSearchHit>();

  for (const hit of [...primaryHits, ...secondaryHits]) {
    const key = hit.href || hit.id;
    const existing = merged.get(key);
    if (!existing || (hit.score ?? 0) > (existing.score ?? 0)) {
      merged.set(key, hit);
    }
  }

  return [...merged.values()];
}

export function buildSearchSnippet(text: string, query: string, maxLength = SNIPPET_LENGTH): string {
  const normalizedText = collapseWhitespace(text);
  const normalizedQuery = normalizeQuery(query);

  if (!normalizedText) {
    return '';
  }

  if (!normalizedQuery) {
    return normalizedText.slice(0, maxLength);
  }

  const lowerText = normalizedText.toLowerCase();
  const terms = [normalizedQuery, ...getQueryTerms(query)];
  const matchIndex = terms.reduce<number>((best, term) => {
    const index = lowerText.indexOf(term);
    if (index === -1) {
      return best;
    }

    if (best === -1 || index < best) {
      return index;
    }

    return best;
  }, -1);

  if (matchIndex === -1 || normalizedText.length <= maxLength) {
    return normalizedText.slice(0, maxLength);
  }

  const leading = Math.max(0, matchIndex - Math.floor(maxLength * 0.35));
  const trailing = Math.min(normalizedText.length, leading + maxLength);

  let start = leading;
  let end = trailing;

  if (start > 0) {
    const nextSpace = normalizedText.indexOf(' ', start);
    if (nextSpace !== -1 && nextSpace < matchIndex) {
      start = nextSpace + 1;
    }
  }

  if (end < normalizedText.length) {
    const previousSpace = normalizedText.lastIndexOf(' ', end);
    if (previousSpace > matchIndex) {
      end = previousSpace;
    }
  }

  const snippet = normalizedText.slice(start, end).trim();
  return `${start > 0 ? '…' : ''}${snippet}${end < normalizedText.length ? '…' : ''}`;
}

export function buildReaderSearchResults(hits: ReaderSearchHit[], query: string): ReaderSearchResult[] {
  const normalizedQuery = normalizeQuery(query);
  if (!normalizedQuery) {
    return [];
  }

  const bestByHref = new Map<string, ReaderSearchResult>();

  for (const hit of hits) {
    const candidate: ReaderSearchResult = {
      ...hit,
      score: scoreResult(hit, normalizedQuery),
      snippet: buildSearchSnippet(hit.text, normalizedQuery),
    };

    const existing = bestByHref.get(hit.href);
    if (!existing || candidate.score > existing.score) {
      bestByHref.set(hit.href, candidate);
    }
  }

  const ranked = [...bestByHref.values()].sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }

    return left.href.localeCompare(right.href);
  });

  const pageCounts = new Map<string, number>();
  const results: ReaderSearchResult[] = [];

  for (const result of ranked) {
    const count = pageCounts.get(result.pageId) ?? 0;
    if (count >= MAX_RESULTS_PER_PAGE) {
      continue;
    }

    results.push(result);
    pageCounts.set(result.pageId, count + 1);

    if (results.length >= MAX_RESULTS) {
      break;
    }
  }

  return results;
}
