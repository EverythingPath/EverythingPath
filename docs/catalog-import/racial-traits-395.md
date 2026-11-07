# Racial traits #395: pf1-content pf-racial-traits batch 9

**#740 author update (drafted, 2026-10-25):** Orc Atavism now retains the Orc
equivalence its pinned text states when it replaces Orc Blood. Its full-context
fixture and unresolved binding are refreshed, with the old binding preserved
in the inventory. Source, complete-body and notice holds, including the
unverified page citation and Ferocity link gap, remain unchanged. See the
[race repair record](race-import-740.md); the original review below is retained.

Reviewed by **Opus (AI curator) for the owner**, 2026-10-20.

Exactly the issue's 100 ordered, unique keys were reviewed: **0 admitted, 82 specifically held, 0 dependent omissions, 0 whole-entry unsupported/prose-only dispositions, 18 exclusions, 0 record-level 3.5 holds**. The exclusions are 9 Foundry `!folders!` records, which the importer's folder contract leaves out of the Catalog Entries (PRD Decision 17), and 9 records in the Advanced Race Guide Race Builder subtree, which the import contract excludes by folder ancestry ([README](README.md), explicit exclusions) and the [Racial Trait contract](../character-sheet/racial-traits.md) puts out of scope. No candidate carries a `3.5` tag. The 82 in-scope records are 32 standard racial traits (6 of them in flat race folders), 32 alternates, 7 Subrace Standard heritage parts and 11 Subraces-folder heritages, ethnicities or racial subtypes.

The [machine-readable inventory and evidence](../../scripts/catalog/legal/racial-traits-395.json) records, per key, the complete pinned body and inert fields with their source hash and cited sources; the PCGen race-ability rows, PRD Advanced Race Guide paragraphs, leads and rejected rows; the inherited-rule notices with their evidence, the linked bodies and the unresolved origins; the importer's reading of race, standard flag and replacements; every checked curation record, source discrepancies and calculation gaps; and the current assessment binding and mapped facts. This report summarizes them and does not repeat the evidence.

## #328 S4-A launch update

