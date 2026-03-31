import type { DocsLang } from '@/lib/docs/types';

export type DocsUiCopy = {
  common: {
    docs: string;
    openNavigation: string;
    closeNavigation: string;
    projectLogoAlt: string;
    documentationNavigation: string;
    navigationDialogDescription: string;
    categoryFallback: string;
  };
  sidebar: {
    navigationLabel: string;
    homeLabel: string;
    searchPlaceholder: string;
    searchHint: string;
  };
  search: {
    loading: string;
    noResults: string;
    noResultsHint: string;
    browseHome: string;
  };
  toc: {
    title: string;
  };
  landing: {
    eyebrow: string;
    title: string;
    description: string;
    searchLabel: string;
    quickStartTitle: string;
    quickStartDescription: string;
    categoriesTitle: string;
    categoriesDescription: string;
    moreInSection: string;
    keepExploringTitle: string;
    keepExploringDescription: string;
    browseAll: string;
    openPage: string;
    emptySections: string;
    emptyRecommendations: string;
    fallbackPageLabel: string;
  };
};

const DOCS_UI_COPY: Record<DocsLang, DocsUiCopy> = {
  en: {
    common: {
      docs: 'Docs',
      openNavigation: 'Open navigation',
      closeNavigation: 'Close navigation',
      projectLogoAlt: 'Project logo',
      documentationNavigation: 'Documentation navigation',
      navigationDialogDescription: 'Browse documentation pages, search the docs, and switch languages.',
      categoryFallback: 'More topics',
    },
    sidebar: {
      navigationLabel: 'Documentation navigation',
      homeLabel: 'Docs Home',
      searchPlaceholder: 'Search pages, titles, or keywords…',
      searchHint: 'Search titles, descriptions, and page content.',
    },
    search: {
      loading: 'Searching docs...',
      noResults: 'No matching pages',
      noResultsHint: 'Try another keyword, or continue browsing from the sidebar.',
      browseHome: 'Browse docs home',
    },
    toc: {
      title: 'On this page',
    },
    landing: {
      eyebrow: 'Classic docs',
      title: 'Start exploring your documentation here',
      description:
        'Use the sidebar to navigate the full structure, or jump in from quick starts, featured sections, and next-step links.',
      searchLabel: 'Quick search',
      quickStartTitle: 'Quick start',
      quickStartDescription: 'Start with these pages to build context quickly.',
      categoriesTitle: 'Browse by section',
      categoriesDescription:
        'Keep the same sidebar-first information architecture while surfacing the most useful entry points on the landing page.',
      moreInSection: 'See more in this section',
      keepExploringTitle: 'Keep exploring',
      keepExploringDescription: 'If you are not sure where to go next, these are strong next stops.',
      browseAll: 'Browse all docs',
      openPage: 'Open page',
      emptySections: 'Use the sidebar to browse published pages.',
      emptyRecommendations: 'Continue with the sidebar after opening a page.',
      fallbackPageLabel: 'Featured page',
    },
  },
  zh: {
    common: {
      docs: '文档',
      openNavigation: '打开导航',
      closeNavigation: '关闭导航',
      projectLogoAlt: '项目标志',
      documentationNavigation: '文档导航',
      navigationDialogDescription: '浏览文档页面、搜索内容，并切换语言。',
      categoryFallback: '更多主题',
    },
    sidebar: {
      navigationLabel: '文档导航',
      homeLabel: '文档首页',
      searchPlaceholder: '搜索页面、标题或关键词…',
      searchHint: '可搜索标题、描述和页面内容。',
    },
    search: {
      loading: '正在搜索文档...',
      noResults: '没有匹配的页面',
      noResultsHint: '换一个关键词，或从左侧分组继续浏览。',
      browseHome: '浏览文档首页',
    },
    toc: {
      title: '本页内容',
    },
    landing: {
      eyebrow: '经典文档',
      title: '从这里开始浏览你的文档站',
      description: '使用左侧目录快速定位内容，或从这里进入新手引导、热门分类和下一步推荐。',
      searchLabel: '快速搜索',
      quickStartTitle: '快速开始',
      quickStartDescription: '先读这些页面，最快建立对站点内容的整体认识。',
      categoriesTitle: '按分类浏览',
      categoriesDescription: '保持与左侧目录一致的信息结构，但把最常用的入口前置到首页。',
      moreInSection: '查看本分类更多内容',
      keepExploringTitle: '继续探索',
      keepExploringDescription: '如果你还不确定下一步，从这些常见入口继续。',
      browseAll: '浏览全部文档',
      openPage: '打开页面',
      emptySections: '可以通过左侧目录浏览全部已发布页面。',
      emptyRecommendations: '先打开任意页面，再沿着侧边栏继续阅读。',
      fallbackPageLabel: '推荐页面',
    },
  },
};

export function getDocsUiCopy(lang: DocsLang): DocsUiCopy {
  return DOCS_UI_COPY[lang] ?? DOCS_UI_COPY.en;
}

export function inferDocsLangFromPathname(pathname: string | null | undefined): DocsLang {
  const firstSegment = pathname?.split('/').filter(Boolean)[0];
  if (firstSegment === 'zh' || firstSegment === 'en') {
    return firstSegment;
  }

  return 'en';
}
