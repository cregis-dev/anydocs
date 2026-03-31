import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { access, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ValidationError } from '../errors/validation-error.ts';
import type { ProjectPathContract } from '../types/project.ts';

const CORE_PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let webRuntimeQueue: Promise<void> = Promise.resolve();
const WEB_RUNTIME_ROOT_ENV = 'ANYDOCS_WEB_RUNTIME_ROOT';
const WEB_RUNTIME_LOCK_DIR = '.anydocs-web-runtime.lock';
const WEB_RUNTIME_LOCK_TIMEOUT_MS = 5 * 60_000;
const WEB_RUNTIME_LOCK_POLL_MS = 250;

function isWebRuntimeRoot(candidate: string) {
  return existsSync(path.join(candidate, 'scripts', 'gen-public-assets.mjs'));
}

function resolveWebPackageRoot() {
  const cwd = process.cwd();
  const configuredRoot = process.env[WEB_RUNTIME_ROOT_ENV]?.trim();
  const candidates = [
    ...(configuredRoot ? [path.resolve(cwd, configuredRoot)] : []),
    cwd,
    path.join(cwd, 'packages', 'web'),
    path.join(path.resolve(CORE_PACKAGE_ROOT, '../../..'), 'packages', 'web'),
    path.resolve(CORE_PACKAGE_ROOT, '../../cli/docs-runtime'),
  ];

  for (const candidate of candidates) {
    if (isWebRuntimeRoot(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    `Unable to locate the docs web runtime. Set ${WEB_RUNTIME_ROOT_ENV} or install a CLI package that includes docs-runtime.`,
  );
}

const BRIDGE_ENV_ALLOWLIST = new Set([
  'CI',
  'COLORTERM',
  'FORCE_COLOR',
  'HOME',
  'LANG',
  'LC_ALL',
  'LC_CTYPE',
  'LOGNAME',
  'PATH',
  'PNPM_HOME',
  'SHELL',
  'TERM',
  'TMPDIR',
  'USER',
  'XDG_CACHE_HOME',
  'XDG_CONFIG_HOME',
]);

export type DocsRuntimeMode = 'export' | 'preview';

type BaseBridgeOptions = {
  projectRoot: string;
  outputRoot?: string;
  stdio?: 'pipe' | 'inherit';
};

export type ExportDocsSiteOptions = BaseBridgeOptions & {
  outputRoot: string;
};

export type StartDocsPreviewServerOptions = BaseBridgeOptions & {
  host?: string;
  port?: number;
  readyPath?: string;
  startTimeoutMs?: number;
};

export type DocsPreviewServerProcess = {
  child: ChildProcess;
  host: string;
  port: number;
  url: string;
  stop: () => Promise<void>;
  waitUntilExit: () => Promise<{ exitCode: number | null; signal: NodeJS.Signals | null }>;
};

function createRuntimeEnv(mode: DocsRuntimeMode, options: BaseBridgeOptions): NodeJS.ProcessEnv {
  const baseEnv = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => BRIDGE_ENV_ALLOWLIST.has(key)),
  );

  return {
    ...baseEnv,
    NODE_ENV: mode === 'export' ? 'production' : 'development',
    ANYDOCS_DOCS_RUNTIME: mode,
    ANYDOCS_DOCS_PROJECT_ROOT: options.projectRoot,
    ...(options.outputRoot ? { ANYDOCS_DOCS_OUTPUT_ROOT: options.outputRoot } : {}),
    ANYDOCS_DISABLE_STUDIO: '1',
  };
}

function formatBridgeFailure(command: string, exitCode: number | null, signal: NodeJS.Signals | null, stderr: string) {
  const details = stderr.trim();
  const suffix = details ? `\n${details}` : '';
  return new Error(`${command} failed (exit=${exitCode ?? 'null'}, signal=${signal ?? 'null'}).${suffix}`);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === 'object' && error !== null && ('code' in error || 'message' in error);
}

function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return isNodeError(error) && error.code === 'EPERM';
  }
}

async function cleanupStaleFilesystemLock(lockDir: string): Promise<void> {
  try {
    const owner = JSON.parse(await readFile(path.join(lockDir, 'owner.json'), 'utf8')) as { pid?: unknown };
    if (typeof owner.pid === 'number' && !isPidAlive(owner.pid)) {
      await rm(lockDir, { recursive: true, force: true });
    }
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      return;
    }

    throw error;
  }
}

async function resolveNodeExecutable(): Promise<string> {
  const override = process.env.ANYDOCS_NODE_BINARY?.trim();
  if (override) {
    if (!path.isAbsolute(override)) {
      return override;
    }

    await access(override);
    return override;
  }

  return 'node';
}

