import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { ValidationError } from '../src/errors/validation-error.ts';
import { createDocsRepository, loadPage } from '../src/fs/docs-repository.ts';
import { createDefaultProjectConfig } from '../src/config/project-config.ts';
import { initializeProject } from '../src/services/init-service.ts';
import { createPage } from '../src/services/authoring-service.ts';
import { validateDocContentV1 } from '../src/utils/index.ts';
import {
  composePageFromTemplate,
  createPageFromTemplate,
  filterPublicPageMetadata,
  updatePageFromTemplate,
  validatePageAgainstProjectTemplates,
} from '../src/services/page-template-service.ts';

async function createTempProjectRoot(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), 'anydocs-page-template-'));
}

test('composePageFromTemplate builds structured how-to content and render output', () => {
  const result = composePageFromTemplate({
    template: 'how_to',
    summary: 'Use this workflow to publish a docs page safely.',
    steps: [
      {
        title: 'Open the project',
        body: 'Call project_open before mutating anything.',
      },
      {
        title: 'Create the page',
        body: 'Use page_create_from_template for richer initial structure.',
        code: 'npx -y @anydocs/mcp',
        language: 'bash',
      },
    ],
    callouts: [{ body: 'Keep page status changes separate from content changes.', theme: 'warning' }],
  });

  assert.equal(validateDocContentV1(result.content).ok, true);
  assert.match(result.render.markdown, /^Use this workflow/m);
  assert.match(result.render.markdown, /## Steps/);
  assert.match(result.render.markdown, /1\. Open the project/);
  assert.match(result.render.markdown, /### Open the project/);
  assert.match(result.render.markdown, /```bash/);
  assert.match(result.render.plainText, /Keep page status changes separate/);
});

test('createPageFromTemplate writes a canonical page with generated content and render output', async () => {
  const projectRoot = await createTempProjectRoot();

  try {
    await initializeProject({ repoRoot: projectRoot, languages: ['en'], defaultLanguage: 'en' });

    const result = await createPageFromTemplate({
      projectRoot,
      lang: 'en',
      page: {
        id: 'publish-guide',
        slug: 'publish-guide',
        title: 'Publish Guide',
      },
      template: 'reference',
      summary: 'Reference the publish workflow and key constraints.',
      sections: [
        {
          title: 'Allowed tools',
          body: 'Use canonical page and navigation tools.',
          items: ['page_create', 'page_update', 'page_set_status'],
        },
      ],
      callouts: [{ title: 'Note', body: 'Published pages only appear in build artifacts.', theme: 'info' }],
    });

    assert.equal(result.page.id, 'publish-guide');
    assert.match(result.page.render?.markdown ?? '', /## Allowed tools/);

    const persisted = await loadPage(createDocsRepository(projectRoot), 'en', 'publish-guide');
    assert.equal(persisted?.title, 'Publish Guide');
    assert.match(persisted?.render?.plainText ?? '', /Published pages only appear/);
    assert.equal(validateDocContentV1(persisted?.content).ok, true);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test('composePageFromTemplate rejects empty how-to templates', () => {
  assert.throws(
    () =>
      composePageFromTemplate({
        template: 'how_to',
        summary: 'A how-to page without steps should fail.',
      }),
    (error: unknown) =>
      error instanceof ValidationError &&
      error.details.rule === 'page-template-how-to-steps-required',
  );
});

test('validatePageAgainstProjectTemplates normalizes custom metadata fields', () => {
  const config = createDefaultProjectConfig({
    authoring: {
      pageTemplates: [
        {
          id: 'adr',
          label: 'ADR',
          baseTemplate: 'reference',
          metadataSchema: {
            fields: [
              {
                id: 'decision-status',
                label: 'Decision Status',
                type: 'enum',
                required: true,
                visibility: 'public',
                options: ['proposed', 'accepted', 'superseded'],
              },
              {
                id: 'author',
                label: 'Author',
                type: 'string',
              },
              {
                id: 'reviewers',
                label: 'Reviewers',
                type: 'string[]',
              },
            ],
          },
        },
      ],
    },
  });

  const page = validatePageAgainstProjectTemplates(
    {
      id: 'adr-001',
      lang: 'en',
      slug: 'architecture/adr-001',
      title: 'Use static search indexes',
      template: 'adr',
      metadata: {
        'decision-status': 'accepted',
        author: ' shawn ',
        reviewers: ['alice', ' bob ', 'alice', ''],
      },
      status: 'draft',
      content: {},
    },
    config,
  );

  assert.equal(page.template, 'adr');
  assert.deepEqual(page.metadata, {
    'decision-status': 'accepted',
    author: 'shawn',
    reviewers: ['alice', 'bob'],
  });
});

test('validatePageAgainstProjectTemplates rejects metadata without a template', () => {
  const config = createDefaultProjectConfig();

  assert.throws(
    () =>
      validatePageAgainstProjectTemplates(
        {
          id: 'guide',
          lang: 'en',
          slug: 'guide',
          title: 'Guide',
          metadata: { author: 'shawn' },
          status: 'draft',
          content: {},
        },
        config,
      ),
    (error: unknown) =>
      error instanceof ValidationError && error.details.rule === 'page-metadata-requires-template',
  );
});

test('validatePageAgainstProjectTemplates rejects unknown template ids', () => {
  const config = createDefaultProjectConfig();

  assert.throws(
    () =>
      validatePageAgainstProjectTemplates(
        {
          id: 'guide',
          lang: 'en',
          slug: 'guide',
          title: 'Guide',
          template: 'unknown-template',
          status: 'draft',
          content: {},
        },
        config,
      ),
    (error: unknown) =>
      error instanceof ValidationError && error.details.rule === 'page-template-must-exist',
  );
});

test('filterPublicPageMetadata returns only public template fields', () => {
  const config = createDefaultProjectConfig({
    authoring: {
      pageTemplates: [
        {
          id: 'adr',
          label: 'ADR',
          baseTemplate: 'reference',
          metadataSchema: {
            fields: [
              {
                id: 'decision-status',
                label: 'Decision Status',
                type: 'enum',
                visibility: 'public',
                options: ['proposed', 'accepted'],
              },
              {
                id: 'author',
                label: 'Author',
                type: 'string',
                visibility: 'internal',
              },
            ],
          },
        },
      ],
    },
  });

  const publicMetadata = filterPublicPageMetadata(
    {
      id: 'adr-001',
      lang: 'en',
      slug: 'architecture/adr-001',
      title: 'Use static search indexes',
      template: 'adr',
      metadata: {
        'decision-status': 'accepted',
        author: 'shawn',
      },
      status: 'published',
      content: {},
    },
    config,
  );

  assert.deepEqual(publicMetadata, {
    'decision-status': 'accepted',
  });
});

test('updatePageFromTemplate rewrites an existing page with generated content and render output', async () => {
  const projectRoot = await createTempProjectRoot();

  try {
    await initializeProject({ repoRoot: projectRoot, languages: ['en'], defaultLanguage: 'en' });
    await createPage({
      projectRoot,
      lang: 'en',
      page: {
        id: 'publish-guide',
        slug: 'publish-guide',
        title: 'Publish Guide',
        content: {
          'block-1': {
            id: 'block-1',
            type: 'Paragraph',
            value: [
              {
                id: 'paragraph-1',
                type: 'paragraph',
                children: [{ text: 'Before template update' }],
                props: { nodeType: 'block' },
              },
            ],
            meta: { order: 0, depth: 0 },
          },
        },
      },
    });

    const result = await updatePageFromTemplate({
      projectRoot,
      lang: 'en',
      pageId: 'publish-guide',
      template: 'how_to',
      patch: { title: 'Updated Publish Guide' },
      summary: 'Use this page to follow the publishing workflow.',
      steps: [
        { title: 'Open the project', body: 'Read the current project contract first.' },
        { title: 'Set page status', body: 'Promote the page after review.', code: 'page_set_status({...})' },
      ],
    });

    assert.equal(result.page.title, 'Updated Publish Guide');
    assert.match(result.page.render?.markdown ?? '', /## Steps/);
    assert.match(result.page.render?.plainText ?? '', /Set page status/);

    const persisted = await loadPage(createDocsRepository(projectRoot), 'en', 'publish-guide');
    assert.match(persisted?.render?.markdown ?? '', /### Open the project/);
    assert.equal(typeof persisted?.content, 'object');
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});
