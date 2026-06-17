import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { ProjectContract } from '../types/project.ts';
import type { ApiSourceDoc } from '../types/api-source.ts';
import type {
  OpenApiDocArtifact,
  OpenApiNavGroup,
  OpenApiOperation,
  OpenApiServer,
  ResolvedMediaType,
  ResolvedParameter,
  ResolvedRequestBody,
  ResolvedResponse,
  ResolvedSchema,
  ResolvedSecurityRequirement,
} from '../types/openapi-doc.ts';
import { OPENAPI_DOC_ARTIFACT_VERSION } from '../types/openapi-doc.ts';
import { createApiSourceRepository, listApiSources } from '../fs/api-source-repository.ts';
import { buildTryItManifestSource, TRY_IT_MANIFEST_VERSION, type TryItManifestSource } from '../services/try-it-proxy.ts';

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

// --- 渲染就绪 doc artifact 解析 ---------------------------------------------

const SCHEMA_MAX_DEPTH = 24;

function refName(ref: string): string {
  return ref.split('/').at(-1) ?? ref;
}

/** 解引用 `#/components/<section>/<name>`（schema 段除外——schema 引用保留为 ref 名）。 */
function derefComponent(node: unknown, spec: Record<string, unknown>, section: string): Record<string, unknown> | null {
  if (!isRecord(node)) {
    return null;
  }
  if (typeof node.$ref !== 'string') {
    return node;
  }
  const components = isRecord(spec.components) ? spec.components : {};
  const bucket = isRecord(components[section]) ? (components[section] as Record<string, unknown>) : {};
  const target = bucket[refName(node.$ref)];
  return isRecord(target) ? target : null;
}

function pickString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function resolveSchemaNode(node: unknown, depth = 0): ResolvedSchema | undefined {
  if (!isRecord(node)) {
    return undefined;
  }

  // 命名 schema 引用：不内联展开，交给渲染层用 schemas 字典解引用（天然防环）。
  if (typeof node.$ref === 'string') {
    return { ref: refName(node.$ref) };
  }

  if (depth >= SCHEMA_MAX_DEPTH) {
    return { type: typeof node.type === 'string' ? node.type : 'object', cyclic: true };
  }

  const resolved: ResolvedSchema = {};

  if (typeof node.type === 'string') resolved.type = node.type;
  if (typeof node.format === 'string') resolved.format = node.format;
  if (typeof node.title === 'string') resolved.title = node.title;
  if (typeof node.description === 'string') resolved.description = node.description;
  if (typeof node.nullable === 'boolean') resolved.nullable = node.nullable;
  if (typeof node.deprecated === 'boolean') resolved.deprecated = node.deprecated;
  if (typeof node.readOnly === 'boolean') resolved.readOnly = node.readOnly;
  if (typeof node.writeOnly === 'boolean') resolved.writeOnly = node.writeOnly;
  if (typeof node.contentMediaType === 'string') resolved.contentMediaType = node.contentMediaType;
  if (Array.isArray(node.enum)) resolved.enum = node.enum;
  if ('default' in node) resolved.default = node.default;
  if ('example' in node) resolved.example = node.example;

  const required = Array.isArray(node.required)
    ? node.required.filter((entry): entry is string => typeof entry === 'string')
    : [];
  if (required.length > 0) resolved.required = required;

  if (isRecord(node.properties)) {
    const properties: Record<string, ResolvedSchema> = {};
    for (const [name, value] of Object.entries(node.properties)) {
      const child = resolveSchemaNode(value, depth + 1);
      if (child) properties[name] = child;
    }
    if (Object.keys(properties).length > 0) resolved.properties = properties;
  }

  if (node.items !== undefined) {
    resolved.items = resolveSchemaNode(node.items, depth + 1);
  }

  if (node.contentSchema !== undefined) {
    resolved.contentSchema = resolveSchemaNode(node.contentSchema, depth + 1);
  }

  for (const kind of ['allOf', 'oneOf', 'anyOf'] as const) {
    if (!Array.isArray(node[kind])) {
      continue;
    }
    const members = (node[kind] as unknown[])
      .map((member) => resolveSchemaNode(member, depth + 1))
      .filter((member): member is ResolvedSchema => member !== undefined);
    resolved.composition = { kind, members };

    // allOf：把内联成员（非命名引用）的 properties/required 浅合并到顶层，便于直接渲染。
    if (kind === 'allOf') {
      const mergedProps: Record<string, ResolvedSchema> = { ...(resolved.properties ?? {}) };
      const mergedRequired = new Set(resolved.required ?? []);
      for (const member of members) {
        if (member.ref) continue;
        for (const [name, value] of Object.entries(member.properties ?? {})) {
          mergedProps[name] = value;
        }
        for (const name of member.required ?? []) {
          mergedRequired.add(name);
        }
      }
      if (Object.keys(mergedProps).length > 0) resolved.properties = mergedProps;
      if (mergedRequired.size > 0) resolved.required = [...mergedRequired];
    }
  }

  return resolved;
}

