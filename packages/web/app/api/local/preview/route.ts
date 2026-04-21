import { runPreviewWorkflow } from '@anydocs/core';
import { loadStudioProjectContract } from '@/lib/docs/fs';
import { type NextRequest } from 'next/server';

import { getActivePreview, registerPreview, stopAllActivePreviews } from '../_preview-registry';
import { handleRouteError, json, readProjectQuery } from '../_shared';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const { projectId, customPath } = readProjectQuery(request);
    const contract = await loadStudioProjectContract(projectId, customPath);
    const projectRoot = contract.paths.projectRoot;

    await stopAllActivePreviews();

    const result = await runPreviewWorkflow({
      repoRoot: contract.paths.repoRoot,
      projectId: contract.config.projectId,
    });
    const entry = registerPreview(projectRoot, result);
    const activePreview = getActivePreview(projectRoot) ?? entry;

    return json({
      docsPath: activePreview.docsPath,
      previewUrl: activePreview.previewUrl,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE() {
  try {
    const stopped = await stopAllActivePreviews();
    return json({ stopped });
  } catch (error) {
    return handleRouteError(error);
  }
}
