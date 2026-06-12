# Story 13.5: Implement Four-Step Onboarding Flow

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a first-time user,
I want a four-step onboarding (Welcome → Vault → Model → Done) that establishes vault location and model preference before I see Studio,
so that the experience matches the Claude Design onboarding screens.

## Acceptance Criteria (as implemented — test-safe slice)

1. A new `packages/web/components/studio/onboarding-stepper.tsx` renders a four-step flow with a progress indicator: **Welcome**, **Vault** (explains the vault = project folder; actual open/create happens on the existing welcome-screen next), **Model** (provider picker — local `ollama`/`llama.cpp`/`mlx` default + cloud `openai`/`anthropic` BYOK opt-in — and a model field), **Done**.
2. On **Done**, the model preference (`{ provider, model }`) is persisted to `localStorage` (`anydocs.onboarding.modelPreference`) and the host marks onboarding complete (`anydocs.onboarding.completed=1`); the user then proceeds to the welcome-screen / Library. _(Provider-port persistence — Story 11.1 / Epic 11 — is NOT yet built, so the selection is saved locally as a placeholder. No API key is stored: secrets stay out of localStorage; BYOK key entry is deferred to the provider-port, with an in-UI note.)_
3. The onboarding renders **only on a genuine fresh launch**: non-locked runtime, no `projectId`, no recent projects, and the completion flag unset. In cli/locked boot `projectId` is set, so neither the onboarding nor the welcome-screen renders — **Phase 1 welcome-to-project acceptance flows are unaffected**. The `welcome-screen.tsx` keeps the actual project/vault selection responsibility (AC3); the stepper precedes it for first-time users and a "Skip setup" affordance bypasses it.
4. `pnpm --filter @anydocs/web typecheck` + `pnpm --filter @anydocs/web test` stay green (8 passed / 23 skipped — unchanged baseline).

## Tasks / Subtasks

- [x] Build the OnboardingStepper component (AC: 1, 2)
  - [x] `onboarding-stepper.tsx` (`'use client'`): 4 steps + `StepDots` progress indicator; provider/model state; `localStorage` model-pref persistence (no secret); cloud-provider BYOK note; `onComplete`/`onSkip` callbacks.
- [x] Wire the gated first-launch branch (AC: 3)
  - [x] `onboardingComplete` state lazy-initialised from `localStorage` (defaults true on SSR/locked). New branch before the welcome-screen early return: render `<OnboardingStepper>` only when `!projectId && !onboardingComplete && !isProjectLocked && canManageRecentProjects && recentProjects.length === 0`. `onComplete`/`onSkip` set the completion flag + state → fall through to welcome-screen.
- [x] Validate (AC: 4)
  - [x] `pnpm --filter @anydocs/web typecheck` exit 0; `pnpm --filter @anydocs/web test` → 8 passed / 23 skipped (baseline unchanged).
- [x] Update `sprint-status.yaml` `13-5-...` → `review`.

## Dev Notes

- **Hard Epic 11 dependency (the reason for the slice):** AC2's "model + provider persisted to the provider-port configuration" requires `AgentProviderPort` (Story 11.1), which does not exist yet. The Model step therefore persists the selection to `localStorage` as a placeholder; re-wiring to the provider-port is a follow-up once Epic 11 lands. No API key is stored (security) — BYOK key entry is deferred with an in-UI note.
- **Test-safe gating (the reason it can't break acceptance):** the cli-studio `@p0` acceptance suite boots in `mode:'cli'` with a locked project, so `projectId` is set and the welcome-screen / onboarding branch never renders. The onboarding only appears for a non-locked, project-less, recents-empty, flag-unset first launch. `welcome-screen.tsx` is untouched and still owns project selection (AC3).
- **Vault step scope:** the stepper does not duplicate project creation/opening — that stays in `welcome-screen.tsx` (reached right after Done). The Vault step is informational (explains the vault) to avoid forking the acceptance-critical selection logic. A future pass can let the Vault step drive selection directly once verifiable.
- **Scope:** the stepper UI + local model persistence + first-launch gating. NOT provider-port wiring (Epic 11), NOT replacing welcome-screen's selection, NOT real vault creation from the stepper.

## Review Follow-ups (AI)

- [ ] [Med] Wire the Model step to the real `AgentProviderPort` config (Story 11.1 / Epic 11) — persist provider/model (and securely handle BYOK keys) instead of the `localStorage` placeholder.
- [ ] [Low] Optionally let the Vault step drive project open/create directly (currently delegated to the welcome-screen) once the acceptance suite can verify the combined flow.
- [ ] [Verification] Owner: run `pnpm test:acceptance` + manually confirm a fresh launch shows the 4-step stepper, Done lands on welcome/Library, and returning users / cli boot are unaffected.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.8 (`claude-opus-4-8`)

### Completion Notes List

- `onboarding-stepper.tsx`: Welcome → Vault → Model → Done with a `StepDots` progress indicator; provider picker (local default `ollama` + cloud BYOK opt-in) + model field; `onComplete` persists `{provider, model}` to `localStorage` (no API key stored) and hands back to the host. `data-testid`s on each step + progress for future acceptance coverage.
- `local-studio-app.tsx`: `onboardingComplete` lazy-init from `localStorage`; a gated branch renders the stepper only on a genuine fresh launch (non-locked, no project, no recents, flag unset). `onComplete`/`onSkip` set the flag + state → welcome-screen. cli/locked boot never reaches it (projectId set) → acceptance-safe.
- Honest deviation: model persistence is a `localStorage` placeholder because the provider-port (Epic 11) doesn't exist; the Vault step is informational (selection stays in welcome-screen). Both logged as follow-ups.

### Validation Evidence

- `pnpm --filter @anydocs/web typecheck` → exit 0
- `pnpm --filter @anydocs/web test` → **8 passed / 23 skipped** (unchanged baseline). Core/cli/mcp untouched.
- Verification gap: the first-launch onboarding path is not exercised by the non-gated suite (cli boot is locked) — owner to run `pnpm test:acceptance` + manual first-launch check.

### File List

**New files**
- `packages/web/components/studio/onboarding-stepper.tsx`

**Modified files**
- `packages/web/components/studio/local-studio-app.tsx` — OnboardingStepper import + `onboardingComplete` state + gated first-launch branch
- `artifacts/bmad/implementation-artifacts/13-5-implement-four-step-onboarding-flow.md` — status review; Dev Agent Record + Review Follow-ups
- `artifacts/bmad/implementation-artifacts/sprint-status.yaml` — `13-5-...` backlog → review

## References

- Epics: [Source: artifacts/bmad/planning-artifacts/epics.md#Epic 13 → Story 13.5]
- Dependency: [Source: artifacts/bmad/planning-artifacts/epics.md#Epic 11 → Story 11.1] (`AgentProviderPort` — model/provider persistence target, not yet built)
- Predecessors: [Source: artifacts/bmad/implementation-artifacts/13-4-implement-library-surface.md] (Done → Library landing)
- Design source: `/Users/shawn/Downloads/anydocs-desktop-handoff/` (`ds-welcome`, `ds-onboard-model`, `ds-onboard-done`)
- Gate: [Source: CLAUDE.md#Pre-GitHub Submission Gate] (touches Studio → `pnpm test:acceptance` recommended)
