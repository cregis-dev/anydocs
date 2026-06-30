---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
lastStep: 8
status: 'complete'
completedAt: '2026-06-30'
inputDocuments:
  - artifacts/bmad/planning-artifacts/epics-cloud-team-edition.md
  - '/Users/shawn/Downloads/anydocs-studio-handoff/cloud-studio-ai-first-design-brief.md'
  - '/Users/shawn/Downloads/anydocs-studio-handoff/README.md'
  - artifacts/bmad/planning-artifacts/prd.md
  - artifacts/bmad/planning-artifacts/architecture.md
workflowType: 'architecture'
project_name: 'anydocs — Cloud Team Edition'
productLine: 'Cloud Team Edition (independent from local-first edition)'
user_name: 'Shawn'
date: '2026-06-29'
note: 'Distinct from the local-first architecture.md (status: complete). This document does NOT modify that file; it is a separate product-line architecture.'
---

# Architecture Decision Document — Anydocs Studio Cloud Team Edition

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

_Scope: the cloud, multi-tenant, real-time-collaborative, AI-First product line. Requirements basis: `epics-cloud-team-edition.md` (27 CFR + 9 CNFR, 11 epics C1–C11, 61 stories) and the design handoff `cloud-studio-ai-first-design-brief.md`. The local-first edition (`architecture.md`) is left unchanged; this document only references it for forward-compatible Phase 3 anchors (`mode` field, `transport-port.ts`, `ToolProfile`, audit `actorId`)._

## Project Context Analysis

### Requirements Overview

**Functional Requirements:** 27 CFR in 5 groups — App Shell & IA (CFR1–6),
three-scope Agent (CFR7–15), real-time collaboration (CFR16–18), project/workspace
management (CFR19–23), and team backend/service (CFR24–27, mapping Phase 3 FR61–64).
Architecturally these collapse into: a multi-tenant web shell, an AI agent
orchestration subsystem with write-ahead audit, a realtime collaboration layer, and
a remote MCP service.

**Non-Functional Requirements:** dark mode (CNFR1) + WCAG AA a11y (CNFR2) + i18n
(CNFR3) drive a token-driven design system; `tokens.css` is an immutable shared
contract (CNFR4). Performance states (CNFR5) require nav virtualization + offline
handling. Real-time consistency (CNFR6) mandates a CRDT/OT backend. Remote MCP auth
(CNFR7) requires 401/403/405 semantics. Agent latency budgets (CNFR8) and write-ahead
audit (CNFR9) constrain the agent path.

**Scale & Complexity:**
- Primary domain: full-stack cloud SaaS (web) with real-time + AI-First.
- Complexity level: high / enterprise.
- Major subsystems: multi-tenant identity & storage, realtime collaboration (CRDT/OT),
  AI agent orchestration + audit, remote MCP service, token-driven design system.

### Technical Constraints & Dependencies

- **Reuse boundary (central decision):** preserve `doc-content-v1` as canonical
  storage and reuse `@anydocs/editor`, validators, build/publish, and MCP tool
  definitions from the existing packages; introduce net-new cloud services for
  storage, auth, realtime, and tenancy. Do NOT modify the local-first edition.
- **Storage shift:** from filesystem `ContentRepository` to a server-side datastore;
  a cloud `ContentRepository` implementation backs the same domain contracts.
- **Realtime bridge:** `doc-content-v1` (canonical, at-rest) ↔ CRDT/OT document
  (runtime, in-flight) — mirroring the existing "Plate is runtime, doc-content-v1 is
  storage" separation.
- **LLM provider** stays behind `provider-port` (no vendor name in core).
- **Design contract:** `tokens.css` shared with the desktop edition; reference
  prototypes (17 HTML/React boards) are re-implemented in the target stack, not shipped.

### Cross-Cutting Concerns Identified

- Tenant isolation & data partitioning (every data access).
- Authentication & authorization (identity, roles, agent permission boundaries).
- Realtime sync layer (editor body, presence, cursors, comments).
- Agent orchestration + write-ahead audit + attribution (`actorId`).
- Token-driven theming / dark mode / accessibility (every surface).
- Latency budgets & observability for the agent and realtime paths.

## Starter Template Evaluation

### Primary Technology Domain

