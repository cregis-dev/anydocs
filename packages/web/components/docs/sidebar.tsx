'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ChevronRight } from 'lucide-react';

import type { DocsLang, NavItem, NavigationDoc, PublishedPageDoc } from '@/lib/docs/types';
import { SearchPanel } from '@/components/docs/search-panel';
import { getDocsUiCopy } from '@/components/docs/docs-ui-copy';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';

function findPage(pages: PublishedPageDoc[], pageId: string) {
  return pages.find((p) => p.id === pageId) ?? null;
}

const LANGUAGE_META: Record<string, { label: string }> = {
  en: { label: 'English' },
  es: { label: 'Español' },
  fr: { label: 'Français' },
  zh: { label: '简体中文' },
};

function getLanguageMeta(language: DocsLang) {
  return LANGUAGE_META[language] ?? { label: language.toUpperCase() };
}

function buildLanguageHref(pathname: string, currentLang: DocsLang, nextLang: DocsLang) {
  if (!pathname || pathname === `/${currentLang}`) {
    return `/${nextLang}`;
  }

  if (pathname.startsWith(`/${currentLang}/`)) {
    return `/${nextLang}${pathname.slice(currentLang.length + 1)}`;
  }

  return `/${nextLang}`;
}

function normalizeRoutePath(pathname: string) {
  if (!pathname || pathname === '/') {
    return '/';
  }

  return pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
}

function containsActivePage(item: NavItem, activePageId: string | null): boolean {
  if (!activePageId) {
    return false;
  }

  if (item.type === 'page') {
    return item.pageId === activePageId;
  }

  if (item.type === 'link') {
    return false;
  }

  return item.children.some((child) => containsActivePage(child, activePageId));
}

function NavGroup({
  title,
  children,
  depth,
  defaultOpen,
  isActiveBranch,
  groupSummaryClassName,
  nestedGroupSummaryClassName,
  groupTitleClassName,
  groupBranchClassName,
}: {
  title: string;
  children: React.ReactNode;
  depth: number;
  defaultOpen: boolean;
  isActiveBranch: boolean;
  groupSummaryClassName?: string;
  nestedGroupSummaryClassName?: string;
  groupTitleClassName?: string;
  groupBranchClassName?: string;
}) {
  const isTopLevel = depth === 0;

  return (
    <details
      className={cn(
        'group [&_summary::-webkit-details-marker]:hidden',
        isTopLevel ? 'mt-2.5 first:mt-0' : 'mt-1.5',
      )}
      open={defaultOpen}
    >
      <summary
        className={cn(
          'flex cursor-pointer list-none items-center gap-2 rounded-xl transition',
          isTopLevel
            ? 'px-2 py-2 hover:bg-[color:var(--docs-sidebar-hover,var(--fd-muted))] group-open:bg-[color:var(--docs-sidebar-group-background,var(--docs-sidebar-hover,var(--fd-muted)))]'
            : 'px-3 py-2 hover:bg-[color:var(--docs-sidebar-hover,var(--fd-muted))]',
          isActiveBranch &&
            'bg-[color:var(--docs-sidebar-group-background,var(--docs-sidebar-hover,var(--fd-muted)))]',
          isTopLevel ? groupSummaryClassName : nestedGroupSummaryClassName,
        )}
      >
        <ChevronRight
          className={cn(
            'shrink-0 text-[color:var(--docs-sidebar-link-subtle,var(--fd-muted-foreground))] transition-transform duration-200 group-open:rotate-90',
            isTopLevel ? 'h-3.5 w-3.5' : 'h-4 w-4',
            isActiveBranch && 'text-[color:var(--docs-sidebar-group-accent,var(--fd-primary))]',
          )}
        />
        <span
          className={cn(
            'min-w-0 truncate',
            isTopLevel
              ? 'text-[14px] font-medium tracking-[-0.01em] text-[color:var(--docs-sidebar-link,var(--fd-foreground))] group-open:text-[color:var(--docs-sidebar-group-title,var(--fd-foreground))]'
              : 'text-[14px] leading-5 text-[color:var(--docs-sidebar-link-subtle,var(--fd-muted-foreground))]',
            isActiveBranch &&
              'text-[color:var(--docs-sidebar-group-title,var(--fd-foreground))]',
            groupTitleClassName,
          )}
        >
          {title}
        </span>
      </summary>

      <div
        className={cn(
          isTopLevel
            ? 'ml-3 mt-2 space-y-1 border-l pl-3'
            : 'ml-4 mt-2 space-y-1 border-l pl-3',
          isActiveBranch &&
            'border-[color:color-mix(in_srgb,var(--docs-sidebar-group-accent,var(--fd-primary))_22%,white)]',
          groupBranchClassName,
        )}
        data-docs-divider
      >
        {children}
      </div>
    </details>
  );
}

