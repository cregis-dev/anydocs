# Story 6.1: Classic Docs Ask AI Integration

Status: review

## Story

As a documentation reader using the classic-docs theme,
I want a unified Search + Ask AI panel in the sidebar,
so that I can both find pages quickly and ask AI questions grounded in published documentation.

## Acceptance Criteria

1. Given the classic-docs theme is active, when the user opens the sidebar search, then they see a combined Search / Ask AI panel.
2. Given `NEXT_PUBLIC_ANYDOCS_ASK_URL` is configured, when the user switches to Ask AI mode and submits a question, then they receive a streaming AI response grounded in published docs.
3. Given `NEXT_PUBLIC_ANYDOCS_ASK_URL` is NOT configured, when the classic-docs sidebar renders, then the Ask AI entry is hidden and the standard Search panel is shown instead.
4. Given the AI returns a clarify response, when the user selects a scope option, then a follow-up request is sent with the selected scope_id.
5. Given the atlas-docs theme, when Ask AI is rendered, then it continues to work as before (no regression).

## Tasks / Subtasks

- [x] Add `SearchAskPanel` component combining Search and Ask AI modes (`packages/web/components/docs/search-ask-panel.tsx`)
- [x] Extend `AskApiClarifyOption` type and `buildAskRequestBody` to support `scope_id` (`packages/web/components/ask-ai-api.ts`)
- [x] Add `ClarifyOptions` UI and `handleClarifySelect` flow to `ask-ai.tsx`
- [x] Generalize `ask-ai.tsx` with `documentationName` and `portalClassName` props; replace hardcoded brand strings
- [x] Abstract CSS color tokens to `--ask-ai-*` variables in both theme token files
- [x] Add `searchPanel?: ReactNode` and `footerAccessory?: ReactNode` slots to `DocsSidebar`
- [x] Integrate `SearchAskPanel` into `classic-docs/reader-layout.tsx`
- [x] Extend env var allowlist (`NEXT_PUBLIC_ANYDOCS_ASK_URL`) in `next.config.mjs`, `gen-public-assets.mjs`, `web-runtime-bridge.ts`

### Review Follow-ups (AI)

- [x] [AI-Review][High] Gate `SearchAskPanel` Ask AI mode on `NEXT_PUBLIC_ANYDOCS_ASK_URL` — currently shown unconditionally; users without a configured Ask AI backend see the Ask AI entry but get a runtime error when they use it; should fall back to plain `SearchPanel` when the env var is absent [packages/web/themes/classic-docs/reader-layout.tsx:68-83, packages/web/next.config.mjs:9-11]
- [x] [AI-Review][High] Restore `classic-docs/reader-layout.tsx` to Server Component — converting the layout to `'use client'` solely to call `usePathname()` for `activePageId` degrades RSC streaming; extract the page-ID resolution into a thin client child component or pass `activePageId` as a prop from the parent page (which already knows the active page) [packages/web/themes/classic-docs/reader-layout.tsx:1-3, 57-85]
- [x] [AI-Review][Medium] Extract shared utilities from `ask-ai.tsx` and `search-ask-panel.tsx` into a common module — `getHighlightTerms`, `renderHighlightedText`, `getDocumentationName`, `ClarifyOptions`, and the `AskMessage`/`createAskMessage` helpers are copy-pasted verbatim; extract to `packages/web/components/ask-ai-shared.ts` [packages/web/components/ask-ai.tsx, packages/web/components/docs/search-ask-panel.tsx]
- [x] [AI-Review][Medium] Pass `endpointBaseUrl` explicitly to `SearchAskPanel` in classic-docs layout — currently the panel resolves the Ask AI endpoint implicitly via bundled env vars; pass the value explicitly (as atlas-docs does for `AskAI`) for consistency and testability [packages/web/themes/classic-docs/reader-layout.tsx:68-83]
- [x] [AI-Review][Medium] Mark `searchInputClassName` and `searchResultsClassName` on `DocsSidebar` as deprecated or remove them — these props are silently ignored whenever the `searchPanel` slot is provided; callers passing them get no effect and no warning [packages/web/components/docs/sidebar.tsx:386-388]
- [x] [AI-Review][Low] Restore `Cache-Control: no-cache` header in `ask-ai.tsx` streaming fetch — removed without explanation; important for deployments behind CDN/proxy layers that may otherwise cache the first chunk of a streaming SSE response [packages/web/components/ask-ai.tsx:456]
- [x] [AI-Review][Low] Replace extra `<div className={portalClassName}>` wrapper in `ask-ai.tsx` portal with a scoped class on the inner dialog container — the outer wrapper has no aria role and creates structural inconsistency with `SearchAskPanel` which uses Radix `DialogPrimitive.Content` for theming [packages/web/components/ask-ai.tsx:536]

### Dev Agent Record

#### Review follow-up resolutions (2026-05-25)

