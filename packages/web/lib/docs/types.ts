import type { YooptaContentValue } from '@yoopta/editor';
import type {
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
export type PageDoc = CorePageDoc<YooptaContentValue>;
export const SUPPORTED_DOCS_LANGUAGES = ['zh', 'en'] as const satisfies readonly DocsLang[];
export type { NavItem, NavigationDoc, PageRender, PageReview };
