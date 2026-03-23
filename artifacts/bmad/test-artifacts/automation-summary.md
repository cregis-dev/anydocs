---
stepsCompleted:
  - step-01-preflight-and-context
  - step-02-identify-targets
  - step-03-generate-tests
  - step-04-validate-and-summarize
lastStep: step-04-validate-and-summarize
lastSaved: 2026-03-22
inputDocuments:
  - /Users/shawn/workspace/code/anydocs/_bmad/tea/config.yaml
  - /Users/shawn/workspace/code/anydocs/_bmad/tea/workflows/testarch/automate/instructions.md
  - /Users/shawn/workspace/code/anydocs/_bmad/tea/workflows/testarch/automate/checklist.md
  - /Users/shawn/workspace/code/anydocs/_bmad/tea/workflows/testarch/automate/steps-c/step-01-preflight-and-context.md
  - /Users/shawn/workspace/code/anydocs/_bmad/tea/workflows/testarch/automate/steps-c/step-02-identify-targets.md
  - /Users/shawn/workspace/code/anydocs/package.json
  - /Users/shawn/workspace/code/anydocs/packages/web/package.json
  - /Users/shawn/workspace/code/anydocs/packages/core/package.json
  - /Users/shawn/workspace/code/anydocs/packages/cli/package.json
  - /Users/shawn/workspace/code/anydocs/packages/mcp/package.json
  - /Users/shawn/workspace/code/anydocs/packages/web/playwright.config.ts
  - /Users/shawn/workspace/code/anydocs/artifacts/bmad/planning-artifacts/prd.md
  - /Users/shawn/workspace/code/anydocs/artifacts/bmad/planning-artifacts/architecture.md
  - /Users/shawn/workspace/code/anydocs/_bmad/tea/testarch/tea-index.csv
  - /Users/shawn/workspace/code/anydocs/_bmad/tea/testarch/knowledge/test-levels-framework.md
  - /Users/shawn/workspace/code/anydocs/_bmad/tea/testarch/knowledge/test-priorities-matrix.md
  - /Users/shawn/workspace/code/anydocs/_bmad/tea/testarch/knowledge/data-factories.md
  - /Users/shawn/workspace/code/anydocs/_bmad/tea/testarch/knowledge/selective-testing.md
  - /Users/shawn/workspace/code/anydocs/_bmad/tea/testarch/knowledge/ci-burn-in.md
  - /Users/shawn/workspace/code/anydocs/_bmad/tea/testarch/knowledge/test-quality.md
  - /Users/shawn/workspace/code/anydocs/_bmad/tea/testarch/knowledge/overview.md
  - /Users/shawn/workspace/code/anydocs/_bmad/tea/testarch/knowledge/api-request.md
  - /Users/shawn/workspace/code/anydocs/_bmad/tea/testarch/knowledge/network-recorder.md
  - /Users/shawn/workspace/code/anydocs/_bmad/tea/testarch/knowledge/auth-session.md
  - /Users/shawn/workspace/code/anydocs/_bmad/tea/testarch/knowledge/intercept-network-call.md
  - /Users/shawn/workspace/code/anydocs/_bmad/tea/testarch/knowledge/recurse.md
  - /Users/shawn/workspace/code/anydocs/_bmad/tea/testarch/knowledge/log.md
  - /Users/shawn/workspace/code/anydocs/_bmad/tea/testarch/knowledge/file-utils.md
  - /Users/shawn/workspace/code/anydocs/_bmad/tea/testarch/knowledge/burn-in.md
  - /Users/shawn/workspace/code/anydocs/_bmad/tea/testarch/knowledge/network-error-monitor.md
  - /Users/shawn/workspace/code/anydocs/_bmad/tea/testarch/knowledge/fixtures-composition.md
  - /Users/shawn/workspace/code/anydocs/_bmad/tea/testarch/knowledge/pactjs-utils-overview.md
  - /Users/shawn/workspace/code/anydocs/_bmad/tea/testarch/knowledge/pactjs-utils-consumer-helpers.md
  - /Users/shawn/workspace/code/anydocs/_bmad/tea/testarch/knowledge/pactjs-utils-provider-verifier.md
  - /Users/shawn/workspace/code/anydocs/_bmad/tea/testarch/knowledge/pactjs-utils-request-filter.md
  - /Users/shawn/workspace/code/anydocs/_bmad/tea/testarch/knowledge/pact-mcp.md
  - /Users/shawn/workspace/code/anydocs/_bmad/tea/testarch/knowledge/playwright-cli.md
  - /Users/shawn/workspace/code/anydocs/packages/web/tests/e2e/studio-authoring-flow.spec.ts
  - /Users/shawn/workspace/code/anydocs/packages/web/tests/e2e/studio.spec.ts
  - /Users/shawn/workspace/code/anydocs/packages/web/tests/e2e/utils.ts
  - /Users/shawn/workspace/code/anydocs/packages/web/components/studio/local-studio-app.tsx
  - /Users/shawn/workspace/code/anydocs/packages/web/components/studio/backend.ts
  - /Users/shawn/workspace/code/anydocs/packages/core/src/services/authoring-service.ts
  - /Users/shawn/workspace/code/anydocs/packages/core/src/services/build-service.ts
  - /Users/shawn/workspace/code/anydocs/packages/core/src/services/preview-service.ts
  - /Users/shawn/workspace/code/anydocs/packages/core/src/publishing/build-artifacts.ts
  - /Users/shawn/workspace/code/anydocs/packages/core/src/fs/content-repository.ts
  - /Users/shawn/workspace/code/anydocs/.playwright-cli/page-2026-03-22T16-09-45-837Z.yml
