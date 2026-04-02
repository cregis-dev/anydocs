---
title: 'Custom Page Templates and Structured Metadata'
slug: 'custom-page-templates-and-structured-metadata'
created: '2026-04-02T01:11:42+0800'
status: 'ready-for-dev'
stepsCompleted: [1, 2, 3, 4]
tech_stack:
  - 'TypeScript'
  - 'Node.js'
  - 'pnpm workspace monorepo'
  - 'Next.js App Router'
  - 'Electron + local-first Studio runtime'
  - 'MCP adapter over @anydocs/core'
files_to_modify:
  - 'packages/core/src/types/project.ts'
  - 'packages/core/src/config/project-config.ts'
  - 'packages/core/src/schemas/project-schema.ts'
  - 'packages/core/src/types/docs.ts'
  - 'packages/core/src/schemas/docs-schema.ts'
  - 'packages/core/src/fs/content-repository.ts'
  - 'packages/core/src/services/page-template-service.ts'
  - 'packages/core/src/services/authoring-service.ts'
  - 'packages/core/src/services/workflow-standard-service.ts'
  - 'packages/core/src/publishing/build-artifacts.ts'
  - 'packages/mcp/src/tools/project-tools.ts'
  - 'packages/mcp/src/tools/page-tools.ts'
  - 'packages/mcp/src/tools/shared.ts'
  - 'packages/mcp/src/resources.ts'
  - 'packages/web/components/studio/local-studio-settings.tsx'
  - 'packages/core/tests/docs-schema.test.ts'
  - 'packages/core/tests/project-contract.test.ts'
  - 'packages/core/tests/page-template-service.test.ts'
  - 'packages/core/tests/build-preview-service.test.ts'
  - 'packages/mcp/tests/tool-handlers.test.ts'
  - 'packages/web/tests/e2e/studio-authoring-flow.spec.ts'
  - 'docs/skill.md'
code_patterns:
  - 'Project configuration is the canonical extensibility surface; workflow-standard is generated from the project contract and must stay derivable from config plus paths'
  - 'Page and navigation validation is centralized in core schemas before filesystem persistence'
  - 'MCP and Studio are thin adapters over @anydocs/core and should expose domain-safe fields rather than bypassing validation'
  - 'Published artifacts use explicit whitelists when serializing machine-readable page metadata'
  - 'Built-in page templates are currently static and resolved through PAGE_TEMPLATE_DEFINITIONS plus template composition helpers'
test_patterns:
  - 'Core schema and service tests use node:test with temp project fixtures'
  - 'MCP tool tests assert structured envelopes and project_open/page_* discovery behavior'
  - 'Build-preview tests verify emitted machine-readable artifact contracts'
  - 'Studio authoring flows are covered by focused e2e tests in packages/web/tests/e2e'
---

# Tech-Spec: Custom Page Templates and Structured Metadata

**Created:** 2026-04-02T01:11:42+0800

## Overview

### Problem Statement

Anydocs currently supports only three built-in body templates, `concept`, `how_to`, and `reference`, and page-level metadata is limited to generic fields such as `description`, `tags`, `render`, and `review`. This forces teams with domain-specific document types, such as ADRs, RFCs, runbooks, or compliance records, to overload `tags` for structured fields like author, internal decision status, or approvers. That creates weak validation, inconsistent agent behavior, and poor long-term discoverability.

### Solution

Add project-defined page templates and structured page metadata driven by `anydocs.config.json`. The new model should preserve `tags` as lightweight classification labels, introduce a dedicated `page.metadata` object for structured fields, and allow project-defined templates to extend built-in body-generation behavior while declaring metadata schema and default scaffold content. Core validation remains canonical; MCP and Studio surface the same contract.

### Scope

**In Scope:**
- Add a project-config-driven authoring contract for custom page templates
- Add optional page-level `template` and `metadata` fields to canonical page documents
- Validate `page.metadata` against the selected template's metadata schema
- Allow project-defined templates to reuse built-in body composition modes (`concept`, `how_to`, `reference`)
- Expose built-in plus custom templates through `project_open.authoring.templates`
- Update Studio page settings so authors can select a template and edit structured metadata fields without using `tags`
- Extend canonical page reads and published machine-readable page artifacts to include `template` and `metadata`
- Add field-level visibility rules so internal metadata is available to authoring surfaces but not leaked into published machine-readable output
- Keep legacy pages and existing built-in templates backward compatible

