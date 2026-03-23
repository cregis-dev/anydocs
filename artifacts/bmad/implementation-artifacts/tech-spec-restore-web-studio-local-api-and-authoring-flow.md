---
title: 'Restore Web Studio Local API and Authoring Flow'
slug: 'restore-web-studio-local-api-and-authoring-flow'
created: '2026-03-22T18:01:56Z'
status: 'ready-for-dev'
stepsCompleted: [1, 2, 3, 4]
tech_stack:
  - 'Next.js App Router route handlers'
  - 'TypeScript'
  - '@anydocs/core service layer'
  - 'Playwright end-to-end tests'
  - 'Electron IPC fallback boundary for desktop runtime'
files_to_modify:
  - 'packages/web/app/api/local/_shared.ts'
  - 'packages/web/app/api/local/_preview-registry.ts'
  - 'packages/web/app/api/local/project/route.ts'
  - 'packages/web/app/api/local/navigation/route.ts'
  - 'packages/web/app/api/local/pages/route.ts'
  - 'packages/web/app/api/local/page/route.ts'
  - 'packages/web/app/api/local/api-sources/route.ts'
  - 'packages/web/app/api/local/build/route.ts'
  - 'packages/web/app/api/local/preview/route.ts'
  - 'packages/web/tests/e2e/studio-local-api.spec.ts'
  - 'packages/web/tests/e2e/studio.spec.ts'
  - 'packages/web/tests/e2e/studio-authoring-flow.spec.ts'
  - 'packages/web/scripts/gen-public-assets.mjs'
code_patterns:
  - 'Studio web runtime falls back to /api/local/* when desktop IPC is unavailable'
  - 'Studio bootstrap loads project, navigation, pages, and api-sources together before marking the workspace connected'
  - 'Route handlers should stay thin and delegate filesystem/build/preview work to existing helpers'
  - 'Studio connection status is derived from initial load state, so bootstrap API failures surface as Disconnected'
  - 'Local API responses must remain JSON and match the existing Studio frontend contracts'
  - 'Validation and repository failures should be translated from DomainError/ValidationError into readable JSON responses'
  - 'Static docs export already hides app/api during export, so restored local routes must remain compatible with that mechanism'
test_patterns:
  - 'Playwright API regression in packages/web/tests/e2e/studio-local-api.spec.ts'
  - 'Playwright Studio shell smoke in packages/web/tests/e2e/studio.spec.ts'
  - 'Playwright authoring flow in packages/web/tests/e2e/studio-authoring-flow.spec.ts'
---

# Tech-Spec: Restore Web Studio Local API and Authoring Flow

**Created:** 2026-03-22T18:01:56Z

## Overview

### Problem Statement

The web Studio runtime currently depends on `/api/local/*` endpoints for project bootstrap, page and navigation reads/writes, and preview/build actions, but the checked-in App Router handlers are missing. As a result, opening an external project in web Studio fails with `404`, the workspace drops into `Disconnected`, and core authoring flows are no longer reliable.

### Solution

Restore the local App Router endpoints required by web Studio, keep the existing frontend request contract intact, and wire the routes to the same server-side helpers and core workflows already used elsewhere in the repo. Validate the fix through the real Playwright API and Studio authoring flows rather than mocks.

### Scope

**In Scope:**
- Restore the web Studio local API surface under `packages/web/app/api/local/*`
- Recover project bootstrap, navigation/page access, save, build, and preview behavior for the web runtime
- Keep JSON response shapes aligned with the current Studio client contract
- Revalidate the restored path with targeted Playwright API and P0 Studio authoring tests

**Out of Scope:**
- Unrelated UI redesign or Studio feature expansion
- Reader, MCP, or theme work that does not block web Studio authoring
- Existing top-level test failures that are not required to make web Studio authoring functional again

## Context for Development

### Codebase Patterns

