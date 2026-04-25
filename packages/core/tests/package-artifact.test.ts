import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { access, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const CORE_WORKDIR = fileURLToPath(new URL('..', import.meta.url));
const CORE_PACKAGE_JSON = fileURLToPath(new URL('../package.json', import.meta.url));

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

test('packed core tarball includes runtime contract exports', { timeout: 120_000, concurrency: false }, async () => {
  const packageJson = JSON.parse(await readFile(CORE_PACKAGE_JSON, 'utf8')) as { version: string };
  const tarballPath = path.join(CORE_WORKDIR, `anydocs-core-${packageJson.version}.tgz`);

  await rm(tarballPath, { force: true });

  try {
    await runCommand('pnpm', ['build'], CORE_WORKDIR);
    await runCommand('pnpm', ['pack'], CORE_WORKDIR);
    await access(tarballPath);

    const listing = await runCommand('tar', ['-tzf', tarballPath], CORE_WORKDIR);
    assert.match(listing.stdout, /package\/runtime-contract\.d\.ts/);
    assert.match(listing.stdout, /package\/runtime-contract\.mjs/);
    assert.match(listing.stdout, /package\/dist\/utils\/render-page-content\.d\.ts/);
    assert.match(listing.stdout, /package\/dist\/utils\/render-page-content\.js/);
  } finally {
    await rm(tarballPath, { force: true });
  }
});
