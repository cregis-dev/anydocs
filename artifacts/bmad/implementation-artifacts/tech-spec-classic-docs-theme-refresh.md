---
title: 'classic-docs theme refresh'
slug: 'classic-docs-theme-refresh'
created: '2026-03-15T00:00:00+08:00'
status: 'ready-for-dev'
stepsCompleted: [1, 2, 3, 4]
tech_stack:
  - 'TypeScript'
  - 'Node.js'
  - 'Next.js 15 App Router'
  - 'React'
  - 'Tailwind CSS v4'
  - 'MiniSearch'
files_to_modify:
  - 'packages/core/src/config/project-config.ts'
  - 'packages/core/src/publishing/build-artifacts.ts'
  - 'packages/web/themes/classic-docs/reader-layout.tsx'
  - 'packages/web/themes/classic-docs/tokens.css'
  - 'packages/web/components/docs/sidebar.tsx'
  - 'packages/web/components/docs/search-panel.tsx'
  - 'packages/core/src/types/project.ts'
  - 'packages/core/src/schemas/project-schema.ts'
  - 'packages/web/app/api/local/project/route.ts'
  - 'packages/web/components/studio/local-studio-app.tsx'
  - 'packages/web/components/studio/local-studio-settings.tsx'
  - 'packages/core/tests/project-contract.test.ts'
  - 'packages/core/tests/init-service.test.ts'
  - 'packages/core/tests/build-preview-service.test.ts'
code_patterns:
  - 'Theme shells are isolated under packages/web/themes/<themeId>/'
  - 'Reader layout is resolved from site.theme.id through the theme registry'
  - 'Project-level reader settings live under anydocs.config.json -> site.theme'
  - 'The reader layout receives the fully validated siteTheme object and is responsible for theme-specific shell composition'
  - 'Studio project settings mirror a subset of site.theme and persist through /api/local/project'
test_patterns:
  - 'packages/core/tests/project-contract.test.ts'
  - 'packages/core/tests/init-service.test.ts'
  - 'packages/core/tests/build-preview-service.test.ts'
---

# Tech-Spec: classic-docs theme refresh

**Created:** 2026-03-15T00:00:00+08:00

## Overview

### Problem Statement

The current `classic-docs` reader does not match its intended positioning as a minimal developer and product documentation theme. It still renders a top header, places language switching in the header instead of the sidebar footer, and uses theme tokens with a green brand bias rather than a stable black-and-white base. It also lacks project-config-driven support for a sidebar logo, explicit site name presentation, configurable search visibility, and configurable primary theme colors.

### Solution

Upgrade the existing `classic-docs` theme shell and token contract instead of introducing a new theme. The refreshed theme will use a desktop-first left-sidebar layout with no top navigation, sidebar-top branding, optional sidebar search, sidebar-footer language switching, and a monochrome default palette with a limited set of configurable brand colors that drive active, hover, accent, and emphasis states.

### Scope

**In Scope:**
- Refresh the `classic-docs` desktop reader layout
- Remove the desktop top header and consolidate navigation into the left sidebar
- Add configurable sidebar branding with logo and site title
- Add configurable search visibility for the sidebar top area
- Add a desktop sidebar footer language switcher
- Rebase default visual tokens onto a black-and-white neutral system
- Support configuration of the main reader brand colors used by navigation and emphasis states
- Improve mobile adaptation for the refreshed theme shell
- Extend project theme typing, schema validation, and theme data plumbing as needed for the new config fields

**Out of Scope:**
- Creating a new reader theme or theme variant
- Building a highly customizable theming system with unrestricted token overrides
- Reworking article-body component styles to match the visual reference exactly
- Changing the docs content model, navigation model, or static artifact contract beyond theme metadata/config support
- Adding runtime end-user theme switching

## Context for Development

### Codebase Patterns

