# V13 Upgrade Inventory

Phase 0 inventory for API-risk usage in the SW5e resurrection repo.

## Scope

This document will track:

- Files containing `activateListeners(`
- jQuery binding sites such as `.find(`, `.on(`, `.click(`, `.change(`, `.keyup(`, `.submit(`
- Raw `$(` usage
- Render hooks or app code that assumes jQuery-wrapped HTML
- Legacy Foundry property access that needs v13 review
- High-density files that should be upgraded first

## Status

Pending initial inventory run.

## Required outputs

- Total file count with `activateListeners`
- Total jQuery/event-binding site count
- Ranked top-15 highest-density files
- Notes on obviously risky v12/v13 API touchpoints
