import { promises as fs } from 'node:fs';
import path from 'node:path';

import { assertValidProjectId, createDefaultProjectConfig, ANYDOCS_CONFIG_FILE, resolveProjectRoot } from '../config/project-config.ts';
import { ValidationError } from '../errors/validation-error.ts';
import { validateProjectConfig } from '../schemas/project-schema.ts';
import {
  assertWorkflowStandardMatchesContract,
  createWorkflowStandardDefinition,
  readWorkflowStandardDefinition,
} from '../services/workflow-standard-service.ts';
import type { ProjectConfig, ProjectContract } from '../types/project.ts';
import {
  assertProjectContractStructure,
  createProjectPathContract,
} from './project-paths.ts';
import { createDocsRepository, initializeDocsRepository, loadNavigation } from './docs-repository.ts';

function collectReferencedTopNavGroupIds(config: ProjectConfig): string[] {
  return (config.site.navigation?.topNav ?? [])
    .filter((item) => item.type === 'nav-group')
    .map((item) => item.groupId);
}

function collectTopLevelGroupIds(items: Awaited<ReturnType<typeof loadNavigation>>['items']): string[] {
  return items.flatMap((item) =>
    item.type === 'section' || item.type === 'folder'
      ? item.id
        ? [item.id]
        : []
      : [],
  );
}

async function assertTopNavGroupsExistForLanguages(config: ProjectConfig, paths: ProjectContract['paths']) {
  const requiredGroupIds = [...new Set(collectReferencedTopNavGroupIds(config))];
  if (requiredGroupIds.length === 0) {
    return;
  }

  const repository = createDocsRepository(paths.projectRoot);

  for (const language of config.languages) {
    const navigation = await loadNavigation(repository, language);
    const topLevelGroupIds = collectTopLevelGroupIds(navigation.items);
    const seen = new Set<string>();

    for (const groupId of topLevelGroupIds) {
      if (!seen.has(groupId)) {
        seen.add(groupId);
        continue;
      }

      throw new ValidationError(`Navigation for "${language}" contains duplicate top-level group id "${groupId}".`, {
        entity: 'navigation-doc',
        rule: 'navigation-top-level-group-id-unique',
        remediation: 'Use unique ids for top-level section and folder items in each language navigation file.',
        metadata: { lang: language, groupId },
      });
    }

    for (const groupId of requiredGroupIds) {
      if (seen.has(groupId)) {
        continue;
      }

      throw new ValidationError(`Top navigation references missing group "${groupId}" in language "${language}".`, {
        entity: 'project-config',
        rule: 'site-navigation-top-nav-group-exists',
        remediation:
          'Create the matching top-level section or folder id in every enabled language navigation file, or update site.navigation.topNav to reference an existing group.',
        metadata: { lang: language, groupId },
      });
    }
  }
}

export type Result<T, E extends Error = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

function toValidationResult<T>(work: () => Promise<T>): Promise<Result<T, ValidationError>> {
  return work()
    .then((value) => ({ ok: true as const, value }))
    .catch((error: unknown) => {
      if (error instanceof ValidationError) {
        return { ok: false as const, error };
      }

      throw error;
    });
}

async function ensureExists(targetPath: string, entity: string, remediation: string) {
  try {
    await fs.access(targetPath);
  } catch {
    throw new ValidationError(`Missing required ${entity} at "${targetPath}".`, {
      entity,
      rule: 'required-path-exists',
      remediation,
      metadata: { targetPath },
    });
  }
}

async function readProjectConfigFile(configPath: string): Promise<unknown> {
  const rawConfig = await fs.readFile(configPath, 'utf8');

  try {
    return JSON.parse(rawConfig) as unknown;
  } catch (error: unknown) {
    throw new ValidationError(`Project configuration at "${configPath}" is not valid JSON.`, {
      entity: 'project-config-file',
      rule: 'project-config-json-valid',
      remediation: 'Fix anydocs.config.json so it contains valid JSON before loading the project contract.',
      metadata: {
        configPath,
        cause: error instanceof Error ? error.message : String(error),
      },
    });
  }
}

