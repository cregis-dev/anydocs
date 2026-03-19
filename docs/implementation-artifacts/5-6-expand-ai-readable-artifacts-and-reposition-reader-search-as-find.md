# Story 5.6: Expand AI-Readable Artifacts and Reposition Reader Search as Find

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a documentation maintainer,
I want Anydocs to emit richer AI-readable published artifacts while keeping reader search focused on Find,
so that external agents can consume grounded published content and human readers can still discover pages quickly without implying in-product AI Ask behavior.

## Acceptance Criteria

1. Given a docs project with published pages, when `anydocs build <targetDir>` completes, then the build output contains `llms.txt`, `llms-full.txt`, `mcp/index.json`, `mcp/pages.<lang>.json`, `mcp/navigation.<lang>.json`, `mcp/chunks.<lang>.json`, and `search-index.<lang>.json`.
2. Given the generated `llms-full.txt`, when an external agent reads it without opening the reader HTML, then it can determine each page’s language, URL, title, and readable body content from explicit page boundaries.
3. Given the generated `mcp/index.json`, when an external agent discovers available machine-readable files, then it can locate the per-language chunk artifact through a stable `files.chunks` entry.
4. Given a published page with multiple sections, when chunk artifacts are generated, then `mcp/chunks.<lang>.json` contains one or more stable, page-scoped chunks with `headingPath`, `href`, `text`, and ordering metadata.
5. Given a page with no headings, when chunk artifacts are generated, then that page still produces at least one chunk entry.
6. Given unpublished pages exist, when AI-readable artifacts and search artifacts are generated, then unpublished pages do not appear in `llms.txt`, `llms-full.txt`, `mcp/*.json`, or `search-index.<lang>.json`.
7. Given the reader search UI is used by a human reader, when they search the docs, then the UI continues to behave as a page-finding tool and does not imply in-product AI answering behavior.

## Tasks / Subtasks

- [x] Extend published build outputs with a full-site fallback text artifact (AC: 1, 2, 6)
  - [x] Add `llms-full.txt` generation in `packages/core/src/publishing/build-artifacts.ts`.
  - [x] Ensure the output is grouped by language and page, with explicit page metadata boundaries.
  - [x] Reuse the canonical published-only content set instead of introducing a second filtering path.
- [x] Add chunk-level machine-readable content artifacts for external agents (AC: 1, 3, 4, 5, 6)
  - [x] Generate `mcp/chunks.<lang>.json` from published page render output in `packages/core/src/publishing/build-artifacts.ts`.
  - [x] Use a deterministic page-scoped chunking strategy that preserves `pageId`, `href`, `headingPath`, `order`, and plain-text chunk content.
  - [x] Guarantee at least one chunk for pages that do not contain headings.
- [x] Extend machine-readable discovery metadata to advertise chunk files (AC: 1, 3)
  - [x] Update `mcp/index.json` generation so each language exposes `files.chunks`.
  - [x] Extend workflow-standard artifact typing and registration in `packages/core/src/types/workflow-standard.ts` and `packages/core/src/services/workflow-standard-service.ts` so downstream tooling can discover the new artifact family.
- [x] Keep reader search aligned with its Find-only product role (AC: 7)
  - [x] Review `packages/web/components/docs/search-panel.tsx` and adjust UI copy or result presentation so the search panel reads as page discovery rather than answer generation.
  - [x] Preserve the current static-reader search model and avoid introducing in-product AI Ask behavior.
- [x] Add automated coverage for the expanded artifact contract (AC: 1, 2, 3, 4, 5, 6)
  - [x] Extend `packages/core/tests/build-preview-service.test.ts` to verify `llms-full.txt`, `mcp/chunks.<lang>.json`, updated `mcp/index.json`, and continued published-only behavior.
  - [x] Keep existing `llms.txt`, search-index, and machine-readable artifact assertions intact where still valid.
- [x] Update docs for the new AI-readable artifact model and search positioning (AC: 1, 7)
  - [x] Update `docs/04-usage-manual.md` to explain the difference between reader search assets and AI-readable artifacts.
  - [x] Update `docs/05-dev-guide.md` with verification guidance and recommended external-agent consumption order.

## Implementation Checklist

### Phase 1: Lock the artifact contract

- [x] Confirm the new generated artifact inventory is exactly:
  - `llms.txt`
  - `llms-full.txt`
  - `search-index.<lang>.json`
  - `mcp/index.json`
  - `mcp/pages.<lang>.json`
  - `mcp/navigation.<lang>.json`
  - `mcp/chunks.<lang>.json`