**Out of Scope:**
- Arbitrary root-level custom page fields outside a namespaced `metadata` object
- A visual template builder or drag-and-drop schema designer in Studio
- Metadata-driven reader filtering, faceting, or search UI changes
- Arbitrary nested JSON-schema support; the first slice should support a constrained field model
- Project-specific MCP resource URIs for custom templates in the first slice
- Automatic bulk migration of existing tag conventions into structured metadata

## Context for Development

### Codebase Patterns

- `packages/core/src/types/project.ts`, `packages/core/src/config/project-config.ts`, and `packages/core/src/schemas/project-schema.ts` together define and validate project-level configuration. Any new extensibility surface must be introduced there first.
- `packages/core/src/types/docs.ts` and `packages/core/src/schemas/docs-schema.ts` are the canonical page contract. Filesystem persistence and tool adapters should consume these types rather than inventing parallel validation.
- `packages/core/src/fs/content-repository.ts` already owns project-contract loading and project-wide invariants. Any rule about dangling template ids or project-scoped page validity should be enforced there during contract validation, not left to Studio or MCP only.
- `packages/core/src/services/page-template-service.ts` currently hardcodes built-in templates and composes rich body content from normalized `summary`, `sections`, `steps`, and `callouts`. The safest way to add custom templates is to layer config-defined wrappers over the existing built-in composition model rather than inventing a new renderer.
- `packages/mcp/src/tools/project-tools.ts` already returns `project_open.authoring.templates`; that makes `project_open` the right project-scoped discovery surface for custom templates because MCP resources are currently static, not project-root-aware.
- `packages/web/components/studio/local-studio-settings.tsx` already owns page metadata editing for title, description, and tags. Template selection and metadata field editing belong in this panel, not in ad hoc editor blocks.
- `packages/core/src/publishing/build-artifacts.ts` manually whitelists page data into search, chunks, `llms.txt`, and `dist/mcp/pages.<lang>.json`. Any new published metadata must be added deliberately.

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `packages/core/src/types/project.ts` | Canonical project config types; likely home for authoring template definitions |
| `packages/core/src/config/project-config.ts` | Default project config creation; must preserve backward compatibility |
| `packages/core/src/schemas/project-schema.ts` | Project config validation; must validate custom templates and metadata schema definitions |
| `packages/core/src/types/docs.ts` | Canonical page type; must grow `template` and `metadata` |
| `packages/core/src/schemas/docs-schema.ts` | Canonical page validation; must validate template references and metadata payload shape |
| `packages/core/src/fs/content-repository.ts` | Project contract loading and validation; must detect pages that reference missing templates |
| `packages/core/src/services/page-template-service.ts` | Built-in template registry and composition behavior |
| `packages/core/src/services/authoring-service.ts` | Page create/update contract and mutable-field whitelist |
| `packages/core/src/services/workflow-standard-service.ts` | Generated workflow-standard content model derived from project contract |
| `packages/core/src/publishing/build-artifacts.ts` | Published machine-readable page metadata serialization |
| `packages/mcp/src/tools/project-tools.ts` | `project_open` authoring discovery output |
| `packages/mcp/src/tools/page-tools.ts` | Page create/update/template tool contracts |
| `packages/mcp/src/tools/shared.ts` | Page summary envelope used by `page_list` and `page_find` |
| `packages/mcp/src/resources.ts` | Static built-in template resources; must remain coherent with new project-scoped template behavior |
| `packages/web/components/studio/local-studio-settings.tsx` | Current page metadata editing UI in Studio |
| `packages/core/tests/project-contract.test.ts` | Existing assertions about generated workflow-standard drift and optional page fields |
| `packages/mcp/tests/tool-handlers.test.ts` | Tool-level contract coverage for `project_open` and page operations |

### Technical Decisions