Full-stack cloud SaaS (web) with real-time collaboration + AI. **Brownfield decision:**
extend the existing pnpm monorepo rather than adopt a greenfield starter — the cloud
edition reuses `@anydocs/editor` (Plate), `tokens.css`, `doc-content-v1`, validators,
and MCP tool definitions. A greenfield starter would fork these assets.

### Starter Options Considered

- **Greenfield SaaS starter (e.g., Vercel Next.js SaaS, T3, makerkit):** rejected — would
  duplicate or fork the editor/design-contract assets the cloud edition must reuse.
- **All-in-one backend platform (Supabase / Convex):** considered for DB+Auth+Realtime in
  one; rejected in favor of self-hosted control — chosen stack keeps Yjs/Hocuspocus native
  to Plate and Postgres+RLS for tenant isolation without platform lock-in.
- **Brownfield monorepo extension (SELECTED):** add a new cloud app + net-new backend
  packages into the existing workspace, reusing shared domain packages.

### Selected Approach: Extend the pnpm monorepo with a cloud app + cloud backend

**Rationale for Selection:**
Maximum reuse of `@anydocs/editor`, `tokens.css`, and `doc-content-v1`; the editor already
supports Yjs collaboration natively (slate-yjs + Hocuspocus), so real-time is additive rather
than a rewrite. Tenant isolation, auth, and realtime are introduced as net-new packages
without touching the local-first edition.

**Initialization (first implementation story — Story C1.1 scaffolding):**

```bash
# New cloud app + backend packages inside the existing workspace
pnpm create next-app packages/cloud-web --ts --app --tailwind --eslint   # align Next version with workspace
pnpm --filter @anydocs/cloud-web add better-auth drizzle-orm postgres @anydocs/editor
pnpm --filter @anydocs/cloud-web add yjs @hocuspocus/provider @platejs/yjs
pnpm add -D drizzle-kit -w
# Realtime backend (separate persistent Node service — NOT serverless)
pnpm --filter @anydocs/cloud-realtime add @hocuspocus/server yjs
```

**Architectural Decisions Provided by the Stack:**

- **Language & Runtime:** TypeScript (strict), Node 20+; aligns with the existing workspace.
- **App Framework:** Next.js (App Router). Current stable is **16.2.9 LTS** (June 2026); the
  existing workspace is on Next 15 — the cloud app initially **aligns to the workspace Next
  version** to avoid a split React/Next across packages; a workspace-wide bump to 16 is a
  separate coordinated upgrade.
- **Styling / Design System:** Tailwind v4 + shadcn/ui (reused); `tokens.css` is the immutable
  design contract (CNFR4), shared with the desktop edition.
- **Authentication:** **Better Auth 1.6.22** — TS-first, owns its schema in the app's own
  Postgres, first-class Drizzle adapter, no per-MAU pricing. SSO/SCIM out of scope this round.
- **Database & Tenancy:** **Postgres + Drizzle ORM 0.45.2** with **Row-Level Security (RLS)** —
  declarative policies enforce tenant isolation at the database layer (CFR2). Postgres host is
  provider-agnostic (Neon / Supabase Postgres / self-managed).
- **Real-time Collaboration:** **Yjs** CRDT via the **Plate Yjs plugin**, synced by a
  self-hosted **Hocuspocus 4.3.0** WebSocket backend (`@hocuspocus/provider` 4.1.0 client).
  Runs as a separate persistent Node service — not serverless. `doc-content-v1` stays canonical
  at rest; the Y.Doc is the in-flight runtime representation.
- **LLM Provider:** abstracted behind `provider-port` (no vendor name in core).
- **Build Tooling / Testing:** inherit the workspace's tooling (pnpm, existing test runners, ESLint).
- **Hosting Topology:** Next.js cloud app (Vercel or Node host) + Hocuspocus realtime (separate
  persistent Node service) + Postgres (managed). Three deployable units.

**Note:** Project initialization (scaffold cloud app + backend packages + Postgres/Drizzle +
Better Auth + Hocuspocus baseline) should be the first implementation story (maps to Story C1.1).

## Core Architectural Decisions

### Decision Priority Analysis

**Critical (block implementation):** multi-tenant data model + RLS session binding;
content persistence model (doc-content-v1 jsonb ↔ Y.Doc binary); auth/session→tenant
binding; API layer style; audit substrate.

