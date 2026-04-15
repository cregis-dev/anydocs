import assert from 'node:assert/strict';
import { access, mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';

import { createDocsRepository, saveNavigation, savePage } from '../src/fs/docs-repository.ts';
import { loadProjectContract } from '../src/fs/content-repository.ts';
import { updateProjectConfig } from '../src/fs/content-repository.ts';
import { initializeProject } from '../src/services/init-service.ts';
import { loadPublishedSiteBuildArtifacts, runBuildWorkflow } from '../src/services/build-service.ts';
import { runPreviewWorkflow } from '../src/services/preview-service.ts';
import { saveProjectImageAsset } from '../src/services/project-asset-service.ts';
import { writePublishedArtifacts } from '../src/publishing/build-artifacts.ts';

async function createTempRepoRoot(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), 'anydocs-build-preview-'));
}

function isListenPermissionError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const nodeError = error as NodeJS.ErrnoException;
  const message = error.message ?? '';
  return (
    nodeError.code === 'EPERM' ||
    nodeError.code === 'EACCES' ||
    /listen EPERM|listen EACCES|operation not permitted 127\.0\.0\.1/.test(message)
  );
}

async function waitForPreviewText(url: string, expectedText: string, timeoutMs = 15_000): Promise<string> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      const body = await response.text();
      if (body.includes(expectedText)) {
        return body;
      }
    } catch {
      // Keep polling until the preview server reflects the change or times out.
    }

    await delay(200);
  }

  throw new Error(`Timed out waiting for preview text "${expectedText}" at ${url}.`);
}

async function listFilesRecursively(rootDir: string): Promise<string[]> {
  const entries = await readdir(rootDir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const entryPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFilesRecursively(entryPath)));
      continue;
    }

    files.push(entryPath);
  }

  return files;
}

async function writeMachineReadableArtifacts(repoRoot: string) {
  const contractResult = await loadProjectContract(repoRoot);
  assert.equal(contractResult.ok, true);

  const siteArtifacts = await loadPublishedSiteBuildArtifacts({ repoRoot });
  await writePublishedArtifacts(contractResult.value, siteArtifacts);

  return {
    contract: contractResult.value,
    siteArtifacts,
  };
}

