import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { expect, test } from '@playwright/test';

import {
  e2eProjectRoot,
  studioUrl,
  waitForCliStudioReady,
  waitForStudioSaved,
} from './support/studio';
import { isCliStudio } from './support/studio-mode';

const navigationPath = path.join(e2eProjectRoot, 'navigation', 'en.json');
const nestedPagePath = path.join(e2eProjectRoot, 'pages', 'en', 'nested-page.json');

function toPathTestId(path: number[]) {
  return path.join('-');
}

async function readNavigation() {
  return JSON.parse(await readFile(navigationPath, 'utf8')) as {
    items: Array<{
      type: string;
      title?: string;
      href?: string;
      children?: Array<{
        type: string;
        title?: string;
        href?: string;
      }>;
    }>;
  };
}

test.describe.configure({ mode: 'serial' });

test('[P0] cli studio covers navigation group and link operations @p0', async ({ page }) => {
  test.skip(!isCliStudio, 'Needs CLI Studio runtime.');
  test.setTimeout(60000);

  await page.goto(studioUrl);
  await waitForCliStudioReady(page);

  await page.getByTestId('studio-create-menu-trigger').click();
  await page.getByTestId('studio-create-group-button').click();
  await expect(page.getByText('Add Group')).toBeVisible();
  await page.getByPlaceholder('Group').fill('Regression Group');
  await expect(page.getByText('请选择语言')).toHaveCount(0);
  await page.getByRole('button', { name: 'Create Group' }).click();
  await waitForStudioSaved(page);

  let navigation = await readNavigation();
  const sectionIndex = navigation.items.findIndex((item) => item.title === 'Regression Group');
  expect(sectionIndex).toBeGreaterThanOrEqual(0);

  await expect(page.getByTestId(`studio-nav-section-${toPathTestId([sectionIndex])}`)).toContainText('Regression Group');

  await page.getByTestId(`studio-nav-section-menu-trigger-${toPathTestId([sectionIndex])}`).click();
  await page.getByRole('menuitem', { name: 'Add Page' }).click();
  await page.getByPlaceholder('Untitled').fill('Nested Page');
  await page.getByPlaceholder('getting-started/new-page').fill('guides/nested-page');
  await page.getByRole('button', { name: 'Create Page' }).click();
  await waitForStudioSaved(page);

  await expect(page.getByRole('button', { name: 'Nested Page' })).toBeVisible();

  await page.getByTestId(`studio-nav-section-menu-trigger-${toPathTestId([sectionIndex])}`).click();
  await page.getByRole('menuitem', { name: 'Add Link' }).click();
  await page.getByPlaceholder('Link').fill('Regression Link');
  await page.getByPlaceholder('https://').fill('https://example.com/regression');
  await page.getByRole('button', { name: 'Create Link' }).click();
  await waitForStudioSaved(page);

  navigation = await readNavigation();
  const linkIndex = (navigation.items[sectionIndex]?.children ?? []).findIndex((item) => item.type === 'link' && item.title === 'Regression Link');
  expect(linkIndex).toBeGreaterThanOrEqual(0);

  await expect(page.getByTestId(`studio-nav-link-${toPathTestId([sectionIndex, linkIndex])}`)).toContainText('Regression Link');

  await page.getByTestId(`studio-nav-section-menu-trigger-${toPathTestId([sectionIndex])}`).click();
  await page.getByTestId(`studio-nav-section-rename-button-${toPathTestId([sectionIndex])}`).click();
  await page.getByPlaceholder('Group').fill('Regression Group Updated');
  await page.getByRole('button', { name: 'Save' }).click();
  await waitForStudioSaved(page);

  await expect(page.getByTestId(`studio-nav-section-${toPathTestId([sectionIndex])}`)).toContainText('Regression Group Updated');

  navigation = await readNavigation();
  const updatedLinkIndex = (navigation.items[sectionIndex]?.children ?? []).findIndex((item) => item.type === 'link' && item.title === 'Regression Link');
  expect(updatedLinkIndex).toBeGreaterThanOrEqual(0);

  await page.getByTestId(`studio-nav-link-menu-trigger-${toPathTestId([sectionIndex, updatedLinkIndex])}`).click();
  await page.getByTestId(`studio-nav-link-edit-button-${toPathTestId([sectionIndex, updatedLinkIndex])}`).click();
  await page.getByPlaceholder('Link').fill('Regression Link Updated');
  await page.getByPlaceholder('https://').fill('https://example.com/updated');
  await page.getByRole('button', { name: 'Save' }).click();
  await waitForStudioSaved(page);

  await expect.poll(() => readFile(navigationPath, 'utf8'), { timeout: 15000 }).toContain('"title": "Regression Group Updated"');
  await expect.poll(() => readFile(navigationPath, 'utf8'), { timeout: 15000 }).toContain('"title": "Regression Link Updated"');
  await expect.poll(() => readFile(navigationPath, 'utf8'), { timeout: 15000 }).toContain('"href": "https://example.com/updated"');

  navigation = await readNavigation();
  expect(navigation.items[sectionIndex]).toMatchObject({
    type: 'section',
    title: 'Regression Group Updated',
  });

  await expect.poll(() => readFile(nestedPagePath, 'utf8'), { timeout: 15000 }).toContain('"title": "Nested Page"');
  await expect.poll(() => readFile(nestedPagePath, 'utf8'), { timeout: 15000 }).toContain('"slug": "guides/nested-page"');
});
