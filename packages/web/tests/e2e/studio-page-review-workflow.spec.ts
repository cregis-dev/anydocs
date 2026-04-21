import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { expect, test } from '@playwright/test';

import {
  e2eProjectRoot,
  studioUrl,
  waitForCliStudioReady,
} from './support/studio';
import { isCliStudio } from './support/studio-mode';

const reviewGatePagePath = path.join(e2eProjectRoot, 'pages', 'en', 'review-gate.json');

test.describe.configure({ mode: 'serial' });

test('[P0] cli studio enforces review approval before publish transitions @p0', async ({ page }) => {
  test.skip(!isCliStudio, 'Needs CLI Studio runtime.');
  test.setTimeout(60000);

  await page.goto(studioUrl);
  await waitForCliStudioReady(page);

  await page.getByTestId('studio-nav-page-menu-trigger-review-gate').click();
  await page.getByTestId('studio-nav-page-edit-button-review-gate').click();
  await expect(page.getByTestId('studio-settings-sidebar')).toBeVisible();
  await expect(page.getByTestId('studio-approve-publication-button')).toBeVisible();

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByTestId('studio-page-status-trigger').click();
  await page.getByRole('option', { name: 'Published' }).click();
  await expect(page.getByTestId('studio-page-status-trigger')).toContainText('In Review');

  await page.getByTestId('studio-approve-publication-button').click();
  await expect(page.getByRole('button', { name: 'Clear Approval' })).toBeVisible();
  await expect
    .poll(async () => {
      const persisted = JSON.parse(await readFile(reviewGatePagePath, 'utf8')) as {
        review?: { approvedAt?: string };
      };
      return Boolean(persisted.review?.approvedAt);
    }, { timeout: 15000 })
    .toBe(true);

  let persistedPage = JSON.parse(await readFile(reviewGatePagePath, 'utf8')) as {
    status: string;
    review?: {
      approvedAt?: string;
    };
  };
  expect(persistedPage.status).toBe('in_review');
  expect(persistedPage.review?.approvedAt).toBeTruthy();

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByTestId('studio-page-status-trigger').click();
  await page.getByRole('option', { name: 'Published' }).click();
  await expect
    .poll(async () => {
      const persisted = JSON.parse(await readFile(reviewGatePagePath, 'utf8')) as {
        status: string;
      };
      return persisted.status;
    }, { timeout: 15000 })
    .toBe('published');

  persistedPage = JSON.parse(await readFile(reviewGatePagePath, 'utf8')) as {
    status: string;
    review?: {
      approvedAt?: string;
    };
  };
  expect(persistedPage.status).toBe('published');
  expect(persistedPage.review?.approvedAt).toBeTruthy();

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByTestId('studio-page-status-trigger').click();
  await page.getByRole('option', { name: 'Draft' }).click();
  await expect
    .poll(async () => {
      const persisted = JSON.parse(await readFile(reviewGatePagePath, 'utf8')) as {
        status: string;
      };
      return persisted.status;
    }, { timeout: 15000 })
    .toBe('draft');

  persistedPage = JSON.parse(await readFile(reviewGatePagePath, 'utf8')) as {
    status: string;
  };
  expect(persistedPage.status).toBe('draft');
});
