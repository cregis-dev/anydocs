import 'server-only';

import path from 'node:path';
import { readFile } from 'node:fs/promises';

import { createApiSourceRepository, listApiSources, loadApiSource, type ApiSourceDoc } from '@anydocs/core';

import { loadStudioProjectContract } from '@/lib/docs/fs';
import type { DocsLang } from '@/lib/docs/types';

async function getApiSourceRepository(projectId: string = '', customPath?: string) {
  const contract = await loadStudioProjectContract(projectId, customPath);
  return createApiSourceRepository(contract.paths.projectRoot);
}

export async function getPublishedApiSources(lang: DocsLang, projectId: string = '', customPath?: string): Promise<ApiSourceDoc[]> {
  return listApiSources(await getApiSourceRepository(projectId, customPath), {
    lang,
    status: 'published',
  });
}

export async function getPublishedApiSourceById(
  lang: DocsLang,
  sourceId: string,
  projectId: string = '',
  customPath?: string,
): Promise<ApiSourceDoc | null> {
  const source = await loadApiSource(await getApiSourceRepository(projectId, customPath), sourceId);
  if (!source || source.lang !== lang || source.status !== 'published') {
    return null;
  }
  return source;
}

export async function getPublishedApiSourceSpec(
  lang: DocsLang,
  sourceId: string,
  projectId: string = '',
  customPath?: string,
): Promise<unknown | null> {
  const source = await getPublishedApiSourceById(lang, sourceId, projectId, customPath);
  if (!source) {
    return null;
  }

  const contract = await loadStudioProjectContract(projectId, customPath);
  if (source.source.kind === 'url') {
    const response = await fetch(source.source.url);
    if (!response.ok) {
      throw new Error(`Failed to fetch API source "${source.id}": ${response.status} ${response.statusText}`);
    }
    return response.json();
  }

  const filePath = source.source.path.startsWith('/')
    ? source.source.path
    : path.join(contract.paths.projectRoot, source.source.path);
  const raw = await readFile(filePath, 'utf8');
  return JSON.parse(raw) as unknown;
}

export async function getPublishedApiSourceStaticParams(projectId: string = '', customPath?: string) {
  const contract = await loadStudioProjectContract(projectId, customPath);
  const params: Array<{ lang: DocsLang; sourceId: string }> = [];

  for (const lang of contract.config.languages) {
    const items = await getPublishedApiSources(lang, projectId, customPath);
    for (const item of items) {
      params.push({ lang, sourceId: item.id });
    }
  }

  return params;
}
