# Racial traits #390: pf1-content pf-racial-traits batch 4

Reviewed by **Opus (AI curator) for the owner**, 2026-10-19.

Exactly the issue's 100 ordered, unique keys were reviewed: **0 admitted, 74 specifically held, 0 dependent omissions, 0 whole-entry unsupported/prose-only dispositions, 26 exclusions, 0 record-level 3.5 holds**. The exclusions are 10 Foundry `!folders!` records, which the importer's folder contract leaves out of the Catalog Entries (PRD Decision 17), and 16 records in the Advanced Race Guide Race Builder subtree, which the import contract excludes by folder ancestry ([README](README.md), explicit exclusions) and the [Racial Trait contract](../character-sheet/racial-traits.md) puts out of scope. No candidate carries a `3.5` tag. The 74 in-scope records are 30 standard racial traits (10 of them in flat race folders), 36 alternates, 4 Subrace Standard heritage parts and 4 Subraces-folder heritages or racial subtypes.

The [machine-readable inventory and evidence](../../scripts/catalog/legal/racial-traits-390.json) records, per key, the complete pinned body and inert fields with their source hash and cited sources; the PCGen race-ability rows, PRD Advanced Race Guide paragraphs, leads and rejected rows; the inherited-rule notices with their evidence, the linked bodies and the unresolved origins; the importer's reading of race, standard flag and replacements; every checked curation record, source discrepancies and calculation gaps; and the current assessment binding and mapped facts. This report summarizes them and does not repeat the evidence.

## #328 S4-A launch update

