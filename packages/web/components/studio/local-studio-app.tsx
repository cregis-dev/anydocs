'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FileText,
  Globe,
  Loader2,
  Plus,
  SidebarClose,
  SidebarOpen,
  Eye,
  Circle,
  Save,
  WifiOff,
  X,
  Link2,
  Settings,
  ChevronDown,
  Box,
  Sparkles,
} from 'lucide-react';
import type { ProjectSiteTopNavItem } from '@anydocs/core';

import type { ApiSourceDoc, DocsLang, NavItem, NavigationDoc, PageDoc } from '@/lib/docs/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LocalStudioSettings } from '@/components/studio/local-studio-settings';
import { NavigationItemDialog, type NavigationItemDialogValues } from '@/components/studio/navigation-item-dialog';
import { YooptaDocEditor } from '@/components/studio/yoopta-doc-editor';
import { NavigationComposer } from '@/components/studio/navigation-composer';
import { formatLanguageLabel } from '@/components/studio/language-label';
import {
  type StudioProject,
  hasNativeDirectoryPicker,
  loadProjectsFromStorage,
  normalizeAbsoluteProjectPath,
  pickNativeProjectPath,
  removeRecentProject,
  registerRecentProject,
  saveProjectsToStorage,
} from '@/components/studio/project-registry';
import {
  createLockedStudioProject,
  type StudioBootContext,
} from '@/components/studio/studio-boot';
import { WelcomeScreen } from '@/components/studio/welcome-screen';
import {
  type DeletePageResponse,
  type StudioBuildResponse,
  type StudioHost,
  type StudioPreviewResponse,
  type StudioProjectResponse,
  type StudioProjectSettingsPatch,
} from '@/components/studio/backend';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { docsThemeRegistry } from '@/lib/themes/registry';
import {
  filterNavigationToGroup,
  findFirstPageIdInGroup,
  pageBelongsToGroup,
  resolveTopNavLabel,
} from '@/lib/themes/atlas-nav';
import { cn } from '@/lib/utils';

type LoadState = { nav: NavigationDoc | null; pages: PageDoc[]; loading: boolean; error: string | null };
type ProjectState = {
  name: string;
  projectRoot: string;
  languages: DocsLang[];
  defaultLanguage: DocsLang;
  themeId: string;
  siteTitle: string;
  homeLabel: string;
  logoSrc: string;
  logoAlt: string;
  showSearch: boolean;
  primaryColor: string;
  primaryForegroundColor: string;
  accentColor: string;
  accentForegroundColor: string;
  sidebarActiveColor: string;
  sidebarActiveForegroundColor: string;
  codeTheme: 'github-light' | 'github-dark';
  topNavItems: ProjectSiteTopNavItem[];
  apiSources: ApiSourceDoc[];
  outputDir: string;
} | null;

type RightSidebarMode = 'page' | 'project' | null;
type WorkflowAction = 'preview' | 'build';
type SidebarCreateDialog = { type: 'page' | 'group' | 'link' } | null;
const STUDIO_BOOTSTRAP_RETRY_DELAYS_MS = [250, 500, 1_000, 1_500, 2_500, 4_000] as const;

function collectNavPageRefs(items: NavItem[], out: { pageId: string; hidden: boolean }[]) {
  for (const item of items) {
    if (item.type === 'page') {
      out.push({ pageId: item.pageId, hidden: !!item.hidden });
      continue;
    }
    if (item.type === 'link') continue;
    collectNavPageRefs(item.children, out);
  }
}

function validateStudioNavAndPages(nav: NavigationDoc | null, pages: PageDoc[]) {
  const errors: string[] = [];
  const warnings: string[] = [];

  const bySlug = new Map<string, string[]>();
  for (const p of pages) {
    const ids = bySlug.get(p.slug) ?? [];
    ids.push(p.id);
    bySlug.set(p.slug, ids);
  }
  for (const [slug, ids] of bySlug.entries()) {
    const uniq = [...new Set(ids)];
    if (uniq.length > 1) warnings.push(`重复 slug：${slug}（${uniq.join(', ')}）`);
  }

  if (nav) {
    const refs: { pageId: string; hidden: boolean }[] = [];
    collectNavPageRefs(nav.items, refs);
    const allIds = new Set(pages.map((p) => p.id));
    const missing = [...new Set(refs.map((r) => r.pageId))].filter((id) => !allIds.has(id));
    for (const id of missing) errors.push(`导航引用缺失 pageId：${id}`);

    const hiddenPublished = refs.filter((r) => r.hidden).map((r) => r.pageId);
    if (hiddenPublished.length) warnings.push(`隐藏节点不会出现在阅读站导航：${[...new Set(hiddenPublished)].join(', ')}`);
  }

  return { errors, warnings };
}

function clearReviewApproval(page: PageDoc | null): PageDoc | null {
  if (!page?.review?.required || !page.review.approvedAt) {
    return page;
  }

  return {
    ...page,
    review: {
      ...page.review,
      approvedAt: undefined,
    },
  };
}

function applyPagePatch(page: PageDoc | null, patch: Partial<PageDoc>, invalidateApproval: boolean): PageDoc | null {
  if (!page) {
    return page;
  }

  const next = {
    ...page,
    ...patch,
  };

  return invalidateApproval ? clearReviewApproval(next) : next;
}

function upsertPageInList(pages: PageDoc[], nextPage: PageDoc) {
  const index = pages.findIndex((page) => page.id === nextPage.id);
  if (index === -1) {
    return [...pages, nextPage];
  }

  const nextPages = [...pages];
  nextPages[index] = nextPage;
  return nextPages;
}

function sortPagesBySlug(pages: PageDoc[]) {
  return [...pages].sort((left, right) => left.slug.localeCompare(right.slug));
}

function normalizeProjectApiSources(
  apiSources: ApiSourceDoc[],
  languages: DocsLang[],
  defaultLanguage: DocsLang,
): ApiSourceDoc[] {
  return apiSources.map((source) =>
    languages.includes(source.lang)
      ? source
      : {
          ...source,
          lang: defaultLanguage,
        },
  );
}

function applyProjectPatch(
  current: Exclude<ProjectState, null>,
  patch: Partial<Exclude<ProjectState, null>>,
): Exclude<ProjectState, null> {
  const nextLanguages = patch.languages ?? current.languages;
  const nextDefaultLanguage =
    patch.defaultLanguage ??
    (nextLanguages.includes(current.defaultLanguage) ? current.defaultLanguage : nextLanguages[0] ?? current.defaultLanguage);

  return {
    ...current,
    ...patch,
    languages: nextLanguages,
    defaultLanguage: nextDefaultLanguage,
    apiSources: normalizeProjectApiSources(patch.apiSources ?? current.apiSources, nextLanguages, nextDefaultLanguage),
  };
}