- Add project-defined templates under `anydocs.config.json` rather than hand-editing `anydocs.workflow.json`. The workflow file is generated and contract-checked, so it should remain a derived machine-readable snapshot, not the canonical authoring source.
- Preserve `tags` as lightweight labels for categorization, search, and filtering. Structured fields such as author, internal state, approvers, or document-specific status belong in `page.metadata`.
- Add `page.template?: string` and `page.metadata?: Record<string, unknown>` to the canonical page model. Keeping custom fields namespaced under `metadata` avoids unbounded page-root growth and keeps validation tractable.
- Keep Anydocs publication `status` separate from domain-specific metadata status. For example, ADR decision state belongs in `page.metadata.decisionStatus`, not `page.status`.
- Use a constrained metadata field schema in the first slice. Support only `string`, `text`, `enum`, `boolean`, `date`, and `string[]`. Defer nested objects, unions, and arbitrary JSON Schema.
- Metadata is valid only when `page.template` is set. If a page has no template, `page.metadata` must be omitted. If a template defines no metadata fields, `page.metadata` must also be omitted.
- Template-specific validation must be split cleanly: `docs-schema` remains shape-only for `template` and `metadata`, while a new project-aware validator in core enforces template existence, metadata-field rules, and visibility constraints. That validator must be called from page write flows and from project-contract validation over persisted pages.
- If a page references a template id that no longer exists in project config, `loadProjectContract` / `project_validate` must fail with a structured validation error naming the page id and missing template id. Existing files are not rewritten automatically.
- `page_update` keeps its current top-level shallow-patch behavior, so `metadata` replacement is all-or-nothing in v1. Studio and MCP clients must send the full normalized `metadata` object on each update rather than partial nested patches.
- Define custom templates as wrappers over built-in body template modes, for example `baseTemplate: 'reference'`, plus optional default `summary`, `sections`, `steps`, and `callouts`. This keeps current composition logic reusable and avoids inventing a second rendering contract.
- Custom scaffold merge behavior must be deterministic: explicit caller `summary` overrides template default summary; default `sections`, `steps`, and `callouts` are prepended in configured order; caller-provided items are appended in request order; no automatic deduplication is attempted.
- `project_open.authoring.templates` becomes the authoritative project-scoped discovery response for both built-in and custom templates. Keep `anydocs://templates/*` resources focused on built-in templates in v1 because current resources are not project-root-aware.
- Template labels and metadata-field labels should support the same localization model already used elsewhere in config: either a single string or a language-keyed object. Studio should resolve the active page language first and fall back to any available label.
- Metadata field definitions need explicit normalization rules: `string` and `text` are trimmed and omitted if empty; `enum` stores the option id; `boolean` stores a strict boolean; `date` stores `YYYY-MM-DD`; `string[]` stores trimmed, non-empty, de-duplicated strings in input order.
- Metadata fields need explicit visibility. Support `public` and `internal`, defaulting to `internal` for safety. Authoring surfaces can read/write both; published machine-readable artifacts must serialize only `public` metadata.
- `page_list` and `page_find` summaries should include `template` but omit `metadata` in v1 to keep list payloads stable and avoid leaking bulky or internal fields. Full page reads and write responses should include full `metadata`.
- Serialize `template` and only public `metadata` into published machine-readable page artifacts in `dist/mcp/pages.<lang>.json`, but do not add metadata facets to the search index or reader UI in this slice.

## Implementation Plan

### Recommended Delivery Slices

Implement this work in small vertical slices so contract changes stabilize before adapter and UI work.

#### Slice 1: Project Config Contract

- Goal: define the project-scoped authoring template schema without changing page persistence yet
- Files:
  - `packages/core/src/types/project.ts`
  - `packages/core/src/config/project-config.ts`
  - `packages/core/src/schemas/project-schema.ts`
  - `packages/core/src/services/workflow-standard-service.ts`
  - `packages/core/tests/project-contract.test.ts`
- Output:
  - `authoring.pageTemplates` exists in config types and validation
  - workflow-standard reflects the new config surface
  - invalid template schemas fail early at contract load time

#### Slice 2: Page Contract and Canonical Validator

- Goal: make page files capable of carrying `template` and `metadata`, then enforce project-aware validity in one place
- Files:
  - `packages/core/src/types/docs.ts`
  - `packages/core/src/schemas/docs-schema.ts`
  - `packages/core/src/services/page-template-service.ts`
  - `packages/core/src/fs/content-repository.ts`
  - `packages/core/tests/docs-schema.test.ts`
  - `packages/core/tests/page-template-service.test.ts`
  - `packages/core/tests/project-contract.test.ts`
