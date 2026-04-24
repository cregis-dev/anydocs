'use client';

import type {
  ProjectLocalizedLabel,
  ProjectSiteTopNavItem,
  ResolvedProjectPageTemplateDefinition,
} from '@anydocs/core';
import { ArrowDown, ArrowUp, Link2, Plus, Trash2 } from 'lucide-react';

import type { ApiSourceDoc, DocsLang } from '@/lib/docs/types';
import { SUPPORTED_DOCS_LANGUAGES } from '@/lib/docs/types';
import type { PageDoc, PageReview, PageStatus } from '@/lib/docs/types';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatLanguageLabel } from '@/components/studio/language-label';
import { docsThemes } from '@/lib/themes/registry';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

type ProjectSettingsValue = {
  projectId: string;
  name: string;
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
  authoringTemplates: ResolvedProjectPageTemplateDefinition[];
  apiSources: ApiSourceDoc[];
  outputDir: string;
  siteUrl: string;
};

type ProjectSettingsPatch = {
  name?: string;
  defaultLanguage?: DocsLang;
  themeId?: string;
  siteTitle?: string;
  homeLabel?: string;
  logoSrc?: string;
  logoAlt?: string;
  showSearch?: boolean;
  primaryColor?: string;
  primaryForegroundColor?: string;
  accentColor?: string;
  accentForegroundColor?: string;
  sidebarActiveColor?: string;
  sidebarActiveForegroundColor?: string;
  codeTheme?: 'github-light' | 'github-dark';
  topNavItems?: ProjectSiteTopNavItem[];
  apiSources?: ApiSourceDoc[];
  languages?: DocsLang[];
  outputDir?: string;
  siteUrl?: string;
};

function parseTags(raw: string) {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseCommaSeparatedValues(raw: string) {
  return raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

function getLocalizedLabel(label: ProjectLocalizedLabel, lang: DocsLang): string {
  if (typeof label === 'string') {
    return label;
  }

  return label[lang] ?? Object.values(label).find((value) => typeof value === 'string' && value.trim().length > 0) ?? '';
}

function metadataFieldTestId(fieldId: string) {
  return `studio-page-metadata-${fieldId}`;
}

function getPageTemplateById(
  templates: ResolvedProjectPageTemplateDefinition[],
  templateId: string | undefined,
) {
  if (!templateId) {
    return null;
  }

  return templates.find((template) => template.id === templateId) ?? null;
}

function getReviewSourceLabel(review: PageReview): string {
  return review.sourceType === 'legacy-import' ? 'Legacy Import' : 'AI Generated';
}

function getTopNavLabelValue(item: ProjectSiteTopNavItem, language: DocsLang): string {
  return typeof item.label === 'string' ? item.label : item.label[language] ?? '';
}

function setTopNavLabelValue(item: ProjectSiteTopNavItem, language: DocsLang, value: string): ProjectSiteTopNavItem {
  const nextLabel =
    typeof item.label === 'string'
      ? {
          zh: language === 'zh' ? value : item.label,
          en: language === 'en' ? value : item.label,
        }
      : { ...item.label, [language]: value };

  return {
    ...item,
    label: nextLabel,
  };
}

function createTopNavItemId(prefix: 'group' | 'link', index: number) {
  return `${prefix}-${Date.now().toString(36)}-${index.toString(36)}`;
}

function createApiSourceId(index: number) {
  return `api-source-${Date.now().toString(36)}-${index.toString(36)}`;
}

function createApiSourceDraft(language: DocsLang, index: number): ApiSourceDoc {
  return {
    id: createApiSourceId(index),
    type: 'openapi',
    lang: language,
    status: 'draft',
    source: {
      kind: 'url',
      url: 'https://example.com/openapi.json',
    },
    display: {
      title: 'New API Source',
    },
    runtime: {
      tryIt: {
        enabled: false,
      },
    },
  };
}

function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3 rounded-lg border border-fd-border bg-fd-background p-3">
      <div>
        <div className="text-sm font-medium text-fd-foreground">{title}</div>
        {description ? <div className="mt-1 text-xs text-fd-muted-foreground">{description}</div> : null}
      </div>
      {children}
    </section>
  );
}

type ShellNavGroup = {
  title: string;
  items: Array<{ label: string; active?: boolean }>;
};

type ReaderShellConfig = {
  headerTitle: string;
  headerSubtitle: string;
  shellLabel: string;
  shellSummary: string;
  navSummary: string;
  articleSummary: string;
  railSummary: string;
  navGroups: ShellNavGroup[];
  articleTitle: string;
  articleLines: number;
  railTitle: string;
  railLines: number;
  footerNote: string;
  layoutClass: string;
  navClassName: string;
  articleClassName: string;
  railClassName: string;
};

