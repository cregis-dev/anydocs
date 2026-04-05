import {
  ValidationError,
  clonePageToLanguage,
  composePageFromTemplate,
  createPagesBatch,
  createPage,
  createPageFromMarkdown,
  deleteAuthoredPage,
  findResolvedProjectPageTemplate,
  findPageBySlug,
  listResolvedProjectPageTemplates,
  listTranslationStatus,
  listPages,
  loadPage,
  setPageStatusesBatch,
  setPageStatus,
  updateProjectConfig,
  updatePagesBatch,
  updatePage,
  updatePageFromMarkdown,
  type ProjectPageTemplateDefinition,
  type PageReview,
  type PageRender,
} from '@anydocs/core';

import {
  type ToolDefinition,
  createRepository,
  executeTool,
  loadProjectContext,
  pageFilePath,
  requireKnownPageStatus,
  requireObjectArguments,
  requireStringArgument,
  summarizePage,
  optionalStringArgument,
  optionalStringArrayArgument,
} from './shared.ts';

const ALLOWED_PAGE_PATCH_FIELDS = new Set([
  'slug',
  'title',
  'description',
  'template',
  'metadata',
  'tags',
  'content',
  'render',
  'review',
]);

type ResolvedTemplate = ReturnType<typeof listResolvedProjectPageTemplates>[number];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function filterPages(
  pages: Awaited<ReturnType<typeof listPages>>,
  options: { status?: string; tag?: string },
) {
  return pages.filter((page) => {
    if (options.status && page.status !== options.status) {
      return false;
    }

    if (options.tag && !(page.tags ?? []).includes(options.tag)) {
      return false;
    }

    return true;
  });
}

function optionalPageRender(
  tool: string,
  args: Record<string, unknown>,
  key: string,
): PageRender | undefined {
  const value = args[key];
  if (value == null) {
    return undefined;
  }

  if (!isRecord(value)) {
    throw new ValidationError(`Tool "${tool}" expects "${key}" to be an object when provided.`, {
      entity: 'mcp-tool',
      rule: 'mcp-tool-object-argument',
      remediation: `Provide "${key}" as an object, or omit it.`,
      metadata: { tool, key, received: value },
    });
  }

  return value as PageRender;
}

function optionalPageReview(
  tool: string,
  args: Record<string, unknown>,
  key: string,
): PageReview | undefined {
  const value = args[key];
  if (value == null) {
    return undefined;
  }

  if (!isRecord(value)) {
    throw new ValidationError(`Tool "${tool}" expects "${key}" to be an object when provided.`, {
      entity: 'mcp-tool',
      rule: 'mcp-tool-object-argument',
      remediation: `Provide "${key}" as an object, or omit it.`,
      metadata: { tool, key, received: value },
    });
  }

  return value as PageReview;
}

function optionalObjectArgument(
  tool: string,
  args: Record<string, unknown>,
  key: string,
): Record<string, unknown> | undefined {
  const value = args[key];
  if (value == null) {
    return undefined;
  }

  if (!isRecord(value)) {
    throw new ValidationError(`Tool "${tool}" expects "${key}" to be an object when provided.`, {
      entity: 'mcp-tool',
      rule: 'mcp-tool-object-argument',
      remediation: `Provide "${key}" as an object, or omit it.`,
      metadata: { tool, key, received: value },
    });
  }

  return value;
}

function requireObjectArrayArgument(
  tool: string,
  args: Record<string, unknown>,
  key: string,
): Array<Record<string, unknown>> {
  const value = args[key];
  if (!Array.isArray(value) || value.some((item) => !isRecord(item))) {
    throw new ValidationError(`Tool "${tool}" expects "${key}" to be an array of objects.`, {
      entity: 'mcp-tool',
      rule: 'mcp-tool-object-array-argument',
      remediation: `Provide "${key}" as an array of objects.`,
      metadata: { tool, key, received: value },
    });
  }

  return value as Array<Record<string, unknown>>;
}

function requireTemplateId(tool: string, value: unknown): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ValidationError(`Tool "${tool}" requires "template" to be a non-empty string.`, {
      entity: 'mcp-tool',
      rule: 'mcp-tool-required-string-argument',
      remediation: 'Provide "template" as a non-empty template id string.',
      metadata: { tool, received: value },
    });
  }

  return value.trim();
}

function requireTemplateDefinition(
  tool: string,
  projectRoot: string,
  templateId: string,
  config: Parameters<typeof listResolvedProjectPageTemplates>[0],
): ResolvedTemplate {
  const resolvedTemplate = findResolvedProjectPageTemplate(config, templateId);
  if (!resolvedTemplate) {
    throw new ValidationError(`Template "${templateId}" is not defined for this project.`, {
      entity: 'mcp-tool',
      rule: 'page-template-kind-must-be-supported',
      remediation: 'Use page_template_query to inspect available built-in and custom template ids.',
      metadata: {
        tool,
        projectRoot,
        templateId,
        availableTemplates: listResolvedProjectPageTemplates(config).map((template) => template.id),
      },
    });
  }

  return resolvedTemplate;
}

function toTemplateSummary(template: ResolvedTemplate) {
  return {
    id: template.id,
    label: template.label,
    ...(template.description ? { description: template.description } : {}),
    baseTemplate: template.baseTemplate,
    builtIn: template.builtIn,
    recommendedInputs: [...template.recommendedInputs],
    ...(template.defaultSummary ? { defaultSummary: template.defaultSummary } : {}),
    ...(template.defaultSections ? { defaultSections: template.defaultSections } : {}),
    ...(template.metadataSchema ? { metadataSchema: template.metadataSchema } : {}),
  };
}

function resolveTemplateSections(
  providedSections: ReturnType<typeof parseTemplateSections>,
  template: ResolvedTemplate,
) {
  if (providedSections !== undefined) {
    return providedSections;
  }

  if (!template.defaultSections?.length) {
    return undefined;
  }

  return template.defaultSections.map((section) => ({
    title: section.title,
    ...(section.body ? { body: section.body } : {}),
  }));
}

