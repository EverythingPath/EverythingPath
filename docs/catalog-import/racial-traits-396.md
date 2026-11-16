# Racial traits #396: pf1-content pf-racial-traits batch 10

Reviewed by **Opus (AI curator) for the owner**, 2026-10-20.

Exactly the issue's 100 ordered, unique keys were reviewed: **0 admitted, 77 specifically held, 0 dependent omissions, 0 whole-entry unsupported/prose-only dispositions, 23 exclusions, 0 record-level 3.5 holds**. The exclusions are 13 Foundry `!folders!` records (two of them Race Builder folders), which the importer's folder contract leaves out of the Catalog Entries (PRD Decision 17), and 10 records in the Advanced Race Guide Race Builder subtree, which the import contract excludes by folder ancestry ([README](README.md), explicit exclusions) and the [Racial Trait contract](../character-sheet/racial-traits.md) puts out of scope. No candidate carries a `3.5` tag. The 77 in-scope records are 36 standard racial traits (9 of them in flat race folders), 29 alternates, 5 Subrace Standard heritage parts and 7 Subraces-folder heritages or ethnicities.

The [machine-readable inventory and evidence](../../scripts/catalog/legal/racial-traits-396.json) records, per key, the complete pinned body and inert fields with their source hash and cited sources; the PCGen race-ability rows, PRD Advanced Race Guide paragraphs, leads and rejected rows; the inherited-rule notices with their evidence, the linked bodies and the unresolved origins; the importer's reading of race, standard flag and replacements; every checked curation record, source discrepancies and calculation gaps; and the current assessment binding and mapped facts. This report summarizes them and does not repeat the evidence.

## #328 S4-B launch update

