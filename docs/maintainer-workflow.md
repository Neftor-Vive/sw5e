# Maintainer Workflow

This repo is a build-first Foundry system workspace. Treat `dist/` as the packaged output and the source tree as the source of truth.

## Daily Loop

1. Edit source in the repository root.
2. Rebuild with `npm run build`.
3. Run the smallest useful verification step first:
   - `npm run validate:content` for content and manifest work
   - `npm test` as the validation alias
4. Do manual spot checks in Foundry when the change affects UI or gameplay workflows.

## Content And Assets

- `tools/sync-content-aliases.mjs` normalizes legacy content-path drift before every build.
- `tools/validate-content.mjs` is the canonical content validator.
- Wildcard monster-side references are validated as wildcard matches in `dist/`; they are expected and should not be flattened into explicit file lists.

## Test Servers

- Primary dev target: `foundry-test`
- Primary test world: `orion`

Do not test active development against production userdata.

## Git Remote Layout

Use the standard fork workflow:

- `origin` should point at the active maintainer fork
- `upstream` should point at the canonical `sw5e-foundry/sw5e` repository

That keeps day-to-day pushes isolated to the fork while preserving a clean path to fetch upstream changes and prepare future PRs.

## Release Discipline

Use `npm run release:check` before calling a checkpoint or release candidate ready. It runs:

1. `npm run build`
2. `npm run validate:content`

For PR preparation, `npm run pr:check` is the same gate and should be treated as the default pre-PR command.

## Docs To Keep Current

- `docs/v13-upgrade/roadmap.md`
- `docs/v13-upgrade/plan.md`
- `CHANGELOG.md`

The roadmap is the canonical whole-module map. The plan is the short current-status view.
