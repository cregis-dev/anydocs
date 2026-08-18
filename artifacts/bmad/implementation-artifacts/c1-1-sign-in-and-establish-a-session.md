# Story C1.1: Sign in and establish a session

Status: done

<!-- Product line: Cloud Team Edition. Sprint: sprint-status-cloud-team-edition.yaml (NOT sprint-status.yaml). -->
<!-- Builds on c1-0 (done): @anydocs/cloud-core getAuth() lazy Better Auth (email/password enabled) + migrated auth tables; @anydocs/cloud-web Next 16 App Router. -->

## Story

As a documentation maintainer,
I want to sign in to the cloud with email (Better Auth email/password baseline),
so that I have an authenticated session that scopes everything I see and do.

## Acceptance Criteria

1. **Session established with a stable user id.** An unauthenticated visitor who completes email
   sign-in gets an established session identified by a stable user id (Better Auth `user.id`).
2. **Unauthenticated/expired access is redirected, no data leak.** An expired or invalid session
   accessing a protected route redirects back to sign-in without rendering or returning any
   workspace/tenant data.
3. **Sign-out invalidates the session.** Signing out invalidates the session server-side; protected
   routes then redirect back to sign-in.
4. **OAuth is a declared extension point.** The AC's "or OAuth" is satisfiable by configuration
   (Better Auth social providers) without code changes to the flow — documented, not wired this story
   (no provider secrets in scope).

## Tasks / Subtasks

