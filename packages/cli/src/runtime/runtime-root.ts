import { existsSync } from 'node:fs';
import { cp, mkdir, mkdtemp, rm, symlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CLI_PACKAGE_ROOT = path.dirname(fileURLToPath(new URL('../../package.json', import.meta.url)));
const TEMP_RUNTIME_ROOT = path.join(os.tmpdir(), 'anydocs-cli-runtime');

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

function isDocsRuntimeRoot(candidate: string) {
  return existsSync(path.join(candidate, 'scripts', 'gen-public-assets.mjs'));
}

function isStudioRuntimeRoot(candidate: string) {
  return existsSync(path.join(candidate, 'next.config.mjs')) && existsSync(path.join(candidate, 'app', 'studio', 'page.tsx'));
}

export async function materializeRuntimeRoot(runtimeRoot: string, runtimeName: 'docs' | 'studio'): Promise<string> {
  if (!isInsideNodeModules(runtimeRoot)) {
    return runtimeRoot;
  }

  await mkdir(TEMP_RUNTIME_ROOT, { recursive: true });
  const targetRoot = await mkdtemp(path.join(TEMP_RUNTIME_ROOT, `${runtimeName}-runtime-`));
  await cp(runtimeRoot, targetRoot, {
    recursive: true,
    force: true,
    filter: (source) => {
      const base = path.basename(source);
      return base !== '.next' && !base.startsWith('.next-cli-');
    },
  });
  const packagedNodeModulesRoot = resolvePackagedInstallNodeModulesRoot(runtimeRoot);
  await symlink(packagedNodeModulesRoot, path.join(targetRoot, 'node_modules'), 'dir');

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
    path.join(CLI_PACKAGE_ROOT, 'studio-runtime'),
  ];

  for (const candidate of candidates) {
    if (isStudioRuntimeRoot(candidate)) {
      return materializeRuntimeRoot(candidate, 'studio');
    }
  }

  throw new Error('Unable to locate the Studio runtime. Expected a packaged or local cli studio-runtime.');
}
