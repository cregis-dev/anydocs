import path from 'node:path';

import { initializeProject, ValidationError } from '@anydocs/core';

import { formatCliCommand } from '../help.ts';
import { error, info } from '../output/logger.ts';
import { writeJsonError, writeJsonSuccess } from '../output/structured.ts';

export type InitCommandOptions = {
  targetDir?: string;
  projectId?: string;
  projectName?: string;
  defaultLanguage?: 'en' | 'zh';
  languages?: Array<'en' | 'zh'>;
  agent?: 'codex' | 'claude-code';
  json?: boolean;
};

export async function runInitCommand(options: InitCommandOptions = {}): Promise<number> {
  const {
    targetDir,
    projectId,
    projectName,
    defaultLanguage,
    languages,
    agent,
    json = false,
  } = options;
  const repoRoot = path.resolve(process.cwd(), targetDir ?? '.');

  try {
    const result = await initializeProject({
      repoRoot,
      projectId,
      projectName,
      defaultLanguage,
      languages,
      agent,
    });

    if (json) {
      writeJsonSuccess(
        'init',
        {
          projectId: result.contract.config.projectId,
          projectRoot: result.contract.paths.projectRoot,
          configFile: result.contract.paths.configFile,
          workflowFile: result.contract.paths.workflowFile,
          languages: result.contract.config.languages,
          createdFiles: result.createdFiles,
        },
        {
          projectId: result.contract.config.projectId,
          repoRoot,
        },
      );
      return 0;
    }

    info(`Initialized Anydocs project at ${result.contract.paths.projectRoot}`);
    info(`Config: ${result.contract.paths.configFile}`);
    info(`Project ID: ${result.contract.config.projectId}`);
    info(`Languages: ${result.contract.config.languages.join(', ')}`);
    info('Created files:');
    for (const file of result.createdFiles) {
      info(`- ${path.relative(repoRoot, file) || path.basename(file)}`);
    }
    info('Next:');
    info(`- Build the project: ${formatCliCommand(['build', targetDir ?? '.'])}`);
    info(`- Preview it locally: ${formatCliCommand(['preview', targetDir ?? '.'])}`);

    return 0;
  } catch (caughtError: unknown) {
    if (caughtError instanceof ValidationError) {
      if (json) {
        writeJsonError('init', caughtError, { repoRoot });
        return 1;
      }
      error(`Init failed: ${caughtError.message}`);
      error(`Rule: ${caughtError.details.rule}`);
      if (caughtError.details.remediation) {
        error(`Fix: ${caughtError.details.remediation}`);
      }
      return 1;
    }

    const message = caughtError instanceof Error ? caughtError.message : String(caughtError);
    if (json) {
      writeJsonError('init', caughtError, { repoRoot });
      return 1;
    }
    error(`Init failed: ${message}`);
    return 1;
  }
}
