import {
  assessWorkflowForwardCompatibility,
  validateProjectContract,
} from '@anydocs/core';

import {
  type ToolDefinition,
  executeTool,
  loadProjectContext,
  requireObjectArguments,
  requireStringArgument,
} from './shared.ts';

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
        };
      });
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
