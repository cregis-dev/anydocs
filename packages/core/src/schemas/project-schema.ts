import { ValidationError } from '../errors/validation-error.ts';
import {
  SUPPORTED_DOCS_CODE_THEMES,
  type DocsCodeTheme,
  SUPPORTED_DOCS_LANGUAGES,
  type DocsLanguage,
  type ProjectSiteTopNavItem,
  type ProjectSiteTopNavLabel,
  type ProjectConfig,
} from '../types/project.ts';

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

function validateTopNavLabel(input: unknown, itemId: string): ProjectSiteTopNavLabel {
  if (typeof input === 'string') {
    if (input.trim().length === 0) {
      throw makeValidationError(
        'site-navigation-top-nav-label-string',
        'Use a non-empty string for a top navigation label.',
        { itemId, received: input },
      );
    }

    return input.trim();
  }

  if (!isRecord(input)) {
    throw makeValidationError(
      'site-navigation-top-nav-label-object',
      'Use a string or language-keyed object for top navigation labels.',
      { itemId, received: input },
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
        'site-navigation-top-nav-label-language-string',
        `Use a non-empty string for "site.navigation.topNav[].label.${language}" when provided.`,
        { itemId, language, received: value },
      );
    }

    next[language] = value.trim();
  }

  if (Object.keys(next).length === 0) {
    throw makeValidationError(
      'site-navigation-top-nav-label-language-required',
      'Provide at least one localized top navigation label value.',
      { itemId, received: input },
    );
  }

  return next;
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

  return {
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
    ...(typeof outputDir === 'string' ? { build: { outputDir: outputDir.trim() } } : {}),
  };
}