**Important (shape architecture):** presence/awareness via Hocuspocus; agent path +
audit storage; remote MCP transport + auth; hosting topology; realtime scale-out path.

**Deferred (post-MVP):** caching layer; full-text search substrate; notifications infra;
observability/APM vendor.

### Data Architecture

- **Store:** Postgres + Drizzle ORM 0.45.2 + Row-Level Security (decided in step 3).
- **Tenancy tables:** organizations, workspaces, projects, pages, page_content,
  memberships, roles, comments/comment_threads, agent_runs, audit_entries, ydoc_states.
  Every tenant-scoped table carries a tenant key with an RLS policy.
- **Content persistence (key decision):** `doc-content-v1` remains canonical, stored as
  `jsonb`; the realtime **Y.Doc** binary is persisted in `ydoc_states` by Hocuspocus.
  A **Y.Doc ↔ doc-content-v1 bridge** materializes canonical content on idle/save
  (debounced), reusing the existing doc-content-v1 ↔ Plate converters. This mirrors the
  local-first "Plate is runtime, doc-content-v1 is storage" separation.
- **Audit substrate (decision — diverges from local-first):** cloud stores audit entries
  in a Postgres `audit_entries` table (RLS + retention policy), NOT the local-first NDJSON
  daily shards — same versioned schema, different substrate suited to multi-tenant query.
- **Migrations:** drizzle-kit. **Caching:** none in MVP (deferred).

### Authentication & Security

- **Auth:** Better Auth 1.6.22 (decided); schema in the app's own Postgres via Drizzle adapter.
- **Session→tenant binding:** the session carries userId + active org/workspace, bound
  server-side; each request sets the Postgres session GUC (`set_config`) so RLS policies
  key off the tenant id — DB-enforced isolation, not app-enforced.
- **Authorization (dual-layer):** RLS for data isolation + an app-level role→agent-scope
  permission map (Epic C10) enforced at agent invocation.
- **Remote MCP (Epic C9):** bearer-token auth on the HTTP transport (401/403); read-only
  `ToolProfile` rejects write tools (405).
- **Secrets:** env-based; per-request DB role for RLS.

### API & Communication Patterns

- **Web app API (Next-native):** Server Actions for mutations + Route Handlers for REST-ish
  endpoints, MCP, and webhooks. Chosen over tRPC to minimize deps and align with App Router.
- **Realtime:** WebSocket via Hocuspocus (Yjs sync protocol + **awareness** for presence/cursors).
- **Remote MCP:** JSON-RPC over HTTP via the `transport-port` adapter.
- **Errors:** reuse core typed domain errors; map to HTTP/status at the route boundary.

### Frontend Architecture

- **Rendering:** Next.js App Router — RSC for shell/data, client components for editor + realtime.
- **Editor:** `@anydocs/editor` (Plate) + Plate Yjs plugin bound to the Hocuspocus provider.
- **Client state:** React context + Yjs awareness for collaboration; **Zustand** for local
  UI state (command palette, panel collapse, run inspector).
- **Design system:** `tokens.css` + Tailwind v4 + shadcn/ui; dark mode via `[data-theme]`.

### Infrastructure & Deployment

- **Three deployable units:** `cloud-web` (Vercel or Node host), `cloud-realtime` Hocuspocus
  (persistent Node service — Railway/Fly/Render), Postgres (Neon / managed).
- **Realtime scale-out:** a single Hocuspocus node suffices initially; scaling to >1 WS node
  requires a Y.Doc-aware pub/sub (Redis) — noted as the scale path, deferred.
- **CI/CD:** extend the existing pnpm workspace pipeline.
- **Observability:** structured logs in MVP; APM vendor deferred.

### Decision Impact Analysis

**Implementation sequence:** (1) scaffold + Postgres/Drizzle/RLS + Better Auth (C1) →
(2) tenancy model + project/page CRUD (C1/C2) → (3) editor mount + autosave (C2) →
(4) realtime Hocuspocus + Y.Doc bridge (C6) → (5) agent + audit (C3–C5) →
(6) remote MCP (C9) → (7) governance (C10).

