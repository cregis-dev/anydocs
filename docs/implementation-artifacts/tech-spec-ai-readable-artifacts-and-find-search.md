---
title: 'AI-readable artifacts and find search'
slug: 'ai-readable-artifacts-and-find-search'
created: '2026-03-18T18:30:00+08:00'
status: 'ready-for-dev'
stepsCompleted: [1, 2, 3, 4]
tech_stack:
  - 'TypeScript'
  - 'Node.js'
  - 'Next.js 16 App Router'
  - 'React 19'
  - 'MiniSearch'
  - 'JSON'
  - 'Plain text'
files_to_modify:
  - 'packages/core/src/publishing/build-artifacts.ts'
  - 'packages/core/src/services/workflow-standard-service.ts'
  - 'packages/core/src/types/workflow-standard.ts'
  - 'packages/web/components/docs/search-panel.tsx'
  - 'packages/core/tests/build-preview-service.test.ts'
  - 'docs/04-usage-manual.md'
  - 'docs/05-dev-guide.md'
code_patterns:
  - 'Published-only filtering is shared across site output, search artifacts, and AI-facing artifacts'
  - 'Build artifacts are emitted from packages/core/src/publishing/build-artifacts.ts'
  - 'Reader search consumes a static per-language search-index.<lang>.json asset from the output root'
  - 'Machine-readable site outputs live under dist/mcp and are indexed by mcp/index.json'
  - 'AI-facing outputs should stay static, deterministic, and external-agent-friendly rather than adding in-product AI chat behavior'
test_patterns:
  - 'packages/core/tests/build-preview-service.test.ts'
---

# Tech-Spec: AI-readable artifacts and find search

**Created:** 2026-03-18T18:30:00+08:00

## Overview

### Problem Statement

Anydocs is positioned as an AI-first documentation tool, but the product direction for the near term is not to embed an in-product AI Ask experience. Instead, Anydocs should produce deterministic machine-readable artifacts that external agents can consume. At the same time, the existing reader search should remain available for human readers, but its role should be narrowed to fast page and section discovery rather than acting like an answer engine.

The current artifact set only partially serves that direction. `llms.txt` is a lightweight page index, `mcp/*.json` exposes navigation and pages, and `search-index.<lang>.json` powers the reader search UI. However, there is no full-document fallback artifact, and there is no chunk-level content artifact that an external agent can use for grounded retrieval. The current search index also overreaches into page-body search without being a reliable multilingual retrieval layer.

### Solution

Keep traditional search as a lightweight human-facing `Find` capability, not as an AI-answering layer. Extend the build output with a layered AI-readable artifact contract:

- `llms.txt` as the lightweight discovery index
- `llms-full.txt` as a full-site fallback export for coarse-grained agent reading
- `mcp/index.json`, `mcp/pages.<lang>.json`, and `mcp/navigation.<lang>.json` as the structural layer
- `mcp/chunks.<lang>.json` as the primary content-retrieval layer for external agents

This design preserves deterministic static output, keeps publication rules consistent, and gives external agents a better contract than a single monolithic text file.

### Scope

**In Scope:**
- Reposition reader search as human-facing `Find`
- Define and generate `llms-full.txt`
- Define and generate `mcp/chunks.<lang>.json`
- Extend `mcp/index.json` so agents can discover the new chunk files
- Document external-agent consumption order for the artifact set
- Keep the current published-only filtering rule across all public and AI-facing artifacts

**Out of Scope:**
- Building in-product AI Ask or chat UI
- Adding embeddings, hosted vector search, or a retrieval API server
- Replacing the current docs reader route model
- Replacing the current `llms.txt` or MCP outputs with a single new format
- Theme-specific AI artifact customization

## Context for Development

### Codebase Patterns

