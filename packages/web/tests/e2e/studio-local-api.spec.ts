import { access, readFile } from 'node:fs/promises';
import path from 'node:path';

import { expect, test } from '@playwright/test';

import {
  buildLocalApiUrl,
  ensureProjectExists,
  ensurePublishedWelcomePage,
  getProjectId,
  projectRoot,
  readJsonFile,
} from './support/studio';

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  await ensureProjectExists();
});

test('[P0] local authoring endpoints return canonical JSON payloads @p0', async ({ request }) => {
  const projectId = await getProjectId();

  const projectResponse = await request.get(
    buildLocalApiUrl('project', {
      projectId,
      path: projectRoot,
    }),
  );
  expect(projectResponse.status()).toBe(200);
  expect(projectResponse.headers()['content-type']).toContain('application/json');

  const projectPayload = await projectResponse.json();
  expect(projectPayload.paths.projectRoot).toBe(projectRoot);
  expect(projectPayload.config.projectId).toBe(projectId);
  expect(Array.isArray(projectPayload.config.languages)).toBeTruthy();

  const pagesResponse = await request.get(
    buildLocalApiUrl('pages', {
      lang: 'en',
      projectId,
      path: projectRoot,
    }),
  );
  expect(pagesResponse.status()).toBe(200);

  const pagesPayload = await pagesResponse.json();
  expect(Array.isArray(pagesPayload.pages)).toBeTruthy();
  const firstPageId = pagesPayload.pages[0]?.id as string | undefined;
  expect(firstPageId).toBeTruthy();

  const pageResponse = await request.get(
    buildLocalApiUrl('page', {
      lang: 'en',
      pageId: firstPageId,
      projectId,
      path: projectRoot,
    }),
  );
  expect(pageResponse.status()).toBe(200);

  const pagePayload = await pageResponse.json();
  expect(pagePayload.id).toBe(firstPageId);
  expect(pagePayload.lang).toBe('en');

  const navigationResponse = await request.get(
    buildLocalApiUrl('navigation', {
      lang: 'en',
      projectId,
      path: projectRoot,
    }),
  );
  expect(navigationResponse.status()).toBe(200);

  const navigationPayload = await navigationResponse.json();
  expect(navigationPayload.version).toBe(1);
  expect(Array.isArray(navigationPayload.items)).toBeTruthy();

  const apiSourcesResponse = await request.get(
    buildLocalApiUrl('api-sources', {
      projectId,
      path: projectRoot,
    }),
  );
  expect(apiSourcesResponse.status()).toBe(200);

  const apiSourcesPayload = await apiSourcesResponse.json();
  expect(Array.isArray(apiSourcesPayload.sources)).toBeTruthy();
});

test('[P0] preview and build endpoints return stable responses and usable artifacts @p0', async ({ request }) => {
  test.setTimeout(600_000);

  const projectId = await getProjectId();
  await ensurePublishedWelcomePage();

  const previewResponse = await request.post(
    buildLocalApiUrl('preview', {
      projectId,
      path: projectRoot,
    }),
  );
  expect(previewResponse.status()).toBe(200);
  expect(previewResponse.headers()['content-type']).toContain('application/json');

  const previewPayload = await previewResponse.json();
  expect(previewPayload.docsPath).toMatch(/^\/en(?:\/|$)/);
  if (previewPayload.previewUrl) {
    expect(previewPayload.previewUrl).toContain('http');
  }

  const buildResponse = await request.post(
    buildLocalApiUrl('build', {
      projectId,
      path: projectRoot,
    }),
  );
  expect(buildResponse.status()).toBe(200);
  expect(buildResponse.headers()['content-type']).toContain('application/json');

  const buildPayload = await buildResponse.json();
  expect(buildPayload.artifactRoot).toBe(path.join(projectRoot, 'dist'));
  expect(Array.isArray(buildPayload.languages)).toBeTruthy();
  expect(buildPayload.languages.some((entry: { lang: string; publishedPages: number }) => entry.lang === 'en')).toBeTruthy();

  const llmsPath = path.join(projectRoot, 'dist', 'llms.txt');
  await access(llmsPath);
  expect(await readFile(llmsPath, 'utf8')).toContain('/en/welcome');

  const mcpPages = await readJsonFile<{ pages: Array<{ id: string; href: string }> }>(
    path.join(projectRoot, 'dist', 'mcp', 'pages.en.json'),
  );
  expect(mcpPages.pages.some((page) => page.id === 'welcome' && page.href === '/en/welcome')).toBeTruthy();
});

test('[P1] page endpoint returns a structured JSON 404 for missing pages @p1', async ({ request }) => {
  const projectId = await getProjectId();

  const response = await request.get(
    buildLocalApiUrl('page', {
      lang: 'en',
      pageId: 'missing-page',
      projectId,
      path: projectRoot,
    }),
  );

  expect(response.status()).toBe(404);
  expect(response.headers()['content-type']).toContain('application/json');

  const payload = await response.json();
  expect(payload.error).toContain('missing-page');
});
