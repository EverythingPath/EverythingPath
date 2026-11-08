# Racial traits #392: pf1-content pf-racial-traits batch 6

Reviewed by **Opus (AI curator) for the owner**, 2026-10-19.

Exactly the issue's 100 ordered, unique keys were reviewed: **0 admitted, 75 specifically held, 0 dependent omissions, 0 whole-entry unsupported/prose-only dispositions, 25 exclusions, 0 record-level 3.5 holds**. The exclusions are 14 Foundry `!folders!` records (13 race folders and the Race Builder's Movement folder), which the importer's folder contract leaves out of the Catalog Entries (PRD Decision 17), and 11 records in the Advanced Race Guide Race Builder subtree, which the import contract excludes by folder ancestry ([README](README.md), explicit exclusions) and the [Racial Trait contract](../character-sheet/racial-traits.md) puts out of scope. No candidate carries a `3.5` tag. The 75 in-scope records are 27 standard racial traits, 35 alternates, 8 Subrace Standard heritage parts and 5 Subraces-folder heritages or racial subtypes.

The [machine-readable inventory and evidence](../../scripts/catalog/legal/racial-traits-392.json) records, per key, the complete pinned body and inert fields with their source hash and cited sources; the PCGen race-ability rows, PRD Advanced Race Guide paragraphs, leads and rejected rows; the inherited-rule notices with their evidence, the linked bodies and the unresolved origins; the importer's reading of race, standard flag and replacements; every checked curation record, source discrepancies and calculation gaps; and the current assessment binding and mapped facts. This report summarizes them and does not repeat the evidence.

## #328 S4-B launch update

