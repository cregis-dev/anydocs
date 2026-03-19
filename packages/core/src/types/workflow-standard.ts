import type { PageStatus } from './docs.ts';
import type { DocsLanguage, ProjectContract } from './project.ts';

export type WorkflowStandardFile = {
  id:
    | 'projectConfig'
    | 'workflowStandard'
    | 'navigation'
    | 'page'
    | 'llms'
    | 'llmsFull'
    | 'machineReadableRoot'
    | 'machineReadableIndex'
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