function appendOutputTail(current: string, chunk: string, maxChars: number) {
  const next = current + chunk;
  return next.length > maxChars ? next.slice(-maxChars) : next;
}

function collectChildOutput(child: ChildProcess, maxChars = 32_000) {
  let stdout = '';
  let stderr = '';

  child.stdout?.on('data', (chunk) => {
    stdout = appendOutputTail(stdout, chunk.toString(), maxChars);
  });
  child.stderr?.on('data', (chunk) => {
    stderr = appendOutputTail(stderr, chunk.toString(), maxChars);
  });

  return {
    stdout: () => stdout,
    stderr: () => stderr,
  };
}

function destroyChildPipes(child: ChildProcess) {
  child.stdout?.destroy();
  child.stderr?.destroy();
}

function shellEscapeArg(value: string) {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

async function createBridgeChild(
  mode: DocsRuntimeMode,
  args: string[],
  options: BaseBridgeOptions,
): Promise<ChildProcess> {
  const nodeExecutable = await resolveNodeExecutable();
  const shell = process.env.SHELL || '/bin/zsh';
  const webPackageRoot = resolveWebPackageRoot();
  const webBridgeScript = path.join(webPackageRoot, 'scripts', 'gen-public-assets.mjs');
  const command = ['exec', nodeExecutable, webBridgeScript, mode, ...args].map(shellEscapeArg).join(' ');

  return spawn(shell, ['-lc', command], {
    cwd: webPackageRoot,
    env: createRuntimeEnv(mode, options),
    stdio: options.stdio === 'inherit' ? 'inherit' : 'pipe',
  });
}

function waitForChildExit(child: ChildProcess): Promise<{ exitCode: number | null; signal: NodeJS.Signals | null }> {
  return new Promise((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) {
      destroyChildPipes(child);
      resolve({ exitCode: child.exitCode, signal: child.signalCode });
      return;
    }

    child.once('exit', (exitCode, signal) => {
      destroyChildPipes(child);
      resolve({ exitCode, signal });
    });
  });
}

async function acquireFilesystemWebRuntimeLock(): Promise<() => Promise<void>> {
  const lockDir = path.join(resolveWebPackageRoot(), WEB_RUNTIME_LOCK_DIR);
  const ownerPath = path.join(lockDir, 'owner.json');
  const deadline = Date.now() + WEB_RUNTIME_LOCK_TIMEOUT_MS;

  while (true) {
    try {
      await mkdir(lockDir);
      await writeFile(
        ownerPath,
        JSON.stringify({
          pid: process.pid,
          acquiredAt: new Date().toISOString(),
        }),
        'utf8',
      );

      let released = false;
      return async () => {
        if (released) {
          return;
        }

        released = true;
        await rm(lockDir, { recursive: true, force: true });
      };
    } catch (error) {
      if (!isNodeError(error) || error.code !== 'EEXIST') {
        throw error;
      }

      await cleanupStaleFilesystemLock(lockDir);
      if (Date.now() >= deadline) {
        throw new Error(`Timed out waiting for the shared web runtime lock at "${lockDir}".`);
      }

      await delay(WEB_RUNTIME_LOCK_POLL_MS);
    }
  }
}

async function acquireWebRuntimeLock(): Promise<() => Promise<void>> {
  const previous = webRuntimeQueue;
  let releaseProcessQueue!: () => void;
  webRuntimeQueue = new Promise<void>((resolve) => {
    releaseProcessQueue = resolve;
  });
  await previous;
  const releaseFilesystemLock = await acquireFilesystemWebRuntimeLock();

  let released = false;
  return async () => {
    if (released) {
      return;
    }

    released = true;
    try {
      await releaseFilesystemLock();
    } finally {
      releaseProcessQueue();
    }
  };
}

export async function exportDocsSite(options: ExportDocsSiteOptions): Promise<void> {
  const releaseLock = await acquireWebRuntimeLock();

  try {
    const child = await createBridgeChild('export', [], options);
    const output = collectChildOutput(child);

    if (!child.stdout || !child.stderr) {
      const result = await waitForChildExit(child);
      if (result.exitCode !== 0) {
        throw formatBridgeFailure('Docs site export', result.exitCode, result.signal, '');
      }
      return;
    }

    const result = await waitForChildExit(child);
    if (result.exitCode !== 0) {
      const stderr = [output.stderr().trim(), output.stdout().trim()].filter(Boolean).join('\n');
      throw formatBridgeFailure('Docs site export', result.exitCode, result.signal, stderr);
    }
  } finally {
    await releaseLock();
  }
}

