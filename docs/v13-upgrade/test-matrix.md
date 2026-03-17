# V13 Test Matrix

Manual regression matrix for the SW5e v13 resurrection effort.

## Coverage targets

- Milestone A minimum: `>= 150` cases
- Milestone B target: `>= 200` cases

## Test groups

### Actor sheets

Target range: `45-70`

Track:

- open each actor type
- edit primary fields
- add and remove embedded items
- toggle controls
- drag and drop within the sheet
- drag and drop from the sidebar

### Item sheets

Target range: `25-45`

Track:

- create each key item type
- edit each key item type
- activate or use actions where supported
- verify consumption, recharge, and related logic

### Rolls and chat cards

Target range: `20-35`

Track:

- ability checks
- skill checks
- attack and damage flows
- targeting and templates if applicable

### Active Effects

Target range: `15-25`

Track:

- create effects
- apply effects
- remove effects
- verify recalculation

### Compendium workflows

Target range: `15-30`

Track:

- import from compendiums
- drag and drop entries into actors

### Migration and world update

Target range: `10-20`

Track:

- load a copy of an older world
- verify migrations do not corrupt actor or item data

### Settings and config dialogs

Target range: `10-20`

Track:

- open dialogs
- save changes
- verify effects of saved configuration

## Case template

Each case should include:

- Preconditions
- Steps
- Expected result
- Pass/fail notes
