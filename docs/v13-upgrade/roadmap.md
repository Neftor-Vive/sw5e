# SW5e v13 Roadmap

Foundry target: `v13` build `350`

Active server and test target: `foundry-test`, world `orion`

## Status Snapshot

- Completed: shell recovery, sheet recovery, compatibility cleanup, secondary app recovery, document and data cleanup, starship recovery, canvas and chat interaction recovery, presentation hardening, content validation, and release prep
- Active: community testing and follow-on polish
- Deferred: optional AppV1 modernization and longer-term maintenance work

Tranches were executed in order so the whole module could be covered without losing sight of the main compatibility goal. At the current checkpoint the roadmap is complete for the v13 community-test line: the system builds, validates content, and is ready for outside testing against Foundry `13.350`.

## Tranche Roadmap

### Tranche 0: Foundations and Recovery Setup

Purpose:
- establish the working baseline and the supporting project structure for the recovery effort

Included subsystem surfaces:
- baseline inventory
- upgrade planning
- working documentation for compatibility recovery

Key repo areas:
- `docs/v13-upgrade/*`
- root build and content tooling

Exit criteria:
- the recovery effort has a documented target and an execution map

Primary verification:
- baseline build and manual inspection

### Tranche 1: World Shell and Chrome Recovery

Purpose:
- restore a usable Foundry shell so the system can be debugged safely

Included subsystem surfaces:
- shell render hooks
- chat and directory helpers
- shell-facing CSS and icon and button styling
- sidebar, controls, hotbar, and directory integrations

Key repo areas:
- `sw5e.mjs`
- `module/documents/item.mjs`
- `module/display-cr.mjs`
- `module/character-importer.mjs`
- `less/original/*`
- `less/update/components/forms-*`
- `less/update/components/foundry-nav-themes.less`

Exit criteria:
- shell controls visible
- sidebar and hotbar layout sane
- no major render-hook failures on shell surfaces

Primary verification:
- build plus live Foundry spot checks

### Tranche 2: Primary Non-Starship Sheet Recovery

Purpose:
- restore actor and item sheet interaction and window lifecycle for core play

Included subsystem surfaces:
- actor sheet foundation
- character sheet
- NPC sheet
- group sheet
- item sheet
- shared sheet mixins
- primary sheet templates

Key repo areas:
- `module/applications/actor/*`
- `module/applications/item/*`
- `static/templates/actors/*`
- `static/templates/items/*`

Exit criteria:
- primary actor and item sheets open and function on v13
- shell stays stable while sheets are open

Primary verification:
- build plus live Foundry spot checks

### Tranche 3: Boot-Time Compatibility and Deprecated API Cleanup

Purpose:
- remove invalid or high-noise v13 API usage on boot and common runtime paths

Included subsystem surfaces:
- boot-time compatibility shims
- deprecated API cleanup on high-traffic paths
- migration and runtime glue that affects all sessions

Key repo areas:
- `sw5e.mjs`
- `module/migration.mjs`
- `module/documents/actor/actor.mjs`
- shared runtime modules reached during initialization

Exit criteria:
- no major boot-time compatibility blockers remain
- deprecated runtime assumptions are reduced on high-traffic paths

Primary verification:
- build, validation, and live Foundry startup checks

### Tranche 4: Secondary Applications and Workflow Dialogs

Purpose:
- stabilize the rest of the interactive app surface beyond core sheets

Included subsystem surfaces:
- advancement apps and flows
- compendium browser apps
- journal apps
- combat and sidebar-specific apps
- property and source config dialogs

Key repo areas:
- `module/applications/advancement/*`
- `module/applications/compendium/*`
- `module/applications/journal/*`
- `module/applications/combat/*`
- `module/applications/sidebar/*`
- `module/applications/source-config.mjs`
- `static/templates/apps/*`
- `static/templates/advancement/*`
- `static/templates/journal/*`

Exit criteria:
- representative dialog and app flows open and interact cleanly on v13
- advancement and configuration flows are usable again

Primary verification:
- build plus live Foundry spot checks

### Tranche 5: Document Layer, Data Models, and Derived Data

Purpose:
- modernize the core SW5e system logic that drives actors, items, effects, chat, macros, and advancement documents

Included subsystem surfaces:
- actor, item, active-effect, chat, combat, token, and macro documents
- actor and item data classes
- shared fields and abstract helpers
- advancement document and data logic