**Cross-component dependencies:** RLS session binding underpins all data access; the
Y.Doc↔doc-content-v1 bridge underpins both autosave and realtime; `provider-port`
underpins all three agent scopes.

## Implementation Patterns & Consistency Rules

### Pattern Categories Defined

These rules align with the existing workspace conventions where they exist, and add
cloud-specific rules for DB/RLS, realtime, and audit. ~6 conflict areas codified.

### Naming Patterns

**Database (Postgres / Drizzle):**
- Tables: `snake_case`, plural — `organizations`, `workspaces`, `audit_entries`.
- Columns: `snake_case`; primary key `id` (text/uuid); foreign keys `<entity>_id`.
- Tenant keys: `organization_id` / `workspace_id` / `project_id` on every tenant-scoped row.
- Timestamps: `created_at` / `updated_at` (ISO at the app boundary).
- RLS policy: `<table>_tenant_isolation`; index: `<table>_<cols>_idx`.
- Drizzle schema lives in `db/schema/*.ts`, one file per table group; exported table objects camelCase.

**API:**
- Route Handlers at `app/api/<noun-plural>/route.ts`; dynamic params `[id]` (Next convention).
- Remote MCP mounted at `app/api/mcp/route.ts`.
- Server Actions in `actions/*.ts`, named `verbNoun` (`createPage`, `inviteMember`).

**Code (align with existing workspace):**
- Files: `kebab-case` (`task-card.tsx`, `tenant-repository.ts`) — matches the existing repo.
- React components / types / interfaces: `PascalCase` exports.
- Functions / variables: `camelCase`. Constants: `UPPER_SNAKE`.

### Structure Patterns

- **New packages:** `packages/cloud-core` (server domain: db schema, repositories, auth,
  tenancy, agent, audit — reused by web + realtime + remote MCP), `packages/cloud-web`
  (Next app adapter), `packages/cloud-realtime` (Hocuspocus adapter). Mirrors the existing
  "`@anydocs/core` is domain, apps are adapters" philosophy.
- **Domain logic** lives in `cloud-core` services and returns typed results / throws typed
  domain errors; `cloud-web` and `cloud-realtime` are thin adapters.
- **Tests:** co-located `*.test.ts` (matches the existing workspace test convention).

### Format Patterns

- **App/API layer JSON:** `camelCase` field names (matches `doc-content-v1` + TS); `snake_case`
  only at the DB layer (Drizzle maps between them).
- **Route Handler errors:** `{ error: { code, message } }` with the correct HTTP status; Server
  Actions return domain objects directly or throw typed errors.
- **Dates:** ISO 8601 strings everywhere at the boundary (consistent with `doc-content-v1.updatedAt`).
- **Content contract:** `doc-content-v1` is unchanged and remains the page-content format.

### Communication Patterns

- **Realtime room id:** `workspace:<wsId>:project:<projId>:page:<pageId>`.
- **Yjs awareness payload:** `{ user: { id, name, color }, agent?: { persona }, cursor, selection }`.
- **Agent run state enum:** matches the Task Card state machine
  (`planning | awaiting_confirmation | running | awaiting_review | applied | rolled_back | failed`).
- **Audit / domain event names:** `dot.case` lowercase — `agent.run.planned`, `agent.run.applied`,
  `page.published`, `member.invited`.
- **State:** immutable updates; **Yjs is the source of truth for document content** — never
  mirror doc content into React state; Zustand holds only local UI state.

### Process Patterns

- **Tenant binding (mandatory):** every server entrypoint resolves the Better Auth session →
  active tenant and sets the Postgres RLS GUC *before* any query. No query runs without it.
- **Error handling:** typed domain errors in `cloud-core`, mapped to HTTP/UI at the boundary;
  user-facing errors are self-explaining with recovery hooks (design brief §9.5) — no raw stacks.
- **Loading:** RSC streaming + Suspense for data; optimistic UI for inline diffs; agent progress
  via the Task Card machine.
- **Validation:** reuse `doc-content-v1` validators; validate at API/action boundaries.

### Enforcement Guidelines

**All AI Agents MUST:**
- Resolve session → tenant and set the RLS GUC before any DB access; never bypass RLS.
- Keep `doc-content-v1` canonical; never persist Plate/Y.Doc as the source of truth.
- Put shared domain in `cloud-core`; never fork `@anydocs/editor` / `@anydocs/core`.
- Keep no vendor/provider name in `cloud-core` (use `provider-port`).
- Read all design values from `tokens.css`; never hard-code colors/spacing.