function sanitizeApiSourcesForSave(apiSources: ApiSourceDoc[]): ApiSourceDoc[] {
  return apiSources.map((source) => {
    const routeBase = source.runtime?.routeBase?.trim();

    return {
      ...source,
      id: source.id.trim(),
      display: {
        ...source.display,
        title: source.display.title.trim(),
      },
      source:
        source.source.kind === 'url'
          ? {
              kind: 'url',
              url: source.source.url.trim(),
            }
          : {
              kind: 'file',
              path: source.source.path.trim(),
            },
      ...(routeBase || source.runtime?.tryIt
        ? {
            runtime: {
              ...(routeBase ? { routeBase } : {}),
              ...(source.runtime?.tryIt ? { tryIt: source.runtime.tryIt } : {}),
            },
          }
        : {}),
    };
  });
}

function slugifyGroupId(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/-{2,}/g, '-') || `group-${Date.now().toString(36)}`
  );
}

function isTransientStudioBootstrapError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  return (
    /Request failed:\s*404\s+Not Found/i.test(message) ||
    /received HTML instead/i.test(message)
  );
}

function removePageRefsFromNav(items: NavItem[], pageId: string): { items: NavItem[]; removed: number } {
  let removed = 0;
  const nextItems: NavItem[] = [];

  for (const item of items) {
    if (item.type === 'page') {
      if (item.pageId === pageId) {
        removed += 1;
        continue;
      }

      nextItems.push(item);
      continue;
    }

    if (item.type === 'section' || item.type === 'folder') {
      const cleaned = removePageRefsFromNav(item.children, pageId);
      removed += cleaned.removed;
      nextItems.push({ ...item, children: cleaned.items });
      continue;
    }

    nextItems.push(item);
  }

  return { items: nextItems, removed };
}

function replaceNavigationGroupChildren(nav: NavigationDoc, groupId: string, children: NavItem[]): NavigationDoc {
  return {
    ...nav,
    items: nav.items.map((item) =>
      (item.type === 'section' || item.type === 'folder') && item.id === groupId ? { ...item, children } : item,
    ),
  };
}

type LocalStudioAppProps = {
  bootContext: StudioBootContext;
  host: StudioHost;
};

