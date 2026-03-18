import path from 'node:path';

export type DocsRuntimeSource = {
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

export function sanitizeCookieDocsSource(projectId?: string | null, customPath?: string | null): DocsRuntimeSource {
  const normalizedProjectId = normalizeOptionalString(projectId) ?? '';
  const normalizedCustomPath = normalizeOptionalString(customPath);

  if (!normalizedCustomPath) {
    return { projectId: normalizedProjectId };
  }

  if (path.isAbsolute(normalizedCustomPath)) {
    return { projectId: normalizedProjectId };
  }

  const pathSegments = normalizedCustomPath.split(/[\\/]+/);
  if (pathSegments.includes('..')) {
    return { projectId: normalizedProjectId };
  }

  return {
    projectId: normalizedProjectId,
    customPath: normalizedCustomPath,
  };
}
