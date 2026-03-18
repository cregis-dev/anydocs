import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

import { expect, test, type Dialog, type Page } from '@playwright/test';

const repoRoot = path.resolve(__dirname, '../../../..');
const cliEntry = path.join(repoRoot, 'packages/cli/src/index.ts');
const projectRoot =
  process.env.ANYDOCS_E2E_PROJECT_ROOT ?? path.join(repoRoot, '.tmp', 'playwright-anydocs-project');
const configFile = path.join(projectRoot, 'anydocs.config.json');

function runCliCommand(args: string[]) {
  execFileSync('node', ['--experimental-strip-types', cliEntry, ...args], {
    cwd: repoRoot,
    env: process.env,
    stdio: 'pipe',
  });
}

async function ensureProjectExists() {
  try {
    await access(configFile);
  } catch {
    runCliCommand(['init', projectRoot]);
  }
}

function acceptDialog(page: Page, message: string | RegExp, value?: string) {
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

async function acceptDialogSequence(
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

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  await ensureProjectExists();
});

test('authoring flow covers CLI init, Studio editing, preview, and build @p0', async ({ page }) => {
  test.setTimeout(600000);

  const runId = Date.now().toString(36);
  const groupName = `API Guides ${runId}`;
  const pageTitle = `Authentication API ${runId}`;
  const pageSlug = `api/authentication-${runId}`;
  const pageId = `authentication-${runId}`;
  const pageDescription = `Token and session flows for ${runId}.`;
  const pageBody = `Authentication flow ${runId}`;
  const savedNavFile = path.join(projectRoot, 'navigation', 'en.json');

  await page.goto('/studio');
  await expect(page.getByTestId('studio-open-project-button')).toBeVisible();

  const openProjectDialog = acceptDialog(page, '输入文档项目根目录的绝对路径', projectRoot);
  await page.getByTestId('studio-open-project-button').click();
  await openProjectDialog;

  await expect(page.getByText('Anydocs Project')).toBeVisible();
  await expect(page.getByTestId('studio-pages-sidebar')).toBeVisible();
  await expect(page.getByTestId('studio-settings-sidebar')).toBeVisible();

  const createGroupDialog = acceptDialog(page, '请输入分组名称', groupName);
  await page.getByTestId('studio-create-menu-trigger').click();
  await page.getByTestId('studio-create-group-button').click();
  await createGroupDialog;
  await expect(page.getByText(groupName)).toBeVisible();

  const createPageDialogs = acceptDialogSequence(page, [
    { message: '请输入 slug（例如 getting-started/new-page）', value: pageSlug },
    { message: '请输入标题（Display Title）', value: pageTitle },
  ]);
  await page.getByTestId('studio-create-menu-trigger').click();
  await page.getByTestId('studio-create-page-button').click();
  await createPageDialogs;

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

  await expect(page.getByTestId('studio-save-status')).toContainText('All changes saved', { timeout: 20000 });
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
  await page.getByTestId('studio-preview-button').click();
  const previewPage = await previewPagePromise;
  await previewPage.waitForLoadState('domcontentloaded');
  await expect(page.getByTestId('studio-workflow-message')).toContainText('Preview ready:', { timeout: 30000 });
  await expect(previewPage).toHaveURL(/\/en\/welcome\/$/, { timeout: 30000 });
  await previewPage.goto(new URL(`/en/${pageSlug}/`, previewPage.url()).toString());
  await expect(previewPage.getByRole('heading', { name: pageTitle })).toBeVisible({ timeout: 30000 });
  await previewPage.close();

  const builtIndex = path.join(projectRoot, 'dist', 'index.html');
  const builtLlms = path.join(projectRoot, 'dist', 'llms.txt');

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

  const runId = Date.now().toString(36);
  const pageTitle = `Delete Me ${runId}`;
  const pageSlug = `cleanup/delete-me-${runId}`;
  const pageId = `delete-me-${runId}`;
  const projectNavFile = path.join(projectRoot, 'navigation', 'en.json');
  const projectPageFile = path.join(projectRoot, 'pages', 'en', `${pageId}.json`);

  await page.goto('/studio');
  const openProjectDialog = acceptDialog(page, '输入文档项目根目录的绝对路径', projectRoot);
  await page.getByTestId('studio-open-project-button').click();
  await openProjectDialog;

  const createPageDialogs = acceptDialogSequence(page, [
    { message: '请输入 slug（例如 getting-started/new-page）', value: pageSlug },
    { message: '请输入标题（Display Title）', value: pageTitle },
  ]);
  await page.getByTestId('studio-create-menu-trigger').click();
  await page.getByTestId('studio-create-page-button').click();
  await createPageDialogs;
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
  await expect(page.getByTestId('studio-page-title-input')).not.toHaveValue(pageTitle);
});
