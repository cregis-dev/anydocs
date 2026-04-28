import path from 'node:path';
import { spawn } from 'node:child_process';

import {
  runPreviewWorkflow,
  type PreviewWorkflowResult,
  ValidationError,
} from '@anydocs/core';

import { error, info } from '../output/logger.ts';
import { writeJsonError, writeJsonSuccess } from '../output/structured.ts';
import { configureDocsRuntimeEnv } from '../runtime/runtime-root.ts';

type PreviewCommandOptions = {
  targetDir?: string;
  watch?: boolean;
  open?: boolean;
  json?: boolean;
};

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

type PreviewFailureKind = 'startup' | 'shutdown';

function logPreviewSuccess(result: PreviewWorkflowResult) {
  info(`Preview server started for project "${result.projectId}".`);
  info(`Preview URL: ${result.url}${result.docsPath}`);
  info(`Published pages: ${result.publishedPages}`);
}

function logPreviewFailure(caughtError: unknown, kind: PreviewFailureKind = 'startup') {
  const label = kind === 'startup' ? 'Preview failed' : 'Preview shutdown failed';

  if (caughtError instanceof ValidationError) {
    error(`${label}: ${caughtError.message}`);
    error(`Rule: ${caughtError.details.rule}`);
    if (caughtError.details.remediation) {
      error(`Fix: ${caughtError.details.remediation}`);
    }
    return;
  }

  const message = caughtError instanceof Error ? caughtError.message : String(caughtError);
  error(`${label}: ${message}`);
}

export async function runPreviewCommand(options: PreviewCommandOptions = {}): Promise<number> {
  const { targetDir, watch = false, open = true, json = false } = options;
  const repoRoot = path.resolve(process.cwd(), targetDir ?? '.');

  try {
    await configureDocsRuntimeEnv();

    if (watch) {
      info('Preview runs in live mode by default; --watch is kept as a compatibility flag.');
    }

    const result = await runPreviewWorkflow({ repoRoot, stdio: json ? 'pipe' : 'inherit' });
    if (json) {
      writeJsonSuccess(
        'preview',
        {
          projectId: result.projectId,
          host: result.host,
          port: result.port,
          url: result.url,
          docsPath: result.docsPath,
          previewUrl: `${result.url}${result.docsPath}`,
          publishedPages: result.publishedPages,
          pid: result.pid,
        },
        {
          projectId: result.projectId,
          repoRoot,
        },
      );
    } else {
      logPreviewSuccess(result);
      if (open) {
        void tryOpenBrowser(`${result.url}${result.docsPath}`);
      }
    }

    let stopping = false;
    const stop = async () => {
      if (stopping) {
        return;
      }

      stopping = true;
      info('Stopping preview server...');
      await result.stop();
    };

    const handleSignal = (signal: NodeJS.Signals) => {
      void stop().catch((caughtError) => {
        logPreviewFailure(caughtError, 'shutdown');
        process.exitCode = 1;
      });
    };
    process.once('SIGINT', handleSignal);
    process.once('SIGTERM', handleSignal);

    try {
      const exitResult = await result.waitUntilExit();
      return exitResult.exitCode ?? 0;
    } finally {
      process.off('SIGINT', handleSignal);
      process.off('SIGTERM', handleSignal);
    }
  } catch (caughtError: unknown) {
    if (json) {
      writeJsonError('preview', caughtError, { repoRoot });
      return 1;
    }
    logPreviewFailure(caughtError);
    return 1;
  }
}
