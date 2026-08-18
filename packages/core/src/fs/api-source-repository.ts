import { joinPosix } from '../utils/posix-path.ts';
import { isMissingFileError, type FileSystemPort } from './file-system-port.ts';
import type { DocsLang } from '../types/docs.ts';
import type { ApiSourceDoc } from '../types/api-source.ts';
import { validateApiSourceDoc } from '../schemas/api-source-schema.ts';

export type ApiSourceRepository = {
  projectRoot: string;
  apiSourcesRoot: string;
  /** Injectable filesystem seam (default node-backed; desktop swaps in the Tauri adapter). */
  port: FileSystemPort;
};

async function readJson<T>(port: FileSystemPort, filePath: string): Promise<T> {
  return JSON.parse(await port.readText(filePath)) as T;
}

async function writeJsonAtomic(
  port: FileSystemPort,
  filePath: string,
  value: unknown,
): Promise<void> {
  await port.writeFileAtomic(filePath, JSON.stringify(value, null, 2) + '\n');
}

function sourceFile(repository: ApiSourceRepository, sourceId: string): string {
  return joinPosix(repository.apiSourcesRoot, `${sourceId}.json`);
}

export function createApiSourceRepository(
  projectRoot: string,
  port: FileSystemPort,
): ApiSourceRepository {
  return {
    projectRoot,
    apiSourcesRoot: joinPosix(projectRoot, 'api-sources'),
    port,
  };
}

export async function initializeApiSourceRepository(repository: ApiSourceRepository): Promise<void> {
  await repository.port.ensureDir(repository.apiSourcesRoot);
}

export async function loadApiSource(repository: ApiSourceRepository, sourceId: string): Promise<ApiSourceDoc | null> {
  try {
    return validateApiSourceDoc(await readJson<unknown>(repository.port, sourceFile(repository, sourceId)));
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
    entries = await repository.port.readDir(repository.apiSourcesRoot);
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
        await readJson<unknown>(repository.port, joinPosix(repository.apiSourcesRoot, entry)),
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
  await writeJsonAtomic(repository.port, sourceFile(repository, validated.id), validated);
  return validated;
}

export async function deleteApiSource(repository: ApiSourceRepository, sourceId: string): Promise<void> {
  try {
    await repository.port.remove(sourceFile(repository, sourceId));
  } catch (error: unknown) {
    if (isMissingFileError(error)) {
      return;
    }
    throw error;
  }
}
