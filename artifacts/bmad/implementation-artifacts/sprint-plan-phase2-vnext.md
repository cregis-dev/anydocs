---
generated: '2026-05-24 (Epic 13 addendum)'
previous_generated: '2026-05-24 (initial)'
project: anydocs
phase: 'Phase 2 — Single-User vNext'
scope: 'Epic 6–13 (50 stories total), FR51–FR60 + NFR26–NFR33 (Epic 6–12 service layer + Epic 13 UI shell)'
phase3_anchors: 'FR61–FR64 + NFR34 — NOT in this plan; reserved per architecture addendum'
source_artifacts:
  - artifacts/bmad/planning-artifacts/prd.md
  - artifacts/bmad/planning-artifacts/architecture.md
  - artifacts/bmad/planning-artifacts/epics.md
  - artifacts/bmad/planning-artifacts/implementation-readiness-report-2026-05-24.md
status_tracker: artifacts/bmad/implementation-artifacts/sprint-status.yaml
companion_to: artifacts/bmad/implementation-artifacts/sprint-status.yaml
---

# Phase 2 vNext — Sprint Plan

**Date:** 2026-05-24
**Scope:** Phase 2 single-user vNext (7 epics, 39 stories, 18 vNext requirements)
**Status tracker:** `artifacts/bmad/implementation-artifacts/sprint-status.yaml`
**Readiness gate:** `READY WITH ADVISORIES` (0 critical issues; 2 major UX advisories tracked here as a parallel track)

---

## Cohort Overview

Five development sprints + one UX parallel track. Sprint cohorts honor the backward dependency chain established in `epics.md` and the architecture addendum. No forward cross-epic dependencies; cohorts can ship incrementally.

| Sprint | Theme | Service-layer Stories | Studio Shell (Epic 13) Stories | Story Count | Critical Path | Required Predecessors |
|---|---|---|---|---:|---|---|
| **S1** | Foundation primitives | 6.1, 6.5, 8.1, 8.2, 10.1 | **13.1** (tokens + shell primitives) | 6 | Yes — unblocks everything | UX track kick-off |
| **S2** | Editor runtime + desktop scaffold | 6.2, 6.3, 6.4, 9.1, 9.2, 9.3 | **13.2** (shell recompose), **13.3** (VaultSidebar) | 8 | Yes | S1 done (13.1 primitives ready; 7.1 host adapter ready) |
| **S3** | Audit subsystem + Studio cutover | 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 7.1, 7.2, 7.3 | **13.4** (Library), **13.5** (Onboarding), **13.6** (Settings) | 12 | Yes | S2 done (shell + sidebar landed) |
| **S4** | Built-in Agent (core) | 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7 | **13.7** (Palette), **13.8** (Run Inspector), **13.9** (Build UI) | 10 | Yes | S3 done; **UX track for 11.7 must be done**; 13.7 needs 11.5; 13.8 needs 10.3 |
| **S5** | Safety, polish, desktop validation | 11.8, 11.9, 12.1, 12.2, 12.3, 12.4, 8.3, 8.4, 9.4, 9.5, 9.6, 9.7 | **13.10** (Audit Log Query), **13.11** (Dark mode + visual regression) | 14 | No | S4 done; **UX track for 12.3 must be done**; 13.10 needs 10.4 + 10.5 |
| **UX-T** | UX parallel track | UX-1, UX-2 | — | 2 | No (parallel) | S1 kick-off (no blocking dependency) |

**Total stories:** 50 (Epic 6–12: 39 + Epic 13: 11)
**Total sprints:** 5 + 1 UX parallel track

---

## Sprint Detail

### Sprint 1 — Foundation Primitives

**Goal:** Land the foundational contracts and resolvers that every later sprint depends on. After S1, four independent work streams (editor / desktop / audit / Agent) can proceed without re-revisiting contract decisions.

**Stories:**

