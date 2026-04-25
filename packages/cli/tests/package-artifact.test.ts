import assert from 'node:assert/strict';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { access, cp, mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const CLI_WORKDIR = fileURLToPath(new URL('..', import.meta.url));
const CLI_PACKAGE_JSON = fileURLToPath(new URL('../package.json', import.meta.url));
const CORE_WORKDIR = fileURLToPath(new URL('../../core/', import.meta.url));
const CORE_PACKAGE_JSON = fileURLToPath(new URL('../../core/package.json', import.meta.url));

async function runCommand(command: string, args: string[], cwd: string): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
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

    child.once('error', reject);
    child.once('exit', (exitCode, signal) => {
      child.stdout.destroy();
      child.stderr.destroy();

      if (exitCode === 0) {
        resolve({ stdout, stderr });
        return;
      }

      reject(
        new Error(
          `${command} ${args.join(' ')} failed (exit=${exitCode ?? 'null'}, signal=${signal ?? 'null'}).\n${stderr || stdout}`,
        ),
      );
    });
  });
}

type SpawnedProcess = {
  child: ChildProcessWithoutNullStreams;
  getCombinedOutput: () => string;
  waitForExit: () => Promise<{ exitCode: number | null; signal: NodeJS.Signals | null }>;
};

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

function spawnCommand(command: string, args: string[], cwd: string): SpawnedProcess {
  const child = spawn(command, args, {
    cwd,
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
    waitForExit: createWaitForExit(child),
  };
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

async function waitForOutputOrChildExit(
  spawned: SpawnedProcess,
  expected: RegExp,
  timeoutMs = 120_000,
): Promise<string> {
  const maxAttempts = Math.ceil(timeoutMs / 150);

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const output = spawned.getCombinedOutput();
    if (expected.test(output)) {
      return output;
    }

    if (spawned.child.exitCode !== null) {
      throw new Error(
        `Process exited before emitting expected output (exit=${spawned.child.exitCode}).\n${output}`.trim(),
      );
    }

    await delay(150);
  }

  throw new Error(`Timed out waiting for output: ${String(expected)}\n${spawned.getCombinedOutput()}`);
}

test('packed cli tarball includes the packaged studio runtime', { timeout: 240_000, concurrency: false }, async () => {
  const packageJson = JSON.parse(await readFile(CLI_PACKAGE_JSON, 'utf8')) as { version: string };
  const tarballPath = path.join(CLI_WORKDIR, `anydocs-cli-${packageJson.version}.tgz`);

  await rm(tarballPath, { force: true });

  try {
    await runCommand('pnpm', ['build'], CLI_WORKDIR);
    await runCommand('pnpm', ['pack'], CLI_WORKDIR);
    await access(tarballPath);

    const listing = await runCommand('tar', ['-tzf', tarballPath], CLI_WORKDIR);
    assert.match(listing.stdout, /package\/dist\/commands\/studio-command\.js/);
    assert.match(listing.stdout, /package\/dist\/runtime\/runtime-root\.js/);
    assert.match(listing.stdout, /package\/studio-runtime\/app\/studio\/page\.tsx/);
    assert.match(listing.stdout, /package\/studio-runtime\/components\/studio\/studio-entry\.tsx/);
    assert.match(listing.stdout, /package\/studio-runtime\/lib\/studio\/server\/project-policy\.ts/);
    assert.match(listing.stdout, /package\/studio-runtime\/next\.config\.mjs/);
    assert.match(listing.stdout, /package\/studio-runtime\/tsconfig\.json/);
    assert.match(listing.stdout, /package\/docs-runtime\/scripts\/gen-public-assets\.mjs/);
    assert.match(listing.stdout, /package\/docs-runtime\/app\/\[lang\]\/\[\.\.\.slug\]\/page\.tsx/);
    assert.match(listing.stdout, /package\/docs-runtime\/next\.config\.mjs/);
    assert.match(listing.stdout, /package\/docs-runtime\/tsconfig\.json/);
  } finally {
    await rm(tarballPath, { force: true });
  }
});

test('packed cli tarball installs and starts Studio with packed core dependency', { timeout: 360_000, concurrency: false }, async () => {
  const cliPackageJson = JSON.parse(await readFile(CLI_PACKAGE_JSON, 'utf8')) as { version: string };
  const corePackageJson = JSON.parse(await readFile(CORE_PACKAGE_JSON, 'utf8')) as { version: string };
  const cliTarballPath = path.join(CLI_WORKDIR, `anydocs-cli-${cliPackageJson.version}.tgz`);
  const coreTarballPath = path.join(CORE_WORKDIR, `anydocs-core-${corePackageJson.version}.tgz`);
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'anydocs-packed-cli-smoke-'));

  await rm(cliTarballPath, { force: true });
  await rm(coreTarballPath, { force: true });

  try {
    await runCommand('pnpm', ['build'], CLI_WORKDIR);
    await runCommand('pnpm', ['pack'], CORE_WORKDIR);
    await runCommand('pnpm', ['pack'], CLI_WORKDIR);
    await cp(coreTarballPath, path.join(tempRoot, path.basename(coreTarballPath)));
    await cp(cliTarballPath, path.join(tempRoot, path.basename(cliTarballPath)));

    await runCommand('npm', ['init', '-y'], tempRoot);
    await runCommand(
      'npm',
      ['install', `./${path.basename(coreTarballPath)}`, `./${path.basename(cliTarballPath)}`],
      tempRoot,
    );
    await runCommand('node', ['node_modules/.bin/anydocs', 'init', 'docs', '--languages', 'en', '--default-language', 'en'], tempRoot);

    const spawned = spawnCommand('node', ['node_modules/.bin/anydocs', 'studio', 'docs', '--no-open', '--json'], tempRoot);
    try {
      const output = await waitForOutputOrChildExit(spawned, /"url": "http:\/\/127\.0\.0\.1:\d+\/studio"/, 240_000);
      assert.match(output, /"command": "studio"/);
    } finally {
      await terminateChild(spawned.child);
      await spawned.waitForExit();
    }
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
    await rm(cliTarballPath, { force: true });
    await rm(coreTarballPath, { force: true });
  }
});
