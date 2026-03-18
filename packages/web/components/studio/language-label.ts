import type { DocsLang } from '@/lib/docs/types';

export function formatLanguageLabel(language: DocsLang): string {
  switch (language) {
    case 'zh':
      return '中文';
    case 'en':
      return 'EN';
    default:
      return String(language).toUpperCase();
  }
}
