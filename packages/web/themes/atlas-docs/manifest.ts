import { DOCS_CANONICAL_BLOCK_TYPES } from '@/lib/themes/content-schema';

export const ATLAS_DOCS_THEME_ID = 'atlas-docs';
export const ATLAS_DOCS_THEME_CLASS_NAME = 'theme-atlas-docs';

export const atlasDocsThemeManifest = {
  id: ATLAS_DOCS_THEME_ID,
  label: 'Atlas Docs',
  className: ATLAS_DOCS_THEME_CLASS_NAME,
  description: 'Two-level reader shell with site-level top navigation, scoped sidebar groups, and a light right rail.',
  tone: 'structured / product docs',
  recommendedFor: 'Documentation sets split into clear knowledge domains such as guides, APIs, SDKs, and references.',
  capabilities: {
    supportedBlockTypes: [...DOCS_CANONICAL_BLOCK_TYPES],
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
