import { expect, test } from '@playwright/test';

import { buildLocalApiUrl, studioUrl } from './support/studio';
import { isCliSingleProjectStudio } from './support/studio-mode';

test.describe.configure({ mode: 'serial' });

test('studio authoring flow persists template and structured metadata @p0', async ({ page, request }) => {
  test.skip(!isCliSingleProjectStudio, 'Needs CLI single-project Studio runtime.');

  await page.goto(studioUrl);
  await expect(page.getByTestId('studio-pages-sidebar')).toBeVisible();

  await page.getByTestId('studio-nav-page-menu-trigger-welcome').click();
  await page.getByTestId('studio-nav-page-edit-button-welcome').click();
  await expect(page.getByTestId('studio-settings-sidebar')).toBeVisible();

  await page.getByTestId('studio-page-template-trigger').click();
  await expect(page.getByRole('option', { name: 'Blueprint Review' })).toBeVisible();
  await page.getByRole('option', { name: 'ADR' }).click();

  await page.getByTestId('studio-page-metadata-decision-status').click();
  await page.getByRole('option', { name: 'accepted' }).click();

  await page.getByTestId('studio-page-metadata-author').fill('shawn');

  await expect(page.getByTestId('studio-save-status')).toContainText('All changes saved', { timeout: 10000 });

  const persistedResponse = await request.get(
    buildLocalApiUrl('page', {
      lang: 'en',
      pageId: 'welcome',
    }),
  );
  expect(persistedResponse.ok()).toBeTruthy();

  const persistedPage = (await persistedResponse.json()) as {
    template?: string;
    metadata?: Record<string, unknown>;
  };
  expect(persistedPage.template).toBe('adr');
  expect(persistedPage.metadata).toEqual({
    'decision-status': 'accepted',
    author: 'shawn',
  });

  await page.reload();
  await expect(page.getByTestId('studio-pages-sidebar')).toBeVisible();
  await page.getByTestId('studio-nav-page-menu-trigger-welcome').click();
  await page.getByTestId('studio-nav-page-edit-button-welcome').click();

  await expect(page.getByTestId('studio-page-template-trigger')).toContainText('ADR');
  await expect(page.getByTestId('studio-page-metadata-author')).toHaveValue('shawn');
});
