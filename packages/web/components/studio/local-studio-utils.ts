'use client';

import type { ProjectSiteTopNavItem } from '@anydocs/core';

import type { ApiSourceDoc, DocsLang, NavItem, NavigationDoc, PageDoc } from '@/lib/docs/types';
import type { listResolvedProjectPageTemplates } from '@/lib/page-templates';

// ─── Shared Types ─────────────────────────────────────────────────────────────

export type LoadState = { nav: NavigationDoc | null; pages: PageDoc[]; loading: boolean; error: string | null };

export type ProjectState = {
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
  authoringTemplates: ReturnType<typeof listResolvedProjectPageTemplates>;
  apiSources: ApiSourceDoc[];
  outputDir: string;
} | null;

export type RightSidebarMode = 'page' | 'project' | null;
export type WorkflowAction = 'preview' | 'build';
export type SidebarCreateDialog = { type: 'page' | 'group' | 'link' } | null;

export type WorkflowDiagnostic = {
  title: string;
  detail: string;
  remediation?: string;
  raw?: string;
};

export type WorkflowSuccess =
  | { type: 'build'; message: string; artifactRoot: string }
  | { type: 'preview'; message: string; previewUrl: string };

export type StoredWorkflowResult = {
  action: WorkflowAction;
  resolvedAt: string;
  success: WorkflowSuccess | null;
  error: string | null;
};

export type WorkflowResultHistoryEntry = StoredWorkflowResult & { id: string };

// ─── Constants ────────────────────────────────────────────────────────────────

export const STUDIO_BOOTSTRAP_RETRY_DELAYS_MS = [250, 500, 1_000, 1_500, 2_500, 4_000] as const;
export const WORKFLOW_STAGE_HINT_DELAY_MS = 4_000;
export const WORKFLOW_RESULT_HISTORY_LIMIT = 5;
export const WORKFLOW_RESULT_STORAGE_PREFIX = 'anydocs:studio:workflow-result:';

// ─── Workflow display helpers ─────────────────────────────────────────────────

export function formatWorkflowActionLabel(action: WorkflowAction) {
  return action === 'build' ? 'Build' : 'Preview';
}

