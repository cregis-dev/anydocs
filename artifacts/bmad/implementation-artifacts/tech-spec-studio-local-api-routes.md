---
title: 'studio-local-api-routes'
slug: 'studio-local-api-routes'
created: '2026-03-15T17:13:57Z'
status: 'implementation-complete'
stepsCompleted: [1, 2, 3, 4]
tech_stack:
  - 'Next.js App Router route handlers'
  - 'TypeScript'
  - '@anydocs/core service layer'
  - 'Playwright end-to-end tests'
files_to_modify:
  - 'packages/web/app/api/local/_shared.ts'
  - 'packages/web/app/api/local/_preview-registry.ts'
  - 'packages/web/app/api/local/project/route.ts'
  - 'packages/web/app/api/local/navigation/route.ts'
  - 'packages/web/app/api/local/pages/route.ts'
  - 'packages/web/app/api/local/page/route.ts'
  - 'packages/web/app/api/local/build/route.ts'
  - 'packages/web/app/api/local/preview/route.ts'
  - 'packages/web/components/studio/local-studio-app.tsx'
  - 'packages/web/tests/e2e/studio-authoring-flow.spec.ts'
  - 'packages/web/tests/e2e/studio.spec.ts'
  - 'packages/web/scripts/gen-public-assets.mjs'
code_patterns:
  - 'Studio UI calls /api/local/* via createLocalApiUrl() in local-studio-app.tsx'
  - 'Server-side filesystem/project operations already exist in packages/web/lib/docs/fs.ts'
  - 'Build/preview behavior must delegate to existing core workflows used by CLI'
  - 'Route handlers should stay thin and normalize request/query parsing plus JSON error responses in one shared helper'
  - 'Preview lifecycle likely needs process registration across requests because Studio only gets previewUrl/docsPath back, not a live stop handle'
test_patterns:
  - 'Playwright Studio flow tests under packages/web/tests/e2e'
  - 'HTTP-level endpoint smoke checks in packages/web/tests/e2e/studio.spec.ts'
  - 'Real project-root filesystem assertions are used in authoring flow tests'
---

# Tech-Spec: studio-local-api-routes

**Created:** 2026-03-15T17:13:57Z

## Overview

### Problem Statement

Studio currently depends on local `/api/local/*` endpoints for opening external projects, reading and writing project files, and triggering build/preview actions. The frontend and docs assume these endpoints exist, but the actual Next.js route handlers are missing in the current repository state, causing Studio to fail with `404` when opening an external project.

### Solution

Add App Router route handlers for the full local Studio API surface and have them delegate to the existing server-side helpers in `packages/web/lib/docs/fs.ts` and the same core build/preview workflows used by the CLI. Keep the API local-first, filesystem-backed, and behaviorally aligned with the current Studio client expectations.

### Scope

**In Scope:**
- Add working local route handlers for `project`, `navigation`, `pages`, `page`, `build`, and `preview`
- Support external-project path loading through the same `projectId + path` request shape already emitted by Studio
- Reuse existing docs filesystem helpers instead of duplicating repository logic
- Reuse existing build and preview workflow behavior so Studio and CLI stay consistent
- Return JSON payloads matching current Studio frontend expectations
- Add or update verification coverage for the restored local API surface

**Out of Scope:**
- Changing the Studio client request contract
- Introducing remote or production-enabled authoring APIs
- Redesigning preview architecture beyond wiring existing preview workflow into the local API surface
- Refactoring unrelated Studio UI behavior

## Context for Development

### Codebase Patterns

