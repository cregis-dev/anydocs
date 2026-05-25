---
workflowType: 'ux-design'
project_name: 'anydocs'
user_name: 'Shawn'
date: '2026-05-24'
phase: 'Phase 2 — Single-User vNext (Desktop)'
status: 'complete'
inputDocuments:
  - artifacts/bmad/planning-artifacts/prd.md
  - artifacts/bmad/planning-artifacts/architecture.md
  - artifacts/bmad/planning-artifacts/epics.md
  - artifacts/bmad/planning-artifacts/implementation-readiness-report-2026-05-24.md
externalDesignSource:
  path: '/Users/shawn/Downloads/anydocs-desktop-handoff'
  version: 'v1.0 frozen 2026-05-25'
  scope: '22 high-fidelity macOS desktop screens + tokens.css + design primitives'
  authoritativeFor:
    - 'Design tokens (colors, typography, radius, shadow, easing)'
    - 'macOS shell chrome (titlebar, traffic lights, status bar)'
    - 'Visual language (warm neutrals, brand teal-blue, AI indigo)'
    - 'Component primitives (LocalChip, ModelBadge, KBD, MacWindow, LocalAgentPanel, etc.)'
    - '22 screen compositions'
designDocumentType: 'Bridge spec'
designDocumentScope: 'Maps Claude Design handoff to PRD/Architecture/Epics; closes 4 trust-critical UX gaps for Phase 2 single-user vNext'
---

# UX Design Specification — Anydocs Phase 2 Single-User vNext (Desktop)

**Author:** Shawn (PM) — facilitated by BMM UX workflow
**Date:** 2026-05-24
**Phase:** Phase 2 — Single-User vNext (macOS desktop, Tauri)
**Source-of-truth designs:** `/Users/shawn/Downloads/anydocs-desktop-handoff` (v1.0 frozen 2026-05-25)

---

## 1. Document Purpose and Scope

### 1.1 What This Document Is

This is a **bridge specification** between three artifacts:

1. **Claude Design Handoff** (22 hi-fi screens + tokens.css) — visual / interaction source of truth
2. **PRD v2026-05-24** — capability contract (FR51–FR60 + NFR26–NFR33 for Phase 2 vNext)
3. **Epics v2026-05-24** (Epic 6–12, 39 stories) — implementation breakdown

This document inventories the design, maps every screen to a PRD requirement and an epic story, and closes the **four trust-critical UX gaps** identified in the implementation readiness report.

### 1.2 What This Document Is Not

- **Not** exploratory UX design — discovery, design directions, and visual foundation are already decided by the Claude Design handoff
- **Not** a re-do of the existing screens — those are authoritative
- **Not** a multi-user / team experience spec — Phase 3 / Anydocs Studio (web collaborative) is out of scope here

### 1.3 Why a Bridge Spec

The Implementation Readiness Report flagged 2 **major UX advisories** (Story 12.3 scope escalation modal + Story 11.7 Agent anchors). The Claude Design package addresses most of Phase 2 visual surface but leaves these and two adjacent surfaces (audit log query, workspace Agent anchor) under-specified. This bridge spec closes those gaps using the established design language, so Sprint 4 and Sprint 5 can proceed without ad-hoc design improvisation.

---

## 2. Design Foundation (Adopted from Claude Design Handoff)

The following are **adopted as-is** from `/Users/shawn/Downloads/anydocs-desktop-handoff/tokens.css` and `desktop-shell.jsx`. Implementation must reference these source files directly — do not transcribe tokens.

### 2.1 Tokens (Authoritative Source: `tokens.css`)

| Token Family | Variable Prefix | Adopted For |
|---|---|---|
| Warm neutral (10-step) | `--n-0` … `--n-900` | Canvas, surface, text, hairlines |
| Brand teal-blue | `--brand-50/100/300/500/600/700` | Primary actions, links, focus ring |
| AI indigo | `--ai-50/100/200/300/500/600/700`, `--ai-glow` | All Agent / Writer / scope-related UI |
| Status colors | `--ok-*`, `--warn-*`, `--bad-*`, `--info-*` | Success, caution, error, info chips |
| Typography | `--font-ui` (Inter), `--font-mono` (JetBrains Mono), `--t-11` … `--t-40` | All text |
| Radius | `--r-4`, `--r-6`, `--r-8`, `--r-12`, `--r-16` | Corners |
| Shadow | `--sh-1`, `--sh-2`, `--sh-3` | Elevation |
| Easing | `--ease` | All motion (single curve) |

**Dark mode:** Single `[data-theme="dark"]` switch — all tokens auto-invert. No bespoke dark-mode work needed at component level.

### 2.2 Visual Language

- **Tone:** Quiet, Notion-grade. Warm neutrals (warmth h≈80). No "AI noise" (no purple gradients, no neon).
- **AI accent (indigo h≈275):** Reserved for Agent / Writer / model UI. Single tonal direction; no rainbow.
- **Brand accent (teal-blue h≈210):** Primary user actions, links, focus rings.
- **Density:** Notion-grade reading body (15.5px / 1.65 line height); UI 11–14px.
- **Iconography:** Single `Ic` icon library from `shell.jsx`. No second icon set.

### 2.3 Component Primitives (Authoritative Source: `desktop-shell.jsx`)

