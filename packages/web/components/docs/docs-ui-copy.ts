import type { DocsLang } from "../../lib/docs/types.ts";

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
    dialogTitle: string;
    dialogDescription: string;
    startTyping: string;
    pagesLabel: string;
    sectionsLabel: string;
    contentLabel: string;
    navigate: string;
    select: string;
    close: string;
    bestMatch: string;
    resultsLabel: string;
    loading: string;
    noResults: string;
    noResultsHint: string;
    browseHome: string;
  };
  toc: {
    title: string;
  };
  blueprint: {
    showToc: string;
    hideToc: string;
    contextTitle: string;
    reviewTitle: string;
    decisionsTitle: string;
    sectionLabel: string;
    pathLabel: string;
    tagsLabel: string;
    warningsLabel: string;
    typeLabel: string;
    statusLabel: string;
    reviewStateLabel: string;
    createdByLabel: string;
    reviewerLabel: string;
    dueLabel: string;
    updatedLabel: string;
    statusDraft: string;
    statusInReview: string;
    statusPublished: string;
    reviewStateDraft: string;
    reviewStateInReview: string;
    reviewStateApproved: string;
    reviewStateBlocked: string;
    docTypePrd: string;
    docTypeTechSpec: string;
    docTypeReviewNote: string;
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
      docs: "Docs",
      openNavigation: "Open navigation",
      closeNavigation: "Close navigation",
      projectLogoAlt: "Project logo",
      documentationNavigation: "Documentation navigation",
      navigationDialogDescription:
        "Browse documentation pages, search the docs, and switch languages.",
      categoryFallback: "More topics",
    },
    sidebar: {
      navigationLabel: "Documentation navigation",
      homeLabel: "Docs Home",
      searchPlaceholder: "Find pages, sections, or keywords…",
      searchHint: "Search page titles, section headings, and page content.",
    },
    search: {
      dialogTitle: "Search docs",
      dialogDescription:
        "Search page titles, section headings, and page content.",
      startTyping: "Start typing to search pages, sections, or keywords.",
      pagesLabel: "Pages",
      sectionsLabel: "Sections",
      contentLabel: "Content",
      navigate: "Navigate",
      select: "Open result",
      close: "Close search",
      bestMatch: "Best match",
      resultsLabel: "results",
      loading: "Searching docs...",
      noResults: "No matching pages or sections",
      noResultsHint: "Try another keyword, or keep browsing from the sidebar.",
      browseHome: "Browse docs home",
    },
    toc: {
      title: "On this page",
    },
    blueprint: {
      showToc: "Show outline",
      hideToc: "Hide outline",
      contextTitle: "Doc Context",
      reviewTitle: "Review Status",
      decisionsTitle: "Decision Summary",
      sectionLabel: "Section",
      pathLabel: "Path",
      tagsLabel: "Tags",
      warningsLabel: "Warnings",
      typeLabel: "Type",
      statusLabel: "Status",
      reviewStateLabel: "Review state",
      createdByLabel: "Created by",
      reviewerLabel: "Reviewer",
      dueLabel: "Due",
      updatedLabel: "Updated",
      statusDraft: "Draft",
      statusInReview: "In Review",
      statusPublished: "Published",
      reviewStateDraft: "Draft",
      reviewStateInReview: "In Review",
      reviewStateApproved: "Approved",
      reviewStateBlocked: "Blocked",
      docTypePrd: "PRD",
      docTypeTechSpec: "Tech Spec",
      docTypeReviewNote: "Review Note",
    },
    landing: {
      eyebrow: "Classic docs",
      title: "Start with the pages that define the structure",
      description:
        "Use the sidebar for the full table of contents, or begin here with the key sections and a short reading path.",
      searchLabel: "Quick search",
      quickStartTitle: "Start reading",
      quickStartDescription:
        "These pages give you the fastest path into the documentation.",
      categoriesTitle: "Browse by section",
      categoriesDescription:
        "The landing page surfaces a few useful entry points while keeping the same section structure as the sidebar.",
      moreInSection: "See more in this section",
      keepExploringTitle: "Continue with",
      keepExploringDescription:
        "After the first pages, these are the next documents worth opening.",
      browseAll: "Open the full docs",
      openPage: "Open page",
      emptySections: "Use the sidebar to browse published pages.",
      emptyRecommendations: "Continue with the sidebar after opening a page.",
      fallbackPageLabel: "Featured page",
    },
  },
  zh: {
    common: {
      docs: "文档",
      openNavigation: "打开导航",
      closeNavigation: "关闭导航",
      projectLogoAlt: "项目标志",
      documentationNavigation: "文档导航",
      navigationDialogDescription: "浏览文档页面、搜索内容，并切换语言。",
      categoryFallback: "更多主题",
    },
    sidebar: {
      navigationLabel: "文档导航",
      homeLabel: "文档首页",
      searchPlaceholder: "查找页面、章节或关键词…",
      searchHint: "可搜索页面标题、章节标题和正文内容。",
    },
    search: {
      dialogTitle: "搜索文档",
      dialogDescription: "搜索页面标题、章节标题和正文内容。",
      startTyping: "输入关键词，搜索页面、章节或正文内容。",
      pagesLabel: "页面",
      sectionsLabel: "章节",
      contentLabel: "正文",
      navigate: "切换结果",
      select: "打开结果",
      close: "关闭搜索",
      bestMatch: "最佳匹配",
      resultsLabel: "条结果",
      loading: "正在搜索文档...",
      noResults: "没有匹配的页面或章节",
      noResultsHint: "换一个关键词，或继续从左侧导航浏览。",
      browseHome: "浏览文档首页",
    },
    toc: {
      title: "本页内容",
    },
    blueprint: {
      showToc: "显示目录",
      hideToc: "收起目录",
      contextTitle: "文档上下文",
      reviewTitle: "评审状态",
      decisionsTitle: "决策摘要",
      sectionLabel: "所属章节",
      pathLabel: "阅读路径",
      tagsLabel: "标签",
      warningsLabel: "风险提示",
      typeLabel: "类型",
      statusLabel: "状态",
      reviewStateLabel: "评审状态",
      createdByLabel: "创建人",
      reviewerLabel: "审核人",
      dueLabel: "截止日期",
      updatedLabel: "更新时间",
      statusDraft: "草稿",
      statusInReview: "审核中",
      statusPublished: "已发布",
      reviewStateDraft: "草稿",
      reviewStateInReview: "评审中",
      reviewStateApproved: "已通过",
      reviewStateBlocked: "已阻塞",
      docTypePrd: "PRD",
      docTypeTechSpec: "技术方案",
      docTypeReviewNote: "评审记录",
    },
    landing: {
      eyebrow: "经典文档",
      title: "先从定义结构的页面开始阅读",
      description:
        "左侧目录保留完整的信息结构，这里只前置最值得先读的页面和主要分类入口。",
      searchLabel: "快速搜索",
      quickStartTitle: "开始阅读",
      quickStartDescription: "先读这些页面，能最快建立对整套文档的认识。",
      categoriesTitle: "按分类浏览",
      categoriesDescription:
        "首页只提取少量常用入口，完整目录仍然保持在左侧导航里。",
      moreInSection: "查看本分类更多内容",
      keepExploringTitle: "继续阅读",
      keepExploringDescription: "看完起始页之后，可以从这些文档继续往下读。",
      browseAll: "打开完整文档",
      openPage: "打开页面",
      emptySections: "可以通过左侧目录浏览全部已发布页面。",
      emptyRecommendations: "先打开任意页面，再沿着侧边栏继续阅读。",
      fallbackPageLabel: "推荐页面",
    },
  },
};

export function getDocsUiCopy(lang: DocsLang): DocsUiCopy {
  return DOCS_UI_COPY[lang] ?? DOCS_UI_COPY.en;
}

export function inferDocsLangFromPathname(
  pathname: string | null | undefined,
): DocsLang {
  const firstSegment = pathname?.split("/").filter(Boolean)[0];
  if (firstSegment === "zh" || firstSegment === "en") {
    return firstSegment;
  }

  return "en";
}
