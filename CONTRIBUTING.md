# Contributing to Anydocs

This repository contains the Anydocs tooling surfaces:

- `Studio` for local authoring
- `Docs Reader` for published-content rendering
- `CLI` for init, build, preview, import, and conversion
- `MCP` for agent-safe project authoring

The current collaboration model should stay lightweight:

- `main` is protected and merge-only
- all changes land through pull requests
- feature branches should be short-lived
- default merge strategy is squash

## Prerequisites

- Node.js 22.x
- pnpm 9.x
- Playwright Chromium installed locally when you need browser acceptance coverage

Recommended setup:

```bash
pnpm install
pnpm --filter @anydocs/web exec playwright install chromium
```

## Branching and Commits

Create a branch from `main` for each change set:

```bash
git fetch origin
git switch main
git pull --ff-only
git switch -c feat/web-reader-redirect
```

Use short, intention-revealing branch names:

- `feat/web-studio-project-lock`
- `fix/cli-preview-runtime-root`
- `docs/github-workflow`
- `release/1.0.5`

Use Conventional Commits with scopes aligned to the repo layout:

- `feat(web): ...`
- `fix(cli): ...`
- `refactor(core): ...`
- `test(mcp): ...`
- `docs(repo): ...`

Avoid mixing unrelated cleanup into a feature or bugfix branch.

## Local Development

Common commands:

```bash
pnpm dev
pnpm dev:desktop
pnpm build
pnpm lint
pnpm typecheck
pnpm test
pnpm test:acceptance
```

If you are working on authoring flows, it is often useful to keep these running together:

```bash
# Terminal 1
pnpm dev

# Terminal 2
pnpm --filter @anydocs/cli cli preview examples/starter-docs

# Terminal 3
pnpm --filter @anydocs/cli cli build examples/starter-docs --watch
```

## Validation Before Opening a PR

Minimum expectation for repository code changes:

```bash
pnpm lint
pnpm typecheck
pnpm test
```

Also run this when your change touches `packages/web`, Studio, reader routes, local APIs, build/preview flows, or other user-facing authoring behavior:

```bash
pnpm test:acceptance
```

Notes:

- `pnpm test` covers the current `core`, `cli`, and `mcp` automated suites
- `pnpm test:acceptance` adds the Playwright P0 regression layer for the web surface
- if you change packaging, runtime bootstrapping, or cross-package integration, run `pnpm build` before you open the PR
- do not send a PR with known failing tests unless the failing scope is explicitly documented and accepted

## Pull Request Expectations

Open a draft PR early when the implementation is still moving. Before requesting review, make sure the PR description covers:

- why the change is needed
- what behavior changed
- the main risks or compatibility implications
- the exact validation commands you ran

For UI-visible changes, include screenshots or a short recording.

Keep PRs focused. If a branch starts to mix refactors, behavior changes, and release work, split it.

## Review and Merge

- do not push directly to `main`
- address review feedback with follow-up commits or a rebase that preserves intent
- prefer squash merge unless the individual commits are intentionally meaningful
- delete the branch after merge

## CI and Required Checks

GitHub Actions runs two checks on pull requests and on pushes to `main`:

- `Quality`: install, lint, typecheck, test, and build
- `Acceptance`: Playwright Chromium install plus the P0 Studio acceptance suite

These jobs are the recommended required checks for branch protection.

## Release Hygiene

Use a dedicated release branch or release PR for version bumps, tags, and packaging changes. Do not mix feature work and release preparation in the same PR unless the release change is inseparable from the fix.