function getReaderShellConfig(currentThemeId: string): ReaderShellConfig {
  if (currentThemeId === 'atlas-docs') {
    return {
      headerTitle: 'Site-wide nav',
      headerSubtitle: 'Useful for multiple domains with a shared top navigation.',
      shellLabel: 'Two-level chrome',
      shellSummary: 'Top navigation scopes the site, then each section gets its own sidebar.',
      navSummary: 'Use when the docs split into guides, APIs, SDKs, and references.',
      articleSummary: 'The reading lane stays stable while the navigation carries the domain split.',
      railSummary: 'Keep page anchors and supporting context in a light right rail.',
      navGroups: [
        {
          title: 'Guides',
          items: [
            { label: 'Introduction' },
            { label: 'Getting Started', active: true },
            { label: 'Concepts' },
          ],
        },
        {
          title: 'Reference',
          items: [
            { label: 'API Reference' },
            { label: 'SDK Docs' },
            { label: 'Changelog' },
          ],
        },
      ],
      articleTitle: 'One site, several domains',
      articleLines: 4,
      railTitle: 'On this page',
      railLines: 3,
      footerNote: 'Top nav + scoped sidebar + right rail',
      layoutClass: 'grid-cols-[1fr_minmax(0,1.8fr)_120px]',
      navClassName: 'bg-fd-muted/60',
      articleClassName: 'bg-fd-background',
      railClassName: 'bg-fd-muted/50',
    };
  }

  if (currentThemeId === 'blueprint-review') {
    return {
      headerTitle: 'Review chrome',
      headerSubtitle: 'Best for internal docs, PRDs, and deep folder trees.',
      shellLabel: 'Review-first chrome',
      shellSummary: 'The sidebar does the orientation work so the page can stay dense and content-first.',
      navSummary: 'Use when the tree is deep and hierarchy matters more than site-wide marketing nav.',
      articleSummary: 'Long-form review content stays readable without turning into a blog layout.',
      railSummary: 'Keep comments, references, or related links close to the page.',
      navGroups: [
        {
          title: 'Planning',
          items: [
            { label: 'Scope' },
            { label: 'PRD', active: true },
            { label: 'Assumptions' },
          ],
        },
        {
          title: 'Review',
          items: [
            { label: 'Architecture' },
            { label: 'Implementation' },
            { label: 'QA notes' },
          ],
        },
      ],
      articleTitle: 'Dense, content-first reading',
      articleLines: 5,
      railTitle: 'References',
      railLines: 4,
      footerNote: 'Dense reading shell with deep folders',
      layoutClass: 'grid-cols-[160px_minmax(0,1fr)_120px]',
      navClassName: 'bg-fd-muted/60',
      articleClassName: 'bg-fd-background',
      railClassName: 'bg-fd-muted/50',
    };
  }

  return {
    headerTitle: 'Compact docs shell',
    headerSubtitle: 'Best for a single product doc tree with a clean reading lane.',
    shellLabel: 'Classic reader chrome',
    shellSummary: 'A compact sidebar keeps the tree visible while the article stays centered and calm.',
    navSummary: 'Best when the site is mostly one connected doc tree instead of multiple domains.',
    articleSummary: 'The content column remains dominant so long-form docs are easy to scan.',
    railSummary: 'Use the right rail sparingly for anchors, not for primary navigation.',
    navGroups: [
      {
        title: 'Getting Started',
        items: [
          { label: 'Welcome' },
          { label: 'Install', active: true },
          { label: 'Quickstart' },
        ],
      },
      {
        title: 'Reference',
        items: [
          { label: 'Pages' },
          { label: 'Navigation' },
          { label: 'Settings' },
        ],
      },
    ],
    articleTitle: 'Compact sidebar, centered article',
    articleLines: 4,
    railTitle: 'This page',
    railLines: 3,
    footerNote: 'Compact sidebar + centered article',
    layoutClass: 'grid-cols-[180px_minmax(0,1.1fr)_96px]',
    navClassName: 'bg-fd-muted/60',
    articleClassName: 'bg-fd-background',
    railClassName: 'bg-fd-muted/50',
  };
}

function ShellHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="space-y-2 rounded-md border border-fd-border bg-fd-card p-2">
      <div className="flex items-center justify-between gap-2">
        <div className="h-2.5 w-20 rounded-full bg-fd-foreground/12" />
        <div className="h-2.5 w-10 rounded-full bg-fd-foreground/10" />
      </div>
      <div className="flex items-center gap-2">
        <div className="h-2.5 w-16 rounded-full bg-fd-foreground/12" />
        <div className="h-2.5 w-24 rounded-full bg-fd-foreground/10" />
      </div>
      <div className="text-[11px] font-medium text-fd-muted-foreground">{title}</div>
      <div className="text-[11px] text-fd-muted-foreground">{subtitle}</div>
    </div>
  );
}

function ShellAnatomy({
  shellLabel,
  shellSummary,
  navSummary,
  articleSummary,
  railSummary,
}: {
  shellLabel: string;
  shellSummary: string;
  navSummary: string;
  articleSummary: string;
  railSummary: string;
}) {
  return (
    <div className="space-y-2 rounded-md border border-fd-border bg-fd-card p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary" className="text-[10px] uppercase tracking-[0.12em]">
          {shellLabel}
        </Badge>
        <span className="text-xs text-fd-muted-foreground">{shellSummary}</span>
      </div>
      <div className="grid gap-2 md:grid-cols-3">
        <div className="rounded-md border border-fd-border bg-fd-background p-2">
          <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-fd-muted-foreground">
            Navigation
          </div>
          <div className="mt-1 text-xs text-fd-foreground">{navSummary}</div>
        </div>
        <div className="rounded-md border border-fd-border bg-fd-background p-2">
          <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-fd-muted-foreground">
            Content
          </div>
          <div className="mt-1 text-xs text-fd-foreground">{articleSummary}</div>
        </div>
        <div className="rounded-md border border-fd-border bg-fd-background p-2">
          <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-fd-muted-foreground">
            Rail
          </div>
          <div className="mt-1 text-xs text-fd-foreground">{railSummary}</div>
        </div>
      </div>
    </div>
  );
}

