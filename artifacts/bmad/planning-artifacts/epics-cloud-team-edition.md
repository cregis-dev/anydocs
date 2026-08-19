---
stepsCompleted: ['step-01-validate-prerequisites', 'step-02-design-epics', 'step-03-create-stories', 'step-04-final-validation']
inputDocuments:
  - '/Users/shawn/Downloads/anydocs-studio-handoff/cloud-studio-ai-first-design-brief.md'
  - '/Users/shawn/Downloads/anydocs-studio-handoff/README.md (design handoff index, 17 boards)'
  - 'artifacts/bmad/planning-artifacts/architecture.md (Phase 3 Architectural Anchors §)'
  - 'artifacts/bmad/planning-artifacts/prd.md (Phase 3 anchors FR61–FR64 + NFR34)'
productLine: 'Cloud Team Edition (independent from local-first edition)'
designContract: 'tokens.css (shared with desktop edition) — immutable source of truth'
---

# Anydocs Studio — Cloud Team Edition · Epic Breakdown

## Overview

This document decomposes the **Cloud Team Edition** of Anydocs Studio — a cloud, multi-tenant,
multi-member, AI-First documentation workspace — into epics and stories.

It is an **independent product line**, parallel to the existing local-first edition (Epics 1–13 in
`epics.md`). It deliberately does **not** modify the local-first edition's assumptions (NFR14:
"works without a cloud account"). The two editions share exactly one artifact today: `tokens.css`.

**Requirements basis:** the design handoff `cloud-studio-ai-first-design-brief.md` functions as the
interim PRD for this product line; the 17-board handoff is its UX specification. A dedicated Cloud
PRD and Cloud Architecture should formalize these, but the brief is detailed enough to drive epic
and story decomposition now.

> **Scope inheritance from Phase 2/3 anchors:** much of the Agent UI in the design brief (Inline /
> Page / Workspace agents, Task Card state machine, Run Inspector, scope escalation, write-ahead
> audit) corresponds to the local-first edition's Phase 2 Epics 10–12, which are **not yet built**.
> In the cloud product line these are re-homed as cloud epics; where the underlying core services
> (`@anydocs/core/agent`, `/audit`, `/runtime`) can be shared, stories will note the dependency.

## Requirements Inventory

### Functional Requirements

**App Shell & Information Architecture**

CFR1: The system presents a four-region app shell — Workspace Rail (56px) / Navigation & Pages (280px, collapsible) / Canvas editor (flex) / Agent & Context panel (380px, collapsible) — each region independently collapsible.
CFR2: The system models an Org → Workspace → Project → Page four-level tenancy hierarchy; the Workspace Rail switches org/workspace and lists projects (icon + tooltip, drag-reorder, pin).
CFR3: The Navigation & Pages tree supports section/folder/page/link nodes, drag-reorder, and per-item hover affordances: status dot + last-editor avatar + running-agent indicator.
CFR4: The nav header provides a status filter (All/Draft/In Review/Published), a language switch (zh/en/…), and a create menu (new page / folder / "Let Agent draft").
CFR5: The Canvas top bar shows breadcrumb + page-status stepper (mini) + presence avatar group + actions (share/history/more); the doc body is a 760px-centered block editor; a thin status bar shows autosave time, word count, language, and agent state.
CFR6: A focus writing mode hides both side rails, leaving only the top bar + canvas.

**AI Agent — three summon forms (AI-First)**

CFR7: Inline Agent — invoked via ⌘K command bar, a selection floating toolbar (polish / translate / shorten / formalize / to-table / generate code / explain / custom), or `/` AI command block at line start; results appear as in-place inline diff with per-suggestion accept/reject.
CFR8: Inline diff micro-interactions — accept fades content in (200ms), reject fades suggestion out (150ms), hover shows attribution ("Suggested by Writer Agent · 2 min ago"), and 30s of inactivity auto-collapses to an "AI suggestion (N)" chip.
CFR9: Page Agent — right panel at scope=Page runs a Plan → Preview → Apply flow surfaced as a Task Card with a full state machine: Planning → Awaiting confirmation → Running → Awaiting review → Applied, with Rolled back / Failed branches.
CFR10: The Task Card carries an editable title, status, progress + current-step text, blocks/files touched, an expandable full plan with per-step input/output + diff, and actions: Apply / Reject / Partial apply / Rollback / Retry / Export as comment.
CFR11: Workspace Agent — at scope=Project/Workspace, a Run Inspector (full-screen-able) shows a plan tree + per-file diff (split/unified toggle) + a fixed action bar; supports partial accept (per file/block), step intervention + re-run, and rollback of applied runs.
CFR12: Plan → Preview → Apply is mandatory for every AI write; the system never overwrites document body directly without a previewable, rejectable intermediate state.
CFR13: The system ships three visually distinguishable built-in agent personas within the AI color family — Writer (rewrite/generate), Reviewer (check/annotate, never edits text directly), Architect (IA/cross-page); agent avatars are visually distinct from humans in the presence group.
CFR14: While an agent edits, the canvas shows a 2px indigo bar + agent avatar on the affected block without blocking the author; if the author edits a block the agent is about to change, a conflict toast offers "Pause Agent?".
CFR15: Agent error recovery — token-budget overrun offers "Resume from step N? / Re-plan / Cancel"; a merge conflict offers side-by-side resolve; a failure shows a short description + collapsible "Show details" (no raw stack noise).

**Multi-member Collaboration**

CFR16: Presence — the top bar shows an avatar group of online members + the active agent; hovering shows name / role / current activity; a status dot encodes active (green) / idle (amber) / AI-working (violet).
CFR17: Live cursors & selection — each human has a fixed warm color + name chip (2s fade); agents render in unified indigo with a "<Persona> Agent" chip; concurrent selections on the same span overlap.
CFR18: Comments — selecting text floats a comment affordance that opens a thread; supports @person and @Agent (the latter auto-creates a follow-up Task Card); Comments tab and in-canvas dots locate each other bidirectionally.
CFR19: Review & Publish — Draft → In Review → Published stepper (in Metadata tab) with Owner (required), Required reviewers (multiple), AI auto-check results (link validity, terminology consistency, translation sync, internal pageId existence) as status dots, and human approve / request-changes; Publish is gated on "all AI checks pass + all required reviewers approve", with an owner force-override behind double confirmation.

