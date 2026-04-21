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
const nestedPagePath = path.join(e2eProjectRoot, 'pages', 'en', 'folder-child-page.json');

function toPathTestId(path: number[]) {
  return path.join('-');
}

async function readNavigation() {
  return JSON.parse(await readFile(navigationPath, 'utf8')) as {
    items: Array<{
      type: string;
      title?: string;
      pageId?: string;
      children?: Array<{
        type: string;
        title?: string;
        pageId?: string;
        children?: Array<{
          type: string;
          title?: string;
          pageId?: string;
        }>;
      }>;
    }>;
  };
}

test.describe.configure({ mode: 'serial' });

test('[P0] cli studio covers folder creation and navigation ordering @p0', async ({ page }) => {
  test.skip(!isCliStudio, 'Needs CLI Studio runtime.');
  test.setTimeout(60000);

  await page.goto(studioUrl);
  await waitForCliStudioReady(page);

  await page.getByTestId('studio-create-menu-trigger').click();
  await page.getByTestId('studio-create-group-button').click();
  await page.getByPlaceholder('Group').fill('Folder Ops Root');
  await page.getByRole('button', { name: 'Create Group' }).click();
  await waitForStudioSaved(page);

  let navigation = await readNavigation();
  const rootIndex = navigation.items.findIndex((item) => item.title === 'Folder Ops Root');
  expect(rootIndex).toBeGreaterThanOrEqual(0);

  await page.getByTestId(`studio-nav-section-menu-trigger-${toPathTestId([rootIndex])}`).click();
  await page.getByRole('menuitem', { name: 'Add Page' }).click();
  await page.getByPlaceholder('Untitled').fill('Alpha Child');
  await page.getByPlaceholder('getting-started/new-page').fill('alpha-child');
  await page.getByRole('button', { name: 'Create Page' }).click();
  await waitForStudioSaved(page);

  await page.getByTestId(`studio-nav-section-menu-trigger-${toPathTestId([rootIndex])}`).click();
  await page.getByRole('menuitem', { name: 'Add Group' }).click();
  await page.getByPlaceholder('Group').fill('Folder Child');
  await page.getByRole('button', { name: 'Create Group' }).click();
  await waitForStudioSaved(page);

  navigation = await readNavigation();
  const rootChildren = navigation.items[rootIndex]?.children ?? [];
  const folderIndex = rootChildren.findIndex((item) => item.type === 'folder' && item.title === 'Folder Child');
  expect(folderIndex).toBeGreaterThanOrEqual(0);

  await page.getByTestId(`studio-nav-folder-menu-trigger-${toPathTestId([rootIndex, folderIndex])}`).click();
  await page.getByRole('menuitem', { name: 'Add Page' }).click();
  await page.getByPlaceholder('Untitled').fill('Folder Child Page');
  await page.getByPlaceholder('getting-started/new-page').fill('folder-child-page');
  await page.getByRole('button', { name: 'Create Page' }).click();
  await waitForStudioSaved(page);

  await page.getByTestId(`studio-nav-folder-menu-trigger-${toPathTestId([rootIndex, folderIndex])}`).click();
  await page.getByTestId(`studio-nav-folder-rename-button-${toPathTestId([rootIndex, folderIndex])}`).click();
  await page.getByPlaceholder('Group').fill('Folder Child Updated');
  await page.getByRole('button', { name: 'Save' }).click();
  await waitForStudioSaved(page);

  await page.getByTestId(`studio-nav-folder-menu-trigger-${toPathTestId([rootIndex, folderIndex])}`).click();
  await page.getByRole('menuitem', { name: 'Move Up' }).click();
  await waitForStudioSaved(page);

  await expect
    .poll(async () => {
      const nextNavigation = await readNavigation();
      return (nextNavigation.items[rootIndex]?.children ?? []).map((item) =>
        item.type === 'page' ? item.pageId : item.title,
      );
    }, { timeout: 15000 })
    .toEqual(['Folder Child Updated', 'alpha-child']);

  await page.getByTestId(`studio-nav-folder-menu-trigger-${toPathTestId([rootIndex, 0])}`).click();
  await page.getByRole('menuitem', { name: 'Move Down' }).click();
  await waitForStudioSaved(page);

  await expect
    .poll(async () => {
      const nextNavigation = await readNavigation();
      return (nextNavigation.items[rootIndex]?.children ?? []).map((item) =>
        item.type === 'page' ? item.pageId : item.title,
      );
    }, { timeout: 15000 })
    .toEqual(['alpha-child', 'Folder Child Updated']);

  await expect.poll(() => readFile(nestedPagePath, 'utf8'), { timeout: 15000 }).toContain('"title": "Folder Child Page"');
  await expect.poll(() => readFile(nestedPagePath, 'utf8'), { timeout: 15000 }).toContain('"slug": "folder-child-page"');
});
