import assert from 'node:assert/strict';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { ANYDOCS_CONFIG_FILE, ANYDOCS_WORKFLOW_FILE } from '../src/config/project-config.ts';
import { ValidationError } from '../src/errors/validation-error.ts';
import { initializeProject } from '../src/services/init-service.ts';

async function createTempRepoRoot(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), 'anydocs-init-'));
}

test('initializeProject creates the canonical project structure and starter content', async () => {
  const repoRoot = await createTempRepoRoot();

  try {
    const result = await initializeProject({ repoRoot });
    const projectRoot = repoRoot;

    assert.equal(result.contract.paths.projectRoot, projectRoot);
    assert.deepEqual(result.contract.config.languages, ['en']);
    assert.equal(result.contract.config.site.theme.id, 'classic-docs');
    assert.equal(result.contract.config.site.theme.codeTheme, 'github-dark');
    assert.equal(result.contract.config.site.theme.branding, undefined);
    assert.equal(result.contract.config.site.theme.chrome, undefined);
    assert.equal(result.contract.config.site.theme.colors, undefined);

    await access(path.join(projectRoot, ANYDOCS_CONFIG_FILE));
    await access(path.join(projectRoot, ANYDOCS_WORKFLOW_FILE));
    await access(path.join(projectRoot, 'navigation', 'en.json'));
    await access(path.join(projectRoot, 'pages', 'en', 'welcome.json'));
    await access(path.join(projectRoot, 'imports'));
    await access(path.join(repoRoot, 'dist'));
    await access(path.join(repoRoot, 'dist', 'mcp'));

    const page = JSON.parse(
      await readFile(path.join(projectRoot, 'pages', 'en', 'welcome.json'), 'utf8'),
    ) as { status: string; slug: string; title: string };
    const config = JSON.parse(
      await readFile(path.join(projectRoot, ANYDOCS_CONFIG_FILE), 'utf8'),
    ) as {
      site?: {
        theme?: {
          id?: string;
          codeTheme?: string;
          branding?: unknown;
          chrome?: unknown;
          colors?: unknown;
        };
      };
    };

    assert.equal(page.status, 'published');
    assert.equal(page.slug, 'welcome');
    assert.equal(page.title, 'Welcome');
    assert.equal(config.site?.theme?.id, 'classic-docs');
    assert.equal(config.site?.theme?.codeTheme, 'github-dark');
    assert.equal(config.site?.theme?.branding, undefined);
    assert.equal(config.site?.theme?.chrome, undefined);
    assert.equal(config.site?.theme?.colors, undefined);
    assert.ok(
      result.createdFiles.some((filePath) => filePath.endsWith(ANYDOCS_WORKFLOW_FILE)),
    );
    assert.ok(
      result.createdFiles.some((filePath) => filePath.endsWith(path.join('pages', 'en', 'welcome.json'))),
    );
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
});

test('initializeProject fails clearly when canonical config already exists and preserves file contents', async () => {
  const repoRoot = await createTempRepoRoot();
  const projectRoot = repoRoot;
  const configFile = path.join(projectRoot, ANYDOCS_CONFIG_FILE);
  const existingConfig = '{\n  "sentinel": true\n}\n';

  try {
    await mkdir(projectRoot, { recursive: true });
    await writeFile(configFile, existingConfig, 'utf8');

    await assert.rejects(
      () => initializeProject({ repoRoot }),
      (error: unknown) => {
        assert.ok(error instanceof ValidationError);
        assert.equal(error.details.entity, 'project-config-file');
        assert.equal(error.details.rule, 'init-target-must-not-conflict');
        assert.match(error.message, /already exists/);
        return true;
      },
    );

    const preservedConfig = await readFile(configFile, 'utf8');
    assert.equal(preservedConfig, existingConfig);
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
});

test('initializeProject rejects runtime-invalid project options before writing files', async () => {
  const repoRoot = await createTempRepoRoot();

  try {
    await assert.rejects(
      () =>
        initializeProject({
          repoRoot,
          defaultLanguage: 'zh',
          languages: ['en'] as ('en' | 'zh')[],
        }),
      (error: unknown) => {
        assert.ok(error instanceof ValidationError);
        assert.equal(error.details.entity, 'project-config');
        assert.equal(error.details.rule, 'default-language-must-be-enabled');
        return true;
      },
    );

    await assert.rejects(
      () => access(path.join(repoRoot, ANYDOCS_CONFIG_FILE)),
      /ENOENT/,
    );
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
});