---

# Repository-wide automation framework rollout

## Step 1: Preflight and context

### Execution mode

- Mode: BMad-integrated repository-wide automation expansion
- Detected stack: fullstack TypeScript monorepo
- Coverage target: critical-paths
- Browser automation mode: auto

### Framework readiness

- Framework scaffolding present:
  - browser test runner in `/Users/shawn/workspace/code/anydocs/packages/web/playwright.config.ts`
  - package-level automated tests in `packages/core/tests`, `packages/cli/tests`, `packages/mcp/tests`, and `packages/web/tests`
- Package manifests confirm runnable test surfaces:
  - `@anydocs/web` uses Playwright
  - `@anydocs/core`, `@anydocs/cli`, and `@anydocs/mcp` use `node --test`

### Existing test structure

- Current coverage is uneven:
  - strong service and contract coverage in `packages/core/tests`
  - CLI command coverage in `packages/cli/tests`
  - MCP integration coverage in `packages/mcp/tests`
  - limited browser regression coverage in `packages/web/tests/e2e`
- There is no shared top-level test support layer, no repo-wide priority-based execution model, and no unified regression gate for delivery acceptance.

### Artifact and requirement context

- Planning artifacts found and loaded:
  - PRD: `artifacts/bmad/planning-artifacts/prd.md`
  - Architecture: `artifacts/bmad/planning-artifacts/architecture.md`
- No dedicated test-design artifact was found for this repository-wide pass.

### Knowledge fragments loaded

- Core guidance:
  - `test-levels-framework.md`
  - `test-priorities-matrix.md`
  - `data-factories.md`
  - `selective-testing.md`
  - `ci-burn-in.md`
  - `test-quality.md`
- Playwright utils guidance:
  - `overview.md`
  - `api-request.md`
  - `network-recorder.md`
  - `auth-session.md`
  - `intercept-network-call.md`
  - `recurse.md`
  - `log.md`
  - `file-utils.md`
  - `burn-in.md`
  - `network-error-monitor.md`
  - `fixtures-composition.md`
- Pact and agent-assist guidance:
  - `pactjs-utils-overview.md`
  - `pactjs-utils-consumer-helpers.md`
  - `pactjs-utils-provider-verifier.md`
  - `pactjs-utils-request-filter.md`
  - `pact-mcp.md`
  - `playwright-cli.md`

### Step 1 conclusion

- Framework prerequisites are satisfied, so the automation workflow can proceed.
- The main need is not basic framework initialization but a repository-wide test architecture upgrade:
  - unify support utilities
  - expand critical-path browser coverage
  - formalize selective execution and regression commands
  - keep duplicate coverage low by testing each behavior at the cheapest reliable level

## Step 2: Coverage plan and target selection

### Browser exploration result

- `playwright-cli` is installed and usable for local exploration.
- Snapshot of `http://127.0.0.1:3000/studio` confirmed the real entry-point state:
  - heading: `DocEditor Studio`
  - helper text: `选择外部文档项目根目录后开始编辑`
  - button: `Open External Project`
- This confirms the welcome-screen entry path is part of the critical user journey and should stay in the P0 suite.

### Execution mode

- Mode selected for generation: sequential
- Requested mode from config: `auto`
- Capability probe: enabled
- Reason for fallback:
  - this run is not authorized to launch subagents from the current conversation context
  - generation will therefore follow the same output contract sequentially

### Selected automation targets

#### API / integration targets

- Studio local authoring API contract
  - `/api/local/project`
  - `/api/local/pages`
  - `/api/local/page`
  - `/api/local/navigation`
  - `/api/local/preview`
  - `/api/local/build`
- Build and preview service entry points
  - `runBuildWorkflow()`
  - `runPreviewWorkflow()`
- Publication artifact generation
  - search indexes
  - `llms.txt`
  - `llms-full.txt`
  - `mcp/*.json`
  - `build-manifest.json`

#### E2E targets

- Studio welcome-screen to project-open flow
- Studio authoring flow for create/edit/publish/delete
- Studio workflow actions for preview and build
- Reader-side verification of generated published pages and machine-readable outputs

#### Backend targets

- Authoring service mutation invariants:
  - page lifecycle and publication approval behavior
  - navigation persistence and page-reference cleanup
  - project contract and language configuration validation
