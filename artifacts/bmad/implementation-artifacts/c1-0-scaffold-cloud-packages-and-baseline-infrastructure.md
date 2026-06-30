# Story C1.0: Scaffold cloud packages and baseline infrastructure

Status: ready-for-dev

<!-- Product line: Cloud Team Edition (independent from the local-first edition). -->
<!-- Sprint tracking: artifacts/bmad/implementation-artifacts/sprint-status-cloud-team-edition.yaml (NOT sprint-status.yaml). -->

## Story

As a developer agent,
I want the Cloud Team Edition's packages and baseline infrastructure scaffolded in the existing pnpm workspace,
so that every later story (C1.1 onward) has a running app, database, auth, and realtime baseline to build on — without disturbing the local-first edition.

## Acceptance Criteria

1. **Three cloud packages exist and build.** `cloud-web` (Next.js App Router), `cloud-core` (server domain), and `cloud-realtime` (Hocuspocus) exist as workspace packages, build under TypeScript strict mode, and import `@anydocs/editor` and `tokens.css` **without forking them**.
2. **Backend baseline wired in `cloud-core`.** Postgres + Drizzle ORM (with a first migration that creates at least one baseline table) + Better Auth are wired and configured; `drizzle-kit` migration runs cleanly against a Postgres instance.
3. **Realtime baseline boots in `cloud-realtime`.** A Hocuspocus server starts (persistent Node process) and accepts a WebSocket connection (no document persistence/auth logic required yet — just a bootable baseline).
4. **Local-first edition unchanged.** The existing packages `web`, `core`, `editor` (and `cli`, `mcp`, `desktop*`) are not modified; their builds/tests still pass.
5. **`tokens.css` consumed as the design contract.** `cloud-web` imports `tokens.css`; no hard-coded design values (colors/spacing/radius) are introduced.

## Tasks / Subtasks