- [x] Update `packages/core/src/types/workflow-standard.ts` so workflow-standard supports a chunk artifact identifier.
- [x] Update `packages/core/src/services/workflow-standard-service.ts` so generated artifact registration includes the new chunk file path contract.
- [x] Decide and document the final `mcp/index.json -> languages[].files.chunks` relative path shape before implementing generation.

### Phase 2: Add full-site AI fallback output

- [x] Add a dedicated helper in `packages/core/src/publishing/build-artifacts.ts` to build `llms-full.txt`.
- [x] Reuse the same published-page collection already used for `llms.txt`, search, and MCP outputs.
- [x] Ensure `llms-full.txt` includes per-language sections and per-page metadata boundaries:
  - page id
  - URL
  - title
  - breadcrumbs
  - tags
  - updatedAt
- [x] Ensure body content uses plain-text render output and never serializes editor JSON.
- [x] Write `llms-full.txt` at the output root next to `llms.txt`.

### Phase 3: Add chunk artifacts

- [x] Add deterministic chunk-generation helpers in `packages/core/src/publishing/build-artifacts.ts`.
- [x] Start with a heading-aware heuristic if possible; otherwise fall back to page-scoped text chunking that still preserves stable order and boundaries.
- [x] Ensure each chunk contains:
  - `id`
  - `pageId`
  - `lang`
  - `slug`
  - `href`
  - `title`
  - `description`
  - `headingPath`
  - `breadcrumbs`
  - `order`
  - `tags`
  - `updatedAt`
  - `text`
  - `summary` if cheaply derivable, otherwise omit
  - `tokenEstimate`
- [x] Guarantee at least one chunk for pages with no headings.
- [x] Keep chunk ids stable for unchanged page structure.
- [x] Emit one `mcp/chunks.<lang>.json` file per enabled language.

### Phase 4: Extend machine-readable discovery

- [x] Update `mcp/index.json` generation in `packages/core/src/publishing/build-artifacts.ts` so each language advertises `files.chunks`.
- [x] Preserve existing `files.searchIndex`, `files.navigation`, and `files.pages` entries unchanged.
- [x] Verify the new discovery metadata still matches the output-root-relative conventions already used elsewhere.

### Phase 5: Keep search clearly in Find mode

- [x] Review `packages/web/components/docs/search-panel.tsx` copy and result rendering.
- [x] Remove or avoid any wording that implies answer generation, AI Ask, or semantic explanation.
- [x] Keep result presentation biased toward navigation:
  - page title
  - breadcrumb path
  - direct link target
- [x] Avoid introducing a new runtime dependency or a new retrieval pipeline in the reader UI.

### Phase 6: Add regression coverage

- [x] Extend `packages/core/tests/build-preview-service.test.ts` to assert `llms-full.txt` exists and contains page metadata boundaries.
- [x] Assert `mcp/chunks.<lang>.json` exists and includes at least one chunk for a standard published page.
- [x] Add a fixture or test case covering a published page with no headings and verify the single-chunk fallback behavior.
- [x] Extend `mcp/index.json` assertions so `files.chunks` is required for each generated language.
- [x] Preserve existing assertions proving unpublished content stays excluded from search and AI-readable artifacts.

### Phase 7: Update docs and verification workflow

- [x] Update `docs/04-usage-manual.md` so end users understand:
  - search is for finding docs
  - AI-readable outputs are for external agents
- [x] Update `docs/05-dev-guide.md` with example verification commands for:
  - `dist/llms-full.txt`
  - `dist/mcp/index.json`
  - `dist/mcp/chunks.<lang>.json`
- [x] Document the recommended external-agent read order:
  - `llms.txt` or `mcp/index.json`
  - `pages.<lang>.json`
  - `navigation.<lang>.json`
  - `chunks.<lang>.json`
  - `llms-full.txt` as fallback

### Final Ready-to-Merge Check

- [x] `anydocs build` emits all required files for a fixture project.
- [x] All new outputs remain `published-only`.
- [ ] Existing reader search still works after artifact changes.
- [x] No existing MCP or `llms.txt` consumers are broken by path or schema drift.
- [x] Story file, tech spec, and implementation behavior all describe the same artifact contract.

## Dev Notes

This story is the first follow-up after Epic 5 was previously marked complete. It is not a bugfix against Story 5.4; it is a scope expansion that refines the AI-readable artifact contract and narrows the product role of reader search.