Reviewed 2026-11-01 by **Sol (AI curator) for the owner** ([races-328.md](races-328.md#s4-a-launch-human-dwarf-and-half-orc)). The launch review admits 2 standard racial traits of Human, Dwarf and Half-Orc with confirmed, content-bound assessments; counts are now **2 admitted, 72 held**, with 26 exclusions unchanged. The earlier Opus review of each admitted row stays in its `assessmentHistory`; every other candidate keeps its review and holds.

- **Hardy** (`pf1-content/AO5nhhUfI1b4M37H`): matches the PRD ARG paragraph (`advancedRaceGuide/coreRaces/dwarves.html:367`) apart from "receive" for "gain"; PCGen's Core Essentials row (`dwarf/dwarf_abilities_race.lst:25`). Its Modifiers are +2 racial on saves in the shared Situations poison, spells and spellLike, re-homed from the Dwarf's checked note record; one racial bonus counts once when several Situations apply. Required notices: PZO9280, PZO1121, PZO1110.
- **+2 to One Ability Score (Human)** (`pf1-content/BFszTUJLlDS1ZDB8`): matches the PRD ARG paragraph (`advancedRaceGuide/coreRaces/humans.html:359`) apart from "get" for "gain"; no "racial"; PCGen's Core Essentials row (`human/human_abilities_race.lst:18`). Its Modifier is ability.$choice +2 racial: the player picks the score on the sheet. Required notices: PZO9280, PZO1121, PZO1110.

Each admitted row's whole-content hold ("Book PDFs unavailable") is superseded by this comparison, and it records no notice hold: PZO1110 is reviewed, PZO1121's Registry hold is cleared (owner, 2026-10-30), and PZO9280's reviewed confirmation waives `racial-traits-390-notice-PZO9280-complete-chain`. The batch's `noticeRequirements` rows keep these keys as history. Content fingerprints are unchanged (the imported entries are identical); only the status, rationale, evidence and notice bindings move.

Tests: `racial-traits-390.test.ts` checks the admitted rows with the held ones (`assessedTraits` in the fixture), expects them admitted by the committed gate and records no hold for them.

## Family rulings applied

This batch follows the #387 rulings Sol approved for the family:

1. **Every in-scope record is held** with a whole-content hold: the race records stay held (#328), every cited book's notice chain is held, and no book PDFs are available.
2. **Race abilities.** Every record requires the books its pinned race record cites, recorded as an inherited rule with the race record's location. Dwarf Traits (Duergar), which lets the duergar take dwarf alternate racial traits, also requires the Dwarf race's book.
3. **Alternate framework.** Every alternate records the APG alternate racial trait rule (PZO1115, `apg_abilities_race.lst:86`).
4. **Monster abilities** take the earliest book the pinned Universal Monster Rules page lists: darkvision PZO1127; low-light vision, light sensitivity, scent, tremorsense, natural attacks, resistance, spell resistance and change shape PZO1112; jet PZO1116.
5. **Creature types** (the trox's monstrous humanoid type; Shadow Foe's dark folk and wayang subtypes and Shadow Plane natives) stay named unresolved origins.
6. **PZO1131** for Unchained action-cost metadata anywhere in the bound closure: 15 records (8 on their own actions, 10 through bound bodies).
7. **Comparisons.** PCGen race-ability rows from a pinned book are the `comparison`; Core Essentials support rows (no SOURCELONG book) are leads whose book is not required. 20 records carry a PRD `prdComparison` from the pinned capture (13 match word for word).
8. **Description pass.** Every in-scope record has a checked description record: its reviewed Modifiers plus one entry-level Note with the body (`@Distance` read as feet, `@Condition` as the condition, `@Toggle` buff controls removed).
9. **Racial bonuses from distinct Sources stack**; no gap claims otherwise. Admission policies of #735 do not bear on this batch (no spells or CRB feats).

## Dispositions

| Key                            | Name                                               | Kind             | Disposition                                                      |
| ------------------------------ | -------------------------------------------------- | ---------------- | ---------------------------------------------------------------- |
| `pf1-content/ALR9GkMbRKfG24xw` | Sure Step (Drow)                                   | alternate        | held: `racial-traits-390-whole-content-ALR9GkMbRKfG24xw`         |
| `pf1-content/AN48SbFk5eXftpNZ` | Lucky, Greater                                     | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/AO5nhhUfI1b4M37H` | Hardy                                              | standard         | held: `racial-traits-390-whole-content-AO5nhhUfI1b4M37H`         |
| `pf1-content/AQYBioB3D1EbhppG` | Magma Affinity (Ifrit - Lavasoul)                  | subrace standard | held: `racial-traits-390-whole-content-AQYBioB3D1EbhppG`         |
| `pf1-content/AVRfXZSXqcyehtLa` | Trox                                               | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/AdTesmy8kKMUm2wL` | Lashunta                                           | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/AeRpusxvML1yA3y8` | Immortal Spark                                     | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/AgBhMGlaftYkCH0A` | Alternate Skill Modifiers (Skinwalker - Witchwolf) | subrace standard | held: `racial-traits-390-whole-content-AgBhMGlaftYkCH0A`         |
| `pf1-content/AhKzUgvUAMysEDxU` | Darkvision (Ifrit)                                 | standard         | held: `racial-traits-390-whole-content-AhKzUgvUAMysEDxU`         |
| `pf1-content/AisJptj1zLCA5blH` | Water Affinity                                     | standard         | held: `racial-traits-390-whole-content-AisJptj1zLCA5blH`         |
| `pf1-content/AlkCBC1auwyzpQjs` | Gathlain                                           | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/ApO0RGr2Gzhmn8O3` | Darkvision (Kobold)                                | standard         | held: `racial-traits-390-whole-content-ApO0RGr2Gzhmn8O3`         |
| `pf1-content/AqIpMOjIk0gDJKYu` | Gifted Linguist                                    | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/AqWhtrTEaKeJ9qZ6` | Unstoppable Magic                                  | alternate        | held: `racial-traits-390-whole-content-AqWhtrTEaKeJ9qZ6`         |
| `pf1-content/ArtoWaI22YDsrDHx` | Languages (Strix)                                  | standard         | held: `racial-traits-390-whole-content-ArtoWaI22YDsrDHx`         |
| `pf1-content/AvTDArpprTBmK1bc` | Jester                                             | alternate        | held: `racial-traits-390-whole-content-AvTDArpprTBmK1bc`         |
| `pf1-content/AvVAnxyxjjnvja9E` | Lasting Grudge                                     | alternate        | held: `racial-traits-390-whole-content-AvVAnxyxjjnvja9E`         |
| `pf1-content/Awm5U8aA0n8RoC5o` | Sacred Tattoo                                      | alternate        | held: `racial-traits-390-whole-content-Awm5U8aA0n8RoC5o`         |
| `pf1-content/Ax9nTBosPUTxsSm8` | Energy Strike (Fire)                               | alternate        | held: `racial-traits-390-whole-content-Ax9nTBosPUTxsSm8`         |
| `pf1-content/AzCeQSKFPUO7wO2u` | Light Sensitivity (Kuru)                           | standard         | held: `racial-traits-390-whole-content-AzCeQSKFPUO7wO2u`         |
| `pf1-content/B2D1fGqevyFO0un4` | Dwarf Traits                                       | alternate        | held: `racial-traits-390-whole-content-B2D1fGqevyFO0un4`         |
| `pf1-content/B3cuHM7Ab4p8kLmH` | Languages (Undine)                                 | standard         | held: `racial-traits-390-whole-content-B3cuHM7Ab4p8kLmH`         |
| `pf1-content/B6U6IMKIbklylZ0z` | Transitional Lore                                  | alternate        | held: `racial-traits-390-whole-content-B6U6IMKIbklylZ0z`         |
| `pf1-content/B6r5qb6FBh8SMdQ7` | Mountain-Born                                      | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/B93R81ATGIvP1b5g` | Driven Worker                                      | alternate        | held: `racial-traits-390-whole-content-B93R81ATGIvP1b5g`         |
| `pf1-content/BD8FBL0PfVe5qfrt` | Pyrophile                                          | alternate        | held: `racial-traits-390-whole-content-BD8FBL0PfVe5qfrt`         |
| `pf1-content/BDdZagTVnNqGFBxs` | Hag Racial Trait (Changeling - Veil May)           | subrace standard | held: `racial-traits-390-whole-content-BDdZagTVnNqGFBxs`         |
| `pf1-content/BE3QYzPCTLBEaGzv` | Forlorn Elves                                      | subrace          | held: `racial-traits-390-whole-content-BE3QYzPCTLBEaGzv`         |
| `pf1-content/BFUKz38eVbL0HHi0` | Magic Resistant                                    | alternate        | held: `racial-traits-390-whole-content-BFUKz38eVbL0HHi0`         |
| `pf1-content/BFszTUJLlDS1ZDB8` | +2 to One Ability Score (Human)                    | standard         | held: `racial-traits-390-whole-content-BFszTUJLlDS1ZDB8`         |
| `pf1-content/BHKMNxCT3v9uYQYs` | Daysighted                                         | alternate        | held: `racial-traits-390-whole-content-BHKMNxCT3v9uYQYs`         |
| `pf1-content/BLIEcAnkXmKm2jje` | Fertile Soil                                       | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/BM8w79D9BzKSQqA9` | Advanced                                           | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/BMIxDLXqziDnuMSa` | Keen Senses (Drow)                                 | standard         | held: `racial-traits-390-whole-content-BMIxDLXqziDnuMSa`         |
| `pf1-content/BNpMu00YoQaJyRUt` | Night-Born (Moon May)                              | subrace          | held: `racial-traits-390-whole-content-BNpMu00YoQaJyRUt`         |
| `pf1-content/BO8RYKHYIldtwfI1` | Dirty Trickster                                    | alternate        | held: `racial-traits-390-whole-content-BO8RYKHYIldtwfI1`         |
| `pf1-content/BOkE0vla5gQ1Ro28` | Quick Reactions                                    | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/BRLeKQsuAdgeFbYa` | Toxic Skin                                         | alternate        | held: `racial-traits-390-whole-content-BRLeKQsuAdgeFbYa`         |
| `pf1-content/BU8lLJp14WQHGVoh` | Drow Noble                                         | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/BUkCaVZZwAmcggRQ` | Languages (Triton)                                 | standard         | held: `racial-traits-390-whole-content-BUkCaVZZwAmcggRQ`         |
| `pf1-content/BXrxoCtA5zxBVD2q` | Halo                                               | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/BZvAxBgK3Qcj0J99` | Whispering Wind                                    | alternate        | held: `racial-traits-390-whole-content-BZvAxBgK3Qcj0J99`         |
| `pf1-content/BdP7zBLRqwKpJpgz` | Nagaji                                             | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/BgNdXPtHRUJOuPwF` | Oni-Spawn (Hungerseed)                             | subrace          | held: `racial-traits-390-whole-content-BgNdXPtHRUJOuPwF`         |
| `pf1-content/BgVWmGCg6iPJqElT` | Small                                              | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/BmioT34QBFUeczwK` | Swamp Stride                                       | standard         | held: `racial-traits-390-whole-content-BmioT34QBFUeczwK`         |
| `pf1-content/BoKaaVK4wgIJW1i9` | Spell-Like Ability (Tiefling)                      | standard         | held: `racial-traits-390-whole-content-BoKaaVK4wgIJW1i9`         |
| `pf1-content/BoM8mOnp4b2S8Wza` | Chain Fighter                                      | alternate        | held: `racial-traits-390-whole-content-BoM8mOnp4b2S8Wza`         |
| `pf1-content/BrLS6YIWNz9a7lBw` | Moon-Touched Damage Resistance                     | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/BsjoXUFny0rPD6xc` | Evasive Maneuvers                                  | alternate        | held: `racial-traits-390-whole-content-BsjoXUFny0rPD6xc`         |
| `pf1-content/Bt1g2sR2N1REW8nH` | Fertile Soil                                       | alternate        | held: `racial-traits-390-whole-content-Bt1g2sR2N1REW8nH`         |
| `pf1-content/BvVgHyKfrWZxpi5x` | Industrious Urbanite                               | alternate        | held: `racial-traits-390-whole-content-BvVgHyKfrWZxpi5x`         |
| `pf1-content/BvaJsBlzyFd2czzE` | Orc                                                | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/ByxPR4BiN7Bn8n1R` | Slapping Tail                                      | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/C1PaDJ7bjwWd2U4C` | Ability Modifiers (Changeling - Brine May)         | subrace standard | held: `racial-traits-390-whole-content-C1PaDJ7bjwWd2U4C`         |
| `pf1-content/C2pF36QqsyrsmkFi` | Starchild                                          | alternate        | held: `racial-traits-390-whole-content-C2pF36QqsyrsmkFi`         |
| `pf1-content/C3Q7w4YJ7ALgd1am` | Nature Affinity                                    | alternate        | held: `racial-traits-390-whole-content-C3Q7w4YJ7ALgd1am`         |
| `pf1-content/C4r4Wp69HHAX7XMo` | Alternate                                          | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/C6ShN5EYe8WUtbY1` | Shadow Foe                                         | alternate        | held: `racial-traits-390-whole-content-C6ShN5EYe8WUtbY1`         |
| `pf1-content/C7DoZtwBMutYgHTP` | Surface Infiltrator                                | alternate        | held: `racial-traits-390-whole-content-C7DoZtwBMutYgHTP`         |
| `pf1-content/CE7P9xyXwMPR0YbH` | Darkvision (Merfolk)                               | alternate        | held: `racial-traits-390-whole-content-CE7P9xyXwMPR0YbH`         |
| `pf1-content/CEzqJtWkanQxWqcP` | Fey Thoughts (Half-Elf)                            | alternate        | held: `racial-traits-390-whole-content-CEzqJtWkanQxWqcP`         |
| `pf1-content/CHswbETjpZZan3xy` | Reflexive Improvisation                            | alternate        | held: `racial-traits-390-whole-content-CHswbETjpZZan3xy`         |
| `pf1-content/CIIghsU8K1M5XpKj` | Speak with Sharks (Adaro)                          | standard         | held: `racial-traits-390-whole-content-CIIghsU8K1M5XpKj`         |
| `pf1-content/CKFlDxy9rGtxB8JX` | Gatecrasher                                        | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/CKxKRzXRJPG1TCu0` | Hatred (Svirfneblin)                               | standard         | held: `racial-traits-390-whole-content-CKxKRzXRJPG1TCu0`         |
| `pf1-content/CLqyc1IF6YnKONfI` | Speak with Avians                                  | standard         | held: `racial-traits-390-whole-content-CLqyc1IF6YnKONfI`         |
| `pf1-content/CPOfbE09H9pI8Nhy` | Darkvision (Wayang)                                | standard         | held: `racial-traits-390-whole-content-CPOfbE09H9pI8Nhy`         |
| `pf1-content/CPsAbeWBokaEiZly` | Secret Strider                                     | alternate        | held: `racial-traits-390-whole-content-CPsAbeWBokaEiZly`         |
| `pf1-content/CRk79ejVlfpyi1nB` | Swim Speed (Cecaelia)                              | standard         | held: `racial-traits-390-whole-content-CRk79ejVlfpyi1nB`         |
| `pf1-content/CTGG4ZOaOIvJj09S` | Dimdweller (Half-Orc)                              | alternate        | held: `racial-traits-390-whole-content-CTGG4ZOaOIvJj09S`         |
| `pf1-content/CbGMxMkn1Zm56fqP` | Rodent Empathy                                     | standard         | held: `racial-traits-390-whole-content-CbGMxMkn1Zm56fqP`         |
| `pf1-content/CbUIsaZa8o27Yfs8` | Mouthless                                          | standard         | held: `racial-traits-390-whole-content-CbUIsaZa8o27Yfs8`         |
| `pf1-content/CbUmX1PZrxABz6ob` | Rock Stepper                                       | alternate        | held: `racial-traits-390-whole-content-CbUmX1PZrxABz6ob`         |
| `pf1-content/CcJc9pWgmHCgTmGO` | Fiendish Resistance                                | standard         | held: `racial-traits-390-whole-content-CcJc9pWgmHCgTmGO`         |
| `pf1-content/Cf2TEicv6MHEE698` | Keen Scent (Adaro)                                 | standard         | held: `racial-traits-390-whole-content-Cf2TEicv6MHEE698`         |
| `pf1-content/CfOTLvo8D5bPPSPB` | Standard                                           | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/CmBe4LyfyjQ24hCA` | Jet (Cecaelia)                                     | standard         | held: `racial-traits-390-whole-content-CmBe4LyfyjQ24hCA`         |
| `pf1-content/CmhdInCVqMiadv3T` | Claws (Changeling)                                 | standard         | held: `racial-traits-390-whole-content-CmhdInCVqMiadv3T`         |
| `pf1-content/Cnfo5E1FQnEHb2r2` | Change Shape (Rougarou)                            | standard         | held: `racial-traits-390-whole-content-Cnfo5E1FQnEHb2r2`         |
| `pf1-content/Cwtqj31erWpkSxRM` | Claws                                              | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/CxdqYljBam86Yw6g` | Standard                                           | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/CxulnBwaWUQ8WlpW` | Low-Light Vision (Wyvaran)                         | standard         | held: `racial-traits-390-whole-content-CxulnBwaWUQ8WlpW`         |
| `pf1-content/D2PnYkOxI9fNvp0R` | Nereid Fascination                                 | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/D7JILr96IKHWN4vQ` | Halfling Jinx                                      | alternate        | held: `racial-traits-390-whole-content-D7JILr96IKHWN4vQ`         |
| `pf1-content/D8AVfhkKN6J30OJx` | Darkvision (Munavri)                               | standard         | held: `racial-traits-390-whole-content-D8AVfhkKN6J30OJx`         |
| `pf1-content/D8D7iC2Mp8Z5RHvt` | Outrider                                           | alternate        | held: `racial-traits-390-whole-content-D8D7iC2Mp8Z5RHvt`         |
| `pf1-content/DB36Ptkf1JFl5H37` | Shadow Dodger                                      | alternate        | held: `racial-traits-390-whole-content-DB36Ptkf1JFl5H37`         |
| `pf1-content/DEowtAtiVIQOh2dj` | Dual Minded                                        | alternate        | held: `racial-traits-390-whole-content-DEowtAtiVIQOh2dj`         |
| `pf1-content/DFWkrIYLx6L7Vs6W` | Smokesoul (Fume Sylph)                             | subrace          | held: `racial-traits-390-whole-content-DFWkrIYLx6L7Vs6W`         |
| `pf1-content/DI4TtsaRywLKUWbE` | Darkvision (Cecaelia)                              | standard         | held: `racial-traits-390-whole-content-DI4TtsaRywLKUWbE`         |
| `pf1-content/DJJBP96MRHv0t2Ii` | Shoulder to Shoulder                               | alternate        | held: `racial-traits-390-whole-content-DJJBP96MRHv0t2Ii`         |
| `pf1-content/DLslPcoXcnvQjIPH` | +2 Natural Armor                                   | standard         | held: `racial-traits-390-whole-content-DLslPcoXcnvQjIPH`         |
| `pf1-content/DQtBjJloOxsPOhPB` | Damage Reduction                                   | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/DVHvbNX8hupYkCoJ` | Low-Light Vision                                   | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/DbVNH3xkNdzeYdwL` | Monstrous Humanoid (Trox)                          | standard         | held: `racial-traits-390-whole-content-DbVNH3xkNdzeYdwL`         |
| `pf1-content/DhiYQkB9XHcThkS8` | Tremorsense                                        | alternate        | held: `racial-traits-390-whole-content-DhiYQkB9XHcThkS8`         |
| `pf1-content/Di9Bx0HIUosfwSOu` | Standard                                           | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/DiAFreCRKMIg0Ggl` | Grabbing Appendages                                | standard         | held: `racial-traits-390-whole-content-DiAFreCRKMIg0Ggl`         |
| `pf1-content/DlGjetJ3goyzTtno` | Swamp Leshy                                        | alternate        | held: `racial-traits-390-whole-content-DlGjetJ3goyzTtno`         |

## Notable cases

- **Heritages resolving to a `local/` trait.** Oni-Spawn (Hungerseed) and Smokesoul (Fume Sylph) are two of the 37 `reviewedAbilityLineSubraces`; their ability lines are curated as racial ability Modifiers, as #387 did for Div-Spawn and Rimesoul, so "Base Statistics" resolves to the tiefling's and sylph's `local/race-ability-scores/` traits. The resolver test shows the tiefling's +2 Dex, +2 Int, −2 Cha going dormant for +2 Str, +2 Wis, −2 Cha, and the sylph's +2 Dex, +2 Int, −2 Con for +2 Dex, +2 Cha, −2 Con. Their closures now reach both races and all their standard traits (and PZO1131 through them). Night-Born (Moon May) and Forlorn Elves keep "Base Statistics" unmatched: the moon may's separate ability record replaces the changeling trait by name, and the elf ethnicity is a racial subtype.
- **Ability Modifiers (Changeling - Brine May)** replaces the changeling's ability trait by name with its imported untyped changes (+2 Dex, +2 Wis, −2 Con), as #389's Sorrow May does; the resolver and saved-sheet tests show it.
- **Race-covered and re-homed outputs.** Hardy, Hatred (Svirfneblin) and Rodent Empathy carry their race's checked #328 note outputs (coveredTraitNotes), and +2 Natural Armor carries the Ghoran race's re-homed natural armor; their description records add only the Note (latent overlap). Hardy's +2 against poison, spells and spell-like abilities is the three shared Situations, not stacking within the entry.
- **Shared Situations** only where the condition matches exactly: spell resistance (Unstoppable Magic, on caster level) and dirty trick (Dirty Trickster, on CMB). Everything else is local; the drafter's split Situations are merged into one per rule (Nature Affinity, Shadow Foe, Shadow Dodger).
- **Drafter outputs not used:** Pyrophile's fire spell damage bonus was drafted as a spell DC Modifier and is an entry-level Note (the sheet has no spell damage statistic); the Witchwolf's wild empathy bonus was drafted as a Diplomacy Modifier and is a Note on Diplomacy, as earlier batches keep wild empathy; the Magic Resistant and Shoulder to Shoulder placeholders are a Note and a circumstance Modifier.
- **Bonus types listed for review (#370):** Outrider's raw changes are typed racial where the body says "a +2 bonus"; a change replacement replaces only the formula. Industrious Urbanite's "+4 bonus" is curated untyped although the Foundry note calls it racial.
- **Swamp Leshy** replaces climber and only "alters" unassuming foliage, but its header lists both, so the importer makes unassuming foliage dormant. Listed for review.
- **PRD differences recorded, not resolved:** Spell-Like Ability (Tiefling) reads "character level" where the PRD reads "class level" and adds the bloodline sentence; Hardy, Water Affinity, Languages (Undine), +2 to One Ability Score (Human), Chain Fighter and Dual Minded follow other printings' wording (the CRB or APG).
- **Not modeled, listed:** senses, speeds, spell-like abilities and other actions (poison, jinx, jet, change shape, Firehand), natural attacks, energy resistance and spell resistance, creature types, class-skill grants, languages, bonus feat grants (Starchild, Grabbing Appendages), sorcerer and domain affinities, and the duergar's dwarf trait selection.

## Importer and data gaps

- **Journal-page links (#738).** Darkvision (Merfolk) and Darkvision (Munavri) link Universal Monster Rules journal pages. The importer strips the links, so both records fail admission with `Broken structure or reference: unresolved imported reference.` in any preview, as Irradiate did in #542. The failure does not depend on curation; both stay editorially held.
- **No header, no same-name parent trait (own entry; neither #738 nor #739).** Magma Affinity (Ifrit - Lavasoul) has no "Replaced Trait(s)" header and the ifrit has no trait of that name, so the importer lists its own name as unresolved; the body names no replaced trait.
- **Unresolved replaced names:** Pyrophile ("Hag Trait"; the changeling's trait is named "Hag Racial Trait (Changeling)"). Forlorn Elves and Night-Born keep "Base Statistics" unmatched, as designed.
- **Header that alters rather than replaces:** Swamp Leshy (above).
- The raw upstream keys in `mapRacialTrait` caused no reference failure: the full preview's only batch failures are the two journal-link gaps; the bounded preview's 43 failures are links and replacements outside the selection (and Darkvision (Munavri)'s journal link).
- No linked pf-items record is missing. There is no Orc Atavism, no replacement of a counts-as trait and no multi-race "Base Statistics" folder in this batch.

## Outstanding mechanics

Each record lists its calculation gaps in `mechanicsReview.outstandingCalculations`; none is an attribution hold. The main ones are listed under Notable cases ("Not modeled").

## Cross-batch bindings and protected records

Rebased onto `11a7699c` (#387, #389 and #388 landed). Every re-bind below uses `buildAssessmentBinding` over a full `catalog:preview` of the rebased tree with this batch's records, with the earlier batch's fixture copies of this batch's keys replaced by the full-preview entries (#524: by its own re-import), the inventory `currentBinding` updated and the fixture-based binding checked to agree (all 14 agree). Fingerprints run from the rebased base to now. No disposition, evidence, notice or hold changed in the earlier batches.

| Batch, assessment                                | Reaches (this batch)                               | Content fingerprint       |
| ------------------------------------------------ | -------------------------------------------------- | ------------------------- |
| #524 Fey Boon (`pf1/JYgzYISWlo5CQQg3`)           | Hardy, through the Dwarf race                      | `de980657…` → `aeed1b25…` |
| #371 Carnation Scales (Kobold)                   | Darkvision (Kobold)                                | `aa2e9b8c…` → `e5f0b829…` |
| #375 Good Dreams (Desna; Halfling)               | Halfling Jinx                                      | `df35d091…` → `a4fc6e3a…` |
| #387 Rimesoul (Frost Undine)                     | Water Affinity, Languages (Undine)                 | `fc7d9004…` → `c34500b7…` |
| #387 Div-Spawn (Spitespawn)                      | Spell-Like Ability (Tiefling), Fiendish Resistance | `62455a14…` → `33fd1077…` |
| #387 Light from the Darkness                     | Spell-Like Ability (Tiefling)                      | `2532db73…` → `fc4b998e…` |
| #387 Smite Good                                  | Spell-Like Ability (Tiefling)                      | `5dcd7b0c…` → `865dd87b…` |
| #387 Darklands Guide                             | Keen Senses (Drow)                                 | `156c4955…` → `f51aa2f8…` |
| #388 Siege Survivor                              | Hardy                                              | `45c6313b…` → `56581caf…` |
| #388 Unnatural                                   | Rodent Empathy                                     | `85696d10…` → `a454d742…` |
| #388 Stalwart Watcher                            | Hatred (Svirfneblin)                               | `acffaee4…` → `b87092f2…` |
| #388 Variant Tiefling Abilities                  | Spell-Like Ability (Tiefling)                      | `c0c212e2…` → `1c06ce38…` |
| #389 Viscous Blood                               | Hardy                                              | `139e0828…` → `e62fd3d4…` |
| #389 Spell-Like Ability (Tiefling - Shackleborn) | Spell-Like Ability (Tiefling)                      | `5fb33081…` → `17e179fc…` |

They are recorded in `spells-524/binding-preview.json` (no `currentBinding`) and in each batch's inventory `currentBinding` and `tests/fixtures/<batch>/preview.json` (`traits-371`, `traits-375`, `racial-traits-387`, `racial-traits-388`, `racial-traits-389`).

- **Already stale, not re-bound:** the 24 #328 race assessments and #331's Tail Terror that reach batch keys were stale on the base (the deferred stale set, curation.md).
- This batch's closures reach #388's Stability, Climber and Stonecunning (Dwarf); those entries are bound as the rebased full preview has them.
- The batch tests, `cross-batch-bindings.test.ts` and the affected earlier tests were run after the rebase (see the table below). No pf-traits key is in this batch's closures.

## Binding

Every assessment is bound with `buildAssessmentBinding` against the full-corpus content closure: the final full `catalog:preview` artifact, with the batch's 74 entries and their 178 closure entries. The [preview fixture](../../tests/fixtures/racial-traits-390/preview.json) keeps both, so the batch test rebuilds every binding from a clean shared-store tree (0 mismatches).

## Tests

The [resolver tests](../../tests/catalog/racial-traits-390.test.ts) pin the two heritage replacements against their race sheets, every Situation-gated bonus (off by default, on when selected), the shared and merged Situations, imported and race-supplied values not curated twice, the Brine May and Sure Step replacements and no `ac.other` armor, shield or natural armor bonus; all 37 required and 74 description records checked, the one covered/no-output record and the Note targets; the race, alternate, monster-ability, cited and Unchained notice dependencies (15 PZO1131 keys, own action versus bound body) and every enforced hold; the importer's reading and the exact unresolved names; every pinned body, PCGen row and PRD paragraph in the shared store; and re-extraction from a clean shared-store tree with every binding reproduced, 72 records held on their own reasons, only the two journal-link gaps failing, and a confirmed Hardy still held.

The [isolated saved-sheet test](../../tests/catalog/racialTraits390.integration.test.ts) exercises public Convex reads and writes: a changeling-identity race granting its ability trait and Claws (Changeling) takes the held Brine May ability record and Pyrophile, and turns the record off again, with saved totals equal to the preview; outsiders, anonymous callers and another campaign's entry are refused without changing the sheet. The shared held-release round trip is covered once by the release test in [`traits367.integration.test.ts`](../../tests/catalog/traits367.integration.test.ts). No deployment or production activation occurred.

## Preservation and gates

The shared canonical files gain only this batch's entries: 111 curation records (74 description and 37 note records), 74 assessments, 74 evidence entries and 39 notice holds. The other changes are the listed re-binds with their `currentBinding` and fixture copies. Shared-file diff stat against the rebased base `11a7699c` (`git diff --cached --stat --diff-algorithm=histogram`):

```text
 scripts/catalog/legal/held-notices.json           |  369 ++++++++++
 scripts/catalog/legal/racial-traits-387.json      |   10 +-
 scripts/catalog/legal/racial-traits-388.json      |    8 +-
 scripts/catalog/legal/racial-traits-389.json      |    4 +-
 scripts/catalog/legal/traits-371.json             |    2 +-
 scripts/catalog/legal/traits-375.json             |    2 +-
 scripts/catalog/reviewed-curation.json            | 2311 +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 src/lib/catalog/data/attribution-assessments.json | 1794 ++++++++++++++++++++++++++++++++++++++++++++++-
 src/lib/catalog/data/attribution-evidence.json    |  222 ++++++
 tests/fixtures/racial-traits-387/preview.json     |   37 +-
 tests/fixtures/racial-traits-388/preview.json     |   26 +-
 tests/fixtures/racial-traits-389/preview.json     |   12 +-
 tests/fixtures/spells-524/binding-preview.json    |    7 +-
 tests/fixtures/traits-371/preview.json            |    5 +
 tests/fixtures/traits-375/preview.json            |    5 +
 15 files changed, 4773 insertions(+), 41 deletions(-)
```

<!-- prep:shared-store-count -->
New shared-store files (`tests/fixtures/pinned/`), counted by prep after the rebase onto `11a7699c`: **133** (pcgen 12, pf1 8, pf1-content 112, prd 1).
<!-- /prep:shared-store-count -->

The batch adds to the shared store its 100 pinned records, the pf-racial-traits folder records above them, the pinned race records they bind to, the linked bodies (spells, a feat and racial traits), the PCGen race-ability, class, domain and anchor files the evidence cites, and the PRD capture pages; files already on the base (many from #387) were reused.

The complete preview of the rebased tree (`11a7699c` plus this batch) reported **86 admitted, 23,168 held, 2 dependent omissions and 2,559 failures**; before the rebase it reported 2,642 on `00023d38`, 37 fewer than that base's 2,679 (this batch's required note records). The only batch keys among the failures are the two journal-link gaps, which the base already had. The full-corpus gate is therefore a documented failure, not a claim of whole-corpus readiness.

| Command                                                                                                                                                                                                                                                                                                                                   | Result                                                                                                                                         |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `catalog:curate --candidates …` (required) and `--descriptions` (prose pass)                                                                                                                                                                                                                                                              | pass; 37 required drafts, 13 prose drafts                                                                                                      |
| `catalog:preview --candidates …`                                                                                                                                                                                                                                                                                                          | exit 1; 0 admitted / 31 held / 43 failures, all links and replacements outside the selection (plus Munavri's journal link)                     |
| Full `catalog:curate`                                                                                                                                                                                                                                                                                                                     | pass; 1,536 new drafts, none for this batch; 0 missing; the two known #387 Orang-Pendak race note records stale; about 2.8 min                 |
| Full `catalog:preview` (final records; rebased: 2,559 failures)                                                                                                                                                                                                                                                                           | exit 1; 2,642 failures (base 2,679), the two journal-link gaps the only batch keys; about 4 min plus admission queue                           |
| Full re-bind (`bind.ts`, `xrebind390.ts` over the final full preview)                                                                                                                                                                                                                                                                     | 74 assessments bound, 178 closure entries, 0 mismatches against the clean-tree reconstruction; 14 earlier assessments re-bound, fixtures agree |
| `pnpm test tests/catalog/racial-traits-390.test.ts tests/catalog/racialTraits390.integration.test.ts` (one worker)                                                                                                                                                                                                                        | pass; 2 files / 8 tests                                                                                                                        |
| `pnpm test` of the guards (`notice-holds`, `pinned-sources`, `cross-batch-bindings`, `ac-other-defense-bonuses`, `notice-dependencies`, `data-files`) and the affected earlier tests (`racial-traits-387`, `traits-371`, `traits-375`, `spells-524`, `racial-traits-719`, `race-facts-720`, `race-ability-721`, `races-328`) (one worker) | pass; 14 files / 408 tests; about 3.4 min                                                                                                      |
| `pnpm -s typecheck`                                                                                                                                                                                                                                                                                                                       | pass                                                                                                                                           |
| `pnpm -s lint`                                                                                                                                                                                                                                                                                                                            | pass (after removing one unused test variable); about 2.5 min                                                                                  |
| `pnpm -s check:initial-migration-writers`                                                                                                                                                                                                                                                                                                 | pass; 185 registrations                                                                                                                        |
| `pnpm catalog:pin`                                                                                                                                                                                                                                                                                                                        | pass; `sha256:005ef0b9…`                                                                                                                       |
| `pnpm catalog:notice-deps`                                                                                                                                                                                                                                                                                                                | pass; 0 gaps; 38 advisory warnings, none for this batch                                                                                        |
| `pnpm catalog:format --check`                                                                                                                                                                                                                                                                                                             | pass                                                                                                                                           |

`pnpm test tests/catalog` was left to the orchestrator's prep run on the rebased commit, as the brief directs.
