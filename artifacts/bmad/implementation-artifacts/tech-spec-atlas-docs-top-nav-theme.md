---
title: 'atlas-docs top-nav theme'
slug: 'atlas-docs-top-nav-theme'
created: '2026-03-17T00:00:00+08:00'
status: 'draft'
stepsCompleted: [1, 2, 3]
tech_stack:
  - 'TypeScript'
  - 'Node.js'
  - 'Next.js 15 App Router'
  - 'React'
  - 'Tailwind CSS v4'
  - 'MiniSearch'
files_to_modify:
  - 'packages/core/src/types/project.ts'
  - 'packages/core/src/schemas/project-schema.ts'
  - 'packages/core/src/types/docs.ts'
  - 'packages/core/src/schemas/docs-schema.ts'
  - 'packages/core/src/publishing/build-artifacts.ts'
  - 'packages/web/lib/themes/types.ts'
  - 'packages/web/lib/themes/registry.ts'
  - 'packages/web/themes/atlas-docs/manifest.ts'
  - 'packages/web/themes/atlas-docs/reader-layout.tsx'
  - 'packages/web/themes/atlas-docs/tokens.css'
  - 'packages/web/components/docs/sidebar.tsx'
  - 'packages/web/components/studio/local-studio-app.tsx'
  - 'packages/web/components/studio/local-studio-settings.tsx'
  - 'packages/core/tests/project-contract.test.ts'
  - 'packages/core/tests/docs-schema.test.ts'
  - 'packages/core/tests/build-preview-service.test.ts'
code_patterns:
  - 'Theme shells are isolated under packages/web/themes/<themeId>/'
  - 'Theme selection remains project-scoped through site.theme.id'
  - 'Theme-specific shell metadata belongs in project config, not in page content'
  - 'Navigation references must validate against canonical navigation ids in core'
  - 'Studio should present stable references through selectors rather than requiring raw id entry'
test_patterns:
  - 'packages/core/tests/project-contract.test.ts'
  - 'packages/core/tests/docs-schema.test.ts'
  - 'packages/core/tests/build-preview-service.test.ts'
---

# Tech-Spec: atlas-docs top-nav theme

**Created:** 2026-03-17T00:00:00+08:00

## Overview

### Problem Statement

The current reader model only supports a single left navigation tree per language. That works for `classic-docs`, but it cannot represent a theme where the top navigation acts as a first-level information architecture layer and switches the visible scope of the left navigation. The current project theme contract also has no place to configure such top-level navigation items, and the navigation schema has no stable top-level group ids that a top-nav item can safely reference across languages.

### Solution

Introduce a new reader theme named `atlas-docs` that supports a two-level reader shell:

- brand area
- optional top navigation
- left navigation scoped by the selected top-nav group
- main article area
- optional right-side table of contents

To support that shell cleanly, extend project configuration with an optional `site.navigation.topNav` contract and extend top-level navigation groups with stable ids. Themes that do not support top navigation, including `classic-docs`, must ignore `site.navigation.topNav` and continue rendering the full left navigation tree.

### Scope

**In Scope:**
- Create a new reader theme id, `atlas-docs`
- Add optional project-level top-nav configuration under `site.navigation.topNav`
- Add stable ids for top-level `section` / `folder` navigation groups
- Allow top-nav items to be either `nav-group` or `external`
- Let `atlas-docs` filter the left sidebar to the active top-nav group
- Keep `classic-docs` fully backward compatible and top-nav agnostic
- Add Studio controls for configuring top-nav items and top-level group ids
- Add validation, serialization, and artifact metadata support for the new contract

**Out of Scope:**
- Retrofitting `classic-docs` to visually display top navigation
- Top-nav nesting or multi-level menus
- Separate navigation files per top-nav group
- URL-level explicit `groupId` routing in v1
- Rich per-item icons, badges, auth gating, or role-based visibility
- Arbitrary group references below the top level of the navigation tree

## Context for Development

### Design Assessment

The supplied Figma reference was reviewed at node `27:40` in file `P5R5AtNaaMtB96h1KmEz98`.

Observed facts from the selected node:
- The selected frame is a three-column reader shell: left navigation, main article, right table of contents.
- The left navigation already uses grouped sections, which aligns with the proposed grouped-sidebar model.
- The selected frame itself does not include a visible top navigation row.
- The frame origin starts at `y=65`, which suggests there may be a parent-level header outside the selected node, but this could not be confirmed because subsequent Figma MCP calls hit the seat plan limit.

Assessment:
- The selected design is directionally aligned on layout density, grouped left navigation, and right-side table of contents.
- It is not sufficient evidence that the top-nav layer has already been designed.
- Until a broader page-level frame is confirmed, `atlas-docs` should be treated as a new theme spec that is only partially represented by the current Figma selection.

### Naming Decision

Use `atlas-docs` as the working theme id and spec name.

Rationale:
- It implies site-map and knowledge-domain navigation rather than a purely visual skin.
- It is clearly distinct from `classic-docs`.
- It leaves room for future theme families without baking implementation details into the name.

### Codebase Patterns

- Reader themes are isolated under `packages/web/themes/<themeId>/`.
- Theme selection is project-scoped through `site.theme.id`.
- Project-level reader settings belong in the project contract and are resolved once for build, preview, and runtime.
- Shared navigation validation already lives in core and should remain the canonical place to enforce cross-reference integrity.
- Studio settings should expose project-config-driven theme controls only when they are meaningful for the active theme.

## Contract Changes

### 1. Project Config

Add optional site navigation shell metadata:

