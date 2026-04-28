import { existsSync, realpathSync } from 'node:fs';
import { cp, lstat, mkdir, mkdtemp, readFile, rm, symlink, unlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CLI_PACKAGE_ROOT = path.dirname(fileURLToPath(new URL('../../package.json', import.meta.url)));
const TEMP_RUNTIME_ROOT = path.join(os.tmpdir(), 'anydocs-cli-runtime');
const FORCE_MATERIALIZE_RUNTIME_ENV = 'ANYDOCS_FORCE_MATERIALIZE_RUNTIME';
const SYMLINK_MANIFEST_FILE = '.anydocs-symlinks.json';

export function isInsideNodeModules(candidate: string) {
  return candidate.split(path.sep).includes('node_modules');
}

function resolvePackagedInstallNodeModulesRoot(runtimeRoot: string): string {
  const segments = runtimeRoot.split(path.sep);
  const nodeModulesIndex = segments.lastIndexOf('node_modules');
  if (nodeModulesIndex === -1) {
    throw new Error(`Unable to determine the packaged install root for "${runtimeRoot}".`);
  }

  return segments.slice(0, nodeModulesIndex + 1).join(path.sep) || path.sep;
}

function resolveRuntimeNodeModulesRoot(runtimeRoot: string): string {
  if (isInsideNodeModules(runtimeRoot)) {
    return resolvePackagedInstallNodeModulesRoot(runtimeRoot);
  }

  const localNodeModules = path.join(runtimeRoot, 'node_modules');
  if (existsSync(localNodeModules)) {
    return realpathSync(localNodeModules);
  }

  const siblingNodeModules = path.join(runtimeRoot, '..', 'node_modules');
  if (existsSync(siblingNodeModules)) {
    return realpathSync(siblingNodeModules);
  }

  throw new Error(`Unable to determine the packaged install root for "${runtimeRoot}".`);
}

function shouldMaterializeRuntimeRoot(runtimeRoot: string): boolean {
  return isInsideNodeModules(runtimeRoot) || process.env[FORCE_MATERIALIZE_RUNTIME_ENV] === '1';
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await lstat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function restorePnpmSymlinks(nodeModulesRoot: string): Promise<void> {
  const manifestPath = path.join(nodeModulesRoot, SYMLINK_MANIFEST_FILE);
  if (!(await pathExists(manifestPath))) {
    return;
  }

  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as {
    version?: number;
    symlinks?: Array<{ path: string; target: string }>;
  };

  if (manifest.version !== 1 || !Array.isArray(manifest.symlinks)) {
    return;
  }

  for (const link of manifest.symlinks) {
    if (!link.path || !link.target) {
      continue;
    }

    const linkPath = path.join(nodeModulesRoot, link.path);
    if (path.relative(nodeModulesRoot, linkPath).startsWith('..')) {
      continue;
    }

    await mkdir(path.dirname(linkPath), { recursive: true });
    if (await pathExists(linkPath)) {
      await unlink(linkPath).catch(() => undefined);
    }
    if (!(await pathExists(linkPath))) {
      await symlink(link.target, linkPath, 'dir');
    }
  }
}

function isDocsRuntimeRoot(candidate: string) {
  return existsSync(path.join(candidate, 'scripts', 'gen-public-assets.mjs'));
}

function isStudioRuntimeRoot(candidate: string) {
  return existsSync(path.join(candidate, 'next.config.mjs')) && existsSync(path.join(candidate, 'app', 'studio', 'page.tsx'));
}

export async function materializeRuntimeRoot(runtimeRoot: string, runtimeName: 'docs' | 'studio'): Promise<string> {
  if (!shouldMaterializeRuntimeRoot(runtimeRoot)) {
    return runtimeRoot;
  }

  await mkdir(TEMP_RUNTIME_ROOT, { recursive: true });
  const targetRoot = await mkdtemp(path.join(TEMP_RUNTIME_ROOT, `${runtimeName}-runtime-`));
  await cp(runtimeRoot, targetRoot, {
    recursive: true,
    force: true,
    filter: (source) => {
      const base = path.basename(source);
      return base !== 'node_modules' && base !== '.next' && !base.startsWith('.next-cli-');
    },
  });
  const packagedNodeModulesRoot = resolveRuntimeNodeModulesRoot(runtimeRoot);
  await cp(packagedNodeModulesRoot, path.join(targetRoot, 'node_modules'), {
    recursive: true,
    force: true,
    dereference: false,
  });
  await restorePnpmSymlinks(path.join(targetRoot, 'node_modules'));

  const cleanup = () => {
    void rm(targetRoot, { recursive: true, force: true });
  };

  process.once('exit', cleanup);
  process.once('SIGINT', cleanup);
  process.once('SIGTERM', cleanup);
  return targetRoot;
}

export async function resolveDocsRuntimeRoot(): Promise<string> {
  const candidates = [
    path.resolve(CLI_PACKAGE_ROOT, '../web'),
    path.join(CLI_PACKAGE_ROOT, 'docs-runtime'),
    process.cwd(),
    path.join(process.cwd(), 'packages', 'web'),
  ];

  for (const candidate of candidates) {
    if (isDocsRuntimeRoot(candidate)) {
      return materializeRuntimeRoot(candidate, 'docs');
    }
  }

  throw new Error('Unable to locate the docs runtime. Expected a packaged docs-runtime or a local packages/web workspace.');
}

export async function configureDocsRuntimeEnv(): Promise<string> {
  const runtimeRoot = await resolveDocsRuntimeRoot();
  process.env.ANYDOCS_WEB_RUNTIME_ROOT = runtimeRoot;
  return runtimeRoot;
}

export async function resolveStudioRuntimeRoot(): Promise<string> {
  const candidates = [
    path.resolve(CLI_PACKAGE_ROOT, '../web'),
    path.join(CLI_PACKAGE_ROOT, 'studio-runtime'),
    process.cwd(),
    path.join(process.cwd(), 'packages', 'web'),
  ];

  for (const candidate of candidates) {
    if (isStudioRuntimeRoot(candidate)) {
      return materializeRuntimeRoot(candidate, 'studio');
    }
  }

  throw new Error('Unable to locate the Studio runtime. Expected a packaged or local cli studio-runtime.');
}
