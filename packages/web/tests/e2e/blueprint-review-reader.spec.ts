import { expect, test } from '@playwright/test';

const docsPreviewUrl = process.env.DOCS_PREVIEW_URL;
const docsPreviewOrigin = docsPreviewUrl ? new URL(docsPreviewUrl).origin : null;

test.describe('Blueprint Review reader', () => {
  test('[P1] no-heading pages keep the article in the main content column @p1', async ({ page }) => {
    test.skip(!docsPreviewOrigin, 'Needs DOCS_PREVIEW_URL to verify reader preview routes.');

    await page.goto(`${docsPreviewOrigin!}/en/welcome`);
    await page.waitForLoadState('networkidle');

    const article = page.locator('article').first();
    await expect(article).toBeVisible();

    const box = await article.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(700);
    await expect(page.getByRole('button', { name: /on this page|show outline/i })).toHaveCount(0);
  });

  test('[P1] mobile blueprint pages expose a TOC dialog trigger @p1', async ({ page }) => {
    test.skip(!docsPreviewOrigin, 'Needs DOCS_PREVIEW_URL to verify reader preview routes.');

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${docsPreviewOrigin!}/en/blueprint-review`);
    await page.waitForLoadState('networkidle');

    const tocTrigger = page.getByRole('button', { name: /on this page/i });
    await expect(tocTrigger).toBeVisible();

    await tocTrigger.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Context')).toBeVisible();
    await expect(dialog.getByText('Proposal')).toBeVisible();
    await expect(dialog.getByText('Risks')).toBeVisible();
  });

  test('[P1] zh blueprint pages localize metadata and toc chrome @p1', async ({ page }) => {
    test.skip(!docsPreviewOrigin, 'Needs DOCS_PREVIEW_URL to verify reader preview routes.');

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${docsPreviewOrigin!}/zh/blueprint-review`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('状态', { exact: true })).toBeVisible();
    await expect(page.getByText('草稿', { exact: true })).toBeVisible();
    await expect(page.getByText('创建人', { exact: true })).toBeVisible();
    await expect(page.getByText('平台组', { exact: true })).toBeVisible();

    const tocTrigger = page.getByRole('button', { name: /本页内容/i });
    await expect(tocTrigger).toBeVisible();

    await tocTrigger.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Context')).toBeVisible();
    await expect(dialog.getByText('Decision')).toBeVisible();
  });
});
