export const DOCS_LANGUAGES = ['zh', 'en'] as const;

export type DocsLang = (typeof DOCS_LANGUAGES)[number];

export const PAGE_STATUSES = ['draft', 'in_review', 'published'] as const;

export type PageStatus = (typeof PAGE_STATUSES)[number];

export type PageRender = {
  markdown?: string;
  plainText?: string;
};

export type PageReviewWarning = {
  code: string;
  message: string;
  remediation?: string;
  metadata?: Record<string, unknown>;
};

export type PageReviewSourceType = 'legacy-import' | 'ai-generated';

export type PageReview = {
  required: boolean;
  sourceType: PageReviewSourceType;
  sourceId: string;
  itemId?: string;
  sourcePath?: string;
  approvedAt?: string;
  metadata?: Record<string, unknown>;
  warnings?: PageReviewWarning[];
};

export type PageDoc<TContent = unknown> = {
  id: string;
  lang: DocsLang;
  slug: string;
  title: string;
  description?: string;
  template?: string;
  metadata?: Record<string, unknown>;
  tags?: string[];
  status: PageStatus;
  updatedAt?: string;
  content: TContent;
  render?: PageRender;
  review?: PageReview;
};

export type NavItem =
  | {
      type: 'section';
      id?: string;
      title: string;
      children: NavItem[];
    }
  | {
      type: 'folder';
      id?: string;
      title: string;
      children: NavItem[];
    }
  | {
      type: 'page';
      pageId: string;
      titleOverride?: string;
      hidden?: boolean;
    }
  | {
      type: 'link';
      title: string;
      href: string;
    };

export type NavigationDoc = {
  version: number;
  items: NavItem[];
};

export function isDocsLang(value: unknown): value is DocsLang {
  return typeof value === 'string' && DOCS_LANGUAGES.includes(value as DocsLang);
}

export function isPageStatus(value: unknown): value is PageStatus {
  return typeof value === 'string' && PAGE_STATUSES.includes(value as PageStatus);
}
