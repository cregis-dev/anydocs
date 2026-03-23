import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { loadProjectContract } from '../src/fs/content-repository.ts';
import { createApiSourceRepository, saveApiSource } from '../src/fs/api-source-repository.ts';
import { writePublishedOpenApiArtifacts } from '../src/publishing/build-openapi-artifacts.ts';
import { initializeProject } from '../src/services/init-service.ts';

async function createTempProjectRoot(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), 'anydocs-openapi-artifacts-'));
}

test('writePublishedOpenApiArtifacts emits machine-readable OpenAPI artifacts for published file sources', async () => {
  const repoRoot = await createTempProjectRoot();

  try {
    await initializeProject({ repoRoot, languages: ['en'], defaultLanguage: 'en' });

    const specDir = path.join(repoRoot, 'openapi');
    await mkdir(specDir, { recursive: true });
    await writeFile(
      path.join(specDir, 'petstore.json'),
      JSON.stringify(
        {
          openapi: '3.0.0',
          info: {
            title: 'Petstore API',
            version: '1.0.0',
          },
          paths: {
            '/pets': {
              get: {
                operationId: 'listPets',
                summary: 'List pets',
                description: 'Returns the published pets collection.',
                tags: ['Pets'],
                responses: {
                  '200': {
                    description: 'OK',
                    content: {
                      'application/json': {
                        schema: {
                          $ref: '#/components/schemas/PetList',
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          components: {
            schemas: {
              Pet: {
                type: 'object',
                required: ['id'],
                properties: {
                  id: {
                    type: 'string',
                    description: 'Pet id',
                  },
                  name: {
                    type: 'string',
                    description: 'Pet name',
                  },
                },
              },
              PetList: {
                type: 'array',
                items: {
                  $ref: '#/components/schemas/Pet',
                },
              },
            },
          },
        },
        null,
        2,
      ),
      'utf8',
    );

    const repository = createApiSourceRepository(repoRoot);
    await saveApiSource(repository, {
      id: 'petstore',
      type: 'openapi',
      lang: 'en',
      status: 'published',
      source: {
        kind: 'file',
        path: 'openapi/petstore.json',
      },
      display: {
        title: 'Petstore API',
      },
    });

    const contractResult = await loadProjectContract(repoRoot);
    assert.equal(contractResult.ok, true);
    if (!contractResult.ok) {
      throw contractResult.error;
    }

    await writePublishedOpenApiArtifacts(contractResult.value);

    const openApiRoot = path.join(repoRoot, 'dist', 'mcp', 'openapi');
    const index = JSON.parse(await readFile(path.join(openApiRoot, 'index.en.json'), 'utf8')) as {
      version: number;
      sources: Array<{ id: string; title: string; operationCount: number; schemaCount: number; href: string }>;
    };
    const operations = JSON.parse(await readFile(path.join(openApiRoot, 'operations.petstore.en.json'), 'utf8')) as {
      items: Array<{ id: string; method: string; path: string; schemaRefs: string[] }>;
    };
    const schemas = JSON.parse(await readFile(path.join(openApiRoot, 'schemas.petstore.en.json'), 'utf8')) as {
      items: Array<{ name: string; properties: Array<{ name: string; type: string }>; usedByOperations: string[] }>;
    };
    const chunks = JSON.parse(await readFile(path.join(openApiRoot, 'chunks.petstore.en.json'), 'utf8')) as {
      items: Array<{ entityType: string; entityId: string; href: string }>;
    };
    const llmsOpenApi = await readFile(path.join(repoRoot, 'dist', 'llms-openapi.txt'), 'utf8');

    assert.equal(index.version, 1);
    assert.deepEqual(
      index.sources.map((source) => ({
        id: source.id,
        title: source.title,
        operationCount: source.operationCount,
        schemaCount: source.schemaCount,
        href: source.href,
      })),
      [
        {
          id: 'petstore',
          title: 'Petstore API',
          operationCount: 1,
          schemaCount: 2,
          href: '/en/reference/petstore',
        },
      ],
    );
    assert.deepEqual(
      operations.items.map((operation) => ({
        id: operation.id,
        method: operation.method,
        path: operation.path,
        schemaRefs: operation.schemaRefs,
      })),
      [
        {
          id: 'listPets',
          method: 'GET',
          path: '/pets',
          schemaRefs: ['PetList'],
        },
      ],
    );
    assert.deepEqual(
      schemas.items.map((schema) => ({
        name: schema.name,
        propertyCount: schema.properties.length,
        usedByOperations: schema.usedByOperations,
      })),
      [
        {
          name: 'Pet',
          propertyCount: 2,
          usedByOperations: [],
        },
        {
          name: 'PetList',
          propertyCount: 0,
          usedByOperations: ['listPets'],
        },
      ],
    );
    assert.deepEqual(
      chunks.items.map((chunk) => ({ entityType: chunk.entityType, entityId: chunk.entityId, href: chunk.href })),
      [
        {
          entityType: 'operation',
          entityId: 'listPets',
          href: '/en/reference/petstore',
        },
        {
          entityType: 'schema',
          entityId: 'Pet',
          href: '/en/reference/petstore',
        },
        {
          entityType: 'schema',
          entityId: 'PetList',
          href: '/en/reference/petstore',
        },
      ],
    );
    assert.match(llmsOpenApi, /# OpenAPI Sources/);
    assert.match(llmsOpenApi, /Petstore API/);
    assert.match(llmsOpenApi, /\/en\/reference\/petstore/);
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
});