async function pickAvailablePort(host: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, host, () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close(() => reject(new Error('Failed to resolve an available preview port.')));
        return;
      }

      const { port } = address;
      server.close((closeError) => {
        if (closeError) {
          reject(closeError);
          return;
        }

        resolve(port);
      });
    });
  });
}

async function waitForPreviewServerReady(
  child: ChildProcess,
  url: string,
  timeoutMs: number,
): Promise<void> {
  const startedAt = Date.now();
  const output = collectChildOutput(child);

  while (Date.now() - startedAt < timeoutMs) {
    if (child.exitCode !== null) {
      const stderr = [output.stderr().trim(), output.stdout().trim()].filter(Boolean).join('\n');
      throw formatBridgeFailure('Docs preview server', child.exitCode, null, stderr);
    }

    try {
      const response = await fetch(url, { redirect: 'manual' });
      if (response.status >= 200 && response.status < 400) {
        return;
      }
    } catch {
      // Keep polling until timeout or process exit.
    }

    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  child.kill('SIGTERM');
  await waitForChildExit(child);
  throw new Error(`Timed out waiting for docs preview server to become ready at ${url}.`);
}

export async function startDocsPreviewServer(
  options: StartDocsPreviewServerOptions,
): Promise<DocsPreviewServerProcess> {
  const releaseLock = await acquireWebRuntimeLock();

  try {
    const host = options.host ?? '127.0.0.1';
    const port = options.port ?? (await pickAvailablePort(host));
    const readyPath = options.readyPath ?? '/';
    const startTimeoutMs = options.startTimeoutMs ?? 30_000;
    const child = await createBridgeChild(
      'preview',
      ['--hostname', host, '--port', String(port)],
      options,
    );
    const url = `http://${host}:${port}`;
    const readyUrl = new URL(readyPath, `${url}/`).toString();
    const exitPromise = waitForChildExit(child).finally(() => releaseLock());

    await waitForPreviewServerReady(child, readyUrl, startTimeoutMs);

    return {
      child,
      host,
      port,
      url,
      stop: async () => {
        if (child.exitCode !== null) {
          await exitPromise;
          return;
        }

        child.kill('SIGTERM');
        await exitPromise;
      },
      waitUntilExit: () => exitPromise,
    };
  } catch (error) {
    await releaseLock();
    throw error;
  }
}

function isSameOrDescendantPath(candidatePath: string, parentPath: string): boolean {
  const relativePath = path.relative(parentPath, candidatePath);
  return relativePath === '' || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath));
}

export function assertSafeArtifactRoot(paths: ProjectPathContract): void {
  const normalizedArtifactRoot = path.resolve(paths.artifactRoot);
  const normalizedRepoRoot = path.resolve(paths.repoRoot);
  const normalizedProjectRoot = path.resolve(paths.projectRoot);

  if (normalizedArtifactRoot === normalizedRepoRoot || normalizedArtifactRoot === normalizedProjectRoot) {
    throw new ValidationError(
      `Refusing to export the docs site into "${normalizedArtifactRoot}" because that would overwrite the project workspace.`,
      {
        entity: 'artifact-root',
        rule: 'artifact-root-must-not-overwrite-project-workspace',
        remediation: 'Use the default dist directory or pass --output to a dedicated build output directory.',
        metadata: { artifactRoot: normalizedArtifactRoot, repoRoot: normalizedRepoRoot, projectRoot: normalizedProjectRoot },
      },
    );
  }

  const protectedRoots = [
    path.resolve(paths.pagesRoot),
    path.resolve(paths.navigationRoot),
    path.resolve(paths.importsRoot),
  ];

  const conflictingRoot = protectedRoots.find((protectedRoot) =>
    isSameOrDescendantPath(normalizedArtifactRoot, protectedRoot),
  );

  if (!conflictingRoot) {
    return;
  }

  throw new ValidationError(
    `Refusing to export the docs site into "${normalizedArtifactRoot}" because it overlaps source content at "${conflictingRoot}".`,
    {
      entity: 'artifact-root',
      rule: 'artifact-root-must-not-overlap-source-content',
      remediation: 'Write build output to a dedicated directory such as dist/ or another folder outside pages/, navigation/, and imports/.',
      metadata: {
        artifactRoot: normalizedArtifactRoot,
        conflictingRoot,
        repoRoot: normalizedRepoRoot,
        projectRoot: normalizedProjectRoot,
      },
    },
  );
}
