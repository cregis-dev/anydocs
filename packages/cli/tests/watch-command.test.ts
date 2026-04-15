import assert from 'node:assert/strict';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { access, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

import { initializeProject } from '@anydocs/core';

const CLI_ENTRY = fileURLToPath(new URL('../src/index.ts', import.meta.url));
const CLI_WORKDIR = fileURLToPath(new URL('..', import.meta.url));
const CLI_PACKAGE_JSON = fileURLToPath(new URL('../package.json', import.meta.url));

const { version: CLI_VERSION } = JSON.parse(
  await readFile(CLI_PACKAGE_JSON, 'utf8'),
) as { version: string };

type SpawnedCli = {
  child: ChildProcessWithoutNullStreams;
  getCombinedOutput: () => string;
  getStdout: () => string;
  getStderr: () => string;
  waitForExit: () => Promise<{ exitCode: number | null; signal: NodeJS.Signals | null }>;
};

async function createTempRepoRoot(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), 'anydocs-cli-watch-'));
}

function createWaitForExit(child: ChildProcessWithoutNullStreams) {
  return () =>
    new Promise<{ exitCode: number | null; signal: NodeJS.Signals | null }>((resolve) => {
      if (child.exitCode !== null || child.signalCode !== null) {
        child.stdout.destroy();
        child.stderr.destroy();
        resolve({ exitCode: child.exitCode, signal: child.signalCode });
        return;
      }

      child.once('exit', (exitCode, signal) => {
        child.stdout.destroy();
        child.stderr.destroy();
        resolve({ exitCode, signal });
      });
    });
}

function spawnCli(args: string[]): SpawnedCli {
  const child = spawn(process.execPath, ['--experimental-strip-types', CLI_ENTRY, ...args], {
    cwd: CLI_WORKDIR,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stdout = '';
  let stderr = '';

  child.stdout.on('data', (chunk) => {
    stdout += chunk.toString();
  });

  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });

  return {
    child,
    getCombinedOutput: () => `${stdout}${stderr}`,
    getStdout: () => stdout,
    getStderr: () => stderr,
    waitForExit: createWaitForExit(child),
  };
}

async function waitForOutput(
  readOutput: () => string,
  expected: string | RegExp,
  timeoutMs = 60_000,
): Promise<string> {
  const maxAttempts = Math.ceil(timeoutMs / 100);

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const output = readOutput();
    if (typeof expected === 'string' ? output.includes(expected) : expected.test(output)) {
      return output;
    }

    await delay(100);
  }

  throw new Error(`Timed out waiting for output: ${String(expected)}`);
}

async function waitForHttp(url: string, timeoutMs = 20_000): Promise<void> {
  const maxAttempts = Math.ceil(timeoutMs / 150);

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // keep polling
    }

    await delay(150);
  }

  throw new Error(`Timed out waiting for HTTP server at ${url}.`);
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

test('cli prints general help and exits successfully when no command is provided', async () => {
  const spawned = spawnCli([]);
  const result = await spawned.waitForExit();

  assert.equal(result.exitCode, 0);
  assert.equal(result.signal, null);
  assert.match(spawned.getStdout(), /Usage:/);
  assert.match(spawned.getStdout(), /anydocs <command> \[options\]/);
  assert.equal(spawned.getStderr(), '');
});

test('cli prints command-specific help and version', async () => {
  const helpSpawned = spawnCli(['help', 'build']);
  const helpResult = await helpSpawned.waitForExit();

  assert.equal(helpResult.exitCode, 0);
  assert.equal(helpResult.signal, null);
  assert.match(helpSpawned.getStdout(), /--output, -o <dir>/);
  assert.equal(helpSpawned.getStderr(), '');

  const versionSpawned = spawnCli(['version']);
  const versionResult = await versionSpawned.waitForExit();

  assert.equal(versionResult.exitCode, 0);
  assert.equal(versionResult.signal, null);
  assert.equal(versionSpawned.getStdout().trim(), CLI_VERSION);
  assert.equal(versionSpawned.getStderr(), '');
});