Reviewed 2026-11-01 by **Sol (AI curator) for the owner** ([races-328.md](races-328.md#s4-b-launch-half-elf-elf-gnome-and-halfling)). The S4-B launch review confirms 2 standard racial traits of Half-Elf, Elf, Gnome and Halfling with content-bound assessments; counts are now **4 admitted, 73 held**, with 23 exclusions unchanged. The earlier Opus review of each row stays in its `assessmentHistory`; every other candidate keeps its review and holds.

- **Keen Senses (Elf)** (`pf1-content/WOF6A7695wxFO2ie`): matches the PRD ARG paragraph (`advancedRaceGuide/coreRaces/elves.html:370`) word for word; PCGen's Core Essentials row (`elf/elf_abilities_race.lst:24`) with the recorded DESC differences. Its Modifier is +2 racial Perception (skill.per). Required notices: PZO9280, PZO1121, PZO1110.
- **Low-Light Vision (Elf)** (`pf1-content/X3ixmmB9S07XqKNX`): matches the PRD ARG paragraph (`advancedRaceGuide/coreRaces/elves.html:367`) word for word; PCGen's Core Essentials row (`elf/elf_abilities_race.lst:21`) word for word. Low-light vision stays readable. Required notices: PZO9280, PZO1121, PZO1112, PZO1110. Outstanding: Low-light vision is permitted prose; no sense statistic.

Each row's whole-content hold ("Book PDFs unavailable") is superseded by this comparison, and it records no notice hold: PZO1110 is reviewed, PZO1121's Registry hold and `racial-traits-396-notice-PZO1121-complete-chain` are cleared (`notice-clearances.json`, owner 2026-10-30), and PZO9280's reviewed confirmation waives `racial-traits-396-notice-PZO9280-complete-chain`; the PZO1112 (low-light vision) and PZO1131 (Unchained action costs) batch holds are cleared too. The batch's `noticeRequirements` rows keep these keys as history. Content fingerprints are unchanged (the imported entries are identical); only the status, rationale, evidence and notice bindings move.

Tests: `racial-traits-396.test.ts` checks the confirmed rows with the held ones (`assessedTraits` in the fixture), expects them admitted by the committed gate and records no hold for them.

## #328 S4-A launch update

Reviewed 2026-11-01 by **Sol (AI curator) for the owner** ([races-328.md](races-328.md#s4-a-launch-human-dwarf-and-half-orc)). The launch review admits 2 standard racial traits of Human, Dwarf and Half-Orc with confirmed, content-bound assessments; counts are now **2 admitted, 75 held**, with 23 exclusions unchanged. The earlier Opus review of each admitted row stays in its `assessmentHistory`; every other candidate keeps its review and holds.

- **Intimidating** (`pf1-content/UawXK40Ix4vmfMkY`): matches the PRD ARG paragraph (`advancedRaceGuide/coreRaces/halfOrcs.html:371`) apart from "because of" for "due to"; PCGen's Core Essentials row (`half_orc/halforc_abilities_race.lst:22`). Its Modifier is +2 racial Intimidate (the race's skill.int change, relocated here). Required notices: PZO9280, PZO1121, PZO1110.
- **+2 to One Ability Score (Half-Orc)** (`pf1-content/VHmuEYXmx81Q5EmC`): matches the PRD ARG paragraph (`advancedRaceGuide/coreRaces/halfOrcs.html:367`) apart from "Half-Orc" for "Half-orc"; "get" for "gain"; PCGen's Core Essentials row (`half_orc/halforc_abilities_race.lst:18`). Its Modifier is ability.$choice +2 racial: the player picks the score on the sheet. Required notices: PZO9280, PZO1121, PZO1110.

Each admitted row's whole-content hold ("Book PDFs unavailable") is superseded by this comparison, and it records no notice hold: PZO1110 is reviewed, PZO1121's Registry hold is cleared (owner, 2026-10-30), and PZO9280's reviewed confirmation waives `racial-traits-396-notice-PZO9280-complete-chain`. The batch's `noticeRequirements` rows keep these keys as history. Content fingerprints are unchanged (the imported entries are identical); only the status, rationale, evidence and notice bindings move.

Tests: `racial-traits-396.test.ts` checks the admitted rows with the held ones (`assessedTraits` in the fixture), expects them admitted by the committed gate and records no hold for them.

## Family rulings applied

This batch follows the #387 rulings Sol approved for the family:

1. **Every in-scope record is held** with a whole-content hold: the race records stay held (#328), every cited book's notice chain is held (40 batch notice holds, registered in `held-notices.json`), and no book PDFs are available.
2. **Race abilities.** Every record requires the books its pinned race record cites.
3. **Alternate framework.** Every alternate records the APG alternate racial trait rule (PZO1115, `apg_abilities_race.lst:86`).
4. **Monster abilities** take the earliest book the pinned Universal Monster Rules page lists: darkvision PZO1127; low-light vision, natural attacks, poison, light blindness, energy resistance, fast healing and amphibious PZO1112.
5. **Creature types** (the dragon type; aeons, psychopomps and aligned outsiders; the human subtype Throwback gives; the monstrous humanoid type and aquatic subtype) stay named unresolved origins.
6. **PZO1131** for Unchained action-cost metadata anywhere in the bound closure: 25 records (15 on their own actions, 19 through bound bodies, 9 both). The three heritages with a curated ability line reach their race's standard traits through the race's ability score trait, and so the race's own spell-like ability actions.
7. **Comparisons.** PCGen race-ability rows from a pinned book are the `comparison` (29 records); Core Essentials support rows (no SOURCELONG book) are leads whose book is not required. 19 records carry a PRD `prdComparison` from the pinned capture (15 match word for word). Subrace Standard parts take no PRD paragraph (the paragraph is the parent's trait); the PRD drow page splits the "Spell-Like Abilities" heading, so Spell-Like Abilities (Drow) records none.
8. **Description pass.** Every in-scope record has a checked description record: its reviewed Modifiers plus one entry-level Note with the body (`@Distance` read as feet, `@Toggle` buff controls and empty "Related buff" lines removed, HTML entities decoded).
9. **Racial bonuses from distinct Sources stack**; the resolver test shows Wayfarer and Evader (Gloomkin) giving +7 racial Survival together to avoid becoming lost underground. The #735 admission policies don't bear on this batch (no spells or CRB feats).

## Dispositions

| Key                            | Name                                                  | Kind             | Disposition                                                      |
| ------------------------------ | ----------------------------------------------------- | ---------------- | ---------------------------------------------------------------- |
| `pf1-content/U8dkiXDmSDOETLxv` | Azata-Blooded (Musetouched)                           | subrace          | held: `racial-traits-396-whole-content-U8dkiXDmSDOETLxv`         |
| `pf1-content/UBaGcNVcXL59Bfoq` | Cat's Luck                                            | standard         | held: `racial-traits-396-whole-content-UBaGcNVcXL59Bfoq`         |
| `pf1-content/UMT2CcRjz9uXlsvb` | Kyton-Spawn (Shackleborn)                             | subrace          | held: `racial-traits-396-whole-content-UMT2CcRjz9uXlsvb`         |
| `pf1-content/URpcaP1vfemHJyal` | Pyromaniac                                            | alternate        | held: `racial-traits-396-whole-content-URpcaP1vfemHJyal`         |
| `pf1-content/UTayoqBWQlU9L28c` | Elemental Weapons                                     | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/UXlI3nAl6Peg1HRL` | Language                                              | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/UYSb1Adt09Nn6xut` | Slow Speed (Oread)                                    | standard         | held: `racial-traits-396-whole-content-UYSb1Adt09Nn6xut`         |
| `pf1-content/UawXK40Ix4vmfMkY` | Intimidating                                          | standard         | held: `racial-traits-396-whole-content-UawXK40Ix4vmfMkY`         |
| `pf1-content/UbqcWIBRROTWK8l0` | Pride                                                 | standard         | held: `racial-traits-396-whole-content-UbqcWIBRROTWK8l0`         |
| `pf1-content/Ucd87mayBCsB4mpW` | Poison Minion (Half-Orc)                              | alternate        | held: `racial-traits-396-whole-content-Ucd87mayBCsB4mpW`         |
| `pf1-content/Ud0HV2vZPaqEryKB` | Hag Racial Trait (Changeling - Slag May)              | subrace standard | held: `racial-traits-396-whole-content-Ud0HV2vZPaqEryKB`         |
| `pf1-content/Ui1DckRv5x7YYvfl` | Hypnotic                                              | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/UsBkDqNJ8C119TCb` | Elemental Assault                                     | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/Uu1wTwtXGLuFWugv` | Energy Strike (Cold)                                  | alternate        | held: `racial-traits-396-whole-content-Uu1wTwtXGLuFWugv`         |
| `pf1-content/UvWpHqJHIyUkValD` | Paraheen Dwarves                                      | subrace          | held: `racial-traits-396-whole-content-UvWpHqJHIyUkValD`         |
| `pf1-content/UzMmqEyE5E3VDox0` | Woodcraft                                             | alternate        | held: `racial-traits-396-whole-content-UzMmqEyE5E3VDox0`         |
| `pf1-content/V0AMHu01ZqnTvZD7` | Subrace Standard                                      | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/V0x3N3HwwNLa2KSm` | Slow Speed (Locathah)                                 | standard         | held: `racial-traits-396-whole-content-V0x3N3HwwNLa2KSm`         |
| `pf1-content/V1sxwRKkE3x6qoMX` | Spell-Like Ability (Ifrit - Lavasoul)                 | subrace standard | held: `racial-traits-396-whole-content-V1sxwRKkE3x6qoMX`         |
| `pf1-content/V20dpuTbpcjyZ61Z` | Alert for Betrayal                                    | alternate        | held: `racial-traits-396-whole-content-V20dpuTbpcjyZ61Z`         |
| `pf1-content/V4zztgoZn2hLGEld` | Alternate Skill Modifiers (Skinwalker - Aerieborn)    | subrace standard | held: `racial-traits-396-whole-content-V4zztgoZn2hLGEld`         |
| `pf1-content/V5V8tGIQ5JWnd9mq` | Skilled (Aasimar - Idyllkin)                          | subrace standard | held: `racial-traits-396-whole-content-V5V8tGIQ5JWnd9mq`         |
| `pf1-content/V7nc5iy8a624CWna` | Languages (Catfolk)                                   | standard         | held: `racial-traits-396-whole-content-V7nc5iy8a624CWna`         |
| `pf1-content/V8NqYeuTjc2CDfT3` | Standard                                              | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/VEGU8AW6YZR5TyFR` | Darkvision (Ratfolk)                                  | standard         | held: `racial-traits-396-whole-content-VEGU8AW6YZR5TyFR`         |
| `pf1-content/VGk89BngdzOsdcda` | Standard                                              | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/VHmuEYXmx81Q5EmC` | +2 to One Ability Score (Half-Orc)                    | standard         | held: `racial-traits-396-whole-content-VHmuEYXmx81Q5EmC`         |
| `pf1-content/VIBm0jH0Xerz1xxp` | Day Raider                                            | alternate        | held: `racial-traits-396-whole-content-VIBm0jH0Xerz1xxp`         |
| `pf1-content/VIbYUNN6RqDM7x9Y` | Spell-Like Ability, Lesser                            | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/VIu4idSpcjqKbD1s` | Surface Sprinter                                      | alternate        | held: `racial-traits-396-whole-content-VIu4idSpcjqKbD1s`         |
| `pf1-content/VKKENsPZuC210Ock` | Alternate Spell-Like Ability (Skinwalker - Witchwolf) | subrace standard | held: `racial-traits-396-whole-content-VKKENsPZuC210Ock`         |
| `pf1-content/VKPGN4SPNATBrToA` | Darkvision (Tiefling)                                 | standard         | held: `racial-traits-396-whole-content-VKPGN4SPNATBrToA`         |
| `pf1-content/VKSewOw07cYNG8qy` | Darkvision (Wyvaran)                                  | standard         | held: `racial-traits-396-whole-content-VKSewOw07cYNG8qy`         |
| `pf1-content/VLpXXZb8shozC2Hu` | Speak with Sharks (Sahuagin)                          | standard         | held: `racial-traits-396-whole-content-VLpXXZb8shozC2Hu`         |
| `pf1-content/VM3b9p3WKEHB45ne` | Light Blindness (Sahuagin)                            | standard         | held: `racial-traits-396-whole-content-VM3b9p3WKEHB45ne`         |
| `pf1-content/VMdfkHxhfKgt1aOq` | Fire Insight                                          | alternate        | held: `racial-traits-396-whole-content-VMdfkHxhfKgt1aOq`         |
| `pf1-content/VN4qyk60FhxU3o6J` | Powerful Swimmer                                      | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/VPo3x8dFD4PXeN7s` | Dual-Minded                                           | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/VQJKPH7YtgzXQj4J` | Inured                                                | alternate        | held: `racial-traits-396-whole-content-VQJKPH7YtgzXQj4J`         |
| `pf1-content/VRVtIxsv59vhHm5y` | Hag Racial Trait (Changeling - Frostlaced Flesh)      | standard         | held: `racial-traits-396-whole-content-VRVtIxsv59vhHm5y`         |
| `pf1-content/VYojkt9Hjlz5f7Oh` | Android                                               | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/VZg9M6DaaZkIA8ql` | Undead                                                | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/VavtvA1snnAQD7lX` | Dragon Slayer                                         | alternate        | held: `racial-traits-396-whole-content-VavtvA1snnAQD7lX`         |
| `pf1-content/VdVeZbAwasLj2Tjs` | Grindylow                                             | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/VdfQ0vUsErAKGQob` | Powerful Bite                                         | standard         | held: `racial-traits-396-whole-content-VdfQ0vUsErAKGQob`         |
| `pf1-content/VeT8BWM5gpiTLijD` | Self-Made Fate                                        | alternate        | held: `racial-traits-396-whole-content-VeT8BWM5gpiTLijD`         |
| `pf1-content/VfIksZzCRMtktSu6` | Darkvision (Aasimar)                                  | standard         | held: `racial-traits-396-whole-content-VfIksZzCRMtktSu6`         |
| `pf1-content/Vg06NWO6pnA0wAut` | Languages (Adaro)                                     | standard         | held: `racial-traits-396-whole-content-Vg06NWO6pnA0wAut`         |
| `pf1-content/VmHT9b6yPqZD8typ` | Evader (Gloomkin)                                     | alternate        | held: `racial-traits-396-whole-content-VmHT9b6yPqZD8typ`         |
| `pf1-content/VqKrfxVGYTHWF2ZK` | Languages (Oread)                                     | standard         | held: `racial-traits-396-whole-content-VqKrfxVGYTHWF2ZK`         |
| `pf1-content/VvjAmbtqRiEyxX0b` | Feat and Skill                                        | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/VySd3q4uEVwTS4i2` | Adoptive Parentage (Weapon Familiarity)               | alternate        | held: `racial-traits-396-whole-content-VySd3q4uEVwTS4i2`         |
| `pf1-content/W0HmuUGc9ihN3Sfp` | Shadowplay                                            | alternate        | held: `racial-traits-396-whole-content-W0HmuUGc9ihN3Sfp`         |
| `pf1-content/W199gG02chF53jD4` | Mute-Born (Sorrow May)                                | subrace          | held: `racial-traits-396-whole-content-W199gG02chF53jD4`         |
| `pf1-content/W1eARNOkwX3dAEns` | Throwback                                             | alternate        | held: `racial-traits-396-whole-content-W1eARNOkwX3dAEns`         |
| `pf1-content/W84vzbaWfDxNW2hr` | Bleachlings                                           | subrace          | held: `racial-traits-396-whole-content-W84vzbaWfDxNW2hr`         |
| `pf1-content/W8kHLAzmTHKAUWWU` | Special Qualities                                     | standard         | held: `racial-traits-396-whole-content-W8kHLAzmTHKAUWWU`         |
| `pf1-content/W927qk1LcTVIgFyp` | Alternate                                             | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/W9nFsXa8qFiY5VXd` | Burrow (Trox)                                         | standard         | held: `racial-traits-396-whole-content-W9nFsXa8qFiY5VXd`         |
| `pf1-content/WCxIMzfaq7mV3b2o` | Inspiration                                           | standard         | held: `racial-traits-396-whole-content-WCxIMzfaq7mV3b2o`         |
| `pf1-content/WDeyEgmjJDg4h1TC` | Practicality                                          | alternate        | held: `racial-traits-396-whole-content-WDeyEgmjJDg4h1TC`         |
| `pf1-content/WE57FyExdDq2mjnV` | Sunsoul (Solar Ifrit)                                 | alternate        | held: `racial-traits-396-whole-content-WE57FyExdDq2mjnV`         |
| `pf1-content/WF6xe4rsv4mnhPIz` | Tree Dialect                                          | alternate        | held: `racial-traits-396-whole-content-WF6xe4rsv4mnhPIz`         |
| `pf1-content/WGGmNZdRqTXOPmgr` | Samsaran                                              | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/WJO1PMH4T8qWg9wK` | Experimental Body: Fey-Touched                        | alternate        | held: `racial-traits-396-whole-content-WJO1PMH4T8qWg9wK`         |
| `pf1-content/WLj6hpVMQwt2vRRP` | Deep Magic                                            | alternate        | held: `racial-traits-396-whole-content-WLj6hpVMQwt2vRRP`         |
| `pf1-content/WOF6A7695wxFO2ie` | Keen Senses (Elf)                                     | standard         | held: `racial-traits-396-whole-content-WOF6A7695wxFO2ie`         |
| `pf1-content/WQeKVvkmzlUI61kh` | Sticky Tongue                                         | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/WSIKTn6GrP0LMTHn` | Low-Light Vision (Suli)                               | standard         | held: `racial-traits-396-whole-content-WSIKTn6GrP0LMTHn`         |
| `pf1-content/WTmVd9Sq3RNMG60F` | Vivacious                                             | alternate        | held: `racial-traits-396-whole-content-WTmVd9Sq3RNMG60F`         |
| `pf1-content/Wbsmn2PqBb1r519r` | Voice in the Darkness (Half-Elf)                      | alternate        | held: `racial-traits-396-whole-content-Wbsmn2PqBb1r519r`         |
| `pf1-content/WcTRWpOx3VeqJuTU` | Slow Speed                                            | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/WdLlWlzLdW3iuwEv` | Defensive Training (Kasatha)                          | standard         | held: `racial-traits-396-whole-content-WdLlWlzLdW3iuwEv`         |
| `pf1-content/WdgbfutKDt92CIVc` | Soul Seer                                             | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/WeWIm2pWosb2oHQU` | Languages (Ghoran)                                    | standard         | held: `racial-traits-396-whole-content-WeWIm2pWosb2oHQU`         |
| `pf1-content/WfRb4ifVrYFjSJNV` | Hypnotic                                              | alternate        | held: `racial-traits-396-whole-content-WfRb4ifVrYFjSJNV`         |
| `pf1-content/WfhMYITrAYcmBj7a` | Aphorite Resistances                                  | standard         | held: `racial-traits-396-whole-content-WfhMYITrAYcmBj7a`         |
| `pf1-content/Wi9RMrZnkVkKMKNF` | First World Gnomes                                    | subrace          | held: `racial-traits-396-whole-content-Wi9RMrZnkVkKMKNF`         |
| `pf1-content/WiWFGkrXvw6qHwTc` | Languages (Duergar)                                   | standard         | held: `racial-traits-396-whole-content-WiWFGkrXvw6qHwTc`         |
| `pf1-content/WjDK7bfCeawKboHW` | Undead Resistance                                     | standard         | held: `racial-traits-396-whole-content-WjDK7bfCeawKboHW`         |
| `pf1-content/WjizXs1zxKATqDaG` | Alternate                                             | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/WqGT0UXfEhYH82xO` | Duergar                                               | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/WqujuS6n7hjE1jKW` | Monstrous Humanoid (Adaro)                            | standard         | held: `racial-traits-396-whole-content-WqujuS6n7hjE1jKW`         |
| `pf1-content/WuhUXGK47ZMvbYw3` | Subraces                                              | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/WvOUUxWA9WOyYUGc` | Stone in the Blood                                    | alternate        | held: `racial-traits-396-whole-content-WvOUUxWA9WOyYUGc`         |
| `pf1-content/WyTkLcKys4Jy29Q2` | Jungle Affinity                                       | alternate        | held: `racial-traits-396-whole-content-WyTkLcKys4Jy29Q2`         |
| `pf1-content/X33mXkgyuZ1XxCUY` | Languages (Monkey Goblin)                             | standard         | held: `racial-traits-396-whole-content-X33mXkgyuZ1XxCUY`         |
| `pf1-content/X3R13oOAjWS0XJys` | Spell-Like Abilities (Drow Noble)                     | standard         | held: `racial-traits-396-whole-content-X3R13oOAjWS0XJys`         |
| `pf1-content/X3ixmmB9S07XqKNX` | Low-Light Vision (Elf)                                | standard         | held: `racial-traits-396-whole-content-X3ixmmB9S07XqKNX`         |
| `pf1-content/X3vM1Jyty2T7MMTq` | Tough                                                 | alternate        | held: `racial-traits-396-whole-content-X3vM1Jyty2T7MMTq`         |
| `pf1-content/X7Zw9GPsNULV907F` | Prehensile Tail (Vanara)                              | standard         | held: `racial-traits-396-whole-content-X7Zw9GPsNULV907F`         |
| `pf1-content/XD4XuIeMdE9bWevW` | Wayfarer                                              | alternate        | held: `racial-traits-396-whole-content-XD4XuIeMdE9bWevW`         |
| `pf1-content/XKf2zezBFglZk9zk` | Poison Minion (Gnome)                                 | alternate        | held: `racial-traits-396-whole-content-XKf2zezBFglZk9zk`         |
| `pf1-content/XNPNBWO2uRTlFiRM` | Low-Light Vision (Merfolk)                            | standard         | held: `racial-traits-396-whole-content-XNPNBWO2uRTlFiRM`         |
| `pf1-content/XOISvyFa8ZziUEak` | Psychic Defense                                       | alternate        | held: `racial-traits-396-whole-content-XOISvyFa8ZziUEak`         |
| `pf1-content/XORCuKscv4fKV1EH` | Normal Speed (Vanara)                                 | standard         | held: `racial-traits-396-whole-content-XORCuKscv4fKV1EH`         |
| `pf1-content/XPYjs1zYjY2E02gz` | Spell-Like Abilities (Drow)                           | standard         | held: `racial-traits-396-whole-content-XPYjs1zYjY2E02gz`         |
| `pf1-content/XQyOZECH4JHvQaTE` | Standard                                              | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/XQySDLBHVVeaaRzo` | Resistant                                             | standard         | held: `racial-traits-396-whole-content-XQySDLBHVVeaaRzo`         |
| `pf1-content/XSk0ArPbEAnqz9Fm` | Darklands Half-Orcs (Gloomkin)                        | subrace          | held: `racial-traits-396-whole-content-XSk0ArPbEAnqz9Fm`         |

## Notable cases

- **Heritage ability lines curated (#387 to #395 precedent).** Azata-Blooded (Musetouched) (+2 Dex, +2 Cha), Kyton-Spawn (Shackleborn) (+2 Con, +2 Cha, -2 Wis) and Sunsoul (Solar Ifrit) (+2 Str, +2 Cha, -2 Wis) are `reviewedAbilityLineSubraces` heritages. The first two lines agree with PCGen's Core Essentials "<Heritage> ~ Ability Scores" rows; Sunsoul has no PCGen row, as #390's Smokesoul (Fume Sylph). Each line is racial ability Modifiers, so "Base Statistics" resolves to the race's ability score trait, which goes dormant. Mute-Born (Sorrow May) keeps its line readable: the sorrow may's separate ability record replaces the changeling's trait by name.
- **Uncovered trait note: Aphorite Resistances** (one of the four the run notes list; counted once). Its checked note record carries the Aphorite race note record's outputs (untyped +2 under the shared poison and mindAffecting Situations) plus an entry-level electricity resistance Note, so it supersedes the race note record (`pf1/zlWiqUqxCajrZRe3` allSavingThrows, reported stale, as #387 did for Forest Walker (Orang-Pendak)) and the bonus counts once. The full preview's only new stale record is that one.
- **Latent overlap: Undead Resistance.** The Dhampir race's checked #328 description record already gives +2 racial saves against disease and mind-affecting effects, so the trait's note is covered/no-output. **Pride** and **Resistant** are covered by their races' re-homed #328 note records (`coveredTraitNotes`).
- **Pinned standard traits stay unchanged:** Intimidating, +2 to One Ability Score (Half-Orc), Keen Senses (Elf), Low-Light Vision (Elf) and Pyromaniac are pinned by `racial-traits-719`, `race-ability-721` or #391; no Modifier is added. Pyromaniac's "one level higher" rule stays an entry-level Note (no spell DC or caster level Modifier, so 719's "Pyromaniac removes the gnome illusion DC" still holds). Checked against the race outputs first (#391): no other standard trait duplicates a race Modifier.
- **Reviewed Modifier where a raw change doesn't map:** Hag Racial Trait (Changeling - Slag May)'s +1 racial melee damage (`damage.melee`; a Subrace Standard part, so it isn't granted to every changeling). Frostlaced Flesh, by contrast, is a hag option the importer files as a standard trait; its cold save bonus stays a Note on saves (#391 Crawling Skin, #394 Green Widow).
- **Situational bonuses** (manual Situations): Woodcraft (+2 racial in forest terrain; one entry's same-type bonuses don't stack, so +2 is the improved total, not +3), Dragon Slayer (dodge on `ac`, racial attack), Self-Made Fate, Evader (Gloomkin), Inured, Shadowplay, Practicality, Voice in the Darkness (Half-Elf), Jungle Affinity, Wayfarer, Psychic Defense, Deep Magic (dispel checks) and Hypnotic (spell DC).
- **Shared Situations** only where the condition matches exactly: illusions (Alert for Betrayal), spellResistance (Deep Magic), poison and mindAffecting (Aphorite Resistances). Practicality's "illusions" stays local.
- **Covered/no-output records:** Pyromaniac's `spellEffect` note (its `cl` Note states the rule), Poison Minion (Gnome)'s `ac` note (the poison rule is not an AC rule) and Undead Resistance's save note (latent overlap above).
- **Inherited rules beyond the race:** Pyromaniac records the APG alchemist bombs and oracle flame mystery; Psychic Defense records Occult Adventures' psychic spells (PZO1132) and the Bestiary 5 psychic magic it cites (PZO1133); Inured records the Horror Adventures sanity rules it cites; First World Gnomes records the First World creature template it cites (PZO9298, the pinned source registry's "The First World, Realm of the Fey", no Registry identity); Experimental Body: Fey-Touched records the APG alchemist (extracts). Linked bodies' books are required throughout (spells, the Energy Strike options, the gloomkin and wildborn heritages, the ethnicities' traits).
- **Listed for review:** Practicality's imported Sense Motive bonus is typed racial where the body is untyped (a change replacement can't fix a type; held, as #370 did); Alternate Spell-Like Ability (Skinwalker - Witchwolf)'s "Race" header names the seascarred; Alternate Skill Modifiers (Skinwalker - Aerieborn)'s body gives no amount (the +2 racial comes from the raw changes); Evader (Gloomkin)'s PCGen row gives the Stealth bonus unconditionally.
- **Not modeled, listed:** senses, speeds, spell-like abilities and other actions, natural attacks, poison, energy resistance, creature types, class-skill grants, languages, effective-level rules, rerolls, healing and the hag heritages' awakened abilities.

## Importer and data gaps

- No batch record fails admission in the full preview: no unresolved description link, no journal-page link (#738), no prerequisite-parser finding (#739) and no missing pf-items reference.
- The ethnicities (Paraheen Dwarves, Bleachlings, First World Gnomes) and Mute-Born (Sorrow May) keep "Base Statistics" unmatched, as designed; Darklands Half-Orcs (Gloomkin) has no header, so the importer reads no replacement at all.
- The raw upstream keys in `mapRacialTrait` caused no reference failure; the bounded preview's 40 failures are links and replacements outside the selection. Untested cases from the run notes: none in this batch (no counts-as replacement, no `local/` heritage beyond the race ability traits, no curated Modifier triggering replacement other than the three heritage ability lines, no multi-race "Base Statistics" folder).

## Outstanding mechanics

Each record lists its calculation gaps in `mechanicsReview.outstandingCalculations`; none is an attribution hold. The main ones are the items under Notable cases ("Not modeled"), Practicality's chosen Craft or Profession skill, Frostlaced Flesh's cold save bonus and Paraheen's Craftsman replacing hardy.

## Cross-batch bindings and protected records

Curated on `b28163b4`. Every re-bind uses `buildAssessmentBinding` over the final full `catalog:preview` with this batch's records, with the earlier batch's fixture copies of this batch's keys replaced by the full-preview entries, the inventory `currentBinding` updated and the fixture-based binding checked to agree (all 40 agree). Only the content fingerprints changed; no disposition, evidence, notice or hold changed in the earlier batches. The 40 are every assessment whose full-corpus closure reaches a batch key and that was fresh on the base (checked with the binding code over the baseline full preview, and re-checked over the final one: all 40 fresh, the other 28 unchanged): 5 from #387, 4 from #388, 3 from #389, 6 from #390, 1 from #371, 1 from #391, 5 from #392, 3 from #393, 4 from #394 and 8 from #395.

| Batch, assessment                  | Reaches (this batch)                             | Content fingerprint       |
| ---------------------------------- | ------------------------------------------------ | ------------------------- |
| #387 Div-Spawn (Spitespawn)        | Darkvision (Tiefling)                            | `96f012e5…` → `c6e2ef54…` |
| #387 Ekujae Elves                  | Woodcraft, Keen Senses (Elf)                     | `c7051e69…` → `c3f4cfa3…` |
| #387 Scavenger                     | Intimidating                                     | `24ce5bbb…` → `a6cf7c52…` |
| #387 Halo                          | Darkvision (Aasimar)                             | `01bfcf8c…` → `802b534f…` |
| #387 Dragon Sight                  | Intimidating                                     | `ae90bc43…` → `0746a3d1…` |
| #388 Share Knowledge               | Aphorite Resistances                             | `637cb92b…` → `d41cf143…` |
| #388 Archon-Blooded (Lawbringers)  | Darkvision (Aasimar)                             | `9849489b…` → `a53c3015…` |
| #388 Shade Magic                   | Spell-Like Abilities (Drow)                      | `6f6383cd…` → `8ddc8545…` |
| #388 Divided Attention             | Intimidating                                     | `a67e04d5…` → `721a9f83…` |
| #389 Serpent Affinity              | Resistant                                        | `76fbf094…` → `55b64e17…` |
| #389 Shaman's Apprentice           | Intimidating                                     | `ce2243b1…` → `987f6a7b…` |
| #389 Stoic                         | Intimidating                                     | `89333900…` → `98a0c575…` |
| #390 Energy Strike (Fire)          | Energy Strike (Cold)                             | `16085551…` → `1aaccd12…` |
| #390 Forlorn Elves                 | Keen Senses (Elf)                                | `f134f173…` → `89168475…` |
| #390 Oni-Spawn (Hungerseed)        | Darkvision (Tiefling)                            | `2b36be8f…` → `4054b1ae…` |
| #390 Evasive Maneuvers             | Darkvision (Wyvaran)                             | `4806a848…` → `8c0c34b8…` |
| #390 Darkvision (Merfolk)          | Low-Light Vision (Merfolk)                       | `1907e542…` → `f31fa95d…` |
| #390 Tremorsense                   | Burrow (Trox)                                    | `3412f0fd…` → `2a87dcc2…` |
| #371 Carnation Scales (Kobold)     | Day Raider                                       | `e5f0b829…` → `789a05d8…` |
| #391 Fey Wisdom                    | Keen Senses (Elf)                                | `d2ece3f8…` → `0dc515f6…` |
| #392 Burning Assurance (Sandkin)   | Intimidating                                     | `56518a48…` → `9a004e09…` |
| #392 Ironsoul (Metal Oread)        | Slow Speed (Oread), Languages (Oread)            | `ca08f9f6…` → `1e3464ab…` |
| #392 Seasinger                     | Low-Light Vision (Merfolk)                       | `454b6d91…` → `64489952…` |
| #392 Rakshasa-Spawn (Beastbrood)   | Darkvision (Tiefling)                            | `c40282fc…` → `ce1089f8…` |
| #392 Peri-Blooded (Emberkin)       | Darkvision (Aasimar)                             | `23772d7d…` → `1c874f01…` |
| #393 Draconic Consular             | Keen Senses (Elf)                                | `4a2e600f…` → `d0d8dd3f…` |
| #393 Trusted Mediator              | Low-Light Vision (Suli)                          | `50089ad6…` → `e86106a7…` |
| #393 Asura-Spawn (Faultspawn)      | Darkvision (Tiefling)                            | `6e6485ff…` → `2e887608…` |
| #394 Spiresworn Elves              | Keen Senses (Elf)                                | `46539a7e…` → `87c9db55…` |
| #394 Tree Stranger                 | Normal Speed (Vanara)                            | `d454924b…` → `95e8c041…` |
| #394 Mountain Clan                 | Intimidating                                     | `0cc7b842…` → `afe98ce5…` |
| #394 Deep Kin                      | Intimidating                                     | `fc36815d…` → `824e91d6…` |
| #395 Garuda-Blooded (Plumekith)    | Darkvision (Aasimar)                             | `e1119272…` → `4afa7adb…` |
| #395 Energy Strike (Acid)          | Energy Strike (Cold)                             | `16085551…` → `1aaccd12…` |
| #395 Arctic Elf                    | Low-Light Vision (Elf)                           | `38c345ce…` → `a719e219…` |
| #395 Nosferatu-Born (Ancient-Born) | Undead Resistance                                | `85c19ac2…` → `30f202d0…` |
| #395 Orc Atavism                   | Intimidating, +2 to One Ability Score (Half-Orc) | `6ca8ab4b…` → `f7ecbca8…` |
| #395 Urbanite                      | Keen Senses (Elf)                                | `5dcd0527…` → `36a12ea6…` |
| #395 Outsear Sahuagin              | Speak with Sharks (Sahuagin)                     | `7e862b38…` → `35e716f8…` |
| #395 Risky Troublemaker            | Prehensile Tail (Vanara)                         | `c134ea99…` → `0bc79309…` |

They are recorded in each batch's inventory `currentBinding` and `tests/fixtures/<batch>/preview.json`. `racial-traits-395.json` and its preview fixture keep their landed `JSON.stringify` layout, so their diff is the re-bind only.

- **Already stale, not re-bound:** 28 assessments that reach batch keys were stale on the base and are unchanged (the deferred stale set): 28 #328 race records.
- **Protected and fixture copies:** no batch key is a protected root or a pinned definition of an earlier batch. `feats-355/binding-preview.json` copies batch keys that no #355 assessment's closure reaches, and the #530 to #536 and #350 to #355 `protected-context.json` lists name batch keys only as seed, closure and source keys.
- **Guard test adjusted:** `cross-batch-bindings.test.ts` modeled "an owner whose replacements differ" for Day Raider with an in-memory owner, assuming no batch owned it. This batch owns Day Raider now, so the test lets the in-memory owner stand in for it (it drops the real owner's fixture); its expectation is unchanged.
- **In-flight batches:** no #547 (buffs) key is in this batch's closures, and no #547 key's closure reaches a batch key. Skilled (Kitsune) is not in this batch's closures, so its #394 explanation is left as it is.

## Binding

Every assessment is bound with `buildAssessmentBinding` against the full-corpus content closure: the final full `catalog:preview` artifact, with the batch's 77 entries and their 180 closure entries. The [preview fixture](../../tests/fixtures/racial-traits-396/preview.json) keeps both, so the batch test rebuilds every binding from a clean shared-store tree (0 mismatches). Pride's and Resistant's Modifiers are their races' re-homed note outputs, which a bounded tree without the race lacks; the test lists them as relocated.

## Tests

The [resolver tests](../../tests/catalog/racial-traits-396.test.ts) pin Azata-Blooded (Musetouched) replacing the aasimar's ability score trait on an aasimar identity sheet (Dexterity 10 to 12, Wisdom 12 to 10), the other curated heritage lines, every Situation-gated bonus (off by default, on when selected), Woodcraft's forest improvement, the shared Situations, Aphorite Resistances' two untyped bonuses not adding, distinct racial Sources stacking (Wayfarer + Evader = +7), the imported values not curated twice, Slag May's melee damage and no `ac.other` armor, shield or natural armor bonus; all 33 required and 77 description records checked, the three covered records and the Note targets; the race, alternate, monster-ability, inherited and Unchained notice dependencies (25 PZO1131 keys, own action versus bound body) and every enforced hold; the importer's reading and the exact unresolved names; every pinned body, PCGen row and PRD paragraph in the shared store; and re-extraction from a clean shared-store tree with every binding reproduced, all 77 records held on their own reasons, and a confirmed Keen Senses (Elf) still held.

The [isolated saved-sheet test](../../tests/catalog/racialTraits396.integration.test.ts) exercises public Convex reads and writes: an aasimar-identity race granting its ability score trait, Skilled (Aasimar) and Darkvision (Aasimar) takes the held Azata-Blooded (Musetouched) and Skilled (Aasimar - Idyllkin) (Dexterity +2, Wisdom -2, Diplomacy -2, Perception -3, Handle Animal +2, Survival +1) and turns them off again, with saved totals equal to the preview; outsiders, anonymous callers and another campaign's entry are refused without changing the sheet. The shared held-release round trip is covered once by the release test in [`traits367.integration.test.ts`](../../tests/catalog/traits367.integration.test.ts). No deployment or production activation occurred.

## Preservation and gates

The shared canonical files gain only this batch's entries: 110 curation records (77 description and 33 note records), 77 assessments, 77 evidence entries and 40 notice holds. The other changes are the listed re-binds (content fingerprints only) with their `currentBinding` and fixture copies, and the guard-test adjustment above. Shared-file diff stat against `b28163b4` (`git diff --stat --diff-algorithm=histogram HEAD`):

```text
 scripts/catalog/legal/held-notices.json           |  380 ++++
 scripts/catalog/legal/racial-traits-387.json      |   10 +-
 scripts/catalog/legal/racial-traits-388.json      |    8 +-
 scripts/catalog/legal/racial-traits-389.json      |    6 +-
 scripts/catalog/legal/racial-traits-390.json      |   12 +-
 scripts/catalog/legal/racial-traits-391.json      |    2 +-
 scripts/catalog/legal/racial-traits-392.json      |   10 +-
 scripts/catalog/legal/racial-traits-393.json      |    6 +-
 scripts/catalog/legal/racial-traits-394.json      |    8 +-
 scripts/catalog/legal/racial-traits-395.json      |   16 +-
 scripts/catalog/legal/traits-371.json             |    2 +-
 scripts/catalog/reviewed-curation.json            | 2284 +++++++++++++++++++++
 src/lib/catalog/data/attribution-assessments.json | 1940 ++++++++++++++++-
 src/lib/catalog/data/attribution-evidence.json    |  231 +++
 tests/catalog/cross-batch-bindings.test.ts        |   10 +-
 tests/fixtures/racial-traits-387/preview.json     |   58 +-
 tests/fixtures/racial-traits-388/preview.json     |   30 +-
 tests/fixtures/racial-traits-389/preview.json     |   14 +-
 tests/fixtures/racial-traits-390/preview.json     |   41 +-
 tests/fixtures/racial-traits-391/preview.json     |    7 +-
 tests/fixtures/racial-traits-392/preview.json     |   34 +-
 tests/fixtures/racial-traits-393/preview.json     |   19 +-
 tests/fixtures/racial-traits-394/preview.json     |   19 +-
 tests/fixtures/racial-traits-395/preview.json     |   65 +-
 tests/fixtures/traits-371/preview.json            |    7 +-
 25 files changed, 5079 insertions(+), 140 deletions(-)
```

<!-- prep:shared-store-count -->

New shared-store files (`tests/fixtures/pinned/`), counted by prep after the rebase onto `25469988`: **93** (pcgen 1, pf1 4, pf1-content 88).

<!-- /prep:shared-store-count -->

The batch adds to the shared store the pinned records of its 100 keys the store lacked, the pf-racial-traits folder records above them, the linked racial traits, three linked pf1 spells (produce flame, psychic reading, status), the Monkey Goblin race record and one PCGen file (the Core Essentials monkey goblin race-ability file); the other race records, PCGen files and PRD pages were already on the base and are reused.

The complete preview of `b28163b4` plus this batch reported **102 admitted, 23,152 held, 2 dependent omissions and 2,326 failures**, 33 fewer than the base's 2,359 (this batch's required note records). No batch key is among the failures. The full-corpus gate is therefore a documented failure, not a claim of whole-corpus readiness.

| Command                                                                                                                                                                                                                               | Result                                                                                                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `catalog:curate --candidates …` (required) and `--descriptions` (prose pass)                                                                                                                                                          | pass; 33 required drafts, 17 prose drafts; about 12 s each                                                                                                                   |
| `catalog:preview --candidates …`                                                                                                                                                                                                      | exit 1; 0 admitted / 37 held / 40 failures, all links and replacements outside the selection                                                                                 |
| Full `catalog:curate`                                                                                                                                                                                                                 | pass; 1,220 new drafts, none for this batch; 0 missing; about 14 min (capped)                                                                                                |
| Full `catalog:preview` (baseline, then final records)                                                                                                                                                                                 | exit 1; 2,359 failures on the base, 2,326 with this batch, no batch key among them; about 9 min each plus admission queue                                                    |
| Full re-bind (`bind.ts`, `xrebind396.ts` over the final full preview)                                                                                                                                                                 | 77 assessments bound, 180 closure entries, 0 mismatches against the clean-tree reconstruction; 40 earlier assessments re-bound, fixtures agree                               |
| `pnpm test` of the batch tests, the guards (`notice-holds`, `pinned-sources`, `cross-batch-bindings`, `batch-ownership-sweep`, `ac-other-defense-bonuses`) and `racial-traits-719`, `race-facts-720`, `race-ability-721` (one worker) | pass after two fixes (the integration test's skill totals include the ability modifier; the `cross-batch-bindings` Day Raider case above); 10 files / 432 tests; about 4 min |
| `pnpm -s typecheck`                                                                                                                                                                                                                   | pass                                                                                                                                                                         |
| `pnpm -s lint`                                                                                                                                                                                                                        | pass; about 2.5 min                                                                                                                                                          |
| `pnpm -s check:initial-migration-writers`                                                                                                                                                                                             | pass; 185 registrations                                                                                                                                                      |
| `pnpm catalog:pin`                                                                                                                                                                                                                    | pass; `sha256:005ef0b9…`                                                                                                                                                     |
| `pnpm catalog:notice-deps`                                                                                                                                                                                                            | pass; 0 gaps; 39 advisory warnings, none for this batch                                                                                                                      |
| `pnpm catalog:format --check`                                                                                                                                                                                                         | pass                                                                                                                                                                         |

`pnpm test tests/catalog` was left to the orchestrator's prep run on the rebased commit, as the brief directs.
