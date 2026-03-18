---
stepsCompleted:
  - step-01-preflight-and-context
  - step-02-identify-targets
  - step-04-validate-and-summarize
lastStep: step-04-validate-and-summarize
lastSaved: 2026-03-15
inputDocuments:
  - /Users/shawn/workspace/code/anydocs/_bmad/tea/config.yaml
  - /Users/shawn/workspace/code/anydocs/_bmad/tea/workflows/testarch/automate/instructions.md
  - /Users/shawn/workspace/code/anydocs/_bmad/tea/workflows/testarch/automate/checklist.md
  - /Users/shawn/workspace/code/anydocs/_bmad/tea/workflows/testarch/automate/steps-c/step-01-preflight-and-context.md
  - /Users/shawn/workspace/code/anydocs/_bmad/tea/workflows/testarch/automate/steps-c/step-02-identify-targets.md
  - /Users/shawn/workspace/code/anydocs/_bmad/tea/workflows/testarch/automate/steps-c/step-04-validate-and-summarize.md
  - /Users/shawn/workspace/code/anydocs/packages/web/components/studio/local-studio-app.tsx
  - /Users/shawn/workspace/code/anydocs/packages/web/app/api/local/build/route.ts
  - /Users/shawn/workspace/code/anydocs/packages/web/app/api/local/preview/route.ts
  - /Users/shawn/workspace/code/anydocs/packages/core/src/services/build-service.ts
  - /Users/shawn/workspace/code/anydocs/packages/core/src/services/preview-service.ts
  - /Users/shawn/workspace/code/anydocs/packages/core/src/services/web-runtime-bridge.ts
  - /Users/shawn/workspace/code/anydocs/packages/web/scripts/gen-public-assets.mjs
  - /Users/shawn/workspace/code/anydocs/packages/web/tests/e2e/studio-authoring-flow.spec.ts
  - /Users/shawn/workspace/code/anydocs/packages/web/components/studio/local-studio-app.tsx
  - /Users/shawn/workspace/code/anydocs/packages/web/components/studio/local-studio-settings.tsx
  - /Users/shawn/workspace/code/anydocs/packages/web/components/studio/welcome-screen.tsx
  - /Users/shawn/workspace/docs_home/anydocs-03
  - /Users/shawn/workspace/docs_home/anydocs-04
---

# Studio runtime validation summary

## Execution mode

- Mode: Standalone frontend validation
- Framework: Next.js + Playwright MCP
- Target project: `/Users/shawn/workspace/docs_home/anydocs-03`
- Browser automation mode used: MCP

## Coverage plan by test level and priority

### E2E / P0

- Open Studio welcome screen
- Open external project by absolute path
- Load three-column editor layout
- Select pages from navigation tree
- Toggle left sidebar and right metadata panel
- Switch language from `zh` to `en`
- Edit document display title and verify autosave status returns to `All changes saved`
- Trigger `Preview`
- Trigger `Build`

### API / P0

- Observed `GET /api/local/project`
- Observed `GET /api/local/navigation`
- Observed `GET /api/local/pages`
- Observed `GET /api/local/page`
- Observed `PUT /api/local/page`
- Observed `POST /api/local/preview`
- Observed `POST /api/local/build`

### Component / P1

- Navigation tree rendering and page selection state
- Metadata panel form binding
- Footer connection/save state rendering

### Unit / P2

- Not executed in this runtime pass

## Validation result

### Passed flows

- Studio root page rendered normally.
- External project opening via prompt worked with the provided path.
- Project content, navigation tree, editor pane, and metadata pane loaded correctly.
- Sidebar and meta-panel toggles worked.
- Page selection worked.
- Language switching worked and reloaded English content.
- Metadata title edit propagated to UI and autosaved successfully.

### Failed flows

- `Preview` failed from Studio.
  - UI error: `Docs preview server failed (exit=-2, signal=null).`
  - Network: `POST /api/local/preview/` returned `500`.
- `Build` hung from Studio.
  - UI stayed in `build...`
  - Network: `POST /api/local/build/` never completed during the validation window.

## Cross-checks

- CLI preview worked for the same project:
  - `node --experimental-strip-types packages/cli/src/index.ts preview /Users/shawn/workspace/docs_home/anydocs-03`
- CLI build worked for the same project:
  - `node --experimental-strip-types packages/cli/src/index.ts build /Users/shawn/workspace/docs_home/anydocs-03`
- Direct core preview workflow also worked outside the Studio API route.
- Direct core build workflow with default bridge settings hung outside the CLI wrapper.

## Key assumptions and risks

- The content project itself is valid; failures are in the Studio API bridge path, not in project data.
- `trailingSlash: true` is forcing every local API request through `308` redirects. This is noisy but not the primary blocker.
- Highest-confidence root cause for Studio `Build` hang:
  - `packages/core/src/services/web-runtime-bridge.ts` creates the export child with `stdio: 'pipe'`
  - `exportDocsSite()` reads `stderr` only and never drains `stdout`
  - `packages/web/scripts/gen-public-assets.mjs` runs `next build`, which writes substantial stdout
  - the child process can block once stdout pipe buffers fill, leaving `/api/local/build/` hanging
- Likely related risk for Studio `Preview` failure:
  - the Studio API route launches the preview bridge inside the existing Next dev server process
  - this path behaves differently from the CLI path and exits early for this project/environment
  - the bridge/proxy path needs dedicated instrumentation or tests to isolate why the nested preview launch fails while CLI preview succeeds

## Files created/updated

- Created: `/Users/shawn/workspace/code/anydocs/docs/test-artifacts/automation-summary.md`
- No repository source files were modified.

## Recommended next workflow

