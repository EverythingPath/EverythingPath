# Racial traits #394: pf1-content pf-racial-traits batch 8

Reviewed by **Opus (AI curator) for the owner**, 2026-10-20.

Exactly the issue's 100 ordered, unique keys were reviewed: **0 admitted, 68 specifically held, 0 dependent omissions, 0 whole-entry unsupported/prose-only dispositions, 32 exclusions, 0 record-level 3.5 holds**. The exclusions are 20 Foundry `!folders!` records (four of them Race Builder folders), which the importer's folder contract leaves out of the Catalog Entries (PRD Decision 17), and 12 records in the Advanced Race Guide Race Builder subtree, which the import contract excludes by folder ancestry ([README](README.md), explicit exclusions) and the [Racial Trait contract](../character-sheet/racial-traits.md) puts out of scope. No candidate carries a `3.5` tag. The 68 in-scope records are 28 standard racial traits (7 of them in flat race folders), 28 alternates, 4 Subrace Standard heritage parts and 8 Subraces-folder heritages, ethnicities or racial subtypes.

The [machine-readable inventory and evidence](../../scripts/catalog/legal/racial-traits-394.json) records, per key, the complete pinned body and inert fields with their source hash and cited sources; the PCGen race-ability rows, PRD Advanced Race Guide paragraphs, leads and rejected rows; the inherited-rule notices with their evidence, the linked bodies and the unresolved origins; the importer's reading of race, standard flag and replacements; every checked curation record, source discrepancies and calculation gaps; and the current assessment binding and mapped facts. This report summarizes them and does not repeat the evidence.

## #328 S4-B launch update

