import { DOCS_CANONICAL_BLOCK_TYPES } from '@/lib/themes/content-schema';

export const BLUEPRINT_REVIEW_THEME_ID = 'blueprint-review';
export const BLUEPRINT_REVIEW_THEME_CLASS_NAME = 'theme-blueprint-review';

export const blueprintReviewThemeManifest = {
  id: BLUEPRINT_REVIEW_THEME_ID,
  label: 'Blueprint Review',
  className: BLUEPRINT_REVIEW_THEME_CLASS_NAME,
  description: 'Internal-first docs shell optimized for PRDs and technical review reading.',
  tone: 'internal / review / content-first',
  recommendedFor: 'Internal PRDs, technical specs, review notes, and knowledge base docs with deep folder trees.',
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
