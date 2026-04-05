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

function normalizeOptionalString(value?: string): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function inferProjectId(value: string): string | undefined {
  const normalized = value
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized.length > 0 ? normalized : undefined;
}

function inferProjectName(value: string): string | undefined {
  const words = value
    .trim()
    .split(/[^A-Za-z0-9]+/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  if (words.length === 0) {
    return undefined;
  }

  return words
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

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
  const inferredSource = normalizeOptionalString(projectName) ?? path.basename(repoRoot);
  const resolvedProjectId = normalizeOptionalString(projectId) ?? inferProjectId(inferredSource);
  const resolvedProjectName = normalizeOptionalString(projectName) ?? inferProjectName(path.basename(repoRoot));

  try {
    const result = await initializeProject({
      repoRoot,
      projectId: resolvedProjectId,
      projectName: resolvedProjectName,
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