async function writeJsonAtomic(targetPath: string, value: unknown): Promise<void> {
  const tempPath = `${targetPath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tempPath, JSON.stringify(value, null, 2) + '\n', 'utf8');
  await fs.rename(tempPath, targetPath);
}

export async function loadProjectContract(
  repoRoot: string,
  projectId?: string,
  outputDir?: string,
): Promise<Result<ProjectContract, ValidationError>> {
  return toValidationResult(async () => {
    if (projectId) {
      assertValidProjectId(projectId);
    }

    const projectRoot = resolveProjectRoot(repoRoot, projectId);
    const configPath = path.join(projectRoot, ANYDOCS_CONFIG_FILE);

    await ensureExists(
      configPath,
      'project-config-file',
      'Create anydocs.config.json in the canonical project root before loading the contract.',
    );

    const rawConfig = await readProjectConfigFile(configPath);
    const config = validateProjectConfig(rawConfig);
    if (projectId && config.projectId !== projectId) {
      throw new ValidationError(
        `Project configuration at "${configPath}" declares projectId "${config.projectId}" but the requested project is "${projectId}".`,
        {
          entity: 'project-config',
          rule: 'project-id-matches-requested-project-root',
          remediation:
            'Update anydocs.config.json so projectId matches the canonical project directory, or load the project using the matching projectId.',
          metadata: {
            configPath,
            expectedProjectId: projectId,
            receivedProjectId: config.projectId,
          },
        },
      );
    }
    const paths = createProjectPathContract(repoRoot, config, outputDir);
    assertProjectContractStructure(config, paths);

    await ensureExists(
      paths.workflowFile,
      'workflow-standard-file',
      'Create anydocs.workflow.json in the canonical project root before loading the workflow standard.',
    );
    const workflow = await readWorkflowStandardDefinition(paths.workflowFile);
    assertWorkflowStandardMatchesContract(workflow, { config, paths });
    await ensureExists(
      paths.pagesRoot,
      'pages-root',
      'Create the pages directory for the canonical project structure.',
    );
    await ensureExists(
      paths.navigationRoot,
      'navigation-root',
      'Create the navigation directory for the canonical project structure.',
    );

    for (const language of config.languages) {
      await ensureExists(
        paths.languageRoots[language].pagesDir,
        'pages-language-root',
        `Create the pages/${language} directory for the canonical project structure.`,
      );
      await ensureExists(
        paths.languageRoots[language].navigationFile,
        'navigation-language-file',
        `Create navigation/${language}.json for every enabled language.`,
      );
    }

    await assertTopNavGroupsExistForLanguages(config, paths);

    return { config, paths };
  });
}

export async function validateProjectContract(
  repoRoot: string,
  projectId?: string,
): Promise<Result<ProjectConfig, ValidationError>> {
  const result = await loadProjectContract(repoRoot, projectId);
  if (!result.ok) {
    return result;
  }

  return {
    ok: true,
    value: result.value.config,
  };
}

export async function updateProjectConfig(
  repoRoot: string,
  patch: Partial<ProjectConfig>,
  projectId?: string,
): Promise<Result<ProjectConfig, ValidationError>> {
  const contractResult = await loadProjectContract(repoRoot, projectId);
  if (!contractResult.ok) {
    return contractResult;
  }

  return toValidationResult(async () => {
    const currentConfig = contractResult.value.config;
    const nextSite =
      patch.site !== undefined
        ? {
            ...currentConfig.site,
            ...patch.site,
            ...(patch.site.theme !== undefined
              ? {
                  theme: {
                    ...currentConfig.site.theme,
                    ...patch.site.theme,
                  },
                }
              : {}),
          }
        : currentConfig.site;
    const nextConfig = validateProjectConfig({
      ...currentConfig,
      ...patch,
      site: nextSite,
      ...(patch.build !== undefined ? { build: patch.build } : currentConfig.build ? { build: currentConfig.build } : {}),
      projectId: currentConfig.projectId,
      version: currentConfig.version,
    });
    const nextPaths = createProjectPathContract(repoRoot, nextConfig);
    await assertTopNavGroupsExistForLanguages(nextConfig, nextPaths);

    await writeJsonAtomic(contractResult.value.paths.configFile, nextConfig);
    await writeJsonAtomic(
      contractResult.value.paths.workflowFile,
      createWorkflowStandardDefinition({
        config: nextConfig,
        paths: nextPaths,
      }),
    );
    await initializeDocsRepository(createDocsRepository(nextPaths.projectRoot), nextConfig.languages);
    return nextConfig;
  });
}