- `packages/core/src/publishing/build-artifacts.ts` already owns generation of `search-index.<lang>.json`, `mcp/*.json`, and `llms.txt`.
- The current `llms.txt` output is intentionally lightweight and only lists languages and page routes.
- The current MCP outputs expose navigation and page metadata, but not section-level content blocks.
- The current reader search panel fetches `/search-index.<lang>.json` and performs browser-side MiniSearch queries against static JSON.
- The shared publication boundary is already important to the architecture and must remain identical for site output, search output, and AI-facing output.

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `packages/core/src/publishing/build-artifacts.ts` | Current generation of `llms.txt`, `search-index`, and MCP outputs |
| `packages/core/src/services/workflow-standard-service.ts` | Workflow-standard artifact registration and path exposure |
| `packages/core/src/types/workflow-standard.ts` | Workflow-standard artifact identifier typing |
| `packages/web/components/docs/search-panel.tsx` | Current human-facing reader search consumer |
| `packages/core/tests/build-preview-service.test.ts` | Current artifact generation verification |
| `docs/planning-artifacts/prd.md` | Product positioning and AI-first vision |
| `docs/planning-artifacts/architecture.md` | Shared publication and static artifact architecture rules |

### Technical Decisions

- The reader search capability remains in the product, but its product role is explicitly `Find`, not `Ask`.
- `search-index.<lang>.json` remains a reader-facing asset and should not be treated as the primary external-agent contract.
- `llms-full.txt` is useful as a compatibility and fallback artifact, but it is not sufficient as the only AI-readable output.
- `mcp/chunks.<lang>.json` becomes the primary content artifact for external agents because it provides bounded, referenceable, section-level content.
- External agents should be able to consume all AI-readable artifacts directly from the static build output without requiring the reader HTML routes.
- The artifact contract must stay deterministic and static-file-friendly so it works in local builds, preview exports, and generic static hosting.

## Artifact Contract

### Output Layout

The recommended output layout under the build root is:

```text
dist/
├── llms.txt
├── llms-full.txt
├── search-index.en.json
├── search-index.zh.json
└── mcp/
    ├── index.json
    ├── navigation.en.json
    ├── navigation.zh.json
    ├── pages.en.json
    ├── pages.zh.json
    ├── chunks.en.json
    └── chunks.zh.json
```

### Consumer Order

External agents should consume artifacts in this order:

1. `llms.txt` or `mcp/index.json` for discovery
2. `mcp/pages.<lang>.json` and `mcp/navigation.<lang>.json` for page and structure understanding
3. `mcp/chunks.<lang>.json` for grounded section-level content retrieval
4. `llms-full.txt` only as a coarse-grained full-site fallback

Reader search continues to consume `search-index.<lang>.json` separately as a human-facing feature.

### `llms.txt`

`llms.txt` remains a lightweight discovery index. It should include:

- project/site identification
- available languages
- per-language page listings
- stable page URLs
- short descriptions when available

It should not include full page bodies.

### `llms-full.txt`

`llms-full.txt` is a sequential full-site export for external agents that need a single-file fallback. It must:

- include only `published` pages
- group content by language
- include explicit per-page metadata boundaries
- preserve stable page URL references
- render readable plain text content, not raw editor JSON

Recommended per-page block format:

```text
### Page
- Page ID: welcome
- URL: /en/welcome
- Title: Welcome
- Breadcrumbs: Getting Started
- Tags: demo, welcome
- Updated At: 2026-03-11T00:00:00.000Z

Welcome
This is the canonical Anydocs demo project...
```

### `mcp/index.json`

`mcp/index.json` remains the machine-readable discovery index and must be extended so each language advertises a `chunks` file alongside `pages`, `navigation`, and `searchIndex`.

Required shape:

```json
{
  "version": 1,
  "generatedAt": "ISO-8601",
  "projectId": "string",
  "publicationRule": "published-only",
  "site": {
    "theme": { "id": "string" }
  },
  "languages": [
    {
      "lang": "en",
      "publishedPages": 12,
      "navigationItems": 20,
      "files": {
        "searchIndex": "../search-index.en.json",
        "navigation": "navigation.en.json",
        "pages": "pages.en.json",
        "chunks": "chunks.en.json"
      }
    }
  ]
}
```

### `mcp/pages.<lang>.json`

This file remains the page-level metadata source. Its current contract is adequate and should remain focused on page discovery, references, and routing.

Required fields per page:

