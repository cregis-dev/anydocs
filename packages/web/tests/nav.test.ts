import assert from 'node:assert/strict';
import test from 'node:test';

import { findFirstNavPageId } from '../lib/docs/nav.ts';
import type { NavItem } from '../lib/docs/types.ts';

test('findFirstNavPageId resolves the first visible page recursively', () => {
  const nav: NavItem[] = [
    { type: 'link', title: 'External', href: 'https://example.com' },
    {
      type: 'section',
      title: 'Empty section',
      children: [{ type: 'link', title: 'Nested external', href: '/external' }],
    },
    {
      type: 'folder',
      title: 'Getting Started',
      children: [
        { type: 'page', pageId: 'hidden-intro', hidden: true },
        { type: 'page', pageId: 'introduction' },
      ],
    },
    { type: 'page', pageId: 'later-page' },
  ];

  assert.equal(findFirstNavPageId(nav), 'introduction');
});

test('findFirstNavPageId returns null when navigation has no visible pages', () => {
  assert.equal(
    findFirstNavPageId([
      { type: 'link', title: 'External', href: 'https://example.com' },
      {
        type: 'section',
        title: 'Hidden only',
        children: [{ type: 'page', pageId: 'draft', hidden: true }],
      },
    ]),
    null,
  );
});