- `packages/web/components/studio/local-studio-app.tsx` is the canonical client contract for request URLs, methods, and response shapes.
- `packages/web/lib/docs/fs.ts` already centralizes server-only project/file operations for project config, pages, navigation, build, and preview-adjacent concerns.
- CLI behavior is already standardized through `@anydocs/core`; Studio local API should act as a thin HTTP adapter over those same capabilities.
- Documentation and tests already assume `/api/local/*` is a local-only Node.js-backed interface.
- `packages/web/app/` currently contains no `api/` directory at all, so the problem is a missing HTTP adapter layer rather than broken resource logic.
- `packages/web/scripts/gen-public-assets.mjs` explicitly hides `app/api` during export by renaming it to `app/__api_export_hidden__`, so restored local routes must live under `app/api/local/*` and remain compatible with that export-time hiding behavior.
- `packages/core/src/services/preview-service.ts` returns a live `stop()` handle, which is useful inside one process but not directly serializable over HTTP; Studio preview route needs route-local process tracking if build should be able to stop an existing preview before export.

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `packages/web/components/studio/local-studio-app.tsx` | Defines the exact Studio request/response contract the routes must satisfy |
| `packages/web/lib/docs/fs.ts` | Existing server-only helpers for project config, page, navigation, and project actions |
| `packages/core/src/fs/content-repository.ts` | Defines `loadProjectContract()` and `updateProjectConfig()` result contracts used by project route |
| `packages/core/src/fs/docs-repository.ts` | Defines delete-page result shape and navigation cleanup semantics |
| `packages/web/tests/e2e/studio-authoring-flow.spec.ts` | End-to-end Studio flow that should work once local routes are restored |
| `packages/web/tests/e2e/studio.spec.ts` | Existing endpoint smoke coverage and Studio boot checks |
| `packages/core/src/services/build-service.ts` | Canonical build workflow that CLI already uses |
| `packages/core/src/services/preview-service.ts` | Canonical preview workflow that CLI already uses |
| `packages/core/src/services/web-runtime-bridge.ts` | Preview/build child-process bridge and locking behavior |
| `packages/web/scripts/gen-public-assets.mjs` | Export path already expects `app/api` to exist and be temporarily hidden |
| `docs/04-usage-manual.md` | Product-level expectation that Studio uses `/api/local/*` for local file operations |

### Technical Decisions

- Implement the routes under `packages/web/app/api/local/*/route.ts` using App Router route handlers with `runtime = 'nodejs'`.
- Keep route handlers thin; parse request/query input, validate required parameters, delegate to `packages/web/lib/docs/fs.ts`, then normalize JSON responses.
- Introduce a small shared helper module for parsing `projectId`, `path`, `lang`, request body, and consistent error responses across all local routes.
- `build` and `preview` must delegate to the same underlying workflow path used by CLI, not a Studio-only simplified execution path.
- Align route response payloads exactly to the current `StudioProjectResponse`, `{ pages }`, `DeletePageResponse`, preview payload, and build payload expected by `LocalStudioApp`.
- Add a route-local preview registry so `POST /api/local/preview` can reuse or replace an existing preview server for the same project and `POST /api/local/build` can stop an active preview before export if necessary.
- Use validation-aware error translation so `ValidationError` failures become readable JSON messages rather than HTML/500 fallbacks in Studio.
- Preserve local-only assumptions and do not expand these routes for production usage.

## Implementation Plan

### Tasks

- [x] Task 1: Add shared local route primitives for Studio local APIs
  - File: `packages/web/app/api/local/_shared.ts`
  - Action: Add shared helpers to parse `projectId`, `path`, `lang`, and `pageId` from `NextRequest`, read JSON bodies safely, and produce consistent JSON/error responses.
  - Notes: Normalize `ValidationError` and other thrown errors to JSON `{ error }` messages so Studio never gets HTML fallback responses from local routes.
- [x] Task 2: Add project contract route for Studio bootstrap and settings persistence
  - File: `packages/web/app/api/local/project/route.ts`
  - Action: Implement `GET` to return the loaded Studio project contract and `PUT` to persist project settings through `updateStudioProjectSettings()`.
  - Notes: Response must match `StudioProjectResponse` in `local-studio-app.tsx`, including `config` and `paths.projectRoot/artifactRoot`.
