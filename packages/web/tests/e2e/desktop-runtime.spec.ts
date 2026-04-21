import { cp, mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { expect, test } from '@playwright/test';

import { studioUrl } from './support/studio';

const repoRoot = path.resolve(__dirname, '../../../..');
const starterDocsRoot = path.join(repoRoot, 'examples', 'starter-docs');

async function createTempDocsProject() {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'anydocs-desktop-smoke-'));
  const projectRoot = path.join(tempRoot, 'starter-docs');
  await cp(starterDocsRoot, projectRoot, {
    recursive: true,
  });
  return projectRoot;
}

test.describe.configure({ mode: 'serial' });

test('desktop runtime smoke: open project, save, create page, build, preview', async ({ page, request }) => {
  test.setTimeout(120_000);
  const projectRoot = await createTempDocsProject();
  const createdSlug = 'desktop/runtime-smoke';
  const createdTitle = 'Desktop Runtime Smoke';
  const updatedWelcomeTitle = 'Welcome Desktop Smoke';

  try {
    await page.goto(studioUrl);

    await page.getByTestId('studio-open-project-button').click();
    await page.getByTestId('studio-project-path-input').fill(projectRoot);
    await page.getByTestId('studio-project-path-submit').click();

    await expect(page.getByTestId('studio-pages-sidebar')).toBeVisible();
    await expect(page.getByTestId('studio-connection-status')).toContainText('Connected');

    await page.getByTestId('studio-nav-page-menu-trigger-welcome').click();
    await page.getByTestId('studio-nav-page-edit-button-welcome').click();
    await expect(page.getByTestId('studio-settings-sidebar')).toBeVisible();

    await page.getByTestId('studio-page-title-input').fill(updatedWelcomeTitle);
    await page.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent('__ANYDOCS_DESKTOP_MENU__', {
          detail: { action: 'save' },
        }),
      );
    });
    await expect(page.getByTestId('studio-save-status')).toContainText('All changes saved', {
      timeout: 10000,
    });

    await page.reload();
    await expect(page.getByTestId('studio-pages-sidebar')).toBeVisible();
    await page.getByTestId('studio-nav-page-menu-trigger-welcome').click();
    await page.getByTestId('studio-nav-page-edit-button-welcome').click();
    await expect(page.getByTestId('studio-page-title-input')).toHaveValue(updatedWelcomeTitle);

    await page.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent('__ANYDOCS_DESKTOP_MENU__', {
          detail: { action: 'new-page' },
        }),
      );
    });

    await expect(page.getByText('Add Page')).toBeVisible();
    await page.getByPlaceholder('Untitled').fill(createdTitle);
    await page.getByPlaceholder('getting-started/new-page').fill(createdSlug);
    await page.getByRole('button', { name: 'Create Page' }).click();

    await expect(page.getByRole('button', { name: createdTitle }).first()).toBeVisible();
    await expect(page.getByTestId('studio-save-status')).toContainText('All changes saved', {
      timeout: 10000,
    });

    await page.getByTestId('studio-workflow-menu-trigger').click();
    await page.getByTestId('studio-build-button').click();
    const buildValidatedMessage = page.getByText(/Build validated ->/).first();
    await expect(buildValidatedMessage).toContainText('Build validated', {
      timeout: 60000,
    });

    await page.getByTestId('studio-workflow-menu-trigger').click();
    await page.getByTestId('studio-preview-button').click();
    const previewReadyMessage = page.getByText(/Preview ready:/).first();
    await expect(previewReadyMessage).toContainText('Preview ready', {
      timeout: 60000,
    });

    const previewMessage = await previewReadyMessage.textContent();
    const previewUrl = previewMessage?.match(/https?:\/\/\S+/)?.[0];
    expect(previewUrl).toBeTruthy();

    const previewResponse = await request.get(previewUrl!);
    expect(previewResponse.ok()).toBeTruthy();
    await expect
      .soft(await previewResponse.text())
      .toContain(updatedWelcomeTitle);

    const pagesRoot = path.join(projectRoot, 'pages');
    const pageDirs = await readdir(pagesRoot, { withFileTypes: true });
    const pageFiles = (
      await Promise.all(
        pageDirs
          .filter((entry) => entry.isDirectory())
          .map(async (entry) => {
            const dirPath = path.join(pagesRoot, entry.name);
            const files = await readdir(dirPath);
            return files
              .filter((file) => file.endsWith('.json'))
              .map((file) => path.join(dirPath, file));
          }),
      )
    ).flat();
    const createdPagePath = (
      await Promise.all(
        pageFiles.map(async (fullPath) => {
          const contents = JSON.parse(await readFile(fullPath, 'utf8')) as { slug?: string };
          return contents.slug === createdSlug ? fullPath : null;
          }),
      )
    ).find(Boolean);

    expect(createdPagePath).toBeTruthy();
    const createdPage = JSON.parse(await readFile(createdPagePath!, 'utf8')) as { title?: string; slug?: string };
    expect(createdPage.title).toBe(createdTitle);
    expect(createdPage.slug).toBe(createdSlug);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test('desktop runtime language switch clears stale page selection before requesting the new language', async ({ page }) => {
  const projectRoot = await createTempDocsProject();
  const createdSlug = 'desktop/runtime-zh-only';
  const createdTitle = 'Desktop Runtime Zh Only';
  const failedPageGetResponses: Array<{ status: number; url: string; body: string }> = [];

  page.on('response', async (response) => {
    if (!response.url().includes('/studio/page/get') || response.status() < 500) {
      return;
    }

    failedPageGetResponses.push({
      status: response.status(),
      url: response.url(),
      body: await response.text().catch(() => ''),
    });
  });

  try {
    await page.goto(studioUrl);

    await page.getByTestId('studio-open-project-button').click();
    await page.getByTestId('studio-project-path-input').fill(projectRoot);
    await page.getByTestId('studio-project-path-submit').click();

    await expect(page.getByTestId('studio-pages-sidebar')).toBeVisible();
    await expect(page.getByTestId('studio-connection-status')).toContainText('Connected');
    await expect(page.getByTestId('studio-language-switcher')).toContainText('中文');

    await page.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent('__ANYDOCS_DESKTOP_MENU__', {
          detail: { action: 'new-page' },
        }),
      );
    });

    await expect(page.getByText('Add Page')).toBeVisible();
    await page.getByPlaceholder('Untitled').fill(createdTitle);
    await page.getByPlaceholder('getting-started/new-page').fill(createdSlug);
    await page.getByRole('button', { name: 'Create Page' }).click();

    await expect(page.getByRole('button', { name: createdTitle }).first()).toBeVisible();
    await expect(page.getByTestId('studio-save-status')).toContainText('All changes saved', {
      timeout: 10000,
    });

    await page.getByTestId('studio-language-switcher').click();
    await page.getByRole('option', { name: 'EN' }).click();

    await expect(page.getByTestId('studio-language-switcher')).toContainText('EN');
    await expect(page.getByRole('button', { name: 'Starter Docs Example' })).toBeVisible();
    await expect(page.getByTestId('studio-connection-status')).toContainText('Connected');
    await expect(page.getByTestId('studio-save-status')).toContainText('All changes saved');
    await expect.poll(() => failedPageGetResponses, {
      message: JSON.stringify(failedPageGetResponses, null, 2),
      timeout: 5000,
    }).toHaveLength(0);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test('desktop runtime shows workflow progress details for slower builds', async ({ page }) => {
  test.setTimeout(120_000);
  const projectRoot = await createTempDocsProject();

  await page.route('**/studio/build/post', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 5_200));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          artifactRoot: `${projectRoot}/dist`,
          languages: [{ lang: 'zh', publishedPages: 1 }],
        },
      }),
    });
  });

  try {
    await page.goto(studioUrl);

    await page.getByTestId('studio-open-project-button').click();
    await page.getByTestId('studio-project-path-input').fill(projectRoot);
    await page.getByTestId('studio-project-path-submit').click();

    await expect(page.getByTestId('studio-pages-sidebar')).toBeVisible();
    await expect(page.getByTestId('studio-connection-status')).toContainText('Connected');

    await page.getByTestId('studio-workflow-menu-trigger').click();
    await page.getByTestId('studio-build-button').click();

    await expect(page.getByTestId('studio-workflow-progress')).toContainText('Build in progress');
    await expect(page.getByTestId('studio-save-status')).toContainText('Build in progress (', {
      timeout: 10_000,
    });
    await expect(page.getByTestId('studio-workflow-progress')).toContainText('Current step: Generating artifacts', {
      timeout: 10_000,
    });
    const buildValidatedMessage = page.getByText(/Build validated ->/).first();
    await expect(buildValidatedMessage).toContainText('Build validated', {
      timeout: 60_000,
    });
  } finally {
    await page.unroute('**/studio/build/post');
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test('desktop runtime classifies workflow failures with actionable guidance', async ({ page }) => {
  const projectRoot = await createTempDocsProject();

  await page.route('**/studio/build/post', async (route) => {
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({
        success: false,
        error: {
          code: 'RUNTIME_LOCK_TIMEOUT',
          message: 'Timed out waiting for the shared web runtime lock at "/tmp/anydocs.lock".',
        },
      }),
    });
  });

  try {
    await page.goto(studioUrl);

    await page.getByTestId('studio-open-project-button').click();
    await page.getByTestId('studio-project-path-input').fill(projectRoot);
    await page.getByTestId('studio-project-path-submit').click();

    await expect(page.getByTestId('studio-pages-sidebar')).toBeVisible();
    await expect(page.getByTestId('studio-connection-status')).toContainText('Connected');

    await page.getByTestId('studio-workflow-menu-trigger').click();
    await page.getByTestId('studio-build-button').click();

    await expect(page.getByTestId('studio-workflow-error')).toContainText(
      'Build blocked by another docs runtime task',
    );
    await expect(page.getByTestId('studio-workflow-error')).toContainText(
      'Wait a moment, close stale preview windows if needed, then retry.',
    );
    await expect(page.getByTestId('studio-save-status')).toContainText(
      'Build blocked by another docs runtime task',
    );
  } finally {
    await page.unroute('**/studio/build/post');
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test('desktop runtime exposes workflow success actions for build results', async ({ page }) => {
  test.setTimeout(120_000);
  const projectRoot = await createTempDocsProject();
  const previewUrl = 'http://127.0.0.1:43123/zh/welcome';

  await page.addInitScript((nextProjectRoot: string) => {
    (
      window as Window & {
        __openedLocalPath?: string;
        __openedPreviewUrl?: string;
      }
    ).__openedLocalPath = undefined;
    (
      window as Window & {
        __openedLocalPath?: string;
        __openedPreviewUrl?: string;
      }
    ).__openedPreviewUrl = undefined;
    window.__ANYDOCS_DESKTOP_BRIDGE__ = {
      pickProjectDirectory: async () => nextProjectRoot,
      openLocalPath: async (path: string) => {
        (window as Window & { __openedLocalPath?: string }).__openedLocalPath = path;
        return true;
      },
    };
    window.open = ((url?: string | URL) => {
      const nextUrl = typeof url === 'string' ? url : url?.toString() ?? '';
      (window as Window & { __openedPreviewUrl?: string }).__openedPreviewUrl = nextUrl;
      let currentHref = nextUrl;
      return {
        closed: false,
        location: {
          get href() {
            return currentHref;
          },
          set href(value: string) {
            currentHref = value;
            (window as Window & { __openedPreviewUrl?: string }).__openedPreviewUrl = value;
          },
        },
        focus() {},
        close() {
          this.closed = true;
        },
      } as unknown as Window;
    }) as typeof window.open;
  }, projectRoot);

  await page.route('**/studio/build/post', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          artifactRoot: `${projectRoot}/dist`,
          languages: [{ lang: 'zh', publishedPages: 1 }],
        },
      }),
    });
  });

  await page.route('**/studio/preview/post', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          docsPath: '/zh/welcome',
          previewUrl,
        },
      }),
    });
  });

  try {
    await page.goto(studioUrl);

    await page.getByTestId('studio-open-project-button').click();

    await expect(page.getByTestId('studio-pages-sidebar')).toBeVisible();
    await expect(page.getByTestId('studio-connection-status')).toContainText('Connected');

    await page.getByTestId('studio-workflow-menu-trigger').click();
    await page.getByTestId('studio-build-button').click();

    await expect(page.getByTestId('studio-workflow-message')).toContainText('Build completed');
    await expect(page.getByTestId('studio-workflow-open-artifacts-button')).toBeVisible();
    await expect(page.getByTestId('studio-workflow-run-preview-button')).toBeVisible();
    await page.reload();
    await expect(page.getByTestId('studio-pages-sidebar')).toBeVisible();
    await expect(page.getByTestId('studio-workflow-message')).toContainText('Build completed');
    await expect(page.getByTestId('studio-workflow-open-artifacts-button')).toBeVisible();

    await page.getByTestId('studio-workflow-open-artifacts-button').click();
    await expect.poll(() =>
      page.evaluate(() => (window as Window & { __openedLocalPath?: string }).__openedLocalPath ?? null),
    ).toBe(`${projectRoot}/dist`);

    await page.getByTestId('studio-workflow-run-preview-button').click();
    await expect(page.getByTestId('studio-workflow-message')).toContainText('Preview ready');
    await expect(page.getByTestId('studio-workflow-open-preview-button')).toBeVisible();
    await expect(page.getByTestId('studio-workflow-history')).toContainText('Build completed');
    await expect.poll(() =>
      page.evaluate(() => (window as Window & { __openedPreviewUrl?: string }).__openedPreviewUrl ?? null),
    ).toBe(previewUrl);
    await page.getByTestId('studio-dismiss-workflow-result-button').click();
    await expect(page.getByTestId('studio-workflow-message')).toBeHidden();
  } finally {
    await page.unroute('**/studio/build/post').catch(() => {});
    await page.unroute('**/studio/preview/post').catch(() => {});
    await rm(projectRoot, { recursive: true, force: true });
  }
});
