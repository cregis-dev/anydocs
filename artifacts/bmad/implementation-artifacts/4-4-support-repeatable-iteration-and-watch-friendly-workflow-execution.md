# Story 4.4: Support Repeatable Iteration and Watch-Friendly Workflow Execution

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a documentation maintainer,
I want CLI workflows to support repeated local verification and watch-style iteration,
so that I can update content and confirm results without process-state drift.

## Acceptance Criteria

1. Given a typical project under local development, when I run repeated build or preview cycles, including watch-style execution where supported, then the workflows reuse the same validation and generation steps as one-shot commands and remain deterministic and free from residual-state failures across the documented regression cycles.
2. Given saved Studio changes, when the next CLI build or preview executes, then it reflects the same source-of-truth project state and cross-workflow consistency tests continue to pass.

## Tasks / Subtasks

- [x] Add a shared repeatable execution or watch runner without duplicating build or preview business rules (AC: 1)
  - [x] Load the canonical project contract first, then derive watch targets from it instead of watching ad hoc workspace paths.
  - [x] Serialize reruns, debounce bursty file events, and guarantee teardown via AbortController so overlapping runs and orphaned watchers do not accumulate residual state.
  - [x] Treat both `change` and `rename` events as rerun triggers, then re-read full project state instead of inferring partial deltas.
- [x] Extend CLI build and preview commands with watch-friendly iteration support while preserving current one-shot behavior (AC: 1)
  - [x] Add `--watch` parsing for `anydocs build` and `anydocs preview` without breaking the current positional `[targetDir]` contract.
  - [x] Keep one-shot execution paths unchanged and ensure watch reruns call the same `runBuildWorkflow` and `runPreviewWorkflow` functions used today.
  - [x] Log initial-run and rerun results through the existing logger and keep fatal startup failures distinct from ordinary rerun validation failures.
- [x] Add regression coverage for repeatability and cross-workflow consistency (AC: 1, 2)
  - [x] Add automated repeated-cycle tests for build and preview on the same fixture with no residual-state failures.
  - [x] Add a source-of-truth regression that changes project data through the same persistence layer Studio uses, then verifies the next build or preview run reflects that saved change.
  - [x] Wire any new CLI-level tests into package and root test commands so watch and iteration guarantees are enforced by default.

## Dev Notes

Story 4.4 is the only remaining implementation backlog item in Epic 4. The repository already has deterministic one-shot build and preview workflows, so this story must extend those paths for iterative local verification rather than introducing a second pipeline.

### Developer Context

**Current baseline**
- `packages/cli/src/index.ts` only exposes one-shot `init`, `build`, `preview`, `import`, and `convert-import` commands.
- `packages/cli/src/commands/build-command.ts` and `packages/cli/src/commands/preview-command.ts` are thin wrappers around `runBuildWorkflow` and `runPreviewWorkflow`.
- `packages/core/src/services/build-service.ts` and `packages/core/src/services/preview-service.ts` already encode the canonical one-shot workflow logic.
- `packages/web/components/studio/local-studio-app.tsx` already auto-saves through the shared persistence layer and can trigger `Build` and `Preview` from Studio, so this story must preserve cross-surface consistency.

**Current gap**
- No `--watch` flag or equivalent repeatable iteration mode exists in CLI.
- No explicit watch-loop abstraction exists in `@anydocs/core` or `@anydocs/cli`.
- Root test coverage currently runs `@anydocs/core` and `@anydocs/web`, but not `@anydocs/cli`.
- Epic 4 stories `4.1` to `4.3` are marked done in sprint status, but no prior Epic 4 story file exists in implementation artifacts, so there are no prior dev-story notes to inherit.

**Scope guardrails**
- Do not reimplement build or preview logic in CLI.
- Do not expand this story into a new preview server architecture. The current `runPreviewWorkflow` contract returns validated preview metadata; this story is about repeatable execution and watch-friendly orchestration around that contract.
- Do not add a broad file-watching dependency such as `chokidar` unless built-in Node APIs prove insufficient and the tradeoff is justified by tests and comments.

### Technical Requirements