function requireTemplatePayloadArgument(
  tool: string,
  args: Record<string, unknown>,
  key: string,
): Record<string, unknown> {
  const value = args[key];
  if (!isRecord(value)) {
    throw new ValidationError(`Tool "${tool}" expects "${key}" to be an object.`, {
      entity: 'mcp-tool',
      rule: 'mcp-tool-object-argument',
      remediation: `Provide "${key}" as an object.`,
      metadata: { tool, key, received: value },
    });
  }
  return value;
}

function parsePatch(tool: string, args: Record<string, unknown>) {
  const patch = optionalObjectArgument(tool, args, 'patch');
  if (!patch) {
    return {};
  }

  const unsupportedFields = Object.keys(patch).filter((key) => !ALLOWED_PAGE_PATCH_FIELDS.has(key));
  if (unsupportedFields.length > 0) {
    throw new ValidationError(`Tool "${tool}" received unsupported page patch fields.`, {
      entity: 'mcp-tool',
      rule: 'page-update-patch-fields-must-be-supported',
      remediation: 'Use only slug, title, description, template, metadata, tags, content, render, and review in page_update.patch.',
      metadata: {
        tool,
        unsupportedFields,
      },
    });
  }

  return {
    ...(typeof patch.slug === 'string' ? { slug: patch.slug } : {}),
    ...(typeof patch.title === 'string' ? { title: patch.title } : {}),
    ...(typeof patch.description === 'string' ? { description: patch.description } : {}),
    ...(typeof patch.template === 'string' ? { template: patch.template } : {}),
    ...(isRecord(patch.metadata) ? { metadata: patch.metadata } : {}),
    ...(Array.isArray(patch.tags) ? { tags: patch.tags as string[] } : {}),
    ...('content' in patch ? { content: patch.content } : {}),
    ...(isRecord(patch.render) ? { render: patch.render as PageRender } : {}),
    ...(isRecord(patch.review) ? { review: patch.review as PageReview } : {}),
  };
}

function parseTemplateCallout(
  tool: string,
  value: unknown,
  key: string,
): { title?: string; body: string; theme?: 'info' | 'warning' | 'success' } {
  if (!isRecord(value)) {
    throw new ValidationError(`Tool "${tool}" expects "${key}" to be an object.`, {
      entity: 'mcp-tool',
      rule: 'mcp-tool-object-argument',
      remediation: `Provide "${key}" as an object.`,
      metadata: { tool, key, received: value },
    });
  }

  return {
    ...(typeof value.title === 'string' ? { title: value.title } : {}),
    body: requireStringArgument(tool, value, 'body'),
    ...(typeof value.theme === 'string' ? { theme: value.theme as 'info' | 'warning' | 'success' } : {}),
  };
}

function parseTemplateSections(tool: string, args: Record<string, unknown>, key: string) {
  const value = args[key];
  if (value == null) {
    return undefined;
  }

  return requireObjectArrayArgument(tool, args, key).map((section) => ({
    title: requireStringArgument(tool, section, 'title'),
    ...(typeof section.body === 'string' ? { body: section.body } : {}),
    ...(Array.isArray(section.items) ? { items: section.items as string[] } : {}),
    ...(typeof section.code === 'string' ? { code: section.code } : {}),
    ...(typeof section.language === 'string' ? { language: section.language } : {}),
    ...(section.callout ? { callout: parseTemplateCallout(tool, section.callout, 'callout') } : {}),
  }));
}

function parseTemplateSteps(tool: string, args: Record<string, unknown>, key: string) {
  const value = args[key];
  if (value == null) {
    return undefined;
  }

  return requireObjectArrayArgument(tool, args, key).map((step) => ({
    title: requireStringArgument(tool, step, 'title'),
    ...(typeof step.body === 'string' ? { body: step.body } : {}),
    ...(typeof step.code === 'string' ? { code: step.code } : {}),
    ...(typeof step.language === 'string' ? { language: step.language } : {}),
  }));
}

