# Product Line Strategy — Team First

_Decision date: 2026-08-18 · Decided by: Shawn · Status: **adopted**_

## Decision

The **Cloud Team Edition** becomes the primary product line and receives all new feature
investment. The **local-first edition** is repositioned as a free, single-user, self-installed
offline product: **maintained, not extended**.

Concretely:

- Local-first **Epic 11** (Agent subsystem, 9 stories) and **Epic 12** (Scope escalation, 4
  stories) are **frozen**. The same capabilities ship in the cloud as C3.1/C3.3–C3.7, C4.\*,
  C5.\* and C10.1/C10.2.
- Local-first **Epics 1–8 + 10 are done**; **Epic 9** (desktop native fs) and **Epic 13**
  (Studio desktop shell) finish as planned — they complete the self-installed product and have
  no cloud equivalent worth deferring.
- No new epics are opened against the local-first edition, and **no new features are added to it**
  at all — only maintenance (bug fixes, dependency and security updates). All feature demand is
  routed to the Cloud Team Edition. Confirmed by Shawn, 2026-08-18.

## Why

### 1. The product's value only appears at team scale

Documentation work at the company is team-level by nature, and Anydocs is an internal
efficiency tool. A single author writing docs alone has no coordination pain, so the tool's
value never materialises — which is precisely why the delivered local-first edition has seen
limited impact despite being functionally complete.

14 of the 61 cloud stories deliver capabilities the local-first edition **structurally cannot**
provide: real-time collaboration (C6, 6 stories), review/approval/publish gates (C7, 4), and
team governance (C10, 4). That is where the unaddressed pain lives.

### 2. Freezing Epics 11–12 removes the one large duplicate investment left

| Local-first (frozen) | Cloud equivalent | Stories |
|---|---|---|
| Epic 11 — Agent subsystem (Inline/Page/Workspace) | C3.1, C3.3–C3.7, C4.\*, C5.\* | 9 → ~20 |
| Epic 12 — Scope escalation confirmation | C10.1, C10.2 | 4 → 2 |

Building the agent subsystem twice — once against the filesystem, once against Postgres — is
the single largest avoidable duplication remaining in the roadmap. Freezing costs nothing today
because neither epic has started.

> **Correction to an earlier estimate.** A first pass suggested ~74% of remaining local-first
> work would be duplicated. That figure was computed from a stale worktree copy of
> `sprint-status.yaml` (18 commits behind `origin/main`). The true local-first state is
> **67 done / 16 backlog**, and the duplication is confined to Epics 11–12. The direction is
> unchanged; the magnitude is smaller and the sunk cost is already paid.

### 3. Most of the local-first investment is portable, not stranded

`@anydocs/core` domain logic is largely filesystem-free and can back the cloud edition directly:

| Asset | Lines | fs-bound? | Cloud consumer |
|---|---|---|---|
| `schemas/audit-entry-schema.ts` | 321 | no | C3.2, C10.3, C10.4 |
| `services/audit-log-service.ts` (write-ahead lifecycle) | 261 | no | C3.2 |
| `runtime/runtime-mode.ts` + `capability-matrix.ts` | 277 | no | C1.5 |
| `schemas/` | 1663 | no | C2.\*, C7.\* |
| `utils/` | 1995 | no | across |
| `types/` | 805 | no | across |
| `publishing/` | 2016 | 2 of 5 files | C7.4 |
| `search/` | 336 | no | C2.\* |
| `fs/audit-repository.ts` | 202 | **yes** | replace with a Postgres adapter |

Epic 10's audit subsystem is **already built and tested**, and its domain layer is fs-free. The
only fs-bound piece is the storage adapter — exactly the right seam. Cloud story C3.2
("write-ahead audit foundation") should therefore be re-scoped from *build* to *adapt*.

`doc-content-v1`, `@anydocs/editor` and `tokens.css` are already shared contracts.

### 4. The local-first edition is already a shippable product

Epics 1–8 + 10 done means it can install, edit, build, publish and audit today. Freezing it
is a repositioning, not a feature cut. Its role changes from *the product* to **acquisition
entry point + offline fallback**.

## Costs accepted

1. **Cloud is 844 lines against ~25k lines of local-first Studio.** Epic C2 (navigation tree,
   editor mount, autosave — 9 stories) is a genuine rewrite of Studio interaction on the cloud
   stack. The pivot does not make that cheaper.
2. **The reuse seam does not exist yet.** `cloud-core` currently depends only on
   `@anydocs/editor`; it has **no dependency on `@anydocs/core`**. The architecture document
   commits to reusing validators/publishing/MCP definitions, but nothing is wired. Until that
   is fixed, every cloud story silently re-implements core.
3. **Local-first users get no new features.** Acceptable given the product is internal and the
   cloud edition supersedes it, but it must be communicated rather than left implicit.

## Required actions before accelerating cloud work

| # | Action | Why it blocks | Size |
|---|---|---|---|
| 1 | Freeze Epics 11–12 in `sprint-status.yaml` | Stops duplicate investment | ✅ done 2026-08-18 |
| 2 | Wire `cloud-core → @anydocs/core` reuse seam | Without it, C2–C7 rewrite 22k lines of core | 1–2 stories |
| 3 | Run the Y.Doc ↔ `doc-content-v1` bridge spike | Determines C2 autosave **and** C6 realtime architecture; the sprint file already flags it as "spike EARLY, before C3+C6" | 1 spike |
| 4 | Re-scope C3.2 from *build* to *adapt* Epic 10's audit domain | Avoids rebuilding 582 fs-free lines | edit epic |
| 5 | Sync `feat/cloud-team-edition` with `origin/main` | Branch predated Epics 8–10/13 landing, so it consumed a June snapshot of core | ✅ done 2026-08-18 (merge `4a268e8`) |

## Non-goals

- Not deleting, unpublishing, or breaking the local-first edition.
- Not migrating existing local-first projects into the cloud (a separate decision).
- Not changing `doc-content-v1`; it stays the canonical storage contract for both lines.

## Revisit triggers

Re-open this decision if any of the following becomes true:

- Cloud Epic C2 materially overruns, indicating the rewrite cost was underestimated.
- A concrete external/offline-only distribution need appears for the local-first edition.
- The Y.Doc bridge spike (action 3) finds the bridge unworkable, which would invalidate the
  C2/C6 architecture the pivot depends on.

## References

- `artifacts/bmad/planning-artifacts/epics-cloud-team-edition.md` — 11 epics / 61 stories
- `artifacts/bmad/planning-artifacts/architecture-cloud-team-edition.md` — reuse boundary
- `artifacts/bmad/planning-artifacts/epics.md` — local-first Epics 1–13
- `artifacts/bmad/implementation-artifacts/sprint-status.yaml` — Epics 11–12 marked `frozen`
- `artifacts/bmad/implementation-artifacts/sprint-status-cloud-team-edition.yaml` — strategy header + reuse map
