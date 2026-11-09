# Racial traits #391: pf1-content pf-racial-traits batch 5

Reviewed by **Opus (AI curator) for the owner**, 2026-10-19.

Exactly the issue's 100 ordered, unique keys were reviewed: **0 admitted, 75 specifically held, 0 dependent omissions, 0 whole-entry unsupported/prose-only dispositions, 25 exclusions, 0 record-level 3.5 holds**. The exclusions are 11 Foundry `!folders!` records, which the importer's folder contract leaves out of the Catalog Entries (PRD Decision 17), and 14 records in the Advanced Race Guide Race Builder subtree, which the import contract excludes by folder ancestry ([README](README.md), explicit exclusions) and the [Racial Trait contract](../character-sheet/racial-traits.md) puts out of scope. No candidate carries a `3.5` tag. The 75 in-scope records are 36 standard racial traits (24 in Standard folders, 12 in flat race folders), 34 alternates and 5 Subrace Standard heritage parts.

The [machine-readable inventory and evidence](../../scripts/catalog/legal/racial-traits-391.json) records, per key, the complete pinned body and inert fields with their source hash and cited sources; the PCGen race-ability rows, PRD Advanced Race Guide paragraphs, leads and rejected same-name rows; the inherited-rule notices with their evidence, the linked bodies and the unresolved origins; the importer's reading of race, standard flag and replacements; every checked curation record, source discrepancies and calculation gaps; and the current assessment binding and mapped facts. This report summarizes them and does not repeat the evidence.

## #328 S4-B launch update

