import { expect, test } from '@playwright/test';

import { studioUrl } from './support/studio';

const docsPreviewUrl = process.env.DOCS_PREVIEW_URL;

test.describe('Studio shell', () => {
  test('[P0] standalone web dev does not expose /studio @p0', async ({ page }) => {
    await page.goto(studioUrl);

    await expect(page).toHaveTitle(/404|Not Found/i);
    await expect(page.getByText(/404|Not Found/i)).toBeVisible();
  });

  test('[P0] standalone web dev does not expose the root studio page @p0', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveTitle(/404|Not Found/i);
    await expect(page.getByText(/404|Not Found/i)).toBeVisible();
  });

  test('[P1] explicit preview mode renders a published reader route @p1', async ({ page }) => {
    test.skip(!docsPreviewUrl, 'Needs DOCS_PREVIEW_URL to verify CLI preview/export reader routes.');

    await page.goto(docsPreviewUrl!);
    await page.waitForLoadState('networkidle');

    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('body')).toContainText(/Welcome|欢迎/);
  });
});
