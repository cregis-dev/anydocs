import {
  DOCS_YOOPTA_ALLOWED_MARKS,
  DOCS_YOOPTA_ALLOWED_TYPES,
  DOCS_YOOPTA_AUTHORING_GUIDANCE,
  PAGE_TEMPLATE_DEFINITIONS,
  assessWorkflowForwardCompatibility,
  ValidationError,
  setProjectLanguages,
  validateProjectContract,
} from '@anydocs/core';

import {
  type ToolDefinition,
  executeTool,
  loadProjectContext,
  requireObjectArguments,
  requireStringArgument,
} from './shared.ts';
import {
  listAuthoringResourceReferences,
  listAuthoringResourceTemplateReferences,
} from '../resources.ts';

export const projectTools: ToolDefinition[] = [
  {
    name: 'project_open',
    description:
      'Open an Anydocs project contract and return the canonical config, key paths, and enabled languages.',
    inputSchema: {
      type: 'object',
      properties: {
        projectRoot: {
          type: 'string',
          description: 'Path to the Anydocs project root.',
        },
      },
      required: ['projectRoot'],
      additionalProperties: false,
    },
    handler: async (argumentsValue) => {
      const args = requireObjectArguments('project_open', argumentsValue);
      const projectRoot = requireStringArgument('project_open', args, 'projectRoot');

      return executeTool('project_open', { projectRoot }, async () => {
        const { contract } = await loadProjectContext('project_open', projectRoot);
        return {
          config: contract.config,
          paths: contract.paths,
          enabledLanguages: contract.config.languages,
          authoring: {
            contentFormat: 'yoopta',
            allowedBlockTypes: [...DOCS_YOOPTA_ALLOWED_TYPES],
            allowedMarks: [...DOCS_YOOPTA_ALLOWED_MARKS],
            guidance: [...DOCS_YOOPTA_AUTHORING_GUIDANCE],
            templates: PAGE_TEMPLATE_DEFINITIONS.map((template) => ({
              id: template.id,
              label: template.label,
              description: template.description,
              recommendedInputs: [...template.recommendedInputs],
            })),
            resources: listAuthoringResourceReferences(),
            resourceTemplates: listAuthoringResourceTemplateReferences(),
          },
        };
      });
    },
  },
  {
    name: 'project_set_languages',
    description:
      'Update the enabled language set for an Anydocs project and optionally switch the default language.',
    inputSchema: {
      type: 'object',
      properties: {
        projectRoot: {
          type: 'string',
          description: 'Path to the Anydocs project root.',
        },
        languages: {
          type: 'array',
          items: { type: 'string' },
          description: 'The full enabled language set to persist in anydocs.config.json.',
        },
        defaultLanguage: {
          type: 'string',
          description: 'Optional default language. Must be included in languages.',
        },
      },
      required: ['projectRoot', 'languages'],
      additionalProperties: false,
    },
    handler: async (argumentsValue) => {
      const args = requireObjectArguments('project_set_languages', argumentsValue);
      const projectRoot = requireStringArgument('project_set_languages', args, 'projectRoot');
      const languages = args.languages;
      if (!Array.isArray(languages) || languages.some((value) => typeof value !== 'string')) {
        throw new ValidationError('Tool "project_set_languages" requires "languages" to be a string array.', {
          entity: 'mcp-tool',
          rule: 'mcp-tool-string-array-argument',
          remediation: 'Provide "languages" as an array of language strings.',
          metadata: { tool: 'project_set_languages', received: languages },
        });
      }

      const defaultLanguage =
        args.defaultLanguage == null
          ? undefined
          : requireStringArgument('project_set_languages', args, 'defaultLanguage');

      return executeTool('project_set_languages', { projectRoot }, async () =>
        setProjectLanguages({
          projectRoot,
          languages: languages as Array<'en' | 'zh'>,
          ...(defaultLanguage ? { defaultLanguage: defaultLanguage as 'en' | 'zh' } : {}),
        }),
      );
    },
  },
  {
    name: 'project_validate',
    description:
      'Validate an Anydocs project and return workflow compatibility details for agent-safe authoring.',
    inputSchema: {
      type: 'object',
      properties: {
        projectRoot: {
          type: 'string',
          description: 'Path to the Anydocs project root.',
        },
      },
      required: ['projectRoot'],
      additionalProperties: false,
    },
    handler: async (argumentsValue) => {
      const args = requireObjectArguments('project_validate', argumentsValue);
      const projectRoot = requireStringArgument('project_validate', args, 'projectRoot');

      return executeTool('project_validate', { projectRoot }, async () => {
        const configResult = await validateProjectContract(projectRoot);
        if (!configResult.ok) {
          throw configResult.error;
        }

        const workflowCompatibility = await assessWorkflowForwardCompatibility(projectRoot);
        return {
          valid: true,
          config: configResult.value,
          workflowCompatibility,
        };
      });
    },
  },
];
