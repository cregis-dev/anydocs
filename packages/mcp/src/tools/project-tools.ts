import { randomUUID } from 'node:crypto';

import {
  DOC_CONTENT_AUTHORING_GUIDANCE,
  DOC_CONTENT_BLOCK_TYPES,
  DOC_CONTENT_TEXT_MARKS,
  DOCS_YOOPTA_ALLOWED_MARKS,
  DOCS_YOOPTA_ALLOWED_TYPES,
  DOCS_YOOPTA_AUTHORING_GUIDANCE,
  getProjectThemeCapabilities,
  listResolvedProjectPageTemplates,
  runPreviewWorkflow,
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
  optionalStringArgument,
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

function optionalIntegerArgument(
  tool: string,
  args: Record<string, unknown>,
  key: string,
  options: { min?: number; max?: number } = {},
): number | undefined {
  const value = args[key];
  if (value == null) {
    return undefined;
  }

  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new ValidationError(`Tool "${tool}" expects "${key}" to be an integer when provided.`, {
      entity: 'mcp-tool',
      rule: 'mcp-tool-integer-argument',
      remediation: `Provide "${key}" as an integer, or omit it.`,
      metadata: { tool, key, received: value },
    });
  }

  if (options.min != null && value < options.min) {
    throw new ValidationError(`Tool "${tool}" expects "${key}" to be >= ${options.min}.`, {
      entity: 'mcp-tool',
      rule: 'mcp-tool-integer-min-constraint',
      remediation: `Provide "${key}" as an integer >= ${options.min}.`,
      metadata: { tool, key, min: options.min, received: value },
    });
  }

  if (options.max != null && value > options.max) {
    throw new ValidationError(`Tool "${tool}" expects "${key}" to be <= ${options.max}.`, {
      entity: 'mcp-tool',
      rule: 'mcp-tool-integer-max-constraint',
      remediation: `Provide "${key}" as an integer <= ${options.max}.`,
      metadata: { tool, key, max: options.max, received: value },
    });
  }

  return value;
}

type PreviewSessionRuntime = Awaited<ReturnType<typeof runPreviewWorkflow>>;

type PreviewSession = {
  id: string;
  projectRoot: string;
  projectId: string;
  host: string;
  port: number;
  url: string;
  docsPath: string;
  previewUrl: string;
  pid: number;
  publishedPages: number;
  startedAt: string;
  status: 'running' | 'stopping' | 'stopped' | 'exited';
  exitCode?: number | null;
  signal?: NodeJS.Signals | null;
  endedAt?: string;
  runtime: Pick<PreviewSessionRuntime, 'stop' | 'waitUntilExit'>;
  stopPromise?: Promise<void>;
};

const previewSessions = new Map<string, PreviewSession>();

function summarizePreviewSession(session: PreviewSession) {
  return {
    id: session.id,
    projectRoot: session.projectRoot,
    projectId: session.projectId,
    host: session.host,
    port: session.port,
    url: session.url,
    docsPath: session.docsPath,
    previewUrl: session.previewUrl,
    pid: session.pid,
    publishedPages: session.publishedPages,
    startedAt: session.startedAt,
    status: session.status,
    ...(session.exitCode !== undefined ? { exitCode: session.exitCode } : {}),
    ...(session.signal !== undefined ? { signal: session.signal } : {}),
    ...(session.endedAt ? { endedAt: session.endedAt } : {}),
  };
}

function listProjectPreviewSessions(projectRoot: string): PreviewSession[] {
  return [...previewSessions.values()].filter((session) => session.projectRoot === projectRoot);
}

function listRunningPreviewSessions(projectRoot?: string): PreviewSession[] {
  return [...previewSessions.values()].filter((session) =>
    session.status === 'running' && (projectRoot == null || session.projectRoot === projectRoot)
  );
}

function attachPreviewExitWatcher(session: PreviewSession) {
  void session.runtime.waitUntilExit().then(({ exitCode, signal }) => {
    if (session.status === 'stopped') {
      return;
    }

    session.status = session.status === 'stopping' ? 'stopped' : 'exited';
    session.exitCode = exitCode;
    session.signal = signal;
    session.endedAt = new Date().toISOString();
  }).catch(() => {
    if (session.status === 'stopped') {
      return;
    }

    session.status = session.status === 'stopping' ? 'stopped' : 'exited';
    session.exitCode = null;
    session.signal = null;
    session.endedAt = new Date().toISOString();
  });
}

