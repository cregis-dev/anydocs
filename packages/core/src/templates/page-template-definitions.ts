import type { DocsLang } from '../types/docs.ts';
import type { ProjectConfig, ProjectPageTemplateDefinition } from '../types/project.ts';

export const PAGE_TEMPLATE_KINDS = ['concept', 'how_to', 'reference'] as const;

export type PageTemplateKind = (typeof PAGE_TEMPLATE_KINDS)[number];

export const PAGE_TEMPLATE_DEFINITIONS = [
  {
    id: 'concept',
    label: 'Concept',
    description: 'Explain an idea, architecture, or mental model with sectioned prose and supporting callouts.',
    recommendedInputs: ['summary', 'sections'],
  },
  {
    id: 'how_to',
    label: 'How-To',
    description: 'Teach a procedure with ordered steps, optional code examples, and final guidance.',
    recommendedInputs: ['summary', 'steps'],
  },
  {
    id: 'reference',
    label: 'Reference',
    description: 'Capture stable facts, options, APIs, and operational details in scan-friendly sections.',
    recommendedInputs: ['summary', 'sections'],
  },
] as const satisfies ReadonlyArray<{
  id: PageTemplateKind;
  label: string;
  description: string;
  recommendedInputs: readonly string[];
}>;

export type ResolvedProjectPageTemplateDefinition = {
  id: string;
  label: string | Partial<Record<DocsLang, string>>;
  description?: string;
  baseTemplate: PageTemplateKind;
  recommendedInputs: string[];
  defaultSummary?: string;
  defaultSections?: ProjectPageTemplateDefinition['defaultSections'];
  metadataSchema?: ProjectPageTemplateDefinition['metadataSchema'];
  builtIn: boolean;
};

export function findResolvedProjectPageTemplate(
  config: ProjectConfig,
  templateId: string,
): ResolvedProjectPageTemplateDefinition | null {
  const builtIn = PAGE_TEMPLATE_DEFINITIONS.find((template) => template.id === templateId);
  if (builtIn) {
    return {
      id: builtIn.id,
      label: builtIn.label,
      description: builtIn.description,
      baseTemplate: builtIn.id,
      recommendedInputs: [...builtIn.recommendedInputs],
      builtIn: true,
    };
  }

  const custom = config.authoring?.pageTemplates?.find((template) => template.id === templateId);
  if (!custom) {
    return null;
  }

  const baseDefinition = PAGE_TEMPLATE_DEFINITIONS.find((template) => template.id === custom.baseTemplate);

  return {
    id: custom.id,
    label: custom.label,
    ...(custom.description ? { description: custom.description } : {}),
    baseTemplate: custom.baseTemplate,
    recommendedInputs: baseDefinition ? [...baseDefinition.recommendedInputs] : [],
    ...(custom.defaultSummary ? { defaultSummary: custom.defaultSummary } : {}),
    ...(custom.defaultSections ? { defaultSections: custom.defaultSections } : {}),
    ...(custom.metadataSchema ? { metadataSchema: custom.metadataSchema } : {}),
    builtIn: false,
  };
}

export function listResolvedProjectPageTemplates(config: ProjectConfig): ResolvedProjectPageTemplateDefinition[] {
  const builtIns = PAGE_TEMPLATE_DEFINITIONS.map((template) => ({
    id: template.id,
    label: template.label,
    description: template.description,
    baseTemplate: template.id,
    recommendedInputs: [...template.recommendedInputs],
    builtIn: true,
  })) satisfies ResolvedProjectPageTemplateDefinition[];

  const customs =
    config.authoring?.pageTemplates?.map((template) => findResolvedProjectPageTemplate(config, template.id)).filter(Boolean) ??
    [];

  return [...builtIns, ...(customs as ResolvedProjectPageTemplateDefinition[])];
}
