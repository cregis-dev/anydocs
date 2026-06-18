import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { loadProjectContract } from '../src/fs/content-repository.ts';
import { saveApiSource } from '../src/fs/api-source-repository.ts';
import { createNodeApiSourceRepository } from '../src/fs/node-fs-port.ts';
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

    const repository = createNodeApiSourceRepository(repoRoot);
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

    // 渲染就绪 doc artifact（M1）
    const doc = JSON.parse(await readFile(path.join(openApiRoot, 'doc.petstore.en.json'), 'utf8')) as {
      version: number;
      sourceId: string;
      href: string;
      operations: Array<{ id: string; method: string; path: string; href: string; responses: Array<{ status: string; contents: Array<{ schema?: { ref?: string } }> }> }>;
      nav: Array<{ tag: string; items: Array<{ operationId: string }> }>;
      schemas: Record<string, { type?: string; items?: { ref?: string } }>;
    };
    assert.equal(doc.version, 1);
    assert.equal(doc.sourceId, 'petstore');
    assert.equal(doc.href, '/en/reference/petstore');
    assert.equal(doc.operations.length, 1);
    assert.equal(doc.operations[0]?.href, '/en/reference/petstore/listPets');
    assert.equal(doc.operations[0]?.responses[0]?.contents[0]?.schema?.ref, 'PetList');
    assert.deepEqual(
      doc.nav.map((group) => ({ tag: group.tag, ops: group.items.map((item) => item.operationId) })),
      [{ tag: 'Pets', ops: ['listPets'] }],
    );
    // 命名 schema 引用保留为 ref 名（不内联展开）
    assert.equal(doc.schemas.PetList?.items?.ref, 'Pet');
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
});

