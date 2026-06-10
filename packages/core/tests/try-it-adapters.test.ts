import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';

import { cregisCanonicalString, cregisSign, cregisSignAdapter } from '../src/services/try-it-adapters.ts';

test('cregisCanonicalString excludes sign/empty/null, sorts by key, concatenates key+value', () => {
  const body = {
    sign: 'should-be-excluded',
    nonce: 'abc',
    pid: 123,
    empty: '',
    missing: null,
    undef: undefined,
    order_amount: '5.00',
  };
  // 排序后 keys：nonce < order_amount < pid（字典序）
  assert.equal(cregisCanonicalString(body), 'nonceabcorder_amount5.00pid123');
});

test('cregisSign prepends apiKey and md5-lowercases the canonical string', () => {
  const body = { nonce: 'abc', pid: 123, order_amount: '5.00' };
  const apiKey = 'a'.repeat(32);
  const expected = createHash('md5').update(`${apiKey}nonceabcorder_amount5.00pid123`).digest('hex');
  const actual = cregisSign(body, apiKey);
  assert.equal(actual, expected);
  assert.match(actual, /^[0-9a-f]{32}$/); // 32 位小写 hex
});

test('cregisSignAdapter injects sign into body using apikey credential', async () => {
  const result = await cregisSignAdapter.apply(
    { sourceId: 's', method: 'POST', url: 'https://api/x', headers: {}, body: { nonce: 'x', pid: 1 } },
    { apikey: 'KEY' },
  );
  const body = result.body as Record<string, unknown>;
  assert.equal(body.nonce, 'x');
  assert.equal(body.sign, createHash('md5').update('KEYnoncexpid1').digest('hex'));
});

test('cregis signing is order-independent (sorted)', () => {
  const a = cregisSign({ b: '2', a: '1' }, 'K');
  const b = cregisSign({ a: '1', b: '2' }, 'K');
  assert.equal(a, b);
});