```json
{
  "site": {
    "theme": {
      "id": "atlas-docs"
    },
    "navigation": {
      "topNav": [
        {
          "id": "guides",
          "type": "nav-group",
          "groupId": "guides",
          "label": {
            "zh": "指南",
            "en": "Guides"
          }
        },
        {
          "id": "github",
          "type": "external",
          "href": "https://github.com/anydocs/anydocs",
          "openInNewTab": true,
          "label": {
            "zh": "GitHub",
            "en": "GitHub"
          }
        }
      ]
    }
  }
}
```

Rules:
- `site.navigation` is optional
- `site.navigation.topNav` is optional
- top-nav items support only `nav-group` and `external` in v1
- themes that do not support top-nav must ignore this configuration

### 2. Navigation Document

Add stable ids to top-level `section` and `folder` items:

```json
{
  "version": 2,
  "items": [
    {
      "id": "guides",
      "type": "section",
      "title": "指南",
      "children": []
    }
  ]
}
```

Rules:
- `id` is optional unless the node is referenced by `site.navigation.topNav`
- v1 top-nav references can only target top-level `section` or `folder` items
- ids must remain stable across enabled languages when a top-nav item references them

### 3. Theme Manifest Capabilities

Extend theme manifests with explicit capabilities:

```ts
capabilities: {
  topNav: boolean;
  topNavGroupSwitching: boolean;
}
```

Initial expectations:
- `classic-docs`: `false`, `false`
- `atlas-docs`: `true`, `true`

## Reader Behavior

### Theme Compatibility

When the active theme does **not** support top-nav:
- ignore `site.navigation.topNav`
- render the full left navigation tree
- preserve existing behavior for `classic-docs`

When the active theme **does** support top-nav:
- if `topNav` is empty, render brand area only and keep the full left navigation tree
- if `topNav` contains only external links, render them in the header and keep the full left navigation tree
- if `topNav` contains `nav-group` items, filter the left navigation to the active group

### Active Group Resolution

Use this priority order:

1. If the current page belongs to a referenced group, select that group automatically.
2. Otherwise, if one or more `nav-group` items exist, select the first `nav-group`.
3. Otherwise, fall back to the full left navigation tree.

### Left Sidebar Filtering

Given an active `groupId`:
- find the top-level `section` or `folder` whose `id` matches
- render only that group's `children` in the left navigation pane
- if the matched group is missing or invalid at runtime, fall back to the full navigation tree instead of rendering an empty shell

### External Links

External items:
- do not affect left-sidebar state
- navigate immediately to `href`
- honor `openInNewTab`

## Studio UX

### Navigation Editor

Add top-level group-id support:
- show `Group ID` only on top-level `section` and `folder` items
- generate a slug-like default when a new top-level group is created
- do not silently rewrite ids when titles change
- show a usage badge when a group is referenced by `topNav`

### Project Settings

Add `Top Navigation` management when the selected theme supports top-nav:
- reorder items
- add `nav-group` items
- add `external` items
- configure labels
- select a target group from a dropdown rather than typing raw ids

When the active theme does not support top-nav:
- do not show the full editing surface
- show a passive note that saved top-nav config is preserved but not rendered by the current theme

## Validation Rules

- `topNav[].id` must be unique
- `nav-group.groupId` must reference a top-level `section` or `folder` id
- referenced group ids must exist in every enabled language
- `external.href` must be a valid URL
- labels must be non-empty
- navigation ids used by top-nav must be unique within a language

Reader runtime should be tolerant:
- ignore broken items
- fall back to the full navigation tree
- never fail the page render solely due to a top-nav mismatch

Studio and contract loading should be strict:
- surface clear remediation for missing or inconsistent group ids

## Implementation Plan

### Tasks

- [ ] Task 1: Extend core project types and schema for `site.navigation.topNav`
- [ ] Task 2: Extend navigation types and schema so top-level groups can carry stable ids
- [ ] Task 3: Add theme manifest capability metadata and expose it through the web theme registry
- [ ] Task 4: Create the `atlas-docs` theme shell and tokens
- [ ] Task 5: Implement group-aware left-sidebar rendering in `atlas-docs`
- [ ] Task 6: Add Studio support for top-nav item editing and top-level group-id editing
- [ ] Task 7: Serialize the new site-navigation metadata into build artifacts
- [ ] Task 8: Add tests for config validation, nav-group integrity, and compatibility fallback behavior

### Acceptance Criteria

- [ ] AC 1: Given a project using `classic-docs`, when `site.navigation.topNav` is present, then the reader ignores it and still renders the full left navigation tree.
- [ ] AC 2: Given a project using `atlas-docs` with `nav-group` items configured, when a page belongs to one of those groups, then the matching top-nav item is selected and the left navigation shows only that group's children.
- [ ] AC 3: Given a project using `atlas-docs` with only external top-nav items, when the reader loads, then the header shows those links and the left navigation remains unfiltered.
- [ ] AC 4: Given a top-nav item references a missing or inconsistent group id, when the project contract is loaded in Studio or build flows, then validation fails with a targeted error.
- [ ] AC 5: Given a broken top-nav item still reaches runtime, when the reader renders, then the page remains usable and falls back to the full left navigation tree.
- [ ] AC 6: Given Studio creates or edits top-nav items, when the project is saved and reloaded, then labels, external URLs, ordering, and group references round-trip correctly.

## Risks and Notes

- Highest product risk: over-complicating a simple docs reader by mixing site-shell configuration with content modeling. Keep the top-nav contract intentionally narrow.
- Highest implementation risk: leaking `atlas-docs` assumptions into the shared sidebar component. Prefer a theme-specific wrapper if shared props start to sprawl.
- Design risk: the supplied Figma node only partially reflects the intended top-nav theme. A parent-level frame or additional design variant should be confirmed before visual implementation begins.
