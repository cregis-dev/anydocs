import { DOCS_YOOPTA_ALLOWED_TYPES } from '@/lib/themes/yoopta-content';

export const CLASSIC_DOCS_THEME_ID = 'classic-docs';
export const CLASSIC_DOCS_THEME_CLASS_NAME = 'theme-classic-docs';

export const classicDocsThemeManifest = {
  id: CLASSIC_DOCS_THEME_ID,
  label: 'Classic Docs',
  className: CLASSIC_DOCS_THEME_CLASS_NAME,
  description: 'Balanced documentation shell with familiar sidebar navigation and compact header chrome.',
  tone: 'neutral / product docs',
  recommendedFor: 'General product documentation, onboarding guides, and mixed reference content.',
  capabilities: {
    supportedBlockTypes: [...DOCS_YOOPTA_ALLOWED_TYPES],
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