- Reader themes are isolated under `packages/web/themes/<themeId>/`, with `reader-layout.tsx` handling shell composition and `tokens.css` providing the visual contract.
- Theme selection is project-scoped through `site.theme.id`, resolved by the web app theme registry rather than by route-level conditionals.
- `packages/web/app/[lang]/layout.tsx` resolves the active theme, fetches the validated `siteTheme` object from project config, and passes it intact to the theme reader layout. Theme-specific rendering does not fetch config independently.
- Shared docs navigation rendering currently lives in `packages/web/components/docs/sidebar.tsx`, with search mounted at the top and only a simple footer home link. `classic-docs` can either extend that component or refactor it to accept additional theme-driven branding, search visibility, and footer controls.
- Project config validation and persistence already enforce `site.theme` as a typed contract in core. New `classic-docs` options should be added there instead of being inferred from content or navigation data.
- Studio project settings already expose `themeId`, `siteTitle`, `homeLabel`, and `codeTheme`, and persist them through `/api/local/project`. Any new theme settings that are considered user-configurable in-product must extend the Studio state shape, request payload, and settings panel together.
- Build metadata does not serialize the entire theme object today. `packages/core/src/publishing/build-artifacts.ts` manually whitelists `id`, `branding`, and `codeTheme`, so any newly supported theme config fields require explicit serialization if they are meant to survive into `build-manifest.json` or `mcp/index.json`.
- No `project-context.md` file was present in the repository scan, so repository conventions are inferred from current code, tests, and planning docs only.

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `packages/web/themes/classic-docs/reader-layout.tsx` | Current reader shell with top header and theme class wrapper |
| `packages/web/themes/classic-docs/tokens.css` | Current classic-docs token definitions and brand palette |
| `packages/web/components/docs/sidebar.tsx` | Shared docs sidebar structure, navigation rendering, and footer area |
| `packages/web/app/[lang]/layout.tsx` | Theme resolution entry point for reader routes |
| `packages/web/components/docs/search-panel.tsx` | Existing search panel mounted in the sidebar top area |
| `packages/core/src/types/project.ts` | Project-level theme contract types |
| `packages/core/src/config/project-config.ts` | Default project config creation and theme defaults |
| `packages/core/src/schemas/project-schema.ts` | Validation for `site.theme` fields in `anydocs.config.json` |
| `packages/core/src/publishing/build-artifacts.ts` | Theme metadata serialization for build manifest and MCP index |
| `packages/web/app/api/local/project/route.ts` | Local API theme payload shape for Studio updates |
| `packages/web/components/studio/local-studio-app.tsx` | Studio project state mapping and save payload construction |
| `packages/web/components/studio/local-studio-settings.tsx` | Existing project settings UI patterns and current theme controls |
| `packages/core/tests/project-contract.test.ts` | Contract persistence and clearing behavior for theme settings |
| `packages/core/tests/init-service.test.ts` | Default project config expectations on initialization |
| `packages/core/tests/build-preview-service.test.ts` | Theme metadata expectations in generated artifacts |

### Technical Decisions

- Keep this work as an in-place upgrade of `classic-docs`, not a new theme ID.
- Treat logo, site title, search visibility, and color fields as project-level theme metadata under `site.theme`, not as page or navigation content.
- Keep theme customization intentionally narrow: a small set of semantic color fields is allowed, while the rest of the visual system remains owned by the theme.
- Extend the theme contract with three explicit groups so the implementation remains understandable and validation-friendly:
  - `site.theme.branding.logoSrc?: string`
  - `site.theme.branding.logoAlt?: string`
  - `site.theme.chrome.showSearch?: boolean`
  - `site.theme.colors.primary?: string`
  - `site.theme.colors.primaryForeground?: string`
  - `site.theme.colors.accent?: string`
  - `site.theme.colors.accentForeground?: string`
  - `site.theme.colors.sidebarActive?: string`
  - `site.theme.colors.sidebarActiveForeground?: string`
- Because theme configuration is already part of Studio project settings, the recommended implementation path is to expose the new `classic-docs` fields through the existing Studio settings flow instead of requiring manual JSON edits only.
- The existing shared sidebar is a likely refactor point. If the added branding and language-switch footer make the component too classic-docs-specific, the implementation should split a theme-specific sidebar wrapper rather than over-generalizing the shared component.
- Theme color configuration should use semantic fields with validation-friendly formats. Schema validation should accept only `#RRGGBB` hex values for the new color fields, and the theme should derive dependent hover and soft states internally.
- Logo support should prefer a simple project-config value that can be rendered statically by the reader, such as a URL/path string, rather than introducing asset upload infrastructure in this scope.
- Use the screenshot only as layout and mood reference; article-body blocks are not being redesigned in this spec.
- Desktop behavior is the priority. Mobile only needs a coherent responsive adaptation, not a pixel-matched translation of the desktop sidebar.

## Implementation Plan

### Tasks

