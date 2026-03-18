import assert from 'node:assert/strict';
import test from 'node:test';

import { sanitizeCookieDocsSource } from '../lib/docs/request-source.ts';

test('sanitizeCookieDocsSource strips absolute cookie paths', () => {
  assert.deepEqual(sanitizeCookieDocsSource('default', '/tmp/anydocs-project'), {
    projectId: 'default',
  });
});

test('sanitizeCookieDocsSource strips parent-directory cookie paths', () => {
  assert.deepEqual(sanitizeCookieDocsSource('default', '../private-project'), {
    projectId: 'default',
  });
});

test('sanitizeCookieDocsSource keeps safe relative cookie paths', () => {
  assert.deepEqual(sanitizeCookieDocsSource('default', 'workspace/demo-docs'), {
    projectId: 'default',
    customPath: 'workspace/demo-docs',
  });
});
