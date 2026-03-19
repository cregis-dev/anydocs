import {
  ValidationError,
  createPage,
  findPageBySlug,
  listPages,
  loadPage,
  setPageStatus,
  updatePage,
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
  'tags',
  'content',
  'render',
  'review',
]);

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
      remediation: 'Use only slug, title, description, tags, content, render, and review in page_update.patch.',
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
    ...(Array.isArray(patch.tags) ? { tags: patch.tags as string[] } : {}),
    ...('content' in patch ? { content: patch.content } : {}),
    ...(isRecord(patch.render) ? { render: patch.render as PageRender } : {}),
    ...(isRecord(patch.review) ? { review: patch.review as PageReview } : {}),
  };
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
            'Allowed fields: slug, title, description, tags, content, render, review. Unsupported fields are rejected.',
          additionalProperties: true,
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
        const context = await loadProjectContext('page_update', projectRoot, lang);
        return updatePage({
          projectRoot,
          lang: context.lang!,
          pageId,
          patch,
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
