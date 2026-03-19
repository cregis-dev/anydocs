import { createPage, loadPage, savePage, deletePage } from '@/lib/docs/fs';
import type { PageDoc } from '@/lib/docs/types';
import { type NextRequest } from 'next/server';

import {
  handleRouteError,
  json,
  jsonError,
  readJsonBody,
  readProjectQuery,
  requireLang,
  requirePageId,
} from '../_shared';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const lang = requireLang(request);
    const pageId = requirePageId(request);
    const { projectId, customPath } = readProjectQuery(request);
    const page = await loadPage(lang, pageId, projectId, customPath);

    if (!page) {
      return jsonError(`Page "${pageId}" not found.`, 404);
    }

    return json(page);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const lang = requireLang(request);
    const { projectId, customPath } = readProjectQuery(request);
    const page = await readJsonBody<PageDoc>(request);
    return json(await savePage(lang, page, projectId, customPath));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const lang = requireLang(request);
    const { projectId, customPath } = readProjectQuery(request);
    const input = await readJsonBody<{ slug: string; title: string }>(request);
    return json(
      await createPage(lang, {
        slug: input.slug,
        title: input.title,
        projectId,
        customPath,
      }),
      201,
    );
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const lang = requireLang(request);
    const pageId = requirePageId(request);
    const { projectId, customPath } = readProjectQuery(request);
    return json(await deletePage(lang, pageId, projectId, customPath));
  } catch (error) {
    return handleRouteError(error);
  }
}
