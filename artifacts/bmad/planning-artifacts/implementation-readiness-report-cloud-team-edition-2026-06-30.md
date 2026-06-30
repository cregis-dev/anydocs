---
stepsCompleted: ['step-01-document-discovery', 'step-02-prd-analysis', 'step-03-epic-coverage-validation', 'step-04-ux-alignment', 'step-05-epic-quality-review', 'step-06-final-assessment']
status: 'complete'
overallReadiness: 'READY — 3 pre-sprint fixes applied (2026-06-30)'
assessor: 'Implementation Readiness workflow (Architect/SM role)'
productLine: 'Cloud Team Edition'
assessmentDate: '2026-06-30'
documentsAssessed:
  - artifacts/bmad/planning-artifacts/epics-cloud-team-edition.md
  - artifacts/bmad/planning-artifacts/architecture-cloud-team-edition.md
  - '/Users/shawn/Downloads/anydocs-studio-handoff/cloud-studio-ai-first-design-brief.md (interim PRD + UX)'
documentsExcluded:
  - 'prd.md / epics.md / architecture.md / ux-design-specification.md — local-first edition (separate product line, NOT duplicates)'
---

# Implementation Readiness Assessment Report

**Date:** 2026-06-30
**Project:** anydocs — Cloud Team Edition

## Document Inventory

**In scope (Cloud Team Edition):**
- **Requirements (PRD-equivalent):** `cloud-studio-ai-first-design-brief.md` (interim PRD) + `epics-cloud-team-edition.md` (27 CFR + 9 CNFR inventory). No standalone Cloud PRD file exists.
- **Epics & Stories:** `epics-cloud-team-edition.md` — 11 epics (C1–C11), 61 stories (post-remediation; was 59).
- **Architecture:** `architecture-cloud-team-edition.md` — complete (8/8 steps).
- **UX:** the design handoff (17 hi-fi boards + `tokens.css` + agent-interaction scripts) embedded in the design brief.

**Out of scope (local-first edition — separate product line, not duplicates):**
- `prd.md`, `epics.md`, `architecture.md`, `ux-design-specification.md`.

## PRD Analysis

**Requirements basis:** no standalone Cloud PRD; the requirements set is the CFR/CNFR inventory
in `epics-cloud-team-edition.md` (authored from the design brief). Full text lives there; extracted
here for traceability.

### Functional Requirements (27)

- **Shell & IA:** CFR1 four-region shell; CFR2 Org→Workspace→Project→Page tenancy + Rail; CFR3 nav
  tree w/ status/editor/agent affordances; CFR4 nav header filter/lang/create; CFR5 canvas top bar +
  760px body + status bar; CFR6 focus mode.
- **Agent:** CFR7 Inline summon (⌘K/toolbar/`/`); CFR8 inline diff micro-interactions; CFR9 Page Agent
  Plan→Preview→Apply + Task Card state machine; CFR10 Task Card fields/actions; CFR11 Workspace Agent
  Run Inspector + partial accept/rollback; CFR12 mandatory Plan→Preview→Apply; CFR13 three personas;
  CFR14 in-canvas agent indicator + conflict toast; CFR15 agent error recovery.
- **Collaboration:** CFR16 presence; CFR17 live cursors/selection; CFR18 comments (@person/@Agent).
- **Project/Workspace mgmt:** CFR19 review & publish gate; CFR20 Workspace Home; CFR21 new project
  (Blank/Template/Let-Agent-draft); CFR22 command palette; CFR23 bilingual compare.
- **Team backend/service:** CFR24 (FR61) project `mode`; CFR25 (FR62) authorship attribution;
  CFR26 (FR63) remote MCP auth+read-only; CFR27 (FR64) governance.

**Total FRs: 27**

### Non-Functional Requirements (9)