| Primitive | Role | PRD Anchor |
|---|---|---|
| `MacWindow` | Top-level macOS chrome with traffic lights + titlebar | FR58 visual context |
| `VaultSidebar` | Left tree showing real `.md` paths + status | Phase 1 + new in Phase 2 |
| `LocalTopbar` | Path crumbs + minimal actions; **no Share / no Presence** | FR58 + Phase 2 single-user constraint |
| `LocalStatusBar` | Bottom 24px: save state · word count · mono · UTF-8 · LF · model badge | FR58 indicator |
| `LocalAgentPanel` | Right 340px Writer panel | FR51 entry point for page-scope Agent |
| `LocalChip` | "Local" green chip with pulse — used in titlebar + status bar + vault footer | FR58 runtime mode indicator |
| `ModelBadge` | Mono pill showing `provider/model` + running dot | FR58 + provider-port visibility |
| `KBD` | Keyboard shortcut chip | Universal |

### 2.4 What's Removed from Multi-User Version (Per Phase 2 Scope)

| Multi-User Pattern | Why Removed | PRD Anchor |
|---|---|---|
| Browser shell | Desktop runtime is Tauri/macOS | runtime mode = `desktop` |
| Presence avatars + collaborator cursors | Single-user | Phase 3 capability anchor |
| Share / invite buttons | Single-user | Phase 3 capability anchor |
| Human review gate | Writer is sole collaborator | Single-user simplification |
| "Someone is typing" | Replaced by tok/s + GPU pulse | `ModelBadge` running state |
| Cloud-running default | Local default; cloud requires BYOK authorization | FR52 + provider port abstraction |

---

## 3. Screen Inventory and PRD Mapping

The Claude Design handoff contains **22 named screens**. Each is mapped here to its PRD FR, Epic, and story coverage.

| # | Screen ID | Screen Name | PRD FR | Epic / Story | Phase 1 / Phase 2 |
|---:|---|---|---|---|---|
| 1 | `ds-welcome` | Onboarding 1 · Welcome + Vault selection | FR1, FR46, FR47 | Phase 1 carry | P1 |
| 2 | `ds-onboard-model` | Onboarding 2 · Model picker (ollama default; cloud BYOK opt-in) | Provider port (architecture) + FR58 | Story 11.1 host wiring | P2 |
| 3 | `ds-onboard-done` | Onboarding 3 · Setup complete | FR1, FR46 | Phase 1 carry | P1 |
| 4 | `ds-library-empty` | Library · empty state with primary CTAs | FR13, FR14 | Phase 1 carry | P1 |
| 5 | `ds-library` | Library · populated, Continue / Recently edited / All pages | FR13, FR16 | Phase 1 carry | P1 |
| 6 | `ds-editor` | Block editor · clean state | FR13, FR14, FR15, FR51 (anchor host) | Story 7.1, 7.2, 11.7 | P2 |
| 7 | `ds-inline` | ⌘K inline composer with diff preview | **FR53** (inline Agent), FR59 (scope visible) | **Story 11.7** + Story 11.3 + Story 12.1/12.3 | P2 |
| 8 | `ds-running` | Agent run in progress (LocalAgentPanel) | **FR54** (page Agent), FR56 | **Story 11.4** + Story 11.6 | P2 |
| 9 | `ds-inspector` | Run Inspector · streaming (timeline + diff + 3 view modes) | **FR56** (write-ahead audit trail) | Story 10.3, 11.6, 11.8 | P2 |
| 10 | `ds-inspector-done` | Run Inspector · completed run | FR56, **FR57** (rollback trigger entry) | Story 10.3, **Story 10.5** | P2 |
| 11 | `ds-search` | Vector + full-text search | FR40 | Phase 1 carry | P1 |
| 12 | `ds-palette` | Command palette (⌘P) | **FR55** (workspace Agent anchor) | **Story 11.7** workspace anchor | P2 |
| 13 | `ds-cloud-fallback` | Cloud BYOK fallback authorization modal | Provider port + FR52 boundary | Story 11.1 host wiring | P2 |
| 14 | `ds-settings-general` | Settings · General | FR3, FR4 | Phase 1 carry | P1 |
| 15 | `ds-settings-models` | Settings · Models (installed + cloud) | Provider port | Story 11.1 host wiring | P2 |
| 16 | `ds-models` | Settings · Model download list | Provider port | Story 11.1 host wiring | P2 |
| 17 | `ds-models-pulling` | Settings · Model downloading | Provider port | Story 11.1 host wiring | P2 |
| 18 | `ds-settings-shortcuts` | Settings · Keyboard shortcuts | NFR17 a11y | Phase 1 carry | P1 |
| 19 | `ds-settings-vault` | Settings · Vault (path + sync) | FR52 + Phase 1 | P2 augments P1 | P2 |
| 20 | `ds-settings-about` | Settings · About + dependency audit | FR60 visibility (`@anydocs/editor` package surfaced here) | Story 6.1 metadata | P2 |
| 21 | `ds-sync-conflict` | Vault sync conflict banner | Phase 1 carry (BYOS) | Phase 1 carry | P1 |
| 22 | `ds-build` / `ds-build-failed` | Build & Publish · success / failure | FR24, FR25, FR33 | Phase 1 carry | P1 |
| — | (dark mode) | Dark theme demonstration | NFR (universal) | All | All |

