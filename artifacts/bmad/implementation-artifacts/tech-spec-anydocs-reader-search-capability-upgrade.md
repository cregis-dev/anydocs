---
title: 'Anydocs Reader Search Capability Upgrade'
slug: 'anydocs-reader-search-capability-upgrade'
created: '2026-04-06T19:54:53+0800'
status: 'ready-for-dev'
stepsCompleted: [1, 2, 3, 4]
tech_stack:
  - 'TypeScript'
  - 'Node.js'
  - 'React 19'
  - 'Next.js 16 App Router'
  - 'MiniSearch'
  - 'JSON'
files_to_modify:
  - 'packages/web/components/docs/search-panel.tsx'
  - 'packages/core/src/publishing/build-artifacts.ts'
  - 'packages/core/tests/build-preview-service.test.ts'
  - 'packages/web/components/docs/docs-ui-copy.ts'
  - 'packages/web/lib/docs/markdown.ts'
  - 'packages/web/tests/markdown.test.ts'
  - 'packages/web/tests/canonical-reader.test.ts'
  - 'packages/core/src/utils/heading-ids.ts (new shared helper candidate)'
code_patterns:
  - 'Reader search currently fetches /search-index.<lang>.json and performs browser-side MiniSearch queries.'
  - 'Published-only filtering and artifact generation are centralized in packages/core/src/publishing/build-artifacts.ts.'
  - 'Chunk artifacts already exist as mcp/chunks.<lang>.json with heading-aware ordering metadata.'
  - 'Theme shells own search placement and styling; the shared search component should stay visually minimal.'
  - 'Heading ids are generated and deduplicated at render time via createHeadingIdGenerator(), not stored canonically in page source.'
  - 'Canonical, markdown, and legacy readers all derive heading ids from the same slug-style logic, but packages/core does not currently own that helper.'
test_patterns:
  - 'packages/core/tests/build-preview-service.test.ts validates search-index and chunk artifact behavior.'
  - 'packages/web/tests/markdown.test.ts and packages/web/tests/canonical-reader.test.ts use node:test with strict assertions to lock heading-id and TOC behavior.'
---

# Tech-Spec: Anydocs Reader Search Capability Upgrade

**Created:** 2026-04-06T19:54:53+0800

## Overview

### Problem Statement

Anydocs Reader search is currently a lightweight page-level feature backed by `search-index.<lang>.json` and browser-side `MiniSearch`. It is good enough for finding page titles, but it does not reliably help readers locate the exact section where a concept, workflow step, or reference detail appears. Search results currently return page links without section-level evidence, snippets, or in-page anchors, which keeps search closer to a navigation filter than a true `Find` capability.

### Solution

Upgrade Reader search into a section/chunk-level `Find` capability. The new search flow should prioritize title, section heading, and body text matches, reuse the existing chunk artifact model as the search foundation, and return results with enough structure to jump directly to the relevant place in a page. The implementation should stay deterministic, local-first, and static-artifact-friendly, without introducing AI answering, semantic retrieval, or theme-level style work.

### Scope

**In Scope:**
- Upgrade Reader search from page-level results to section/chunk-level results.
- Reuse existing chunk-oriented publishing data or a reader-facing derivative built from that same source.
- Search only across page title, section heading/title, and body text.
- Return result metadata sufficient for snippets, section context, and in-page anchor navigation.
- Keep a basic shared UI in the search component while leaving visual treatment to each theme.
- Preserve the current product role of search as `Find`, not `Ask`.

**Out of Scope:**
- AI assistant integration or AI-answering behavior.
- Semantic, vector, or hosted search services.
- Search over tags, page-template metadata, or other public metadata fields.
- Theme-specific style redesign or command-palette visual polish.
- Broader AI-readable artifact contract changes beyond what is strictly required to support Reader search.

## Context for Development

### Codebase Patterns

