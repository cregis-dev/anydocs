# Story 13.1: Port `tokens.css` and Shell Primitives into `@anydocs/web`

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer agent,
I want the Claude Design `tokens.css` and shell primitives ported into a new module under `packages/web/lib/desktop-shell/`,
so that every subsequent Studio surface (Epic 13 Stories 13.2–13.11) consumes one design system from code with no hand-tuned values.

## Acceptance Criteria

1. A new module `packages/web/lib/desktop-shell/` exists with `tokens.css` copied verbatim from `/Users/shawn/Downloads/anydocs-desktop-handoff/tokens.css` (no value mutation, including OKLCH color values, font stacks, and CSS custom property names).
2. The module exports six React primitives matching the Claude Design `desktop-shell.jsx` source, with identical naming and props contract: `MacWindow`, `LocalChip`, `ModelBadge`, `LocalTopbar`, `LocalStatusBar`, `KBD`.
3. Light and dark themes are switchable via `<html data-theme="dark">` or any ancestor element carrying `data-theme="dark"`; no theme-specific code paths exist inside the primitives.
4. Every primitive renders pixel-faithfully against its Claude Design reference within a configurable visual regression tolerance, in both light and dark themes.
5. No hand-tuned color, spacing, radius, shadow, or easing values appear outside `tokens.css` — primitives reference only `var(--n-*)`, `var(--brand-*)`, `var(--ai-*)`, `var(--ok-*)`, `var(--warn-*)`, `var(--bad-*)`, `var(--info-*)`, `var(--r-*)`, `var(--sh-*)`, `var(--ease)`, `var(--font-ui)`, `var(--font-mono)`, `var(--t-*)`.
6. The module exports TypeScript types for each primitive's props, fully typed under TypeScript strict mode.
7. A storybook-style fixture page at `packages/web/app/(internal)/desktop-shell-preview/page.tsx` (or equivalent dev-only route) demonstrates every primitive in light + dark mode for designer review and visual regression baseline capture.
8. `pnpm typecheck` and `pnpm test:web` continue to pass.
9. The module does NOT modify any existing Studio component (`packages/web/components/studio/*`). Migration into the Studio shell happens in Story 13.2.

## Tasks / Subtasks

- [x] Establish the module directory and entry point (AC: 1, 5, 6)
  - [x] Create `packages/web/lib/desktop-shell/` directory.
  - [x] Create `packages/web/lib/desktop-shell/index.ts` as the only public entry (re-exports all primitives + their prop types).
  - [x] Decide on import path convention: prefer `@/lib/desktop-shell` if `@/*` alias exists; otherwise relative imports from consumers. Document the chosen path in the module-level comment.
- [x] Port `tokens.css` verbatim (AC: 1, 5)
  - [x] Copy `/Users/shawn/Downloads/anydocs-desktop-handoff/tokens.css` to `packages/web/lib/desktop-shell/tokens.css` byte-for-byte. Do not "format" or "improve" any value.
  - [x] Add a top-of-file comment noting the canonical source path + frozen date (2026-05-25) + the rule that any addition requires team discussion (per Claude Design README §8).
  - [x] Import `tokens.css` from the new module's entry — either via direct CSS import in `index.ts` (Next.js supports this) or via a Tailwind-compatible layer if the project uses Tailwind v4 ingestion. Verify the existing web package's CSS strategy and choose the path of least conflict.
  - [x] Verify the `.ax` root class and all `.ax *` selectors continue to apply correctly when nested inside the existing Next.js `app/layout.tsx`. If conflicts emerge, scope the imports under a wrapper element rather than mutating the tokens file.