- [ ] **Task 1 — Scaffold `cloud-core` server-domain package (AC: #1, #2)**
  - [ ] Create `packages/cloud-core/` with `package.json` (name `@anydocs/cloud-core`), `tsconfig.json` (strict), `src/index.ts`
  - [ ] Add deps: `drizzle-orm`, `postgres`, `better-auth`; devDep `drizzle-kit`
  - [ ] `src/db/client.ts` — Drizzle client over a `postgres` connection (env `DATABASE_URL`)
  - [ ] `src/db/schema/` — at least one baseline table (e.g. `organizations.ts`) + a Better Auth tables module (`auth.ts`)
  - [ ] `src/db/rls.ts` — stub `withTenant()` helper signature (sets the Postgres GUC; full enforcement in C1.x)
  - [ ] `src/auth/better-auth.ts` — Better Auth config using the Drizzle adapter
  - [ ] `drizzle.config.ts` + generate the first migration with `drizzle-kit` under `src/db/migrations/`
- [ ] **Task 2 — Scaffold `cloud-realtime` Hocuspocus package (AC: #1, #3)**
  - [ ] Create `packages/cloud-realtime/` with `package.json` (`@anydocs/cloud-realtime`), `tsconfig.json` (strict)
  - [ ] Add deps: `@hocuspocus/server`, `yjs`
  - [ ] `src/server.ts` — minimal bootable Hocuspocus server (port from env); `src/index.ts` entry
  - [ ] Leave `extensions/` (auth/persistence/materialize) as empty stubs for C6 stories
- [ ] **Task 3 — Scaffold `cloud-web` Next.js App Router package (AC: #1, #5)**
  - [ ] `pnpm create next-app packages/cloud-web --ts --app --tailwind --eslint` (align Next version with the workspace; see Dev Notes)
  - [ ] `package.json` name `@anydocs/cloud-web`; add deps: `@anydocs/cloud-core`, `@anydocs/editor`, `better-auth`, `yjs`, `@hocuspocus/provider`, `@platejs/yjs`, `zustand`
  - [ ] `app/globals.css` imports `tokens.css`; add a minimal `app/(app)/layout.tsx` placeholder (full four-region shell is Story C1.4)
  - [ ] Verify `@anydocs/editor` imports resolve through its public contract (no deep `src/*` imports)
- [ ] **Task 4 — Workspace wiring & isolation (AC: #1, #4)**
  - [ ] Register the 3 packages in `pnpm-workspace.yaml` (if not glob-covered) and root scripts as needed
  - [ ] Confirm `tokens.css` is referenced from a shared location (shared with the desktop edition) — do not duplicate it
  - [ ] Confirm NO changes to `packages/{web,core,editor,cli,mcp,desktop,desktop-server}`
- [ ] **Task 5 — Build / typecheck / smoke (AC: #1–#5)**
  - [ ] `pnpm -r build` (or per-package) passes for the 3 new packages under TS strict
  - [ ] `drizzle-kit` migration applies to a local/throwaway Postgres
  - [ ] `cloud-realtime` server boots and accepts a WS connection (smoke)
  - [ ] Existing local-first gate still green: `pnpm test` (core + cli + mcp) unaffected

## Dev Notes

### Stack & versions (verified 2026-06-30 — pin at scaffold time)

- **Next.js** current stable **16.2.9 LTS**, but the existing workspace is on **Next 15** — **align the cloud app to the workspace Next version** to avoid a split React/Next across packages. A workspace-wide bump to 16 is a separate coordinated upgrade. [Source: architecture-cloud-team-edition.md#Starter Template Evaluation]
- **Better Auth 1.6.22** (TS-first, Drizzle adapter, schema in your own Postgres, no per-MAU). [Source: architecture-cloud-team-edition.md#Authentication & Security]
- **Drizzle ORM 0.45.2** with native **Row-Level Security** (declarative policies). [Source: architecture-cloud-team-edition.md#Data Architecture]
- **Hocuspocus 4.3.0** (`@hocuspocus/server`), provider 4.1.0; **Yjs** CRDT via the Plate Yjs plugin (`@platejs/yjs`). [Source: architecture-cloud-team-edition.md#Real-time Collaboration]

### Architecture patterns & guardrails (MUST follow)

- **Domain/adapter split:** `cloud-core` owns ALL domain logic + DB access; `cloud-web` and `cloud-realtime` are thin adapters. Mirrors the existing "`@anydocs/core` is domain, apps are adapters" philosophy. [Source: architecture-cloud-team-edition.md#Structure Patterns]
- **Reuse, never fork:** import `@anydocs/editor` and `@anydocs/core` only through their public contracts; consume `tokens.css` as the immutable design contract (no hard-coded design values). [Source: epics-cloud-team-edition.md#Story C1.0]
- **`doc-content-v1` stays canonical** (jsonb at rest); the Y.Doc is runtime-only. This story does NOT implement the Y.Doc to doc-content-v1 bridge — that is an EARLY SPIKE flagged for C2/C6 — but leave the `cloud-realtime/extensions/materialize.ts` stub in place for it. [Source: architecture#Data Architecture; readiness report#Gap Analysis]
- **Tenant isolation is DB-enforced (RLS):** `withTenant()` must set the Postgres session GUC before queries. Only stub the signature here; full enforcement lands with C1.1–C1.6. [Source: architecture#Authentication & Security]
- **No vendor name in `cloud-core`** — LLM access goes behind `provider-port` (introduced in C3, not this story).

### Naming/format conventions (align with existing workspace)

- Files **kebab-case**; React components / types **PascalCase**; functions/vars **camelCase**; constants UPPER_SNAKE.
- DB tables **snake_case** plural; columns snake_case; tenant keys `organization_id`/`workspace_id`/`project_id`; timestamps `created_at`/`updated_at`. [Source: architecture#Naming Patterns]
- Tests **co-located `*.test.ts`** (matches the workspace test convention).

### Project Structure Notes

Target layout (this story creates the package skeletons; later stories fill them in):

```
packages/
  cloud-core/      @anydocs/cloud-core      src/{db/{client,rls,schema/,migrations/},auth/,index.ts}
  cloud-web/       @anydocs/cloud-web       app/{globals.css,(app)/layout.tsx}, package.json
  cloud-realtime/  @anydocs/cloud-realtime  src/{server.ts,extensions/(stubs),index.ts}
tokens.css         shared design contract (cloud-web + desktop edition import it)
```

- **Hosting topology (context, not built here):** 3 deployable units — cloud-web (Vercel/Node), cloud-realtime (persistent Node), Postgres (Neon/managed). `cloud-realtime` is NOT serverless. [Source: architecture#Infrastructure & Deployment]
- **Isolation invariant:** the local-first packages must remain unchanged. If a shared root config (tsconfig base, eslint) must change, prefer additive package-local overrides over editing shared files.

### Testing standards

- TS strict build must pass for all 3 packages.
- Provide a minimal smoke test for `cloud-realtime` boot (server starts + accepts a WS connection).
- A `drizzle-kit` migration must generate and apply against a throwaway Postgres (document the `DATABASE_URL` env in `.env.example`).
- Do not regress the local-first gate (`pnpm test`).

### References

- [Source: artifacts/bmad/planning-artifacts/epics-cloud-team-edition.md#Story C1.0]
- [Source: artifacts/bmad/planning-artifacts/epics-cloud-team-edition.md#Epic C1]
- [Source: artifacts/bmad/planning-artifacts/architecture-cloud-team-edition.md#Starter Template Evaluation]
- [Source: artifacts/bmad/planning-artifacts/architecture-cloud-team-edition.md#Core Architectural Decisions]
- [Source: artifacts/bmad/planning-artifacts/architecture-cloud-team-edition.md#Project Structure & Boundaries]
- [Source: artifacts/bmad/planning-artifacts/implementation-readiness-report-cloud-team-edition-2026-06-30.md] (this story = M1 fix)

### Open questions (for the user, non-blocking)

- Postgres host preference for dev (Neon vs local Docker vs Supabase Postgres)? Affects `.env.example` + migration instructions.
- Confirm the workspace Next version to align `cloud-web` to (the workspace is on 15; current LTS is 16.2.9).

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
