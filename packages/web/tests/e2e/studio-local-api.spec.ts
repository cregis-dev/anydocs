import { expect, test } from '@playwright/test';

import { buildLocalApiUrl } from './support/studio';
import { isCliStudio } from './support/studio-mode';

test.describe.configure({ mode: 'serial' });

test('[P0] standalone web dev rejects local authoring endpoints @p0', async ({ request }) => {
  test.skip(isCliStudio, 'Standalone-only assertion.');

  const response = await request.get(buildLocalApiUrl('project', {}));

  expect(response.status()).toBe(400);
  expect(response.headers()['content-type']).toContain('application/json');

  const payload = await response.json();
  expect(payload.error).toContain('Studio local APIs are only available in CLI Studio runtime.');
});

test('[P0] standalone web dev rejects local preview/build endpoints @p0', async ({ request }) => {
  test.skip(isCliStudio, 'Standalone-only assertion.');

  const previewResponse = await request.post(buildLocalApiUrl('preview', {}));
  expect(previewResponse.status()).toBe(400);

  const buildResponse = await request.post(buildLocalApiUrl('build', {}));
  expect([400, 404]).toContain(buildResponse.status());
});

test('[P1] standalone web dev keeps the same local API policy for page reads @p1', async ({ request }) => {
  test.skip(isCliStudio, 'Standalone-only assertion.');

  const response = await request.get(buildLocalApiUrl('page', { lang: 'en', pageId: 'missing-page' }));

  expect(response.status()).toBe(400);
  expect(response.headers()['content-type']).toContain('application/json');

  const payload = await response.json();
  expect(payload.error).toContain('Studio local APIs are only available in CLI Studio runtime.');
});
