import path from 'node:path';

import { initializeProject, ValidationError } from '@anydocs/core';

import { formatCliCommand } from '../help.ts';
import { error, info } from '../output/logger.ts';

export async function runInitCommand(targetDir?: string): Promise<number> {
  const repoRoot = path.resolve(process.cwd(), targetDir ?? '.');

  try {
    const result = await initializeProject({ repoRoot });

    info(`Initialized Anydocs project at ${result.contract.paths.projectRoot}`);
    info(`Config: ${result.contract.paths.configFile}`);
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
      error(`Init failed: ${caughtError.message}`);
      error(`Rule: ${caughtError.details.rule}`);
      if (caughtError.details.remediation) {
        error(`Fix: ${caughtError.details.remediation}`);
      }
      return 1;
    }

    const message = caughtError instanceof Error ? caughtError.message : String(caughtError);
    error(`Init failed: ${message}`);
    return 1;
  }
}