- Output:
  - `PageDoc` supports `template` and `metadata`
  - project-aware validator resolves templates, normalizes metadata, enforces visibility, and rejects unknown template ids
  - `loadProjectContract` fails when persisted pages reference missing templates

#### Slice 3: Authoring-Service Persistence Semantics

- Goal: wire the canonical validator into create/update flows and lock update semantics before exposing adapters
- Files:
  - `packages/core/src/services/authoring-service.ts`
  - `packages/core/src/services/page-template-service.ts`
  - `packages/core/tests/authoring-service.test.ts`
  - `packages/core/tests/page-template-service.test.ts`
- Output:
  - create/update flows accept `template` and `metadata`
  - `metadata` replacement semantics are explicit and tested
  - custom template scaffold merge rules are deterministic

#### Slice 4: MCP Discovery and Authoring Surface

- Goal: expose the new contract to agents only after core rules are stable
- Files:
  - `packages/mcp/src/tools/project-tools.ts`
  - `packages/mcp/src/tools/page-tools.ts`
  - `packages/mcp/src/tools/shared.ts`
  - `packages/mcp/src/resources.ts`
  - `packages/mcp/tests/tool-handlers.test.ts`
- Output:
  - `project_open.authoring.templates` returns built-in plus custom templates
  - page tool inputs and outputs support `template` and `metadata`
  - summaries include `template` but omit `metadata`

#### Slice 5: Studio Template and Metadata UI

- Goal: let human authors use the new contract after core and MCP behavior are proven
- Files:
  - `packages/web/components/studio/local-studio-settings.tsx`
  - `packages/web/tests/e2e/studio-authoring-flow.spec.ts`
- Output:
  - page settings can select templates and edit structured metadata
  - Studio submits full normalized metadata payloads

#### Slice 6: Published Artifact Propagation

- Goal: serialize only the public subset into published machine-readable output
- Files:
  - `packages/core/src/publishing/build-artifacts.ts`
  - `packages/core/tests/build-preview-service.test.ts`
- Output:
  - published pages artifacts include `template`
  - only `public` metadata is emitted
  - search indexes remain unchanged

#### Slice 7: Guidance and Rollout

- Goal: align agent guidance and adoption instructions with the shipped behavior
- Files:
  - `docs/skill.md`
- Output:
  - agents stop using `tags` as structured metadata
  - rollout notes explain incremental migration from legacy tag conventions

### Recommended Commit Order

1. Commit 1: project-config schema and workflow-standard updates
2. Commit 2: page contract plus project-aware validator
3. Commit 3: authoring-service persistence and scaffold merge semantics
4. Commit 4: MCP discovery and page tool contract updates
5. Commit 5: Studio metadata editor and e2e coverage
6. Commit 6: published artifact serialization and build-preview coverage
7. Commit 7: guidance/docs cleanup

### Gating Rules Between Slices

- Do not start Slice 4 before Slice 3 passes, or MCP will expose unstable semantics.
- Do not start Slice 5 before Slice 4 passes, or Studio will encode behavior that agents cannot reproduce.
- Do not start Slice 6 before visibility filtering is implemented in core, or internal metadata can leak into published artifacts.
- Keep docs and guidance last so they describe the final settled contract rather than an in-flight draft.

### Tasks

- [ ] Task 1: Extend the canonical project config with authoring template definitions
  - File: `packages/core/src/types/project.ts`
  - Action: Add `authoring` config types for project-defined page templates, including template id, label, description, `baseTemplate`, optional default scaffold content, and metadata field definitions.
  - Notes: Keep the shape explicit and limited; do not model arbitrary JSON Schema.

- [ ] Task 2: Add project config defaults and validation for custom templates
  - File: `packages/core/src/config/project-config.ts`
  - Action: Preserve backward-compatible default config creation while allowing an optional `authoring` section to pass through.
  - Notes: Existing projects without `authoring` must remain valid and unchanged.
  - File: `packages/core/src/schemas/project-schema.ts`
  - Action: Validate the new `authoring.pageTemplates` structure, template ids, localized labels, supported metadata field types, enum option requirements, field visibility, and unique ids for templates, fields, and enum options.
  - Notes: Reject invalid schema definitions early at project-load time.