**Total coverage of PRD vNext FRs in design:**
- FR51 (anchors): partial (inline + page; workspace anchor needs explicit label in palette — **see §6.4**)
- FR52 (desktop fs): no UI surface — fs is invisible by design; runtime indicator handled by LocalChip + LocalStatusBar
- FR53 (inline Agent): ✓ ⌘K inline
- FR54 (page Agent): ✓ LocalAgentPanel
- FR55 (workspace Agent): partial — needs explicit palette entry (see §6.4)
- FR56 (write-ahead audit): ✓ Run Inspector (in-progress); historical query missing (see §6.2)
- FR57 (audit query + rollback): ⚠️ partial — Run Inspector covers single run; historical browse + rollback affordance missing (see §6.2)
- FR58 (runtime mode indicator): ✓ LocalChip + LocalStatusBar + LocalTopbar — fully covered
- FR59 (scope visible + escalation confirmation): ⚠️ scope text in agent panel; explicit scope badge + escalation modal missing (see §6.1 and §6.3)
- FR60 (`@anydocs/editor` contract): no UI surface; surfaced indirectly in `ds-settings-about` dependency list

---

## 4. User Journeys (Mapped to Design Screens)

The PRD's **Journey 4** (desktop + Agent协同编辑) decomposes into the following design-anchored journey:

### Journey 4 — Frame-by-Frame

| Step | Frame | Screen ID | Notes |
|---|---|---|---|
| 1 | Cold launch desktop app | (Tauri shell launches MacWindow) | NFR26 startup budget |
| 2 | Select vault, see library | `ds-library` | LocalChip present from frame 1 |
| 3 | Open `quick-start.md` in editor | `ds-editor` | LocalTopbar shows path + `Reveal` |
| 4 | Press ⌘K, select text → inline Agent | `ds-inline` | Scope badge = `inline` visible inside composer (gap closure §6.1) |
| 5 | Inline Agent diff appears; accept / reject | (`ds-inline` diff preview) | Audit entry persisted before write (architecture §11.6) |
| 6 | Open LocalAgentPanel (⌘.) for page-level work | `ds-running` | Header reads "scoped to this page" — scope badge added (gap closure §6.1) |
| 7 | Need cross-page edit → invoke from palette ⌘P | `ds-palette` | Explicit "Workspace agent" entry (gap closure §6.4) |
| 8 | Palette → confirms escalation inline → page → workspace | **Scope Escalation Modal** | Gap closure §6.3 |
| 9 | Workspace Agent run streams; Run Inspector available | `ds-inspector` | tok/s + GPU pulse via ModelBadge |
| 10 | Open audit log to inspect today's runs | **Audit Log Query view** | Gap closure §6.2 |
| 11 | Select an entry → roll back | (audit log query view) | Story 10.5 rollback service |
| 12 | Re-build site, preview | `ds-build` | Phase 1 carry; LocalChip throughout |

### Other Phase 1 Journeys (Adopted As-Is)

- Journey 1 (Alex 0→site): screens `ds-welcome → ds-onboard-* → ds-library-empty → ds-editor → ds-build`
- Journey 2 (Sarah legacy import): primarily CLI; library shows imported folder
- Journey 3 (Mike reader): out of scope — reader is the published static site, not the desktop app

---

## 5. Component Strategy

### 5.1 Adoption Boundary

| Layer | Source | Adoption |
|---|---|---|
| Design tokens (`tokens.css`) | Claude Design | **Authoritative** — copy file verbatim into `packages/web/themes/anydocs-desktop/` or `packages/editor/styles/`. Do not transcribe values. |
| Shell primitives (`desktop-shell.jsx`) | Claude Design | **Authoritative** — port to project's component library; preserve naming (MacWindow, LocalChip, ModelBadge, LocalAgentPanel, LocalTopbar, LocalStatusBar). |
| 22 screen compositions | Claude Design | **Reference** — recreate composition pixel-faithful; minor adjustments allowed for live data. |
| Block editor body (`LocalDocBody`, `.doc` class) | Claude Design | **Authoritative** — port the typography rules to `@anydocs/editor`. |
| Agent anchor UX (inline / page / workspace) | This document | Augments Claude Design with explicit scope badge — see §6.1 |
| Scope escalation modal | This document | New design — see §6.3 |
| Audit log query view | This document | New design — see §6.2 |

### 5.2 Component Inventory for Phase 2 Stories

The following mapping shows which design primitive each Phase 2 story consumes:

| Story | Components Required | Source |
|---|---|---|
| 6.1 (`@anydocs/editor` scaffold) | None (package skeleton) | — |
| 6.2 (Plate runtime) | `LocalDocBody` typography | desktop-shell.jsx |
| 6.4 (8 built-in plugins) | Block visuals from `ds-editor` | desktop-screens-main.jsx |
| 7.1 (editor-host adapter) | None (adapter code) | — |
| 8.3 (RuntimeModeIndicator) | `LocalChip` + `LocalStatusBar` `ModelBadge` | desktop-shell.jsx |
| 9.1 (Tauri shell) | `MacWindow` chrome + traffic light offsets | desktop-shell.jsx |
| 9.5 (desktop renderer wiring) | Whole desktop shell | desktop-shell.jsx |
| 10.4 (audit query API) | **Audit Log Query view** | This doc §6.2 |
| 10.5 (rollback service) | Rollback affordance in audit detail | This doc §6.2 |
| 11.3 (inline Agent) | `⌘K Inline composer popover` | `ds-inline` in desktop-screens-main.jsx |
| 11.4 (page Agent) | `LocalAgentPanel` + scope badge | desktop-shell.jsx + this doc §6.1 |
| 11.5 (workspace Agent) | Command palette entry | `ds-palette` + this doc §6.4 |
| 11.7 (Agent anchors in editor) | inline ⌘K + LocalAgentPanel + palette workspace entry | All three sources + this doc |
| 11.8 (Run Inspector) | `ds-inspector` + `ds-inspector-done` | desktop-screens-inspector.jsx |
| 12.3 (escalation confirmation modal) | **Scope Escalation Modal** | This doc §6.3 |