**Project & Workspace Management**

CFR20: Workspace Home (post-login default) presents four regions — Continue editing / Needs your review / Agent activity / Mentions & comments.
CFR21: New-project creation offers three starting points — Blank / From template (starter / API reference / changelog / handbook) / Let Agent draft (a conversational onboarding where the agent asks 3–5 questions, generates a skeleton, previews, and applies on approval).
CFR22: A global command palette (⌘K / ⌘P) unifies Go-to (cross-project pages / people / tasks), Do (commands), and Ask-AI (a highlighted "Ask Agent: …" row), plus Recent and Commands sections.
CFR23: A bilingual side-by-side compare view (zh ↔ en) renders both languages with agent-flagged out-of-sync paragraphs.

**Team Backend & Service (maps Phase 3 anchors)**

CFR24 (=FR61): The system supports a project-level `mode` field (`single` / `team`) distinguishing single-user and team workflows.
CFR25 (=FR62): Multiple maintainers collaborate within a team-mode project with authorship attribution preserved on content and on agent operations.
CFR26 (=FR63): MCP capabilities are exposable as a remote service with authentication and a read-only tool subset.
CFR27 (=FR64): Team-mode maintainers can govern agent permission boundaries and audit-log retention policies.

### NonFunctional Requirements

CNFR1: Dark mode is mandatory across all surfaces via `[data-theme="dark"]`; AI elements retain recognizability on dark backgrounds (raised lightness + `--ai-glow`).
CNFR2: Accessibility — WCAG AA contrast; color is never the sole information carrier (status = icon + text); full keyboard reachability with visible focus; agent state and diff-accept actions announce via `aria-live`.
CNFR3: Internationalization — copy tolerates 30% length expansion; time / number / name render per locale.
CNFR4: `tokens.css` is the immutable shared design contract (shared with the desktop edition); no hard-coded design values — all colors / type / radius / shadow / easing read from tokens.
CNFR5: Performance states — virtualized navigation tree beyond 500 pages; long-diff collapse/expand; offline / reconnect banner; subtle autosave indicator.
CNFR6: Real-time collaboration consistency — concurrent edits and presence sync converge without data loss (implies a CRDT/OT-backed realtime backend).
CNFR7 (=NFR34): The remote MCP service returns 401/403 on missing or invalid authentication and 405 on write-tool calls against a read-only profile, in 100% of remote-service e2e smoke tests.
CNFR8: Per-scope agent latency budgets (inherited from NFR28) — inline ≤ 3s, page ≤ 8s, workspace streaming feedback ≤ 2s (P95), with up to +50% allowed under degraded upstream conditions.
CNFR9: Write-ahead audit (inherited from NFR29) — every agent write persists an audit entry before taking effect; if audit persistence fails, the write rolls back or is rejected.

### Additional Requirements

**From Architecture (Phase 3 anchors — forward-compatible hooks already declared):**
- `project-schema.ts` reserves `mode?: 'single' | 'team'`; cloud edition activates the `team` path (local-first rejects it with `ProjectModeNotSupportedError`).
- `@anydocs/mcp` reserves `adapters/` + `transport-port.ts` (HTTP transport) and `tools/profiles/` + `ToolProfile { mode: 'full' | 'read-only' }` — cloud edition implements the HTTP transport + read-only profile.
- Audit `actor` admits a future `actorId` (additive, no schemaVersion bump) — cloud edition populates `actorId` for multi-author attribution.

**Net-new for the cloud product line (no existing architecture home):**
- Authentication & identity (the local-first edition has none).
- Multi-tenant data model + storage (Org → Workspace → Project → Page) — the local-first edition assumes one project per process.
- Realtime collaboration backend (presence, live cursors, CRDT/OT document sync).
- A cloud Architecture document must precede or accompany implementation; an "Architecture & Foundations" epic captures this.

**From the design handoff (UX constraints):**
- All 17 boards are 1440×900 (component inventory 1440×1280); `tokens.css` is the only directly reusable asset — boards are HTML/React reference prototypes to be re-implemented in the target stack, not shipped.
- Interaction states (Inline diff accept/reject, Task Card state machine, Run Inspector split/unified, Review flow) are clickable in the prototype and must be implemented as behavior, not static appearance.

**Explicitly OUT of scope this round (design brief §13):**
- Billing / quota / plan-management admin.
- Org & permission admin backend (SSO, SCIM).
- Native mobile UI (only 1024-wide usability required).
- Reader (public docs site) visuals — reuse existing reader.
- Agent underlying model-selection UI — use default.

### FR Coverage Map

CFR1: Epic C1 — four-region app shell skeleton
CFR2: Epic C1 — Org → Workspace → Project → Page tenancy + Workspace Rail
CFR3: Epic C2 — navigation tree with per-item status/editor/agent affordances
CFR4: Epic C2 — nav header status filter + language switch + create menu
CFR5: Epic C2 — canvas top bar + 760px doc body + status bar
CFR6: Epic C2 — focus writing mode
CFR7: Epic C3 — Inline Agent summon (⌘K / floating toolbar / `/` block)
CFR8: Epic C3 — inline diff micro-interactions
CFR9: Epic C4 — Page Agent Plan→Preview→Apply + Task Card state machine
CFR10: Epic C4 — Task Card fields + actions
CFR11: Epic C5 — Workspace Agent Run Inspector + partial accept/rollback
CFR12: Epic C3 (established), C4/C5 (extended) — mandatory Plan→Preview→Apply
CFR13: Epic C3 (introduced), C4/C5/C6 — three agent personas, distinct from humans
CFR14: Epic C3 (introduced), C4/C6 — in-canvas agent-editing indicator + conflict toast
CFR15: Epic C4 (introduced), C5 — agent error recovery (budget/conflict/failure)
CFR16: Epic C6 — presence avatar group + status dots
CFR17: Epic C6 — live cursors & selection
CFR18: Epic C6 — comments (@person / @Agent)
CFR19: Epic C7 — Review & Publish gate (AI checks + reviewer approval)
CFR20: Epic C8 — Workspace Home four regions
CFR21: Epic C8 — new project (Blank / Template / Let Agent draft onboarding)
CFR22: Epic C8 — global command palette (⌘K / ⌘P)
CFR23: Epic C2 — bilingual side-by-side compare
CFR24 (FR61): Epic C1 — project `mode` field (single/team)
CFR25 (FR62): Epic C6 (+ C1 identity base) — authorship attribution
CFR26 (FR63): Epic C9 — remote MCP service (auth + read-only profile)
CFR27 (FR64): Epic C10 — agent permission boundaries + audit retention governance