- CNFR1 dark mode; CNFR2 WCAG AA a11y (keyboard/focus/aria-live/color-not-sole); CNFR3 i18n
  (30% copy expansion + locale formatting); CNFR4 tokens.css immutable contract; CNFR5 perf states
  (virtualized tree/long-diff/offline banner/autosave); CNFR6 realtime consistency (CRDT/OT);
  CNFR7 (NFR34) remote MCP 401/403/405; CNFR8 (NFR28) per-scope agent latency (inline≤3s/page≤8s/ws≤2s);
  CNFR9 (NFR29) write-ahead audit.

**Total NFRs: 9**

### Additional Requirements / Constraints

- `tokens.css` shared with the desktop edition (immutable). 17 design boards are reference prototypes,
  re-implemented in the target stack (not shipped).
- Explicitly OUT of scope this round (design brief §13): billing/quota admin, org/permission admin
  (SSO/SCIM), native mobile UI, reader visuals, model-selection UI.

### PRD Completeness Assessment

Requirements are clear, numbered, and testable (each CFR/CNFR is already an epic/story with
Given/When/Then ACs). The "PRD" is distributed across the design brief (rich UX + interaction scripts)
and the epics inventory rather than a single PRD doc — acceptable for this product line, but a formal
Cloud PRD remains an optional consolidation. One known soft spot to verify downstream: **CNFR3 (i18n)**
is stated but carried cross-cutting, without a dedicated story AC.

## Epic Coverage Validation

### Coverage Matrix (FRs)

The epics document ships an explicit FR Coverage Map. Every CFR resolves to ≥1 epic/story:

| FR | Epic(s) | Status |
|---|---|---|
| CFR1–CFR2 | C1 (shell, tenancy) | ✓ |
| CFR3–CFR6, CFR23 | C2 (nav, editor, focus, bilingual) | ✓ |
| CFR7–CFR8 | C3 (inline agent) | ✓ |
| CFR9–CFR10 | C4 (page agent / task card) | ✓ |
| CFR11 | C5 (workspace agent / run inspector) | ✓ |
| CFR12 | C3 (established), C4/C5 (extended) | ✓ |
| CFR13–CFR14 | C3 (introduced), C4/C5/C6 | ✓ |
| CFR15 | C4 (introduced), C5 | ✓ |
| CFR16–CFR18 | C6 (collaboration) | ✓ |
| CFR19 | C7 (review/publish) | ✓ |
| CFR20–CFR22 | C8 (home/onboarding/palette) | ✓ |
| CFR24 (FR61) | C1 (mode field) | ✓ |
| CFR25 (FR62) | C6 (authorship) + C1 identity | ✓ |
| CFR26 (FR63) | C9 (remote MCP) | ✓ |
| CFR27 (FR64) | C10 (governance) | ✓ |

### Coverage Matrix (NFRs)

| NFR | Epic(s) | Status |
|---|---|---|
| CNFR1, CNFR2 | C11 (+ per-epic AC) | ✓ |
| CNFR3 (i18n) | C2 cross-cutting | ⚠️ Partial — no dedicated story AC |
| CNFR4 | C1 (tokens) | ✓ |
| CNFR5 | C2 (perf states) | ✓ |
| CNFR6 | C6 (realtime CRDT) | ✓ |
| CNFR7 (NFR34) | C9 (401/403/405) | ✓ |
| CNFR8 (NFR28) | C3/C4/C5 (latency) | ✓ |
| CNFR9 (NFR29) | C3 (audit foundation), C10 | ✓ |

### Missing Requirements

- **Critical missing:** none. All 27 CFRs have a traceable epic/story path.
- **Partial (high priority):** **CNFR3 (i18n)** — present in the inventory and architecture-flagged,
  but not yet expressed as a concrete story AC. Recommendation: add an i18n AC line to Story C2.5
  (editor/locale) and/or C11.2 (a11y/locale), plus the Next.js i18n routing element noted in the
  architecture gap analysis.
- **Reverse check (in epics but not in requirements):** none — the epic set is a strict superset
  decomposition of the CFR/CNFR inventory; no orphan stories.

### Coverage Statistics

- Total FRs: 27 → covered 27 → **100% FR coverage**.
- Total NFRs: 9 → fully covered 8, partial 1 (CNFR3) → **94% NFR coverage** (no critical gaps).