function resolveNamedSchemas(spec: Record<string, unknown>): Record<string, ResolvedSchema> {
  const components = isRecord(spec.components) ? spec.components : {};
  const rawSchemas = isRecord(components.schemas) ? components.schemas : {};
  const result: Record<string, ResolvedSchema> = {};
  for (const [name, value] of Object.entries(rawSchemas)) {
    const resolved = resolveSchemaNode(value);
    if (resolved) result[name] = resolved;
  }
  return result;
}

function resolveContents(rawContent: unknown): ResolvedMediaType[] {
  if (!isRecord(rawContent)) {
    return [];
  }
  const contents: ResolvedMediaType[] = [];
  for (const [mediaType, rawMedia] of Object.entries(rawContent)) {
    if (!isRecord(rawMedia)) {
      continue;
    }
    const media: ResolvedMediaType = { mediaType };
    const schema = resolveSchemaNode(rawMedia.schema);
    if (schema) media.schema = schema;
    if ('example' in rawMedia) {
      media.example = rawMedia.example;
    } else if (isRecord(rawMedia.examples)) {
      const first = Object.values(rawMedia.examples).find(isRecord);
      if (first && 'value' in first) media.example = first.value;
    }
    contents.push(media);
  }
  return contents;
}

function resolveParameters(
  spec: Record<string, unknown>,
  pathLevel: unknown,
  operationLevel: unknown,
): ResolvedParameter[] {
  const collected = new Map<string, ResolvedParameter>();
  const validIn = new Set(['path', 'query', 'header', 'cookie']);

  for (const rawList of [pathLevel, operationLevel]) {
    if (!Array.isArray(rawList)) {
      continue;
    }
    for (const rawParam of rawList) {
      const param = derefComponent(rawParam, spec, 'parameters');
      if (!param || typeof param.name !== 'string' || typeof param.in !== 'string' || !validIn.has(param.in)) {
        continue;
      }
      const entry: ResolvedParameter = {
        in: param.in as ResolvedParameter['in'],
        name: param.name,
        required: param.in === 'path' ? true : param.required === true,
      };
      if (typeof param.deprecated === 'boolean') entry.deprecated = param.deprecated;
      const description = pickString(param.description);
      if (description) entry.description = description;
      const schema = resolveSchemaNode(param.schema);
      if (schema) entry.schema = schema;
      if ('example' in param) entry.example = param.example;
      // operation 级覆盖 path 级（同 name+in）。
      collected.set(`${entry.in}:${entry.name}`, entry);
    }
  }

  return [...collected.values()];
}

function resolveRequestBody(spec: Record<string, unknown>, rawOperation: Record<string, unknown>): ResolvedRequestBody | undefined {
  const body = derefComponent(rawOperation.requestBody, spec, 'requestBodies');
  if (!body) {
    return undefined;
  }
  const contents = resolveContents(body.content);
  const resolved: ResolvedRequestBody = {
    required: body.required === true,
    contents,
  };
  const description = pickString(body.description);
  if (description) resolved.description = description;
  return resolved;
}

function resolveResponses(spec: Record<string, unknown>, rawOperation: Record<string, unknown>): ResolvedResponse[] {
  if (!isRecord(rawOperation.responses)) {
    return [];
  }
  const responses: ResolvedResponse[] = [];
  for (const [status, rawResponse] of Object.entries(rawOperation.responses)) {
    const response = derefComponent(rawResponse, spec, 'responses');
    if (!response) {
      continue;
    }
    const resolved: ResolvedResponse = {
      status,
      contents: resolveContents(response.content),
    };
    const description = pickString(response.description);
    if (description) resolved.description = description;
    responses.push(resolved);
  }
  return responses;
}

