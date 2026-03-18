import path from 'node:path';
import { readFile } from 'node:fs/promises';

import { ValidationError } from '../errors/validation-error.ts';
import { PAGE_STATUSES } from '../types/docs.ts';
import type {
  WorkflowStandardDefinition,
  WorkflowStandardExport,
  WorkflowStandardFile,
} from '../types/workflow-standard.ts';
import type { ProjectContract } from '../types/project.ts';

function relativeToRepo(contract: ProjectContract, targetPath: string): string {
  return path.relative(contract.paths.repoRoot, targetPath) || '.';
}

function createSourceFiles(contract: ProjectContract): WorkflowStandardFile[] {
  const files: WorkflowStandardFile[] = [
    {
      id: 'projectConfig',
      path: relativeToRepo(contract, contract.paths.configFile),
      format: 'json',
      required: true,
      writable: true,
      generated: false,
      description: 'Canonical project configuration for authoring, build, and preview.',
    },
    {
      id: 'workflowStandard',
      path: relativeToRepo(contract, contract.paths.workflowFile),
      format: 'json',
      required: true,
      writable: true,
      generated: false,
      description: 'Reusable workflow contract for external automation and future AI-native flows.',
    },
  ];

  for (const language of contract.config.languages) {
    const roots = contract.paths.languageRoots[language];

    files.push({
      id: 'navigation',
      path: relativeToRepo(contract, roots.navigationFile),
      format: 'json',
      required: true,
      writable: true,
      generated: false,
      description: `Navigation tree for ${language}.`,
    });
    files.push({
      id: 'page',
      path: relativeToRepo(contract, path.join(roots.pagesDir, '{pageId}.json')),
      format: 'json',
      required: true,
      writable: true,
      generated: false,
      description: `Page document pattern for ${language}.`,
    });
  }

  return files;
}

function createGeneratedArtifacts(contract: ProjectContract): WorkflowStandardFile[] {
  const artifacts: WorkflowStandardFile[] = [
    {
      id: 'llms',
      path: relativeToRepo(contract, contract.paths.llmsFile),
      format: 'text',
      required: false,
      writable: false,
      generated: true,
      description: 'AI-friendly published artifact generated from published content only.',
    },
    {
      id: 'machineReadableRoot',
      path: relativeToRepo(contract, contract.paths.machineReadableRoot),
      format: 'directory',
      required: false,
      writable: false,
      generated: true,
      description: 'Machine-readable published artifacts generated from canonical publication rules.',
    },
    {
      id: 'machineReadableIndex',
      path: relativeToRepo(contract, path.join(contract.paths.machineReadableRoot, 'index.json')),
      format: 'json',
      required: false,
      writable: false,
      generated: true,
      description: 'Stable machine-readable artifact index for external AI and automation consumers.',
    },
  ];

  for (const language of contract.config.languages) {
    artifacts.push({
      id: 'searchIndex',
      path: relativeToRepo(contract, contract.paths.languageRoots[language].searchIndexFile),
      format: 'json',
      required: false,
      writable: false,
      generated: true,
      description: `Static search index for ${language}.`,
    });
  }

  return artifacts;
}

