import type {
  ApiSourceDoc,
  DocsLang as CoreDocsLang,
  NavItem,
  NavigationDoc,
  PageRender,
  PageReview,
  PageStatus as CorePageStatus,
  PageDoc as CorePageDoc,
} from '@anydocs/core';
// Use the leaf-module subpath for the content-type import — keeps the
// Studio client bundle clear of the server-side services that the
// `@anydocs/core` barrel re-exports (the same discipline Story 7.2
// established for `editor-host`).
import type { DocContentV1 } from '@anydocs/core/content';

export type DocsLang = CoreDocsLang;
export type PageStatus = CorePageStatus;
// Story 7.3 cutover: `StudioPageDoc` widens from the legacy
// `YooptaContentValue` shape to canonical `DocContentV1`. The new
// `<EditorHost>` mounts the Plate-backed editor and emits DocContentV1
// directly; `fs.ts` lazily migrates any legacy on-disk Yoopta-shape
// content forward via `yooptaToDocContent` on read.
export type StudioPageDoc = CorePageDoc<DocContentV1>;
export type PublishedPageDoc = CorePageDoc<unknown>;
export type PublishedPageSummary = Pick<
  PublishedPageDoc,
  'id' | 'lang' | 'slug' | 'title' | 'description' | 'status' | 'template' | 'metadata'
>;
export type PageDoc = StudioPageDoc;
export const SUPPORTED_DOCS_LANGUAGES = ['zh', 'en'] as const satisfies readonly DocsLang[];
export type { ApiSourceDoc, NavItem, NavigationDoc, PageRender, PageReview };
