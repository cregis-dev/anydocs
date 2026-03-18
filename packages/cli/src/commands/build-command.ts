import path from 'node:path';

import {
  runBuildWorkflow,
  runProjectWatchLoop,
  type BuildWorkflowResult,
  type ProjectWatchRunContext,
  ValidationError,
} from '@anydocs/core';

import { formatCliCommand } from '../help.ts';
import { error, info } from '../output/logger.ts';

type BuildCommandOptions = {
  targetDir?: string;
  watch?: boolean;
  output?: string;
};

type BuildFailureKind = 'startup' | 'rerun';

function logBuildSuccess(result: BuildWorkflowResult, context?: ProjectWatchRunContext) {
  if (context?.reason === 'change' && context.trigger) {
    const changeSource = context.trigger.filename
      ? path.join(context.trigger.targetPath, context.trigger.filename)
      : context.trigger.targetPath;
    info(`Change detected (${context.trigger.eventType}): ${changeSource}`);
  }

  info(`Build workflow validated project "${result.projectId}".`);
  info(`Static site root: ${result.artifactRoot}`);
  info(`Entrypoint: ${result.entryHtmlFile}`);
  info(`Default docs route: ${result.defaultDocsPath}`);
  for (const language of result.languages) {
    info(
      `- ${language.lang}: ${language.totalPages} pages, ${language.publishedPages} published, ${language.navigationItems} nav items`,
    );
  }
}

function logBuildFailure(caughtError: unknown, kind: BuildFailureKind = 'startup') {
  const label = kind === 'startup' ? 'Build failed' : 'Build rerun failed';

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

export async function runBuildCommand(options: BuildCommandOptions = {}): Promise<number> {
  const { targetDir, watch = false, output } = options;
  const repoRoot = path.resolve(process.cwd(), targetDir ?? '.');

  try {
    if (!watch) {
      const result = await runBuildWorkflow({ repoRoot, outputDir: output });
      logBuildSuccess(result);
      info(`Next: preview locally with ${formatCliCommand(['preview', targetDir ?? '.'])}`);
      return 0;
    }

    const controller = new AbortController();
    const stop = () => {
      if (!controller.signal.aborted) {
        info('Stopping build watch mode...');
        controller.abort();
      }
    };
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);

    try {
      await runProjectWatchLoop({
        repoRoot,
        signal: controller.signal,
        execute: (ctx) => runBuildWorkflow({ repoRoot: ctx.repoRoot, outputDir: output }),
        onSuccess: async (result, context) => {
          logBuildSuccess(result, context);
        },
        onError: async (caughtError) => {
          logBuildFailure(caughtError, 'rerun');
        },
      });
    } finally {
      process.off('SIGINT', stop);
      process.off('SIGTERM', stop);
    }

    return 0;
  } catch (caughtError: unknown) {
    logBuildFailure(caughtError);
    return 1;
  }
}
