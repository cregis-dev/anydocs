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

export type ToolDefinition = {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  handler: (argumentsValue: unknown) => Promise<ToolEnvelope>;
};

type ProjectContext = {
  contract: ProjectContract;
  lang?: DocsLang;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toErrorEnvelope(tool: string, caughtError: unknown, meta: Record<string, unknown> = {}): ToolErrorEnvelope {
  const fallbackMessage = caughtError instanceof Error ? caughtError.message : String(caughtError);
  const error =
    caughtError instanceof DomainError
      ? {
          code: caughtError.code,
          message: caughtError.message,
          rule: caughtError.details.rule,
          remediation: caughtError.details.remediation,
          details: caughtError.details.metadata,
        }
      : {
          code: 'MCP_TOOL_ERROR',
          message: fallbackMessage,
        };

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
