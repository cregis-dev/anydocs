import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { expect, test } from '@playwright/test';

import { e2eProjectRoot, studioUrl, waitForStudioSaved } from './support/studio';
import { isCliStudio } from './support/studio-mode';

const navigationPath = path.join(e2eProjectRoot, 'navigation', 'en.json');
const createdPageId = 'studio-page-ops';
const createdPagePath = path.join(e2eProjectRoot, 'pages', 'en', `${createdPageId}.json`);
const createdTitle = 'Studio Page Ops';
const updatedTitle = 'Studio Page Ops Updated';
const updatedDescription = 'Regression coverage for create, edit, publish, preview, build, and delete.';
const updatedSlug = `flows/${createdPageId}`;

test.describe.configure({ mode: 'serial' });

test('[P0] cli studio covers page create/edit/publish/delete @p0', async ({ page }) => {
  test.skip(!isCliStudio, 'Needs CLI Studio runtime.');
  test.setTimeout(60000);

  await page.goto(studioUrl);
  await expect(page.getByTestId('studio-pages-sidebar')).toBeVisible();
  await expect(page.getByTestId('studio-language-switcher')).toContainText('EN');

  await page.getByTestId('studio-create-menu-trigger').click();
  await page.getByTestId('studio-create-page-button').click();
  await expect(page.getByText('Add Page')).toBeVisible();
  await page.getByPlaceholder('Untitled').fill(createdTitle);
  await page.getByPlaceholder('getting-started/new-page').fill(updatedSlug);
  await expect(page.getByText('请选择语言')).toHaveCount(0);
  await page.getByRole('button', { name: 'Create Page' }).click();

  await expect(page.getByTestId(`studio-nav-page-menu-trigger-${createdPageId}`)).toBeVisible();
  await waitForStudioSaved(page);

  await page.getByTestId(`studio-nav-page-menu-trigger-${createdPageId}`).click();
  await page.getByTestId(`studio-nav-page-edit-button-${createdPageId}`).click();
  await expect(page.getByTestId('studio-settings-sidebar')).toBeVisible();

  await page.getByTestId('studio-page-title-input').fill(updatedTitle);
  await page.getByTestId('studio-page-description-input').fill(updatedDescription);
  await page.getByTestId('studio-page-template-trigger').click();
  await page.getByRole('option', { name: 'ADR' }).click();
  await page.getByTestId('studio-page-metadata-decision-status').click();
  await page.getByRole('option', { name: 'accepted' }).click();
  await page.getByTestId('studio-page-metadata-author').fill('qa-bot');
  await page.getByTestId('studio-page-tags-input').fill('guide, regression');

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByTestId('studio-page-status-trigger').click();
  await page.getByRole('option', { name: 'Published' }).click();

  await waitForStudioSaved(page);

  const persistedPage = JSON.parse(await readFile(createdPagePath, 'utf8')) as {
    title: string;
    slug: string;
    description?: string;
    status: string;
    template?: string;
    metadata?: Record<string, unknown>;
    tags?: string[];
  };
  expect(persistedPage.title).toBe(updatedTitle);
  expect(persistedPage.slug).toBe(updatedSlug);
  expect(persistedPage.description).toBe(updatedDescription);
  expect(persistedPage.status).toBe('published');
  expect(persistedPage.template).toBe('adr');
  expect(persistedPage.metadata).toEqual({
    'decision-status': 'accepted',
    author: 'qa-bot',
  });
  expect(persistedPage.tags).toEqual(['guide', 'regression']);

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByTestId('studio-delete-page-button').click();
  await expect(page.getByTestId(`studio-nav-page-menu-trigger-${createdPageId}`)).toHaveCount(0);

  const navigation = JSON.parse(await readFile(navigationPath, 'utf8')) as { items: Array<Record<string, unknown>> };
  expect(JSON.stringify(navigation.items)).not.toContain(createdPageId);

  const pageExists = await readFile(createdPagePath, 'utf8')
    .then(() => true)
    .catch(() => false);
  expect(pageExists).toBe(false);
});