CNFR1: Epic C11 (+ per-epic AC) — dark mode across surfaces
CNFR2: Epic C11 (+ per-epic AC) — WCAG AA accessibility
CNFR3: Epic C11 (Story C11.2 i18n AC) + C2 cross-cutting — i18n / copy expansion / locale formatting
CNFR4: Epic C1 — tokens.css as immutable shared contract
CNFR5: Epic C2 (+ cross-cutting) — performance states (virtualized tree, long-diff, offline banner, autosave)
CNFR6: Epic C6 — real-time collaboration consistency (CRDT/OT backend)
CNFR7 (NFR34): Epic C9 — remote MCP 401/403/405
CNFR8 (NFR28): Epic C3/C4/C5 — per-scope agent latency budgets
CNFR9 (NFR29): Epic C3 (audit foundation), governed in C10 — write-ahead audit

## Epic List

### Epic C1: Sign-in & Cloud Workspace Foundation
A member can sign in to the cloud, land in their organization/workspace, and navigate projects and pages inside the four-region app shell — establishing identity, the Org → Workspace → Project → Page tenancy model, the project `mode` (single/team) distinction, and adoption of `tokens.css` as the design contract.
**CFRs covered:** CFR1, CFR2, CFR24
**CNFRs covered:** CNFR4
**Net-new backend:** authentication & identity, multi-tenant data model + storage. (A Cloud Architecture doc should precede this epic.)
**Dependencies:** none (foundation).

### Epic C2: Cloud Authoring — Navigation, Editor & Focus
A member can browse, create, edit, save, and language-compare documentation pages in a cloud project — the navigation tree, the block editor (reusing `@anydocs/editor`) with top bar/status bar, focus writing mode, and bilingual side-by-side compare. Usable single-user end-to-end before any agent or collaboration lands.
**CFRs covered:** CFR3, CFR4, CFR5, CFR6, CFR23
**CNFRs covered:** CNFR3, CNFR5
**Dependencies:** C1.

### Epic C3: Inline Agent
A member can summon AI help inline (⌘K / floating toolbar / `/` block) and accept or reject suggestions as in-place diffs — introducing the mandatory Plan→Preview→Apply discipline, the agent personas, the in-canvas agent-editing indicator, and the shared agent-service + write-ahead audit foundation that later agent epics build on.
**CFRs covered:** CFR7, CFR8, CFR12 (established), CFR13 (introduced), CFR14 (introduced)
**CNFRs covered:** CNFR8 (inline ≤ 3s), CNFR9 (write-ahead audit foundation)
**Dependencies:** C1, C2.

### Epic C4: Page Agent & Task Card
A member can delegate a whole-page task to an agent and steward it through a reviewable Task Card lifecycle (Planning → Awaiting confirmation → Running → Awaiting review → Applied, with Rolled back / Failed branches), including error recovery.
**CFRs covered:** CFR9, CFR10, CFR12 (extended), CFR13, CFR14, CFR15 (introduced)
**CNFRs covered:** CNFR8 (page ≤ 8s)
**Dependencies:** C3 (agent-service + audit core).

### Epic C5: Workspace Agent & Run Inspector
A member can run cross-file/cross-page batch operations through a full-screen Run Inspector — plan tree + per-file diff (split/unified), partial accept, step intervention + re-run, and rollback of applied runs.
**CFRs covered:** CFR11, CFR12 (extended), CFR13, CFR15
**CNFRs covered:** CNFR8 (workspace streaming ≤ 2s)
**Dependencies:** C3 (agent-service + audit core), C4 (Task Card patterns).

### Epic C6: Real-time Collaboration
Multiple members co-edit a page with presence, live cursors, and comments, with authorship attribution preserved on content and agent operations — the realtime backend (presence sync + CRDT/OT document convergence) lands here.
**CFRs covered:** CFR16, CFR17, CFR18, CFR25, CFR13/CFR14 (agent presence facets)
**CNFRs covered:** CNFR6
**Net-new backend:** realtime collaboration infrastructure.
**Dependencies:** C1 (identity), C2 (editor).

### Epic C7: Review, Approval & Publish
A team gates publishing behind AI auto-checks (link validity, terminology consistency, translation sync, internal pageId existence) and required human reviewer approval, via the Draft → In Review → Published stepper, with an owner force-override behind double confirmation.
**CFRs covered:** CFR19
**Dependencies:** C2 (pages/status). Benefits from C6 but stands alone.

### Epic C8: Workspace Home, Onboarding & Command Palette
A member lands on a Workspace Home (Continue editing / Needs review / Agent activity / Mentions), starts new projects (Blank / Template / Let-Agent-draft onboarding), and navigates + acts globally via the ⌘K/⌘P command palette.
**CFRs covered:** CFR20, CFR21, CFR22
**Dependencies:** C1, C2. Onboarding leans on C3/C4 agents but degrades gracefully without them.

### Epic C9: Remote MCP Service (Auth + Read-only Profile)
External agents and consumers reach a project's MCP capabilities over an authenticated remote transport, with a read-only tool profile that rejects write tools — implementing the `transport-port.ts` HTTP adapter and `ToolProfile` anchors.
**CFRs covered:** CFR26 (FR63)
**CNFRs covered:** CNFR7 (NFR34)
**Dependencies:** C1 (auth/identity). Independent of the UI epics — can run in parallel.