### Pattern Examples

**Good:** `await withTenant(session, (db) => db.query.pages...)` — RLS GUC set in `withTenant`.
**Anti-pattern:** querying with a service-role connection that ignores RLS "for convenience".
**Good:** materialize `doc-content-v1` from the Y.Doc on idle via the bridge.
**Anti-pattern:** writing the Plate value straight to `pages.content` as the canonical store.

## Project Structure & Boundaries

### Complete Project Directory Structure

Three new packages added to the existing pnpm workspace (existing packages untouched):

```
anydocs/
├── packages/
│   ├── core/                       # existing (@anydocs/core) — reused, untouched
│   ├── editor/                     # existing (@anydocs/editor) — reused (Plate + Yjs plugin)
│   ├── web/                        # existing local-first Studio — untouched
│   │
│   ├── cloud-core/                 # NEW @anydocs/cloud-core — server domain (reused by web + realtime + mcp)
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── db/
│   │       │   ├── client.ts               # Drizzle client
│   │       │   ├── rls.ts                   # withTenant(): sets Postgres GUC before queries
│   │       │   ├── schema/
│   │       │   │   ├── auth.ts              # Better Auth tables
│   │       │   │   ├── organizations.ts     · workspaces.ts · projects.ts · pages.ts
│   │       │   │   ├── memberships.ts · roles.ts
│   │       │   │   ├── comments.ts · comment-threads.ts
│   │       │   │   ├── agent-runs.ts · audit-entries.ts · ydoc-states.ts
│   │       │   └── migrations/              # drizzle-kit output
│   │       ├── auth/                        # better-auth.ts config, session.ts        (C1)
│   │       ├── tenancy/                     # tenant-context.ts, resolve-tenant.ts      (C1)
│   │       ├── repositories/                # project/page/membership/comment/audit-repository.ts (C2/C6/C10)
│   │       ├── content/                     # ydoc-bridge.ts (Y.Doc ↔ doc-content-v1)   (C2/C6)
│   │       ├── agent/                       # provider-port.ts, agent-service.ts,
│   │       │                                #   inline/page/workspace-orchestrator.ts,
│   │       │                                #   scope-validator.ts                      (C3/C4/C5)
│   │       ├── audit/                       # audit-service.ts, write-ahead.ts, retention.ts (C3/C10)
│   │       ├── permissions/                 # roles.ts, permission-map.ts               (C10)
│   │       ├── mcp/                         # transport-port.ts, http-transport.ts, tool-profiles.ts (C9)
│   │       ├── errors/                      # typed domain errors
│   │       └── index.ts
│   │
│   ├── cloud-web/                   # NEW @anydocs/cloud-web — Next.js App Router adapter
│   │   ├── package.json · next.config.ts · tsconfig.json · .env.example
│   │   ├── middleware.ts                    # auth + active-tenant resolution
│   │   ├── app/
│   │   │   ├── globals.css                  # imports tokens.css
│   │   │   ├── (auth)/sign-in/page.tsx       (C1)
│   │   │   ├── (app)/
│   │   │   │   ├── layout.tsx               # four-region shell                         (C1)
│   │   │   │   ├── home/page.tsx            # Workspace Home                            (C8)
│   │   │   │   └── [workspace]/[project]/[lang]/[...page]/page.tsx  # editor route      (C2)
│   │   │   ├── actions/                     # createPage.ts, inviteMember.ts, publishPage.ts ...
│   │   │   └── api/
│   │   │       ├── auth/[...all]/route.ts   # Better Auth handler
│   │   │       ├── mcp/route.ts             # remote MCP (HTTP transport)               (C9)
│   │   │       └── webhooks/
│   │   ├── components/
│   │   │   ├── shell/                       # rail · nav-tree · top-bar · status-bar · agent-panel (C1/C2)
│   │   │   ├── editor/                      # editor-host · yjs-binding                 (C2/C6)
│   │   │   ├── agent/                       # inline-command-bar · floating-toolbar · task-card · run-inspector (C3/C4/C5)
│   │   │   ├── collab/                      # presence-bar · live-cursors · comment-thread (C6)
│   │   │   ├── review/                      # review-stepper · publish-gate            (C7)
│   │   │   ├── home/                        # workspace-home · command-palette · onboarding (C8)
│   │   │   ├── governance/                  # permissions · audit-view                 (C10)
│   │   │   └── ui/                          # shadcn primitives + component inventory   (C11)
│   │   ├── stores/                          # ui-store.ts (Zustand — local UI state)
│   │   └── lib/                             # auth client, db re-export
│   │
│   └── cloud-realtime/             # NEW @anydocs/cloud-realtime — Hocuspocus WS service
│       ├── package.json · tsconfig.json
│       └── src/
│           ├── server.ts                    # Hocuspocus server entry (persistent Node)
│           ├── extensions/
│           │   ├── auth.ts                  # validate Better Auth session / token       (C6/C9)
│           │   ├── persistence.ts           # store Y.Doc binary in ydoc_states          (C6)
│           │   └── materialize.ts           # debounced Y.Doc → doc-content-v1 bridge      (C2/C6)
│           └── index.ts
│
└── tokens.css                      # shared design contract (cloud-web + desktop edition both import)
```