- Fix and retest `web-runtime-bridge` child-process handling first.
- After that, run:
  - `test-review` to lock findings into regression expectations
  - a focused Playwright E2E around Studio `Build` and `Preview`

# External project workflow validation

## Execution mode

- Mode: Standalone frontend automation
- Framework: Next.js Studio + Playwright
- Target project: `/Users/shawn/workspace/docs_home/anydocs-04`
- Browser automation mode used: Playwright test runner

## Coverage plan by test level and priority

### E2E / P0

- CLI init for the external project root
- Open the project from Studio welcome screen using the absolute path prompt
- Create a new page in Studio and publish it
- Edit page title, description, slug, and Yoopta body content
- Trigger Studio preview and verify the published route is served

### CLI workflow / P0

- Run CLI build against the edited project root
- Start CLI preview against the edited project root
- Verify generated `llms.txt` and `mcp/pages.en.json` include the edited page

### Studio workflow / P1

- Trigger Studio build and observe request lifecycle
- Attempt navigation editing via new group creation

## Validation result

### Passed flows

- `node --experimental-strip-types packages/cli/src/index.ts init /Users/shawn/workspace/docs_home/anydocs-04`
  created a valid project.
- Studio could open the external project, create a new page, autosave metadata/content, and persist the page JSON.
- Studio preview returned `200` and served the newly published page on the preview server.
- Direct CLI build succeeded after Studio edits:
  - project: `default`
  - route: `/en/welcome`
  - summary: `en: 8 pages, 7 published, 2 nav items`
- Direct CLI preview started successfully and served the edited documentation project.
- Generated artifacts contain the edited page in machine-readable outputs:
  - `/Users/shawn/workspace/docs_home/anydocs-04/dist/llms.txt`
  - `/Users/shawn/workspace/docs_home/anydocs-04/dist/mcp/pages.en.json`
  - `/Users/shawn/workspace/docs_home/anydocs-04/dist/en/api/authentication-mmqo02je/index.html`

### Failed or degraded flows

- Studio navigation edits were not persisted during the mixed authoring flow.
  - Evidence: no `PUT /api/local/navigation` request was emitted while creating a new group.
  - Evidence: `/Users/shawn/workspace/docs_home/anydocs-04/navigation/en.json` remained unchanged.
- Studio build is operational but too slow for a practical P0 browser regression.
  - Observed durations on `/api/local/build`:
    - ~61s
    - ~120s
    - ~180s
    - ~300s
  - The Playwright end-to-end flow timed out waiting for this request to complete, even though the server eventually returned `200`.

## Files created or updated

- Created: `/Users/shawn/workspace/code/anydocs/packages/web/tests/e2e/studio-authoring-flow.spec.ts`
- Updated: `/Users/shawn/workspace/code/anydocs/packages/web/tests/e2e/studio.spec.ts`
- Updated: `/Users/shawn/workspace/code/anydocs/packages/web/components/studio/welcome-screen.tsx`
- Updated: `/Users/shawn/workspace/code/anydocs/packages/web/components/studio/local-studio-app.tsx`
- Updated: `/Users/shawn/workspace/code/anydocs/packages/web/components/studio/local-studio-settings.tsx`

## Key assumptions and risks

- The new page/content path is valid end-to-end because Studio persisted the page JSON and CLI build consumed it into `llms.txt`, `mcp/pages.en.json`, and exported HTML.
- Navigation state and page state currently have a race in Studio authoring flows; page saves/reloads can complete without a corresponding navigation save.
- Studio build should not be used as a short-running browser regression gate in its current form; the CLI build path is the reliable validation path today.

## Recommended next workflow

- Investigate Studio navigation persistence around `navDirty` + page-save reload interactions.
- Add a targeted regression for navigation autosave once that race is fixed.
- Treat Studio build latency as a separate performance/reliability issue and either:
  - optimize the `web-runtime-bridge` export path, or
  - validate build correctness through CLI integration tests instead of a browser-held request.

## Follow-up remediation and rerun

- Implemented a navigation/page autosave fix in `LocalStudioApp`:
  - page saves no longer trigger a full `reload()` that overwrites unsaved navigation state
  - autosave now debounces on change ticks instead of only the first `dirty=true` transition, preventing partial Yoopta content writes
- Implemented a Studio build/preview coordination fix:
  - `packages/web/app/__api_export_hidden__/local/build/route.ts` now stops any active preview for the same project before invoking `runBuildWorkflow`
  - `packages/web/app/__api_export_hidden__/local/_preview-registry.ts` now exposes `stopActivePreview()`
- Added a Playwright config switch so the E2E can reuse an already running Studio dev server:
  - `STUDIO_SKIP_WEBSERVER=1`

### Final rerun result

- Final command:
  - `STUDIO_SKIP_WEBSERVER=1 ANYDOCS_E2E_PROJECT_ROOT=/Users/shawn/workspace/docs_home/anydocs-04 npx playwright test tests/e2e/studio-authoring-flow.spec.ts`
- Result:
  - `1 passed (3.9m)`
- Observed Studio workflow timings after fixes:
  - preview: about `4.4s`
  - build: about `51s`
- Verified latest generated artifacts include the new published page:
  - `/Users/shawn/workspace/docs_home/anydocs-04/dist/llms.txt`
  - `/Users/shawn/workspace/docs_home/anydocs-04/dist/mcp/pages.en.json`
  - `/Users/shawn/workspace/docs_home/anydocs-04/dist/search-index.en.json`

### Residual note

- One historical page entry (`Authentication API mmr97gd1`) appears in `llms.txt` without a description suffix, while newer pages include it. The latest rerun pages (`mmr9frk1`, `mmr9lmks`) were generated correctly.
