import path from 'node:path';

import {
  createDocsRepository,
  findPageBySlug,
  listPages,
  loadPage,
  loadProjectContract,
  ValidationError,
  type PageDoc,
} from '@anydocs/core';

import { error, info } from '../output/logger.ts';
import { writeJsonError, writeJsonSuccess } from '../output/structured.ts';
import {
  assertEnabledLanguage,
  assertKnownPageStatus,
  resolveRepoRoot,
  summarizePage,
} from './read-command-helpers.ts';

type BasePageCommandOptions = {
  targetDir?: string;
  lang?: string;
  json?: boolean;
};

type PageListCommandOptions = BasePageCommandOptions & {
  status?: string;
  tag?: string;
};

type PageGetCommandOptions = BasePageCommandOptions & {
  pageId?: string;
};

type PageFindCommandOptions = BasePageCommandOptions & {
  pageId?: string;
  slug?: string;
  status?: string;
  tag?: string;
};

function pageFilePath(projectRoot: string, lang: string, pageId: string): string {
  return path.join(projectRoot, 'pages', lang, `${pageId}.json`);
}

function filterPages(pages: PageDoc[], options: { status?: string; tag?: string }): PageDoc[] {
  return pages.filter((page) => {
    if (options.status && page.status !== options.status) {
      return false;
    }

    if (options.tag && !(page.tags ?? []).includes(options.tag)) {
      return false;
    }

    return true;
  });
}

function printPageList(pages: PageDoc[], projectRoot: string): void {
  info(`Pages: ${pages.length}`);
  for (const page of pages) {
    info(`- ${page.lang}:${page.slug} -> ${page.id} (${page.status})`);
    info(`  file: ${pageFilePath(projectRoot, page.lang, page.id)}`);
  }
}

export async function runPageListCommand(options: PageListCommandOptions = {}): Promise<number> {
  const repoRoot = resolveRepoRoot(options.targetDir);
  const contractResult = await loadProjectContract(repoRoot);
  if (!contractResult.ok) {
    if (options.json) {
      writeJsonError('page list', contractResult.error, { repoRoot });
    } else {
      error(`Page list failed: ${contractResult.error.message}`);
      error(`Rule: ${contractResult.error.details.rule}`);
      if (contractResult.error.details.remediation) {
        error(`Fix: ${contractResult.error.details.remediation}`);
      }
    }
    return 1;
  }

  try {
    const contract = contractResult.value;
    const lang = assertEnabledLanguage(contract, options.lang);
    assertKnownPageStatus(options.status);

    const repository = createDocsRepository(contract.paths.projectRoot);
    const pages = filterPages(await listPages(repository, lang), options);
    const data = {
      lang,
      count: pages.length,
      pages: pages.map((page) => summarizePage(page, pageFilePath(contract.paths.projectRoot, lang, page.id))),
    };

    if (options.json) {
      writeJsonSuccess('page list', data, {
        projectId: contract.config.projectId,
        repoRoot,
      });
    } else {
      printPageList(pages, contract.paths.projectRoot);
    }
    return 0;
  } catch (caughtError: unknown) {
    if (options.json) {
      writeJsonError('page list', caughtError, { repoRoot });
    } else {
      const message = caughtError instanceof Error ? caughtError.message : String(caughtError);
      error(`Page list failed: ${message}`);
    }
    return 1;
  }
}

export async function runPageGetCommand(options: PageGetCommandOptions = {}): Promise<number> {
  const repoRoot = resolveRepoRoot(options.targetDir);
  const contractResult = await loadProjectContract(repoRoot);
  if (!contractResult.ok) {
    if (options.json) {
      writeJsonError('page get', contractResult.error, { repoRoot });
    } else {
      error(`Page get failed: ${contractResult.error.message}`);
      error(`Rule: ${contractResult.error.details.rule}`);
      if (contractResult.error.details.remediation) {
        error(`Fix: ${contractResult.error.details.remediation}`);
      }
    }
    return 1;
  }

  try {
    const contract = contractResult.value;
    const lang = assertEnabledLanguage(contract, options.lang);
    if (!options.pageId) {
      throw new ValidationError('Page id is required.', {
        entity: 'cli-command',
        rule: 'cli-page-id-required',
        remediation: 'Provide a page id using the positional argument or --page-id.',
      });
    }

    const repository = createDocsRepository(contract.paths.projectRoot);
    const page = await loadPage(repository, lang, options.pageId);
    if (!page) {
      throw new ValidationError(`Page "${options.pageId}" not found.`, {
        entity: 'page-doc',
        rule: 'page-must-exist',
        remediation: 'Use page list or page find to inspect available pages before retrying.',
        metadata: { lang, pageId: options.pageId },
      });
    }

    const file = pageFilePath(contract.paths.projectRoot, lang, page.id);
    if (options.json) {
      writeJsonSuccess(
        'page get',
        {
          file,
          page,
        },
        {
          projectId: contract.config.projectId,
          repoRoot,
        },
      );
    } else {
      info(`Page: ${page.lang}:${page.slug} -> ${page.id}`);
      info(`Status: ${page.status}`);
      info(`File: ${file}`);
      info(`Title: ${page.title}`);
    }
    return 0;
  } catch (caughtError: unknown) {
    if (options.json) {
      writeJsonError('page get', caughtError, { repoRoot });
    } else {
      const message = caughtError instanceof Error ? caughtError.message : String(caughtError);
      error(`Page get failed: ${message}`);
    }
    return 1;
  }
}

export async function runPageFindCommand(options: PageFindCommandOptions = {}): Promise<number> {
  const repoRoot = resolveRepoRoot(options.targetDir);
  const contractResult = await loadProjectContract(repoRoot);
  if (!contractResult.ok) {
    if (options.json) {
      writeJsonError('page find', contractResult.error, { repoRoot });
    } else {
      error(`Page find failed: ${contractResult.error.message}`);
      error(`Rule: ${contractResult.error.details.rule}`);
      if (contractResult.error.details.remediation) {
        error(`Fix: ${contractResult.error.details.remediation}`);
      }
    }
    return 1;
  }

  try {
    const contract = contractResult.value;
    const lang = assertEnabledLanguage(contract, options.lang);
    assertKnownPageStatus(options.status);

    const repository = createDocsRepository(contract.paths.projectRoot);
    let pages: PageDoc[] = [];

    if (options.pageId) {
      const page = await loadPage(repository, lang, options.pageId);
      pages = page ? [page] : [];
    } else if (options.slug) {
      const page = await findPageBySlug(repository, lang, options.slug);
      pages = page ? [page] : [];
    } else {
      pages = await listPages(repository, lang);
    }

    const filteredPages = filterPages(pages, options);
    const data = {
      query: {
        lang,
        pageId: options.pageId ?? null,
        slug: options.slug ?? null,
        status: options.status ?? null,
        tag: options.tag ?? null,
      },
      matches: filteredPages.map((page) =>
        summarizePage(page, pageFilePath(contract.paths.projectRoot, lang, page.id)),
      ),
    };

    if (options.json) {
      writeJsonSuccess('page find', data, {
        projectId: contract.config.projectId,
        repoRoot,
      });
    } else if (filteredPages.length === 0) {
      info('No matching pages found.');
    } else {
      printPageList(filteredPages, contract.paths.projectRoot);
    }
    return 0;
  } catch (caughtError: unknown) {
    if (options.json) {
      writeJsonError('page find', caughtError, { repoRoot });
    } else {
      const message = caughtError instanceof Error ? caughtError.message : String(caughtError);
      error(`Page find failed: ${message}`);
    }
    return 1;
  }
}
