import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildPublishedSiteLanguageContent,
  buildPublishedLanguageContent,
  filterNavigationToPublished,
  filterPublishedPages,
  isPageApprovedForPublication,
  orderPublishedPagesByNavigation,
} from '../src/publishing/publication-filter.ts';
import type { NavigationDoc, PageDoc } from '../src/types/docs.ts';

test('filterPublishedPages excludes draft and in_review pages deterministically', () => {
  const pages: PageDoc[] = [
    { id: 'b', lang: 'en', slug: 'beta', title: 'Beta', status: 'draft', content: {} },
    { id: 'a', lang: 'en', slug: 'alpha', title: 'Alpha', status: 'published', content: {} },
    { id: 'c', lang: 'en', slug: 'charlie', title: 'Charlie', status: 'published', content: {} },
    { id: 'd', lang: 'en', slug: 'delta', title: 'Delta', status: 'in_review', content: {} },
  ];

  const result = filterPublishedPages(pages);
  assert.deepEqual(result.map((page) => page.id), ['a', 'c']);
});

test('filterPublishedPages excludes published pages that still require explicit review approval', () => {
  const pages: PageDoc[] = [
    {
      id: 'needs-review',
      lang: 'en',
      slug: 'needs-review',
      title: 'Needs Review',
      status: 'published',
      content: {},
      review: {
        required: true,
        sourceType: 'legacy-import',
        sourceId: 'legacy-1',
      },
    },
    {
      id: 'approved',
      lang: 'en',
      slug: 'approved',
      title: 'Approved',
      status: 'published',
      content: {},
      review: {
        required: true,
        sourceType: 'legacy-import',
        sourceId: 'legacy-1',
        approvedAt: '2026-03-11T00:00:00.000Z',
      },
    },
  ];

  const result = filterPublishedPages(pages);
  assert.deepEqual(result.map((page) => page.id), ['approved']);
  assert.equal(isPageApprovedForPublication(pages[0]!), false);
  assert.equal(isPageApprovedForPublication(pages[1]!), true);
});

test('filterNavigationToPublished removes unpublished page references and empty groups', () => {
  const navigation: NavigationDoc = {
    version: 1,
    items: [
      { type: 'page', pageId: 'welcome' },
      {
        type: 'section',
        title: 'Hidden',
        children: [{ type: 'page', pageId: 'draft-page' }],
      },
      {
        type: 'folder',
        title: 'Published',
        children: [{ type: 'page', pageId: 'guide' }],
      },
      { type: 'link', title: 'External', href: 'https://example.com' },
    ],
  };

  const result = filterNavigationToPublished(navigation.items, new Set(['welcome', 'guide']));
  assert.deepEqual(result, [
    { type: 'page', pageId: 'welcome' },
    {
      type: 'folder',
      title: 'Published',
      children: [{ type: 'page', pageId: 'guide' }],
    },
    { type: 'link', title: 'External', href: 'https://example.com' },
  ]);
});

test('buildPublishedLanguageContent returns deterministic published bundle', () => {
  const navigation: NavigationDoc = {
    version: 1,
    items: [
      { type: 'page', pageId: 'welcome' },
      { type: 'page', pageId: 'draft-page' },
    ],
  };
  const pages: PageDoc[] = [
    { id: 'draft-page', lang: 'en', slug: 'draft', title: 'Draft', status: 'draft', content: {} },
    { id: 'welcome', lang: 'en', slug: 'welcome', title: 'Welcome', status: 'published', content: {} },
  ];

  const first = buildPublishedLanguageContent(navigation, pages);
  const second = buildPublishedLanguageContent(navigation, pages);

  assert.deepEqual(first, second);
  assert.deepEqual(first.pages.map((page) => page.id), ['welcome']);
  assert.deepEqual(first.navigation.items, [{ type: 'page', pageId: 'welcome' }]);
});

test('orderPublishedPagesByNavigation follows navigation order before slug fallback', () => {
  const navigation: NavigationDoc = {
    version: 1,
    items: [
      { type: 'page', pageId: 'guide' },
      {
        type: 'folder',
        title: 'Reference',
        children: [{ type: 'page', pageId: 'welcome' }],
      },
    ],
  };
  const pages: PageDoc[] = [
    { id: 'welcome', lang: 'en', slug: 'welcome', title: 'Welcome', status: 'published', content: {} },
    { id: 'extras', lang: 'en', slug: 'extras', title: 'Extras', status: 'published', content: {} },
    { id: 'guide', lang: 'en', slug: 'guide', title: 'Guide', status: 'published', content: {} },
  ];

  const ordered = orderPublishedPagesByNavigation(navigation, pages);

  assert.deepEqual(
    ordered.map((page) => page.id),
    ['guide', 'welcome', 'extras'],
  );
});

test('buildPublishedSiteLanguageContent emits stable route metadata from published pages', () => {
  const navigation: NavigationDoc = {
    version: 1,
    items: [{ type: 'page', pageId: 'getting-started' }],
  };
  const pages: PageDoc[] = [
    {
      id: 'getting-started',
      lang: 'en',
      slug: 'guide/getting-started',
      title: 'Getting Started',
      status: 'published',
      content: {},
    },
  ];

  const site = buildPublishedSiteLanguageContent('en', navigation, pages);

  assert.deepEqual(site.routes, [
    {
      pageId: 'getting-started',
      slug: 'guide/getting-started',
      segments: ['guide', 'getting-started'],
      href: '/en/guide/getting-started',
      title: 'Getting Started',
    },
  ]);
});
