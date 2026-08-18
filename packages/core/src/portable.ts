// =============================================================================
// @anydocs/core/portable — the runtime-agnostic subset of the domain
// -----------------------------------------------------------------------------
// The root entry (`@anydocs/core`) re-exports `fs/` and `services/`, which reach
// `node:fs` and therefore cannot be imported from a serverless / edge runtime.
// This entry re-exports ONLY modules whose transitive import graph is free of
// `node:fs`, so the Cloud Team Edition (`@anydocs/cloud-core`, `@anydocs/cloud-web`)
// can consume the shared domain — schemas, validators, types, search, runtime mode
// — without dragging the filesystem layer into a cloud bundle.
//
// This is the reuse seam described in
// artifacts/bmad/planning-artifacts/product-line-strategy-team-first-2026-08-18.md
// (Team First, action 2). Both product lines share ONE definition of
// `doc-content-v1`, the audit entry contract, and the runtime capability matrix.
//
// ADDING TO THIS FILE: `tests/portable-entry.test.ts` walks the import graph and
// FAILS if anything reachable from here imports `node:fs`. If that test starts
// failing, do not weaken it — either keep the new dependency out, or invert it
// behind a port the caller supplies (see audit-log-service → fs/audit-repository
// for the coupling this seam exists to avoid).
// =============================================================================

export * from './config/index.ts';
export * from './errors/index.ts';
export * from './runtime/index.ts';
export * from './schemas/index.ts';
export * from './search/index.ts';
export * from './types/index.ts';
export * from './utils/index.ts';