### Epic C10: Team Governance — Permissions & Audit Retention
Team-mode maintainers govern agent permission boundaries (which scopes which roles may invoke) and audit-log retention policy, querying the write-ahead audit established in C3.
**CFRs covered:** CFR27 (FR64)
**CNFRs covered:** CNFR9 (governance facet)
**Dependencies:** C1 (roles/identity), C3 (audit subsystem).

### Epic C11: Design-System Conformance — Dark Mode, A11y & Visual Regression
Every migrated surface passes a cross-surface conformance gate: dark mode via `[data-theme="dark"]`, WCAG AA accessibility (keyboard, focus, aria-live, color-not-sole-carrier), component-inventory conformance, and visual-regression coverage.
**CNFRs covered:** CNFR1, CNFR2 (also carried as per-epic acceptance criteria)
**Dependencies:** the surfaces delivered by C1–C8 (final conformance pass).

---

## Epic C1: Sign-in & Cloud Workspace Foundation

A member can sign in to the cloud, land in their organization/workspace, and navigate projects and pages inside the four-region app shell.

### Story C1.0: Scaffold cloud packages and baseline infrastructure

As a developer agent,
I want the cloud product line's packages and baseline infrastructure scaffolded in the workspace,
So that every later story has a running app, database, auth, and realtime baseline to build on.

**Acceptance Criteria:**

**Given** the existing pnpm monorepo
**When** the cloud packages are scaffolded
**Then** `cloud-web` (Next.js App Router), `cloud-core` (server domain), and `cloud-realtime`
(Hocuspocus) exist as workspace packages, build under TypeScript strict, and import `@anydocs/editor`
and `tokens.css` without forking them
**And** Postgres + Drizzle (with a first migration) + Better Auth are wired in `cloud-core`, and a
Hocuspocus baseline server boots in `cloud-realtime`
**And** the local-first edition packages (`web`, `core`, `editor`) are unchanged
**And** `tokens.css` is consumed as the design contract (no hard-coded design values)

### Story C1.1: Sign in and establish a session

As a documentation maintainer,
I want to sign in to the cloud with email or an OAuth provider,
So that I have an authenticated session that scopes everything I see and do.

**Acceptance Criteria:**

**Given** an unauthenticated visitor
**When** they complete email or OAuth sign-in
**Then** a session is established and the visitor is identified by a stable user id
**And** an expired or invalid session redirects back to sign-in without exposing any workspace data

**Given** an authenticated session
**When** the user signs out
**Then** the session is invalidated and protected routes return to sign-in

### Story C1.2: Provision a default organization and workspace

As a newly signed-in member,
I want an organization and workspace ready on first login,
So that I have a place to create projects without manual setup.

**Acceptance Criteria:**

**Given** a user signing in for the first time
**When** the session is created
**Then** a default organization and workspace are provisioned with the user as owner
**And** subsequent logins reuse the existing organization/workspace rather than creating duplicates

### Story C1.3: Workspace Rail — switch context and list projects

As a member of multiple workspaces,
I want a left rail to switch organization/workspace and see project icons,
So that I can move between contexts quickly.

**Acceptance Criteria:**

**Given** a member belonging to one or more workspaces
**When** they open the Workspace Rail switcher
**Then** they can switch the active organization/workspace and the project list updates accordingly
**And** projects render as icons with name tooltips, support drag-reorder, and support pinning
**And** the rail bottom exposes notifications and the personal avatar/settings entry

### Story C1.4: Four-region app shell with collapsible regions

As a member,
I want the Rail / Navigation / Canvas / Agent-panel four-region shell built on tokens.css,
So that every later surface mounts into a consistent frame.

**Acceptance Criteria:**

**Given** an open project
**When** the shell renders
**Then** the four regions appear at their specified widths (56 / 280 / flex / 380)
**And** the Navigation and Agent panels can each independently collapse and restore
**And** all colors, type, radius, shadow, and easing read from `tokens.css` with no hard-coded values (CNFR4)

### Story C1.5: Project `mode` field (single / team)

As a workspace owner,
I want each project to carry a `mode` of `single` or `team`,
So that single-user and team workflows are distinguished from creation onward.

**Acceptance Criteria:**

**Given** project creation or settings
**When** the owner sets `mode` to `single` or `team`
**Then** the value persists on the project and is readable by all consumers
**And** `team`-only capabilities (collaboration, governance) are gated on `mode = team`
**And** an absent `mode` is treated as `single` for forward compatibility

### Story C1.6: Project and page addressing under the workspace

As a member,
I want projects and pages addressable within the workspace,
So that I can open a project and route to a specific page.

**Acceptance Criteria:**

**Given** a workspace with projects
**When** a member opens a project and selects a page
**Then** the page is resolved by `(workspace, project, pageId, lang)` and rendered in the Canvas
**And** navigating to a non-existent project/page returns a typed not-found state, never another tenant's data

---

## Epic C2: Cloud Authoring — Navigation, Editor & Focus

A member can browse, create, edit, save, and language-compare documentation pages in a cloud project.

### Story C2.1: Render the navigation tree

As a member,
I want the project's navigation tree rendered with section/folder/page/link nodes,
So that I can see and traverse the documentation structure.

**Acceptance Criteria:**

**Given** a project with a navigation document
**When** the Navigation panel loads
**Then** section, folder, page, and link nodes render in their saved order with correct nesting
**And** selecting a page node opens it in the Canvas

### Story C2.2: Per-item navigation affordances

As a member,
I want each nav item to show status, last editor, and running-agent state,
So that I can gauge a page at a glance.

**Acceptance Criteria:**

**Given** a rendered navigation tree
**When** I hover or scan an item
**Then** it shows a status dot (draft/in-review/published), the last-editor avatar, and a running-agent indicator when a task targets that page

### Story C2.3: Drag-reorder the navigation tree

As a member,
I want to drag nav items to reorder or renest them,
So that I can shape the information architecture.

**Acceptance Criteria:**

**Given** a navigation tree
**When** I drag an item to a new position or parent
**Then** the new structure persists and re-renders in the new order
**And** an invalid drop (e.g., a page into a link) is rejected without corrupting the tree

### Story C2.4: Navigation header — filter, language, create

As a member,
I want a status filter, language switch, and create menu in the nav header,
So that I can narrow the tree and add content.