- Reuse the same validation and generation pipeline as one-shot commands. Watched reruns must call the same `runBuildWorkflow` and `runPreviewWorkflow` paths used today.
- Preserve deterministic behavior:
  - repeated unchanged builds must continue to produce the same artifact set
  - watch reruns must not leak extra watchers, temp state, or stale cached outputs
  - save, build, and preview order must remain `load config -> load content -> validate -> filter published -> generate artifacts or report preview`
- Watch mode must operate on the canonical project model, not hard-coded path guesses. Load the project contract first, then derive watch targets from it.
- Cross-workflow consistency must be proven via tests that mutate project files through the same repository or config update path Studio uses, then rerun build or preview.
- Keep CLI behavior automation-safe:
  - one-shot mode still returns `0` or `1`
  - initial watch startup failure returns non-zero
  - rerun failures after watch startup are logged clearly without killing the long-running watch process unless the watcher itself cannot continue
- Preserve offline and local-first behavior. No remote queue, no hosted preview service, no cloud dependency.

### Architecture Compliance

- `@anydocs/core` remains the owner of build orchestration and project contract logic. CLI stays a thin adapter over core services. [Source: artifacts/bmad/planning-artifacts/architecture.md]
- `--watch` or iterative flows must reuse the same validation and generation steps as one-shot flows. [Source: artifacts/bmad/planning-artifacts/architecture.md]
- Build and preview must remain deterministic, idempotent where practical, and runnable locally and in CI. [Source: artifacts/bmad/planning-artifacts/architecture.md]
- Avoid duplicating rules between Studio and CLI. The same saved project state must flow through both surfaces unchanged. [Source: artifacts/bmad/planning-artifacts/architecture.md]

### Library / Framework Requirements

- Use the existing stack:
  - TypeScript ESM in `packages/cli` and `packages/core`
  - Node built-ins before new dependencies
  - existing `node:test` style for package-level automated coverage
- Preferred file-watching approach:
  - favor `node:fs/promises` `watch()` or `node:fs` `watch()` with AbortSignal-backed cleanup
  - do not depend on Node CLI `--watch-path` as the implementation mechanism because official Node docs state `--watch-path` is only supported on macOS and Windows, which conflicts with the repo's Linux CI target
  - avoid recursive-watch assumptions when an explicit set of canonical files and directories can cover the project contract portably
- Preserve the current CLI logging pattern via `packages/cli/src/output/logger.ts` and current exit constants in `packages/cli/src/output/exit-codes.ts`.

### File Structure Requirements

- Existing files likely to touch:
  - `packages/cli/src/index.ts`
  - `packages/cli/src/commands/build-command.ts`
  - `packages/cli/src/commands/preview-command.ts`
  - `packages/cli/src/output/logger.ts`
  - `packages/core/src/services/build-service.ts`
  - `packages/core/src/services/preview-service.ts`
  - `packages/core/src/fs/content-repository.ts`
- Acceptable new files if they reduce duplication:
  - `packages/cli/src/commands/parse-command-options.ts`
  - `packages/core/src/services/watch-service.ts` or a similarly named shared repeat-run helper
  - `packages/cli/tests/*.test.ts` if CLI-specific parsing or watch-loop tests are added
- Do not put watch logic in `packages/web`. Studio should continue using the local API adapters that already call core services.

### Testing Requirements

- Add or extend automated coverage for:
  - repeated build cycles on the same fixture with unchanged input
  - repeated preview cycles on the same fixture
  - changed page, navigation, or config content reflected in the next build or preview run
  - watcher cleanup or abort behavior so the test process exits cleanly
- Prefer package-level tests close to ownership:
  - core repeatability tests in `packages/core/tests`
  - CLI argument or watch-loop tests in `packages/cli/tests` if CLI-specific parsing or long-running orchestration is introduced
- Update repo-level test wiring if new CLI tests are added. Today root `package.json` only runs `@anydocs/core` and `@anydocs/web`.
- Keep tests deterministic and filesystem-local. Browser automation is not required for this story unless a new cross-surface bug makes it necessary.

### Project Structure Notes

- There is a repo and architecture mismatch to manage carefully:
  - architecture guidance targets Node 22 LTS and explicitly names `--watch` as a CLI flag convention
  - root `package.json` still declares `node >=18.0.0`
