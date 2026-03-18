import path from 'node:path';

import { ValidationError } from '../errors/validation-error.ts';
import { DEFAULT_DOCS_CODE_THEME, DEFAULT_DOCS_THEME_ID, type ProjectConfig } from '../types/project.ts';

export const ANYDOCS_CONFIG_FILE = 'anydocs.config.json';
export const ANYDOCS_WORKFLOW_FILE = 'anydocs.workflow.json';
export const DEFAULT_PROJECT_ID = 'default';
export const DEFAULT_PROJECT_NAME = 'Anydocs Project';
export const DEFAULT_PROJECT_LANGUAGES = ['en'] as const;

const PROJECT_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function createDefaultProjectConfig(
  overrides: Partial<ProjectConfig> = {},
): ProjectConfig {
  const defaultLanguage = overrides.defaultLanguage ?? 'en';
  const languages = overrides.languages ?? [defaultLanguage];

  return {
    version: 1,
    projectId: overrides.projectId ?? DEFAULT_PROJECT_ID,
    name: overrides.name ?? DEFAULT_PROJECT_NAME,
    defaultLanguage,
    languages,
    site: {
      theme: {
        id: overrides.site?.theme?.id ?? DEFAULT_DOCS_THEME_ID,
        ...(overrides.site?.theme?.branding ? { branding: overrides.site.theme.branding } : {}),
        ...(overrides.site?.theme?.chrome ? { chrome: overrides.site.theme.chrome } : {}),
        ...(overrides.site?.theme?.colors ? { colors: overrides.site.theme.colors } : {}),
        codeTheme: overrides.site?.theme?.codeTheme ?? DEFAULT_DOCS_CODE_THEME,
      },
      ...(overrides.site?.navigation ? { navigation: overrides.site.navigation } : {}),
    },
    ...(overrides.build ? { build: overrides.build } : {}),
  };
}

export function resolveProjectRoot(repoRoot: string, _projectId?: string): string {
  return path.resolve(repoRoot);
}

export function assertValidProjectId(projectId: string): void {
  if (typeof projectId !== 'string' || projectId.trim().length === 0) {
    throw new ValidationError('Project id must be a non-empty string.', {
      entity: 'project-id',
      rule: 'project-id-required',
      remediation: 'Provide a non-empty projectId using lowercase letters, numbers, and hyphens only.',
      metadata: { received: projectId },
    });
  }

  if (!PROJECT_ID_PATTERN.test(projectId)) {
    throw new ValidationError(`Invalid project id "${projectId}".`, {
      entity: 'project-id',
      rule: 'project-id-format',
      remediation: 'Use lowercase letters, numbers, and hyphens only for projectId values passed into core workflows.',
      metadata: { received: projectId },
    });
  }
}
