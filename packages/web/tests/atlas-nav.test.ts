import assert from 'node:assert/strict';
import test from 'node:test';

import type { ProjectSiteTopNavItem } from '@anydocs/core';

import { buildTopNavHref, pageBelongsToGroup, resolveFilteredNavigation } from '../lib/themes/atlas-nav.ts';
import type { NavigationDoc, PageDoc } from '../lib/docs/types.ts';

const pages: PageDoc[] = [
  {
    id: 'intro',
    lang: 'en',
    slug: 'guides/intro',
    title: 'Intro',
    status: 'published',
    content: {},
  },
  {
    id: 'nested',
    lang: 'en',
    slug: 'guides/nested/advanced',
    title: 'Advanced',
    status: 'published',
    content: {},
  },
  {
    id: 'api-start',
    lang: 'en',
    slug: 'api/start',
    title: 'API Start',
    status: 'published',
    content: {},
  },
];

const navigation: NavigationDoc = {
  version: 2,
  items: [
    {
      type: 'section',
      id: 'guides',
      title: 'Guides',
      children: [
        {
          type: 'folder',
          title: 'Nested',
          children: [{ type: 'page', pageId: 'nested' }],
        },
        {
          type: 'page',
          pageId: 'intro',
        },
      ],
    },
    {
      type: 'section',
      id: 'api',
      title: 'API',
      children: [{ type: 'page', pageId: 'api-start' }],
    },
  ],
};

const topNav: ProjectSiteTopNavItem[] = [
  {
    id: 'guides',
    type: 'nav-group',
    groupId: 'guides',
    label: { en: 'Guides' },
  },
  {
    id: 'github',
    type: 'external',
    href: 'https://github.com/anydocs/anydocs',
    openInNewTab: true,
    label: { en: 'GitHub' },
  },
];

test('pageBelongsToGroup matches nested pages inside a referenced top-level group', () => {
  assert.equal(pageBelongsToGroup(navigation.items, 'guides', 'nested'), true);
  assert.equal(pageBelongsToGroup(navigation.items, 'guides', 'api-start'), false);
});

test('buildTopNavHref resolves the first reachable page recursively for nav-group items', () => {
  assert.equal(buildTopNavHref(topNav[0]!, 'en', navigation, pages), '/en/guides/nested/advanced');
  assert.equal(buildTopNavHref(topNav[1]!, 'en', navigation, pages), 'https://github.com/anydocs/anydocs');
});

test('resolveFilteredNavigation scopes sidebar items to the inferred active group', () => {
  const result = resolveFilteredNavigation(navigation, topNav, 'nested');

  assert.equal(result.activeGroupId, 'guides');
  assert.deepEqual(result.filteredNav.items, navigation.items[0]?.children);
});
