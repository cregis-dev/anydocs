import {
  deleteNavigationItem,
  insertNavigationItem,
  moveNavigationItem,
  ValidationError,
  loadNavigation,
  replaceNavigationItems,
  setNavigation,
  type NavItem,
  type NavigationDoc,
} from '@anydocs/core';

import {
  type ToolDefinition,
  DRY_RUN_SCHEMA_FIELD,
  LANG_SCHEMA_FIELD,
  PROJECT_ROOT_SCHEMA_FIELD,
  TOOL_ANNOTATIONS,
  buildDryRunPreview,
  createRepository,
  executeTool,
  loadProjectContext,
  navigationFilePath,
  optionalBooleanArgument,
  requireObjectArguments,
  requireProjectRoot,
  requireStringArgument,
} from './shared.ts';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireNavigationDocument(
  tool: string,
  args: Record<string, unknown>,
): NavigationDoc {
  const value = args.navigation;
  if (!isRecord(value)) {
    throw new ValidationError(`Tool "${tool}" requires a navigation document object.`, {
      entity: 'mcp-tool',
      rule: 'mcp-tool-navigation-document-required',
      remediation: 'Provide "navigation" as an object with "version" and "items".',
      metadata: { tool, received: value },
    });
  }

  return value as NavigationDoc;
}

function requireNavigationItems(
  tool: string,
  args: Record<string, unknown>,
): NavigationDoc['items'] {
  const value = args.items;
  if (!Array.isArray(value)) {
    throw new ValidationError(`Tool "${tool}" requires an items array.`, {
      entity: 'mcp-tool',
      rule: 'mcp-tool-navigation-items-required',
      remediation: 'Provide "items" as a navigation item array.',
      metadata: { tool, received: value },
    });
  }

  return value as NavigationDoc['items'];
}

function requireNavigationItem(
  tool: string,
  args: Record<string, unknown>,
): NavItem {
  const value = args.item;
  if (!isRecord(value)) {
    throw new ValidationError(`Tool "${tool}" requires a navigation item object.`, {
      entity: 'mcp-tool',
      rule: 'mcp-tool-navigation-item-required',
      remediation: 'Provide "item" as a navigation item object.',
      metadata: { tool, received: value },
    });
  }

  return value as NavItem;
}

