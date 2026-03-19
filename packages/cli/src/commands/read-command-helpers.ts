import path from 'node:path';

import {
  PAGE_STATUSES,
  ValidationError,
  type DocsLang,
  type PageDoc,
  type ProjectContract,
} from '@anydocs/core';

export function resolveRepoRoot(targetDir?: string): string {
  return path.resolve(process.cwd(), targetDir ?? '.');
}

export function assertEnabledLanguage(contract: ProjectContract, lang: string | undefined): DocsLang {
  if (!lang) {
    throw new ValidationError('Language is required.', {
      entity: 'cli-command',
      rule: 'cli-language-required',
      remediation: 'Provide --lang <language> using one of the enabled project languages.',
      metadata: { enabledLanguages: contract.config.languages },
    });
  }

  if (!contract.config.languages.includes(lang as DocsLang)) {
    throw new ValidationError(`Language "${lang}" is not enabled for the project.`, {
      entity: 'cli-command',
      rule: 'cli-language-must-be-enabled',
      remediation: 'Use one of the enabled project languages from anydocs.config.json.',
      metadata: { lang, enabledLanguages: contract.config.languages },
    });
  }

  return lang as DocsLang;
}

export function assertKnownPageStatus(status: string | undefined): void {
  if (!status) {
    return;
  }

  if (!PAGE_STATUSES.includes(status as (typeof PAGE_STATUSES)[number])) {
    throw new ValidationError(`Unknown page status "${status}".`, {
      entity: 'cli-command',
      rule: 'cli-page-status-must-be-known',
      remediation: `Use one of: ${PAGE_STATUSES.join(', ')}.`,
      metadata: { status, knownStatuses: PAGE_STATUSES },
    });
  }
}

export function summarizePage(page: PageDoc, filePath: string) {
  return {
    id: page.id,
    lang: page.lang,
    slug: page.slug,
    title: page.title,
    description: page.description ?? '',
    status: page.status,
    tags: page.tags ?? [],
    updatedAt: page.updatedAt ?? null,
    file: filePath,
  };
}
