import type { DocsLang, ProjectConfig, ProjectPageTemplateDefinition } from '@anydocs/core';

export const PAGE_TEMPLATE_KINDS = ['concept', 'how_to', 'reference'] as const;

type BuiltInPageTemplateDefinition = {
  id: (typeof PAGE_TEMPLATE_KINDS)[number];
  label: string;
  description: string;
  recommendedInputs: readonly string[];
};

export type ResolvedProjectPageTemplateDefinition = {
  id: string;
  label: string | Partial<Record<DocsLang, string>>;
  description?: string;
  baseTemplate: BuiltInPageTemplateDefinition['id'];
  recommendedInputs: string[];
  defaultSummary?: string;
  defaultSections?: ProjectPageTemplateDefinition['defaultSections'];
  metadataSchema?: ProjectPageTemplateDefinition['metadataSchema'];
  builtIn: boolean;
};

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
] as const satisfies ReadonlyArray<BuiltInPageTemplateDefinition>;

export function listResolvedProjectPageTemplates(
  config: ProjectConfig,
): ResolvedProjectPageTemplateDefinition[] {
  const builtIns = PAGE_TEMPLATE_DEFINITIONS.map((template) => ({
    id: template.id,
    label: template.label,
    description: template.description,
    baseTemplate: template.id,
    recommendedInputs: [...template.recommendedInputs],
    builtIn: true,
  })) satisfies ResolvedProjectPageTemplateDefinition[];

  const customs =
    config.authoring?.pageTemplates
      ?.map((template) => {
        const builtIn = PAGE_TEMPLATE_DEFINITIONS.find((entry) => entry.id === template.baseTemplate);
        if (!builtIn) {
          return null;
        }

        return {
          id: template.id,
          label: template.label,
          ...(template.description ? { description: template.description } : {}),
          baseTemplate: template.baseTemplate,
          recommendedInputs: [...builtIn.recommendedInputs],
          ...(template.defaultSummary ? { defaultSummary: template.defaultSummary } : {}),
          ...(template.defaultSections ? { defaultSections: template.defaultSections } : {}),
          ...(template.metadataSchema ? { metadataSchema: template.metadataSchema } : {}),
          builtIn: false,
        } satisfies ResolvedProjectPageTemplateDefinition;
      })
      .filter(Boolean) ?? [];

  return [...builtIns, ...(customs as ResolvedProjectPageTemplateDefinition[])];
}
