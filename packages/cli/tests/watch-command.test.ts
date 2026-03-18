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
    waitForExit: () =>
      new Promise((resolve) => {
        child.once('exit', (exitCode, signal) => {
          resolve({ exitCode, signal });
        });
      }),
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
  assert.match(spawned.getStdout(), /pnpm --filter @anydocs\/cli cli <command> \[options\]/);
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
  assert.equal(versionSpawned.getStdout().trim(), '1.0.0');
  assert.equal(versionSpawned.getStderr(), '');
});

test('cli rejects unknown commands with a clear error', async () => {
  const spawned = spawnCli(['unknown-command']);
  const result = await spawned.waitForExit();

  assert.equal(result.exitCode, 1);
  assert.equal(result.signal, null);
  assert.match(spawned.getStderr(), /Unknown command "unknown-command"\./);
  assert.match(spawned.getStderr(), /Run "pnpm --filter @anydocs\/cli cli help" for usage\./);
});

test('init prints next-step commands after creating a project', async () => {
  const repoRoot = await createTempRepoRoot();

  try {
    const spawned = spawnCli(['init', repoRoot]);
    const result = await spawned.waitForExit();

    assert.equal(result.exitCode, 0);
    assert.equal(result.signal, null);
    assert.match(spawned.getStdout(), /Initialized Anydocs project/);
    assert.match(spawned.getStdout(), /skill\.md/);
    assert.match(spawned.getStdout(), /Next:/);
    assert.match(spawned.getStdout(), /pnpm --filter @anydocs\/cli cli build/);
    assert.match(spawned.getStdout(), /pnpm --filter @anydocs\/cli cli preview/);
    assert.equal(spawned.getStderr(), '');
    await access(path.join(repoRoot, 'skill.md'));
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
    assert.match(spawned.getStdout(), /Next: preview locally with pnpm --filter @anydocs\/cli cli preview/);
    assert.equal(spawned.getStderr(), '');
    await access(path.join(repoRoot, 'dist', 'index.html'));
    await access(path.join(repoRoot, 'dist', 'en', 'docs', 'welcome', 'index.html'));
    await assert.rejects(() => access(path.join(repoRoot, 'dist', 'studio')));
    await assert.rejects(() => access(path.join(repoRoot, 'dist', 'projects')));
    await assert.rejects(() => access(path.join(repoRoot, 'dist', 'admin')));
    await assert.rejects(() => access(path.join(repoRoot, 'dist', '_not-found')));

    const exportedFiles = await listFilesRecursively(path.join(repoRoot, 'dist'));
    const leakedTxtFiles = exportedFiles.filter((filePath) => filePath.endsWith('.txt') && !filePath.endsWith('llms.txt'));
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
