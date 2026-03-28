import type { Metadata } from 'next';

import { getCliDocsRuntimeMode } from '@/lib/docs/data';

function withTrailingSlash(value: string): string {
  return value.endsWith('/') ? value : `${value}/`;
}

export function buildPublishedAbsoluteUrl(siteUrl: string | undefined, routePath: string): string | undefined {
  if (!siteUrl) {
    return undefined;
  }

  const normalizedRoutePath = routePath.replace(/^\/+/, '');
  const exportCompatiblePath =
    normalizedRoutePath.length === 0 || /\.[a-z0-9]+$/i.test(normalizedRoutePath) || normalizedRoutePath.endsWith('/')
      ? normalizedRoutePath
      : `${normalizedRoutePath}/`;
  return new URL(exportCompatiblePath, withTrailingSlash(siteUrl)).toString();
}

export function buildPreviewRobotsMetadata(): Metadata['robots'] | undefined {
  if (getCliDocsRuntimeMode() !== 'preview') {
    return undefined;
  }

  return {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  };
}

export function resolveDocsLocale(lang: string): string {
  switch (lang) {
    case 'zh':
      return 'zh-CN';
    default:
      return lang;
  }
}
