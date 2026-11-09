## Two presentations

`sheetMode` controls only how a Character is presented. The sheet behind it is the same in both modes, and building out keeps every entry.

- Only a Character in a campaign with a militia can be Militia-only. A Character in no campaign is always Full.
- The mode is never shown as a label, on Characters & officers or on the sheet. A Militia-only Character has a **Build out** button, which makes it Full and opens its sheet. There is no way back to Militia-only.

- **Militia-only Character:**
  - Characters & officers shows its name, level and permanent ability totals, and edits them in place.
  - **Raising the level** appends Unspecified Class Levels.
  - **Lowering the level** removes Class Levels from the end, real ones included, after a confirmation naming them.
  - **Editing a score** changes the base score by the difference, so the total shown equals what was typed.
- **Full Character:** it is edited on its Character Sheet. Its level and ability scores are read-only in Characters & officers and link to the sheet. A campaign can have Full Characters with or without a militia. Every Character Sheet lives at `/characters/<id>` (see "Ownership and campaigns").

The roster Hit Dice override, the name, PC/NPC kind, active state and `description` stay editable in Characters & officers in both modes.

A Synthesist's Combined Form is neither presentation: it is a read-only view on the summoner's Full Character Sheet, calculated from the summoner's and the eidolon's separate builds (see "Companions"). It never changes `sheetMode` or anything shown in Characters & officers.
