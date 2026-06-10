import 'server-only';

import { buildDocArtifact, type OpenApiDocArtifact } from '@anydocs/core';

import { getPublishedApiSourceByRouteSlug, getPublishedApiSourceSpec } from '@/lib/docs/api-sources';
import type { DocsLang } from '@/lib/docs/types';

/**
 * 运行时解析 published API source 为渲染就绪的 doc artifact。
 *
 * 复用 core 的 `buildDocArtifact`（与 build 期产出 `doc.*.json` 同一套逻辑），
 * 不依赖 build 产物是否已生成——dev/Studio 预览与生产渲染一致。
 */
export async function getPublishedOpenApiDoc(
  lang: DocsLang,
  routeSlug: string,
  projectId: string = '',
  customPath?: string,
): Promise<OpenApiDocArtifact | null> {
  const source = await getPublishedApiSourceByRouteSlug(lang, routeSlug, projectId, customPath);
  if (!source) {
    return null;
  }

  const spec = await getPublishedApiSourceSpec(lang, source.id, projectId, customPath);
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
    return null;
  }

  const doc = buildDocArtifact(source, spec as Record<string, unknown>);
  // href 以当前实际路由（lang + routeSlug）为准，不依赖 source 配置里的 routeBase，
  // 保证导航链接与 URL 高亮永远对齐。
  return withRoutedHrefs(doc, lang, routeSlug);
}

function withRoutedHrefs(doc: OpenApiDocArtifact, lang: DocsLang, routeSlug: string): OpenApiDocArtifact {
  const base = `/${lang}/reference/${routeSlug}`;
  return {
    ...doc,
    href: base,
    operations: doc.operations.map((operation) => ({ ...operation, href: `${base}/${operation.id}` })),
    nav: doc.nav.map((group) => ({
      ...group,
      items: group.items.map((item) => ({ ...item, href: `${base}/${item.operationId}` })),
    })),
  };
}
