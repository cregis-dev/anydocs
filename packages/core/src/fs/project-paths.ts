import path from 'node:path';

import { ValidationError } from '../errors/validation-error.ts';
import {
  ANYDOCS_CONFIG_FILE,
  ANYDOCS_WORKFLOW_FILE,
} from '../config/project-config.ts';
import {
  SUPPORTED_DOCS_LANGUAGES,
  type DocsLanguage,
  type ProjectConfig,
  type ProjectPathContract,
} from '../types/project.ts';

export function createProjectPathContract(
  repoRoot: string,
  projectRoot: string,
  config: ProjectConfig,
  outputDir?: string,
): ProjectPathContract {
  const pagesRoot = path.join(projectRoot, 'pages');
  const navigationRoot = path.join(projectRoot, 'navigation');

  // Determine output directory:
  // 1. Explicit parameter (from CLI --output)
  // 2. Config file build.outputDir
  // 3. Default: {repoRoot}/dist
  const resolvedOutputDir = outputDir
    ? path.resolve(repoRoot, outputDir)
    : config.build?.outputDir
      ? path.resolve(projectRoot, config.build.outputDir)
      : path.join(repoRoot, 'dist');

  const artifactRoot = resolvedOutputDir;
  const machineReadableRoot = path.join(artifactRoot, 'mcp');

  const languageRoots = Object.fromEntries(
    SUPPORTED_DOCS_LANGUAGES.map((language) => [
      language,
      {
        pagesDir: path.join(pagesRoot, language),
        navigationFile: path.join(navigationRoot, `${language}.json`),
        searchIndexFile: path.join(artifactRoot, `search-index.${language}.json`),
      },
    ]),
  ) as Record<
    DocsLanguage,
    {
      pagesDir: string;
      navigationFile: string;
      searchIndexFile: string;
    }
  >;

  return {
    repoRoot,
    projectRoot,
    configFile: path.join(projectRoot, ANYDOCS_CONFIG_FILE),
    workflowFile: path.join(projectRoot, ANYDOCS_WORKFLOW_FILE),
    importsRoot: path.join(projectRoot, 'imports'),
    apiSourcesRoot: path.join(projectRoot, 'api-sources'),
    pagesRoot,
    navigationRoot,
    artifactRoot,
    llmsFile: path.join(artifactRoot, 'llms.txt'),
    machineReadableRoot,
    languageRoots,
  };
}

export function assertProjectContractStructure(
  config: ProjectConfig,
  paths: ProjectPathContract,
): void {
  for (const language of config.languages) {
    const roots = paths.languageRoots[language];
    if (!roots) {
      throw new ValidationError(`Missing canonical language paths for "${language}".`, {
        entity: 'project-path-contract',
        rule: 'language-roots-must-cover-enabled-languages',
        remediation: 'Ensure the path contract defines page, navigation, and search paths for every enabled language.',
        metadata: { language, enabledLanguages: config.languages },
      });
    }
  }
}
