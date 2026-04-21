import { DOCS_CANONICAL_BLOCK_TYPES } from '@/lib/themes/content-schema';

export const CLASSIC_DOCS_THEME_ID = 'classic-docs';
export const CLASSIC_DOCS_THEME_CLASS_NAME = 'theme-classic-docs';

export const classicDocsThemeManifest = {
  id: CLASSIC_DOCS_THEME_ID,
  label: 'Classic Docs',
  className: CLASSIC_DOCS_THEME_CLASS_NAME,
  description: 'Compact reader shell with familiar sidebar navigation and a centered article lane.',
  tone: 'neutral / product docs',
  recommendedFor: 'General product documentation, onboarding guides, and mixed reference content that should stay calm and centered.',
  capabilities: {
    supportedBlockTypes: [...DOCS_CANONICAL_BLOCK_TYPES],
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
};
