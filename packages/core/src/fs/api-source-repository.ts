import { promises as fs } from 'node:fs';
import path from 'node:path';

import type { DocsLang } from '../types/docs.ts';
import type { ApiSourceDoc } from '../types/api-source.ts';
import { validateApiSourceDoc } from '../schemas/api-source-schema.ts';

export type ApiSourceRepository = {
  projectRoot: string;
  apiSourcesRoot: string;
};

function isMissingFileError(error: unknown): boolean {
  return !!error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT';
}

async function readJson<T>(filePath: string): Promise<T> {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw) as T;
}

async function writeJsonAtomic(filePath: string, value: unknown): Promise<void> {
  const dir = path.dirname(filePath);
  const tempFilePath = path.join(dir, `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(tempFilePath, JSON.stringify(value, null, 2) + '\n', 'utf8');
  await fs.rename(tempFilePath, filePath);
}

function sourceFile(repository: ApiSourceRepository, sourceId: string): string {
  return path.join(repository.apiSourcesRoot, `${sourceId}.json`);
}

export function createApiSourceRepository(projectRoot: string): ApiSourceRepository {
  return {
    projectRoot,
    apiSourcesRoot: path.join(projectRoot, 'api-sources'),
  };
}

export async function initializeApiSourceRepository(repository: ApiSourceRepository): Promise<void> {
  await fs.mkdir(repository.apiSourcesRoot, { recursive: true });
}

export async function loadApiSource(repository: ApiSourceRepository, sourceId: string): Promise<ApiSourceDoc | null> {
  try {
    return validateApiSourceDoc(await readJson<unknown>(sourceFile(repository, sourceId)));
  } catch (error: unknown) {
    if (isMissingFileError(error)) {
      return null;
    }
    throw error;
  }
}

export async function listApiSources(
  repository: ApiSourceRepository,
  options: {
    lang?: DocsLang;
    status?: ApiSourceDoc['status'];
  } = {},
): Promise<ApiSourceDoc[]> {
  let entries: string[] = [];
  try {
    entries = await fs.readdir(repository.apiSourcesRoot);
  } catch {
    return [];
  }

  const items: ApiSourceDoc[] = [];
  for (const entry of entries) {
    if (!entry.endsWith('.json')) {
      continue;
    }
    try {
      const source = validateApiSourceDoc(
        await readJson<unknown>(path.join(repository.apiSourcesRoot, entry)),
      );
      if (options.lang && source.lang !== options.lang) {
        continue;
      }
      if (options.status && source.status !== options.status) {
        continue;
      }
      items.push(source);
    } catch (error: unknown) {
      if (isMissingFileError(error)) {
        continue;
      }
      throw error;
    }
  }

  items.sort((left, right) => left.id.localeCompare(right.id));
  return items;
}

export async function saveApiSource(repository: ApiSourceRepository, source: ApiSourceDoc): Promise<ApiSourceDoc> {
  const validated = validateApiSourceDoc(source);
  await writeJsonAtomic(sourceFile(repository, validated.id), validated);
  return validated;
}

export async function deleteApiSource(repository: ApiSourceRepository, sourceId: string): Promise<void> {
  try {
    await fs.unlink(sourceFile(repository, sourceId));
  } catch (error: unknown) {
    if (isMissingFileError(error)) {
      return;
    }
    throw error;
  }
}