- [x] Port the six shell primitives (AC: 2, 5, 6)
  - [x] Create `packages/web/lib/desktop-shell/mac-window.tsx`:
    - Mirror Claude Design `MacWindow` (desktop-shell.jsx L73–128).
    - Props: `{ children: ReactNode; title?: string; subtitle?: string; width?: number; height?: number; dark?: boolean; fileChip?: boolean }`.
    - Render 30px titlebar with three traffic lights, centered title, right-side toggle buttons.
    - Convert inline `style` objects to a mix of `style` and class names backed by tokens. Inline-style usage is acceptable where matching the JSX source exactly; CSS module is optional.
    - Internal `TrafficLight` and `tbBtn` helpers stay local.
  - [x] Create `packages/web/lib/desktop-shell/local-chip.tsx`:
    - Mirror Claude Design `LocalChip` (desktop-shell.jsx L23–44).
    - No props for v1 (pulse SVG is inline).
    - Honor `prefers-reduced-motion: reduce` — pulse SVG animations must be suppressed when the user prefers reduced motion (per UX spec §8.4).
  - [x] Create `packages/web/lib/desktop-shell/model-badge.tsx`:
    - Mirror Claude Design `ModelBadge` (desktop-shell.jsx L46–70).
    - Props: `{ model?: string; provider?: string; running?: boolean; compact?: boolean }`.
    - Default `model = "llama-3.1-8b"`, `provider = "ollama"`.
    - Detect "local" providers (`ollama`, `llama.cpp`, `mlx`) vs cloud and color the indicator dot accordingly.
  - [x] Create `packages/web/lib/desktop-shell/local-topbar.tsx`:
    - Mirror Claude Design `LocalTopbar` (desktop-shell.jsx L268–309).
    - Props: `{ crumbs?: string[]; dirty?: boolean; agentToggled?: boolean; onRevealInFinder?: () => void; onToggleHistory?: () => void; onToggleAgent?: () => void }`.
    - Render path crumbs in mono, minimal actions (Reveal, History toggle, Agent toggle).
    - Explicitly do NOT render Share / Presence (per UX spec §2.4 single-user removals).
  - [x] Create `packages/web/lib/desktop-shell/local-status-bar.tsx`:
    - Mirror Claude Design `LocalStatusBar` (desktop-shell.jsx L312–341).
    - Props: `{ saved?: string; words?: number; model?: string; provider?: string; agent?: string }`.
    - Render save state + word count + mono `md · UTF-8 · LF` + agent activity (if any) + `ModelBadge` (compact).
  - [x] Create `packages/web/lib/desktop-shell/kbd.tsx`:
    - Mirror Claude Design `KBD` (desktop-shell.jsx L10–21).
    - Props: `{ children: ReactNode; mono?: boolean; dim?: boolean }`.
- [x] Add a dev-only preview route (AC: 4, 7)
  - [x] Create `packages/web/app/(internal)/desktop-shell-preview/page.tsx` (or equivalent dev-only path that is gated behind production 404 per CLAUDE.md "Production Constraints").
  - [x] Compose every primitive in a single page in BOTH light and dark themes side by side. Use `<div data-theme="light">` and `<div data-theme="dark">` containers.
  - [x] Render representative state combinations: `LocalTopbar` with dirty / clean / agent on / off, `ModelBadge` local vs cloud, `LocalChip` static, `MacWindow` light + dark, `KBD` mono + non-mono + dim.
  - [x] Ensure this route returns 404 in production (per CLAUDE.md "Production Constraints"). If the existing `(internal)` group convention exists in the codebase, reuse it; otherwise add a defensive `process.env.NODE_ENV` check.
- [x] Add visual regression baseline (AC: 4, 7)
  - [x] Add a Playwright test under `packages/web/tests/e2e/` or `packages/web/tests/visual/` that captures the preview route in both themes.
  - [x] Snapshot each primitive composition. Configure pixel tolerance modestly (e.g., 1% per region) to allow font rendering jitter across CI environments.
  - [x] The visual regression baseline must be deterministic across CI runners (per existing Phase 1 Playwright convention).
- [x] Validate the build + tests (AC: 8)
  - [x] `pnpm typecheck` exits 0.
  - [x] `pnpm test:web` exits 0.
  - [x] `pnpm build:web` produces a clean Next.js build with no warnings about the new module.
  - [x] The preview route returns 404 when built with `NODE_ENV=production`.

