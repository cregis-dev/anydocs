import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { getDb } from '../db/client.ts';

// Better Auth, schema-owned in cloud-core's own Postgres via the Drizzle adapter.
// Lazily constructed so importing @anydocs/cloud-core does not open a DB connection.
// Email/password baseline here; OAuth providers + org/tenant wiring land in Story C1.1+.

// Factory isolates Better Auth's generic inference (annotating the cache directly caused
// a circular type). getAuth() memoises the first instance.
function createAuth() {
  return betterAuth({
    database: drizzleAdapter(getDb(), { provider: 'pg' }),
    emailAndPassword: { enabled: true },
    secret: process.env.BETTER_AUTH_SECRET,
    baseURL: process.env.BETTER_AUTH_URL ?? 'http://localhost:3000',
  });
}

let _auth: ReturnType<typeof createAuth> | undefined;

export function getAuth(): ReturnType<typeof createAuth> {
  _auth ??= createAuth();
  return _auth;
}

export type Auth = ReturnType<typeof createAuth>;