- `packages/web/components/studio/backend.ts` is the canonical bridge between Studio UI actions and the local API or desktop IPC surface.
- `LocalStudioApp` bootstraps the selected project by loading project contract, navigation, page list, and API sources in one combined path, so web Studio is not functionally complete unless all of those endpoints exist.
- In web mode, missing local API handlers surface immediately as load errors and drive the footer state to `Disconnected`.
- There is an existing completed spec for the broader local API restoration effort in `artifacts/bmad/implementation-artifacts/tech-spec-studio-local-api-routes.md`; this spec narrows the delivery target to the web Studio recovery path.
- `packages/web/lib/docs/fs.ts` already contains the server-side helpers needed for project contract loading, navigation/page CRUD, project settings updates, and API source persistence.
- The restored routes should remain thin HTTP adapters over existing filesystem helpers and core build/preview workflows.
- Validation failures are already modeled as `DomainError` / `ValidationError` in `@anydocs/core`, so route-layer error normalization should preserve JSON responses rather than letting Next fall back to HTML errors.
- No repository-local `project-context.md` exists for this repo, so implementation should follow the existing code and artifact conventions directly.

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `packages/web/components/studio/backend.ts` | Defines the request URLs, methods, and response contracts expected by Studio |
| `packages/web/components/studio/local-studio-app.tsx` | Surfaces connection state and exercises project bootstrap plus authoring flows |
| `packages/web/lib/docs/fs.ts` | Server-only helper layer already implementing project, page, navigation, and API source operations |
| `artifacts/bmad/implementation-artifacts/tech-spec-studio-local-api-routes.md` | Existing broader design reference for the missing local API route family |
| `packages/web/tests/e2e/studio-local-api.spec.ts` | Current API regression proving `/api/local/project` still returns `404` |
| `packages/web/tests/e2e/studio.spec.ts` | Current P0 Studio shell regression for project-open and connection status |
| `packages/web/tests/e2e/studio-authoring-flow.spec.ts` | Current P0 end-to-end authoring regression relying on real local routes |
| `packages/web/scripts/gen-public-assets.mjs` | Existing export path that temporarily hides `app/api`, which restored local routes must stay compatible with |
| `packages/core/src/errors/domain-error.ts` | Base error contract for readable structured route responses |
| `packages/core/src/errors/validation-error.ts` | Validation-specific error type already emitted by repository/service helpers |

### Technical Decisions

- Preserve the current Studio frontend contract rather than redesigning request shapes.
- Treat web Studio recovery as the primary target; desktop-specific IPC behavior is not the main delivery scope for this fix.
- Prefer reusing the existing local API route design from the earlier implementation artifact instead of inventing a new transport path.
- Include `api-sources` in the restored route family because Studio bootstrap and project settings save both depend on it.
- Keep route responses JSON-only, including validation and missing-resource failures, because `backend.ts` explicitly treats HTML as an API failure mode.
- Keep the restored route placement under `packages/web/app/api/local/*` so the existing export-time `app/api` hiding logic continues to protect static docs output.
- Fixes must be validated against real HTTP handlers and real filesystem-backed project flows.

## Implementation Plan

### Tasks

- [ ] Task 1: Recreate the shared local route foundation used by all web Studio endpoints
  - File: `packages/web/app/api/local/_shared.ts`
  - Action: Implement reusable helpers for parsing `projectId`, `path`, `lang`, and `pageId` from `NextRequest`, safely reading JSON request bodies, and returning consistent JSON success/error payloads.
  - Notes: Translate `DomainError` and `ValidationError` into readable `{ error }` JSON responses and keep the handlers pinned to `runtime = 'nodejs'`.
- [ ] Task 2: Restore the project contract route required for Studio bootstrap and settings persistence
  - File: `packages/web/app/api/local/project/route.ts`
  - Action: Implement `GET` using `loadStudioProjectContract()` and `PUT` using `updateStudioProjectSettings()`.
  - Notes: Response shape must match `StudioProjectResponse` exactly because `LocalStudioApp` reads `config` and `paths.*` fields during bootstrap and settings save.
