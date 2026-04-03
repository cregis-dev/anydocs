import { DOCS_YOOPTA_ALLOWED_TYPES } from '../utils/index.ts';
import {
  DEFAULT_DOCS_THEME_ID,
  type ProjectThemeCapabilities,
} from '../types/project.ts';
import { ValidationError } from '../errors/validation-error.ts';

const SHARED_THEME_BLOCK_TYPES = [...DOCS_YOOPTA_ALLOWED_TYPES];

const THEME_CAPABILITY_REGISTRY: Record<string, ProjectThemeCapabilities> = {
  'classic-docs': {
    supportedBlockTypes: [...SHARED_THEME_BLOCK_TYPES],
    unsupportedBlockTypes: [],
    navigation: {
      topNav: false,
      topNavGroupSwitching: false,
    },
    features: {
      search: true,
      i18nSwitcher: true,
      darkMode: false,
    },
  },
  'atlas-docs': {
    supportedBlockTypes: [...SHARED_THEME_BLOCK_TYPES],
    unsupportedBlockTypes: [],
    navigation: {
      topNav: true,
      topNavGroupSwitching: true,
    },
    features: {
      search: true,
      i18nSwitcher: true,
      darkMode: false,
    },
  },
};

export function getProjectThemeCapabilities(themeId: string): ProjectThemeCapabilities {
  const capabilities = THEME_CAPABILITY_REGISTRY[themeId];
  if (!capabilities) {
    throw new ValidationError(`Theme "${themeId}" is not registered for MCP capability resolution.`, {
      entity: 'project-config',
      rule: 'project-theme-id-must-be-supported',
      remediation: `Use one of the supported theme ids, for example "${DEFAULT_DOCS_THEME_ID}".`,
      metadata: {
        themeId,
        supportedThemeIds: Object.keys(THEME_CAPABILITY_REGISTRY),
      },
    });
  }

  return {
    supportedBlockTypes: [...capabilities.supportedBlockTypes],
    unsupportedBlockTypes: [...capabilities.unsupportedBlockTypes],
    navigation: { ...capabilities.navigation },
    features: { ...capabilities.features },
  };
}
