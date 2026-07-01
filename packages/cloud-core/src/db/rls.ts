import { sql } from 'drizzle-orm';
import { getDb, type Db } from './client.ts';

// Tenant-scoped DB access. RLS policies key off a Postgres GUC set per request.
// STORY C1.0 SCOPE: signature + GUC-set scaffold only. Full RLS policy enforcement
// (organizations_tenant_isolation, etc.) and the real role/connection wiring land in
// stories C1.1–C1.6. Do NOT bypass this helper with a service-role connection.
//
// app.tenant_id is the convention used by the (forthcoming) RLS policies.

export interface TenantContext {
  organizationId: string;
}

export async function withTenant<T>(
  ctx: TenantContext,
  fn: (tx: Db) => Promise<T>,
): Promise<T> {
  return getDb().transaction(async (tx) => {
    // Bind the tenant id for the duration of the transaction so RLS policies can read it.
    await tx.execute(sql`select set_config('app.tenant_id', ${ctx.organizationId}, true)`);
    return fn(tx as unknown as Db);
  });
}