Reviewed 2026-11-01 by **Sol (AI curator) for the owner** ([races-328.md](races-328.md#s4-b-launch-half-elf-elf-gnome-and-halfling)). The S4-B launch review confirms 1 standard racial trait of Half-Elf, Elf, Gnome and Halfling with content-bound assessments; counts are now **2 admitted, 66 held**, with 32 exclusions unchanged. The earlier Opus review of each row stays in its `assessmentHistory`; every other candidate keeps its review and holds.

- **Slow Speed (Gnome)** (`pf1-content/Pe7olUqkJIbDGl4q`): matches the PRD ARG paragraph (`advancedRaceGuide/coreRaces/gnomes.html:368`) word for word; PCGen's Core Essentials row (`gnome/gnome_abilities_race.lst:20`) word for word. Base speed 20 feet stays prose: the sheet has no movement statistic (Foundry's landSpeed set is unmapped). Required notices: PZO1121, PZO9280, PZO1110. Outstanding: Speed: #740, owner 2026-10-31 "prose is fine for now".

Each row's whole-content hold ("Book PDFs unavailable") is superseded by this comparison, and it records no notice hold: PZO1110 is reviewed, PZO1121's Registry hold and `racial-traits-394-notice-PZO1121-complete-chain` are cleared (`notice-clearances.json`, owner 2026-10-30), and PZO9280's reviewed confirmation waives `racial-traits-394-notice-PZO9280-complete-chain`. The batch's `noticeRequirements` rows keep these keys as history. Content fingerprints are unchanged (the imported entries are identical); only the status, rationale, evidence and notice bindings move.

Tests: `racial-traits-394.test.ts` checks the confirmed rows with the held ones (`assessedTraits` in the fixture), expects them admitted by the committed gate and records no hold for them.

## #328 S4-A launch update

Reviewed 2026-11-01 by **Sol (AI curator) for the owner** ([races-328.md](races-328.md#s4-a-launch-human-dwarf-and-half-orc)). The launch review admits 1 standard racial trait of Human, Dwarf and Half-Orc with confirmed, content-bound assessments; counts are now **1 admitted, 67 held**, with 32 exclusions unchanged. The earlier Opus review of each admitted row stays in its `assessmentHistory`; every other candidate keeps its review and holds.

- **Orc Ferocity** (`pf1-content/OyIvyI3x7V5HIzZL`): matches the PRD ARG paragraph (`advancedRaceGuide/coreRaces/halfOrcs.html:373`) apart from "1 or more" for "above 0"; PCGen's Core Essentials row (`half_orc/halforc_abilities_race.lst:24`). Its once-per-day use stays prose; its nonaction carries Unchained action-cost metadata, so PZO1131 is required. Required notices: PZO9280, PZO1121, PZO1131, PZO1110. Outstanding: Orc Ferocity's once-per-day use and fighting on while disabled are permitted prose.

Each admitted row's whole-content hold ("Book PDFs unavailable") is superseded by this comparison, and it records no notice hold: PZO1110 is reviewed, PZO1121's Registry hold is cleared (owner, 2026-10-30), and PZO9280's reviewed confirmation waives `racial-traits-394-notice-PZO9280-complete-chain`. The batch's `noticeRequirements` rows keep these keys as history. Content fingerprints are unchanged (the imported entries are identical); only the status, rationale, evidence and notice bindings move.

Tests: `racial-traits-394.test.ts` checks the admitted rows with the held ones (`assessedTraits` in the fixture), expects them admitted by the committed gate (its uncleared-holds gate still holds them on their notice chains) and records no hold for them.

## Family rulings applied

This batch follows the #387 rulings Sol approved for the family:

1. **Every in-scope record is held** with a whole-content hold: the race records stay held (#328), every cited book's notice chain is held (40 batch notice holds, registered in `held-notices.json`), and no book PDFs are available.
2. **Race abilities.** Every record requires the books its pinned race record cites. Languages (Lashunta)'s folder binds no race (the two lashunta race records), so both lashunta records' books are recorded, as #393 did for Knowledgeable. Skilled (Kitsune) also requires Blood of the Beast (PZO9473): PCGen's only row for the body establishes it, although the record cites only the kitsune race record's books (listed for review).
3. **Alternate framework.** Every alternate records the APG alternate racial trait rule (PZO1115, `apg_abilities_race.lst:86`).
4. **Monster abilities** take the earliest book the pinned Universal Monster Rules page lists: darkvision PZO1127; low-light vision, blindsense, spell resistance, natural attacks, poison, change shape, energy resistance and incorporeal PZO1112; amorphous PZO1116.
5. **Creature types** (the aquatic, shapechanger and demon subtypes, and the dwarf, orc and elf subtypes the attack bonuses name) stay named unresolved origins, as do the deep ones and skum (Aquatic Ancestry) and the chromatic dragons (Dragonmaw).
6. **PZO1131** for Unchained action-cost metadata anywhere in the bound closure: 20 records (16 on their own actions, 13 through bound bodies, 9 both). Mountain Clan and Deep Kin reach it through Orc Ferocity, which their bundled half-orc alternates replace; Skilled (Kitsune) through Kitsune Magic.
7. **Comparisons.** PCGen race-ability rows from a pinned book are the `comparison`; Core Essentials support rows (no SOURCELONG book) are leads whose book is not required. 20 records carry a PRD `prdComparison` from the pinned capture (10 match word for word).
8. **Description pass.** Every in-scope record has a checked description record: its reviewed Modifiers plus one entry-level Note with the body (`@Distance` read as feet, `@Toggle` buff controls and empty "Related buff" lines removed).
9. **Racial bonuses from distinct Sources stack**; the resolver test shows Skilled (Tiefling - Hungerseed) and Wright giving +4 racial Intimidate together on a driving check. The #735 admission policies don't bear on this batch (no spells or CRB feats).

## Dispositions

| Key                            | Name                                             | Kind             | Disposition                                                      |
| ------------------------------ | ------------------------------------------------ | ---------------- | ---------------------------------------------------------------- |
| `pf1-content/Nwir9OMkjPZ9fSDk` | Resist Level Drain (Dhampir)                     | standard         | held: `racial-traits-394-whole-content-Nwir9OMkjPZ9fSDk`         |
| `pf1-content/O0ZXFuoAWRbYEowl` | Multi-Armed                                      | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/O0p9WY2bZpciuXs4` | Secretive Survivor                               | alternate        | held: `racial-traits-394-whole-content-O0p9WY2bZpciuXs4`         |
| `pf1-content/O32ChmG5bmi7g6OL` | Defense                                          | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/O4c045wJE5lLweg3` | Eternal Grudge                                   | alternate        | held: `racial-traits-394-whole-content-O4c045wJE5lLweg3`         |
| `pf1-content/O6rs7yvVrpAvi6FF` | Goblin                                           | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/O6yQCQgndhuYUxgN` | Memories Beyond Death                            | alternate        | held: `racial-traits-394-whole-content-O6yQCQgndhuYUxgN`         |
| `pf1-content/O79h8E0bytNQ3Wte` | Integrated                                       | alternate        | held: `racial-traits-394-whole-content-O79h8E0bytNQ3Wte`         |
| `pf1-content/O8QmIUQzLwYT07HR` | Alternate                                        | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/OAfZWupd9yLtJyVt` | Weapon Familiarity (Green Martian)               | standard         | held: `racial-traits-394-whole-content-OAfZWupd9yLtJyVt`         |
| `pf1-content/OAwtdUpYAjTJ1AQo` | Adaro                                            | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/OFY1lCZv7lTqBqxl` | Keen Senses (Vishkanya)                          | standard         | held: `racial-traits-394-whole-content-OFY1lCZv7lTqBqxl`         |
| `pf1-content/OGvHcwhmrl2F70Rh` | Aberration                                       | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/OHZg8sim2p5PHnsi` | Naiad                                            | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/OKOj8Njd7R51xoXM` | Skilled (Tiefling - Hungerseed)                  | subrace standard | held: `racial-traits-394-whole-content-OKOj8Njd7R51xoXM`         |
| `pf1-content/OO9iqTdt7jrlQP4M` | Fearless                                         | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/OQLnOZYLv8WzxMbW` | Low-Light Vision (Kuru)                          | standard         | held: `racial-traits-394-whole-content-OQLnOZYLv8WzxMbW`         |
| `pf1-content/ORyyVJgnmWufSpWO` | Frenzy                                           | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/OSKe4wubLjYQOswq` | Dragonmaw                                        | alternate        | held: `racial-traits-394-whole-content-OSKe4wubLjYQOswq`         |
| `pf1-content/OVHxWEhuUhEocUus` | Alternate                                        | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/OXY295BxKtSQhWDC` | Senses                                           | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/OXeCLUuxw8wq2SMA` | All-Around Vision                                | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/OYQqWgVtw30JL2qT` | Spell-Like Abilities (Fetchling - Disguise Self) | standard         | held: `racial-traits-394-whole-content-OYQqWgVtw30JL2qT`         |
| `pf1-content/OYizHQkCQbWFXC6A` | Standard                                         | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/OayRgLPHanjzhdK0` | Spell-Like Ability (Tiefling - Hellspawn)        | subrace standard | held: `racial-traits-394-whole-content-OayRgLPHanjzhdK0`         |
| `pf1-content/OcHofX7dmPTO2FJc` | Wright                                           | alternate        | held: `racial-traits-394-whole-content-OcHofX7dmPTO2FJc`         |
| `pf1-content/Ogs5hSl1Cu4m6hnG` | Base Speed                                       | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/OhPrA1hx36b7dlOE` | Linguist                                         | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/OhtzsoHplJO2iqs7` | Spiresworn Elves                                 | subrace          | held: `racial-traits-394-whole-content-OhtzsoHplJO2iqs7`         |
| `pf1-content/OiT98l4ilseMB1OR` | Fast Healing                                     | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/Ol8AbEHSbXnbj9eC` | Blasphemous Covenant                             | alternate        | held: `racial-traits-394-whole-content-Ol8AbEHSbXnbj9eC`         |
| `pf1-content/OqqOmbw84qSUfekh` | Polyglot                                         | alternate        | held: `racial-traits-394-whole-content-OqqOmbw84qSUfekh`         |
| `pf1-content/OrBsTYxtz2gkCF62` | Change Size                                      | alternate        | held: `racial-traits-394-whole-content-OrBsTYxtz2gkCF62`         |
| `pf1-content/OskWDhOKD8ogUXFd` | Languages (Orang-Pendak)                         | standard         | held: `racial-traits-394-whole-content-OskWDhOKD8ogUXFd`         |
| `pf1-content/OtTp6bzpLQ0gsia8` | Tree Stranger                                    | alternate        | held: `racial-traits-394-whole-content-OtTp6bzpLQ0gsia8`         |
| `pf1-content/OvKzLDHijIYHCO4A` | Fortunate                                        | standard         | held: `racial-traits-394-whole-content-OvKzLDHijIYHCO4A`         |
| `pf1-content/OvR36pLkOfFeJVQZ` | Poison Minion (Half-Elf)                         | alternate        | held: `racial-traits-394-whole-content-OvR36pLkOfFeJVQZ`         |
| `pf1-content/Owfw2qBYmmKJsSYD` | Martial Recollection                             | alternate        | held: `racial-traits-394-whole-content-Owfw2qBYmmKJsSYD`         |
| `pf1-content/OyIvyI3x7V5HIzZL` | Orc Ferocity                                     | standard         | held: `racial-traits-394-whole-content-OyIvyI3x7V5HIzZL`         |
| `pf1-content/P1EvUId4dIEa4CCY` | Languages (Suli)                                 | standard         | held: `racial-traits-394-whole-content-P1EvUId4dIEa4CCY`         |
| `pf1-content/P32v41a5IFStjrX2` | Experimental Body: Blessed                       | alternate        | held: `racial-traits-394-whole-content-P32v41a5IFStjrX2`         |
| `pf1-content/P4eBE9KoLo0nWAZ9` | Aquatic (Merfolk)                                | standard         | held: `racial-traits-394-whole-content-P4eBE9KoLo0nWAZ9`         |
| `pf1-content/P62rxEcFwpYPinoO` | Yaddithian                                       | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/PEz0pdv3ODLB5O8A` | Hypnotic Gaze                                    | alternate        | held: `racial-traits-394-whole-content-PEz0pdv3ODLB5O8A`         |
| `pf1-content/PHryxw5cbuUqi07S` | Winter-Born (Snow May)                           | subrace          | held: `racial-traits-394-whole-content-PHryxw5cbuUqi07S`         |
| `pf1-content/PIMcPx0ChSCDRhb4` | Blindsense (Sahuagin)                            | standard         | held: `racial-traits-394-whole-content-PIMcPx0ChSCDRhb4`         |
| `pf1-content/PIVj1MVMqsVbaJAX` | Offensive                                        | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/PIxuFy35QRAS2jCE` | Sophisticate                                     | alternate        | held: `racial-traits-394-whole-content-PIxuFy35QRAS2jCE`         |
| `pf1-content/PK40R7vlzpGl20u2` | Deepsight                                        | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/PKI1mYZltP1nWgBs` | Mountain Clan                                    | subrace          | held: `racial-traits-394-whole-content-PKI1mYZltP1nWgBs`         |
| `pf1-content/POCUxFT4m0DJf9s9` | Fleet of Foot                                    | alternate        | held: `racial-traits-394-whole-content-POCUxFT4m0DJf9s9`         |
| `pf1-content/POpOQ92KDbEjUHMM` | Exiled Dwarf                                     | subrace          | held: `racial-traits-394-whole-content-POpOQ92KDbEjUHMM`         |
| `pf1-content/PR2n7WHSkifyQAeA` | Over-Sized Ears                                  | alternate        | held: `racial-traits-394-whole-content-PR2n7WHSkifyQAeA`         |
| `pf1-content/PVMoVc8yuZPm39Zq` | Alternate                                        | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/PYk8BVSrlIwDWzG1` | Slow Speed (Adaro)                               | standard         | held: `racial-traits-394-whole-content-PYk8BVSrlIwDWzG1`         |
| `pf1-content/PZivMg8Pl1LRnSQE` | Kindred-Raised                                   | alternate        | held: `racial-traits-394-whole-content-PZivMg8Pl1LRnSQE`         |
| `pf1-content/PZvJlelVbb79phHY` | Alternate                                        | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/PZxrk9JzfGnFGo9P` | Alternate                                        | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/PcB92kGTJfdUh7PC` | Cornered Fury                                    | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/PdrOz09Jw9MiyqED` | Languages (Wyrwood)                              | standard         | held: `racial-traits-394-whole-content-PdrOz09Jw9MiyqED`         |
| `pf1-content/Pe7olUqkJIbDGl4q` | Slow Speed (Gnome)                               | standard         | held: `racial-traits-394-whole-content-Pe7olUqkJIbDGl4q`         |
| `pf1-content/PlHMiodexQ4Ph2sd` | Military Tradition                               | alternate        | held: `racial-traits-394-whole-content-PlHMiodexQ4Ph2sd`         |
| `pf1-content/Po1HlX0Q2YF9g6Bs` | Light Sensitivity                                | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/PoeOzomLE0yQZG39` | Dreamspeaker                                     | alternate        | held: `racial-traits-394-whole-content-PoeOzomLE0yQZG39`         |
| `pf1-content/PpI7Dg0KK2Bwxqr5` | Spell Resistance (Munavri)                       | standard         | held: `racial-traits-394-whole-content-PpI7Dg0KK2Bwxqr5`         |
| `pf1-content/PpXi216y1kJgHY1C` | Frenzy                                           | standard         | held: `racial-traits-394-whole-content-PpXi216y1kJgHY1C`         |
| `pf1-content/PpiI4GuDb2S5SPo6` | Spell-Like Ability (Aasimar - Idyllkin)          | subrace standard | held: `racial-traits-394-whole-content-PpiI4GuDb2S5SPo6`         |
| `pf1-content/PrbroPUHndaGtsXZ` | Languages (Tiefling)                             | standard         | held: `racial-traits-394-whole-content-PrbroPUHndaGtsXZ`         |
| `pf1-content/PtZLDuOW5e0OoVsx` | Gear Gnomes                                      | subrace          | held: `racial-traits-394-whole-content-PtZLDuOW5e0OoVsx`         |
| `pf1-content/Pump2OQujqB4q4A4` | Catfolk                                          | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/PxiY2qb6ecVEaAVB` | Languages (Lashunta)                             | standard         | held: `racial-traits-394-whole-content-PxiY2qb6ecVEaAVB`         |
| `pf1-content/PxjUu8YOjXmWdagL` | Ability Modifiers (Changeling)                   | standard         | held: `racial-traits-394-whole-content-PxjUu8YOjXmWdagL`         |
| `pf1-content/Q3bLl6S1s1r2Pgz9` | Spell-Like Ability (Sylph)                       | standard         | held: `racial-traits-394-whole-content-Q3bLl6S1s1r2Pgz9`         |
| `pf1-content/Q4FtkHZulWkKEk7v` | Aquatic Ancestry                                 | alternate        | held: `racial-traits-394-whole-content-Q4FtkHZulWkKEk7v`         |
| `pf1-content/Q8AUOygDMWFYCGIu` | Subraces                                         | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/Q901lu7ObAb1hJJ3` | Song'o Halflings                                 | subrace          | held: `racial-traits-394-whole-content-Q901lu7ObAb1hJJ3`         |
| `pf1-content/Q9DPJigrJ8kDDemn` | Fey Magic (Halfling)                             | alternate        | held: `racial-traits-394-whole-content-Q9DPJigrJ8kDDemn`         |
| `pf1-content/Q9pyiVLTHEk6i0fR` | Languages (Merfolk)                              | standard         | held: `racial-traits-394-whole-content-Q9pyiVLTHEk6i0fR`         |
| `pf1-content/QHrUf44V832k8pMm` | Manipulative                                     | standard         | held: `racial-traits-394-whole-content-QHrUf44V832k8pMm`         |
| `pf1-content/QK5CNiDmMqT3cdFB` | Unlucky Halfling                                 | alternate        | held: `racial-traits-394-whole-content-QK5CNiDmMqT3cdFB`         |
| `pf1-content/QKKgx5XFGKCFrwXg` | Wanderlust                                       | alternate        | held: `racial-traits-394-whole-content-QKKgx5XFGKCFrwXg`         |
| `pf1-content/QLhGfJhpG2KXm17L` | Vigilance                                        | alternate        | held: `racial-traits-394-whole-content-QLhGfJhpG2KXm17L`         |
| `pf1-content/QPyW1vOWOSSxqWWv` | Dhampir                                          | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/QR0A1ZzY2Alo3j3S` | Alternate                                        | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/QRux4GYZsfcsvYP2` | Darkvision (Hobgoblin)                           | standard         | held: `racial-traits-394-whole-content-QRux4GYZsfcsvYP2`         |
| `pf1-content/QbRefHZlsADS7c1G` | Alternate                                        | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/QdzlzrqWtgfjE4Fs` | Ancient Enmity                                   | alternate        | held: `racial-traits-394-whole-content-QdzlzrqWtgfjE4Fs`         |
| `pf1-content/Qg5f0jB4eeVRC3e5` | Alternate                                        | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/QgiMP50bjeNmLvbI` | Hag Racial Trait (Changeling - Green Widow)      | standard         | held: `racial-traits-394-whole-content-QgiMP50bjeNmLvbI`         |
| `pf1-content/Qgkfifudu74ghm0o` | Change Shape (Skinwalker - Witchwolf)            | subrace standard | held: `racial-traits-394-whole-content-Qgkfifudu74ghm0o`         |
| `pf1-content/QhJ7FgCkYyiR6ZpR` | Languages (Samsaran)                             | standard         | held: `racial-traits-394-whole-content-QhJ7FgCkYyiR6ZpR`         |
| `pf1-content/QjhAMEEff8AzuwPa` | Amorphous                                        | standard         | held: `racial-traits-394-whole-content-QjhAMEEff8AzuwPa`         |
| `pf1-content/QkJI00xDaBcowq2i` | Deep Kin                                         | subrace          | held: `racial-traits-394-whole-content-QkJI00xDaBcowq2i`         |
| `pf1-content/QmWDxDKnr4PQkfFz` | Deathless Spirit                                 | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/QoUMSih2Xyc3GRR7` | Green-Born (Callow May)                          | subrace          | held: `racial-traits-394-whole-content-QoUMSih2Xyc3GRR7`         |
| `pf1-content/QtSU2kSLH55e6DDI` | Water Sense (Undine)                             | alternate        | held: `racial-traits-394-whole-content-QtSU2kSLH55e6DDI`         |
| `pf1-content/QuCU7zACopBCx8Ob` | Skilled (Kitsune)                                | alternate        | held: `racial-traits-394-whole-content-QuCU7zACopBCx8Ob`         |
| `pf1-content/Qx1JqPVW0quaOGfY` | Natural Armor (Changeling)                       | standard         | held: `racial-traits-394-whole-content-Qx1JqPVW0quaOGfY`         |
| `pf1-content/QzYMP6bnoI0bDcVv` | Sneaky                                           | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/R0qRSOcfexnzVYYs` | Ghost Hunter                                     | standard         | held: `racial-traits-394-whole-content-R0qRSOcfexnzVYYs`         |

## Notable cases

- **Overstated imported change, fixed (#392 precedent).** Aquatic Ancestry's raw Swim change grants the full Hit Dice; the body and PCGen (`floor(TL/2)`) give half the character level. A row in `reviewed-change-replacements.ts` replaces the formula with `floor(@attributes.hd.total / 2)` (racial type kept; +3 at 7th level), with a paragraph in [curation.md](curation.md#reviewed-change-replacements). No other assessment's closure covers it.
- **Reviewed Modifiers where raw changes don't map.** Unlucky Halfling's −1 on all saves (raw `untypedPerm`), Dreamspeaker's +1 divination DC (school Modifier, as #393's Fell Magic), and Frenzy's +2 racial Constitution and Strength and −2 AC under one "while in your frenzy" Situation (the AC penalty is untyped, on `ac`, never `ac.other`'s armor types).
- **Situational bonuses** (manual Situations): Eternal Grudge, Ancient Enmity (untyped, as the APG wording the pinned body follows), Blasphemous Covenant, Wright (+2 racial on each skill the Foundry notes name for driving checks, and Craft to build or repair vehicles), Unlucky Halfling's curse caster level and DC, Wanderlust's movement caster level, Dreamspeaker's sleep effects, Change Shape (Skinwalker - Witchwolf)'s bestial Wisdom and saving-throw feature, and Memories Beyond Death's +1 on a chosen overlapping Knowledge skill (ten Modifiers, one Situation each).
- **Shared Situations** only where the condition matches exactly: fear (Memories Beyond Death) and chaoticCreatures (Vigilance's dodge bonus to AC).
- **Standard traits of #719 races stay without reviewed Modifiers:** Orc Ferocity, Slow Speed (Gnome), Ability Modifiers (Changeling), Natural Armor (Changeling) and Hag Racial Trait (Changeling - Green Widow). Green Widow's +2 racial Bluff stays a Note on Bluff because the importer files every hag option as a standard trait (the #391 Crawling Skin ruling). Fortunate's +2 racial saves is the imported change; the Svirfneblin race records grant no save bonus, so nothing counts twice.
- **Covered/no-output records:** Orc Ferocity's and Aquatic Ancestry's Foundry `conChecks` notes (drafted onto concentration) are explicit covered/no-output records; the description Note (Orc Ferocity) and the Note on Swim (Aquatic Ancestry) state the rules. Notes the Foundry data put on unrelated statistics are entry-level (Resist Level Drain, Water Sense, Amorphous, Blasphemous Covenant's summoning clause).
- **Bonus types listed for review (#370):** Over-Sized Ears and Wanderlust's raw changes are typed racial where the bodies say "a +4 bonus" and "a +2 bonus"; a change replacement replaces only the formula.
- **Inherited rules beyond the race:** Wright requires Ultimate Combat (PZO1118) for driving checks (PCGen `uc_feats.lst:287`, Skilled Driver); Experimental Body: Blessed requires the APG alchemist (extracts); Unlucky Halfling's linked Ill Omen cites APG and Mythic Adventures, so PZO1126 is required.
- **Listed for review:** Wanderlust cites PZO9280 (Inner Sea Races) p.62, the ARG page; the cited code is required and ARG is not added. Languages (Tiefling) cites PZO1112 p.2645, a page reference no pinned evidence confirms. Weapon Familiarity (Green Martian)'s body names "longswords and spears" while its weaponProf field maps four Proficiencies (Longsword, Spear, Shortspear, Longspear). Amorphous records the amorphous universal monster rule although the body says the being of Ib cannot change shape (it keeps only the immunity).
- **Not modeled, listed:** senses, speeds, spell-like abilities and other actions, natural attacks, size change, energy resistance and spell resistance, creature types, class-skill grants, languages, energy drain immunity, precision and critical immunity, incorporeal damage, summoned creatures, and Military Tradition's choice of two weapon proficiencies (an outstanding proficiency fact).

## Importer and data gaps

- **Unresolved replaced names (own entry; neither #738 nor #739).** Polyglot's header names "Keen Senses, Language" (the halfling's records are "Keen Senses (Halfling)" and "Languages (Halfling)", and the body _alters_ the language trait); Martial Recollection's names "Seed; Nature Magic" (the ghoran's trait is "Natural Magic", and the body _alters_ Seed). With any unmatched name the importer resolves none (#304), so both import with empty `replaces`.
- The racial subtypes, ethnicities and changeling heritages (Spiresworn Elves, Song'o Halflings, Gear Gnomes, Mountain Clan, Deep Kin, Exiled Dwarf, Winter-Born (Snow May), Green-Born (Callow May)) keep "Base Statistics" unmatched, as designed; none is a `reviewedAbilityLineSubraces` heritage.
- The raw upstream keys in `mapRacialTrait` caused no reference failure: no batch key fails admission in the full preview; the bounded preview's 38 failures are links and replacements outside the selection. No journal-page link, no missing pf-items reference and no Orc Atavism are in this batch. Untested cases from the run notes: none (no counts-as replacement, no `local/` heritage resolution, no curated Modifier triggering replacement, no multi-race "Base Statistics" folder).

## Outstanding mechanics

Each record lists its calculation gaps in `mechanicsReview.outstandingCalculations`; none is an attribution hold. The main ones are the items under Notable cases ("Not modeled"), Green Widow's Bluff bonus (blocked by the hag-option importer gap) and Military Tradition's proficiency choice.

## Cross-batch bindings and protected records

Curated on `be85b38b`. Every re-bind uses `buildAssessmentBinding` over the final full `catalog:preview` with this batch's records, with the earlier batch's fixture copies of this batch's keys replaced by the full-preview entries, the inventory `currentBinding` updated and the fixture-based binding checked to agree (all 33 agree). Only the content fingerprints changed; no disposition, evidence, notice or hold changed in the earlier batches. The 33 are every assessment whose full-corpus closure reaches a batch key and that was fresh on the base (checked with the binding code over the baseline full preview): 2 from #387, 5 from #388, 9 from #389, 6 from #390, 1 from #391, 3 from #392, 6 from #393 and 1 from #370.

| Batch, assessment                                | Reaches (this batch)                | Content fingerprint       |
| ------------------------------------------------ | ----------------------------------- | ------------------------- |
| #387 Div-Spawn (Spitespawn)                      | Languages (Tiefling)                | `33fd1077…` → `96f012e5…` |
| #387 Jininese Elves                              | Dreamspeaker                        | `98345451…` → `ac9edd53…` |
| #388 Sensual                                     | Keen Senses (Vishkanya)             | `14de0db2…` → `daaa1ac8…` |
| #388 Ability Modifiers (Changeling - Waker May)  | Ability Modifiers (Changeling)      | `307cf180…` → `0eb677a1…` |
| #388 Divided Attention                           | Orc Ferocity                        | `09413f8d…` → `a67e04d5…` |
| #388 Vampiric Empathy                            | Manipulative                        | `5c43b3f7…` → `1547e685…` |
| #388 Human-Raised (Half-Elf)                     | Integrated                          | `86778618…` → `9016fd99…` |
| #389 Feral                                       | Orc Ferocity                        | `1720b16f…` → `51164a82…` |
| #389 Scarred                                     | Darkvision (Hobgoblin)              | `b630ba36…` → `7bf94f92…` |
| #389 Ability Modifiers (Changeling - Sorrow May) | Ability Modifiers (Changeling)      | `8d7cb34b…` → `c29f4778…` |
| #389 Secretive                                   | Spell-Like Ability (Sylph)          | `3f1c40a1…` → `6e5783a6…` |
| #389 Stoic                                       | Orc Ferocity                        | `0666b4f4…` → `89333900…` |
| #389 Ability Modifiers (Changeling - Virga May)  | Ability Modifiers (Changeling)      | `7b735864…` → `e7a297a1…` |
| #389 Tenacious                                   | Orc Ferocity                        | `9ed8afa0…` → `69bf3d5a…` |
| #389 Hag Magic (ISR)                             | Natural Armor (Changeling)          | `c8e6aed1…` → `a038e4ea…` |
| #389 Nomadic                                     | Polyglot, Fleet of Foot, Wanderlust | `80e240a7…` → `a07444c0…` |
| #390 Sacred Tattoo                               | Orc Ferocity                        | `79643eef…` → `34807906…` |
| #390 Whispering Wind                             | Spell-Like Ability (Sylph)          | `11a977f4…` → `d231fda1…` |
| #390 Oni-Spawn (Hungerseed)                      | Languages (Tiefling)                | `eaf0d271…` → `2b36be8f…` |
| #390 Ability Modifiers (Changeling - Brine May)  | Ability Modifiers (Changeling)      | `733c3bcb…` → `193bd762…` |
| #390 Smokesoul (Fume Sylph)                      | Spell-Like Ability (Sylph)          | `192ce010…` → `96d8ca3e…` |
| #390 Tremorsense                                 | Frenzy                              | `6fad7345…` → `3412f0fd…` |
| #391 Weather Savvy                               | Spell-Like Ability (Sylph)          | `f684feff…` → `4693f80c…` |
| #392 Ability Modifiers (Changeling - Snow May)   | Ability Modifiers (Changeling)      | `d6840799…` → `93aa5cdd…` |
| #392 Fey Magic (Half-Orc)                        | Orc Ferocity                        | `7dec86e2…` → `9cdbd415…` |
| #392 Rakshasa-Spawn (Beastbrood)                 | Languages (Tiefling)                | `e8c6c4b5…` → `c40282fc…` |
| #393 Ability Modifiers (Changeling - Moon May)   | Ability Modifiers (Changeling)      | `7562d301…` → `eafa6f24…` |
| #393 Ability Modifiers (Changeling - Hearth May) | Ability Modifiers (Changeling)      | `5107609c…` → `b47302f5…` |
| #393 Gatecrasher                                 | Orc Ferocity                        | `2221a888…` → `03400ef6…` |
| #393 Hag Magic (AoE)                             | Natural Armor (Changeling)          | `9c94cd90…` → `0b5418b9…` |
| #393 Asura-Spawn (Faultspawn)                    | Languages (Tiefling)                | `ec16a24b…` → `6e6485ff…` |
| #393 Vampire Hunter                              | Manipulative                        | `512365e5…` → `97b38b48…` |
| #370 Wild Ferocity (Half-Orc)                    | Orc Ferocity                        | `6e30086e…` → `9a2920d6…` |

They are recorded in each batch's inventory `currentBinding` and `tests/fixtures/<batch>/preview.json`.

- **Already stale, not re-bound:** 25 assessments that reach batch keys were stale on the base (the deferred stale set): 23 #328 race records, Extra Gnome Magic and Lifecrafting.
- **Protected and fixture copies:** no batch key is a protected root of an earlier batch. `feats-355/binding-preview.json` copies three batch keys (Keen Senses (Vishkanya), Blindsense (Sahuagin), Slow Speed (Gnome)) that no #355 assessment's closure reaches, and the #530 to #536 and #350 to #355 `protected-context.json` lists name 27 batch keys only as context definitions.
- **In-flight batches:** no #424 key is in this batch's closures.

## Binding

Every assessment is bound with `buildAssessmentBinding` against the full-corpus content closure: the final full `catalog:preview` artifact, with the batch's 68 entries and their 81 closure entries. The [preview fixture](../../tests/fixtures/racial-traits-394/preview.json) keeps both, so the batch test rebuilds every binding from a clean shared-store tree (0 mismatches).

## Tests

The [resolver tests](../../tests/catalog/racial-traits-394.test.ts) pin Unlucky Halfling replacing Halfling Luck on a halfling sheet (saves +1 to −1), every Situation-gated bonus (off by default, on when selected), the shared Situations, distinct racial Sources stacking, imported values not curated twice, the Aquatic Ancestry replacement formula, the school DC, and no `ac.other` armor, shield or natural armor bonus; all 31 required and 68 description records checked, the two covered records and the Note targets; the race, alternate, monster-ability, inherited and Unchained notice dependencies (20 PZO1131 keys, own action versus bound body) and every enforced hold; the importer's reading and the exact unresolved names; every pinned body, PCGen row and PRD paragraph in the shared store; and re-extraction from a clean shared-store tree with every binding reproduced, all 68 records held on their own reasons (Weapon Familiarity (Green Martian) on the Dynamite source-matched hold), and a confirmed Slow Speed (Gnome) still held.

The [isolated saved-sheet test](../../tests/catalog/racialTraits394.integration.test.ts) exercises public Convex reads and writes: a halfling-identity race granting Halfling Luck, Sure-Footed and Keen Senses takes the held Unlucky Halfling, Secretive Survivor and Fey Magic (Halfling) (saves −2 each, Acrobatics and Climb −2, Bluff and Stealth +2, Perception −2) and turns them off again, with saved totals equal to the preview; outsiders, anonymous callers and another campaign's entry are refused without changing the sheet. The shared held-release round trip is covered once by the release test in [`traits367.integration.test.ts`](../../tests/catalog/traits367.integration.test.ts). No deployment or production activation occurred.

## Preservation and gates

The shared canonical files gain only this batch's entries: 99 curation records (68 description and 31 note records), 68 assessments, 68 evidence entries and 40 notice holds, plus one reviewed change replacement. The other changes are the listed re-binds (content fingerprints only) with their `currentBinding` and fixture copies. Shared-file diff stat against `be85b38b` (`git diff --stat --diff-algorithm=histogram HEAD`):

```text
 docs/catalog-import/curation.md                   |    2 +
 scripts/catalog/legal/held-notices.json           |  378 ++++
 scripts/catalog/legal/racial-traits-387.json      |    4 +-
 scripts/catalog/legal/racial-traits-388.json      |   10 +-
 scripts/catalog/legal/racial-traits-389.json      |   18 +-
 scripts/catalog/legal/racial-traits-390.json      |   12 +-
 scripts/catalog/legal/racial-traits-391.json      |    2 +-
 scripts/catalog/legal/racial-traits-392.json      |    6 +-
 scripts/catalog/legal/racial-traits-393.json      |   12 +-
 scripts/catalog/legal/traits-370.json             |    2 +-
 scripts/catalog/reviewed-change-replacements.ts   |   15 +
 scripts/catalog/reviewed-curation.json            | 2192 +++++++++++++++++++++
 src/lib/catalog/data/attribution-assessments.json | 1700 +++++++++++++++-
 src/lib/catalog/data/attribution-evidence.json    |  204 ++
 tests/fixtures/racial-traits-387/preview.json     |   37 +-
 tests/fixtures/racial-traits-388/preview.json     |   37 +-
 tests/fixtures/racial-traits-389/preview.json     |   63 +-
 tests/fixtures/racial-traits-390/preview.json     |   64 +-
 tests/fixtures/racial-traits-391/preview.json     |    5 +
 tests/fixtures/racial-traits-392/preview.json     |   21 +-
 tests/fixtures/racial-traits-393/preview.json     |   35 +-
 tests/fixtures/traits-370/preview.json            |   11 +-
 22 files changed, 4700 insertions(+), 130 deletions(-)
```

<!-- prep:shared-store-count -->

New shared-store files (`tests/fixtures/pinned/`), counted by prep after the rebase onto `a76e43fd`: **96** (pcgen 1, pf1 3, pf1-content 92).

<!-- /prep:shared-store-count -->

The batch adds to the shared store the 76 of its 100 pinned records the store lacked (24, such as Orc Ferocity and the changeling standard traits, were already on the base), two pf-racial-traits folder records above them, the 14 linked racial traits and 3 linked spells the bodies name, and the Blood of the Beast PCGen race-ability file; the race records, the other PCGen files and the PRD pages were already on the base and are reused.

The complete preview of `be85b38b` plus this batch reported **94 admitted, 23,160 held, 2 dependent omissions and 2,417 failures**, 31 fewer than the base's 2,448 (this batch's required note records). No batch key is among the failures. The full-corpus gate is therefore a documented failure, not a claim of whole-corpus readiness.

| Command                                                                                                                                                                                   | Result                                                                                                                                         |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `catalog:curate --candidates …` (required) and `--descriptions` (prose pass)                                                                                                              | pass; 31 required drafts, 18 prose drafts; about 12 s each                                                                                     |
| `catalog:preview --candidates …`                                                                                                                                                          | exit 1; 0 admitted / 30 held / 38 failures, all links and replacements outside the selection                                                   |
| Full `catalog:curate`                                                                                                                                                                     | pass; 1,311 new drafts, none for this batch; 0 missing; the known Orang-Pendak and Dwarf race note records stale (as on the base); about 3 min |
| Full `catalog:preview` (baseline, then final records)                                                                                                                                     | exit 1; 2,448 failures on the base, 2,417 with this batch, no batch key among them; about 9 min each plus admission queue                      |
| Full re-bind (`bind.ts`, `xrebind394.ts` over the final full preview)                                                                                                                     | 68 assessments bound, 81 closure entries, 0 mismatches against the clean-tree reconstruction; 33 earlier assessments re-bound, fixtures agree  |
| `pnpm test` of the batch tests and the guards (`notice-holds`, `pinned-sources`, `cross-batch-bindings`, `batch-ownership-sweep`, `ac-other-defense-bonuses`) (one worker)                | pass; 7 files / 163 tests (the batch test after fixing its own Kindred-Raised and Dreamspeaker assertions); about 6 min                        |
| `pnpm test` of the affected earlier tests (`racial-traits-387` to `-393`, `traits-370`, `racial-traits-719`, `race-facts-720`, `race-ability-721`, `races-328`, `feats-355`) (one worker) | pass; 13 files / 335 tests; about 2 min                                                                                                        |
| `pnpm -s typecheck`                                                                                                                                                                       | pass                                                                                                                                           |
| `pnpm -s lint`                                                                                                                                                                            | pass; about 2.5 min                                                                                                                            |
| `pnpm -s check:initial-migration-writers`                                                                                                                                                 | pass; 185 registrations                                                                                                                        |
| `pnpm catalog:pin`                                                                                                                                                                        | pass; `sha256:005ef0b9…`                                                                                                                       |
| `pnpm catalog:notice-deps`                                                                                                                                                                | pass; 0 gaps; 38 advisory warnings, none for this batch                                                                                        |
| `pnpm catalog:format --check`                                                                                                                                                             | pass                                                                                                                                           |

`pnpm test tests/catalog` was left to the orchestrator's prep run on the rebased commit, as the brief directs.
