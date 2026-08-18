import assert from 'node:assert/strict';
import test from 'node:test';

import { readPageSeoMetadata } from '../lib/docs/page-seo.ts';

test('readPageSeoMetadata reads nested page seo fields', () => {
  assert.deepEqual(
    readPageSeoMetadata({
      seo: {
        title: 'Cregis Developer Center | API Docs & Quickstart Guide',
        description: 'Start building with Cregis APIs & SDKs.',
        keywords: ['Cregis developer center', 'API documentation', 'SDK'],
      },
    }),
    {
      title: 'Cregis Developer Center | API Docs & Quickstart Guide',
      description: 'Start building with Cregis APIs & SDKs.',
      keywords: ['Cregis developer center', 'API documentation', 'SDK'],
    },
  );
});

test('readPageSeoMetadata reads direct page seo fields', () => {
  assert.deepEqual(
    readPageSeoMetadata({
      title: 'Cregis 开发者中心 | API 文档与快速入门',
      description: '使用 Cregis API 与 SDK 快速开发。',
      keywords: ['Cregis 开发者中心', 'API 文档'],
    }),
    {
      title: 'Cregis 开发者中心 | API 文档与快速入门',
      description: '使用 Cregis API 与 SDK 快速开发。',
      keywords: ['Cregis 开发者中心', 'API 文档'],
    },
  );
});

test('readPageSeoMetadata normalizes comma-separated keywords', () => {
  assert.deepEqual(
    readPageSeoMetadata({
      seo: {
        keywords: 'Cregis 开发者中心, API 文档, SDK, API 文档',
      },
    }),
    {
      keywords: ['Cregis 开发者中心', 'API 文档', 'SDK'],
    },
  );
});

test('readPageSeoMetadata ignores invalid and empty values', () => {
  assert.deepEqual(
    readPageSeoMetadata({
      seo: {
        title: '   ',
        description: 123,
        keywords: ['SDK', '', 42, '  quickstart  '],
      },
    }),
    {
      keywords: ['SDK', 'quickstart'],
    },
  );
});