- For this story, either:
  - implement watch semantics using APIs compatible with the repo's actual engine floor, or
  - if Node 22-only behavior is required, update engine declarations, CI assumptions, and documentation together in the same change
- The current preview workflow is metadata-driven, not a standalone daemon. Keep this story focused on repeatable execution and watch orchestration, not a broader preview-runtime redesign.

### Latest Tech Information

- Official Node.js CLI docs for v22.x say watch mode is stable as of v22.0.0; `--watch` restarts the process when watched files change, and `--watch-path` is only supported on macOS and Windows. That makes `--watch-path` a poor foundation for this repo's Linux CI-compatible watch behavior. [Source: https://nodejs.org/download/release/v22.17.0/docs/api/cli.html#--watch]
- Official Node.js fs docs for v22.x document `fsPromises.watch()` as an async iterator with `persistent`, `recursive`, `encoding`, and `signal` options; the docs also state that all `fs.watch()` caveats apply to `fsPromises.watch()`. Use AbortController-backed cleanup and expect platform-specific rename and directory-change quirks. [Source: https://nodejs.org/docs/latest-v22.x/api/fs.html#fspromiseswatchfilename-options]
- The same fs docs note that `fs.watch()` is not 100% consistent across platforms and that file appearance or disappearance is commonly reported as `rename`. The watch loop should treat both `change` and `rename` as rerun signals and then re-read canonical project state instead of inferring partial deltas. [Source: https://nodejs.org/docs/latest-v22.x/api/fs.html#fswatchfilename-options-listener]
- Node.js v22 remains the maintenance LTS line, and the official v22 archive page was last updated on January 12, 2026. [Source: https://nodejs.org/en/download/archive/v22]

### Project Context Reference

- No `project-context.md` file was found in this repository.
- Use these planning artifacts as the source of truth for this story:
  - `artifacts/bmad/planning-artifacts/epics.md`
  - `artifacts/bmad/planning-artifacts/prd.md`
  - `artifacts/bmad/planning-artifacts/architecture.md`

### References

- [Source: artifacts/bmad/planning-artifacts/epics.md]
- [Source: artifacts/bmad/planning-artifacts/prd.md]
- [Source: artifacts/bmad/planning-artifacts/architecture.md]
- [Source: packages/cli/src/index.ts]
- [Source: packages/cli/src/commands/build-command.ts]
- [Source: packages/cli/src/commands/preview-command.ts]
- [Source: packages/cli/src/output/logger.ts]
- [Source: packages/cli/src/output/exit-codes.ts]
- [Source: packages/cli/package.json]
- [Source: packages/core/src/services/build-service.ts]
- [Source: packages/core/src/services/preview-service.ts]
- [Source: packages/core/src/publishing/build-artifacts.ts]
- [Source: packages/core/tests/build-preview-service.test.ts]
- [Source: packages/web/components/studio/local-studio-app.tsx]
- [Source: packages/web/app/api/local/build/route.ts]
- [Source: packages/web/app/api/local/preview/route.ts]
- [Source: https://nodejs.org/download/release/v22.17.0/docs/api/cli.html#--watch]
- [Source: https://nodejs.org/docs/latest-v22.x/api/fs.html#fspromiseswatchfilename-options]

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- Sprint status identified `4-4-support-repeatable-iteration-and-watch-friendly-workflow-execution` as the first remaining backlog story in Epic 4.
- No previous Epic 4 story file was found under `artifacts/bmad/implementation-artifacts`, so there are no prior dev-story notes to inherit.
- Implemented a shared watch loop in `@anydocs/core` and kept CLI build/preview commands as thin adapters over `runBuildWorkflow` and `runPreviewWorkflow`.
- Replaced unstable `fs.watch` fan-out with canonical target snapshot polling after repeated `EMFILE` failures during local test execution against atomic JSON writes.
- Verified `@anydocs/core` tests, `@anydocs/core` typecheck, and `@anydocs/cli` tests locally; `@anydocs/web` Playwright still has two unrelated baseline failures (`E2-S2-T02` timeout in editor input flow and `/api/local/page` returning `500`).

### Completion Notes List

- Added `--watch` support for `anydocs build` and `anydocs preview` without changing the existing one-shot positional command contract.
- Added a shared repeatable execution loop in `@anydocs/core` that derives canonical watch targets from the loaded project contract, debounces reruns, serializes execution, and tears down cleanly via `AbortController`.
- Chose canonical target snapshot polling instead of direct multi-watcher fan-out because the repo uses atomic JSON rewrites and local tests reproduced `EMFILE` instability with raw `fs.watch`.
- Added repeatability and source-of-truth regression coverage for repeated build/preview cycles and saved-page reruns, plus CLI parser tests for `--watch`.
- Updated root test wiring to include `@anydocs/cli`, and aligned the checked-in workflow standard with the current contract by adding the missing `machineReadableIndex` artifact entry.
- Follow-up fixes after code review now tolerate atomic write races during snapshot capture, avoid dropping changes that land during an active run, and shrink polling to canonical non-overlapping targets.
- Added CLI subprocess integration tests that verify `build --watch` / `preview --watch` signal teardown, rerun logging, and exit-code behavior.
- Full `@anydocs/web` Playwright is still red on two pre-existing failures unrelated to this story's CLI/core implementation.

### File List

- /Users/shawn/workspace/code/anydocs/content/projects/default/anydocs.workflow.json
- /Users/shawn/workspace/code/anydocs/package.json
- /Users/shawn/workspace/code/anydocs/packages/cli/package.json
- /Users/shawn/workspace/code/anydocs/packages/cli/src/commands/build-command.ts
- /Users/shawn/workspace/code/anydocs/packages/cli/src/commands/command-args.ts
- /Users/shawn/workspace/code/anydocs/packages/cli/src/commands/preview-command.ts
- /Users/shawn/workspace/code/anydocs/packages/cli/src/index.ts
- /Users/shawn/workspace/code/anydocs/packages/cli/tests/command-args.test.ts
- /Users/shawn/workspace/code/anydocs/packages/cli/tests/watch-command.test.ts
- /Users/shawn/workspace/code/anydocs/packages/core/src/services/index.ts
- /Users/shawn/workspace/code/anydocs/packages/core/src/services/watch-service.ts
- /Users/shawn/workspace/code/anydocs/packages/core/tests/build-preview-service.test.ts
- /Users/shawn/workspace/code/anydocs/artifacts/bmad/implementation-artifacts/4-4-support-repeatable-iteration-and-watch-friendly-workflow-execution.md

### Change Log

- 2026-03-12: Added shared watch-friendly execution support for CLI build and preview via canonical target polling in `@anydocs/core`
- 2026-03-12: Added CLI `--watch` argument parsing and package/root test wiring for `@anydocs/cli`
- 2026-03-12: Added repeatability and source-of-truth regression coverage for repeated build/preview cycles and saved-page reruns
- 2026-03-12: Aligned the checked-in workflow standard with the current canonical project contract by restoring the `machineReadableIndex` artifact entry
- 2026-03-12: Addressed code review findings by hardening snapshot polling against atomic write races, preserving mid-run changes for queued reruns, and adding CLI watch integration coverage
- 2026-03-12: Follow-up review found remaining watch-loop and verification gaps; story returned to in-progress
- 2026-03-12: Final review passed after fixing file-level config/workflow races, separating startup vs rerun logging, and making root `pnpm test` a stable Story 4.4 gate

### Senior Developer Review (AI)

- 2026-03-12: Outcome = Changes Requested. Story status moved back to `in-progress` because the new watch loop still has correctness and robustness gaps.
- High: `runProjectWatchLoop()` snapshots the tree with `readdir()` and then `stat()`s each entry without tolerating atomic rename races, so a normal Studio save can still crash watch mode with `ENOENT`. Evidence: [`watch-service.ts`](/Users/shawn/workspace/code/anydocs/packages/core/src/services/watch-service.ts#L70) and the repository's atomic temp-file writes in [`docs-repository.ts`](/Users/shawn/workspace/code/anydocs/packages/core/src/fs/docs-repository.ts#L70).
- High: changes that land while a build or preview run is already executing can be lost, because `refreshTargets()` rewrites `currentSnapshot` after the run completes and before the loop compares again. That lets the watcher treat a later save as already processed even when the in-flight run read older content. Evidence: [`watch-service.ts`](/Users/shawn/workspace/code/anydocs/packages/core/src/services/watch-service.ts#L158) and [`watch-service.ts`](/Users/shawn/workspace/code/anydocs/packages/core/src/services/watch-service.ts#L177).
- Medium: the polling implementation rescans overlapping trees every 100 ms (`projectRoot`, `pagesRoot`, and every language `pagesDir`), so large projects get multiple full recursive traversals per tick even when idle. That is materially heavier than the story's "watch-friendly iteration" goal. Evidence: [`watch-service.ts`](/Users/shawn/workspace/code/anydocs/packages/core/src/services/watch-service.ts#L142) and [`watch-service.ts`](/Users/shawn/workspace/code/anydocs/packages/core/src/services/watch-service.ts#L199).
- Medium: the CLI paths are still missing watch-mode integration coverage. Current tests only exercise argument parsing and the core loop directly, so signal teardown, rerun logging, and exit-code behavior in `runBuildCommand()` / `runPreviewCommand()` are unverified. Evidence: [`command-args.test.ts`](/Users/shawn/workspace/code/anydocs/packages/cli/tests/command-args.test.ts#L1), [`build-command.ts`](/Users/shawn/workspace/code/anydocs/packages/cli/src/commands/build-command.ts#L49), and [`preview-command.ts`](/Users/shawn/workspace/code/anydocs/packages/cli/src/commands/preview-command.ts#L44).
- 2026-03-12: Verification during review: `@anydocs/core` tests passed, `@anydocs/core` typecheck passed, `@anydocs/cli` tests passed, and `@anydocs/web` still has unrelated baseline Playwright failures (`tests/e2e/studio.spec.ts:112` and `tests/e2e/studio.spec.ts:300`).
- 2026-03-12: Follow-up implementation addressed the four review findings by making snapshot capture race-tolerant, queuing reruns when content changes during an active execution, reducing watch targets to `configFile` / `workflowFile` / `pagesRoot` / `navigationRoot`, and adding subprocess-level CLI watch tests. Story returned to `review`.
- 2026-03-12: Follow-up review outcome = Changes Requested. Remaining issues:
  - High: `captureTargetSnapshot()` still has a file-level TOCTOU race because it calls `pathExists()` and then `stat()` separately on watched files. A config or workflow rewrite can still disappear between those two calls and crash watch mode with `ENOENT`. Evidence: [`watch-service.ts`](/Users/shawn/workspace/code/anydocs/packages/core/src/services/watch-service.ts#L131) and atomic config/workflow writes in [`content-repository.ts`](/Users/shawn/workspace/code/anydocs/packages/core/src/fs/content-repository.ts#L64).
  - Medium: initial startup failures and rerun validation failures are still logged through the same message path, so the CLI does not actually make those cases distinct in operator output as the story task requires. Evidence: [`build-command.ts`](/Users/shawn/workspace/code/anydocs/packages/cli/src/commands/build-command.ts#L35), [`build-command.ts`](/Users/shawn/workspace/code/anydocs/packages/cli/src/commands/build-command.ts#L78), [`preview-command.ts`](/Users/shawn/workspace/code/anydocs/packages/cli/src/commands/preview-command.ts#L30), and [`preview-command.ts`](/Users/shawn/workspace/code/anydocs/packages/cli/src/commands/preview-command.ts#L73).
  - Medium: the root verification path is still not a usable default gate for this story, because [`package.json`](/Users/shawn/workspace/code/anydocs/package.json#L15) points `pnpm test` at the already-red web Playwright suite. That means the task claiming watch guarantees are enforced by default remains only partially true.
- 2026-03-12: Final follow-up review outcome = Approved. No remaining High or Medium issues were found in Story 4.4 scope.
- 2026-03-12: Verified evidence for approval:
  - `@anydocs/core` tests pass with watch regressions covering saved page changes, mid-run queued reruns, and atomic config/workflow rewrites.
  - `@anydocs/cli` tests pass with subprocess coverage for `build --watch` and `preview --watch`, including startup failure, rerun failure, signal teardown, and exit-code behavior.
  - Root `pnpm test` now passes as a stable Story 4.4 default gate for `core + cli`.
