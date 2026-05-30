# Story 5.6: Expand AI-Readable Artifacts and Reposition Reader Search as Find

Status: done

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

### Review Follow-ups (AI)

- [x] [AI-Review][Medium] Correct wrong file paths in Story File List — declared `docs/04-usage-manual.md` and `docs/05-dev-guide.md` but actual files are `docs/usage-manual.md` and `docs/developer-guide.md` [5-6-expand-ai-readable-artifacts-and-reposition-reader-search-as-find.md:271-278]
- [x] [AI-Review][Medium] Add test asserting draft pages are excluded from `llms-full.txt` — AC6 gap: `build-preview-service.test.ts` validates draft exclusion for search index and chunks but never checks `llms-full.txt` content [packages/core/tests/build-preview-service.test.ts:370-412]
- [x] [AI-Review][Medium] Add test asserting draft pages are excluded from `mcp/chunks.<lang>.json` — same AC6 gap as above; chunk artifact has no explicit draft-exclusion assertion [packages/core/tests/build-preview-service.test.ts:370-412]
- [x] [AI-Review][Medium] Remove or refactor unreachable fallback block in `toChunkDocs` — the `if (chunks.length > 0) return chunks; return [fallback]` block (lines 675-718) is dead code because `getSearchSections` always returns at least one section via page-title fallback; existing test validates the `getSearchSections` path, not this block [packages/core/src/publishing/build-artifacts.ts:675-718]
- [x] [AI-Review][Medium] Eliminate double page-parsing in `writePublishedArtifacts` — `toChunkDocs` is called twice per page (once for MCP chunks, once for reader search chunks) causing `getPageText`→`renderPageContent`→`extractMarkdownSections` to run twice; extract shared sections before both calls [packages/core/src/publishing/build-artifacts.ts:818-832]
- [x] [AI-Review][Low] Add section-anchored `href` to chunk docs — unlike reader search docs which include `#headingId` anchors, chunk `href` is always page-level only (`/${lang}/${slug}`); external agents cannot deep-link to a specific section from chunk metadata [packages/core/src/publishing/build-artifacts.ts:629]
- [x] [AI-Review][Low] Add `llmsFull` and `chunks` artifact entries to `BuildManifest.artifacts` — new artifacts are discoverable via `mcp/index.json` but not via `build-manifest.json`; two discovery paths are inconsistent [packages/core/src/publishing/build-artifacts.ts:169-174]
- [ ] [AI-Review][Medium] Hoist `buildPageBreadcrumbs` call out of the per-page loop in `buildLlmsFullTxt` — currently called once per page (O(N²) nav walks per language); `writePublishedArtifacts` already does this correctly at the parallel call site [packages/core/src/publishing/build-artifacts.ts:355]
- [ ] [AI-Review][Low] Fix misleading indentation on `BuildManifest.source` — `site:` field is indented at outer-brace level so it visually reads as a sibling of `source` rather than a nested member; compiles fine but confuses readers [packages/core/src/publishing/build-artifacts.ts:137-149]
- [ ] [AI-Review][Low] Deduplicate `serializeThemeMetadata` + `serializeSiteNavigationMetadata` calls in `writePublishedArtifacts` — called three times across the function producing the same per-build value [packages/core/src/publishing/build-artifacts.ts:887-941]
- [ ] [AI-Review][Low] Add inline comment documenting path-convention split in `MachineReadableArtifactIndex.files` — `searchIndex`/`searchFind` use `../prefix`, `navigation`/`pages`/`chunks` don't; intentional (latter are mcp/ siblings) but currently undocumented [packages/core/src/publishing/build-artifacts.ts:894-900]

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
- `artifacts/bmad/implementation-artifacts/tech-spec-ai-readable-artifacts-and-find-search.md` now defines the desired artifact contract, chunk schema, and search positioning.
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

- Preserve the single publication filter path for site output, search output, and AI-facing output. [Source: artifacts/bmad/planning-artifacts/architecture.md]
- Generated machine-readable artifacts must be derived from the canonical shared domain model and remain build outputs rather than hand-edited files. [Source: artifacts/bmad/planning-artifacts/architecture.md]
- Search remains build-time generated in Phase 1 and should stay lightweight and browser-executed. [Source: artifacts/bmad/planning-artifacts/architecture.md]
- External AI tools are expected to interact through generated published artifacts rather than product-internal UI state. [Source: artifacts/bmad/planning-artifacts/architecture.md]

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
  - `artifacts/bmad/implementation-artifacts/tech-spec-ai-readable-artifacts-and-find-search.md`
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
  - `artifacts/bmad/planning-artifacts/epics.md`
  - `artifacts/bmad/planning-artifacts/prd.md`
  - `artifacts/bmad/planning-artifacts/architecture.md`
  - `artifacts/bmad/implementation-artifacts/tech-spec-ai-readable-artifacts-and-find-search.md`