- `packages/web/components/docs/search-panel.tsx` currently fetches `/search-index.<lang>.json`, builds a `MiniSearch` index on the client, and renders simple page-level results.
- `packages/core/src/publishing/build-artifacts.ts` is the shared publishing path for `search-index.<lang>.json`, `mcp/pages.<lang>.json`, `mcp/navigation.<lang>.json`, `mcp/chunks.<lang>.json`, `llms.txt`, and `llms-full.txt`.
- Existing chunk artifacts are already heading-aware and preserve ordering metadata, which makes them the most natural base for section-level Reader search.
- Current chunk records contain `headingPath` and page-level `href`, but they do not currently encode resolved heading anchor ids.
- Published-only filtering is a core architectural constraint and must remain shared across site output, search output, and machine-readable artifacts.
- Theme shells such as classic, atlas, and blueprint review already control search placement and styling around the shared `SearchPanel`; this work should keep the shared search UI structurally useful but visually minimal.
- Heading ids are currently created at render time in web-only reader code using `createHeadingIdGenerator()` from `packages/web/lib/docs/markdown.ts`; canonical-doc, markdown, and legacy readers all rely on this rule for in-page anchors and TOC ids.
- The Reader page route derives TOC ids from rendered content, not from build artifacts, so any build-time search href generation must stay aligned with the same heading-id algorithm to avoid broken anchors.

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `packages/web/components/docs/search-panel.tsx` | Current Reader search implementation and result rendering |
| `packages/core/src/publishing/build-artifacts.ts` | Current published search-index generation and chunk artifact generation |
| `packages/core/tests/build-preview-service.test.ts` | Existing tests for search-index and chunk artifact behavior |
| `packages/web/components/docs/docs-ui-copy.ts` | Shared search copy for `en` and `zh` |
| `packages/web/lib/docs/markdown.ts` | Shared heading slug/id generation and markdown TOC extraction rules |
| `packages/web/lib/docs/canonical-reader.ts` | Canonical-doc TOC extraction behavior and heading id expectations |
| `packages/web/components/docs/canonical-doc-view.tsx` | Canonical reader heading rendering with generated `id` attributes |
| `packages/web/components/docs/markdown-view.tsx` | Markdown reader heading rendering and deduplicated heading ids |
| `packages/web/components/docs/legacy-yoopta-doc-view.tsx` | Legacy reader heading id assignment after render |
| `packages/web/app/[lang]/[...slug]/page.tsx` | Reader route that derives TOC state and theme-specific page chrome |
| `packages/web/tests/markdown.test.ts` | Tests for heading-id slugification and duplicate handling in markdown |
| `packages/web/tests/canonical-reader.test.ts` | Tests for canonical heading-id stability |
| `artifacts/bmad/implementation-artifacts/tech-spec-ai-readable-artifacts-and-find-search.md` | Existing spec that establishes chunk artifacts and the `Find` positioning |

### Technical Decisions

- Reader search remains a deterministic `Find` feature and must not imply in-product AI answering.
- Section/chunk-level results are the primary target; page-level behavior may remain only as a compatibility fallback where necessary.
- Search indexing should reuse the current chunk source of truth rather than inventing a separate retrieval model.
- Reader search should consume a reader-facing chunk-derived search index rather than reading `mcp/chunks.<lang>.json` directly.
- Search fields for this scope are restricted to title, section heading/title, and body text.
- Snippets should be generated client-side at query time so they remain query-aware and do not bloat build artifacts.
- Stable heading anchors should be preferred for result navigation; chunks without a resolvable heading anchor should fall back to the page-level href.
- Build-time search href generation must align with the exact heading-id algorithm used by Reader rendering; this likely requires extracting the slug/id helper into shared code owned by `@anydocs/core` or another shared module rather than duplicating logic ad hoc.
- Result deduplication or result capping is required to avoid flooding the UI with near-duplicate chunk matches from the same page.
- Empty queries should keep the current minimal behavior and should not introduce recommendations, recent-search behavior, or other discovery features in this scope.
- Search remains language-scoped in this iteration; the Reader should load and query only the active language index.
- Theme-specific styling is intentionally out of scope; shared search UI changes should focus on structure and usability only.

## Implementation Plan

### Tasks

- [ ] Task 1: Define a reader-facing search index schema derived from chunk publishing data.
  - File: `packages/core/src/publishing/build-artifacts.ts`
  - Action: Document and implement the minimal record shape Reader search will consume, and keep its contract intentionally decoupled from the MCP chunk artifact shape.
  - Notes: The stable minimum record must include `id`, `pageId`, `pageSlug`, `pageTitle`, `sectionTitle`, `breadcrumbs`, `href`, and `text`, with optional fields only where the Reader truly needs them.
- [ ] Task 2: Define the anchor and href contract for section-level result navigation.
  - Files: `packages/core/src/publishing/build-artifacts.ts`, `packages/web/lib/docs/markdown.ts`, `packages/web/components/docs/search-panel.tsx`
  - Action: Establish how heading-based anchors are represented in the Reader search contract and how page-level fallback hrefs are used when no heading anchor can be resolved.
  - Notes: Do not duplicate slug logic in ad hoc helpers. Extract or reuse the same heading-id generation rule used by canonical, markdown, and legacy readers.
- [ ] Task 3: Add or adapt a published search data source that is chunk-oriented for Reader usage.
  - File: `packages/core/src/publishing/build-artifacts.ts`
  - Action: Rework `search-index.<lang>.json` generation or produce a compatible derivative so Reader search can operate on section/chunk-level records backed by the existing heading-aware content split.
  - Notes: Preserve published-only filtering and keep MCP chunk artifacts unchanged unless a narrow shared helper extraction is required.
- [ ] Task 4: Define and implement the Reader-facing search result model and rendering behavior.
  - File: `packages/web/components/docs/search-panel.tsx`
  - Action: Replace the current page-shaped result assumptions with a result model that can render section-aware entries, derive snippets at query time, and preserve minimal empty-query behavior.
  - Notes: Base UI output should show page context, section context, and a short snippet without introducing theme-specific presentation logic.