function NavNode({
  lang,
  item,
  pages,
  activePageId,
  depth,
  rootFolderDisplay,
  groupSummaryClassName,
  nestedGroupSummaryClassName,
  groupTitleClassName,
  groupBranchClassName,
  sectionHeadingClassName,
  linkClassName,
  activeLinkClassName,
  inactiveLinkClassName,
}: {
  lang: DocsLang;
  item: NavItem;
  pages: PublishedPageDoc[];
  activePageId: string | null;
  depth: number;
  rootFolderDisplay: 'collapsible' | 'section';
  groupSummaryClassName?: string;
  nestedGroupSummaryClassName?: string;
  groupTitleClassName?: string;
  groupBranchClassName?: string;
  sectionHeadingClassName?: string;
  linkClassName?: string;
  activeLinkClassName?: string;
  inactiveLinkClassName?: string;
}) {
  if (item.type === 'section') {
    const isActiveBranch = containsActivePage(item, activePageId);
    return (
      <NavGroup
        title={item.title}
        depth={depth}
        defaultOpen={isActiveBranch}
        isActiveBranch={isActiveBranch}
        groupSummaryClassName={groupSummaryClassName}
        nestedGroupSummaryClassName={nestedGroupSummaryClassName}
        groupTitleClassName={groupTitleClassName}
        groupBranchClassName={groupBranchClassName}
      >
        <>
          {item.children.map((c, idx) => (
            <NavNode
              key={`${item.title}-${idx}`}
              lang={lang}
              item={c}
              pages={pages}
              activePageId={activePageId}
              depth={depth + 1}
              rootFolderDisplay={rootFolderDisplay}
              groupSummaryClassName={groupSummaryClassName}
              nestedGroupSummaryClassName={nestedGroupSummaryClassName}
              groupTitleClassName={groupTitleClassName}
              groupBranchClassName={groupBranchClassName}
              sectionHeadingClassName={sectionHeadingClassName}
              linkClassName={linkClassName}
              activeLinkClassName={activeLinkClassName}
              inactiveLinkClassName={inactiveLinkClassName}
            />
          ))}
        </>
      </NavGroup>
    );
  }

  if (item.type === 'folder') {
    if (rootFolderDisplay === 'section' && depth === 0) {
      return (
        <div className="mt-8 first:mt-0">
          <div
            className={cn(
              'px-2 pb-3 text-[15px] font-semibold tracking-[-0.02em] text-[color:var(--docs-sidebar-group-title,var(--fd-foreground))]',
              sectionHeadingClassName,
            )}
          >
            {item.title}
          </div>
          <div className="space-y-1">
            {item.children.map((c, idx) => (
              <NavNode
                key={`${item.title}-${idx}`}
                lang={lang}
                item={c}
                pages={pages}
                activePageId={activePageId}
                depth={depth + 1}
                rootFolderDisplay={rootFolderDisplay}
                groupSummaryClassName={groupSummaryClassName}
                nestedGroupSummaryClassName={nestedGroupSummaryClassName}
                groupTitleClassName={groupTitleClassName}
                groupBranchClassName={groupBranchClassName}
                sectionHeadingClassName={sectionHeadingClassName}
                linkClassName={linkClassName}
                activeLinkClassName={activeLinkClassName}
                inactiveLinkClassName={inactiveLinkClassName}
              />
            ))}
          </div>
        </div>
      );
    }

    const isActiveBranch = containsActivePage(item, activePageId);
    return (
      <NavGroup
        title={item.title}
        depth={depth}
        defaultOpen={isActiveBranch}
        isActiveBranch={isActiveBranch}
        groupSummaryClassName={groupSummaryClassName}
        nestedGroupSummaryClassName={nestedGroupSummaryClassName}
        groupTitleClassName={groupTitleClassName}
        groupBranchClassName={groupBranchClassName}
      >
        <>
          {item.children.map((c, idx) => (
            <NavNode
              key={`${item.title}-${idx}`}
              lang={lang}
              item={c}
              pages={pages}
              activePageId={activePageId}
              depth={depth + 1}
              rootFolderDisplay={rootFolderDisplay}
              groupSummaryClassName={groupSummaryClassName}
              nestedGroupSummaryClassName={nestedGroupSummaryClassName}
              groupTitleClassName={groupTitleClassName}
              groupBranchClassName={groupBranchClassName}
              sectionHeadingClassName={sectionHeadingClassName}
              linkClassName={linkClassName}
              activeLinkClassName={activeLinkClassName}
              inactiveLinkClassName={inactiveLinkClassName}
            />
          ))}
        </>
      </NavGroup>
    );
  }

  if (item.type === 'link') {
    return (
      <a
        href={item.href}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          'block rounded-lg px-3 py-2 text-[14px] leading-5 text-[color:var(--docs-sidebar-link-subtle,var(--fd-muted-foreground))] transition hover:bg-[color:var(--docs-sidebar-hover,var(--fd-muted))] hover:text-[color:var(--docs-sidebar-link,var(--fd-foreground))]',
          linkClassName,
          inactiveLinkClassName,
        )}
      >
        {item.title}
      </a>
    );
  }

  const page = findPage(pages, item.pageId);
  if (!page) return null;
  const active = activePageId === page.id;
  const title = item.titleOverride ?? page.title;
  return (
    <Link
      href={`/${lang}/${page.slug}`}
      className={cn(
        rootFolderDisplay === 'section'
          ? 'block rounded-lg border border-transparent px-3 py-2 text-[13px] leading-5 transition'
          : 'block rounded-r-md rounded-l-none px-3 py-2 text-[14px] leading-5 transition',
        active
          ? rootFolderDisplay === 'section'
            ? 'border-[color:color-mix(in_srgb,var(--docs-sidebar-group-accent,var(--fd-primary))_18%,white)] bg-[color:var(--docs-sidebar-active-background)] font-medium text-[color:var(--docs-sidebar-active-foreground,var(--fd-foreground))]'
            : 'border-l-4 border-[color:var(--docs-sidebar-active-border,var(--fd-foreground))] bg-[color:var(--docs-sidebar-active-background,var(--fd-muted))] font-medium text-[color:var(--docs-sidebar-active-foreground,var(--fd-foreground))]'
          : rootFolderDisplay === 'section'
            ? 'text-[color:var(--docs-sidebar-link-subtle,var(--fd-muted-foreground))] hover:bg-[color:var(--docs-sidebar-hover,var(--fd-muted))] hover:text-[color:var(--docs-sidebar-link,var(--fd-foreground))]'
            : 'border-l-4 border-transparent text-[color:var(--docs-sidebar-link-subtle,var(--fd-muted-foreground))] hover:bg-[color:var(--docs-sidebar-hover,var(--fd-muted))] hover:text-[color:var(--docs-sidebar-link,var(--fd-foreground))]',
        linkClassName,
        active ? activeLinkClassName : inactiveLinkClassName,
      )}
      aria-current={active ? 'page' : undefined}
    >
      {title}
    </Link>
  );
}

