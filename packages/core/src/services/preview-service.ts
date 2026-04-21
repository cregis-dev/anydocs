import { loadProjectContract } from '../fs/content-repository.ts';
import { loadPublishedSiteBuildArtifacts } from './build-service.ts';
import { writePublishedArtifacts } from '../publishing/build-artifacts.ts';
import type { DocsLanguage } from '../types/project.ts';

export type PreviewWorkflowOptions = {
  repoRoot: string;
  projectId?: string;
  host?: string;
  port?: number;
  startTimeoutMs?: number;
  stdio?: 'pipe' | 'inherit';
};

export type PreviewTarget = {
  projectId: string;
  language: DocsLanguage;
  docsPath: string;
  publishedPages: number;
};

export type PreviewWorkflowResult = PreviewTarget & {
  host: string;
  port: number;
  url: string;
  pid: number;
  stop: () => Promise<void>;
  waitUntilExit: () => Promise<{ exitCode: number | null; signal: NodeJS.Signals | null }>;
};

export async function resolvePreviewTarget(options: PreviewWorkflowOptions): Promise<PreviewTarget> {
  const contractResult = await loadProjectContract(options.repoRoot, options.projectId);
  if (!contractResult.ok) {
    throw contractResult.error;
  }

  const contract = contractResult.value;
  const language = contract.config.defaultLanguage;
  const siteArtifacts = await loadPublishedSiteBuildArtifacts(options);
  const defaultLanguageSite = siteArtifacts.find((entry) => entry.lang === language);
  const firstPublishedRoute = defaultLanguageSite?.content.routes[0] ?? null;

  return {
    projectId: contract.config.projectId,
    language,
    docsPath: firstPublishedRoute?.href ?? `/${language}`,
    publishedPages: defaultLanguageSite?.content.pages.length ?? 0,
  };
}

export async function runPreviewWorkflow(options: PreviewWorkflowOptions): Promise<PreviewWorkflowResult> {
  const target = await resolvePreviewTarget(options);
  const contractResult = await loadProjectContract(options.repoRoot, options.projectId);
  if (!contractResult.ok) {
    throw contractResult.error;
  }

  const contract = contractResult.value;
  const siteArtifacts = await loadPublishedSiteBuildArtifacts(options);
  await writePublishedArtifacts(contract, siteArtifacts);
  const { startDocsPreviewServer } = await import('./web-runtime-bridge.ts');
  const server = await startDocsPreviewServer({
    projectRoot: contract.paths.projectRoot,
    host: options.host,
    port: options.port,
    readyPath: target.docsPath,
    startTimeoutMs: options.startTimeoutMs,
    stdio: options.stdio,
  });

  return {
    ...target,
    host: server.host,
    port: server.port,
    url: server.url,
    pid: server.child.pid ?? -1,
    stop: server.stop,
    waitUntilExit: server.waitUntilExit,
  };
}