- [ ] Task 3: Extend the canonical page document with template and metadata
  - File: `packages/core/src/types/docs.ts`
  - Action: Add optional `template` and `metadata` fields to `PageDoc`.
  - Notes: `metadata` should be a page-owned field, distinct from `review.metadata`.
  - File: `packages/core/src/schemas/docs-schema.ts`
  - Action: Accept and normalize `template` and `metadata` at the page schema layer as shape-only fields.
  - Notes: `metadata` must still be an object when present; template-specific validation is handled by a project-aware validator, not by bare page-shape validation.

- [ ] Task 4: Add a canonical project-aware page authoring validator
  - File: `packages/core/src/services/page-template-service.ts`
  - Action: Add reusable helpers to resolve the effective template definition for a project, validate a page against the project authoring contract, normalize metadata values, and filter public metadata for publication.
  - Notes: This is the single source of truth for template existence, metadata normalization, and visibility handling.
  - File: `packages/core/src/fs/content-repository.ts`
  - Action: During project-contract validation, enumerate persisted pages for enabled languages and fail if any page references an unknown template or invalid metadata for its template.
  - Notes: This closes the gap where config edits could invalidate existing pages without being caught until authoring time.

- [ ] Task 5: Resolve built-in and custom templates through core services
  - File: `packages/core/src/services/page-template-service.ts`
  - Action: Add a project-aware template resolution layer that merges built-in templates with config-defined templates and allows custom templates to reuse built-in composition behavior.
  - Notes: Preserve `concept`, `how_to`, and `reference` as first-class built-ins; custom templates should reference a built-in `baseTemplate`.
  - File: `packages/core/src/services/authoring-service.ts`
  - Action: Extend page create/update flows so `template` and `metadata` are accepted, persisted, and validated through the canonical project-aware validator.
  - Notes: Update mutable-field whitelists and error messages so invalid metadata, unknown templates, or forbidden `metadata`-without-`template` requests fail as structured validation errors.
  - Notes: Document and enforce that `patch.metadata` replaces the full metadata object in v1.

- [ ] Task 6: Reflect the new content model in generated workflow metadata
  - File: `packages/core/src/services/workflow-standard-service.ts`
  - Action: Update the generated workflow standard so `projectConfigFields` includes `authoring` and page optional fields include `template` and `metadata`.
  - Notes: This file remains derived from project contract state; do not make it independently editable.

- [ ] Task 7: Update MCP discovery and page tool contracts
  - File: `packages/mcp/src/tools/project-tools.ts`
  - Action: Return built-in plus custom templates from `project_open.authoring.templates`, including metadata field definitions needed by agent clients.
  - Notes: This becomes the primary project-scoped template discovery surface.
  - File: `packages/mcp/src/tools/page-tools.ts`
  - Action: Add `template` and `metadata` to `page_create`, `page_update`, `page_batch_create`, and templated page tool inputs where appropriate.
  - Notes: Reject unsupported patch fields with the same strictness as today, and document that `metadata` patching replaces the entire object.
  - File: `packages/mcp/src/tools/shared.ts`
  - Action: Extend summarized page responses to include `template` only, while leaving `metadata` for full page payloads such as `page_get` and write responses.
  - Notes: This avoids accidental leakage of internal metadata in list views and keeps summaries compact.
  - File: `packages/mcp/src/resources.ts`
  - Action: Clarify built-in resource descriptions so they remain built-in examples, while project-specific template discovery happens through `project_open`.
  - Notes: Avoid a misleading partial implementation of project-scoped resources in v1.

- [ ] Task 8: Add Studio support for template selection and metadata editing
  - File: `packages/web/components/studio/local-studio-settings.tsx`
  - Action: Add a template selector and schema-driven metadata inputs to page settings.
  - Notes: Use field-type-aware controls such as text input, textarea, select, checkbox, date input, and comma-separated list parsing for `string[]`.
  - Notes: Studio must submit full normalized `metadata` objects on save because partial nested patch semantics are out of scope in v1.
  - Notes: Preserve existing tags editing; present tags as labels, not as structured metadata.

- [ ] Task 9: Extend template-driven authoring to initialize body scaffold
  - File: `packages/core/src/services/page-template-service.ts`
  - Action: When creating a page from a custom template, merge the custom template's default scaffold with caller-provided summary/sections/steps/callouts before composition using deterministic precedence and ordering rules.
  - Notes: Custom templates should be able to predefine recurring sections such as Context, Decision, Alternatives, or Compliance Checklist.
  - File: `packages/mcp/src/tools/page-tools.ts`
  - Action: Allow template-based create/update operations to reference custom template ids, not just the built-in enum.
  - Notes: Keep unknown-template errors explicit and project-aware.

