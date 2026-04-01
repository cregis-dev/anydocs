import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ANYDOCS_CONFIG_FILE,
  ANYDOCS_WORKFLOW_FILE,
  createDefaultProjectConfig,
} from '../src/config/project-config.ts';
import { loadProjectContract } from '../src/fs/content-repository.ts';
import { updateProjectConfig } from '../src/fs/content-repository.ts';
import { createWorkflowStandardDefinition } from '../src/services/workflow-standard-service.ts';
import { createProjectPathContract } from '../src/fs/project-paths.ts';

async function createTempRepoRoot(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), 'anydocs-core-'));
}

async function writeValidContract(repoRoot: string) {
  const config = createDefaultProjectConfig({
    languages: ['en', 'zh'],
    defaultLanguage: 'en',
    name: 'Test Project',
  });
  const projectRoot = repoRoot;
  const paths = createProjectPathContract(repoRoot, config);
  await mkdir(path.join(projectRoot, 'pages', 'en'), { recursive: true });
  await mkdir(path.join(projectRoot, 'pages', 'zh'), { recursive: true });
  await mkdir(path.join(projectRoot, 'navigation'), { recursive: true });
  await writeFile(
    path.join(projectRoot, ANYDOCS_CONFIG_FILE),
    `${JSON.stringify(config, null, 2)}\n`,
    'utf8',
  );
  await writeFile(
    path.join(projectRoot, ANYDOCS_WORKFLOW_FILE),
    `${JSON.stringify(createWorkflowStandardDefinition({ config, paths }), null, 2)}\n`,
    'utf8',
  );
  await writeFile(
    path.join(projectRoot, 'navigation', 'en.json'),
    `${JSON.stringify({ version: 1, items: [] }, null, 2)}\n`,
    'utf8',
  );
  await writeFile(
    path.join(projectRoot, 'navigation', 'zh.json'),
    `${JSON.stringify({ version: 1, items: [] }, null, 2)}\n`,
    'utf8',
  );
}

