import type { ReactNode } from 'react';
import type { ProjectSiteNavigation, ProjectSiteTheme, ProjectThemeCapabilities } from '@anydocs/core';

import type { DocsLang, NavigationDoc, PublishedPageDoc } from '@/lib/docs/types';

export type DocsThemeReaderLayoutProps = {
  children: ReactNode;
  lang: DocsLang;
  availableLanguages: DocsLang[];
  nav: NavigationDoc;
  pages: PublishedPageDoc[];
  searchFindHref?: string;
  searchIndexHref?: string;
  projectName?: string;
  siteTheme: ProjectSiteTheme;
  siteNavigation?: ProjectSiteNavigation;
};

export type DocsThemeManifest = {
  id: string;
  label: string;
  className: string;
  description: string;
  tone: string;
  recommendedFor: string;
  capabilities: ProjectThemeCapabilities;
};

export type DocsThemeDefinition = DocsThemeManifest & {
  ReaderLayout: (props: DocsThemeReaderLayoutProps) => ReactNode | Promise<ReactNode>;
};
