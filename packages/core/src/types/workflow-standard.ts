import type { PageStatus } from './docs.ts';
import type { DocsLanguage, ProjectContract } from './project.ts';

export type WorkflowStandardFile = {
  id:
    | 'projectConfig'
    | 'workflowStandard'
    | 'navigation'
    | 'page'
    | 'apiSource'
    | 'llms'
    | 'llmsFull'
    | 'machineReadableRoot'
    | 'machineReadableIndex'
    | 'openApiRoot'
    | 'openApiIndex'
    | 'searchIndex'
    | 'chunkIndex';
  path: string;
  format: 'json' | 'text' | 'directory';
  required: boolean;
  writable: boolean;
  generated: boolean;
  description: string;
};

export type WorkflowStandardStep =
  | 'loadConfig'
  | 'loadContent'
  | 'validate'
  | 'persistSources'
  | 'filterPublished'
  | 'generateArtifacts'
  | 'reportResult';

export type WorkflowStandardDefinition = {
  version: 1;
  standardId: 'anydocs-phase-1';
  projectContractVersion: ProjectContract['config']['version'];
  localFirst: true;
  uiIndependent: true;
  supportedLanguages: DocsLanguage[];
  enabledLanguages: DocsLanguage[];
  publicationStatuses: PageStatus[];
  publishedStatuses: Extract<PageStatus, 'published'>[];
  sourceFiles: WorkflowStandardFile[];
  generatedArtifacts: WorkflowStandardFile[];
  contentModel: {
    projectConfigFields: Array<keyof ProjectContract['config']>;
    pageRequiredFields: string[];
    pageOptionalFields: string[];
    navigationRequiredFields: string[];
  };
  orchestration: {
    workflowSteps: WorkflowStandardStep[];
    publicationRule: 'published-only';
    futureCompatibleWithoutReinitialization: true;
    externalAutomationReady: true;
  };
};

export type WorkflowStandardExport = {
  definition: WorkflowStandardDefinition;
  markdownGuide: string;
};

export type WorkflowCompatibilityAssessment = {
  compatible: true;
  standardId: WorkflowStandardDefinition['standardId'];
  projectContractVersion: WorkflowStandardDefinition['projectContractVersion'];
  reusableAcrossProjects: true;
  futureCompatibleWithoutReinitialization: true;
  externalAutomationReady: true;
  validatedAt: string;
};

export type WorkflowSyncDiffAction = 'add' | 'remove' | 'replace';

export type WorkflowSyncDiffEntry = {
  path: string;
  action: WorkflowSyncDiffAction;
  expected?: unknown;
  received?: unknown;
};

export type WorkflowSyncResult = {
  applied: boolean;
  filePath: string;
  diff: WorkflowSyncDiffEntry[];
  workflow: WorkflowStandardDefinition;
};
