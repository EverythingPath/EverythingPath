# Archetype structures: six mechanical Barbarian archetypes (#662)

The second #716 structure batch by class (batch name `archetype-barbarian-1`; discriminator 662, the owning curation issue: [#662](https://github.com/AndreasUnunger/EverythingPath/issues/662) owns the barbarian Archetypes). Since `archetype-select-2` the import emits 34 Barbarian archetypes behind `--pcgen`, every row held on its structure gate or omitted behind a held feature. This batch writes the structure records of six of them, 16 rows, in `scripts/catalog/reviewed-curation.json` `structures`, written `drafted`: ten feature records. The record step checked all ten on a captured review (run `t3-review-9f78883ff5829657ed25e5ce80c9690e8a29723b431d2754c01e3186002a7696`), so all 16 rows are admitted ([the record step](#the-record-step)). The rows are preview-only: no release scope names them (owner decision 2026-11-10). The Mad Dog ([party-structures-662.md](party-structures-662.md)) is an earlier batch's and is unchanged.

Sources: PCGen at `25523dbc` (`roleplaying_game/advanced_players_guide/apg_abilities_class.lst`) and the PRD capture `prd-2026-10-20` (`advancedPlayersGuide/coreClasses/barbarian.html`, already in the pinned store). Each `sourceSha256` is the one the structure report of a `--pcgen` preview on the base `ba6c19ce` gives. No owner or feature record, and no `.MOD` line naming one, carries a Product Identity flag.

## The batch

Ten of the 34 have no review item and no `%` token by the selection's count. Six of them pass the further checks: the PRD's and PCGen's own text names every row the mapper replaces, at the level the Barbarian gains it, and no text carries a `%` or a conditioned fragment. All six are Advanced Player's Guide archetypes (PZO1115).

| Archetype          | Rows | Records                        | Replaces, whole (level)                                                     |
| ------------------ | ---: | ------------------------------ | --------------------------------------------------------------------------- |
| Brutal Pugilist    |    4 | three features (`description`) | Uncanny Dodge 2, Trap Sense 3, Improved Uncanny Dodge 5                     |
| Drunken Brute      |    2 | one feature (`description`)    | Fast Movement 1                                                             |
| Elemental Kin      |    2 | one feature (`description`)    | Trap Sense 3                                                                |
| Hurler             |    2 | one feature (`description`)    | Fast Movement 1                                                             |
| Invulnerable Rager |    3 | two features (`description`)   | Uncanny Dodge 2, Trap Sense 3, Improved Uncanny Dodge 5, Damage Reduction 7 |
| Mounted Fury       |    3 | two features (`description`)   | Fast Movement 1, Uncanny Dodge 2, Improved Uncanny Dodge 5                  |

- **The roots.** None has a review item, so none has a record. Each was still checked row by row against its features' "This ability replaces …" in the PRD and PCGen (the table above), since their features' records admit them with the mapper's rows. Invulnerability replaces uncanny dodge, improved uncanny dodge and damage reduction; Bestial Mount replaces uncanny dodge and improved uncanny dodge.
- **The descriptions.** Each is the PRD paragraph, without its heading, with links and emphasis as plain text and entities as characters. Five equal PCGen's DESC. Five differ and take the PRD's: Improved Savage Grapple (PCGen: "whether she can grapple or be grappled by another creature"; PRD: "whether she can be grappled using the grab ability or swallowed by another creature"), Raging Drunk (PCGen lacks "to" in "in addition to the normal fatigue"), Elemental Fury (the PRD's "at at 18th level" is kept word for word), Invulnerability (DR/—; PCGen DR/-) and Bestial Mount (level –4; PCGen -4).
- **Rage powers.** Each archetype's PRD section ends with the rage powers that "complement" it: a suggestion, neither a grant nor a restriction, with no PCGen record. No record binds anything about rage powers.

## The record step

The review confirmed all ten records. The record step marked them `checked` with that run as their `receipt`.

As committed, all 16 rows are admitted under #227 on PZO1115: the six archetypes and their ten features. Each archetype replaces its reviewed rows, whole, and adds its features at their levels. No other emitted key changes state, and no release scope gains a row. The four archetypes left out below keep their state: each is still omitted behind its held features.

## Left out

| Archetype           | Why                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Jungle Rager        | Home Ground Advantage's DESC (`isc_abilities_class.lst:134`) has PCGen's escape `5%%`, which the importer emits unread. The capture has no Inner Sea Combat page, so the description could only be that DESC, and reading the escape is the importer's part.                                                                                                             |
| Savage Technologist | The text and the mapper disagree. Its Rage "alters rage" (PRD `technologyGuide/archetypes.html:370`; PCGen `tg_abilities_class.lst:44`), keeping rage's rounds and Will bonus, but the mapper replaces Rage whole. The proficiency flag (`:16`) removes the barbarian's proficiencies with no replaced row, and Class Skills (`:48`) isn't among the mapper's additions. |
| Deepwater Rager     | No allowed text names what any feature replaces: the capture has no Legacy of the First World page, and PCGen's DESCs (`lotfw_abilities_class.lst:30-34`) are silent. The only evidence is the FACT flags the mapper read (`:28`).                                                                                                                                       |
| Mooncursed          | The text and the mapper disagree. Shifting Rage "alters rage" (`ha_abilities_class.lst:47`), but the mapper replaces Rage, Greater Rage and Mighty Rage whole, and no feature names what Hybrid Rage replaces. The capture has no Horror Adventures page.                                                                                                                |

## What the sheet computes

Nothing new. No record gives a number: every feature keeps `modifiers: []`, and no root has a record. Of the replaced Barbarian rows only Trap Sense carries modifiers, two situational lines against traps, so no unconditional total changes. Fast Movement and Damage Reduction carry no speed or rule value in any released row yet. At Barbarian 1, 4 and 8 the archetypes change only which rows show and which go dormant. Some features carry numbers that stay prose:

- Invulnerability's DR/— equal to half the barbarian level, from 2nd level (1/— at 2, 2/— at 4, 4/— at 8).
- Extreme Endurance's fire or cold resistance (1 point for every three levels beyond 3rd).
- Pit Fighter's insight bonus on chosen maneuvers and Savage Grapple's bonus to CMD.
- Skilled Thrower's +10 feet of thrown range increment.
- Fast Rider's +10 feet to the mount's speed, and Bestial Mount's animal companion: no companion rule is keyed on it, unlike the Mad Dog's War Beast.
- Elemental Fury's and Raging Drunk's rounds of rage.

So the sheet won't show an invulnerable rager's own damage reduction. A later rule value record could bind it.

## Tests

[`archetype-structures-662.test.ts`](../../tests/catalog/archetype-structures-662.test.ts) runs on the pinned tree from one table: each archetype's reviewed replacements, and each feature's level, source hash and PRD line.

- The committed records have exactly these fields, items and hashes, and all ten carry the record step's receipt. Each description is read from the pinned PRD page. The four left-out archetypes have no record.
- As committed, every gate passes and the records apply. All 16 rows are admitted under #227 on PZO1115, and no other key changes. Each archetype replaces exactly its reviewed rows, whole, and adds its features at their levels.
- Drafted in memory, no emitted key changes state against the overlay without the records. Every feature is held on structure, and the roots are omitted behind their features.

<!-- prep:shared-store-count -->
New shared-store files (`tests/fixtures/pinned/`), counted by prep after the rebase onto `f33650f9`: **0**.
<!-- /prep:shared-store-count -->