- [x] Task 3: Add navigation routes for language-scoped read/write operations
  - File: `packages/web/app/api/local/navigation/route.ts`
  - Action: Implement `GET` and `PUT` using `loadNavigation()` and `saveNavigation()` from `packages/web/lib/docs/fs.ts`.
  - Notes: Validate `lang` before delegation and return the saved navigation document as JSON.
- [x] Task 4: Add page list and page CRUD routes matching current Studio client contract
  - File: `packages/web/app/api/local/pages/route.ts`
  - Action: Implement `GET` returning `{ pages }` for the selected language.
  - Notes: Keep the response shape exactly as consumed by `jsonFetch<{ pages: PageDoc[] }>()`.
- [x] Task 5: Add single-page load/save/create/delete route
  - File: `packages/web/app/api/local/page/route.ts`
  - Action: Implement `GET`, `PUT`, `POST`, and `DELETE` using `loadPage()`, `savePage()`, `createPage()`, and `deletePage()` from `packages/web/lib/docs/fs.ts`.
  - Notes: `DELETE` must return the repository delete result shape expected by `DeletePageResponse`; `POST` must accept `{ slug, title }`.
- [x] Task 6: Add in-process preview registry for Studio local runtime coordination
  - File: `packages/web/app/api/local/_preview-registry.ts`
  - Action: Add module-local tracking keyed by project root or project identity so preview route can stop/reuse existing preview servers and build route can stop active previews before export.
  - Notes: Registry should wrap `PreviewWorkflowResult` stop/wait methods and clean up exited entries.
- [x] Task 7: Add preview route backed by core preview workflow
  - File: `packages/web/app/api/local/preview/route.ts`
  - Action: Implement `POST` to resolve the external project context, stop/reuse any existing active preview for that project, run `runPreviewWorkflow()`, register the process, and return `{ docsPath, previewUrl }`.
  - Notes: Use route-local preview registry rather than inventing a new preview backend; response must satisfy current Studio button behavior.
- [x] Task 8: Add build route backed by core build workflow with preview coordination
  - File: `packages/web/app/api/local/build/route.ts`
  - Action: Implement `POST` to stop any active preview for the same project, invoke `runBuildWorkflow()`, and return `{ artifactRoot, languages }`.
  - Notes: Keep CLI-equivalent behavior by delegating directly to core build workflow, not to a shell command wrapper.
- [x] Task 9: Verify route placement remains export-safe
  - File: `packages/web/scripts/gen-public-assets.mjs`
  - Action: Confirm existing `app/api` hiding behavior still works once local route files are restored; adjust only if the new helper/registry files require additional handling.
  - Notes: Do not redesign export behavior unless a concrete route-placement issue is discovered.
- [x] Task 10: Restore regression coverage for Studio local API usage
  - File: `packages/web/tests/e2e/studio.spec.ts`
  - Action: Tighten endpoint smoke checks to assert JSON responses for the restored local routes where practical.
  - Notes: Keep the tests tolerant of fixture/project setup realities, but ensure the routes no longer fail solely because handlers are missing.
- [x] Task 11: Re-validate end-to-end Studio authoring with real local APIs
  - File: `packages/web/tests/e2e/studio-authoring-flow.spec.ts`
  - Action: Use the restored real local APIs, not route mocks, to verify open-project, page save, preview, and build flows against an external project root.
  - Notes: This is the main functional proof that Studio and CLI are aligned again.

### Acceptance Criteria

