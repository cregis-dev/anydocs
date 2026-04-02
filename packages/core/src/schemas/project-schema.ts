import { ValidationError } from '../errors/validation-error.ts';
import {
  SUPPORTED_DOCS_CODE_THEMES,
  type DocsCodeTheme,
  type ProjectAuthoringConfig,
  type ProjectLocalizedLabel,
  type ProjectPageTemplateDefinition,
  type ProjectPageTemplateMetadataField,
  type ProjectPageMetadataFieldType,
  type ProjectPageMetadataVisibility,
  SUPPORTED_DOCS_LANGUAGES,
  type DocsLanguage,
  type ProjectSiteTopNavItem,
  type ProjectSiteTopNavLabel,
  type ProjectConfig,
} from '../types/project.ts';

const PROJECT_PAGE_TEMPLATE_BASE_TEMPLATES = ['concept', 'how_to', 'reference'] as const;
const PROJECT_PAGE_METADATA_FIELD_TYPES = ['string', 'text', 'enum', 'boolean', 'date', 'string[]'] as const;
const PROJECT_PAGE_METADATA_VISIBILITIES = ['public', 'internal'] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSupportedLanguage(value: unknown): value is DocsLanguage {
  return typeof value === 'string' && SUPPORTED_DOCS_LANGUAGES.includes(value as DocsLanguage);
}

function makeValidationError(
  rule: string,
  remediation: string,
  metadata?: Record<string, unknown>,
): ValidationError {
  return new ValidationError(`Project configuration failed validation for rule "${rule}".`, {
    entity: 'project-config',
    rule,
    remediation,
    metadata,
  });
}

function isHexColor(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}