function resolveSecurity(spec: Record<string, unknown>, rawOperation: Record<string, unknown>): ResolvedSecurityRequirement[] | undefined {
  const raw = Array.isArray(rawOperation.security)
    ? rawOperation.security
    : Array.isArray(spec.security)
      ? spec.security
      : null;
  if (!raw) {
    return undefined;
  }
  const components = isRecord(spec.components) ? spec.components : {};
  const schemes = isRecord(components.securitySchemes) ? components.securitySchemes : {};
  const result: ResolvedSecurityRequirement[] = [];
  for (const requirement of raw) {
    if (!isRecord(requirement)) {
      continue;
    }
    for (const [scheme, scopes] of Object.entries(requirement)) {
      const def = isRecord(schemes[scheme]) ? (schemes[scheme] as Record<string, unknown>) : {};
      const entry: ResolvedSecurityRequirement = { scheme };
      if (typeof def.type === 'string') entry.type = def.type;
      if (typeof def.in === 'string') entry.in = def.in;
      if (typeof def.name === 'string') entry.name = def.name;
      if (Array.isArray(scopes)) {
        entry.scopes = scopes.filter((scope): scope is string => typeof scope === 'string');
      }
      result.push(entry);
    }
  }
  return result.length > 0 ? result : undefined;
}

function resolveServers(spec: Record<string, unknown>): OpenApiServer[] {
  if (!Array.isArray(spec.servers)) {
    return [];
  }
  const servers: OpenApiServer[] = [];
  for (const rawServer of spec.servers) {
    if (!isRecord(rawServer) || typeof rawServer.url !== 'string') {
      continue;
    }
    const server: OpenApiServer = { url: rawServer.url };
    const description = pickString(rawServer.description);
    if (description) server.description = description;
    if (isRecord(rawServer.variables)) {
      const variables: NonNullable<OpenApiServer['variables']> = {};
      for (const [name, rawVar] of Object.entries(rawServer.variables)) {
        if (!isRecord(rawVar) || typeof rawVar.default !== 'string') {
          continue;
        }
        const variable: NonNullable<OpenApiServer['variables']>[string] = { default: rawVar.default };
        if (Array.isArray(rawVar.enum)) {
          variable.enum = rawVar.enum.filter((entry): entry is string => typeof entry === 'string');
        }
        const varDescription = pickString(rawVar.description);
        if (varDescription) variable.description = varDescription;
        variables[name] = variable;
      }
      if (Object.keys(variables).length > 0) server.variables = variables;
    }
    servers.push(server);
  }
  return servers;
}

const HTTP_METHODS = new Set(['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace']);

function buildOperation(
  spec: Record<string, unknown>,
  routeBase: string,
  kind: OpenApiOperation['kind'],
  method: string,
  endpointPath: string,
  rawOperation: Record<string, unknown>,
  sharedParams: unknown,
): OpenApiOperation {
  const operationId = toOperationId(method, endpointPath, rawOperation);
  const operation: OpenApiOperation = {
    id: operationId,
    kind,
    method: method.toUpperCase(),
    path: endpointPath,
    summary: pickString(rawOperation.summary) ?? `${method.toUpperCase()} ${endpointPath}`,
    tag:
      Array.isArray(rawOperation.tags) && typeof rawOperation.tags[0] === 'string'
        ? rawOperation.tags[0]
        : kind === 'webhook'
          ? 'Webhooks'
          : 'Untagged',
    parameters: resolveParameters(spec, sharedParams, rawOperation.parameters),
    responses: resolveResponses(spec, rawOperation),
    href: `${routeBase}/${operationId}`,
  };
  const description = pickString(rawOperation.description);
  if (description) operation.description = description;
  if (rawOperation.deprecated === true) operation.deprecated = true;
  const requestBody = resolveRequestBody(spec, rawOperation);
  if (requestBody) operation.requestBody = requestBody;
  const security = resolveSecurity(spec, rawOperation);
  if (security) operation.security = security;
  return operation;
}