---

## 6. Gap Closure Specifications (Trust-Critical UX Patterns)

This section delivers the four UX patterns that the Claude Design package does not explicitly cover. Each pattern is specified to the level Story Dev can implement without further design rounds.

### 6.1 Explicit Scope Badge in Editor (Gap G3 — supports FR51, FR59)

**Problem:** The Claude Design `LocalAgentPanel` header reads "scoped to this page" as static text. PRD FR59 requires the active scope to be **explicitly visible at invocation time**, supporting <10% scope-misfire rate.

**Solution:** Replace the static "scoped to this page" subtitle with a visible **scope badge** that is also a dropdown trigger for scope selection.

#### 6.1.1 Scope Badge Component (`ScopeBadge`)

**Visual:**

```
┌─────────────────────────┐
│ ◆ Page · webhooks.md  ▾ │   ← height 24, radius 6, font-mono 11, AI accent
└─────────────────────────┘
   ↑ scope icon  ↑ resource hint  ↑ disclosure chevron
```

**Three states:**

| Scope | Icon | Background | Border | Label |
|---|---|---|---|---|
| `inline` | `Ic.cursor(11)` (block cursor) | `--ai-50` | `--ai-300` 28% | `Inline · <block-preview>` |
| `page` | `Ic.doc(11)` | `--ai-50` | `--ai-300` 28% | `Page · <pageId>` |
| `workspace` | `Ic.folder(11)` | `--ai-100` | `--ai-500` 35% | `Workspace · <projectName>` |

**Dropdown menu (`<ScopePicker>`)** opens on click. Items:

```
◆ Inline               ⌘K     ← current selection in active block
◆ Page · webhooks.md   ⌘⇧K
◆ Workspace · Anydocs  ⌘⇧⌥K
───────────────────────
History 14 runs today  →
```

- **Selecting a wider scope** triggers Scope Escalation Modal (§6.3)
- **Selecting a narrower scope** does not require confirmation (narrowing is safe)
- Item icons match scope; right column shows keyboard shortcuts (KBD primitive)

#### 6.1.2 Placement

| Surface | Position |
|---|---|
| `⌘K Inline composer popover` (`ds-inline`) | Top-left inside popover, replacing the "Inline · suggestion" chip |
| `LocalAgentPanel` header (`ds-running`) | Replaces the "scoped to this page" subtitle line; positioned right after the "Writer" name |
| Command palette workspace entry (`ds-palette`) | The palette item itself acts as the badge for workspace invocation; modal §6.3 closes scope-up |

#### 6.1.3 Accessibility

- Keyboard: `Tab` reaches badge; `Enter` / `Space` opens dropdown
- ARIA: `role="button" aria-haspopup="menu" aria-expanded={open}`
- Screen reader label: "Agent scope: {scope}, {resource}. Click to change scope."

#### 6.1.4 Token usage

- Use `--ai-50` background and `--ai-300` at 28% alpha for border (matches existing AI chip styling in `tokens.css`)
- Focus ring: `0 0 0 3px var(--ai-glow)` (matches existing `.btn.ai` style)

---

### 6.2 Audit Log Query View (Gap G2 — supports FR57)

**Problem:** The Claude Design `ds-inspector` covers an **in-progress single run**. PRD FR57 requires historical query by scope/resource/time AND a rollback affordance per entry. Neither exists in the handoff.

**Solution:** Extend the Run Inspector pattern into a two-level surface:
- **Audit Log Query view** — list of past runs with filters
- **Run Inspector** (already designed) — detail view for any selected entry

#### 6.2.1 Entry Point

Add a new menu item to the existing Command Palette (`ds-palette`):

```
Audit log…                                  ⌘⇧A
  Browse Writer history and roll back
```

Also link from the existing "Recent runs (local)" section in `LocalAgentPanel`: "See all (14 today) →" link routes to this view.

#### 6.2.2 Layout (Window-filling, like `ds-inspector`)

```
┌─ MacWindow: "Anydocs — Audit log" ──────────────────────────────────┐
│ ┌─Filter bar (60px)─────────────────────────────────────────────┐  │
│ │ Scope: [All ▾] Resource: [Any page ▾] When: [Today ▾]        │  │
│ │ Status: [All ▾]            Search: [_______________]  ⌘F      │  │
│ └────────────────────────────────────────────────────────────────┘  │
│ ┌─List (left, 460px)──────────┐ ┌─Detail (right)──────────────────┐ │
│ │ 14:02 ◆ Page · webhooks.md │ │ (Full Run Inspector layout —     │ │
│ │   "Add retry policy" ✓     │ │  reuses ds-inspector-done)      │ │
│ │ 13:47 ◆ Inline · block-3   │ │                                  │ │
│ │   "Tighten intro" ✓        │ │ [Roll back] [Show in editor]    │ │
│ │ 13:12 ◆ Workspace · all    │ │                                  │ │
│ │   "Unify terms" ⚠ rejected │ │                                  │ │
│ │ ...                        │ │                                  │ │
│ └────────────────────────────┘ └──────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────┘
```

#### 6.2.3 List Row Specification

Each row:

```
┌─────────────────────────────────────────────────────────────────┐
│ 14:02  ◆ Page · webhooks.md                              ✓     │  ← row 52px
│ "Add retry policy section"                                       │  ← prompt (truncated)
│ llama-3.1-8b · 318 tok · 4.1s              4 blocks changed     │  ← meta
└─────────────────────────────────────────────────────────────────┘
```

