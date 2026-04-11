import assert from 'node:assert/strict';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { ANYDOCS_CONFIG_FILE, ANYDOCS_WORKFLOW_FILE } from '../src/config/project-config.ts';
import { ValidationError } from '../src/errors/validation-error.ts';
import { initializeProject } from '../src/services/init-service.ts';

async function createTempRepoRoot(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), 'anydocs-init-'));
}

const PACKAGE_ROOT = fileURLToPath(new URL('..', import.meta.url));
const BUNDLED_AGENT_GUIDE = path.join(PACKAGE_ROOT, 'docs', 'agent.md');

test('initializeProject creates the canonical project structure and starter content', async () => {
  const repoRoot = await createTempRepoRoot();

  try {
    const result = await initializeProject({ repoRoot });
    const projectRoot = repoRoot;

    assert.equal(result.contract.paths.projectRoot, projectRoot);
    assert.equal(result.contract.config.defaultLanguage, 'zh');
    assert.deepEqual(result.contract.config.languages, ['zh', 'en']);
    assert.equal(result.contract.config.site.theme.id, 'classic-docs');
    assert.equal(result.contract.config.site.theme.codeTheme, 'github-dark');
    assert.deepEqual(result.contract.config.site.theme.branding, {
      siteTitle: 'Anydocs Project',
    });
    assert.equal(result.contract.config.site.theme.chrome, undefined);
    assert.equal(result.contract.config.site.theme.colors, undefined);
    assert.deepEqual(result.contract.config.build, {
      outputDir: './dist',
    });

    await access(path.join(projectRoot, ANYDOCS_CONFIG_FILE));
    await access(path.join(projectRoot, ANYDOCS_WORKFLOW_FILE));
    await access(path.join(projectRoot, 'navigation', 'zh.json'));
    await access(path.join(projectRoot, 'navigation', 'en.json'));
    await access(path.join(projectRoot, 'pages', 'zh', 'welcome.json'));
    await access(path.join(projectRoot, 'pages', 'en', 'welcome.json'));
    await access(path.join(projectRoot, 'skill.md'));
    await access(path.join(projectRoot, 'imports'));
    await access(path.join(repoRoot, 'dist'));
    await access(path.join(repoRoot, 'dist', 'mcp'));

    const zhPage = JSON.parse(
      await readFile(path.join(projectRoot, 'pages', 'zh', 'welcome.json'), 'utf8'),
    ) as { status: string; slug: string; title: string };
    const zhNavigation = JSON.parse(
      await readFile(path.join(projectRoot, 'navigation', 'zh.json'), 'utf8'),
    ) as { items: Array<{ type: string; title?: string }> };
    const enPage = JSON.parse(
      await readFile(path.join(projectRoot, 'pages', 'en', 'welcome.json'), 'utf8'),
    ) as { status: string; slug: string; title: string };
    const config = JSON.parse(
      await readFile(path.join(projectRoot, ANYDOCS_CONFIG_FILE), 'utf8'),
    ) as {
      site?: {
        theme?: {
          id?: string;
          codeTheme?: string;
          branding?: { siteTitle?: string };
          chrome?: unknown;
          colors?: unknown;
        };
      };
      build?: {
        outputDir?: string;
      };
    };
    const skillGuide = await readFile(path.join(projectRoot, 'skill.md'), 'utf8');
    const sourceSkillGuide = await readFile(BUNDLED_AGENT_GUIDE, 'utf8');

    assert.equal(zhPage.status, 'published');
    assert.equal(zhPage.slug, 'welcome');
    assert.equal(zhPage.title, '欢迎');
    assert.equal(zhNavigation.items[0]?.title, '开始使用');
    assert.equal(enPage.status, 'published');
    assert.equal(enPage.slug, 'welcome');
    assert.equal(enPage.title, 'Welcome');
    assert.equal(skillGuide, sourceSkillGuide);
    assert.equal(config.site?.theme?.id, 'classic-docs');
    assert.equal(config.site?.theme?.codeTheme, 'github-dark');
    assert.deepEqual(config.site?.theme?.branding, {
      siteTitle: 'Anydocs Project',
    });
    assert.equal(config.site?.theme?.chrome, undefined);
    assert.equal(config.site?.theme?.colors, undefined);
    assert.equal(config.build?.outputDir, './dist');
    assert.ok(
      result.createdFiles.some((filePath) => filePath.endsWith(ANYDOCS_WORKFLOW_FILE)),
    );
    assert.ok(
      result.createdFiles.some((filePath) => filePath.endsWith(path.join('pages', 'zh', 'welcome.json'))),
    );
    assert.ok(
      result.createdFiles.some((filePath) => filePath.endsWith(path.join('pages', 'en', 'welcome.json'))),
    );
    assert.ok(result.createdFiles.some((filePath) => filePath.endsWith('skill.md')));
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
});

test('initializeProject can generate a Codex-specific AGENTS.md guide instead of skill.md', async () => {
  const repoRoot = await createTempRepoRoot();

  try {
    const result = await initializeProject({ repoRoot, agent: 'codex' });

    await access(path.join(repoRoot, 'AGENTS.md'));
    await assert.rejects(() => access(path.join(repoRoot, 'skill.md')), /ENOENT/);

    const agentGuide = await readFile(path.join(repoRoot, 'AGENTS.md'), 'utf8');
    const sourceSkillGuide = await readFile(BUNDLED_AGENT_GUIDE, 'utf8');

    assert.equal(agentGuide, sourceSkillGuide);
    assert.ok(result.createdFiles.some((filePath) => filePath.endsWith('AGENTS.md')));
    assert.ok(!result.createdFiles.some((filePath) => filePath.endsWith('skill.md')));
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
});

test('initializeProject can generate a CLAUDE.md guide and bundled slash commands for Claude Code', async () => {
  const repoRoot = await createTempRepoRoot();

  try {
    const result = await initializeProject({ repoRoot, agent: 'claude-code' });

    await access(path.join(repoRoot, 'CLAUDE.md'));
    await access(path.join(repoRoot, '.claude', 'commands', 'anydocs-new-page.md'));
    await access(path.join(repoRoot, '.claude', 'commands', 'anydocs-publish-page.md'));
    await assert.rejects(() => access(path.join(repoRoot, 'skill.md')), /ENOENT/);

    const agentGuide = await readFile(path.join(repoRoot, 'CLAUDE.md'), 'utf8');
    const sourceClaudeGuide = await readFile(BUNDLED_AGENT_GUIDE, 'utf8');

    assert.equal(agentGuide, sourceClaudeGuide);
    assert.ok(result.createdFiles.some((filePath) => filePath.endsWith('CLAUDE.md')));
    assert.ok(
      result.createdFiles.some((filePath) =>
        filePath.endsWith(path.join('.claude', 'commands', 'anydocs-new-page.md')),
      ),
    );
    assert.ok(
      result.createdFiles.some((filePath) =>
        filePath.endsWith(path.join('.claude', 'commands', 'anydocs-publish-page.md')),
      ),
    );
    assert.ok(!result.createdFiles.some((filePath) => filePath.endsWith('skill.md')));
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