- [ ] Task 1: Extend the canonical theme contract for classic-docs refresh settings
  - File: `packages/core/src/types/project.ts`
  - Action: Add typed support for the new theme configuration groups under `site.theme`, including branding logo fields, a chrome flag for search visibility, and a semantic color map.
  - Notes: Keep the contract generic enough to live on `ProjectSiteTheme`, but document that these fields are currently consumed by `classic-docs`.

- [ ] Task 2: Validate and normalize the new theme settings in project config loading
  - File: `packages/core/src/schemas/project-schema.ts`
  - Action: Add schema validation and trimming for `branding.logoSrc`, `branding.logoAlt`, `chrome.showSearch`, and the semantic color fields.
  - Notes: Reject malformed types, reject non-hex color strings, and preserve current behavior when the new fields are omitted.

- [ ] Task 3: Update default config and artifact serialization to carry the expanded theme metadata
  - File: `packages/core/src/config/project-config.ts`
  - Action: Ensure default project creation still emits a valid `classic-docs` config and preserves optional new fields when provided as overrides.
  - Notes: Do not invent non-empty defaults for logo or colors; absence should keep the theme opinionated.
  - File: `packages/core/src/publishing/build-artifacts.ts`
  - Action: Extend theme serialization so any supported new theme fields are included in `build-manifest.json` and machine-readable site metadata.
  - Notes: This keeps build diagnostics and deployment checks in sync with runtime reader configuration.

- [ ] Task 4: Extend the local project settings API to read and write the new theme fields
  - File: `packages/web/app/api/local/project/route.ts`
  - Action: Expand the request body type and update payload mapping so Studio can persist logo, search visibility, and semantic color fields.
  - Notes: Preserve partial-update behavior and do not require clients to send every theme property on each save.

- [ ] Task 5: Extend Studio project state and settings controls for classic-docs appearance
  - File: `packages/web/components/studio/local-studio-app.tsx`
  - Action: Add the new theme fields to project state hydration, dirty tracking, and save payload generation.
  - Notes: Keep empty values removable so users can clear overrides back to theme defaults.
  - File: `packages/web/components/studio/local-studio-settings.tsx`
  - Action: Add project settings inputs for logo source, optional logo alt text, sidebar search toggle, and the semantic color fields.
  - Notes: Prefer showing these controls only when `themeId === 'classic-docs'` so other themes are not burdened with irrelevant UI.

- [ ] Task 6: Refactor classic-docs desktop shell into a true sidebar-first layout
  - File: `packages/web/themes/classic-docs/reader-layout.tsx`
  - Action: Remove the desktop top header, move branding into the sidebar top, and pass the full theme-driven branding/chrome config into the sidebar area.
  - Notes: Keep the root theme class wrapper, and ensure mobile still has a usable shell instead of inheriting the desktop-only structure.

- [ ] Task 7: Upgrade the docs sidebar structure to support branding, optional search, and footer language switching
  - File: `packages/web/components/docs/sidebar.tsx`
  - Action: Add a branded top block, optional search panel rendering, a footer language switcher for desktop, and any prop changes needed to support classic-docs layout.
  - Notes: If the shared sidebar becomes too theme-specific, extract a classic-docs-specific sidebar wrapper while leaving the navigation tree rendering reusable.
  - File: `packages/web/components/docs/search-panel.tsx`
  - Action: Adjust search panel styling only if needed so it fits the refreshed sidebar visual system.
  - Notes: Search behavior should remain unchanged; this task is about placement and presentation.

- [ ] Task 8: Rework classic-docs tokens and runtime CSS variable mapping around a monochrome base
  - File: `packages/web/themes/classic-docs/tokens.css`
  - Action: Replace the current green-biased defaults with black-and-white neutral tokens while keeping semantic `fd-*` variables intact.
  - Notes: The default palette should work with zero overrides.
  - File: `packages/web/themes/classic-docs/reader-layout.tsx`
  - Action: Inject validated theme color overrides into CSS custom properties used by classic-docs.
  - Notes: Use inline style variables or a small theme helper rather than generating CSS files dynamically.

- [ ] Task 9: Implement responsive behavior for the refreshed classic-docs shell
  - File: `packages/web/themes/classic-docs/reader-layout.tsx`
  - Action: Provide a mobile-friendly adaptation that preserves access to navigation, search, branding, and language switching without the fixed desktop sidebar layout.
  - Notes: A sheet, drawer, or collapsible mobile nav is acceptable as long as it remains consistent with the theme and keeps docs reading usable.

