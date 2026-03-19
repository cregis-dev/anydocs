import { loadStudioProjectContract, updateStudioProjectSettings } from '@/lib/docs/fs';
import { type NextRequest } from 'next/server';

import { handleRouteError, json, readJsonBody, readProjectQuery } from '../_shared';

type ProjectSettingsPatch = Parameters<typeof updateStudioProjectSettings>[0];

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const { projectId, customPath } = readProjectQuery(request);
    const contract = await loadStudioProjectContract(projectId, customPath);
    return json(contract);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { projectId, customPath } = readProjectQuery(request);
    const patch = await readJsonBody<ProjectSettingsPatch>(request);
    await updateStudioProjectSettings(patch, projectId, customPath);
    const contract = await loadStudioProjectContract(projectId, customPath);
    return json(contract);
  } catch (error) {
    return handleRouteError(error);
  }
}
