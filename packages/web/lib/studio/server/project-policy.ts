import path from 'node:path';

import { ValidationError } from '@anydocs/core';
import type { NextRequest } from 'next/server';

export type StudioProjectQuery = {
  projectId: string;
  customPath?: string;
};

function normalizeOptionalString(value?: string | null): string | undefined {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function createProjectPolicyError(message: string, metadata?: Record<string, unknown>) {
  return new ValidationError(message, {
    entity: 'studio-project-policy',
    rule: 'studio-project-access-policy',
    remediation: 'Retry the request against the locked Studio project root.',
    ...(metadata ? { metadata } : {}),
  });
}

export function resolveStudioProjectQuery(request: NextRequest): StudioProjectQuery {
  const requestedProjectId = request.nextUrl.searchParams.get('projectId')?.trim() ?? '';
  const requestedCustomPath = normalizeOptionalString(request.nextUrl.searchParams.get('path'));

  const studioMode = process.env.ANYDOCS_STUDIO_MODE;

  if (studioMode !== 'cli-single-project') {
    throw createProjectPolicyError('Studio local APIs are only available in CLI Studio runtime.', {
      studioMode: studioMode ?? 'web-dev',
    });
  }

  const lockedProjectRoot = normalizeOptionalString(process.env.ANYDOCS_STUDIO_PROJECT_ROOT);
  const lockedProjectId = normalizeOptionalString(process.env.ANYDOCS_STUDIO_PROJECT_ID) ?? requestedProjectId;

  if (!lockedProjectRoot) {
    throw createProjectPolicyError('CLI Studio mode is missing the locked project root.');
  }

  if (requestedCustomPath && path.resolve(requestedCustomPath) !== path.resolve(lockedProjectRoot)) {
    throw createProjectPolicyError('CLI Studio mode only allows the locked project root.', {
      requestedPath: requestedCustomPath,
      lockedProjectRoot,
    });
  }

  if (requestedProjectId && lockedProjectId && requestedProjectId !== lockedProjectId) {
    throw createProjectPolicyError('CLI Studio mode only allows the locked project id.', {
      requestedProjectId,
      lockedProjectId,
    });
  }

  return {
    projectId: lockedProjectId ?? '',
    customPath: lockedProjectRoot,
  };
}
