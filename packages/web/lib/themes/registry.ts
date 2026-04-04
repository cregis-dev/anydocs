import type { DocsThemeDefinition } from '@/lib/themes/types';
import { atlasDocsTheme } from '@/themes/atlas-docs';
import { blueprintReviewTheme } from '@/themes/blueprint-review';
import { classicDocsTheme } from '@/themes/classic-docs';

export const docsThemeRegistry: Record<string, DocsThemeDefinition> = {
  [atlasDocsTheme.id]: atlasDocsTheme,
  [blueprintReviewTheme.id]: blueprintReviewTheme,
  [classicDocsTheme.id]: classicDocsTheme,
};

export const docsThemes = Object.values(docsThemeRegistry);