## Dev Notes

- This story is the **design system foundation** for all Epic 13 work. Get the tokens + primitives right; downstream stories simply compose them.
- The Claude Design package is the authoritative source. Do not "improve" or "simplify" tokens, color values, or primitive prop shapes. If something seems wrong, ask before changing.
- This story creates the module but does NOT wire it into the existing Studio. Story 13.2 (Studio shell recompose) does the wire-up. Until then, primitives are reachable only via the preview route.
- The `.ax` root class in tokens.css scopes all primitive styles. Consumers will need to wrap the Studio tree in `<div className="ax">` (Story 13.2 handles this). For this story, the preview route wraps its content in `.ax` so primitives render with proper typography and color.

### Developer Context

**Business objective**
- Lock the design system in code so 11 downstream Epic 13 stories share one source of truth.
- Enable visual regression baseline (Story 13.11 builds on this) before Studio shell changes start.

**Current code baseline**
- `packages/web/app/globals.css` carries Phase 1 global styles. Verify there is no token name collision (the new tokens use `--n-*`, `--brand-*`, `--ai-*`, etc.; check globals.css does not define overlapping custom properties).
- `packages/web/components/ui/` carries shadcn/ui primitives. These continue to exist and serve their current purposes; the new `desktop-shell/` module is a separate, parallel design surface dedicated to the desktop Studio experience.
- `packages/web/tailwind.config.*` (if present) — verify Tailwind v4 ingestion does not interfere with raw CSS variable consumption.

**Phase scope discipline**
- This story is UI primitives only. No Studio composition changes (Story 13.2), no editor changes (Story 6.x), no Tauri shell wiring (Epic 9).
- The `MacWindow` primitive renders chrome (traffic lights, titlebar) for use in `desktop` runtime mode (Story 8.1 resolves runtime mode). In `web` mode the MacWindow is suppressed by Story 13.2 — do not implement that gating here; just provide the primitive.

### Technical Requirements

- Tokens file must be byte-identical to the Claude Design source. Use `cp` not editor-saved copy if possible to avoid line-ending normalization.
- Primitives MUST consume only token variables for color / spacing / radius / shadow / typography / easing. Inline numeric values are acceptable ONLY for layout structure (flex gaps, grid spans, fixed heights from the JSX source) — but any visual property must reference a token.
- `prefers-reduced-motion: reduce` MUST be honored by `LocalChip` (suppresses pulse animation) and any other primitive that animates.
- Color-only meaning is forbidden per NFR17 — every state already pairs icon + label by virtue of the design.
- TypeScript strict mode; no `any` in prop types.
- Primitives must work as React Server Components where possible, but `LocalTopbar`, `LocalStatusBar`, and any primitive that takes event handlers will be Client Components — mark with `'use client'` accordingly.

### Architecture Compliance

- Per architecture.md "Phase 2 Architectural Boundaries (Updates)":
  - `@anydocs/web` is the consumer of the design system; it MUST NOT depend on internal Claude Design implementation details
  - Design tokens are sealed in `tokens.css`; consumers reference via CSS custom properties
- Per UX spec §2.1–§2.3:
  - Token families and primitives are adopted as authoritative
  - Naming preserved (`MacWindow`, `LocalChip`, etc.)
- Per UX spec §5.1 "Adoption Boundary":
  - Tokens → port to `packages/web/lib/desktop-shell/tokens.css` (this story implements that line)
  - Shell primitives → port to project's component library; preserve naming

### Library / Framework Requirements

- React 19 + Next.js 16 (per Phase 1 architecture).
- No additional UI dependency. Specifically: no Radix UI, no shadcn additions, no class-variance-authority — primitives are styled with raw CSS via tokens.
- Tailwind v4 may coexist but is NOT used inside the primitives (tokens are the styling vocabulary).
- Inter and JetBrains Mono fonts must be available. If they are not already loaded by `packages/web/app/layout.tsx`, add font loading via `next/font/google` matching the exact font names declared in tokens.css.

