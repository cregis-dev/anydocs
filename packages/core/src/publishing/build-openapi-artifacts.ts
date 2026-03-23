import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { ProjectContract } from '../types/project.ts';
import type { ApiSourceDoc } from '../types/api-source.ts';
import { createApiSourceRepository, listApiSources } from '../fs/api-source-repository.ts';

type OpenApiSourceIndexDoc = {
  id: string;
  title: string;
  lang: string;
  href: string;
  operationCount: number;
  schemaCount: number;
};

type OpenApiOperationDoc = {
  id: string;
  method: string;
  path: string;
  summary: string;
  description: string;
  tag: string;
  schemaRefs: string[];
  href: string;
  plainText: string;
};

type OpenApiSchemaDoc = {
  name: string;
  type: string;
  required: string[];
  properties: Array<{
    name: string;
    type: string;
    description: string;
  }>;
  usedByOperations: string[];
  plainText: string;
};

type OpenApiChunkDoc = {
  id: string;
  entityType: 'operation' | 'schema';
  entityId: string;
  title: string;
  text: string;
  href: string;
};

type OpenApiArtifactsByLanguage = Record<string, OpenApiSourceIndexDoc[]>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function writeText(filePath: string, value: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${value}\n`, 'utf8');
}

async function cleanupOpenApiArtifacts(root: string): Promise<void> {
  await rm(root, { recursive: true, force: true });
  await mkdir(root, { recursive: true });
}

async function resolveSourcePayload(contract: ProjectContract, source: ApiSourceDoc): Promise<unknown> {
  if (source.source.kind === 'url') {
    const response = await fetch(source.source.url);
    if (!response.ok) {
      throw new Error(`Failed to fetch api source "${source.id}" from "${source.source.url}": ${response.status} ${response.statusText}`);
    }
    return response.json();
  }

  const targetPath = path.isAbsolute(source.source.path)
    ? source.source.path
    : path.join(contract.paths.projectRoot, source.source.path);
  return JSON.parse(await readFile(targetPath, 'utf8')) as unknown;
}

function normalizeRouteBase(source: ApiSourceDoc): string {
  if (source.runtime?.routeBase) {
    return source.runtime.routeBase.startsWith('/') ? source.runtime.routeBase : `/${source.runtime.routeBase}`;
  }

  return `/${source.lang}/reference/${source.id}`;
}

function schemaToText(schema: unknown): string {
  if (!isRecord(schema)) {
    return 'unknown';
  }

  if (typeof schema.$ref === 'string') {
    return schema.$ref.split('/').at(-1) ?? schema.$ref;
  }

  if (schema.type === 'array') {
    return `array<${schemaToText(schema.items)}>`;
  }

  if (Array.isArray(schema.oneOf)) {
    return schema.oneOf.map((item) => schemaToText(item)).join(' | ');
  }

  if (Array.isArray(schema.allOf)) {
    return schema.allOf.map((item) => schemaToText(item)).join(' & ');
  }

  if (Array.isArray(schema.anyOf)) {
    return schema.anyOf.map((item) => schemaToText(item)).join(' | ');
  }

  if (typeof schema.type === 'string') {
    return typeof schema.format === 'string' ? `${schema.type}(${schema.format})` : schema.type;
  }

  return 'object';
}

function collectSchemaRefs(node: unknown, refs = new Set<string>()): Set<string> {
  if (Array.isArray(node)) {
    for (const item of node) {
      collectSchemaRefs(item, refs);
    }
    return refs;
  }

  if (!isRecord(node)) {
    return refs;
  }

  if (typeof node.$ref === 'string') {
    refs.add(node.$ref.split('/').at(-1) ?? node.$ref);
  }

  for (const value of Object.values(node)) {
    collectSchemaRefs(value, refs);
  }

  return refs;
}

function toOperationId(method: string, endpointPath: string, operation: Record<string, unknown>): string {
  if (typeof operation.operationId === 'string' && operation.operationId.trim().length > 0) {
    return operation.operationId.trim();
  }

  return `${method.toLowerCase()}-${endpointPath.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
}

function toOperationDocs(
  source: ApiSourceDoc,
  spec: Record<string, unknown>,
): {
  operations: OpenApiOperationDoc[];
  schemas: OpenApiSchemaDoc[];
  chunks: OpenApiChunkDoc[];
  sourceIndex: OpenApiSourceIndexDoc;
} {
  const routeBase = normalizeRouteBase(source);
  const rawPaths = isRecord(spec.paths) ? spec.paths : {};
  const rawSchemas = isRecord(spec.components) && isRecord(spec.components.schemas) ? spec.components.schemas : {};
  const operations: OpenApiOperationDoc[] = [];
  const operationIdsBySchema = new Map<string, Set<string>>();

  for (const [endpointPath, rawMethods] of Object.entries(rawPaths)) {
    if (!isRecord(rawMethods)) {
      continue;
    }

    for (const [method, rawOperation] of Object.entries(rawMethods)) {
      if (!isRecord(rawOperation)) {
        continue;
      }

      const operationId = toOperationId(method, endpointPath, rawOperation);
      const summary =
        typeof rawOperation.summary === 'string' && rawOperation.summary.trim().length > 0
          ? rawOperation.summary.trim()
          : `${method.toUpperCase()} ${endpointPath}`;
      const description =
        typeof rawOperation.description === 'string' && rawOperation.description.trim().length > 0
          ? rawOperation.description.trim()
          : summary;
      const tag =
        Array.isArray(rawOperation.tags) && typeof rawOperation.tags[0] === 'string'
          ? rawOperation.tags[0]
          : 'Untagged';
      const schemaRefs = [...collectSchemaRefs(rawOperation)].sort((left, right) => left.localeCompare(right));

      for (const ref of schemaRefs) {
        if (!operationIdsBySchema.has(ref)) {
          operationIdsBySchema.set(ref, new Set());
        }
        operationIdsBySchema.get(ref)?.add(operationId);
      }

      const plainText = [
        `${method.toUpperCase()} ${endpointPath}`,
        summary,
        description,
        `tag ${tag}`,
        ...(schemaRefs.length > 0 ? [`schemas ${schemaRefs.join(', ')}`] : []),
      ].join('. ');

      operations.push({
        id: operationId,
        method: method.toUpperCase(),
        path: endpointPath,
        summary,
        description,
        tag,
        schemaRefs,
        href: routeBase,
        plainText,
      });
    }
  }

  const schemas: OpenApiSchemaDoc[] = Object.entries(rawSchemas)
    .filter(([, value]) => isRecord(value))
    .map(([name, rawSchema]) => {
      const schemaRecord = rawSchema as Record<string, unknown>;
      const properties = isRecord(schemaRecord.properties) ? schemaRecord.properties : {};
      const propertyDocs = Object.entries(properties).map(([propertyName, propertySchema]) => ({
        name: propertyName,
        type: schemaToText(propertySchema),
        description:
          isRecord(propertySchema) && typeof propertySchema.description === 'string'
            ? propertySchema.description
            : '',
      }));
      const required = Array.isArray(schemaRecord.required)
        ? schemaRecord.required.filter((entry): entry is string => typeof entry === 'string')
        : [];
      const usedByOperations = [...(operationIdsBySchema.get(name) ?? new Set<string>())].sort((left, right) =>
        left.localeCompare(right),
      );
      const plainText = [
        name,
        `type ${typeof schemaRecord.type === 'string' ? schemaRecord.type : 'object'}`,
        ...(required.length > 0 ? [`required ${required.join(', ')}`] : []),
        ...(propertyDocs.length > 0
          ? [`properties ${propertyDocs.map((property) => `${property.name}:${property.type}`).join(', ')}`]
          : []),
      ].join('. ');

      return {
        name,
        type: typeof schemaRecord.type === 'string' ? schemaRecord.type : 'object',
        required,
        properties: propertyDocs,
        usedByOperations,
        plainText,
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name));

  const chunks: OpenApiChunkDoc[] = [
    ...operations.map((operation) => ({
      id: `${source.id}:${operation.id}:summary`,
      entityType: 'operation' as const,
      entityId: operation.id,
      title: operation.summary,
      text: operation.plainText,
      href: routeBase,
    })),
    ...schemas.map((schema) => ({
      id: `${source.id}:${schema.name}:schema`,
      entityType: 'schema' as const,
      entityId: schema.name,
      title: schema.name,
      text: schema.plainText,
      href: routeBase,
    })),
  ];

  const sourceIndex: OpenApiSourceIndexDoc = {
    id: source.id,
    title: source.display.title,
    lang: source.lang,
    href: routeBase,
    operationCount: operations.length,
    schemaCount: schemas.length,
  };

  return { operations, schemas, chunks, sourceIndex };
}

function buildLlmsOpenApiTxt(indexesByLanguage: OpenApiArtifactsByLanguage): string {
  const lines: string[] = ['# OpenAPI Sources', ''];

  for (const [lang, sources] of Object.entries(indexesByLanguage).sort(([left], [right]) => left.localeCompare(right))) {
    lines.push(`## ${lang}`);
    lines.push('');
    for (const source of sources) {
      lines.push(`- ${source.title} — ${source.href} — operations: ${source.operationCount}, schemas: ${source.schemaCount}`);
    }
    lines.push('');
  }

  return lines.join('\n').trimEnd();
}

export async function writePublishedOpenApiArtifacts(contract: ProjectContract): Promise<void> {
  const repository = createApiSourceRepository(contract.paths.projectRoot);
  const publishedSources = await listApiSources(repository, { status: 'published' });
  const openApiRoot = path.join(contract.paths.machineReadableRoot, 'openapi');
  await cleanupOpenApiArtifacts(openApiRoot);

  const indexesByLanguage: OpenApiArtifactsByLanguage = Object.fromEntries(
    contract.config.languages.map((lang) => [lang, [] as OpenApiSourceIndexDoc[]]),
  );

  for (const source of publishedSources) {
    const rawSpec = await resolveSourcePayload(contract, source);
    if (!isRecord(rawSpec)) {
      continue;
    }

    const { operations, schemas, chunks, sourceIndex } = toOperationDocs(source, rawSpec);
    indexesByLanguage[source.lang]?.push(sourceIndex);

    await writeJson(path.join(openApiRoot, `source.${source.id}.json`), rawSpec);
    await writeJson(path.join(openApiRoot, `operations.${source.id}.${source.lang}.json`), {
      version: 1,
      sourceId: source.id,
      items: operations,
    });
    await writeJson(path.join(openApiRoot, `schemas.${source.id}.${source.lang}.json`), {
      version: 1,
      sourceId: source.id,
      items: schemas,
    });
    await writeJson(path.join(openApiRoot, `chunks.${source.id}.${source.lang}.json`), {
      version: 1,
      sourceId: source.id,
      items: chunks,
    });
  }

  for (const lang of contract.config.languages) {
    await writeJson(path.join(openApiRoot, `index.${lang}.json`), {
      version: 1,
      sources: indexesByLanguage[lang] ?? [],
    });
  }

  const hasPublishedSources = Object.values(indexesByLanguage).some((sources) => sources.length > 0);
  if (!hasPublishedSources) {
    await rm(path.join(contract.paths.artifactRoot, 'llms-openapi.txt'), { force: true });
    return;
  }

  await writeText(path.join(contract.paths.artifactRoot, 'llms-openapi.txt'), buildLlmsOpenApiTxt(indexesByLanguage));
}
