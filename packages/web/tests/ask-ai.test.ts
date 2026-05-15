import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildAskRequestBody,
  formatAskResponseMessage,
  parseAskResponseText,
  readAskStreamResponse,
  resolveAskEndpoint,
  resolveAskStreamEndpoint,
  shouldUseAskJsonFallback,
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

test('resolveAskStreamEndpoint defaults to the same-origin docs proxy stream route', () => {
  assert.equal(
    resolveAskStreamEndpoint('', {
      protocol: 'https:',
      hostname: 'cregis-developer.cregis.dev',
    }),
    '/ask-api/v1/ask/stream',
  );
});

test('resolveAskStreamEndpoint appends the stream route to explicit bases', () => {
  assert.equal(
    resolveAskStreamEndpoint('https://gw.example.com/ask/', {
      protocol: 'https:',
      hostname: 'docs.example.com',
    }),
    'https://gw.example.com/ask/v1/ask/stream',
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

test('readAskStreamResponse handles chunked SSE delta, result, and done events', async () => {
  const encoder = new TextEncoder();
  const chunks = [
    'event: status\ndata: {"stage":"received"}\n\n',
    'event: delta\ndata: {"text":"Hello "}\n\n',
    'event: delta\ndata: {"text":"world"}\n\n',
    'event: result\ndata: {"type":"answer","answer_md":"Hello world","citations":[]}\n\n',
    'event: done\ndata: {"ok":true}\n\n',
  ];
  const response = new Response(
    new ReadableStream({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      },
    }),
    { headers: { 'Content-Type': 'text/event-stream' } },
  );
  const deltas: string[] = [];
  const statuses: string[] = [];

  const result = await readAskStreamResponse(response, {
    onStatus: (stage) => statuses.push(stage),
    onDelta: (text) => deltas.push(text),
  });

  assert.deepEqual(statuses, ['received']);
  assert.deepEqual(deltas, ['Hello ', 'world']);
  assert.deepEqual(result, {
    type: 'answer',
    answer_md: 'Hello world',
    citations: [],
  });
});

test('readAskStreamResponse supports multi-line SSE data fields', async () => {
  const encoder = new TextEncoder();
  const response = new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            'event: result\n' +
              'data: {"type":"error",\n' +
              'data: "code":"invalid_request",\n' +
              'data: "message":"bad"}\n\n',
          ),
        );
        controller.close();
      },
    }),
    { headers: { 'Content-Type': 'text/event-stream' } },
  );

  assert.deepEqual(await readAskStreamResponse(response), {
    type: 'error',
    code: 'invalid_request',
    message: 'bad',
  });
});

test('readAskStreamResponse turns non-SSE gateway HTML into a structured timeout', async () => {
  const response = new Response('<!DOCTYPE html><title>504: Gateway time-out</title>', {
    status: 504,
    statusText: 'Gateway Time-out',
    headers: { 'Content-Type': 'text/html; charset=UTF-8' },
  });

  assert.deepEqual(await readAskStreamResponse(response), {
    type: 'error',
    code: 'gateway_timeout',
    message: 'Gateway Time-out',
  });
});

test('readAskStreamResponse marks a truncated SSE stream as empty_stream', async () => {
  const encoder = new TextEncoder();
  const response = new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('event: status\ndata: {"stage":"generating"}\n\n'));
        controller.close();
      },
    }),
    { headers: { 'Content-Type': 'text/event-stream' } },
  );

  assert.deepEqual(await readAskStreamResponse(response), {
    type: 'error',
    code: 'empty_stream',
    message: 'empty stream response',
  });
});

test('Ask AI never falls back to the non-stream JSON endpoint', () => {
  assert.equal(
    shouldUseAskJsonFallback({
      streamStarted: false,
      response: { type: 'error', code: 'http_error', message: 'stream endpoint unavailable' },
    }),
    false,
  );
  assert.equal(
    shouldUseAskJsonFallback({
      streamStarted: true,
      response: { type: 'error', code: 'empty_stream', message: 'empty stream response' },
    }),
    false,
  );
  assert.equal(
    shouldUseAskJsonFallback({
      streamStarted: false,
      error: new Error('Failed to fetch'),
    }),
    false,
  );
});