### File Structure Requirements

**To create (this story):**

```
packages/web/lib/desktop-shell/
├── index.ts                       ← public entry: re-exports primitives + prop types
├── tokens.css                     ← verbatim copy from Claude Design
├── mac-window.tsx
├── local-chip.tsx
├── model-badge.tsx
├── local-topbar.tsx
├── local-status-bar.tsx
└── kbd.tsx

packages/web/app/(internal)/desktop-shell-preview/
└── page.tsx                       ← dev-only preview route (404 in production)

packages/web/tests/visual/         ← may already exist
└── desktop-shell.spec.ts          ← Playwright visual regression baseline
```

**Reference-only (do not modify):**

- `/Users/shawn/Downloads/anydocs-desktop-handoff/tokens.css` — verbatim source
- `/Users/shawn/Downloads/anydocs-desktop-handoff/desktop-shell.jsx` — primitives source; mirror props and behavior exactly
- `/Users/shawn/Downloads/anydocs-desktop-handoff/shell.jsx` — contains `Ic` icon library; primitives reference Ic in JSX source. Port a minimal subset of Ic needed by these six primitives (or scope to fewer icons if some primitives use multiple).
- `/Users/shawn/Downloads/anydocs-desktop-handoff/README.md` — Section 5 ("Visual / interaction language") and Section 7 ("Tauri implementation notes") inform some primitive behavior

**Out of scope for this story:**

- Studio shell recompose — Story 13.2
- VaultSidebar primitive — Story 13.3 (this story does NOT port VaultSidebar)
- LocalAgentPanel primitive — Story 13.2 / 13.3 territory (this story does NOT port LocalAgentPanel)
- ScopeBadge component — UX spec §6.1; future Story 13.7 / 11.7
- Audit Log Query view — Story 13.10
- Any Tauri-specific traffic light offsets — Tauri config in Story 9.1

### Testing Requirements

- Unit / component tests are optional for this story (primitives are mostly styling). Visual regression is the primary acceptance test.
- The Playwright visual test must:
  - Capture each primitive in light and dark themes
  - Capture state combinations (e.g., `LocalTopbar dirty=true vs dirty=false`)
  - Have stable, deterministic output across runs (font loading must be ready before snapshot)
- The preview route must:
  - 404 in production builds (smoke test from `pnpm test:e2e:p0` should cover this)
  - Render without console errors in dev mode

**Test commands (per CLAUDE.md):**

- `pnpm typecheck` — strict-mode type check
- `pnpm test:web` — Vitest suite for `packages/web`
- `pnpm test:e2e:p0` — critical-path Playwright (includes any new visual regression test if added under the p0 bucket)
- `pnpm test:acceptance` — the GitHub submission gate (recommended before PR)

### References