**Acceptance Criteria:**

**Given** the Navigation panel
**When** I use the status filter (All/Draft/In Review/Published)
**Then** the tree shows only matching pages
**And** the language switch swaps the active language's nav and content
**And** the create menu offers new page, new folder, and "Let Agent draft"

### Story C2.5: Mount the block editor with top bar

As an author,
I want the `@anydocs/editor` block editor in the Canvas with a top bar,
So that I can edit page content with context and actions.

**Acceptance Criteria:**

**Given** an open page
**When** the Canvas renders
**Then** the block editor mounts on the page's `doc-content-v1` content, body width 760px centered
**And** the top bar shows breadcrumb, a mini status stepper, a presence placeholder, and share/history/more actions

### Story C2.6: Autosave and status bar

As an author,
I want my edits autosaved with a status bar,
So that I never lose work and can see save state.

**Acceptance Criteria:**

**Given** an author editing a page
**When** content changes
**Then** changes autosave and the status bar shows last-saved time, word count, current language, and agent state
**And** a failed save surfaces a non-blocking retry indicator without losing local edits

### Story C2.7: Focus writing mode

As an author,
I want a focus mode that hides both side rails,
So that I can write distraction-free.

**Acceptance Criteria:**

**Given** an open page
**When** I toggle focus mode
**Then** the Navigation and Agent panels hide, leaving only the top bar and Canvas
**And** toggling again restores the previous panel layout

### Story C2.8: Bilingual side-by-side compare

As a bilingual author,
I want a zh↔en side-by-side view,
So that I can keep translations aligned.

**Acceptance Criteria:**

**Given** a page that exists in two languages
**When** I open bilingual compare
**Then** both languages render side by side, scroll-synced by block
**And** paragraphs flagged out-of-sync are visually marked

### Story C2.9: Large-project performance states

As a member of a large project,
I want a virtualized nav tree and connection indicators,
So that the app stays responsive and honest about state.

**Acceptance Criteria:**

**Given** a project with more than 500 pages
**When** the nav tree renders
**Then** it virtualizes rows and remains responsive while scrolling (CNFR5)
**And** going offline shows a reconnect banner and re-syncs cleanly on reconnect

---

## Epic C3: Inline Agent

A member can summon AI help inline and accept or reject suggestions as in-place diffs.

### Story C3.1: Agent service and provider port foundation

As a developer agent,
I want a core agent-service abstracted behind a provider port,
So that all three agent scopes route through one boundary with no vendor name in core.

**Acceptance Criteria:**

**Given** the core package
**When** an agent invocation is requested
**Then** it routes through `agent-service` and an abstract `provider-port`, returning typed results or typed errors
**And** no vendor/provider name appears in `@anydocs/core`

### Story C3.2: Write-ahead audit foundation

As a developer agent,
I want every agent write preceded by a persisted audit entry,
So that no audit-missing write can occur (write-ahead).

**Acceptance Criteria:**

**Given** an agent about to write
**When** the write is requested
**Then** a `pending` audit entry is persisted before the write, transitioning to `committed` on success or `rejected` on failure
**And** if audit persistence fails, the write is rolled back or rejected (CNFR9)

