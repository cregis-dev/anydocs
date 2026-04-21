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

const configPath = path.join(e2eProjectRoot, 'anydocs.config.json');

test.describe.configure({ mode: 'serial' });

test('[P0] cli studio persists project settings and reader theme fields @p0', async ({ page }) => {
  test.skip(!isCliStudio, 'Needs CLI Studio runtime.');
  test.setTimeout(60000);

  await page.goto(studioUrl);
  await waitForCliStudioReady(page);

  await page.getByTestId('studio-open-project-settings-button').click();
  await expect(page.getByTestId('studio-settings-sidebar')).toBeVisible();

  await page.getByTestId('studio-project-name-input').fill('Anydocs E2E Workspace');
  await page.getByTestId('studio-site-title-input').fill('Regression Docs');
  await page.getByTestId('studio-home-label-input').fill('Back to Docs');

  await page.getByTestId('studio-project-theme-trigger').click();
  await page.getByRole('option', { name: 'Classic Docs' }).click();
  await expect(page.getByTestId('studio-classic-docs-logo-src-input')).toBeVisible();

  await page.getByTestId('studio-project-code-theme-trigger').click();
  await page.getByRole('option', { name: 'GitHub Light' }).click();

  await page.getByTestId('studio-classic-docs-logo-src-input').fill('/brand/regression.svg');
  await page.getByTestId('studio-classic-docs-logo-alt-input').fill('Regression mark');

  const showSearchToggle = page.getByTestId('studio-classic-docs-show-search-toggle');
  if (await showSearchToggle.isChecked()) {
    await showSearchToggle.uncheck();
  }

  await page.getByTestId('studio-classic-docs-primary-color-input').fill('#112233');
  await page.getByTestId('studio-classic-docs-primary-foreground-color-input').fill('#f8fafc');
  await page.getByTestId('studio-classic-docs-accent-color-input').fill('#dde7f0');
  await page.getByTestId('studio-classic-docs-accent-foreground-color-input').fill('#1f2937');
  await page.getByTestId('studio-classic-docs-sidebar-active-color-input').fill('#0f172a');
  await page.getByTestId('studio-classic-docs-sidebar-active-foreground-color-input').fill('#ffffff');
  await page.getByTestId('studio-build-output-dir-input').fill('dist');

  await waitForStudioSaved(page);

  const persistedConfig = JSON.parse(await readFile(configPath, 'utf8')) as {
    name: string;
    site?: {
      theme?: {
        id?: string;
        codeTheme?: string;
        branding?: {
          siteTitle?: string;
          homeLabel?: string;
          logo?: {
            src?: string;
            alt?: string;
          };
        };
        chrome?: {
          showSearch?: boolean;
        };
        colors?: Record<string, string>;
      };
    };
    build?: {
      outputDir?: string;
    };
  };

  expect(persistedConfig.name).toBe('Anydocs E2E Workspace');
  expect(persistedConfig.site?.theme?.id).toBe('classic-docs');
  expect(persistedConfig.site?.theme?.codeTheme).toBe('github-light');
  expect(persistedConfig.site?.theme?.branding).toMatchObject({
    siteTitle: 'Regression Docs',
    homeLabel: 'Back to Docs',
    logoSrc: '/brand/regression.svg',
    logoAlt: 'Regression mark',
  });
  expect(persistedConfig.site?.theme?.chrome?.showSearch).toBe(false);
  expect(persistedConfig.site?.theme?.colors).toMatchObject({
    primary: '#112233',
    primaryForeground: '#f8fafc',
    accent: '#dde7f0',
    accentForeground: '#1f2937',
    sidebarActive: '#0f172a',
  });
  expect(persistedConfig.build?.outputDir).toBe('dist');

  await page.reload();
  await waitForCliStudioReady(page);
  await page.getByTestId('studio-open-project-settings-button').click();

  await expect(page.getByTestId('studio-project-name-input')).toHaveValue('Anydocs E2E Workspace');
  await expect(page.getByTestId('studio-site-title-input')).toHaveValue('Regression Docs');
  await expect(page.getByTestId('studio-home-label-input')).toHaveValue('Back to Docs');
  await expect(page.getByTestId('studio-project-theme-trigger')).toContainText('Classic Docs');
  await expect(page.getByTestId('studio-project-code-theme-trigger')).toContainText('GitHub Light');
  await expect(page.getByTestId('studio-classic-docs-logo-src-input')).toHaveValue('/brand/regression.svg');
  await expect(page.getByTestId('studio-build-output-dir-input')).toHaveValue('dist');
});