## UX Alignment Assessment

### UX Document Status

**Found (high fidelity).** The cloud UX is the design handoff: 17 hi-fi boards (1440×900) + the
`cloud-studio-ai-first-design-brief.md` (IA, agent-interaction scripts, collaboration rules,
component inventory) + `tokens.css`. Note: the local-first `ux-design-specification.md` is OUT of
scope (different product line; it explicitly excludes team/collaboration).

### UX ↔ PRD Alignment

Inherently aligned — the design brief **is** the requirements basis (it doubles as the interim PRD).
The CFR/CNFR inventory was extracted directly from it, so user journeys and use cases match 1:1.

### UX ↔ Architecture Alignment

Architecture supports the UX surfaces:
- Four-region shell → `cloud-web/app/layout` + `components/shell` ✓
- Three agent forms + Task Card + Run Inspector → `cloud-core/agent` + `components/agent` ✓
- Presence / cursors / comments → `cloud-realtime` + `components/collab` + Yjs awareness ✓
- Plan→Preview→Apply inline diff → agent apply-path ✓
- `tokens.css` contract + dark mode → CNFR4 + C11 ✓
- Workspace Home / onboarding / command palette → C8 ✓; bilingual compare → C2 ✓

### Alignment Issues / Warnings

1. **⚠️ Two team-backend epics have NO design board:** **C10 Governance** (permission boundaries +
   audit retention) and **C9 Remote MCP** management have UI surfaces (esp. C10) that the 17 boards
   don't cover — the design brief §13 explicitly excludes org/permission admin. **C10 needs a UX pass
   before build;** C9 is mostly backend (minimal UI). Recommendation: tag C10 stories "needs UX design".
2. **⚠️ CNFR3 (i18n)** — the design brief §11 mandates 30% copy expansion + locale formatting, but
   neither a story AC nor a dedicated architecture element implements it (consistent with the coverage
   and architecture findings). Add as a story AC + Next.js i18n element.
3. **ℹ️ Reference-prototype caveat:** the 17 boards are HTML/React prototypes to be re-implemented in
   the target stack; `tokens.css` is the only directly reusable asset. Architecture already records this.

## Epic Quality Review (against create-epics-and-stories standards)

### User-Value & Independence

- **User value:** C2–C8, C10 are clearly user-outcome framed. C1 (sign-in/foundation) and C9 (remote
  MCP) are borderline "foundation/service" but each carries a real outcome (member lands in a workspace;
  integrators reach the project) — **acceptable framing**.
- **Epic independence:** ✓ no forward dependencies. Each epic depends only on earlier epics
  (C2→C1, C3→C1/C2, C4→C3, C5→C3/C4, C6→C1/C2, C7→C2, C8→C1/C2, C9→C1, C10→C1/C3, C11→C1–C8).
- **Within-epic story order:** ✓ no story references a later story. Foundation-first ordering
  (C3.1 agent-service + C3.2 audit before C3.3+; C1.1 session before provisioning/shell).
- **DB/entity timing:** ✓ tables created when first needed (C1 tenancy tables, C3 agent_runs/audit,
  C6 comments/ydoc, C10 roles) — not all upfront.
- **AC quality:** ✓ Given/When/Then throughout, with error/edge cases; NFR budgets embedded as testable
  P95 ACs (C3.6/C4.3/C5, C9.2–C9.4).

### Findings by Severity

**🔴 Critical:** none.

**🟠 Major:**
- **M1 — Missing explicit scaffolding story.** The architecture names the first implementation priority
  as "scaffold `cloud-web` + `cloud-core` + `cloud-realtime` + Postgres/Drizzle/Better Auth/Hocuspocus
  baseline," but Story **C1.1** is "Sign in and establish a session" — scaffolding is only *implied*.
  **Recommendation:** add an explicit **Story C1.0 "Scaffold cloud packages + baseline infra"** as the
  true first story (brownfield-extend setup), so the workspace/DB/auth/realtime baseline exists before C1.1.
