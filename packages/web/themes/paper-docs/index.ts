import type { DocsThemeDefinition } from '@/lib/themes/types';
import { paperDocsThemeManifest } from '@/themes/paper-docs/manifest';
import { PaperDocsReaderLayout } from '@/themes/paper-docs/reader-layout';

export const paperDocsTheme: DocsThemeDefinition = {
  ...paperDocsThemeManifest,
  ReaderLayout: PaperDocsReaderLayout,
};
