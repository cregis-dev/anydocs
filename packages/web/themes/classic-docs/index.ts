import type { DocsThemeDefinition } from '@/lib/themes/types';
import { classicDocsThemeManifest } from '@/themes/classic-docs/manifest';
import { ClassicDocsReaderLayout } from '@/themes/classic-docs/reader-layout';

export const classicDocsTheme: DocsThemeDefinition = {
  ...classicDocsThemeManifest,
  ReaderLayout: ClassicDocsReaderLayout,
};