### Architectural Boundaries

- **API boundaries:** Server Actions (mutations) + Route Handlers (REST/MCP/webhooks) in
  `cloud-web`; WebSocket (Yjs sync) in `cloud-realtime`; remote MCP JSON-RPC over HTTP at
  `app/api/mcp`. All cross the `cloud-core` domain boundary — apps never touch the DB directly
  except through `cloud-core` repositories.
- **Component boundaries:** RSC for shell/data; client components for editor/realtime/agent;
  Yjs awareness for collab state; Zustand for local UI only.
- **Service boundaries:** `cloud-core` owns all domain logic + DB access; `cloud-web` and
  `cloud-realtime` are adapters. `provider-port` isolates the LLM vendor.
- **Data boundaries:** every tenant-scoped query goes through `withTenant()` (RLS GUC).
  `doc-content-v1` jsonb is canonical; Y.Doc binary in `ydoc_states` is runtime; the bridge
  reconciles them.

### Requirements → Structure Mapping

| Epic | Primary location |
|---|---|
| C1 Foundation | `cloud-core/{db,auth,tenancy}` + `cloud-web/app/(auth)` + shell `layout.tsx` |
| C2 Authoring | `cloud-web/components/{shell,editor}` + `cloud-core/{repositories,content}` |
| C3 Inline Agent | `cloud-core/{agent,audit}` + `cloud-web/components/agent/{inline-command-bar,floating-toolbar}` |
| C4 Page Agent | `cloud-core/agent/page-orchestrator` + `components/agent/task-card` |
| C5 Workspace Agent | `cloud-core/agent/workspace-orchestrator` + `components/agent/run-inspector` |
| C6 Collaboration | `cloud-realtime/*` + `cloud-web/components/collab` + `cloud-core/content/ydoc-bridge` |
| C7 Review/Publish | `cloud-web/components/review` + `cloud-core/repositories` |
| C8 Home/Onboarding/Palette | `cloud-web/components/home` |
| C9 Remote MCP | `cloud-core/mcp` + `cloud-web/app/api/mcp` |
| C10 Governance | `cloud-core/{permissions,audit}` + `cloud-web/components/governance` |
| C11 Design conformance | `cloud-web/components/ui` + `tokens.css` |

### Data Flow

1. Request → `middleware.ts` resolves session + active tenant → `cloud-core/withTenant` sets RLS GUC.
2. Editor mounts `@anydocs/editor` + Plate Yjs plugin → connects to `cloud-realtime` (Hocuspocus).
3. Edits flow through the Y.Doc; `cloud-realtime` persists binary + debounced-materializes
   `doc-content-v1` jsonb via the bridge.
4. Agent invocation → `agent-service` (scope-validated) → write-ahead `audit` → applies via the
   same content path → audit committed.
5. Remote MCP → `app/api/mcp` → `transport-port` (HTTP) → auth + `ToolProfile` → `cloud-core` tools.

## Architecture Validation Results

### Coherence Validation ✅

