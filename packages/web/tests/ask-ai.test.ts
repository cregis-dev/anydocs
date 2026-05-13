import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildAskRequestBody,
  formatAskResponseMessage,
  resolveAskEndpoint,
} from '../components/ask-ai-api.ts';

test('resolveAskEndpoint uses an explicit base URL when provided', () => {
  assert.equal(
    resolveAskEndpoint('https://gw.example.com/ask/', {
      protocol: 'https:',
      hostname: 'docs.example.com',
    }),
    'https://gw.example.com/ask/v1/ask',
  );
});

test('resolveAskEndpoint defaults to the same-origin docs proxy', () => {
  assert.equal(
    resolveAskEndpoint('', {
      protocol: 'https:',
      hostname: 'cregis-developer.cregis.dev',
    }),
    '/ask-api/v1/ask',
  );
});

test('buildAskRequestBody includes page context only when known', () => {
  assert.deepEqual(buildAskRequestBody('  How do I sign requests?  ', 'sdk-overview'), {
    question: 'How do I sign requests?',
    context: { current_page_id: 'sdk-overview' },
    options: { max_chunks: 5 },
  });

  assert.deepEqual(buildAskRequestBody('What is Cregis?', null), {
    question: 'What is Cregis?',
    options: { max_chunks: 5 },
  });
});

test('formatAskResponseMessage renders answer citations without losing markdown', () => {
  const message = formatAskResponseMessage(
    {
      type: 'answer',
      answer_md: 'Use the official SDK to handle signing.',
      citations: [
        {
          citation_id: 'cit_1',
          title: 'SDKs & Developer Tools',
          url: '/en/sdk-overview#waas-sdk',
        },
      ],
    },
    'en',
  );

  assert.match(message, /Use the official SDK/);
  assert.match(message, /Sources/);
  assert.match(message, /SDKs & Developer Tools/);
});

test('formatAskResponseMessage localizes structured errors for Chinese docs', () => {
  assert.equal(
    formatAskResponseMessage(
      {
        type: 'error',
        code: 'llm_request_failed',
        message: 'upstream failed',
      },
      'zh',
    ),
    '暂时无法回答：upstream failed',
  );
});
