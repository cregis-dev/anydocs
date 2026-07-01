import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index.ts';

// Lazy Postgres connection + Drizzle client. Importing @anydocs/cloud-core must NOT open a
// socket — the connection is created on first getDb()/getSql() call. DATABASE_URL is
// provider-agnostic (local Docker / Neon / managed) — see .env.example.

let _sql: ReturnType<typeof postgres> | undefined;
let _db: ReturnType<typeof drizzle<typeof schema>> | undefined;

function connectionString(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not set — see packages/cloud-core/.env.example');
  }
  return url;
}

export function getSql(): ReturnType<typeof postgres> {
  if (!_sql) _sql = postgres(connectionString());
  return _sql;
}

export function getDb() {
  if (!_db) _db = drizzle(getSql(), { schema });
  return _db;
}

export type Db = ReturnType<typeof getDb>;
export { schema };
