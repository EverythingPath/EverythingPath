# Party structures: Bladebound and Dragon Disciple (#554, #676)

A #716 structure batch for the party (batch name `party-curation-3`; discriminator 554, the lowest owning curation issue: [#554](https://github.com/AndreasUnunger/EverythingPath/issues/554) owns Dragon Disciple, [#676](https://github.com/AndreasUnunger/EverythingPath/issues/676) the magus Archetypes). The import emits Bladebound behind `--pcgen` since #716 E1 and Dragon Disciple with its eleven features since D1 ([prestige classes](prestige-and-unchained.md#imported-prestige-classes-dragon-disciple-716-d1)), every row held on the structure gate. This batch writes the fifteen structure records that settle both gates, in `scripts/catalog/reviewed-curation.json` `structures`, written `drafted`. Only the orchestrator's record step checks them through a review receipt ([curation](curation.md#structure-records-716)); it checked all fifteen on a captured review, run `t3-review-3cb19584e17c9cf81d91f134748afd581a694b4c3e40263b567174d1a5c08638`.

Sources: PCGen at `25523dbc` (`roleplaying_game/ultimate_magic/um_abilities_class.lst`, `roleplaying_game/core_rulebook/cr_abilities_class.lst` and `cr_classes.lst`), the PRD capture `prd-2026-10-20` (`ultimateMagic/spellcastingClassOptions/magus.html`, `coreRulebook/prestigeClasses/dragonDisciple.html`) and Foundry pf1 v11.11 for the replaced rows. Each `sourceSha256` is the one the structure report of a `--pcgen` preview on the base `f2de0758` gives.

## The records

| Entry                                                                                                                    | Fields                                                                                                                                                                  | Settles                                                                 |
| ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `everythingpath/magus-bladebound`                                                                                        | `detail.replaces`: Magus Arcana (`pf1/HJ2vLLDYkihPxFkD`) in part at 3, Arcane Pool (`pf1/mpe3JHJMINddqLWr`) whole at 1, the mapper's rows                               | `unmatchedReplacement` `unknown:CFArcana`, `conflict` `stackingGuard#2` |
| `…-magus-bladebound-arcane-pool`                                                                                         | `description` (magus.html:368)                                                                                                                                          | its owned feature                                                       |
| `…-magus-bladebound-black-blade`                                                                                         | `description` (magus.html:367)                                                                                                                                          | its owned feature                                                       |
| `everythingpath/dragon-disciple`                                                                                         | `description` (dragonDisciple.html:347-348); `prerequisites`                                                                                                            | its four `uncheckedRequirement` items                                   |
| `…-weapon-and-armor-proficiency`, `…-spells-per-day`                                                                     | `noMechanics`                                                                                                                                                           | each its owned feature                                                  |
| `…-natural-armor-increase`                                                                                               | `description` (:379); `modifiers`: untyped `ac.natural` `min(3, floor((@classLevel.dragonDisciple + 2) / 3))`                                                           | its owned feature                                                       |
| `…-ability-boost`                                                                                                        | `description` (:380); `modifiers`: untyped `ability.str` `2 * min(2, floor(L / 2))`, `ability.con` `2 * min(1, floor(L / 6))`, `ability.int` `2 * min(1, floor(L / 8))` | its owned feature                                                       |
| `…-blood-of-dragons`, `…-bloodline-feat`, `…-dragon-bite`, `…-breath-weapon`, `…-blindsense`, `…-dragon-form`, `…-wings` | `description` (:378, :381-387)                                                                                                                                          | each its owned feature                                                  |

Each description is the PRD paragraph word for word, without its heading and with its links as plain text; two-paragraph texts are joined by a space, as PCGen's Blindsense is.

- **Bladebound.** The PRD says the bladebound pool "changes the Arcane Pool class feature and replaces the magus arcana gained at 3rd level" (magus.html:368), and the `.MOD` line sets `Magus_CF_Arcana3` and `Magus_CF_ArcanePool` (`um_abilities_class.lst:2678`). The TYPE token `MagusCFArcana` (`:1288`) names no further row, so the record re-affirms the mapper's two rows. The pool's size (1/3 level, minimum 1, plus Intelligence) and the black blade's statistics stay prose; the black blade as a weapon is an open owner question (G3) and isn't modelled.
- **Dragon Disciple's prerequisites**, in the PRD's order (dragonDisciple.html:353-357): `unchecked` "not: race: type Dragon" and PCGen's "not: template: Half Dragon" (the schema has no negated race or template atom); the mapper's `skillRanks` Knowledge (arcana) 5; `unchecked` "speaks Draconic" (no language atom); **`canCast` 1st-level arcane, checked**; and one `unchecked` clause, "casts those arcane spells without preparing them; with sorcerer levels, has the draconic bloodline": `canCast` has no without-preparation flag and no atom reads a bloodline. Every branch of PCGen's PREMULT (`cr_classes.lst:381`) needs arcane casting.
- **Natural Armor Increase** is +1 at 1st, 4th and 7th level (the table; PCGen `cr_abilities_class.lst:2965`). It is untyped on `ac.natural` because the rulebook says "These armor bonuses stack." (:379; PCGen `TYPE=NaturalArmor.STACK`).
- **Ability Boost** is Str +2 at 2nd and 4th, Con +2 at 6th and Int +2 at 8th level (the table; PCGen `:2966`), untyped: "These increases stack and are gained as if through level advancement." (:380).

## Owner questions (not encoded)

1. Do a dragon disciple's levels add to a bloodrager's bloodline? The rulebook names sorcerer levels (:378); PCGen stacks them (`acg_abilities_class.lst:381-383`).
2. Which bonus-feat list does a bloodrager's Bloodline Feat use? The rulebook names the draconic bloodline's (:381); PCGen the bloodrager's (`acg_abilities_class.lst:378`).

So Blood of Dragons and Bloodline Feat carry their description only, with no `picksByLevel` and no stacking mechanic.

## What the sheet computes

At Dragon Disciple 3: natural armor +1 and Str +2; Con and Int nothing. No other record gives a number. A Bloodrager 4 meets the checked `canCast` atom: the bloodrager's `spontaneous-low` table gives a 1st-level slot at 4th level.

## After the record step

The record step checked the fifteen records (run `t3-review-3cb19584…`), so both structure gates pass. All twelve Dragon Disciple rows are admitted under #227 (declared book PZO1110), and Bladebound and its two features on PZO1117. Bladebound replaces the Magus's Arcane Pool (`pf1/mpe3JHJMINddqLWr`), which is admitted on its confirmed, content-bound assessment ([party-data-539, K1](party-data-539.md#k1-arcane-pool-magus-character-8-admitted)), so no row is omitted with it.

## Tests

[`party-structures-554.test.ts`](../../tests/catalog/party-structures-554.test.ts) runs on the pinned tree:

- The committed records have exactly these fields, items and hashes.
- With the committed, checked records and the committed attribution, both gates pass, the thirteen field records apply and the outcomes are as above.
- The modifiers give the table's values at levels 1-10.
- The two owner-question features carry no mechanics.
- The committed records are checked on the record step's receipt; drafted again in memory, every row is held on structure. This is the only case that depends on the records' status.

<!-- prep:shared-store-count -->
New shared-store files (`tests/fixtures/pinned/`), counted by prep after the rebase onto `cab8228f`: **0**.
<!-- /prep:shared-store-count -->