function ShellNav({
  groups,
  compact = false,
  className,
}: {
  groups: ShellNavGroup[];
  compact?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('rounded-md border border-fd-border p-2', compact ? 'space-y-2' : 'space-y-3', className)}>
      <div className="h-2.5 w-20 rounded-full bg-fd-foreground/12" />
      <div className="space-y-3">
        {groups.map((group) => (
          <div key={group.title} className="space-y-2">
            <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-fd-muted-foreground">
              {group.title}
            </div>
            <div className="space-y-1">
              {group.items.map((item) => (
                <div
                  key={item.label}
                  className={cn(
                    'rounded-md border px-2 py-1',
                    item.active
                      ? 'border-fd-foreground/20 bg-fd-card'
                      : 'border-transparent bg-transparent',
                  )}
                >
                  <div
                    className={cn(
                      'h-2 rounded-full',
                      item.active ? 'w-24 bg-fd-foreground/16' : 'w-20 bg-fd-foreground/10',
                    )}
                  />
                  <div className="mt-1 text-[10px] text-fd-muted-foreground">{item.label}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ShellArticle({
  title,
  lines = 3,
  className,
}: {
  title: string;
  lines?: number;
  className?: string;
}) {
  return (
    <div className={cn('space-y-2 rounded-md border border-fd-border p-2', className)}>
      <div className="text-[11px] font-medium text-fd-foreground">{title}</div>
      <div className="h-2 w-40 rounded-full bg-fd-foreground/12" />
      <div className="space-y-2">
        {Array.from({ length: lines }).map((_, index) => (
          <div key={index} className="h-2 rounded-full bg-fd-foreground/10" />
        ))}
      </div>
      <div className="h-12 rounded-md border border-dashed border-fd-border bg-fd-card/70" />
    </div>
  );
}

function ShellRail({
  title,
  compact = false,
  className,
}: {
  title: string;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('rounded-md border border-fd-border p-2', compact ? 'space-y-2' : 'space-y-3', className)}>
      <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-fd-muted-foreground">
        {title}
      </div>
      <div className="h-2.5 w-12 rounded-full bg-fd-foreground/12" />
      <div className="space-y-2">
        <div className="h-2 rounded-full bg-fd-foreground/10" />
        <div className="h-2 rounded-full bg-fd-foreground/10" />
        <div className="h-2 rounded-full bg-fd-foreground/10" />
        {!compact ? <div className="h-2 rounded-full bg-fd-foreground/10" /> : null}
      </div>
    </div>
  );
}

function ReaderThemeShellPreview({
  themeId,
}: {
  themeId: string;
}) {
  const config = getReaderShellConfig(themeId);

  return (
    <div className="space-y-3">
      <ShellHeader title={config.headerTitle} subtitle={config.headerSubtitle} />
      <ShellAnatomy
        shellLabel={config.shellLabel}
        shellSummary={config.shellSummary}
        navSummary={config.navSummary}
        articleSummary={config.articleSummary}
        railSummary={config.railSummary}
      />
      <div className={cn('grid gap-2', config.layoutClass)}>
        <ShellNav
          groups={config.navGroups}
          compact={themeId !== 'atlas-docs'}
          className={config.navClassName}
        />
        <ShellArticle
          title={config.articleTitle}
          lines={config.articleLines}
          className={config.articleClassName}
        />
        <ShellRail
          title={config.railTitle}
          compact={themeId !== 'atlas-docs'}
          className={config.railClassName}
        />
      </div>
      <div className="text-xs text-fd-muted-foreground">{config.footerNote}</div>
    </div>
  );
}

type ReaderThemePreviewData = {
  id: string;
  label: string;
  tone: string;
  previewSummary: string;
  structureSummary: string;
  chromeLabel: string;
};

function ReaderThemePreview({
  theme,
}: {
  theme: ReaderThemePreviewData;
}) {
  return (
    <div className="space-y-3 rounded-lg border border-fd-border bg-fd-background p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-fd-foreground">{theme.label} Preview</div>
          <div className="text-xs text-fd-muted-foreground">{theme.previewSummary}</div>
          <div className="mt-1 text-xs text-fd-muted-foreground">{theme.structureSummary}</div>
        </div>
        <Badge variant="secondary">{theme.chromeLabel}</Badge>
      </div>

      <ReaderThemeShellPreview themeId={theme.id} />
    </div>
  );
}

function ProjectSettingsContent({
  project,
  navGroupOptions,
  onProjectChange,
}: {
  project: ProjectSettingsValue | null;
  navGroupOptions: Array<{ id: string; title: string }>;
  onProjectChange: (patch: ProjectSettingsPatch) => void;
}) {
  if (!project) {
    return <div className="text-sm text-fd-muted-foreground">Project settings unavailable.</div>;
  }

  const selectedTheme = docsThemes.find((theme) => theme.id === project.themeId) ?? null;
  const topNavSupported = selectedTheme?.capabilities.navigation.topNav ?? false;
  const themePreviewData: ReaderThemePreviewData | null = selectedTheme
    ? {
        id: selectedTheme.id,
        label: selectedTheme.label,
        tone: selectedTheme.tone,
        previewSummary:
          selectedTheme.id === 'atlas-docs'
            ? 'Top nav + scoped sidebar + right rail'
            : selectedTheme.id === 'blueprint-review'
              ? 'Dense sidebar + long-form review layout'
              : 'Compact sidebar + centered article',
        structureSummary:
          selectedTheme.id === 'atlas-docs'
            ? 'Top navigation organizes the site; each section gets its own sidebar.'
            : selectedTheme.id === 'blueprint-review'
              ? 'The sidebar is the primary orientation layer because the tree is deep.'
              : 'The sidebar stays compact so the article remains the main reading lane.',
        chromeLabel:
          selectedTheme.id === 'atlas-docs'
            ? 'Two-level chrome'
            : selectedTheme.id === 'blueprint-review'
              ? 'Review chrome'
              : 'Classic chrome',
      }
    : null;

  return (
    <div className="space-y-4">
      <SettingsSection title="General" description="Project identity and supported languages.">
        <div>
          <div className="mb-1 text-xs text-fd-muted-foreground">Project ID</div>
          <div
            className="rounded-md border border-fd-border bg-fd-muted/50 px-3 py-2 font-mono text-sm text-fd-muted-foreground"
            data-testid="studio-project-id-display"
          >
            {project.projectId}
          </div>
          <div className="mt-1 text-xs text-fd-muted-foreground">
            Used by CLI and MCP tools. Set at project creation and cannot be changed.
          </div>
        </div>

        <div>
          <div className="mb-1 text-xs text-fd-muted-foreground">Project Name</div>
          <Input
            value={project.name}
            onChange={(e) => onProjectChange({ name: e.target.value })}
            data-testid="studio-project-name-input"
          />
        </div>

        <div>
          <div className="mb-1 text-xs text-fd-muted-foreground">Site URL</div>
          <Input
            type="url"
            value={project.siteUrl}
            onChange={(e) => onProjectChange({ siteUrl: e.target.value })}
            placeholder="https://docs.example.com"
            data-testid="studio-project-site-url-input"
          />
          <div className="mt-1 text-xs text-fd-muted-foreground">
            Used as base URL in llms.txt and canonical links. Leave empty for relative paths.
          </div>
        </div>

        <div>
          <div className="mb-1 text-xs text-fd-muted-foreground">Default Language</div>
          <Select
            value={project.defaultLanguage}
            onValueChange={(value) => onProjectChange({ defaultLanguage: value as DocsLang })}
          >
            <SelectTrigger data-testid="studio-project-default-language-trigger">
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              {project.languages.map((language) => (
                <SelectItem key={language} value={language}>
                  {formatLanguageLabel(language)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <div className="mb-2 text-xs text-fd-muted-foreground">Enabled Languages</div>
          <div className="space-y-2">
            {SUPPORTED_DOCS_LANGUAGES.map((language) => {
              const checked = project.languages.includes(language);
              const disableUncheck = checked && project.languages.length === 1;

              return (
                <label key={language} className="flex items-center justify-between gap-3 rounded-md border border-fd-border px-3 py-2 text-sm">
                  <div>
                    <div className="font-medium">{formatLanguageLabel(language)}</div>
                    <div className="text-xs text-fd-muted-foreground">
                      {language === project.defaultLanguage ? 'Default language' : 'Optional language'}
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={disableUncheck}
                    onChange={(e) => {
                      const nextLanguages = e.target.checked
                        ? [...project.languages, language]
                        : project.languages.filter((item) => item !== language);
                      const normalized = SUPPORTED_DOCS_LANGUAGES.filter((item) => nextLanguages.includes(item));
                      onProjectChange({
                        languages: normalized,
                        ...(normalized.includes(project.defaultLanguage) ? {} : { defaultLanguage: normalized[0] }),
                      });
                    }}
                  />
                </label>
              );
            })}
          </div>
        </div>
      </SettingsSection>

      <SettingsSection title="Reader" description="Reader theme, branding, and surface-specific labels. This affects the public docs shell only.">
        <div>
          <div className="mb-1 text-xs text-fd-muted-foreground">Docs Theme</div>
          <Select value={project.themeId} onValueChange={(value) => onProjectChange({ themeId: value })}>
            <SelectTrigger data-testid="studio-project-theme-trigger">
              <SelectValue placeholder="Select theme" />
            </SelectTrigger>
            <SelectContent>
              {docsThemes.map((theme) => (
                <SelectItem key={theme.id} value={theme.id} className="py-2">
                  <div className="space-y-0.5 text-left">
                    <div className="font-medium">{theme.label}</div>
                    <div className="text-xs text-fd-muted-foreground">{theme.tone}</div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedTheme ? (
            <div className="mt-3 space-y-2 rounded-lg border border-fd-border bg-fd-background p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{selectedTheme.tone}</Badge>
                <Badge variant="secondary">Reader only</Badge>
              </div>
              <div className="text-sm font-medium text-fd-foreground">{selectedTheme.label}</div>
              <div className="text-xs text-fd-muted-foreground">{selectedTheme.description}</div>
              <div className="text-xs text-fd-muted-foreground">
                Best for: {selectedTheme.recommendedFor}
              </div>
              <div className="text-xs text-fd-muted-foreground">
                Why this shell: {themePreviewData?.previewSummary}
              </div>
              <div className="text-xs text-fd-muted-foreground">
                Navigation logic: {themePreviewData?.structureSummary}
              </div>
            </div>
          ) : null}
          {themePreviewData ? (
            <div className="mt-3">
              <ReaderThemePreview theme={themePreviewData} />
            </div>
          ) : null}
        </div>

        <div>
          <div className="mb-1 text-xs text-fd-muted-foreground">Site Title</div>
          <Input
            value={project.siteTitle}
            onChange={(e) => onProjectChange({ siteTitle: e.target.value })}
            placeholder={selectedTheme?.label ?? 'Reader title'}
            data-testid="studio-site-title-input"
          />
        </div>

        <div>
          <div className="mb-1 text-xs text-fd-muted-foreground">Home Label</div>
          <Input
            value={project.homeLabel}
            onChange={(e) => onProjectChange({ homeLabel: e.target.value })}
            placeholder="Docs Home"
            data-testid="studio-home-label-input"
          />
        </div>

        <div>
          <div className="mb-1 text-xs text-fd-muted-foreground">Code Theme</div>
          <Select
            value={project.codeTheme}
            onValueChange={(value) => onProjectChange({ codeTheme: value as 'github-light' | 'github-dark' })}
          >
            <SelectTrigger data-testid="studio-project-code-theme-trigger">
              <SelectValue placeholder="Select code theme" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="github-dark">GitHub Dark</SelectItem>
              <SelectItem value="github-light">GitHub Light</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </SettingsSection>

      {project.themeId === 'classic-docs' ? (
        <SettingsSection title="Classic Docs" description="Branding and color overrides for the classic theme.">
          <div>
            <div className="mb-1 text-xs text-fd-muted-foreground">Logo Source</div>
            <Input
              value={project.logoSrc}
              onChange={(e) => onProjectChange({ logoSrc: e.target.value })}
              placeholder="/logo.svg or https://..."
              data-testid="studio-classic-docs-logo-src-input"
            />
          </div>

          <div>
            <div className="mb-1 text-xs text-fd-muted-foreground">Logo Alt Text</div>
            <Input
              value={project.logoAlt}
              onChange={(e) => onProjectChange({ logoAlt: e.target.value })}
              placeholder="Project logo"
              data-testid="studio-classic-docs-logo-alt-input"
            />
          </div>

          <label className="flex items-center justify-between gap-3 rounded-md border border-fd-border px-3 py-2 text-sm">
            <div>
              <div className="font-medium">Show Sidebar Search</div>
              <div className="text-xs text-fd-muted-foreground">Hide the sidebar search input.</div>
            </div>
            <input
              type="checkbox"
              checked={project.showSearch}
              onChange={(e) => onProjectChange({ showSearch: e.target.checked })}
              data-testid="studio-classic-docs-show-search-toggle"
            />
          </label>

          <div className="grid gap-3">
            <div>
              <div className="mb-1 text-xs text-fd-muted-foreground">Primary Color</div>
              <Input
                value={project.primaryColor}
                onChange={(e) => onProjectChange({ primaryColor: e.target.value })}
                placeholder="#111111"
                className="font-mono"
                data-testid="studio-classic-docs-primary-color-input"
              />
            </div>

            <div>
              <div className="mb-1 text-xs text-fd-muted-foreground">Primary Foreground</div>
              <Input
                value={project.primaryForegroundColor}
                onChange={(e) => onProjectChange({ primaryForegroundColor: e.target.value })}
                placeholder="#ffffff"
                className="font-mono"
                data-testid="studio-classic-docs-primary-foreground-color-input"
              />
            </div>

            <div>
              <div className="mb-1 text-xs text-fd-muted-foreground">Accent Color</div>
              <Input
                value={project.accentColor}
                onChange={(e) => onProjectChange({ accentColor: e.target.value })}
                placeholder="#f3f3ef"
                className="font-mono"
                data-testid="studio-classic-docs-accent-color-input"
              />
            </div>

            <div>
              <div className="mb-1 text-xs text-fd-muted-foreground">Accent Foreground</div>
              <Input
                value={project.accentForegroundColor}
                onChange={(e) => onProjectChange({ accentForegroundColor: e.target.value })}
                placeholder="#111111"
                className="font-mono"
                data-testid="studio-classic-docs-accent-foreground-color-input"
              />
            </div>

            <div>
              <div className="mb-1 text-xs text-fd-muted-foreground">Sidebar Active</div>
              <Input
                value={project.sidebarActiveColor}
                onChange={(e) => onProjectChange({ sidebarActiveColor: e.target.value })}
                placeholder="#111111"
                className="font-mono"
                data-testid="studio-classic-docs-sidebar-active-color-input"
              />
            </div>

            <div>
              <div className="mb-1 text-xs text-fd-muted-foreground">Sidebar Active Foreground</div>
              <Input
                value={project.sidebarActiveForegroundColor}
                onChange={(e) => onProjectChange({ sidebarActiveForegroundColor: e.target.value })}
                placeholder="#ffffff"
                className="font-mono"
                data-testid="studio-classic-docs-sidebar-active-foreground-color-input"
              />
            </div>
          </div>
        </SettingsSection>
      ) : null}

      {topNavSupported ? (
        <SettingsSection title="Top Navigation" description="Header items for themes that support top navigation.">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={navGroupOptions.length === 0}
              onClick={() =>
                onProjectChange({
                  topNavItems: [
                    ...project.topNavItems,
                    {
                      id: createTopNavItemId('group', project.topNavItems.length),
                      type: 'nav-group',
                      groupId: navGroupOptions[0]?.id ?? '',
                      label: { zh: '新分组', en: 'New Group' },
                    },
                  ],
                })
              }
            >
              <Plus className="mr-1 size-4" />
              Add Group
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() =>
                onProjectChange({
                  topNavItems: [
                    ...project.topNavItems,
                    {
                      id: createTopNavItemId('link', project.topNavItems.length),
                      type: 'external',
                      href: 'https://',
                      openInNewTab: true,
                      label: { zh: '新链接', en: 'New Link' },
                    },
                  ],
                })
              }
            >
              <Link2 className="mr-1 size-4" />
              Add Link
            </Button>
          </div>

          {project.topNavItems.length ? (
            <div className="space-y-3">
              {project.topNavItems.map((item, index) => (
                <div key={item.id} className="space-y-3 rounded-lg border border-fd-border p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-fd-foreground">{item.id}</div>
                      <div className="text-xs text-fd-muted-foreground">
                        {item.type === 'nav-group' ? 'Scoped sidebar group' : 'External link'}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={index === 0}
                        onClick={() => {
                          const next = [...project.topNavItems];
                          const [current] = next.splice(index, 1);
                          next.splice(index - 1, 0, current);
                          onProjectChange({ topNavItems: next });
                        }}
                      >
                        <ArrowUp className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={index === project.topNavItems.length - 1}
                        onClick={() => {
                          const next = [...project.topNavItems];
                          const [current] = next.splice(index, 1);
                          next.splice(index + 1, 0, current);
                          onProjectChange({ topNavItems: next });
                        }}
                      >
                        <ArrowDown className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          onProjectChange({
                            topNavItems: project.topNavItems.filter((_, itemIndex) => itemIndex !== index),
                          })
                        }
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>

                  <div>
                    <div className="mb-1 text-xs text-fd-muted-foreground">Item Type</div>
                    <Select
                      value={item.type}
                      onValueChange={(value) => {
                        const next = [...project.topNavItems];
                        next[index] =
                          value === 'nav-group'
                            ? {
                                id: item.id,
                                type: 'nav-group',
                                groupId: navGroupOptions[0]?.id ?? '',
                                label: item.label,
                              }
                            : {
                                id: item.id,
                                type: 'external',
                                href: item.type === 'external' ? item.href : 'https://',
                                openInNewTab: item.type === 'external' ? item.openInNewTab : true,
                                label: item.label,
                              };
                        onProjectChange({ topNavItems: next });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select item type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="nav-group">Navigation Group</SelectItem>
                        <SelectItem value="external">External Link</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <div className="mb-1 text-xs text-fd-muted-foreground">Label (ZH)</div>
                      <Input
                        value={getTopNavLabelValue(item, 'zh')}
                        onChange={(e) => {
                          const next = [...project.topNavItems];
                          next[index] = setTopNavLabelValue(item, 'zh', e.target.value);
                          onProjectChange({ topNavItems: next });
                        }}
                        placeholder="指南"
                      />
                    </div>
                    <div>
                      <div className="mb-1 text-xs text-fd-muted-foreground">Label (EN)</div>
                      <Input
                        value={getTopNavLabelValue(item, 'en')}
                        onChange={(e) => {
                          const next = [...project.topNavItems];
                          next[index] = setTopNavLabelValue(item, 'en', e.target.value);
                          onProjectChange({ topNavItems: next });
                        }}
                        placeholder="Guides"
                      />
                    </div>
                  </div>

                  {item.type === 'nav-group' ? (
                    <div>
                      <div className="mb-1 text-xs text-fd-muted-foreground">Target Group</div>
                      <Select
                        value={item.groupId}
                        onValueChange={(value) => {
                          const next = [...project.topNavItems];
                          next[index] = { ...item, groupId: value };
                          onProjectChange({ topNavItems: next });
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select navigation group" />
                        </SelectTrigger>
                        <SelectContent>
                          {navGroupOptions.map((group) => (
                            <SelectItem key={group.id} value={group.id}>
                              {group.title} ({group.id})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div>
                        <div className="mb-1 text-xs text-fd-muted-foreground">External URL</div>
                        <Input
                          value={item.href}
                          onChange={(e) => {
                            const next = [...project.topNavItems];
                            next[index] = { ...item, href: e.target.value };
                            onProjectChange({ topNavItems: next });
                          }}
                          placeholder="https://..."
                        />
                      </div>
                      <label className="flex items-center justify-between gap-3 rounded-md border border-fd-border px-3 py-2 text-sm">
                        <div>
                          <div className="font-medium">Open in New Tab</div>
                          <div className="text-xs text-fd-muted-foreground">Open external links in a new tab.</div>
                        </div>
                        <input
                          type="checkbox"
                          checked={item.openInNewTab ?? false}
                          onChange={(e) => {
                            const next = [...project.topNavItems];
                            next[index] = { ...item, openInNewTab: e.target.checked };
                            onProjectChange({ topNavItems: next });
                          }}
                        />
                      </label>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-fd-border p-3 text-sm text-fd-muted-foreground">
              No top navigation items.
            </div>
          )}
        </SettingsSection>
      ) : null}

      <SettingsSection title="API Sources" description="Manage OpenAPI-backed references published by this docs project.">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() =>
              onProjectChange({
                apiSources: [...project.apiSources, createApiSourceDraft(project.defaultLanguage, project.apiSources.length)],
              })
            }
          >
            <Plus className="mr-1 size-4" />
            Add API Source
          </Button>
        </div>

        {project.apiSources.length ? (
          <div className="space-y-3">
            {project.apiSources.map((source, index) => (
              <div key={`${source.id}-${index}`} className="space-y-3 rounded-lg border border-fd-border p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-fd-foreground">{source.display.title || source.id}</div>
                    <div className="text-xs text-fd-muted-foreground">{source.id}</div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      onProjectChange({
                        apiSources: project.apiSources.filter((_, itemIndex) => itemIndex !== index),
                      })
                    }
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <div className="mb-1 text-xs text-fd-muted-foreground">Source ID</div>
                    <Input
                      value={source.id}
                      onChange={(e) => {
                        const next = [...project.apiSources];
                        next[index] = { ...source, id: e.target.value };
                        onProjectChange({ apiSources: next });
                      }}
                      placeholder="vault-isp"
                    />
                  </div>
                  <div>
                    <div className="mb-1 text-xs text-fd-muted-foreground">Title</div>
                    <Input
                      value={source.display.title}
                      onChange={(e) => {
                        const next = [...project.apiSources];
                        next[index] = {
                          ...source,
                          display: {
                            ...source.display,
                            title: e.target.value,
                          },
                        };
                        onProjectChange({ apiSources: next });
                      }}
                      placeholder="Vault ISP API"
                    />
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <div>
                    <div className="mb-1 text-xs text-fd-muted-foreground">Language</div>
                    <Select
                      value={source.lang}
                      onValueChange={(value) => {
                        const next = [...project.apiSources];
                        next[index] = { ...source, lang: value as DocsLang };
                        onProjectChange({ apiSources: next });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select language" />
                      </SelectTrigger>
                      <SelectContent>
                        {project.languages.map((language) => (
                          <SelectItem key={language} value={language}>
                            {formatLanguageLabel(language)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <div className="mb-1 text-xs text-fd-muted-foreground">Status</div>
                    <Select
                      value={source.status}
                      onValueChange={(value) => {
                        const next = [...project.apiSources];
                        next[index] = { ...source, status: value as ApiSourceDoc['status'] };
                        onProjectChange({ apiSources: next });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="in_review">In Review</SelectItem>
                        <SelectItem value="published">Published</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <div className="mb-1 text-xs text-fd-muted-foreground">Source Kind</div>
                    <Select
                      value={source.source.kind}
                      onValueChange={(value) => {
                        const next = [...project.apiSources];
                        next[index] =
                          value === 'file'
                            ? {
                                ...source,
                                source: {
                                  kind: 'file',
                                  path: source.source.kind === 'file' ? source.source.path : '',
                                },
                              }
                            : {
                                ...source,
                                source: {
                                  kind: 'url',
                                  url: source.source.kind === 'url' ? source.source.url : 'https://example.com/openapi.json',
                                },
                              };
                        onProjectChange({ apiSources: next });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select source kind" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="url">URL</SelectItem>
                        <SelectItem value="file">File</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <div className="mb-1 text-xs text-fd-muted-foreground">
                    {source.source.kind === 'url' ? 'OpenAPI URL' : 'OpenAPI File Path'}
                  </div>
                  <Input
                    value={source.source.kind === 'url' ? source.source.url : source.source.path}
                    onChange={(e) => {
                      const next = [...project.apiSources];
                      next[index] =
                        source.source.kind === 'url'
                          ? {
                              ...source,
                              source: {
                                kind: 'url',
                                url: e.target.value,
                              },
                            }
                          : {
                              ...source,
                              source: {
                                kind: 'file',
                                path: e.target.value,
                              },
                            };
                      onProjectChange({ apiSources: next });
                    }}
                    placeholder={source.source.kind === 'url' ? 'https://...' : 'openapi/spec.json'}
                  />
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <div className="mb-1 text-xs text-fd-muted-foreground">Scalar Route Base</div>
                    <Input
                      value={source.runtime?.routeBase ?? ''}
                      onChange={(e) => {
                        const next = [...project.apiSources];
                        next[index] = {
                          ...source,
                          runtime: {
                            ...source.runtime,
                            routeBase: e.target.value,
                            ...(source.runtime?.tryIt ? { tryIt: source.runtime.tryIt } : {}),
                          },
                        };
                        onProjectChange({ apiSources: next });
                      }}
                      placeholder={`/${source.lang}/reference/${source.id}`}
                    />
                  </div>

                  <label className="flex items-center justify-between gap-3 rounded-md border border-fd-border px-3 py-2 text-sm">
                    <div>
                      <div className="font-medium">Enable Try It Out</div>
                      <div className="text-xs text-fd-muted-foreground">Expose Scalar test requests for this source.</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={source.runtime?.tryIt?.enabled ?? false}
                      onChange={(e) => {
                        const next = [...project.apiSources];
                        next[index] = {
                          ...source,
                          runtime: {
                            ...source.runtime,
                            ...(source.runtime?.routeBase ? { routeBase: source.runtime.routeBase } : {}),
                            tryIt: {
                              enabled: e.target.checked,
                            },
                          },
                        };
                        onProjectChange({ apiSources: next });
                      }}
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-fd-border p-3 text-sm text-fd-muted-foreground">
            No API sources configured.
          </div>
        )}
      </SettingsSection>

      <SettingsSection title="Build" description="Output location for preview/build artifacts.">
        <div>
          <div className="mb-1 text-xs text-fd-muted-foreground">Build Output Directory</div>
          <Input
            value={project.outputDir}
            onChange={(e) => onProjectChange({ outputDir: e.target.value })}
            placeholder="dist"
            data-testid="studio-build-output-dir-input"
          />
        </div>
      </SettingsSection>
    </div>
  );
}

function PageSettingsContent({
  page,
  templates,
  onChange,
  onDeletePage,
  onSetReviewApproval,
}: {
  page: PageDoc | null;
  templates: ResolvedProjectPageTemplateDefinition[];
  onChange: (patch: Partial<PageDoc>) => void;
  onDeletePage: () => void;
  onSetReviewApproval: (approved: boolean) => void;
}) {
  if (!page) {
    return <div className="text-sm text-fd-muted-foreground">Select a page, then use Edit to open page settings.</div>;
  }

  const selectedTemplate = getPageTemplateById(templates, page.template);
  const metadataFields = selectedTemplate?.metadataSchema?.fields ?? [];
  const metadata = page.metadata ?? {};

  return (
    <div className="space-y-4">
      <SettingsSection title="Basics" description="Page metadata and public URL.">
        <div>
          <div className="mb-1 text-xs text-fd-muted-foreground">Display Title</div>
          <Input
            value={page.title}
            onChange={(e) => onChange({ title: e.target.value })}
            data-testid="studio-page-title-input"
          />
        </div>

        <div>
          <div className="mb-1 text-xs text-fd-muted-foreground">Slug</div>
          <Input
            value={page.slug}
            onChange={(e) => onChange({ slug: e.target.value })}
            data-testid="studio-page-slug-input"
          />
          <div className="mt-1 text-xs text-fd-muted-foreground">/{page.lang}/{page.slug}</div>
        </div>

        <div>
          <div className="mb-1 text-xs text-fd-muted-foreground">Description</div>
          <textarea
            value={page.description ?? ''}
            onChange={(e) => onChange({ description: e.target.value })}
            className="min-h-24 w-full resize-none rounded-md border border-fd-border bg-fd-background px-3 py-2 text-sm outline-none focus-visible:ring-1 focus-visible:ring-[color:var(--color-fd-ring)]"
            data-testid="studio-page-description-input"
          />
        </div>

        <div>
          <div className="mb-1 text-xs text-fd-muted-foreground">Template</div>
          <Select
            value={page.template ?? '__none__'}
            onValueChange={(value) =>
              onChange({
                template: value === '__none__' ? undefined : value,
                metadata: undefined,
              })
            }
          >
            <SelectTrigger data-testid="studio-page-template-trigger">
              <SelectValue placeholder="No template" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">No template</SelectItem>
              {templates.map((template) => (
                <SelectItem key={template.id} value={template.id}>
                  {getLocalizedLabel(template.label, page.lang)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedTemplate ? (
            <div className="mt-2 space-y-1 text-xs text-fd-muted-foreground">
              <div>{selectedTemplate.description ?? 'No template description.'}</div>
              {!selectedTemplate.builtIn ? <div>Base template: {selectedTemplate.baseTemplate}</div> : null}
            </div>
          ) : (
            <div className="mt-2 text-xs text-fd-muted-foreground">Optional. Select a template to attach structured metadata.</div>
          )}
        </div>
      </SettingsSection>

      {selectedTemplate ? (
        <SettingsSection
          title="Structured Metadata"
          description="Typed fields defined by the selected page template."
        >
          {metadataFields.length > 0 ? (
            <div className="space-y-3">
              {metadataFields.map((field) => {
                const label = getLocalizedLabel(field.label, page.lang);
                const value = metadata[field.id];
                const nextMetadata = (nextValue: unknown) => {
                  const baseMetadata = { ...(page.metadata ?? {}) };
                  if (
                    nextValue == null ||
                    nextValue === '' ||
                    (Array.isArray(nextValue) && nextValue.length === 0)
                  ) {
                    delete baseMetadata[field.id];
                  } else {
                    baseMetadata[field.id] = nextValue;
                  }

                  onChange({
                    metadata: Object.keys(baseMetadata).length > 0 ? baseMetadata : undefined,
                  });
                };

                return (
                  <div key={field.id}>
                    <div className="mb-1 flex items-center gap-2 text-xs text-fd-muted-foreground">
                      <span>{label}</span>
                      {field.required ? <Badge variant="secondary">Required</Badge> : null}
                      <Badge variant="default">{field.visibility === 'public' ? 'Public' : 'Internal'}</Badge>
                    </div>

                    {field.type === 'text' ? (
                      <textarea
                        value={typeof value === 'string' ? value : ''}
                        onChange={(e) => nextMetadata(e.target.value)}
                        className="min-h-24 w-full resize-none rounded-md border border-fd-border bg-fd-background px-3 py-2 text-sm outline-none focus-visible:ring-1 focus-visible:ring-[color:var(--color-fd-ring)]"
                        data-testid={metadataFieldTestId(field.id)}
                      />
                    ) : null}

                    {field.type === 'string' ? (
                      <Input
                        value={typeof value === 'string' ? value : ''}
                        onChange={(e) => nextMetadata(e.target.value)}
                        data-testid={metadataFieldTestId(field.id)}
                      />
                    ) : null}

                    {field.type === 'enum' ? (
                      <Select
                        value={typeof value === 'string' ? value : '__none__'}
                        onValueChange={(next) => nextMetadata(next === '__none__' ? undefined : next)}
                      >
                        <SelectTrigger data-testid={metadataFieldTestId(field.id)}>
                          <SelectValue placeholder="Select value" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">No value</SelectItem>
                          {(field.options ?? []).map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : null}

                    {field.type === 'boolean' ? (
                      <label className="flex items-center justify-between gap-3 rounded-md border border-fd-border px-3 py-2 text-sm">
                        <span>{typeof value === 'boolean' ? (value ? 'Enabled' : 'Disabled') : 'Disabled'}</span>
                        <input
                          type="checkbox"
                          checked={value === true}
                          onChange={(e) => nextMetadata(e.target.checked)}
                          data-testid={metadataFieldTestId(field.id)}
                        />
                      </label>
                    ) : null}

                    {field.type === 'date' ? (
                      <Input
                        type="date"
                        value={typeof value === 'string' ? value : ''}
                        onChange={(e) => nextMetadata(e.target.value)}
                        data-testid={metadataFieldTestId(field.id)}
                      />
                    ) : null}

                    {field.type === 'string[]' ? (
                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-2">
                          {Array.isArray(value) && value.length > 0 ? (
                            value.map((item) => (
                              <Badge key={`${field.id}-${item}`} variant="secondary">
                                {item}
                              </Badge>
                            ))
                          ) : (
                            <div className="text-sm text-fd-muted-foreground">No values</div>
                          )}
                        </div>
                        <Input
                          value={Array.isArray(value) ? value.join(', ') : ''}
                          onChange={(e) => nextMetadata(parseCommaSeparatedValues(e.target.value))}
                          placeholder="alice, bob, platform-team"
                          data-testid={metadataFieldTestId(field.id)}
                        />
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-sm text-fd-muted-foreground">This template does not define structured metadata fields.</div>
          )}
        </SettingsSection>
      ) : null}

      <SettingsSection title="Publishing" description="Workflow state and content taxonomy.">
        <div>
          <div className="mb-1 text-xs text-fd-muted-foreground">Status</div>
          <Select
            value={page.status}
            onValueChange={(v) => {
              const next = v as PageStatus;
              if (next === page.status) return;
              if (next === 'published' && page.review?.required && !page.review.approvedAt) {
                window.alert('This page requires an explicit review approval before it can be published.');
                return;
              }
              if (next === 'published' && page.status !== 'published') {
                const ok = window.confirm(
                  '将状态设置为 published 后，该页面会在构建生成的阅读站/搜索索引/llms.txt/WebMCP 中对外可见。确认继续？',
                );
                if (!ok) return;
              }
              if (next !== 'published' && page.status === 'published') {
                const ok = window.confirm('将页面从 published 下线后，下一次构建将不会再对外展示。确认继续？');
                if (!ok) return;
              }
              onChange({ status: next });
            }}
          >
            <SelectTrigger data-testid="studio-page-status-trigger">
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="in_review">In Review</SelectItem>
              <SelectItem value="published">Published</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <div className="mb-1 text-xs text-fd-muted-foreground">Tags</div>
          <div className="mb-2 flex flex-wrap gap-2">
            {(Array.isArray(page.tags) ? page.tags : []).length ? (
              (page.tags ?? []).map((tag) => (
                <Badge key={tag} variant="secondary">
                  {tag}
                </Badge>
              ))
            ) : (
              <div className="text-sm text-fd-muted-foreground">No tags</div>
            )}
          </div>
          <Input
            value={(page.tags ?? []).join(', ')}
            onChange={(e) => onChange({ tags: parseTags(e.target.value) })}
            placeholder="guide, api, onboarding"
            data-testid="studio-page-tags-input"
          />
        </div>
      </SettingsSection>

      {page.review?.required ? (
        <SettingsSection title="Review Workflow" description="Publication approval for imported or generated content.">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-medium text-fd-foreground">{getReviewSourceLabel(page.review)}</div>
            <Badge variant="secondary">{page.status === 'published' ? 'Approved' : 'Needs Review'}</Badge>
          </div>

          <div className="space-y-1 text-xs text-fd-muted-foreground">
            <div>Source ID: {page.review.sourceId}</div>
            {page.review.itemId ? <div>Item ID: {page.review.itemId}</div> : null}
            {page.review.sourcePath ? <div>Source Path: {page.review.sourcePath}</div> : null}
            {page.review.approvedAt ? <div>Approved At: {page.review.approvedAt}</div> : null}
          </div>

          <div className="flex gap-2">
            {page.review.approvedAt ? (
              <Button type="button" variant="secondary" size="sm" onClick={() => onSetReviewApproval(false)}>
                Clear Approval
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                onClick={() => onSetReviewApproval(true)}
                data-testid="studio-approve-publication-button"
              >
                Approve For Publication
              </Button>
            )}
          </div>

          {page.review.warnings?.length ? (
            <div className="space-y-2">
              {page.review.warnings.map((warning) => (
                <div
                  key={warning.code + warning.message}
                  className="rounded-md border border-amber-200 bg-amber-50/80 p-2 text-xs text-amber-950"
                >
                  <div className="font-medium">{warning.code}</div>
                  <div className="mt-1">{warning.message}</div>
                  {warning.remediation ? <div className="mt-1 text-amber-800">Fix: {warning.remediation}</div> : null}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs text-fd-muted-foreground">No blocking review warnings.</div>
          )}
        </SettingsSection>
      ) : null}

      <section className="rounded-lg border border-red-200 bg-red-50/80 p-3">
        <div className="text-sm font-medium text-red-900">Danger Zone</div>
        <div className="mt-1 text-xs leading-5 text-red-900">
          Delete this page file and remove all navigation references in the current language.
        </div>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          className="mt-3"
          onClick={onDeletePage}
          data-testid="studio-delete-page-button"
        >
          Delete Page
        </Button>
      </section>
    </div>
  );
}

export function LocalStudioSettings({
  mode,
  page,
  project,
  navGroupOptions,
  onChange,
  onSetReviewApproval,
  onDeletePage,
  onProjectChange,
}: {
  mode: 'page' | 'project';
  page: PageDoc | null;
  project: ProjectSettingsValue | null;
  navGroupOptions: Array<{ id: string; title: string }>;
  onChange: (patch: Partial<PageDoc>) => void;
  onSetReviewApproval: (approved: boolean) => void;
  onDeletePage: () => void;
  onProjectChange: (patch: ProjectSettingsPatch) => void;
}) {
  return (
    <div className="h-full overflow-y-auto p-4">
      {mode === 'project' ? (
        <ProjectSettingsContent
          project={project}
          navGroupOptions={navGroupOptions}
          onProjectChange={onProjectChange}
        />
      ) : (
        <PageSettingsContent
          page={page}
          templates={project?.authoringTemplates ?? []}
          onChange={onChange}
          onDeletePage={onDeletePage}
          onSetReviewApproval={onSetReviewApproval}
        />
      )}
    </div>
  );
}