function parseTemplateCallouts(tool: string, args: Record<string, unknown>, key: string) {
  const value = args[key];
  if (value == null) {
    return undefined;
  }

  return requireObjectArrayArgument(tool, args, key).map((callout) => parseTemplateCallout(tool, callout, key));
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

function optionalMarkdownInputModeArgument(
  tool: string,
  args: Record<string, unknown>,
  key: string,
): 'document' | 'fragment' | undefined {
  const value = args[key];
  if (value == null) {
    return undefined;
  }

  if (value !== 'document' && value !== 'fragment') {
    throw new ValidationError(`Tool "${tool}" expects "${key}" to be "document" or "fragment" when provided.`, {
      entity: 'mcp-tool',
      rule: 'mcp-tool-markdown-input-mode-argument',
      remediation: `Provide "${key}" as "document" or "fragment", or omit it.`,
      metadata: { tool, key, received: value },
    });
  }

  return value;
}

function optionalMarkdownFormatArgument(
  tool: string,
  args: Record<string, unknown>,
  key: string,
): 'markdown' | 'mdx' | undefined {
  const value = args[key];
  if (value == null) {
    return undefined;
  }

  if (value !== 'markdown' && value !== 'mdx') {
    throw new ValidationError(`Tool "${tool}" expects "${key}" to be "markdown" or "mdx" when provided.`, {
      entity: 'mcp-tool',
      rule: 'mcp-tool-markdown-format-argument',
      remediation: `Provide "${key}" as "markdown" or "mdx", or omit it.`,
      metadata: { tool, key, received: value },
    });
  }

  return value;
}

function optionalMarkdownUpdateOperationArgument(
  tool: string,
  args: Record<string, unknown>,
  key: string,
): 'replace' | 'append' | undefined {
  const value = args[key];
  if (value == null) {
    return undefined;
  }

  if (value !== 'replace' && value !== 'append') {
    throw new ValidationError(`Tool "${tool}" expects "${key}" to be "replace" or "append" when provided.`, {
      entity: 'mcp-tool',
      rule: 'mcp-tool-markdown-operation-argument',
      remediation: `Provide "${key}" as "replace" or "append", or omit it.`,
      metadata: { tool, key, received: value },
    });
  }

  return value;
}

export const pageTools: ToolDefinition[] = [
  {
    name: 'page_list',
    description: 'List Anydocs pages for an enabled language, with optional status and tag filters.',
    inputSchema: {
      type: 'object',
      properties: {
        projectRoot: { type: 'string' },
        lang: { type: 'string' },
        status: { type: 'string', enum: ['draft', 'in_review', 'published'] },
        tag: { type: 'string' },
      },
      required: ['projectRoot', 'lang'],
      additionalProperties: false,
    },
    handler: async (argumentsValue) => {
      const args = requireObjectArguments('page_list', argumentsValue);
      const projectRoot = requireStringArgument('page_list', args, 'projectRoot');
      const lang = requireStringArgument('page_list', args, 'lang');
      const status = args.status == null ? undefined : requireKnownPageStatus('page_list', args.status);
      const tag = optionalStringArgument('page_list', args, 'tag');

      return executeTool('page_list', { projectRoot, lang }, async () => {
        const context = await loadProjectContext('page_list', projectRoot, lang);
        const repository = createRepository(context.contract.paths.projectRoot);
        const pages = filterPages(await listPages(repository, context.lang!), { status, tag });

        return {
          lang: context.lang,
          count: pages.length,
          pages: pages.map((page) =>
            summarizePage(page, pageFilePath(context.contract.paths.projectRoot, context.lang!, page.id)),
          ),
        };
      });
    },
  },
  {
    name: 'page_get',
    description: 'Load a canonical Anydocs page document by page id.',
    inputSchema: {
      type: 'object',
      properties: {
        projectRoot: { type: 'string' },
        lang: { type: 'string' },
        pageId: { type: 'string' },
      },
      required: ['projectRoot', 'lang', 'pageId'],
      additionalProperties: false,
    },
    handler: async (argumentsValue) => {
      const args = requireObjectArguments('page_get', argumentsValue);
      const projectRoot = requireStringArgument('page_get', args, 'projectRoot');
      const lang = requireStringArgument('page_get', args, 'lang');
      const pageId = requireStringArgument('page_get', args, 'pageId');

      return executeTool('page_get', { projectRoot, lang, pageId }, async () => {
        const context = await loadProjectContext('page_get', projectRoot, lang);
        const repository = createRepository(context.contract.paths.projectRoot);
        const page = await loadPage(repository, context.lang!, pageId);
        if (!page) {
          throw new ValidationError(`Page "${pageId}" not found.`, {
            entity: 'page-doc',
            rule: 'page-must-exist',
            remediation: 'Use page_list or page_find to inspect available pages before retrying.',
            metadata: {
              lang: context.lang,
              pageId,
              projectRoot: context.contract.paths.projectRoot,
            },
          });
        }

        return {
          file: pageFilePath(context.contract.paths.projectRoot, context.lang!, page.id),
          page,
        };
      });
    },
  },
  {
    name: 'page_find',
    description:
      'Find Anydocs pages by page id or slug, with optional status and tag filters. Omitting both returns all pages.',
    inputSchema: {
      type: 'object',
      properties: {
        projectRoot: { type: 'string' },
        lang: { type: 'string' },
        pageId: { type: 'string' },
        slug: { type: 'string' },
        status: { type: 'string', enum: ['draft', 'in_review', 'published'] },
        tag: { type: 'string' },
      },
      required: ['projectRoot', 'lang'],
      additionalProperties: false,
    },
    handler: async (argumentsValue) => {
      const args = requireObjectArguments('page_find', argumentsValue);
      const projectRoot = requireStringArgument('page_find', args, 'projectRoot');
      const lang = requireStringArgument('page_find', args, 'lang');
      const pageId = optionalStringArgument('page_find', args, 'pageId');
      const slug = optionalStringArgument('page_find', args, 'slug');
      const status = args.status == null ? undefined : requireKnownPageStatus('page_find', args.status);
      const tag = optionalStringArgument('page_find', args, 'tag');

      return executeTool('page_find', { projectRoot, lang }, async () => {
        const context = await loadProjectContext('page_find', projectRoot, lang);
        const repository = createRepository(context.contract.paths.projectRoot);
        let pages = [];

        if (pageId) {
          const page = await loadPage(repository, context.lang!, pageId);
          pages = page ? [page] : [];
        } else if (slug) {
          const page = await findPageBySlug(repository, context.lang!, slug);
          pages = page ? [page] : [];
        } else {
          pages = await listPages(repository, context.lang!);
        }

        const matches = filterPages(pages, { status, tag }).map((page) =>
          summarizePage(page, pageFilePath(context.contract.paths.projectRoot, context.lang!, page.id)),
        );

        return {
          query: {
            lang: context.lang,
            pageId: pageId ?? null,
            slug: slug ?? null,
            status: status ?? null,
            tag: tag ?? null,
          },
          matches,
        };
      });
    },
  },
  {
    name: 'page_clone_to_language',
    description:
      'Clone a page into another enabled language as a draft skeleton, with optional content copying but no translation.',
    inputSchema: {
      type: 'object',
      properties: {
        projectRoot: { type: 'string' },
        sourceLang: { type: 'string' },
        targetLang: { type: 'string' },
        sourcePageId: { type: 'string' },
        includeContent: { type: 'boolean' },
      },
      required: ['projectRoot', 'sourceLang', 'targetLang', 'sourcePageId'],
      additionalProperties: false,
    },
    handler: async (argumentsValue) => {
      const args = requireObjectArguments('page_clone_to_language', argumentsValue);
      const projectRoot = requireStringArgument('page_clone_to_language', args, 'projectRoot');
      const sourceLang = requireStringArgument('page_clone_to_language', args, 'sourceLang');
      const targetLang = requireStringArgument('page_clone_to_language', args, 'targetLang');
      const sourcePageId = requireStringArgument('page_clone_to_language', args, 'sourcePageId');
      const includeContent = optionalBooleanArgument('page_clone_to_language', args, 'includeContent');

      return executeTool(
        'page_clone_to_language',
        { projectRoot, sourceLang, targetLang, sourcePageId },
        async () => {
          await loadProjectContext('page_clone_to_language', projectRoot, sourceLang);
          await loadProjectContext('page_clone_to_language', projectRoot, targetLang);
          return clonePageToLanguage({
            projectRoot,
            sourceLang: sourceLang as 'en' | 'zh',
            targetLang: targetLang as 'en' | 'zh',
            sourcePageId,
            ...(includeContent !== undefined ? { includeContent } : {}),
          });
        },
      );
    },
  },
  {
    name: 'page_list_translation_status',
    description:
      'List page pairing status between two enabled languages without invoking translation or changing content.',
    inputSchema: {
      type: 'object',
      properties: {
        projectRoot: { type: 'string' },
        sourceLang: { type: 'string' },
        targetLang: { type: 'string' },
      },
      required: ['projectRoot', 'sourceLang', 'targetLang'],
      additionalProperties: false,
    },
    handler: async (argumentsValue) => {
      const args = requireObjectArguments('page_list_translation_status', argumentsValue);
      const projectRoot = requireStringArgument('page_list_translation_status', args, 'projectRoot');
      const sourceLang = requireStringArgument('page_list_translation_status', args, 'sourceLang');
      const targetLang = requireStringArgument('page_list_translation_status', args, 'targetLang');

      return executeTool(
        'page_list_translation_status',
        { projectRoot, sourceLang, targetLang },
        async () => {
          await loadProjectContext('page_list_translation_status', projectRoot, sourceLang);
          await loadProjectContext('page_list_translation_status', projectRoot, targetLang);
          const pages = await listTranslationStatus(
            projectRoot,
            sourceLang as 'en' | 'zh',
            targetLang as 'en' | 'zh',
          );
          return {
            count: pages.length,
            pages,
          };
        },
      );
    },
  },
  {
    name: 'page_template_save',
    description:
      'Create or update a project-defined authoring page template by id without touching unrelated project config.',
    inputSchema: {
      type: 'object',
      properties: {
        projectRoot: { type: 'string' },
        template: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            label: {
              oneOf: [
                { type: 'string' },
                { type: 'object', additionalProperties: { type: 'string' } },
              ],
            },
            description: { type: 'string' },
            baseTemplate: { type: 'string', enum: ['concept', 'how_to', 'reference'] },
            defaultSummary: { type: 'string' },
            defaultSections: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  body: { type: 'string' },
                },
                required: ['title'],
                additionalProperties: false,
              },
            },
            metadataSchema: {
              type: 'object',
              properties: {
                fields: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      label: {
                        oneOf: [
                          { type: 'string' },
                          { type: 'object', additionalProperties: { type: 'string' } },
                        ],
                      },
                      type: { type: 'string', enum: ['string', 'text', 'enum', 'boolean', 'date', 'string[]'] },
                      required: { type: 'boolean' },
                      visibility: { type: 'string', enum: ['public', 'internal'] },
                      options: { type: 'array', items: { type: 'string' } },
                    },
                    required: ['id', 'label', 'type'],
                    additionalProperties: false,
                  },
                },
              },
              required: ['fields'],
              additionalProperties: false,
            },
          },
          required: ['id', 'label', 'baseTemplate'],
          additionalProperties: false,
        },
      },
      required: ['projectRoot', 'template'],
      additionalProperties: false,
    },
    handler: async (argumentsValue) => {
      const args = requireObjectArguments('page_template_save', argumentsValue);
      const projectRoot = requireStringArgument('page_template_save', args, 'projectRoot');
      const templatePayload = requireTemplatePayloadArgument('page_template_save', args, 'template');
      const templateId = requireStringArgument('page_template_save', templatePayload, 'id');

      return executeTool('page_template_save', { projectRoot, templateId }, async () => {
        const { contract } = await loadProjectContext('page_template_save', projectRoot);
        const existingTemplates = contract.config.authoring?.pageTemplates ?? [];
        const existingIndex = existingTemplates.findIndex((template) => template.id === templateId);
        const existingTemplate = existingIndex >= 0 ? existingTemplates[existingIndex] : undefined;
        const nextTemplate = {
          ...(existingTemplate ?? {}),
          ...templatePayload,
          id: templateId,
        } as unknown as ProjectPageTemplateDefinition;
        const nextTemplates =
          existingIndex >= 0
            ? existingTemplates.map((template, index) => (index === existingIndex ? nextTemplate : template))
            : [...existingTemplates, nextTemplate];

        const updateResult = await updateProjectConfig(projectRoot, {
          authoring: { pageTemplates: nextTemplates },
        });
        if (!updateResult.ok) {
          throw updateResult.error;
        }

        const savedTemplate = requireTemplateDefinition(
          'page_template_save',
          projectRoot,
          templateId,
          updateResult.value,
        );

        return {
          configFile: contract.paths.configFile,
          action: existingIndex >= 0 ? 'updated' : 'created',
          template: toTemplateSummary(savedTemplate),
        };
      });
    },
  },
  {
    name: 'page_template_query',
    description: 'Query built-in and project-defined page templates, or inspect one by template id.',
    inputSchema: {
      type: 'object',
      properties: {
        projectRoot: { type: 'string' },
        templateId: { type: 'string' },
      },
      required: ['projectRoot'],
      additionalProperties: false,
    },
    handler: async (argumentsValue) => {
      const args = requireObjectArguments('page_template_query', argumentsValue);
      const projectRoot = requireStringArgument('page_template_query', args, 'projectRoot');
      const templateId = optionalStringArgument('page_template_query', args, 'templateId');

      return executeTool('page_template_query', { projectRoot }, async () => {
        const { contract } = await loadProjectContext('page_template_query', projectRoot);
        const resolvedTemplates = listResolvedProjectPageTemplates(contract.config);
        if (!templateId) {
          return {
            templates: resolvedTemplates.map((template) => toTemplateSummary(template)),
          };
        }

        const template = requireTemplateDefinition(
          'page_template_query',
          projectRoot,
          templateId,
          contract.config,
        );

        return {
          template: toTemplateSummary(template),
        };
      });
    },
  },
  {
    name: 'page_create',
    description: 'Create a canonical Anydocs page document through the shared authoring service.',
    inputSchema: {
      type: 'object',
      properties: {
        projectRoot: { type: 'string' },
        lang: { type: 'string' },
        pageId: { type: 'string' },
        slug: { type: 'string' },
        title: { type: 'string' },
        description: { type: 'string' },
        template: { type: 'string' },
        metadata: { type: 'object' },
        tags: { type: 'array', items: { type: 'string' } },
        status: { type: 'string', enum: ['draft', 'in_review', 'published'] },
        content: { type: 'object' },
        render: { type: 'object' },
        review: { type: 'object' },
      },
      required: ['projectRoot', 'lang', 'pageId', 'slug', 'title'],
      additionalProperties: false,
    },
    handler: async (argumentsValue) => {
      const args = requireObjectArguments('page_create', argumentsValue);
      const projectRoot = requireStringArgument('page_create', args, 'projectRoot');
      const lang = requireStringArgument('page_create', args, 'lang');
      const pageId = requireStringArgument('page_create', args, 'pageId');
      const slug = requireStringArgument('page_create', args, 'slug');
      const title = requireStringArgument('page_create', args, 'title');
      const description = optionalStringArgument('page_create', args, 'description');
      const template = optionalStringArgument('page_create', args, 'template');
      const metadata = optionalObjectArgument('page_create', args, 'metadata');
      const tags = optionalStringArrayArgument('page_create', args, 'tags');
      const status = args.status == null ? undefined : requireKnownPageStatus('page_create', args.status);
      const content = optionalObjectArgument('page_create', args, 'content');
      const render = optionalPageRender('page_create', args, 'render');
      const review = optionalPageReview('page_create', args, 'review');

      return executeTool('page_create', { projectRoot, lang, pageId }, async () => {
        const result = await createPage({
          projectRoot,
          lang: (await loadProjectContext('page_create', projectRoot, lang)).lang!,
          page: {
            id: pageId,
            slug,
            title,
            description,
            template,
            metadata,
            tags,
            status,
            content,
            render,
            review,
          },
        });

        return result;
      });
    },
  },
  {
    name: 'page_create_from_markdown',
    description:
      'Create a canonical Anydocs page from markdown or MDX text, inferring title/description/tags from document content when possible.',
    inputSchema: {
      type: 'object',
      properties: {
        projectRoot: { type: 'string' },
        lang: { type: 'string' },
        pageId: { type: 'string' },
        slug: { type: 'string' },
        markdown: { type: 'string' },
        inputMode: { type: 'string', enum: ['document', 'fragment'] },
        format: { type: 'string', enum: ['markdown', 'mdx'] },
        sourcePath: { type: 'string' },
        title: { type: 'string' },
        description: { type: 'string' },
        template: { type: 'string' },
        metadata: { type: 'object' },
        tags: { type: 'array', items: { type: 'string' } },
        status: { type: 'string', enum: ['draft', 'in_review', 'published'] },
        review: { type: 'object' },
      },
      required: ['projectRoot', 'lang', 'pageId', 'slug', 'markdown'],
      additionalProperties: false,
    },
    handler: async (argumentsValue) => {
      const args = requireObjectArguments('page_create_from_markdown', argumentsValue);
      const projectRoot = requireStringArgument('page_create_from_markdown', args, 'projectRoot');
      const lang = requireStringArgument('page_create_from_markdown', args, 'lang');
      const pageId = requireStringArgument('page_create_from_markdown', args, 'pageId');
      const slug = requireStringArgument('page_create_from_markdown', args, 'slug');
      const markdown = requireStringArgument('page_create_from_markdown', args, 'markdown');
      const inputMode = optionalMarkdownInputModeArgument('page_create_from_markdown', args, 'inputMode');
      const format = optionalMarkdownFormatArgument('page_create_from_markdown', args, 'format');
      const sourcePath = optionalStringArgument('page_create_from_markdown', args, 'sourcePath');
      const title = optionalStringArgument('page_create_from_markdown', args, 'title');
      const description = optionalStringArgument('page_create_from_markdown', args, 'description');
      const template = optionalStringArgument('page_create_from_markdown', args, 'template');
      const metadata = optionalObjectArgument('page_create_from_markdown', args, 'metadata');
      const tags = optionalStringArrayArgument('page_create_from_markdown', args, 'tags');
      const status =
        args.status == null ? undefined : requireKnownPageStatus('page_create_from_markdown', args.status);
      const review = optionalPageReview('page_create_from_markdown', args, 'review');

      return executeTool('page_create_from_markdown', { projectRoot, lang, pageId }, async () => {
        const context = await loadProjectContext('page_create_from_markdown', projectRoot, lang);
        return createPageFromMarkdown({
          projectRoot,
          lang: context.lang!,
          markdown,
          ...(inputMode ? { inputMode } : {}),
          ...(format ? { format } : {}),
          ...(sourcePath ? { sourcePath } : {}),
          page: {
            id: pageId,
            slug,
            ...(title ? { title } : {}),
            ...(description ? { description } : {}),
            ...(template ? { template } : {}),
            ...(metadata ? { metadata } : {}),
            ...(tags ? { tags } : {}),
            ...(status ? { status } : {}),
            ...(review ? { review } : {}),
          },
        });
      });
    },
  },
  {
    name: 'page_create_from_template',
    description:
      'Create a canonical Anydocs page from a structured rich-content template, generating DocContentV1 and render output.',
    inputSchema: {
      type: 'object',
      properties: {
        projectRoot: { type: 'string' },
        lang: { type: 'string' },
        pageId: { type: 'string' },
        slug: { type: 'string' },
        title: { type: 'string' },
        template: { type: 'string' },
        description: { type: 'string' },
        metadata: { type: 'object' },
        tags: { type: 'array', items: { type: 'string' } },
        status: { type: 'string', enum: ['draft', 'in_review', 'published'] },
        review: { type: 'object' },
        summary: { type: 'string' },
        sections: { type: 'array', items: { type: 'object' } },
        steps: { type: 'array', items: { type: 'object' } },
        callouts: { type: 'array', items: { type: 'object' } },
      },
      required: ['projectRoot', 'lang', 'pageId', 'slug', 'title', 'template'],
      additionalProperties: false,
    },
    handler: async (argumentsValue) => {
      const args = requireObjectArguments('page_create_from_template', argumentsValue);
      const projectRoot = requireStringArgument('page_create_from_template', args, 'projectRoot');
      const lang = requireStringArgument('page_create_from_template', args, 'lang');
      const pageId = requireStringArgument('page_create_from_template', args, 'pageId');
      const slug = requireStringArgument('page_create_from_template', args, 'slug');
      const title = requireStringArgument('page_create_from_template', args, 'title');
      const templateId = requireTemplateId('page_create_from_template', args.template);
      const description = optionalStringArgument('page_create_from_template', args, 'description');
      const metadata = optionalObjectArgument('page_create_from_template', args, 'metadata');
      const tags = optionalStringArrayArgument('page_create_from_template', args, 'tags');
      const status =
        args.status == null ? undefined : requireKnownPageStatus('page_create_from_template', args.status);
      const review = optionalPageReview('page_create_from_template', args, 'review');
      const summary = optionalStringArgument('page_create_from_template', args, 'summary');
      const sections = parseTemplateSections('page_create_from_template', args, 'sections');
      const steps = parseTemplateSteps('page_create_from_template', args, 'steps');
      const callouts = parseTemplateCallouts('page_create_from_template', args, 'callouts');

      return executeTool('page_create_from_template', { projectRoot, lang, pageId }, async () => {
        const context = await loadProjectContext('page_create_from_template', projectRoot, lang);
        const resolvedTemplate = requireTemplateDefinition(
          'page_create_from_template',
          projectRoot,
          templateId,
          context.contract.config,
        );
        const summaryForTemplate = summary ?? resolvedTemplate.defaultSummary;
        const sectionsForTemplate = resolveTemplateSections(sections, resolvedTemplate);
        const composition = composePageFromTemplate({
          template: resolvedTemplate.baseTemplate,
          ...(summaryForTemplate ? { summary: summaryForTemplate } : {}),
          ...(sectionsForTemplate ? { sections: sectionsForTemplate } : {}),
          ...(steps ? { steps } : {}),
          ...(callouts ? { callouts } : {}),
        });

        return createPage({
          projectRoot,
          lang: context.lang!,
          page: {
            id: pageId,
            slug,
            title,
            description,
            template: resolvedTemplate.id,
            ...(metadata ? { metadata } : {}),
            tags,
            status,
            review,
            content: composition.content,
            render: composition.render,
          },
        });
      });
    },
  },
  {
    name: 'page_update_from_template',
    description:
      'Update an existing canonical Anydocs page from a structured rich-content template, regenerating DocContentV1 and render output.',
    inputSchema: {
      type: 'object',
      properties: {
        projectRoot: { type: 'string' },
        lang: { type: 'string' },
        pageId: { type: 'string' },
        template: { type: 'string' },
        slug: { type: 'string' },
        title: { type: 'string' },
        description: { type: 'string' },
        metadata: { type: 'object' },
        tags: { type: 'array', items: { type: 'string' } },
        review: { type: 'object' },
        summary: { type: 'string' },
        sections: { type: 'array', items: { type: 'object' } },
        steps: { type: 'array', items: { type: 'object' } },
        callouts: { type: 'array', items: { type: 'object' } },
      },
      required: ['projectRoot', 'lang', 'pageId', 'template'],
      additionalProperties: false,
    },
    handler: async (argumentsValue) => {
      const args = requireObjectArguments('page_update_from_template', argumentsValue);
      const projectRoot = requireStringArgument('page_update_from_template', args, 'projectRoot');
      const lang = requireStringArgument('page_update_from_template', args, 'lang');
      const pageId = requireStringArgument('page_update_from_template', args, 'pageId');
      const templateId = requireTemplateId('page_update_from_template', args.template);
      const slug = optionalStringArgument('page_update_from_template', args, 'slug');
      const title = optionalStringArgument('page_update_from_template', args, 'title');
      const description = optionalStringArgument('page_update_from_template', args, 'description');
      const metadata = optionalObjectArgument('page_update_from_template', args, 'metadata');
      const tags = optionalStringArrayArgument('page_update_from_template', args, 'tags');
      const review = optionalPageReview('page_update_from_template', args, 'review');
      const summary = optionalStringArgument('page_update_from_template', args, 'summary');
      const sections = parseTemplateSections('page_update_from_template', args, 'sections');
      const steps = parseTemplateSteps('page_update_from_template', args, 'steps');
      const callouts = parseTemplateCallouts('page_update_from_template', args, 'callouts');

      return executeTool('page_update_from_template', { projectRoot, lang, pageId }, async () => {
        const context = await loadProjectContext('page_update_from_template', projectRoot, lang);
        const resolvedTemplate = requireTemplateDefinition(
          'page_update_from_template',
          projectRoot,
          templateId,
          context.contract.config,
        );
        const summaryForTemplate = summary ?? resolvedTemplate.defaultSummary;
        const sectionsForTemplate = resolveTemplateSections(sections, resolvedTemplate);
        const composition = composePageFromTemplate({
          template: resolvedTemplate.baseTemplate,
          ...(summaryForTemplate ? { summary: summaryForTemplate } : {}),
          ...(sectionsForTemplate ? { sections: sectionsForTemplate } : {}),
          ...(steps ? { steps } : {}),
          ...(callouts ? { callouts } : {}),
        });

        return updatePage({
          projectRoot,
          lang: context.lang!,
          pageId,
          patch: {
            ...(slug ? { slug } : {}),
            ...(title ? { title } : {}),
            ...(description ? { description } : {}),
            template: resolvedTemplate.id,
            ...(metadata ? { metadata } : {}),
            ...(tags ? { tags } : {}),
            ...(review ? { review } : {}),
            content: composition.content,
            render: composition.render,
          },
        });
      });
    },
  },
  {
    name: 'page_batch_create',
    description: 'Create multiple canonical page documents in one validated batch.',
    inputSchema: {
      type: 'object',
      properties: {
        projectRoot: { type: 'string' },
        lang: { type: 'string' },
        pages: {
          type: 'array',
          description: 'Array of page create payloads.',
          items: { type: 'object' },
        },
      },
      required: ['projectRoot', 'lang', 'pages'],
      additionalProperties: false,
    },
    handler: async (argumentsValue) => {
      const args = requireObjectArguments('page_batch_create', argumentsValue);
      const projectRoot = requireStringArgument('page_batch_create', args, 'projectRoot');
      const lang = requireStringArgument('page_batch_create', args, 'lang');
      const pages = requireObjectArrayArgument('page_batch_create', args, 'pages').map((page, index) => ({
        id: requireStringArgument('page_batch_create', page, 'id'),
        slug: requireStringArgument('page_batch_create', page, 'slug'),
        title: requireStringArgument('page_batch_create', page, 'title'),
        description: optionalStringArgument('page_batch_create', page, 'description'),
        template: optionalStringArgument('page_batch_create', page, 'template'),
        metadata: optionalObjectArgument('page_batch_create', page, 'metadata'),
        tags: optionalStringArrayArgument('page_batch_create', page, 'tags'),
        status:
          page.status == null ? undefined : requireKnownPageStatus('page_batch_create', page.status),
        content: optionalObjectArgument('page_batch_create', page, 'content'),
        render: optionalPageRender('page_batch_create', page, 'render'),
        review: optionalPageReview('page_batch_create', page, 'review'),
        __index: index,
      }));

      return executeTool('page_batch_create', { projectRoot, lang }, async () => {
        const context = await loadProjectContext('page_batch_create', projectRoot, lang);
        return createPagesBatch({
          projectRoot,
          lang: context.lang!,
          pages: pages.map(({ __index: _unused, ...page }) => page),
        });
      });
    },
  },
  {
    name: 'page_update',
    description:
      'Shallow-merge an explicit whitelist of mutable page fields onto an existing canonical page document.',
    inputSchema: {
      type: 'object',
      properties: {
        projectRoot: { type: 'string' },
        lang: { type: 'string' },
        pageId: { type: 'string' },
        patch: {
          type: 'object',
          description:
            'Allowed fields: slug, title, description, template, metadata, tags, content, render, review. Unsupported fields are rejected.',
          additionalProperties: true,
        },
        regenerateRender: {
          type: 'boolean',
          description:
            'When true and patch.render is omitted, regenerate render.markdown/plainText from the resulting canonical content.',
        },
      },
      required: ['projectRoot', 'lang', 'pageId', 'patch'],
      additionalProperties: false,
    },
    handler: async (argumentsValue) => {
      const args = requireObjectArguments('page_update', argumentsValue);
      const projectRoot = requireStringArgument('page_update', args, 'projectRoot');
      const lang = requireStringArgument('page_update', args, 'lang');
      const pageId = requireStringArgument('page_update', args, 'pageId');

      return executeTool('page_update', { projectRoot, lang, pageId }, async () => {
        const patch = parsePatch('page_update', args);
        const regenerateRender = optionalBooleanArgument('page_update', args, 'regenerateRender');
        const context = await loadProjectContext('page_update', projectRoot, lang);
        return updatePage({
          projectRoot,
          lang: context.lang!,
          pageId,
          patch,
          regenerateRender,
        });
      });
    },
  },
  {
    name: 'page_update_from_markdown',
    description:
      'Replace or append markdown-derived content on an existing page, supporting both whole-document and fragment conversion workflows.',
    inputSchema: {
      type: 'object',
      properties: {
        projectRoot: { type: 'string' },
        lang: { type: 'string' },
        pageId: { type: 'string' },
        markdown: { type: 'string' },
        operation: { type: 'string', enum: ['replace', 'append'] },
        inputMode: { type: 'string', enum: ['document', 'fragment'] },
        format: { type: 'string', enum: ['markdown', 'mdx'] },
        sourcePath: { type: 'string' },
        slug: { type: 'string' },
        title: { type: 'string' },
        description: { type: 'string' },
        template: { type: 'string' },
        metadata: { type: 'object' },
        tags: { type: 'array', items: { type: 'string' } },
        review: { type: 'object' },
      },
      required: ['projectRoot', 'lang', 'pageId', 'markdown'],
      additionalProperties: false,
    },
    handler: async (argumentsValue) => {
      const args = requireObjectArguments('page_update_from_markdown', argumentsValue);
      const projectRoot = requireStringArgument('page_update_from_markdown', args, 'projectRoot');
      const lang = requireStringArgument('page_update_from_markdown', args, 'lang');
      const pageId = requireStringArgument('page_update_from_markdown', args, 'pageId');
      const markdown = requireStringArgument('page_update_from_markdown', args, 'markdown');
      const operation = optionalMarkdownUpdateOperationArgument('page_update_from_markdown', args, 'operation');
      const inputMode = optionalMarkdownInputModeArgument('page_update_from_markdown', args, 'inputMode');
      const format = optionalMarkdownFormatArgument('page_update_from_markdown', args, 'format');
      const sourcePath = optionalStringArgument('page_update_from_markdown', args, 'sourcePath');
      const slug = optionalStringArgument('page_update_from_markdown', args, 'slug');
      const title = optionalStringArgument('page_update_from_markdown', args, 'title');
      const description = optionalStringArgument('page_update_from_markdown', args, 'description');
      const template = optionalStringArgument('page_update_from_markdown', args, 'template');
      const metadata = optionalObjectArgument('page_update_from_markdown', args, 'metadata');
      const tags = optionalStringArrayArgument('page_update_from_markdown', args, 'tags');
      const review = optionalPageReview('page_update_from_markdown', args, 'review');

      return executeTool('page_update_from_markdown', { projectRoot, lang, pageId }, async () => {
        const context = await loadProjectContext('page_update_from_markdown', projectRoot, lang);
        return updatePageFromMarkdown({
          projectRoot,
          lang: context.lang!,
          pageId,
          markdown,
          ...(operation ? { operation } : {}),
          ...(inputMode ? { inputMode } : {}),
          ...(format ? { format } : {}),
          ...(sourcePath ? { sourcePath } : {}),
          patch: {
            ...(slug ? { slug } : {}),
            ...(title ? { title } : {}),
            ...(description ? { description } : {}),
            ...(template ? { template } : {}),
            ...(metadata ? { metadata } : {}),
            ...(tags ? { tags } : {}),
            ...(review ? { review } : {}),
          },
        });
      });
    },
  },
  {
    name: 'page_batch_update',
    description: 'Apply shallow page patches to multiple canonical page documents in one validated batch.',
    inputSchema: {
      type: 'object',
      properties: {
        projectRoot: { type: 'string' },
        lang: { type: 'string' },
        updates: {
          type: 'array',
          description: 'Array of { pageId, patch, regenerateRender? } entries.',
          items: { type: 'object' },
        },
      },
      required: ['projectRoot', 'lang', 'updates'],
      additionalProperties: false,
    },
    handler: async (argumentsValue) => {
      const args = requireObjectArguments('page_batch_update', argumentsValue);
      const projectRoot = requireStringArgument('page_batch_update', args, 'projectRoot');
      const lang = requireStringArgument('page_batch_update', args, 'lang');
      const updates = requireObjectArrayArgument('page_batch_update', args, 'updates').map((entry) => ({
        pageId: requireStringArgument('page_batch_update', entry, 'pageId'),
        patch: parsePatch('page_batch_update', entry),
        regenerateRender: optionalBooleanArgument('page_batch_update', entry, 'regenerateRender'),
      }));

      return executeTool('page_batch_update', { projectRoot, lang }, async () => {
        const context = await loadProjectContext('page_batch_update', projectRoot, lang);
        return updatePagesBatch({
          projectRoot,
          lang: context.lang!,
          updates,
        });
      });
    },
  },
  {
    name: 'page_delete',
    description: 'Delete a canonical Anydocs page and remove matching navigation references in that language.',
    inputSchema: {
      type: 'object',
      properties: {
        projectRoot: { type: 'string' },
        lang: { type: 'string' },
        pageId: { type: 'string' },
      },
      required: ['projectRoot', 'lang', 'pageId'],
      additionalProperties: false,
    },
    handler: async (argumentsValue) => {
      const args = requireObjectArguments('page_delete', argumentsValue);
      const projectRoot = requireStringArgument('page_delete', args, 'projectRoot');
      const lang = requireStringArgument('page_delete', args, 'lang');
      const pageId = requireStringArgument('page_delete', args, 'pageId');

      return executeTool('page_delete', { projectRoot, lang, pageId }, async () => {
        const context = await loadProjectContext('page_delete', projectRoot, lang);
        return deleteAuthoredPage({
          projectRoot,
          lang: context.lang!,
          pageId,
        });
      });
    },
  },
  {
    name: 'page_batch_set_status',
    description: 'Set canonical page statuses for multiple pages in one validated batch.',
    inputSchema: {
      type: 'object',
      properties: {
        projectRoot: { type: 'string' },
        lang: { type: 'string' },
        updates: {
          type: 'array',
          description: 'Array of { pageId, status } entries.',
          items: { type: 'object' },
        },
      },
      required: ['projectRoot', 'lang', 'updates'],
      additionalProperties: false,
    },
    handler: async (argumentsValue) => {
      const args = requireObjectArguments('page_batch_set_status', argumentsValue);
      const projectRoot = requireStringArgument('page_batch_set_status', args, 'projectRoot');
      const lang = requireStringArgument('page_batch_set_status', args, 'lang');
      const updates = requireObjectArrayArgument('page_batch_set_status', args, 'updates').map((entry) => ({
        pageId: requireStringArgument('page_batch_set_status', entry, 'pageId'),
        status: requireKnownPageStatus('page_batch_set_status', entry.status),
      }));

      return executeTool('page_batch_set_status', { projectRoot, lang }, async () => {
        const context = await loadProjectContext('page_batch_set_status', projectRoot, lang);
        return setPageStatusesBatch({
          projectRoot,
          lang: context.lang!,
          updates,
        });
      });
    },
  },
  {
    name: 'page_set_status',
    description: 'Set the canonical page status while preserving shared publication validation rules.',
    inputSchema: {
      type: 'object',
      properties: {
        projectRoot: { type: 'string' },
        lang: { type: 'string' },
        pageId: { type: 'string' },
        status: { type: 'string', enum: ['draft', 'in_review', 'published'] },
      },
      required: ['projectRoot', 'lang', 'pageId', 'status'],
      additionalProperties: false,
    },
    handler: async (argumentsValue) => {
      const args = requireObjectArguments('page_set_status', argumentsValue);
      const projectRoot = requireStringArgument('page_set_status', args, 'projectRoot');
      const lang = requireStringArgument('page_set_status', args, 'lang');
      const pageId = requireStringArgument('page_set_status', args, 'pageId');
      const status = requireKnownPageStatus('page_set_status', args.status);

      return executeTool('page_set_status', { projectRoot, lang, pageId, status }, async () => {
        const context = await loadProjectContext('page_set_status', projectRoot, lang);
        return setPageStatus({
          projectRoot,
          lang: context.lang!,
          pageId,
          status,
        });
      });
    },
  },
];