**Status icons (right edge):**
- `Ic.check(11)` on `--ok-700` for `committed`
- `Ic.spin(11)` on `--ai-700` for `pending` (rare; would only appear during in-flight visit)
- `Ic.warn(11)` on `--warn-700` for `rejected`
- `Ic.rotate(11)` on `--n-500` for entries with `operation: 'rollback'`

#### 6.2.4 Filter Bar Behavior

| Filter | Options | Backed by |
|---|---|---|
| Scope | All / Inline / Page / Workspace | `query({ scope })` |
| Resource | Any / Specific page picker / Navigation | `query({ target })` |
| When | Today / This week / Last 30 days / Custom range | `query({ timestamp })` |
| Status | All / Committed / Rejected / Rolled-back | `query({ status, operation })` |
| Search | Free text against `diff.summary` and `promptDigest` resolved label | post-filter on result set |

#### 6.2.5 Rollback Affordance (FR57)

In the **Detail panel** of any `committed` entry:

```
┌──────────────────────────────────────────────────┐
│ Status: ✓ Committed · 14:02                       │
│ Result: 4 blocks added under "Retry behavior"     │
│                                                   │
│ [⤺ Roll back this change]  [Show in editor]      │
└──────────────────────────────────────────────────┘
```

**Click flow:**
1. Click "Roll back this change" → confirmation dialog (lightweight; reuses BMad confirmation primitive)
2. Dialog: "Roll back 'Add retry policy section'? This will restore the file to its state at 14:02 and add a new audit entry."
3. Buttons: `[Cancel]` (ghost) and `[Roll back]` (primary, but in `--bad-500` since destructive)
4. On confirm → call `audit-log-service.rollback(entryId)` → new audit entry appears in list with `operation: 'rollback'` and `rollbackOf: entryId`

**Rejected / rolled-back entries** do not show the rollback button (matches Story 10.5 `RollbackNotApplicableError`).

#### 6.2.6 Empty state

If no audit entries match filters: centered text with `--n-500` "No Writer activity in this range" and a "Clear filters" link.

#### 6.2.7 Pruning hint

In the filter bar far right, when filters span > 30 days back: small mono text "Retention: 30 days" (using `--n-500` style from `LocalStatusBar`).

---

### 6.3 Scope Escalation Confirmation Modal (Gap G1 — FR59, NFR33)

**Problem:** PRD FR59 mandates explicit user confirmation for any scope widening. The Claude Design `ds-cloud-fallback` modal is conceptually similar (explicit consent for a wider behavior) but addresses **LLM provider fallback**, not Agent scope. A purpose-built modal is needed.

**Solution:** Design the modal by adapting the visual pattern of `ds-cloud-fallback` (vetted trust-critical pattern from Claude Design) with new content that addresses scope semantics.

#### 6.3.1 Trigger

Modal appears when:
- User selects a wider scope from `ScopeBadge` dropdown (inline → page, inline → workspace, page → workspace)
- User invokes a wider Agent (e.g., palette workspace entry) while editor is mounted on a narrower context

Modal does NOT appear when:
- User selects a narrower scope (always safe)
- Same scope re-invocation

#### 6.3.2 Layout (Modal, 540px wide, centered)

