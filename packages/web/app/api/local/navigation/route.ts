import { loadNavigation, saveNavigation } from '@/lib/docs/fs';
import type { NavigationDoc } from '@/lib/docs/types';
import { type NextRequest } from 'next/server';

import { handleRouteError, json, readJsonBody, readProjectQuery, requireLang } from '../_shared';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const lang = requireLang(request);
    const { projectId, customPath } = readProjectQuery(request);
    return json(await loadNavigation(lang, projectId, customPath));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const lang = requireLang(request);
    const { projectId, customPath } = readProjectQuery(request);
    const navigation = await readJsonBody<NavigationDoc>(request);
    return json(await saveNavigation(lang, navigation, projectId, customPath));
  } catch (error) {
    return handleRouteError(error);
  }
}