export function LocalStudioApp({ bootContext, host }: LocalStudioAppProps) {
  const studioHost = host;
  const lockedProject = useMemo(() => createLockedStudioProject(bootContext), [bootContext]);
  const isProjectLocked = bootContext.mode === 'cli-single-project';
  const [projectId, setProjectId] = useState<string>(lockedProject?.id ?? '');
  const [lang, setLang] = useState<DocsLang | null>(null);
  const [load, setLoad] = useState<LoadState>({ nav: null, pages: [], loading: true, error: null });
  const [navDraft, setNavDraft] = useState<NavigationDoc | null>(null);
  const [navDirty, setNavDirty] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [active, setActive] = useState<PageDoc | null>(null);
  const [activeLoading, setActiveLoading] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [dirtyTick, setDirtyTick] = useState(0);
  const [saving, setSaving] = useState(false);
  const [savingNav, setSavingNav] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [navSaveError, setNavSaveError] = useState<string | null>(null);
  const [filter] = useState('');
  const [projectState, setProjectState] = useState<ProjectState>(null);
  const [projectDirty, setProjectDirty] = useState(false);
  const [projectDirtyTick, setProjectDirtyTick] = useState(0);
  const [projectSaving, setProjectSaving] = useState(false);
  const [projectSaveError, setProjectSaveError] = useState<string | null>(null);
  const [workflowBusy, setWorkflowBusy] = useState<'build' | 'preview' | null>(null);
  const [workflowMessage, setWorkflowMessage] = useState<string | null>(null);
  const [workflowError, setWorkflowError] = useState<string | null>(null);
  const [navDirtyTick, setNavDirtyTick] = useState(0);
  const [selectedTopNavGroupId, setSelectedTopNavGroupId] = useState<string | null>(null);
  
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(true);
  const [rightSidebarMode, setRightSidebarMode] = useState<RightSidebarMode>(null);
  const [workflowAction, setWorkflowAction] = useState<WorkflowAction>('preview');
  const [workflowMenuOpen, setWorkflowMenuOpen] = useState(false);
  
  // Dropdown states
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const [sidebarCreateDialog, setSidebarCreateDialog] = useState<SidebarCreateDialog>(null);
  
  // Folder opening state
  const [isOpeningFolder, setIsOpeningFolder] = useState(false);
  const [recentProjects, setRecentProjects] = useState<StudioProject[]>(lockedProject ? [lockedProject] : []);
  
  // Load recent projects and check URL params on mount
  useEffect(() => {
    if (lockedProject) {
      setRecentProjects([lockedProject]);
      setProjectId(lockedProject.id);
      return;
    }

    const projects = loadProjectsFromStorage();
    setRecentProjects(projects);
    
    // Check URL params for project ID
    const params = new URLSearchParams(window.location.search);
    const projectIdParam = params.get('p');
    if (projectIdParam) {
      const project = projects.find(p => p.id === projectIdParam);
      if (project) {
        setProjectId(project.id);
      }
    }
  }, [lockedProject]);
  
  // Connection status (simulated as always connected for local)
  const isConnected = !load.error && !load.loading;
  const lastSavedTime = saving ? 'Saving...' : (dirty ? 'Unsaved changes' : (saveError ? 'Save failed' : 'All changes saved'));
  const projectSaveStatus = projectSaving ? 'Saving project...' : projectDirty ? 'Unsaved project settings' : projectSaveError ? 'Project save failed' : null;
  const selectedProject = useMemo(
    () => recentProjects.find((project) => project.id === projectId) ?? null,
    [projectId, recentProjects],
  );
  const navDirtyRef = useRef(false);
  navDirtyRef.current = navDirty;
  const navDraftRef = useRef<NavigationDoc | null>(null);
  navDraftRef.current = navDraft;
  const savingNavRef = useRef(false);
  savingNavRef.current = savingNav;
  const navDirtyTickRef = useRef(0);
  navDirtyTickRef.current = navDirtyTick;
  const workflowMenuRef = useRef<HTMLDivElement | null>(null);
  const previewWindowRef = useRef<Window | null>(null);

  useEffect(() => {
    if (!workflowMenuOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) {
        return;
      }
      if (workflowMenuRef.current?.contains(target)) {
        return;
      }
      setWorkflowMenuOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setWorkflowMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [workflowMenuOpen]);

  const handleOpenFolder = useCallback(async (projectPathOverride?: string) => {
    if (!bootContext.canOpenExternalProject) {
      return;
    }

    setIsOpeningFolder(true);
    try {
      const projectPath = projectPathOverride
        ? normalizeAbsoluteProjectPath(projectPathOverride)
        : await pickNativeProjectPath();
      if (!projectPath) {
        return;
      }

      const { current, projects } = registerRecentProject(recentProjects, projectPath);
      if (bootContext.canManageRecentProjects) {
        saveProjectsToStorage(projects);
      }
      setRecentProjects(projects);
      setProjectId(current.id);
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        alert(e instanceof Error ? e.message : 'Failed to open folder');
      }
    } finally {
      setIsOpeningFolder(false);
    }
  }, [bootContext.canManageRecentProjects, bootContext.canOpenExternalProject, recentProjects]);

  const handleProjectSelect = useCallback((project: StudioProject) => {
    if (!bootContext.canSwitchProjects) {
      return;
    }

    const updated = recentProjects.map(p => 
      p.id === project.id 
        ? { ...p, lastOpened: Date.now() }
        : p
    ).sort((a, b) => b.lastOpened - a.lastOpened);
    if (bootContext.canManageRecentProjects) {
      saveProjectsToStorage(updated);
    }
    setRecentProjects(updated);
    setProjectId(project.id);
  }, [bootContext.canManageRecentProjects, bootContext.canSwitchProjects, recentProjects]);

  const handleRecentProjectRemove = useCallback((project: StudioProject) => {
    if (!bootContext.canManageRecentProjects) {
      return;
    }

    const nextProjects = removeRecentProject(recentProjects, project.id);
    saveProjectsToStorage(nextProjects);
    setRecentProjects(nextProjects);
  }, [bootContext.canManageRecentProjects, recentProjects]);

  const activeIdRef = useRef<string | null>(null);
  activeIdRef.current = activeId;

  const reload = useCallback(async () => {
    if (!projectId) {
      setLoad({ nav: null, pages: [], loading: false, error: null });
      setNavDraft(null);
      setProjectState(null);
      setWorkflowMessage(null);
      setWorkflowError(null);
      setRightSidebarMode(null);
      return;
    }
    if (!selectedProject?.path) {
      setProjectState(null);
      setRightSidebarMode(null);
      setLoad({ nav: null, pages: [], loading: false, error: '请重新打开外部项目根目录。' });
      return;
    }
    setLoad((s) => ({ ...s, loading: true, error: null }));
    try {
      let project;
      let pages;
      let nav;
      let apiSources;

      for (let attempt = 0; ; attempt += 1) {
        try {
          project = await studioHost.getProject(projectId, selectedProject.path);
          const nextLang = lang && project.config.languages.includes(lang)
            ? lang
            : project.config.defaultLanguage;
          [nav, pages, apiSources] = await Promise.all([
            studioHost.getNavigation(nextLang, projectId, selectedProject.path),
            studioHost.getPages(nextLang, projectId, selectedProject.path),
            studioHost.getApiSources(projectId, selectedProject.path),
          ]);

          if (lang !== nextLang) {
            setLang(nextLang);
          }

          break;
        } catch (error) {
          if (attempt >= STUDIO_BOOTSTRAP_RETRY_DELAYS_MS.length || !isTransientStudioBootstrapError(error)) {
            throw error;
          }

          await new Promise((resolve) => setTimeout(resolve, STUDIO_BOOTSTRAP_RETRY_DELAYS_MS[attempt]));
        }
      }

      const nextLang = lang && project.config.languages.includes(lang)
        ? lang
        : project.config.defaultLanguage;
      setProjectState({
        name: project.config.name,
        projectRoot: project.paths.projectRoot,
        languages: project.config.languages,
        defaultLanguage: project.config.defaultLanguage,
        themeId: project.config.site.theme.id,
        siteTitle: project.config.site.theme.branding?.siteTitle ?? '',
        homeLabel: project.config.site.theme.branding?.homeLabel ?? '',
        logoSrc: project.config.site.theme.branding?.logoSrc ?? '',
        logoAlt: project.config.site.theme.branding?.logoAlt ?? '',
        showSearch: project.config.site.theme.chrome?.showSearch ?? true,
        primaryColor: project.config.site.theme.colors?.primary ?? '',
        primaryForegroundColor: project.config.site.theme.colors?.primaryForeground ?? '',
        accentColor: project.config.site.theme.colors?.accent ?? '',
        accentForegroundColor: project.config.site.theme.colors?.accentForeground ?? '',
        sidebarActiveColor: project.config.site.theme.colors?.sidebarActive ?? '',
        sidebarActiveForegroundColor: project.config.site.theme.colors?.sidebarActiveForeground ?? '',
        codeTheme: project.config.site.theme.codeTheme ?? 'github-dark',
        topNavItems: project.config.site.navigation?.topNav ?? [],
        apiSources: apiSources.sources,
        outputDir: project.config.build?.outputDir ?? '',
      });
      const preserveDraftNavigation = navDirtyRef.current || savingNavRef.current;
      setLoad({
        nav: preserveDraftNavigation ? navDraftRef.current ?? nav : nav,
        pages: pages.pages,
        loading: false,
        error: null,
      });
      if (!preserveDraftNavigation) {
        setNavDraft(nav);
        setNavDirty(false);
      }
      setProjectDirty(false);
      setProjectSaveError(null);
      // Only reset activeId if it's not valid for the new project
      const currentActiveId = activeIdRef.current;
      if (!currentActiveId || !pages.pages.find((p) => p.id === currentActiveId)) {
        const first = pages.pages[0]?.id ?? null;
        setActiveId(first);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '加载失败';
      setProjectState(null);
      setRightSidebarMode(null);
      setLoad({ nav: null, pages: [], loading: false, error: msg });
    }
  }, [lang, projectId, selectedProject, studioHost]);

  // When projectId changes, reset activeId
  useEffect(() => {
    setActiveId(null);
    setRightSidebarMode(null);
  }, [projectId]);

  useEffect(() => {
    if (isProjectLocked) {
      return;
    }

    const url = new URL(window.location.href);
    if (projectId) {
      url.searchParams.set('p', projectId);
    } else {
      url.searchParams.delete('p');
    }
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  }, [isProjectLocked, projectId]);

  // When lang changes, reset activeId to force reload with new language
  useEffect(() => {
    setActiveId(null);
    setRightSidebarMode((current) => (current === 'page' ? null : current));
  }, [lang]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!activeId) {
      setActive(null);
      setActiveLoading(false);
      setRightSidebarMode((current) => (current === 'page' ? null : current));
      return;
    }
    if (!lang) {
      setActive(null);
      setActiveLoading(false);
      return;
    }
    let cancelled = false;
    setActiveLoading(true);
    if (!selectedProject?.path) {
      setActive(null);
      setActiveLoading(false);
      return;
    }
    studioHost.getPage(lang, activeId, projectId, selectedProject.path)
      .then((p) => {
        if (cancelled) return;
        setActive(p);
        setActiveLoading(false);
        setDirty(false);
      })
      .catch(() => {
        if (cancelled) return;
        setActive(null);
        setActiveLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [lang, activeId, projectId, selectedProject, studioHost]);

  const title = active?.title ?? '未选择文档';
  const status = active?.status ?? 'draft';

  const filteredPages = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return load.pages;
    return load.pages.filter((p) => `${p.title} ${p.slug}`.toLowerCase().includes(q));
  }, [filter, load.pages]);

  const validation = useMemo(() => validateStudioNavAndPages(navDraft, load.pages), [navDraft, load.pages]);
  const currentTheme = useMemo(
    () => (projectState ? docsThemeRegistry[projectState.themeId] ?? null : null),
    [projectState],
  );
  const configuredTopNavEntries = useMemo(
    () =>
      (projectState?.topNavItems ?? []).map((item) => ({
        item,
        label: resolveTopNavLabel(item.label, lang ?? projectState?.defaultLanguage ?? 'en'),
      })),
    [lang, projectState],
  );
  const fallbackTopNavEntries = useMemo(
    () =>
      (navDraft?.items ?? [])
        .flatMap((item) =>
          (item.type === 'section' || item.type === 'folder') && item.id
            ? [
                {
                  item: {
                    id: `studio-top-nav-${item.id}`,
                    type: 'nav-group' as const,
                    groupId: item.id,
                    label: item.title,
                  },
                  label: item.title,
                },
              ]
            : [],
        ),
    [navDraft],
  );
  const topNavEntries = configuredTopNavEntries.length > 0 ? configuredTopNavEntries : fallbackTopNavEntries;
  const topNavGroupEntries = useMemo(
    () =>
      topNavEntries.filter(
        (entry): entry is typeof entry & { item: Extract<ProjectSiteTopNavItem, { type: 'nav-group' }> } =>
          entry.item.type === 'nav-group',
      ),
    [topNavEntries],
  );
  const showStudioTopNav = !!(
    currentTheme?.capabilities.topNav &&
    topNavEntries.length > 0
  );
  const activePageTopNavGroupId = useMemo(() => {
    if (!navDraft || !activeId) {
      return null;
    }

    return (
      topNavGroupEntries.find((entry) => pageBelongsToGroup(navDraft.items, entry.item.groupId, activeId))?.item.groupId ?? null
    );
  }, [activeId, navDraft, topNavGroupEntries]);
  const activeStudioTopNavGroupId = showStudioTopNav ? selectedTopNavGroupId : null;
  const visibleNavDraft = useMemo(() => {
    if (!navDraft || !activeStudioTopNavGroupId) {
      return navDraft;
    }

    return filterNavigationToGroup(navDraft, activeStudioTopNavGroupId);
  }, [activeStudioTopNavGroupId, navDraft]);
  const topLevelNavGroups = useMemo(
    () =>
      (navDraft?.items ?? [])
        .flatMap((item) =>
          item.type === 'section' || item.type === 'folder'
            ? item.id
              ? [{ id: item.id, title: item.title }]
              : []
            : [],
        ),
    [navDraft],
  );
  const reviewQueue = useMemo(
    () => load.pages.filter((page) => page.review?.required && page.status !== 'published'),
    [load.pages],
  );

  useEffect(() => {
    if (!showStudioTopNav) {
      setSelectedTopNavGroupId(null);
      return;
    }

    const availableGroupIds = new Set(topNavGroupEntries.map((entry) => entry.item.groupId));
    const fallbackGroupId = topNavGroupEntries[0]?.item.groupId ?? null;

    setSelectedTopNavGroupId((current) => {
      if (current && availableGroupIds.has(current) && (!activePageTopNavGroupId || current !== activePageTopNavGroupId)) {
        return current;
      }

      if (activePageTopNavGroupId && availableGroupIds.has(activePageTopNavGroupId)) {
        return activePageTopNavGroupId;
      }

      return current && availableGroupIds.has(current) ? current : fallbackGroupId;
    });
  }, [activePageTopNavGroupId, showStudioTopNav, topNavGroupEntries]);

  const onSave = useCallback(
    async (next: PageDoc) => {
      if (!lang) {
        return;
      }
      setSaving(true);
      setSaveError(null);
      if (!selectedProject?.path) {
        setSaveError('请重新打开外部项目根目录。');
        setSaving(false);
        return;
      }
      try {
        const saved = await studioHost.savePage(lang, next, projectId, selectedProject.path);
        setActive(saved);
        setLoad((current) => ({
          ...current,
          pages: upsertPageInList(current.pages, saved),
        }));
        setDirty(false);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : '保存失败';
        setSaveError(msg);
      } finally {
        setSaving(false);
      }
    },
    [lang, projectId, selectedProject, studioHost],
  );

  const onSaveNav = useCallback(async () => {
    if (!navDraft) return;
    if (!lang) return;
    if (validation.errors.length) {
      setNavSaveError(validation.errors[0] ?? '导航校验失败');
      return;
    }
    setSavingNav(true);
    setNavSaveError(null);
    if (!selectedProject?.path) {
      setNavSaveError('请重新打开外部项目根目录。');
      setSavingNav(false);
      return;
    }
    try {
      const saved = await studioHost.saveNavigation(lang, navDraft, projectId, selectedProject.path);
      setLoad((current) => ({
        ...current,
        nav: saved,
      }));
      setNavDraft(saved);
      setNavDirty(false);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '导航保存失败';
      setNavSaveError(msg);
    } finally {
      setSavingNav(false);
    }
  }, [lang, navDraft, validation.errors, projectId, selectedProject, studioHost]);

  const onSaveProject = useCallback(async () => {
    if (!projectState) return;
    setProjectSaving(true);
    setProjectSaveError(null);
    if (!selectedProject?.path) {
      setProjectSaveError('请重新打开外部项目根目录。');
      setProjectSaving(false);
      return;
    }
    try {
      const branding = {
        ...(projectState.siteTitle.trim() ? { siteTitle: projectState.siteTitle.trim() } : {}),
        ...(projectState.homeLabel.trim() ? { homeLabel: projectState.homeLabel.trim() } : {}),
        ...(projectState.logoSrc.trim() ? { logoSrc: projectState.logoSrc.trim() } : {}),
        ...(projectState.logoAlt.trim() ? { logoAlt: projectState.logoAlt.trim() } : {}),
      };
      const patch: StudioProjectSettingsPatch = {
        name: projectState.name,
        languages: projectState.languages,
        defaultLanguage: projectState.defaultLanguage,
        site: {
          theme: {
            id: projectState.themeId,
            ...(Object.keys(branding).length > 0 ? { branding } : {}),
            chrome: projectState.showSearch ? {} : { showSearch: false },
            colors: {
              ...(projectState.primaryColor.trim() ? { primary: projectState.primaryColor.trim() } : {}),
              ...(projectState.primaryForegroundColor.trim()
                ? { primaryForeground: projectState.primaryForegroundColor.trim() }
                : {}),
              ...(projectState.accentColor.trim() ? { accent: projectState.accentColor.trim() } : {}),
              ...(projectState.accentForegroundColor.trim()
                ? { accentForeground: projectState.accentForegroundColor.trim() }
                : {}),
              ...(projectState.sidebarActiveColor.trim()
                ? { sidebarActive: projectState.sidebarActiveColor.trim() }
                : {}),
              ...(projectState.sidebarActiveForegroundColor.trim()
                ? { sidebarActiveForeground: projectState.sidebarActiveForegroundColor.trim() }
                : {}),
            },
            codeTheme: projectState.codeTheme,
          },
          navigation: {
            topNav: projectState.topNavItems,
          },
        },
        build: projectState.outputDir.trim()
          ? {
              outputDir: projectState.outputDir.trim(),
            }
          : {},
      };
      const response: StudioProjectResponse = await studioHost.updateProject(patch, projectId, selectedProject.path);
      const apiSourcesResponse = await studioHost.replaceApiSources(
        sanitizeApiSourcesForSave(projectState.apiSources),
        projectId,
        selectedProject.path,
      );
      setProjectState((current) =>
        current
          ? {
              ...current,
              name: response.config.name,
              defaultLanguage: response.config.defaultLanguage,
              languages: response.config.languages,
              themeId: response.config.site.theme.id,
              siteTitle: response.config.site.theme.branding?.siteTitle ?? '',
              homeLabel: response.config.site.theme.branding?.homeLabel ?? '',
              logoSrc: response.config.site.theme.branding?.logoSrc ?? '',
              logoAlt: response.config.site.theme.branding?.logoAlt ?? '',
              showSearch: response.config.site.theme.chrome?.showSearch ?? true,
              primaryColor: response.config.site.theme.colors?.primary ?? '',
              primaryForegroundColor: response.config.site.theme.colors?.primaryForeground ?? '',
              accentColor: response.config.site.theme.colors?.accent ?? '',
              accentForegroundColor: response.config.site.theme.colors?.accentForeground ?? '',
              sidebarActiveColor: response.config.site.theme.colors?.sidebarActive ?? '',
              sidebarActiveForegroundColor: response.config.site.theme.colors?.sidebarActiveForeground ?? '',
              codeTheme: response.config.site.theme.codeTheme ?? 'github-dark',
              topNavItems: response.config.site.navigation?.topNav ?? [],
              apiSources: apiSourcesResponse.sources,
              outputDir: response.config.build?.outputDir ?? '',
            }
          : current,
      );
      if (!response.config.languages.includes(lang ?? response.config.defaultLanguage)) {
        setLang(response.config.defaultLanguage);
      }
      setProjectDirty(false);
      await reload();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '项目设置保存失败';
      setProjectSaveError(msg);
    } finally {
      setProjectSaving(false);
    }
  }, [lang, projectId, projectState, reload, selectedProject, studioHost]);

  useEffect(() => {
    if (!navDirty) return;
    const scheduledTick = navDirtyTick;
    const timer = setTimeout(() => {
      if (navDirtyRef.current && navDirtyTickRef.current === scheduledTick) {
        onSaveNav();
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [navDirty, navDirtyTick, onSaveNav]);

  const dirtyRef = useRef(false);
  dirtyRef.current = dirty;
  const dirtyTickRef = useRef(0);
  dirtyTickRef.current = dirtyTick;
  const activeRef = useRef<PageDoc | null>(null);
  activeRef.current = active;
  useEffect(() => {
    if (!dirty) return;
    const scheduledTick = dirtyTick;
    const timer = setTimeout(() => {
      if (dirtyRef.current && activeRef.current && dirtyTickRef.current === scheduledTick) {
        onSave(activeRef.current);
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [dirty, dirtyTick, onSave]);

  const projectDirtyRef = useRef(false);
  projectDirtyRef.current = projectDirty;
  const projectDirtyTickRef = useRef(0);
  projectDirtyTickRef.current = projectDirtyTick;
  useEffect(() => {
    if (!projectDirty) return;
    const scheduledTick = projectDirtyTick;
    const timer = setTimeout(() => {
      if (projectDirtyRef.current && projectDirtyTickRef.current === scheduledTick) {
        void onSaveProject();
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [projectDirty, projectDirtyTick, onSaveProject]);

  const onCreate = useCallback((type: 'page' | 'group' | 'link') => {
    setCreateMenuOpen(false);
    setSidebarCreateDialog({ type });
  }, []);

  const sidebarCreateDialogConfig = useMemo(() => {
    if (!sidebarCreateDialog) {
      return null;
    }

    if (sidebarCreateDialog.type === 'page') {
      return {
        kind: 'page' as const,
        title: 'Add Page',
        description: 'Create a new page and add it to the root of the left navigation.',
        submitLabel: 'Create Page',
        initialValues: {
          title: 'Untitled',
          slug: 'getting-started/new-page',
        },
      };
    }

    if (sidebarCreateDialog.type === 'group') {
      return {
        kind: 'group' as const,
        title: 'Add Group',
        description: 'Create a new top-level group in the left navigation.',
        submitLabel: 'Create Group',
        initialValues: {
          title: 'Group',
        },
      };
    }

    return {
      kind: 'link' as const,
      title: 'Add Link',
      description: 'Add an external link to the root of the left navigation.',
      submitLabel: 'Create Link',
      initialValues: {
        title: 'Link',
        href: 'https://',
      },
    };
  }, [sidebarCreateDialog]);

  const handleSidebarCreateSubmit = useCallback(
    async (values: NavigationItemDialogValues) => {
      if (!lang) {
        throw new Error('请选择语言');
      }
      if (!navDraft) {
        throw new Error('导航尚未加载完成');
      }

      if (sidebarCreateDialog?.type === 'group') {
        const newGroup = {
          type: 'section' as const,
          id: slugifyGroupId(values.title),
          title: values.title,
          children: [],
        };
        setNavDraft({
          ...navDraft,
          items: [...navDraft.items, newGroup],
        });
        setNavDirty(true);
        setNavDirtyTick((tick) => tick + 1);
        return;
      }

      if (sidebarCreateDialog?.type === 'link') {
        setNavDraft({
          ...navDraft,
          items: [...navDraft.items, { type: 'link', title: values.title, href: values.href }],
        });
        setNavDirty(true);
        setNavDirtyTick((tick) => tick + 1);
        return;
      }

      if (!selectedProject?.path) {
        throw new Error('请重新打开外部项目根目录。');
      }

      const created = await studioHost.createPage(
        lang,
        { slug: values.slug, title: values.title || 'Untitled' },
        projectId,
        selectedProject.path,
      );
      setActiveId(created.id);
      setLoad((current) => ({
        ...current,
        pages: upsertPageInList(current.pages, created),
      }));
      setNavDraft({
        ...navDraft,
        items: [...navDraft.items, { type: 'page', pageId: created.id }],
      });
      setNavDirty(true);
      setNavDirtyTick((tick) => tick + 1);
    },
    [lang, navDraft, projectId, selectedProject, sidebarCreateDialog, studioHost],
  );

  const createPageForNavigation = useCallback(
    async (input: { slug: string; title: string }) => {
      if (!lang || !selectedProject?.path) {
        return null;
      }

      const created = await studioHost.createPage(
        lang,
        { slug: input.slug.trim(), title: input.title.trim() },
        projectId,
        selectedProject.path,
      );

      setActiveId(created.id);
      setLoad((current) => ({
        ...current,
        pages: upsertPageInList(current.pages, created),
      }));

      return created;
    },
    [lang, projectId, selectedProject, studioHost],
  );

  const openPageSettings = useCallback((pageId: string) => {
    setActiveId(pageId);
    setRightSidebarMode('page');
  }, []);

  const toggleProjectSettings = useCallback(() => {
    setRightSidebarMode((current) => (current === 'project' ? null : 'project'));
  }, []);

  const closeRightSidebar = useCallback(() => {
    setRightSidebarMode(null);
  }, []);

  const handleTopNavGroupSelect = useCallback(
    (groupId: string) => {
      setSelectedTopNavGroupId(groupId);
      if (!navDraft) {
        return;
      }

      if (activeId && pageBelongsToGroup(navDraft.items, groupId, activeId)) {
        return;
      }

      const nextPageId = findFirstPageIdInGroup(navDraft.items, groupId);
      if (nextPageId) {
        setActiveId(nextPageId);
        setRightSidebarMode(null);
      }
    },
    [activeId, navDraft],
  );

  const runPreview = useCallback(async () => {
    if (!selectedProject?.path) {
      setWorkflowMessage(null);
      setWorkflowError('请重新打开外部项目根目录。');
      return;
    }

    const existingPreviewWindow = previewWindowRef.current;
    const shouldOpenPreviewWindow = !existingPreviewWindow || existingPreviewWindow.closed;
    const reservedPreviewWindow = shouldOpenPreviewWindow ? window.open('about:blank', '_blank') : existingPreviewWindow;
    if (reservedPreviewWindow) {
      previewWindowRef.current = reservedPreviewWindow;
    }

    setWorkflowBusy('preview');
    setWorkflowMessage(null);
    setWorkflowError(null);
    try {
      const result: StudioPreviewResponse = await studioHost.runPreview(projectId, selectedProject.path);
      const targetUrl = new URL(result.previewUrl ?? result.docsPath, window.location.href).toString();
      setWorkflowMessage(`Preview ready: ${targetUrl}`);
      const nextPreviewWindow = previewWindowRef.current;

      if (nextPreviewWindow && !nextPreviewWindow.closed) {
        nextPreviewWindow.location.href = targetUrl;
        nextPreviewWindow.focus();
      } else {
        previewWindowRef.current = window.open(targetUrl, '_blank');
      }
    } catch (e: unknown) {
      if (shouldOpenPreviewWindow && reservedPreviewWindow && !reservedPreviewWindow.closed) {
        reservedPreviewWindow.close();
        if (previewWindowRef.current === reservedPreviewWindow) {
          previewWindowRef.current = null;
        }
      }
      setWorkflowMessage(null);
      setWorkflowError(e instanceof Error ? e.message : 'Preview workflow failed');
    } finally {
      setWorkflowBusy(null);
    }
  }, [projectId, selectedProject, studioHost]);

  const onDeletePage = useCallback(async () => {
    if (!lang || !active || !selectedProject?.path) {
      return;
    }

    const detail = active.status === 'published'
      ? '删除后，下一次 preview/build 将不会再对外可见。'
      : '删除后将无法再从当前语言工程中恢复该页面。';
    const ok = window.confirm(
      `确认删除当前语言页面 “${active.title}” 吗？这会同时移除该语言导航中的全部页面引用。${detail}`,
    );
    if (!ok) {
      return;
    }

    try {
      const deleted: DeletePageResponse = await studioHost.deletePage(lang, active.id, projectId, selectedProject.path);

      const nextPages = sortPagesBySlug(load.pages.filter((page) => page.id !== deleted.pageId));
      const nextActive = nextPages[0] ?? null;
      const cleanedNav = navDraft
        ? {
            ...navDraft,
            items: removePageRefsFromNav(navDraft.items, deleted.pageId).items,
          }
        : null;

      setLoad((current) => ({
        ...current,
        pages: nextPages,
        nav: cleanedNav ?? current.nav,
      }));
      setNavDraft(cleanedNav);
      setNavDirty(false);
      setNavSaveError(null);
      setActiveId(nextActive?.id ?? null);
      setActive(nextActive);
      setActiveLoading(false);
      setRightSidebarMode(null);
      setDirty(false);
      setSaveError(null);
      setWorkflowMessage(null);
      setWorkflowError(null);
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : '页面删除失败');
    }
  }, [active, lang, load.pages, navDraft, projectId, selectedProject, studioHost]);

  const runBuild = useCallback(async () => {
    if (!selectedProject?.path) {
      setWorkflowMessage(null);
      setWorkflowError('请重新打开外部项目根目录。');
      return;
    }
    setWorkflowBusy('build');
    setWorkflowMessage(null);
    setWorkflowError(null);
    try {
      const result: StudioBuildResponse = await studioHost.runBuild(projectId, selectedProject.path);
      const summary = result.languages.map((entry) => `${entry.lang}:${entry.publishedPages}`).join(', ');
      setWorkflowMessage(`Build validated -> ${result.artifactRoot} (${summary})`);
    } catch (e: unknown) {
      setWorkflowMessage(null);
      setWorkflowError(e instanceof Error ? e.message : 'Build workflow failed');
    } finally {
      setWorkflowBusy(null);
    }
  }, [projectId, selectedProject, studioHost]);

  const triggerWorkflowAction = useCallback(
    async (action: WorkflowAction) => {
      if (action === 'build') {
        await runBuild();
        return;
      }

      await runPreview();
    },
    [runBuild, runPreview],
  );

  const executeCurrentWorkflowAction = useCallback(async () => {
    setWorkflowMenuOpen(false);
    await triggerWorkflowAction(workflowAction);
  }, [triggerWorkflowAction, workflowAction]);

  const selectWorkflowAction = useCallback(
    async (action: WorkflowAction) => {
      setWorkflowAction(action);
      setWorkflowMenuOpen(false);
      await triggerWorkflowAction(action);
    },
    [triggerWorkflowAction],
  );

  if (!projectId) {
    return (
      <WelcomeScreen
        recentProjects={recentProjects}
        isOpeningFolder={isOpeningFolder}
        supportsNativeDirectoryPicker={hasNativeDirectoryPicker()}
        allowExternalProjectOpen={bootContext.canOpenExternalProject}
        allowRecentProjects={bootContext.canManageRecentProjects}
        onOpenProject={(projectPath) => handleOpenFolder(projectPath)}
        onSelectProject={handleProjectSelect}
        onRemoveProject={handleRecentProjectRemove}
      />
    );
  }

  return (
    <div className="h-dvh overflow-hidden bg-fd-background text-fd-foreground flex flex-col">
      {/* Top Navigation Bar */}
      <header className="flex h-12 items-center justify-between gap-4 border-b border-fd-border px-4 shrink-0">
        <div className="flex min-w-0 items-center gap-4">
          <div className="min-w-0">
            <span
              className="block truncate text-sm font-semibold"
              title={projectState?.projectRoot || selectedProject?.path || undefined}
            >
              {projectState?.name || selectedProject?.name || 'No Project'}
            </span>
          </div>
          {isProjectLocked ? null : (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={() => setProjectId('')}
              title="Close Project"
              data-testid="studio-close-project-button"
            >
              <X className="size-4" />
            </Button>
          )}
        </div>

        {showStudioTopNav ? (
          <nav className="flex min-w-0 flex-1 items-center justify-center gap-1 overflow-x-auto px-2">
            {topNavEntries.map(({ item, label }) => {
              if (item.type === 'external') {
                return (
                  <a
                    key={item.id}
                    href={item.href}
                    target={item.openInNewTab ? '_blank' : undefined}
                    rel={item.openInNewTab ? 'noopener noreferrer' : undefined}
                    className="inline-flex h-9 shrink-0 items-center rounded-lg border border-transparent px-3 text-sm text-fd-muted-foreground transition hover:bg-fd-muted hover:text-fd-foreground"
                  >
                    {label}
                  </a>
                );
              }

              const active = item.groupId === activeStudioTopNavGroupId;

              return (
                <button
                  key={item.id}
                  type="button"
                  className={cn(
                    'inline-flex h-9 shrink-0 items-center rounded-lg border px-3 text-sm transition',
                    active
                      ? 'border-fd-border bg-fd-card font-semibold text-fd-foreground shadow-sm'
                      : 'border-transparent text-fd-muted-foreground hover:bg-fd-muted hover:text-fd-foreground',
                  )}
                  onClick={() => handleTopNavGroupSelect(item.groupId)}
                  data-testid={`studio-top-nav-${item.groupId}`}
                >
                  {label}
                </button>
              );
            })}
          </nav>
        ) : (
          <div className="flex-1" />
        )}

        <div className="flex items-center gap-2.5">
          <div className="flex items-center overflow-hidden rounded-lg border border-fd-border bg-fd-card shadow-sm">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-none border-0"
              onClick={() => setLeftSidebarOpen(!leftSidebarOpen)}
              title={leftSidebarOpen ? 'Hide Sidebar' : 'Show Sidebar'}
              data-testid="studio-toggle-left-sidebar"
            >
              {leftSidebarOpen ? <SidebarClose className="size-4 text-slate-500" /> : <SidebarOpen className="size-4 text-slate-500" />}
            </Button>
            <div className="h-9 w-px bg-fd-border" />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-none border-0"
              title="Workspace tools"
              data-testid="studio-tools-button"
            >
              <Sparkles className="size-4 text-slate-500" />
            </Button>
          </div>

          <div ref={workflowMenuRef} className="relative">
            <div className="flex items-center overflow-hidden rounded-lg bg-black text-white shadow-sm">
              <Button
                type="button"
                variant="ghost"
                className="h-9 rounded-none border-0 bg-transparent px-4 text-sm font-semibold text-white hover:bg-white/10 hover:text-white"
                onClick={() => void executeCurrentWorkflowAction()}
                disabled={workflowBusy !== null}
                data-testid="studio-workflow-action-button"
              >
                {workflowBusy === workflowAction ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : workflowAction === 'build' ? (
                  <Box className="mr-2 size-4" />
                ) : (
                  <Eye className="mr-2 size-4" />
                )}
                {workflowAction === 'build' ? 'Build' : 'Preview'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-none border-0 bg-transparent text-white hover:bg-white/10 hover:text-white"
                onClick={() => setWorkflowMenuOpen((open) => !open)}
                disabled={workflowBusy !== null}
                data-testid="studio-workflow-menu-trigger"
              >
                <ChevronDown className="size-4" />
              </Button>
            </div>
            {workflowMenuOpen ? (
              <div className="absolute left-0 top-full z-50 mt-3 w-56 rounded-2xl border border-fd-border bg-fd-card p-2 shadow-lg">
                <button
                  type="button"
                  className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-base text-slate-500 transition hover:bg-fd-muted"
                  onClick={() => void selectWorkflowAction('preview')}
                  data-testid="studio-preview-button"
                >
                  <Eye className="size-5" />
                  <span className="font-medium text-fd-foreground">Preview</span>
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-base text-slate-500 transition hover:bg-fd-muted"
                  onClick={() => void selectWorkflowAction('build')}
                  data-testid="studio-build-button"
                >
                  <Box className="size-5" />
                  <span className="font-medium text-fd-foreground">Build</span>
                </button>
              </div>
            ) : null}
          </div>

          <div className="h-7 w-px bg-fd-border" />

          <Button
            type="button"
            variant={rightSidebarMode === 'project' ? 'secondary' : 'ghost'}
            size="icon"
            className="h-9 w-9 rounded-lg border border-transparent text-slate-500 shadow-none hover:bg-fd-card"
            onClick={toggleProjectSettings}
            title={rightSidebarMode === 'project' ? 'Hide Project Settings' : 'Show Project Settings'}
            data-testid="studio-open-project-settings-button"
          >
            <Settings className="size-4" />
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex min-h-0 flex-1 overflow-hidden">
        {/* Left Column: File Tree */}
        {leftSidebarOpen && (
          <aside className="flex min-h-0 w-64 shrink-0 flex-col border-r border-fd-border bg-fd-card" data-testid="studio-pages-sidebar">
            <div className="h-10 flex items-center justify-between border-b border-fd-border px-4 shrink-0">
              <span className="text-xs font-semibold tracking-wider text-fd-muted-foreground">PAGES</span>
              <div className="relative">
                <Button
                  type="button"
                  className="w-6 h-6 p-0 bg-black dark:bg-slate-100 text-white dark:text-black hover:opacity-80"
                  onClick={() => setCreateMenuOpen(!createMenuOpen)}
                  data-testid="studio-create-menu-trigger"
                >
                  <Plus className="size-4" />
                </Button>
                {createMenuOpen && (
                  <div className="absolute right-0 top-full mt-1 w-40 rounded-lg border border-fd-border bg-fd-popover p-1 shadow-md z-50">
                    <button
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-fd-muted"
                      onClick={() => onCreate('page')}
                      data-testid="studio-create-page-button"
                    >
                      <FileText className="size-4" />
                      Add Page
                    </button>
                    <button
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-fd-muted"
                      onClick={() => onCreate('group')}
                      data-testid="studio-create-group-button"
                    >
                      <Plus className="size-4" />
                      Add Group
                    </button>
                    <button
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-fd-muted"
                      onClick={() => onCreate('link')}
                      data-testid="studio-create-link-button"
                    >
                      <Link2 className="size-4" />
                      Add Link
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {load.loading ? (
                <div className="flex items-center gap-2 px-2 py-3 text-sm text-fd-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  正在加载...
                </div>
              ) : load.error ? (
                <div className="px-2 py-3 text-sm text-fd-muted-foreground">{load.error}</div>
              ) : visibleNavDraft ? (
                <div className="space-y-2">
                  {validation.errors.length || validation.warnings.length ? (
                    <div className="rounded-lg border border-fd-border bg-fd-background p-2 text-xs">
                      {validation.errors.map((m) => (
                        <div key={m} className="text-red-600">
                          {m}
                        </div>
                      ))}
                      {validation.warnings.map((m) => (
                        <div key={m} className="text-fd-muted-foreground">
                          {m}
                        </div>
                      ))}
                    </div>
                  ) : null}
                  <NavigationComposer
                    nav={visibleNavDraft}
                    pages={filteredPages}
                    activePageId={activeId}
                    onSelectPage={(id) => {
                      setActiveId(id);
                      setRightSidebarMode(null);
                    }}
                    onOpenPageSettings={openPageSettings}
                    onCreatePage={createPageForNavigation}
                    onChange={(next) => {
                      setNavDraft((current) => {
                        if (!current || !activeStudioTopNavGroupId) {
                          return next;
                        }

                        return replaceNavigationGroupChildren(current, activeStudioTopNavGroupId, next.items);
                      });
                      setNavDirty(true);
                      setNavDirtyTick((tick) => tick + 1);
                    }}
                  />
                </div>
              ) : (
                <div className="px-2 py-3 text-sm text-fd-muted-foreground">暂无数据</div>
              )}
            </div>
            <div className="sticky bottom-0 z-10 shrink-0 border-t border-fd-border bg-fd-card/95 p-4 shadow-[0_-10px_24px_rgba(15,23,42,0.06)] backdrop-blur supports-[backdrop-filter]:bg-fd-card/90">
              <Select value={lang ?? ''} onValueChange={(v) => setLang(v as DocsLang)}>
                <SelectTrigger
                  className="h-11 w-full rounded-xl px-3 text-sm"
                  disabled={!projectState}
                  data-testid="studio-language-switcher"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <Globe className="size-4 shrink-0" />
                    <SelectValue placeholder="Select language" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {(projectState?.languages ?? []).map((language) => (
                    <SelectItem key={language} value={language}>
                      {formatLanguageLabel(language)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </aside>
        )}

        {/* Middle Column: Editor */}
        <section className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-fd-background">
          {/* Breadcrumbs */}
          <div className="h-10 border-b border-fd-border flex items-center px-6 gap-2 shrink-0">
            <span className="text-xs text-fd-muted-foreground flex items-center gap-1">
              <FileText className="size-4" />
              Documentation
            </span>
            <span className="text-xs text-fd-muted-foreground">/</span>
            <span className="text-xs font-semibold text-fd-foreground">{title}</span>
            {active?.review?.required ? (
              <Badge variant="secondary" className="ml-2">
                {status === 'published' ? 'Reviewed' : 'Review Required'}
              </Badge>
            ) : null}
            {activeLoading ? <Loader2 className="ml-2 size-3 animate-spin text-fd-muted-foreground" /> : null}
          </div>

          {/* Editor Area */}
          <div className="min-h-0 flex-1 overflow-hidden">
            <div className="h-full overflow-auto p-6 lg:p-8 xl:p-12">
              <div className="min-h-full">
                {workflowError ? (
                  <div
                    className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
                    data-testid="studio-workflow-error"
                  >
                    {workflowError}
                  </div>
                ) : null}
                {navSaveError ? (
                  <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {navSaveError}
                  </div>
                ) : null}
                {workflowMessage ? (
                  <div
                    className="mb-4 rounded-md border border-fd-border bg-fd-card px-3 py-2 text-sm text-fd-muted-foreground"
                    data-testid="studio-workflow-message"
                  >
                    {workflowMessage}
                  </div>
                ) : null}
                {reviewQueue.length ? (
                  <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    {reviewQueue.length} external page{reviewQueue.length > 1 ? 's' : ''} still need review before publication in this language.
                  </div>
                ) : null}
                {active ? (
                  <>
                    <YooptaDocEditor
                      id={active.id}
                      value={active.content}
                      onChange={(nextContent, derived) => {
                        setActive((p) => {
                          const next = applyPagePatch(
                            p,
                            {
                              content: nextContent,
                              render: {
                                ...p?.render,
                                ...derived,
                              },
                              updatedAt: new Date().toISOString(),
                            },
                            true,
                          );
                          return next;
                        });
                        setDirty(true);
                        setDirtyTick((tick) => tick + 1);
                      }}
                    />
                  </>
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-fd-muted-foreground">
                    选择或创建文档
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Right Column: Contextual Settings */}
        {rightSidebarMode ? (
          <aside className="flex min-h-0 w-80 shrink-0 flex-col border-l border-fd-border bg-fd-card" data-testid="studio-settings-sidebar">
            <div className="flex h-10 items-center justify-between border-b border-fd-border px-4 shrink-0">
              <div className="text-xs font-semibold tracking-wider text-fd-muted-foreground">
                {rightSidebarMode === 'project' ? 'PROJECT SETTINGS' : 'PAGE SETTINGS'}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={closeRightSidebar}
                title="Close Settings"
                data-testid="studio-close-settings-sidebar"
              >
                <X className="size-4" />
              </Button>
            </div>
            <LocalStudioSettings
              mode={rightSidebarMode}
              page={active}
              project={projectState}
              navGroupOptions={topLevelNavGroups}
              onDeletePage={() => void onDeletePage()}
              onSetReviewApproval={(approved) => {
                setActive((current) => {
                  if (!current?.review?.required) {
                    return current;
                  }

                  return {
                    ...current,
                    review: {
                      ...current.review,
                      approvedAt: approved ? new Date().toISOString() : undefined,
                    },
                    updatedAt: new Date().toISOString(),
                  };
                });
                setDirty(true);
                setDirtyTick((tick) => tick + 1);
              }}
              onProjectChange={(patch) => {
                setProjectState((current) => (current ? applyProjectPatch(current, patch) : current));
                setProjectDirty(true);
                setProjectDirtyTick((tick) => tick + 1);
              }}
              onChange={(patch) => {
                setActive((current) =>
                  applyPagePatch(
                    current,
                    {
                      ...patch,
                      updatedAt: new Date().toISOString(),
                    },
                    true,
                  ),
                );
                setDirty(true);
                setDirtyTick((tick) => tick + 1);
              }}
            />
          </aside>
        ) : null}
      </main>

      <NavigationItemDialog
        open={sidebarCreateDialog !== null}
        config={sidebarCreateDialogConfig}
        onOpenChange={(next) => {
          if (!next) {
            setSidebarCreateDialog(null);
          }
        }}
        onSubmit={handleSidebarCreateSubmit}
      />

      {/* Footer Status Bar */}
      <footer className="sticky bottom-0 z-20 flex h-8 shrink-0 items-center justify-between border-t border-fd-border bg-fd-card/95 px-4 text-[10px] font-medium text-fd-muted-foreground shadow-[0_-12px_28px_rgba(15,23,42,0.08)] backdrop-blur supports-[backdrop-filter]:bg-fd-card/90">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1" data-testid="studio-connection-status">
            {isConnected ? (
              <>
                <Circle className="size-2 fill-green-500 text-green-500" />
                Connected
              </>
            ) : (
              <>
                <WifiOff className="size-3" />
                Disconnected
              </>
            )}
          </div>
          <div className="flex items-center gap-1" data-testid="studio-save-status">
            <Save className="size-3" />
            {workflowBusy
              ? `${workflowBusy}...`
              : workflowError
                ? 'Workflow failed'
                : navSaveError
                  ? 'Navigation save failed'
                  : savingNav
                    ? 'Saving navigation...'
                    : projectSaveStatus ?? lastSavedTime}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">UTF-8</div>
          <div className="flex items-center gap-1">JSON + Yoopta</div>
        </div>
      </footer>
    </div>
  );
}
