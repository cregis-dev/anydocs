import { loadProjectContract } from '../fs/content-repository.ts';
import type { WorkflowCompatibilityAssessment } from '../types/workflow-standard.ts';
import {
  createWorkflowStandardDefinition,
  readWorkflowStandardDefinition,
} from './workflow-standard-service.ts';
import { ValidationError } from '../errors/validation-error.ts';

function createWorkflowCompatibilityError(
  rule: string,
  remediation: string,
  metadata?: Record<string, unknown>,
): ValidationError {
  return new ValidationError(`Workflow compatibility validation failed for rule "${rule}".`, {
    entity: 'workflow-compatibility',
    rule,
    remediation,
    metadata,
  });
}

export async function assessWorkflowForwardCompatibility(
  repoRoot: string,
  projectId?: string,
): Promise<WorkflowCompatibilityAssessment> {
  const contractResult = await loadProjectContract(repoRoot, projectId);
  if (!contractResult.ok) {
    throw contractResult.error;
  }

  const contract = contractResult.value;
  const persisted = await readWorkflowStandardDefinition(contract.paths.workflowFile);
  const expected = createWorkflowStandardDefinition(contract);

  if (persisted.standardId !== expected.standardId) {
    throw createWorkflowCompatibilityError(
      'workflow-standard-compatible-standard-id',
      'Regenerate the workflow standard so it matches the canonical phase 1 standard id.',
      { expected: expected.standardId, received: persisted.standardId },
    );
  }

  if (persisted.projectContractVersion !== expected.projectContractVersion) {
    throw createWorkflowCompatibilityError(
      'workflow-standard-compatible-project-contract-version',
      'Regenerate the workflow standard so it matches the current project contract version.',
      { expected: expected.projectContractVersion, received: persisted.projectContractVersion },
    );
  }

  const persistedRequiredFields = [
    ...persisted.contentModel.projectConfigFields,
    ...persisted.contentModel.pageRequiredFields,
    ...persisted.contentModel.navigationRequiredFields,
  ];
  const expectedRequiredFields = [
    ...expected.contentModel.projectConfigFields,
    ...expected.contentModel.pageRequiredFields,
    ...expected.contentModel.navigationRequiredFields,
  ];
  const missingRequiredField = expectedRequiredFields.find((field) => !persistedRequiredFields.includes(field));
  if (missingRequiredField) {
    throw createWorkflowCompatibilityError(
      'workflow-standard-compatible-required-fields',
      'Regenerate the workflow standard so it includes the canonical required content-model fields.',
      { missingRequiredField },
    );
  }

  const missingStep = expected.orchestration.workflowSteps.find(
    (step) => !persisted.orchestration.workflowSteps.includes(step),
  );
  if (missingStep) {
    throw createWorkflowCompatibilityError(
      'workflow-standard-compatible-workflow-steps',
      'Regenerate the workflow standard so it preserves the canonical orchestration steps.',
      { missingStep },
    );
  }

  return {
    compatible: true,
    standardId: persisted.standardId,
    projectContractVersion: persisted.projectContractVersion,
    reusableAcrossProjects: true,
    futureCompatibleWithoutReinitialization: true,
    externalAutomationReady: true,
    validatedAt: new Date().toISOString(),
  };
}
