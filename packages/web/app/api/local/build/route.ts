import { runBuildWorkflow } from '@anydocs/core';
import { loadStudioProjectContract } from '@/lib/docs/fs';
import { type NextRequest } from 'next/server';

import { handleRouteError, json, readProjectQuery } from '../_shared';

export const runtime = 'nodejs';

// POST /api/local/build — run the full build workflow for the active project.
// Web-host counterpart of the desktop-server's `/studio/build/post` handler
// (`web-local-host.runBuild` posts here). Response shape is the
// `StudioBuildResponse` contract from `components/studio/hosts/host-types.ts`:
// `{ artifactRoot, languages: [{ lang, publishedPages }] }`.
export async function POST(request: NextRequest) {
  try {
    const { projectId, customPath } = readProjectQuery(request);
    const contract = await loadStudioProjectContract(projectId, customPath);

    const result = await runBuildWorkflow({
      repoRoot: contract.paths.repoRoot,
      projectId: contract.config.projectId,
    });

    return json({
      artifactRoot: result.artifactRoot,
      languages: result.languages.map(({ lang, publishedPages }) => ({ lang, publishedPages })),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
