# SW5e V13 Issue Register

Open issues discovered during community testing of the `v13-community-test` branch should be recorded here until they are fixed, intentionally deferred, or moved into a more formal tracker.

## Open Issues

### CT-001: Character creation stalls after dropping a class onto a new actor

- Status: open
- Severity: high
- Area: character creation, advancements, class onboarding
- Reported during: manual character-building test

Reproduction steps:

1. Create a new character actor.
2. Open the character sheet.
3. Drag a class item from the compendium onto the character sheet.
4. Advance into the class onboarding flow until the `Advancement Step 2` dialog appears.
5. Attempt to continue with `Next`.

Observed behavior:

- The flow reaches the `Advancement Step 2` screen for the selected class.
- The onboarding flow does not let the user progress past this screen.
- Character creation is effectively blocked at this point.

Expected behavior:

- The class onboarding flow should allow the user to continue through the advancement steps and complete initial character setup.

Notes:

- Initial report used the `Consular` class.
- The current evidence suggests this is a high-priority blocker for basic standalone SW5e character creation on v13.

## Closed Issues

None yet.
