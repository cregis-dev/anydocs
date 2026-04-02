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
import { writePublishedArtifacts } from '../src/publishing/build-artifacts.ts';

async function createTempRepoRoot(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), 'anydocs-build-preview-'));
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
      (filePath) =>
        filePath.endsWith('.txt') &&
        !filePath.endsWith('llms.txt') &&
        !filePath.endsWith('llms-full.txt') &&
        !filePath.endsWith('robots.txt'),
    );
    assert.deepEqual(leakedTxtFiles, []);

    const rootIndex = await readFile(path.join(result.artifactRoot, 'index.html'), 'utf8');
    const docsPage = await readFile(path.join(result.artifactRoot, 'en', 'welcome', 'index.html'), 'utf8');
    const searchIndex = JSON.parse(
      await readFile(path.join(result.artifactRoot, 'search-index.en.json'), 'utf8'),
    ) as { lang: string; docs: Array<{ slug: string }> };
    const referenceRoot = await readFile(
      path.join(result.artifactRoot, 'en', 'reference', 'index.html'),
      'utf8',
    );
    const sitemap = await readFile(path.join(result.artifactRoot, 'sitemap.xml'), 'utf8');
    const robots = await readFile(path.join(result.artifactRoot, 'robots.txt'), 'utf8');
    const llms = await readFile(path.join(result.artifactRoot, 'llms.txt'), 'utf8');
    const llmsFull = await readFile(path.join(result.artifactRoot, 'llms-full.txt'), 'utf8');
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
    assert.deepEqual(searchIndex.docs.map((entry) => entry.slug), ['welcome']);
    assert.match(llms, /\/en\/welcome/);
    assert.match(llmsFull, /# Docs Full Export/);
    assert.match(llmsFull, /Page ID: welcome/);
    assert.match(llmsFull, /URL: \/en\/welcome/);
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
      /Start exploring your documentation here|Select a document from the sidebar\./,
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

test('runPreviewWorkflow starts a live preview server and reflects published content changes', { timeout: 120_000, concurrency: false }, async () => {
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
    const result = await runPreviewWorkflow({ repoRoot, startTimeoutMs: 60_000 });

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