| Story | Key | Notes |
|---|---|---|
| 6.1 | Scaffold `@anydocs/editor` package + public API contract file | Creates the contract file `contract/public-api.ts`. Foundational. |
| 6.5 | CI contract-diff check for `@anydocs/editor` | Locks the contract before consumers integrate. Pair with 6.1. |
| 8.1 | Runtime mode resolver in `@anydocs/core` | Process-level resolver. Read once, immutable. |
| 8.2 | Capability matrix + consumer migration rules | Lint/review rules prevent inline `if (runtimeMode === ...)` branches downstream. |
| 10.1 | Versioned audit entry JSON schema | Locks audit data shape before any audit producer/consumer code exists. |
| **13.1** | **Port `tokens.css` and shell primitives into `@anydocs/web`** | **Foundation for all Studio UI work; copies tokens.css verbatim + ports MacWindow / LocalChip / ModelBadge / LocalTopbar / LocalStatusBar / KBD. Parallel to 6.1.** |

**Exit criteria:**
- `@anydocs/editor` package compiles, contract file declared, CI diff active
- Runtime mode resolver returns `'web'` (no Tauri yet); fails fast on ambiguous environments
- Capability matrix exists; first consumer (any Phase 1 web code that needs a placeholder branch) migrates
- Audit schema v1 validates a sample fixture set
- Design tokens and shell primitives mounted in `packages/web/lib/desktop-shell/`; sample storybook or fixture renders all primitives in light + dark

**Risks:**
- Contract file premature lock — mitigation: 6.5 fails CI on first integration mismatch, allowing fast feedback
- Audit schema field omission — mitigation: schema versioning rule in 10.7 (later sprint) allows additive evolution

**UX Track parallel:** Kick off UX-1 and UX-2 (no blocking dependency on S1 stories).

---

### Sprint 2 — Editor Runtime + Desktop Scaffold

**Goal:** Internal editor runtime (Plate) ready; desktop shell scaffolded with native fs commands. Two parallel work streams converge into one capable runtime.

**Stories:**

| Story | Key | Notes |
|---|---|---|
| 6.2 | Plate-based block runtime inside the package | Internal implementation; consumers still use only contract. |
| 6.3 | `doc-content-v1 ↔ Plate` converters | Canonical storage preservation. Round-trip fixtures pass. |
| 6.4 | `EditorPlugin` contract + 8 built-in block types | Phase 1 minimal block set ported to new plugin contract. |
| 9.1 | Tauri shell scaffolding in `packages/desktop/src-tauri/` | Runnable shell that loads existing web export. |
| 9.2 | Rust-side native fs commands + path safety | `fs_commands.rs` with write-temp-then-rename. **Possibly large — split if scope creeps.** |
| 9.3 | `desktop-fs-adapter.ts` implementing `ContentRepository` | Bridges core repositories to Tauri IPC. |
| **13.2** | **Recompose Studio shell to four-region layout** | **Replaces three-column `local-studio-app.tsx` with VaultSidebar / LocalTopbar+main / LocalAgentPanel / LocalStatusBar. Depends on 13.1 + 7.1 (host adapter).** |
| **13.3** | **Replace navigation-composer with VaultSidebar file tree** | **Primary left rail becomes file tree showing real `.md` paths; navigation-composer demoted to advanced mode.** |

**Exit criteria:**
- `@anydocs/editor` mounts a Plate editor and produces canonical `doc-content-v1` output
- All Phase 1 block types are plugin-registered in the new editor
- Tauri shell launches and signals `runtime mode = desktop`
- Desktop fs adapter passes basic round-trip integration tests (not yet atomic-fault tested)
- Studio main app boots in the new four-region shell; Phase 1 acceptance tests pass against the new layout
- VaultSidebar reflects real vault on disk; selecting any file opens it in the editor

**Risks:**
- 9.2 scope creep — mitigation: pre-sprint refinement to consider per-command split
- Cross-platform Tauri quirks (Linux/macOS path canonicalization differences) — mitigation: 9.4 in S5 catches regressions

---

### Sprint 3 — Audit Subsystem + Studio Cutover

**Goal:** Complete audit log subsystem and migrate Studio to the new editor. After S3, Phase 2 has audit traceability for human writes and a unified editor across web + desktop.

**Stories:**