```
┌─ Backdrop (n-900 @ 40%) ───────────────────────────────────────┐
│                                                                  │
│  ┌─ Modal (540 × auto, radius 12, sh-3) ──────────────────────┐ │
│  │                                                              │ │
│  │  ◆ Expand Writer's scope?                              ✕    │ │
│  │  ───────────────────────────────────────────────────         │ │
│  │                                                              │ │
│  │  Writer is currently scoped to:                              │ │
│  │  ┌─────────────────────────────────────────────────┐         │ │
│  │  │ ◆ Inline · current block (line 14)              │         │ │
│  │  └─────────────────────────────────────────────────┘         │ │
│  │                                                              │ │
│  │  This request needs:                                         │ │
│  │  ┌─────────────────────────────────────────────────┐         │ │
│  │  │ ◆ Workspace · Anydocs (148 files)               │         │ │
│  │  └─────────────────────────────────────────────────┘         │ │
│  │                                                              │ │
│  │  Writer can edit any file in this vault until you            │ │
│  │  end the run. Every change goes through the audit            │ │
│  │  log and can be rolled back.                                 │ │
│  │                                                              │ │
│  │  ☐ Don't ask again for workspace scope today                 │ │
│  │                                                              │ │
│  │  ┌─────────────┐  ┌──────────────────────────────────┐      │ │
│  │  │  Cancel     │  │ ⤴ Expand to Workspace             │      │ │
│  │  └─────────────┘  └──────────────────────────────────┘      │ │
│  │                                                              │ │
│  └──────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

#### 6.3.3 Content Variants

Three variants based on (from → to):

| From | To | Headline | Body text |
|---|---|---|---|
| inline | page | "Expand to page scope?" | "Writer can edit anywhere in {pageName} until the run ends." |
| page | workspace | "Expand to workspace scope?" | "Writer can edit any file in {vaultName} ({fileCount} files)." |
| inline | workspace | "Expand to workspace scope?" | Same as page → workspace |

#### 6.3.4 Buttons

- **Cancel** (ghost, leading) — `--n-50` background, `--n-200` border, 36px height, mono spacing
- **Expand to {scope}** (primary AI) — uses `.btn.ai` styling: `--ai-500` bg, `--ai-glow` ring, white text, `Ic.arrowUp` (rotated) glyph prefix
- Default focus: **Cancel** (safer default; user must explicitly tab to Expand)

#### 6.3.5 Keyboard & Accessibility (per Story 12.3)

- `Esc` → Cancel
- `Tab` order: Close (✕) → Cancel → Don't-ask-again checkbox → Expand
- Focus trap inside modal until dismissed
- `Enter` only triggers Expand when Expand has explicit focus (no enter-on-modal-mount shortcut)
- ARIA: `role="alertdialog" aria-labelledby="esc-headline" aria-describedby="esc-body"`
- Screen reader announcement on open: "{Headline}. Currently scoped to {from}. Expanding to {to}. {Body text}."

#### 6.3.6 "Don't ask again" semantics

- Checkbox preference is **per-target-scope** and **per-session** (not persisted across app restarts)
- Stored in `runtime` module (architecture §runtime), not in user config
- Resets on app launch — trust-critical: a fresh app session always asks once

#### 6.3.7 Token & Source Mapping

- Backdrop: `color-mix(in oklch, var(--n-900) 40%, transparent)` matching `ds-cloud-fallback`
- Modal surface: `var(--n-0)` with `--sh-3` shadow
- Headline: `--t-18` weight 600, color `--n-900`
- Body: `--t-13` color `--n-600` line-height 1.5
- Scope chips inside modal: same `ScopeBadge` component from §6.1
- Checkbox: standard system checkbox styled with `--n-300` border and `--ai-500` check
- Primary button styling: `.btn.ai` from `tokens.css` (line 196–199)

#### 6.3.8 Architectural Hook (per architecture §scope-escalation)

- On confirm: editor host mints signed escalation token (Story 12.1)
- Token TTL: 30 seconds
- Token binds `from_scope`, `to_scope`, `resource_id`
- Modal cancel: no token minted; Agent invocation aborts
- `agent-service.ts.invokeAgent()` verifies token (Story 12.2); missing/expired/mismatched → `EscalationConfirmationRequiredError`

---

### 6.4 Workspace Agent Explicit Anchor in Command Palette (Gap G4 — supports FR55)

**Problem:** The Claude Design `ds-palette` (command palette) is the natural workspace entry but doesn't explicitly label any item as "Workspace Agent".

**Solution:** Add an explicit Agent section at the top of the palette with three scope-labeled entries.

#### 6.4.1 Palette Structure (Augmented)

```
┌─ Palette overlay (640 × 480) ──────────────────────────┐
│ ┌─Input───────────────────────────────────────────────┐│
│ │ ⌘  Type a command or ask Writer…                    ││
│ └─────────────────────────────────────────────────────┘│
│                                                          │
│ ─ ASK WRITER ─                                          │
│  ◆ Ask Writer · inline                       ⌘K        │
│  ◆ Ask Writer · this page (webhooks.md)      ⌘⇧K       │
│  ◆ Ask Writer · workspace                    ⌘⇧⌥K  ★  │ ← NEW explicit label
│                                                          │
│ ─ NAVIGATION ─                                          │
│  → Switch file…                              ⌘O        │
│  → Recent files…                                        │
│                                                          │
│ ─ ACTIONS ─                                             │
│  → Build & Publish                                      │
│  → Audit log…                                ⌘⇧A   ★   │ ← NEW (links to §6.2)
│  → Toggle dark mode                          ⌘⇧L       │
│  ...                                                    │
└─────────────────────────────────────────────────────────┘
```

The "Ask Writer · workspace" entry, when activated outside an existing workspace-scope context, triggers the Scope Escalation Modal (§6.3) before launching the Agent.

#### 6.4.2 Visual Treatment

- Section headers (`ASK WRITER`, `NAVIGATION`, `ACTIONS`): `--t-11` `--n-400` uppercase letter-spacing `0.1em`
- Each Agent entry uses the inline `ScopeBadge` (§6.1) variant as the leading glyph
- Keyboard shortcuts shown on right via `KBD` primitive
- New star (★) markers in the spec above are documentation only — not in the actual UI

---

## 7. Visual States and Edge Cases (Cheatsheet)

The Claude Design `README.md §6` notes that the 22 static screens do not cover all states. This section closes those gaps.

### 7.1 Universal Input State Rules

| State | Treatment |
|---|---|
| Default | `--n-50` bg, `--n-200` border |
| Hover | `--n-100` bg |
| Focus | `--brand-500` focus ring (`box-shadow: 0 0 0 3px color-mix(in oklch, var(--brand-500) 25%, transparent)`) |
| Disabled | `--n-100` bg, `--n-400` text, no border-color change, `cursor: not-allowed` |
| Error | `--bad-700` text, `--bad-50` bg, `--bad-500` 30% border |

### 7.2 Editor Selection

- Background: `--n-100` (light mode), `--n-150` (dark mode)
- Active inline Agent diff range: `--ai-50` background + `box-shadow: inset 3px 0 0 var(--ai-500)` (matches `.diff-ins` in tokens.css)

### 7.3 Button States

- `.btn:active`: bg → next darker step (`--n-100` → `--n-150`)
- `.btn:disabled`: bg `--n-50`, text `--n-400`, opacity 100% (do not dim — keep readable)
- `.btn.ai:disabled`: bg `--ai-300`, text white at 85% opacity (do not break the AI accent)

### 7.4 Toast / Inline Error (Per Claude Design §6 Issue 4)

| Surface | Spec |
|---|---|
| **Toast** | Bottom-right, `--n-900` bg, `--n-0` text, `--r-12` radius, `--sh-3` shadow, auto-dismiss 4s, max-width 360 |
| **Inline error** | Below input field; `--bad-700` text; `--t-12`; 4px top margin |

---

## 8. Accessibility

### 8.1 Compliance Target

WCAG 2.1 AA (carries over Phase 1 NFR15). Keyboard-only flows must complete for all primary interactions (NFR16).

### 8.2 Critical A11y Checks for New Patterns

| Pattern | Requirement | Verification |
|---|---|---|
| ScopeBadge dropdown (§6.1) | Reachable via keyboard, ARIA menu role | Story 11.7 e2e |
| Audit log query view (§6.2) | List rows keyboard-navigable; filter dropdowns ARIA-compliant | Story 10.4 e2e |
| Audit detail rollback (§6.2.5) | Destructive primary uses `--bad-500`; confirm dialog focus-trapped | Story 10.5 e2e |
| Scope escalation modal (§6.3) | Focus trap, default-Cancel focus, Esc closes, `role="alertdialog"` | **Story 12.3 + 12.4 e2e** |
| Command palette Agent entries (§6.4) | Each entry has discrete keyboard shortcut + ARIA label | Story 11.7 e2e |

### 8.3 Color-Independent Meaning

All status uses **icon + label** (not color alone):

- ✓ Committed (check icon + green)
- ⚠ Rejected (warn icon + amber)
- ⤺ Rolled back (rotate icon + neutral)
- ◆ Scope (diamond icon + label text)

This satisfies NFR17 (zero color-only meaning violations).

### 8.4 Reduced Motion

- LocalChip pulse animation must respect `prefers-reduced-motion: reduce` → static green dot
- Agent panel `pulse` class same rule
- Run Inspector spinner: static check icon under reduced motion

---

## 9. Responsive / Window Sizing

Desktop is fixed-window (Tauri shell). Minimum window: **960 × 640** (declared in `tauri.conf.json` per Story 9.1).

At < 1100px width:
- `VaultSidebar` collapses to icons-only (40px wide) via `⌘\` toggle
- `LocalAgentPanel` overlays editor instead of pushing it

At < 800px width: not supported (desktop UX is opinionated; minimum protects layout integrity).

---

## 10. Dark Mode

Adopted from Claude Design `tokens.css [data-theme="dark"]` block. Single switch toggles all tokens. No bespoke dark-mode design per component required.

**New patterns must verify in dark mode:**
- ScopeBadge: `--ai-50` resolves to dark `oklch(0.235 0.045 275)` per tokens; verify legibility against `--n-50` (dark) surface
- Audit log query list: row hover `--n-100` works in dark via auto-invert
- Scope escalation modal backdrop: `--n-900 @ 40%` works in both themes since `--n-900` inverts to near-white in dark mode (verify backdrop is still legible — adjust to `oklch(0 0 0 / 50%)` if needed)

---

## 11. Open Questions / Decisions for Implementation

| Question | Owner | Resolution Path |
|---|---|---|
| Should audit log query view be a separate window or in-window panel? | Dev | Prototype both during Story 10.4; bias toward in-window panel (less context switch) |
| ScopeBadge dropdown vs inline scope selector tabs (Tabs in `ds-inspector` use a tabs primitive — could be reused) | Dev + UX | Try dropdown first; switch to tabs if dropdown feels heavy in Story 11.7 user testing |
| "Don't ask again for workspace today" — is per-session enough, or should it be per-vault? | Product | Per-session for safety; revisit after first 100 desktop installs |
| Should the modal show a preview of which files Workspace Agent will touch? | Product | Out of scope for Phase 2 — would require Agent dry-run; revisit in Phase 3 |

---

## 12. Implementation Handoff Checklist (for Sprint Master)

### 12.1 Per-Story UX Readiness

| Story | UX Status | Dependency |
|---|---|---|
| 6.1, 6.2, 6.3, 6.4, 6.5 (editor package) | ✅ No UX gating — internal package work | — |
| 7.1, 7.2, 7.3 (Studio cutover) | ✅ Adopt Claude Design `ds-editor` + LocalTopbar | — |
| 8.1, 8.2 (runtime mode resolver) | ✅ No UX gating | — |
| 8.3 (RuntimeModeIndicator) | ✅ LocalChip + LocalStatusBar from Claude Design | — |
| 8.4 (cross-mode tests) | ✅ Internal | — |
| 9.1, 9.2, 9.3 (Tauri shell + fs) | ✅ MacWindow from Claude Design | — |
| 9.4–9.7 (desktop validation) | ✅ Internal | — |
| 10.1–10.3 (audit subsystem) | ✅ Internal | — |
| 10.4 (audit query API) | ✅ **§6.2 closes the UI gap** | This doc §6.2 |
| 10.5 (rollback service) | ✅ **§6.2.5 closes affordance gap** | This doc §6.2.5 |
| 10.6–10.7 (retention + versioning) | ✅ Internal | — |
| 11.1, 11.2 (provider port + scope validator) | ✅ Internal | — |
| 11.3 (inline Agent) | ✅ `ds-inline` + scope badge §6.1 | This doc §6.1 |
| 11.4 (page Agent) | ✅ `LocalAgentPanel` + scope badge §6.1 | This doc §6.1 |
| 11.5 (workspace Agent) | ✅ Palette entry §6.4 | This doc §6.4 |
| 11.6 (agent-service wire) | ✅ Internal | — |
| 11.7 (Agent anchors) | ✅ §6.1 (badge) + §6.4 (palette) close gaps | This doc §6.1 + §6.4 |
| 11.8 (latency tests) | ✅ Internal | — |
| 11.9 (audit fault-injection) | ✅ Internal | — |
| 12.1, 12.2 (escalation token) | ✅ Internal | — |
| 12.3 (escalation modal) | ✅ **§6.3 closes the UX gap** | This doc §6.3 |
| 12.4 (escalation e2e) | ✅ Internal (drives §6.3 design) | — |
| **13.1 (tokens + shell primitives port)** | ✅ Source: `tokens.css` + `desktop-shell.jsx` from Claude Design | Claude Design handoff |
| **13.2 (shell recompose)** | ✅ Source: `ds-editor` composition | Claude Design handoff |
| **13.3 (VaultSidebar replaces navigation-composer)** | ✅ Source: `VaultSidebar` primitive | Claude Design handoff |
| **13.4 (Library surface)** | ✅ Source: `ds-library` + `ds-library-empty` | Claude Design handoff |
| **13.5 (Four-step Onboarding)** | ✅ Source: `ds-welcome` + `ds-onboard-model` + `ds-onboard-done` | Claude Design handoff |
| **13.6 (Settings 6-page restructure)** | ✅ Source: `ScreenSettingsGeneral/Models/Vault/Shortcuts/About` + `ScreenSettingsModelsPulling` | Claude Design handoff |
| **13.7 (Command Palette + workspace Agent entry)** | ✅ Source: `ds-palette` + UX spec §6.4 | Claude Design handoff + this doc §6.4 |
| **13.8 (Run Inspector)** | ✅ Source: `ds-inspector` + `ds-inspector-done` | Claude Design handoff |
| **13.9 (Build & Publish UI)** | ✅ Source: `ScreenLocalBuild` + `ScreenLocalBuildFailed` | Claude Design handoff |
| **13.10 (Audit Log Query view)** | ✅ **§6.2 closes the UX gap** | This doc §6.2 |
| **13.11 (Dark mode + visual regression)** | ✅ Source: `tokens.css [data-theme="dark"]` + this doc §10 + §8 | Claude Design handoff + this doc |

**All Phase 2 stories (50 total: 39 Epic 6–12 service-layer + 11 Epic 13 UI shell) now have UX coverage.**

### 12.2 Source-of-Truth Files for Dev

| Layer | Path |
|---|---|
| Tokens | `/Users/shawn/Downloads/anydocs-desktop-handoff/tokens.css` → port to `packages/editor/styles/tokens.css` |
| Shell primitives | `/Users/shawn/Downloads/anydocs-desktop-handoff/desktop-shell.jsx` → port to `packages/web/components/desktop-shell/` |
| 22 reference screens | `/Users/shawn/Downloads/anydocs-desktop-handoff/Anydocs Desktop.html` (open via `npx serve .`) |
| Gap closure specs | This document §6.1–§6.4 |
| States cheatsheet | This document §7 |
| Accessibility specs | This document §8 |

### 12.3 First Implementation Order (Aligned to Sprint Plan)

1. **Sprint 1:** Port `tokens.css` into project; port `MacWindow`, `LocalChip`, `ModelBadge`, `LocalStatusBar`, `LocalTopbar` — establishes design system in code
2. **Sprint 2:** Implement `LocalDocBody` typography in `@anydocs/editor`; port `VaultSidebar` + `LocalAgentPanel`
3. **Sprint 3:** Implement `ds-editor` composition (Studio cutover); implement audit query view (§6.2)
4. **Sprint 4:** Implement ScopeBadge (§6.1); implement palette workspace entry (§6.4); implement Run Inspector composition
5. **Sprint 5:** Implement Scope Escalation Modal (§6.3); finalize Run Inspector + audit log integration; e2e validations

---

## 13. Sign-Off

### 13.1 Decision Record

- **2026-05-24:** UX gap closure spec produced as bridge between Claude Design handoff (22 screens) and PRD/Architecture/Epics. Four trust-critical patterns specified (§6.1–§6.4). No new design directions explored; established Claude Design system adopted as authoritative.

### 13.2 What This Document Locks

- All 22 Claude Design screens are **authoritative** for Phase 2 visual implementation
- Tokens (`tokens.css`) are **the only acceptable source** for color/typography/spacing values — no hand-tuned values per component
- Four gap closure patterns (ScopeBadge, Audit Log Query, Scope Escalation Modal, Workspace Palette Entry) are **specified to dev-ready level** and locked for Phase 2
- Phase 3 collaboration patterns (presence, sharing, team mode) are **out of scope** — see PRD anchors

### 13.3 What Remains Open

- 4 minor implementation decisions (§11) deferred to dev judgment with documented bias
- Audit log compression for retention scenarios beyond Phase 2 (deferred to Phase 3 architecture addendum)
- LLM provider concrete adapter UX beyond the existing `ds-cloud-fallback` pattern (deferred to host configuration; out of UX scope)

### 13.4 Phase 2 UX Status

✅ **Ready for Sprint 1 kickoff.** No remaining trust-critical UX gaps. Two major UX advisories from `implementation-readiness-report-2026-05-24.md` (Story 11.7 anchors + Story 12.3 modal) are closed by §6.1 and §6.3 respectively.

---

**End of UX Design Specification.**

For visual reference, open the Claude Design handoff:

```bash
cd /Users/shawn/Downloads/anydocs-desktop-handoff
npx serve .
# → http://localhost:3000/Anydocs%20Desktop.html
```

The interactive canvas exposes all 22 screens with `data-link` navigation; treat it as the visual companion to this document.
