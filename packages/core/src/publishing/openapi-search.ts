import type { OpenApiDocArtifact, OpenApiOperation } from '../types/openapi-doc.ts';
import type { ReaderSearchChunkSource } from '../search/search-find.ts';

function collectSchemaRefNames(operation: OpenApiOperation): string[] {
  const refs = new Set<string>();
  for (const content of operation.requestBody?.contents ?? []) {
    if (content.schema?.ref) {
      refs.add(content.schema.ref);
    }
  }
  for (const response of operation.responses) {
    for (const content of response.contents) {
      if (content.schema?.ref) {
        refs.add(content.schema.ref);
      }
    }
  }
  return [...refs];
}

function buildOperationSearchText(operation: OpenApiOperation): string {
  const parameterText = operation.parameters
    .map((parameter) => [parameter.name, parameter.description ?? ''].filter(Boolean).join(' '))
    .join('; ');
  const schemaRefs = collectSchemaRefNames(operation);

  return [
    `${operation.method} ${operation.path}`,
    operation.summary,
    operation.description ?? '',
    parameterText ? `参数 ${parameterText}` : '',
    schemaRefs.length > 0 ? `schemas ${schemaRefs.join(', ')}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * 把 OpenAPI doc 的每个 operation 转成 reader 搜索 chunk（深链到独立 operation 页）。
 * 并入站内 search-find 索引，让接口可被站内搜索精确命中。
 */
export function buildOpenApiReaderSearchChunks(doc: OpenApiDocArtifact): ReaderSearchChunkSource[] {
  const prefix = `/${doc.lang}/`;

  return doc.operations.map((operation, index) => {
    const slug = operation.href.startsWith(prefix)
      ? operation.href.slice(prefix.length)
      : operation.href.replace(/^\//, '');
    const text = buildOperationSearchText(operation);
    const kindTag = operation.kind === 'webhook' ? 'WEBHOOK' : 'API';

    return {
      id: `reference:${doc.sourceId}:${operation.id}`,
      pageId: `reference:${doc.sourceId}:${operation.id}`,
      slug,
      href: operation.href,
      title: operation.summary,
      pageTitle: doc.info.title,
      description: operation.description?.trim() || `${operation.method} ${operation.path}`,
      headingPath: [operation.tag],
      breadcrumbs: [doc.info.title, operation.tag],
      navPath: [doc.info.title, operation.tag],
      order: index,
      tags: [operation.method, operation.tag, kindTag],
      updatedAt: null,
      text,
      enrichedText: text,
      chunkHash: `reference:${doc.sourceId}:${operation.id}`,
      tokenEstimate: Math.max(1, Math.ceil(text.length / 4)),
    };
  });
}
