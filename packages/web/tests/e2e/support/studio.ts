import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { access, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { expect, type Dialog, type Page } from '@playwright/test';

const explicitStudioUrl = process.env.STUDIO_URL;
const normalizedStudioBaseUrl = explicitStudioUrl
  ? explicitStudioUrl.replace(/\/studio\/?$/, '').replace(/\/$/, '').replace('://localhost', '://127.0.0.1')
  : 'http://127.0.0.1:3000';

export const repoRoot = path.resolve(__dirname, '../../../../../');
export const cliEntry = path.join(repoRoot, 'packages/cli/src/index.ts');
export const studioBaseUrl = normalizedStudioBaseUrl;
export const studioUrl = `${studioBaseUrl}/studio`;
const workerProjectSuffix =
  process.env.TEST_WORKER_INDEX ??
  process.env.PLAYWRIGHT_WORKER_INDEX ??
  '0';
export const projectRoot =
  process.env.ANYDOCS_E2E_PROJECT_ROOT ??
  path.join(repoRoot, '.tmp', `playwright-anydocs-project-${workerProjectSuffix}`);

const configFile = path.join(projectRoot, 'anydocs.config.json');

export function runCliCommand(args: string[]) {
  execFileSync('node', ['--experimental-strip-types', cliEntry, ...args], {
    cwd: repoRoot,
    env: process.env,
    stdio: 'pipe',
  });
}

export async function ensureProjectExists() {
  try {
    await access(configFile);
  } catch {
    runCliCommand(['init', projectRoot]);
  }
}

export async function readJsonFile<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, 'utf8')) as T;
}

export function createRunId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${randomUUID().slice(0, 6)}`;
}

export function createStudioPageScenario(prefix = 'authentication') {
  const runId = createRunId(prefix);

  return {
    runId,
    groupName: `API Guides ${runId}`,
    pageTitle: `Authentication API ${runId}`,
    pageSlug: `api/authentication-${runId}`,
    pageId: `authentication-${runId}`,
    pageDescription: `Token and session flows for ${runId}.`,
    pageBody: `Authentication flow ${runId}`,
  };
}

export function createDeleteScenario(prefix = 'cleanup') {
  const runId = createRunId(prefix);

  return {
    runId,
    pageTitle: `Delete Me ${runId}`,
    pageSlug: `cleanup/delete-me-${runId}`,
    pageId: `delete-me-${runId}`,
  };
}

export function buildLocalApiUrl(pathname: string, params: Record<string, string | undefined>) {
  const query = new URLSearchParams();
  query.set('__studio_api', '2');

  for (const [key, value] of Object.entries(params)) {
    if (value) {
      query.set(key, value);
    }
  }

  return `${studioBaseUrl}/api/local/${pathname}?${query.toString()}`;
}

export async function getProjectId() {
  const config = await readJsonFile<{ projectId: string }>(configFile);
  return config.projectId;
}

export async function ensurePublishedWelcomePage() {
  const welcomePageFile = path.join(projectRoot, 'pages', 'en', 'welcome.json');
  const page = await readJsonFile<Record<string, unknown>>(welcomePageFile);

  if (page.status === 'published') {
    return;
  }

  await writeFile(
    welcomePageFile,
    `${JSON.stringify(
      {
        ...page,
        status: 'published',
        updatedAt: new Date().toISOString(),
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
}

export function acceptDialog(page: Page, message: string | RegExp, value?: string) {
  return page.waitForEvent('dialog').then(async (dialog: Dialog) => {
    const actual = dialog.message();
    if (message instanceof RegExp) {
      assert.match(actual, message);
    } else {
      assert.equal(actual, message);
    }
    await dialog.accept(value);
  });
}

export async function acceptDialogSequence(
  page: Page,
  entries: Array<{ message: string | RegExp; value?: string }>,
) {
  const pending = [...entries];

  await new Promise<void>((resolve, reject) => {
    const onDialog = async (dialog: Dialog) => {
      const next = pending.shift();
      if (!next) {
        page.off('dialog', onDialog);
        reject(new Error(`Unexpected dialog: ${dialog.message()}`));
        return;
      }

      try {
        const actual = dialog.message();
        if (next.message instanceof RegExp) {
          assert.match(actual, next.message);
        } else {
          assert.equal(actual, next.message);
        }

        if (pending.length === 0) {
          page.off('dialog', onDialog);
        }

        await dialog.accept(next.value);

        if (pending.length === 0) {
          resolve();
        }
      } catch (error) {
        page.off('dialog', onDialog);
        reject(error);
      }
    };

    page.on('dialog', onDialog);
  });
}

export async function openProjectFromWelcome(page: Page, selectedProjectRoot = projectRoot) {
  await page.addInitScript(() => {
    localStorage.removeItem('studio-projects');
  });

  await page.goto(studioUrl);
  await expect(page.getByTestId('studio-open-project-button')).toBeVisible();

  await page.getByTestId('studio-open-project-button').click();
  const projectPathDialog = page.getByRole('dialog', { name: 'Open External Project' });
  await expect(projectPathDialog).toBeVisible();
  await projectPathDialog.getByTestId('studio-project-path-input').fill(selectedProjectRoot);
  await projectPathDialog.getByTestId('studio-project-path-submit').click();
  await expect(projectPathDialog).toHaveCount(0);

  await expect(page.getByTestId('studio-pages-sidebar')).toBeVisible();
  await expect(page.getByTestId('studio-workflow-action-button')).toBeVisible();
}

export async function waitForSaveIdle(page: Page, timeout = 20_000) {
  await expect(page.getByTestId('studio-save-status')).toContainText('All changes saved', { timeout });
}
