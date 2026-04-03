import {
  DOCS_YOOPTA_ALLOWED_MARKS,
  DOCS_YOOPTA_ALLOWED_TYPES,
  DOCS_YOOPTA_AUTHORING_GUIDANCE,
  getProjectThemeCapabilities,
  listResolvedProjectPageTemplates,
  runBuildWorkflow,
  assessWorkflowForwardCompatibility,
  syncWorkflowStandard,
  updateProjectConfig,
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function optionalBooleanArgument(
  tool: string,
  args: Record<string, unknown>,
  key: string,
): boolean | undefined {
  const value = args[key];
  if (value == null) {
    return undefined;
  }

  if (typeof value !== 'boolean') {
    throw new ValidationError(`Tool "${tool}" expects "${key}" to be a boolean when provided.`, {
      entity: 'mcp-tool',
      rule: 'mcp-tool-boolean-argument',
      remediation: `Provide "${key}" as true or false, or omit it.`,
      metadata: { tool, key, received: value },
    });
  }

  return value;
}

function parseProjectConfigPatch(
  tool: string,
  args: Record<string, unknown>,
) {
  const patch = args.patch;
  if (patch == null) {
    throw new ValidationError(`Tool "${tool}" requires a "patch" object.`, {
      entity: 'mcp-tool',
      rule: 'mcp-tool-required-object-argument',
      remediation: 'Provide "patch" as an object containing supported project configuration fields.',
      metadata: { tool, received: patch },
    });
  }

  if (!isRecord(patch)) {
    throw new ValidationError(`Tool "${tool}" expects "patch" to be an object.`, {
      entity: 'mcp-tool',
      rule: 'mcp-tool-object-argument',
      remediation: 'Provide "patch" as an object.',
      metadata: { tool, received: patch },
    });
  }

  const unsupportedRootFields = Object.keys(patch).filter(
    (key) => !['name', 'defaultLanguage', 'languages', 'build', 'site'].includes(key),
  );
  if (unsupportedRootFields.length > 0) {
    throw new ValidationError(`Tool "${tool}" received unsupported project config patch fields.`, {
      entity: 'mcp-tool',
      rule: 'project-config-patch-fields-must-be-supported',
      remediation: 'Use only name, defaultLanguage, languages, build, and site in project_update_config.patch.',
      metadata: { tool, unsupportedFields: unsupportedRootFields },
    });
  }

  const nextPatch: Record<string, unknown> = {};
  if (typeof patch.name === 'string') {
    nextPatch.name = patch.name.trim();
  }
  if (typeof patch.defaultLanguage === 'string') {
    nextPatch.defaultLanguage = patch.defaultLanguage.trim();
  }
  if (Array.isArray(patch.languages)) {
    if (patch.languages.some((value) => typeof value !== 'string')) {
      throw new ValidationError(`Tool "${tool}" expects "patch.languages" to be an array of strings.`, {
        entity: 'mcp-tool',
        rule: 'mcp-tool-string-array-argument',
        remediation: 'Provide "patch.languages" as an array of language strings.',
        metadata: { tool, received: patch.languages },
      });
    }
    nextPatch.languages = patch.languages.map((value) => value.trim());
  }
  if (patch.build != null) {
    if (!isRecord(patch.build)) {
      throw new ValidationError(`Tool "${tool}" expects "patch.build" to be an object when provided.`, {
        entity: 'mcp-tool',
        rule: 'mcp-tool-object-argument',
        remediation: 'Provide "patch.build" as an object.',
        metadata: { tool, received: patch.build },
      });
    }
    const unsupportedBuildFields = Object.keys(patch.build).filter((key) => key !== 'outputDir');
    if (unsupportedBuildFields.length > 0) {
      throw new ValidationError(`Tool "${tool}" received unsupported build patch fields.`, {
        entity: 'mcp-tool',
        rule: 'project-config-build-patch-fields-must-be-supported',
        remediation: 'Use only build.outputDir in project_update_config.patch.',
        metadata: { tool, unsupportedFields: unsupportedBuildFields },
      });
    }
    nextPatch.build = {
      ...(typeof patch.build.outputDir === 'string' ? { outputDir: patch.build.outputDir.trim() } : {}),
    };
  }

  if (patch.site != null) {
    if (!isRecord(patch.site)) {
      throw new ValidationError(`Tool "${tool}" expects "patch.site" to be an object when provided.`, {
        entity: 'mcp-tool',
        rule: 'mcp-tool-object-argument',
        remediation: 'Provide "patch.site" as an object.',
        metadata: { tool, received: patch.site },
      });
    }
    const unsupportedSiteFields = Object.keys(patch.site).filter((key) => !['url', 'theme', 'navigation'].includes(key));
    if (unsupportedSiteFields.length > 0) {
      throw new ValidationError(`Tool "${tool}" received unsupported site patch fields.`, {
        entity: 'mcp-tool',
        rule: 'project-config-site-patch-fields-must-be-supported',
        remediation: 'Use only site.url, site.theme, and site.navigation in project_update_config.patch.',
        metadata: { tool, unsupportedFields: unsupportedSiteFields },
      });
    }

    const nextSite: Record<string, unknown> = {};
    if (typeof patch.site.url === 'string') {
      nextSite.url = patch.site.url.trim();
    }
    if (patch.site.theme != null) {
      if (!isRecord(patch.site.theme)) {
        throw new ValidationError(`Tool "${tool}" expects "patch.site.theme" to be an object when provided.`, {
          entity: 'mcp-tool',
          rule: 'mcp-tool-object-argument',
          remediation: 'Provide "patch.site.theme" as an object.',
          metadata: { tool, received: patch.site.theme },
        });
      }
      const unsupportedThemeFields = Object.keys(patch.site.theme).filter(
        (key) => !['id', 'branding', 'chrome', 'colors', 'codeTheme'].includes(key),
      );
      if (unsupportedThemeFields.length > 0) {
        throw new ValidationError(`Tool "${tool}" received unsupported theme patch fields.`, {
          entity: 'mcp-tool',
          rule: 'project-config-theme-patch-fields-must-be-supported',
          remediation: 'Use only site.theme.id, branding, chrome, colors, and codeTheme in project_update_config.patch.',
          metadata: { tool, unsupportedFields: unsupportedThemeFields },
        });
      }
      nextSite.theme = {
        ...(typeof patch.site.theme.id === 'string' ? { id: patch.site.theme.id.trim() } : {}),
        ...(isRecord(patch.site.theme.branding) ? { branding: patch.site.theme.branding } : {}),
        ...(isRecord(patch.site.theme.chrome) ? { chrome: patch.site.theme.chrome } : {}),
        ...(isRecord(patch.site.theme.colors) ? { colors: patch.site.theme.colors } : {}),
        ...(typeof patch.site.theme.codeTheme === 'string' ? { codeTheme: patch.site.theme.codeTheme.trim() } : {}),
      };
    }
    if (patch.site.navigation != null) {
      if (!isRecord(patch.site.navigation)) {
        throw new ValidationError(`Tool "${tool}" expects "patch.site.navigation" to be an object when provided.`, {
          entity: 'mcp-tool',
          rule: 'mcp-tool-object-argument',
          remediation: 'Provide "patch.site.navigation" as an object.',
          metadata: { tool, received: patch.site.navigation },
        });
      }
      const unsupportedNavigationFields = Object.keys(patch.site.navigation).filter((key) => key !== 'topNav');
      if (unsupportedNavigationFields.length > 0) {
        throw new ValidationError(`Tool "${tool}" received unsupported navigation patch fields.`, {
          entity: 'mcp-tool',
          rule: 'project-config-navigation-patch-fields-must-be-supported',
          remediation: 'Use only site.navigation.topNav in project_update_config.patch.',
          metadata: { tool, unsupportedFields: unsupportedNavigationFields },
        });
      }
      if ('topNav' in patch.site.navigation && !Array.isArray(patch.site.navigation.topNav)) {
        throw new ValidationError(`Tool "${tool}" expects "patch.site.navigation.topNav" to be an array when provided.`, {
          entity: 'mcp-tool',
          rule: 'mcp-tool-array-argument',
          remediation: 'Provide "patch.site.navigation.topNav" as an array of navigation items.',
          metadata: { tool, received: patch.site.navigation.topNav },
        });
      }
      nextSite.navigation = {
        ...('topNav' in patch.site.navigation ? { topNav: patch.site.navigation.topNav } : {}),
      };
    }

    nextPatch.site = nextSite;
  }

  return nextPatch;
}

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
          themeCapabilities: getProjectThemeCapabilities(contract.config.site.theme.id),
          authoring: {
            contentFormat: 'yoopta',
            allowedBlockTypes: [...DOCS_YOOPTA_ALLOWED_TYPES],
            allowedMarks: [...DOCS_YOOPTA_ALLOWED_MARKS],
            guidance: [...DOCS_YOOPTA_AUTHORING_GUIDANCE],
            templates: listResolvedProjectPageTemplates(contract.config).map((template) => ({
              id: template.id,
              label: template.label,
              ...(template.description ? { description: template.description } : {}),
              baseTemplate: template.baseTemplate,
              builtIn: template.builtIn,
              recommendedInputs: [...template.recommendedInputs],
              ...(template.defaultSummary ? { defaultSummary: template.defaultSummary } : {}),
              ...(template.defaultSections ? { defaultSections: template.defaultSections } : {}),
              ...(template.metadataSchema ? { metadataSchema: template.metadataSchema } : {}),
            })),
            resources: listAuthoringResourceReferences(),
            resourceTemplates: listAuthoringResourceTemplateReferences(),
          },
        };
      });
    },
  },
  {
    name: 'project_update_config',
    description:
      'Update supported project configuration fields through the canonical config validation and workflow-sync path.',
    inputSchema: {
      type: 'object',
      properties: {
        projectRoot: {
          type: 'string',
          description: 'Path to the Anydocs project root.',
        },
        patch: {
          type: 'object',
          description: 'Supported project config fields to update.',
        },
      },
      required: ['projectRoot', 'patch'],
      additionalProperties: false,
    },
    handler: async (argumentsValue) => {
      const args = requireObjectArguments('project_update_config', argumentsValue);
      const projectRoot = requireStringArgument('project_update_config', args, 'projectRoot');
      const patch = parseProjectConfigPatch('project_update_config', args);

      return executeTool('project_update_config', { projectRoot }, async () => {
        const result = await updateProjectConfig(projectRoot, patch);
        if (!result.ok) {
          throw result.error;
        }
        const { contract } = await loadProjectContext('project_update_config', projectRoot);
        return {
          filePath: contract.paths.configFile,
          config: result.value,
        };
      });
    },
  },
  {
    name: 'project_build',
    description:
      'Run the canonical build workflow for an Anydocs project, or dry-run it to inspect planned artifacts.',
    inputSchema: {
      type: 'object',
      properties: {
        projectRoot: {
          type: 'string',
          description: 'Path to the Anydocs project root.',
        },
        dryRun: {
          type: 'boolean',
          description: 'When true, return build metadata without writing artifacts.',
        },
      },
      required: ['projectRoot'],
      additionalProperties: false,
    },
    handler: async (argumentsValue) => {
      const args = requireObjectArguments('project_build', argumentsValue);
      const projectRoot = requireStringArgument('project_build', args, 'projectRoot');
      const dryRun = optionalBooleanArgument('project_build', args, 'dryRun');

      return executeTool('project_build', { projectRoot, ...(dryRun !== undefined ? { dryRun } : {}) }, async () =>
        runBuildWorkflow({
          repoRoot: projectRoot,
          ...(dryRun !== undefined ? { dryRun } : {}),
        }),
      );
    },
  },
  {
    name: 'project_sync_workflow',
    description:
      'Diff the persisted anydocs.workflow.json against the canonical contract and optionally apply the canonical definition.',
    inputSchema: {
      type: 'object',
      properties: {
        projectRoot: {
          type: 'string',
          description: 'Path to the Anydocs project root.',
        },
        mode: {
          type: 'string',
          enum: ['dryRun', 'apply'],
          description: 'Whether to inspect or apply the workflow sync.',
        },
      },
      required: ['projectRoot'],
      additionalProperties: false,
    },
    handler: async (argumentsValue) => {
      const args = requireObjectArguments('project_sync_workflow', argumentsValue);
      const projectRoot = requireStringArgument('project_sync_workflow', args, 'projectRoot');
      const mode =
        args.mode == null ? 'dryRun' : requireStringArgument('project_sync_workflow', args, 'mode');
      if (!['dryRun', 'apply'].includes(mode)) {
        throw new ValidationError(`Tool "project_sync_workflow" received unsupported mode "${mode}".`, {
          entity: 'mcp-tool',
          rule: 'workflow-sync-mode-must-be-supported',
          remediation: 'Use "dryRun" or "apply" for project_sync_workflow.mode.',
          metadata: { mode },
        });
      }

      return executeTool('project_sync_workflow', { projectRoot, mode }, async () =>
        syncWorkflowStandard(projectRoot, {
          apply: mode === 'apply',
        }),
      );
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
