export const ATLAS_DOCS_THEME_ID = 'atlas-docs';
export const ATLAS_DOCS_THEME_CLASS_NAME = 'theme-atlas-docs';

export const atlasDocsThemeManifest = {
  id: ATLAS_DOCS_THEME_ID,
  label: 'Atlas Docs',
  className: ATLAS_DOCS_THEME_CLASS_NAME,
  description: 'Two-level documentation shell with a site-level top nav and scoped sidebar navigation.',
  tone: 'structured / product docs',
  recommendedFor: 'Documentation sets split into clear knowledge domains such as guides, APIs, SDKs, and references.',
  capabilities: {
    topNav: true,
    topNavGroupSwitching: true,
  },
} as const;