- Given Studio opens an external project by absolute path, when it requests `GET /api/local/project`, then the route returns the project config and resolved paths in the shape consumed by `LocalStudioApp`.
- Given Studio loads a language workspace, when it requests `GET /api/local/navigation`, `GET /api/local/pages`, and `GET /api/local/page`, then the routes return canonical data from the target project without 404 or HTML fallback responses.
- Given a user edits project settings, navigation, or a page in Studio, when the corresponding `PUT` request is sent, then the route persists the change through the existing filesystem helpers and returns JSON that matches the saved state.
- Given a user creates or deletes a page in Studio, when `POST /api/local/page` or `DELETE /api/local/page` is called, then the route updates the project files and returns the payload shape expected by the current Studio client.
- Given a user triggers Studio build or preview, when `POST /api/local/build` or `POST /api/local/preview` is called, then the route reuses the same core workflow behavior as CLI and returns a successful JSON response with artifact or preview metadata.
- Given the web app is running in local development, when Studio uses the restored local API routes, then the basic authoring flow no longer fails because of missing `/api/local/*` handlers.
- [ ] AC 1: Given a valid external project path and language, when Studio requests `GET /api/local/project`, then it receives JSON matching `StudioProjectResponse` with no HTML fallback or 404.
- [ ] AC 2: Given a valid external project path and language, when Studio requests `GET /api/local/navigation`, `GET /api/local/pages`, and `GET /api/local/page`, then each route returns canonical JSON sourced from the target project files.
- [ ] AC 3: Given Studio updates project settings, navigation, or page content, when the corresponding `PUT` route completes, then the persisted filesystem state and JSON response match the saved values.
- [ ] AC 4: Given Studio creates a page through `POST /api/local/page`, when the request includes `slug` and `title`, then a new draft page is created using the existing page-creation helper and returned as JSON.
- [ ] AC 5: Given Studio deletes a page through `DELETE /api/local/page`, when the page exists, then the page file is removed, navigation references are cleaned, and the route returns `pageId`, `lang`, and `removedNavigationRefs`.
- [ ] AC 6: Given project validation or save rules fail inside the local API layer, when a local route throws a `ValidationError`, then the response remains JSON and exposes a readable message to Studio instead of HTML error content.
- [ ] AC 7: Given a valid external project path, when `POST /api/local/preview` is called, then the route invokes the same core preview workflow used by CLI, registers the active preview, and returns `{ docsPath, previewUrl }`.
- [ ] AC 8: Given an active preview exists for the same project, when `POST /api/local/build` is called, then the route stops that preview before invoking the same core build workflow used by CLI and returns `{ artifactRoot, languages }`.
- [ ] AC 9: Given the restored routes exist under `packages/web/app/api/local`, when docs export runs, then the existing export process still hides `app/api` during static export and succeeds without shipping Studio local routes in the static site.
- [ ] AC 10: Given the real local API routes are restored, when the Studio authoring E2E opens an external project, edits content, runs preview, and runs build, then the flow completes using the real routes rather than Playwright route mocks.

## Additional Context

### Dependencies

- Existing `@anydocs/core` project, build, and preview services
- Existing `packages/web/lib/docs/fs.ts` server-only helper layer
- Next.js App Router route handlers running in Node.js runtime
- The `web-runtime-bridge` child-process orchestration used by build/preview
- Route-local preview process tracking to bridge preview lifecycle across HTTP requests

### Testing Strategy

- Run targeted endpoint and Studio authoring tests covering project open, page load/save, page create/delete, and build/preview triggers.
- Run at least one manual Studio open flow against a real external project to verify that the restored routes satisfy the existing frontend contract.
- Verify exported docs site still succeeds after restoring `app/api/local/*`, confirming the existing API-hiding logic still protects static export output.
- Prefer validating build/preview through the real route handlers instead of Playwright route interception so the restored HTTP adapter path is actually exercised.

### Notes

- This work is intended to restore missing HTTP adapters, not invent new domain logic.
- The fastest safe path is to centralize repetitive request parsing and keep each route focused on one resource/action family.
- Highest-risk integration area is preview/build coordination inside the Next dev process; keep the preview registry minimal and explicit.
- If build/preview latency makes the full browser-held E2E unstable, keep one direct endpoint or manual verification step in addition to Playwright coverage rather than weakening the route contract.
