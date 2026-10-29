import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { NextRequest, NextResponse } from 'next/server';

import { resolveRequestDocsSource } from '@/lib/docs/data';
import { getProjectBuildRoot } from '@/lib/docs/fs';
import type { DocsLang } from '@/lib/docs/types';

export const runtime = 'nodejs';

function isDocsLang(value: string | null): value is DocsLang {
  return value === 'en' || value === 'zh';
}

export async function GET(request: NextRequest) {
  const lang = request.nextUrl.searchParams.get('lang');
  if (!isDocsLang(lang)) {
    return NextResponse.json(
      {
        error: 'Invalid lang. Expected "en" or "zh".',
      },
      { status: 400 },
    );
  }

  const source = await resolveRequestDocsSource();
  const buildRoot = await getProjectBuildRoot(source.projectId, source.customPath);
  const searchFindPath = path.join(buildRoot, `search-find.${lang}.json`);

  try {
    const content = await readFile(searchFindPath, 'utf8');
    return new NextResponse(content, {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        // Allow browser/proxy caching so the client-side `cache: 'force-cache'`
        // fetch actually hits the HTTP cache on subsequent page loads. The
        // artifact is regenerated only when the project is rebuilt, so a
        // short max-age with revalidation is safe and avoids re-downloading
        // the multi-megabyte index on every navigation.
        'Cache-Control': 'public, max-age=300, must-revalidate',
      },
    });
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return NextResponse.json(
        {
          error: `search-find.${lang}.json not found for current preview source.`,
        },
        { status: 404, headers: { 'Cache-Control': 'public, max-age=60' } },
      );
    }

    throw error;
  }
}
