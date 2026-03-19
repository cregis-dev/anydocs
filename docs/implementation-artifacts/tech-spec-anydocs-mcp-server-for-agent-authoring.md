---
title: 'Anydocs MCP Server For Agent Authoring'
slug: 'anydocs-mcp-server-for-agent-authoring'
created: '2026-03-18T18:37:23+0800'
status: 'ready-for-dev'
stepsCompleted: [1, 2, 3, 4]
tech_stack:
  - 'TypeScript'
  - 'Node.js'
  - 'pnpm workspace monorepo'
  - 'ESM packages with strip-types execution'
  - '@modelcontextprotocol/sdk'
files_to_modify:
  - 'packages/core/src/services/authoring-service.ts'
  - 'packages/core/src/services/index.ts'
  - 'packages/core/tests/authoring-service.test.ts'
  - 'packages/mcp/package.json'
  - 'packages/mcp/tsconfig.json'
  - 'packages/mcp/src/server.ts'
  - 'packages/mcp/src/tools/shared.ts'
  - 'packages/mcp/src/tools/project-tools.ts'
  - 'packages/mcp/src/tools/page-tools.ts'
  - 'packages/mcp/src/tools/navigation-tools.ts'
  - 'packages/mcp/src/index.ts'
  - 'packages/mcp/tests/server.test.ts'
  - 'packages/mcp/tests/tool-handlers.test.ts'
  - 'README.md'
code_patterns:
  - 'Adapter packages stay thin and delegate business logic to @anydocs/core'
  - 'Filesystem-backed project/page/navigation operations live in core repositories and return ValidationError or Result shapes'
  - 'Automation-facing structured output already exists in the CLI as JSON success/error envelopes'
  - 'Workspace packages use private ESM TypeScript configuration with local package path mapping'
test_patterns:
  - 'Package-level tests use node:test with Node --experimental-strip-types'
  - 'CLI integration tests spawn the package entrypoint and assert structured stdout/stderr contracts'
---

# Tech-Spec: Anydocs MCP Server For Agent Authoring

**Created:** 2026-03-18T18:37:23+0800

## Overview

### Problem Statement

Anydocs currently exposes a local-first CLI and published machine-readable build artifacts, but it does not provide an installable MCP server that agent tools such as Codex can connect to for direct authoring operations. This prevents agents from using domain-safe tools to inspect and edit docs projects through the canonical Anydocs model.

### Solution

Add a new `@anydocs/mcp` package that runs as a local `stdio` MCP server and exposes Anydocs domain tools backed directly by `@anydocs/core`. The first version should focus on agent authoring workflows for project, page, and navigation operations while clearly separating runtime MCP tooling from the existing published `dist/mcp/*.json` artifacts.

### Scope

**In Scope:**
- Create a new `packages/mcp` workspace package
- Implement a local `stdio` MCP server for agent tools
- Expose minimal authoring-focused MCP tools for Anydocs projects
- Reuse `@anydocs/core` as the only business-logic layer
- Reuse or align with the structured result and error model already introduced in the CLI
- Clarify terminology to distinguish runtime MCP tooling from published machine-readable artifacts

**Out of Scope:**
- Remote HTTP MCP transport
- Multi-project session orchestration
- Arbitrary raw filesystem editing tools
- Studio UI changes
- Preview/build MCP tools in the first implementation slice

## Context for Development

### Codebase Patterns

- The monorepo already separates adapters from domain logic through `@anydocs/core` and `@anydocs/cli`, so a new MCP package should follow the same adapter-over-core pattern.
- `@anydocs/core` exposes filesystem-backed repository functions such as `loadProjectContract()`, `createDocsRepository()`, `listPages()`, `loadPage()`, `findPageBySlug()`, `loadNavigation()`, `savePage()`, and `saveNavigation()` that can anchor MCP tools without routing through the CLI.
- Existing CLI commands already provide structured JSON success/error envelopes in `packages/cli/src/output/structured.ts`, which is the closest current contract for automation-friendly MCP tool responses.
- There is currently no installed MCP SDK dependency in the workspace and no existing `packages/mcp` package, so the implementation must introduce both the package boundary and the runtime integration pattern.
- Published `dist/mcp/*.json` files are build artifacts for reader-side machine-readable output, not a runtime MCP server, and the spec should keep those concepts distinct.

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `package.json` | Root workspace scripts and package conventions |
| `pnpm-workspace.yaml` | Workspace package discovery; confirms `packages/*` is already included |
| `packages/core/package.json` | Core package runtime and test conventions |
| `packages/cli/package.json` | Existing adapter package conventions and script patterns |
| `packages/core/src/fs/content-repository.ts` | Canonical project contract loading and validation |
| `packages/core/src/fs/docs-repository.ts` | Canonical page and navigation read/write operations |
| `packages/core/src/types/project.ts` | Project contract and path types that MCP tools must accept/return |
| `packages/core/src/types/docs.ts` | Page, navigation, language, and status domain types |
| `packages/cli/src/output/structured.ts` | Existing structured automation envelope pattern |
| `packages/cli/src/commands/page-command.ts` | Thin adapter pattern for domain-safe page inspection |
| `packages/cli/tests/watch-command.test.ts` | Package-level process/integration test style using `node:test` |