- [x] **Task 1 — Mount the Better Auth server handler + client (AC: #1, #3)**
  - [x] `cloud-web/app/api/auth/[...all]/route.ts` — export `GET`/`POST` via `toNextJsHandler(getAuth())` from `better-auth/next-js`
  - [x] `cloud-web/lib/auth-client.ts` — `createAuthClient` from `better-auth/react` (baseURL from env), export `signIn`/`signUp`/`signOut`/`useSession`
  - [x] Confirm `getAuth()` stays lazy (server handler calls it per request; no module-load connection)
- [x] **Task 2 — Sign-in / sign-up page (AC: #1)**
  - [x] `cloud-web/app/(auth)/sign-in/page.tsx` — email + password form; on submit call `authClient.signIn.email(...)`; on success route to `/home`
  - [x] Minimal sign-up affordance (email/password) so a first user can exist; both use `tokens.css` (no hard-coded design values)
  - [x] Surface auth errors inline (self-explaining, no raw stack) per design brief §9.5
- [x] **Task 3 — Protect the (app) routes via middleware (AC: #2)**
  - [x] `cloud-web/middleware.ts` — check the Better Auth session cookie; if absent/invalid on an `(app)` path, redirect to `/sign-in`
  - [x] Ensure protected Server Components do not fetch/render tenant data before the session check (no leak on the redirect path)
  - [x] Add a `matcher` scoping middleware to protected routes (exclude `/sign-in`, `/api/auth/*`, static assets)
- [x] **Task 4 — Sign-out (AC: #3)**
  - [x] A sign-out control (in the placeholder shell or home) calling `authClient.signOut()`
  - [x] After sign-out, navigating to a protected route redirects to `/sign-in` (session invalidated server-side)
- [x] **Task 5 — Tests + gates (AC: #1–#3)**
  - [x] Unit: middleware redirect logic (no session → redirect; valid session → pass) with the session cookie mocked
  - [x] Integration (Postgres-backed, Docker is available): sign-up → sign-in establishes a session row; sign-out deletes/expires it; protected fetch without session is rejected
  - [x] `pnpm --filter @anydocs/cloud-web typecheck` + `next build` pass; local-first gate (`pnpm test`) still green

## Dev Notes

### Reuse from c1-0 (done) — do not re-scaffold

- **`@anydocs/cloud-core` public API is LAZY:** `getAuth()` (Better Auth, email/password already enabled),
  `getDb()`, `getSql()`. Importing the package must NOT open a socket — call the getters at request time,
  never at module top-level. [Source: c1-0 review; architecture-cloud-team-edition.md#Authentication & Security]
- **Auth tables already migrated:** `user` / `session` / `account` / `verification` (migration 0000). The
  `session` table already has `active_organization_id` reserved for the C1.2+ tenant binding — do not add tenancy
  logic here (that is C1.2/C1.6).
- **`user.id` is a stable text PK** — use it as the AC1 "stable user id".

### Stack & integration specifics

- **Next.js 16.1.6 + React 19.2.3** (workspace-aligned). App Router; `middleware.ts` at the `cloud-web` package root.
- **Better Auth 1.6.22.** Server handler: `import { toNextJsHandler } from 'better-auth/next-js'` →
  `export const { GET, POST } = toNextJsHandler(getAuth())`. Client: `import { createAuthClient } from 'better-auth/react'`.
- **Env:** `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` (default `http://localhost:3000`), `DATABASE_URL` — all in
  `cloud-web/.env.example` (from c1-0). A real `BETTER_AUTH_SECRET` is required for sessions to sign.
- **Session cookie:** Better Auth sets an httpOnly session cookie; middleware reads it. Prefer Better Auth's
  own session-check helper over hand-parsing the cookie where available.

### Guardrails (from architecture + c1-0)

- No vendor/provider name leaks into `cloud-core` (already clean). No hard-coded design values — use `tokens.css`.
- Do NOT modify local-first packages or `sprint-status.yaml`.
- Keep `doc-content-v1` untouched (no content work here).
- No tenancy/RLS enforcement yet — `withTenant()` stays a stub until C1.2+; this story only establishes identity/session.

### Project Structure Notes

New files land in `cloud-web`:
```
cloud-web/
  middleware.ts                         # (app) route protection (Task 3)
  lib/auth-client.ts                    # Better Auth React client (Task 1)
  app/api/auth/[...all]/route.ts        # Better Auth server handler (Task 1)
  app/(auth)/sign-in/page.tsx           # sign-in / sign-up (Task 2)
```
The `(app)` route group + placeholder layout already exist from c1-0.

### Testing standards

- Co-located `*.test.ts`. Middleware unit test can run without a DB (mock the session cookie).
- Integration flow uses a throwaway Postgres (Docker was confirmed available in c1-0): apply migration,
  sign-up/sign-in/sign-out, assert on the `session` table. Tear down the container after.
- Do not regress the local-first gate.

### References

- [Source: artifacts/bmad/planning-artifacts/epics-cloud-team-edition.md#Story C1.1]
- [Source: artifacts/bmad/planning-artifacts/architecture-cloud-team-edition.md#Authentication & Security]
- [Source: artifacts/bmad/implementation-artifacts/c1-0-scaffold-cloud-packages-and-baseline-infrastructure.md] (getAuth()/getDb() lazy API, migrated tables)

### Open questions (non-blocking)

- Post-sign-in landing route: `/home` (Workspace Home is C8.1) vs a temporary placeholder? Default to a minimal
  `/home` placeholder that just proves the authenticated state; real Home is C8.1.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (BMAD dev-story workflow)

### Debug Log References

- `pnpm --filter @anydocs/cloud-web test` → 4 passed, 1 skipped without a DB; with a live
  `postgres:16` (`CLOUD_TEST_DATABASE_URL` set) → 5 passed, 0 skipped (integration included).
- `pnpm --filter @anydocs/cloud-core build` → dist emitted (consumed by cloud-web).
- `pnpm --filter @anydocs/cloud-web typecheck` → clean.
- `pnpm --filter @anydocs/cloud-web build` (`next build`) → success; `/home` + `/api/auth/[...all]` are dynamic (ƒ), `/sign-in` + `/` static, middleware active as "Proxy (Middleware)".
- Local-first gate `pnpm test` → 0 exit (core/editor/cli/mcp + web:unit 77/77 green — no regression).

### Completion Notes List

- **Lazy auth preserved (AC1/AC3):** the route handler wraps `getAuth()` in a per-request thunk
  `toNextJsHandler((request) => getAuth().handler(request))` so importing the route / `next build`
  never opens a DB socket. Confirmed: initial build failed because `/home` was statically
  prerendered and hit `getDb()`; fixed by marking the page `export const dynamic = 'force-dynamic'`.
- **Two-layer session enforcement (AC2 no-leak):** `middleware.ts` does the optimistic Better Auth
  cookie-presence check (`getSessionCookie`, no DB round-trip) for a fast redirect; the protected
  `/home` Server Component does the authoritative `getAuth().api.getSession()` and `redirect('/sign-in')`
  *before* rendering any user data — so an expired/invalid-but-present cookie still can't leak data.
- **Sign-out (AC3):** `SignOutButton` calls `authClient.signOut()` (server-side session invalidation)
  then routes to `/sign-in`; a subsequent `/home` hit fails `getSession()` and redirects.
- **OAuth extension point (AC4):** documented, not wired — `.env.example` carries commented provider
  secrets + the note that enabling a social provider is Better Auth config (`socialProviders` +
  `signIn.social`) with no change to this flow. No provider secrets in scope. `cloud-core` untouched
  (no vendor-name leak).
- **Testability:** middleware logic is split into a pure, runtime-agnostic `lib/auth-guard.ts`
  (`resolveAuthRedirect` / `isProtectedPath`), unit-tested without the Next edge runtime or a DB.
  `tsconfig.json` gained `allowImportingTsExtensions` so co-located `.ts`-extension test imports
  (required by `node --experimental-strip-types`) typecheck cleanly.
- **Integration test EXECUTED and passing (AC1–AC3):** ran against a throwaway `postgres:16`
  container (published on `127.0.0.1:55432`, dropped after) — `pnpm --filter @anydocs/cloud-web test`
  → 5 passed / 0 failed / 0 skipped. Verified: sign-up establishes a `session` row with a stable
  `user.id`; sign-in returns the same id; an anonymous `getSession` is null (no leak); sign-out
  invalidates the session server-side. The test resets only its own 5 tables (never a whole schema),
  so it is safe against a shared DB. Reproduce:
  `docker run --rm -d --name pg -e POSTGRES_PASSWORD=pw -e POSTGRES_DB=anydocs_cloud_test -p 127.0.0.1:55432:5432 postgres:16`
  then `CLOUD_TEST_DATABASE_URL=postgres://postgres:pw@127.0.0.1:55432/anydocs_cloud_test pnpm --filter @anydocs/cloud-web test`.
- **Landing route decision:** post-sign-in lands on a minimal `/home` placeholder that proves the
  authenticated state (real Workspace Home is C8.1), per the story's open-question default.

### File List

**New**
- `packages/cloud-web/app/api/auth/[...all]/route.ts`
- `packages/cloud-web/lib/auth-client.ts`
- `packages/cloud-web/lib/auth-guard.ts`
- `packages/cloud-web/lib/auth-guard.test.ts`
- `packages/cloud-web/middleware.ts`
- `packages/cloud-web/app/(auth)/sign-in/page.tsx`
- `packages/cloud-web/app/(app)/home/page.tsx`
- `packages/cloud-web/app/(app)/home/sign-out-button.tsx`
- `packages/cloud-web/tests/auth-flow.integration.test.ts`

**Modified**
- `packages/cloud-web/package.json` (added `test` script)
- `packages/cloud-web/tsconfig.json` (added `allowImportingTsExtensions`)
- `packages/cloud-web/.env.example` (`NEXT_PUBLIC_BETTER_AUTH_URL` + OAuth extension-point docs)
- `packages/.gitignore` (un-ignore `.env.example` so shared example env is committed — review M1)
- `package.json` (added root `test:cloud` aggregate script — review M3)
- `artifacts/bmad/implementation-artifacts/sprint-status-cloud-team-edition.yaml` (c1-1 status)

### Senior Developer Review (AI)

**Outcome:** Approve (after fixes) — all 4 ACs implemented & integration-tested; 6 review findings
(0 High / 3 Medium / 3 Low) all resolved in-session.

**Action Items (all resolved):**
- [x] [Med] M1 — `.env.example` was gitignored via `.env*` (never committed), so AC4 OAuth docs +
  env contract were untracked. Fixed: `packages/.gitignore` now un-ignores `*.env.example`.
- [x] [Med] M2 — AC2 "expired session" untested. Fixed: integration test now force-expires the
  `session` row and asserts `getSession` → null (expired-but-present cookie rejected).
- [x] [Med] M3 — cloud-web tests not in any aggregate/CI gate. Fixed: added root `test:cloud`
  (cloud-realtime + cloud-web).
- [x] [Low] L1 — sign-out had no error handling (button could wedge). Fixed with try/finally in
  `sign-out-button.tsx`.
- [x] [Low] L2 — `minLength={8}` blocked sign-in for short legacy passwords. Fixed: min length now
  applies on sign-up only.
- [x] [Low] L3 — sign-up→/home relied on implicit autoSignIn. Documented the assumption + the
  server-side getSession safety net in `sign-in/page.tsx`.

**Post-fix verification:** cloud-web typecheck ✅; `next build` ✅; `test:cloud` ✅ (cloud-realtime
1/1, cloud-web 5/5 incl. PG integration with the new expiry assertion, against throwaway postgres:16).

### Change Log

- 2026-07-01 — Implemented C1.1 sign-in/session: Better Auth server handler + React client,
  sign-in/sign-up page, `(app)` route protection via middleware + pure guard, `/home` placeholder
  with server-side session check + sign-out, OAuth documented as config-only. Unit tests green;
  Postgres integration test executed against a throwaway postgres:16 (5/5 pass). Status → review.
- 2026-07-03 — Addressed code review findings — 6 items resolved (3 Med / 3 Low): commit-track
  `.env.example`, add expired-session AC2 test, add root `test:cloud`, sign-out try/finally,
  sign-in min-length on sign-up only, autoSignIn doc. Re-verified typecheck/build/test:cloud green.
  Status → done.