| Story | Key | Notes |
|---|---|---|
| 10.2 | Daily NDJSON audit repository | Storage layer. |
| 10.3 | Write-ahead lifecycle (`pending → committed → rejected`) | Service layer with rollback semantics. |
| 10.4 | Audit query API | Filter axes: scope/resource/time/status. |
| 10.5 | Rollback service | `rollback(entryId)` re-applies pre-change snapshot; produces new audit entry. |
| 10.6 | Retention prune (≥30 days) + CLI command | `anydocs audit prune`; system audit entry on prune. |
| 10.7 | Schema versioning rule + forward-compat tests | Locks the additive-evolution rule. |
| 7.1 | `editor-host` adapter in `@anydocs/web` | Consumer-side adapter; no internal imports. |
| 7.2 | Studio dual-mount with feature flag + parity fixtures | `STUDIO_EDITOR=anydocs-editor` flag; 100% fixture parity. |
| 7.3 | Studio cutover + retire Yoopta | Flip default; remove Yoopta deps from `packages/web`. |
| **13.4** | **Library surface (Continue + Recent + Stats)** | **Post-project-open landing surface; reuses welcome-screen for first-launch. Maps to `ds-library` + `ds-library-empty`.** |
| **13.5** | **Four-step Onboarding (Welcome → Vault → Model → Done)** | **Replaces single-screen welcome with stepper; Model step consumes Story 11.1 provider port.** |
| **13.6** | **Settings 6-page restructure** | **Splits `local-studio-settings.tsx` into General / Models / Vault / Shortcuts / About / Models-Pulling routable subpages.** |

**Exit criteria:**
- Audit log records human writes during normal Studio editing
- Query and rollback APIs work end-to-end
- Studio default editor is `@anydocs/editor`; Yoopta code removed
- All Phase 1 Studio regression tests still pass
- Library surface lands users after project open; Onboarding stepper drives first-launch
- Settings page architecture mirrors Claude Design `ScreenSettings*` set

**Risks:**
- 7.2 parity fixtures expose unexpected block-level divergences — mitigation: feature flag allows controlled rollback to Yoopta until parity is 100%
- Retention prune accidentally deletes wrong shards — mitigation: 10.6 requires system audit entry on prune (auditable trail); pre-prune dry-run mode

---

### Sprint 4 — Built-in Agent (Core)

