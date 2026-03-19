import {
  assessWorkflowForwardCompatibility,
  loadProjectContract,
  validateProjectContract,
  type ProjectContract,
} from '@anydocs/core';

import { error, info } from '../output/logger.ts';
import { writeJsonError, writeJsonSuccess } from '../output/structured.ts';
import { resolveRepoRoot } from './read-command-helpers.ts';

type ProjectCommandOptions = {
  targetDir?: string;
  json?: boolean;
};

function printProjectSummary(contract: ProjectContract): void {
  info(`Project "${contract.config.projectId}" is valid.`);
  info(`Project root: ${contract.paths.projectRoot}`);
  info(`Config: ${contract.paths.configFile}`);
  info(`Workflow: ${contract.paths.workflowFile}`);
  info(`Default language: ${contract.config.defaultLanguage}`);
  info(`Enabled languages: ${contract.config.languages.join(', ')}`);
}

export async function runProjectInspectCommand(options: ProjectCommandOptions = {}): Promise<number> {
  const repoRoot = resolveRepoRoot(options.targetDir);
  const contractResult = await loadProjectContract(repoRoot);
  if (!contractResult.ok) {
    if (options.json) {
      writeJsonError('project inspect', contractResult.error, { repoRoot });
    } else {
      error(`Project inspect failed: ${contractResult.error.message}`);
      error(`Rule: ${contractResult.error.details.rule}`);
      if (contractResult.error.details.remediation) {
        error(`Fix: ${contractResult.error.details.remediation}`);
      }
    }
    return 1;
  }

  const contract = contractResult.value;
  const data = {
    config: contract.config,
    paths: contract.paths,
  };

  if (options.json) {
    writeJsonSuccess('project inspect', data, {
      projectId: contract.config.projectId,
      repoRoot,
    });
  } else {
    printProjectSummary(contract);
  }

  return 0;
}

export async function runProjectValidateCommand(options: ProjectCommandOptions = {}): Promise<number> {
  const repoRoot = resolveRepoRoot(options.targetDir);
  const configResult = await validateProjectContract(repoRoot);
  if (!configResult.ok) {
    if (options.json) {
      writeJsonError('project validate', configResult.error, { repoRoot });
    } else {
      error(`Project validate failed: ${configResult.error.message}`);
      error(`Rule: ${configResult.error.details.rule}`);
      if (configResult.error.details.remediation) {
        error(`Fix: ${configResult.error.details.remediation}`);
      }
    }
    return 1;
  }

  try {
    const compatibility = await assessWorkflowForwardCompatibility(repoRoot);
    const data = {
      valid: true,
      config: configResult.value,
      workflowCompatibility: compatibility,
    };

    if (options.json) {
      writeJsonSuccess('project validate', data, {
        projectId: configResult.value.projectId,
        repoRoot,
      });
    } else {
      info(`Project "${configResult.value.projectId}" is valid and workflow-compatible.`);
      info(`Default language: ${configResult.value.defaultLanguage}`);
      info(`Enabled languages: ${configResult.value.languages.join(', ')}`);
      info(`Workflow standard: ${compatibility.standardId}`);
      info(`Validated at: ${compatibility.validatedAt}`);
    }

    return 0;
  } catch (caughtError: unknown) {
    if (options.json) {
      writeJsonError('project validate', caughtError, { repoRoot });
    } else {
      const message = caughtError instanceof Error ? caughtError.message : String(caughtError);
      error(`Project validate failed: ${message}`);
    }
    return 1;
  }
}

export async function runProjectPathsCommand(options: ProjectCommandOptions = {}): Promise<number> {
  const repoRoot = resolveRepoRoot(options.targetDir);
  const contractResult = await loadProjectContract(repoRoot);
  if (!contractResult.ok) {
    if (options.json) {
      writeJsonError('project paths', contractResult.error, { repoRoot });
    } else {
      error(`Project paths failed: ${contractResult.error.message}`);
      error(`Rule: ${contractResult.error.details.rule}`);
      if (contractResult.error.details.remediation) {
        error(`Fix: ${contractResult.error.details.remediation}`);
      }
    }
    return 1;
  }

  const contract = contractResult.value;
  if (options.json) {
    writeJsonSuccess('project paths', contract.paths, {
      projectId: contract.config.projectId,
      repoRoot,
    });
  } else {
    info(`Project root: ${contract.paths.projectRoot}`);
    info(`Config: ${contract.paths.configFile}`);
    info(`Workflow: ${contract.paths.workflowFile}`);
    info(`Pages root: ${contract.paths.pagesRoot}`);
    info(`Navigation root: ${contract.paths.navigationRoot}`);
    info(`Artifact root: ${contract.paths.artifactRoot}`);
    info(`Machine-readable root: ${contract.paths.machineReadableRoot}`);
  }

  return 0;
}
