import path from 'node:path';

import { ValidationError } from '@anydocs/core';
import type { NextRequest } from 'next/server';

import { normalizeOptionalString, readRuntimeConfig } from '@/lib/runtime/runtime-config';

export type StudioProjectQuery = {
  projectId: string;
  customPath?: string;
};

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
  const runtime = readRuntimeConfig();

  if (runtime.studio?.kind !== 'cli') {
    throw createProjectPolicyError('Studio local APIs are only available in CLI Studio runtime.', {
      studioMode: runtime.studio?.kind ?? 'disabled',
    });
  }

  const lockedProjectRoot = runtime.studio.lockedProjectRoot;
  const lockedProjectId = runtime.studio.lockedProjectId ?? requestedProjectId;

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
