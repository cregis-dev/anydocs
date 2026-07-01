import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { user } from './auth.ts';

// Baseline tenant root. Org -> Workspace -> Project -> Page tenancy is filled in
// by later C1 stories; this is the minimal first table so the first migration is real.
// RLS policies (organizations_tenant_isolation, ...) are added in C1.x — see src/db/rls.ts.
export const organizations = pgTable('organizations', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  ownerId: text('owner_id')
    .notNull()
    .references(() => user.id, { onDelete: 'restrict' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