Reviewed 2026-11-01 by **Sol (AI curator) for the owner** ([races-328.md](races-328.md#s4-b-launch-half-elf-elf-gnome-and-halfling)). The S4-B launch review confirms 4 standard racial traits of Half-Elf, Elf, Gnome and Halfling with content-bound assessments; counts are now **7 admitted, 68 held**, with 25 exclusions unchanged. The earlier Opus review of each row stays in its `assessmentHistory`; every other candidate keeps its review and holds.

- **Halfling Luck** (`pf1-content/HVI7FNwj2ng10qtj`): matches the PRD ARG paragraph (`advancedRaceGuide/coreRaces/halflings.html:368`) word for word; PCGen's Core Essentials row (`halfling/halfling_abilities_race.lst:22`) word for word. Its Modifier is +1 racial on all saves. Required notices: PZO9280, PZO1121, PZO1110.
- **Low-Light Vision (Half-Elf)** (`pf1-content/I8Zy5iy8HpAxBZQb`): matches the PRD ARG paragraph (`advancedRaceGuide/coreRaces/halfElves.html:367`) word for word; PCGen's Core Essentials row (`half_elf/halfelf_abilities_race.lst:21`) word for word. Low-light vision stays readable. Required notices: PZO9280, PZO1121, PZO1112, PZO1110. Outstanding: Low-light vision is permitted prose; no sense statistic.
- **Defensive Training (Gnome)** (`pf1-content/IQ5vHUbNbGqVaVV5`): matches the PRD ARG paragraph (`advancedRaceGuide/coreRaces/gnomes.html:370`) apart from "get" for "gain"; an added "their"; "type" for "subtype"; PCGen's Core Essentials row (`gnome/gnome_abilities_race.lst:22`) with the recorded DESC differences. Its Modifier is +4 dodge AC in the shared Situation giants, re-homed from the Gnome's checked note record (the same Situation Defensive Training (Dwarf) uses). Required notices: PZO9280, PZO1121, PZO1110. **Flagged for the reviewer:** Judgement 1: the body reads "monsters of the giant type" where the ARG and PCGen read "subtype". Giant is a creature subtype, not a type, and the Gnome's own race body says "giant subtype"; the target is unchanged (the shared giants Situation, the same one the Gnome race note and Defensive Training (Dwarf) use), so the word is recorded, not resolved, and changes no rule.
- **Languages (Elf)** (`pf1-content/IuApwtNYMYMTabOZ`): matches the PRD ARG paragraph (`advancedRaceGuide/coreRaces/elves.html:372`) apart from an added "languages"; PCGen's Core Essentials row (`elf/elf_abilities_race.lst:26`) with the recorded DESC differences. Languages (Common and Elven; the bonus-language list) stay readable prose; the record's languages field stays in gameContent. Required notices: PZO9280, PZO1121, PZO1110. Outstanding: Languages are permitted prose; no language statistic.

Each row's whole-content hold ("Book PDFs unavailable") is superseded by this comparison, and it records no notice hold: PZO1110 is reviewed, PZO1121's Registry hold and `racial-traits-392-notice-PZO1121-complete-chain` are cleared (`notice-clearances.json`, owner 2026-10-30), and PZO9280's reviewed confirmation waives `racial-traits-392-notice-PZO9280-complete-chain`; the PZO1112 (low-light vision) and PZO1131 (Unchained action costs) batch holds are cleared too. The batch's `noticeRequirements` rows keep these keys as history. Content fingerprints are unchanged (the imported entries are identical); only the status, rationale, evidence and notice bindings move.

Tests: `racial-traits-392.test.ts` checks the confirmed rows with the held ones (`assessedTraits` in the fixture), expects them admitted by the committed gate and records no hold for them.

## #328 S4-A launch update

Reviewed 2026-11-01 by **Sol (AI curator) for the owner** ([races-328.md](races-328.md#s4-a-launch-human-dwarf-and-half-orc)). The launch review admits 3 standard racial traits of Human, Dwarf and Half-Orc with confirmed, content-bound assessments; counts are now **3 admitted, 72 held**, with 25 exclusions unchanged. The earlier Opus review of each admitted row stays in its `assessmentHistory`; every other candidate keeps its review and holds.

- **Orc Blood** (`pf1-content/JWzMBJeAQYDav9gw`): matches the PRD ARG paragraph (`advancedRaceGuide/coreRaces/halfOrcs.html:372`) word for word; PCGen's Core Essentials row (`half_orc/halforc_abilities_race.lst:23`). It sets countsAsRaces to the Orc (pf1/JOuAdPAOTat7d5v6) and Human (pf1/e6IaBxKgMxy1yKlr) races, which race prerequisites read (src/lib/catalog-rule-lookups.ts). Required notices: PZO9280, PZO1121, PZO1110.
- **Slow and Steady (Dwarf)** (`pf1-content/JsvoElxHBPdle8s8`): matches the PRD ARG paragraph (`advancedRaceGuide/coreRaces/dwarves.html:362`) word for word; PCGen's Core Essentials row (`dwarf/dwarf_abilities_race.lst:20`). Base speed 20 feet and the armor/encumbrance clause stay prose: the sheet has no movement statistic (Foundry's landSpeed set and changeFlags are unmapped). Required notices: PZO9280, PZO1121, PZO1110. Outstanding: Speed and the never-modified-by-armor-or-encumbrance clause: #740, owner 2026-10-31 "prose is fine for now".
- **Hatred (Dwarf)** (`pf1-content/JtJKg8vV58UJ6m1m`): matches the PRD ARG paragraph (`advancedRaceGuide/coreRaces/dwarves.html:366`) apart from "receive" for "gain"; no "racial"; PCGen's Core Essentials row (`dwarf/dwarf_abilities_race.lst:24`). Its Modifiers are +1 racial attack in two local Situations (humanoids of the orc subtype; of the goblinoid subtype), re-homed from the Dwarf's checked note record. Required notices: PZO9280, PZO1121, PZO1110.

Each admitted row's whole-content hold ("Book PDFs unavailable") is superseded by this comparison, and it records no notice hold: PZO1110 is reviewed, PZO1121's Registry hold is cleared (owner, 2026-10-30), and PZO9280's reviewed confirmation waives `racial-traits-392-notice-PZO9280-complete-chain`. The batch's `noticeRequirements` rows keep these keys as history. Content fingerprints are unchanged (the imported entries are identical); only the status, rationale, evidence and notice bindings move.

Tests: `racial-traits-392.test.ts` checks the admitted rows with the held ones (`assessedTraits` in the fixture), expects them admitted by the committed gate and records no hold for them.

## Family rulings applied

This batch follows the #387 rulings Sol approved for the family:

1. **Every in-scope record is held** with a whole-content hold: the race records stay held (#328), every cited book's notice chain is held (33 notice holds, 15 of them for codes with no Registry identity), and no book PDFs are available.
2. **Race abilities.** Every record requires the books its pinned race record cites, recorded as an inherited rule with the race record's location. Sexual Dimorphism's folder (`Lashunta`) binds no race record, so the books of both pinned lashunta records are recorded, as #391 did.
3. **Alternate framework.** Every record in an Alternate folder records the APG alternate racial trait rule (PZO1115, `apg_abilities_race.lst:86`).
4. **Monster abilities** take the earliest book the pinned Universal Monster Rules page lists: darkvision PZO1127; low-light vision, scent, natural attacks, resistance, spell resistance, fast healing, poison, amphibious, ferocity, change shape and telepathy PZO1112.
5. **Creature types** (construct, ratfolk, the aquatic subtype) and sahkils stay named unresolved origins.
6. **PZO1131** for Unchained action-cost metadata anywhere in the bound closure: 18 records (11 on their own actions, 13 through bound bodies).
7. **Comparisons.** 38 records have a PCGen row from a pinned book as their `comparison`; 28 more have only Core Essentials support rows (no SOURCELONG book), which are leads whose book is not required; 9 have no row. 28 records carry a PRD `prdComparison` from the pinned capture (20 match word for word).
8. **Description pass.** Every in-scope record has a checked description record: its reviewed Modifiers plus one entry-level Note with the body, Foundry enrichers read as text.
9. **Racial bonuses from distinct Sources stack**; no gap claims otherwise. The resolver test shows Halfling Luck (+1) and #387's Irrepressible (+2) giving +3 on a save against domination.

## Dispositions

| Key                            | Name                                                | Kind             | Disposition                                                      |
| ------------------------------ | --------------------------------------------------- | ---------------- | ---------------------------------------------------------------- |
| `pf1-content/H60rZUqCEkij0cwp` | Weather Savvy                                       | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/H8rQtfSQ6Ws9EicL` | Sexual Dimorphism                                   | standard         | held: `racial-traits-392-whole-content-H8rQtfSQ6Ws9EicL`         |
| `pf1-content/HC3Bca5jWDNu0lWb` | Glider                                              | alternate        | held: `racial-traits-392-whole-content-HC3Bca5jWDNu0lWb`         |
| `pf1-content/HEOPhaWDWb6tyTnS` | Ability Modifiers (Changeling - Snow May)           | subrace standard | held: `racial-traits-392-whole-content-HEOPhaWDWb6tyTnS`         |
| `pf1-content/HFKHorjMw2dERwBo` | Craftsman                                           | alternate        | held: `racial-traits-392-whole-content-HFKHorjMw2dERwBo`         |
| `pf1-content/HIyj3yO9hq41OXcK` | Shadow Caster                                       | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/HKY25NxPZPmmCyLp` | Languages (Shabti)                                  | standard         | held: `racial-traits-392-whole-content-HKY25NxPZPmmCyLp`         |
| `pf1-content/HLRPBh2KsFeAZ80f` | Lightbringer                                        | alternate        | held: `racial-traits-392-whole-content-HLRPBh2KsFeAZ80f`         |
| `pf1-content/HODSs5WDOVKrQJmT` | Natural Armor (Triton)                              | standard         | held: `racial-traits-392-whole-content-HODSs5WDOVKrQJmT`         |
| `pf1-content/HSEQTjNZ9ZPnhZUZ` | Beast Talker                                        | alternate        | held: `racial-traits-392-whole-content-HSEQTjNZ9ZPnhZUZ`         |
| `pf1-content/HVI7FNwj2ng10qtj` | Halfling Luck                                       | standard         | held: `racial-traits-392-whole-content-HVI7FNwj2ng10qtj`         |
| `pf1-content/HVrPKFO3jjYdMj6E` | Slow and Steady (Duergar)                           | standard         | held: `racial-traits-392-whole-content-HVrPKFO3jjYdMj6E`         |
| `pf1-content/HZkPgVdKUdcECvIX` | Fetchling                                           | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/HapMiOpR6SZycm6F` | Intrepid Settler                                    | alternate        | held: `racial-traits-392-whole-content-HapMiOpR6SZycm6F`         |
| `pf1-content/HdO6Xf8qZgaYWFNa` | Scaled Skin                                         | alternate        | held: `racial-traits-392-whole-content-HdO6Xf8qZgaYWFNa`         |
| `pf1-content/HgsRDdx0DWvccvNd` | Burning Assurance (Sandkin)                         | alternate        | held: `racial-traits-392-whole-content-HgsRDdx0DWvccvNd`         |
| `pf1-content/Hi2xxPj8RqlQ5NYn` | Tripping Tentacles                                  | alternate        | held: `racial-traits-392-whole-content-Hi2xxPj8RqlQ5NYn`         |
| `pf1-content/Hl9pUifDtWTNl8Ce` | Natural Armor (Gathlain)                            | standard         | held: `racial-traits-392-whole-content-Hl9pUifDtWTNl8Ce`         |
| `pf1-content/HlQZHVl2g1ALQvcU` | Construct                                           | standard         | held: `racial-traits-392-whole-content-HlQZHVl2g1ALQvcU`         |
| `pf1-content/Hlouei1c7jB5cV99` | Climb                                               | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/HomUlBQh0EYivpPx` | Imposter-Wary                                       | alternate        | held: `racial-traits-392-whole-content-HomUlBQh0EYivpPx`         |
| `pf1-content/Hp26XuRpA7QNUOZO` | Ironsoul (Metal Oread)                              | subrace          | held: `racial-traits-392-whole-content-Hp26XuRpA7QNUOZO`         |
| `pf1-content/Hr7VZkVINGbLYfpo` | Celestial Resistance                                | standard         | held: `racial-traits-392-whole-content-Hr7VZkVINGbLYfpo`         |
| `pf1-content/HuTHL7T1EdrjNmVr` | Dayguard                                            | alternate        | held: `racial-traits-392-whole-content-HuTHL7T1EdrjNmVr`         |
| `pf1-content/HwNbN3nPop23QbOP` | Alternate                                           | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/HzKBmWjSHjYSNsU9` | Relentless                                          | alternate        | held: `racial-traits-392-whole-content-HzKBmWjSHjYSNsU9`         |
| `pf1-content/I0yTReZxAfE5biVp` | Mountain Half-Orcs (Cragkin)                        | subrace          | held: `racial-traits-392-whole-content-I0yTReZxAfE5biVp`         |
| `pf1-content/I1G2vlwgLPPKgAkC` | Wary                                                | alternate        | held: `racial-traits-392-whole-content-I1G2vlwgLPPKgAkC`         |
| `pf1-content/I5gERPgPEuK7wW5I` | Alternate                                           | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/I6yOviSAKlkZqshg` | Bullying                                            | alternate        | held: `racial-traits-392-whole-content-I6yOviSAKlkZqshg`         |
| `pf1-content/I8Zy5iy8HpAxBZQb` | Low-Light Vision (Half-Elf)                         | standard         | held: `racial-traits-392-whole-content-I8Zy5iy8HpAxBZQb`         |
| `pf1-content/I9fkqO4nc2dW3z5O` | Skilled                                             | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/IFQQ7tPmJJM0ADpU` | Fey Magic (Half-Orc)                                | alternate        | held: `racial-traits-392-whole-content-IFQQ7tPmJJM0ADpU`         |
| `pf1-content/IFsGVU8XTl62vLHu` | Wing-Clipped                                        | alternate        | held: `racial-traits-392-whole-content-IFsGVU8XTl62vLHu`         |
| `pf1-content/IGdp7NHex91tWhaA` | Alternate                                           | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/IJGd1TSyqGZb8BkZ` | Ingratiating                                        | alternate        | held: `racial-traits-392-whole-content-IJGd1TSyqGZb8BkZ`         |
| `pf1-content/IJRr9hW0I3JvpP43` | Fangs                                               | alternate        | held: `racial-traits-392-whole-content-IJRr9hW0I3JvpP43`         |
| `pf1-content/IMMiUPW6WLWA1Ur0` | Telepathic Senses                                   | standard         | held: `racial-traits-392-whole-content-IMMiUPW6WLWA1Ur0`         |
| `pf1-content/IMoj6UWbaCG3nGLM` | Skilled (Tiefling - Beastbrood)                     | subrace standard | held: `racial-traits-392-whole-content-IMoj6UWbaCG3nGLM`         |
| `pf1-content/INprX7ISw247EOKK` | Enclave Protector                                   | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/IPPDGMZfb6Lfx9ij` | Tiefling                                            | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/IQ5vHUbNbGqVaVV5` | Defensive Training (Gnome)                          | standard         | held: `racial-traits-392-whole-content-IQ5vHUbNbGqVaVV5`         |
| `pf1-content/IQMSioY3z5n7YnvD` | Hydrated Vitality                                   | alternate        | held: `racial-traits-392-whole-content-IQMSioY3z5n7YnvD`         |
| `pf1-content/IQphttqw1U0aVd3j` | Hag Racial Trait (Changeling - Sea Lungs)           | standard         | held: `racial-traits-392-whole-content-IQphttqw1U0aVd3j`         |
| `pf1-content/IR01WybC7O8a3cwc` | Standard                                            | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/ISDM23EtuZrM7FYC` | Natural Weapon (Rougarou)                           | standard         | held: `racial-traits-392-whole-content-ISDM23EtuZrM7FYC`         |
| `pf1-content/IcEKOd8iP5Pcehuo` | Subrace                                             | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/If5pzCueoAcW1gH8` | Psychic Sensitivity                                 | alternate        | held: `racial-traits-392-whole-content-If5pzCueoAcW1gH8`         |
| `pf1-content/Igl9Y5Dsn0JUc2p2` | Skilled (Half-Orc)                                  | alternate        | held: `racial-traits-392-whole-content-Igl9Y5Dsn0JUc2p2`         |
| `pf1-content/IhuFP2bF95CxfXim` | Limber                                              | standard         | held: `racial-traits-392-whole-content-IhuFP2bF95CxfXim`         |
| `pf1-content/IihEWtYnIufBuARs` | Ward against Corruption                             | standard         | held: `racial-traits-392-whole-content-IihEWtYnIufBuARs`         |
| `pf1-content/IqAHfnk4nZFtNoiO` | Student of the City                                 | alternate        | held: `racial-traits-392-whole-content-IqAHfnk4nZFtNoiO`         |
| `pf1-content/IrGbEnYCmrcDJRtd` | Psychic Attunement                                  | standard         | held: `racial-traits-392-whole-content-IrGbEnYCmrcDJRtd`         |
| `pf1-content/Is0b85FOWlGlamTK` | Exalted Resistance                                  | alternate        | held: `racial-traits-392-whole-content-Is0b85FOWlGlamTK`         |
| `pf1-content/IsWc0OR9iZHYdi8V` | Dragon Soul                                         | alternate        | held: `racial-traits-392-whole-content-IsWc0OR9iZHYdi8V`         |
| `pf1-content/IuApwtNYMYMTabOZ` | Languages (Elf)                                     | standard         | held: `racial-traits-392-whole-content-IuApwtNYMYMTabOZ`         |
| `pf1-content/Iwrwzoq5uWYKNHty` | Other Races                                         | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/IyUQ79MttCnXeN09` | Alternate                                           | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/IyVxBas4dlfht6tU` | Spirit of the Waters                                | alternate        | held: `racial-traits-392-whole-content-IyVxBas4dlfht6tU`         |
| `pf1-content/J1Dwg9toMkISFKjK` | Weapon Familiarity (Goblin)                         | alternate        | held: `racial-traits-392-whole-content-J1Dwg9toMkISFKjK`         |
| `pf1-content/J4yZRm0uY0156HhY` | Industrious                                         | alternate        | held: `racial-traits-392-whole-content-J4yZRm0uY0156HhY`         |
| `pf1-content/J65XMmSdfKBUu43b` | Seasinger                                           | alternate        | held: `racial-traits-392-whole-content-J65XMmSdfKBUu43b`         |
| `pf1-content/JAbeHqFork30yKAt` | Elf-Raised                                          | subrace          | held: `racial-traits-392-whole-content-JAbeHqFork30yKAt`         |
| `pf1-content/JB9m2sNBMDG3cV7t` | Ratfolk                                             | standard         | held: `racial-traits-392-whole-content-JB9m2sNBMDG3cV7t`         |
| `pf1-content/JJCX1zB7PDtiyWry` | Spell Resistance (Drow Noble)                       | standard         | held: `racial-traits-392-whole-content-JJCX1zB7PDtiyWry`         |
| `pf1-content/JLGJMVewolF9XNVW` | Rakshasa-Spawn (Beastbrood)                         | subrace          | held: `racial-traits-392-whole-content-JLGJMVewolF9XNVW`         |
| `pf1-content/JQ5GKhU4fgbLDkpF` | Alternate Skill Modifiers (Skinwalker - Nightskulk) | subrace standard | held: `racial-traits-392-whole-content-JQ5GKhU4fgbLDkpF`         |
| `pf1-content/JRAuStEQiJCdtUwp` | Spell-Like Abilities (Fetchling - Plane Shift)      | standard         | held: `racial-traits-392-whole-content-JRAuStEQiJCdtUwp`         |
| `pf1-content/JWzMBJeAQYDav9gw` | Orc Blood                                           | standard         | held: `racial-traits-392-whole-content-JWzMBJeAQYDav9gw`         |
| `pf1-content/JYBBbQdb096At3uS` | Body Thorns                                         | alternate        | held: `racial-traits-392-whole-content-JYBBbQdb096At3uS`         |
| `pf1-content/JZTCeWXAOZP3iu70` | Standard                                            | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/JbnIvI7j1PdXhFTw` | Illusion Resistance                                 | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/Jd9xntfeAWCOXKTY` | Hypnotic Gaze                                       | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/JdUecbyHLbK4aqT3` | Amphibious                                          | alternate        | held: `racial-traits-392-whole-content-JdUecbyHLbK4aqT3`         |
| `pf1-content/JdmRjdRfq9S16pmP` | Change Shape (Skinwalker - Seascarred)              | subrace standard | held: `racial-traits-392-whole-content-JdmRjdRfq9S16pmP`         |
| `pf1-content/JhEI4m5iFNvOgm9H` | Lightning Affinity (Sylph - Stormsoul)              | subrace standard | held: `racial-traits-392-whole-content-JhEI4m5iFNvOgm9H`         |
| `pf1-content/JkYEEoXqg586RnrU` | Normal Speed (Undine)                               | standard         | held: `racial-traits-392-whole-content-JkYEEoXqg586RnrU`         |
| `pf1-content/JlymGAKiie1gmqI2` | Weapon Familiarity (Orc)                            | standard         | held: `racial-traits-392-whole-content-JlymGAKiie1gmqI2`         |
| `pf1-content/JmY7RO5K6KAnO4BH` | Lucky, Lesser                                       | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/Jnw41wF4ln2vH7d8` | Svirfneblin Magic (Svirfneblin)                     | standard         | held: `racial-traits-392-whole-content-Jnw41wF4ln2vH7d8`         |
| `pf1-content/JpCDy27IK3xb1DeK` | Skilled (Tiefling - Pitborn)                        | subrace standard | held: `racial-traits-392-whole-content-JpCDy27IK3xb1DeK`         |
| `pf1-content/JqYNnxJSPBm6aC5k` | Movement                                            | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/JsvoElxHBPdle8s8` | Slow and Steady (Dwarf)                             | standard         | held: `racial-traits-392-whole-content-JsvoElxHBPdle8s8`         |
| `pf1-content/JtJKg8vV58UJ6m1m` | Hatred (Dwarf)                                      | standard         | held: `racial-traits-392-whole-content-JtJKg8vV58UJ6m1m`         |
| `pf1-content/JtvsIm1JAxjAL2YL` | Alternate Weakness (Dhampir - Ancient-Born)         | subrace standard | held: `racial-traits-392-whole-content-JtvsIm1JAxjAL2YL`         |
| `pf1-content/JuBq7kP20NXqHu1h` | Alternate                                           | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/JurU0JeI27uBxqLH` | Tribalistic                                         | alternate        | held: `racial-traits-392-whole-content-JurU0JeI27uBxqLH`         |
| `pf1-content/K0OwTmAv3gNkTc8B` | Change Shape (Skinwalker - Bloodmarked)             | subrace standard | held: `racial-traits-392-whole-content-K0OwTmAv3gNkTc8B`         |
| `pf1-content/K0diut2YgUGdeXRG` | Treespeech                                          | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/K2EflQoRjUsrIMyR` | Sneaky (Hobgoblin)                                  | standard         | held: `racial-traits-392-whole-content-K2EflQoRjUsrIMyR`         |
| `pf1-content/K7YBN0QKQeWCJZ9K` | Breeze-Kissed (Sylph)                               | alternate        | held: `racial-traits-392-whole-content-K7YBN0QKQeWCJZ9K`         |
| `pf1-content/K8MPTqH6wXv1qsGS` | Poison Minion (Human)                               | alternate        | held: `racial-traits-392-whole-content-K8MPTqH6wXv1qsGS`         |
| `pf1-content/K9zkM020ZgkC0gYA` | Master Tinker                                       | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/KCaTgWITt5MUDVQT` | Desert Delver                                       | alternate        | held: `racial-traits-392-whole-content-KCaTgWITt5MUDVQT`         |
| `pf1-content/KEDQumXdts1m9M82` | Half-Elf                                            | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/KEXruHT9nIp41wT1` | Peri-Blooded (Emberkin)                             | subrace          | held: `racial-traits-392-whole-content-KEXruHT9nIp41wT1`         |
| `pf1-content/KEijNXH9Jnwa1Ggb` | Dragon Scholar                                      | alternate        | held: `racial-traits-392-whole-content-KEijNXH9Jnwa1Ggb`         |
| `pf1-content/KFfarHpxjH2YZRa3` | Shadowplay                                          | alternate        | held: `racial-traits-392-whole-content-KFfarHpxjH2YZRa3`         |
| `pf1-content/KH1Wjk7EJlFPBwP0` | Spell-Like Ability, Greater                         | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/KMPtEFezdRZosq6n` | Subrace                                             | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |

## Notable cases

- **Heritages curated with their ability lines.** Ironsoul (Metal Oread) (+2 Con, +2 Wis, -2 Dex), Rakshasa-Spawn (Beastbrood) (+2 Dex, +2 Cha, -2 Wis) and Peri-Blooded (Emberkin) (+2 Int, +2 Cha) get racial ability Modifiers, so "Base Statistics" resolves to their race's ability score trait, which goes dormant (as #387 to #391 did). Their closures now reach the race and its standard traits.
- **Subrace Standard replacements by name.** Ability Modifiers (Changeling - Snow May) replaces the changeling's Ability Modifiers trait (untyped +2 Int, +2 Wis, -2 Con, imported); Skilled (Tiefling - Beastbrood) and Skilled (Tiefling - Pitborn) replace the tiefling's Skilled; the resolver test shows the replaced bonuses going dormant.
- **Seasinger (Merfolk): overstated imported change fixed, listed for review.** Foundry grants an untyped +2 on every Perform skill; the body and PCGen's ARG row give a +2 racial bonus on Perform (sing) only. A new row in [`reviewed-change-replacements.ts`](../../scripts/catalog/reviewed-change-replacements.ts) sets the formula to 0, and the description record supplies the racial +2 under a Perform (sing) Situation, as Mountain Guide did ([curation.md](curation.md#reviewed-change-replacements)). No other assessment's closure covers Seasinger.
- **Bonus types recorded for review, not changed.** Ingratiating's imported Craft and Profession changes are racial while the body (and PCGen) give untyped bonuses; a replacement can't change a type, so the record stays held (as #370). Hatred (Dwarf)'s pinned CRB wording is an untyped "+1 bonus"; the PRD ARG paragraph and the Dwarf race's checked #328 note record type it racial.
- **Shared Situations** only where the condition matches exactly: fear (Intrepid Settler, Dragon Soul), illusions (Imposter-Wary), trip (Tripping Tentacles), disarm and steal (Bullying). Relentless's bull rush and overrun bonuses need both combatants on the ground, so they are local Situations.
- **Choice and condition Situations:** Ingratiating's chosen Perform skill, Industrious's chosen Craft or Profession (plus an unconditional +2 racial concentration Modifier: the raw concentration change doesn't map), Craftsman, Tribalistic, Breeze-Kissed, Dragon Scholar, Shadowplay, Nightskulk's urban Stealth, Ancient-Born's -1, and the Seascarred and Bloodmarked bestial-form bonuses.
- **Race-covered notes:** Defensive Training (Gnome), Hatred (Dwarf) and Ward against Corruption carry their race's re-homed #328 Modifiers and need no required record; Svirfneblin Magic's illusion DC is the race's re-homed description output.
- **Covered/no-output records:** Construct's AC note (it repeats the saving throw Note's sentence) and Sea Lungs' `conChecks` note (Constitution checks, which the drafter maps to concentration; #389).
- **Normal Speed (Undine)** carries the undine languages paragraph as its body while its changes and class skill give the speed rule: recorded as an unresolved origin and a PRD difference, not resolved.
- **Inherited rules the bodies name:** the steal maneuver (APG) for Bullying; the shaitan bloodline (Ultimate Magic), the Metal subdomain (APG) and unerring weapon (Ultimate Combat) for Ironsoul; the stormborn bloodline (APG) for Stormsoul; thought components (Occult Adventures) for Telepathic Senses; Psychic Sensitivity (Occult Adventures) for Psychic Sensitivity and Psychic Attunement; the Fetchling race's book for Shadowplay, which grants elves the fetchling's spell-like abilities. Shadowplay's shadow descriptor and Psychic Attunement's Psychic Virtuoso (its pinned record cites no source) stay unresolved origins.
- **PRD differences recorded, not resolved:** Craftsman and Spirit of the Waters follow their APG rows (ARG printings are leads); Defensive Training (Gnome) "type" against "subtype"; the fetchling's caster level "character level" against "total Hit Dice"; Elf-Raised's capitalization; Languages (Elf)'s extra "languages".
- **Not modeled, listed:** senses, speeds, spell-like abilities, natural attacks, creature types, energy resistance, spell resistance, class-skill grants, languages, bonus feats (Psychic Sensitivity, Psychic Attunement), counting as another race or type (Dragon Soul), the sex-dependent lashunta adjustments (the race records carry them), and Imposter-Wary's Sense Motive-only rank (the importer reads one general rank per level).

## Importer and data gaps

- **Unresolved own name (neither #738 nor #739):** Lightning Affinity (Sylph - Stormsoul) is a Subrace Standard record without a header; the importer looks for a parent trait of the same name, and the sylph has none (it is the stormsoul's Air Affinity), so the name stays unresolved.
- **Journal link (#738):** Amphibious (Undine) links the Universal Monster Rules Amphibious page; it fails admission with "unresolved imported reference" in any preview, independent of curation.
- **Header phrase:** Beast Talker's header reads "alters the change shape and spell-like ability racial traits"; the importer keeps it unresolved, which is right, since the trait alters rather than replaces them.
- **Drafter target (known):** `conChecks` maps to `concentration` in `scripts/catalog/curation.ts`; Foundry's `conChecks` is Constitution checks.
- The raw upstream keys in `mapRacialTrait` caused no reference failure: the full preview's only failure for a batch key is the Amphibious journal link; the bounded preview's 46 failures are links and replacements outside the selection.
- No linked pf-items record is missing. There is no Orc Atavism, no replacement of a counts-as trait, no heritage resolving to a `local/` trait outside the three curated heritages above, and no multi-race "Base Statistics" folder in this batch.

## Outstanding mechanics

Each record lists its calculation gaps in `mechanicsReview.outstandingCalculations`; none is an attribution hold. The main ones are listed under Notable cases ("Not modeled").

## Cross-batch bindings and protected records

Rebased onto `f962f631` (#388, #390, #716 P10a and #391 landed). Every re-bind uses `buildAssessmentBinding` over a full `catalog:preview` of the rebased tree, with the matching inventory `currentBinding` and fixture copy updated; every fixture-based binding agrees with the full-corpus one. Nothing else changed in the earlier batches. The changed entries are this batch's keys, which gained their description Notes (`situationalNotes`). Against the rebased base (`git diff HEAD^`), **27 landed assessments** change their content fingerprint and no other field, besides this batch's 75 new ones:

| Batch | Record                            | Reaches                                 | Content fingerprint       |
| ----- | --------------------------------- | --------------------------------------- | ------------------------- |
| #524  | Fey Boon (`pf1/JYgzYISWlo5CQQg3`) | Slow and Steady (Dwarf), Hatred (Dwarf) | `1c2dc1f0…` → `e1b6ab74…` |
| #387  | Deep Tradition                    | Hatred (Dwarf)                          | `e5962760…` → `6ece2372…` |
| #387  | Rimesoul (Frost Undine)           | Normal Speed (Undine)                   | `c34500b7…` → `ec6e1d61…` |
| #387  | Unfettered                        | Halfling Luck                           | `20e0a653…` → `85267fc5…` |
| #387  | Dusksight (Dwarf)                 | Hatred (Dwarf)                          | `49d92b43…` → `aeebbf4f…` |
| #387  | Fey Thoughts (Dwarf)              | Hatred (Dwarf)                          | `357a2979…` → `cf2a8f3e…` |
| #388  | Archon-Blooded (Lawbringers)      | Celestial Resistance                    | `920538fb…` → `e7cdc0ec…` |
| #388  | Craven                            | Halfling Luck                           | `da8b6437…` → `f007fb7c…` |
| #388  | Siege Survivor                    | Hatred (Dwarf)                          | `56581caf…` → `b6ff2547…` |
| #388  | Slave Born                        | Halfling Luck, Ingratiating             | `edd19674…` → `a57d1477…` |
| #388  | Tongue of the Sea                 | Languages (Elf)                         | `0e769fb1…` → `b3a49885…` |
| #388  | Arena-Bred                        | Skilled (Half-Orc)                      | `b7d3a890…` → `c1c4af7b…` |
| #388  | Human-Raised (Half-Elf)           | Wary                                    | `1a9036fb…` → `86778618…` |
| #389  | Soaring Agility                   | Natural Armor (Gathlain)                | `d13df0c1…` → `63357d4f…` |
| #389  | Round Ears                        | Low-Light Vision (Half-Elf)             | `9dba302a…` → `86d3b83f…` |
| #389  | Drow-Descended                    | Low-Light Vision (Half-Elf)             | `445c683c…` → `f620faa4…` |
| #389  | Stoneseer (Svirfneblin)           | Svirfneblin Magic (Svirfneblin)         | `2a1b82ea…` → `a7e26495…` |
| #389  | Nomadic                           | Halfling Luck                           | `3a0eeb23…` → `80e240a7…` |
| #389  | Feral (Orc)                       | Weapon Familiarity (Orc)                | `282ef228…` → `843a745d…` |
| #390  | Lasting Grudge                    | Hatred (Dwarf)                          | `f4da9a15…` → `dd41e49c…` |
| #390  | Dirty Trickster                   | Defensive Training (Gnome)              | `34885c6e…` → `105cd14d…` |
| #390  | Industrious Urbanite              | Hatred (Dwarf)                          | `b391c0a1…` → `807f272d…` |
| #390  | Shadow Foe                        | Defensive Training (Gnome)              | `eae166db…` → `32f12e28…` |
| #390  | Halfling Jinx                     | Halfling Luck                           | `280d51cd…` → `2e7b3f20…` |
| #390  | Shadow Dodger                     | Defensive Training (Gnome)              | `328e572e…` → `cd36ca22…` |
| #391  | Yamaraj's Baliff                  | Ward against Corruption                 | `6290145a…` → `62a95e4e…` |
| #375  | Good Dreams (Desna; Halfling)     | Halfling Luck                           | `a4fc6e3a…` → `3cdb2db6…` |

- **Records:** the `currentBinding` of each listed record in `scripts/catalog/legal/racial-traits-387.json`, `racial-traits-388.json`, `racial-traits-389.json`, `racial-traits-390.json`, `racial-traits-391.json` and `traits-375.json`, and the closure copies of batch keys in their `tests/fixtures/<batch>/preview.json`; `tests/fixtures/spells-524/binding-preview.json` (its two dwarf trait copies, from #524's own re-import; #524 records no `currentBinding`). The merge conflicts on Rimesoul, Drow-Descended, Good Dreams and Fey Boon (#390/#391 had re-bound them too) are resolved by this re-bind.
- **This batch, re-bound after the rebase:** seven of its own records' closures reach #390/#391 entries (Glider, Scaled Skin, Hydrated Vitality, Spirit of the Waters, Elf-Raised, Rakshasa-Spawn (Beastbrood), Body Thorns); their `currentBinding` and the batch fixture are updated.
- **Protected record, listed for review: Halfling Luck in #534.** #534's `binding-preview.json` copies Halfling Luck as context and its `protected-context.json` pins that copy's definition fingerprint. This batch gives Halfling Luck its evidence-backed Note (#749, protected records), so the #534 copy is replaced by #534's own re-import (only `situationalNotes` changes) and its protected definition fingerprint moves from `d223848e…` to `633b9a12…` (unchanged by the rebase). No #534 spell binding changes. These two lines are the only #534 changes.
- **Already stale, not re-bound:** the 25 #328 race assessments, #331's Lifecrafting and #333's Extra Gnome Magic, whose closures reach batch keys, were stale on the base (the deferred stale set, curation.md) and are left for the post-curation cleanup.
- **#355's binding-preview** copies five batch keys as context; `feats-355.test.ts` and `cross-batch-bindings.test.ts` pass, so no #355 binding changes.

## Binding

Every assessment is bound with `buildAssessmentBinding` against the full-corpus content closure: the final full `catalog:preview` artifact, with the batch's 75 entries and their 194 closure entries. The [preview fixture](../../tests/fixtures/racial-traits-392/preview.json) keeps both, so the batch test rebuilds every binding from a clean shared-store tree (0 mismatches).

## Tests

The [resolver tests](../../tests/catalog/racial-traits-392.test.ts) pin the reviewed values through the public resolver: the three heritages replacing their race's ability score trait, Snow May and the two tiefling skill records replacing their parent traits, every Situation-gated bonus off by default and on when selected, the shared Situations not stacking within an entry, the Seasinger replacement, imported changes not curated twice, Halfling Luck stacking with Irrepressible, and no `ac.other` armor, shield or natural armor bonus. They also check all 33 required and 75 description records, the two covered/no-output records and the Note targets; the proficiency and skill-rank facts; the race, alternate, monster-ability, cited and Unchained notice dependencies (18 PZO1131 keys, own action versus bound body) and every enforced hold; the importer's reading of race, standard flag and replacements; every pinned body, PCGen row and PRD paragraph in the shared store; and re-extraction from a clean shared-store tree with every binding reproduced and a confirmed Slow and Steady (Dwarf) still held.

The [isolated saved-sheet test](../../tests/catalog/racialTraits392.integration.test.ts) exercises public Convex reads and writes: a changeling-identity race granting its ability trait and the held Sea Lungs trait takes the held Snow May ability record and turns it off again, with saved totals equal to the preview; outsiders, anonymous callers and another campaign's entry are refused without changing the sheet. The shared held-release round trip is covered once by the release test in [`traits367.integration.test.ts`](../../tests/catalog/traits367.integration.test.ts). No deployment or production activation occurred.

## Preservation and gates

The shared canonical files gain only this batch's entries: 108 curation records (75 description and 33 note records), 75 assessments, 75 evidence entries and 33 notice holds, plus the Seasinger change replacement row. The other changes are the listed re-binds. Diff stat against the rebased base `f962f631` (`git diff --cached --stat`, shared-store files omitted):

```text
 docs/catalog-import/curation.md                   |     2 +
 docs/catalog-import/racial-traits-392.md          |   238 ++
 scripts/catalog/legal/held-notices.json           |   315 ++
 scripts/catalog/legal/racial-traits-387.json      |    10 +-
 scripts/catalog/legal/racial-traits-388.json      |    14 +-
 scripts/catalog/legal/racial-traits-389.json      |    12 +-
 scripts/catalog/legal/racial-traits-390.json      |    12 +-
 scripts/catalog/legal/racial-traits-391.json      |     2 +-
 scripts/catalog/legal/racial-traits-392.json      | 24798 ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 scripts/catalog/legal/traits-375.json             |     2 +-
 scripts/catalog/reviewed-change-replacements.ts   |    12 +
 scripts/catalog/reviewed-curation.json            |  2486 +++++++++++++-
 src/lib/catalog/data/attribution-assessments.json |  1834 ++++++++++-
 src/lib/catalog/data/attribution-evidence.json    |   225 ++
 tests/catalog/racial-traits-392.test.ts           |  1089 +++++++
 tests/catalog/racialTraits392.integration.test.ts |   446 +++
 tests/fixtures/racial-traits-387/preview.json     |    19 +-
 tests/fixtures/racial-traits-388/preview.json     |    61 +-
 tests/fixtures/racial-traits-389/preview.json     |    31 +-
 tests/fixtures/racial-traits-390/preview.json     |    21 +-
 tests/fixtures/racial-traits-391/preview.json     |     7 +-
 tests/fixtures/racial-traits-392/data.ts          |   323 ++
 tests/fixtures/racial-traits-392/preview.json     | 14603 ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 tests/fixtures/racial-traits-392/sheet.ts         |   154 +
 tests/fixtures/spells-524/binding-preview.json    |    12 +-
 tests/fixtures/spells-534/binding-preview.json    |     7 +-
 tests/fixtures/spells-534/protected-context.json  |     2 +-
 tests/fixtures/traits-375/preview.json            |     7 +-
 28 files changed, 46589 insertions(+), 155 deletions(-)
```

<!-- prep:shared-store-count -->

New shared-store files (`tests/fixtures/pinned/`), counted by prep after the rebase onto `f962f631`: **104** (pcgen 7, pf1 3, pf1-content 94).

<!-- /prep:shared-store-count -->

The batch adds to the shared store its 100 pinned records, the pf-racial-traits folder records above them, the pinned race records they bind to, the linked bodies (spells, feats, a weapon and racial traits), the PCGen race-ability, class, domain, feat and anchor files the evidence cites, and the PRD capture pages; files already on the base were reused.

The complete preview reported **86 admitted, 23,168 held, 2 dependent omissions and 2,614 failures** on `a1fc7966` with this batch, 33 fewer than that base's 2,647: this batch's required note records. Rebased onto `f962f631`, it reports 2,489 failures. The only batch key among the failures is the Amphibious (Undine) journal link (#738). The full-corpus gate is therefore a documented failure, not a claim of whole-corpus readiness.

| Command                                                                                                                                                                                                                                                    | Result                                                                                                                                                                                          |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `catalog:curate --candidates …` (required) and `--descriptions` (prose pass)                                                                                                                                                                               | pass; 33 required drafts, 16 prose drafts                                                                                                                                                       |
| `catalog:preview --candidates …`                                                                                                                                                                                                                           | exit 1; 0 admitted / 29 held / 46 failures: links and replacements outside the selection                                                                                                        |
| Full `catalog:curate`                                                                                                                                                                                                                                      | pass; 1,508 new drafts, none for this batch; 0 missing; 2 stale records on the base, neither a batch key (`pf1/m5cdZ1RG7c1mkhqF`); about 3 min                                                  |
| Full `catalog:preview`                                                                                                                                                                                                                                     | exit 1; 2,614 failures, one for this batch (Amphibious (Undine), #738); about 4 min                                                                                                             |
| Full re-bind (`buildAssessmentBinding` over the final full preview)                                                                                                                                                                                        | inventory, assessments and preview fixture reproduced; 0 mismatches against the clean-tree reconstruction; 27 cross-batch re-binds (after the rebase onto `f962f631`) agree with their fixtures |
| `pnpm test` of this batch's files, `notice-holds`, `pinned-sources`, `cross-batch-bindings`, `ac-other-defense-bonuses`, `data-files` (one worker)                                                                                                         | pass; 7 files / 70 tests                                                                                                                                                                        |
| `pnpm test` of the affected earlier tests (`racial-traits-387`, `racial-traits-389`, `traits-375`, `spells-524`, `spells-534`, `feats-355`, `racial-traits-719`, `races-328`, `race-facts-720`, `race-ability-721`) and `notice-dependencies` (one worker) | pass after the #534 re-bind; `spells-534` failed before it on Halfling Luck's protected fingerprint (see above)                                                                                 |
| After the rebase onto `f962f631`, one at a time: this batch's two files, `cross-batch-bindings`, `racial-traits-387` to `-391`, `traits-375`, `spells-524`, `spells-534` (one worker)                                                                      | pass; 8, 11, 6, 6, 6, 6, 6, 6, 21 and 20 tests                                                                                                                                                  |
| `pnpm -s typecheck`                                                                                                                                                                                                                                        | pass                                                                                                                                                                                            |
| `pnpm -s lint`                                                                                                                                                                                                                                             | pass                                                                                                                                                                                            |
| `pnpm -s check:initial-migration-writers`                                                                                                                                                                                                                  | pass; 185 registrations                                                                                                                                                                         |
| `pnpm catalog:pin`                                                                                                                                                                                                                                         | pass; `sha256:005ef0b9…`                                                                                                                                                                        |
| `pnpm catalog:notice-deps`                                                                                                                                                                                                                                 | pass; 0 gaps; 38 advisory warnings, none for this batch                                                                                                                                         |
| `pnpm catalog:format --check`                                                                                                                                                                                                                              | pass                                                                                                                                                                                            |

`pnpm test tests/catalog` was left to the orchestrator's prep run on the rebased commit, as the brief directs.
