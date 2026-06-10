import assert from 'node:assert/strict';
import test from 'node:test';

import {
  applyBuiltinAuth,
  assembleUrl,
  deriveAllowedHosts,
  invokeTryIt,
  isHostAllowed,
  isPrivateHost,
} from '../src/services/try-it-engine.ts';

test('isPrivateHost flags loopback / private / link-local', () => {
  for (const host of ['localhost', '127.0.0.1', '10.1.2.3', '192.168.0.1', '172.16.0.1', '169.254.0.1', '::1', '0.0.0.0']) {
    assert.equal(isPrivateHost(host), true, host);
  }
  for (const host of ['api.example.com', '8.8.8.8', '172.15.0.1', '172.32.0.1']) {
    assert.equal(isPrivateHost(host), false, host);
  }
});

test('isHostAllowed requires whitelist and rejects private hosts', () => {
  assert.equal(isHostAllowed('api.example.com', ['api.example.com']), true);
  assert.equal(isHostAllowed('API.example.com', ['api.example.com']), true);
  assert.equal(isHostAllowed('evil.com', ['api.example.com']), false);
  // 即便白名单里有内网，也拒绝
  assert.equal(isHostAllowed('127.0.0.1', ['127.0.0.1']), false);
});

test('assembleUrl substitutes path params and appends query', () => {
  assert.equal(assembleUrl('https://api.example.com/', '/orders/{id}', { id: '42' }, { expand: 'true' }), 'https://api.example.com/orders/42?expand=true');
  assert.equal(assembleUrl('https://api.example.com', 'pets', {}, {}), 'https://api.example.com/pets');
  // 空 query 值被忽略
  assert.equal(assembleUrl('https://api.example.com', '/x', {}, { a: '', b: '1' }), 'https://api.example.com/x?b=1');
});

test('applyBuiltinAuth injects api key / bearer / basic from user credentials', () => {
  assert.deepEqual(applyBuiltinAuth({ type: 'apiKey', in: 'header', name: 'X-Api-Key' }, { apiKey: 'k1' }), { headers: { 'X-Api-Key': 'k1' } });
  assert.deepEqual(applyBuiltinAuth({ type: 'apiKey', in: 'query', name: 'key' }, { apiKey: 'k1' }), { query: { key: 'k1' } });
  assert.deepEqual(applyBuiltinAuth({ type: 'bearer' }, { token: 't1' }), { headers: { Authorization: 'Bearer t1' } });
  assert.deepEqual(applyBuiltinAuth({ type: 'none' }, {}), {});
  // 缺凭证则不注入
  assert.deepEqual(applyBuiltinAuth({ type: 'bearer' }, {}), {});
  const basic = applyBuiltinAuth({ type: 'basic' }, { username: 'u', password: 'p' });
  assert.equal(basic.headers?.Authorization, `Basic ${Buffer.from('u:p').toString('base64')}`);
});

test('deriveAllowedHosts extracts hostnames and skips templated urls', () => {
  assert.deepEqual(
    deriveAllowedHosts(['https://api.example.com/v2', '{baseUrl}'], ['real.cregis.com']).sort(),
    ['api.example.com', 'real.cregis.com'],
  );
});

test('invokeTryIt blocks disallowed host before any network call (SSRF)', async () => {
  const result = await invokeTryIt(
    { sourceId: 's', method: 'POST', path: '/x', body: { a: 1 } },
    { baseUrl: 'https://evil.internal', auth: { type: 'none' }, allowedHosts: ['api.example.com'] },
  );
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ssrf_blocked');
  }
});

test('invokeTryIt enforces method whitelist', async () => {
  const result = await invokeTryIt(
    { sourceId: 's', method: 'DELETE', path: '/x' },
    { baseUrl: 'https://api.example.com', auth: { type: 'none' }, allowedHosts: ['api.example.com'], methods: ['POST'] },
  );
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'method_not_allowed');
  }
});

test('invokeTryIt errors when a signed adapter is missing', async () => {
  const result = await invokeTryIt(
    { sourceId: 's', method: 'POST', path: '/x' },
    { baseUrl: 'https://api.example.com', auth: { type: 'signed', adapter: 'cregis-sign' }, allowedHosts: ['api.example.com'] },
  );
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'adapter_missing');
  }
});

test('invokeTryIt rejects private/internal target even if host whitelisted', async () => {
  const result = await invokeTryIt(
    { sourceId: 's', method: 'GET', path: '/x' },
    { baseUrl: 'http://127.0.0.1:8080', auth: { type: 'none' }, allowedHosts: ['127.0.0.1'] },
  );
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'ssrf_blocked');
  }
});
