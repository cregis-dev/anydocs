import type { DocsThemeDefinition } from '@/lib/themes/types';
import { atlasDocsTheme } from '@/themes/atlas-docs';
import { classicDocsTheme } from '@/themes/classic-docs';
import { paperDocsTheme } from '@/themes/paper-docs';

export const docsThemeRegistry: Record<string, DocsThemeDefinition> = {
  [atlasDocsTheme.id]: atlasDocsTheme,
  [classicDocsTheme.id]: classicDocsTheme,
  [paperDocsTheme.id]: paperDocsTheme,
};

export const docsThemes = Object.values(docsThemeRegistry);
