import assert from 'node:assert/strict';
import test from 'node:test';

import type { ApiSourceDoc } from '../src/types/api-source.ts';
import type { OpenApiDocArtifact } from '../src/types/openapi-doc.ts';
import {
  buildTryItManifestSource,
  handleTryItProxyRequest,
  resolveProjectCredentials,
  resolveTryItInvocation,
  type TryItManifest,
} from '../src/services/try-it-proxy.ts';

function makeDoc(): OpenApiDocArtifact {
  return {
    version: 1,
    sourceId: 'payment-engine-api',
    lang: 'zh',
    href: '/zh/reference/payment-engine-api',
    info: { title: 'Cregis Payment Engine API' },
    servers: [{ url: '{baseUrl}' }],
    nav: [],
    operations: [
      { id: 'createOrder', kind: 'endpoint', method: 'POST', path: '/api/v2/checkout', summary: '创建订单', tag: 'Orders', parameters: [], responses: [], href: '/x' },
      { id: 'orderCallback', kind: 'webhook', method: 'POST', path: 'orderCallback', summary: '回调', tag: 'Webhooks', parameters: [], responses: [], href: '/y' },
    ],
    schemas: {},
  };
}

function makeSource(tryIt: ApiSourceDoc['runtime'] extends infer R ? NonNullable<R>['tryIt'] : never): ApiSourceDoc {
  return {
    id: 'payment-engine-api',
    type: 'openapi',
    lang: 'zh',
    status: 'published',
    source: { kind: 'file', path: 'spec.json' },
    display: { title: 'Cregis Payment Engine API' },
    runtime: { tryIt },
  };
}

test('buildTryItManifestSource returns null when disabled', () => {
  assert.equal(buildTryItManifestSource(makeSource({ enabled: false }), makeDoc()), null);
  assert.equal(buildTryItManifestSource(makeSource(undefined), makeDoc()), null);
});

test('buildTryItManifestSource includes only endpoint operations (not webhooks)', () => {
  const result = buildTryItManifestSource(
    makeSource({ enabled: true, auth: { type: 'signed', adapter: 'cregis-sign' }, credentialRef: 'CREGIS', baseUrlRef: 'CREGIS_BASEURL' }),
    makeDoc(),
  );
  assert.ok(result);
  assert.equal(result?.auth.type, 'signed');
  assert.equal(result?.credentialRef, 'CREGIS');
  assert.deepEqual(Object.keys(result?.operations ?? {}), ['createOrder']); // webhook 排除
  assert.deepEqual(result?.operations.createOrder, { method: 'POST', path: '/api/v2/checkout' });
});

test('resolveTryItInvocation uses manifest method/path, not client-supplied', () => {
  const manifest: TryItManifest = {
    version: 1,
    sources: [
      {
        sourceId: 'payment-engine-api',
        lang: 'zh',
        auth: { type: 'signed', adapter: 'cregis-sign' },
        allowedHosts: [],
        operations: { createOrder: { method: 'POST', path: '/api/v2/checkout' } },
      },
    ],
  };
  const resolution = resolveTryItInvocation(
    manifest,
    { sourceId: 'payment-engine-api', operationId: 'createOrder', body: { order_amount: '5.00' } },
    { baseUrl: 'https://real.cregis.com' },
  );
  assert.equal(resolution.ok, true);
  if (resolution.ok) {
    assert.equal(resolution.request.method, 'POST');
    assert.equal(resolution.request.path, '/api/v2/checkout');
    assert.deepEqual(resolution.config.methods, ['POST']);
    assert.ok(resolution.config.allowedHosts.includes('real.cregis.com'));
  }
});

test('resolveTryItInvocation rejects unknown source / operation / bad baseUrl', () => {
  const manifest: TryItManifest = {
    version: 1,
    sources: [{ sourceId: 's', lang: 'zh', auth: { type: 'none' }, allowedHosts: [], operations: { op: { method: 'GET', path: '/x' } } }],
  };
  assert.equal(resolveTryItInvocation(manifest, { sourceId: 'nope', operationId: 'op' }, { baseUrl: 'https://a.com' }).ok, false);
  assert.equal(resolveTryItInvocation(manifest, { sourceId: 's', operationId: 'nope' }, { baseUrl: 'https://a.com' }).ok, false);
  assert.equal(resolveTryItInvocation(manifest, { sourceId: 's', operationId: 'op' }, { baseUrl: 'not a url' }).ok, false);
});

test('resolveProjectCredentials maps env by credentialRef convention', () => {
  const env = { TRYIT_CREGIS_PAYMENT_SECRET: 's3cr3t', TRYIT_CREGIS_PAYMENT_KEY: 'k', OTHER: 'x' };
  assert.deepEqual(resolveProjectCredentials('CREGIS_PAYMENT', env), { secret: 's3cr3t', key: 'k' });
  assert.deepEqual(resolveProjectCredentials(undefined, env), {});
});

test('handleTryItProxyRequest errors on unknown source and unresolved baseUrl', async () => {
  const manifest: TryItManifest = {
    version: 1,
    sources: [
      { sourceId: 's', lang: 'zh', auth: { type: 'none' }, baseUrlRef: 'S_BASEURL', allowedHosts: [], operations: { op: { method: 'GET', path: '/x' } } },
    ],
  };
  const unknown = await handleTryItProxyRequest(manifest, { sourceId: 'nope', operationId: 'op' }, { env: {} });
  assert.equal(unknown.ok, false);
  if (!unknown.ok) assert.equal(unknown.error.code, 'source_not_found');

  const noBase = await handleTryItProxyRequest(manifest, { sourceId: 's', operationId: 'op' }, { env: {} });
  assert.equal(noBase.ok, false);
  if (!noBase.ok) assert.equal(noBase.error.code, 'baseurl_unresolved');
});
