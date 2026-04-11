import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildReaderSearchResults,
  buildSearchSnippet,
  findReaderFallbackHits,
  mergeReaderSearchHits,
  normalizeReaderSearchIndex,
} from '../lib/docs/search.ts';

test('buildSearchSnippet centers the matching query and trims long body text', () => {
  const snippet = buildSearchSnippet(
    'Introduction text before the match. The search keyword lives in this sentence and should stay visible in the snippet output that follows.',
    'keyword',
    90,
  );

  assert.match(snippet, /keyword/i);
  assert.ok(snippet.startsWith('…'));
  assert.ok(snippet.endsWith('…'));
  assert.ok(snippet.length <= 92);
});

test('buildReaderSearchResults ranks title and section matches ahead of body-only matches', () => {
  const results = buildReaderSearchResults(
    [
      {
        id: 'guide-1',
        pageId: 'guide',
        pageSlug: 'guide',
        pageTitle: 'Guide',
        sectionTitle: 'Setup',
        breadcrumbs: ['Getting Started'],
        href: '/en/guide#setup',
        text: 'Install the docs runtime.',
        score: 1,
      },
      {
        id: 'faq-1',
        pageId: 'faq',
        pageSlug: 'faq',
        pageTitle: 'FAQ',
        sectionTitle: '',
        breadcrumbs: ['Reference'],
        href: '/en/faq',
        text: 'This body text mentions setup once.',
        score: 5,
      },
    ],
    'setup',
  );

  assert.equal(results[0]?.pageId, 'guide');
  assert.equal(results[0]?.sectionTitle, 'Setup');
  assert.equal(results[1]?.pageId, 'faq');
});

test('buildReaderSearchResults deduplicates identical href hits and caps same-page results', () => {
  const results = buildReaderSearchResults(
    [
      {
        id: 'guide-1',
        pageId: 'guide',
        pageSlug: 'guide',
        pageTitle: 'Guide',
        sectionTitle: 'Overview',
        breadcrumbs: [],
        href: '/en/guide#overview',
        text: 'Overview setup text.',
        score: 4,
      },
      {
        id: 'guide-2',
        pageId: 'guide',
        pageSlug: 'guide',
        pageTitle: 'Guide',
        sectionTitle: 'Overview',
        breadcrumbs: [],
        href: '/en/guide#overview',
        text: 'Overview setup text with a slightly stronger match.',
        score: 8,
      },
      {
        id: 'guide-3',
        pageId: 'guide',
        pageSlug: 'guide',
        pageTitle: 'Guide',
        sectionTitle: 'Details',
        breadcrumbs: [],
        href: '/en/guide#details',
        text: 'Detailed setup instructions.',
        score: 7,
      },
      {
        id: 'guide-4',
        pageId: 'guide',
        pageSlug: 'guide',
        pageTitle: 'Guide',
        sectionTitle: 'Troubleshooting',
        breadcrumbs: [],
        href: '/en/guide#troubleshooting',
        text: 'More setup notes.',
        score: 6,
      },
    ],
    'setup',
  );

  assert.deepEqual(
    results.map((entry) => entry.href),
    ['/en/guide#overview', '/en/guide#details'],
  );
});

test('normalizeReaderSearchIndex maps legacy page-level search docs to reader docs safely', () => {
  const index = normalizeReaderSearchIndex(
    {
      lang: 'en',
      docs: [
        {
          id: 'welcome',
          slug: 'welcome',
          title: 'Welcome',
          breadcrumbs: ['Getting Started'],
          text: 'Welcome to the docs.',
        },
      ],
    },
    'en',
  );

  assert.deepEqual(index, {
    lang: 'en',
    docs: [
      {
        id: 'welcome',
        pageId: 'welcome',
        pageSlug: 'welcome',
        pageTitle: 'Welcome',
        sectionTitle: '',
        breadcrumbs: ['Getting Started'],
        href: '/en/welcome',
        text: 'Welcome to the docs.',
      },
    ],
  });
});

test('findReaderFallbackHits matches non-prefix substrings and cjk suffixes', () => {
  const hits = findReaderFallbackHits(
    [
      {
        id: 'blueprint-review',
        pageId: 'blueprint-review',
        pageSlug: 'blueprint-review',
        pageTitle: 'Blueprint Review',
        sectionTitle: '',
        breadcrumbs: [],
        href: '/en/blueprint-review',
        text: 'Review a technical spec before implementation.',
      },
      {
        id: 'welcome-zh',
        pageId: 'welcome',
        pageSlug: 'welcome',
        pageTitle: '页面模板示例',
        sectionTitle: '',
        breadcrumbs: [],
        href: '/zh/welcome',
        text: '这个样例专门解释 Anydocs 的模板能力。',
      },
    ],
    '示例',
  );

  assert.equal(hits.length, 1);
  assert.equal(hits[0]?.href, '/zh/welcome');

  const englishHits = findReaderFallbackHits(
    [
      {
        id: 'blueprint-review',
        pageId: 'blueprint-review',
        pageSlug: 'blueprint-review',
        pageTitle: 'Blueprint Review',
        sectionTitle: '',
        breadcrumbs: [],
        href: '/en/blueprint-review',
        text: 'Review a technical spec before implementation.',
      },
    ],
    'print',
  );

  assert.equal(englishHits.length, 1);
  assert.equal(englishHits[0]?.href, '/en/blueprint-review');
});

test('mergeReaderSearchHits keeps minisearch score while adding fallback-only docs', () => {
  const hits = mergeReaderSearchHits(
    [
      {
        id: 'guide-1',
        pageId: 'guide',
        pageSlug: 'guide',
        pageTitle: 'Guide',
        sectionTitle: 'Setup',
        breadcrumbs: [],
        href: '/en/guide#setup',
        text: 'Setup guide.',
        score: 9,
      },
    ],
    [
      {
        id: 'guide-1',
        pageId: 'guide',
        pageSlug: 'guide',
        pageTitle: 'Guide',
        sectionTitle: 'Setup',
        breadcrumbs: [],
        href: '/en/guide#setup',
        text: 'Setup guide.',
        score: 0,
      },
      {
        id: 'faq-1',
        pageId: 'faq',
        pageSlug: 'faq',
        pageTitle: 'FAQ',
        sectionTitle: '',
        breadcrumbs: [],
        href: '/en/faq',
        text: 'Schema details.',
        score: 0,
      },
    ],
  );

  assert.equal(hits.length, 2);
  assert.equal(hits.find((hit) => hit.href === '/en/guide#setup')?.score, 9);
  assert.ok(hits.some((hit) => hit.href === '/en/faq'));
});
