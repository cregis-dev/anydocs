import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveReaderLanguageHref } from './language-switch.ts';

test('language switch preserves a published slug and falls back for localized slugs', async () => {
  const request: typeof fetch = async (url) => {
    assert.equal(url, '/search-index.zh.json');
    return Response.json({ docs: [{ pageSlug: 'overview' }, { pageSlug: 'zh-guide' }] });
  };
  assert.equal(await resolveReaderLanguageHref('/en/overview/', 'en', 'zh', undefined, request), '/zh/overview/');
  assert.equal(await resolveReaderLanguageHref('/en/en-guide/', 'en', 'zh', undefined, request), '/zh/');
});

test('language homepage and unavailable preview indexes resolve to the target homepage', async () => {
  const request: typeof fetch = async (url) => {
    assert.equal(url, '/api/docs/search-index?lang=en');
    return new Response(null, { status: 404 });
  };
  assert.equal(await resolveReaderLanguageHref('/zh/', 'zh', 'en', undefined, request), '/en/');
  assert.equal(await resolveReaderLanguageHref('/zh/guide', 'zh', 'en', '/api/docs/search-index?lang=zh', request), '/en/');
});
