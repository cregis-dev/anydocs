import type { ApiSourceDoc } from '@anydocs/core';
import { listStudioApiSources, replaceStudioApiSources } from '@/lib/docs/fs';
import { type NextRequest } from 'next/server';

import { handleRouteError, json, readJsonBody, readProjectQuery } from '../_shared';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const { projectId, customPath } = readProjectQuery(request);
    return json({ sources: await listStudioApiSources(projectId, customPath) });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { projectId, customPath } = readProjectQuery(request);
    const body = await readJsonBody<{ sources: ApiSourceDoc[] }>(request);
    return json({ sources: await replaceStudioApiSources(body.sources, projectId, customPath) });
  } catch (error) {
    return handleRouteError(error);
  }
}
