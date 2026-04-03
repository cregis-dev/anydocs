import { mkdir } from 'node:fs/promises';
import path from 'node:path';

import { loadProjectContract } from '../fs/content-repository.ts';
import { createDocsRepository, listPages, loadNavigation } from '../fs/docs-repository.ts';
import {
  buildPublishedSiteLanguageContent,
  type PublishedLanguageContent,
  type PublishedSiteLanguageContent,
} from '../publishing/publication-filter.ts';
import { writePublishedArtifacts } from '../publishing/build-artifacts.ts';
import { writePublishedOpenApiArtifacts } from '../publishing/build-openapi-artifacts.ts';
import type { DocsLanguage } from '../types/project.ts';
import type { WorkflowStandardFile } from '../types/workflow-standard.ts';
import { createWorkflowStandardDefinition } from './workflow-standard-service.ts';

export type BuildWorkflowOptions = {
  repoRoot: string;
  projectId?: string;
  outputDir?: string;
  dryRun?: boolean;
};

export type BuildWorkflowLanguageSummary = {
  lang: DocsLanguage;
  totalPages: number;
  publishedPages: number;
  navigationItems: number;
};

export type BuildWorkflowLanguageResult<TContent = unknown> = {
  lang: DocsLanguage;
  content: PublishedLanguageContent<TContent>;
  summary: BuildWorkflowLanguageSummary;
};

export type BuildWorkflowPublishedSiteResult<TContent = unknown> = {
  lang: DocsLanguage;
  content: PublishedSiteLanguageContent<TContent>;
  summary: BuildWorkflowLanguageSummary;
};

export type BuildWorkflowResult = {
  projectId: string;
  artifactRoot: string;
  machineReadableRoot: string;
  entryHtmlFile: string;
  defaultDocsPath: string;
  languages: BuildWorkflowLanguageSummary[];
  artifacts: WorkflowStandardFile[];
  dryRun: boolean;
};

function countNavigationItems(items: Array<{ children?: unknown[] } | Record<string, unknown>>): number {
  let count = 0;
  for (const item of items) {
    count += 1;
    if (Array.isArray(item.children)) {
      count += countNavigationItems(item.children as Array<{ children?: unknown[] } | Record<string, unknown>>);
    }
  }
  return count;
}

export async function runBuildWorkflow(options: BuildWorkflowOptions): Promise<BuildWorkflowResult> {
  const contractResult = await loadProjectContract(options.repoRoot, options.projectId, options.outputDir);
  if (!contractResult.ok) {
    throw contractResult.error;
  }

  const contract = contractResult.value;
  const siteArtifacts = await loadPublishedSiteBuildArtifacts(options);
  const defaultLanguageSite = siteArtifacts.find((entry) => entry.lang === contract.config.defaultLanguage);
  const firstPublishedRoute = defaultLanguageSite?.content.routes[0] ?? null;
  const languages = siteArtifacts.map((entry) => entry.summary);
  const artifacts = createWorkflowStandardDefinition(contract).generatedArtifacts;

  if (!options.dryRun) {
    const { assertSafeArtifactRoot, exportDocsSite } = await import('./web-runtime-bridge.ts');

    assertSafeArtifactRoot(contract.paths);
    await mkdir(contract.paths.artifactRoot, { recursive: true });
    await exportDocsSite({
      projectRoot: contract.paths.projectRoot,
      outputRoot: contract.paths.artifactRoot,
    });
    await mkdir(contract.paths.machineReadableRoot, { recursive: true });
    await writePublishedArtifacts(contract, siteArtifacts);
    await writePublishedOpenApiArtifacts(contract);
  }

  return {
    projectId: contract.config.projectId,
    artifactRoot: contract.paths.artifactRoot,
    machineReadableRoot: contract.paths.machineReadableRoot,
    entryHtmlFile: path.join(contract.paths.artifactRoot, 'index.html'),
    defaultDocsPath: firstPublishedRoute?.href ?? `/${contract.config.defaultLanguage}`,
    languages,
    artifacts,
    dryRun: Boolean(options.dryRun),
  };
}

export async function loadPublishedBuildArtifacts<TContent = unknown>(
  options: BuildWorkflowOptions,
): Promise<BuildWorkflowLanguageResult<TContent>[]> {
  const siteResults = await loadPublishedSiteBuildArtifacts<TContent>(options);
  return siteResults.map((entry) => ({
    lang: entry.lang,
    content: {
      navigation: entry.content.navigation,
      pages: entry.content.pages,
    },
    summary: entry.summary,
  }));
}

export async function loadPublishedSiteBuildArtifacts<TContent = unknown>(
  options: BuildWorkflowOptions,
): Promise<BuildWorkflowPublishedSiteResult<TContent>[]> {
  const contractResult = await loadProjectContract(options.repoRoot, options.projectId, options.outputDir);
  if (!contractResult.ok) {
    throw contractResult.error;
  }

  const contract = contractResult.value;
  const repository = createDocsRepository(contract.paths.projectRoot);
  const results: BuildWorkflowPublishedSiteResult<TContent>[] = [];

  for (const lang of contract.config.languages) {
    const [navigation, pages] = await Promise.all([
      loadNavigation(repository, lang),
      listPages<TContent>(repository, lang),
    ]);
    const content = buildPublishedSiteLanguageContent(lang, navigation, pages);
    results.push({
      lang,
      content,
      summary: {
        lang,
        totalPages: pages.length,
        publishedPages: content.pages.length,
        navigationItems: countNavigationItems(content.navigation.items),
      },
    });
  }

  return results;
}