function isSlugLikeId(value: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

function normalizeOptionalTrimmedString(value: unknown, rule: string, remediation: string): string | undefined {
  if (value == null) {
    return undefined;
  }

  if (typeof value !== 'string') {
    throw makeValidationError(rule, remediation, { received: value });
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeSiteUrl(value: string): string {
  const normalized = new URL(value.trim());
  if (normalized.protocol !== 'http:' && normalized.protocol !== 'https:') {
    throw new Error('unsupported protocol');
  }

  if (normalized.pathname !== '/') {
    normalized.pathname = normalized.pathname.replace(/\/+$/, '');
  }

  return normalized.toString().replace(/\/$/, normalized.pathname === '/' ? '/' : '');
}

function validateLocalizedLabel(
  input: unknown,
  metadata: Record<string, unknown>,
  stringRule: string,
  stringRemediation: string,
  objectRule: string,
  objectRemediation: string,
  languageStringRule: string,
  languageStringRemediation: (language: DocsLanguage) => string,
  languageRequiredRule: string,
  languageRequiredRemediation: string,
): ProjectLocalizedLabel {
  if (typeof input === 'string') {
    if (input.trim().length === 0) {
      throw makeValidationError(
        stringRule,
        stringRemediation,
        { ...metadata, received: input },
      );
    }

    return input.trim();
  }

  if (!isRecord(input)) {
    throw makeValidationError(
      objectRule,
      objectRemediation,
      { ...metadata, received: input },
    );
  }

  const next: Partial<Record<DocsLanguage, string>> = {};
  for (const language of SUPPORTED_DOCS_LANGUAGES) {
    const value = input[language];
    if (value == null) {
      continue;
    }

    if (typeof value !== 'string' || value.trim().length === 0) {
      throw makeValidationError(
        languageStringRule,
        languageStringRemediation(language),
        { ...metadata, language, received: value },
      );
    }

    next[language] = value.trim();
  }

  if (Object.keys(next).length === 0) {
    throw makeValidationError(
      languageRequiredRule,
      languageRequiredRemediation,
      { ...metadata, received: input },
    );
  }

  return next;
}

function validateTopNavLabel(input: unknown, itemId: string): ProjectSiteTopNavLabel {
  return validateLocalizedLabel(
    input,
    { itemId },
    'site-navigation-top-nav-label-string',
    'Use a non-empty string for a top navigation label.',
    'site-navigation-top-nav-label-object',
    'Use a string or language-keyed object for top navigation labels.',
    'site-navigation-top-nav-label-language-string',
    (language) => `Use a non-empty string for "site.navigation.topNav[].label.${language}" when provided.`,
    'site-navigation-top-nav-label-language-required',
    'Provide at least one localized top navigation label value.',
  );
}

function validatePageTemplateLabel(input: unknown, templateId: string): ProjectLocalizedLabel {
  return validateLocalizedLabel(
    input,
    { templateId },
    'authoring-page-template-label-string',
    'Use a non-empty string or language-keyed object for "authoring.pageTemplates[].label".',
    'authoring-page-template-label-object',
    'Use a string or language-keyed object for "authoring.pageTemplates[].label".',
    'authoring-page-template-label-language-string',
    (language) => `Use a non-empty string for "authoring.pageTemplates[].label.${language}" when provided.`,
    'authoring-page-template-label-language-required',
    'Provide at least one localized template label value.',
  );
}

function validatePageMetadataFieldLabel(input: unknown, templateId: string, fieldId: string): ProjectLocalizedLabel {
  return validateLocalizedLabel(
    input,
    { templateId, fieldId },
    'authoring-page-template-field-label-string',
    'Use a non-empty string or language-keyed object for "authoring.pageTemplates[].metadataSchema.fields[].label".',
    'authoring-page-template-field-label-object',
    'Use a string or language-keyed object for "authoring.pageTemplates[].metadataSchema.fields[].label".',
    'authoring-page-template-field-label-language-string',
    (language) =>
      `Use a non-empty string for "authoring.pageTemplates[].metadataSchema.fields[].label.${language}" when provided.`,
    'authoring-page-template-field-label-language-required',
    'Provide at least one localized metadata field label value.',
  );
}

function validatePageTemplateSection(input: unknown, templateId: string, index: number) {
  if (!isRecord(input)) {
    throw makeValidationError(
      'authoring-page-template-section-object',
      'Use an object for each entry in "authoring.pageTemplates[].defaultSections".',
      { templateId, index, received: input },
    );
  }

  const title = normalizeOptionalTrimmedString(
    input.title,
    'authoring-page-template-section-title-string',
    'Use a non-empty string for "authoring.pageTemplates[].defaultSections[].title".',
  );
  if (!title) {
    throw makeValidationError(
      'authoring-page-template-section-title-required',
      'Provide a non-empty title for each default section.',
      { templateId, index, received: input.title },
    );
  }

  const body = normalizeOptionalTrimmedString(
    input.body,
    'authoring-page-template-section-body-string',
    'Use a string for "authoring.pageTemplates[].defaultSections[].body" when provided.',
  );

  return {
    title,
    ...(body ? { body } : {}),
  };
}

function validatePageTemplateMetadataField(
  input: unknown,
  templateId: string,
  index: number,
): ProjectPageTemplateMetadataField {
  if (!isRecord(input)) {
    throw makeValidationError(
      'authoring-page-template-field-object',
      'Use an object for each metadata field definition.',
      { templateId, index, received: input },
    );
  }

  const id = typeof input.id === 'string' ? input.id.trim() : '';
  if (!id || !isSlugLikeId(id)) {
    throw makeValidationError(
      'authoring-page-template-field-id',
      'Use a lowercase slug-like id for each metadata field definition.',
      { templateId, index, received: input.id },
    );
  }

  const label = validatePageMetadataFieldLabel(input.label, templateId, id);
  const type = input.type;
  if (typeof type !== 'string' || !PROJECT_PAGE_METADATA_FIELD_TYPES.includes(type as ProjectPageMetadataFieldType)) {
    throw makeValidationError(
      'authoring-page-template-field-type',
      `Use one of: ${PROJECT_PAGE_METADATA_FIELD_TYPES.join(', ')} for metadata field types.`,
      { templateId, fieldId: id, received: type },
    );
  }

  if (input.required != null && typeof input.required !== 'boolean') {
    throw makeValidationError(
      'authoring-page-template-field-required-boolean',
      'Use a boolean for "required" on metadata field definitions.',
      { templateId, fieldId: id, received: input.required },
    );
  }

  if (
    input.visibility != null
    && (typeof input.visibility !== 'string'
      || !PROJECT_PAGE_METADATA_VISIBILITIES.includes(input.visibility as ProjectPageMetadataVisibility))
  ) {
    throw makeValidationError(
      'authoring-page-template-field-visibility',
      `Use one of: ${PROJECT_PAGE_METADATA_VISIBILITIES.join(', ')} for metadata field visibility.`,
      { templateId, fieldId: id, received: input.visibility },
    );
  }

  const rawOptions = input.options;
  if (type === 'enum') {
    if (!Array.isArray(rawOptions) || rawOptions.length === 0 || rawOptions.some((option) => typeof option !== 'string')) {
      throw makeValidationError(
        'authoring-page-template-field-options-required',
        'Provide a non-empty string array for "options" on enum metadata fields.',
        { templateId, fieldId: id, received: rawOptions },
      );
    }
  } else if (rawOptions != null) {
    throw makeValidationError(
      'authoring-page-template-field-options-unsupported',
      'Use "options" only on enum metadata fields.',
      { templateId, fieldId: id, received: rawOptions },
    );
  }

  const options = Array.isArray(rawOptions) ? rawOptions.map((option) => option.trim()).filter(Boolean) : [];
  if (type === 'enum' && options.length === 0) {
    throw makeValidationError(
      'authoring-page-template-field-options-required',
      'Provide at least one non-empty option for enum metadata fields.',
      { templateId, fieldId: id, received: rawOptions },
    );
  }

  const optionIds = new Set<string>();
  for (const option of options) {
    if (!isSlugLikeId(option)) {
      throw makeValidationError(
        'authoring-page-template-field-option-id',
        'Use lowercase slug-like ids for enum metadata field options.',
        { templateId, fieldId: id, received: option },
      );
    }
    if (optionIds.has(option)) {
      throw makeValidationError(
        'authoring-page-template-field-option-id-unique',
        'Use unique option ids within each enum metadata field.',
        { templateId, fieldId: id, optionId: option },
      );
    }
    optionIds.add(option);
  }

  return {
    id,
    label,
    type: type as ProjectPageMetadataFieldType,
    ...(typeof input.required === 'boolean' ? { required: input.required } : {}),
    ...(typeof input.visibility === 'string'
      ? { visibility: input.visibility as ProjectPageMetadataVisibility }
      : {}),
    ...(options.length > 0 ? { options } : {}),
  };
}

function validatePageTemplate(input: unknown, index: number): ProjectPageTemplateDefinition {
  if (!isRecord(input)) {
    throw makeValidationError(
      'authoring-page-template-object',
      'Use an object for each entry in "authoring.pageTemplates".',
      { index, received: input },
    );
  }

  const id = typeof input.id === 'string' ? input.id.trim() : '';
  if (!id || !isSlugLikeId(id)) {
    throw makeValidationError(
      'authoring-page-template-id',
      'Use a lowercase slug-like id for each authoring page template.',
      { index, received: input.id },
    );
  }

  const label = validatePageTemplateLabel(input.label, id);
  const description = normalizeOptionalTrimmedString(
    input.description,
    'authoring-page-template-description-string',
    'Use a string for "authoring.pageTemplates[].description" when provided.',
  );

  const baseTemplate = input.baseTemplate;
  if (
    typeof baseTemplate !== 'string'
    || !PROJECT_PAGE_TEMPLATE_BASE_TEMPLATES.includes(baseTemplate as (typeof PROJECT_PAGE_TEMPLATE_BASE_TEMPLATES)[number])
  ) {
    throw makeValidationError(
      'authoring-page-template-base-template',
      `Use one of: ${PROJECT_PAGE_TEMPLATE_BASE_TEMPLATES.join(', ')} for "baseTemplate".`,
      { templateId: id, received: baseTemplate },
    );
  }

  const defaultSummary = normalizeOptionalTrimmedString(
    input.defaultSummary,
    'authoring-page-template-default-summary-string',
    'Use a string for "authoring.pageTemplates[].defaultSummary" when provided.',
  );

  if (input.defaultSections != null && !Array.isArray(input.defaultSections)) {
    throw makeValidationError(
      'authoring-page-template-default-sections-array',
      'Use an array for "authoring.pageTemplates[].defaultSections" when provided.',
      { templateId: id, received: input.defaultSections },
    );
  }
  const defaultSections = input.defaultSections?.map((section, sectionIndex) =>
    validatePageTemplateSection(section, id, sectionIndex),
  ) ?? [];

  if (input.metadataSchema != null && !isRecord(input.metadataSchema)) {
    throw makeValidationError(
      'authoring-page-template-metadata-schema-object',
      'Use an object for "authoring.pageTemplates[].metadataSchema" when provided.',
      { templateId: id, received: input.metadataSchema },
    );
  }
  if (input.metadataSchema?.fields != null && !Array.isArray(input.metadataSchema.fields)) {
    throw makeValidationError(
      'authoring-page-template-metadata-fields-array',
      'Use an array for "authoring.pageTemplates[].metadataSchema.fields" when provided.',
      { templateId: id, received: input.metadataSchema.fields },
    );
  }

  const fields = input.metadataSchema?.fields?.map((field, fieldIndex) =>
    validatePageTemplateMetadataField(field, id, fieldIndex),
  ) ?? [];
  const fieldIds = new Set<string>();
  for (const field of fields) {
    if (fieldIds.has(field.id)) {
      throw makeValidationError(
        'authoring-page-template-field-id-unique',
        'Use unique metadata field ids within each page template.',
        { templateId: id, fieldId: field.id },
      );
    }
    fieldIds.add(field.id);
  }

  const template: ProjectPageTemplateDefinition = {
    id,
    label,
    ...(description ? { description } : {}),
    baseTemplate: baseTemplate as ProjectPageTemplateDefinition['baseTemplate'],
    ...(defaultSummary ? { defaultSummary } : {}),
    ...(defaultSections.length > 0 ? { defaultSections } : {}),
    ...(fields.length > 0 ? { metadataSchema: { fields } } : {}),
  };

  return template;
}

function validateTopNavItem(input: unknown, index: number): ProjectSiteTopNavItem {
  if (!isRecord(input)) {
    throw makeValidationError(
      'site-navigation-top-nav-item-object',
      'Use an object for each top navigation item.',
      { index, received: input },
    );
  }

  const id = input.id;
  if (typeof id !== 'string' || id.trim().length === 0 || !isSlugLikeId(id.trim())) {
    throw makeValidationError(
      'site-navigation-top-nav-item-id',
      'Use a lowercase slug-like id for each top navigation item.',
      { index, received: id },
    );
  }

  if (input.type !== 'nav-group' && input.type !== 'external') {
    throw makeValidationError(
      'site-navigation-top-nav-item-type',
      'Use "nav-group" or "external" for each top navigation item type.',
      { index, itemId: id.trim(), received: input.type },
    );
  }

  const label = validateTopNavLabel(input.label, id.trim());

  if (input.type === 'nav-group') {
    const groupId = input.groupId;
    if (typeof groupId !== 'string' || groupId.trim().length === 0 || !isSlugLikeId(groupId.trim())) {
      throw makeValidationError(
        'site-navigation-top-nav-group-id',
        'Use a lowercase slug-like "groupId" for nav-group top navigation items.',
        { index, itemId: id.trim(), received: groupId },
      );
    }

    return {
      id: id.trim(),
      type: 'nav-group',
      groupId: groupId.trim(),
      label,
    };
  }

  const href = input.href;
  if (typeof href !== 'string' || href.trim().length === 0) {
    throw makeValidationError(
      'site-navigation-top-nav-href',
      'Provide a non-empty "href" for external top navigation items.',
      { index, itemId: id.trim(), received: href },
    );
  }

  if (input.openInNewTab != null && typeof input.openInNewTab !== 'boolean') {
    throw makeValidationError(
      'site-navigation-top-nav-open-in-new-tab',
      'Use a boolean for "openInNewTab" on external top navigation items.',
      { index, itemId: id.trim(), received: input.openInNewTab },
    );
  }

  return {
    id: id.trim(),
    type: 'external',
    href: href.trim(),
    ...(typeof input.openInNewTab === 'boolean' ? { openInNewTab: input.openInNewTab } : {}),
    label,
  };
}

export function validateProjectConfig(input: unknown): ProjectConfig {
  if (!isRecord(input)) {
    throw makeValidationError(
      'config-must-be-object',
      'Ensure anydocs.config.json contains a single JSON object.',
    );
  }

  const version = input.version;
  if (version !== 1) {
    throw makeValidationError(
      'version-must-be-1',
      'Set "version" to 1 in anydocs.config.json.',
      { received: version },
    );
  }

  const projectId = input.projectId;
  if (typeof projectId !== 'string' || projectId.trim().length === 0) {
    throw makeValidationError(
      'project-id-required',
      'Provide a non-empty "projectId" using URL-safe characters.',
      { received: projectId },
    );
  }

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(projectId)) {
    throw makeValidationError(
      'project-id-format',
      'Use lowercase letters, numbers, and hyphens only for "projectId".',
      { received: projectId },
    );
  }

  const name = input.name;
  if (typeof name !== 'string' || name.trim().length === 0) {
    throw makeValidationError(
      'project-name-required',
      'Provide a non-empty human-readable "name" in anydocs.config.json.',
      { received: name },
    );
  }

  const defaultLanguage = input.defaultLanguage;
  if (!isSupportedLanguage(defaultLanguage)) {
    throw makeValidationError(
      'default-language-invalid',
      `Set "defaultLanguage" to one of: ${SUPPORTED_DOCS_LANGUAGES.join(', ')}.`,
      { received: defaultLanguage },
    );
  }

  const languages = input.languages;
  if (!Array.isArray(languages) || languages.length === 0) {
    throw makeValidationError(
      'languages-required',
      'Provide a non-empty "languages" array in anydocs.config.json.',
      { received: languages },
    );
  }

  const uniqueLanguages = new Set<DocsLanguage>();
  for (const language of languages) {
    if (!isSupportedLanguage(language)) {
      throw makeValidationError(
        'language-variant-invalid',
        `Only these languages are supported in Phase 1: ${SUPPORTED_DOCS_LANGUAGES.join(', ')}.`,
        { received: language },
      );
    }

    uniqueLanguages.add(language);
  }

  if (!uniqueLanguages.has(defaultLanguage)) {
    throw makeValidationError(
      'default-language-must-be-enabled',
      'Include the default language in the "languages" array.',
      { defaultLanguage, languages: [...uniqueLanguages] },
    );
  }

  const site = input.site;
  if (!isRecord(site)) {
    throw makeValidationError(
      'site-required',
      'Provide a "site" object in anydocs.config.json.',
      { received: site },
    );
  }

  const siteUrl = site.url;
  let normalizedSiteUrl: string | undefined;
  if (siteUrl != null) {
    if (typeof siteUrl !== 'string' || siteUrl.trim().length === 0) {
      throw makeValidationError(
        'site-url-string',
        'Use a non-empty absolute http(s) URL for "site.url" when configuring canonical metadata.',
        { received: siteUrl },
      );
    }

    try {
      normalizedSiteUrl = normalizeSiteUrl(siteUrl);
    } catch {
      throw makeValidationError(
        'site-url-http-absolute',
        'Use an absolute http(s) URL for "site.url", for example "https://docs.example.com".',
        { received: siteUrl },
      );
    }
  }

  const theme = site.theme;
  if (!isRecord(theme)) {
    throw makeValidationError(
      'site-theme-required',
      'Provide a "theme" object under "site" in anydocs.config.json.',
      { received: theme },
    );
  }

  const themeId = theme.id;
  if (typeof themeId !== 'string' || themeId.trim().length === 0) {
    throw makeValidationError(
      'site-theme-id-required',
      'Provide a non-empty "site.theme.id" in anydocs.config.json.',
      { received: themeId },
    );
  }

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(themeId)) {
    throw makeValidationError(
      'site-theme-id-format',
      'Use lowercase letters, numbers, and hyphens only for "site.theme.id".',
      { received: themeId },
    );
  }

  const branding = theme.branding;
  if (branding != null && !isRecord(branding)) {
    throw makeValidationError(
      'site-theme-branding-object',
      'Use an object for "site.theme.branding" when specifying reader branding overrides.',
      { received: branding },
    );
  }

  const siteTitle = normalizeOptionalTrimmedString(
    branding?.siteTitle,
    'site-theme-branding-site-title-string',
    'Use a string for "site.theme.branding.siteTitle" when overriding the reader title.',
  );

  const homeLabel = normalizeOptionalTrimmedString(
    branding?.homeLabel,
    'site-theme-branding-home-label-string',
    'Use a string for "site.theme.branding.homeLabel" when overriding the footer home label.',
  );

  const logoSrc = normalizeOptionalTrimmedString(
    branding?.logoSrc,
    'site-theme-branding-logo-src-string',
    'Use a string for "site.theme.branding.logoSrc" when configuring a sidebar logo URL or path.',
  );

  const logoAlt = normalizeOptionalTrimmedString(
    branding?.logoAlt,
    'site-theme-branding-logo-alt-string',
    'Use a string for "site.theme.branding.logoAlt" when overriding sidebar logo alt text.',
  );

  if (
    branding
    && siteTitle === undefined
    && logoSrc === undefined
  ) {
    throw makeValidationError(
      'site-theme-branding-site-title-or-logo-required',
      'Provide at least one of "site.theme.branding.siteTitle" or "site.theme.branding.logoSrc" when setting branding overrides.',
      {
        received: {
          siteTitle,
          logoSrc,
        },
      },
    );
  }

  const chrome = theme.chrome;
  if (chrome != null && !isRecord(chrome)) {
    throw makeValidationError(
      'site-theme-chrome-object',
      'Use an object for "site.theme.chrome" when specifying reader chrome overrides.',
      { received: chrome },
    );
  }

  const showSearch = chrome?.showSearch;
  if (showSearch != null && typeof showSearch !== 'boolean') {
    throw makeValidationError(
      'site-theme-chrome-show-search-boolean',
      'Use a boolean for "site.theme.chrome.showSearch" when toggling sidebar search visibility.',
      { received: showSearch },
    );
  }

  const colors = theme.colors;
  if (colors != null && !isRecord(colors)) {
    throw makeValidationError(
      'site-theme-colors-object',
      'Use an object for "site.theme.colors" when specifying semantic theme color overrides.',
      { received: colors },
    );
  }

  const colorEntries = [
    ['primary', colors?.primary],
    ['primaryForeground', colors?.primaryForeground],
    ['accent', colors?.accent],
    ['accentForeground', colors?.accentForeground],
    ['sidebarActive', colors?.sidebarActive],
    ['sidebarActiveForeground', colors?.sidebarActiveForeground],
  ] as const;

  for (const [field, value] of colorEntries) {
    if (value == null) {
      continue;
    }

    if (typeof value !== 'string' || !isHexColor(value.trim())) {
      throw makeValidationError(
        `site-theme-colors-${field}-hex`,
        `Use a "#RRGGBB" value for "site.theme.colors.${field}".`,
        { received: value },
      );
    }
  }

  const codeTheme = theme.codeTheme;
  if (codeTheme != null && !SUPPORTED_DOCS_CODE_THEMES.includes(codeTheme as DocsCodeTheme)) {
    throw makeValidationError(
      'site-theme-code-theme-invalid',
      `Set "site.theme.codeTheme" to one of: ${SUPPORTED_DOCS_CODE_THEMES.join(', ')}.`,
      { received: codeTheme },
    );
  }

  const navigation = site.navigation;
  if (navigation != null && !isRecord(navigation)) {
    throw makeValidationError(
      'site-navigation-object',
      'Use an object for "site.navigation" when specifying site-shell navigation settings.',
      { received: navigation },
    );
  }

  const rawTopNav = navigation?.topNav;
  if (rawTopNav != null && !Array.isArray(rawTopNav)) {
    throw makeValidationError(
      'site-navigation-top-nav-array',
      'Use an array for "site.navigation.topNav" when specifying top navigation items.',
      { received: rawTopNav },
    );
  }

  const topNav = rawTopNav?.map((item, index) => validateTopNavItem(item, index)) ?? [];
  const topNavIds = new Set<string>();
  for (const item of topNav) {
    if (topNavIds.has(item.id)) {
      throw makeValidationError(
        'site-navigation-top-nav-item-id-unique',
        'Use unique ids for top navigation items.',
        { itemId: item.id },
      );
    }

    topNavIds.add(item.id);
  }

  const build = input.build;
  if (build != null && !isRecord(build)) {
    throw makeValidationError(
      'build-must-be-object',
      'Use an object for "build" when specifying build options.',
      { received: build },
    );
  }

  const outputDir = build?.outputDir;
  if (outputDir != null && (typeof outputDir !== 'string' || outputDir.trim().length === 0)) {
    throw makeValidationError(
      'build-output-dir-string',
      'Use a non-empty string for "build.outputDir" when overriding the output directory.',
      { received: outputDir },
    );
  }

  const authoring = input.authoring;
  if (authoring != null && !isRecord(authoring)) {
    throw makeValidationError(
      'authoring-must-be-object',
      'Use an object for "authoring" when specifying authoring template settings.',
      { received: authoring },
    );
  }

  const rawPageTemplates = authoring?.pageTemplates;
  if (rawPageTemplates != null && !Array.isArray(rawPageTemplates)) {
    throw makeValidationError(
      'authoring-page-templates-array',
      'Use an array for "authoring.pageTemplates" when specifying custom page templates.',
      { received: rawPageTemplates },
    );
  }

  const pageTemplates = rawPageTemplates?.map((template, index) => validatePageTemplate(template, index)) ?? [];
  const templateIds = new Set<string>();
  for (const template of pageTemplates) {
    if (PROJECT_PAGE_TEMPLATE_BASE_TEMPLATES.includes(template.id as (typeof PROJECT_PAGE_TEMPLATE_BASE_TEMPLATES)[number])) {
      throw makeValidationError(
        'authoring-page-template-id-built-in-reserved',
        `Use a custom template id other than the built-in template ids: ${PROJECT_PAGE_TEMPLATE_BASE_TEMPLATES.join(', ')}.`,
        { templateId: template.id },
      );
    }
    if (templateIds.has(template.id)) {
      throw makeValidationError(
        'authoring-page-template-id-unique',
        'Use unique ids for authoring page templates.',
        { templateId: template.id },
      );
    }

    templateIds.add(template.id);
  }

  const normalizedAuthoring: ProjectAuthoringConfig | undefined = authoring && pageTemplates.length > 0
    ? { pageTemplates }
    : undefined;

  const normalizedConfig: ProjectConfig = {
    version: 1,
    projectId,
    name: name.trim(),
    defaultLanguage,
    languages: [...uniqueLanguages],
    site: {
      ...(typeof normalizedSiteUrl === 'string' ? { url: normalizedSiteUrl } : {}),
      theme: {
        id: themeId.trim(),
        ...(branding
          ? {
              branding: {
                ...(siteTitle !== undefined ? { siteTitle } : {}),
                ...(homeLabel !== undefined ? { homeLabel } : {}),
                ...(logoSrc !== undefined ? { logoSrc } : {}),
                ...(logoAlt !== undefined ? { logoAlt } : {}),
              },
            }
          : {}),
        ...(chrome
          ? {
              chrome: {
                ...(typeof showSearch === 'boolean' ? { showSearch } : {}),
              },
            }
          : {}),
        ...(colors
          ? {
              colors: {
                ...(typeof colors.primary === 'string' ? { primary: colors.primary.trim() } : {}),
                ...(typeof colors.primaryForeground === 'string'
                  ? { primaryForeground: colors.primaryForeground.trim() }
                  : {}),
                ...(typeof colors.accent === 'string' ? { accent: colors.accent.trim() } : {}),
                ...(typeof colors.accentForeground === 'string'
                  ? { accentForeground: colors.accentForeground.trim() }
                  : {}),
                ...(typeof colors.sidebarActive === 'string'
                  ? { sidebarActive: colors.sidebarActive.trim() }
                  : {}),
                ...(typeof colors.sidebarActiveForeground === 'string'
                  ? { sidebarActiveForeground: colors.sidebarActiveForeground.trim() }
                  : {}),
              },
            }
          : {}),
        ...(typeof codeTheme === 'string' ? { codeTheme: codeTheme as DocsCodeTheme } : {}),
      },
      ...(topNav.length > 0 ? { navigation: { topNav } } : {}),
    },
    ...(normalizedAuthoring ? { authoring: normalizedAuthoring } : {}),
    ...(typeof outputDir === 'string' ? { build: { outputDir: outputDir.trim() } } : {}),
  };

  return normalizedConfig;
}
