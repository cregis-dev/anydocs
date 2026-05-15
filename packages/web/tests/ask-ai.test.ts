import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildAskRequestBody,
  formatAskResponseMessage,
  parseAskResponseText,
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
  assert.match(message, /- \[cit_1\] \[SDKs & Developer Tools\]\(\/en\/sdk-overview#waas-sdk\)/);
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

test('parseAskResponseText turns gateway HTML into a structured timeout error', () => {
  const response = parseAskResponseText('<!DOCTYPE html><title>504: Gateway time-out</title>', {
    contentType: 'text/html; charset=UTF-8',
    status: 504,
    statusText: 'Gateway Time-out',
  });

  assert.deepEqual(response, {
    type: 'error',
    code: 'gateway_timeout',
    message: 'Gateway Time-out',
  });
});

test('formatAskResponseMessage hides gateway HTML behind a friendly Chinese error', () => {
  assert.equal(
    formatAskResponseMessage(
      {
        type: 'error',
        code: 'gateway_timeout',
        message: 'Gateway Time-out',
      },
      'zh',
    ),
    '暂时无法回答：请求超时，请稍后重试。',
  );
});