**Goal:** Three-scope Agent subsystem fully wired through write-ahead audit. After S4, the headline Phase 2 user-facing capability is functional (but not yet safety-hardened — that's S5).

**Stories:**

| Story | Key | Notes |
|---|---|---|
| 11.1 | Abstract `AgentProviderPort` interface | No vendor name in `@anydocs/core`. |
| 11.2 | Scope validator pure functions | Pure assertion functions; unit-testable in isolation. |
| 11.3 | Inline Agent orchestrator (FR53) | Block-scope writes only. |
| 11.4 | Page Agent orchestrator (FR54) | Single pageId scope. |
| 11.5 | Workspace Agent orchestrator (FR55) | Multi-page + navigation; every target audit-logged. |
| 11.6 | Wire `agent-service.ts` through scope + audit (FR56) | 7-step write-ahead sequence integration. |
| 11.7 | Agent anchors in `@anydocs/editor` (FR51) | **Three invocation surfaces — possibly large; UX dependency.** |
| **13.7** | **Command Palette + workspace Agent entry** | **Maps to `ds-palette`; depends on 11.5 workspace agent + 12.3 escalation modal (modal can land in S5).** |
| **13.8** | **Run Inspector full-window surface** | **Maps to `ds-inspector` + `ds-inspector-done`; depends on 10.3 audit lifecycle events.** |
| **13.9** | **Build & Publish UI (success + failure)** | **Maps to `ds-build` + `ds-build-failed`; reuses existing core build service.** |

**Exit criteria:**
- Each Agent scope rejects out-of-scope writes (FR53/54/55 boundary tests pass)
- Every Agent write produces an audit entry; audit-failure injection rolls back content writes
- Inline/page/workspace anchors are reachable from Studio (functional, not necessarily polished — UX track required for finalization)
- Command palette exposes inline / page / workspace Agent entries with documented keyboard shortcuts
- Run Inspector renders streaming and completed states; integrates with audit lifecycle
- Build & Publish UI is the primary entry; CLI continues to work unchanged

**Risks:**
- 11.7 large — mitigation: pre-sprint refinement; consider splitting per scope if UX diverges
- Provider configuration friction (host wires concrete adapter outside core) — mitigation: include reference provider adapter under host (not in core); document wiring pattern
- **UX dependency:** UX-1 (Agent anchors interaction design) must be complete before 11.7 enters dev

---

### Sprint 5 — Safety, Polish, Desktop Validation

**Goal:** Harden Agent safety boundaries, complete scope escalation enforcement, finish desktop validation tests. After S5, Phase 2 is production-ready for single-user vNext.

**Stories:**

| Story | Key | Notes |
|---|---|---|
| 11.8 | Per-scope Agent latency budgets + integration tests (NFR28) | Inline ≤3s, page ≤8s, workspace single-step ≤2s. |
| 11.9 | Audit-failure fault-injection tests (NFR29) | Verifies write-ahead + rollback semantics under injected failures. |
| 12.1 | Escalation token signing in editor host | Short-TTL signed token on user confirmation. |
| 12.2 | `agent-service.ts` escalation token verification | Server-side defense in depth. |
| 12.3 | Studio escalation confirmation modal + keyboard accessibility (FR59) | **UX dependency.** |
| 12.4 | End-to-end test: unconfirmed escalation rejected (NFR33) | UI bypass simulation; service-layer rejection assertion. |
| 8.3 | `RuntimeModeIndicator` in Studio | Status bar surface. |
| 8.4 | Cross-mode round-trip fixture tests (NFR32) | `web ↔ desktop` mode switch preservation. |
| 9.4 | Atomic write fault-injection tests (NFR27) | Mid-flight write failures → original file unchanged. |
| 9.5 | Wire desktop renderer to `@anydocs/editor` + runtime mode | Final desktop integration. |
| 9.6 | Validate desktop call graph contains zero `/api/local/*` calls (FR52) | Network trace assertion. |
| 9.7 | Desktop cold-start budget enforcement (NFR26) | 95th-percentile ≤3s budget test. |
| **13.10** | **Audit Log Query view (UX spec §6.2)** | **Depends on 10.4 query API + 10.5 rollback; reuses Run Inspector layout for detail panel.** |
| **13.11** | **Dark mode + visual regression across migrated surfaces** | **Validates all Epic 13 surfaces in light/dark + WCAG NFR17 + reduced motion.** |

**Exit criteria:**
- All Phase 2 NFRs (NFR26–NFR33) have passing tests
- Scope escalation is dual-layer enforced (UI + Core); UI bypass test rejects unconfirmed escalations
- Desktop runtime is fully integrated and meets startup budget
- Phase 2 acceptance gate: `pnpm test:acceptance` extended to cover Phase 2 e2e flows
- Audit Log Query view is reachable from palette + Agent Panel; rollback flows end-to-end
- Visual regression baseline exists for all migrated Studio surfaces in light + dark mode

**Risks:**
- 12.3 lacks UX deliverable at sprint start — mitigation: UX-2 (escalation modal) must be done in UX track before S5; if not, S5 stories slip
- Desktop platform-specific failures emerge late — mitigation: 9.4 and 9.7 run on supported platforms in CI; nightly desktop matrix

---

## UX Parallel Track

**Goal:** Close the two major UX gaps identified in the readiness report before they become blockers for Sprint 4 and Sprint 5.

| UX Story | Title | Target Sprint | Status |
|---|---|---|---|
| **UX-1** | Agent anchors interaction design (Story 11.7 dependency) | Deliver before S4 starts | Not started |
| **UX-2** | Scope escalation confirmation modal design (Story 12.3 dependency) | Deliver before S5 starts | Not started |

### UX-1: Agent Anchors

**Deliverables:**
- Interaction patterns for the three Agent invocation surfaces (menu / keyboard / command palette) in `@anydocs/editor`
- Visible scope badge design (per FR59 — "scope explicitly visible at invocation time")
- Empty/loading/error states for each scope
- Keyboard shortcut conventions (collision check with existing editor shortcuts)
- Acceptance copy + microcopy for scope indicators

**Acceptance criteria:**
- Anchors deliver scope-visible affordance that supports PRD's <10% scope-misfire metric
- Keyboard accessibility validated against existing Phase 1 a11y patterns
- Design tokens align with existing Studio design system

**Owner:** UX (parallel to S1–S3)
**Blocker for:** Story 11.7 entering dev

### UX-2: Scope Escalation Confirmation Modal

**Deliverables:**
- Modal layout, copy, focus order, escape behavior
- Variant designs for three escalation paths (inline → page, page → workspace, inline → workspace)
- Error state when token expires before confirmation
- Confirmation primary/secondary action visual hierarchy

**Acceptance criteria:**
- Modal copy clearly states source scope, target scope, and active resource (per Story 12.3 AC)
- Keyboard-only operation supports confirm + cancel with visible focus indicators
- No color-only meaning (per Phase 1 NFR17 carryover)

**Owner:** UX (parallel to S1–S4)
**Blocker for:** Story 12.3 entering dev

---

## Dependency Graph

```
┌─────────────────────────────────────────────────────────────────┐
│ Sprint 1 — Foundation                                            │
│   6.1 ── 6.5     8.1 ── 8.2     10.1                            │
└──────┬──────────────┬──────────────┬────────────────────────────┘
       │              │              │
       ↓              ↓              ↓
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ Sprint 2     │  │ Sprint 2     │  │ Sprint 3     │
│ Editor       │  │ Desktop      │  │ Audit + Cut  │
│ 6.2→6.3→6.4  │  │ 9.1→9.2→9.3  │  │ 10.2..10.7   │
│              │  │              │  │ + 7.1→7.2→7.3│
└──────┬───────┘  └──────┬───────┘  └──────┬───────┘
       │                 │                 │
       └────────┬────────┴─────────────────┘
                ↓
       ┌────────────────────────────┐
       │ Sprint 4 — Agent           │
       │ 11.1→11.2→11.3│11.4│11.5   │
       │      ↓                     │
       │ 11.6 → 11.7 (needs UX-1)   │
       └────────┬───────────────────┘
                ↓
       ┌────────────────────────────────────┐
       │ Sprint 5 — Safety + Polish         │
       │ 11.8, 11.9 (Agent safety)          │
       │ 12.1→12.2→12.3 (needs UX-2)→12.4  │
       │ 8.3, 8.4 (mode polish)             │
       │ 9.4, 9.5, 9.6, 9.7 (desktop val)   │
       └────────────────────────────────────┘

UX Parallel Track (kicked off in S1):
   UX-1 (Agent anchors) ──────────► must complete before S4 begins
   UX-2 (escalation modal) ───────► must complete before S5 begins
```

### Critical Path

S1 → S2/S3 (in parallel after S1) → S4 → S5

**Earliest acceptance-test runnable:** End of S5 (Phase 2 acceptance gate).
**Earliest user-visible value:** End of S3 (Studio cutover; existing users get the new editor + audit log for human writes).

---

## Risk Register (Phase 2)

| ID | Risk | Likelihood | Impact | Owner | Mitigation | Trigger Sprint |
|---|---|---|---|---|---|---|
| R1 | UX deliverable (UX-1) slips past S3 → Story 11.7 blocked | Medium | Medium | UX | Kick off UX-1 at S1 start; weekly check-in | S1 |
| R2 | UX deliverable (UX-2) slips past S4 → Story 12.3 blocked | Medium | Medium | UX | Kick off UX-2 at S1 start | S1 |
| R3 | Plate migration parity failures in Story 7.2 fixtures | Medium | High | Dev | Feature flag enables rollback; `doc-content-v1` canonical storage limits blast radius | S3 |
| R4 | Tauri atomicity contract regressions on edge platforms | Low | High | Dev | Story 9.4 fault-injection in CI; nightly desktop matrix | S5 (S2 partial) |
| R5 | Audit retention prune deletes wrong shards | Low | High | Dev | Story 10.6 emits system audit entry on prune; Story 10.7 schema-evolution tests | S3 |
| R6 | Scope escalation token bypass via UI tampering | Low | Critical | Dev | Architecture mandates dual-layer; Story 12.4 e2e tests UI bypass explicitly | S5 |
| R7 | Provider port abstraction leaks vendor name into `@anydocs/core` | Low | Medium | Dev | Lint rule + Story 11.1 AC; review at each PR | S4 |
| R8 | Stories 9.2 / 11.7 / 6.2 prove too large | Medium | Low | Dev | Pre-sprint refinement; split when split is obvious | S2 / S4 / S2 |
| R9 | Phase 1 regression during Studio cutover (Story 7.3) | Low | High | Dev | Story 7.2 parity fixtures must be 100% before 7.3 flip; existing acceptance suite must pass after cutover | S3 |
| R10 | Cross-mode content compat breaks after long usage | Low | Medium | Dev | Story 8.4 round-trip fixtures expanded with realistic project sizes | S5 |

---

## Test Strategy by Sprint

| Sprint | New Test Categories |
|---|---|
| S1 | Contract diff CI, schema validation unit tests, runtime mode resolver unit tests |
| S2 | Plate converter round-trip fixtures, Tauri fs command integration tests, plugin contract enforcement |
| S3 | Audit lifecycle integration tests, audit query unit tests, Studio dual-mount parity fixtures, post-cutover Phase 1 regression |
| S4 | Scope validator unit tests, Agent orchestrator integration tests, audit-wire integration |
| S5 | Per-scope latency benchmarks, audit fault-injection, escalation e2e (including UI bypass), desktop atomicity fault-injection, desktop startup budget benchmarks, cross-mode round-trip benchmarks |

**Acceptance gate extension:** `pnpm test:acceptance` should grow during S2–S5 to cover:
- Phase 2 e2e fixtures (desktop edit → save → audit → rollback)
- Cross-mode round trips
- Escalation UI bypass rejection

---

## Implementation Notes for Sprint Master

1. **Sprint 1 is the highest-leverage sprint.** Five small foundation stories unblock 34 downstream stories. Do not skip or compress.
2. **UX parallel track must start at S1 kickoff**, not later. Two-sprint UX timeline is generous if started early; tight if started at S3.
3. **Two epics (6 and 7) are infrastructure-flavored.** When reporting to non-engineering stakeholders, frame these as enablers for Epic 11 (built-in Agent — the headline capability). Stakeholders should not expect visible features from S1 or part of S2.
4. **Story 10.1 (audit schema) is the single most important early decision.** Architecture addendum has the schema fully specified — implementation is mostly transcription. Ensure consensus on schema fields before S4.
5. **Provider adapter strategy** is intentionally out of `@anydocs/core`. Decide host-side provider configuration before S4. The Story 11.1 abstract port keeps core agnostic; host wires concrete provider at deploy time.
6. **Phase 3 anchors must remain untouched.** Any FR61–FR64 / NFR34 work is out of scope for this plan. When Phase 3 begins, generate a new addendum.

---

## Sprint Status Tracking

Live status is in `artifacts/bmad/implementation-artifacts/sprint-status.yaml`. This plan is the strategic document; the YAML is the operational source of truth. Update both:

- **YAML:** As stories transition through `backlog → ready-for-dev → in-progress → review → done`
- **This plan:** When sprint scope changes, dependencies are revised, or risks materialize

---

## Completion Summary

**Phase 2 vNext implementation plan generated.**

- **Sprints:** 5 + 1 UX parallel track
- **Total stories scheduled:** **50** (Epic 6–12 service layer: 39 + Epic 13 Studio shell migration: 11)
- **FR/NFR coverage:** FR51–FR60 + NFR26–NFR33 (service via Epic 6–12; UI via Epic 13)
- **Phase 3 boundary:** Respected (no Phase 3 work in plan)
- **UX dependencies:** 2 (UX-1 before S4, UX-2 before S5)
- **Risks identified:** 10 (see Risk Register)
- **Status tracker:** `artifacts/bmad/implementation-artifacts/sprint-status.yaml` (updated 2026-05-24 with epic-13)

### Epic 13 Addendum Notes (2026-05-24)

The original sprint plan (Epic 6–12) covered service-layer Phase 2 work but hinted at UI migration implicitly. Epic 13 (Studio Desktop Shell Migration) explicitly formalizes 11 stories that:

- Port Claude Design tokens + shell primitives into `packages/web/lib/desktop-shell/`
- Recompose Studio from 3-column to 4-region desktop layout
- Replace navigation-composer with VaultSidebar file tree
- Add Library start surface, 4-step Onboarding, 6-page Settings
- Implement Command Palette, Run Inspector, Build UI, Audit Log Query view
- Validate dark mode + visual regression

Epic 13 work is **woven into the existing 5 sprints** (parallel to service-layer work) — no sprint timeline extension required.

**Next operational step:** Run `bmad-bmm-create-story` against the first foundation stories — **Story 6.1** (editor package scaffold) + **Story 13.1** (tokens/primitives port) — to produce dev-ready story files in `artifacts/bmad/implementation-artifacts/`. These two stories are S1 critical-path and can be developed in parallel.