- [ ] Task 3: Restore the language-scoped navigation and page listing endpoints used during initial workspace load
  - File: `packages/web/app/api/local/navigation/route.ts`
  - Action: Implement `GET` and `PUT` using `loadNavigation()` and `saveNavigation()`.
  - Notes: Return canonical `NavigationDoc` JSON and validate `lang` as a required query parameter.
  - File: `packages/web/app/api/local/pages/route.ts`
  - Action: Implement `GET` returning `{ pages }` via `listPages()`.
  - Notes: Preserve the exact wrapper object because `backend.ts` expects `{ pages: PageDoc[] }`, not a bare array.
- [ ] Task 4: Restore the single-page CRUD endpoint used by Studio authoring workflows
  - File: `packages/web/app/api/local/page/route.ts`
  - Action: Implement `GET`, `PUT`, `POST`, and `DELETE` by delegating to `loadPage()`, `savePage()`, `createPage()`, and `deletePage()`.
  - Notes: `POST` must accept `{ slug, title }`; `DELETE` must return `{ pageId, lang, removedNavigationRefs }`; missing pages must remain JSON `404` instead of falling through to HTML.
- [ ] Task 5: Restore the API source endpoint because Studio bootstrap and project settings save both depend on it
  - File: `packages/web/app/api/local/api-sources/route.ts`
  - Action: Implement `GET` with `listStudioApiSources()` and `PUT` with `replaceStudioApiSources()`.
  - Notes: Return `{ sources }` and accept a request body of `{ sources: ApiSourceDoc[] }` to match the existing `backend.ts` contract.
- [ ] Task 6: Restore preview/build coordination for the web runtime without changing the current Studio UX contract
  - File: `packages/web/app/api/local/_preview-registry.ts`
  - Action: Recreate a minimal in-process registry for active preview workflow handles keyed by project identity.
  - Notes: Registry should support stop/reuse semantics across separate HTTP requests.
  - File: `packages/web/app/api/local/preview/route.ts`
  - Action: Implement `POST` to resolve the project context, run `runPreviewWorkflow()`, register the active preview, and return `{ docsPath, previewUrl }`.
  - Notes: Keep behavior aligned with CLI/core workflow usage rather than shelling out through a separate path.
  - File: `packages/web/app/api/local/build/route.ts`
  - Action: Implement `POST` to stop any active preview for the same project before invoking `runBuildWorkflow()`, then return `{ artifactRoot, languages }`.
  - Notes: Build route should not rely on stale preview state and should preserve JSON-only behavior on failure.
- [ ] Task 7: Verify restored route placement stays compatible with static docs export behavior
  - File: `packages/web/scripts/gen-public-assets.mjs`
  - Action: Confirm the existing `app/api` hide-and-restore logic still works with the restored local route tree, and adjust only if the helper/registry files need no-op handling.
  - Notes: The goal is compatibility, not an export redesign.
- [ ] Task 8: Revalidate the recovered web Studio path with the existing real-route regression suites
  - File: `packages/web/tests/e2e/studio-local-api.spec.ts`
  - Action: Keep the API suite aimed at the restored real handlers and update only if payload assertions need minor alignment with the canonical contract.
  - Notes: This suite is the first gate proving `/api/local/*` is back.
  - File: `packages/web/tests/e2e/studio.spec.ts`
  - Action: Verify the project-open smoke test remains focused on connected workspace chrome and settings availability.
  - Notes: The pass condition is that web Studio no longer stalls in `Disconnected` after project open.
  - File: `packages/web/tests/e2e/studio-authoring-flow.spec.ts`
  - Action: Re-run and stabilize the create/edit/publish/delete plus preview/build authoring flows against the restored real routes.
  - Notes: Fix only regressions directly caused by the restored local API path; do not broaden the scenario beyond current P0 coverage.

