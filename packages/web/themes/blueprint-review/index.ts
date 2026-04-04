import type { DocsThemeDefinition } from '@/lib/themes/types';
import { blueprintReviewThemeManifest } from '@/themes/blueprint-review/manifest';
import { BlueprintReviewReaderLayout } from '@/themes/blueprint-review/reader-layout';

export const blueprintReviewTheme: DocsThemeDefinition = {
  ...blueprintReviewThemeManifest,
  ReaderLayout: BlueprintReviewReaderLayout,
};

