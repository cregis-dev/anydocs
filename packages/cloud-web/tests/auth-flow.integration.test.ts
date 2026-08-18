import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Postgres-backed integration test for the sign-up → sign-in → sign-out flow (AC1–AC3).
// Requires a throwaway Postgres: set CLOUD_TEST_DATABASE_URL (e.g. a `docker run postgres`
// instance). Skipped when unset so it never blocks the local-first gate or a DB-less CI.
//
//   docker run --rm -e POSTGRES_PASSWORD=pw -e POSTGRES_DB=anydocs_cloud_test -p 5433:5432 -d postgres:16
//   CLOUD_TEST_DATABASE_URL=postgres://postgres:pw@localhost:5433/anydocs_cloud_test \
//     pnpm --filter @anydocs/cloud-web test

const TEST_DB_URL = process.env.CLOUD_TEST_DATABASE_URL;

// Point cloud-core's lazy connection + Better Auth at the test DB before any getter runs.
if (TEST_DB_URL) {
  process.env.DATABASE_URL = TEST_DB_URL;
  process.env.BETTER_AUTH_SECRET ??= 'integration-test-secret-integration-test-secret';
  process.env.BETTER_AUTH_URL ??= 'http://localhost:3000';
}

const MIGRATION_URL = new URL(
  '../../cloud-core/src/db/migrations/0000_colossal_mentor.sql',
  import.meta.url,
);

function cookieHeader(res: Response): Headers {
  const headers = new Headers();
  const setCookies = res.headers.getSetCookie?.() ?? [];
  const cookie = setCookies.map((c) => c.split(';')[0]).join('; ');
  if (cookie) headers.set('cookie', cookie);
  return headers;
}

test(
  'sign-up establishes a session, sign-in reuses the stable user id, sign-out invalidates it',
  { skip: TEST_DB_URL ? false : 'set CLOUD_TEST_DATABASE_URL to run the Postgres integration test' },
  async () => {
    const { getSql } = await import('@anydocs/cloud-core/db');
    const { getAuth } = await import('@anydocs/cloud-core/auth');
    const sql = getSql();

    // Reset only this story's own tables (never the whole schema) so pointing at a shared DB
    // can't wipe unrelated data, then apply the c1-0 migration.
    await sql.unsafe(
      'drop table if exists "organizations", "account", "session", "verification", "user" cascade;',
    );
    const migration = readFileSync(fileURLToPath(MIGRATION_URL), 'utf8');
    for (const statement of migration.split('--> statement-breakpoint')) {
      const trimmed = statement.trim();
      if (trimmed) await sql.unsafe(trimmed);
    }

    const auth = getAuth();
    const email = `c1-1-${Date.now()}@example.com`;
    const password = 'a-strong-test-password';

    try {
      // AC1: sign-up establishes a session with a stable user id.
      const signUpRes = await auth.api.signUpEmail({
        body: { email, password, name: 'C1.1 Tester' },
        asResponse: true,
      });
      assert.equal(signUpRes.status, 200, 'sign-up should succeed');

      const signUpSession = await auth.api.getSession({ headers: cookieHeader(signUpRes) });
      assert.ok(signUpSession?.user.id, 'sign-up should establish a session');
      const userId = signUpSession.user.id;

      const afterSignUp = await sql<{ n: number }[]>`
        select count(*)::int as n from "session" where user_id = ${userId}`;
      assert.ok(afterSignUp[0].n >= 1, 'a session row should exist after sign-up');

      // AC1: sign-in returns the SAME stable user id and establishes a session.
      const signInRes = await auth.api.signInEmail({
        body: { email, password },
        asResponse: true,
      });
      assert.equal(signInRes.status, 200, 'sign-in should succeed');
      const signedInHeaders = cookieHeader(signInRes);
      const signInSession = await auth.api.getSession({ headers: signedInHeaders });
      assert.equal(signInSession?.user.id, userId, 'user id is stable across sign-in');

      // AC2: an anonymous request (no session) resolves to no session — no data returned.
      const anon = await auth.api.getSession({ headers: new Headers() });
      assert.equal(anon, null, 'no session cookie → no session, no data leak');

      // AC3: sign-out invalidates the session server-side.
      await auth.api.signOut({ headers: signedInHeaders });
      const afterSignOut = await auth.api.getSession({ headers: signedInHeaders });
      assert.equal(afterSignOut, null, 'session is invalid after sign-out');

      // AC2: an EXPIRED-but-present session cookie is rejected server-side (no data leak on the
      // redirect path). Fresh sign-in, then force the row past its expiry and re-check.
      const freshRes = await auth.api.signInEmail({ body: { email, password }, asResponse: true });
      const freshHeaders = cookieHeader(freshRes);
      assert.ok(
        (await auth.api.getSession({ headers: freshHeaders }))?.user.id === userId,
        'fresh session is valid before expiry',
      );
      await sql`update "session" set expires_at = now() - interval '1 hour' where user_id = ${userId}`;
      const expired = await auth.api.getSession({ headers: freshHeaders });
      assert.equal(expired, null, 'expired-but-present session → no session (AC2)');
    } finally {
      await sql.end({ timeout: 5 });
    }
  },
);
