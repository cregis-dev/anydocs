import path from 'node:path';

import { expect, type Page } from '@playwright/test';

const explicitStudioUrl = process.env.STUDIO_URL;
const normalizedStudioBaseUrl = explicitStudioUrl
  ? explicitStudioUrl.replace(/\/studio\/?$/, '').replace(/\/$/, '').replace('://localhost', '://127.0.0.1')
  : 'http://127.0.0.1:3000';

const repoRoot = path.resolve(__dirname, '../../../../..');

export const studioBaseUrl = normalizedStudioBaseUrl;
export const studioUrl = `${studioBaseUrl}/studio`;
export const e2eProjectRoot = process.env.ANYDOCS_E2E_PROJECT_ROOT
  ? path.resolve(process.env.ANYDOCS_E2E_PROJECT_ROOT)
  : path.join(repoRoot, 'packages', '.tmp', 'playwright-anydocs-project');

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

export async function waitForCliStudioReady(page: Page) {
  await page.getByTestId('studio-pages-sidebar').waitFor({
    state: 'visible',
    timeout: 30000,
  });
  await expect(page.getByTestId('studio-language-switcher')).toContainText('EN', {
    timeout: 30000,
  });
  await expect(page.getByTestId('studio-connection-status')).toContainText('Connected', {
    timeout: 30000,
  });
  await expect(page.getByRole('button', { name: 'Welcome', exact: true })).toBeVisible({
    timeout: 30000,
  });
}

export async function waitForStudioSaved(page: Page) {
  await expect(page.getByTestId('studio-connection-status')).toContainText('Connected', {
    timeout: 15000,
  });
  // Let React commit the dirty/saving state before asserting the final saved state.
  await page.waitForTimeout(250);
  await expect(page.getByTestId('studio-save-status')).toContainText('All changes saved', {
    timeout: 15000,
  });
}