- UX spec: [Source: artifacts/bmad/planning-artifacts/ux-design-specification.md#2. Design Foundation] (token families, visual language, component primitives)
- UX spec: [Source: artifacts/bmad/planning-artifacts/ux-design-specification.md#5.1 Adoption Boundary] (tokens authoritative, primitives authoritative)
- UX spec: [Source: artifacts/bmad/planning-artifacts/ux-design-specification.md#8. Accessibility] (WCAG 2.1 AA + reduced motion)
- Epics: [Source: artifacts/bmad/planning-artifacts/epics.md#Epic 13: Studio Desktop Shell Migration → Story 13.1]
- Architecture: [Source: artifacts/bmad/planning-artifacts/architecture.md#Phase 2 Architectural Boundaries (Updates)]
- Claude Design source: `/Users/shawn/Downloads/anydocs-desktop-handoff/tokens.css` (verbatim port)
- Claude Design source: `/Users/shawn/Downloads/anydocs-desktop-handoff/desktop-shell.jsx` (primitive shapes)
- Claude Design source: `/Users/shawn/Downloads/anydocs-desktop-handoff/README.md` Section 5 + 7
- Repository conventions: [Source: CLAUDE.md#Production Constraints] (`/studio` and dev-only routes must 404 in production)
- Repository conventions: [Source: CLAUDE.md#Pre-GitHub Submission Gate]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.7 (`claude-opus-4-7`)

### Debug Log References

- `next build` initially failed with "(internal)/desktop-shell-preview/page.tsx doesn't have a root layout". Next.js App Router requires each route group at the app root level to have its own `layout.tsx` that emits `<html>` + `<body>`. Resolution: added `packages/web/app/(internal)/layout.tsx`, mirroring the existing `(home)/layout.tsx` pattern. Metadata includes `robots: { index: false, follow: false }` since these routes are dev-only.
- Playwright snapshot syntax: `--update-snapshots tests/...` passes the path as an argument to the `-u` flag, which expects `all|changed|missing|none`. Correct invocation is `--update-snapshots=all <path>` or just `--update-snapshots`. Generated baselines on macOS Chromium; CI on Linux Chromium will need its own first-run baseline (Playwright writes platform-suffixed snapshots: `*-chromium-darwin.png` vs `*-chromium-linux.png`).

### Completion Notes List

- **Tokens**: `tokens.css` byte-copied from `/Users/shawn/Downloads/anydocs-desktop-handoff/tokens.css` (247 lines source). Added a top-of-file `VERBATIM PORT — DO NOT EDIT VALUES` header (Story 13.1 Tasks/Subtasks requirement) above the original Claude Design header. No value mutation; OKLCH colors, font stacks, custom property names preserved. Confirmed no token-name collision with `packages/web/app/globals.css` via a `grep` for `--n-* | --brand-* | --ai-* | --ok-* | --warn-* | --bad-* | --info-* | --r-* | --sh-* | --ease | --t-* | --font-ui | --font-mono` — zero hits.
- **Primitives**: All six (`KBD`, `LocalChip`, `ModelBadge`, `MacWindow`, `LocalTopbar`, `LocalStatusBar`) implemented in TypeScript strict mode under `packages/web/lib/desktop-shell/`. Prop names and shapes mirror `desktop-shell.jsx` source 1:1. Default values preserved.
- **Reduced motion (AC + Tech Reqs)**: `LocalChip`'s SVG pulse honors `prefers-reduced-motion: reduce` via an inline `<style>` scoped through the `.anydocs-local-chip-pulse` class — so the chip stays a Server Component (no `'use client'` boundary needed). The Playwright spec passes `animations: 'disabled'` for the snapshot anyway, so the baseline is deterministic.
- **Server vs Client boundaries**: Only `LocalTopbar` is marked `'use client'` (it takes `onRevealInFinder`/`onToggleHistory`/`onToggleAgent` callbacks). All other primitives are Server-Component-compatible. `LocalStatusBar`'s `.pulse` class animation is CSS-only (defined in `tokens.css`), so no client boundary is required there.
- **Internal `Ic` subset**: ported only the 4 icons consumed by the 6 primitives (`base`, `folder`, `hist`, `ai`) to `packages/web/lib/desktop-shell/icons.tsx`. Kept internal (not exported through `index.ts`) — downstream Epic 13 stories that need more icons can either extend this file or add a separate icon module per UX spec direction.
- **MacWindow `LocalChip` slot**: when `fileChip` prop is true, `MacWindow` directly imports and renders `<LocalChip />`. The earlier draft used a `require()` indirection to dodge a theoretical circular dependency; removed it because the actual import graph is acyclic.
- **Public entry**: `packages/web/lib/desktop-shell/index.ts` imports `tokens.css` so a single consumer-side `import '@/lib/desktop-shell'` brings the styles and JS in one shot. Re-exports the 6 primitives + their prop types and nothing else (the `Ic` icon helpers and the internal `TrafficLight` stay private).
- **Preview route**: `packages/web/app/(internal)/desktop-shell-preview/page.tsx` composes every primitive in both light and dark themes via a small `ThemedColumn` helper. New `packages/web/app/(internal)/layout.tsx` emits `<html>` + `<body>` so the route group satisfies Next.js App Router's root-layout requirement. The page returns `notFound()` when `NODE_ENV === 'production'`; build-time static generation triggers that branch, so the production route renders the Next.js not-found template and serves HTTP 404 (verified by spinning up `next start` and curling the URL).
- **Visual regression**: `packages/web/tests/e2e/desktop-shell-visual.spec.ts` covers light + dark baselines + a dev-mode render smoke. Tagged `@p1` (not critical-path; can be promoted to `@p0` later if Story 13.11 makes it the floor for downstream Epic 13 stories). `maxDiffPixelRatio: 0.01` (1%) modest tolerance per Story 13.1 testing requirements. macOS Chromium baselines committed; Linux CI must regenerate platform-suffixed baselines on first run (the spec header documents the exact `--update-snapshots` command).

### Validation Evidence

- `pnpm --filter @anydocs/web typecheck` → exit 0
- `pnpm --filter @anydocs/web build` → ✓ Compiled successfully; `/desktop-shell-preview` listed as static route; `next start -p 4321` + `curl /desktop-shell-preview` → **HTTP 404** with Next.js not-found template (production gate works)
- `pnpm --filter @anydocs/web test` (Playwright suite) → 3 new tests pass (light baseline, dark baseline, dev render smoke); existing passing tests unchanged; 22 pre-existing tests skipped (DOCS_PREVIEW_URL / desktop-runtime gating)
- `pnpm --filter @anydocs/web exec playwright test tests/e2e/desktop-shell-visual.spec.ts` → 3 passed (4.2s, two committed baseline PNGs)

### File List

**New files**

- `packages/web/lib/desktop-shell/tokens.css` — Claude Design tokens verbatim port
- `packages/web/lib/desktop-shell/icons.tsx` — internal `Ic` icon subset (4 icons)
- `packages/web/lib/desktop-shell/kbd.tsx`
- `packages/web/lib/desktop-shell/local-chip.tsx`
- `packages/web/lib/desktop-shell/model-badge.tsx`
- `packages/web/lib/desktop-shell/mac-window.tsx`
- `packages/web/lib/desktop-shell/local-topbar.tsx` (`'use client'`)
- `packages/web/lib/desktop-shell/local-status-bar.tsx`
- `packages/web/lib/desktop-shell/index.ts` — public entry; imports `tokens.css`
- `packages/web/app/(internal)/layout.tsx` — root layout for the `(internal)` route group
- `packages/web/app/(internal)/desktop-shell-preview/page.tsx` — dev-only preview, 404 in production
- `packages/web/tests/e2e/desktop-shell-visual.spec.ts` — Playwright visual regression baseline
- `packages/web/tests/e2e/desktop-shell-visual.spec.ts-snapshots/desktop-shell-light-chromium-darwin.png`
- `packages/web/tests/e2e/desktop-shell-visual.spec.ts-snapshots/desktop-shell-dark-chromium-darwin.png`

**Modified files**

- `artifacts/bmad/implementation-artifacts/13-1-port-tokens-css-and-shell-primitives-into-anydocs-web.md` — Status: ready-for-dev → in-progress → review; tasks ticked; Dev Agent Record / File List / Change Log populated
- `artifacts/bmad/implementation-artifacts/sprint-status.yaml` — `13-1-port-tokens-css-and-shell-primitives-into-anydocs-web`: ready-for-dev → review

**No existing Studio component was modified (AC9).**

## Change Log

| Date       | Version | Change                                                                                                                                                                                | Author |
|------------|---------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|--------|
| 2026-05-25 | 0.1.0   | Initial port: `tokens.css` (verbatim) + six shell primitives (`MacWindow`, `LocalChip`, `ModelBadge`, `LocalTopbar`, `LocalStatusBar`, `KBD`) + dev-only preview route + Playwright visual regression baseline. Production gate verified (`HTTP 404`). | Claude Opus 4.7 (dev agent) |
