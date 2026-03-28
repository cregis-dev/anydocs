import { expect, test } from '@playwright/test';

import { studioUrl } from './support/studio';

test.describe.configure({ mode: 'serial' });

test('authoring flow is not available from standalone web /studio @p0', async ({ page }) => {
  await page.goto(studioUrl);
  await expect(page.getByText(/404|Not Found/i)).toBeVisible();
});

test('standalone web root does not boot the authoring workspace @p0', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText(/404|Not Found/i)).toBeVisible();
});
