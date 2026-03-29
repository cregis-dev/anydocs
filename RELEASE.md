# RELEASE.md

This file provides AI-facing release constraints for this repository.

## Scope

Use this file when the task involves any of the following:

- npm publishing
- package version bumps
- release tags
- GitHub release workflow changes
- release preparation or release validation

Do not infer release behavior from tag names alone. Read the current workflow and scripts if the task touches release automation.

## Source of Truth

- Published npm package versions are defined in each package's own `package.json`.
- The publishable packages in this repo are:
  - `@anydocs/core`
  - `@anydocs/mcp`
  - `@anydocs/cli`
- The workspace root `package.json` is `private: true` and its `version` is not a publish target.

## Versioning Policy

- Package versions are independent.
- Do not force all published packages onto the same version unless the user explicitly asks for unified versioning.
- When a change affects only one published package, bump only that package.
- When a change affects multiple published packages, bump only the affected packages.
- Do not use the git release tag as the source of truth for package versions.

## Release Tag Policy

- Release tags are date-based workflow triggers.
- Use `vYYYY-MM-DD` for the first release on a date.
- Use `vYYYY-MM-DD.N` for additional releases on the same date.
- The tag identifies a release event, not the version of any individual npm package.

Examples:

- `v2026-03-30`
- `v2026-03-30.2`

## Publish Workflow Behavior

The release workflow is triggered by:

- pushing a tag that matches `v*`
- manual `workflow_dispatch`

The publish script checks each package independently:

1. Read package `name` and `version`
2. Check whether `name@version` already exists on npm
3. Skip publishing if that version already exists
4. Publish only packages whose versions are not already present

Because of that:

- pushing a new release tag does not create a new npm version by itself
- if versions were not bumped first, the workflow can pass while npm publishes nothing

## Required Agent Behavior

When asked to prepare or execute a release:

1. Identify which published packages actually changed
2. Bump only those package versions
3. Verify the release workflow trigger format
4. Create or push a date-based tag only after version bumps are in place

When asked why a release ran but npm did not update:

- first check whether the relevant package versions were already present on npm
- then confirm whether the workflow was triggered only by a new tag without version bumps

## Do Not

- Do not assume `v1.0.9` means every package should publish `1.0.9`
- Do not push a fresh tag and expect npm changes if package versions are unchanged
- Do not bump unrelated published packages just to keep version numbers visually aligned
- Do not treat the root `package.json` version as the publish version
