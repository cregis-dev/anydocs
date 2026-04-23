import path from 'node:path';

import {
  DomainError,
  PAGE_STATUSES,
  ValidationError,
  createDocsRepository,
  loadProjectContract,
  type DocsLang,
  type PageDoc,
  type PageStatus,
  type ProjectContract,
} from '@anydocs/core';

export type ToolMeta = {
  tool: string;
  [key: string]: unknown;
};

export type ToolSuccessEnvelope<TData> = {
  ok: true;
  data: TData;
  meta: ToolMeta;
};

export type ToolErrorEnvelope = {
  ok: false;
  error: {
    code: string;
    message: string;
    rule?: string;
    remediation?: string;
    details?: Record<string, unknown>;
  };
  meta: ToolMeta;
};

export type ToolEnvelope<TData = unknown> = ToolSuccessEnvelope<TData> | ToolErrorEnvelope;

export type JsonSchema = Record<string, unknown>;

export type ToolAnnotations = {
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
  title?: string;
};

export type ToolDefinition = {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  annotations?: ToolAnnotations;
  handler: (argumentsValue: unknown) => Promise<ToolEnvelope>;
};

export const TOOL_ANNOTATIONS = {
  READ_ONLY: {
    readOnlyHint: true,
    openWorldHint: false,
  },
  IDEMPOTENT_WRITE: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
  NON_IDEMPOTENT_WRITE: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false,
  },
  DESTRUCTIVE: {
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: false,
    openWorldHint: false,
  },
  OPEN_WORLD_WRITE: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
  },
} as const satisfies Record<string, ToolAnnotations>;

type ProjectContext = {
  contract: ProjectContract;
  lang?: DocsLang;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export const MCP_STABLE_ERROR_CODES: ReadonlySet<string> = new Set([
  'VALIDATION_ERROR',
  'MCP_TOOL_ERROR',
  'MCP_PROJECT_ROOT_OUT_OF_SCOPE',
]);

function mapDomainErrorCode(code: string): { publicCode: string; sourceCode?: string } {
  if (MCP_STABLE_ERROR_CODES.has(code)) {
    return { publicCode: code };
  }
  if (code.startsWith('MCP_')) {
    return { publicCode: code };
  }
  return { publicCode: 'MCP_DOMAIN_ERROR', sourceCode: code };
}

function toErrorEnvelope(tool: string, caughtError: unknown, meta: Record<string, unknown> = {}): ToolErrorEnvelope {
  const fallbackMessage = caughtError instanceof Error ? caughtError.message : String(caughtError);
  let error: ToolErrorEnvelope['error'];

  if (caughtError instanceof DomainError) {
    const { publicCode, sourceCode } = mapDomainErrorCode(caughtError.code);
    const existingMetadata = caughtError.details.metadata;
    const details: Record<string, unknown> | undefined =
      sourceCode !== undefined
        ? { ...(existingMetadata ?? {}), sourceCode }
        : existingMetadata;
    error = {
      code: publicCode,
      message: caughtError.message,
      ...(caughtError.details.rule ? { rule: caughtError.details.rule } : {}),
      ...(caughtError.details.remediation ? { remediation: caughtError.details.remediation } : {}),
      ...(details ? { details } : {}),
    };
  } else {
    error = {
      code: 'MCP_TOOL_ERROR',
      message: fallbackMessage,
    };
  }

  return {
    ok: false,
    error,
    meta: {
      tool,
      ...meta,
    },
  };
}

export function createToolSuccess<TData>(
  tool: string,
  data: TData,
  meta: Record<string, unknown> = {},
): ToolSuccessEnvelope<TData> {
  return {
    ok: true,
    data,
    meta: {
      tool,
      ...meta,
    },
  };
}

export function createToolError(
  tool: string,
  caughtError: unknown,
  meta: Record<string, unknown> = {},
): ToolErrorEnvelope {
  return toErrorEnvelope(tool, caughtError, meta);
}

export async function executeTool<TData>(
  tool: string,
  meta: Record<string, unknown>,
  work: () => Promise<TData>,
): Promise<ToolEnvelope<TData>> {
  try {
    return createToolSuccess(tool, await work(), meta);
  } catch (caughtError: unknown) {
    return createToolError(tool, caughtError, meta);
  }
}

export function renderToolResult(envelope: ToolEnvelope) {
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(envelope, null, 2),
      },
    ],
    isError: !envelope.ok,
  };
}

export function requireObjectArguments(tool: string, argumentsValue: unknown): Record<string, unknown> {
  if (argumentsValue == null) {
    return {};
  }

  if (isRecord(argumentsValue)) {
    return argumentsValue;
  }

  throw new ValidationError(`Tool "${tool}" expects an object for arguments.`, {
    entity: 'mcp-tool',
    rule: 'mcp-tool-arguments-must-be-object',
    remediation: 'Pass a JSON object matching the documented MCP tool input contract.',
    metadata: {
      tool,
      receivedType: typeof argumentsValue,
    },
  });
}

function parseAllowedProjectRoots(): string[] | null {
  const raw = process.env.ANYDOCS_MCP_ALLOWED_ROOTS;
  if (!raw) return null;
  const entries = raw
    .split(path.delimiter)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => path.resolve(entry));
  return entries.length > 0 ? entries : null;
}

function isWithinAllowedRoot(candidate: string, allowedRoots: string[]): boolean {
  return allowedRoots.some((root) => {
    if (candidate === root) return true;
    const rel = path.relative(root, candidate);
    return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
  });
}

