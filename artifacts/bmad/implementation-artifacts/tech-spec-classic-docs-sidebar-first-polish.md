---
title: 'classic-docs sidebar-first polish'
slug: 'classic-docs-sidebar-first-polish'
created: '2026-03-30T00:00:00+08:00'
status: 'ready-for-dev'
---

# Tech-Spec: classic-docs sidebar-first polish

## Summary

This slice upgrades `classic-docs` from a functional docs shell into a more complete developer-docs/help-center theme without adding top navigation. The theme remains explicitly `sidebar-first`; `atlas-docs` continues to own top-level category navigation.

## Scope

### In Scope

- Improve `classic-docs` reader polish without introducing top navigation
- Add a richer classic-docs landing page at `/{lang}`
- Localize theme shell copy for supported languages
- Improve search empty/loading copy and presentation
- Tighten sidebar, TOC, and article layout hierarchy
- Refine mobile drawer/header behavior while keeping the existing sidebar model

### Out of Scope

- Adding top navigation or nav-group switching
- Turning `classic-docs` into a marketing homepage
- Reworking the content model or navigation model
- Adding end-user theme switching

## UX Goals

1. `classic-docs` should feel like an official docs site, not a placeholder shell.
2. A new visitor should be able to start from the landing page without relying entirely on the sidebar.
3. Theme shell copy must respect the active docs language.
4. Large-screen reading should feel balanced even on pages without deep TOC content.
5. Mobile should keep the same information architecture, just with a drawer presentation.

## Implementation Outline

### Track A: Shell Localization and Hierarchy

- Introduce a small docs-reader UI copy helper for `zh` and `en`
- Localize sidebar search placeholder, empty-state copy, TOC title, mobile menu labels, and landing page copy
- Strengthen sidebar section titles, active states, and footer affordances
- Refine TOC card styling and active-state clarity

### Track B: Sidebar-First Landing Page

- Replace the current placeholder `/{lang}` page for `classic-docs` with a landing page
- Keep the sidebar visible; the landing page complements it rather than replacing it
- Structure the landing page around:
  - hero title and concise description
  - primary search entry
  - quick-start links
  - top navigation groups/categories derived from the current nav tree
  - a small “need help / keep exploring” section
- Leave non-`classic-docs` themes on their current landing behavior unless they opt into the new page later

### Track C: Layout Refinement

- Adjust classic-docs shell spacing so large screens do not feel left-heavy and empty
- Improve mobile header and drawer polish without changing the information architecture
- Keep article pages readable and visually consistent with the upgraded landing page

## Acceptance Criteria

- `classic-docs` still has no top navigation on desktop or mobile
- `/{lang}` for `classic-docs` is a real landing page instead of placeholder text
- Sidebar/search/TOC shell strings are localized for `zh` and `en`
- Search empty state gives a helpful localized response
- Desktop and mobile remain usable with the same sidebar-first information architecture