test('loadProjectContract returns canonical config and paths for a valid project', async () => {
  const repoRoot = await createTempRepoRoot();
  await writeValidContract(repoRoot);

  try {
    const result = await loadProjectContract(repoRoot);
    assert.equal(result.ok, true);

    if (!result.ok) {
      return;
    }

    assert.equal(result.value.config.projectId, 'default');
    assert.equal(result.value.paths.projectRoot, repoRoot);
    assert.equal(result.value.paths.configFile, path.join(repoRoot, ANYDOCS_CONFIG_FILE));
    assert.equal(
      result.value.paths.languageRoots.en.pagesDir,
      path.join(repoRoot, 'pages', 'en'),
    );
    assert.equal(result.value.paths.artifactRoot, path.join(repoRoot, 'dist'));
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
});

test('loadProjectContract fails with a structured error when config is missing', async () => {
  const repoRoot = await createTempRepoRoot();

  try {
    const result = await loadProjectContract(repoRoot);
    assert.equal(result.ok, false);

    if (result.ok) {
      return;
    }

    assert.equal(result.error.code, 'VALIDATION_ERROR');
    assert.equal(result.error.details.entity, 'project-config-file');
    assert.equal(result.error.details.rule, 'required-path-exists');
    assert.match(result.error.details.remediation ?? '', /anydocs\.config\.json/);
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
});

test('loadProjectContract fails with a structured error when config JSON is malformed', async () => {
  const repoRoot = await createTempRepoRoot();
  const projectRoot = repoRoot;

  try {
    await mkdir(projectRoot, { recursive: true });
    await writeFile(path.join(projectRoot, ANYDOCS_CONFIG_FILE), '{ invalid json\n', 'utf8');

    const result = await loadProjectContract(repoRoot);
    assert.equal(result.ok, false);

    if (result.ok) {
      return;
    }

    assert.equal(result.error.code, 'VALIDATION_ERROR');
    assert.equal(result.error.details.entity, 'project-config-file');
    assert.equal(result.error.details.rule, 'project-config-json-valid');
    assert.match(result.error.details.remediation ?? '', /valid JSON/);
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
});

test('loadProjectContract fails when the project config omits the required docs theme', async () => {
  const repoRoot = await createTempRepoRoot();

  try {
    await mkdir(path.join(repoRoot, 'pages', 'en'), { recursive: true });
    await mkdir(path.join(repoRoot, 'navigation'), { recursive: true });
    await writeFile(
      path.join(repoRoot, ANYDOCS_CONFIG_FILE),
      `${JSON.stringify({
        version: 1,
        projectId: 'default',
        name: 'Theme Missing',
        defaultLanguage: 'en',
        languages: ['en'],
      }, null, 2)}\n`,
      'utf8',
    );

    const result = await loadProjectContract(repoRoot);
    assert.equal(result.ok, false);

    if (result.ok) {
      return;
    }

    assert.equal(result.error.code, 'VALIDATION_ERROR');
    assert.equal(result.error.details.entity, 'project-config');
    assert.equal(result.error.details.rule, 'site-required');
    assert.match(result.error.details.remediation ?? '', /site/);
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
});

test('loadProjectContract fails when a required language navigation file is missing', async () => {
  const repoRoot = await createTempRepoRoot();
  await writeValidContract(repoRoot);

  try {
    await rm(
      path.join(repoRoot, 'navigation', 'zh.json'),
      { force: true },
    );

    const result = await loadProjectContract(repoRoot);
    assert.equal(result.ok, false);

    if (result.ok) {
      return;
    }

    assert.equal(result.error.code, 'VALIDATION_ERROR');
    assert.equal(result.error.details.entity, 'navigation-language-file');
    assert.equal(result.error.details.rule, 'required-path-exists');
    assert.match(result.error.details.remediation ?? '', /navigation\/zh\.json/);
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
});

test('loadProjectContract rejects top navigation group references missing from an enabled language', async () => {
  const repoRoot = await createTempRepoRoot();
  await writeValidContract(repoRoot);

  try {
    const rawConfig = JSON.parse(await readFile(path.join(repoRoot, ANYDOCS_CONFIG_FILE), 'utf8')) as Record<string, unknown>;
    rawConfig.site = {
      ...(rawConfig.site as Record<string, unknown>),
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
        ],
      },
    };
    await writeFile(path.join(repoRoot, ANYDOCS_CONFIG_FILE), `${JSON.stringify(rawConfig, null, 2)}\n`, 'utf8');
    await writeFile(
      path.join(repoRoot, 'navigation', 'en.json'),
      `${JSON.stringify(
        {
          version: 2,
          items: [
            {
              type: 'section',
              id: 'guides',
              title: 'Guides',
              children: [],
            },
          ],
        },
        null,
        2,
      )}\n`,
      'utf8',
    );
    await writeFile(
      path.join(repoRoot, 'navigation', 'zh.json'),
      `${JSON.stringify(
        {
          version: 2,
          items: [
            {
              type: 'section',
              id: 'api',
              title: '接口',
              children: [],
            },
          ],
        },
        null,
        2,
      )}\n`,
      'utf8',
    );

    const result = await loadProjectContract(repoRoot);
    assert.equal(result.ok, false);

    if (result.ok) {
      return;
    }

    assert.equal(result.error.details.rule, 'site-navigation-top-nav-group-exists');
    assert.equal(result.error.details.metadata?.lang, 'zh');
    assert.equal(result.error.details.metadata?.groupId, 'guides');
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
});

test('loadProjectContract fails when workflow standard file is missing', async () => {
  const repoRoot = await createTempRepoRoot();
  await writeValidContract(repoRoot);

  try {
    await rm(
      path.join(repoRoot, ANYDOCS_WORKFLOW_FILE),
      { force: true },
    );

    const result = await loadProjectContract(repoRoot);
    assert.equal(result.ok, false);

    if (result.ok) {
      return;
    }

    assert.equal(result.error.code, 'VALIDATION_ERROR');
    assert.equal(result.error.details.entity, 'workflow-standard-file');
    assert.equal(result.error.details.rule, 'required-path-exists');
    assert.match(result.error.details.remediation ?? '', /anydocs\.workflow\.json/);
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
});

test('loadProjectContract fails when workflow standard file is malformed', async () => {
  const repoRoot = await createTempRepoRoot();
  await writeValidContract(repoRoot);

  try {
    await writeFile(
      path.join(repoRoot, ANYDOCS_WORKFLOW_FILE),
      '{ invalid workflow json\n',
      'utf8',
    );

    const result = await loadProjectContract(repoRoot);
    assert.equal(result.ok, false);

    if (result.ok) {
      return;
    }

    assert.equal(result.error.code, 'VALIDATION_ERROR');
    assert.equal(result.error.details.entity, 'workflow-standard');
    assert.equal(result.error.details.rule, 'workflow-standard-json-valid');
    assert.match(result.error.details.remediation ?? '', /valid JSON/);
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
});

test('loadProjectContract rejects configs whose projectId does not match the requested project root', async () => {
  const repoRoot = await createTempRepoRoot();
  const config = createDefaultProjectConfig({
    projectId: 'other-project',
    languages: ['en'],
  });
  const paths = createProjectPathContract(repoRoot, config);

  try {
    await mkdir(path.join(repoRoot, 'pages', 'en'), { recursive: true });
    await mkdir(path.join(repoRoot, 'navigation'), { recursive: true });
    await writeFile(
      path.join(repoRoot, ANYDOCS_CONFIG_FILE),
      `${JSON.stringify(config, null, 2)}\n`,
      'utf8',
    );
    await writeFile(
      path.join(repoRoot, ANYDOCS_WORKFLOW_FILE),
      `${JSON.stringify(createWorkflowStandardDefinition({ config, paths }), null, 2)}\n`,
      'utf8',
    );
    await writeFile(
      path.join(repoRoot, 'navigation', 'en.json'),
      `${JSON.stringify({ version: 1, items: [] }, null, 2)}\n`,
      'utf8',
    );

    const result = await loadProjectContract(repoRoot, 'default');
    assert.equal(result.ok, false);

    if (result.ok) {
      return;
    }

    assert.equal(result.error.code, 'VALIDATION_ERROR');
    assert.equal(result.error.details.entity, 'project-config');
    assert.equal(result.error.details.rule, 'project-id-matches-requested-project-root');
    assert.match(result.error.details.remediation ?? '', /projectId matches the canonical project directory|matching projectId/);
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
});

test('loadProjectContract rejects invalid project ids before resolving file-system paths', async () => {
  const repoRoot = await createTempRepoRoot();

  try {
    const result = await loadProjectContract(repoRoot, '../escape');
    assert.equal(result.ok, false);

    if (result.ok) {
      return;
    }

    assert.equal(result.error.code, 'VALIDATION_ERROR');
    assert.equal(result.error.details.entity, 'project-id');
    assert.equal(result.error.details.rule, 'project-id-format');
    assert.match(result.error.details.remediation ?? '', /lowercase letters, numbers, and hyphens/);
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
});

test('loadProjectContract fails when persisted workflow metadata drifts from the canonical project contract', async () => {
  const repoRoot = await createTempRepoRoot();
  await writeValidContract(repoRoot);

  try {
    await writeFile(
      path.join(repoRoot, ANYDOCS_WORKFLOW_FILE),
      `${JSON.stringify(
        {
          version: 1,
          standardId: 'anydocs-phase-1',
          projectContractVersion: 1,
          localFirst: true,
          uiIndependent: true,
          supportedLanguages: ['zh', 'en'],
          enabledLanguages: ['en'],
          publicationStatuses: ['draft', 'in_review', 'published'],
          publishedStatuses: ['published'],
          sourceFiles: [],
          generatedArtifacts: [],
          contentModel: {
            projectConfigFields: ['version', 'projectId', 'name', 'defaultLanguage', 'languages'],
            pageRequiredFields: ['id', 'lang', 'slug', 'title', 'status', 'content'],
            pageOptionalFields: ['description', 'tags', 'updatedAt', 'render'],
            navigationRequiredFields: ['version', 'items'],
          },
          orchestration: {
            workflowSteps: [
              'loadConfig',
              'loadContent',
              'validate',
              'persistSources',
              'filterPublished',
              'generateArtifacts',
              'reportResult',
            ],
            publicationRule: 'published-only',
            futureCompatibleWithoutReinitialization: true,
            externalAutomationReady: true,
          },
        },
        null,
        2,
      )}\n`,
      'utf8',
    );

    const result = await loadProjectContract(repoRoot);
    assert.equal(result.ok, false);

    if (result.ok) {
      return;
    }

    assert.equal(result.error.code, 'VALIDATION_ERROR');
    assert.equal(result.error.details.entity, 'workflow-standard');
    assert.equal(result.error.details.rule, 'workflow-standard-matches-project-contract');
    assert.match(result.error.details.remediation ?? '', /match the current canonical project contract/);
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
});

test('updateProjectConfig persists validated project settings changes', async () => {
  const repoRoot = await createTempRepoRoot();
  await writeValidContract(repoRoot);

  try {
    const result = await updateProjectConfig(repoRoot, {
      name: 'Updated Project',
      defaultLanguage: 'zh',
    });

    assert.equal(result.ok, true);
    if (!result.ok) {
      return;
    }

    assert.equal(result.value.name, 'Updated Project');
    assert.equal(result.value.defaultLanguage, 'zh');
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
});

test('updateProjectConfig rewrites the workflow standard to match updated project settings', async () => {
  const repoRoot = await createTempRepoRoot();
  await writeValidContract(repoRoot);

  try {
    const result = await updateProjectConfig(repoRoot, {
      languages: ['zh'],
      defaultLanguage: 'zh',
    });

    assert.equal(result.ok, true);
    if (!result.ok) {
      return;
    }

    const workflow = JSON.parse(
      await readFile(
        path.join(repoRoot, ANYDOCS_WORKFLOW_FILE),
        'utf8',
      ),
    ) as {
      enabledLanguages: string[];
      sourceFiles: Array<{ path: string }>;
    };

    assert.deepEqual(workflow.enabledLanguages, ['zh']);
    assert.equal(workflow.sourceFiles.some((file) => file.path.includes('/navigation/en.json')), false);
    assert.equal(workflow.sourceFiles.some((file) => file.path.includes('/pages/en/')), false);
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
});

test('updateProjectConfig persists docs theme changes', async () => {
  const repoRoot = await createTempRepoRoot();
  await writeValidContract(repoRoot);

  try {
    const result = await updateProjectConfig(repoRoot, {
      site: {
        theme: {
          id: 'classic-docs',
          branding: {
            siteTitle: 'Classic Knowledge Base',
            homeLabel: 'Knowledge Home',
            logoSrc: '/classic-logo.svg',
            logoAlt: 'Classic logo',
          },
          chrome: {
            showSearch: false,
          },
          colors: {
            primary: '#101010',
            primaryForeground: '#fafafa',
            accent: '#f2f2ef',
            accentForeground: '#1a1a1a',
            sidebarActive: '#202020',
            sidebarActiveForeground: '#ffffff',
          },
          codeTheme: 'github-light',
        },
      },
    });

    assert.equal(result.ok, true);
    if (!result.ok) {
      return;
    }

    assert.equal(result.value.site.theme.id, 'classic-docs');
    assert.equal(result.value.site.theme.branding?.siteTitle, 'Classic Knowledge Base');
    assert.equal(result.value.site.theme.branding?.homeLabel, 'Knowledge Home');
    assert.equal(result.value.site.theme.branding?.logoSrc, '/classic-logo.svg');
    assert.equal(result.value.site.theme.branding?.logoAlt, 'Classic logo');
    assert.equal(result.value.site.theme.chrome?.showSearch, false);
    assert.equal(result.value.site.theme.colors?.primary, '#101010');
    assert.equal(result.value.site.theme.colors?.sidebarActiveForeground, '#ffffff');
    assert.equal(result.value.site.theme.codeTheme, 'github-light');

    const persistedConfig = JSON.parse(
      await readFile(path.join(repoRoot, ANYDOCS_CONFIG_FILE), 'utf8'),
    ) as {
      site?: {
        theme?: {
          id?: string;
          branding?: {
            siteTitle?: string;
            homeLabel?: string;
            logoSrc?: string;
            logoAlt?: string;
          };
          chrome?: {
            showSearch?: boolean;
          };
          colors?: {
            primary?: string;
            primaryForeground?: string;
            accent?: string;
            accentForeground?: string;
            sidebarActive?: string;
            sidebarActiveForeground?: string;
          };
          codeTheme?: string;
        };
      };
    };
    assert.equal(persistedConfig.site?.theme?.id, 'classic-docs');
    assert.equal(persistedConfig.site?.theme?.branding?.siteTitle, 'Classic Knowledge Base');
    assert.equal(persistedConfig.site?.theme?.branding?.homeLabel, 'Knowledge Home');
    assert.equal(persistedConfig.site?.theme?.branding?.logoSrc, '/classic-logo.svg');
    assert.equal(persistedConfig.site?.theme?.branding?.logoAlt, 'Classic logo');
    assert.equal(persistedConfig.site?.theme?.chrome?.showSearch, false);
    assert.equal(persistedConfig.site?.theme?.colors?.primary, '#101010');
    assert.equal(persistedConfig.site?.theme?.colors?.sidebarActiveForeground, '#ffffff');
    assert.equal(persistedConfig.site?.theme?.codeTheme, 'github-light');
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
});

test('updateProjectConfig creates missing language roots when enabling a new language', async () => {
  const repoRoot = await createTempRepoRoot();
  const config = createDefaultProjectConfig({
    languages: ['en'],
    defaultLanguage: 'en',
    name: 'Single Language Project',
  });
  const paths = createProjectPathContract(repoRoot, config);

  try {
    await mkdir(path.join(repoRoot, 'pages', 'en'), { recursive: true });
    await mkdir(path.join(repoRoot, 'navigation'), { recursive: true });
    await writeFile(path.join(repoRoot, ANYDOCS_CONFIG_FILE), `${JSON.stringify(config, null, 2)}\n`, 'utf8');
    await writeFile(
      path.join(repoRoot, ANYDOCS_WORKFLOW_FILE),
      `${JSON.stringify(createWorkflowStandardDefinition({ config, paths }), null, 2)}\n`,
      'utf8',
    );
    await writeFile(
      path.join(repoRoot, 'navigation', 'en.json'),
      `${JSON.stringify({ version: 1, items: [] }, null, 2)}\n`,
      'utf8',
    );

    const result = await updateProjectConfig(repoRoot, {
      languages: ['en', 'zh'],
      defaultLanguage: 'en',
    });

    assert.equal(result.ok, true);
    if (!result.ok) {
      return;
    }

    const zhNavigation = JSON.parse(
      await readFile(path.join(repoRoot, 'navigation', 'zh.json'), 'utf8'),
    ) as { version: number; items: unknown[] };
    assert.equal(zhNavigation.version, 1);
    const contract = await loadProjectContract(repoRoot);
    assert.equal(contract.ok, true);
    assert.deepEqual(result.value.languages, ['en', 'zh']);
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
});

test('updateProjectConfig persists build outputDir and allows clearing optional overrides while keeping valid branding', async () => {
  const repoRoot = await createTempRepoRoot();
  await writeValidContract(repoRoot);

  try {
    const first = await updateProjectConfig(repoRoot, {
      site: {
        theme: {
          id: 'classic-docs',
          branding: {
            siteTitle: 'Custom Title',
            homeLabel: 'Custom Home',
            logoSrc: '/brand.svg',
            logoAlt: 'Brand logo',
          },
          chrome: {
            showSearch: false,
          },
          colors: {
            primary: '#222222',
            primaryForeground: '#fefefe',
            accent: '#f4f4ef',
            accentForeground: '#111111',
            sidebarActive: '#171717',
            sidebarActiveForeground: '#ffffff',
          },
          codeTheme: 'github-dark',
        },
      },
      build: {
        outputDir: './site-dist',
      },
    });

    assert.equal(first.ok, true);
    if (!first.ok) {
      return;
    }
    assert.equal(first.value.build?.outputDir, './site-dist');
    assert.equal(first.value.site.theme.branding?.siteTitle, 'Custom Title');
    assert.equal(first.value.site.theme.branding?.logoSrc, '/brand.svg');
    assert.equal(first.value.site.theme.chrome?.showSearch, false);
    assert.equal(first.value.site.theme.colors?.primary, '#222222');

    const second = await updateProjectConfig(repoRoot, {
      site: {
        theme: {
          id: 'classic-docs',
          branding: {
            siteTitle: 'Only title',
          },
          chrome: {},
          colors: {},
          codeTheme: 'github-dark',
        },
      },
      build: {},
    });

    assert.equal(second.ok, true);
    if (!second.ok) {
      return;
    }
    assert.equal(second.value.build, undefined);
    assert.deepEqual(second.value.site.theme.branding, {
      siteTitle: 'Only title',
    });
    assert.deepEqual(second.value.site.theme.chrome, {});
    assert.deepEqual(second.value.site.theme.colors, {});
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
});

test('updateProjectConfig persists normalized site.url overrides', async () => {
  const repoRoot = await createTempRepoRoot();
  await writeValidContract(repoRoot);

  try {
    const result = await updateProjectConfig(repoRoot, {
      site: {
        url: 'https://docs.example.com/product/',
      },
    });

    assert.equal(result.ok, true);
    if (!result.ok) {
      return;
    }

    assert.equal(result.value.site.url, 'https://docs.example.com/product');

    const persistedConfig = JSON.parse(
      await readFile(path.join(repoRoot, ANYDOCS_CONFIG_FILE), 'utf8'),
    ) as {
      site?: {
        url?: string;
      };
    };
    assert.equal(persistedConfig.site?.url, 'https://docs.example.com/product');
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
});

test('loadProjectContract rejects invalid classic-docs chrome and color overrides', async () => {
  const repoRoot = await createTempRepoRoot();
  const projectRoot = repoRoot;

  try {
    await mkdir(path.join(projectRoot, 'pages', 'en'), { recursive: true });
    await mkdir(path.join(projectRoot, 'navigation'), { recursive: true });
    await writeFile(
      path.join(projectRoot, 'navigation', 'en.json'),
      `${JSON.stringify({ version: 1, items: [] }, null, 2)}\n`,
      'utf8',
    );

    const invalidChromeConfig = {
      version: 1,
      projectId: 'default',
      name: 'Invalid Chrome',
      defaultLanguage: 'en',
      languages: ['en'],
      site: {
        theme: {
          id: 'classic-docs',
          chrome: {
            showSearch: 'nope',
          },
        },
      },
    };

    await writeFile(
      path.join(projectRoot, ANYDOCS_CONFIG_FILE),
      `${JSON.stringify(invalidChromeConfig, null, 2)}\n`,
      'utf8',
    );

    let result = await loadProjectContract(repoRoot);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.details.rule, 'site-theme-chrome-show-search-boolean');
    }

    const invalidColorConfig = {
      ...invalidChromeConfig,
      name: 'Invalid Colors',
      site: {
        theme: {
          id: 'classic-docs',
          colors: {
            primary: '#fff',
          },
        },
      },
    };

    await writeFile(
      path.join(projectRoot, ANYDOCS_CONFIG_FILE),
      `${JSON.stringify(invalidColorConfig, null, 2)}\n`,
      'utf8',
    );

    result = await loadProjectContract(repoRoot);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.details.rule, 'site-theme-colors-primary-hex');
    }
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
});

test('loadProjectContract requires a branding site title or logo when branding overrides are present', async () => {
  const repoRoot = await createTempRepoRoot();
  await writeValidContract(repoRoot);
  const projectRoot = repoRoot;

  try {
    await mkdir(path.join(projectRoot, 'pages', 'en'), { recursive: true });
    await mkdir(path.join(projectRoot, 'navigation'), { recursive: true });
    await writeFile(
      path.join(projectRoot, 'navigation', 'en.json'),
      `${JSON.stringify({ version: 1, items: [] }, null, 2)}\n`,
      'utf8',
    );

    const invalidBrandingConfig = {
      version: 1,
      projectId: 'default',
      name: 'Branding Required',
      defaultLanguage: 'en',
      languages: ['en', 'zh'],
      site: {
        theme: {
          id: 'classic-docs',
          branding: {
            homeLabel: 'Docs Home',
            logoAlt: 'Brand logo',
          },
        },
      },
    };

    await writeFile(
      path.join(projectRoot, ANYDOCS_CONFIG_FILE),
      `${JSON.stringify(invalidBrandingConfig, null, 2)}\n`,
      'utf8',
    );

    let result = await loadProjectContract(repoRoot);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.details.rule, 'site-theme-branding-site-title-or-logo-required');
    }

    const titleOnlyConfig = {
      ...invalidBrandingConfig,
      site: {
        theme: {
          id: 'classic-docs',
          branding: {
            siteTitle: 'Docs Home',
          },
        },
      },
    };

    await writeFile(
      path.join(projectRoot, ANYDOCS_CONFIG_FILE),
      `${JSON.stringify(titleOnlyConfig, null, 2)}\n`,
      'utf8',
    );

    result = await loadProjectContract(repoRoot);
    assert.equal(result.ok, true);

    const blankTitleWithLogoConfig = {
      ...invalidBrandingConfig,
      site: {
        theme: {
          id: 'classic-docs',
          branding: {
            siteTitle: '   ',
            logoSrc: '/brand.svg',
            logoAlt: 'Brand logo',
          },
        },
      },
    };

    await writeFile(
      path.join(projectRoot, ANYDOCS_CONFIG_FILE),
      `${JSON.stringify(blankTitleWithLogoConfig, null, 2)}\n`,
      'utf8',
    );

    result = await loadProjectContract(repoRoot);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.deepEqual(result.value.config.site.theme.branding, {
        logoSrc: '/brand.svg',
        logoAlt: 'Brand logo',
      });
    }

    const logoOnlyConfig = {
      ...invalidBrandingConfig,
      site: {
        theme: {
          id: 'classic-docs',
          branding: {
            logoSrc: '/brand.svg',
            logoAlt: 'Brand logo',
          },
        },
      },
    };

    await writeFile(
      path.join(projectRoot, ANYDOCS_CONFIG_FILE),
      `${JSON.stringify(logoOnlyConfig, null, 2)}\n`,
      'utf8',
    );

    result = await loadProjectContract(repoRoot);
    assert.equal(result.ok, true);

    const blankTitleAndLogoConfig = {
      ...invalidBrandingConfig,
      site: {
        theme: {
          id: 'classic-docs',
          branding: {
            siteTitle: '   ',
            logoSrc: '   ',
            homeLabel: 'Docs Home',
          },
        },
      },
    };

    await writeFile(
      path.join(projectRoot, ANYDOCS_CONFIG_FILE),
      `${JSON.stringify(blankTitleAndLogoConfig, null, 2)}\n`,
      'utf8',
    );

    result = await loadProjectContract(repoRoot);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.details.rule, 'site-theme-branding-site-title-or-logo-required');
    }
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
});

test('loadProjectContract rejects invalid site.url overrides', async () => {
  const repoRoot = await createTempRepoRoot();
  const projectRoot = repoRoot;

  try {
    await mkdir(path.join(projectRoot, 'pages', 'en'), { recursive: true });
    await mkdir(path.join(projectRoot, 'navigation'), { recursive: true });
    await writeFile(
      path.join(projectRoot, 'navigation', 'en.json'),
      `${JSON.stringify({ version: 1, items: [] }, null, 2)}\n`,
      'utf8',
    );

    const invalidSiteUrlConfig = {
      version: 1,
      projectId: 'default',
      name: 'Invalid Site URL',
      defaultLanguage: 'en',
      languages: ['en'],
      site: {
        url: 'ftp://docs.example.com',
        theme: {
          id: 'classic-docs',
        },
      },
    };

    await writeFile(
      path.join(projectRoot, ANYDOCS_CONFIG_FILE),
      `${JSON.stringify(invalidSiteUrlConfig, null, 2)}\n`,
      'utf8',
    );

    const result = await loadProjectContract(repoRoot);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.details.rule, 'site-url-http-absolute');
    }
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
});