test('runBuildWorkflow emits a deployable docs site at the output root', { timeout: 120_000, concurrency: false }, async () => {
  const repoRoot = await createTempRepoRoot();

  try {
    await initializeProject({ repoRoot, languages: ['en'], defaultLanguage: 'en' });
    const savedImage = await saveProjectImageAsset(repoRoot, {
      bytes: Buffer.from('fake-png-bytes'),
      filename: 'hero-image.png',
      mimeType: 'image/png',
    });
    const update = await updateProjectConfig(repoRoot, {
      site: {
        url: 'https://docs.example.com',
      },
    });
    assert.equal(update.ok, true);
    const result = await runBuildWorkflow({ repoRoot });

    assert.equal(result.projectId, 'default');
    assert.equal(result.artifactRoot, path.join(repoRoot, 'dist'));
    assert.equal(result.entryHtmlFile, path.join(repoRoot, 'dist', 'index.html'));
    assert.equal(result.defaultDocsPath, '/en/welcome');

    await access(path.join(result.artifactRoot, 'index.html'));
    await access(path.join(result.artifactRoot, savedImage.src.slice(1)));
    await access(path.join(result.artifactRoot, 'docs', 'index.html'));
    await access(path.join(result.artifactRoot, 'en', 'index.html'));
    await access(path.join(result.artifactRoot, 'en', 'welcome', 'index.html'));
    await access(path.join(result.artifactRoot, 'en', 'docs', 'index.html'));
    await access(path.join(result.artifactRoot, 'en', 'docs', 'welcome', 'index.html'));
    await access(path.join(result.artifactRoot, 'en', 'reference', 'index.html'));
    await access(path.join(result.artifactRoot, 'sitemap.xml'));
    await access(path.join(result.artifactRoot, 'robots.txt'));
    await assert.rejects(() => access(path.join(result.artifactRoot, 'studio')));
    await assert.rejects(() => access(path.join(result.artifactRoot, 'projects')));
    await assert.rejects(() => access(path.join(result.artifactRoot, 'admin')));
    await assert.rejects(() => access(path.join(result.artifactRoot, '_not-found')));

    const exportedFiles = await listFilesRecursively(result.artifactRoot);
    const leakedTxtFiles = exportedFiles.filter(
      (filePath) => {
        if (!filePath.endsWith('.txt')) {
          return false;
        }

        const fileName = path.basename(filePath);
        if (fileName.startsWith('__next.')) {
          return false;
        }

        return (
          !filePath.endsWith('llms.txt') &&
          !filePath.endsWith('llms-full.txt') &&
          !filePath.endsWith('robots.txt')
        );
      },
    );
    assert.deepEqual(leakedTxtFiles, []);

    const rootIndex = await readFile(path.join(result.artifactRoot, 'index.html'), 'utf8');
    const docsPage = await readFile(path.join(result.artifactRoot, 'en', 'welcome', 'index.html'), 'utf8');
    const searchIndex = JSON.parse(
      await readFile(path.join(result.artifactRoot, 'search-index.en.json'), 'utf8'),
    ) as {
      lang: string;
      docs: Array<{ pageSlug: string; pageTitle: string; sectionTitle: string; href: string }>;
    };
    const referenceRoot = await readFile(
      path.join(result.artifactRoot, 'en', 'reference', 'index.html'),
      'utf8',
    );
    const sitemap = await readFile(path.join(result.artifactRoot, 'sitemap.xml'), 'utf8');
    const robots = await readFile(path.join(result.artifactRoot, 'robots.txt'), 'utf8');
    const llms = await readFile(path.join(result.artifactRoot, 'llms.txt'), 'utf8');
    const llmsFull = await readFile(path.join(result.artifactRoot, 'llms-full.txt'), 'utf8');
    const exportedImage = await readFile(path.join(result.artifactRoot, savedImage.src.slice(1)));
    const chunks = JSON.parse(
      await readFile(path.join(result.machineReadableRoot, 'chunks.en.json'), 'utf8'),
    ) as {
      lang: string;
      chunking: { strategy: string; maxChars: number; overlapChars: number };
      chunks: Array<{ pageId: string; href: string; text: string; order: number }>;
    };
    const mcpIndex = JSON.parse(await readFile(path.join(result.machineReadableRoot, 'index.json'), 'utf8')) as {
      version: number;
      site: { theme: { id: string; codeTheme?: string } };
      languages: Array<{ lang: string; files: { searchIndex: string; chunks: string } }>;
    };
    const manifest = JSON.parse(await readFile(path.join(result.artifactRoot, 'build-manifest.json'), 'utf8')) as {
      source: { site: { theme: { id: string; codeTheme?: string } } };
      projects: Array<{ site: { theme: { id: string; codeTheme?: string } }; artifacts: { site: string; searchIndexes: string[] } }>;
    };

    assert.match(rootIndex, /\/en(?!\/docs)/);
    assert.match(docsPage, /Welcome/);
    assert.match(docsPage, /<html[^>]+lang="en"/);
    assert.match(referenceRoot, /404/);
    assert.doesNotMatch(referenceRoot, /Published API Sources/);
    assert.match(sitemap, /https:\/\/docs\.example\.com\/en/);
    assert.match(sitemap, /https:\/\/docs\.example\.com\/en\/welcome/);
    assert.match(robots, /Sitemap: https:\/\/docs\.example\.com\/sitemap\.xml/);
    assert.equal(searchIndex.lang, 'en');
    assert.ok(searchIndex.docs.length >= 1);
    assert.equal(searchIndex.docs[0]?.pageSlug, 'welcome');
    assert.equal(searchIndex.docs[0]?.pageTitle, 'Welcome');
    assert.ok('sectionTitle' in (searchIndex.docs[0] ?? {}));
    assert.ok('href' in (searchIndex.docs[0] ?? {}));
    assert.match(llms, /\/en\/welcome/);
    assert.match(llmsFull, /# Docs Full Export/);
    assert.match(llmsFull, /Page ID: welcome/);
    assert.match(llmsFull, /URL: \/en\/welcome/);
    assert.equal(exportedImage.toString('utf8'), 'fake-png-bytes');
    assert.equal(chunks.lang, 'en');
    assert.equal(chunks.chunking.strategy, 'heading-aware');
    assert.equal(chunks.chunks[0]?.pageId, 'welcome');
    assert.equal(chunks.chunks[0]?.href, '/en/welcome');
    assert.ok((chunks.chunks[0]?.text ?? '').length > 0);
    assert.equal(chunks.chunks[0]?.order, 1);
    assert.equal(mcpIndex.version, 1);
    assert.equal(mcpIndex.site.theme.id, 'classic-docs');
    assert.equal(mcpIndex.site.theme.codeTheme, 'github-dark');
    assert.equal(mcpIndex.languages[0]?.files.searchIndex, '../search-index.en.json');
    assert.equal(mcpIndex.languages[0]?.files.chunks, 'chunks.en.json');
    assert.equal(manifest.source.site.theme.id, 'classic-docs');
    assert.equal(manifest.source.site.theme.codeTheme, 'github-dark');
    assert.equal(manifest.projects[0]?.site.theme.id, 'classic-docs');
    assert.equal(manifest.projects[0]?.site.theme.codeTheme, 'github-dark');
    assert.equal(manifest.projects[0]?.artifacts.site, '.');
    assert.deepEqual(manifest.projects[0]?.artifacts.searchIndexes, ['search-index.en.json']);
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
});

test('runBuildWorkflow dryRun returns planned artifacts without creating files', async () => {
  const repoRoot = await createTempRepoRoot();

  try {
    await initializeProject({ repoRoot, languages: ['en'], defaultLanguage: 'en' });
    const result = await runBuildWorkflow({ repoRoot, dryRun: true });

    assert.equal(result.dryRun, true);
    assert.ok(result.artifacts.some((artifact) => artifact.id === 'machineReadableIndex'));
    await assert.rejects(() => access(path.join(repoRoot, 'dist', 'index.html')));
    await assert.rejects(() => access(path.join(repoRoot, 'dist', 'mcp', 'index.json')));
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
});

test('published artifacts emit a fallback chunk for published pages without headings', async () => {
  const repoRoot = await createTempRepoRoot();

  try {
    await initializeProject({ repoRoot, languages: ['en'], defaultLanguage: 'en' });
    const repository = createDocsRepository(repoRoot);
    await savePage(repository, 'en', {
      id: 'welcome',
      lang: 'en',
      slug: 'welcome',
      title: 'Welcome',
      status: 'published',
      content: {},
      render: {
        plainText: 'Body content without headings for chunk fallback.',
      },
    });

    const { contract } = await writeMachineReadableArtifacts(repoRoot);
    const chunks = JSON.parse(
      await readFile(path.join(contract.paths.machineReadableRoot, 'chunks.en.json'), 'utf8'),
    ) as {
      chunks: Array<{ id: string; pageId: string; headingPath: string[]; text: string; order: number }>;
    };

    assert.equal(chunks.chunks.length, 1);
    assert.equal(chunks.chunks[0]?.id, 'welcome#0001');
    assert.equal(chunks.chunks[0]?.pageId, 'welcome');
    assert.deepEqual(chunks.chunks[0]?.headingPath, []);
    assert.equal(chunks.chunks[0]?.order, 1);
    assert.equal(chunks.chunks[0]?.text, 'Body content without headings for chunk fallback.');
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
});

test('published search index emits section-level records with stable anchors and page-level fallback hrefs', async () => {
  const repoRoot = await createTempRepoRoot();

  try {
    await initializeProject({ repoRoot, languages: ['en'], defaultLanguage: 'en' });
    const repository = createDocsRepository(repoRoot);

    await savePage(repository, 'en', {
      id: 'guide',
      lang: 'en',
      slug: 'guide',
      title: 'Guide',
      status: 'published',
      content: {},
      render: {
        markdown: `# Guide

## Overview
Search starts here.

### Details
Drill into details.

### Details
Repeated heading should still get a stable anchor.
`,
        plainText:
          'Guide Overview Search starts here. Details Drill into details. Details Repeated heading should still get a stable anchor.',
      },
    });

    await savePage(repository, 'en', {
      id: 'faq',
      lang: 'en',
      slug: 'faq',
      title: 'FAQ',
      status: 'published',
      content: {},
      render: {
        plainText: 'Frequently asked questions without explicit headings.',
      },
    });

    await savePage(repository, 'en', {
      id: 'draft-page',
      lang: 'en',
      slug: 'draft-page',
      title: 'Draft',
      status: 'draft',
      content: {},
      render: {
        plainText: 'This content must stay out of published search.',
      },
    });

    const { contract } = await writeMachineReadableArtifacts(repoRoot);
    const searchIndex = JSON.parse(
      await readFile(path.join(contract.paths.artifactRoot, 'search-index.en.json'), 'utf8'),
    ) as {
      docs: Array<{
        pageId: string;
        pageSlug: string;
        pageTitle: string;
        sectionTitle: string;
        href: string;
        text: string;
        breadcrumbs: string[];
      }>;
    };

    const guideResults = searchIndex.docs.filter((entry) => entry.pageId === 'guide');
    const faqResult = searchIndex.docs.find((entry) => entry.pageId === 'faq');

    assert.ok(guideResults.length >= 3);
    assert.deepEqual(
      guideResults.map((entry) => entry.sectionTitle),
      ['Overview', 'Details', 'Details'],
    );
    assert.deepEqual(
      guideResults.map((entry) => entry.href),
      ['/en/guide#overview', '/en/guide#details', '/en/guide#details-2'],
    );
    assert.match(guideResults[1]?.text ?? '', /Drill into details/);
    assert.equal(faqResult?.href, '/en/faq');
    assert.equal(faqResult?.sectionTitle, '');
    assert.equal(searchIndex.docs.some((entry) => entry.pageId === 'draft-page'), false);
    assert.equal(
      searchIndex.docs.every(
        (entry) =>
          typeof entry.pageId === 'string' &&
          typeof entry.pageSlug === 'string' &&
          typeof entry.pageTitle === 'string' &&
          typeof entry.sectionTitle === 'string' &&
          Array.isArray(entry.breadcrumbs) &&
          typeof entry.href === 'string' &&
          typeof entry.text === 'string',
      ),
      true,
    );
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
});

test('published search index normalizes formatted markdown headings to reader-stable anchors', async () => {
  const repoRoot = await createTempRepoRoot();

  try {
    await initializeProject({ repoRoot, languages: ['en'], defaultLanguage: 'en' });
    const repository = createDocsRepository(repoRoot);

    await savePage(repository, 'en', {
      id: 'formatted-guide',
      lang: 'en',
      slug: 'formatted-guide',
      title: 'Formatted Guide',
      status: 'published',
      content: {},
      render: {
        markdown: `# Formatted Guide

## **Overview**
Overview body.

### [API](/reference/api)
API details.
`,
        plainText: 'Formatted Guide Overview Overview body. API API details.',
      },
    });

    const { contract } = await writeMachineReadableArtifacts(repoRoot);
    const searchIndex = JSON.parse(
      await readFile(path.join(contract.paths.artifactRoot, 'search-index.en.json'), 'utf8'),
    ) as {
      docs: Array<{ pageId: string; sectionTitle: string; href: string }>;
    };

    const results = searchIndex.docs.filter((entry) => entry.pageId === 'formatted-guide');

    assert.deepEqual(
      results.map((entry) => entry.sectionTitle),
      ['Overview', 'API'],
    );
    assert.deepEqual(
      results.map((entry) => entry.href),
      ['/en/formatted-guide#overview', '/en/formatted-guide#api'],
    );
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
});

test('published search index ignores heading-like lines inside fenced code blocks', async () => {
  const repoRoot = await createTempRepoRoot();

  try {
    await initializeProject({ repoRoot, languages: ['en'], defaultLanguage: 'en' });
    const repository = createDocsRepository(repoRoot);

    await savePage(repository, 'en', {
      id: 'code-guide',
      lang: 'en',
      slug: 'code-guide',
      title: 'Code Guide',
      status: 'published',
      content: {},
      render: {
        markdown: `# Code Guide

## Setup
Use this command:

\`\`\`bash
# install
echo "ready"
\`\`\`

## Next
Continue here.
`,
        plainText: 'Code Guide Setup Use this command install ready Next Continue here.',
      },
    });

    const { contract } = await writeMachineReadableArtifacts(repoRoot);
    const searchIndex = JSON.parse(
      await readFile(path.join(contract.paths.artifactRoot, 'search-index.en.json'), 'utf8'),
    ) as {
      docs: Array<{ pageId: string; sectionTitle: string; href: string; text: string }>;
    };

    const results = searchIndex.docs.filter((entry) => entry.pageId === 'code-guide');

    assert.deepEqual(
      results.map((entry) => entry.sectionTitle),
      ['Setup', 'Next'],
    );
    assert.deepEqual(
      results.map((entry) => entry.href),
      ['/en/code-guide#setup', '/en/code-guide#next'],
    );
    assert.equal(results.some((entry) => entry.sectionTitle === 'install'), false);
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
});

test('published artifacts preserve inline code text in chunk content', async () => {
  const repoRoot = await createTempRepoRoot();

  try {
    await initializeProject({ repoRoot, languages: ['en'], defaultLanguage: 'en' });
    const repository = createDocsRepository(repoRoot);
    await savePage(repository, 'en', {
      id: 'welcome',
      lang: 'en',
      slug: 'welcome',
      title: 'Welcome',
      status: 'published',
      content: {},
      render: {
        markdown: '# Welcome\n\nCall `project_open` before `page_update`.',
      },
    });

    const { contract } = await writeMachineReadableArtifacts(repoRoot);
    const chunks = JSON.parse(
      await readFile(path.join(contract.paths.machineReadableRoot, 'chunks.en.json'), 'utf8'),
    ) as {
      chunks: Array<{ text: string }>;
    };

    assert.match(chunks.chunks[0]?.text ?? '', /project_open/);
    assert.match(chunks.chunks[0]?.text ?? '', /page_update/);
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
});

test('published artifacts derive text from canonical content when render is omitted', async () => {
  const repoRoot = await createTempRepoRoot();

  try {
    await initializeProject({ repoRoot, languages: ['en'], defaultLanguage: 'en' });
    const repository = createDocsRepository(repoRoot);
    await savePage(repository, 'en', {
      id: 'welcome',
      lang: 'en',
      slug: 'welcome',
      title: 'Welcome',
      status: 'published',
      content: {
        version: 1,
        blocks: [
          {
            type: 'heading',
            level: 1,
            children: [{ type: 'text', text: 'Welcome' }],
          },
          {
            type: 'paragraph',
            children: [
              { type: 'text', text: 'Canonical content drives search text and machine-readable exports.' },
            ],
          },
          {
            type: 'codeBlock',
            language: 'bash',
            code: 'pnpm install',
          },
        ],
      },
    });

    const { contract } = await writeMachineReadableArtifacts(repoRoot);
    const searchIndex = JSON.parse(
      await readFile(path.join(contract.paths.artifactRoot, 'search-index.en.json'), 'utf8'),
    ) as { docs: Array<{ pageSlug: string; text: string }> };
    const chunks = JSON.parse(
      await readFile(path.join(contract.paths.machineReadableRoot, 'chunks.en.json'), 'utf8'),
    ) as {
      chunks: Array<{ text: string }>;
    };
    const llmsFull = await readFile(path.join(contract.paths.artifactRoot, 'llms-full.txt'), 'utf8');

    assert.equal(searchIndex.docs[0]?.pageSlug, 'welcome');
    assert.match(searchIndex.docs[0]?.text ?? '', /Canonical content drives search text/);
    assert.match(chunks.chunks[0]?.text ?? '', /Canonical content drives search text/);
    assert.match(llmsFull, /Canonical content drives search text/);
    assert.match(llmsFull, /pnpm install/);
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
});

test('published pages artifacts serialize template and only public metadata', async () => {
  const repoRoot = await createTempRepoRoot();

  try {
    await initializeProject({ repoRoot, languages: ['en'], defaultLanguage: 'en' });
    const update = await updateProjectConfig(repoRoot, {
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
    assert.equal(update.ok, true);

    const repository = createDocsRepository(repoRoot);
    await savePage(repository, 'en', {
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
      render: {
        plainText: 'Decision record body.',
      },
    });

    const { contract } = await writeMachineReadableArtifacts(repoRoot);
    const pagesArtifact = JSON.parse(
      await readFile(path.join(contract.paths.machineReadableRoot, 'pages.en.json'), 'utf8'),
    ) as {
      pages: Array<{
        id: string;
        template?: string;
        metadata?: Record<string, unknown>;
      }>;
    };
    const searchIndex = JSON.parse(
      await readFile(path.join(contract.paths.artifactRoot, 'search-index.en.json'), 'utf8'),
    ) as { docs: Array<Record<string, unknown>> };
    const llmsFull = await readFile(path.join(contract.paths.artifactRoot, 'llms-full.txt'), 'utf8');
    const adrPage = pagesArtifact.pages.find((page) => page.id === 'adr-001');

    assert.equal(adrPage?.id, 'adr-001');
    assert.equal(adrPage?.template, 'adr');
    assert.deepEqual(adrPage?.metadata, {
      'decision-status': 'accepted',
    });
    assert.equal(searchIndex.docs.every((doc) => !('metadata' in doc)), true);
    assert.doesNotMatch(llmsFull, /shawn/);
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
});

test('runBuildWorkflow keeps an empty-state docs shell when there are no published pages', { timeout: 120_000, concurrency: false }, async () => {
  const repoRoot = await createTempRepoRoot();

  try {
    await initializeProject({ repoRoot, languages: ['en'], defaultLanguage: 'en' });
    const repository = createDocsRepository(repoRoot);
    await savePage(repository, 'en', {
      id: 'welcome',
      lang: 'en',
      slug: 'welcome',
      title: 'Welcome',
      status: 'draft',
      content: {},
      render: {
        markdown: '# Welcome',
        plainText: 'Welcome',
      },
    });

    const result = await runBuildWorkflow({ repoRoot });
    const docsShell = await readFile(path.join(result.artifactRoot, 'en', 'index.html'), 'utf8');
    const searchIndex = JSON.parse(
      await readFile(path.join(result.artifactRoot, 'search-index.en.json'), 'utf8'),
    ) as { docs: unknown[] };

    assert.match(
      docsShell,
      /Start exploring your documentation here|Select a document from the sidebar\.|Start with the pages that define the structure|Continue with the sidebar after opening a page\./,
    );
    assert.equal(searchIndex.docs.length, 0);
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
});

test('published artifacts serialize expanded classic-docs theme metadata', async () => {
  const repoRoot = await createTempRepoRoot();

  try {
    await initializeProject({ repoRoot, languages: ['en'], defaultLanguage: 'en' });
    const update = await updateProjectConfig(repoRoot, {
      site: {
        theme: {
          id: 'classic-docs',
          branding: {
            siteTitle: 'Console Docs',
            homeLabel: 'Console Home',
            logoSrc: '/console.svg',
            logoAlt: 'Console logo',
          },
          chrome: {
            showSearch: false,
          },
          colors: {
            primary: '#161616',
            primaryForeground: '#fdfdfd',
            accent: '#f3f0ea',
            accentForeground: '#151515',
            sidebarActive: '#202020',
            sidebarActiveForeground: '#ffffff',
          },
          codeTheme: 'github-light',
        },
      },
    });
    assert.equal(update.ok, true);

    const { contract } = await writeMachineReadableArtifacts(repoRoot);
    const mcpIndex = JSON.parse(await readFile(path.join(contract.paths.machineReadableRoot, 'index.json'), 'utf8')) as {
      site: {
        theme: {
          branding?: { siteTitle?: string; logoSrc?: string };
          chrome?: { showSearch?: boolean };
          colors?: { primary?: string; sidebarActiveForeground?: string };
          codeTheme?: string;
        };
      };
    };
    const manifest = JSON.parse(await readFile(path.join(contract.paths.artifactRoot, 'build-manifest.json'), 'utf8')) as {
      source: {
        site: {
          theme: {
            branding?: { homeLabel?: string; logoAlt?: string };
            chrome?: { showSearch?: boolean };
            colors?: { accent?: string; primaryForeground?: string };
            codeTheme?: string;
          };
        };
      };
      projects: Array<{
        site: {
          theme: {
            colors?: { sidebarActive?: string };
          };
        };
      }>;
    };

    assert.equal(mcpIndex.site.theme.branding?.siteTitle, 'Console Docs');
    assert.equal(mcpIndex.site.theme.branding?.logoSrc, '/console.svg');
    assert.equal(mcpIndex.site.theme.chrome?.showSearch, false);
    assert.equal(mcpIndex.site.theme.colors?.primary, '#161616');
    assert.equal(mcpIndex.site.theme.colors?.sidebarActiveForeground, '#ffffff');
    assert.equal(mcpIndex.site.theme.codeTheme, 'github-light');

    assert.equal(manifest.source.site.theme.branding?.homeLabel, 'Console Home');
    assert.equal(manifest.source.site.theme.branding?.logoAlt, 'Console logo');
    assert.equal(manifest.source.site.theme.chrome?.showSearch, false);
    assert.equal(manifest.source.site.theme.colors?.accent, '#f3f0ea');
    assert.equal(manifest.source.site.theme.colors?.primaryForeground, '#fdfdfd');
    assert.equal(manifest.source.site.theme.codeTheme, 'github-light');
    assert.equal(manifest.projects[0]?.site.theme.colors?.sidebarActive, '#202020');
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
});

test('published artifacts serialize atlas-docs top navigation metadata', async () => {
  const repoRoot = await createTempRepoRoot();

  try {
    await initializeProject({ repoRoot, languages: ['en', 'zh'], defaultLanguage: 'en' });
    const repository = createDocsRepository(repoRoot);
    await saveNavigation(repository, 'en', {
      version: 2,
      items: [
        {
          type: 'section',
          id: 'guides',
          title: 'Guides',
          children: [{ type: 'page', pageId: 'welcome' }],
        },
      ],
    });
    await saveNavigation(repository, 'zh', {
      version: 2,
      items: [
        {
          type: 'section',
          id: 'guides',
          title: '指南',
          children: [{ type: 'page', pageId: 'welcome' }],
        },
      ],
    });
    await updateProjectConfig(repoRoot, {
      site: {
        theme: {
          id: 'atlas-docs',
          branding: {
            siteTitle: 'Atlas Docs',
          },
        },
        navigation: {
          topNav: [
            {
              id: 'guides',
              type: 'nav-group',
              groupId: 'guides',
              label: {
                zh: '指南',
                en: 'Guides',
              },
            },
            {
              id: 'github',
              type: 'external',
              href: 'https://github.com/anydocs/anydocs',
              openInNewTab: true,
              label: {
                zh: 'GitHub',
                en: 'GitHub',
              },
            },
          ],
        },
      },
    });

    const { contract } = await writeMachineReadableArtifacts(repoRoot);
    const mcpIndex = JSON.parse(await readFile(path.join(contract.paths.machineReadableRoot, 'index.json'), 'utf8')) as {
      site: {
        theme: { id: string };
        navigation?: { topNav?: Array<{ id: string; type: string; groupId?: string; href?: string }> };
      };
    };
    const manifest = JSON.parse(await readFile(path.join(contract.paths.artifactRoot, 'build-manifest.json'), 'utf8')) as {
      source: {
        site: {
          theme: { id: string };
          navigation?: { topNav?: Array<{ id: string; type: string; groupId?: string; href?: string }> };
        };
      };
    };

    assert.equal(mcpIndex.site.theme.id, 'atlas-docs');
    assert.equal(mcpIndex.site.navigation?.topNav?.[0]?.id, 'guides');
    assert.equal(mcpIndex.site.navigation?.topNav?.[0]?.groupId, 'guides');
    assert.equal(mcpIndex.site.navigation?.topNav?.[1]?.href, 'https://github.com/anydocs/anydocs');
    assert.equal(manifest.source.site.theme.id, 'atlas-docs');
    assert.equal(manifest.source.site.navigation?.topNav?.[0]?.type, 'nav-group');
    assert.equal(manifest.source.site.navigation?.topNav?.[1]?.type, 'external');
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
});

test('runPreviewWorkflow starts a live preview server and reflects published content changes', { timeout: 120_000, concurrency: false }, async (t) => {
  const repoRoot = await createTempRepoRoot();

  try {
    await initializeProject({ repoRoot, languages: ['en'], defaultLanguage: 'en' });
    const update = await updateProjectConfig(repoRoot, {
      site: {
        url: 'https://docs.example.com',
      },
    });
    assert.equal(update.ok, true);
    const repository = createDocsRepository(repoRoot);
    let result: Awaited<ReturnType<typeof runPreviewWorkflow>>;
    try {
      result = await runPreviewWorkflow({ repoRoot, startTimeoutMs: 60_000 });
    } catch (error) {
      if (isListenPermissionError(error)) {
        t.skip(`Skipping preview workflow test in restricted runtime: ${String((error as Error).message)}`);
        return;
      }

      throw error;
    }

    try {
      assert.equal(result.projectId, 'default');
      assert.equal(result.docsPath, '/en/welcome');
      assert.match(result.url, /^http:\/\/127\.0\.0\.1:\d+$/);

      const initialBody = await waitForPreviewText(`${result.url}${result.docsPath}`, 'Welcome');
      assert.match(initialBody, /Welcome/);
      assert.match(initialBody, /<html[^>]+lang="en"/);
      assert.match(initialBody, /noindex/);

      await savePage(repository, 'en', {
        id: 'welcome',
        lang: 'en',
        slug: 'welcome',
        title: 'Live Preview Updated',
        status: 'published',
        content: {},
        render: {
          markdown: '# Live Preview Updated',
          plainText: 'Live Preview Updated',
        },
      });

      const updatedBody = await waitForPreviewText(`${result.url}${result.docsPath}`, 'Live Preview Updated', 20_000);
      assert.match(updatedBody, /Live Preview Updated/);
    } finally {
      await result.stop();
    }
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
});

test('runBuildWorkflow fails fast for an invalid docs project root', { concurrency: false }, async () => {
  const missingRepoRoot = path.join(os.tmpdir(), 'anydocs-build-preview-missing-project');

  await assert.rejects(() => runBuildWorkflow({ repoRoot: missingRepoRoot }), /Missing required project-config-file/);
});

test('runBuildWorkflow rejects artifact roots that overlap source content directories', { concurrency: false }, async () => {
  const repoRoot = await createTempRepoRoot();

  try {
    await initializeProject({ repoRoot, languages: ['en'], defaultLanguage: 'en' });

    await assert.rejects(
      () => runBuildWorkflow({ repoRoot, outputDir: 'pages/generated-site' }),
      /overlaps source content/,
    );
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
});
