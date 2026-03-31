import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { access, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const CLI_WORKDIR = fileURLToPath(new URL('..', import.meta.url));
const CLI_PACKAGE_JSON = fileURLToPath(new URL('../package.json', import.meta.url));

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