- [ ] Task 5: Update client-side search ranking toward `Find` quality.
  - File: `packages/web/components/docs/search-panel.tsx`
  - Action: Prioritize title and section-heading matches over body-only matches while preserving lightweight browser-side search behavior.
  - Notes: Ranking should prefer exact title and heading matches first, then prefix and fuzzy matches, before body-only hits for the same query intent.
- [ ] Task 6: Add duplicate-result control for multi-match pages.
  - File: `packages/web/components/docs/search-panel.tsx`
  - Action: Prevent a single page from dominating the result list with redundant adjacent chunk hits by deduplicating or capping same-page results.
  - Notes: Favor the strongest chunk hit from a page and keep the final visible list small enough to stay scannable.
- [ ] Task 7: Extend automated coverage for the new search contract.
  - Files: `packages/core/tests/build-preview-service.test.ts`, `packages/web/tests/markdown.test.ts`, `packages/web/tests/canonical-reader.test.ts`
  - Action: Assert that generated search data contains section/chunk-level records, stable href data, and published-only filtering behavior, and add focused Reader-side coverage for section result rendering, snippet rendering, and href fallback behavior as needed.
  - Notes: Reuse existing heading-id and TOC tests as the contract baseline for anchor stability.
- [ ] Task 8: Refresh shared user-facing search copy only where the current page-level wording becomes misleading.
  - File: `packages/web/components/docs/docs-ui-copy.ts`
  - Action: Keep the copy aligned with a `Find` tool that locates pages and sections without introducing AI language.
  - Notes: Avoid changing theme wrappers or unrelated docs chrome while adjusting shared search copy.

### Acceptance Criteria

- [ ] AC 1: Given a docs project with published content across multiple sections, when build artifacts are generated, then the Reader search data contains section/chunk-level search records rather than only page-level records.
- [ ] AC 1a: Given a generated Reader search record, when it is written to the published search index, then it includes the minimum stable fields required by the Reader contract: `id`, `pageId`, `pageSlug`, `pageTitle`, `sectionTitle`, `breadcrumbs`, `href`, and `text`.
- [ ] AC 2: Given a reader enters a query that matches body text inside a section, when results are shown, then the result includes page context, section context, and a concise snippet indicating why the section matched.
- [ ] AC 3: Given a reader opens a search result, when the result points to a section-level match, then navigation lands on a stable in-page anchor for the matching section whenever an anchor can be resolved.
- [ ] AC 4: Given competing results where one matches a page or section title and another matches only body text, when results are ranked, then title and heading matches appear ahead of body-only matches for the same query intent.
- [ ] AC 5: Given unpublished pages or sections exist in the project, when search artifacts are generated, then unpublished content does not appear in Reader search data or rendered Reader search results.
- [ ] AC 6: Given the shared search component is rendered inside different docs themes, when themes apply their own wrappers and class names, then the shared search component remains structurally usable without requiring theme-specific style work in this feature scope.
- [ ] AC 7: Given a query matches multiple nearby chunks from the same page, when results are rendered, then redundant near-duplicate results are deduplicated or capped so one page does not flood the visible result set.
- [ ] AC 8: Given a matching chunk has no resolvable heading anchor, when the reader opens the result, then navigation falls back to the page-level href without breaking the search flow.
- [ ] AC 9: Given Reader search consumes its published search index, when MCP chunk artifact requirements evolve independently, then Reader search remains decoupled from MCP-specific field requirements and continues to use its own reader-facing contract.
- [ ] AC 10: Given the search input is empty, when the Reader renders the search component, then it does not introduce recommendation, recent-search, or discovery behavior in this scope.
- [ ] AC 11: Given a reader is browsing one language, when search data is loaded and queried, then only the active language index is used in this scope.

## Additional Context

### Dependencies

- Existing chunk generation in `packages/core/src/publishing/build-artifacts.ts`
- Existing client-side `MiniSearch` dependency in `packages/web`
- Existing Reader theme shells that embed `SearchPanel`
- Existing heading-id generation and TOC behavior in `packages/web/lib/docs/markdown.ts`, `packages/web/lib/docs/canonical-reader.ts`, and the Reader view components
- Existing published-only artifact pipeline and cleanup behavior in `packages/core/src/publishing/build-artifacts.ts`

### Testing Strategy

- Extend artifact-generation tests to validate the new Reader search data shape and published-only behavior.
- Add focused assertions for section/chunk-level hrefs and section context.
- Add or extend Reader-side tests for snippet derivation, section-aware result rendering, and href fallback behavior where the search panel logic becomes non-trivial.
- Manually verify English and Chinese pages with repeated headings, missing headings, and body-only matches to confirm anchor stability and same-language-only loading.

### Notes

- This quick spec intentionally separates search capability from search styling.
- This quick spec intentionally does not widen search fields to tags or public metadata.
- This work should remain compatible with the current architectural direction established by the AI-readable artifacts and `Find` spec, but it is scoped to Reader search behavior only.
- The highest implementation risk is anchor drift between build-time search records and render-time heading ids; shared heading-id logic is the preferred mitigation.
- If the reader-facing section index grows too large, optimize the record shape before considering any service-backed search solution.
