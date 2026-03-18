import assert from 'node:assert/strict';
import { access, mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';

import { createDocsRepository, saveNavigation, savePage } from '../src/fs/docs-repository.ts';
import { updateProjectConfig } from '../src/fs/content-repository.ts';
import { initializeProject } from '../src/services/init-service.ts';
import { runBuildWorkflow } from '../src/services/build-service.ts';
import { runPreviewWorkflow } from '../src/services/preview-service.ts';

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

test('runBuildWorkflow emits a deployable docs site at the output root', { timeout: 120_000 }, async () => {
  const repoRoot = await createTempRepoRoot();

  try {
    await initializeProject({ repoRoot, languages: ['en'], defaultLanguage: 'en' });
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
    await assert.rejects(() => access(path.join(result.artifactRoot, 'studio')));
    await assert.rejects(() => access(path.join(result.artifactRoot, 'projects')));
    await assert.rejects(() => access(path.join(result.artifactRoot, 'admin')));
    await assert.rejects(() => access(path.join(result.artifactRoot, '_not-found')));

    const exportedFiles = await listFilesRecursively(result.artifactRoot);
    const leakedTxtFiles = exportedFiles.filter((filePath) => filePath.endsWith('.txt') && !filePath.endsWith('llms.txt'));
    assert.deepEqual(leakedTxtFiles, []);

    const rootIndex = await readFile(path.join(result.artifactRoot, 'index.html'), 'utf8');
    const docsPage = await readFile(path.join(result.artifactRoot, 'en', 'welcome', 'index.html'), 'utf8');
    const searchIndex = JSON.parse(
      await readFile(path.join(result.artifactRoot, 'search-index.en.json'), 'utf8'),
    ) as { lang: string; docs: Array<{ slug: string }> };
    const llms = await readFile(path.join(result.artifactRoot, 'llms.txt'), 'utf8');
    const mcpIndex = JSON.parse(await readFile(path.join(result.machineReadableRoot, 'index.json'), 'utf8')) as {
      version: number;
      site: { theme: { id: string; codeTheme?: string } };
      languages: Array<{ lang: string; files: { searchIndex: string } }>;
    };
    const manifest = JSON.parse(await readFile(path.join(result.artifactRoot, 'build-manifest.json'), 'utf8')) as {
      source: { site: { theme: { id: string; codeTheme?: string } } };
      projects: Array<{ site: { theme: { id: string; codeTheme?: string } }; artifacts: { site: string; searchIndexes: string[] } }>;
    };

    assert.match(rootIndex, /\/en(?!\/docs)/);
    assert.match(docsPage, /Welcome/);
    assert.equal(searchIndex.lang, 'en');
    assert.deepEqual(searchIndex.docs.map((entry) => entry.slug), ['welcome']);
    assert.match(llms, /\/en\/welcome/);
    assert.equal(mcpIndex.version, 1);
    assert.equal(mcpIndex.site.theme.id, 'classic-docs');
    assert.equal(mcpIndex.site.theme.codeTheme, 'github-dark');
    assert.equal(mcpIndex.languages[0]?.files.searchIndex, '../search-index.en.json');
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

test('runBuildWorkflow keeps an empty-state docs shell when there are no published pages', { timeout: 120_000 }, async () => {
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

    assert.match(docsShell, /Select a document from the sidebar\./);
    assert.equal(searchIndex.docs.length, 0);
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
});

test('runBuildWorkflow serializes expanded classic-docs theme metadata into build artifacts', { timeout: 120_000 }, async () => {
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

    const result = await runBuildWorkflow({ repoRoot });
    const mcpIndex = JSON.parse(await readFile(path.join(result.machineReadableRoot, 'index.json'), 'utf8')) as {
      site: {
        theme: {
          branding?: { siteTitle?: string; logoSrc?: string };
          chrome?: { showSearch?: boolean };
          colors?: { primary?: string; sidebarActiveForeground?: string };
          codeTheme?: string;
        };
      };
    };
    const manifest = JSON.parse(await readFile(path.join(result.artifactRoot, 'build-manifest.json'), 'utf8')) as {
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

test('runBuildWorkflow serializes atlas-docs top navigation metadata into build artifacts', { timeout: 120_000 }, async () => {
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

    const result = await runBuildWorkflow({ repoRoot });
    const mcpIndex = JSON.parse(await readFile(path.join(result.machineReadableRoot, 'index.json'), 'utf8')) as {
      site: {
        theme: { id: string };
        navigation?: { topNav?: Array<{ id: string; type: string; groupId?: string; href?: string }> };
      };
    };
    const manifest = JSON.parse(await readFile(path.join(result.artifactRoot, 'build-manifest.json'), 'utf8')) as {
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

test('runPreviewWorkflow starts a live preview server and reflects published content changes', { timeout: 120_000 }, async () => {
  const repoRoot = await createTempRepoRoot();

  try {
    await initializeProject({ repoRoot, languages: ['en'], defaultLanguage: 'en' });
    const repository = createDocsRepository(repoRoot);
    const result = await runPreviewWorkflow({ repoRoot, startTimeoutMs: 60_000 });

    try {
      assert.equal(result.projectId, 'default');
      assert.equal(result.docsPath, '/en/welcome');
      assert.match(result.url, /^http:\/\/127\.0\.0\.1:\d+$/);

      const initialBody = await waitForPreviewText(`${result.url}${result.docsPath}`, 'Welcome');
      assert.match(initialBody, /Welcome/);

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

test('runBuildWorkflow fails fast for an invalid docs project root', async () => {
  const missingRepoRoot = path.join(os.tmpdir(), 'anydocs-build-preview-missing-project');

  await assert.rejects(() => runBuildWorkflow({ repoRoot: missingRepoRoot }), /Missing required project-config-file/);
});

test('runBuildWorkflow rejects artifact roots that overlap source content directories', async () => {
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
