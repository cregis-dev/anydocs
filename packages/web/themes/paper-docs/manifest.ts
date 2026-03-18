export const PAPER_DOCS_THEME_ID = 'paper-docs';
export const PAPER_DOCS_THEME_CLASS_NAME = 'theme-paper-docs';

export const paperDocsThemeManifest = {
  id: PAPER_DOCS_THEME_ID,
  label: 'Paper Docs',
  className: PAPER_DOCS_THEME_CLASS_NAME,
  description: 'Editorial reading theme with softer framing, wider rhythm, and article-first presentation.',
  tone: 'editorial / narrative',
  recommendedFor: 'Long-form guides, handbooks, changelogs, and documentation with stronger reading emphasis.',
  capabilities: {
    topNav: false,
    topNavGroupSwitching: false,
  },
} as const;