- Content repository atomicity and project contract integrity

### Test level selection

- E2E
  - use only for repository acceptance flows that cross Studio UI, local APIs, CLI-backed preview/build, and generated reader output
- API / integration
  - use for local API contracts and workflow orchestration behavior where browser coverage would be slower and more brittle
- Backend
  - use for pure service and repository invariants already expressed in `node:test` package suites
- Component
  - not introduced in this pass; current repository does not have a component-test runner and the highest-value gaps are elsewhere
- Unit
  - keep existing lightweight unit-style tests in package suites; only add new ones where helper logic becomes shared infrastructure

### Priority assignments

- P0
  - open external project from Studio welcome screen
  - create, edit, publish, and delete a page through Studio
  - run preview/build and verify the generated published outputs are usable
  - local API endpoints return stable JSON for project/page/navigation/build/preview workflows
  - publication boundary remains published-only in generated artifacts
- P1
  - project settings persistence and language switching
  - navigation persistence around page mutations
  - reader-route smoke coverage for canonical language/slug flows
- P2
  - utility-level regression around shared E2E helpers and command wrappers
- P3
  - none selected in this pass

### Coverage scope justification

- Scope: selective critical-path expansion
- Rationale:
  - `packages/core`, `packages/cli`, and `packages/mcp` already have substantial package-level coverage
  - the biggest delivery risk is cross-surface regression, not absence of low-level tests
  - new tests should close gaps around real user journeys, generated artifacts, and repo-wide execution ergonomics without duplicating existing service assertions

## Step 3: Generated framework assets

### Shared support layer

- Added `packages/web/tests/e2e/support/studio.ts`
  - centralizes repo root, project root, CLI bootstrapping, URL construction, test-data factories, dialog helpers, and save-state synchronization
  - normalizes local Studio base URLs to `http://127.0.0.1:3000` to avoid IPv6 drift during local request-based testing

### Browser and API suites

- Updated `packages/web/tests/e2e/studio.spec.ts`
  - P0 smoke coverage for Studio welcome shell and external-project entry
  - P0 workspace-chrome verification after opening a project
  - P1 optional reader-preview smoke path via `DOCS_PREVIEW_URL`
- Updated `packages/web/tests/e2e/studio-authoring-flow.spec.ts`
  - uses shared support helpers instead of inline setup duplication
  - covers create/edit/publish/build and delete flows as serial acceptance journeys
- Added `packages/web/tests/e2e/studio-local-api.spec.ts`
  - P0 local API contract checks for project/pages/page/navigation/api-sources/build/preview
  - P1 structured 404 handling for missing pages

### Backend regression additions

- Added `packages/core/tests/api-source-repository.test.ts`
  - validates canonical API source persistence, sorting/filtering, deletion, and invalid-document rejection

### Execution ergonomics

- Updated `packages/web/playwright.config.ts`
  - standardized default base URL and web-server URL to `http://127.0.0.1:3000`
- Updated `packages/web/package.json`
  - added `test:e2e`, `test:e2e:p0`, `test:e2e:p1`, and `test:api`
- Updated root `package.json`
  - added `test:e2e`, `test:e2e:p0`, and `test:acceptance`
- Updated `packages/web/tests/e2e/README.md`
  - documents prerequisites, priority tags, reusable server mode, and repo-standard commands

## Step 4: Validation and current gate status

### Validation runs

- Passed
  - `pnpm --filter @anydocs/core exec node --test tests/api-source-repository.test.ts`
- Failed with product regressions
  - `pnpm test`
  - `pnpm --filter @anydocs/web test:api`
  - `pnpm --filter @anydocs/web test:e2e:p0`

### Observed results

- Green
  - Studio welcome-screen smoke check passes
- Red
  - root package test gate currently has three existing failures:
    - `build-preview-service.test.ts` expects no `llms-openapi.txt`, but build output now emits that artifact
    - `runPreviewWorkflow` cannot bind to `127.0.0.1` in the current execution environment
    - `workflow-standard-service.test.ts` can deadlock on `packages/web/.next/lock` when another Next build is active
  - `/api/local/project` returns `404` instead of `200`
  - Studio project-open flow reaches workspace chrome but connection state remains `Disconnected`
  - downstream authoring settings flow fails because project-backed settings data never becomes available

### Interpreted root cause

- The new regression framework is functioning as intended: it exposes a real delivery blocker in the current workspace.
- Source inspection shows the repository no longer contains checked-in local API route handlers under `packages/web/app/api/local/*`, while the Studio client still fetches those endpoints.
- A stale `.next/dev/server/app/api/local/*` output exists from a previous compile, which explains why the application shape can still partially render while the current source tree is missing the server implementation.

### Gate recommendation

- Treat the repository as not yet acceptance-ready until the Studio local API surface is restored or replaced.
- Use the new gate in two layers:
  - fast backend confidence: `pnpm test`
  - delivery acceptance: `pnpm test:acceptance`