- **Decision compatibility:** all-TypeScript stack — Next.js + Plate + Yjs + Hocuspocus 4.3 +
  Better Auth 1.6 + Drizzle 0.45 / Postgres. Verified integration paths exist: Plate ships a
  native Yjs plugin; Better Auth ships a Drizzle adapter; Hocuspocus is the canonical Yjs WS
  backend. No version conflicts.
- **Pattern consistency:** naming/structure/format rules align with the existing workspace
  conventions (kebab-case files, PascalCase components, co-located `*.test.ts`, typed domain errors).
- **Structure alignment:** three packages (`cloud-core` domain + `cloud-web` / `cloud-realtime`
  adapters) mirror the existing "core is domain, apps are adapters" philosophy; boundaries respected.

### Requirements Coverage Validation ✅ (with 1 noted gap)

- **Epics C1–C11:** every epic maps to concrete directories (see Requirements → Structure table).
- **NFR coverage:** CNFR1 dark/CNFR4 tokens → tokens.css + `[data-theme]`; CNFR2 a11y → C11 + per-epic ACs;
  CNFR5 perf → client virtualization + Hocuspocus connection-state banner; CNFR6 realtime → Yjs/Hocuspocus
  (architectural core); CNFR7 remote MCP → C9 transport+auth+ToolProfile; CNFR8 latency → provider-port +
  streaming (operationally provider-bound); CNFR9 write-ahead audit → `audit/write-ahead.ts`.
- **Gap — CNFR3 (i18n):** no dedicated architecture element; carried cross-cutting only (same soft gap
  noted in the epics). Recommend adding Next.js i18n routing + a locale-format utility — small, non-blocking.

### Implementation Readiness Validation ✅

- **Decision completeness:** all critical decisions documented with verified current versions.
- **Structure completeness:** full package tree, boundaries, and epic→location mapping defined.
- **Pattern completeness:** naming/structure/format/communication/process patterns + enforcement rules + examples.

### Gap Analysis Results

**Critical (blocking):** none.

**Important (address early, non-blocking):**
1. **Y.Doc ↔ doc-content-v1 bridge is the highest-risk net-new component.** Correct, loss-less
   materialization under concurrent edits is subtle. Recommend a spike + round-trip fixtures
   (reuse the editor's existing converters) before building dependent epics.
2. **Agent writes must flow through the Y.Doc, not bypass it.** So collaborators see agent edits live
   AND they remain audited. The agent apply-path must go: agent → Y.Doc transaction → audit → materialize.
   Make this explicit in the agent orchestrators (C3–C5).
3. **Realtime scale-out (Redis pub/sub for >1 Hocuspocus node)** is deferred — fine for MVP, flagged for scale.

**Nice-to-have (deferred):** observability/APM vendor; caching layer; cloud full-text search substrate
(the local-first build-time MiniSearch index doesn't fit a live multi-tenant store — Postgres FTS or a
search service is a later decision).

### Architecture Completeness Checklist

- [x] Requirements analysis · scale/complexity · constraints · cross-cutting concerns
- [x] Architectural decisions documented with verified versions
- [x] Implementation patterns (naming/structure/communication/process) + enforcement
- [x] Complete project structure · boundaries · epic→location mapping

### Architecture Readiness Assessment

**Overall Status:** READY FOR IMPLEMENTATION (with 2 early-risk items to spike first).
**Confidence:** High on stack + structure; Medium on the two net-new integration risks
(Y.Doc bridge, agent↔realtime apply-path).

**Key strengths:** maximum reuse of `@anydocs/editor` + `doc-content-v1` + `tokens.css`;
DB-enforced tenant isolation (RLS); clean domain/adapter separation; no vendor lock-in.

**Areas for future enhancement:** i18n architecture element; realtime horizontal scaling;
cloud search substrate; observability.

### Implementation Handoff

**AI Agent Guidelines:** follow decisions exactly; use patterns consistently; respect boundaries;
treat `doc-content-v1` as canonical and `tokens.css` as the design contract.

**First Implementation Priority:** scaffold `cloud-web` + `cloud-core` + `cloud-realtime`, wire
Postgres/Drizzle/RLS + Better Auth + a Hocuspocus baseline (maps to Story C1.1). Spike the
Y.Doc↔doc-content-v1 bridge in parallel.