/** 按顶层 `tags` 声明顺序分组；声明带描述，未声明的 tag 追加在后并保持首次出现顺序。 */
function buildNavGroups(operations: OpenApiOperation[], spec: Record<string, unknown>): OpenApiNavGroup[] {
  const groups = new Map<string, OpenApiNavGroup>();
  const tagOrder: string[] = [];
  const tagDescriptions = new Map<string, string>();

  if (Array.isArray(spec.tags)) {
    for (const rawTag of spec.tags) {
      if (!isRecord(rawTag) || typeof rawTag.name !== 'string') {
        continue;
      }
      tagOrder.push(rawTag.name);
      const description = pickString(rawTag.description);
      if (description) tagDescriptions.set(rawTag.name, description);
    }
  }

  const ensureGroup = (tag: string): OpenApiNavGroup => {
    let group = groups.get(tag);
    if (!group) {
      group = { tag, items: [] };
      const description = tagDescriptions.get(tag);
      if (description) group.description = description;
      groups.set(tag, group);
      if (!tagOrder.includes(tag)) {
        tagOrder.push(tag);
      }
    }
    return group;
  };

  for (const operation of operations) {
    ensureGroup(operation.tag).items.push({
      operationId: operation.id,
      method: operation.method,
      path: operation.path,
      title: operation.summary,
      href: operation.href,
    });
  }

  return tagOrder.map((tag) => groups.get(tag)).filter((group): group is OpenApiNavGroup => group !== undefined);
}

export function buildDocArtifact(source: ApiSourceDoc, spec: Record<string, unknown>): OpenApiDocArtifact {
  const routeBase = normalizeRouteBase(source);
  const operations: OpenApiOperation[] = [];

  const rawPaths = isRecord(spec.paths) ? spec.paths : {};
  for (const [endpointPath, rawMethods] of Object.entries(rawPaths)) {
    if (!isRecord(rawMethods)) {
      continue;
    }
    const sharedParams = rawMethods.parameters;
    for (const [method, rawOperation] of Object.entries(rawMethods)) {
      if (!HTTP_METHODS.has(method.toLowerCase()) || !isRecord(rawOperation)) {
        continue;
      }
      operations.push(buildOperation(spec, routeBase, 'endpoint', method, endpointPath, rawOperation, sharedParams));
    }
  }

  // OAS 3.1 顶层 webhooks：Cregis 主动推送的回调，与 path operation 同构。
  const rawWebhooks = isRecord(spec.webhooks) ? spec.webhooks : {};
  for (const [eventName, rawMethods] of Object.entries(rawWebhooks)) {
    if (!isRecord(rawMethods)) {
      continue;
    }
    const sharedParams = rawMethods.parameters;
    for (const [method, rawOperation] of Object.entries(rawMethods)) {
      if (!HTTP_METHODS.has(method.toLowerCase()) || !isRecord(rawOperation)) {
        continue;
      }
      operations.push(buildOperation(spec, routeBase, 'webhook', method, eventName, rawOperation, sharedParams));
    }
  }

  const rawInfo = isRecord(spec.info) ? spec.info : {};

  return {
    version: OPENAPI_DOC_ARTIFACT_VERSION,
    sourceId: source.id,
    lang: source.lang,
    href: routeBase,
    info: {
      title: pickString(rawInfo.title) ?? source.display.title,
      version: pickString(rawInfo.version),
      description: pickString(rawInfo.description),
    },
    servers: resolveServers(spec),
    nav: buildNavGroups(operations, spec),
    operations,
    schemas: resolveNamedSchemas(spec),
  };
}

/** 加载所有 published API source 并解析为 doc artifact（供搜索索引等下游复用）。 */
export async function loadPublishedOpenApiDocs(contract: ProjectContract): Promise<OpenApiDocArtifact[]> {
  const repository = createApiSourceRepository(contract.paths.projectRoot);
  const publishedSources = await listApiSources(repository, { status: 'published' });
  const docs: OpenApiDocArtifact[] = [];
  for (const source of publishedSources) {
    const rawSpec = await resolveSourcePayload(contract, source);
    if (!isRecord(rawSpec)) {
      continue;
    }
    docs.push(buildDocArtifact(source, rawSpec));
  }
  return docs;
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
  const tryItManifestSources: TryItManifestSource[] = [];

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
    const docArtifact = buildDocArtifact(source, rawSpec);
    await writeJson(path.join(openApiRoot, `doc.${source.id}.${source.lang}.json`), docArtifact);
    const manifestSource = buildTryItManifestSource(source, docArtifact);
    if (manifestSource) {
      tryItManifestSources.push(manifestSource);
    }
  }

  await writeJson(path.join(openApiRoot, 'try-it.json'), {
    version: TRY_IT_MANIFEST_VERSION,
    sources: tryItManifestSources,
  });

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