type DocsSidebarProps = {
  lang: DocsLang;
  nav: NavigationDoc;
  pages: PublishedPageDoc[];
  searchIndexHref?: string;
  homeLabel?: string;
  showHomeLink?: boolean;
  showSearch?: boolean;
  branding?: {
    siteTitle?: string;
    logoSrc?: string;
    logoAlt?: string;
  };
  availableLanguages?: DocsLang[];
  showLanguageSwitcher?: boolean;
  className?: string;
  rootFolderDisplay?: 'collapsible' | 'section';
  insetClassName?: string;
  fillHeight?: boolean;
  searchWrapperClassName?: string;
  searchPlaceholder?: string;
  searchInputClassName?: string;
  searchResultsClassName?: string;
  navWrapperClassName?: string;
  navListClassName?: string;
  footerClassName?: string;
  brandTitleClassName?: string;
  groupSummaryClassName?: string;
  nestedGroupSummaryClassName?: string;
  groupTitleClassName?: string;
  groupBranchClassName?: string;
  sectionHeadingClassName?: string;
  linkClassName?: string;
  activeLinkClassName?: string;
  inactiveLinkClassName?: string;
  languageTriggerClassName?: string;
  languageContentClassName?: string;
  languageItemClassName?: string;
};

export function DocsSidebar({
  lang,
  nav,
  pages,
  searchIndexHref,
  homeLabel,
  showHomeLink = true,
  showSearch = true,
  branding,
  availableLanguages = [],
  showLanguageSwitcher = false,
  className,
  rootFolderDisplay = 'collapsible',
  insetClassName,
  fillHeight = true,
  searchWrapperClassName,
  searchPlaceholder,
  searchInputClassName,
  searchResultsClassName,
  navWrapperClassName,
  navListClassName,
  footerClassName,
  brandTitleClassName,
  groupSummaryClassName,
  nestedGroupSummaryClassName,
  groupTitleClassName,
  groupBranchClassName,
  sectionHeadingClassName,
  linkClassName,
  activeLinkClassName,
  inactiveLinkClassName,
  languageTriggerClassName,
  languageContentClassName,
  languageItemClassName,
}: DocsSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const copy = getDocsUiCopy(lang);
  const normalizedPathname = normalizeRoutePath(pathname);
  const activePageId = (() => {
    for (const p of pages) {
      const href = `/${lang}/${p.slug}`;
      if (normalizedPathname === normalizeRoutePath(href)) return p.id;
    }
    return null;
  })();
  const siteTitle = branding?.siteTitle?.trim() ?? '';
  const hasLogo = Boolean(branding?.logoSrc);
  const hasTitle = siteTitle.length > 0;
  const showBranding = hasLogo || hasTitle;
  const showLanguageLinks = showLanguageSwitcher && availableLanguages.length > 1;
  const activeLanguageMeta = getLanguageMeta(lang);
  const showFooter = showLanguageLinks;

  return (
    <aside
      aria-label={copy.sidebar.navigationLabel}
      className={cn(
        'flex min-h-0 flex-col overflow-hidden border-r bg-fd-card',
        fillHeight && 'h-full',
        className,
      )}
      data-docs-divider
    >
      {showBranding ? (
        <Link
          href={`/${lang}`}
          className={cn(
            'shrink-0 px-6 pt-6 transition hover:opacity-85',
            insetClassName,
            hasLogo && hasTitle && 'flex items-center gap-3',
            hasLogo && !hasTitle && 'inline-flex items-center',
            !hasLogo && hasTitle && 'block',
          )}
        >
          {hasLogo ? (
            <span
              className={cn(
                'flex shrink-0 items-center justify-center overflow-hidden',
                hasTitle ? 'h-10 w-10 rounded-2xl' : 'h-12 w-12 rounded-2xl',
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={branding?.logoSrc}
                alt={branding?.logoAlt ?? (hasTitle ? `${siteTitle} logo` : copy.common.projectLogoAlt)}
                className="h-full w-full object-contain"
              />
            </span>
          ) : null}

          {hasTitle ? (
            <span className={cn('min-w-0', !hasLogo && 'block')}>
              <span
                className={cn(
                  'block break-words text-[20px] font-bold leading-7 tracking-[-0.025em] text-fd-foreground',
                  brandTitleClassName,
                )}
              >
                {siteTitle}
              </span>
            </span>
          ) : null}
        </Link>
      ) : null}

      {showSearch ? (
        <div className={cn('shrink-0 px-6 pt-4', insetClassName, searchWrapperClassName)}>
          <SearchPanel
            lang={lang}
            indexHref={searchIndexHref}
            placeholder={searchPlaceholder}
            inputClassName={cn(
              'border-[color:var(--docs-search-border,var(--fd-border))] bg-[color:var(--docs-search-background,var(--fd-muted))] px-4 text-sm text-[color:var(--docs-body-copy,var(--fd-foreground))] placeholder:text-[color:var(--docs-search-placeholder,var(--fd-muted-foreground))]',
              searchInputClassName,
            )}
            resultsClassName={cn(
              'rounded-xl border-[color:var(--docs-search-border,var(--fd-border))] bg-fd-background shadow-lg',
              searchResultsClassName,
            )}
          />
        </div>
      ) : null}

      <div
        className={cn(
          'min-h-0 px-6 pb-6 pt-5',
          fillHeight ? 'flex-1 overflow-y-auto' : 'overflow-visible',
          insetClassName,
          navWrapperClassName,
        )}
      >
        <div className={cn('space-y-1.5', navListClassName)}>
          {nav.items.map((item, idx) => (
            <NavNode
              key={idx}
              lang={lang}
              item={item}
              pages={pages}
              activePageId={activePageId}
              depth={0}
              rootFolderDisplay={rootFolderDisplay}
              groupSummaryClassName={groupSummaryClassName}
              nestedGroupSummaryClassName={nestedGroupSummaryClassName}
              groupTitleClassName={groupTitleClassName}
              groupBranchClassName={groupBranchClassName}
              sectionHeadingClassName={sectionHeadingClassName}
              linkClassName={linkClassName}
              activeLinkClassName={activeLinkClassName}
              inactiveLinkClassName={inactiveLinkClassName}
            />
          ))}
        </div>
      </div>

      {showFooter ? (
        <div
          className={cn(
            'space-y-4 border-t px-6 py-6 text-xs text-fd-muted-foreground',
            insetClassName,
            footerClassName,
          )}
          data-docs-divider
        >
          {showHomeLink ? (
            <div className="flex items-center justify-between gap-3">
              <Link href={`/${lang}`} className="font-medium text-fd-foreground transition hover:text-fd-primary">
                {homeLabel ?? copy.sidebar.homeLabel}
              </Link>
            </div>
          ) : null}

          <div>
            <Select
              value={lang}
              onValueChange={(value) => {
                const nextLang = value as DocsLang;
                if (nextLang === lang) {
                  return;
                }
                router.push(buildLanguageHref(pathname, lang, nextLang));
              }}
            >
              <SelectTrigger
                className={cn(
                  'inline-flex h-10 w-full min-w-0 rounded-xl border-[color:var(--docs-divider,var(--fd-border))] bg-[color:var(--docs-sidebar-brand-surface,var(--fd-background))] px-4 text-sm font-normal text-[color:var(--docs-sidebar-link,var(--fd-foreground))] shadow-none',
                  languageTriggerClassName,
                )}
              >
                <span className="truncate pr-2">{activeLanguageMeta.label}</span>
              </SelectTrigger>
              <SelectContent
                className={cn(
                  'min-w-[12rem] rounded-[1.25rem] border-[color:var(--docs-divider,var(--fd-border))] bg-fd-popover p-2 shadow-lg',
                  languageContentClassName,
                )}
              >
                {availableLanguages.map((language) => {
                  const languageMeta = getLanguageMeta(language);

                  return (
                    <SelectItem
                      key={language}
                      value={language}
                      className={cn(
                        'rounded-xl py-3 pl-8 pr-4 text-sm font-medium focus:bg-[color:var(--docs-sidebar-hover,var(--fd-muted))]',
                        languageItemClassName,
                      )}
                    >
                      <span>{languageMeta.label}</span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        </div>
      ) : null}
    </aside>
  );
}
