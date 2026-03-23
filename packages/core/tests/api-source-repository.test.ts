import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  createApiSourceRepository,
  deleteApiSource,
  initializeApiSourceRepository,
  listApiSources,
  loadApiSource,
  saveApiSource,
} from '../src/fs/api-source-repository.ts';
import type { ApiSourceDoc } from '../src/types/api-source.ts';

const tempRoots: string[] = [];

test.after(async () => {
  await Promise.all(tempRoots.map((tempRoot) => rm(tempRoot, { recursive: true, force: true })));
});

async function createTempRepository() {
  const projectRoot = await mkdtemp(path.join(os.tmpdir(), 'anydocs-api-source-'));
  tempRoots.push(projectRoot);

  const repository = createApiSourceRepository(projectRoot);
  await initializeApiSourceRepository(repository);

  return {
    projectRoot,
    repository,
  };
}

function createApiSource(overrides: Partial<ApiSourceDoc> = {}): ApiSourceDoc {
  return {
    id: 'petstore',
    type: 'openapi',
    lang: 'en',
    status: 'published',
    source: {
      kind: 'file',
      path: 'docs/openapi/petstore.json',
    },
    display: {
      title: 'Petstore API',
      groupId: 'reference',
    },
    runtime: {
      routeBase: '/reference/petstore',
      tryIt: {
        enabled: true,
      },
    },
    ...overrides,
  };
}

test('[P0] saveApiSource and loadApiSource round-trip canonical documents', async () => {
  const { projectRoot, repository } = await createTempRepository();

  const saved = await saveApiSource(
    repository,
    createApiSource({
      source: {
        kind: 'file',
        path: '  docs/openapi/petstore.json  ',
      },
      display: {
        title: '  Petstore API  ',
        groupId: 'reference',
      },
      runtime: {
        routeBase: '  /reference/petstore  ',
        tryIt: {
          enabled: true,
        },
      },
    }),
  );

  assert.equal(saved.source.kind, 'file');
  assert.equal(saved.source.path, 'docs/openapi/petstore.json');
  assert.equal(saved.display.title, 'Petstore API');
  assert.equal(saved.runtime?.routeBase, '/reference/petstore');

  const loaded = await loadApiSource(repository, 'petstore');
  assert.deepEqual(loaded, saved);

  const persisted = JSON.parse(
    await readFile(path.join(projectRoot, 'api-sources', 'petstore.json'), 'utf8'),
  ) as ApiSourceDoc;
  assert.equal(persisted.display.title, 'Petstore API');
  assert.equal(persisted.runtime?.routeBase, '/reference/petstore');
});

test('[P1] listApiSources filters by language and status and returns sorted ids', async () => {
  const { repository } = await createTempRepository();

  await saveApiSource(repository, createApiSource({ id: 'zeta-openapi', lang: 'en', status: 'published' }));
  await saveApiSource(repository, createApiSource({ id: 'alpha-openapi', lang: 'en', status: 'draft' }));
  await saveApiSource(repository, createApiSource({ id: 'beta-openapi', lang: 'zh', status: 'published' }));

  const englishSources = await listApiSources(repository, { lang: 'en' });
  assert.deepEqual(
    englishSources.map((source) => source.id),
    ['alpha-openapi', 'zeta-openapi'],
  );

  const publishedEnglishSources = await listApiSources(repository, {
    lang: 'en',
    status: 'published',
  });
  assert.deepEqual(
    publishedEnglishSources.map((source) => source.id),
    ['zeta-openapi'],
  );
});

test('[P1] deleteApiSource removes persisted files and ignores missing ids', async () => {
  const { repository } = await createTempRepository();

  await saveApiSource(repository, createApiSource());
  assert.ok(await loadApiSource(repository, 'petstore'));

  await deleteApiSource(repository, 'petstore');
  assert.equal(await loadApiSource(repository, 'petstore'), null);

  await deleteApiSource(repository, 'petstore');
  assert.equal(await loadApiSource(repository, 'petstore'), null);
});

test('[P0] listApiSources fails fast when persisted api source documents are invalid', async () => {
  const { projectRoot, repository } = await createTempRepository();

  await writeFile(
    path.join(projectRoot, 'api-sources', 'broken.json'),
    JSON.stringify(
      {
        id: 'broken',
        type: 'openapi',
        lang: 'en',
        status: 'retired',
        source: {
          kind: 'file',
          path: 'docs/openapi/broken.json',
        },
        display: {
          title: 'Broken API',
        },
      },
      null,
      2,
    ),
    'utf8',
  );

  await assert.rejects(
    () => listApiSources(repository),
    /api-source-status-supported/,
  );
});
