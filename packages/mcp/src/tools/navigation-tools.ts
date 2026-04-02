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
  createRepository,
  executeTool,
  loadProjectContext,
  navigationFilePath,
  requireObjectArguments,
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
    inputSchema: {
      type: 'object',
      properties: {
        projectRoot: { type: 'string' },
        lang: { type: 'string' },
      },
      required: ['projectRoot', 'lang'],
      additionalProperties: false,
    },
    handler: async (argumentsValue) => {
      const args = requireObjectArguments('nav_get', argumentsValue);
      const projectRoot = requireStringArgument('nav_get', args, 'projectRoot');
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
    inputSchema: {
      type: 'object',
      properties: {
        projectRoot: { type: 'string' },
        lang: { type: 'string' },
        navigation: {
          type: 'object',
          description: 'A canonical navigation document with version and items.',
        },
      },
      required: ['projectRoot', 'lang', 'navigation'],
      additionalProperties: false,
    },
    handler: async (argumentsValue) => {
      const args = requireObjectArguments('nav_set', argumentsValue);
      const projectRoot = requireStringArgument('nav_set', args, 'projectRoot');
      const lang = requireStringArgument('nav_set', args, 'lang');

      return executeTool('nav_set', { projectRoot, lang }, async () => {
        const context = await loadProjectContext('nav_set', projectRoot, lang);
        return setNavigation({
          projectRoot,
          lang: context.lang!,
          navigation: requireNavigationDocument('nav_set', args),
        });
      });
    },
  },
  {
    name: 'nav_replace_items',
    description:
      'Replace only navigation.items while preserving the current navigation document version.',
    inputSchema: {
      type: 'object',
      properties: {
        projectRoot: { type: 'string' },
        lang: { type: 'string' },
        items: {
          type: 'array',
          items: { type: 'object' },
          description: 'The replacement top-level navigation item array.',
        },
      },
      required: ['projectRoot', 'lang', 'items'],
      additionalProperties: false,
    },
    handler: async (argumentsValue) => {
      const args = requireObjectArguments('nav_replace_items', argumentsValue);
      const projectRoot = requireStringArgument('nav_replace_items', args, 'projectRoot');
      const lang = requireStringArgument('nav_replace_items', args, 'lang');

      return executeTool('nav_replace_items', { projectRoot, lang }, async () => {
        const context = await loadProjectContext('nav_replace_items', projectRoot, lang);
        return replaceNavigationItems({
          projectRoot,
          lang: context.lang!,
          items: requireNavigationItems('nav_replace_items', args),
        });
      });
    },
  },
  {
    name: 'nav_insert',
    description:
      'Insert a navigation item at the root or into a section/folder using a slash-separated parentPath like "0/1".',
    inputSchema: {
      type: 'object',
      properties: {
        projectRoot: { type: 'string' },
        lang: { type: 'string' },
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
          description: 'The navigation item to insert.',
        },
      },
      required: ['projectRoot', 'lang', 'item'],
      additionalProperties: false,
    },
    handler: async (argumentsValue) => {
      const args = requireObjectArguments('nav_insert', argumentsValue);
      const projectRoot = requireStringArgument('nav_insert', args, 'projectRoot');
      const lang = requireStringArgument('nav_insert', args, 'lang');

      return executeTool('nav_insert', { projectRoot, lang }, async () => {
        const context = await loadProjectContext('nav_insert', projectRoot, lang);
        return insertNavigationItem({
          projectRoot,
          lang: context.lang!,
          item: requireNavigationItem('nav_insert', args),
          ...(typeof args.parentPath === 'string' ? { parentPath: args.parentPath } : {}),
          ...(typeof args.index === 'number' ? { index: args.index } : {}),
        });
      });
    },
  },
  {
    name: 'nav_delete',
    description:
      'Delete a navigation item using a slash-separated itemPath like "0/1/2".',
    inputSchema: {
      type: 'object',
      properties: {
        projectRoot: { type: 'string' },
        lang: { type: 'string' },
        itemPath: {
          type: 'string',
          description: 'Slash-separated zero-based item path.',
        },
      },
      required: ['projectRoot', 'lang', 'itemPath'],
      additionalProperties: false,
    },
    handler: async (argumentsValue) => {
      const args = requireObjectArguments('nav_delete', argumentsValue);
      const projectRoot = requireStringArgument('nav_delete', args, 'projectRoot');
      const lang = requireStringArgument('nav_delete', args, 'lang');
      const itemPath = requireStringArgument('nav_delete', args, 'itemPath');

      return executeTool('nav_delete', { projectRoot, lang, itemPath }, async () => {
        const context = await loadProjectContext('nav_delete', projectRoot, lang);
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
    inputSchema: {
      type: 'object',
      properties: {
        projectRoot: { type: 'string' },
        lang: { type: 'string' },
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
      },
      required: ['projectRoot', 'lang', 'itemPath'],
      additionalProperties: false,
    },
    handler: async (argumentsValue) => {
      const args = requireObjectArguments('nav_move', argumentsValue);
      const projectRoot = requireStringArgument('nav_move', args, 'projectRoot');
      const lang = requireStringArgument('nav_move', args, 'lang');
      const itemPath = requireStringArgument('nav_move', args, 'itemPath');

      return executeTool('nav_move', { projectRoot, lang, itemPath }, async () => {
        const context = await loadProjectContext('nav_move', projectRoot, lang);
        return moveNavigationItem({
          projectRoot,
          lang: context.lang!,
          itemPath,
          ...(typeof args.parentPath === 'string' ? { parentPath: args.parentPath } : {}),
          ...(typeof args.index === 'number' ? { index: args.index } : {}),
        });
      });
    },
  },
];