- **M2 — C10 Governance has no UX design coverage** (from UX step). Its UI (permission boundaries,
  retention, audit query view) isn't in the 17 boards. **Recommendation:** tag C10 stories "needs UX
  design" and run a small UX pass before building C10.

**🟡 Minor:**
- **m1 — C11 is a cross-cutting conformance epic** (dark/a11y/visual-regression) — borderline "quality
  milestone" rather than user value. Acceptable because CNFR1/2 are also carried as per-epic ACs and C11
  is a final gate; could alternatively be folded entirely into per-epic ACs.
- **m2 — C3.1 / C3.2 are technical "developer agent" foundation stories** (agent-service, audit). Low
  direct user value but legitimately needed-first within the epic; acceptable.
- **m3 — CNFR3 (i18n)** still not a concrete story AC (recurring across coverage/UX/architecture).
- **m4 — C1** bundles auth + tenancy + shell + mode; large but decomposed into 6 ordered stories — OK.

### Best-Practices Compliance Checklist

- [x] Epics deliver user value (C1/C9 borderline but acceptable)
- [x] Epics function independently (no forward deps)
- [x] Stories appropriately sized (single dev session)
- [x] No forward dependencies (cross-epic or within-epic)
- [x] DB tables created when needed (not upfront)
- [x] Clear, testable acceptance criteria
- [x] Traceability to CFR/CNFR maintained
- [ ] Explicit project-initialization story present — **MISSING (M1)**

## Summary and Recommendations

### Overall Readiness Status

**READY — with 3 recommended pre-sprint fixes.** No critical/blocking issues. Requirements traceability
is complete (100% FR, 94% NFR), epics are user-value-oriented with no forward dependencies, and the
architecture supports every UX surface. The fixes below are quick and best done before sprint planning.

### Findings tally

6 findings across 3 categories: **0 critical · 2 major · 4 minor** (+ the CNFR3 thread recurring through
coverage, UX, and architecture).

### Critical Issues Requiring Immediate Action

None.

### Recommended Next Steps (pre-sprint fixes)

1. **Add Story C1.0 "Scaffold cloud packages + baseline infra"** (M1) — make the architecture's
   first-priority scaffolding (cloud-web/cloud-core/cloud-realtime + Postgres/Drizzle/Better Auth/
   Hocuspocus baseline) an explicit first story, ahead of C1.1 sign-in.
2. **Resolve CNFR3 (i18n)** (m3) — add an i18n AC to Story C2.5 and/or C11.2, plus the Next.js i18n
   routing element noted in the architecture gap analysis.
3. **Tag C10 Governance "needs UX design"** (M2) — run a small UX pass for permission-boundary /
   retention / audit-query surfaces (not in the 17 boards) before building C10.

### Also flagged (do during build, not blocking)

- Spike the two architecture risk items early: the Y.Doc ↔ doc-content-v1 bridge, and routing agent
  writes through the Y.Doc (so they're live + audited).
- C11 may be folded into per-epic ACs if you prefer not to keep a separate conformance epic.

### Remediation Applied (2026-06-30)

All 3 recommended pre-sprint fixes were applied to `epics-cloud-team-edition.md`:
- ✅ **M1** — added **Story C1.0 "Scaffold cloud packages and baseline infrastructure"** ahead of C1.1.
- ✅ **m3 / CNFR3** — added **Story C11.2b "Internationalization conformance"** (copy expansion + locale
  formatting + Next.js i18n routing); coverage map updated. NFR coverage now **100% (9/9)**.
- ✅ **M2** — Epic C10 tagged **"Needs UX design first"** with an explicit pre-build UX note.

Story count 59 → **61**. Remaining minor items (m1 C11-as-epic, m2 C3.1/C3.2 technical stories) accepted
as-is. Build-time reminders unchanged (spike the Y.Doc bridge + agent→Y.Doc write-path).

### Final Note

This assessment identified 6 issues across 3 categories, none critical. Address the 3 recommended
pre-sprint fixes (or accept them as known debt) before/alongside sprint planning. The Cloud Team Edition
planning set (requirements basis + epics/stories + architecture) is coherent and implementation-ready.
