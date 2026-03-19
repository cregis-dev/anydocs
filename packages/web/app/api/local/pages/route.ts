import { listPages } from '@/lib/docs/fs';
import { type NextRequest } from 'next/server';

import { handleRouteError, json, readProjectQuery, requireLang } from '../_shared';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const lang = requireLang(request);
    const { projectId, customPath } = readProjectQuery(request);
    return json({ pages: await listPages(lang, projectId, customPath) });
  } catch (error) {
    return handleRouteError(error);
  }
}