async function stopPreviewSession(session: PreviewSession): Promise<void> {
  if (session.status === 'stopped' || session.status === 'exited') {
    return;
  }

  if (session.stopPromise) {
    await session.stopPromise;
    return;
  }

  session.status = 'stopping';
  session.stopPromise = (async () => {
    await session.runtime.stop();
    const exit = await session.runtime.waitUntilExit();
    session.status = 'stopped';
    session.exitCode = exit.exitCode;
    session.signal = exit.signal;
    session.endedAt = new Date().toISOString();
  })().finally(() => {
    session.stopPromise = undefined;
  });
  await session.stopPromise;
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
            contentFormat: 'doc-content-v1',
            allowedBlockTypes: [...DOC_CONTENT_BLOCK_TYPES],
            allowedMarks: [...DOC_CONTENT_TEXT_MARKS],
            guidance: [...DOC_CONTENT_AUTHORING_GUIDANCE],
            legacyContentFormat: 'yoopta',
            legacyAllowedBlockTypes: [...DOCS_YOOPTA_ALLOWED_TYPES],
            legacyAllowedMarks: [...DOCS_YOOPTA_ALLOWED_MARKS],
            legacyGuidance: [...DOCS_YOOPTA_AUTHORING_GUIDANCE],
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
    name: 'project_preview_start',
    description:
      'Start a live docs preview server session for an Anydocs project and return a session id plus preview URL.',
    inputSchema: {
      type: 'object',
      properties: {
        projectRoot: {
          type: 'string',
          description: 'Path to the Anydocs project root.',
        },
        host: {
          type: 'string',
          description: 'Optional host for the preview server (default: 127.0.0.1).',
        },
        port: {
          type: 'integer',
          description: 'Optional port for the preview server; when omitted, an available port is selected.',
        },
        startTimeoutMs: {
          type: 'integer',
          description: 'Optional startup timeout in milliseconds.',
        },
        stopExisting: {
          type: 'boolean',
          description: 'When true, stop any running preview session before starting this one.',
        },
      },
      required: ['projectRoot'],
      additionalProperties: false,
    },
    handler: async (argumentsValue) => {
      const args = requireObjectArguments('project_preview_start', argumentsValue);
      const projectRoot = requireStringArgument('project_preview_start', args, 'projectRoot');
      const host = optionalStringArgument('project_preview_start', args, 'host');
      const port = optionalIntegerArgument('project_preview_start', args, 'port', { min: 1, max: 65535 });
      const startTimeoutMs = optionalIntegerArgument('project_preview_start', args, 'startTimeoutMs', { min: 1 });
      const stopExisting = optionalBooleanArgument('project_preview_start', args, 'stopExisting') ?? false;

      return executeTool('project_preview_start', { projectRoot }, async () => {
        const { contract } = await loadProjectContext('project_preview_start', projectRoot);
        const canonicalProjectRoot = contract.paths.projectRoot;
        const runningSessions = listRunningPreviewSessions();

        if (runningSessions.length > 0 && !stopExisting) {
          throw new ValidationError('A preview session is already running. Stop it first or set stopExisting=true.', {
            entity: 'mcp-tool',
            rule: 'project-preview-session-already-running',
            remediation: 'Call project_preview_stop or retry project_preview_start with stopExisting: true.',
            metadata: {
              projectRoot: canonicalProjectRoot,
              runningSessions: runningSessions.map((session) => summarizePreviewSession(session)),
            },
          });
        }

        if (runningSessions.length > 0 && stopExisting) {
          for (const session of runningSessions) {
            await stopPreviewSession(session);
          }
        }

        const runtime = await runPreviewWorkflow({
          repoRoot: canonicalProjectRoot,
          ...(host ? { host } : {}),
          ...(port !== undefined ? { port } : {}),
          ...(startTimeoutMs !== undefined ? { startTimeoutMs } : {}),
          stdio: 'pipe',
        });
        const sessionId = randomUUID();
        const session: PreviewSession = {
          id: sessionId,
          projectRoot: canonicalProjectRoot,
          projectId: runtime.projectId,
          host: runtime.host,
          port: runtime.port,
          url: runtime.url,
          docsPath: runtime.docsPath,
          previewUrl: `${runtime.url}${runtime.docsPath}`,
          pid: runtime.pid,
          publishedPages: runtime.publishedPages,
          startedAt: new Date().toISOString(),
          status: 'running',
          runtime: {
            stop: runtime.stop,
            waitUntilExit: runtime.waitUntilExit,
          },
        };
        previewSessions.set(sessionId, session);
        attachPreviewExitWatcher(session);

        return {
          session: summarizePreviewSession(session),
        };
      });
    },
  },
  {
    name: 'project_preview_status',
    description: 'Inspect live preview session status for a project, or for one specific session id.',
    inputSchema: {
      type: 'object',
      properties: {
        projectRoot: {
          type: 'string',
          description: 'Path to the Anydocs project root.',
        },
        sessionId: {
          type: 'string',
          description: 'Optional preview session id returned by project_preview_start.',
        },
      },
      required: ['projectRoot'],
      additionalProperties: false,
    },
    handler: async (argumentsValue) => {
      const args = requireObjectArguments('project_preview_status', argumentsValue);
      const projectRoot = requireStringArgument('project_preview_status', args, 'projectRoot');
      const sessionId = optionalStringArgument('project_preview_status', args, 'sessionId');

      return executeTool('project_preview_status', { projectRoot }, async () => {
        const { contract } = await loadProjectContext('project_preview_status', projectRoot);
        const canonicalProjectRoot = contract.paths.projectRoot;

        if (sessionId) {
          const session = previewSessions.get(sessionId);
          if (!session || session.projectRoot !== canonicalProjectRoot) {
            throw new ValidationError(`Preview session "${sessionId}" was not found for this project.`, {
              entity: 'mcp-tool',
              rule: 'project-preview-session-not-found',
              remediation: 'Call project_preview_status without sessionId to list known sessions first.',
              metadata: { projectRoot: canonicalProjectRoot, sessionId },
            });
          }

          return {
            session: summarizePreviewSession(session),
          };
        }

        const sessions = listProjectPreviewSessions(canonicalProjectRoot).map((session) => summarizePreviewSession(session));
        return {
          count: sessions.length,
          sessions,
        };
      });
    },
  },
  {
    name: 'project_preview_stop',
    description: 'Stop one preview session or all running preview sessions for a project.',
    inputSchema: {
      type: 'object',
      properties: {
        projectRoot: {
          type: 'string',
          description: 'Path to the Anydocs project root.',
        },
        sessionId: {
          type: 'string',
          description: 'Optional preview session id returned by project_preview_start.',
        },
      },
      required: ['projectRoot'],
      additionalProperties: false,
    },
    handler: async (argumentsValue) => {
      const args = requireObjectArguments('project_preview_stop', argumentsValue);
      const projectRoot = requireStringArgument('project_preview_stop', args, 'projectRoot');
      const sessionId = optionalStringArgument('project_preview_stop', args, 'sessionId');

      return executeTool('project_preview_stop', { projectRoot }, async () => {
        const { contract } = await loadProjectContext('project_preview_stop', projectRoot);
        const canonicalProjectRoot = contract.paths.projectRoot;
        const targets = sessionId
          ? (() => {
              const session = previewSessions.get(sessionId);
              if (!session || session.projectRoot !== canonicalProjectRoot) {
                throw new ValidationError(`Preview session "${sessionId}" was not found for this project.`, {
                  entity: 'mcp-tool',
                  rule: 'project-preview-session-not-found',
                  remediation: 'Call project_preview_status without sessionId to list known sessions first.',
                  metadata: { projectRoot: canonicalProjectRoot, sessionId },
                });
              }
              return [session];
            })()
          : listRunningPreviewSessions(canonicalProjectRoot);

        for (const session of targets) {
          await stopPreviewSession(session);
        }

        return {
          stopped: targets.length,
          sessions: targets.map((session) => summarizePreviewSession(session)),
        };
      });
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