### Technical Decisions

- Prefer a dedicated `@anydocs/mcp` package rather than routing agent traffic through the CLI
- Use `stdio` transport for the first implementation
- Keep `projectRoot` explicit in tool inputs for v1 instead of introducing session state
- Treat MCP as a sibling adapter to CLI, both calling `@anydocs/core` directly
- Start with authoring tools for project/page/navigation and defer build/preview tools to a later slice
- Preserve the current `dist/mcp/*.json` paths for compatibility, but describe them as machine-readable artifacts in docs to avoid conflating them with the runtime MCP server
- Use `@modelcontextprotocol/sdk` as the MCP transport/runtime dependency rather than implementing protocol framing manually
- Add a small `authoring-service.ts` in core for page create/update/set-status flows so MCP write tools stay thin and domain-safe
- Keep v1 tool scope to `project_open`, `project_validate`, `page_list`, `page_get`, `page_find`, `page_create`, `page_update`, `page_set_status`, and `nav_get`
- Keep MCP v1 focused on tools only; do not add MCP resources in the first slice
- Define `page_update` as a shallow-merge patch over an explicit whitelist of mutable page fields rather than arbitrary object replacement

## Implementation Plan

### Tasks

- [ ] Task 1: Add shared authoring services to `@anydocs/core`
  - File: `packages/core/src/services/authoring-service.ts`
  - Action: Implement domain-safe helpers for `createPage`, `updatePage`, and `setPageStatus` using `loadProjectContract()`, `createDocsRepository()`, `loadPage()`, `findPageBySlug()`, and `savePage()`.
  - Notes: Accept `projectRoot` and explicit language; preserve validation behavior from `savePage()`; auto-refresh `updatedAt` on write operations.
- [ ] Task 2: Export and test the new core authoring services
  - File: `packages/core/src/services/index.ts`
  - Action: Export the new authoring service entrypoints.
  - Notes: Keep package boundary consistent so CLI and MCP can both consume the same functions.
- [ ] Task 3: Add core authoring tests
  - File: `packages/core/tests/authoring-service.test.ts`
  - Action: Cover happy path and validation failures for page creation, patch updates, and status transitions.
  - Notes: Include slug conflict handling, missing page handling, and publication-rule enforcement when status becomes `published`.
- [ ] Task 4: Create the MCP package scaffold
  - File: `packages/mcp/package.json`
  - Action: Add a new private workspace package with scripts for `dev`, `build`, `typecheck`, and `test`, plus dependencies on `@anydocs/core` and `@modelcontextprotocol/sdk`.
  - Notes: Follow the package shape already used by `@anydocs/cli`.
- [ ] Task 5: Add MCP TypeScript configuration and public entrypoint
  - File: `packages/mcp/tsconfig.json`
  - Action: Configure the package for strict ESM TypeScript with path mapping to `@anydocs/core`.
  - Notes: Include `src/**/*` and package-local tests following existing package conventions.
- [ ] Task 6: Implement shared MCP response helpers
  - File: `packages/mcp/src/tools/shared.ts`
  - Action: Define common success/error conversion helpers that map `DomainError` and unknown failures into stable MCP tool payloads.
  - Notes: Keep the payload shape aligned with the CLI JSON envelope where practical: `ok`, `data`, `error`, and `meta`.
- [ ] Task 7: Implement project-level MCP tools
  - File: `packages/mcp/src/tools/project-tools.ts`
  - Action: Add handlers for `project_open` and `project_validate` backed by `loadProjectContract()`, `validateProjectContract()`, and `assessWorkflowForwardCompatibility()`.
  - Notes: `project_open` should return config, key paths, and enabled languages; `project_validate` should return validation and workflow-compatibility state.
- [ ] Task 8: Implement page MCP tools
  - File: `packages/mcp/src/tools/page-tools.ts`
  - Action: Add handlers for `page_list`, `page_get`, `page_find`, `page_create`, `page_update`, and `page_set_status`.
  - Notes: Read operations should mirror current CLI behavior; write operations should call the new core authoring services and require explicit `projectRoot` and `lang`. `page_update` must use a shallow-merge patch with an explicit mutable-field whitelist.
- [ ] Task 9: Implement navigation MCP tools
  - File: `packages/mcp/src/tools/navigation-tools.ts`
  - Action: Add a handler for `nav_get` using `loadNavigation()`.
  - Notes: Return the canonical navigation document and source file path; defer navigation mutation tools to a later slice.
