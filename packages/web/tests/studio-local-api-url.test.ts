import assert from 'node:assert/strict';
import test from 'node:test';

import { createLocalApiUrl } from '../components/studio/local-api-url.ts';

test('createLocalApiUrl omits the extra slash before query params', () => {
  assert.equal(
    createLocalApiUrl('pages', {
      lang: 'en',
      path: '/Users/shawn/workspace/docs_home/anydocs-03',
    }),
    '/api/local/pages?__studio_api=2&lang=en&path=%2FUsers%2Fshawn%2Fworkspace%2Fdocs_home%2Fanydocs-03',
  );
});

test('createLocalApiUrl keeps slashless endpoint when there are no query params', () => {
  assert.equal(createLocalApiUrl('project', {}), '/api/local/project?__studio_api=2');
});
