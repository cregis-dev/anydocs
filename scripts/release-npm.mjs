import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dryRun = process.argv.includes('--dry-run');
const npmCacheDir = path.join(os.tmpdir(), 'anydocs-npm-cache');

const packageDirs = ['packages/core', 'packages/mcp', 'packages/cli'];

function readPackageManifest(relativeDir) {
  const packageJsonPath = path.join(rootDir, relativeDir, 'package.json');
  return JSON.parse(readFileSync(packageJsonPath, 'utf8'));
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? rootDir,
    env: {
      ...process.env,
      npm_config_cache: npmCacheDir,
    },
    stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    encoding: options.capture ? 'utf8' : undefined,
  });

  if (options.allowFailure) {
    return result;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  return result;
}

function isPublished(name, version) {
  const result = run('npm', ['view', `${name}@${version}`, 'version', '--json'], {
    capture: true,
    allowFailure: true,
  });

  if (result.status === 0) {
    return (result.stdout ?? '').trim().length > 0;
  }

  const combinedOutput = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  if (/E404|404 Not Found/.test(combinedOutput)) {
    return false;
  }

  process.stderr.write(combinedOutput);
  process.exit(result.status ?? 1);
}

const packages = packageDirs.map((relativeDir) => {
  const manifest = readPackageManifest(relativeDir);

  return {
    dir: path.join(rootDir, relativeDir),
    relativeDir,
    name: manifest.name,
    version: manifest.version,
    access: manifest.publishConfig?.access ?? 'public',
  };
});

const published = [];
const skipped = [];

for (const pkg of packages) {
  const label = `${pkg.name}@${pkg.version}`;
  process.stdout.write(`\n> ${dryRun ? 'Checking' : 'Publishing'} ${label}\n`);

  if (!dryRun && isPublished(pkg.name, pkg.version)) {
    process.stdout.write(`- Skip: ${label} is already published.\n`);
    skipped.push(label);
    continue;
  }

  // Use pnpm publish so workspace dependencies are rewritten to concrete versions in the packed manifest.
  const publishArgs = ['publish', '--access', pkg.access, '--no-git-checks'];
  if (dryRun) {
    publishArgs.push('--dry-run');
  }

  run('pnpm', publishArgs, { cwd: pkg.dir });
  published.push(label);
}

process.stdout.write('\nRelease summary\n');
if (published.length > 0) {
  process.stdout.write(`- Published: ${published.join(', ')}\n`);
}
if (skipped.length > 0) {
  process.stdout.write(`- Skipped: ${skipped.join(', ')}\n`);
}
if (published.length === 0 && skipped.length === 0) {
  process.stdout.write('- No packages matched the release set.\n');
}