export function requireProjectRoot(
  tool: string,
  args: Record<string, unknown>,
): string {
  const raw = requireStringArgument(tool, args, 'projectRoot');
  const resolved = path.resolve(raw);
  const allowedRoots = parseAllowedProjectRoots();
  if (allowedRoots && !isWithinAllowedRoot(resolved, allowedRoots)) {
    throw new DomainError(
      'MCP_PROJECT_ROOT_OUT_OF_SCOPE',
      `Tool "${tool}" projectRoot is not inside any entry of ANYDOCS_MCP_ALLOWED_ROOTS.`,
      {
        entity: 'mcp-tool',
        rule: 'mcp-tool-project-root-must-be-in-allowlist',
        remediation:
          'Use a projectRoot inside one of ANYDOCS_MCP_ALLOWED_ROOTS, or unset that env var to allow any absolute path.',
        metadata: { tool, projectRoot: resolved, allowedRoots },
      },
    );
  }
  return resolved;
}

export function requireStringArgument(
  tool: string,
  args: Record<string, unknown>,
  key: string,
): string {
  const value = args[key];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ValidationError(`Tool "${tool}" requires a non-empty string "${key}".`, {
      entity: 'mcp-tool',
      rule: 'mcp-tool-required-string-argument',
      remediation: `Provide "${key}" as a non-empty string.`,
      metadata: {
        tool,
        key,
        received: value,
      },
    });
  }

  return value.trim();
}

export function optionalBooleanArgument(
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

export const DRY_RUN_SCHEMA_FIELD = {
  type: 'boolean',
  description: 'When true, validate inputs and report would-be effect without writing to disk.',
} as const;

export type DryRunPreview<TCurrent = unknown> = {
  dryRun: true;
  action: string;
  wouldExecute: { tool: string; args: Record<string, unknown> };
  current: TCurrent;
};

export function buildDryRunPreview<TCurrent>(
  tool: string,
  action: string,
  args: Record<string, unknown>,
  current: TCurrent,
): DryRunPreview<TCurrent> {
  return {
    dryRun: true,
    action,
    wouldExecute: { tool, args },
    current,
  };
}

export function optionalStringArgument(
  tool: string,
  args: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = args[key];
  if (value == null) {
    return undefined;
  }

  if (typeof value !== 'string') {
    throw new ValidationError(`Tool "${tool}" expects "${key}" to be a string when provided.`, {
      entity: 'mcp-tool',
      rule: 'mcp-tool-optional-string-argument',
      remediation: `Provide "${key}" as a string, or omit it.`,
      metadata: {
        tool,
        key,
        received: value,
      },
    });
  }

  return value.trim();
}

export function optionalStringArrayArgument(
  tool: string,
  args: Record<string, unknown>,
  key: string,
): string[] | undefined {
  const value = args[key];
  if (value == null) {
    return undefined;
  }

  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new ValidationError(`Tool "${tool}" expects "${key}" to be an array of strings.`, {
      entity: 'mcp-tool',
      rule: 'mcp-tool-string-array-argument',
      remediation: `Provide "${key}" as an array of strings, or omit it.`,
      metadata: {
        tool,
        key,
        received: value,
      },
    });
  }

  return value;
}

export function requireKnownPageStatus(
  tool: string,
  status: unknown,
): PageStatus {
  if (typeof status !== 'string' || !PAGE_STATUSES.includes(status as PageStatus)) {
    throw new ValidationError(`Tool "${tool}" received an unknown page status "${String(status)}".`, {
      entity: 'mcp-tool',
      rule: 'mcp-tool-page-status-must-be-known',
      remediation: `Use one of: ${PAGE_STATUSES.join(', ')}.`,
      metadata: {
        tool,
        status,
        knownStatuses: PAGE_STATUSES,
      },
    });
  }

  return status as PageStatus;
}

export async function loadProjectContext(
  tool: string,
  projectRoot: string,
  lang?: string,
): Promise<ProjectContext> {
  const contractResult = await loadProjectContract(projectRoot);
  if (!contractResult.ok) {
    throw contractResult.error;
  }

  const contract = contractResult.value;
  if (lang == null) {
    return { contract };
  }

  if (!contract.config.languages.includes(lang as DocsLang)) {
    throw new ValidationError(`Language "${lang}" is not enabled for the project.`, {
      entity: 'mcp-tool',
      rule: 'mcp-tool-language-must-be-enabled',
      remediation: 'Use one of the enabled languages from anydocs.config.json.',
      metadata: {
        tool,
        lang,
        enabledLanguages: contract.config.languages,
        projectRoot: contract.paths.projectRoot,
      },
    });
  }

  return {
    contract,
    lang: lang as DocsLang,
  };
}

export function summarizePage(page: PageDoc, filePath: string) {
  return {
    id: page.id,
    lang: page.lang,
    slug: page.slug,
    title: page.title,
    description: page.description ?? '',
    ...(page.template ? { template: page.template } : {}),
    status: page.status,
    tags: page.tags ?? [],
    updatedAt: page.updatedAt ?? null,
    file: filePath,
  };
}

export function pageFilePath(projectRoot: string, lang: string, pageId: string): string {
  return path.join(projectRoot, 'pages', lang, `${pageId}.json`);
}

export function navigationFilePath(projectRoot: string, lang: string): string {
  return path.join(projectRoot, 'navigation', `${lang}.json`);
}

export function createRepository(projectRoot: string) {
  return createDocsRepository(projectRoot);
}