### Acceptance Criteria

- [ ] AC 1: Given the app is running in web dev mode and a valid external project path is selected, when Studio requests `GET /api/local/project`, then the route returns JSON matching `StudioProjectResponse` instead of `404` or HTML fallback content.
- [ ] AC 2: Given Studio bootstraps a selected workspace, when it requests `GET /api/local/navigation`, `GET /api/local/pages`, and `GET /api/local/api-sources`, then each route returns canonical JSON and the workspace footer remains in the connected state.
- [ ] AC 3: Given Studio requests `GET /api/local/page` for an existing page, when the page exists in the target language, then the response body contains the canonical page document expected by the current editor flow.
- [ ] AC 4: Given a user updates project settings, navigation, or a page in web Studio, when the corresponding `PUT` route completes, then the returned JSON matches the saved state and the underlying project files reflect the change.
- [ ] AC 5: Given a user creates a page through web Studio, when `POST /api/local/page` receives `{ slug, title }`, then a new draft page is created through the existing helper and returned as JSON.
- [ ] AC 6: Given a user deletes a page through web Studio, when `DELETE /api/local/page` targets an existing page, then the page file is removed, matching navigation references are cleaned up, and the response includes `pageId`, `lang`, and `removedNavigationRefs`.
- [ ] AC 7: Given repository or validation rules fail inside a local route, when the route throws a `DomainError` or `ValidationError`, then the response remains JSON with a readable `error` message rather than HTML error content.
- [ ] AC 8: Given a user triggers preview from web Studio, when `POST /api/local/preview` is called for a valid project, then it returns JSON containing a usable `docsPath` and optionally `previewUrl`.
- [ ] AC 9: Given a user triggers build from web Studio while a preview for the same project is active, when `POST /api/local/build` is called, then the route coordinates with the preview registry and returns JSON containing `artifactRoot` and language publication counts.
- [ ] AC 10: Given the restored local routes live under `packages/web/app/api/local`, when the docs export flow runs, then the existing `app/api` hide-and-restore logic still prevents Studio local routes from shipping in the static export output.
- [ ] AC 11: Given the web Studio recovery work is complete, when `pnpm --filter @anydocs/web test:api` runs, then it passes against the real local handlers.
- [ ] AC 12: Given the web Studio recovery work is complete, when the directly related P0 Studio tests run, then they no longer fail because `/api/local/*` handlers are missing or because bootstrap remains `Disconnected`.

## Additional Context

### Dependencies

- Existing filesystem helpers and authoring/build/preview services in `@anydocs/core`
- Next.js App Router local route handlers running in Node.js runtime
- Existing Studio frontend request contracts and `data-testid` hooks
- Existing broader design reference in `artifacts/bmad/implementation-artifacts/tech-spec-studio-local-api-routes.md`
- Existing export-time `app/api` hiding mechanism in `packages/web/scripts/gen-public-assets.mjs`

### Testing Strategy

- Use `pnpm --filter @anydocs/web test:api` as the first proof that the local HTTP surface is restored.
- Run `pnpm --filter @anydocs/web test:e2e:p0` after the route family is back to validate project-open, connected state, authoring, preview, and build paths.
- Treat the most relevant green bar as: API suite passes and the directly related Studio P0 failures are gone; unrelated root-level failures should be documented separately rather than conflated with this scope.
- If route payloads differ slightly from existing assertions, adjust the tests only to reflect the real canonical contract, not to weaken the regression signal.

### Notes

- The highest-value fix is restoring the missing web-local adapter layer, not introducing new domain logic.
- `api-sources` is part of the web Studio bootstrap path and cannot be deferred if the goal is “web Studio complete”.
- Preview/build coordination is the highest-risk integration area because it crosses HTTP requests and long-lived workflow handles; keep the registry minimal and explicit.
- This spec intentionally narrows scope to the user-visible web Studio recovery path so implementation can move quickly and cleanly into quick-dev.