export function formatWorkflowElapsed(ms: number) {
  const totalSeconds = Math.max(1, Math.floor(ms / 1_000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes === 0) {
    return `${seconds}s`;
  }

  return `${minutes}m ${seconds}s`;
}

export function getWorkflowStageHint(action: WorkflowAction, elapsedMs: number) {
  if (action === 'build') {
    if (elapsedMs < WORKFLOW_STAGE_HINT_DELAY_MS) {
      return { title: 'Preparing build', detail: 'Saving local authoring state and starting the docs build.' };
    }
    if (elapsedMs < 12_000) {
      return { title: 'Generating artifacts', detail: 'Validating published pages and rewriting search, reader, and LLM outputs.' };
    }
    return { title: 'Finalizing build', detail: 'Refreshing local runtime state. Larger projects may stay here for a bit.' };
  }

  if (elapsedMs < WORKFLOW_STAGE_HINT_DELAY_MS) {
    return { title: 'Starting preview', detail: 'Stopping older preview sessions and preparing the reader runtime.' };
  }
  if (elapsedMs < 12_000) {
    return { title: 'Warming preview', detail: 'Building the latest published output before opening the local reader.' };
  }
  return { title: 'Waiting for preview', detail: 'Checking that the local preview server is ready to serve the updated docs.' };
}

export function describeWorkflowError(action: WorkflowAction, message: string): WorkflowDiagnostic {
  const actionLabel = formatWorkflowActionLabel(action);
  const normalized = message.trim();
  const lower = normalized.toLowerCase();

  if (lower.includes('timed out waiting for the shared web runtime lock')) {
    return {
      title: `${actionLabel} blocked by another docs runtime task`,
      detail: 'The shared docs runtime stayed locked too long, usually because an older preview or build is still shutting down.',
      remediation: 'Wait a moment, close stale preview windows if needed, then retry.',
      raw: normalized,
    };
  }

  if (lower.includes('timed out waiting for docs preview server to become ready')) {
    return {
      title: 'Preview server did not become ready',
      detail: 'The local reader runtime never responded before the preview timeout expired.',
      remediation: 'Retry preview. If it keeps failing, inspect the desktop or web terminal for runtime errors.',
      raw: normalized,
    };
  }

  if (lower.includes('address already in use') || lower.includes('eaddrinuse')) {
    return {
      title: 'Preview port is already in use',
      detail: 'The local preview process could not bind to a free port.',
      remediation: 'Close the conflicting process or restart the preview session, then retry.',
      raw: normalized,
    };
  }

  if (lower.includes('failed to fetch api source')) {
    return {
      title: 'Build could not fetch an API source',
      detail: 'One of the configured API sources failed during artifact generation.',
      remediation: 'Check the API source URL and credentials in project settings, then run build again.',
      raw: normalized,
    };
  }

  if (lower.includes('unable to locate the docs web runtime')) {
    return {
      title: 'Docs runtime is missing',
      detail: 'Studio could not find the local docs runtime used for build and preview.',
      remediation: 'Reinstall dependencies or restore the local web runtime before retrying.',
      raw: normalized,
    };
  }

  if (lower.includes('request failed: 5')) {
    return {
      title: `${actionLabel} failed in the local service`,
      detail: 'The local Studio service returned an internal error while processing this workflow.',
      remediation: 'Retry once. If the error repeats, inspect the terminal logs for the failing request.',
      raw: normalized,
    };
  }

  return {
    title: `${actionLabel} failed`,
    detail: normalized || `${actionLabel} workflow failed.`,
    remediation: 'Inspect the terminal logs if this keeps happening, then retry.',
    raw: normalized || undefined,
  };
}

export function formatWorkflowResolvedAt(resolvedAt: string) {
  const value = new Date(resolvedAt);
  if (Number.isNaN(value.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(value);
}

export function formatWorkflowResultSummary(entry: WorkflowResultHistoryEntry) {
  if (entry.success?.type === 'build') return 'Build completed';
  if (entry.success?.type === 'preview') return 'Preview ready';
  return describeWorkflowError(entry.action, entry.error ?? `${formatWorkflowActionLabel(entry.action)} failed`).title;
}

// ─── Workflow session storage ─────────────────────────────────────────────────

export function getWorkflowResultStorageKey(projectId: string) {
  return `${WORKFLOW_RESULT_STORAGE_PREFIX}${projectId}`;
}

export function readStoredWorkflowResults(projectId: string): WorkflowResultHistoryEntry[] {
  if (typeof window === 'undefined' || !projectId) {
    return [];
  }

  try {
    const raw = window.sessionStorage.getItem(getWorkflowResultStorageKey(projectId));
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((entry): entry is WorkflowResultHistoryEntry => {
      if (!entry || typeof entry !== 'object') {
        return false;
      }

      const candidate = entry as Partial<WorkflowResultHistoryEntry>;
      return (
        typeof candidate.id === 'string' &&
        (candidate.action === 'build' || candidate.action === 'preview') &&
        typeof candidate.resolvedAt === 'string' &&
        ('success' in candidate || 'error' in candidate)
      );
    });
  } catch {
    return [];
  }
}

export function writeStoredWorkflowResults(projectId: string, results: WorkflowResultHistoryEntry[]) {
  if (typeof window === 'undefined' || !projectId) {
    return;
  }

  window.sessionStorage.setItem(getWorkflowResultStorageKey(projectId), JSON.stringify(results));
}

export function clearStoredWorkflowResult(projectId: string) {
  if (typeof window === 'undefined' || !projectId) {
    return;
  }

  window.sessionStorage.removeItem(getWorkflowResultStorageKey(projectId));
}

// ─── Navigation helpers ───────────────────────────────────────────────────────

export function collectNavPageRefs(items: NavItem[], out: { pageId: string; hidden: boolean }[]) {
  for (const item of items) {
    if (item.type === 'page') {
      out.push({ pageId: item.pageId, hidden: !!item.hidden });
      continue;
    }
    if (item.type === 'link') continue;
    collectNavPageRefs(item.children, out);
  }
}

export function validateStudioNavAndPages(nav: NavigationDoc | null, pages: PageDoc[]) {
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

export function removePageRefsFromNav(items: NavItem[], pageId: string): { items: NavItem[]; removed: number } {
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

export function replaceNavigationGroupChildren(nav: NavigationDoc, groupId: string, children: NavItem[]): NavigationDoc {
  return {
    ...nav,
    items: nav.items.map((item) =>
      (item.type === 'section' || item.type === 'folder') && item.id === groupId ? { ...item, children } : item,
    ),
  };
}

// ─── Page helpers ─────────────────────────────────────────────────────────────

export function clearReviewApproval(page: PageDoc | null): PageDoc | null {
  if (!page?.review?.required || !page.review.approvedAt) {
    return page;
  }

  return {
    ...page,
    review: { ...page.review, approvedAt: undefined },
  };
}

export function shouldInvalidateReviewApproval(patch: Partial<PageDoc>): boolean {
  return (
    'content' in patch ||
    'render' in patch ||
    'title' in patch ||
    'slug' in patch ||
    'description' in patch ||
    'template' in patch ||
    'metadata' in patch
  );
}

export function applyPagePatch(page: PageDoc | null, patch: Partial<PageDoc>, invalidateApproval: boolean): PageDoc | null {
  if (!page) {
    return page;
  }

  const next = { ...page, ...patch };
  return invalidateApproval ? clearReviewApproval(next) : next;
}

export function upsertPageInList(pages: PageDoc[], nextPage: PageDoc) {
  const index = pages.findIndex((page) => page.id === nextPage.id);
  if (index === -1) {
    return [...pages, nextPage];
  }

  const nextPages = [...pages];
  nextPages[index] = nextPage;
  return nextPages;
}

export function sortPagesBySlug(pages: PageDoc[]) {
  return [...pages].sort((left, right) => left.slug.localeCompare(right.slug));
}

// ─── Project helpers ──────────────────────────────────────────────────────────

export function normalizeProjectApiSources(
  apiSources: ApiSourceDoc[],
  languages: DocsLang[],
  defaultLanguage: DocsLang,
): ApiSourceDoc[] {
  return apiSources.map((source) =>
    languages.includes(source.lang)
      ? source
      : { ...source, lang: defaultLanguage },
  );
}

export function applyProjectPatch(
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

export function sanitizeApiSourcesForSave(apiSources: ApiSourceDoc[]): ApiSourceDoc[] {
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
          ? { kind: 'url', url: source.source.url.trim() }
          : { kind: 'file', path: source.source.path.trim() },
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

export function slugifyGroupId(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/-{2,}/g, '-') || `group-${Date.now().toString(36)}`
  );
}

export function isTransientStudioBootstrapError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  return (
    /Request failed:\s*404\s+Not Found/i.test(message) ||
    /received HTML instead/i.test(message)
  );
}