- [ ] Task 10: Add and update automated coverage for the expanded theme contract
  - File: `packages/core/tests/project-contract.test.ts`
  - Action: Add persistence, clearing, and validation-oriented assertions for the new theme fields.
  - Notes: Cover both populated and cleared values.
  - File: `packages/core/tests/init-service.test.ts`
  - Action: Confirm initialization still emits a valid `classic-docs` config without requiring any new overrides.
  - Notes: This guards the default-project path.
  - File: `packages/core/tests/build-preview-service.test.ts`
  - Action: Verify the serialized build metadata includes the newly supported theme fields when configured.
  - Notes: Keep existing `id` and `codeTheme` assertions intact.

### Acceptance Criteria

- [ ] AC 1: Given a project using `site.theme.id = "classic-docs"` with no new overrides, when the docs reader renders on desktop, then it uses a left-sidebar layout without a top navigation header and remains visually valid with the default monochrome palette.
- [ ] AC 2: Given `site.theme.branding.siteTitle` and `site.theme.branding.logoSrc` are configured, when the classic-docs reader renders, then the sidebar top shows the configured logo and site name without requiring page-content changes.
- [ ] AC 3: Given `site.theme.chrome.showSearch = false`, when the classic-docs reader renders, then the sidebar search panel is not shown and navigation spacing remains intact.
- [ ] AC 4: Given more than one published language is available, when the classic-docs reader renders on desktop, then language switching is available from the sidebar footer instead of the removed top header.
- [ ] AC 5: Given one or more semantic theme colors are configured under `site.theme.colors`, when the classic-docs reader renders, then navigation active states and other mapped emphasis surfaces use the configured values while unspecified colors continue using theme defaults.
- [ ] AC 6: Given a project config contains an invalid type for `site.theme.chrome.showSearch` or a non-`#RRGGBB` value in `site.theme.colors`, when the project contract is loaded, then validation fails with a targeted theme-config error instead of silently accepting invalid values.
- [ ] AC 7: Given a user edits classic-docs appearance settings through Studio and saves the project, when the config is persisted and reloaded, then the new branding, chrome, and color values round-trip through the local API and project contract correctly.
- [ ] AC 8: Given a project with configured classic-docs appearance overrides is built, when `build-manifest.json` and machine-readable site metadata are generated, then they include the expanded theme metadata alongside the existing theme id and code theme fields.
- [ ] AC 9: Given the refreshed classic-docs reader is viewed on mobile, when the user needs navigation or language switching, then those controls remain reachable through the responsive shell without depending on the desktop sidebar layout.

## Additional Context

### Dependencies

- Existing docs theme registry and project-config pipeline
- Existing docs sidebar and search panel components
- Existing Studio local project settings save flow
- Existing build metadata serialization path for theme settings

### Testing Strategy

- Extend `packages/core/tests/project-contract.test.ts` to cover valid and invalid `branding`, `chrome`, and `colors` fields, plus clearing behavior for optional overrides.
- Extend `packages/core/tests/init-service.test.ts` to ensure initialization remains backward compatible and does not require the new theme fields.
- Extend `packages/core/tests/build-preview-service.test.ts` to assert the expanded theme metadata is serialized into build outputs when configured.
- If a lightweight web-component test harness already exists during implementation, add focused reader-shell coverage there; otherwise rely on manual reader verification for shell layout behavior.
- Manual verification should cover: desktop layout with and without search, desktop language switch placement, branding with logo, color override application, and mobile navigation/language accessibility in preview mode.

### Notes

- User confirmed this is a refresh of the current theme only.
- Search remains in the sidebar top area but must be configurable on/off.
- Sidebar top branding must support both logo and site name.
- Multiple key colors should be configurable, but the theme must remain mostly opinionated.
- Highest implementation risk: overloading the shared `DocsSidebar` with classic-docs-only concerns. Prefer extracting a theme-specific wrapper if prop complexity starts leaking into other themes.
- Highest product risk: adding too many user-facing color controls and losing the “simple docs theme” positioning. The implementation should ship the smallest semantic color set that satisfies the requested branding flexibility.
- Future extension, explicitly out of scope here: richer body-content styling presets, asset upload support for logos, and per-theme Studio preview thumbnails or live token editors.