Reviewed 2026-11-01 by **Sol (AI curator) for the owner** ([races-328.md](races-328.md#s4-a-launch-human-dwarf-and-half-orc)). The launch review admits 1 standard racial trait of Human, Dwarf and Half-Orc with confirmed, content-bound assessments; counts are now **1 admitted, 81 held**, with 18 exclusions unchanged. The earlier Opus review of each admitted row stays in its `assessmentHistory`; every other candidate keeps its review and holds.

- **Stability (Dwarf)** (`pf1-content/T4PaZ33R29gTAFaT`): matches the PRD ARG paragraph (`advancedRaceGuide/coreRaces/dwarves.html:368`) apart from "receive" for "gain"; PCGen's Core Essentials row (`dwarf/dwarf_abilities_race.lst:26`). Its Modifiers are +4 racial CMD in the shared Situations bullRushGround and tripGround, re-homed from the Dwarf's checked note record. Required notices: PZO9280, PZO1121, PZO1110.

Each admitted row's whole-content hold ("Book PDFs unavailable") is superseded by this comparison, and it records no notice hold: PZO1110 is reviewed, PZO1121's Registry hold is cleared (owner, 2026-10-30), and PZO9280's reviewed confirmation waives `racial-traits-395-notice-PZO9280-complete-chain`. The batch's `noticeRequirements` rows keep these keys as history. Content fingerprints are unchanged (the imported entries are identical); only the status, rationale, evidence and notice bindings move.

Tests: `racial-traits-395.test.ts` checks the admitted rows with the held ones (`assessedTraits` in the fixture), expects them admitted by the committed gate and records no hold for them.

## Family rulings applied

This batch follows the #387 rulings Sol approved for the family:

1. **Every in-scope record is held** with a whole-content hold: the race records stay held (#328), every cited book's notice chain is held (41 batch notice holds, registered in `held-notices.json`), and no book PDFs are available.
2. **Race abilities.** Every record requires the books its pinned race record cites. Orc Atavism also requires Inner Sea Races (PZO9280): PCGen's only row for the body is Inner Sea Races p.212 (see Notable cases), as #394 did for Skilled (Kitsune). Mostly Human (Suli) records the Human race's books (the body counts the character as humanoid (human)); Lost Promise records the tiefling race's books and ARG for the Maw or Claw trait it grants.
3. **Alternate framework.** Every alternate records the APG alternate racial trait rule (PZO1115, `apg_abilities_race.lst:86`).
4. **Monster abilities** take the earliest book the pinned Universal Monster Rules page lists: darkvision PZO1127; low-light vision, natural attacks, incorporeal, spell resistance, energy resistance, fast healing and ferocity PZO1112; see in darkness PZO1116.
5. **Creature types** (the humanoid, outsider, native, elf, reptilian, catfolk and human types and subtypes, the animal and magical beast types, and evil outsiders) stay named unresolved origins.
6. **PZO1131** for Unchained action-cost metadata anywhere in the bound closure: 26 records (17 on their own actions, 21 through bound bodies, 12 both). The three heritages with a curated ability line reach their race's standard traits through the race's ability score trait, and so the race's own spell-like ability actions.
7. **Comparisons.** PCGen race-ability rows from a pinned book are the `comparison`; Core Essentials support rows (no SOURCELONG book) are leads whose book is not required. 24 records carry a PRD `prdComparison` from the pinned capture (13 match word for word). Subrace Standard parts take no PRD paragraph (the paragraph is the parent's trait).
8. **Description pass.** Every in-scope record has a checked description record: its reviewed Modifiers plus one entry-level Note with the body (`@Distance` read as feet, `@Toggle` buff controls and empty "Related buff" lines removed).
9. **Racial bonuses from distinct Sources stack**; the resolver test shows Caretaker and Urbanite giving +4 racial Sense Motive together on a hunch. The #735 admission policies don't bear on this batch (no spells or CRB feats).

## Dispositions

| Key                            | Name                                                   | Kind             | Disposition                                                      |
| ------------------------------ | ------------------------------------------------------ | ---------------- | ---------------------------------------------------------------- |
| `pf1-content/R7UDXRs0E5klyzCY` | Garuda-Blooded (Plumekith)                             | subrace          | held: `racial-traits-395-whole-content-R7UDXRs0E5klyzCY`         |
| `pf1-content/RFh1QM9BhhoOEzaH` | Darkvision (Sylph)                                     | standard         | held: `racial-traits-395-whole-content-RFh1QM9BhhoOEzaH`         |
| `pf1-content/RFndBrivFazRYZLp` | See in Darkness                                        | standard         | held: `racial-traits-395-whole-content-RFndBrivFazRYZLp`         |
| `pf1-content/RI0jgkyo4Dhyk5zs` | Hag Racial Trait (Changeling - Virga May)              | subrace standard | held: `racial-traits-395-whole-content-RI0jgkyo4Dhyk5zs`         |
| `pf1-content/RKCOV7Roq9MdxLZ5` | Faerie Dragon Magic                                    | alternate        | held: `racial-traits-395-whole-content-RKCOV7Roq9MdxLZ5`         |
| `pf1-content/RKMn7UZjPlPPU4Nv` | Perfect                                                | alternate        | held: `racial-traits-395-whole-content-RKMn7UZjPlPPU4Nv`         |
| `pf1-content/RScQcZuZDW9bGV8c` | Elemental Assault                                      | standard         | held: `racial-traits-395-whole-content-RScQcZuZDW9bGV8c`         |
| `pf1-content/RU1pTqBVHbGN6X7E` | Wyrwood                                                | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/RX8XCS2CoFhYwiBG` | Cold-Honed                                             | alternate        | held: `racial-traits-395-whole-content-RX8XCS2CoFhYwiBG`         |
| `pf1-content/RXEGl40emjun7g7s` | Slow Speed (Triton)                                    | standard         | held: `racial-traits-395-whole-content-RXEGl40emjun7g7s`         |
| `pf1-content/RXJPpac5E8PiR8Qt` | Alternate                                              | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/RXUzMQm7nOijW9zk` | Champion of Dark Powers                                | alternate        | held: `racial-traits-395-whole-content-RXUzMQm7nOijW9zk`         |
| `pf1-content/RYyMubzEGeBaS6Q5` | Elf                                                    | standard         | held: `racial-traits-395-whole-content-RYyMubzEGeBaS6Q5`         |
| `pf1-content/Ral2Kd4diC6McjqC` | Joyous Companion                                       | alternate        | held: `racial-traits-395-whole-content-Ral2Kd4diC6McjqC`         |
| `pf1-content/RbJrsAMEPJMnBNnR` | Flight (Syrinx)                                        | standard         | held: `racial-traits-395-whole-content-RbJrsAMEPJMnBNnR`         |
| `pf1-content/RciaNbMBeBVfJMjZ` | Energy Strike (Acid)                                   | alternate        | held: `racial-traits-395-whole-content-RciaNbMBeBVfJMjZ`         |
| `pf1-content/RfPJoszfAEHlG3wH` | Caretaker                                              | alternate        | held: `racial-traits-395-whole-content-RfPJoszfAEHlG3wH`         |
| `pf1-content/RhI2edtj26rk0mWy` | Native Outsider (Suli)                                 | standard         | held: `racial-traits-395-whole-content-RhI2edtj26rk0mWy`         |
| `pf1-content/RioelvLpNPwWWF7b` | Immortal                                               | standard         | held: `racial-traits-395-whole-content-RioelvLpNPwWWF7b`         |
| `pf1-content/Rj3X80eJLvjX0SpQ` | Blood-Born (Veil May)                                  | subrace          | held: `racial-traits-395-whole-content-Rj3X80eJLvjX0SpQ`         |
| `pf1-content/Rj8fmTrCA50gRmxP` | Eternal Hope                                           | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/RjUGliORGeNs7Vsq` | Languages (Kasatha)                                    | standard         | held: `racial-traits-395-whole-content-RjUGliORGeNs7Vsq`         |
| `pf1-content/Rjuh4Wb7NFEZVEsP` | Skill Bonus                                            | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/RleWFHpXOUaneeqN` | Alternate Spell-Like Ability (Skinwalker - Seascarred) | subrace standard | held: `racial-traits-395-whole-content-RleWFHpXOUaneeqN`         |
| `pf1-content/RpWzdpSJZcaBAvhn` | Spell-Like Ability (Sylph - Smokesoul)                 | subrace standard | held: `racial-traits-395-whole-content-RpWzdpSJZcaBAvhn`         |
| `pf1-content/Rs1od0FyIEIDCMrC` | Being of Ib                                            | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/RsQ6g0STYFLSSpm5` | Languages (Gillman)                                    | standard         | held: `racial-traits-395-whole-content-RsQ6g0STYFLSSpm5`         |
| `pf1-content/Rx1ayk8e3zpDoslL` | Forge-Hardened                                         | alternate        | held: `racial-traits-395-whole-content-Rx1ayk8e3zpDoslL`         |
| `pf1-content/RyZzO5ouGh5GzvjZ` | Spell-Like Ability (Ifrit)                             | standard         | held: `racial-traits-395-whole-content-RyZzO5ouGh5GzvjZ`         |
| `pf1-content/RypMqnONgwnba8aC` | Defensive Training (Grippli)                           | alternate        | held: `racial-traits-395-whole-content-RypMqnONgwnba8aC`         |
| `pf1-content/RzalfyOzV6EaGRvl` | Alternate                                              | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/S0kzNQEZQOJswP6b` | Languages (Wyvaran)                                    | standard         | held: `racial-traits-395-whole-content-S0kzNQEZQOJswP6b`         |
| `pf1-content/S2NJixZYq3fBtPig` | Arctic Elf                                             | subrace          | held: `racial-traits-395-whole-content-S2NJixZYq3fBtPig`         |
| `pf1-content/S2fAbQom6ogn4gh9` | Wereraptor-Kin (Aerieborn)                             | subrace          | held: `racial-traits-395-whole-content-S2fAbQom6ogn4gh9`         |
| `pf1-content/S54OGr1E0tI6V4jQ` | Imperious Human                                        | subrace          | held: `racial-traits-395-whole-content-S54OGr1E0tI6V4jQ`         |
| `pf1-content/SBXz9pTH8SkAw1nn` | Stubborn                                               | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/SCPbTbMBMkwN2Uba` | Hag Racial Trait (Changeling - Hulking Changeling)     | standard         | held: `racial-traits-395-whole-content-SCPbTbMBMkwN2Uba`         |
| `pf1-content/SFD4dGofogr1c1S9` | Nosferatu-Born (Ancient-Born)                          | subrace          | held: `racial-traits-395-whole-content-SFD4dGofogr1c1S9`         |
| `pf1-content/SJOcTJ2MQI3AoMeh` | Orc Atavism                                            | alternate        | held: `racial-traits-395-whole-content-SJOcTJ2MQI3AoMeh`         |
| `pf1-content/SL536HxlnXKaBne1` | Piety                                                  | alternate        | held: `racial-traits-395-whole-content-SL536HxlnXKaBne1`         |
| `pf1-content/SL6K0vushMwPUDxn` | Gifted Linguist                                        | standard         | held: `racial-traits-395-whole-content-SL6K0vushMwPUDxn`         |
| `pf1-content/SLZIXlmsbFFwnRo4` | Shadowhunter (Dwarf)                                   | alternate        | held: `racial-traits-395-whole-content-SLZIXlmsbFFwnRo4`         |
| `pf1-content/SNbWlc13JTMMG3qd` | Pass without Trace                                     | standard         | held: `racial-traits-395-whole-content-SNbWlc13JTMMG3qd`         |
| `pf1-content/SQZL2A9E62X4Xn7i` | Duplicitous                                            | alternate        | held: `racial-traits-395-whole-content-SQZL2A9E62X4Xn7i`         |
| `pf1-content/SRBfqkzIldwETAHB` | Dual Talent                                            | alternate        | held: `racial-traits-395-whole-content-SRBfqkzIldwETAHB`         |
| `pf1-content/SSksShaDho0IcKCO` | Natural Weapons (Kitsune)                              | standard         | held: `racial-traits-395-whole-content-SSksShaDho0IcKCO`         |
| `pf1-content/STxquJXw503JM504` | Alternate                                              | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/SWGQSYy6SVgjeVyj` | Efreeti Magic                                          | alternate        | held: `racial-traits-395-whole-content-SWGQSYy6SVgjeVyj`         |
| `pf1-content/SX8UhZozeKaNJ7mS` | Reptilian (Kobold)                                     | standard         | held: `racial-traits-395-whole-content-SX8UhZozeKaNJ7mS`         |
| `pf1-content/SXQa7R5j1fC4dn52` | Standard                                               | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/ScSKrCuWBDqz3zQe` | Languages (Being of Ib)                                | standard         | held: `racial-traits-395-whole-content-ScSKrCuWBDqz3zQe`         |
| `pf1-content/SfGzMso5dZ7Bg6uA` | Skilled (Goblin)                                       | standard         | held: `racial-traits-395-whole-content-SfGzMso5dZ7Bg6uA`         |
| `pf1-content/ShvaEnYXmYs0vV6h` | Desert Dwarves                                         | subrace          | held: `racial-traits-395-whole-content-ShvaEnYXmYs0vV6h`         |
| `pf1-content/SiZwOvv9Vz2OluRK` | Skilled (Aasimar)                                      | standard         | held: `racial-traits-395-whole-content-SiZwOvv9Vz2OluRK`         |
| `pf1-content/SjQ9aL7VVjUC2uxa` | Natural Armor (Deep One Hybrid)                        | standard         | held: `racial-traits-395-whole-content-SjQ9aL7VVjUC2uxa`         |
| `pf1-content/SlDu4fhDm9imymQ9` | Natural Magic                                          | standard         | held: `racial-traits-395-whole-content-SlDu4fhDm9imymQ9`         |
| `pf1-content/SnhFeGgq8qpGMVDh` | Celestial Crusader                                     | alternate        | held: `racial-traits-395-whole-content-SnhFeGgq8qpGMVDh`         |
| `pf1-content/So4VUgnLbrO5TiME` | Hold Breath                                            | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/Son5Vq5HQepEZIzC` | Hag Racial Trait (Changeling - Snow May)               | subrace standard | held: `racial-traits-395-whole-content-Son5Vq5HQepEZIzC`         |
| `pf1-content/SpAdy1qMBxoxTQLN` | Mostly Human (Suli)                                    | alternate        | held: `racial-traits-395-whole-content-SpAdy1qMBxoxTQLN`         |
| `pf1-content/SqRzbbqegU7NiqI0` | Magical Taskmaster                                     | alternate        | held: `racial-traits-395-whole-content-SqRzbbqegU7NiqI0`         |
| `pf1-content/Sqo8OXSw1NiFWFKB` | Dusksight (Half-Elf)                                   | alternate        | held: `racial-traits-395-whole-content-Sqo8OXSw1NiFWFKB`         |
| `pf1-content/SquudHtPDYuuxjEy` | Darkvision (Wyrwood)                                   | standard         | held: `racial-traits-395-whole-content-SquudHtPDYuuxjEy`         |
| `pf1-content/Sr021S4goMyRlaoQ` | Low-Light Vision (Gathlain)                            | standard         | held: `racial-traits-395-whole-content-Sr021S4goMyRlaoQ`         |
| `pf1-content/StOjhD9mqHZqSELy` | Desert Runner                                          | alternate        | held: `racial-traits-395-whole-content-StOjhD9mqHZqSELy`         |
| `pf1-content/SyXfxr53mzenpNu5` | Urbanite                                               | alternate        | held: `racial-traits-395-whole-content-SyXfxr53mzenpNu5`         |
| `pf1-content/SzpFPEuTtwLdI1jd` | Catfolk                                                | standard         | held: `racial-traits-395-whole-content-SzpFPEuTtwLdI1jd`         |
| `pf1-content/T4PaZ33R29gTAFaT` | Stability (Dwarf)                                      | standard         | held: `racial-traits-395-whole-content-T4PaZ33R29gTAFaT`         |
| `pf1-content/T5KckpG6YDbEJlZA` | Heroic                                                 | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/T7YEu4upBsXe3qSs` | Seducer                                                | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/T7dJVz4m8zpUQERB` | Mountaineer                                            | alternate        | held: `racial-traits-395-whole-content-T7dJVz4m8zpUQERB`         |
| `pf1-content/T88sJDx0MPvvjKtb` | Nimbus of Vitality                                     | alternate        | held: `racial-traits-395-whole-content-T88sJDx0MPvvjKtb`         |
| `pf1-content/T8sGSQi3ZjGk5lhB` | Gift of Tongues                                        | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/TCis4lfk8t4e82nQ` | Darkvision (Sahuagin)                                  | standard         | held: `racial-traits-395-whole-content-TCis4lfk8t4e82nQ`         |
| `pf1-content/TJSvxFkclNU1GlEL` | Languages (Sylph)                                      | standard         | held: `racial-traits-395-whole-content-TJSvxFkclNU1GlEL`         |
| `pf1-content/TJfxEOgpWyjJcZJJ` | Spell-Like Ability (Ifrit - Sunsoul)                   | subrace standard | held: `racial-traits-395-whole-content-TJfxEOgpWyjJcZJJ`         |
| `pf1-content/TLsWrSNiNy9BIcob` | Lightbringer                                           | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/TMYYCMogKs454s9n` | Lifebound                                              | standard         | held: `racial-traits-395-whole-content-TMYYCMogKs454s9n`         |
| `pf1-content/TNbX1iRPplCIvhdO` | Spell-Like Ability (Tiefling - Pitborn)                | subrace standard | held: `racial-traits-395-whole-content-TNbX1iRPplCIvhdO`         |
| `pf1-content/TOl6oVYoCVFP8YbS` | Metal Affinity (Oread - Ironsoul)                      | subrace standard | held: `racial-traits-395-whole-content-TOl6oVYoCVFP8YbS`         |
| `pf1-content/TQFXEnSgr6JENkxU` | Languages (Cecaelia)                                   | standard         | held: `racial-traits-395-whole-content-TQFXEnSgr6JENkxU`         |
| `pf1-content/TQUVpXNu7bAbTEAy` | Bond to the Land                                       | alternate        | held: `racial-traits-395-whole-content-TQUVpXNu7bAbTEAy`         |
| `pf1-content/TQxW5qAgBZQbiyTH` | Healthy                                                | alternate        | held: `racial-traits-395-whole-content-TQxW5qAgBZQbiyTH`         |
| `pf1-content/TRCZ20ubvIc5MASZ` | Outsear Sahuagin                                       | subrace          | held: `racial-traits-395-whole-content-TRCZ20ubvIc5MASZ`         |
| `pf1-content/TSEP7Z6CFb3Clbjh` | Lost Promise                                           | alternate        | held: `racial-traits-395-whole-content-TSEP7Z6CFb3Clbjh`         |
| `pf1-content/Tb0QQbLa6WuRfUzG` | Aquatic Mastery                                        | alternate        | held: `racial-traits-395-whole-content-Tb0QQbLa6WuRfUzG`         |
| `pf1-content/TbnWNAk91q2wgqCP` | Angel-Blooded (Angelkin)                               | subrace          | held: `racial-traits-395-whole-content-TbnWNAk91q2wgqCP`         |
| `pf1-content/TeyAhqhhsw6pQAUV` | Voiceless                                              | standard         | held: `racial-traits-395-whole-content-TeyAhqhhsw6pQAUV`         |
| `pf1-content/ThYRR9pEaS3Cynbf` | Darkvision, 120 feet                                   | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/ThceEvBPQBpGFGS0` | Mordant Envoy                                          | alternate        | held: `racial-traits-395-whole-content-ThceEvBPQBpGFGS0`         |
| `pf1-content/TkLZDtMlHbg0Ljlt` | Prehensile Tail (Tiefling)                             | alternate        | held: `racial-traits-395-whole-content-TkLZDtMlHbg0Ljlt`         |
| `pf1-content/To9CTavwqfCUqpuZ` | Ash-Born (Hearth May)                                  | subrace          | held: `racial-traits-395-whole-content-To9CTavwqfCUqpuZ`         |
| `pf1-content/TqBOLc2wmCF0ikFl` | Trailblazer                                            | subrace          | held: `racial-traits-395-whole-content-TqBOLc2wmCF0ikFl`         |
| `pf1-content/TqLGCRRZcEjDtZvM` | Cheek Pouches                                          | alternate        | held: `racial-traits-395-whole-content-TqLGCRRZcEjDtZvM`         |
| `pf1-content/Tt3r64jgYimPthNv` | Standard                                               | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/TwqzAm7tIeUpqdPI` | Risky Troublemaker                                     | alternate        | held: `racial-traits-395-whole-content-TwqzAm7tIeUpqdPI`         |
| `pf1-content/U0rMPYJhgW4Fg6WL` | Bandy-Legged                                           | alternate        | held: `racial-traits-395-whole-content-U0rMPYJhgW4Fg6WL`         |
| `pf1-content/U1WKFunClHJkc7vF` | Swordtrained                                           | standard         | held: `racial-traits-395-whole-content-U1WKFunClHJkc7vF`         |
| `pf1-content/U1wK0c0t4RdHqzbU` | Aasimar                                                | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/U6bKQWjBdxOE4Xof` | Primitive Human                                        | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |

## Notable cases

- **Heritage ability lines curated (#387 to #393 precedent).** Garuda-Blooded (Plumekith) (+2 Dex, +2 Wis), Nosferatu-Born (Ancient-Born) (+2 Str, +2 Wis, -2 Con) and Wereraptor-Kin (Aerieborn) (+2 Wis, -2 Cha) are `reviewedAbilityLineSubraces` heritages whose pinned line agrees with PCGen's Core Essentials "<Heritage> ~ Ability Scores" row; each line is racial ability Modifiers, so "Base Statistics" resolves to the race's ability score trait, which goes dormant. Wereraptor-Kin's "+2 Dex while shapechanged" belongs to its Change Shape part (#393).
- **Angel-Blooded (Angelkin)'s line stays outstanding.** Its line also agrees with PCGen, but `race-ability-721` pins Angel-Blooded as its prose-only example (unresolved "Base Statistics" with the prose reason) in a fixture tree that carries only this heritage, and earlier batches' fixture directories stay unchanged. The curation is listed for review as a #721 follow-up; it is a calculation gap, not a hold.
- **Orc Atavism's citation, checked against pinned evidence** (run notes, #719 to #721). The record cites PZO1121 p.212, but PCGen files the body only in Inner Sea Races (`isr_abilities_race.lst:152`, SOURCEPAGE p.212), PCGen's ARG data has no Orc Atavism row and the PRD ARG half-orc page has no paragraph for it. The cited code stays required, PZO9280 is added from the PCGen row, and the citation is listed for review. Orc Atavism also replaces Orc Blood, the reviewed counts-as rule: with it the sheet counts the character as neither human nor orc, where the body says half-orc and orc. This is the run notes' untested case "replacing a counts-as trait"; it stays outstanding and is listed for review.
- **Latent overlap: Lifebound.** The Samsaran race's checked #328 description record already gives the samsaran +2 racial saves against death and negative energy effects and on Fortitude saves to remove negative levels. Racial bonuses from distinct Sources stack, so Lifebound's three Foundry notes are explicit covered/no-output records.
- **Reviewed Modifiers where raw changes don't map.** Faerie Dragon Magic's +1 illusion DC (`spellDC`, school illusion) and Mordant Envoy's +1 transmutation caster level (`casterLevel`, school transmutation), both untyped as the bodies state.
- **Situational bonuses** (manual Situations): Perfect, Cold-Honed, Piety (one "call out to your deity" Situation on attacks, saves and skills; ability checks stay a Note), Shadowhunter (Dwarf), Urbanite, Desert Runner, Bond to the Land (dodge on `ac`), Healthy (disease), Aquatic Mastery and Champion of Dark Powers (descriptor DCs), Forge-Hardened, Defensive Training (Grippli) (dodge on `ac`), Celestial Crusader (insight on attacks and `ac`, identify bonuses), Hag Racial Trait (Changeling - Snow May) and Bandy-Legged (CMD; the body's "on solid ground" doesn't match the shared "standing on the ground" Situations exactly, so they stay local).
- **Shared Situations** only where the condition matches exactly: poison (Healthy).
- **Standard traits of #719 races stay without reviewed Modifiers:** Natural Weapons (Kitsune), Natural Magic, Elf (Drow), Languages (Cecaelia) and Hag Racial Trait (Changeling - Hulking Changeling), whose +1 racial melee damage stays readable because the importer files every hag option as a standard trait (#391 Crawling Skin, #394 Green Widow). Stability (Dwarf) is covered by the Dwarf race's re-homed note record. Dual Talent stays unresolved and without Modifiers, as `racial-traits-719` pins it.
- **Covered/no-output records:** Cold-Honed's Acrobatics note (the entry-level movement Note states it), Shadowhunter (Dwarf)'s ranged note (the attack Note covers every attack), Desert Runner's and Lifebound's `conChecks` notes (drafted onto concentration; Constitution checks have no statistic), and Lifebound's two save notes (latent overlap above).
- **Inherited rules beyond the race:** Joyous Companion requires Ultimate Magic (PZO1117) for the emotion descriptor the body cites with a "UM" superscript; Metal Affinity (Oread - Ironsoul) requires the UM shaitan bloodline and the APG Metal subdomain; Voiceless requires Occult Adventures (PZO1132) for thought components; Lost Promise requires the tiefling race's books and ARG for Maw or Claw. Linked bodies' books are required throughout (spells, Favored Terrains, the Snowborn and Spireborn subtypes).
- **Listed for review:** Skilled (Aasimar) cites PZO1121 twice (p.238 and p.85; p.238 is the Inner Sea Races aasimar page); Champion of Dark Powers "modifies" Spell Resistance (Drow), which the importer resolves as a replacement; Mostly Human (Suli) and Magical Taskmaster headers name traits the race doesn't have (see Importer gaps); Reptilian (Kobold) cites PZO9432 with page 0.
- **Not modeled, listed:** senses, speeds, spell-like abilities and other actions, natural attacks, energy resistance and spell resistance, creature types, class-skill grants, languages, aging, wind effects, spell failure, and Swordtrained's elven curve blade (an outstanding proficiency fact; the other eleven weapons map from `weaponProf`).

## Importer and data gaps

- **Unresolved link to an unassigned pack (own entry; neither #738 nor #739).** Orc Atavism links pf1-content's `pf-universal-monster-rules` Ferocity record (`pf1-content/itiLDlB5BHlUB8os`, no cited source). That pack stays unassigned, so the importer strips the link and the record fails admission with "Broken structure or reference: unresolved imported reference." in any preview; the batch test expects exactly that failure. The ferocity rule is recorded as an inherited notice from the pinned pf1 Universal Monster Rules journal (PZO1112).
- **Unresolved replaced names (own entry; neither #738 nor #739).** Mostly Human (Suli)'s header names "Languages, Subtype, Type" (the suli's records are "Languages (Suli)" and "Native Outsider (Suli)", and the body _alters_ them); Magical Taskmaster's names "Invisibility Spell-Like Ability" (the duergar's record is "Spell-Like Abilities (Duergar - Invisibility)"). With any unmatched name the importer resolves none (#304). Metal Affinity (Oread - Ironsoul), a Subrace Standard part, names itself and finds no oread trait to replace.
- The racial subtypes, ethnicities and changeling heritages (Arctic Elf, Imperious Human, Trailblazer, Desert Dwarves, Outsear Sahuagin, Blood-Born (Veil May), Ash-Born (Hearth May)) and Angel-Blooded keep "Base Statistics" unmatched, as designed.
- The raw upstream keys in `mapRacialTrait` caused no reference failure: in the full preview the only batch failure is Orc Atavism's link gap above; the bounded preview's failures are links and replacements outside the selection. No journal-page link and no missing pf-items reference are in this batch. Untested cases from the run notes: replacing a counts-as trait (Orc Atavism, above); none of the others (no `local/` heritage resolution beyond the race ability traits, no curated Modifier triggering replacement other than the three heritage ability lines, no multi-race "Base Statistics" folder).

## Outstanding mechanics

Each record lists its calculation gaps in `mechanicsReview.outstandingCalculations`; none is an attribution hold. The main ones are the items under Notable cases ("Not modeled"), Angel-Blooded's ability line, Orc Atavism's counts-as rule, Dual Talent's two ability choices, Hulking Changeling's melee damage and Swordtrained's elven curve blade.

## Cross-batch bindings and protected records

Curated on `1faadea6`. Every re-bind uses `buildAssessmentBinding` over the final full `catalog:preview` with this batch's records, with the earlier batch's fixture copies of this batch's keys replaced by the full-preview entries, the inventory `currentBinding` updated and the fixture-based binding checked to agree (all 23 agree). Only the content fingerprints changed; no disposition, evidence, notice or hold changed in the earlier batches. The 23 are every assessment whose full-corpus closure reaches a batch key and that was fresh on the base (checked with the binding code over the baseline full preview): 3 from #387, 6 from #388, 1 from #389, 3 from #390, 2 from #391, 3 from #392, 1 from #393, 3 from #394 and Fey Boon from #524.

| Batch, assessment                 | Reaches (this batch)                    | Content fingerprint       |
| --------------------------------- | --------------------------------------- | ------------------------- |
| #387 Hard Head, Big Teeth         | Skilled (Goblin)                        | `2d84c5d1…` → `3e08ac9f…` |
| #387 Intoxicating Aroma           | Natural Magic                           | `031d030a…` → `f30abe65…` |
| #387 Skilled (Aasimar - Angelkin) | Skilled (Aasimar)                       | `e453b5b0…` → `e96abfe0…` |
| #388 Aquatic Elves                | Aquatic Mastery                         | `03117f36…` → `bd656b09…` |
| #388 Archon-Blooded (Lawbringers) | Skilled (Aasimar)                       | `4c3d96c1…` → `9849489b…` |
| #388 Exotic Weapon Training       | Swordtrained                            | `630d0f57…` → `b28a448f…` |
| #388 Experimental Body: Scorched  | Darkvision (Wyrwood)                    | `9c7e4b3d…` → `ac5dea1c…` |
| #388 Carrion Sense                | Gifted Linguist                         | `04c5854f…` → `b8b7f40b…` |
| #388 Experimental Body: Enchanted | Darkvision (Wyrwood)                    | `9ea9877d…` → `d32fa87a…` |
| #389 Repair Magic                 | Darkvision (Wyrwood)                    | `ad59c959…` → `5e6d3bb7…` |
| #390 Energy Strike (Fire)         | Elemental Assault, Energy Strike (Acid) | `324fb247…` → `16085551…` |
| #390 Forlorn Elves                | Urbanite                                | `4f5fdc05…` → `f134f173…` |
| #390 Smokesoul (Fume Sylph)       | Darkvision (Sylph), Languages (Sylph)   | `96d8ca3e…` → `f83083bb…` |
| #391 Immortal Spark               | Skilled (Aasimar)                       | `04555023…` → `937599a4…` |
| #391 Glide                        | Gifted Linguist                         | `6b94f5ae…` → `87c98aa6…` |
| #392 Relentless                   | Stability (Dwarf)                       | `83c6c9d2…` → `caf9b9de…` |
| #392 Weapon Familiarity (Goblin)  | Skilled (Goblin)                        | `2aff1e5b…` → `6dcbdc1b…` |
| #392 Peri-Blooded (Emberkin)      | Skilled (Aasimar)                       | `f4b33154…` → `23772d7d…` |
| #393 Claw Attack                  | Swordtrained                            | `de238e35…` → `531fb75d…` |
| #394 Experimental Body: Blessed   | Darkvision (Wyrwood)                    | `25554fbd…` → `09e08b7e…` |
| #394 Exiled Dwarf                 | Stability (Dwarf)                       | `b0c39749…` → `9d8cd532…` |
| #394 Over-Sized Ears              | Skilled (Goblin)                        | `419d7b09…` → `548c8ade…` |
| #524 Fey Boon                     | Stability (Dwarf)                       | `e1b6ab74…` → `a26fa8ef…` |

They are recorded in each racial-traits batch's inventory `currentBinding` and `tests/fixtures/<batch>/preview.json`. #524 records no `currentBinding`: its Stability (Dwarf) copy in `tests/fixtures/spells-524/binding-preview.json` is replaced by the entry #524's own bounded re-import now produces (equal to the full-preview entry), as #394 did for Greed.

- **Already stale, not re-bound:** 31 assessments that reach batch keys were stale on the base (the deferred stale set): 29 #328 race records, Lifecrafting and Tail Terror.
- **Protected and fixture copies:** no batch key is a protected root or a pinned definition of an earlier batch. `feats-355/binding-preview.json` copies six batch keys that no #355 assessment's closure reaches, and the #530 to #536 and #350 to #355 `protected-context.json` lists name 32 batch keys only as seed, closure and source keys.
- **In-flight batches:** no pf-companion-features key (#507) is in this batch's closures, and no #507 inventory is on the base.

## Binding

Every assessment is bound with `buildAssessmentBinding` against the full-corpus content closure: the final full `catalog:preview` artifact, with the batch's 82 entries and their 119 closure entries. The [preview fixture](../../tests/fixtures/racial-traits-395/preview.json) keeps both, so the batch test rebuilds every binding from a clean shared-store tree (0 mismatches). Stability (Dwarf)'s Modifiers are the Dwarf race's re-homed note outputs, which a bounded tree without the race lacks; the test lists it as relocated.

## Tests

The [resolver tests](../../tests/catalog/racial-traits-395.test.ts) pin Garuda-Blooded (Plumekith) replacing the aasimar's ability score trait on an aasimar identity sheet (Dexterity 10 to 12, Charisma 12 to 10, Diplomacy 3 to 2), the other curated heritage lines, every Situation-gated bonus (off by default, on when selected), the shared poison Situation, Healthy's two racial bonuses not stacking, distinct racial Sources stacking (Caretaker + Urbanite = +4), the imported values not curated twice, the school Modifiers, and no `ac.other` armor, shield or natural armor bonus; all 51 required and 82 description records checked, the six covered records and the Note targets; the race, alternate, monster-ability, inherited and Unchained notice dependencies (26 PZO1131 keys, own action versus bound body) and every enforced hold; the importer's reading and the exact unresolved names; every pinned body, PCGen row and PRD paragraph in the shared store; and re-extraction from a clean shared-store tree with every binding reproduced, all 82 records held on their own reasons except Orc Atavism's link-gap failure, and a confirmed Stability (Dwarf) still held.

The [isolated saved-sheet test](../../tests/catalog/racialTraits395.integration.test.ts) exercises public Convex reads and writes: an aasimar-identity race granting its ability score trait, Skilled (Aasimar) and Celestial Resistance takes the held Garuda-Blooded (Plumekith) and Celestial Crusader (Dexterity +2, Charisma -2, Diplomacy -3, Perception -2) and turns them off again, with saved totals equal to the preview; outsiders, anonymous callers and another campaign's entry are refused without changing the sheet. The shared held-release round trip is covered once by the release test in [`traits367.integration.test.ts`](../../tests/catalog/traits367.integration.test.ts). No deployment or production activation occurred.

## Preservation and gates

The shared canonical files gain only this batch's entries: 133 curation records (82 description and 51 note records), 82 assessments, 82 evidence entries and 41 notice holds. The other changes are the listed re-binds (content fingerprints only) with their `currentBinding` and fixture copies. Shared-file diff stat against `1faadea6` (`git diff --stat --diff-algorithm=histogram HEAD`):

```text
 scripts/catalog/legal/held-notices.json           |  389 +++
 scripts/catalog/legal/racial-traits-387.json      |    6 +-
 scripts/catalog/legal/racial-traits-388.json      |   12 +-
 scripts/catalog/legal/racial-traits-389.json      |    2 +-
 scripts/catalog/legal/racial-traits-390.json      |    6 +-
 scripts/catalog/legal/racial-traits-391.json      |    4 +-
 scripts/catalog/legal/racial-traits-392.json      |    6 +-
 scripts/catalog/legal/racial-traits-393.json      |    2 +-
 scripts/catalog/legal/racial-traits-394.json      |    6 +-
 scripts/catalog/reviewed-curation.json            | 2782 +++++++++++++++++++++
 src/lib/catalog/data/attribution-assessments.json | 2036 ++++++++++++++-
 src/lib/catalog/data/attribution-evidence.json    |  246 ++
 tests/fixtures/racial-traits-387/preview.json     |   19 +-
 tests/fixtures/racial-traits-388/preview.json     |   52 +-
 tests/fixtures/racial-traits-389/preview.json     |    5 +
 tests/fixtures/racial-traits-390/preview.json     |   67 +-
 tests/fixtures/racial-traits-391/preview.json     |   21 +-
 tests/fixtures/racial-traits-392/preview.json     |   21 +-
 tests/fixtures/racial-traits-393/preview.json     |    5 +
 tests/fixtures/racial-traits-394/preview.json     |   19 +-
 tests/fixtures/spells-524/binding-preview.json    |    7 +-
 21 files changed, 5613 insertions(+), 100 deletions(-)
```

<!-- prep:shared-store-count -->

New shared-store files (`tests/fixtures/pinned/`), counted by prep after the rebase onto `c6e75a69`: **110** (pcgen 2, pf1 6, pf1-content 102).

<!-- /prep:shared-store-count -->

The batch adds to the shared store the pinned records of its 100 keys the store lacked, the pf-racial-traits folder records above them, the linked racial traits and the six linked pf1 spells the store lacked, and two PCGen files (the Qadira, Gateway to the East race-ability file and a Core Essentials catfolk file); the race records, the other PCGen files and the PRD pages were already on the base and are reused.

The complete preview of `1faadea6` plus this batch reported **96 admitted, 23,158 held, 2 dependent omissions and 2,363 failures**, 51 fewer than the base's 2,414 (this batch's required note records). The only batch key among the failures is Orc Atavism's link gap (see Importer and data gaps). The full-corpus gate is therefore a documented failure, not a claim of whole-corpus readiness.

| Command                                                                                                                                                                                   | Result                                                                                                                                         |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `catalog:curate --candidates …` (required) and `--descriptions` (prose pass)                                                                                                              | pass; 51 required drafts, 18 prose drafts; about 12 s each                                                                                     |
| `catalog:preview --candidates …`                                                                                                                                                          | exit 1; 0 admitted / 37 held / 45 failures, all links and replacements outside the selection                                                   |
| Full `catalog:curate`                                                                                                                                                                     | pass; 1,257 new drafts, none for this batch; 0 missing; about 3 min                                                                            |
| Full `catalog:preview` (baseline, then final records)                                                                                                                                     | exit 1; 2,414 failures on the base, 2,363 with this batch, only Orc Atavism's link gap among them; about 9 min each plus admission queue       |
| Full re-bind (`bind.ts`, `xrebind395.ts`, `xrebind524_395.ts` over the final full preview)                                                                                                | 82 assessments bound, 119 closure entries, 0 mismatches against the clean-tree reconstruction; 23 earlier assessments re-bound, fixtures agree |
| `pnpm test` of the batch tests and the guards (`notice-holds`, `pinned-sources`, `cross-batch-bindings`, `batch-ownership-sweep`, `ac-other-defense-bonuses`) (one worker)                | pass; 7 files / 166 tests; about 3 min                                                                                                         |
| `pnpm test` of the affected earlier tests (`racial-traits-387` to `-394`, `spells-524`, `racial-traits-719`, `race-facts-720`, `race-ability-721`, `races-328`, `feats-355`) (one worker) | pass; 14 files / 356 tests (after keeping Angel-Blooded's line outstanding, which `race-ability-721` pins); about 2 min                        |
| `pnpm -s typecheck`                                                                                                                                                                       | pass                                                                                                                                           |
| `pnpm -s lint`                                                                                                                                                                            | pass; about 2.5 min (the first run flagged two unused test imports and an unused fixture export, removed)                                      |
| `pnpm -s check:initial-migration-writers`                                                                                                                                                 | pass; 185 registrations                                                                                                                        |
| `pnpm catalog:pin`                                                                                                                                                                        | pass; `sha256:005ef0b9…`                                                                                                                       |
| `pnpm catalog:notice-deps`                                                                                                                                                                | pass; 0 gaps; 38 advisory warnings, none for this batch                                                                                        |
| `pnpm catalog:format --check`                                                                                                                                                             | pass                                                                                                                                           |

`pnpm test tests/catalog` was left to the orchestrator's prep run on the rebased commit, as the brief directs.
