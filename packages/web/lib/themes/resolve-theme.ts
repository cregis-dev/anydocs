import { docsThemeRegistry } from '@/lib/themes/registry';
import type { DocsThemeDefinition } from '@/lib/themes/types';

export function resolveDocsTheme(themeId: string): DocsThemeDefinition {
  const theme = docsThemeRegistry[themeId];
  if (!theme) {
    throw new Error(
      `Unknown docs theme "${themeId}". Register it in packages/web/lib/themes/registry.ts before using it in anydocs.config.json.`,
    );
  }

  return theme;
}
