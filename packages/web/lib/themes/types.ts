import type { ReactNode } from 'react';
import type { ProjectSiteNavigation, ProjectSiteTheme } from '@anydocs/core';

import type { DocsLang, NavigationDoc, PageDoc } from '@/lib/docs/types';

export type DocsThemeReaderLayoutProps = {
  children: ReactNode;
  lang: DocsLang;
  availableLanguages: DocsLang[];
  nav: NavigationDoc;
  pages: PageDoc[];
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
  capabilities: {
    topNav: boolean;
    topNavGroupSwitching: boolean;
  };
};

export type DocsThemeDefinition = DocsThemeManifest & {
  ReaderLayout: (props: DocsThemeReaderLayoutProps) => ReactNode | Promise<ReactNode>;
};
