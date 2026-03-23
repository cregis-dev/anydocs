import { access, readFile } from 'node:fs/promises';
import path from 'node:path';

import { expect, test } from '@playwright/test';

import {
  acceptDialog,
  createDeleteScenario,
  createStudioPageScenario,
  ensureProjectExists,
  openProjectFromWelcome,
  projectRoot,
  waitForSaveIdle,
} from './support/studio';

async function submitCreateGroupDialog(page: Parameters<typeof test>[0]['page'], groupName: string) {
  const dialog = page.getByRole('dialog', { name: 'Add Group' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('textbox').fill(groupName);
  await dialog.getByRole('button', { name: 'Create Group' }).click();
  await expect(dialog).toHaveCount(0);
}

async function submitCreatePageDialog(
  page: Parameters<typeof test>[0]['page'],
  input: { pageSlug: string; pageTitle: string },
) {
  const dialog = page.getByRole('dialog', { name: 'Add Page' });
  await expect(dialog).toBeVisible();
  const textboxes = dialog.getByRole('textbox');
  await textboxes.nth(0).fill(input.pageTitle);
  await textboxes.nth(1).fill(input.pageSlug);
  await dialog.getByRole('button', { name: 'Create Page' }).click();
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  await ensureProjectExists();
});

test('authoring flow covers CLI init, Studio editing, preview, and build @p0', async ({ page }) => {
  test.setTimeout(600000);

  const { groupName, pageBody, pageDescription, pageId, pageSlug, pageTitle } =
    createStudioPageScenario();
  const savedNavFile = path.join(projectRoot, 'navigation', 'en.json');

  await openProjectFromWelcome(page);

  await page.getByTestId('studio-open-project-settings-button').click();
  await expect(page.getByTestId('studio-settings-sidebar')).toBeVisible();
  await expect(page.getByTestId('studio-project-name-input')).toBeVisible();
  await page.getByTestId('studio-close-settings-sidebar').click();
  await expect(page.getByTestId('studio-settings-sidebar')).toHaveCount(0);

  await page.getByTestId('studio-create-menu-trigger').click();
  await page.getByTestId('studio-create-group-button').click();
  await submitCreateGroupDialog(page, groupName);
  await expect(page.getByText(groupName)).toBeVisible();

  await page.getByTestId('studio-create-menu-trigger').click();
  await page.getByTestId('studio-create-page-button').click();
  await submitCreatePageDialog(page, { pageSlug, pageTitle });

  await page.getByTestId(`studio-nav-page-menu-trigger-${pageId}`).click();
  await page.getByTestId(`studio-nav-page-edit-button-${pageId}`).click();
  await expect(page.getByTestId('studio-page-title-input')).toHaveValue(pageTitle);

  await page.getByTestId('studio-page-title-input').fill(pageTitle);
  const descriptionInput = page.getByTestId('studio-page-description-input');
  await descriptionInput.click();
  await descriptionInput.fill('');
  await descriptionInput.pressSequentially(pageDescription);
  await expect(descriptionInput).toHaveValue(pageDescription);
  await page.getByTestId('studio-page-slug-input').fill(pageSlug);

  const publishConfirm = acceptDialog(
    page,
    '将状态设置为 published 后，该页面会在构建生成的阅读站/搜索索引/llms.txt/WebMCP 中对外可见。确认继续？',
  );
  await page.getByTestId('studio-page-status-trigger').click();
  await page.getByRole('option', { name: 'Published' }).click();
  await publishConfirm;

  const editor = page.locator('[contenteditable="true"]').first();
  await expect(editor).toBeVisible();
  await editor.click();
  await page.keyboard.type(pageBody);

  await waitForSaveIdle(page);
  await expect
    .poll(async () => await readFile(savedNavFile, 'utf8'), { timeout: 15000 })
    .toContain(groupName);
  await expect
    .poll(async () => await readFile(savedNavFile, 'utf8'), { timeout: 15000 })
    .toContain(pageId);

  const savedPage = JSON.parse(
    await readFile(path.join(projectRoot, 'pages', 'en', `${pageId}.json`), 'utf8'),
  ) as {
    title: string;
    slug: string;
    status: string;
    description?: string;
    render?: { plainText?: string };
  };

  expect(savedPage.title).toBe(pageTitle);
  expect(savedPage.slug).toBe(pageSlug);
  expect(savedPage.status).toBe('published');
  expect(savedPage.description).toBe(pageDescription);
  expect(savedPage.render?.plainText ?? '').toContain(pageBody);

  const previewPagePromise = page.context().waitForEvent('page');
  await page.getByTestId('studio-workflow-action-button').click();
  const previewPage = await previewPagePromise;
  await previewPage.waitForLoadState('domcontentloaded');
  await expect(page.getByTestId('studio-workflow-message')).toContainText('Preview ready:', { timeout: 30000 });
  await expect(previewPage).toHaveURL(/\/en\/welcome\/?$/, { timeout: 30000 });
  await previewPage.goto(new URL(`/en/${pageSlug}/`, previewPage.url()).toString());
  await expect(previewPage.getByRole('heading', { name: pageTitle })).toBeVisible({ timeout: 30000 });
  await previewPage.close();

  const builtIndex = path.join(projectRoot, 'dist', 'index.html');
  const builtLlms = path.join(projectRoot, 'dist', 'llms.txt');

  await page.getByTestId('studio-workflow-menu-trigger').click();
  await page.getByTestId('studio-build-button').click();
  await expect
    .poll(
      async () => {
        try {
          return (await readFile(builtLlms, 'utf8')).includes(pageTitle);
        } catch {
          return false;
        }
      },
      { timeout: 450000 },
    )
    .toBeTruthy();

  await access(builtIndex);
  await access(builtLlms);

  const builtLlmsContent = await readFile(builtLlms, 'utf8');
  expect(builtLlmsContent).toContain(pageTitle);
});

test('deleting a page removes the file and clears its navigation references @p0', async ({ page }) => {
  test.setTimeout(600000);

  const { pageId, pageSlug, pageTitle } = createDeleteScenario();
  const projectNavFile = path.join(projectRoot, 'navigation', 'en.json');
  const projectPageFile = path.join(projectRoot, 'pages', 'en', `${pageId}.json`);

  await openProjectFromWelcome(page);

  await page.getByTestId('studio-create-menu-trigger').click();
  await page.getByTestId('studio-create-page-button').click();
  await submitCreatePageDialog(page, { pageSlug, pageTitle });

  await page.getByTestId(`studio-nav-page-menu-trigger-${pageId}`).click();
  await page.getByTestId(`studio-nav-page-edit-button-${pageId}`).click();
  await expect(page.getByTestId('studio-page-title-input')).toHaveValue(pageTitle);

  await expect
    .poll(async () => await readFile(projectNavFile, 'utf8'), { timeout: 15000 })
    .toContain(pageId);
  await access(projectPageFile);

  const deleteConfirm = acceptDialog(
    page,
    `确认删除当前语言页面 “${pageTitle}” 吗？这会同时移除该语言导航中的全部页面引用。删除后将无法再从当前语言工程中恢复该页面。`,
  );
  await page.getByTestId('studio-delete-page-button').click();
  await deleteConfirm;

  await expect
    .poll(async () => {
      try {
        await access(projectPageFile);
        return true;
      } catch {
        return false;
      }
    }, { timeout: 15000 })
    .toBeFalsy();
  await expect
    .poll(async () => await readFile(projectNavFile, 'utf8'), { timeout: 15000 })
    .not.toContain(pageId);
  await expect(page.getByTestId('studio-page-title-input')).toHaveCount(0);
});
