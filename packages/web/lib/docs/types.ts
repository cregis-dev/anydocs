import type { YooptaContentValue } from '@yoopta/editor';
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

export type DocsLang = CoreDocsLang;
export type PageStatus = CorePageStatus;
export type StudioPageDoc = CorePageDoc<YooptaContentValue>;
export type PublishedPageDoc = CorePageDoc<unknown>;
export type PageDoc = StudioPageDoc;
export const SUPPORTED_DOCS_LANGUAGES = ['zh', 'en'] as const satisfies readonly DocsLang[];
export type { ApiSourceDoc, NavItem, NavigationDoc, PageRender, PageReview };
