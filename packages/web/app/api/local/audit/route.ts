import type { AuditQuery } from '@anydocs/core';
import { type NextRequest } from 'next/server';

import { queryAuditLog, rollbackAuditEntry } from '@/lib/docs/fs';
import { handleRouteError, json, jsonError, readJsonBody, readProjectQuery } from '../_shared';

export const runtime = 'nodejs';

/** GET /api/local/audit — filtered, paginated, reverse-chronological audit query (Story 10.4 / 13.10). */
export async function GET(request: NextRequest) {
  try {
    const { projectId, customPath } = readProjectQuery(request);
    const params = request.nextUrl.searchParams;

    const num = (key: string): number | undefined => {
      const raw = params.get(key);
      if (raw === null || raw.trim() === '') return undefined;
      const parsed = Number(raw);
      return Number.isFinite(parsed) ? parsed : undefined;
    };
    const str = (key: string): string | undefined => params.get(key)?.trim() || undefined;

    const filter: AuditQuery = {
      scope: str('scope') as AuditQuery['scope'],
      status: str('status') as AuditQuery['status'],
      operation: str('operation') as AuditQuery['operation'],
      actorKind: str('actorKind') as AuditQuery['actorKind'],
      resourceKind: str('resourceKind') as AuditQuery['resourceKind'],
      pageId: str('pageId'),
      projectId: str('filterProjectId'),
      from: str('from'),
      to: str('to'),
      limit: num('limit'),
      offset: num('offset'),
    };

    return json(await queryAuditLog(filter, projectId, customPath));
  } catch (error) {
    return handleRouteError(error);
  }
}

/** POST /api/local/audit — roll back a committed entry (Story 10.5 / 13.10). Body: { entryId }. */
export async function POST(request: NextRequest) {
  try {
    const { projectId, customPath } = readProjectQuery(request);
    const { entryId } = await readJsonBody<{ entryId?: string }>(request);
    if (!entryId) {
      return jsonError('entryId is required', 400);
    }
    return json({ entry: await rollbackAuditEntry(entryId, projectId, customPath) });
  } catch (error) {
    return handleRouteError(error);
  }
}