- [ ] Task 10: Implement the stdio MCP server
  - File: `packages/mcp/src/server.ts`
  - Action: Register the v1 tools with the MCP SDK server and expose a `stdio` server entrypoint.
  - Notes: Tool input schemas must keep `projectRoot` explicit; do not add session state, MCP resources, or preview/build tools in v1.
- [ ] Task 11: Add MCP package exports and startup entry
  - File: `packages/mcp/src/index.ts`
  - Action: Export server bootstrapping helpers and any public tool registration function needed by tests.
  - Notes: Keep the server startup and tool registration separable for testability.
- [ ] Task 12: Add MCP unit and integration tests
  - File: `packages/mcp/tests/tool-handlers.test.ts`
  - Action: Test each tool handler against temp project fixtures using `node:test`.
  - Notes: Verify stable success/error payloads and domain validation behavior.
- [ ] Task 13: Add end-to-end stdio server tests
  - File: `packages/mcp/tests/server.test.ts`
  - Action: Spawn the MCP server process and verify it can serve the registered tool set and execute representative tool calls.
  - Notes: Reuse the process-spawn testing pattern already used in CLI tests.
- [ ] Task 14: Document MCP usage and terminology
  - File: `README.md`
  - Action: Add a section describing the new installable MCP server, include a copy-pasteable Codex configuration example using `stdio`, and clarify that `dist/mcp/*.json` are machine-readable artifacts rather than the runtime MCP server.
  - Notes: Keep wording consistent with the new authoring-focused MCP capability.

### Acceptance Criteria

- [ ] AC 1: Given a valid Anydocs project root, when an agent tool connects to the new `@anydocs/mcp` server over `stdio`, then the server registers the v1 Anydocs tool set and remains available for tool calls without requiring HTTP transport.
- [ ] AC 2: Given `project_open` is called with an explicit `projectRoot`, when the target project is valid, then the tool returns the canonical project config, key path contract values, and enabled languages derived from `@anydocs/core`.
- [ ] AC 3: Given `project_validate` is called with an explicit `projectRoot`, when the target project passes contract validation, then the tool returns success plus workflow compatibility information; when validation fails, then it returns a structured domain error including rule and remediation.
- [ ] AC 4: Given `page_list`, `page_get`, or `page_find` is called with explicit `projectRoot` and `lang`, when matching pages exist, then the tools return canonical page metadata and file paths consistent with the underlying project files.
- [ ] AC 5: Given `page_create` is called with a new page id and slug, when the request satisfies project validation rules, then the tool creates a canonical page JSON file through `@anydocs/core` and returns the created page plus its file path.
- [ ] AC 6: Given `page_update` is called for an existing page, when the patch is valid, then the tool persists the updated page through the core authoring service and returns the updated canonical page; when the page does not exist, then it returns a structured validation error.
- [ ] AC 6a: Given `page_update` is called with fields outside the allowed mutable page patch contract, when the request is evaluated, then the tool rejects the update with a structured validation error rather than silently mutating unsupported fields.
- [ ] AC 7: Given `page_set_status` is called to transition a page to `published`, when publication rules are not satisfied, then the tool rejects the change with the same validation semantics enforced by the canonical repository save path.
- [ ] AC 8: Given `nav_get` is called with explicit `projectRoot` and `lang`, when the navigation file exists, then the tool returns the canonical navigation document and its source file path.
- [ ] AC 9: Given any MCP tool fails due to domain validation or missing inputs, when the server returns the result, then the payload includes a stable `ok: false` error object with `code`, `message`, `rule`, `remediation`, and contextual details where available.
- [ ] AC 10: Given repository documentation is updated, when developers review the MCP setup guidance, then the docs distinguish the new installable MCP server from the existing published `dist/mcp/*.json` machine-readable artifacts.

## Additional Context

### Dependencies

- `@anydocs/core` as the business logic layer
- `@modelcontextprotocol/sdk` for the stdio MCP server runtime
- Existing core repository and contract functions in `packages/core/src/fs/*` and `packages/core/src/services/*`

### Testing Strategy

- Add package-level tests for MCP tool handlers and stdio server behavior using `node:test`
- Reuse the repository's process-spawn integration style where end-to-end stdio behavior must be asserted
- Add core unit tests for authoring services before MCP adapter integration tests
- Manually verify a Codex-style `stdio` configuration can start the server and call at least `project_open` and `page_get`
- Add explicit tests proving the v1 server exposes tools only and does not require or register MCP resources

### Notes

- The new MCP server should let agent tools edit Anydocs project content through domain-safe tools rather than raw file mutation.
- The highest implementation risk is balancing a thin MCP adapter with the lack of pre-existing core authoring services for page mutation; adding a minimal core layer first reduces duplication and future drift.
- Navigation mutation tools are intentionally deferred from v1 to keep the first slice focused and shippable.
- The highest contract-risk item in v1 is `page_update`; keeping it to a whitelisted shallow patch avoids ambiguous deep-merge behavior for agents.
