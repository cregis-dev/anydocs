import test from 'node:test';
import assert from 'node:assert/strict';

import { validateNavigationDoc, validatePageDoc } from '../src/schemas/docs-schema.ts';

test('validatePageDoc accepts a canonical page document', () => {
  const page = validatePageDoc({
    id: 'welcome',
    lang: 'en',
    slug: 'getting-started/welcome',
    title: 'Welcome',
    template: 'adr',
    metadata: {
      decisionStatus: 'accepted',
    },
    status: 'draft',
    content: { blocks: [] },
    tags: ['intro'],
    render: {
      markdown: '# Welcome',
    },
    review: {
      required: true,
      sourceType: 'legacy-import',
      sourceId: 'legacy-1',
      itemId: 'welcome',
      warnings: [
        {
          code: 'needs-review',
          message: 'Review imported markdown formatting.',
        },
      ],
    },
  });

  assert.equal(page.id, 'welcome');
  assert.equal(page.lang, 'en');
  assert.equal(page.status, 'draft');
  assert.equal(page.template, 'adr');
  assert.deepEqual(page.metadata, { decisionStatus: 'accepted' });
  assert.deepEqual(page.tags, ['intro']);
  assert.equal(page.review?.sourceType, 'legacy-import');
});

test('validatePageDoc rejects an unsupported status', () => {
  assert.throws(
    () =>
      validatePageDoc({
        id: 'welcome',
        lang: 'en',
        slug: 'getting-started/welcome',
        title: 'Welcome',
        status: 'archived',
        content: {},
      }),
    /page-status-invalid/,
  );
});

test('validatePageDoc rejects non-object metadata values', () => {
  assert.throws(
    () =>
      validatePageDoc({
        id: 'welcome',
        lang: 'en',
        slug: 'getting-started/welcome',
        title: 'Welcome',
        template: 'adr',
        metadata: ['bad'],
        status: 'draft',
        content: {},
      }),
    /page-metadata-object/,
  );
});

test('validateNavigationDoc accepts nested section and page items', () => {
  const navigation = validateNavigationDoc({
    version: 1,
    items: [
      {
        type: 'section',
        title: 'Getting Started',
        children: [
          {
            type: 'page',
            pageId: 'welcome',
          },
        ],
      },
    ],
  });

  assert.equal(navigation.version, 1);
  assert.equal(navigation.items[0]?.type, 'section');
});

test('validateNavigationDoc preserves optional group ids on section and folder items', () => {
  const navigation = validateNavigationDoc({
    version: 2,
    items: [
      {
        type: 'section',
        id: 'guides',
        title: 'Guides',
        children: [
          {
            type: 'folder',
            id: 'tutorials',
            title: 'Tutorials',
            children: [],
          },
        ],
      },
    ],
  });

  assert.equal(navigation.version, 2);
  assert.deepEqual(navigation.items[0], {
    type: 'section',
    id: 'guides',
    title: 'Guides',
    children: [
      {
        type: 'folder',
        id: 'tutorials',
        title: 'Tutorials',
        children: [],
      },
    ],
  });
});

test('validateNavigationDoc rejects invalid page navigation items', () => {
  assert.throws(
    () =>
      validateNavigationDoc({
        version: 1,
        items: [
          {
            type: 'page',
            pageId: '',
          },
        ],
      }),
    /page-id-required/,
  );
});

test('validateNavigationDoc rejects invalid group id formats', () => {
  assert.throws(
    () =>
      validateNavigationDoc({
        version: 2,
        items: [
          {
            type: 'section',
            id: 'Guides Root',
            title: 'Guides',
            children: [],
          },
        ],
      }),
    /group-id-format/,
  );
});
