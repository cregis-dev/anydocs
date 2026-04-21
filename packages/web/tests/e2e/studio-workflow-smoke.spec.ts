import { access } from 'node:fs/promises';
import path from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import {
  e2eProjectRoot,
  studioUrl,
  waitForCliStudioReady,
} from './support/studio';
import { isCliStudio } from './support/studio-mode';

const artifactRoot = path.join(e2eProjectRoot, 'dist');

test.describe.configure({ mode: 'serial' });

async function triggerWorkflowAction<T>(page: Page, buttonTestId: string, endpoint: 'build' | 'preview') {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await page.getByTestId('studio-workflow-menu-trigger').click();
    const responsePromise = page.waitForResponse(
      (response) => response.url().includes(`/api/local/${endpoint}?`) && response.request().method() === 'POST',
      { timeout: 45000 },
    );
    await page.getByTestId(buttonTestId).click();

    try {
      const response = await responsePromise;
      expect(response.ok()).toBeTruthy();
      return (await response.json()) as T;
    } catch (error) {
      if (attempt === 1) {
        throw error;
      }
      await waitForCliStudioReady(page);
    }
  }
}

test('[P0] cli studio build and preview workflows succeed on published docs @p0', async ({ page, request }) => {
  test.skip(!isCliStudio, 'Needs CLI Studio runtime.');
  test.setTimeout(60000);

  await page.goto(studioUrl);
  await waitForCliStudioReady(page);

  await page.getByRole('button', { name: 'Welcome', exact: true }).click();

  const buildResult = await triggerWorkflowAction<{
    artifactRoot: string;
    languages: Array<{ lang: string; publishedPages: number }>;
  }>(page, 'studio-build-button', 'build');
  expect(buildResult.artifactRoot).toBe(artifactRoot);
  expect(buildResult.languages).toMatchObject([{ lang: 'en', publishedPages: 2 }]);

  await access(path.join(artifactRoot, 'search-index.en.json'));
  await access(path.join(artifactRoot, 'search-find.en.json'));
  await access(path.join(artifactRoot, 'en', 'welcome', 'index.html'));

  const previewResult = await triggerWorkflowAction<{
    docsPath: string;
    previewUrl?: string;
  }>(page, 'studio-preview-button', 'preview');
  const previewUrl = previewResult.previewUrl ?? previewResult.docsPath;
  expect(previewUrl).toBeTruthy();

  const previewResponse = await request.get(previewUrl);
  expect(previewResponse.ok()).toBeTruthy();
  await expect.soft(await previewResponse.text()).toContain('Welcome');
});