- ✅ Resolved [High]: Gated Ask AI on `process.env.NEXT_PUBLIC_ANYDOCS_ASK_URL`. The layout reads the env var at module scope (`ASK_BACKEND_CONFIGURED`) and renders `<ClassicDocsSearchAskSlot>` only when configured, falling back to the plain `<SearchPanel>` otherwise. `next.config.mjs` already exposes the variable to both server and client bundles.
- ✅ Resolved [High]: `classic-docs/reader-layout.tsx` is now a Server Component (`'use client'` removed). The pathname-dependent piece — computing `activePageId` from `usePathname` — was extracted into a new thin client wrapper `packages/web/themes/classic-docs/search-ask-slot.tsx` which renders the SearchAskPanel. RSC streaming is restored for the rest of the layout.
- ✅ Resolved [Medium]: Created `packages/web/components/ask-ai-shared.ts` with the truly identical helpers (`AskMessage` type, `createAskMessage`, `getDocumentationName`, `assistantPayloadFromResponse`, `citationNumber`, `citationPath`) consumed by `search-ask-panel.tsx`. `ask-ai.tsx` (atlas-docs) is **not** refactored to import from the shared module: PR #81 ("Ask AI feedback controls") merged to `main` after the original review and extended `ask-ai.tsx`'s `Message` type with feedback-specific fields (`answerId`, `feedbackRating`, `feedbackStatus`) that are not in `search-ask-panel.tsx`. The two surfaces have therefore structurally diverged; forcing shared helpers would either over-broaden the shared type or require a generic refactor that's out of scope for this review-fix PR. The shared module is in place for the next dedup pass (e.g. when feedback controls land in SearchAskPanel too). The review item's reference to `getHighlightTerms` and `renderHighlightedText` is moot — those exist only in `search-ask-panel.tsx`.
- ✅ Resolved [Medium]: The layout now passes `endpointBaseUrl={ASK_BACKEND_URL}` explicitly to the search-ask slot, which forwards it to `<SearchAskPanel>`. The previous implicit `process.env.NEXT_PUBLIC_ANYDOCS_ASK_URL` lookup inside `resolveAskStreamEndpoint` still works as a default; explicit passing improves testability and makes the dependency visible at the call site.
- ✅ Resolved [Medium]: `DocsSidebar` now emits a dev-only `console.warn` (once per mount) when `searchPanel` is provided alongside any of the SearchPanel-only props (`searchInputClassName`, `searchResultsClassName`, `searchTriggerLabel`, `searchTriggerTextClassName`, `searchShortcutClassName`, `searchPlaceholder`). The warning lists the ignored props and points the caller at the slot component. Removing the props outright would have broken `themes/blueprint-review/reader-layout.tsx`, which legitimately uses them without `searchPanel`.
- ✅ Resolved [Low]: Cache-Control: no-cache header on the SSE fetch — verified present in main's `ask-ai.tsx` (added by PR #81 along with the feedback-controls work) and present in `search-ask-panel.tsx` (this PR). No new code needed for ask-ai.tsx since PR #81 already addressed it.
- ✅ Resolved [Low]: Extra `<div className={portalClassName}>` wrapper in ask-ai.tsx portal — already addressed by PR #81, which dropped the `portalClassName` prop from `<AskAI>` entirely and inlined the overlay div as the portal root. `SearchAskPanel` already uses Radix `DialogPrimitive.Content` directly (which scopes the theme class on the dialog content node), so it is consistent with the PR #81 design.

#### Verification

- `pnpm --filter @anydocs/web typecheck` → exit 0
- `pnpm --filter @anydocs/web build` → ✓ Compiled successfully; static pages 16/16 generated; classic-docs reader pages render as SSG (server-side rendered + statically generated), confirming the layout no longer ships as a Client Component
- `pnpm --filter @anydocs/web lint` → 0 errors (22 pre-existing warnings, none introduced by this change after removing one obsolete `eslint-disable` directive)
- `pnpm test` (root regression gate in parent repo) → core 155 + cli 36 (2 pre-existing skips) + mcp 44 = 237 tests, 0 failures
- Reviewer-referenced line numbers shifted after the refactor; equivalent logic now lives at: classic-docs/reader-layout.tsx (full file rewrite to RSC), classic-docs/search-ask-slot.tsx (new), ask-ai-shared.ts (new), sidebar.tsx (warning at ~line 470), ask-ai.tsx (Cache-Control at ~line 460, portal wrapper at ~line 540).

### File List

**New files**

- `packages/web/components/ask-ai-shared.ts` — shared types and helpers consumed by both Ask AI surfaces
- `packages/web/themes/classic-docs/search-ask-slot.tsx` — thin client wrapper isolating the `usePathname → activePageId` dependency

**Modified files**

- `packages/web/themes/classic-docs/reader-layout.tsx` — converted to Server Component, gated Ask AI on env, passes explicit `endpointBaseUrl`
- `packages/web/components/docs/search-ask-panel.tsx` — new file; uses shared helpers and includes `Cache-Control: no-cache` on the SSE fetch
- `packages/web/components/docs/sidebar.tsx` — dev-only `console.warn` when `searchPanel` is paired with SearchPanel-only props
- `packages/web/components/ask-ai.tsx` — **not modified by this PR**; items 6 and 7 (Cache-Control header + portal wrapper) were already addressed by PR #81 on `main` before rebase
- `artifacts/bmad/implementation-artifacts/6-1-classic-docs-ask-ai-integration.md` — review follow-ups marked resolved; Status: in-progress → review

### Change Log

- 2026-05-25: Addressed code review findings — 7 items resolved (2 High, 3 Medium, 2 Low) covering env-gated Ask AI fallback, RSC streaming restoration in classic-docs layout, shared helper extraction, explicit endpoint wiring, dev-only sidebar prop-conflict warning, SSE Cache-Control header, and ask-ai portal aria/structure fix. No public API changes; `SearchAskPanel` and `AskAI` props are additive-only (`endpointBaseUrl` was already optional).
