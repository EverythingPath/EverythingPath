# Racial traits #399: pf1-content pf-racial-traits batch 13

Reviewed by **Opus (AI curator) for the owner**, 2026-10-21.

Exactly the issue's 100 ordered, unique keys were reviewed: **0 admitted, 71 specifically held, 0 dependent omissions, 0 whole-entry unsupported/prose-only dispositions, 29 exclusions, 0 record-level 3.5 holds**. The exclusions are 12 Foundry `!folders!` records, which the importer's folder contract leaves out of the Catalog Entries (PRD Decision 17), and 17 records in the Advanced Race Guide Race Builder subtree, which the import contract excludes by folder ancestry ([README](README.md), explicit exclusions) and the [Racial Trait contract](../character-sheet/racial-traits.md) puts out of scope. No candidate carries a `3.5` tag. The 71 in-scope records are 30 standard racial traits (10 of them in flat race folders), 29 alternates, 7 Subrace Standard heritage parts and 5 Subraces-folder heritages or racial subtypes.

The [machine-readable inventory and evidence](../../scripts/catalog/legal/racial-traits-399.json) records, per key, the complete pinned body and inert fields with their source hash and cited sources; the PCGen race-ability rows, PRD Advanced Race Guide paragraphs, leads and rejected rows; the inherited-rule notices with their evidence, the linked bodies and the unresolved origins; the importer's reading of race, standard flag and replacements; every checked curation record, source discrepancies and calculation gaps; and the current assessment binding and mapped facts. This report summarizes them and does not repeat the evidence.

## #328 S4-A launch update

