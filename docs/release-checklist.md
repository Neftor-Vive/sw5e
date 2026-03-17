# Release Checklist

## Preflight

1. Confirm the target remains Foundry VTT `v13` build `350`.
2. Confirm `static/system.json` compatibility matches the supported target.
3. Confirm the roadmap and short plan still reflect current status.
4. Confirm the project content tools remain in place:
   - `tools/sync-content-aliases.mjs`
   - `tools/validate-content.mjs`

## Build And Validation

1. Run `npm run build`.
2. Run `npm run validate:content`.
3. Run `npm test`.
4. For a full checkpoint, run `npm run release:check`.
5. For PR preparation, `npm run pr:check` is the equivalent gate.

## Runtime Verification

1. Verify `foundry-test` is healthy.
2. Verify the `orion` world still loads cleanly.
3. Perform manual spot checks for the surfaces most affected by the current change.

## Content Verification

1. Confirm the validator reports:
   - all manifest packs present in source and `dist/`
   - all language JSON files parse cleanly
   - zero missing built asset references
2. Confirm wildcard content references still resolve to at least one built file.

## Release Notes

1. Update `CHANGELOG.md`.
2. Update `docs/v13-upgrade/plan.md` and `docs/v13-upgrade/roadmap.md` if tranche or scope status changed.
3. Record the validation and manual verification used for the checkpoint.
