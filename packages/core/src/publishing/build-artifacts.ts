import { mkdir, readdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { ProjectContract, ProjectSiteNavigation, ProjectSiteTopNavItem } from '../types/project.ts';
import type { NavItem, PageDoc } from '../types/docs.ts';
import type { BuildWorkflowPublishedSiteResult } from '../services/build-service.ts';

type SearchIndexDoc = {
  id: string;
  slug: string;
  title: string;
  description: string;
  tags: string[];
  status: 'published';
  updatedAt: string | null;
  breadcrumbs: string[];
  text: string;
};

type MachineReadablePageDoc = {
  id: string;
  slug: string;
  href: string;
  title: string;
  description: string;
  tags: string[];
  updatedAt: string | null;
  breadcrumbs: string[];
};

type MachineReadableChunkDoc = {
  id: string;
  pageId: string;
  lang: string;
  slug: string;
  href: string;
  title: string;
  description: string;
  headingPath: string[];
  breadcrumbs: string[];
  order: number;
  tags: string[];
  updatedAt: string | null;
  text: string;
  summary?: string;
  tokenEstimate: number;
};

type MachineReadableArtifactIndex = {
  version: 1;
  generatedAt: string;
  projectId: string;
  publicationRule: 'published-only';
  site: {
    theme: {
      id: string;
      branding?: {
        siteTitle?: string;
        homeLabel?: string;
      };
      codeTheme?: string;
    };
    navigation?: {
      topNav?: ProjectSiteTopNavItem[];
    };
  };
  languages: Array<{
    lang: string;
    publishedPages: number;
    navigationItems: number;
    files: {
      searchIndex: string;
      navigation: string;
      pages: string;
      chunks: string;
    };
  }>;
};

type SerializedThemeMetadata = {
  id: string;
  branding?: {
    siteTitle?: string;
    homeLabel?: string;
    logoSrc?: string;
    logoAlt?: string;
  };
  chrome?: {
    showSearch?: boolean;
  };
  colors?: {
    primary?: string;
    primaryForeground?: string;
    accent?: string;
    accentForeground?: string;
    sidebarActive?: string;
    sidebarActiveForeground?: string;
  };
  codeTheme?: string;
};

type BuildManifest = {
  version: '1.0.0';
  buildTime: string;
  builder: {
    tool: string;
    version: string;
  };
  source: {
    projectRoot: string;
    projectId: string;
  site: {
    theme: {
      id: string;
      branding?: SerializedThemeMetadata['branding'];
      chrome?: SerializedThemeMetadata['chrome'];
      colors?: SerializedThemeMetadata['colors'];
      codeTheme?: string;
    };
    navigation?: SerializedSiteNavigationMetadata;
  };
  };
  output: {
    directory: string;
    structure: 'flat';
  };
  projects: Array<{
    projectId: string;
    languages: string[];
    site: {
      theme: {
        id: string;
        branding?: SerializedThemeMetadata['branding'];
        chrome?: SerializedThemeMetadata['chrome'];
        colors?: SerializedThemeMetadata['colors'];
        codeTheme?: string;
      };
      navigation?: SerializedSiteNavigationMetadata;
    };
    publishedPages: Record<string, number>;
    artifacts: {
      site: string;
      mcp: string;
      llms: string;
      searchIndexes: string[];
    };
  }>;
  deployment: {
    type: 'static';
    serverRequired: false;
    recommended: string[];
  };
};

type SerializedSiteNavigationMetadata = {
  topNav?: ProjectSiteNavigation['topNav'];
};

const CHUNK_MAX_CHARS = 2000;
const CHUNK_OVERLAP_CHARS = 200;

function stripMarkdown(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/[#>*~]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripLeadingTitleHeading(markdown: string, title: string): string {
  const lines = markdown.split('\n');
  let index = 0;

  while (index < lines.length && lines[index]?.trim() === '') {
    index += 1;
  }

  const firstLine = lines[index]?.trim();
  if (!firstLine) {
    return markdown;
  }

  const expectedHeading = `# ${title.trim()}`;
  if (firstLine !== expectedHeading) {
    return markdown;
  }

  index += 1;
  while (index < lines.length && lines[index]?.trim() === '') {
    index += 1;
  }

  return lines.slice(index).join('\n');
}

function stripLeadingTitleText(plainText: string, title: string): string {
  const normalizedText = plainText.trim();
  const normalizedTitle = title.trim();

  if (!normalizedText || !normalizedTitle) {
    return normalizedText;
  }

  if (normalizedText === normalizedTitle) {
    return '';
  }

  if (normalizedText.startsWith(`${normalizedTitle} `)) {
    return normalizedText.slice(normalizedTitle.length).trimStart();
  }

  return normalizedText;
}

function walkNavItems(items: NavItem[], trail: string[], callback: (item: NavItem, trail: string[]) => void): void {
  for (const item of items) {
    callback(item, trail);

    if (item.type === 'section' || item.type === 'folder') {
      const nextTrail = item.title ? [...trail, item.title] : trail;
      walkNavItems(item.children, nextTrail, callback);
    }
  }
}

function buildPageBreadcrumbs(items: NavItem[]): Map<string, string[]> {
  const breadcrumbs = new Map<string, string[]>();

  walkNavItems(items, [], (item, trail) => {
    if (item.type === 'page') {
      breadcrumbs.set(item.pageId, trail);
    }
  });

  return breadcrumbs;
}

function countNavigationItems(items: NavItem[]): number {
  let count = 0;

  for (const item of items) {
    count += 1;
    if (item.type === 'section' || item.type === 'folder') {
      count += countNavigationItems(item.children);
    }
  }

  return count;
}

function getPageText(page: PageDoc) {
  const markdown = page.render?.markdown ?? '';
  const plainText = page.render?.plainText ?? stripMarkdown(markdown);

  return {
    markdown,
    plainText,
  };
}

function toSearchDoc(page: PageDoc, breadcrumbs: string[]): SearchIndexDoc {
  const { plainText } = getPageText(page);

  return {
    id: page.id,
    slug: page.slug,
    title: page.title,
    description: page.description ?? '',
    tags: page.tags ?? [],
    status: 'published',
    updatedAt: page.updatedAt ?? null,
    breadcrumbs,
    text: plainText,
  };
}

function buildLlmsTxt(siteArtifacts: BuildWorkflowPublishedSiteResult[]): string {
  const lines: string[] = [];
  lines.push('# Docs (LLM-friendly index)');
  lines.push('');
  lines.push(`- Languages: ${siteArtifacts.map((entry) => entry.lang).join(', ')}`);
  lines.push(`- Base routes: ${siteArtifacts.map((entry) => `/${entry.lang}`).join(', ')}`);
  lines.push('');

  for (const site of siteArtifacts) {
    if (site.content.pages.length === 0) {
      continue;
    }

    lines.push(`## ${site.lang}`);
    lines.push('');

    for (const page of site.content.pages) {
      const title = page.title ?? page.slug;
      const description = page.description ? ` — ${page.description}` : '';
      lines.push(`- ${title} — /${site.lang}/${page.slug}${description}`);
    }

    lines.push('');
  }

  return lines.join('\n').trimEnd();
}

function buildLlmsFullTxt(
  contract: ProjectContract,
  siteArtifacts: BuildWorkflowPublishedSiteResult[],
  generatedAt: string,
): string {
  const lines: string[] = [];
  lines.push('# Docs Full Export');
  lines.push(`- Project: ${contract.config.projectId}`);
  lines.push(`- Languages: ${siteArtifacts.map((entry) => entry.lang).join(', ')}`);
  lines.push('- Publication Rule: published-only');
  lines.push(`- Generated At: ${generatedAt}`);
  lines.push('');

  for (const site of siteArtifacts) {
    lines.push(`## Language: ${site.lang}`);
    lines.push('');

    for (const page of site.content.pages) {
      const { plainText } = getPageText(page);
      const body = stripLeadingTitleText(plainText, page.title) || plainText.trim() || page.title.trim();
      const breadcrumbs = buildPageBreadcrumbs(site.content.navigation.items).get(page.id) ?? [];

      lines.push('### Page');
      lines.push(`- Page ID: ${page.id}`);
      lines.push(`- URL: /${site.lang}/${page.slug}`);
      lines.push(`- Title: ${page.title}`);
      lines.push(`- Breadcrumbs: ${breadcrumbs.length ? breadcrumbs.join(' > ') : '(none)'}`);
      lines.push(`- Tags: ${page.tags?.length ? page.tags.join(', ') : '(none)'}`);
      lines.push(`- Updated At: ${page.updatedAt ?? 'null'}`);
      lines.push('');
      lines.push(body);
      lines.push('');
    }
  }

  return lines.join('\n').trimEnd();
}

function extractMarkdownSections(markdown: string, title: string): Array<{ headingPath: string[]; text: string }> {
  const normalized = stripLeadingTitleHeading(markdown, title).replace(/\r\n/g, '\n').trim();
  if (!normalized) {
    return [];
  }

  const sections: Array<{ headingPath: string[]; text: string }> = [];
  const headingStack: Array<{ depth: number; title: string }> = [];
  const lines = normalized.split('\n');
  let currentHeadingPath: string[] = [];
  let currentLines: string[] = [];

  const flushCurrent = () => {
    const text = stripMarkdown(currentLines.join('\n'));
    if (!text) {
      return;
    }

    sections.push({
      headingPath: [...currentHeadingPath],
      text,
    });
  };

  for (const line of lines) {
    const headingMatch = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
    if (!headingMatch) {
      currentLines.push(line);
      continue;
    }

    flushCurrent();
    currentLines = [];

    const depth = headingMatch[1].length;
    const headingTitle = headingMatch[2].replace(/`/g, '').trim();
    while (headingStack.length > 0 && headingStack[headingStack.length - 1]!.depth >= depth) {
      headingStack.pop();
    }
    headingStack.push({ depth, title: headingTitle });
    currentHeadingPath = headingStack.map((entry) => entry.title);
  }

  flushCurrent();
  return sections;
}

function splitChunkText(text: string, maxChars = CHUNK_MAX_CHARS, overlapChars = CHUNK_OVERLAP_CHARS): string[] {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return [];
  }

  if (normalized.length <= maxChars) {
    return [normalized];
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < normalized.length) {
    let end = Math.min(normalized.length, start + maxChars);
    if (end < normalized.length) {
      const lastSpace = normalized.lastIndexOf(' ', end);
      if (lastSpace > start + Math.floor(maxChars * 0.6)) {
        end = lastSpace;
      }
    }

    const chunk = normalized.slice(start, end).trim();
    if (chunk) {
      chunks.push(chunk);
    }

    if (end >= normalized.length) {
      break;
    }

    start = Math.max(start + 1, end - overlapChars);
  }

  return chunks;
}

function toChunkDocs(site: BuildWorkflowPublishedSiteResult, page: PageDoc, breadcrumbs: string[]): MachineReadableChunkDoc[] {
  const { markdown, plainText } = getPageText(page);
  const sectionCandidates = extractMarkdownSections(markdown, page.title);
  const fallbackText = stripLeadingTitleText(plainText, page.title) || plainText.trim() || page.title.trim();
  const sections =
    sectionCandidates.length > 0
      ? sectionCandidates
      : fallbackText
        ? [{ headingPath: [] as string[], text: fallbackText }]
        : [];

  const chunks: MachineReadableChunkDoc[] = [];
  let order = 1;

  for (const section of sections) {
    for (const chunkText of splitChunkText(section.text)) {
      chunks.push({
        id: `${page.id}#${String(order).padStart(4, '0')}`,
        pageId: page.id,
        lang: site.lang,
        slug: page.slug,
        href: `/${site.lang}/${page.slug}`,
        title: page.title,
        description: page.description ?? '',
        headingPath: section.headingPath,
        breadcrumbs,
        order,
        tags: page.tags ?? [],
        updatedAt: page.updatedAt ?? null,
        text: chunkText,
        tokenEstimate: Math.max(1, Math.ceil(chunkText.length / 4)),
      });
      order += 1;
    }
  }

  if (chunks.length > 0) {
    return chunks;
  }

  return [
    {
      id: `${page.id}#0001`,
      pageId: page.id,
      lang: site.lang,
      slug: page.slug,
      href: `/${site.lang}/${page.slug}`,
      title: page.title,
      description: page.description ?? '',
      headingPath: [],
      breadcrumbs,
      order: 1,
      tags: page.tags ?? [],
      updatedAt: page.updatedAt ?? null,
      text: page.title.trim(),
      tokenEstimate: Math.max(1, Math.ceil(page.title.trim().length / 4)),
    },
  ];
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function writeText(filePath: string, value: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${value}\n`, 'utf8');
}

function serializeThemeMetadata(theme: ProjectContract['config']['site']['theme']) {
  return {
    id: theme.id,
    ...(theme.branding ? { branding: theme.branding } : {}),
    ...(theme.chrome ? { chrome: theme.chrome } : {}),
    ...(theme.colors ? { colors: theme.colors } : {}),
    ...(theme.codeTheme ? { codeTheme: theme.codeTheme } : {}),
  } satisfies SerializedThemeMetadata;
}

function serializeSiteNavigationMetadata(navigation: ProjectContract['config']['site']['navigation']) {
  return {
    ...(navigation?.topNav ? { topNav: navigation.topNav } : {}),
  } satisfies SerializedSiteNavigationMetadata;
}

async function cleanupLegacyLanguageArtifacts(
  artifactRoot: string,
  machineReadableRoot: string,
  enabledLanguages: Set<string>,
): Promise<void> {
  try {
    const artifactFiles = await readdir(artifactRoot);
    for (const fileName of artifactFiles) {
      const searchMatch = /^search-index\.(.+)\.json$/.exec(fileName);
      if (!searchMatch) {
        continue;
      }

      const language = searchMatch[1];
      if (enabledLanguages.has(language)) {
        continue;
      }

      await unlink(path.join(artifactRoot, fileName));
    }
  } catch {
    // Ignore cleanup failures for non-existent directories. Build write step recreates canonical files.
  }

  try {
    const machineReadableFiles = await readdir(machineReadableRoot);
    for (const fileName of machineReadableFiles) {
      const artifactMatch = /^(navigation|pages|chunks)\.(.+)\.json$/.exec(fileName);
      if (!artifactMatch) {
        continue;
      }

      const language = artifactMatch[2];
      if (enabledLanguages.has(language)) {
        continue;
      }

      await unlink(path.join(machineReadableRoot, fileName));
    }
  } catch {
    // Ignore cleanup failures for non-existent directories. Build write step recreates canonical files.
  }
}

export async function writePublishedArtifacts(
  contract: ProjectContract,
  siteArtifacts: BuildWorkflowPublishedSiteResult[],
): Promise<void> {
  const generatedAt = new Date().toISOString();
  const enabledLanguages = new Set(siteArtifacts.map((entry) => entry.lang));

  const outputRoot = contract.paths.artifactRoot;

  await mkdir(contract.paths.artifactRoot, { recursive: true });
  await mkdir(contract.paths.machineReadableRoot, { recursive: true });
  await cleanupLegacyLanguageArtifacts(outputRoot, contract.paths.machineReadableRoot, enabledLanguages);

  for (const site of siteArtifacts) {
    const breadcrumbsById = buildPageBreadcrumbs(site.content.navigation.items);
    const languagePaths = contract.paths.languageRoots[site.lang];

    const searchIndex = {
      lang: site.lang,
      generatedAt,
      docs: site.content.pages.map((page) => toSearchDoc(page, breadcrumbsById.get(page.id) ?? [])),
    };
    const navigationArtifact = {
      lang: site.lang,
      version: site.content.navigation.version,
      items: site.content.navigation.items,
    };
    const chunkArtifact = {
      lang: site.lang,
      generatedAt,
      chunking: {
        strategy: 'heading-aware',
        maxChars: CHUNK_MAX_CHARS,
        overlapChars: CHUNK_OVERLAP_CHARS,
      },
      chunks: site.content.pages.flatMap((page) => toChunkDocs(site, page, breadcrumbsById.get(page.id) ?? [])),
    };
    const pagesArtifact = {
      lang: site.lang,
      generatedAt,
      pages: site.content.pages.map((page): MachineReadablePageDoc => ({
        id: page.id,
        slug: page.slug,
        href: `/${site.lang}/${page.slug}`,
        title: page.title,
        description: page.description ?? '',
        tags: page.tags ?? [],
        updatedAt: page.updatedAt ?? null,
        breadcrumbs: breadcrumbsById.get(page.id) ?? [],
      })),
    };

    await writeJson(languagePaths.searchIndexFile, searchIndex);
    await writeJson(path.join(contract.paths.machineReadableRoot, `navigation.${site.lang}.json`), navigationArtifact);
    await writeJson(path.join(contract.paths.machineReadableRoot, `pages.${site.lang}.json`), pagesArtifact);
    await writeJson(path.join(contract.paths.machineReadableRoot, `chunks.${site.lang}.json`), chunkArtifact);
  }

  const machineReadableIndex: MachineReadableArtifactIndex = {
    version: 1,
    generatedAt,
    projectId: contract.config.projectId,
    publicationRule: 'published-only',
    site: {
      theme: serializeThemeMetadata(contract.config.site.theme),
      ...(contract.config.site.navigation ? { navigation: serializeSiteNavigationMetadata(contract.config.site.navigation) } : {}),
    },
    languages: siteArtifacts.map((site) => ({
      lang: site.lang,
      publishedPages: site.content.pages.length,
      navigationItems: countNavigationItems(site.content.navigation.items),
      files: {
        searchIndex: `../search-index.${site.lang}.json`,
        navigation: `navigation.${site.lang}.json`,
        pages: `pages.${site.lang}.json`,
        chunks: `chunks.${site.lang}.json`,
      },
    })),
  };
  await writeJson(path.join(contract.paths.machineReadableRoot, 'index.json'), machineReadableIndex);

  const llms = buildLlmsTxt(siteArtifacts);
  await writeText(contract.paths.llmsFile, llms);
  const llmsFull = buildLlmsFullTxt(contract, siteArtifacts, generatedAt);
  await writeText(path.join(outputRoot, 'llms-full.txt'), llmsFull);

  // Generate build manifest
  const publishedPagesByLang: Record<string, number> = {};
  for (const site of siteArtifacts) {
    publishedPagesByLang[site.lang] = site.content.pages.length;
  }

  const buildManifest: BuildManifest = {
    version: '1.0.0',
    buildTime: generatedAt,
    builder: {
      tool: 'anydocs-cli',
      version: '1.0.0',
    },
    source: {
      projectRoot: contract.paths.projectRoot,
      projectId: contract.config.projectId,
      site: {
        theme: serializeThemeMetadata(contract.config.site.theme),
        ...(contract.config.site.navigation ? { navigation: serializeSiteNavigationMetadata(contract.config.site.navigation) } : {}),
      },
    },
    output: {
      directory: outputRoot,
      structure: 'flat',
    },
    projects: [
      {
        projectId: contract.config.projectId,
        languages: contract.config.languages,
        site: {
          theme: serializeThemeMetadata(contract.config.site.theme),
          ...(contract.config.site.navigation ? { navigation: serializeSiteNavigationMetadata(contract.config.site.navigation) } : {}),
        },
        publishedPages: publishedPagesByLang,
        artifacts: {
          site: '.',
          mcp: path.relative(outputRoot, contract.paths.machineReadableRoot),
          llms: path.relative(outputRoot, contract.paths.llmsFile),
          searchIndexes: contract.config.languages.map((lang) =>
            path.relative(outputRoot, contract.paths.languageRoots[lang].searchIndexFile)
          ),
        },
      },
    ],
    deployment: {
      type: 'static',
      serverRequired: false,
      recommended: ['nginx', 'vercel', 'netlify', 'cloudflare-pages', 'github-pages'],
    },
  };

  await writeJson(path.join(outputRoot, 'build-manifest.json'), buildManifest);
}