function createWorkflowValidationError(
  rule: string,
  remediation: string,
  metadata?: Record<string, unknown>,
): ValidationError {
  return new ValidationError(`Workflow standard validation failed for rule "${rule}".`, {
    entity: 'workflow-standard',
    rule,
    remediation,
    metadata,
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertStringArray(
  value: unknown,
  rule: string,
  remediation: string,
): asserts value is string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string' || entry.trim().length === 0)) {
    throw createWorkflowValidationError(rule, remediation, { received: value });
  }
}

export function validateWorkflowStandardDefinition(input: unknown): WorkflowStandardDefinition {
  if (!isRecord(input)) {
    throw createWorkflowValidationError(
      'workflow-standard-object',
      'Ensure anydocs.workflow.json contains a JSON object matching the canonical workflow standard definition.',
      { received: input },
    );
  }

  if (input.version !== 1) {
    throw createWorkflowValidationError(
      'workflow-standard-version',
      'Regenerate anydocs.workflow.json with the current anydocs init or workflow export logic.',
      { received: input.version },
    );
  }

  if (input.standardId !== 'anydocs-phase-1') {
    throw createWorkflowValidationError(
      'workflow-standard-id',
      'Use the canonical anydocs-phase-1 workflow standard id.',
      { received: input.standardId },
    );
  }

  if (input.projectContractVersion !== 1) {
    throw createWorkflowValidationError(
      'workflow-standard-project-contract-version',
      'Use a workflow standard generated from the current project contract version.',
      { received: input.projectContractVersion },
    );
  }

  if (input.localFirst !== true || input.uiIndependent !== true) {
    throw createWorkflowValidationError(
      'workflow-standard-core-flags',
      'Preserve localFirst and uiIndependent as true for the phase 1 workflow standard.',
      { localFirst: input.localFirst, uiIndependent: input.uiIndependent },
    );
  }

  assertStringArray(
    input.supportedLanguages,
    'workflow-standard-supported-languages',
    'List supported languages as non-empty string identifiers in anydocs.workflow.json.',
  );
  assertStringArray(
    input.enabledLanguages,
    'workflow-standard-enabled-languages',
    'List enabled languages as non-empty string identifiers in anydocs.workflow.json.',
  );
  assertStringArray(
    input.publicationStatuses,
    'workflow-standard-publication-statuses',
    'List publication statuses as non-empty string identifiers in anydocs.workflow.json.',
  );
  assertStringArray(
    input.publishedStatuses,
    'workflow-standard-published-statuses',
    'List published statuses as non-empty string identifiers in anydocs.workflow.json.',
  );

  if (!Array.isArray(input.sourceFiles) || input.sourceFiles.some((file) => !isRecord(file))) {
    throw createWorkflowValidationError(
      'workflow-standard-source-files',
      'Define sourceFiles as an array of workflow standard file descriptors.',
      { received: input.sourceFiles },
    );
  }

  if (!Array.isArray(input.generatedArtifacts) || input.generatedArtifacts.some((file) => !isRecord(file))) {
    throw createWorkflowValidationError(
      'workflow-standard-generated-artifacts',
      'Define generatedArtifacts as an array of workflow standard file descriptors.',
      { received: input.generatedArtifacts },
    );
  }

  if (!isRecord(input.contentModel)) {
    throw createWorkflowValidationError(
      'workflow-standard-content-model',
      'Define contentModel as an object describing config, page, and navigation fields.',
      { received: input.contentModel },
    );
  }

  assertStringArray(
    input.contentModel.projectConfigFields,
    'workflow-standard-project-config-fields',
    'List projectConfigFields as strings in the workflow standard content model.',
  );
  assertStringArray(
    input.contentModel.pageRequiredFields,
    'workflow-standard-page-required-fields',
    'List pageRequiredFields as strings in the workflow standard content model.',
  );
  assertStringArray(
    input.contentModel.pageOptionalFields,
    'workflow-standard-page-optional-fields',
    'List pageOptionalFields as strings in the workflow standard content model.',
  );
  assertStringArray(
    input.contentModel.navigationRequiredFields,
    'workflow-standard-navigation-required-fields',
    'List navigationRequiredFields as strings in the workflow standard content model.',
  );

  if (!isRecord(input.orchestration)) {
    throw createWorkflowValidationError(
      'workflow-standard-orchestration',
      'Define orchestration as an object containing workflow steps and compatibility flags.',
      { received: input.orchestration },
    );
  }

  assertStringArray(
    input.orchestration.workflowSteps,
    'workflow-standard-workflow-steps',
    'List orchestration.workflowSteps as strings in the canonical order.',
  );

  if (input.orchestration.publicationRule !== 'published-only') {
    throw createWorkflowValidationError(
      'workflow-standard-publication-rule',
      'Use the canonical published-only publication rule in the workflow standard.',
      { received: input.orchestration.publicationRule },
    );
  }

  if (
    input.orchestration.futureCompatibleWithoutReinitialization !== true ||
    input.orchestration.externalAutomationReady !== true
  ) {
    throw createWorkflowValidationError(
      'workflow-standard-compatibility-flags',
      'Preserve futureCompatibleWithoutReinitialization and externalAutomationReady as true in the workflow standard.',
      {
        futureCompatibleWithoutReinitialization: input.orchestration.futureCompatibleWithoutReinitialization,
        externalAutomationReady: input.orchestration.externalAutomationReady,
      },
    );
  }

  return input as WorkflowStandardDefinition;
}

function toComparableWorkflowFile(file: WorkflowStandardFile) {
  return {
    id: file.id,
    path: file.path,
    format: file.format,
    required: file.required,
    writable: file.writable,
    generated: file.generated,
    description: file.description,
  };
}

function toComparableWorkflowDefinition(definition: WorkflowStandardDefinition) {
  return {
    version: definition.version,
    standardId: definition.standardId,
    projectContractVersion: definition.projectContractVersion,
    localFirst: definition.localFirst,
    uiIndependent: definition.uiIndependent,
    supportedLanguages: definition.supportedLanguages,
    enabledLanguages: definition.enabledLanguages,
    publicationStatuses: definition.publicationStatuses,
    publishedStatuses: definition.publishedStatuses,
    sourceFiles: definition.sourceFiles.map(toComparableWorkflowFile),
    // Note: generatedArtifacts paths are excluded from comparison because they depend on
    // the build output directory, which can be customized via CLI --output or config.
    // We only validate source files and configuration.
    contentModel: definition.contentModel,
    orchestration: definition.orchestration,
  };
}

export async function readWorkflowStandardDefinition(workflowFile: string): Promise<WorkflowStandardDefinition> {
  const raw = await readFile(workflowFile, 'utf8').catch(() => {
    throw createWorkflowValidationError(
      'workflow-standard-file-readable',
      'Ensure anydocs.workflow.json exists and is readable before validating workflow compatibility.',
      { workflowFile },
    );
  });

  try {
    return validateWorkflowStandardDefinition(JSON.parse(raw) as unknown);
  } catch (error: unknown) {
    if (error instanceof ValidationError) {
      throw error;
    }

    throw createWorkflowValidationError(
      'workflow-standard-json-valid',
      'Fix anydocs.workflow.json so it contains valid JSON before validating workflow compatibility.',
      {
        workflowFile,
        cause: error instanceof Error ? error.message : String(error),
      },
    );
  }
}

export function assertWorkflowStandardMatchesContract(
  definition: WorkflowStandardDefinition,
  contract: ProjectContract,
): void {
  const expected = createWorkflowStandardDefinition(contract);
  const comparablePersisted = toComparableWorkflowDefinition(definition);
  const comparableExpected = toComparableWorkflowDefinition(expected);

  if (JSON.stringify(comparablePersisted) !== JSON.stringify(comparableExpected)) {
    throw createWorkflowValidationError(
      'workflow-standard-matches-project-contract',
      'Regenerate anydocs.workflow.json so its languages, file paths, and publication rules match the current canonical project contract.',
      {
        expected: comparableExpected,
        received: comparablePersisted,
      },
    );
  }
}

export function createWorkflowStandardDefinition(
  contract: ProjectContract,
): WorkflowStandardDefinition {
  return {
    version: 1,
    standardId: 'anydocs-phase-1',
    projectContractVersion: contract.config.version,
    localFirst: true,
    uiIndependent: true,
    supportedLanguages: ['zh', 'en'],
    enabledLanguages: contract.config.languages,
    publicationStatuses: [...PAGE_STATUSES],
    publishedStatuses: ['published'],
    sourceFiles: createSourceFiles(contract),
    generatedArtifacts: createGeneratedArtifacts(contract),
    contentModel: {
      projectConfigFields: ['version', 'projectId', 'name', 'defaultLanguage', 'languages', 'site', 'build'],
      pageRequiredFields: ['id', 'lang', 'slug', 'title', 'status', 'content'],
      pageOptionalFields: ['description', 'tags', 'updatedAt', 'render'],
      navigationRequiredFields: ['version', 'items'],
    },
    orchestration: {
      workflowSteps: [
        'loadConfig',
        'loadContent',
        'validate',
        'persistSources',
        'filterPublished',
        'generateArtifacts',
        'reportResult',
      ],
      publicationRule: 'published-only',
      futureCompatibleWithoutReinitialization: true,
      externalAutomationReady: true,
    },
  };
}

export function renderWorkflowStandardGuide(definition: WorkflowStandardDefinition): string {
  const sourceFiles = definition.sourceFiles
    .map((file) => `- ${file.path} (${file.description})`)
    .join('\n');
  const generatedArtifacts = definition.generatedArtifacts
    .map((file) => `- ${file.path} (${file.description})`)
    .join('\n');
  const workflowSteps = definition.orchestration.workflowSteps.map((step) => `- ${step}`).join('\n');

  return [
    '# Anydocs Workflow Standard',
    '',
    `Standard ID: ${definition.standardId}`,
    `Project Contract Version: ${definition.projectContractVersion}`,
    `Local First: ${definition.localFirst ? 'yes' : 'no'}`,
    `UI Independent: ${definition.uiIndependent ? 'yes' : 'no'}`,
    `Enabled Languages: ${definition.enabledLanguages.join(', ')}`,
    `Publication Statuses: ${definition.publicationStatuses.join(', ')}`,
    `Published Output Rule: ${definition.orchestration.publicationRule}`,
    '',
    '## Source Files',
    sourceFiles,
    '',
    '## Generated Artifacts',
    generatedArtifacts,
    '',
    '## Content Model',
    `- Project config fields: ${definition.contentModel.projectConfigFields.join(', ')}`,
    `- Page required fields: ${definition.contentModel.pageRequiredFields.join(', ')}`,
    `- Page optional fields: ${definition.contentModel.pageOptionalFields.join(', ')}`,
    `- Navigation required fields: ${definition.contentModel.navigationRequiredFields.join(', ')}`,
    '',
    '## Workflow Steps',
    workflowSteps,
    '',
    '## Compatibility Rules',
    '- Future automation may create or modify source files directly as long as it preserves the same config, page, and navigation schemas.',
    '- No project reinitialization is required when later workflows reuse this standard.',
    '- Generated artifacts must not be edited by hand.',
  ].join('\n');
}

export function exportWorkflowStandard(contract: ProjectContract): WorkflowStandardExport {
  const definition = createWorkflowStandardDefinition(contract);

  return {
    definition,
    markdownGuide: renderWorkflowStandardGuide(definition),
  };
}