- `id`
- `slug`
- `href`
- `title`
- `description`
- `tags`
- `updatedAt`
- `breadcrumbs`

### `mcp/navigation.<lang>.json`

This file remains the canonical navigation-tree source. No AI-specific reshaping is required in this spec beyond keeping it discoverable through `mcp/index.json`.

### `mcp/chunks.<lang>.json`

This is the new primary AI-readable content artifact.

Required top-level shape:

```json
{
  "lang": "en",
  "generatedAt": "ISO-8601",
  "chunking": {
    "strategy": "heading-aware",
    "maxChars": 2000,
    "overlapChars": 200
  },
  "chunks": []
}
```

Required per-chunk fields:

- `id`: stable chunk id such as `welcome#0001`
- `pageId`
- `lang`
- `slug`
- `href`
- `title`
- `description`
- `headingPath`: ordered heading chain for the chunk
- `breadcrumbs`
- `order`: monotonically increasing order within the page
- `tags`
- `updatedAt`
- `text`: plain-text content of the chunk
- `summary`: optional short chunk summary
- `tokenEstimate`

Recommended example:

```json
{
  "id": "welcome#0001",
  "pageId": "welcome",
  "lang": "en",
  "slug": "welcome",
  "href": "/en/welcome",
  "title": "Welcome",
  "description": "Root-level canonical demo project for Anydocs.",
  "headingPath": ["Getting Started", "Introduction"],
  "breadcrumbs": ["Getting Started"],
  "order": 1,
  "tags": ["demo", "welcome"],
  "updatedAt": "2026-03-11T00:00:00.000Z",
  "text": "This is the canonical Anydocs demo project...",
  "summary": "Introduces the demo project and its purpose.",
  "tokenEstimate": 180
}
```

## Chunking Rules

- Chunking is page-scoped and must never cross page boundaries.
- The preferred strategy is heading-aware chunking derived from page render output.
- If a page has no headings, the page must still emit at least one chunk.
- The target chunk size is bounded by `maxChars`; if a section exceeds the cap, split again on paragraph boundaries.
- Neighboring chunks should preserve a small overlap using `overlapChars` so external agents can recover local continuity.
- `text` must be plain text suitable for retrieval and citation. It must not contain editor-state JSON.
- Code blocks belong to the nearest heading section. Oversized code samples may become dedicated chunks if needed.
- All chunk ids must be stable across builds when source order and content boundaries do not change.

## Reader Search Positioning

### Product Role

Reader search remains in the product as a `Find` tool for human readers. Its goals are:

- find a page quickly
- find a likely section or breadcrumb path
- jump into a page from a small list of candidates

It is not responsible for long-form explanation, comparison, or answer synthesis.

### Indexing Guidance

`search-index.<lang>.json` should remain optimized for human discovery, not external-agent retrieval. The preferred ranking order is:

1. title
2. slug
3. headings
4. description
5. short snippet

The current body-text field may remain temporarily for compatibility, but future implementation should move toward a find-oriented index rather than treating the search panel as a page-body answer engine.

## Implementation Plan

### Tasks

- [ ] Task 1: Extend the build artifact contract with `llms-full.txt`
  - File: `packages/core/src/publishing/build-artifacts.ts`
  - Action: Add a full-site text export that emits per-language and per-page metadata boundaries plus readable plain-text page content.
  - Notes: Reuse the shared published-page pipeline and do not add a parallel filtering path.

- [ ] Task 2: Add `mcp/chunks.<lang>.json` generation
  - File: `packages/core/src/publishing/build-artifacts.ts`
  - Action: Generate per-language chunk files from published page render output using a heading-aware, page-scoped chunking strategy.
  - Notes: Keep the first version deterministic and heuristic-driven; embeddings or semantic preprocessing are explicitly out of scope.

- [ ] Task 3: Extend `mcp/index.json` to advertise chunk files
  - File: `packages/core/src/publishing/build-artifacts.ts`
  - Action: Add a `chunks` entry under each language’s `files` object.
  - Notes: Existing `pages`, `navigation`, and `searchIndex` entries must remain intact.

