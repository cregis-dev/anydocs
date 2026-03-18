'use client';

import type { ProjectSiteTopNavItem } from '@anydocs/core';
import { ArrowDown, ArrowUp, Link2, Plus, Trash2 } from 'lucide-react';

import type { DocsLang } from '@/lib/docs/types';
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

function parseTags(raw: string) {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
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

export function LocalStudioSettings({
  page,
  project,
  navGroupOptions,
  onChange,
  onSetReviewApproval,
  onDeletePage,
  onProjectChange,
}: {
  page: PageDoc | null;
  project: {
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
    outputDir: string;
  } | null;
  navGroupOptions: Array<{ id: string; title: string }>;
  onChange: (patch: Partial<PageDoc>) => void;
  onSetReviewApproval: (approved: boolean) => void;
  onDeletePage: () => void;
  onProjectChange: (patch: {
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
    languages?: DocsLang[];
    outputDir?: string;
  }) => void;
}) {
  const selectedTheme = project ? docsThemes.find((theme) => theme.id === project.themeId) ?? null : null;
  const topNavSupported = selectedTheme?.capabilities.topNav ?? false;

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="text-xs font-semibold tracking-wider text-fd-muted-foreground">PROJECT SETTINGS</div>

      {project ? (
        <div className="mt-3 space-y-3">
          <div>
            <div className="mb-1 text-xs text-fd-muted-foreground">Project Name</div>
            <Input
              value={project.name}
              onChange={(e) => onProjectChange({ name: e.target.value })}
              data-testid="studio-project-name-input"
            />
          </div>

          <div>
            <div className="mb-1 text-xs text-fd-muted-foreground">Default Language</div>
            <Select
              value={project.defaultLanguage}
              onValueChange={(value) => onProjectChange({ defaultLanguage: value as DocsLang })}
            >
              <SelectTrigger>
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
            <div className="space-y-2 rounded-lg border border-fd-border bg-fd-background p-3">
              {SUPPORTED_DOCS_LANGUAGES.map((language) => {
                const checked = project.languages.includes(language);
                const disableUncheck = checked && project.languages.length === 1;

                return (
                  <label key={language} className="flex items-center justify-between gap-3 text-sm">
                    <div>
                      <div className="font-medium">{formatLanguageLabel(language)}</div>
                      <div className="text-xs text-fd-muted-foreground">
                        {language === project.defaultLanguage ? 'Default language' : 'Optional language variant'}
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
                          ...(normalized.includes(project.defaultLanguage)
                            ? {}
                            : { defaultLanguage: normalized[0] }),
                        });
                      }}
                    />
                  </label>
                );
              })}
            </div>
            <div className="mt-1 text-xs text-fd-muted-foreground">
              新启用语言会自动创建对应的 `pages/&lt;lang&gt;/` 与 `navigation/&lt;lang&gt;.json`。
            </div>
          </div>

          <div>
            <div className="mb-1 text-xs text-fd-muted-foreground">Docs Theme</div>
            <Select value={project.themeId} onValueChange={(value) => onProjectChange({ themeId: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Select theme" />
              </SelectTrigger>
              <SelectContent>
                {docsThemes.map((theme) => (
                  <SelectItem key={theme.id} value={theme.id}>
                    {theme.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="mt-1 text-xs text-fd-muted-foreground">
              每个项目只能配置一个阅读站主题，变更会同时影响 preview 与 build。
            </div>
            {selectedTheme ? (
              <div className="mt-3 rounded-lg border border-fd-border bg-fd-background p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-medium text-fd-foreground">{selectedTheme.label}</div>
                  <Badge variant="secondary">{selectedTheme.id}</Badge>
                </div>
                <div className="mt-2 text-xs leading-5 text-fd-muted-foreground">{selectedTheme.description}</div>
                <div className="mt-3 space-y-1 text-xs text-fd-muted-foreground">
                  <div>Tone: {selectedTheme.tone}</div>
                  <div>Recommended: {selectedTheme.recommendedFor}</div>
                </div>
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
            <div className="mt-1 text-xs text-fd-muted-foreground">可选。覆盖阅读站头部品牌标题。</div>
          </div>

          <div>
            <div className="mb-1 text-xs text-fd-muted-foreground">Home Label</div>
            <Input
              value={project.homeLabel}
              onChange={(e) => onProjectChange({ homeLabel: e.target.value })}
              placeholder="Docs Home"
              data-testid="studio-home-label-input"
            />
            <div className="mt-1 text-xs text-fd-muted-foreground">可选。覆盖侧边栏底部首页链接文案。</div>
          </div>

          {project.themeId === 'classic-docs' ? (
            <div className="space-y-3 rounded-lg border border-fd-border bg-fd-background p-3">
              <div className="text-sm font-medium text-fd-foreground">Classic Docs Appearance</div>
              <div className="text-xs text-fd-muted-foreground">
                这些设置仅影响 `classic-docs` 主题的侧边栏品牌、搜索开关与强调色。
              </div>

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
                  <div className="text-xs text-fd-muted-foreground">关闭后会隐藏侧边栏顶部搜索框。</div>
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

              <div className="text-xs text-fd-muted-foreground">
                颜色仅接受 `#RRGGBB`。留空会回退到 theme 默认值。
              </div>
            </div>
          ) : null}

          <div>
            <div className="mb-1 text-xs text-fd-muted-foreground">Code Theme</div>
            <Select
              value={project.codeTheme}
              onValueChange={(value) => onProjectChange({ codeTheme: value as 'github-light' | 'github-dark' })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select code theme" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="github-dark">GitHub Dark</SelectItem>
                <SelectItem value="github-light">GitHub Light</SelectItem>
              </SelectContent>
            </Select>
            <div className="mt-1 text-xs text-fd-muted-foreground">当前先作为项目与构建 contract 保存，供后续代码高亮渲染接入。</div>
          </div>

          <div>
            <div className="mb-1 text-xs text-fd-muted-foreground">Build Output Directory</div>
            <Input
              value={project.outputDir}
              onChange={(e) => onProjectChange({ outputDir: e.target.value })}
              placeholder="dist"
              data-testid="studio-build-output-dir-input"
            />
            <div className="mt-1 text-xs text-fd-muted-foreground">
              可选。留空时使用默认 `dist/`；支持相对或绝对路径。
            </div>
          </div>

          {topNavSupported ? (
            <div className="space-y-3 rounded-lg border border-fd-border bg-fd-background p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-fd-foreground">Top Navigation</div>
                  <div className="text-xs text-fd-muted-foreground">
                    `atlas-docs` 使用顶导切换左侧分组，外链项不会改变侧边栏内容。
                  </div>
                </div>
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
                          <div className="mt-1 text-xs text-fd-muted-foreground">
                            仅支持引用当前语言导航中的顶层 section / folder id。
                          </div>
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
                              <div className="text-xs text-fd-muted-foreground">外链默认新窗口打开。</div>
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
                  No top navigation items. Add a navigation group or external link to populate the atlas header.
                </div>
              )}
            </div>
          ) : project.topNavItems.length ? (
            <div className="rounded-lg border border-fd-border bg-fd-background p-3 text-xs text-fd-muted-foreground">
              当前主题不会展示已保存的顶部导航配置；切换到 `atlas-docs` 后会继续保留并生效。
            </div>
          ) : null}
        </div>
      ) : (
        <div className="mt-3 text-sm text-fd-muted-foreground">Project Settings</div>
      )}

      <div className="mt-6 text-xs font-semibold tracking-wider text-fd-muted-foreground">DOCUMENT SETTINGS</div>

      {page ? (
        <>
          <div className="mt-3 space-y-3">
            <div>
              <div className="mb-1 text-xs text-fd-muted-foreground">Display Title</div>
              <Input
                value={page.title}
                onChange={(e) => onChange({ title: e.target.value })}
                data-testid="studio-page-title-input"
              />
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
              <div className="mb-1 text-xs text-fd-muted-foreground">Slug</div>
              <Input
                value={page.slug}
                onChange={(e) => onChange({ slug: e.target.value })}
                data-testid="studio-page-slug-input"
              />
              <div className="mt-1 text-xs text-fd-muted-foreground">Public URL: /{page.lang}/{page.slug}</div>
            </div>
          </div>

          <div className="mt-6 text-xs font-semibold tracking-wider text-fd-muted-foreground">TAXONOMY</div>
          <div className="mt-3 space-y-3">
            <div>
              <div className="mb-1 text-xs text-fd-muted-foreground">Tags</div>
              <div className="mb-2 flex flex-wrap gap-2">
                {(Array.isArray(page.tags) ? page.tags : []).length ? (
                  (page.tags ?? []).map((t) => (
                    <Badge key={t} variant="secondary">
                      {t}
                    </Badge>
                  ))
                ) : (
                  <div className="text-sm text-fd-muted-foreground">No tags</div>
                )}
              </div>
              <Input
                value={(page.tags ?? []).join(', ')}
                onChange={(e) => onChange({ tags: parseTags(e.target.value) })}
                placeholder="Add tag..."
                data-testid="studio-page-tags-input"
              />
            </div>

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
              <div className="mt-1 text-xs text-fd-muted-foreground">
                Draft/In Review 仅本地可见；Published 会在下一次构建产出中对外可见（并受导航 hidden 影响）。
              </div>
            </div>
          </div>

          <div className="mt-6 text-xs font-semibold tracking-wider text-fd-muted-foreground">DANGER ZONE</div>
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50/80 p-3">
            <div className="text-sm font-medium text-red-900">Delete Current Page</div>
            <div className="mt-1 text-xs leading-5 text-red-900">
              删除当前语言页面文件，并清理该语言导航中的全部页面引用。此操作不可撤销。
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
          </div>

          {page.review?.required ? (
            <>
              <div className="mt-6 text-xs font-semibold tracking-wider text-fd-muted-foreground">REVIEW PATH</div>
              <div className="mt-3 space-y-3 rounded-lg border border-amber-200 bg-amber-50/80 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-medium text-amber-950">{getReviewSourceLabel(page.review)}</div>
                  <Badge variant="secondary">{page.status === 'published' ? 'Approved' : 'Needs Review'}</Badge>
                </div>
                <div className="space-y-1 text-xs text-amber-900">
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
                    <Button type="button" size="sm" onClick={() => onSetReviewApproval(true)} data-testid="studio-approve-publication-button">
                      Approve For Publication
                    </Button>
                  )}
                </div>
                {page.review.warnings?.length ? (
                  <div className="space-y-2">
                    <div className="text-xs font-semibold tracking-wider text-amber-900">Warnings</div>
                    <div className="space-y-2">
                      {page.review.warnings.map((warning) => (
                        <div key={warning.code + warning.message} className="rounded-md border border-amber-200 bg-white/70 p-2 text-xs text-amber-950">
                          <div className="font-medium">{warning.code}</div>
                          <div className="mt-1">{warning.message}</div>
                          {warning.remediation ? (
                            <div className="mt-1 text-amber-800">Fix: {warning.remediation}</div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-amber-900">
                    No blocking warnings. Keep this page in Draft/In Review until the content and metadata are verified.
                  </div>
                )}
              </div>
            </>
          ) : null}
        </>
      ) : (
        <div className="mt-3 text-sm text-fd-muted-foreground">Document Settings</div>
      )}
    </div>
  );
}