Reviewed 2026-11-01 by **Sol (AI curator) for the owner** ([races-328.md](races-328.md#s4-a-launch-human-dwarf-and-half-orc)). The launch review compared this batch's one Human, Dwarf and Half-Orc standard trait, **Languages (Human)** (`pf1-content/eNIYJNbM6UL7OdyE`), and **keeps it held** (fix round 1); counts stay **0 admitted, 71 held**, 29 exclusions.

Its Common and bonus-language sentences match the PRD Advanced Race Guide paragraph (`advancedRaceGuide/coreRaces/humans.html:364`) and PCGen's Core Essentials row (`core_essentials/races/human/human_abilities_race.lst:23`). Its other two sentences, the added ethnic starting language ("and their ethnic language") and the exception for humans whose ethnic language is Common (or Taldane, for Chelaxians or Taldans), are in neither. No permitted source the repository holds states them: PCGen's Inner Sea Races file only re-pages the row (`isr_abilities_race.lst:197`) and models human ethnicities as backgrounds (`isr_abilities.lst:8-19`). The record's PZO9280 citation identifies a notice, not a content comparison. The hold `racial-traits-399-whole-content-eNIYJNbM6UL7OdyE` keeps its identity with this specific reason, until a permitted comparison (the Inner Sea Races text) supplies both statements. Its notices are reviewed or cleared, and its notice-chain hold IDs stay as history. The S4-A comparison is kept in `launchReview` and the earlier Opus review in `assessmentHistory`; the assessment is unresolved (Sol, 2026-11-01).

Because the trait is in its race's closure, Human (#328) is dependently omitted until this assessment is confirmed.

Tests: `racial-traits-399.test.ts` reads the batch through `assessedTraits` (all held), pins the specific reason, and checks that neither gate admits any record of the batch.

## Family rulings applied

This batch follows the #387 rulings Sol approved for the family:

1. **Every in-scope record is held** with a whole-content hold: the race records stay held (#328), every cited book's notice chain is held (38 batch notice holds, registered in `held-notices.json`, among them `racial-traits-399-notice-primitive-human-blog-complete-chain` for the Paizo blog source, as #389 held it), and no book PDFs are available.
2. **Race abilities.** Every record requires the books its pinned race record cites; Mostly Human (Undine) and Pass for Human also require the Human race's books (they count as humanoid (human)).
3. **Alternate framework.** Every alternate records the APG alternate racial trait rule (PZO1115, `apg_abilities_race.lst:86`).
4. **Monster abilities** take the earliest book the pinned Universal Monster Rules page lists: darkvision PZO1127; light sensitivity, incorporeal, resistance, damage reduction, natural attacks and gaze PZO1112.
5. **Creature types** (humanoid, outsider, construct, goblinoid, human and native, and the aberration, ooze, vermin, plant and aboleth types bonuses name) stay named unresolved origins.
6. **PZO1131** for Unchained action-cost metadata anywhere in the bound closure: 14 records (8 on their own actions, 11 through bound bodies, 5 both). Demon-Spawn (Pitborn) and Moroi-Born (Svetocher), with their curated ability lines, reach their race's standard traits (the tiefling's spell-like ability, the obscuring mist spell) through the race's ability score trait.
7. **Comparisons.** PCGen race-ability rows from a pinned book the record cites are the `comparison` (35 records); Core Essentials support rows (no SOURCELONG book) are leads whose book is not required (25 records with only leads); the Tian Xia language rows (Dragon Empires Gazetteer and Primer) and the heritage parts' parent rows are rejected rows; 11 records have no PCGen row or PRD paragraph and say so as a named root hold. 21 records carry a PRD `prdComparison` from the pinned capture (14 match word for word). Subrace Standard parts take no PRD paragraph.
8. **Description pass.** Every in-scope record has a checked description record: its reviewed Modifiers plus an entry-level Note with the body (`@Distance` read as feet, "N-foot" before "racial bonus", `@Condition` as its name, `@Toggle` controls removed). Expanded Oddities' d20 table is over 4,096 characters, so its Note is split at a line boundary.
9. **Racial bonuses from distinct Sources stack**: the resolver test shows Natural Hunter's and Dimdweller (Elf)'s +2 racial Stealth giving +4 together. The #735 admission policies don't bear on this batch (no spells or CRB feats).

## Dispositions

| Key                            | Name                                          | Kind             | Disposition                                                      |
| ------------------------------ | --------------------------------------------- | ---------------- | ---------------------------------------------------------------- |
| `pf1-content/eLnDyBKNO6J5VbOI` | Hag Racial Trait (Changeling - Sorrow May)    | subrace standard | held: `racial-traits-399-whole-content-eLnDyBKNO6J5VbOI`         |
| `pf1-content/eNIYJNbM6UL7OdyE` | Languages (Human)                             | standard         | held: `racial-traits-399-whole-content-eNIYJNbM6UL7OdyE`         |
| `pf1-content/eNSivYdOXqQpPe52` | Spell-Like Ability (Tiefling - Spitespawn)    | subrace standard | held: `racial-traits-399-whole-content-eNSivYdOXqQpPe52`         |
| `pf1-content/eNeKXqhZNnBDrGxb` | Slow Speed (Monkey Goblin)                    | standard         | held: `racial-traits-399-whole-content-eNeKXqhZNnBDrGxb`         |
| `pf1-content/eXhsF4CcvaCrLqLj` | Natural Hunter                                | standard         | held: `racial-traits-399-whole-content-eXhsF4CcvaCrLqLj`         |
| `pf1-content/eYZTYsiT5ssa2jrK` | Junk Tinker                                   | alternate        | held: `racial-traits-399-whole-content-eYZTYsiT5ssa2jrK`         |
| `pf1-content/eZ0c2h7CXvrIHclo` | Fiendish Sprinter                             | alternate        | held: `racial-traits-399-whole-content-eZ0c2h7CXvrIHclo`         |
| `pf1-content/eaMWAf2sFEmEhTbF` | Lifebound                                     | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/eew9hWENxwAiLP8S` | Stubborn                                      | alternate        | held: `racial-traits-399-whole-content-eew9hWENxwAiLP8S`         |
| `pf1-content/efCmFm0xhnvVzxQz` | Languages (Wayang)                            | standard         | held: `racial-traits-399-whole-content-efCmFm0xhnvVzxQz`         |
| `pf1-content/egMDpZBmPCJvM2jP` | Negative Energy Affinity                      | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/egPtrKyVhJWvKbJV` | Standard                                      | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/em8BoW2q3oUV9CHk` | Detect Thoughts                               | standard         | held: `racial-traits-399-whole-content-em8BoW2q3oUV9CHk`         |
| `pf1-content/emWoMvZJYkXOz6ot` | Light Sensitivity (Orc)                       | standard         | held: `racial-traits-399-whole-content-emWoMvZJYkXOz6ot`         |
| `pf1-content/emgcgmgSjpuv1GHa` | Demon-Spawn (Pitborn)                         | subrace          | held: `racial-traits-399-whole-content-emgcgmgSjpuv1GHa`         |
| `pf1-content/eomWW6BaxOUSLd6M` | Powerful Presence                             | alternate        | held: `racial-traits-399-whole-content-eomWW6BaxOUSLd6M`         |
| `pf1-content/eqdCFnuUmo68fMPd` | Shadowhunter (Gnome)                          | alternate        | held: `racial-traits-399-whole-content-eqdCFnuUmo68fMPd`         |
| `pf1-content/erHe11Qn4judzeI1` | Mostly Human (Undine)                         | alternate        | held: `racial-traits-399-whole-content-erHe11Qn4judzeI1`         |
| `pf1-content/eselzEcuEzC858lz` | Nocturnal (Syrinx)                            | standard         | held: `racial-traits-399-whole-content-eselzEcuEzC858lz`         |
| `pf1-content/euX1ucchOBHkK62k` | Titled                                        | alternate        | held: `racial-traits-399-whole-content-euX1ucchOBHkK62k`         |
| `pf1-content/ewhFVskXwNn3uVnI` | Toxic                                         | standard         | held: `racial-traits-399-whole-content-ewhFVskXwNn3uVnI`         |
| `pf1-content/ewi3N8t6Hb1kLwP0` | Storm in the Blood                            | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/f0Uw5byWu52oGfPu` | Syrinx                                        | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/f14x9PM3WRGXOJrF` | Constructed                                   | standard         | held: `racial-traits-399-whole-content-f14x9PM3WRGXOJrF`         |
| `pf1-content/f2KIBwlRL87kTqh5` | Enchantment Resistance                        | standard         | held: `racial-traits-399-whole-content-f2KIBwlRL87kTqh5`         |
| `pf1-content/f6rFJHkiEHN54rA8` | Architectural Ingenuity                       | alternate        | held: `racial-traits-399-whole-content-f6rFJHkiEHN54rA8`         |
| `pf1-content/f91ILsrKfkpL9uUG` | Moroi-Born (Svetocher)                        | subrace          | held: `racial-traits-399-whole-content-f91ILsrKfkpL9uUG`         |
| `pf1-content/f9g94BzVWjntaNQg` | Warden of Nature                              | alternate        | held: `racial-traits-399-whole-content-f9g94BzVWjntaNQg`         |
| `pf1-content/fACLjvCyrx6Mqexi` | Ability Score                                 | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/fBBiCCIT6JWsXnuc` | Alternate                                     | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/fEOrjylHusRJhTAa` | Skill Training                                | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/fEWoU2Ajm832ZrQ0` | Subraces                                      | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/fEstcJ0Ou5ny9rZm` | Alternate                                     | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/fHSUlCaWzWJaZBFg` | Curiosity                                     | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/fIZiHRwjPPqelrGs` | Terrain Chameleon                             | alternate        | held: `racial-traits-399-whole-content-fIZiHRwjPPqelrGs`         |
| `pf1-content/fJekoMzjSbktf0X4` | Acute Darkvision                              | alternate        | held: `racial-traits-399-whole-content-fJekoMzjSbktf0X4`         |
| `pf1-content/fLfQPOGCnNhp6Q5A` | Spell-Like Ability (Tiefling - Foulspawn)     | subrace standard | held: `racial-traits-399-whole-content-fLfQPOGCnNhp6Q5A`         |
| `pf1-content/fQPApN7TVtDqoPH8` | Envoy                                         | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/fRLqG0NKrKPmpHUr` | Dimdweller (Dwarf)                            | alternate        | held: `racial-traits-399-whole-content-fRLqG0NKrKPmpHUr`         |
| `pf1-content/fS6BttTRyYNJW2om` | Alternate                                     | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/fSxq7K1dm6SfFb3V` | Advanced Intelligence                         | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/fUAqkTyumLnQrGch` | Poison Use (Drow)                             | standard         | held: `racial-traits-399-whole-content-fUAqkTyumLnQrGch`         |
| `pf1-content/fVRCBv9JtvU8M6x2` | Expanded Oddities                             | alternate        | held: `racial-traits-399-whole-content-fVRCBv9JtvU8M6x2`         |
| `pf1-content/fY57zno3ncSszWwf` | Constant Spell-Like Divination                | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/fZAb027L9Kbww3js` | Shadowhunter (Human)                          | alternate        | held: `racial-traits-399-whole-content-fZAb027L9Kbww3js`         |
| `pf1-content/fbORYANXcG7HfMbQ` | Unassuming Foliage                            | standard         | held: `racial-traits-399-whole-content-fbORYANXcG7HfMbQ`         |
| `pf1-content/fc7iZPElgVhpy8L5` | Languages (Nagaji)                            | standard         | held: `racial-traits-399-whole-content-fc7iZPElgVhpy8L5`         |
| `pf1-content/fdroJSWRD5CgUnJI` | Swift as Shadows                              | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/fiOhIvq1Gb79iJPJ` | Languages (Triaxian)                          | standard         | held: `racial-traits-399-whole-content-fiOhIvq1Gb79iJPJ`         |
| `pf1-content/fn3ISzG5o1dQ7EC7` | Locathah                                      | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/fngyJ7hLuNGW6Sde` | +2 to Strength, Dexterity, or Constitution    | standard         | held: `racial-traits-399-whole-content-fngyJ7hLuNGW6Sde`         |
| `pf1-content/fnt6XKtKWkeGCZPs` | Magical Linguist                              | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/foQ7Ykot9sq5eanW` | Darklands Stalker                             | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/fpNtaVGE6wGeLGyH` | Languages (Reptoid)                           | standard         | held: `racial-traits-399-whole-content-fpNtaVGE6wGeLGyH`         |
| `pf1-content/fscyXaZvorGwGprq` | Mist Affinity (Undine - Mistsoul)             | subrace standard | held: `racial-traits-399-whole-content-fscyXaZvorGwGprq`         |
| `pf1-content/fw9JHTLPAg54MLfp` | Strong Limbs                                  | alternate        | held: `racial-traits-399-whole-content-fw9JHTLPAg54MLfp`         |
| `pf1-content/fx2Ntw6KnYVn11Y5` | Hatred (Strix)                                | standard         | held: `racial-traits-399-whole-content-fx2Ntw6KnYVn11Y5`         |
| `pf1-content/fyRBxVBVyy1gQgfV` | Swarming                                      | standard         | held: `racial-traits-399-whole-content-fyRBxVBVyy1gQgfV`         |
| `pf1-content/fzbXyGr9NouJx3Qx` | Verdant Burst                                 | standard         | held: `racial-traits-399-whole-content-fzbXyGr9NouJx3Qx`         |
| `pf1-content/g2iIRBrSeUhIkDvu` | Pass for Human                                | alternate        | held: `racial-traits-399-whole-content-g2iIRBrSeUhIkDvu`         |
| `pf1-content/g6M0a4JgcPgjdjJT` | Fey Resilience                                | alternate        | held: `racial-traits-399-whole-content-g6M0a4JgcPgjdjJT`         |
| `pf1-content/g968gtWvnVkLGBgC` | Weapon Familiarity (Half-Elf)                 | alternate        | held: `racial-traits-399-whole-content-g968gtWvnVkLGBgC`         |
| `pf1-content/g9H3WgBwfJUfaU4m` | Heart of the Snows                            | alternate        | held: `racial-traits-399-whole-content-g9H3WgBwfJUfaU4m`         |
| `pf1-content/gDO7etqF3QCXKyWZ` | Spell-Like Ability (Tiefling - Hungerseed)    | subrace standard | held: `racial-traits-399-whole-content-gDO7etqF3QCXKyWZ`         |
| `pf1-content/gEJBYigk4fJKGkyM` | Sneaky (Grindylow)                            | standard         | held: `racial-traits-399-whole-content-gEJBYigk4fJKGkyM`         |
| `pf1-content/gFl4pJXEpXoSi1RB` | Stone in the Blood                            | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/gG1JcCZ4lN9hbCqJ` | Skilled (Aasimar - Lawbringers)               | subrace standard | held: `racial-traits-399-whole-content-gG1JcCZ4lN9hbCqJ`         |
| `pf1-content/gGkyhubX0tZ3GwR7` | Hag Racial Trait (Changeling - Into the Wind) | standard         | held: `racial-traits-399-whole-content-gGkyhubX0tZ3GwR7`         |
| `pf1-content/gHQ1oivYXAWN4zdz` | Subraces                                      | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/gJJpUgd5CtLjLoAV` | City Scavenger                                | alternate        | held: `racial-traits-399-whole-content-gJJpUgd5CtLjLoAV`         |
| `pf1-content/gKeid1JVhnRJtzWB` | Jungle Half-Orcs (Rainkin)                    | subrace          | held: `racial-traits-399-whole-content-gKeid1JVhnRJtzWB`         |
| `pf1-content/gNnNJoQSb0I7JKbt` | Ability Modifiers (Changeling - Slag May)     | subrace standard | held: `racial-traits-399-whole-content-gNnNJoQSb0I7JKbt`         |
| `pf1-content/gW9EZhxSnPytPicG` | Defensive Training (Drow)                     | alternate        | held: `racial-traits-399-whole-content-gW9EZhxSnPytPicG`         |
| `pf1-content/gWFEMCLFVStyyHr8` | Languages (Vine Leshy)                        | standard         | held: `racial-traits-399-whole-content-gWFEMCLFVStyyHr8`         |
| `pf1-content/gY6SZbdAcTrR3Caq` | Wanderer                                      | alternate        | held: `racial-traits-399-whole-content-gY6SZbdAcTrR3Caq`         |
| `pf1-content/gaF64cLXf9NDJgNi` | Nosophobia                                    | alternate        | held: `racial-traits-399-whole-content-gaF64cLXf9NDJgNi`         |
| `pf1-content/gaZHEiMtyEO1MLC8` | Darkvision (Being of Ib)                      | standard         | held: `racial-traits-399-whole-content-gaZHEiMtyEO1MLC8`         |
| `pf1-content/gc6Sxv7hJp2KpVrr` | Languages (Drow)                              | standard         | held: `racial-traits-399-whole-content-gc6Sxv7hJp2KpVrr`         |
| `pf1-content/gfLHMG7m7z8gAmQg` | Ability Score                                 | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/gh1taO4CBM237eMu` | Scales                                        | standard         | held: `racial-traits-399-whole-content-gh1taO4CBM237eMu`         |
| `pf1-content/ghhqHErIWTAI5Rrj` | Subraces                                      | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/gilTw1Wm9B200MH0` | Normal Speed (Hobgoblin)                      | standard         | held: `racial-traits-399-whole-content-gilTw1Wm9B200MH0`         |
| `pf1-content/gpZx2FQSEHME0jzh` | Sprinter (Catfolk)                            | standard         | held: `racial-traits-399-whole-content-gpZx2FQSEHME0jzh`         |
| `pf1-content/gpu9xXTwvbJOLA61` | Goblinoid (Hobgoblin)                         | standard         | held: `racial-traits-399-whole-content-gpu9xXTwvbJOLA61`         |
| `pf1-content/gt3Mx0lNuCQxOMdo` | Deep Gillman                                  | alternate        | held: `racial-traits-399-whole-content-gt3Mx0lNuCQxOMdo`         |
| `pf1-content/gt6rBTzdG0Cub2lr` | Dimdweller (Elf)                              | alternate        | held: `racial-traits-399-whole-content-gt6rBTzdG0Cub2lr`         |
| `pf1-content/gtEPGAjNbrouZliO` | Underground Sneak                             | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/gwRHgXExczYgcJOA` | Skilled (Svirfneblin)                         | standard         | held: `racial-traits-399-whole-content-gwRHgXExczYgcJOA`         |
| `pf1-content/gxI2toeA7yXzTIxV` | Fey Magic (Dwarf)                             | alternate        | held: `racial-traits-399-whole-content-gxI2toeA7yXzTIxV`         |
| `pf1-content/gxxWYxmCBUIWCPqU` | Vestigial Wings                               | alternate        | held: `racial-traits-399-whole-content-gxxWYxmCBUIWCPqU`         |
| `pf1-content/gxxo5ADAOJmasUMu` | Scavenger                                     | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/gyvG87iDUG02oQmR` | Dread Gnomes                                  | subrace          | held: `racial-traits-399-whole-content-gyvG87iDUG02oQmR`         |
| `pf1-content/h1qCMaAFkj6JDjtM` | Deathless Spirit                              | alternate        | held: `racial-traits-399-whole-content-h1qCMaAFkj6JDjtM`         |
| `pf1-content/h1rqC3aTXHfUTOQl` | Gutter Rat                                    | subrace          | held: `racial-traits-399-whole-content-h1rqC3aTXHfUTOQl`         |
| `pf1-content/h28fV1La84HjFdFv` | Standard                                      | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/h4JiQ73b0LsNd4Zl` | Wyrmscourged                                  | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/h8hy3OtCjGrXyYrf` | Shadow Magic                                  | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/hAY8Dqng9SA6sRpC` | Subtle Manipulator                            | alternate        | held: `racial-traits-399-whole-content-hAY8Dqng9SA6sRpC`         |
| `pf1-content/hFdanJW6aJ2iUnhB` | Languages (Kuru)                              | standard         | held: `racial-traits-399-whole-content-hFdanJW6aJ2iUnhB`         |
| `pf1-content/hGk1y2z11CtFqbys` | Cat's Luck                                    | race builder     | excluded: ARG Race Builder subtree (import contract)             |

## Notable cases

- **Heritage ability lines curated (#387 to #398 precedent).** Demon-Spawn (Pitborn) (+2 Str, +2 Cha, -2 Int) and Moroi-Born (Svetocher) (+2 Str, +2 Cha, -2 Con) are `reviewedAbilityLineSubraces` heritages whose lines agree with PCGen's Core Essentials "<Heritage> ~ Ability Scores" rows, so each is three racial ability Modifiers and "Base Statistics" resolves to the race's ability score trait, which goes dormant. `race-ability-721` and `racial-traits-719` pin neither heritage.
- **Race outputs already on the traits (checked against the race outputs first, #391):** Nocturnal (Syrinx), Constructed, Enchantment Resistance and Unassuming Foliage carry their races' re-homed #328 note records (`coveredTraitNotes`); Natural Hunter, Sneaky (Grindylow) and Skilled (Svirfneblin) carry their races' relocated changes; Scales carries the Reptoid's re-homed description output (natural armor on `ac.natural`). None gets a second Modifier. **Latent overlaps:** Hatred (Strix)'s attack note and Skilled (Svirfneblin)'s underground Stealth note are covered/no-output, because the Strix and Svirfneblin races' checked #328 description records already give those bonuses. No Modifier is added to a standard trait of a #719 race.
- **Situational bonuses** (manual Situations): Stubborn (charm and compulsion, one Situation), Warden of Nature (+2 dodge AC on `ac`, +1 untyped attack), Defensive Training (Drow) (+4 dodge on `ac`), Nosophobia (disease; shared poison; untyped as published), Heart of the Snows (slipping, trip, cold climates, Acrobatics and Climb in slippery conditions), Architectural Ingenuity, both Dimdwellers (the local label earlier batches gave the same Blood of Shadows text), Junk Tinker (driving checks on the ten driving skills, as #394 did for Wright), Terrain Chameleon (untyped +4), Deathless Spirit (shared death and negativeEnergy plus energy drain and necromancy), both Shadowhunters (untyped, to remove negative levels) and Hag Racial Trait (Changeling - Sorrow May) (gaze attacks).
- **Covered/no-output records (6):** the Shadowhunters' rangedWeapon notes (the attack Note covers every attack), Junk Tinker's driving note on Craft (Craft is not a driving skill), Weapon Familiarity (Half-Elf)'s landSpeed note (it states a rule the body does not grant; listed for review), and the two latent overlaps above.
- **Inherited rules beyond the race:** Junk Tinker Ultimate Combat's driving checks (PZO1118, the #394 Skilled Driver anchor); Mist Affinity (Undine - Mistsoul) the APG dreamspun bloodline (PZO1115, `apg_abilities_class.lst:3144`); Subtle Manipulator the linked APG memory lapse (PZO1115); Pass for Human the Advanced Race Guide it cites for the fiendish alternates it bars (PZO1121); Gutter Rat the APG book its linked Heart of the Streets cites; Powerful Presence and Shadowhunter (Human) the linked CRB feats.
- **Listed for review:** Hatred (Strix)'s untyped "+1 bonus" against the Strix race's racial-typed #328 Modifier (as #392 recorded for Hatred (Dwarf)); Toxic's uses formula omits the body's minimum of 1/day; Subtle Manipulator's uses formula grows with Hit Dice where the body gives once per day; Weapon Familiarity (Half-Elf)'s unrelated Foundry note.
- **Not modeled, listed:** senses, speeds, spell-like abilities and other actions (envenoming, Verdant Burst), energy resistance and damage reduction, immunities, creature types and counting as human, class-skill grants (Titled, Wanderer), bonus feats (Powerful Presence, Shadowhunter (Human), Wanderer), Charisma for feat prerequisites, the elf's weapon familiarity granted by reference, the ganzi oddity table, languages, the dreamspun and Repose affinities, and the Primitive Human's +2 to one of three abilities (the raw change has no target; `ability.$choice` can't restrict the choice).
- **Third-party and blog sources:** Detect Thoughts (Green Martian) cites only DYN0032-E and is held on the source-matched Dynamite comics hold (as #388 Fearless and #393 Multi-Armed); "+2 to Strength, Dexterity, or Constitution" cites only a Paizo blog post (custom source), held as #389 held Primitive Feat.

## Importer and data gaps

- **Partial alterations:** Junk Tinker "alters skilled, replacing the racial bonus on Stealth checks"; the importer replaces the whole Skilled (Goblin) record (#395), so its +4 racial Ride bonus goes dormant with this trait. Titled replaces only feather step, but its header ("Feather Step Spell-Like Ability") matches no gathlain trait, so it stays unresolved. Pass for Human and Mostly Human (Undine) "alter" Languages, Subtype and Type, which match no single trait record, so the importer resolves none (#304). Mist Affinity (Undine - Mistsoul) has no header and replaces nothing (known Subrace Standard behavior). Reported here; none is a #738 or #739 finding.
- **Subtle Manipulator** modifies the fetchling's spell-like abilities; the importer resolves its header to Spell-Like Abilities (Fetchling - Shadow Walk), whose body restates all three, as for Umbral Escort.
- No #738 or #739 finding, no missing pf-items reference, no stripped catalog link (every batch record passes the full preview's structure checks), and the raw upstream keys in `mapRacialTrait` caused no reference failure. Untested cases from the run notes: none in this batch. Orc Atavism and the four uncovered trait notes are not in this batch.

## Outstanding mechanics

Each record lists its calculation gaps in `mechanicsReview.outstandingCalculations`; none is an attribution hold. Beyond the "Not modeled" items above: Hag Racial Trait (Changeling - Into the Wind)'s +1 racial ranged damage stays readable because the changeling race grants every hag option at once (as #395 kept Hulking Changeling); Junk Tinker's retained Ride bonus; and **Skilled (Svirfneblin)**: the Svirfneblin race's checked #328 description record gives +4 racial Stealth underground, and this trait's relocated +2 racial Stealth applies everywhere, so the sheet totals +6 underground where the body totals +4 (racial bonuses from distinct Sources stack). The overlap is in the #328 race record, which `racial-traits-719` pins as an overlap; this batch doesn't change it and lists it for review.

## Cross-batch bindings and protected records

Curated on `fb98a347`. Every re-bind uses `buildAssessmentBinding` over the final full `catalog:preview` with this batch's records, with the earlier batch's fixture copies of this batch's keys replaced by the full-preview entries, the inventory `currentBinding` updated and the fixture-based binding checked to agree (all 21 agree). Only the content fingerprints changed; no disposition, evidence, notice or hold changed in the earlier batches. The 21 are every assessment whose full-corpus closure reaches a batch key and that was fresh on the base (checked with the binding code over the baseline full preview; the final preview's closures reach the same 45 assessments): 1 from #387, 3 from #388, 2 from #389, 1 from #390, 2 from #391, 1 from #392, 3 from #394, 3 from #395, 2 from #397, 1 from #398, 1 from traits-367 and 1 from traits-377.

| Batch      | Assessment               | Reaches (this batch)       | Content fingerprint       |
| ---------- | ------------------------ | -------------------------- | ------------------------- |
| #387       | Curiosity                | Natural Hunter             | `c289858d…` → `53c36cf9…` |
| #388       | Nimble Faller            | Sprinter (Catfolk)         | `bf8bee69…` → `3cf28299…` |
| #388       | Stalwart Watcher         | Skilled (Svirfneblin)      | `b87092f2…` → `500d2991…` |
| #388       | Taskmaster               | Enchantment Resistance     | `cc07a4e9…` → `faf9b145…` |
| #389       | Ancestral Grudge         | Poison Use (Drow)          | `9835969f…` → `c169366f…` |
| #389       | Lashvine                 | Verdant Burst              | `76835837…` → `7d85e008…` |
| #390       | Swamp Leshy              | Unassuming Foliage         | `c91129e4…` → `f65842d9…` |
| #391       | Cautious Brawler         | Hatred (Strix)             | `0361ec64…` → `8cad32b6…` |
| #391       | Slimehunter              | Enchantment Resistance     | `3521a2d5…` → `3bca05d1…` |
| #392       | Tribalistic              | Languages (Human)          | `895bdfd4…` → `4599d2f6…` |
| #394       | Blasphemous Covenant     | Poison Use (Drow)          | `58f5c449…` → `01401c2f…` |
| #394       | Deep Kin                 | Acute Darkvision           | `824e91d6…` → `65a940f1…` |
| #394       | Exiled Dwarf             | Stubborn                   | `9d8cd532…` → `2ca100fc…` |
| #395       | Bandy-Legged             | Normal Speed (Hobgoblin)   | `c7c3090a…` → `5d96ecf2…` |
| #395       | Cheek Pouches            | Swarming                   | `6551801a…` → `d29b44f0…` |
| #395       | Trailblazer              | Heart of the Snows         | `ee90bae1…` → `b416ea7b…` |
| #397       | Shadow Sorcery           | Poison Use (Drow)          | `0891e620…` → `076ba436…` |
| #397       | Warded Skin (Rainkin)    | Jungle Half-Orcs (Rainkin) | `de13cb79…` → `bb29d2e2…` |
| #398       | Clever Cat               | Natural Hunter             | `8bc874e1…` → `96562b57…` |
| traits-367 | Nanite Revival (Android) | Constructed                | `b7414f60…` → `1a45fb9b…` |
| traits-377 | Canopy Prowler (Catfolk) | Sprinter (Catfolk)         | `f9eae6be…` → `b032d496…` |

They are recorded in each batch's inventory `currentBinding` and `tests/fixtures/<batch>/preview.json`. `racial-traits-395.json`, `racial-traits-397.json`, `racial-traits-398.json` and their preview fixtures keep their landed `JSON.stringify` layout, so their diff is the re-bind only.

- **Already stale, not re-bound:** 24 assessments that reach batch keys were stale on the base and are unchanged: the #328 race records of the 24 races whose traits are in this batch.
- **Protected records:** no batch key is a protected root, and none is an entry of any batch's `binding-preview.json` import (spells-534's protected definitions name 30 batch keys, but its fixture import selects none of them, so its check doesn't reach them). The #529 to #536 `preserved.json`, #350 to #355 and #530 to #536 `protected-context.json`, `feats-355/binding-preview.json` (Languages (Wayang), Light Sensitivity (Orc), Toxic and Constructed, which no #355 assessment's closure reaches) and the #348, #355, #719, #720 and #721 `provenance.json` lists name batch keys only as seed, closure and source keys. No Note on a governing record changes another batch's binding beyond the 21 above.
- **In-flight batches:** no #429 (weapons-and-ammo) or #506 (monster-abilities) key is in this batch's closures,; neither batch has landed, so no assessment of theirs is re-bound here.

## Binding

Every assessment is bound with `buildAssessmentBinding` against the full-corpus content closure: the final full `catalog:preview` artifact, with the batch's 71 entries and their 136 closure entries. The [preview fixture](../../tests/fixtures/racial-traits-399/preview.json) keeps both, so the batch test rebuilds every binding from a clean shared-store tree (0 mismatches). The race outputs relocated or re-homed onto eight standard traits are absent from a bounded tree without the race; the test lists them.

## Tests

The [resolver tests](../../tests/catalog/racial-traits-399.test.ts) pin Demon-Spawn (Pitborn) and Moroi-Born (Svetocher) replacing their race's ability score trait on race identity sheets, every Situation-gated bonus (off by default, on when selected) and its published type, the shared poison, death and negativeEnergy Situations, the re-homed race outputs, distinct racial Sources stacking (+4), the imported and relocated values not curated twice and no `ac.other` armor, shield or natural armor bonus; all 53 required and 71 description records checked, the six covered records and the Note targets; the race, alternate, monster-ability, inherited, blog and Unchained notice dependencies (14 PZO1131 keys, own action versus bound body), every hold registered; the importer reading of races and replacements; the literal PCGen and PRD evidence in the shared store; and a clean-tree re-extraction that keeps every record held on its own holds (Detect Thoughts on the Dynamite hold).

The [isolated saved-sheet test](../../tests/catalog/racialTraits399.integration.test.ts) exercises public Convex reads and writes: a tiefling-identity race granting its ability score trait and Skilled takes the held Demon-Spawn (Pitborn) (Strength and Charisma 12, Dexterity 10, Intelligence 8; Bluff and Stealth follow) and Vestigial Wings (Skilled's Bluff and Stealth bonuses go dormant, Fly +4), then turns both off again, with saved totals equal to the preview; outsiders, anonymous callers and another campaign's entry are refused without changing the sheet. The shared held-release round trip is covered once by the release test in [`traits367.integration.test.ts`](../../tests/catalog/traits367.integration.test.ts).

## Preservation and gates

The shared canonical files gain only this batch's entries: 124 curation records (71 description and 53 note records), 71 assessments, 71 evidence entries and 38 notice holds. The other changes are the 21 listed re-binds (content fingerprints only) with their `currentBinding` and fixture copies. Shared-file diff stat against `fb98a347` (`git diff --stat HEAD`, shared store excluded):

```text
 scripts/catalog/legal/held-notices.json           |  356 +++
 scripts/catalog/legal/racial-traits-387.json      |    2 +-
 scripts/catalog/legal/racial-traits-388.json      |    6 +-
 scripts/catalog/legal/racial-traits-389.json      |    4 +-
 scripts/catalog/legal/racial-traits-390.json      |    2 +-
 scripts/catalog/legal/racial-traits-391.json      |    4 +-
 scripts/catalog/legal/racial-traits-392.json      |    2 +-
 scripts/catalog/legal/racial-traits-394.json      |    6 +-
 scripts/catalog/legal/racial-traits-395.json      |    6 +-
 scripts/catalog/legal/racial-traits-397.json      |    4 +-
 scripts/catalog/legal/racial-traits-398.json      |    2 +-
 scripts/catalog/legal/traits-367.json             |    2 +-
 scripts/catalog/legal/traits-377.json             |    2 +-
 scripts/catalog/reviewed-curation.json            | 3192 +++++++++++++++++++--
 src/lib/catalog/data/attribution-assessments.json | 1706 ++++++++++-
 src/lib/catalog/data/attribution-evidence.json    |  213 ++
 tests/fixtures/racial-traits-387/preview.json     |    7 +-
 tests/fixtures/racial-traits-388/preview.json     |   31 +-
 tests/fixtures/racial-traits-389/preview.json     |   18 +-
 tests/fixtures/racial-traits-390/preview.json     |    7 +-
 tests/fixtures/racial-traits-391/preview.json     |   17 +-
 tests/fixtures/racial-traits-392/preview.json     |    5 +
 tests/fixtures/racial-traits-394/preview.json     |   43 +-
 tests/fixtures/racial-traits-395/preview.json     |   90 +-
 tests/fixtures/racial-traits-397/preview.json     |   20 +-
 tests/fixtures/racial-traits-398/preview.json     |    7 +-
 tests/fixtures/traits-367/preview.json            |    3 +
 tests/fixtures/traits-377/preview.json            |   13 +-
 28 files changed, 5372 insertions(+), 398 deletions(-)
```

<!-- prep:shared-store-count -->
New shared-store files (`tests/fixtures/pinned/`), counted by prep after the rebase onto `df2fb9a2`: **88** (pf1 2, pf1-content 86).
<!-- /prep:shared-store-count -->

The batch adds to the shared store the pinned records of its 100 keys the store lacked and the pf-racial-traits folder records above them (86 pf1-content files), plus the pf1 Persuasive feat and memory lapse spell the bodies link; the race records, the other linked spells, feats and racial traits, the PCGen files and the PRD pages were already on the base and are reused.

The complete preview of `fb98a347` plus this batch reported **103 admitted, 23,148 held, 5 dependent omissions and 2,101 failures**, 53 fewer than the base's 2,154 (this batch's required note records). No batch key is among the failures. The import report's race summary changes only by two more resolved alternates (Pitborn's and Moroi-Born's "Base Statistics").

## Commands

| Command                                                                                                                                                                                                                                                     | Result                                                                                                                                                            |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `catalog:curate --candidates …` (required) and `--descriptions` (prose pass)                                                                                                                                                                                | pass; 53 required and 20 prose drafts for the batch, 0 missing; 47 s with the bounded preview                                                                     |
| `catalog:preview --candidates …`                                                                                                                                                                                                                            | exit 1 as expected (the bounded tree lacks linked races and traits); 71 entries, 53 required and 71 description records checked, 0 missing, 0 stale               |
| Full `catalog:curate`                                                                                                                                                                                                                                       | pass; 995 new drafts, none for this batch; 0 missing; about 3 min (capped)                                                                                        |
| Full `catalog:preview` (baseline, then final records)                                                                                                                                                                                                       | exit 1 as on the base (admission failures); final: 103 admitted, 23,148 held, 5 dependent omissions, 2,101 failures (base 2,154); about 10 min each plus queueing |
| Full re-bind (`bind.ts` and `xrebind399.ts` over the final full preview)                                                                                                                                                                                    | 71 assessments bound (0 mismatches); 21 earlier assessments re-bound, all fixture bindings agree                                                                  |
| `pnpm test` of the batch tests, the guards (`notice-holds`, `pinned-sources`, `cross-batch-bindings`, `batch-ownership-sweep`, `ac-other-defense-bonuses`), `racial-traits-719`, `race-facts-720` and `race-ability-721` (unit and integration; one worker) | pass; 10 files / 439 tests                                                                                                                                        |
| `pnpm -s typecheck`                                                                                                                                                                                                                                         | pass                                                                                                                                                              |
| `pnpm -s lint`                                                                                                                                                                                                                                              | pass; about 3 min                                                                                                                                                 |
| `pnpm -s check:initial-migration-writers`                                                                                                                                                                                                                   | pass; 185 registrations                                                                                                                                           |
| `pnpm catalog:pin`                                                                                                                                                                                                                                          | pass; `sha256:005ef0b9…`                                                                                                                                          |
| `pnpm catalog:notice-deps`                                                                                                                                                                                                                                  | pass; 0 gaps; 39 advisory warnings, none for this batch                                                                                                           |
| `pnpm catalog:format --check`                                                                                                                                                                                                                               | pass                                                                                                                                                              |

`pnpm test tests/catalog` was left to the orchestrator's prep run on the rebased commit, as the brief directs.
