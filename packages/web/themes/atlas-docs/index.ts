import type { DocsThemeDefinition } from '@/lib/themes/types';
import { atlasDocsThemeManifest } from '@/themes/atlas-docs/manifest';
import { AtlasDocsReaderLayout } from '@/themes/atlas-docs/reader-layout';

export const atlasDocsTheme: DocsThemeDefinition = {
  ...atlasDocsThemeManifest,
  ReaderLayout: AtlasDocsReaderLayout,
};
