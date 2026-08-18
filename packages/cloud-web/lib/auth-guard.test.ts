import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SIGN_IN_PATH,
  isProtectedPath,
  resolveAuthRedirect,
} from './auth-guard.ts';

test('isProtectedPath matches protected prefixes and their sub-paths', () => {
  assert.equal(isProtectedPath('/home'), true);
  assert.equal(isProtectedPath('/home/project-a'), true);
  assert.equal(isProtectedPath('/sign-in'), false);
  assert.equal(isProtectedPath('/'), false);
  // Guard against prefix bleed: /homework is NOT under /home.
  assert.equal(isProtectedPath('/homework'), false);
});

test('resolveAuthRedirect: no session on a protected route redirects to sign-in', () => {
  assert.equal(resolveAuthRedirect('/home', false), SIGN_IN_PATH);
  assert.equal(resolveAuthRedirect('/home/project-a', false), SIGN_IN_PATH);
});

test('resolveAuthRedirect: valid session on a protected route passes through', () => {
  assert.equal(resolveAuthRedirect('/home', true), null);
});

test('resolveAuthRedirect: public routes always pass, session or not', () => {
  assert.equal(resolveAuthRedirect('/sign-in', false), null);
  assert.equal(resolveAuthRedirect('/', false), null);
});
