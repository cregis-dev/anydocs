import { DOCS_LANGUAGES, type DocsLang } from './docs.ts';

export const SUPPORTED_DOCS_LANGUAGES = DOCS_LANGUAGES;
export const DEFAULT_DOCS_THEME_ID = 'classic-docs';
export const SUPPORTED_DOCS_CODE_THEMES = ['github-light', 'github-dark'] as const;
export const DEFAULT_DOCS_CODE_THEME = 'github-dark';

export type DocsLanguage = DocsLang;
export type DocsCodeTheme = (typeof SUPPORTED_DOCS_CODE_THEMES)[number];
export type ProjectLocalizedLabel = string | Partial<Record<DocsLanguage, string>>;
export type ProjectPageTemplateBaseTemplate = 'concept' | 'how_to' | 'reference';
export type ProjectPageMetadataFieldType = 'string' | 'text' | 'enum' | 'boolean' | 'date' | 'string[]';
export type ProjectPageMetadataVisibility = 'public' | 'internal';

export type ProjectPageTemplateMetadataField = {
  id: string;
  label: ProjectLocalizedLabel;
  type: ProjectPageMetadataFieldType;
  required?: boolean;
  visibility?: ProjectPageMetadataVisibility;
  options?: string[];
};

export type ProjectPageTemplateMetadataSchema = {
  fields: ProjectPageTemplateMetadataField[];
};

export type ProjectPageTemplateSection = {
  title: string;
  body?: string;
};

export type ProjectPageTemplateDefinition = {
  id: string;
  label: ProjectLocalizedLabel;
  description?: string;
  baseTemplate: ProjectPageTemplateBaseTemplate;
  defaultSummary?: string;
  defaultSections?: ProjectPageTemplateSection[];
  metadataSchema?: ProjectPageTemplateMetadataSchema;
};

export type ProjectAuthoringConfig = {
  pageTemplates?: ProjectPageTemplateDefinition[];
};

export type ProjectSiteThemeBranding = {
  siteTitle?: string;
  homeLabel?: string;
  logoSrc?: string;
  logoAlt?: string;
};

export type ProjectSiteThemeChrome = {
  showSearch?: boolean;
};

export type ProjectSiteThemeColors = {
  primary?: string;
  primaryForeground?: string;
  accent?: string;
  accentForeground?: string;
  sidebarActive?: string;
  sidebarActiveForeground?: string;
};

export type ProjectSiteTheme = {
  id: string;
  branding?: ProjectSiteThemeBranding;
  chrome?: ProjectSiteThemeChrome;
  colors?: ProjectSiteThemeColors;
  codeTheme?: DocsCodeTheme;
};

export type ProjectSiteTopNavLabel = ProjectLocalizedLabel;

export type ProjectSiteTopNavItem =
  | {
      id: string;
      type: 'nav-group';
      groupId: string;
      label: ProjectSiteTopNavLabel;
    }
  | {
      id: string;
      type: 'external';
      href: string;
      openInNewTab?: boolean;
      label: ProjectSiteTopNavLabel;
    };

export type ProjectSiteNavigation = {
  topNav?: ProjectSiteTopNavItem[];
};

export type ProjectSiteConfig = {
  url?: string;
  theme: ProjectSiteTheme;
  navigation?: ProjectSiteNavigation;
};

export type ProjectConfig = {
  version: 1;
  projectId: string;
  name: string;
  defaultLanguage: DocsLanguage;
  languages: DocsLanguage[];
  site: ProjectSiteConfig;
  authoring?: ProjectAuthoringConfig;
  build?: {
    outputDir?: string;
  };
};

export type ProjectPathContract = {
  repoRoot: string;
  projectRoot: string;
  configFile: string;
  workflowFile: string;
  importsRoot: string;
  apiSourcesRoot: string;
  pagesRoot: string;
  navigationRoot: string;
  artifactRoot: string;
  llmsFile: string;
  machineReadableRoot: string;
  languageRoots: Record<
    DocsLanguage,
    {
      pagesDir: string;
      navigationFile: string;
      searchIndexFile: string;
    }
  >;
};

export type ProjectContract = {
  config: ProjectConfig;
  paths: ProjectPathContract;
};
