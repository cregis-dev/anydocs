import { defineConfig } from 'drizzle-kit';

// Drizzle Kit config for cloud-core. Generates/applies migrations under src/db/migrations.
// Requires DATABASE_URL in the environment (see .env.example).
export default defineConfig({
  schema: './src/db/schema/index.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://anydocs:anydocs@localhost:5432/anydocs_cloud',
  },
});