- [ ] Task 10: Extend published machine-readable page artifacts
  - File: `packages/core/src/publishing/build-artifacts.ts`
  - Action: Add `template` and filtered public `metadata` to `dist/mcp/pages.<lang>.json` for published pages.
  - Notes: Keep search indexes tag-oriented in this slice; do not add metadata-based search facets yet.

- [ ] Task 11: Add regression coverage across config, core, MCP, and Studio
  - File: `packages/core/tests/docs-schema.test.ts`
  - Action: Cover page validation for `template`, `metadata`, and invalid metadata shapes.
  - Notes: Include legacy pages without template/metadata to prove backward compatibility.
  - File: `packages/core/tests/project-contract.test.ts`
  - Action: Verify workflow-standard generation includes `authoring`, `template`, and `metadata`, that invalid template config fails validation, and that pages referencing removed templates cause project validation to fail.
  - Notes: Include drift assertions so generated workflow metadata stays aligned.
  - File: `packages/core/tests/page-template-service.test.ts`
  - Action: Cover custom-template resolution, scaffold defaults, metadata normalization, visibility filtering, and metadata-without-template rejection paths.
  - Notes: Ensure built-ins still behave exactly as before.
  - File: `packages/core/tests/build-preview-service.test.ts`
  - Action: Assert published machine-readable pages artifacts serialize `template` and only public metadata when configured.
  - Notes: Search index assertions should remain unchanged unless explicitly expanded.
  - File: `packages/mcp/tests/tool-handlers.test.ts`
  - Action: Cover `project_open` template discovery plus page create/update flows using `template` and `metadata`.
  - Notes: Validate both happy path and structured validation failure cases, including full-object metadata replacement semantics.
  - File: `packages/web/tests/e2e/studio-authoring-flow.spec.ts`
  - Action: Add a Studio authoring flow that selects a custom template, edits metadata, saves, and reloads.
  - Notes: Assert tags remain independent from structured metadata.

- [ ] Task 12: Update authoring guidance and rollout notes
  - File: `docs/skill.md`
  - Action: Update authoring guidance so agents understand that `tags` are labels, project-defined templates come from `project_open.authoring.templates`, and structured fields belong in `page.metadata`.
  - Notes: Keep the guidance aligned with the new MCP contract and Studio behavior.
  - Notes: Include a manual rollout note for existing projects: keep tags as-is, introduce template+metadata incrementally, and do not assume old tag conventions are auto-mapped.

### Acceptance Criteria

- [ ] AC 1: Given a project config defines one or more custom page templates under `authoring.pageTemplates`, when the project is opened through core or `project_open`, then built-in and custom templates are returned together with enough metadata schema detail for authoring clients to render inputs.
- [ ] AC 2: Given an existing project without `authoring`, `page.template`, or `page.metadata`, when the project is loaded, edited, built, or previewed, then it remains valid and behaves exactly as before.
- [ ] AC 3: Given a page references a custom template with required metadata fields, when the page is created or updated through core, MCP, or Studio, then missing or invalid metadata is rejected with a structured validation error that names the field and rule.
- [ ] AC 4: Given a project defines a custom template with `baseTemplate: "reference"` and default sections, when an author creates a page from that template, then the generated page body includes the configured scaffold and still uses the built-in reference composition path.
- [ ] AC 5: Given a page carries both `tags` and structured `metadata`, when the page is saved and later reloaded, then tags remain unchanged as labels and metadata remains preserved as a distinct object under the page document.
- [ ] AC 6: Given `page_create`, `page_update`, `page_create_from_template`, or `page_update_from_template` is called with `template` and `metadata`, when the request is valid, then the canonical page file persists those fields; when the template id is unknown or metadata violates the template schema, then the tool returns a structured validation error.
- [ ] AC 7: Given a page uses a custom template, when the page is opened in Studio, then the settings panel shows the selected template and renders the configured metadata inputs using controls appropriate to each field type.
- [ ] AC 8: Given a metadata field is marked `internal`, when a page is read through authoring surfaces such as Studio, MCP `page_get`, or write responses, then the field is preserved; when `build` writes published machine-readable pages artifacts, then that field is omitted.
- [ ] AC 9: Given a page references a template id that no longer exists in `authoring.pageTemplates`, when `loadProjectContract` or `project_validate` runs, then project validation fails with a structured error naming the page id and missing template id.
- [ ] AC 10: Given `page_update` is used to modify structured metadata, when the update is persisted, then the provided `metadata` object replaces the previous metadata object as a whole rather than performing an implicit nested merge.
- [ ] AC 11: Given a page includes `metadata` but omits `template`, or references a template that defines no metadata fields, when the page is validated, then the request fails with a structured validation error instead of silently accepting unscoped metadata.
- [ ] AC 12: Given template or metadata-field labels are localized objects, when Studio renders authoring controls for a page language, then it uses the matching language label when available and otherwise falls back deterministically.
- [ ] AC 13: Given built-in template resources are queried through `anydocs://templates/index` or `anydocs://templates/{templateId}`, when the request is served, then built-in templates remain available and their documentation does not imply unsupported project-scoped resource discovery.

