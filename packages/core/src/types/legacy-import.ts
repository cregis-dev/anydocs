import type { DocsLanguage } from './project.ts';

export type LegacyImportFormat = 'markdown' | 'mdx';
export type LegacyImportStatus = 'staged' | 'converted';

export type LegacyImportFrontmatterValue = string | string[];

export type LegacyImportWarning = {
  itemId?: string;
  code: string;
  message: string;
  remediation?: string;
  metadata?: Record<string, unknown>;
};

export type LegacyImportItem = {
  id: string;
  sourcePath: string;
  lang: DocsLanguage;
  slug: string;
  title: string;
  description?: string;
  tags?: string[];
  format: LegacyImportFormat;
  importedAt: string;
  rawContent: string;
  body: string;
  frontmatter: Record<string, LegacyImportFrontmatterValue>;
  status: LegacyImportStatus;
  convertedAt?: string;
};

export type LegacyImportManifestItem = Pick<
  LegacyImportItem,
  'id' | 'sourcePath' | 'lang' | 'slug' | 'title' | 'format' | 'status'
>;

export type LegacyImportManifest = {
  version: 1;
  importId: string;
  projectId: string;
  sourceRoot: string;
  importedAt: string;
  itemCount: number;
  status: LegacyImportStatus;
  items: LegacyImportManifestItem[];
};

export type LegacyImportResult = {
  importId: string;
  importRoot: string;
  manifestFile: string;
  itemCount: number;
  items: LegacyImportManifestItem[];
};

export type LegacyImportConversionItem = {
  itemId: string;
  pageId: string;
  lang: DocsLanguage;
  slug: string;
  status: 'draft';
  warnings: LegacyImportWarning[];
};

export type LegacyImportConversionReport = {
  version: 1;
  importId: string;
  projectId: string;
  convertedAt: string;
  status: 'converted';
  convertedCount: number;
  items: LegacyImportConversionItem[];
  warnings: LegacyImportWarning[];
};

export type LegacyImportConversionResult = {
  importId: string;
  importRoot: string;
  reportFile: string;
  convertedCount: number;
  items: LegacyImportConversionItem[];
  warnings: LegacyImportWarning[];
};