### References

- [`epics.md`](/Users/shawn/workspace/code/anydocs/artifacts/bmad/planning-artifacts/epics.md) - Epic 5, Stories 5.4 and 5.5 context
- [`prd.md`](/Users/shawn/workspace/code/anydocs/artifacts/bmad/planning-artifacts/prd.md) - FR40, FR43, FR44, FR45
- [`architecture.md`](/Users/shawn/workspace/code/anydocs/artifacts/bmad/planning-artifacts/architecture.md) - publication filtering, search indexing, and AI-facing artifact rules
- [`tech-spec-ai-readable-artifacts-and-find-search.md`](/Users/shawn/workspace/code/anydocs/artifacts/bmad/implementation-artifacts/tech-spec-ai-readable-artifacts-and-find-search.md)
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

#### Review follow-up resolutions (2026-05-25)

- ✅ Resolved review finding [Medium]: Corrected File List paths (`docs/04-usage-manual.md` → `docs/usage-manual.md`, `docs/05-dev-guide.md` → `docs/developer-guide.md`). The Tasks/Subtasks and Implementation Checklist entries retain the original (incorrect) filenames as historical record per BMAD dev-story rule "only modify Tasks/Subtasks checkboxes, Dev Agent Record, File List, Change Log, and Status".
- ✅ Resolved review finding [Medium]: Added draft-exclusion assertions for `llms-full.txt` and `mcp/chunks.<lang>.json` to the existing "published search index emits section-level records..." test (which already provisioned a `status=draft` fixture). Verifies both the page id and a unique body sentinel never leak into either artifact.
- ✅ Resolved review finding [Medium]: Removed the unreachable empty-page fallback block in `toChunkDocs` (now `buildChunkDocsFromSections`). `getSearchSections` guarantees ≥1 section for any page with a non-empty title via its plain-text fallback, so the inner fallback was structurally dead. AC5 (every page produces at least one chunk) remains satisfied through `getSearchSections`. Existing "fallback chunk for pages without headings" test continues to pass via the title-fallback path.
- ✅ Resolved review finding [Medium]: Eliminated double page-parsing in `writePublishedArtifacts` by hoisting `getSearchSections(page)` into a per-language `pageSections` map computed once before the MCP-chunk and reader-search-chunk builds. Both `toReaderSearchDocs` and the new `buildChunkDocsFromSections` now accept pre-computed sections, replacing the prior `toChunkDocs` (which re-parsed pages on each call).
- ✅ Resolved review finding [Low]: Chunk `href` now includes the `#headingId` anchor when the chunk maps to a heading, matching `toReaderSearchDocs` behavior. `sourcePath` stays page-level (it represents the underlying source location, not the deep-link target). `buildEnrichedText`'s "Page:" label keeps the page-level URL since the "Section:" line already conveys the heading path.
- ✅ Resolved review finding [Low]: Extended `BuildManifest.artifacts` with required `llmsFull: string` and `chunks: string[]` fields, populated from the same per-language language list used for `searchIndexes`/`searchFindIndexes`. The `mcp/index.json` and `build-manifest.json` discovery paths now agree on the complete published artifact set.

#### Verification (review follow-ups)

- `pnpm --filter @anydocs/core typecheck` → exit 0
- `pnpm --filter @anydocs/core test` → 155/155 passing (includes 2 new draft-exclusion assertions and the dead-code removal under the existing "fallback chunk for pages without headings" test)
- `pnpm typecheck` (root, 7 packages) → all clean
- `pnpm test` (root regression gate) → core 155 + editor 7 + cli 36 (+2 pre-existing skips) + mcp 44 = 242 tests, 0 failures
- Reviewer-referenced line numbers shifted after the refactor; the equivalent logic now lives at `packages/core/src/publishing/build-artifacts.ts:589-686` (chunk builder) and `:805-862` (per-page sections cache + chunk variants).

#### Out-of-scope finding spotted during review (logged for separate work)

- `packages/web/scripts/gen-public-assets.mjs:pruneInternalExportArtifacts` only preserves `llms.txt` and `robots.txt` in the exported docs site; `llms-full.txt` is dropped during the docs export pipeline even though `runBuildWorkflow` writes it. This is a deployment-pipeline gap (not in the 5.6 review action items) and should be filed as its own follow-up.

### File List

