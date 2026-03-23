import { expect, test } from '@playwright/test';

import { ensureProjectExists, openProjectFromWelcome, studioUrl } from './support/studio';

const docsPreviewUrl = process.env.DOCS_PREVIEW_URL;

test.beforeAll(async () => {
  await ensureProjectExists();
});

test.describe('Studio shell', () => {
  test('[P0] welcome screen exposes the external-project entry point @p0', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.removeItem('studio-projects');
    });

    await page.goto(studioUrl);

    await expect(page.getByRole('heading', { name: 'DocEditor Studio' })).toBeVisible();
    await expect(page.getByText('选择外部文档项目根目录后开始编辑')).toBeVisible();
    await expect(page.getByTestId('studio-open-project-button')).toBeVisible();
  });

  test('[P0] opening a project loads the authoring workspace chrome @p0', async ({ page }) => {
    await openProjectFromWelcome(page);

    await expect(page.getByTestId('studio-pages-sidebar')).toBeVisible();
    await expect(page.getByTestId('studio-workflow-action-button')).toBeVisible();
    await expect(page.getByTestId('studio-workflow-menu-trigger')).toBeVisible();
    await expect(page.getByTestId('studio-connection-status')).toContainText('Connected');
    await expect(page.getByTestId('studio-save-status')).toBeVisible();

    await page.getByTestId('studio-open-project-settings-button').click();
    await expect(page.getByTestId('studio-settings-sidebar')).toBeVisible();
    await expect(page.getByTestId('studio-project-name-input')).toBeVisible();
    await page.getByTestId('studio-close-settings-sidebar').click();
    await expect(page.getByTestId('studio-settings-sidebar')).toHaveCount(0);
  });

  test('[P1] explicit preview mode renders a published reader route @p1', async ({ page }) => {
    test.skip(!docsPreviewUrl, 'Needs DOCS_PREVIEW_URL to verify CLI preview/export reader routes.');

    await page.goto(docsPreviewUrl!);
    await page.waitForLoadState('networkidle');

    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('body')).toContainText(/Welcome|欢迎/);
  });
});