export const navigationTools: ToolDefinition[] = [
  {
    name: 'nav_get',
    description: 'Load the canonical Anydocs navigation document for an enabled language.',
    annotations: TOOL_ANNOTATIONS.READ_ONLY,
    inputSchema: {
      type: 'object',
      properties: {
        projectRoot: PROJECT_ROOT_SCHEMA_FIELD,
        lang: LANG_SCHEMA_FIELD,
      },
      required: ['projectRoot', 'lang'],
      additionalProperties: false,
    },
    handler: async (argumentsValue) => {
      const args = requireObjectArguments('nav_get', argumentsValue);
      const projectRoot = requireProjectRoot('nav_get', args);
      const lang = requireStringArgument('nav_get', args, 'lang');

      return executeTool('nav_get', { projectRoot, lang }, async () => {
        const context = await loadProjectContext('nav_get', projectRoot, lang);
        const repository = createRepository(context.contract.paths.projectRoot);
        const navigation = await loadNavigation(repository, context.lang!);

        return {
          file: navigationFilePath(context.contract.paths.projectRoot, context.lang!),
          navigation,
        };
      });
    },
  },
  {
    name: 'nav_set',
    description:
      'Replace the full canonical Anydocs navigation document for an enabled language.',
    annotations: TOOL_ANNOTATIONS.IDEMPOTENT_WRITE,
    inputSchema: {
      type: 'object',
      properties: {
        projectRoot: PROJECT_ROOT_SCHEMA_FIELD,
        lang: LANG_SCHEMA_FIELD,
        navigation: {
          type: 'object',
          description: 'Canonical navigation document: { "version": 1, "items": [...] }. Supported item types: section, folder, page, link. All referenced pageIds must already exist — create pages before calling nav_set.',
        },
        dryRun: DRY_RUN_SCHEMA_FIELD,
      },
      required: ['projectRoot', 'lang', 'navigation'],
      additionalProperties: false,
    },
    handler: async (argumentsValue) => {
      const args = requireObjectArguments('nav_set', argumentsValue);
      const projectRoot = requireProjectRoot('nav_set', args);
      const lang = requireStringArgument('nav_set', args, 'lang');
      const dryRun = optionalBooleanArgument('nav_set', args, 'dryRun') ?? false;

      return executeTool('nav_set', { projectRoot, lang, ...(dryRun ? { dryRun } : {}) }, async () => {
        const context = await loadProjectContext('nav_set', projectRoot, lang);
        const navigation = requireNavigationDocument('nav_set', args);
        if (dryRun) {
          const repository = createRepository(context.contract.paths.projectRoot);
          const current = await loadNavigation(repository, context.lang!);
          return buildDryRunPreview('nav_set', 'replace-navigation', { projectRoot, lang, navigation }, {
            file: navigationFilePath(context.contract.paths.projectRoot, context.lang!),
            navigation: current,
          });
        }
        return setNavigation({
          projectRoot,
          lang: context.lang!,
          navigation,
        });
      });
    },
  },
  {
    name: 'nav_replace_items',
    description:
      'Replace only navigation.items while preserving the current navigation document version.',
    annotations: TOOL_ANNOTATIONS.IDEMPOTENT_WRITE,
    inputSchema: {
      type: 'object',
      properties: {
        projectRoot: PROJECT_ROOT_SCHEMA_FIELD,
        lang: LANG_SCHEMA_FIELD,
        items: {
          type: 'array',
          items: { type: 'object' },
          description: 'Replacement top-level navigation item array. All referenced pageIds must already exist.',
        },
        dryRun: DRY_RUN_SCHEMA_FIELD,
      },
      required: ['projectRoot', 'lang', 'items'],
      additionalProperties: false,
    },
    handler: async (argumentsValue) => {
      const args = requireObjectArguments('nav_replace_items', argumentsValue);
      const projectRoot = requireProjectRoot('nav_replace_items', args);
      const lang = requireStringArgument('nav_replace_items', args, 'lang');
      const dryRun = optionalBooleanArgument('nav_replace_items', args, 'dryRun') ?? false;

      return executeTool('nav_replace_items', { projectRoot, lang, ...(dryRun ? { dryRun } : {}) }, async () => {
        const context = await loadProjectContext('nav_replace_items', projectRoot, lang);
        const items = requireNavigationItems('nav_replace_items', args);
        if (dryRun) {
          const repository = createRepository(context.contract.paths.projectRoot);
          const current = await loadNavigation(repository, context.lang!);
          return buildDryRunPreview('nav_replace_items', 'replace-navigation-items', { projectRoot, lang, items }, {
            file: navigationFilePath(context.contract.paths.projectRoot, context.lang!),
            navigation: current,
          });
        }
        return replaceNavigationItems({
          projectRoot,
          lang: context.lang!,
          items,
        });
      });
    },
  },
  {
    name: 'nav_insert',
    description:
      'Insert a navigation item at the root or into a section/folder using a slash-separated parentPath like "0/1".',
    annotations: TOOL_ANNOTATIONS.NON_IDEMPOTENT_WRITE,
    inputSchema: {
      type: 'object',
      properties: {
        projectRoot: PROJECT_ROOT_SCHEMA_FIELD,
        lang: LANG_SCHEMA_FIELD,
        parentPath: {
          type: 'string',
          description: 'Optional slash-separated path to a section or folder. Omit for the root.',
        },
        index: {
          type: 'number',
          description: 'Optional zero-based insertion index. Omit to append.',
        },
        item: {
          type: 'object',
          description: 'Navigation item to insert. Supported types: section, folder, page ({ type: "page", pageId }), link ({ type: "link", title, href }). The referenced pageId must already exist.',
        },
        dryRun: DRY_RUN_SCHEMA_FIELD,
      },
      required: ['projectRoot', 'lang', 'item'],
      additionalProperties: false,
    },
    handler: async (argumentsValue) => {
      const args = requireObjectArguments('nav_insert', argumentsValue);
      const projectRoot = requireProjectRoot('nav_insert', args);
      const lang = requireStringArgument('nav_insert', args, 'lang');
      const dryRun = optionalBooleanArgument('nav_insert', args, 'dryRun') ?? false;

      return executeTool('nav_insert', { projectRoot, lang, ...(dryRun ? { dryRun } : {}) }, async () => {
        const context = await loadProjectContext('nav_insert', projectRoot, lang);
        const item = requireNavigationItem('nav_insert', args);
        const parentPath = typeof args.parentPath === 'string' ? args.parentPath : undefined;
        const index = typeof args.index === 'number' ? args.index : undefined;
        if (dryRun) {
          const repository = createRepository(context.contract.paths.projectRoot);
          const current = await loadNavigation(repository, context.lang!);
          return buildDryRunPreview(
            'nav_insert',
            'insert-navigation-item',
            {
              projectRoot,
              lang,
              item,
              ...(parentPath !== undefined ? { parentPath } : {}),
              ...(index !== undefined ? { index } : {}),
            },
            {
              file: navigationFilePath(context.contract.paths.projectRoot, context.lang!),
              navigation: current,
            },
          );
        }
        return insertNavigationItem({
          projectRoot,
          lang: context.lang!,
          item,
          ...(parentPath !== undefined ? { parentPath } : {}),
          ...(index !== undefined ? { index } : {}),
        });
      });
    },
  },
  {
    name: 'nav_delete',
    description:
      'Delete a navigation item using a slash-separated itemPath like "0/1/2".',
    annotations: TOOL_ANNOTATIONS.DESTRUCTIVE,
    inputSchema: {
      type: 'object',
      properties: {
        projectRoot: PROJECT_ROOT_SCHEMA_FIELD,
        lang: LANG_SCHEMA_FIELD,
        itemPath: {
          type: 'string',
          description: 'Slash-separated zero-based item path.',
        },
        dryRun: DRY_RUN_SCHEMA_FIELD,
      },
      required: ['projectRoot', 'lang', 'itemPath'],
      additionalProperties: false,
    },
    handler: async (argumentsValue) => {
      const args = requireObjectArguments('nav_delete', argumentsValue);
      const projectRoot = requireProjectRoot('nav_delete', args);
      const lang = requireStringArgument('nav_delete', args, 'lang');
      const itemPath = requireStringArgument('nav_delete', args, 'itemPath');
      const dryRun = optionalBooleanArgument('nav_delete', args, 'dryRun') ?? false;

      return executeTool('nav_delete', { projectRoot, lang, itemPath, ...(dryRun ? { dryRun } : {}) }, async () => {
        const context = await loadProjectContext('nav_delete', projectRoot, lang);
        if (dryRun) {
          const repository = createRepository(context.contract.paths.projectRoot);
          const current = await loadNavigation(repository, context.lang!);
          return buildDryRunPreview('nav_delete', 'delete-navigation-item', { projectRoot, lang, itemPath }, {
            file: navigationFilePath(context.contract.paths.projectRoot, context.lang!),
            navigation: current,
          });
        }
        return deleteNavigationItem({
          projectRoot,
          lang: context.lang!,
          itemPath,
        });
      });
    },
  },
  {
    name: 'nav_move',
    description:
      'Move a navigation item to the root or into another section/folder using slash-separated itemPath and parentPath values.',
    annotations: TOOL_ANNOTATIONS.NON_IDEMPOTENT_WRITE,
    inputSchema: {
      type: 'object',
      properties: {
        projectRoot: PROJECT_ROOT_SCHEMA_FIELD,
        lang: LANG_SCHEMA_FIELD,
        itemPath: {
          type: 'string',
          description: 'Slash-separated zero-based item path for the item to move.',
        },
        parentPath: {
          type: 'string',
          description: 'Optional slash-separated path to a section or folder. Omit for the root.',
        },
        index: {
          type: 'number',
          description: 'Optional zero-based insertion index in the destination container.',
        },
        dryRun: DRY_RUN_SCHEMA_FIELD,
      },
      required: ['projectRoot', 'lang', 'itemPath'],
      additionalProperties: false,
    },
    handler: async (argumentsValue) => {
      const args = requireObjectArguments('nav_move', argumentsValue);
      const projectRoot = requireProjectRoot('nav_move', args);
      const lang = requireStringArgument('nav_move', args, 'lang');
      const itemPath = requireStringArgument('nav_move', args, 'itemPath');
      const dryRun = optionalBooleanArgument('nav_move', args, 'dryRun') ?? false;
      const parentPath = typeof args.parentPath === 'string' ? args.parentPath : undefined;
      const index = typeof args.index === 'number' ? args.index : undefined;

      return executeTool('nav_move', { projectRoot, lang, itemPath, ...(dryRun ? { dryRun } : {}) }, async () => {
        const context = await loadProjectContext('nav_move', projectRoot, lang);
        if (dryRun) {
          const repository = createRepository(context.contract.paths.projectRoot);
          const current = await loadNavigation(repository, context.lang!);
          return buildDryRunPreview(
            'nav_move',
            'move-navigation-item',
            {
              projectRoot,
              lang,
              itemPath,
              ...(parentPath !== undefined ? { parentPath } : {}),
              ...(index !== undefined ? { index } : {}),
            },
            {
              file: navigationFilePath(context.contract.paths.projectRoot, context.lang!),
              navigation: current,
            },
          );
        }
        return moveNavigationItem({
          projectRoot,
          lang: context.lang!,
          itemPath,
          ...(parentPath !== undefined ? { parentPath } : {}),
          ...(index !== undefined ? { index } : {}),
        });
      });
    },
  },
];
