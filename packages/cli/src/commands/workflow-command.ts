import { loadProjectContract, readWorkflowStandardDefinition } from '@anydocs/core';

import { error, info } from '../output/logger.ts';
import { writeJsonError, writeJsonSuccess } from '../output/structured.ts';
import { resolveRepoRoot } from './read-command-helpers.ts';

type WorkflowCommandOptions = {
  targetDir?: string;
  json?: boolean;
};

export async function runWorkflowInspectCommand(options: WorkflowCommandOptions = {}): Promise<number> {
  const repoRoot = resolveRepoRoot(options.targetDir);
  const contractResult = await loadProjectContract(repoRoot);
  if (!contractResult.ok) {
    if (options.json) {
      writeJsonError('workflow inspect', contractResult.error, { repoRoot });
    } else {
      error(`Workflow inspect failed: ${contractResult.error.message}`);
      error(`Rule: ${contractResult.error.details.rule}`);
      if (contractResult.error.details.remediation) {
        error(`Fix: ${contractResult.error.details.remediation}`);
      }
    }
    return 1;
  }

  try {
    const contract = contractResult.value;
    const workflow = await readWorkflowStandardDefinition(contract.paths.workflowFile);
    if (options.json) {
      writeJsonSuccess(
        'workflow inspect',
        {
          file: contract.paths.workflowFile,
          workflow,
        },
        {
          projectId: contract.config.projectId,
          repoRoot,
        },
      );
    } else {
      info(`Workflow standard: ${workflow.standardId}`);
      info(`Workflow file: ${contract.paths.workflowFile}`);
      info(`Project contract version: ${workflow.projectContractVersion}`);
      info(`Enabled languages: ${workflow.enabledLanguages.join(', ')}`);
      info(`Workflow steps: ${workflow.orchestration.workflowSteps.join(', ')}`);
    }
    return 0;
  } catch (caughtError: unknown) {
    if (options.json) {
      writeJsonError('workflow inspect', caughtError, { repoRoot });
    } else {
      const message = caughtError instanceof Error ? caughtError.message : String(caughtError);
      error(`Workflow inspect failed: ${message}`);
    }
    return 1;
  }
}