test('version supports structured json output', async () => {
  const spawned = spawnCli(['version', '--json']);
  const result = await spawned.waitForExit();

  assert.equal(result.exitCode, 0);
  assert.equal(result.signal, null);
  assert.equal(spawned.getStderr(), '');
  assert.deepEqual(JSON.parse(spawned.getStdout()), {
    ok: true,
    data: {
      version: CLI_VERSION,
    },
    meta: {
      command: 'version',
    },
  });
});

test('cli rejects unknown commands with a clear error', async () => {
  const spawned = spawnCli(['unknown-command']);
  const result = await spawned.waitForExit();

  assert.equal(result.exitCode, 1);
  assert.equal(result.signal, null);
  assert.match(spawned.getStderr(), /Unknown command "unknown-command"\./);
  assert.match(spawned.getStderr(), /Run "anydocs help" for usage\./);
});

test('init prints next-step commands after creating a project', async () => {
  const tempRoot = await createTempRepoRoot();
  const repoRoot = path.join(tempRoot, 'acme-help-center');

  try {
    const spawned = spawnCli(['init', repoRoot]);
    const result = await spawned.waitForExit();

    assert.equal(result.exitCode, 0);
    assert.equal(result.signal, null);
    assert.match(spawned.getStdout(), /Initialized Anydocs project/);
    assert.match(spawned.getStdout(), /skill\.md/);
    assert.match(spawned.getStdout(), /Next:/);
    assert.match(spawned.getStdout(), /Build the project: anydocs build/);
    assert.match(spawned.getStdout(), /Preview it locally: anydocs preview/);
    assert.equal(spawned.getStderr(), '');
    await access(path.join(repoRoot, 'skill.md'));

    const configRaw = await readFile(path.join(repoRoot, 'anydocs.config.json'), 'utf8');
    const config = JSON.parse(configRaw) as {
      projectId: string;
      name: string;
      defaultLanguage: string;
      languages: string[];
      site?: { theme?: { branding?: { siteTitle?: string } } };
      build?: { outputDir?: string };
    };
    assert.equal(config.projectId, 'acme-help-center');
    assert.equal(config.name, 'Acme Help Center');
    assert.equal(config.defaultLanguage, 'zh');
    assert.deepEqual(config.languages, ['zh', 'en']);
    assert.equal(config.site?.theme?.branding?.siteTitle, 'Acme Help Center');
    assert.equal(config.build?.outputDir, './dist');
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('init can generate a Codex-specific AGENTS.md guide', async () => {
  const repoRoot = await createTempRepoRoot();

  try {
    const spawned = spawnCli(['init', repoRoot, '--agent', 'codex']);
    const result = await spawned.waitForExit();

    assert.equal(result.exitCode, 0);
    assert.equal(result.signal, null);
    assert.match(spawned.getStdout(), /AGENTS\.md/);
    assert.equal(spawned.getStderr(), '');
    await access(path.join(repoRoot, 'AGENTS.md'));
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
});

test('project create supports richer initialization options', async () => {
  const repoRoot = await createTempRepoRoot();

  try {
    const spawned = spawnCli([
      'project',
      'create',
      repoRoot,
      '--project-id',
      'acme-docs',
      '--name',
      'Acme Docs',
      '--default-language',
      'zh',
      '--languages',
      'zh,en',
      '--agent',
      'claude-code',
      '--json',
    ]);
    const result = await spawned.waitForExit();

    assert.equal(result.exitCode, 0);
    assert.equal(result.signal, null);
    assert.equal(spawned.getStderr(), '');

    const output = JSON.parse(spawned.getStdout()) as {
      ok: boolean;
      data: {
        projectId: string;
        projectRoot: string;
        languages: string[];
        createdFiles: string[];
      };
    };
    assert.equal(output.ok, true);
    assert.equal(output.data.projectId, 'acme-docs');
    assert.equal(output.data.projectRoot, repoRoot);
    assert.deepEqual(output.data.languages, ['zh', 'en']);
    assert.match(output.data.createdFiles.join('\n'), /anydocs\.workflow\.json/);
    assert.match(output.data.createdFiles.join('\n'), /CLAUDE\.md/);
    assert.match(output.data.createdFiles.join('\n'), /\.claude\/commands\/anydocs-new-page\.md/);
    assert.match(output.data.createdFiles.join('\n'), /\.claude\/commands\/anydocs-publish-page\.md/);

    const configRaw = await readFile(path.join(repoRoot, 'anydocs.config.json'), 'utf8');
    const config = JSON.parse(configRaw) as {
      projectId: string;
      name: string;
      defaultLanguage: string;
      languages: string[];
    };
    assert.equal(config.projectId, 'acme-docs');
    assert.equal(config.name, 'Acme Docs');
    assert.equal(config.defaultLanguage, 'zh');
    assert.deepEqual(config.languages, ['zh', 'en']);
    await access(path.join(repoRoot, 'CLAUDE.md'));
    await access(path.join(repoRoot, '.claude', 'commands', 'anydocs-new-page.md'));
    await access(path.join(repoRoot, '.claude', 'commands', 'anydocs-publish-page.md'));
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
});

test('project inspect and validate expose structured project data', async () => {
  const repoRoot = await createTempRepoRoot();

  try {
    await initializeProject({ repoRoot, languages: ['en'], defaultLanguage: 'en' });

    const inspectSpawned = spawnCli(['project', 'inspect', repoRoot, '--json']);
    const inspectResult = await inspectSpawned.waitForExit();

    assert.equal(inspectResult.exitCode, 0);
    assert.equal(inspectSpawned.getStderr(), '');
    const inspectJson = JSON.parse(inspectSpawned.getStdout()) as {
      ok: boolean;
      data: { config: { projectId: string; languages: string[] }; paths: { projectRoot: string; workflowFile: string } };
    };
    assert.equal(inspectJson.ok, true);
    assert.equal(inspectJson.data.config.projectId, 'default');
    assert.deepEqual(inspectJson.data.config.languages, ['en']);
    assert.equal(inspectJson.data.paths.projectRoot, repoRoot);
    assert.match(inspectJson.data.paths.workflowFile, /anydocs\.workflow\.json$/);

    const validateSpawned = spawnCli(['project', 'validate', repoRoot, '--json']);
    const validateResult = await validateSpawned.waitForExit();

    assert.equal(validateResult.exitCode, 0);
    assert.equal(validateSpawned.getStderr(), '');
    const validateJson = JSON.parse(validateSpawned.getStdout()) as {
      ok: boolean;
      data: { valid: boolean; workflowCompatibility: { compatible: boolean } };
    };
    assert.equal(validateJson.ok, true);
    assert.equal(validateJson.data.valid, true);
    assert.equal(validateJson.data.workflowCompatibility.compatible, true);
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
});

test('page and nav commands expose structured read models', async () => {
  const repoRoot = await createTempRepoRoot();

  try {
    await initializeProject({ repoRoot, languages: ['en'], defaultLanguage: 'en' });

    const pageListSpawned = spawnCli(['page', 'list', repoRoot, '--lang', 'en', '--json']);
    const pageListResult = await pageListSpawned.waitForExit();

    assert.equal(pageListResult.exitCode, 0);
    assert.equal(pageListSpawned.getStderr(), '');
    const pageListJson = JSON.parse(pageListSpawned.getStdout()) as {
      ok: boolean;
      data: { count: number; pages: Array<{ id: string; slug: string; status: string; file: string }> };
    };
    assert.equal(pageListJson.ok, true);
    assert.equal(pageListJson.data.count, 1);
    assert.equal(pageListJson.data.pages[0]?.id, 'welcome');
    assert.equal(pageListJson.data.pages[0]?.slug, 'welcome');
    assert.equal(pageListJson.data.pages[0]?.status, 'published');
    assert.match(pageListJson.data.pages[0]?.file ?? '', /pages\/en\/welcome\.json$/);

    const pageGetSpawned = spawnCli(['page', 'get', 'welcome', repoRoot, '--lang', 'en', '--json']);
    const pageGetResult = await pageGetSpawned.waitForExit();

    assert.equal(pageGetResult.exitCode, 0);
    assert.equal(pageGetSpawned.getStderr(), '');
    const pageGetJson = JSON.parse(pageGetSpawned.getStdout()) as {
      ok: boolean;
      data: { page: { id: string; title: string; status: string } };
    };
    assert.equal(pageGetJson.ok, true);
    assert.equal(pageGetJson.data.page.id, 'welcome');
    assert.equal(pageGetJson.data.page.title, 'Welcome');
    assert.equal(pageGetJson.data.page.status, 'published');

    const pageFindSpawned = spawnCli(['page', 'find', repoRoot, '--lang', 'en', '--slug', 'welcome', '--json']);
    const pageFindResult = await pageFindSpawned.waitForExit();

    assert.equal(pageFindResult.exitCode, 0);
    assert.equal(pageFindSpawned.getStderr(), '');
    const pageFindJson = JSON.parse(pageFindSpawned.getStdout()) as {
      ok: boolean;
      data: { matches: Array<{ id: string }> };
    };
    assert.equal(pageFindJson.ok, true);
    assert.equal(pageFindJson.data.matches.length, 1);
    assert.equal(pageFindJson.data.matches[0]?.id, 'welcome');

    const navGetSpawned = spawnCli(['nav', 'get', repoRoot, '--lang', 'en', '--json']);
    const navGetResult = await navGetSpawned.waitForExit();

    assert.equal(navGetResult.exitCode, 0);
    assert.equal(navGetSpawned.getStderr(), '');
    const navGetJson = JSON.parse(navGetSpawned.getStdout()) as {
      ok: boolean;
      data: { navigation: { version: number; items: Array<{ type: string }> } };
    };
    assert.equal(navGetJson.ok, true);
    assert.equal(navGetJson.data.navigation.version, 1);
    assert.equal(navGetJson.data.navigation.items[0]?.type, 'section');
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
});

test('import --convert stages legacy content and converts it into draft pages', async () => {
  const repoRoot = await createTempRepoRoot();
  const legacySourceRoot = await mkdtemp(path.join(os.tmpdir(), 'anydocs-cli-import-source-'));

  try {
    await initializeProject({ repoRoot, languages: ['en'], defaultLanguage: 'en' });
    await writeFile(
      path.join(legacySourceRoot, 'guide.md'),
      '# Imported Guide\n\nLegacy content body.\n',
      'utf8',
    );

    const spawned = spawnCli(['import', legacySourceRoot, repoRoot, 'en', '--convert']);
    const result = await spawned.waitForExit();

    assert.equal(result.exitCode, 0);
    assert.equal(result.signal, null);
    assert.match(spawned.getStdout(), /Imported 1 legacy documents into staged conversion path\./);
    assert.match(spawned.getStdout(), /Converting staged import immediately because --convert was provided\./);
    assert.match(spawned.getStdout(), /Converted 1 staged documents into canonical draft pages\./);
    assert.match(spawned.getStdout(), /Review the generated draft pages and publish the ones you want to ship\./);
    assert.equal(spawned.getStderr(), '');

    const pageRaw = await readFile(path.join(repoRoot, 'pages', 'en', 'guide.json'), 'utf8');
    const page = JSON.parse(pageRaw) as { status: string; slug: string; title: string };
    assert.equal(page.status, 'draft');
    assert.equal(page.slug, 'guide');
    assert.equal(page.title, 'Imported Guide');

    const importsRoot = path.join(repoRoot, 'imports');
    const importIds = await readdir(importsRoot);
    assert.equal(importIds.length, 1);
    const manifestRaw = await readFile(path.join(importsRoot, importIds[0], 'manifest.json'), 'utf8');
    const manifest = JSON.parse(manifestRaw) as { status: string };
    assert.equal(manifest.status, 'converted');
    await access(path.join(importsRoot, importIds[0], 'conversion-report.json'));
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
    await rm(legacySourceRoot, { recursive: true, force: true });
  }
});

test('build emits a deployable static docs site and exits successfully', async () => {
  const repoRoot = await createTempRepoRoot();

  try {
    await initializeProject({ repoRoot, languages: ['en'], defaultLanguage: 'en' });
    const spawned = spawnCli(['build', repoRoot]);
    const result = await spawned.waitForExit();

    assert.equal(result.exitCode, 0);
    assert.equal(result.signal, null);
    assert.match(spawned.getStdout(), /Static site root:/);
    assert.match(spawned.getStdout(), /Entrypoint:/);
    assert.match(spawned.getStdout(), /Next: preview locally with anydocs preview/);
    assert.equal(spawned.getStderr(), '');
    await access(path.join(repoRoot, 'dist', 'index.html'));
    await access(path.join(repoRoot, 'dist', 'en', 'docs', 'welcome', 'index.html'));
    await assert.rejects(() => access(path.join(repoRoot, 'dist', 'studio')));
    await assert.rejects(() => access(path.join(repoRoot, 'dist', 'projects')));
    await assert.rejects(() => access(path.join(repoRoot, 'dist', 'admin')));
    await assert.rejects(() => access(path.join(repoRoot, 'dist', '_not-found')));

    const exportedFiles = await listFilesRecursively(path.join(repoRoot, 'dist'));
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
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
});

test.skip('preview starts a live local docs server and exits cleanly on SIGINT', async () => {
  const repoRoot = await createTempRepoRoot();

  try {
    await initializeProject({ repoRoot, languages: ['en'], defaultLanguage: 'en' });
    const spawned = spawnCli(['preview', repoRoot]);

    try {
      const output = await waitForOutput(
        spawned.getCombinedOutput,
        /Preview URL: (http:\/\/127\.0\.0\.1:\d+\S*)/,
        120_000,
      );
      const match = output.match(/Preview URL: (http:\/\/127\.0\.0\.1:\d+\S*)/);
      assert.ok(match, `Expected preview URL in output, received:\n${output}`);

      await waitForHttp(match[1]);
      spawned.child.kill('SIGINT');

      const result = await spawned.waitForExit();
      assert.equal(result.exitCode, 0);
      assert.equal(result.signal, null);
      assert.match(spawned.getStdout(), /Stopping preview server/);
    } finally {
      if (!spawned.child.killed) {
        spawned.child.kill('SIGKILL');
      }
    }
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
});

test.skip('preview --watch is treated as a live-preview compatibility flag', async () => {
  const repoRoot = await createTempRepoRoot();

  try {
    await initializeProject({ repoRoot, languages: ['en'], defaultLanguage: 'en' });
    const spawned = spawnCli(['preview', repoRoot, '--watch']);

    try {
      const output = await waitForOutput(
        spawned.getCombinedOutput,
        /Preview URL: http:\/\/127\.0\.0\.1:\d+\S*/,
        120_000,
      );
      assert.match(output, /Preview runs in live mode by default; --watch is kept as a compatibility flag\./);
      assert.match(output, /Preview URL: http:\/\/127\.0\.0\.1:\d+\S*/);
      spawned.child.kill('SIGINT');

      const result = await spawned.waitForExit();
      assert.equal(result.exitCode, 0);
      assert.equal(result.signal, null);
      assert.equal(spawned.getStderr(), '');
    } finally {
      if (!spawned.child.killed) {
        spawned.child.kill('SIGKILL');
      }
    }
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
});

test('build returns a startup failure for an invalid repo root', async () => {
  const missingRepoRoot = path.join(os.tmpdir(), 'anydocs-cli-watch-missing-project');
  const spawned = spawnCli(['build', missingRepoRoot]);

  try {
    const result = await spawned.waitForExit();
    const stderr = spawned.getStderr();

    assert.equal(result.exitCode, 1);
    assert.equal(result.signal, null);
    assert.match(stderr, /Build failed:/);
  } finally {
    if (!spawned.child.killed) {
      spawned.child.kill('SIGKILL');
    }
  }
});