test('buildDocArtifact resolves parameters, requestBody, allOf, cycles, and servers', async () => {
  const repoRoot = await createTempProjectRoot();

  try {
    await initializeProject({ repoRoot, languages: ['en'], defaultLanguage: 'en' });

    const specDir = path.join(repoRoot, 'openapi');
    await mkdir(specDir, { recursive: true });
    await writeFile(
      path.join(specDir, 'shop.json'),
      JSON.stringify({
        openapi: '3.1.0',
        info: { title: 'Shop API', version: '2.0.0', description: 'Shop endpoints.' },
        tags: [
          { name: 'Orders', description: 'Order ops' },
          { name: 'Events', description: 'Webhook events' },
        ],
        webhooks: {
          orderEvent: {
            post: {
              operationId: 'orderEvent',
              summary: 'Order event',
              tags: ['Events'],
              requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateOrder' } } } },
              responses: { '200': { description: 'ok' } },
            },
          },
        },
        servers: [
          {
            url: '{baseUrl}/v2',
            description: 'Project base URL',
            variables: { baseUrl: { default: 'https://api.example.com', description: 'Base' } },
          },
        ],
        paths: {
          '/orders/{id}': {
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
            get: {
              operationId: 'getOrder',
              summary: 'Get order',
              tags: ['Orders'],
              parameters: [{ name: 'expand', in: 'query', required: false, schema: { type: 'boolean' } }],
              responses: { '200': { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/Order' } } } } },
            },
          },
          '/orders': {
            post: {
              operationId: 'createOrder',
              summary: 'Create order',
              tags: ['Orders'],
              requestBody: {
                required: true,
                content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateOrder' } } },
              },
              responses: { '201': { description: 'Created' } },
            },
          },
        },
        components: {
          schemas: {
            Order: {
              allOf: [
                { $ref: '#/components/schemas/Base' },
                { type: 'object', required: ['total'], properties: { total: { type: 'number' } } },
              ],
            },
            Base: { type: 'object', properties: { id: { type: 'string' } } },
            CreateOrder: {
              type: 'object',
              properties: {
                items: { type: 'array', items: { type: 'string' } },
                metadata: {
                  type: 'string',
                  contentMediaType: 'application/json',
                  contentSchema: { $ref: '#/components/schemas/OrderMetadata' },
                },
              },
            },
            OrderMetadata: {
              type: 'object',
              properties: {
                source: { type: 'string' },
              },
            },
            // 自引用，验证去环
            Node: { type: 'object', properties: { children: { type: 'array', items: { $ref: '#/components/schemas/Node' } } } },
          },
        },
      }),
      'utf8',
    );

    const repository = createNodeApiSourceRepository(repoRoot);
    await saveApiSource(repository, {
      id: 'shop',
      type: 'openapi',
      lang: 'en',
      status: 'published',
      source: { kind: 'file', path: 'openapi/shop.json' },
      display: { title: 'Shop API' },
    });

    const contractResult = await loadProjectContract(repoRoot);
    assert.equal(contractResult.ok, true);
    if (!contractResult.ok) {
      throw contractResult.error;
    }

    await writePublishedOpenApiArtifacts(contractResult.value);

    const openApiRoot = path.join(repoRoot, 'dist', 'mcp', 'openapi');
    const doc = JSON.parse(await readFile(path.join(openApiRoot, 'doc.shop.en.json'), 'utf8')) as {
      info: { title: string; version?: string };
      servers: Array<{ url: string; variables?: Record<string, { default: string }> }>;
      nav: Array<{ tag: string; description?: string; items: Array<{ operationId: string }> }>;
      operations: Array<{
        id: string;
        kind: string;
        parameters: Array<{ in: string; name: string; required: boolean }>;
        requestBody?: { required: boolean; contents: Array<{ schema?: { ref?: string } }> };
      }>;
      schemas: Record<string, {
        properties?: Record<string, { ref?: string; items?: { ref?: string }; contentMediaType?: string; contentSchema?: { ref?: string } }>;
        required?: string[];
        composition?: { kind: string; members: Array<{ ref?: string }> };
      }>;
    };

    assert.equal(doc.info.title, 'Shop API');
    assert.equal(doc.info.version, '2.0.0');
    assert.equal(doc.servers[0]?.url, '{baseUrl}/v2');
    assert.equal(doc.servers[0]?.variables?.baseUrl?.default, 'https://api.example.com');

    const getOrder = doc.operations.find((operation) => operation.id === 'getOrder');
    assert.ok(getOrder);
    // path 参数(继承自 path-level) + operation query 参数
    assert.deepEqual(
      getOrder?.parameters.map((parameter) => `${parameter.in}:${parameter.name}:${parameter.required}`).sort(),
      ['path:id:true', 'query:expand:false'],
    );

    const createOrder = doc.operations.find((operation) => operation.id === 'createOrder');
    assert.equal(createOrder?.requestBody?.required, true);
    assert.equal(createOrder?.requestBody?.contents[0]?.schema?.ref, 'CreateOrder');
    assert.equal(doc.schemas.CreateOrder?.properties?.metadata?.contentMediaType, 'application/json');
    assert.equal(doc.schemas.CreateOrder?.properties?.metadata?.contentSchema?.ref, 'OrderMetadata');

    // allOf：命名引用成员保留在 composition.members，内联成员 properties 浅合并到顶层
    const order = doc.schemas.Order;
    assert.equal(order?.composition?.kind, 'allOf');
    assert.ok(order?.composition?.members.some((member) => member.ref === 'Base'));
    assert.ok(order?.properties?.total);
    assert.deepEqual(order?.required, ['total']);

    // 自引用去环：children.items 解析为 ref 名而非无限展开
    assert.equal(doc.schemas.Node?.properties?.children?.items?.ref, 'Node');

    // OAS 3.1 webhooks 纳入 operations 并标记 kind=webhook
    const orderEvent = doc.operations.find((operation) => operation.id === 'orderEvent');
    assert.equal(orderEvent?.kind, 'webhook');
    assert.equal(getOrder?.kind, 'endpoint');

    // nav 按顶层 tags 顺序分组并带描述；webhook 归入 Events
    assert.deepEqual(
      doc.nav.map((group) => ({ tag: group.tag, description: group.description, ops: group.items.map((item) => item.operationId).sort() })),
      [
        { tag: 'Orders', description: 'Order ops', ops: ['createOrder', 'getOrder'] },
        { tag: 'Events', description: 'Webhook events', ops: ['orderEvent'] },
      ],
    );
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
});