- /Users/shawn/workspace/code/anydocs/packages/core/src/publishing/build-artifacts.ts (also modified 2026-05-25 — review follow-ups: dead-code removal, single-pass page sections, section-anchored chunk href, BuildManifest.artifacts parity)
- /Users/shawn/workspace/code/anydocs/packages/core/src/services/workflow-standard-service.ts
- /Users/shawn/workspace/code/anydocs/packages/core/src/types/workflow-standard.ts
- /Users/shawn/workspace/code/anydocs/packages/core/tests/build-preview-service.test.ts (also modified 2026-05-25 — review follow-ups: added draft-exclusion assertions for llms-full.txt and mcp/chunks.<lang>.json)
- /Users/shawn/workspace/code/anydocs/packages/web/components/docs/search-panel.tsx
- /Users/shawn/workspace/code/anydocs/docs/usage-manual.md
- /Users/shawn/workspace/code/anydocs/docs/developer-guide.md
- /Users/shawn/workspace/code/anydocs/artifacts/bmad/implementation-artifacts/5-6-expand-ai-readable-artifacts-and-reposition-reader-search-as-find.md

### Change Log

- 2026-03-19: Added `llms-full.txt` and `mcp/chunks.<lang>.json` as published-only build artifacts for external agents.
- 2026-03-19: Extended workflow-standard and machine-readable discovery metadata to expose the new artifact family.
- 2026-03-19: Repositioned reader search copy toward `Find` and updated docs to explain artifact responsibilities and verification flow.
- 2026-05-25: Addressed code review findings — 7 items resolved (5 Medium + 2 Low) covering doc-path corrections, draft-exclusion test coverage, dead-code removal in chunk builder, single-pass page-section computation, section-anchored chunk `href`, and `BuildManifest.artifacts` parity with `mcp/index.json`. No public API changes; chunk artifact hashes for pages with headings change due to the new `href` shape (acceptable: chunks regenerate on every build).
- 2026-05-26: Second-pass adversarial review completed. 4 new non-blocking findings logged as Review Follow-ups (1 Medium perf + 3 Low polish). All 7 ACs remain satisfied; full regression gate passes. Story transitioned `review → done`.

## Senior Developer Review (AI)

**Reviewer:** Claude Opus 4.7 (adversarial pass)
**Review Date:** 2026-05-26
**Review Outcome:** Approve — transition to `done`
**Severity Breakdown:** 0 High · 1 Medium · 3 Low (all non-blocking polish; logged as Review Follow-ups)

### Summary

The implementation satisfies all 7 acceptance criteria. The previous review cycle (2026-05-25) resolved the substantive findings — dead-code removal, single-pass page-section computation, section-anchored chunk `href`, and `BuildManifest.artifacts` parity. The second-pass review confirms:

- `llms-full.txt`, `mcp/chunks.<lang>.json`, and `mcp/index.json.files.chunks` are emitted with correct shape and content.
- Draft exclusion is now asserted for both `llms-full.txt` (page id + body sentinel) and `mcp/chunks.<lang>.json` (lines 421-434 of `build-preview-service.test.ts`).
- Reader search copy (`docs-ui-copy.ts`) uses Find-only wording (`Find pages, sections, or keywords` / `查找页面、章节或关键词`) with no Ask/Answer/AI generation language.
- Workflow-standard service registers both `llmsFull` and per-language `chunks` artifact ids.

### Findings (all logged as Review Follow-ups above)

- **M1 (Medium, perf):** `buildLlmsFullTxt` rebuilds `buildPageBreadcrumbs` map inside the per-page loop. `writePublishedArtifacts` already hoists this correctly at the parallel call site.
- **L1 (Low, type hygiene):** `BuildManifest.source.site` is indented at the wrong level — compiles fine but reads as if `site` is a sibling of `source`.
- **L2 (Low, DRY):** `serializeThemeMetadata` / `serializeSiteNavigationMetadata` called three times producing the same value in `writePublishedArtifacts`.
- **L3 (Low, docs):** `MachineReadableArtifactIndex.files` mixes `../prefixed` and unprefixed paths; intentional (sister files in mcp/) but currently undocumented.

### Action Items

- [x] [Medium] Hoist `buildPageBreadcrumbs` out of `buildLlmsFullTxt` page loop → tracked as Review Follow-up
- [x] [Low] Fix `BuildManifest.source` indentation → tracked as Review Follow-up
- [x] [Low] Hoist serialize helpers in `writePublishedArtifacts` → tracked as Review Follow-up
- [x] [Low] Document path convention in `MachineReadableArtifactIndex.files` → tracked as Review Follow-up
