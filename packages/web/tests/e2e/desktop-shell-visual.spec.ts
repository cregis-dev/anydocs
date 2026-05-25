// Visual regression baseline for the desktop-shell primitives (Story 13.1).
//
// First-run handshake: the baseline images don't exist on disk yet, so the
// initial CI run will fail. Generate them locally with:
//
//   pnpm --filter @anydocs/web exec playwright install chromium
//   pnpm --filter @anydocs/web exec playwright test \
//     --update-snapshots tests/e2e/desktop-shell-visual.spec.ts
//
// then commit the resulting `desktop-shell-visual.spec.ts-snapshots/`
// directory. Downstream Epic 13 stories that touch primitives must run the
// same command (or trigger CI snapshot regen via the standard workflow) so
// the baseline stays in sync.

import { expect, test } from '@playwright/test';

const PREVIEW_PATH = '/desktop-shell-preview';

test.describe('desktop-shell visual regression @p1', () => {
  // Snapshots must be deterministic across CI runners. Disabling animations
  // suppresses the LocalChip pulse and any other ongoing motion before we
  // take the screenshot.
  test.use({
    viewport: { width: 1280, height: 1600 },
  });

  test('light theme baseline @p1', async ({ page }) => {
    await page.goto(PREVIEW_PATH);
    await page.waitForLoadState('networkidle');
    // Wait for web fonts so glyph metrics stabilise.
    await page.evaluate(async () => {
      if ('fonts' in document) {
        await (document as Document & { fonts: FontFaceSet }).fonts.ready;
      }
    });

    const lightSection = page.getByTestId('desktop-shell-light');
    await expect(lightSection).toBeVisible();
    await expect(lightSection).toHaveScreenshot('desktop-shell-light.png', {
      animations: 'disabled',
      maxDiffPixelRatio: 0.01,
    });
  });

  test('dark theme baseline @p1', async ({ page }) => {
    await page.goto(PREVIEW_PATH);
    await page.waitForLoadState('networkidle');
    await page.evaluate(async () => {
      if ('fonts' in document) {
        await (document as Document & { fonts: FontFaceSet }).fonts.ready;
      }
    });

    const darkSection = page.getByTestId('desktop-shell-dark');
    await expect(darkSection).toBeVisible();
    await expect(darkSection).toHaveScreenshot('desktop-shell-dark.png', {
      animations: 'disabled',
      maxDiffPixelRatio: 0.01,
    });
  });

  // Smoke check: the preview route MUST 404 in production. The dev server
  // running under Playwright is `NODE_ENV !== 'production'` so this is
  // enforced indirectly by `pnpm build:web` (the static-export pipeline
  // rejects the production case via `notFound()` inside the page module).
  // We assert dev-mode visibility here; the production 404 is covered by
  // the build step in CI.
  test('preview route renders in dev mode @p1', async ({ page }) => {
    const response = await page.goto(PREVIEW_PATH);
    expect(response?.status() ?? 0).toBeLessThan(400);
    await expect(page.getByRole('heading', { level: 1, name: /desktop-shell preview/i })).toBeVisible();
  });
});