Reviewed 2026-11-01 by **Sol (AI curator) for the owner** ([races-328.md](races-328.md#s4-b-launch-half-elf-elf-gnome-and-halfling)). The S4-B launch review confirms 2 standard racial traits of Half-Elf, Elf, Gnome and Halfling with content-bound assessments; counts are now **3 admitted, 72 held**, with 25 exclusions unchanged. The earlier Opus review of each row stays in its `assessmentHistory`; every other candidate keeps its review and holds.

- **Hatred (Gnome)** (`pf1-content/FD2SILZXcIMjauvr`): matches the PRD ARG paragraph (`advancedRaceGuide/coreRaces/gnomes.html:372`) word for word; PCGen's Core Essentials row (`gnome/gnome_abilities_race.lst:24`) with the recorded DESC differences. Its Modifiers are +1 untyped attack in two local Situations (humanoids of the reptilian subtype; of the goblinoid subtype), re-homed from the Gnome's checked note record; conditional, never unconditional. Required notices: PZO9280, PZO1121, PZO1110.
- **Weapon Familiarity (Elf)** (`pf1-content/GS07eqHZBCT979tA`): matches the PRD ARG paragraph (`advancedRaceGuide/coreRaces/elves.html:371`) word for word; PCGen's Core Essentials row (`elf/elf_abilities_race.lst:25`) word for word. It grants weapon Proficiencies Longbow, Longsword, Rapier and Shortbow (weaponProf); the composite bows match no pinned weapon base type and stay prose. Required notices: PZO9280, PZO1121, PZO1110. Outstanding: Composite Longbow and Composite Shortbow proficiency stay readable (no pinned weapon base type matches, #720). Treating weapons with "elven" in their name as martial weapons stays prose (#740).

Each row's whole-content hold ("Book PDFs unavailable") is superseded by this comparison, and it records no notice hold: PZO1110 is reviewed, PZO1121's Registry hold and `racial-traits-391-notice-PZO1121-complete-chain` are cleared (`notice-clearances.json`, owner 2026-10-30), and PZO9280's reviewed confirmation waives `racial-traits-391-notice-PZO9280-complete-chain`. The batch's `noticeRequirements` rows keep these keys as history. Content fingerprints are unchanged (the imported entries are identical); only the status, rationale, evidence and notice bindings move.

Tests: `racial-traits-391.test.ts` checks the confirmed rows with the held ones (`assessedTraits` in the fixture), expects them admitted by the committed gate and records no hold for them. `racialTraits391.integration` now expects Weapon Familiarity (Elf) admitted; its two alternates stay held.

## #328 S4-A launch update

Reviewed 2026-11-01 by **Sol (AI curator) for the owner** ([races-328.md](races-328.md#s4-a-launch-human-dwarf-and-half-orc)). The launch review admits 1 standard racial trait of Human, Dwarf and Half-Orc with confirmed, content-bound assessments; counts are now **1 admitted, 74 held**, with 25 exclusions unchanged. The earlier Opus review of each admitted row stays in its `assessmentHistory`; every other candidate keeps its review and holds.

- **Weapon Familiarity (Dwarf)** (`pf1-content/GfQrx1OHTdOIVAWb`): matches the PRD ARG paragraph (`advancedRaceGuide/coreRaces/dwarves.html:370`) word for word; PCGen's Core Essentials row (`dwarf/dwarf_abilities_race.lst:28`). It grants weapon Proficiencies Battle Axe, Heavy Pick and Warhammer (weaponProf). Required notices: PZO9280, PZO1121, PZO1110. Outstanding: Treating weapons with "dwarven" in their name as martial weapons stays prose (#740).

Each admitted row's whole-content hold ("Book PDFs unavailable") is superseded by this comparison, and it records no notice hold: PZO1110 is reviewed, PZO1121's Registry hold is cleared (owner, 2026-10-30), and PZO9280's reviewed confirmation waives `racial-traits-391-notice-PZO9280-complete-chain`. The batch's `noticeRequirements` rows keep these keys as history. Content fingerprints are unchanged (the imported entries are identical); only the status, rationale, evidence and notice bindings move.

Tests: `racial-traits-391.test.ts` checks the admitted rows with the held ones (`assessedTraits` in the fixture), expects them admitted by the committed gate and records no hold for them.

## Family rulings applied

This batch follows the #387 rulings Sol approved for the family:

1. **Every in-scope record is held** with a whole-content hold: the race records stay held (#328), every cited book's notice chain is held, and no book PDFs are available.
2. **Race abilities.** Every record requires the books its pinned race record cites, recorded as an inherited rule with the race record's location. Insidious Telepathy has no linked race (see Notable cases); it records both pinned lashunta race records (PZO9280).
3. **Alternate framework.** Every record in an Alternate folder records the APG alternate racial trait rule (PZO1115, `apg_abilities_race.lst:86`).
4. **Monster abilities** take the earliest book the pinned Universal Monster Rules page lists: darkvision PZO1127; low-light vision, scent, amphibious, natural attacks, change shape, light blindness and telepathy PZO1112.
5. **Creature types** (Sahuagin, Locathah, Ganzi, Shabti, Ifrit, Gillman) stay named unresolved origins.
6. **PZO1131** for Unchained action-cost metadata anywhere in the bound closure: 22 records (16 on their own actions, 18 through bound bodies).
7. **Comparisons.** PCGen race-ability rows from a pinned book are the `comparison`; Core Essentials support rows (no SOURCELONG book) are leads whose book is not required. 15 records carry a PRD `prdComparison` from the pinned capture; all 15 match word for word.
8. **Description pass.** Every in-scope record has a checked description record: its reviewed Modifiers plus one entry-level Note with the body, `@Distance` read as feet (`@Distance[1 ft;dual]` as "1 foot").
9. **Racial bonuses from distinct Sources stack**; no gap claims otherwise (the resolver test adds Fosterling's and Garrulous' +2 racial Diplomacy to +4).

## Dispositions

| Key                            | Name                                                    | Kind             | Disposition                                                      |
| ------------------------------ | ------------------------------------------------------- | ---------------- | ---------------------------------------------------------------- |
| `pf1-content/DmLTYUPxopWDWieS` | Terrifying Croak                                        | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/DnOCuttDe4ish4w7` | Languages (Locathah)                                    | standard         | held: `racial-traits-391-whole-content-DnOCuttDe4ish4w7`         |
| `pf1-content/DrDUkvfcwfcx6AP9` | Race Builder                                            | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/Drhj8jWJrmopXD5K` | Subraces                                                | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/DsH7y38wfWDPCINE` | Heart of the Sun                                        | alternate        | held: `racial-traits-391-whole-content-DsH7y38wfWDPCINE`         |
| `pf1-content/DuDqaejBaS9O9bSn` | Institutional Memory                                    | alternate        | held: `racial-traits-391-whole-content-DuDqaejBaS9O9bSn`         |
| `pf1-content/DuFNFt2YIoJ9KYif` | Sticky Tendrils                                         | alternate        | held: `racial-traits-391-whole-content-DuFNFt2YIoJ9KYif`         |
| `pf1-content/DxVHodTFIi9AwMvr` | In the Shadows                                          | alternate        | held: `racial-traits-391-whole-content-DxVHodTFIi9AwMvr`         |
| `pf1-content/DygcxOxDwuPpJmm6` | Behind the Veil (Gnome)                                 | alternate        | held: `racial-traits-391-whole-content-DygcxOxDwuPpJmm6`         |
| `pf1-content/DyrdgHiQStt2znkE` | Languages (Kitsune)                                     | standard         | held: `racial-traits-391-whole-content-DyrdgHiQStt2znkE`         |
| `pf1-content/E0JttnfFJ8Zz2pN9` | Monstrous Humanoid (Sahuagin)                           | standard         | held: `racial-traits-391-whole-content-E0JttnfFJ8Zz2pN9`         |
| `pf1-content/E1pwA6cwxeoiLZHG` | Low-Light Vision (Vishkanya)                            | standard         | held: `racial-traits-391-whole-content-E1pwA6cwxeoiLZHG`         |
| `pf1-content/E7eUF79r7CBaD5z0` | Strix                                                   | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/E8oONe3xMLCowfoc` | Insidious Telepathy                                     | alternate        | held: `racial-traits-391-whole-content-E8oONe3xMLCowfoc`         |
| `pf1-content/E9mTdkJuwxNmW94n` | Merfolk                                                 | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/EEHp8xTA5wbN1b0x` | Natural Climber (Grippli)                               | standard         | held: `racial-traits-391-whole-content-EEHp8xTA5wbN1b0x`         |
| `pf1-content/EEjvlHbyXB1yYEgU` | Shadow Speaker                                          | alternate        | held: `racial-traits-391-whole-content-EEjvlHbyXB1yYEgU`         |
| `pf1-content/EFBMrsOLT7KAGFGg` | Natural Armor (Adaro)                                   | standard         | held: `racial-traits-391-whole-content-EFBMrsOLT7KAGFGg`         |
| `pf1-content/EFIBFtuPXO0SE4U8` | Aquatic (Locathah)                                      | standard         | held: `racial-traits-391-whole-content-EFIBFtuPXO0SE4U8`         |
| `pf1-content/EGuKja9c59lImGX4` | Low-Light Vision (Triton)                               | standard         | held: `racial-traits-391-whole-content-EGuKja9c59lImGX4`         |
| `pf1-content/EKWfbMe0RnUmFJ6e` | Gliding Wings (Kobold)                                  | alternate        | held: `racial-traits-391-whole-content-EKWfbMe0RnUmFJ6e`         |
| `pf1-content/EO0iWRFTSMCzHAXq` | Yamaraj's Baliff                                        | alternate        | held: `racial-traits-391-whole-content-EO0iWRFTSMCzHAXq`         |
| `pf1-content/EPHSQElGyQgaeplx` | Shadowplay (Gnome)                                      | alternate        | held: `racial-traits-391-whole-content-EPHSQElGyQgaeplx`         |
| `pf1-content/EQELT4ORTRAZs06D` | Drow Magic                                              | alternate        | held: `racial-traits-391-whole-content-EQELT4ORTRAZs06D`         |
| `pf1-content/ETapFH3D6SF1WwVn` | Spell-Like Ability (Tiefling - Beastbrood)              | subrace standard | held: `racial-traits-391-whole-content-ETapFH3D6SF1WwVn`         |
| `pf1-content/EUcZujQ4IkzBmgry` | Heart of the Streets                                    | alternate        | held: `racial-traits-391-whole-content-EUcZujQ4IkzBmgry`         |
| `pf1-content/EWlSORpWSJdUosoS` | Xenophobic                                              | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/EYjUNGh2RPUDSQDb` | Standard                                                | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/EbnxHOByXWYcmqYe` | Defensive Training (Svirfneblin)                        | standard         | held: `racial-traits-391-whole-content-EbnxHOByXWYcmqYe`         |
| `pf1-content/EcM8TweX9XxkP724` | Celestial Crusader                                      | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/EhjgQaZ2FinkiBwa` | Subrace                                                 | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/Emdj8uxVBAqovMK3` | Fosterling                                              | alternate        | held: `racial-traits-391-whole-content-Emdj8uxVBAqovMK3`         |
| `pf1-content/Eodq2jHbtqwdKI0v` | Blightborn                                              | alternate        | held: `racial-traits-391-whole-content-Eodq2jHbtqwdKI0v`         |
| `pf1-content/EpCqVk4zDone92PP` | Standard                                                | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/EpMVtxBLnkAejMM4` | Senses (Rougarou)                                       | standard         | held: `racial-traits-391-whole-content-EpMVtxBLnkAejMM4`         |
| `pf1-content/EwrAFmarDQhmHDpK` | Strongtail                                              | alternate        | held: `racial-traits-391-whole-content-EwrAFmarDQhmHDpK`         |
| `pf1-content/EzvNFH1kpPDFx8rP` | Water Sense                                             | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/F22dd0H1yM74ocb4` | Garrulous                                               | alternate        | held: `racial-traits-391-whole-content-F22dd0H1yM74ocb4`         |
| `pf1-content/F2j2piaRH1DBhohG` | Weather Savvy                                           | alternate        | held: `racial-traits-391-whole-content-F2j2piaRH1DBhohG`         |
| `pf1-content/F3Z1TP7Oz3342lE1` | Object of Desire                                        | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/F6e0vnGCV8OO2tyz` | Deft Swords                                             | alternate        | held: `racial-traits-391-whole-content-F6e0vnGCV8OO2tyz`         |
| `pf1-content/F9EySW6oowVAOWa4` | Toxic                                                   | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/FBwKPoaazy72uMFW` | Sociable                                                | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/FD2SILZXcIMjauvr` | Hatred (Gnome)                                          | standard         | held: `racial-traits-391-whole-content-FD2SILZXcIMjauvr`         |
| `pf1-content/FEio8LbQwTnCeXc4` | Shadow Travel                                           | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/FEu0wt9x3Vzny6ur` | Comprehensive Education                                 | alternate        | held: `racial-traits-391-whole-content-FEu0wt9x3Vzny6ur`         |
| `pf1-content/FFlAmgYJfOULGv0Z` | Darkvision (Drow)                                       | standard         | held: `racial-traits-391-whole-content-FFlAmgYJfOULGv0Z`         |
| `pf1-content/FJHJNZFjwC1tvKnM` | Slimehunter                                             | alternate        | held: `racial-traits-391-whole-content-FJHJNZFjwC1tvKnM`         |
| `pf1-content/FKD0hz8VRsVIsfcb` | Languages (Grindylow)                                   | standard         | held: `racial-traits-391-whole-content-FKD0hz8VRsVIsfcb`         |
| `pf1-content/FKDbnASBn1Lhdspf` | Superior Darkvision                                     | standard         | held: `racial-traits-391-whole-content-FKDbnASBn1Lhdspf`         |
| `pf1-content/FKiLZeX0mgKgr8bH` | Amphibious (Cecaelia)                                   | standard         | held: `racial-traits-391-whole-content-FKiLZeX0mgKgr8bH`         |
| `pf1-content/FNERRlnZL8mWZLLL` | Alternate Spell-Like Ability (Skinwalker - Bloodmarked) | subrace standard | held: `racial-traits-391-whole-content-FNERRlnZL8mWZLLL`         |
| `pf1-content/FOZo7WYLv1nrMiUm` | Wildfire Heart                                          | alternate        | held: `racial-traits-391-whole-content-FOZo7WYLv1nrMiUm`         |
| `pf1-content/FTP7h1bfD3Zkmf2N` | Daylight Adaptation                                     | alternate        | held: `racial-traits-391-whole-content-FTP7h1bfD3Zkmf2N`         |
| `pf1-content/FTeB36YtoshjvAUD` | Standard                                                | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/FVArwvrXwcHJtdNz` | Skilled (Tiefling - Faultspawn)                         | subrace standard | held: `racial-traits-391-whole-content-FVArwvrXwcHJtdNz`         |
| `pf1-content/FVyCe9ASrrxnXeyx` | Alternate Spell-Like Ability (Skinwalker - Nightskulk)  | subrace standard | held: `racial-traits-391-whole-content-FVyCe9ASrrxnXeyx`         |
| `pf1-content/FWRhefdBhdDvKS1N` | Languages (Svirfneblin)                                 | standard         | held: `racial-traits-391-whole-content-FWRhefdBhdDvKS1N`         |
| `pf1-content/FXD9eTa4oocJE80N` | Green Martian                                           | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/FZ6FgKC8g50F07A4` | Slow (Yaddithian)                                       | standard         | held: `racial-traits-391-whole-content-FZ6FgKC8g50F07A4`         |
| `pf1-content/Fjtdhz01XBO393UX` | Native Outsider (Ganzi)                                 | standard         | held: `racial-traits-391-whole-content-Fjtdhz01XBO393UX`         |
| `pf1-content/FkNwNCexIJKOgtY2` | Immortal Spark                                          | alternate        | held: `racial-traits-391-whole-content-FkNwNCexIJKOgtY2`         |
| `pf1-content/FmU1AoSsE69xIeLH` | Sea Longing                                             | standard         | held: `racial-traits-391-whole-content-FmU1AoSsE69xIeLH`         |
| `pf1-content/Foqsm1jgAOgvnWCV` | Prehensile Tail (Kobold)                                | alternate        | held: `racial-traits-391-whole-content-Foqsm1jgAOgvnWCV`         |
| `pf1-content/Fp6j8NnotqIeb4M9` | Weapon Familiarity (Grippli)                            | standard         | held: `racial-traits-391-whole-content-Fp6j8NnotqIeb4M9`         |
| `pf1-content/FyjBYbqlBore4xy6` | Darkvision (Grindylow)                                  | standard         | held: `racial-traits-391-whole-content-FyjBYbqlBore4xy6`         |
| `pf1-content/FzTVEjj30jIOfvMw` | Sensitive Breath                                        | standard         | held: `racial-traits-391-whole-content-FzTVEjj30jIOfvMw`         |
| `pf1-content/Fzzd5GnZy7J7wU8j` | Ice Affinity (Undine - Rimesoul)                        | subrace standard | held: `racial-traits-391-whole-content-Fzzd5GnZy7J7wU8j`         |
| `pf1-content/G3dZnTfFV6wwUr3F` | Scent (Ratfolk)                                         | alternate        | held: `racial-traits-391-whole-content-G3dZnTfFV6wwUr3F`         |
| `pf1-content/G8wXEXBfUKfRxuVV` | Hag Racial Trait (Changeling - Crawling Skin)           | standard         | held: `racial-traits-391-whole-content-G8wXEXBfUKfRxuVV`         |
| `pf1-content/GAl4uN1LEs0n1Klg` | Kitsune                                                 | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/GBfKld1Iw8C2wtli` | Heart of the Mountains                                  | alternate        | held: `racial-traits-391-whole-content-GBfKld1Iw8C2wtli`         |
| `pf1-content/GENwJfgCsFdCsTfj` | Silver Tongued                                          | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/GL7VJG5KSRQDF4GS` | Blood Enmity                                            | alternate        | held: `racial-traits-391-whole-content-GL7VJG5KSRQDF4GS`         |
| `pf1-content/GMSMVTSLsR4Trj5Q` | Amphibious (Gillman)                                    | standard         | held: `racial-traits-391-whole-content-GMSMVTSLsR4Trj5Q`         |
| `pf1-content/GMpkUiwCUgKZCObs` | Native Outsider (Shabti)                                | standard         | held: `racial-traits-391-whole-content-GMpkUiwCUgKZCObs`         |
| `pf1-content/GPTaknbsCtOjUD6g` | Spell-Like Ability, At-Will                             | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/GS07eqHZBCT979tA` | Weapon Familiarity (Elf)                                | standard         | held: `racial-traits-391-whole-content-GS07eqHZBCT979tA`         |
| `pf1-content/GSkWHI5OKIScXKx3` | Fey Wisdom                                              | alternate        | held: `racial-traits-391-whole-content-GSkWHI5OKIScXKx3`         |
| `pf1-content/GXOXQzqwFrQ7ECS9` | Breath Weapon                                           | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/GXxza7xp8jSXG1kM` | Fey Magic (Gnome - HftF)                                | alternate        | held: `racial-traits-391-whole-content-GXxza7xp8jSXG1kM`         |
| `pf1-content/GdNaHGhrfNIfChvl` | Poison Use (Vishkanya)                                  | standard         | held: `racial-traits-391-whole-content-GdNaHGhrfNIfChvl`         |
| `pf1-content/GfHikcU2W5jAIyT8` | Poison Minion (Elf)                                     | alternate        | held: `racial-traits-391-whole-content-GfHikcU2W5jAIyT8`         |
| `pf1-content/GfQrx1OHTdOIVAWb` | Weapon Familiarity (Dwarf)                              | standard         | held: `racial-traits-391-whole-content-GfQrx1OHTdOIVAWb`         |
| `pf1-content/GgPKX9hJt82hYYxg` | Natural Armor (Locathah)                                | standard         | held: `racial-traits-391-whole-content-GgPKX9hJt82hYYxg`         |
| `pf1-content/GjiRIP6omZLo0j4y` | Samsaran Magic                                          | standard         | held: `racial-traits-391-whole-content-GjiRIP6omZLo0j4y`         |
| `pf1-content/GkuTWhbg0qcsr11b` | Glide                                                   | alternate        | held: `racial-traits-391-whole-content-GkuTWhbg0qcsr11b`         |
| `pf1-content/GlLRGgDP90v3uQFm` | Claws (Yaddithian)                                      | standard         | held: `racial-traits-391-whole-content-GlLRGgDP90v3uQFm`         |
| `pf1-content/GnO1Z83Jk3OBOvYt` | Spell-Like Abilities (Gathlain)                         | standard         | held: `racial-traits-391-whole-content-GnO1Z83Jk3OBOvYt`         |
| `pf1-content/GomZXQmRgIHlFsdn` | Plagueborn                                              | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/GpvcLgStLsR1U6aj` | Resistant                                               | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/GvDRYlMwK8yy6Wlj` | Cautious Brawler                                        | alternate        | held: `racial-traits-391-whole-content-GvDRYlMwK8yy6Wlj`         |
| `pf1-content/Gw3TLh4PZtyPzAwf` | Humanoid                                                | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/GyJ1zrZi3yP17xN6` | Spell-Like Ability (Munavri)                            | standard         | held: `racial-traits-391-whole-content-GyJ1zrZi3yP17xN6`         |
| `pf1-content/H0DVYfdF81BZBzGL` | Surreptitious                                           | alternate        | held: `racial-traits-391-whole-content-H0DVYfdF81BZBzGL`         |
| `pf1-content/H1YJQ8kSvDqfq09q` | Water Bond                                              | standard         | held: `racial-traits-391-whole-content-H1YJQ8kSvDqfq09q`         |
| `pf1-content/H1bYc9y68ZKt1auL` | Dragon Magic                                            | alternate        | held: `racial-traits-391-whole-content-H1bYc9y68ZKt1auL`         |
| `pf1-content/H47fjaQE7ayPOVqt` | Native Outsider (Ifrit)                                 | standard         | held: `racial-traits-391-whole-content-H47fjaQE7ayPOVqt`         |
| `pf1-content/H4spRGnLY4FijVWz` | Standard                                                | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/H59daebatbCBLoKq` | Change Shape (Reptoid)                                  | standard         | held: `racial-traits-391-whole-content-H59daebatbCBLoKq`         |

## Notable cases

- **Dragon Magic (reviewed change replacement, listed for review).** Foundry gives the record a +2 racial Perception change the body does not state (its header names Elven Magic as the replaced trait, not keen senses); PCGen `lod_abilities_race.lst:18` has no Perception bonus either. A new row in [`reviewed-change-replacements.ts`](../../scripts/catalog/reviewed-change-replacements.ts) sets its formula to 0. No other assessment's content closure covers Dragon Magic, so only its own binding reflects it. The resolver and saved-sheet tests show it adds no Perception.
- **Insidious Telepathy (no linked race).** The record's folder is "Lashunta", but the pinned race records are "Lashunta (Male)" and "Lashunta (Female)", which link no trait record ([README](README.md), Racial Trait Grants). The importer leaves `raceKeys` empty and still resolves Lashunta Magic as the replaced trait. Both race records' book (PZO9280) is recorded from the race records. Its +1 racial bonus is one Situation on the seven Charisma-based skills (the precedent list); the Charisma check bonus stays an entry-level Note; telepathy (PZO1112) is recorded.
- **Replacements shown on the sheet.** Fey Wisdom replaces Keen Senses (Elf): its +2 Perception goes dormant for +1 Diplomacy and Knowledge (nature) (resolver and saved-sheet tests). Skilled (Tiefling - Faultspawn) replaces Skilled (Tiefling) (#389) by name: Bluff and Stealth go dormant for Appraise and Knowledge (local).
- **Situations.** Shared only where the condition matches exactly: death (Immortal Spark). Local Situations elsewhere; Heart of the Sun's and Blightborn's two racial bonuses are two Situations on one entry and don't stack. Blightborn's necromancy and curse bonus is not the shared spells Situation. In the Shadows (two chosen skills) and Comprehensive Education (+1 on each Knowledge skill that is a class skill from class levels) put one choice Situation on each skill, because their raw changes have no target.
- **Race totals unchanged (#719 check).** Change Shape (Reptoid)'s Disguise note is explicit covered/no-output: the Reptoid race's checked #328 description record already supplies the +10 (latent overlap). Hag Racial Trait (Changeling - Crawling Skin)'s +2 Disguise for a blood hag's daughter stays a Note on Disguise and an outstanding calculation, because the changeling race grants every hag option at once (see Importer gaps); a Modifier would offer it to every changeling.
- **Heart of the Streets.** Foundry applies the +1 racial Reflex always and the dodge AC bonus only beside two allies; the body's "when adjacent to at least two other allies" may govern both. The imported reading is kept and listed for review.
- **Cautious Brawler** gets its +1 racial bonus on damage, not attack, as the body says. **Fey Magic (Gnome - HftF)**'s +1 compulsion DC is a Situation on spell DCs (the sheet has no subschool condition).
- **Inherited rules the bodies name:** the boreal bloodline and Ice subdomain (APG) for Ice Affinity (Rimesoul); lesser age resistance (the linked Ultimate Magic buff) for Immortal Spark; object reading (Occult Adventures) for Spell-Like Ability (Munavri); feather step (APG) for Spell-Like Abilities (Gathlain). The shadow descriptor (Shadowplay), the curse descriptor (Blightborn), the aboleth (Slimehunter) and "swordlike weapon" (Deft Swords) stay named unresolved origins: no pinned body cites their books.
- **Rejected rows:** the Tian Xia kitsune language rows (PZO9421, PZO9240; cited by the record anyway), the feyborn Fey Magic row (Heroes of the Wild, PZO9456, not required) and the tiefling's own Skilled and Spell-Like Ability Core Essentials rows for the two tiefling heritage parts.
- **Not modeled, listed:** senses, speeds, natural attacks, spell-like abilities and change shape actions, creature types, class-skill grants, languages, using Wisdom for Bluff and Diplomacy (Yamaraj's Baliff), altitude acclimation, energy and climate rules, composite bow proficiency and "treat as martial" clauses (#720).

## Importer and data gaps

- **Changeling hag options (own entry; neither #738 nor #739).** Hag Racial Trait (Changeling - Crawling Skin) is filed under Standard, so the changeling race grants it together with every other hag racial trait option, although the body gives one by the mother's hag type. Its Disguise bonus therefore stays a Note.
- **Header gaps (own entry).** Daylight Adaptation's body removes light blindness, but its header names only Spell Resistance, so the drow keep Light Blindness granted. Ice Affinity (Undine - Rimesoul) has no header and no undine trait of its name, so the importer lists its own name as unresolved (as Magma Affinity in #390).
- **Unresolved replaced names (own entry):** Sticky Tendrils ("Racial Fly Speed") and Blood Enmity ("Invisibility Spell-Like Ability"): the gathlain and duergar traits have other names.
- **Unlinked race (known):** Insidious Telepathy, as above (README, Racial Trait Grants).
- **#738 journal links:** Amphibious (Cecaelia) links the Universal Monster Rules page and Spell-Like Ability (Munavri)'s action links the skills journal; both fail admission with "unresolved imported reference" in any preview, independent of curation.
- The raw upstream keys in `mapRacialTrait` caused no reference failure: the full preview has no failure for any batch key except the two #738 links; the bounded preview's other failures are links and replacements outside the selection.
- No linked pf-items record is missing. There is no Orc Atavism, no replacement of a counts-as trait, no heritage resolving to a `local/` trait and no multi-race "Base Statistics" folder in this batch.

## Outstanding mechanics

Each record lists its calculation gaps in `mechanicsReview.outstandingCalculations`; none is an attribution hold. The main ones are listed under Notable cases ("Not modeled").

## Cross-batch bindings and protected records

- **Rebased onto #390 (`1fe016bc`, after #388 `11a7699c`).** The batch's description Notes change the content of Weapon Familiarity (Elf), Weapon Familiarity (Dwarf), Drow Magic, Superior Darkvision, Hatred (Gnome) and Darkvision (Drow), which landed assessments reach. All re-binds use `buildAssessmentBinding` over a full `catalog:preview` of the rebased tree (the authority), with the earlier batch's fixture copy and inventory `currentBinding` updated and every fixture-based binding checked to agree (13 of 13). Nothing else changed in those batches.
- **13 landed assessments re-bound; all 13 content fingerprints change** against the rebased base `1fe016bc`, which lacks this batch's Notes (before → after this batch):

  | Assessment (batch)                     | Reaches                    | Content fingerprint       |
  | -------------------------------------- | -------------------------- | ------------------------- |
  | Fey Boon `pf1/JYgzYISWlo5CQQg3` (#524) | Weapon Familiarity (Dwarf) | `aeed1b25…` → `1c2dc1f0…` |
  | Ekujae Elves (#387)                    | Weapon Familiarity (Elf)   | `f50133fe…` → `c7051e69…` |
  | Jininese Elves (#387)                  | Weapon Familiarity (Elf)   | `216089e2…` → `6b97f584…` |
  | Aquatic Elves (#388)                   | Weapon Familiarity (Elf)   | `98150aa2…` → `03117f36…` |
  | Drow-Descended (#389)                  | Drow Magic                 | `7f203f86…` → `445c683c…` |
  | Fey Thoughts (Elf) (#389)              | Weapon Familiarity (Elf)   | `62927e7d…` → `a90518df…` |
  | Human-Raised (Elf) (#389)              | Weapon Familiarity (Elf)   | `98293665…` → `63bbf110…` |
  | Shadowhunter (Elf) (#389)              | Weapon Familiarity (Elf)   | `d8b62126…` → `9c066f1a…` |
  | Forlorn Elves (#390)                   | Weapon Familiarity (Elf)   | `cef5bda1…` → `4f5fdc05…` |
  | Daysighted (#390)                      | Superior Darkvision        | `2498c8be…` → `851e5ae7…` |
  | Dirty Trickster (#390)                 | Hatred (Gnome)             | `4ae664d4…` → `34885c6e…` |
  | Shadow Foe (#390)                      | Hatred (Gnome)             | `55cd0454…` → `eae166db…` |
  | Surface Infiltrator (#390)             | Darkvision (Drow)          | `a839f412…` → `0199dd6f…` |

  The "before" values are those on `1fe016bc` (Fey Boon's as #390 left it). Compared with this batch's own pre-rebase curation on `a1fc7966`, the six #387 and #389 values are unchanged by the rebase (#388 and #390 add nothing to their closures), and Fey Boon moved from `3b660b22…` to `1c2dc1f0…`.

- **This batch, re-bound after the rebase:** Spell-Like Ability (Tiefling - Beastbrood) (`fa6583ff…` → `6409b4de…`), which reaches #390's Spell-Like Ability (Tiefling). The other 74 bindings equal their pre-rebase values.
- They are recorded in `tests/fixtures/spells-524/binding-preview.json` (#524's own bounded re-import of Weapon Familiarity (Dwarf); #524's inventory records no `currentBinding`), `scripts/catalog/legal/racial-traits-387.json` to `racial-traits-390.json` (`currentBinding`) and `tests/fixtures/racial-traits-387/preview.json` to `racial-traits-390/preview.json` (closure copies); those batches' tests and `cross-batch-bindings.test.ts` check them. Skilled (Tiefling) (#389), which Faultspawn replaces, is uncurated here and keeps its binding.
- **Already stale, not re-bound:** the 29 #328 race assessments that reach batch keys and #333's Extra Gnome Magic (Hatred (Gnome)) were stale on the base (the deferred stale set, curation.md) and are left for the post-curation cleanup.
- Earlier fixtures that copy batch keys (#355's `binding-preview.json` copies Monstrous Humanoid (Sahuagin), the vishkanya and triton low-light vision, Hatred (Gnome) and Poison Use (Vishkanya); #719, #720 and #721) were checked by their tests and `cross-batch-bindings.test.ts`: no other binding changes. No pf-traits key is in this batch's closures.

## Binding

Every assessment is bound with `buildAssessmentBinding` against the full-corpus content closure: the final full `catalog:preview` artifact, with the batch's 75 entries and their 62 closure entries. The [preview fixture](../../tests/fixtures/racial-traits-391/preview.json) keeps both, so the batch test rebuilds every binding from a clean shared-store tree (0 mismatches).

## Tests

The [resolver tests](../../tests/catalog/racial-traits-391.test.ts) pin the reviewed values through the public resolver: every Situation-gated bonus off by default and on when selected, one Situation per multi-statistic rule and one choice Situation per skill, the two racial Situations of Heart of the Sun and Blightborn not stacking, the shared death Situation, imported changes not curated twice, Dragon Magic's Perception at 0, Faultspawn making Skilled (Tiefling) dormant, Fey Wisdom making Keen Senses (Elf) dormant, two traits' racial Diplomacy stacking to +4, and no `ac.other` armor, shield or natural armor bonus. They also pin all 37 required and 75 description records, the one covered/no-output record (Change Shape (Reptoid)), the race-covered notes and Note targets, the weapon Proficiencies; the race, alternate, monster-ability, cited and Unchained notice dependencies (22 PZO1131 keys, own action versus bound body) and every enforced hold; the importer's reading of race, standard flag, replacements and unresolved names; every pinned body, PCGen row and PRD paragraph in the shared store; and re-extraction from a clean shared-store tree with every binding reproduced and a confirmed Weapon Familiarity (Dwarf) still held.

The [isolated saved-sheet test](../../tests/catalog/racialTraits391.integration.test.ts) exercises public Convex reads and writes: an elf-identity race granting Keen Senses, Elven Magic and Weapon Familiarity (Elf) takes the held Fey Wisdom (Perception 2 → 0, Diplomacy and Knowledge (nature) +1) and Dragon Magic (no Perception), and turns Fey Wisdom off again, with saved totals equal to the preview; outsiders, anonymous callers and another campaign's entry are refused without changing the sheet. The shared held-release round trip is covered once by the release test in [`traits367.integration.test.ts`](../../tests/catalog/traits367.integration.test.ts). No deployment or production activation occurred.

## Preservation and gates

The shared canonical files gain only this batch's entries: 112 curation records (75 description and 37 note records), 75 assessments, 75 evidence entries and 33 notice holds. The other changes are the Dragon Magic change replacement and the listed re-binds (Fey Boon and its fixture entry, and the 12 #387–#390 assessments with their `currentBinding` and preview fixture copies; after the rebase the #388 and #390 inventories and fixtures change too). Diff stat as curated against `a1fc7966` (before the rebase):

```text
 scripts/catalog/legal/held-notices.json           |  313 +++
 scripts/catalog/legal/racial-traits-387.json      |    4 +-
 scripts/catalog/legal/racial-traits-389.json      |    8 +-
 scripts/catalog/reviewed-change-replacements.ts   |   11 +
 scripts/catalog/reviewed-curation.json            | 2603 +++++++++++++++++++++
 src/lib/catalog/data/attribution-assessments.json | 1784 +++++++++++++-
 src/lib/catalog/data/attribution-evidence.json    |  225 ++
 tests/fixtures/racial-traits-387/preview.json     |    5 +
 tests/fixtures/racial-traits-389/preview.json     |   10 +
 tests/fixtures/spells-524/binding-preview.json    |    5 +
 10 files changed, 4955 insertions(+), 13 deletions(-)
```

<!-- prep:shared-store-count -->

New shared-store files (`tests/fixtures/pinned/`), counted by prep after the rebase onto `1c827888`: **115** (pcgen 5, pf1 11, pf1-content 99).

<!-- /prep:shared-store-count -->

The batch adds to the shared store (`tests/fixtures/pinned/`) its pinned records, the pf-racial-traits folder records above them, the pinned race records they bind to, the linked bodies (spells, a buff and racial traits), the PCGen race-ability, class, domain and anchor files the evidence cites, and the PRD capture pages; files already on the base were reused.

The complete preview reported **86 admitted, 23,168 held, 2 dependent omissions and 2,610 failures** on `a1fc7966`, 37 fewer than that base's 2,647: this batch's required note records. Rebased onto `1fe016bc` (#388, #390), it reports 2,522. The only batch keys among the failures are the two #738 journal-link gaps. The full-corpus gate is therefore a documented failure, not a claim of whole-corpus readiness.

| Command                                                                                                                                                                                                                                                                                                                                             | Result                                                                                                                                                                        |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `catalog:curate --candidates …` (required) and `--descriptions` (prose pass)                                                                                                                                                                                                                                                                        | pass; 37 required drafts, 17 prose drafts                                                                                                                                     |
| `catalog:preview --candidates …`                                                                                                                                                                                                                                                                                                                    | exit 1; 0 admitted / 33 held / 42 failures: links and replacements outside the selection plus the two #738 journal links (the full preview has only those two for this batch) |
| Full `catalog:curate`                                                                                                                                                                                                                                                                                                                               | pass; 1,504 new drafts, none for this batch; 0 missing; 2 stale (as on the base); about 3 min                                                                                 |
| Full `catalog:preview`                                                                                                                                                                                                                                                                                                                              | exit 1; 2,610 failures, only the two #738 journal links for this batch; about 4 min plus the admission queue                                                                  |
| Full re-bind (`buildAssessmentBinding` over the final full preview)                                                                                                                                                                                                                                                                                 | inventory, assessments and preview fixture reproduced; 0 mismatches against the clean-tree reconstruction; the seven cross-batch re-binds' fixture bindings agree             |
| `pnpm test` of the batch tests, the guards (`notice-holds`, `pinned-sources`, `cross-batch-bindings`, `ac-other-defense-bonuses`, `notice-dependencies`, `data-files`) and the affected earlier tests (`racial-traits-387`, `racial-traits-389`, `spells-524`, `feats-355`, `racial-traits-719`, `race-facts-720`, `race-ability-721`) (one worker) | pass; 15 files / 404 tests; about 5 min                                                                                                                                       |
| `pnpm -s typecheck`                                                                                                                                                                                                                                                                                                                                 | pass                                                                                                                                                                          |
| `pnpm -s lint`                                                                                                                                                                                                                                                                                                                                      | pass (a first run flagged an unused fixture export, `previewEntry`, now removed); about 3 min                                                                                 |
| `pnpm -s check:initial-migration-writers`                                                                                                                                                                                                                                                                                                           | pass; 185 registrations                                                                                                                                                       |
| `pnpm catalog:pin`                                                                                                                                                                                                                                                                                                                                  | pass; `sha256:005ef0b9…`                                                                                                                                                      |
| `pnpm catalog:notice-deps`                                                                                                                                                                                                                                                                                                                          | pass; 0 gaps; 38 advisory warnings, none for this batch                                                                                                                       |
| `pnpm catalog:format --check`                                                                                                                                                                                                                                                                                                                       | pass                                                                                                                                                                          |

After the rebase onto `1fe016bc`, one at a time through `capped.sh`: the batch tests (2 files / 8 tests), `cross-batch-bindings` (11), `racial-traits-387` to `-390` with their integration tests (8 each) and `spells-524` (21) all pass; `catalog:format --check` and `git diff --check` pass.

`pnpm test tests/catalog` was left to the orchestrator's prep run on the rebased commit, as the brief directs.
