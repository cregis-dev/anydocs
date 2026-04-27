---
title: 'Fix import review workflow: warnings + Studio approve action'
type: 'feature'
created: '2026-04-27'
status: 'done'
route: 'one-shot'
---

# Fix import review workflow: warnings + Studio approve action

## Intent

**Problem:** After `anydocs import` + `anydocs convert-import`, all pages silently get `review.required=true`. The build silently excludes them. Studio has no visual indicator or approve action. Users are stuck. Closes #51.

**Approach:**
- **Core**: Add `pendingReviewPages` field to `BuildWorkflowLanguageSummary`
- **CLI `convert-import`**: Print ⚠ warning that all converted pages need review approval before appearing in build output; suggest Studio approve menu
- **CLI `build`**: Print ⚠ per-language warning when `pendingReviewPages > 0`
- **Studio nav tree**: Orange `FileText` icon for pages with `review.required && !approvedAt`; new "Approve" menu item sets `approvedAt + status=published` and saves
- **Studio compose/app**: Thread `onApprovePage` callback, `onApprovePageById` implementation in `local-studio-app.tsx`

## Suggested Review Order

1. [packages/core/src/publishing/publication-filter.ts](../../packages/core/src/publishing/publication-filter.ts) — `isPageApprovedForPublication` (unchanged, re-used)
2. [packages/core/src/services/build-service.ts](../../packages/core/src/services/build-service.ts) — `pendingReviewPages` in summary + `isPageApprovedForPublication` import
3. [packages/cli/src/commands/convert-import-command.ts](../../packages/cli/src/commands/convert-import-command.ts) — review approval warning after convert
4. [packages/cli/src/commands/build-command.ts](../../packages/cli/src/commands/build-command.ts) — per-language pending review warning in `logBuildSuccess`
5. [packages/web/components/studio/navigation-tree.tsx](../../packages/web/components/studio/navigation-tree.tsx) — `CheckCircle` icon, `onApprovePage` prop, `hasPendingReview` logic, orange icon + Approve menu item
6. [packages/web/components/studio/navigation-composer.tsx](../../packages/web/components/studio/navigation-composer.tsx) — `onApprovePage` prop passthrough
7. [packages/web/components/studio/local-studio-app.tsx](../../packages/web/components/studio/local-studio-app.tsx) — `onApprovePageById` callback + `onApprovePage` prop to `NavigationComposer`