- [ ] Task 4: Register chunk artifacts in workflow-standard outputs
  - File: `packages/core/src/types/workflow-standard.ts`
  - Action: Add a new workflow artifact identifier for chunk outputs.
  - Notes: This keeps downstream automation and repo tooling aware of the new artifact family.
  - File: `packages/core/src/services/workflow-standard-service.ts`
  - Action: Expose the chunk artifact path alongside existing search, MCP, and llms outputs.
  - Notes: Preserve the current relative-path contract style.

- [ ] Task 5: Keep reader search aligned with the repositioned `Find` role
  - File: `packages/web/components/docs/search-panel.tsx`
  - Action: Review the current UI copy and result rendering so the search panel clearly behaves like page discovery rather than answer generation.
  - Notes: This task does not require building AI Ask or changing the reader route model.

- [ ] Task 6: Add automated coverage for the expanded artifact set
  - File: `packages/core/tests/build-preview-service.test.ts`
  - Action: Assert generation of `llms-full.txt`, `mcp/chunks.<lang>.json`, and updated `mcp/index.json` file references.
  - Notes: Preserve existing assertions for `llms.txt`, search indexes, and published-only behavior.

- [ ] Task 7: Update user-facing and developer docs for the new AI-readable artifact contract
  - File: `docs/04-usage-manual.md`
  - Action: Document the difference between reader search assets and AI-readable artifacts, including the purpose of `llms-full.txt` and `mcp/chunks.<lang>.json`.
  - Notes: Keep the reader-search explanation product-facing.
  - File: `docs/05-dev-guide.md`
  - Action: Add verification guidance and example inspection commands for the new artifact files.
  - Notes: Document the recommended external-agent consumption order.

### Acceptance Criteria

- [ ] AC 1: Given a docs project with published pages, when `anydocs build <targetDir>` completes, then the build output contains `llms.txt`, `llms-full.txt`, `mcp/index.json`, `mcp/pages.<lang>.json`, `mcp/navigation.<lang>.json`, `mcp/chunks.<lang>.json`, and `search-index.<lang>.json`.
- [ ] AC 2: Given the generated `llms-full.txt`, when an external agent reads it without opening the reader HTML, then it can determine each page’s language, URL, title, and readable body content from explicit page boundaries.
- [ ] AC 3: Given the generated `mcp/index.json`, when an external agent discovers available machine-readable files, then it can locate the per-language chunk artifact through a stable `files.chunks` entry.
- [ ] AC 4: Given a published page with multiple sections, when chunk artifacts are generated, then `mcp/chunks.<lang>.json` contains one or more stable, page-scoped chunks with `headingPath`, `href`, `text`, and ordering metadata.
- [ ] AC 5: Given a page with no headings, when chunk artifacts are generated, then that page still produces at least one chunk entry.
- [ ] AC 6: Given unpublished pages exist, when AI-readable artifacts and search artifacts are generated, then unpublished pages do not appear in `llms.txt`, `llms-full.txt`, `mcp/*.json`, or `search-index.<lang>.json`.
- [ ] AC 7: Given the reader search UI is used by a human reader, when they search the docs, then the UI continues to behave as a page-finding tool and does not imply in-product AI answering behavior.

## Additional Context

### Dependencies

- Existing published-page selection in the core build workflow
- Existing `llms.txt` and MCP artifact emission
- Existing reader search panel and static `search-index` contract
- Existing build artifact tests in `packages/core/tests/build-preview-service.test.ts`

### Risks

- If chunk ids are not stable, external automation may lose the ability to cache or cite chunk references across builds.
- If chunking relies too heavily on current reader-specific markdown helpers, core artifact generation may become coupled to web-only code.
- If `llms-full.txt` becomes the primary AI contract by accident, agents may ignore the more precise and cheaper structured artifacts.

### Open Questions

- Whether heading extraction should be implemented directly in core or promoted from existing markdown utilities into a shared helper
- Whether `search-index.<lang>.json` should gain explicit `headings` and `snippet` fields in the same implementation or in a follow-up refinement
- Whether future chunk artifacts should include optional raw markdown excerpts in addition to plain text