## Additional Context

### Dependencies

- Existing core project config and page validation infrastructure
- Existing built-in template composition flow in `packages/core/src/services/page-template-service.ts`
- Existing MCP `project_open` authoring discovery response
- Existing Studio page settings metadata editor

### Testing Strategy

- Add focused schema tests for project-config template definitions and page metadata validation
- Add service-level tests for project-aware template resolution and scaffold composition
- Add MCP tool tests for discovery, create, update, and validation failures involving `template` and `metadata`
- Add build artifact tests to verify the machine-readable published page contract grows intentionally
- Add one Studio e2e flow proving a custom template can be selected and structured metadata survives save/reload
- Manually verify an example config with an ADR-like template can be opened, authored, and built without using tags for author/status fields

### Notes

- Recommended first-slice metadata field types: `string`, `text`, `enum`, `boolean`, `date`, and `string[]`. Anything more complex should wait for evidence that teams need it.
- Normalization rules for v1 metadata fields:
  - `string` / `text`: trim leading and trailing whitespace; omit empty results
  - `enum`: persist the configured option id, not the display label
  - `boolean`: persist only `true` or `false`
  - `date`: persist `YYYY-MM-DD`
  - `string[]`: trim, drop empty values, de-duplicate while preserving first-seen order
- Visibility rules for v1 metadata fields:
  - `internal`: visible to authoring surfaces only
  - `public`: visible to authoring surfaces and eligible for published machine-readable serialization
- Recommended page contract addition:

```json
{
  "id": "adr-001",
  "template": "adr",
  "tags": ["architecture", "decision"],
  "metadata": {
    "decisionStatus": "accepted",
    "author": "shawn"
  }
}
```

- Recommended config shape:

```json
{
  "authoring": {
    "pageTemplates": [
      {
        "id": "adr",
        "label": { "en": "ADR", "zh": "架构决策记录" },
        "description": "Architecture decision record",
        "baseTemplate": "reference",
        "defaultSections": [
          { "title": "Context", "body": "Describe the forces and constraints." },
          { "title": "Decision", "body": "Describe the chosen direction." },
          { "title": "Alternatives", "body": "Describe the options considered." }
        ],
        "metadataSchema": {
          "fields": [
            { "id": "decisionStatus", "label": { "en": "Decision Status", "zh": "决策状态" }, "type": "enum", "visibility": "public", "required": true, "options": ["proposed", "accepted", "superseded"] },
            { "id": "author", "label": { "en": "Author", "zh": "作者" }, "type": "string", "visibility": "internal", "required": true }
          ]
        }
      }
    ]
  }
}
```

- The highest risk is over-designing the schema system into a generic form engine. Keep v1 intentionally narrow and opinionated so validation, Studio rendering, MCP discovery, and template composition stay aligned.
- The second highest risk is trying to retrofit project-specific template details into the current static MCP resources contract. Keep project-scoped discovery in `project_open` first, then revisit project-aware resources later if client demand justifies it.
- Rollout guidance for existing projects should stay manual and low-risk:
  - Keep existing tags unchanged
  - Add `authoring.pageTemplates` first
  - Update selected pages to set `template` and `metadata`
  - Only remove legacy tag conventions after downstream consumers stop depending on them