### Developer Context

**Business objective**
- Keep Anydocs AI-first without shipping an in-product AI Ask surface.
- Make the static build output more useful for external agents by adding chunk-level and full-site artifacts.
- Keep human-facing search available, but clearly scoped to Find rather than Ask.

**Current baseline**
- `packages/core/src/publishing/build-artifacts.ts` already emits `llms.txt`, `search-index.<lang>.json`, `mcp/index.json`, `mcp/pages.<lang>.json`, and `mcp/navigation.<lang>.json`.
- `packages/web/components/docs/search-panel.tsx` consumes `search-index.<lang>.json` through browser-side MiniSearch.
- `docs/implementation-artifacts/tech-spec-ai-readable-artifacts-and-find-search.md` now defines the desired artifact contract, chunk schema, and search positioning.
- `sprint-status.yaml` currently marks Epic 5 and Story 5.4 as done, so this work must be tracked as a new story rather than silently broadening a completed one.

**Current gap**
- There is no `llms-full.txt` artifact for coarse full-site reading.
- There is no chunk-level machine-readable artifact for grounded external-agent retrieval.
- `mcp/index.json` cannot currently advertise chunk files because they do not exist.
- Reader search still over-signals body search despite the intended product direction being Find rather than Ask.

**Scope guardrails**
- Do not build in-product AI Ask or agent chat UI.
- Do not add hosted vector infrastructure, embeddings, or a retrieval API server.
- Do not replace the existing `llms.txt` or MCP outputs with a single monolithic artifact.
- Do not let theme-specific behavior leak into AI-readable content artifacts.

### Technical Requirements

- All AI-readable artifacts must remain derived from the same canonical published-only content set used by the reader-facing site.
- `llms-full.txt` must be readable without access to HTML routes and must include explicit page boundaries with stable URLs.
- `mcp/chunks.<lang>.json` must be deterministic, page-scoped, and composed from plain-text content rather than editor JSON.
- Chunk generation must produce stable identifiers when page content order and section boundaries do not change.
- `mcp/index.json` must remain backward-compatible while adding `files.chunks`.
- Reader search must remain a static, build-time-generated feature and should not imply answer synthesis or AI chat.

### Architecture Compliance

- Preserve the single publication filter path for site output, search output, and AI-facing output. [Source: docs/planning-artifacts/architecture.md]
- Generated machine-readable artifacts must be derived from the canonical shared domain model and remain build outputs rather than hand-edited files. [Source: docs/planning-artifacts/architecture.md]
- Search remains build-time generated in Phase 1 and should stay lightweight and browser-executed. [Source: docs/planning-artifacts/architecture.md]
- External AI tools are expected to interact through generated published artifacts rather than product-internal UI state. [Source: docs/planning-artifacts/architecture.md]

### File Structure Requirements

- Primary implementation files:
  - `packages/core/src/publishing/build-artifacts.ts`
  - `packages/core/src/services/workflow-standard-service.ts`
  - `packages/core/src/types/workflow-standard.ts`
  - `packages/web/components/docs/search-panel.tsx`
  - `packages/core/tests/build-preview-service.test.ts`
  - `docs/04-usage-manual.md`
  - `docs/05-dev-guide.md`
- Reference specification:
  - `docs/implementation-artifacts/tech-spec-ai-readable-artifacts-and-find-search.md`
- Do not move this logic into `packages/web` except for the reader-facing search copy or presentation changes.

### Testing Requirements

- Extend `packages/core/tests/build-preview-service.test.ts` to cover:
  - generation of `llms-full.txt`
  - generation of `mcp/chunks.<lang>.json`
  - `mcp/index.json` discovery entries for chunk files
  - continued published-only filtering across all artifact families
  - page-with-no-heading fallback chunk generation
- Keep regression coverage for existing `llms.txt`, search-index, and MCP outputs where still relevant.
- If search-panel UX copy changes, verify it through focused component or reader-path assertions only if the repo already has a suitable test seam; do not introduce large new frontend test infrastructure for this story alone.

### Project Structure Notes

- This story sits under Epic 5 because its primary value is richer AI-friendly and machine-readable published output for external agents.
- The search-related change is positioning and contract cleanup, not a new search system.
- The tech spec for this story has already been created and should be treated as the implementation contract for dev work.

### Project Context Reference

