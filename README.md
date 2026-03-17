# SW5e V13 Resurrection

Local resurrection workspace for bringing the abandoned `sw5e-foundry/sw5e` system forward to Foundry VTT `v13` build `350`.

Current status:

- source repo: this repository
- active system id: `sw5e`
- build output: `dist/`
- active dev server: `foundry-test`
- active test world: `orion`
- offline Foundry API docs: operator-local checkout outside this repo, when available

This repo is build-based. The source tree is edited locally, compiled into `dist/`, and the `foundry-test` container mounts `dist/` as `Data/systems/sw5e`.

## Current State

The v13 roadmap tranches are complete through:

- shell and shell chrome recovery
- primary non-starship sheet recovery
- boot/runtime compatibility cleanup
- secondary app recovery
- non-starship document/data cleanup
- starship recovery
- canvas, dice, template, and chat-card recovery
- presentation hardening
- content/assets/localization validation
- build, release, and maintainer hardening

The authoritative execution map is [docs/v13-upgrade/roadmap.md](./docs/v13-upgrade/roadmap.md). The short active-status view is [docs/v13-upgrade/plan.md](./docs/v13-upgrade/plan.md).

## Key Commands

One-time setup:

```bash
cd path/to/sw5e-v13
npm ci
```

Normal build:

```bash
npm run build
```

Content validation:

```bash
npm run validate:content
```

Validation alias:

```bash
npm test
```

Run the full release check:

```bash
npm run release:check
```

PR-prep gate:

```bash
npm run pr:check
```

## Build Notes

- `prebuild` runs `tools/sync-content-aliases.mjs` so legacy content-path drift is normalized before packaging.
- `tools/validate-content.mjs` validates manifest packs, built pack databases, language JSON, and built asset references used by the source content tree.
## Working Docs

- [docs/v13-upgrade/roadmap.md](./docs/v13-upgrade/roadmap.md)
- [docs/v13-upgrade/plan.md](./docs/v13-upgrade/plan.md)
- [docs/v13-upgrade/test-matrix.md](./docs/v13-upgrade/test-matrix.md)
- [docs/v13-upgrade/inventory.md](./docs/v13-upgrade/inventory.md)
- [docs/v13-upgrade/unknowns.md](./docs/v13-upgrade/unknowns.md)
- [docs/maintainer-workflow.md](./docs/maintainer-workflow.md)
- [docs/release-checklist.md](./docs/release-checklist.md)