Key repo areas:
- `module/documents/*`
- `module/data/actor/*`
- `module/data/item/*`
- `module/data/advancement/*`
- `module/data/shared/*`
- `module/config.mjs`

Exit criteria:
- representative create, update, and derive flows behave correctly
- major document prep logic no longer depends on deprecated v11-era assumptions

Primary verification:
- build, validation, and focused in-world checks

### Tranche 6: Starships and Vehicle-Adjacent Deferred Recovery

Purpose:
- isolate and fix the known starship migration and starship-specific UI and workflow failures

Included subsystem surfaces:
- starship actor data
- starship sheet
- starship defaults and provisioning
- starship item interactions most directly tied to runtime

Key repo areas:
- `module/data/actor/starship.mjs`
- `module/applications/actor/starship-sheet.mjs`
- starship templates
- starship-related runtime touchpoints

Exit criteria:
- no `attributes.power` migration crash
- representative starship create, open, and update flows are stable

Primary verification:
- build plus live starship checks

### Tranche 7: Canvas, Dice, Templates, and Rich Interaction Surfaces

Purpose:
- recover scene interaction and presentation layers beyond standard sheets

Included subsystem surfaces:
- canvas extensions
- detection modes
- ability templates and firing arcs
- custom grid behavior
- dice integrations
- chat templates and scene-linked UI affordances

Key repo areas:
- `module/canvas/*`
- `module/dice/*`
- `static/templates/chat/*`

Exit criteria:
- representative scene interaction flows work without runtime errors
- canvas-linked UI does not regress shell stability

Primary verification:
- build plus in-world use of templates, rolls, and chat cards

### Tranche 8: Styling, Theme Consolidation, and Template Hardening

Purpose:
- clean up remaining presentation debt after the main behaviors are stable

Included subsystem surfaces:
- LESS layering cleanup
- template consistency
- app-window theming
- actor, item, and global theme alignment
- compendium-browser styling

Key repo areas:
- `less/original/*`
- `less/update/*`
- `static/templates/**/*`

Exit criteria:
- no major CSS collisions with Foundry shell and app chrome
- primary UI surfaces render consistently in v13

Primary verification:
- build plus visual inspection in Foundry

### Tranche 9: Compendium Packs, Static Assets, and Localization Validation

Purpose:
- validate the large shipped content surface once runtime behavior is stable

Included subsystem surfaces:
- compendium packs
- static icon, font, and UI assets
- localization JSON files
- content alias normalization

Key repo areas:
- `packs/*`
- `static/packs/Icons/*`
- `static/lang/*`
- `static/json/*`
- `static/fonts/*`
- `static/ui/*`

Exit criteria:
- packs compile and load cleanly through the existing build path
- representative compendium import and use flows work on v13

Primary verification:
- build and content validation

### Tranche 10: Build, Release, and Maintainer Hardening

Purpose:
- make the resurrected system repeatable to build, test, and hand off

Included subsystem surfaces:
- build scripts and gulp tasks
- packaging expectations
- versioning and compatibility manifest updates
- maintainer and release docs

Key repo areas:
- `package.json`
- `gulpfile.js`
- root docs
- `static/system.json`

Exit criteria:
- build and validation workflow is documented and reproducible
- manifest compatibility reflects the supported v13 state

Primary verification:
- `npm run build`
- `npm run validate:content`

## Coverage Matrix

| Subsystem | Tranche | Status |
| --- | --- | --- |
| entrypoint and bootstrap | T1, T3 | done |
| shell hooks and chrome | T1 | done |
| actor sheets | T2 | done |
| item sheets | T2 | done |
| secondary apps and dialogs | T4 | done |
| advancement flows | T4, T5 | done |
| document layer | T5 | done |
| actor data models | T5, T6 | done |
| item data models | T5 | done |
| migration layer | T3, T5, T6 | done |
| starships | T6 | done |
| canvas, dice, and chat interaction | T7 | done |
| templates | T2, T4, T8 | done |
| styles and themes | T1, T8 | done |
| compendium browser | T4, T8, T9 | done |
| packs and content | T9 | done |
| assets, fonts, icons, and lang | T9 | done |
| build, docs, and release process | T0, T10 | done |

## Working Rules

- small reviewable batches
- validate content and rebuild after meaningful checkpoints
- keep starships isolated until their dedicated tranche
- avoid broad refactors without clear v13 value