- No `project-context.md` file was found in this repository.
- Use these planning and implementation artifacts as the source of truth for this story:
  - `docs/planning-artifacts/epics.md`
  - `docs/planning-artifacts/prd.md`
  - `docs/planning-artifacts/architecture.md`
  - `docs/implementation-artifacts/tech-spec-ai-readable-artifacts-and-find-search.md`

### References

- [`epics.md`](/Users/shawn/workspace/code/anydocs/docs/planning-artifacts/epics.md) - Epic 5, Stories 5.4 and 5.5 context
- [`prd.md`](/Users/shawn/workspace/code/anydocs/docs/planning-artifacts/prd.md) - FR40, FR43, FR44, FR45
- [`architecture.md`](/Users/shawn/workspace/code/anydocs/docs/planning-artifacts/architecture.md) - publication filtering, search indexing, and AI-facing artifact rules
- [`tech-spec-ai-readable-artifacts-and-find-search.md`](/Users/shawn/workspace/code/anydocs/docs/implementation-artifacts/tech-spec-ai-readable-artifacts-and-find-search.md)
- [`build-artifacts.ts`](/Users/shawn/workspace/code/anydocs/packages/core/src/publishing/build-artifacts.ts)
- [`workflow-standard-service.ts`](/Users/shawn/workspace/code/anydocs/packages/core/src/services/workflow-standard-service.ts)
- [`workflow-standard.ts`](/Users/shawn/workspace/code/anydocs/packages/core/src/types/workflow-standard.ts)
- [`search-panel.tsx`](/Users/shawn/workspace/code/anydocs/packages/web/components/docs/search-panel.tsx)
- [`build-preview-service.test.ts`](/Users/shawn/workspace/code/anydocs/packages/core/tests/build-preview-service.test.ts)

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- 2026-03-19: Story created from the approved tech spec `tech-spec-ai-readable-artifacts-and-find-search.md`.
- 2026-03-19: This work was intentionally tracked as a new story because the prior search and machine-readable-artifact stories are already marked done in sprint status.
- 2026-03-19: Implemented `llms-full.txt`, `mcp/chunks.<lang>.json`, workflow-standard artifact registration updates, reader search copy tightening, and docs/test updates.
- 2026-03-19: Verified `@anydocs/core` typecheck plus targeted build and workflow-standard tests; full `@anydocs/core` suite still has pre-existing environment constraints around Next build lock contention and preview socket permissions.

### Completion Notes List

- Added `llms-full.txt` generation with explicit language and page boundaries so external agents can read published content without opening HTML routes.
- Added heading-aware `mcp/chunks.<lang>.json` output with deterministic page-scoped chunk ids, chunk ordering, fallback chunk generation for pages without headings, and published-only filtering shared with existing outputs.
- Extended `mcp/index.json` and workflow-standard metadata so downstream automation can discover the new chunk artifacts and full-text fallback export.
- Tightened reader search copy to emphasize page finding rather than answer generation while keeping the existing static MiniSearch pipeline unchanged.
- Updated usage and development docs to explain the `Find` vs external-agent artifact split and the recommended artifact consumption order.
- Verified `@anydocs/core` typecheck, the targeted build artifact regression tests, and the workflow-standard test suite.
- Full `@anydocs/web` typecheck is currently blocked by missing `.next/types` files in the workspace, and preview-related tests remain constrained by sandbox socket permissions.

### File List

- /Users/shawn/workspace/code/anydocs/packages/core/src/publishing/build-artifacts.ts
- /Users/shawn/workspace/code/anydocs/packages/core/src/services/workflow-standard-service.ts
- /Users/shawn/workspace/code/anydocs/packages/core/src/types/workflow-standard.ts
- /Users/shawn/workspace/code/anydocs/packages/core/tests/build-preview-service.test.ts
- /Users/shawn/workspace/code/anydocs/packages/web/components/docs/search-panel.tsx
- /Users/shawn/workspace/code/anydocs/docs/04-usage-manual.md
- /Users/shawn/workspace/code/anydocs/docs/05-dev-guide.md
- /Users/shawn/workspace/code/anydocs/docs/implementation-artifacts/5-6-expand-ai-readable-artifacts-and-reposition-reader-search-as-find.md

### Change Log

- 2026-03-19: Added `llms-full.txt` and `mcp/chunks.<lang>.json` as published-only build artifacts for external agents.
- 2026-03-19: Extended workflow-standard and machine-readable discovery metadata to expose the new artifact family.
- 2026-03-19: Repositioned reader search copy toward `Find` and updated docs to explain artifact responsibilities and verification flow.
