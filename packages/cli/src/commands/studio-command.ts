import { spawn, type ChildProcess } from 'node:child_process';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import path from 'node:path';

import { loadProjectContract } from '@anydocs/core';

import { error, info } from '../output/logger.ts';
import { writeJsonError, writeJsonSuccess } from '../output/structured.ts';
import { resolveStudioRuntimeRoot } from '../runtime/runtime-root.ts';

type StudioCommandOptions = {
  targetDir?: string;
  host?: string;
  port?: number;
  open?: boolean;
  json?: boolean;
};

const STUDIO_READY_TIMEOUT_MS = 60_000;
const require = createRequire(import.meta.url);

function sanitizePathSegment(value: string): string {
  const normalized = value.trim().replace(/[^a-zA-Z0-9._-]+/g, '-');
  return normalized.length > 0 ? normalized : 'default';
}

function resolveStudioDistDir(projectId: string, port: number): string {
  return path.join('.next-cli-studio', `${sanitizePathSegment(projectId)}-${port}`);
}

function resolveNextBin(): string {
  return require.resolve('next/dist/bin/next');
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

function waitForChildExit(child: ChildProcess): Promise<{ exitCode: number | null; signal: NodeJS.Signals | null }> {
  return new Promise((resolve) => {
    child.once('exit', (exitCode, signal) => {
      resolve({ exitCode, signal });
    });
  });
}

function formatChildFailure(command: string, exitCode: number | null, signal: NodeJS.Signals | null, stderr: string) {
  const details = stderr.trim();
  const suffix = details ? `\n${details}` : '';
  return new Error(`${command} failed (exit=${exitCode ?? 'null'}, signal=${signal ?? 'null'}).${suffix}`);
}

async function pickAvailablePort(host: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, host, () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close(() => reject(new Error('Failed to resolve an available Studio port.')));
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

async function waitForStudioReady(child: ChildProcess, studioUrl: string, timeoutMs: number): Promise<void> {
  const startedAt = Date.now();
  const output = collectChildOutput(child);

  while (Date.now() - startedAt < timeoutMs) {
    if (child.exitCode !== null) {
      const stderr = [output.stderr().trim(), output.stdout().trim()].filter(Boolean).join('\n');
      throw formatChildFailure('Studio server', child.exitCode, null, stderr);
    }

    try {
      const response = await fetch(studioUrl, { redirect: 'manual' });
      if (response.status >= 200 && response.status < 400) {
        return;
      }
    } catch {
      // Keep polling until the dev server is ready or exits.
    }

    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  child.kill('SIGTERM');
  await waitForChildExit(child);
  throw new Error(`Timed out waiting for Studio to become ready at ${studioUrl}.`);
}

async function tryOpenBrowser(url: string): Promise<void> {
  let command: string;
  let args: string[];

  if (process.platform === 'darwin') {
    command = 'open';
    args = [url];
  } else if (process.platform === 'win32') {
    command = 'cmd';
    args = ['/c', 'start', '', url];
  } else {
    command = 'xdg-open';
    args = [url];
  }

  await new Promise<void>((resolve) => {
    const child = spawn(command, args, {
      detached: true,
      stdio: 'ignore',
    });

    child.once('error', () => resolve());
    child.once('spawn', () => {
      child.unref();
      resolve();
    });
  });
}

function logStudioSuccess(projectId: string, studioUrl: string) {
  info(`Studio started for project "${projectId}".`);
  info(`Studio URL: ${studioUrl}`);
}

function logStudioFailure(caughtError: unknown, kind: 'startup' | 'shutdown' = 'startup') {
  const label = kind === 'startup' ? 'Studio failed' : 'Studio shutdown failed';
  const message = caughtError instanceof Error ? caughtError.message : String(caughtError);
  error(`${label}: ${message}`);
}

export async function runStudioCommand(options: StudioCommandOptions = {}): Promise<number> {
  const { targetDir, host = '127.0.0.1', open = true, json = false } = options;
  const projectRoot = path.resolve(process.cwd(), targetDir ?? '.');

  try {
    const contractResult = await loadProjectContract(projectRoot);
    if (!contractResult.ok) {
      throw contractResult.error;
    }

    const contract = contractResult.value;
    const runtimeRoot = await resolveStudioRuntimeRoot();
    const nextBin = resolveNextBin();
    const port = options.port ?? (await pickAvailablePort(host));
    const distDir = resolveStudioDistDir(contract.config.projectId, port);
    const child = spawn(process.execPath, [nextBin, 'dev', '--webpack', '--hostname', host, '--port', String(port)], {
      cwd: runtimeRoot,
      env: {
        ...process.env,
        ANYDOCS_NEXT_DIST_DIR: distDir,
        ANYDOCS_STUDIO_MODE: 'cli-single-project',
        ANYDOCS_STUDIO_PROJECT_ROOT: contract.paths.projectRoot,
        ANYDOCS_STUDIO_PROJECT_ID: contract.config.projectId,
      },
      stdio: json ? 'pipe' : 'inherit',
    });
    const studioUrl = new URL('/studio', `http://${host}:${port}/`).toString();
    const exitPromise = waitForChildExit(child);

    await waitForStudioReady(child, studioUrl, STUDIO_READY_TIMEOUT_MS);

    if (json) {
      writeJsonSuccess(
        'studio',
        {
          projectId: contract.config.projectId,
          projectRoot: contract.paths.projectRoot,
          host,
          port,
          url: studioUrl,
          pid: child.pid ?? -1,
        },
        {
          projectId: contract.config.projectId,
          repoRoot: contract.paths.repoRoot,
        },
      );
    } else {
      logStudioSuccess(contract.config.projectId, studioUrl);
      if (open) {
        void tryOpenBrowser(studioUrl);
      }
    }

    let stopping = false;
    const stop = async () => {
      if (stopping) {
        return;
      }

      stopping = true;
      info('Stopping Studio server...');
      child.kill('SIGTERM');
      await exitPromise;
    };

    const handleSignal = () => {
      void stop().catch((caughtError) => {
        logStudioFailure(caughtError, 'shutdown');
        process.exitCode = 1;
      });
    };
    process.once('SIGINT', handleSignal);
    process.once('SIGTERM', handleSignal);

    try {
      const exitResult = await exitPromise;
      return exitResult.exitCode ?? 0;
    } finally {
      process.off('SIGINT', handleSignal);
      process.off('SIGTERM', handleSignal);
    }
  } catch (caughtError: unknown) {
    if (json) {
      writeJsonError('studio', caughtError, { repoRoot: projectRoot });
      return 1;
    }
    logStudioFailure(caughtError);
    return 1;
  }
}
