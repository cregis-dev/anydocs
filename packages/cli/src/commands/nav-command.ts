import path from 'node:path';

import { createDocsRepository, loadNavigation, loadProjectContract } from '@anydocs/core';

import { error, info } from '../output/logger.ts';
import { writeJsonError, writeJsonSuccess } from '../output/structured.ts';
import { assertEnabledLanguage, resolveRepoRoot } from './read-command-helpers.ts';

type NavigationCommandOptions = {
  targetDir?: string;
  lang?: string;
  json?: boolean;
};

export async function runNavigationGetCommand(options: NavigationCommandOptions = {}): Promise<number> {
  const repoRoot = resolveRepoRoot(options.targetDir);
  const contractResult = await loadProjectContract(repoRoot);
  if (!contractResult.ok) {
    if (options.json) {
      writeJsonError('nav get', contractResult.error, { repoRoot });
    } else {
      error(`Nav get failed: ${contractResult.error.message}`);
      error(`Rule: ${contractResult.error.details.rule}`);
      if (contractResult.error.details.remediation) {
        error(`Fix: ${contractResult.error.details.remediation}`);
      }
    }
    return 1;
  }

  try {
    const contract = contractResult.value;
    const lang = assertEnabledLanguage(contract, options.lang);
    const repository = createDocsRepository(contract.paths.projectRoot);
    const navigation = await loadNavigation(repository, lang);
    const file = path.join(contract.paths.navigationRoot, `${lang}.json`);

    if (options.json) {
      writeJsonSuccess(
        'nav get',
        {
          file,
          navigation,
        },
        {
          projectId: contract.config.projectId,
          repoRoot,
        },
      );
    } else {
      info(`Navigation file: ${file}`);
      info(`Version: ${navigation.version}`);
      info(`Top-level items: ${navigation.items.length}`);
    }

    return 0;
  } catch (caughtError: unknown) {
    if (options.json) {
      writeJsonError('nav get', caughtError, { repoRoot });
    } else {
      const message = caughtError instanceof Error ? caughtError.message : String(caughtError);
      error(`Nav get failed: ${message}`);
    }
    return 1;
  }
}