> **Scope note — REUSE, do not rebuild (revised 2026-08-18, Team First action 4).**
> The local-first edition already ships this domain (Epic 10, done). Verified against the code,
> not assumed:
>
> **Reuse as-is (no cloud copy):**
> - `runWriteAhead()` in `core/src/services/audit-log-service.ts` is pure orchestration —
>   persist-pending → apply write → commit, or reject-and-rethrow with a best-effort rejection
>   record that never masks the original error. That IS the CNFR9 guarantee. Storage-agnostic.
> - The audit entry contract and validators (`schemas/audit-entry-schema.ts`, `types/audit.ts`)
>   are already reachable from `@anydocs/core/portable` and re-exported by `cloud-core/content`.
> - `AuditQuery` / `AuditQueryResult` are the shared query contract (reuse the shape; see below
>   for the implementation).
>
> **Extract a port (the real work):** `audit-log-service.ts` statically imports five functions
> from `fs/audit-repository.ts` (`appendAuditEntry`, `readAuditShard`, `overwriteAuditShard`,
> `listAuditShardDates`, `auditShardFileName`) and threads an `auditRoot: string` through every
> public function. Define an `AuditRepositoryPort` over those operations, keep the NDJSON
> implementation as the local-first default (no behaviour change, Epic 10 tests must stay green),
> and supply a Postgres implementation in `cloud-core`.
>
> **Reimplement, same contract:** `query()` scans daily NDJSON shards and filters in memory. The
> cloud must push filtering/pagination into SQL. Keep `AuditQuery` → `AuditQueryResult` identical
> so C10.4's UI is storage-agnostic.
>
> **Three schema gaps blocking a cloud entry (all verified by running the validator):**
> 1. `runtimeMode` enum is `web | desktop`; `'cloud'` is **rejected** (`runtime-mode-enum`).
>    Extending it touches `core/src/runtime/runtime-mode.ts` and interacts with C1.5.
> 2. `organizationId` is **rejected** — the entry schema is closed
>    (`no-additional-properties`). Multi-tenant audit needs tenant scoping for RLS, so this
>    requires a deliberate schema change plus updates to `AUDIT_SCHEMA_CHANGE_HISTORY` and the
>    pinned v1 guard tests (Story 10.7's versioning rule).
> 3. `actor.userId` is currently **accepted** — the nested `AuditActor` is not closed the way the
>    top level is. Do not rely on that asymmetry silently; either close it deliberately or record
>    `userId` as a supported field when the schema changes for gap 2.
>
> Sequencing: the schema change (gaps 1+2) is shared with the local-first edition and must be
> additive and version-recorded. See `product-line-strategy-team-first-2026-08-18.md`.

### Story C3.3: ⌘K inline command bar

As an author,
I want to press ⌘K to summon an inline command bar,
So that I can ask for a quick edit where my cursor is.

**Acceptance Criteria:**

**Given** the cursor in the editor
**When** I press ⌘K
**Then** an inline command bar appears anchored to the cursor and accepts a natural-language instruction
**And** Escape dismisses it without changing content

### Story C3.4: Selection floating toolbar

As an author,
I want a floating toolbar on text selection with common AI actions,
So that I can transform selected text in one click.

**Acceptance Criteria:**

**Given** a non-empty text selection
**When** the floating toolbar appears
**Then** it offers polish / translate / shorten / formalize / to-table / generate-code / explain / custom
**And** choosing an action runs the inline agent scoped to the selection only

### Story C3.5: `/` AI command block

As an author,
I want to type `/` at the start of a new line to summon an AI command block,
So that AI generation is distinct from the normal block picker.

**Acceptance Criteria:**

**Given** an empty new line
**When** I type `/` and choose the AI command
**Then** an AI command block appears (visually distinct from the block picker) and accepts an instruction
**And** the result is inserted as a previewable inline diff, not committed directly

### Story C3.6: Inline diff with accept/reject micro-interactions

As an author,
I want inline-agent results shown as reviewable diffs,
So that I keep control over every change (Plan→Preview→Apply).

**Acceptance Criteria:**

**Given** an inline agent has produced suggestions
**When** they render
**Then** they appear in place as inline diff (2px accent bar + translucent background), each independently accept/reject-able
**And** accept fades content in (200ms) and replaces; reject fades the suggestion out (150ms) leaving the original
**And** hovering a suggestion shows attribution ("Suggested by Writer Agent · 2 min ago")
**And** 30s of inactivity collapses suggestions to an "AI suggestion (N)" chip that re-expands
**And** the inline round-trip meets the ≤ 3s P95 budget under normal conditions (CNFR8)

### Story C3.7: Agent personas and in-canvas editing indicator

As an author,
I want agent suggestions attributed to a visible persona and shown editing in-canvas,
So that AI activity is legible and distinct from humans.

**Acceptance Criteria:**

**Given** an inline agent action
**When** it runs
**Then** it is attributed to Writer / Reviewer / Architect, each visually distinct within the AI color family and distinct from human avatars (CFR13)
**And** the targeted block shows a 2px indigo bar + agent avatar while editing, without blocking the author elsewhere (CFR14)

---

## Epic C4: Page Agent & Task Card

A member can delegate a whole-page task to an agent and steward it through a reviewable Task Card lifecycle.

### Story C4.1: Page Agent input and Plan mode

As an author,
I want to give the Page Agent a task and first see a plan,
So that I know what it intends before it acts.

**Acceptance Criteria:**

**Given** the Agent panel at scope=Page
**When** I submit a multi-line instruction (optionally attaching selection / page / references)
**Then** the agent enters Plan mode and returns a structured plan with estimated changes and confidence
**And** no content is modified during Plan mode

### Story C4.2: Task Card state machine

As an author,
I want a Task Card that advances through defined states,
So that I can track and control the task.

**Acceptance Criteria:**

**Given** a planned task
**When** I run it
**Then** the Task Card advances Planning → Awaiting confirmation → Running → Awaiting review → Applied, with Rolled back / Failed branches
**And** each state shows the specified icon, title prefix, body, and action buttons
**And** invalid transitions are not reachable from the UI

### Story C4.3: Preview and apply page changes

As an author,
I want to review page changes as diffs and apply them,
So that I accept work deliberately (Plan→Preview→Apply).

**Acceptance Criteria:**

**Given** a task in Awaiting review
**When** I open the changes
**Then** all changes render as inline diff on the page, acceptable per-block or all-at-once
**And** applying transitions the card to Applied and persists only accepted blocks
**And** the page round-trip meets the ≤ 8s P95 budget under normal conditions (CNFR8)

### Story C4.4: Task Card fields and actions

As an author,
I want the Task Card to carry full task detail and actions,
So that I can manage the task end to end.

**Acceptance Criteria:**

**Given** a Task Card
**When** I inspect it
**Then** it shows an editable title, status, progress + current-step text, and blocks/files touched
**And** expanding reveals the full plan with per-step input/output + diff
**And** it offers Apply / Reject / Partial apply / Rollback / Retry / Export as comment

### Story C4.5: Rollback and history

As an author,
I want to roll back an applied task and keep it in history,
So that I can undo agent work safely.

**Acceptance Criteria:**

**Given** an Applied task
**When** I roll it back
**Then** the page returns to its pre-apply state and the card shows Rolled back with a Re-apply action
**And** completed and rejected tasks remain in a collapsed history that can be reopened to view diffs

### Story C4.6: Page Agent error recovery

As an author,
I want clear recovery paths when a task fails or conflicts,
So that errors are self-explaining and recoverable.

**Acceptance Criteria:**

**Given** a running task that exceeds its token budget
**When** it stops
**Then** the card offers "Resume from step N? / Re-plan / Cancel"
**And** a block changed by a human mid-task surfaces a side-by-side conflict resolve
**And** a failure shows a short description + collapsible "Show details" without raw stack noise (CFR15)

---

## Epic C5: Workspace Agent & Run Inspector

A member can run cross-file batch operations through a full-screen Run Inspector.

### Story C5.1: Workspace-scope task orchestration

As a member,
I want to run an agent task across multiple pages/navigation,
So that I can do project-wide operations in one task.

**Acceptance Criteria:**

**Given** the Agent panel scope switched to Project/Workspace (or launched from Workspace Home)
**When** I submit a cross-file task
**Then** the agent produces a multi-phase plan covering every targeted resource
**And** every targeted resource is recorded for audit (FR55 lineage)

### Story C5.2: Run Inspector shell with full-screen

As a member,
I want a Run Inspector with a plan tree and per-file diff that can go full-screen,
So that I can supervise large runs.

**Acceptance Criteria:**

**Given** a workspace task
**When** I open the Run Inspector
**Then** it shows a collapsible plan tree (left) with per-step status icons and per-file diff (right)
**And** it can expand to full viewport and return to the main UI via ⌘\

### Story C5.3: Split / unified diff toggle

As a member,
I want to toggle each file diff between split and unified,
So that I can read changes the way I prefer.

**Acceptance Criteria:**

**Given** a per-file diff in the Run Inspector
**When** I toggle the view
**Then** it switches between split and unified without losing scroll position

### Story C5.4: Partial accept

As a member,
I want to accept only selected files/blocks,
So that I apply only what I trust.

**Acceptance Criteria:**

**Given** a run awaiting review
**When** I check specific files/blocks
**Then** the action bar shows "Apply selected (N)" and applies only those, leaving the rest unapplied
**And** the audit records exactly which resources were applied

### Story C5.5: Step intervention and re-run

As a member,
I want to edit a plan step's instruction and re-run just that step,
So that I can correct course without restarting.

**Acceptance Criteria:**

**Given** a plan step in the Run Inspector
**When** I edit its instruction inline and re-run it
**Then** only that step re-executes and its downstream diffs refresh
**And** earlier accepted results are preserved

### Story C5.6: Roll back an applied run

As a member,
I want to roll back a whole applied run,
So that I can reverse a bad batch operation.

**Acceptance Criteria:**

**Given** an applied run
**When** I roll it back
**Then** all of that run's applied changes revert atomically and the run is marked Rolled back
**And** the rollback is itself recorded in the audit log

---

## Epic C6: Real-time Collaboration

Multiple members co-edit a page with presence, live cursors, and comments, with authorship preserved.

### Story C6.1: Realtime document sync

As a co-author,
I want concurrent edits to converge without loss,
So that my team can edit the same page together.

**Acceptance Criteria:**

**Given** two members editing the same page
**When** they make concurrent edits
**Then** edits converge consistently with no lost updates (CRDT/OT) (CNFR6)
**And** a reconnecting client re-syncs to the converged state without manual merge

### Story C6.2: Presence avatar group

As a member,
I want to see who else is on the page,
So that I have a sense of co-presence.

**Acceptance Criteria:**

**Given** multiple members and/or an active agent on a page
**When** I view the top bar
**Then** a presence avatar group shows online members + the active agent, with status dots (active/idle/AI-working)
**And** hovering an avatar shows name / role / current activity

### Story C6.3: Live cursors and selection

As a co-author,
I want to see others' cursors and selections,
So that we don't collide while editing.

**Acceptance Criteria:**

**Given** members editing the same page
**When** they move cursors or select text
**Then** each human shows a fixed warm color + name chip that fades after 2s, and agents render in unified indigo with a "<Persona> Agent" chip
**And** overlapping selections render as layered highlights

### Story C6.4: Comments and threads

As a reviewer,
I want to comment on selected text in threads,
So that I can discuss changes in context.

**Acceptance Criteria:**

**Given** a text selection
**When** I add a comment
**Then** a thread is created and represented both in the Comments tab and as an in-canvas dot, locating each other bidirectionally
**And** resolving a thread hides its dot while preserving history

### Story C6.5: @mentions for people and agents

As a collaborator,
I want to @-mention people and agents in comments,
So that I can pull in a person or trigger agent work.

**Acceptance Criteria:**

**Given** a comment thread
**When** I @-mention a person
**Then** they are notified
**And** when I @-mention an Agent, a follow-up Task Card is auto-created from the thread context

### Story C6.6: Authorship attribution

As a team lead,
I want content and agent operations attributed to an author,
So that we can see who (or which agent) changed what.

**Acceptance Criteria:**

**Given** a team-mode project
**When** a member or agent writes
**Then** the change carries an `actorId` (human or agent) on content and on the audit entry (CFR25)
**And** attribution is forward-compatible with the existing audit schema (additive `actorId`, no version bump)

---

## Epic C7: Review, Approval & Publish

A team gates publishing behind AI auto-checks and required human reviewer approval.

### Story C7.1: Review stepper with owner and reviewers

As a page owner,
I want a Draft → In Review → Published stepper with assigned reviewers,
So that the review process is explicit.

**Acceptance Criteria:**

**Given** a page in the Metadata tab
**When** I configure review
**Then** I set an Owner (required) and one or more Required reviewers, and move the page Draft → In Review
**And** the stepper reflects the current state for everyone

### Story C7.2: AI auto-check report

As a reviewer,
I want automated checks run before approval,
So that mechanical issues are caught early.

**Acceptance Criteria:**

**Given** a page In Review
**When** auto-checks run
**Then** link validity, terminology consistency, translation sync, and internal pageId existence each report a green/amber/red status dot
**And** a failing check is explained and links to the offending location

### Story C7.3: Reviewer approval

As a required reviewer,
I want to approve or request changes,
So that human judgment gates publishing.

**Acceptance Criteria:**

**Given** a page In Review with me as a required reviewer
**When** I act
**Then** I can Approve or Request changes with a note, and my state shows in the stepper
**And** Request changes returns the page to Draft for the author

### Story C7.4: Publish gate with owner override

As a page owner,
I want publishing gated on checks + approvals, with a guarded override,
So that we publish safely but aren't fully blocked.

**Acceptance Criteria:**

**Given** a page In Review
**When** all AI checks pass and all required reviewers approve
**Then** Publish becomes available and moves the page to Published
**And** an owner may force-publish despite outstanding gates only after an explicit double confirmation, recorded in the audit log

---

## Epic C8: Workspace Home, Onboarding & Command Palette

A member lands on a Workspace Home, starts new projects, and navigates + acts globally.

### Story C8.1: Workspace Home

As a returning member,
I want a home page summarizing my work,
So that I can resume quickly.

**Acceptance Criteria:**

**Given** a signed-in member
**When** they land on Workspace Home
**Then** it shows Continue editing (recent pages), Needs your review, Agent activity, and Mentions & comments
**And** each item links directly to its target

### Story C8.2: New project — blank or template

As a member,
I want to start a project blank or from a template,
So that I can begin with the right structure.

**Acceptance Criteria:**

**Given** the new-project entry
**When** I choose Blank or a template (starter / API reference / changelog / handbook)
**Then** a project is created with the chosen starting structure and opens in the shell

### Story C8.3: Let Agent draft onboarding

As a member,
I want an agent to draft a first project from a short conversation,
So that I get a useful skeleton fast.

**Acceptance Criteria:**

**Given** the "Let Agent draft" entry
**When** I answer the agent's 3–5 onboarding questions
**Then** the agent generates a project skeleton, previews it, and creates it on my approval (Draft pages)
**And** I can reject or edit the skeleton before applying

### Story C8.4: Global command palette

As a power user,
I want a ⌘K/⌘P palette for navigation, commands, and AI,
So that I can do anything from the keyboard.

**Acceptance Criteria:**

**Given** any surface
**When** I open the command palette
**Then** it offers Go-to (cross-project pages/people/tasks), Do (commands), and a highlighted "Ask Agent" row, plus Recent and Commands
**And** selecting an entry executes or navigates without leaving the keyboard

---

## Epic C9: Remote MCP Service (Auth + Read-only Profile)

External agents and consumers reach a project's MCP capabilities over an authenticated remote transport.

### Story C9.1: HTTP transport adapter

As an integrator,
I want the MCP server reachable over HTTP,
So that remote clients can connect without stdio.

**Acceptance Criteria:**

**Given** `@anydocs/mcp` with its reserved `transport-port.ts`
**When** the HTTP transport adapter is enabled
**Then** MCP JSON-RPC is served over HTTP and the existing stdio transport continues to work unchanged
**And** the transport is selected via configuration, not hard-coded

### Story C9.2: Authentication on the remote transport

As a service operator,
I want remote MCP calls authenticated,
So that only authorized clients reach project data.

**Acceptance Criteria:**

**Given** the HTTP transport
**When** a request arrives without valid credentials
**Then** the service returns 401 (missing) or 403 (invalid/forbidden) and processes no tool call (CNFR7)
**And** a valid credential resolves to an identity used for audit attribution

### Story C9.3: Read-only tool profile

As a service operator,
I want a read-only profile that blocks write tools,
So that I can expose safe read access remotely.

**Acceptance Criteria:**

**Given** a connection bound to a `read-only` `ToolProfile`
**When** a write tool is called
**Then** the service returns 405 and performs no write (CNFR7)
**And** read tools continue to function normally under the same profile

### Story C9.4: Remote-service smoke matrix

As a developer agent,
I want an e2e smoke suite for the remote service,
So that auth and profile guarantees are continuously verified.

**Acceptance Criteria:**

**Given** the remote MCP service
**When** the smoke suite runs
**Then** it asserts 401/403 on missing/invalid auth and 405 on write-tool calls against the read-only profile, in 100% of cases (NFR34)

---

## Epic C10: Team Governance — Permissions & Audit Retention

Team-mode maintainers govern agent permission boundaries and audit-log retention.

> **⚠️ Needs UX design first.** These governance surfaces (permission-boundary editor, retention policy,
> audit query view) are NOT in the 17-board design handoff (the design brief §13 excludes org/permission
> admin). Run a small UX pass for these screens before building C10.

### Story C10.1: Role-based agent permission boundaries

As a team owner,
I want to define which roles may invoke which agent scopes,
So that agent reach matches responsibility.

**Acceptance Criteria:**

**Given** a team-mode project
**When** the owner configures permissions
**Then** each role maps to allowed agent scopes (inline / page / workspace)
**And** the configuration persists and is readable by the agent service

### Story C10.2: Enforce permission boundaries at invocation

As a team member,
I want agent invocations checked against my role,
So that I can't exceed my granted scope.

**Acceptance Criteria:**

**Given** a configured permission boundary
**When** a member invokes an agent scope they lack
**Then** the invocation is rejected with a clear message and no write occurs
**And** the rejected attempt is recorded in the audit log

### Story C10.3: Audit retention policy and prune

As a team owner,
I want to set audit retention and prune old entries,
So that we meet governance needs beyond the 30-day minimum.

**Acceptance Criteria:**

**Given** a team-mode project
**When** the owner sets a retention window (≥ 30 days)
**Then** entries older than the window are pruned by a logged prune operation
**And** lowering retention below the minimum is rejected

### Story C10.4: Audit query view

As a team lead,
I want to query the audit log by scope, resource, and time,
So that I can review and roll back agent operations.

**Acceptance Criteria:**

**Given** an audit log
**When** I query by scope, target resource, and time range
**Then** matching entries render with actor, scope, targets, and outcome
**And** an individual logged operation can be rolled back to its pre-change state

---

## Epic C11: Design-System Conformance — Dark Mode, A11y & Visual Regression

Every migrated surface passes a cross-surface conformance gate.

### Story C11.1: Dark mode across surfaces

As any user,
I want a consistent dark mode everywhere,
So that I can work comfortably in low light.

**Acceptance Criteria:**

**Given** any surface delivered by C1–C8
**When** `[data-theme="dark"]` is active
**Then** all tokens invert correctly and AI elements keep recognizability (raised lightness + `--ai-glow`) (CNFR1)
**And** no surface hard-codes a light-only value

### Story C11.2: Accessibility conformance

As a user relying on assistive tech,
I want WCAG AA conformance across surfaces,
So that the product is usable by everyone.

**Acceptance Criteria:**

**Given** any migrated surface
**When** audited
**Then** contrast meets WCAG AA, status is conveyed by icon + text (not color alone), focus is visible, and all flows are keyboard-reachable
**And** agent state and diff-accept actions announce via `aria-live` (CNFR2)

### Story C11.2b: Internationalization conformance

As a non-English user,
I want surfaces to handle locale and copy expansion correctly,
So that the product reads well in any supported language.

**Acceptance Criteria:**

**Given** any migrated surface
**When** rendered in a non-default locale
**Then** layouts tolerate ~30% copy-length expansion without truncation or overflow
**And** time, number, and name formatting follow the active locale (CNFR3)
**And** the cloud app uses Next.js i18n routing so the active language is addressable and switchable

### Story C11.3: Component inventory and visual regression

As a developer agent,
I want the component inventory codified with visual-regression coverage,
So that surfaces stay consistent over time.

**Acceptance Criteria:**

**Given** the component inventory (Button, Avatar, Task Card, Run Inspector, Diff Viewer, etc.)
**When** components are implemented against `tokens.css`
**Then** each has a documented spec and a visual-regression snapshot
**And** CI fails on unintended visual drift across light and dark themes
