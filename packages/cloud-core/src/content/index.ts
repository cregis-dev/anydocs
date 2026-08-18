// =============================================================================
// Shared content contracts, re-exported from @anydocs/core/portable
// -----------------------------------------------------------------------------
// The cloud edition does NOT define its own content model. `doc-content-v1`, the
// audit entry contract, and the runtime capability matrix have exactly one
// definition, in @anydocs/core, and both product lines consume it.
//
// Why the `/portable` subpath and not `@anydocs/core`: the root entry re-exports
// `fs/` and `services/`, which reach `node:fs` and would break in a serverless /
// edge runtime. `/portable` is the fs-free subset, guarded by
// packages/core/tests/portable-entry.test.ts.
//
// Do NOT re-declare these types in cloud-core. If a cloud story needs a domain
// rule that lives behind a filesystem repository in core (audit persistence,
// publishing), extract a port in core and supply a Postgres implementation here
// — do not copy the logic. See product-line-strategy-team-first-2026-08-18.md.
// =============================================================================

export {
  // doc-content-v1 — canonical storage contract (shared with the local-first edition)
  assertValidDocContentV1,
  validateDocContentV1,
  normalizeDocContent,
  // Audit entry contract (Epic 10) — the schema is shared; persistence is cloud-specific
  assertValidAuditEntry,
  validateAuditEntry,
  AUDIT_SCHEMA_VERSION,
  AUDIT_ENTRY_JSON_SCHEMA_V1,
  // Runtime mode + capability matrix (Epic 8) — C1.5 project `mode` field
  CAPABILITY_MATRIX,
  isRuntimeMode,
} from '@anydocs/core/portable';

export type { DocContentV1, AuditEntry, RuntimeMode } from '@anydocs/core/portable';
