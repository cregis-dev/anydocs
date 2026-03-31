import assert from 'node:assert/strict';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
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
  waitForExit: () => Promise<{ exitCode: number | null; signal: NodeJS.Signals | null }>;
};

async function createTempRepoRoot(prefix: string): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), prefix));
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

async function terminateChild(child: ChildProcessWithoutNullStreams, signal: NodeJS.Signals = 'SIGKILL') {
  if (child.exitCode === null && child.signalCode === null) {
    if (process.platform !== 'win32' && typeof child.pid === 'number') {
      try {
        process.kill(-child.pid, signal);
      } catch {
        child.kill(signal);
      }
    } else {
      child.kill(signal);
    }
  }
}

function spawnCli(args: string[]): SpawnedCli {
  const child = spawn(process.execPath, ['--experimental-strip-types', CLI_ENTRY, ...args], {
    cwd: CLI_WORKDIR,
    detached: process.platform !== 'win32',
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
    waitForExit: createWaitForExit(child),
  };
}

async function waitForOutputOrChildExit(
  child: ChildProcessWithoutNullStreams,
  readOutput: () => string,
  expected: RegExp,
  timeoutMs = 120_000,
): Promise<string> {
  const maxAttempts = Math.ceil(timeoutMs / 100);

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const output = readOutput();
    if (expected.test(output)) {
      return output;
    }

    if (child.exitCode !== null) {
      throw new Error(
        `CLI studio process exited before emitting expected output (exit=${child.exitCode}).\n${output}`.trim(),
      );
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
      // Keep polling until the server is reachable.
    }

    await delay(150);
  }

  throw new Error(`Timed out waiting for HTTP server at ${url}.`);
}

test('studio starts a locked single-project Studio server and rejects cross-project access', { timeout: 240_000 }, async () => {
  const repoRoot = await createTempRepoRoot('anydocs-cli-studio-project-');
  const otherProjectRoot = await createTempRepoRoot('anydocs-cli-studio-other-');

  try {
    await initializeProject({ repoRoot, languages: ['en'], defaultLanguage: 'en' });
    const spawned = spawnCli(['studio', repoRoot, '--no-open', '--json']);

    try {
      const output = await waitForOutputOrChildExit(
        spawned.child,
        spawned.getCombinedOutput,
        /"url": "http:\/\/127\.0\.0\.1:\d+\/studio"/,
        240_000,
      );
      const match = output.match(/"url": "(http:\/\/127\.0\.0\.1:\d+\/studio)"/);
      assert.ok(match, `Expected Studio URL in output, received:\n${output}`);

      const studioUrl = match[1];
      await waitForHttp(studioUrl, 120_000);

      const projectUrl = new URL('/api/local/project', studioUrl);
      projectUrl.searchParams.set('__studio_api', '2');
      projectUrl.searchParams.set('projectId', 'default');
      projectUrl.searchParams.set('path', repoRoot);

      const lockedProjectResponse = await fetch(projectUrl);
      assert.equal(lockedProjectResponse.status, 200);

      const rejectedProjectUrl = new URL(projectUrl);
      rejectedProjectUrl.searchParams.set('path', otherProjectRoot);

      const rejectedProjectResponse = await fetch(rejectedProjectUrl);
      assert.equal(rejectedProjectResponse.status, 400);
      assert.match(await rejectedProjectResponse.text(), /locked project root/i);

    } finally {
      if (!spawned.child.killed) {
        await terminateChild(spawned.child);
      }

      await spawned.waitForExit();
    }
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
    await rm(otherProjectRoot, { recursive: true, force: true });
  }
});
