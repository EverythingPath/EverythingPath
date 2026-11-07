# Racial traits #398: pf1-content pf-racial-traits batch 12

Reviewed by **Opus (AI curator) for the owner**, 2026-10-20.

Exactly the issue's 100 ordered, unique keys were reviewed: **0 admitted, 77 specifically held, 0 dependent omissions, 0 whole-entry unsupported/prose-only dispositions, 23 exclusions, 0 record-level 3.5 holds**. The exclusions are 11 Foundry `!folders!` records, which the importer's folder contract leaves out of the Catalog Entries (PRD Decision 17), and 12 records in the Advanced Race Guide Race Builder subtree, which the import contract excludes by folder ancestry ([README](README.md), explicit exclusions) and the [Racial Trait contract](../character-sheet/racial-traits.md) puts out of scope. No candidate carries a `3.5` tag. The 77 in-scope records are 32 standard racial traits (6 of them in flat race folders), 32 alternates, 9 Subrace Standard heritage parts and 4 Subraces-folder heritages or racial subtypes.

The [machine-readable inventory and evidence](../../scripts/catalog/legal/racial-traits-398.json) records, per key, the complete pinned body and inert fields with their source hash and cited sources; the PCGen race-ability rows, PRD Advanced Race Guide paragraphs, leads and rejected rows; the inherited-rule notices with their evidence, the linked bodies and the unresolved origins; the importer's reading of race, standard flag and replacements; every checked curation record, source discrepancies and calculation gaps; and the current assessment binding and mapped facts. This report summarizes them and does not repeat the evidence.

## #328 S4-B launch update

Reviewed 2026-11-01 by **Sol (AI curator) for the owner** ([races-328.md](races-328.md#s4-b-launch-half-elf-elf-gnome-and-halfling)). The S4-B launch review confirms 2 standard racial traits of Half-Elf, Elf, Gnome and Halfling with content-bound assessments; counts are now **2 admitted, 75 held**, with 23 exclusions unchanged. The earlier Opus review of each row stays in its `assessmentHistory`; every other candidate keeps its review and holds.

- **Elven Magic (Elf)** (`pf1-content/bRO90tmeaH1tFi2g`): matches the PRD ARG paragraph (`advancedRaceGuide/coreRaces/elves.html:369`) apart from no "skill"; PCGen's Core Essentials row (`elf/elf_abilities_race.lst:23`) with the recorded DESC differences. Its Modifiers are +2 racial caster level in the shared Situation spellResistance and +2 racial Spellcraft in identifyMagicItems (re-homed from the Elf's checked note records). Required notices: PZO9280, PZO1121, PZO1110.
- **Weapon Familiarity (Halfling)** (`pf1-content/cOod8wThcNc0expZ`): matches the PRD ARG paragraph (`advancedRaceGuide/coreRaces/halflings.html:371`) word for word; PCGen's Core Essentials row (`halfling/halfling_abilities_race.lst:25`) word for word. It grants the weapon Proficiency Sling (weaponProf). Required notices: PZO9280, PZO1121, PZO1110. Outstanding: Treating weapons with "halfling" in their name as martial weapons stays prose (#740).

Each row's whole-content hold ("Book PDFs unavailable") is superseded by this comparison, and it records no notice hold: PZO1110 is reviewed, PZO1121's Registry hold and `racial-traits-398-notice-PZO1121-complete-chain` are cleared (`notice-clearances.json`, owner 2026-10-30), and PZO9280's reviewed confirmation waives `racial-traits-398-notice-PZO9280-complete-chain`. The batch's `noticeRequirements` rows keep these keys as history. Content fingerprints are unchanged (the imported entries are identical); only the status, rationale, evidence and notice bindings move.

Tests: `racial-traits-398.test.ts` checks the confirmed rows with the held ones (`assessedTraits` in the fixture), expects them admitted by the committed gate and records no hold for them.

## Family rulings applied

This batch follows the #387 rulings Sol approved for the family:

1. **Every in-scope record is held** with a whole-content hold: the race records stay held (#328), every cited book's notice chain is held (44 batch notice holds, registered in `held-notices.json`), and no book PDFs are available.
2. **Race abilities.** Every record requires the books its pinned race record cites.
3. **Alternate framework.** Every alternate records the APG alternate racial trait rule (PZO1115, `apg_abilities_race.lst:86`).
4. **Monster abilities** take the earliest book the pinned Universal Monster Rules page lists: darkvision PZO1127; low-light vision, scent, telepathy, natural attacks, poison, fast healing, light sensitivity and resistance PZO1112; no breath PZO1116.
5. **Creature types** (the humanoid, outsider, aquatic, dwarf, goblinoid and native types and subtypes) stay named unresolved origins.
6. **PZO1131** for Unchained action-cost metadata anywhere in the bound closure: 24 records (16 on their own actions, 17 through bound bodies, 9 both). Werewolf-Kin (Witchwolf), with its curated ability line, reaches its race's standard traits through the race's ability score trait.
7. **Comparisons.** PCGen race-ability rows from a pinned book are the `comparison` (35 records); Core Essentials support rows (no SOURCELONG book) and other rows whose book the record does not cite are leads whose book is not required (29 records with only leads); 13 records have no PCGen row or PRD paragraph and say so as a named root hold. 16 records carry a PRD `prdComparison` from the pinned capture (12 match word for word). Subrace Standard parts take no PRD paragraph.
8. **Description pass.** Every in-scope record has a checked description record: its reviewed Modifiers plus an entry-level Note with the body (`@Distance` read as feet, "+N-foot" before "racial bonus", `@Weight` as pounds, `@Toggle` buff controls and empty "Related buff" lines removed, HTML entities decoded).
9. **Racial bonuses from distinct Sources stack**; the resolver test shows Clever Cat's and Attentive's +2 racial Sense Motive giving +4 together. The #735 admission policies don't bear on this batch (no spells or CRB feats).

## Dispositions

| Key                            | Name                                                   | Kind             | Disposition                                                      |
| ------------------------------ | ------------------------------------------------------ | ---------------- | ---------------------------------------------------------------- |
| `pf1-content/bb16lRiGSh8MGZu2` | Draconic Heritage                                      | alternate        | held: `racial-traits-398-whole-content-bb16lRiGSh8MGZu2`         |
| `pf1-content/bCC7aq3JM7gjMcCA` | Illustrious Urbanite                                   | alternate        | held: `racial-traits-398-whole-content-bCC7aq3JM7gjMcCA`         |
| `pf1-content/bcJGI384LPRwuj2a` | Eternal Smith                                          | alternate        | held: `racial-traits-398-whole-content-bcJGI384LPRwuj2a`         |
| `pf1-content/bg2D5FkiZk5q8Zi6` | Darkvision (Aphorite)                                  | standard         | held: `racial-traits-398-whole-content-bg2D5FkiZk5q8Zi6`         |
| `pf1-content/bGb3Y5JukIgU1Kdt` | Ink Cloud                                              | standard         | held: `racial-traits-398-whole-content-bGb3Y5JukIgU1Kdt`         |
| `pf1-content/bIwdeE7yN4YcLEX6` | Silent Hunter                                          | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/biy9S2be3p758hMW` | Spell-Like Ability (Aasimar - Plumekith)               | subrace standard | held: `racial-traits-398-whole-content-biy9S2be3p758hMW`         |
| `pf1-content/bnsF4bxf7kQBIIyM` | Agile (Kitsune)                                        | standard         | held: `racial-traits-398-whole-content-bnsF4bxf7kQBIIyM`         |
| `pf1-content/bPFXgUQ13FgngRh5` | Clever Cat                                             | alternate        | held: `racial-traits-398-whole-content-bPFXgUQ13FgngRh5`         |
| `pf1-content/bPkht5w4AKauP8Ip` | Animal-Minded                                          | standard         | held: `racial-traits-398-whole-content-bPkht5w4AKauP8Ip`         |
| `pf1-content/bPXRe93Nx2bL4PL7` | Smog Sight                                             | alternate        | held: `racial-traits-398-whole-content-bPXRe93Nx2bL4PL7`         |
| `pf1-content/bQz5WGBgK1x813HO` | Alternate Spell-Like Ability (Skinwalker - Scaleheart) | subrace standard | held: `racial-traits-398-whole-content-bQz5WGBgK1x813HO`         |
| `pf1-content/bRO90tmeaH1tFi2g` | Elven Magic (Elf)                                      | standard         | held: `racial-traits-398-whole-content-bRO90tmeaH1tFi2g`         |
| `pf1-content/bsDeGqpk9ZF84qoS` | Vestigal Wings                                         | alternate        | held: `racial-traits-398-whole-content-bsDeGqpk9ZF84qoS`         |
| `pf1-content/btAWWOZmbI05bcPK` | Unexpected Ally                                        | alternate        | held: `racial-traits-398-whole-content-btAWWOZmbI05bcPK`         |
| `pf1-content/bTQhfYlU0IgTdMMX` | Shadow Blending                                        | standard         | held: `racial-traits-398-whole-content-bTQhfYlU0IgTdMMX`         |
| `pf1-content/bTtU2YtIbpt4TyD1` | Alternate Skill Modifiers (Dhampir - Svetocher)        | subrace standard | held: `racial-traits-398-whole-content-bTtU2YtIbpt4TyD1`         |
| `pf1-content/bUnlzKQfFNF97MqX` | Mystic                                                 | subrace          | held: `racial-traits-398-whole-content-bUnlzKQfFNF97MqX`         |
| `pf1-content/bv8MLtZM6d93MjzM` | Languages (Trox)                                       | standard         | held: `racial-traits-398-whole-content-bv8MLtZM6d93MjzM`         |
| `pf1-content/bVANrX9uIcmvZN1c` | Honey Whisperer                                        | alternate        | held: `racial-traits-398-whole-content-bVANrX9uIcmvZN1c`         |
| `pf1-content/bVVtVOY7So7gOXv8` | Telepathy                                              | standard         | held: `racial-traits-398-whole-content-bVVtVOY7So7gOXv8`         |
| `pf1-content/bWTblS61a4GQlsgx` | War-Leader                                             | alternate        | held: `racial-traits-398-whole-content-bWTblS61a4GQlsgx`         |
| `pf1-content/bxzIzgdiXQgNX23U` | Battle-Hardened                                        | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/c1wfLAxHIjIc1tQG` | Aquatic (Aquatic Elf)                                  | standard         | held: `racial-traits-398-whole-content-c1wfLAxHIjIc1tQG`         |
| `pf1-content/c6qcpCl83hFN26vn` | Superior Shapeshifter                                  | alternate        | held: `racial-traits-398-whole-content-c6qcpCl83hFN26vn`         |
| `pf1-content/c6wd72DW5uqIkSVR` | Spell Resistance, Lesser                               | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/calSa82WwxgUFwXr` | Werewolf-Kin (Witchwolf)                               | subrace          | held: `racial-traits-398-whole-content-calSa82WwxgUFwXr`         |
| `pf1-content/cblSp9CRry0z790A` | Human Shadow                                           | alternate        | held: `racial-traits-398-whole-content-cblSp9CRry0z790A`         |
| `pf1-content/cBTigYnTlwamuHfa` | Languages (Goblin)                                     | standard         | held: `racial-traits-398-whole-content-cBTigYnTlwamuHfa`         |
| `pf1-content/cEh0t6PAmegJIQCU` | Energy Strike (Electricity)                            | alternate        | held: `racial-traits-398-whole-content-cEh0t6PAmegJIQCU`         |
| `pf1-content/cFglH9W82vHtpzMu` | Sovyrian-Born                                          | alternate        | held: `racial-traits-398-whole-content-cFglH9W82vHtpzMu`         |
| `pf1-content/cFr4ZtTY4M2iTTWa` | Nocturnal (Strix)                                      | standard         | held: `racial-traits-398-whole-content-cFr4ZtTY4M2iTTWa`         |
| `pf1-content/cfWtOcBqPxN34H5X` | Standard                                               | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/cHfF0MzvRePtnPBS` | Dwarf                                                  | standard         | held: `racial-traits-398-whole-content-cHfF0MzvRePtnPBS`         |
| `pf1-content/chkZrH30moyKCPNU` | Languages (Hobgoblin)                                  | standard         | held: `racial-traits-398-whole-content-chkZrH30moyKCPNU`         |
| `pf1-content/cIGRUby3T6UOP0an` | Maelstrom Resistance                                   | standard         | held: `racial-traits-398-whole-content-cIGRUby3T6UOP0an`         |
| `pf1-content/cL7K05jKkXxOmOt5` | Retreat Magic                                          | alternate        | held: `racial-traits-398-whole-content-cL7K05jKkXxOmOt5`         |
| `pf1-content/cML095CltG7ZpUSM` | Skilled (Tiefling - Shackleborn)                       | subrace standard | held: `racial-traits-398-whole-content-cML095CltG7ZpUSM`         |
| `pf1-content/cnMT4bfxktgJnrm1` | Blood Courage                                          | standard         | held: `racial-traits-398-whole-content-cnMT4bfxktgJnrm1`         |
| `pf1-content/cnthBFOul39AFnoN` | Alternate                                              | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/co5OzRBqAzXGbgii` | Ability Scores (Vine Leshy)                            | standard         | held: `racial-traits-398-whole-content-co5OzRBqAzXGbgii`         |
| `pf1-content/cOod8wThcNc0expZ` | Weapon Familiarity (Halfling)                          | standard         | held: `racial-traits-398-whole-content-cOod8wThcNc0expZ`         |
| `pf1-content/cRbTJE910TfKzJAt` | Pariah                                                 | alternate        | held: `racial-traits-398-whole-content-cRbTJE910TfKzJAt`         |
| `pf1-content/crZ8xD4Vlvu0pk4U` | Ageless Patience                                       | alternate        | held: `racial-traits-398-whole-content-crZ8xD4Vlvu0pk4U`         |
| `pf1-content/cSe1S79oR6gJI9bF` | Defensive Abilities                                    | standard         | held: `racial-traits-398-whole-content-cSe1S79oR6gJI9bF`         |
| `pf1-content/cUYl6WPG3gIKBkIe` | Wyrmcrowned                                            | alternate        | held: `racial-traits-398-whole-content-cUYl6WPG3gIKBkIe`         |
| `pf1-content/cwJ8fDUFMFRGqsJN` | Standard                                               | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/cxbs6wjdHVmjndXR` | Attentive                                              | alternate        | held: `racial-traits-398-whole-content-cxbs6wjdHVmjndXR`         |
| `pf1-content/czaE6LoPE63urloL` | Seed                                                   | standard         | held: `racial-traits-398-whole-content-czaE6LoPE63urloL`         |
| `pf1-content/d0h0dzcrBnA3b3Ts` | Disgusting                                             | alternate        | held: `racial-traits-398-whole-content-d0h0dzcrBnA3b3Ts`         |
| `pf1-content/d18rPNYXrSLzCr3v` | Slow Speed (Vine Leshy)                                | standard         | held: `racial-traits-398-whole-content-d18rPNYXrSLzCr3v`         |
| `pf1-content/d4bGSdKKLFXKTGuf` | Alternate                                              | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/d4QTi9Jgx2Um3y7l` | Flexible                                               | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/d5kvhHSZv8jIHqXe` | Natural Weapon (Kuru)                                  | standard         | held: `racial-traits-398-whole-content-d5kvhHSZv8jIHqXe`         |
| `pf1-content/d6EaA469S0yr8dfD` | Standard                                               | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/d6YoCC2UVK8jUmf8` | Pit Boss                                               | alternate        | held: `racial-traits-398-whole-content-d6YoCC2UVK8jUmf8`         |
| `pf1-content/dagWgGQYv20usVZW` | Spell-Like Ability (Tiefling - Grimspawn)              | subrace standard | held: `racial-traits-398-whole-content-dagWgGQYv20usVZW`         |
| `pf1-content/dBOovRDbboaF29Z1` | Advanced Charisma                                      | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/dC9jf0ZOdGqVPptT` | Undead Resistance                                      | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/dEtxdn5mLY5M3i45` | Alternate Spell-Like Ability (Dhampir - Ru-Shi)        | subrace standard | held: `racial-traits-398-whole-content-dEtxdn5mLY5M3i45`         |
| `pf1-content/deYG2mmqNjWZ4rR5` | Umbral Escort                                          | alternate        | held: `racial-traits-398-whole-content-deYG2mmqNjWZ4rR5`         |
| `pf1-content/dFhNrCde0uxjohHy` | Darkvision (Changeling)                                | standard         | held: `racial-traits-398-whole-content-dFhNrCde0uxjohHy`         |
| `pf1-content/dfqSRTRN0zf2BRS0` | Oread Gem Magic                                        | alternate        | held: `racial-traits-398-whole-content-dfqSRTRN0zf2BRS0`         |
| `pf1-content/dfwclEVJRJgllnC2` | Racial Qualities                                       | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/dhSAd9l3M8b0SGAP` | Blunt Head                                             | alternate        | held: `racial-traits-398-whole-content-dhSAd9l3M8b0SGAP`         |
| `pf1-content/dhTdr09hDfKJLhiH` | Large                                                  | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/dIpPYpwxxkHXRAmv` | Desert Runner                                          | standard         | held: `racial-traits-398-whole-content-dIpPYpwxxkHXRAmv`         |
| `pf1-content/diZs3RkrvBKSq8sk` | Heart of the Sea                                       | alternate        | held: `racial-traits-398-whole-content-diZs3RkrvBKSq8sk`         |
| `pf1-content/djQBH83XAsijjtSG` | Kasatha                                                | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/dk1o8LLPRw7etojM` | Native Outsider (Aasimar)                              | standard         | held: `racial-traits-398-whole-content-dk1o8LLPRw7etojM`         |
| `pf1-content/dKJAALL4Buzlj9X2` | Camouflage                                             | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/dlBhceRWyWTbpBN8` | Fire in the Blood                                      | alternate        | held: `racial-traits-398-whole-content-dlBhceRWyWTbpBN8`         |
| `pf1-content/dMbfvLa1o308rPFe` | Stable Tentacles                                       | standard         | held: `racial-traits-398-whole-content-dMbfvLa1o308rPFe`         |
| `pf1-content/dMLf5DVvmyw2MLmm` | Fey Magic (Elf)                                        | alternate        | held: `racial-traits-398-whole-content-dMLf5DVvmyw2MLmm`         |
| `pf1-content/dMxzvkH2ioltx0pf` | Defensive Training, Lesser                             | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/dmyFia1i5pfWjmWy` | Wyvaran                                                | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/dQpQkqUUdP5QbbYn` | Avenging                                               | subrace          | held: `racial-traits-398-whole-content-dQpQkqUUdP5QbbYn`         |
| `pf1-content/dtbQtYC7PMjK4Zs5` | Cliffside Charger (Cragkin)                            | alternate        | held: `racial-traits-398-whole-content-dtbQtYC7PMjK4Zs5`         |
| `pf1-content/dVdOBUkSuXKjWRg5` | Poison Use                                             | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/dVlYSwjbyeBDBnG2` | Resist Level Drain (Shabti)                            | standard         | held: `racial-traits-398-whole-content-dVlYSwjbyeBDBnG2`         |
| `pf1-content/dWD4t4Bq2TdYAE3h` | Subraces                                               | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/dWFPhuI7Vt2QDf0C` | One of the Multitude                                   | alternate        | held: `racial-traits-398-whole-content-dWFPhuI7Vt2QDf0C`         |
| `pf1-content/dX7u0gwFMcTexeSJ` | Alternate Weakness (Dhampir - Ajibachana)              | subrace standard | held: `racial-traits-398-whole-content-dX7u0gwFMcTexeSJ`         |
| `pf1-content/dXEb2y6woAp0MpCO` | Crystalline Dust                                       | standard         | held: `racial-traits-398-whole-content-dXEb2y6woAp0MpCO`         |
| `pf1-content/dXeL3DD7E9H7ONvk` | Cecaelia                                               | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/dzrY5AIr5JyfIhPU` | Goblinoid (Goblin)                                     | standard         | held: `racial-traits-398-whole-content-dzrY5AIr5JyfIhPU`         |
| `pf1-content/e0CYM9n4bzMQSSt8` | Languages (Ratfolk)                                    | standard         | held: `racial-traits-398-whole-content-e0CYM9n4bzMQSSt8`         |
| `pf1-content/e14A3nZwy20ElCS9` | Blended View (Elf)                                     | alternate        | held: `racial-traits-398-whole-content-e14A3nZwy20ElCS9`         |
| `pf1-content/e4Ogb9Yb2DVlvYNW` | Vanara                                                 | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/e6cqGeDS6lFEFfzJ` | Ferrous Growth                                         | alternate        | held: `racial-traits-398-whole-content-e6cqGeDS6lFEFfzJ`         |
| `pf1-content/e6oHfv1pVnQf20f5` | Languages (Yaddithian)                                 | standard         | held: `racial-traits-398-whole-content-e6oHfv1pVnQf20f5`         |
| `pf1-content/e8KuoZsFSBsI7k9c` | Bite                                                   | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/e8okungPKsrvj6VC` | Treasure Sense                                         | alternate        | held: `racial-traits-398-whole-content-e8okungPKsrvj6VC`         |
| `pf1-content/eEo4SD2HVKDVOPpz` | Alternate Skill Modifiers (Dhampir - Ajibachana)       | subrace standard | held: `racial-traits-398-whole-content-eEo4SD2HVKDVOPpz`         |
| `pf1-content/eH48cH43zltK0czA` | Relentless                                             | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/eI3UbG7beFWfikl0` | Spell-Like Ability (Aphorite)                          | standard         | held: `racial-traits-398-whole-content-eI3UbG7beFWfikl0`         |
| `pf1-content/eIbeWPnBDu7zLYjF` | Spell-Like Ability (Aasimar - Lawbringers)             | subrace standard | held: `racial-traits-398-whole-content-eIbeWPnBDu7zLYjF`         |
| `pf1-content/eIkJlRpLALMQNc4J` | Cosmopolitan                                           | subrace          | held: `racial-traits-398-whole-content-eIkJlRpLALMQNc4J`         |
| `pf1-content/eJIBuryG68v4PJLk` | Light Sensitivity (Dhampir)                            | standard         | held: `racial-traits-398-whole-content-eJIBuryG68v4PJLk`         |
| `pf1-content/eKKCUEHE5IvE6x9L` | Poison Minion (Drow)                                   | alternate        | held: `racial-traits-398-whole-content-eKKCUEHE5IvE6x9L`         |

## Notable cases

- **Heritage ability line curated (#387 to #397 precedent).** Werewolf-Kin (Witchwolf) is a `reviewedAbilityLineSubraces` heritage; its line (+2 Con, -2 Int) agrees with PCGen's Core Essentials "Werewolf-Kin ~ Ability Scores" row, so it is two racial ability Modifiers and "Base Statistics" resolves to the skinwalker's ability score trait, which goes dormant. The +2 Wisdom while shapechanged stays readable. `race-ability-721` and `racial-traits-719` pin no Werewolf-Kin record.
- **Race outputs already on the traits:** Elven Magic (Elf) and Nocturnal (Strix) carry their races' re-homed #328 note records (`coveredTraitNotes`; shared spellResistance and identifyMagicItems Situations, and a local "in dim light or darkness"); Agile (Kitsune), Animal-Minded and Ability Scores (Vine Leshy) carry their races' relocated changes. None gets a second Modifier. **Latent overlaps:** Desert Runner (Kasatha)'s Fortitude note is covered/no-output and Maelstrom Resistance keeps only its resistance Note, because the Kasatha and Ganzi races' checked #328 description records already give those save bonuses (both are in the import report's `latentOverlaps`). Checked against the race outputs first (#391): no other standard trait duplicates a race Modifier, and no Modifier is added to a standard trait of a #719 race.
- **Situational bonuses** (manual Situations): Ageless Patience (taking 20), Pariah (one Situation for emotion and fear effects), One of the Multitude, Human Shadow, Unexpected Ally (aid another on attacks and skills; Diplomacy untyped), Disgusting, Pit Boss, Heart of the Sea (Profession (sailor), underwater concentration), War-Leader (Profession (soldier), untyped) and Alternate Weakness (Dhampir - Ajibachana) (-1 caster level in holy areas). Attentive's +4 to notice enchantment or possession is a +4 racial Situation Modifier that supersedes the imported +2 of the same entry (one entry's bonuses of one type do not stack), giving the published total. No shared Situation matched exactly; the shared fear Situation is not used for Pariah's "emotion and fear effects".
- **Covered/no-output records:** Honey Whisperer's Diplomacy note (one Note on Handle Animal states the wild empathy rule) and Desert Runner (Kasatha)'s Fortitude (latent overlap) and conChecks notes.
- **Inherited rules beyond the race:** Draconic Heritage records Eldritch Heritage as the Ultimate Magic feat PCGen files (`um_feats.lst:37`, PZO1117, as feats-341 does); the body's "APG" superscript is recorded as a discrepancy, listed for review; Oread Gem Magic the ARG and APG spells its superscripts cite, the APG page it cites and the Bestiary's advanced simple template (PZO1112, the #520 template ruling); War-Leader Ultimate Campaign's mass combat (PZO1125, "See Pathfinder RPG Ultimate Campaign"); Superior Shapeshifter Dragon Empires Primer, which it cites for Fox Shape and where PCGen files it (`dep_feats.lst:23`, PZO9421), and Bestiary 3, which Fox Shape's body cites for the fox (PZO1120), as feats-363 does; Honey Whisperer the linked Wild Empathy record's books (PZO1110, PZO1129, PZO1140).
- **Weapon Proficiencies:** Pit Boss (whip) and Weapon Familiarity (Halfling) (sling) keep the importer's weapon-field Proficiencies (#720); the "treat as martial" clause stays prose.
- **Listed for review:** War-Leader's imported Diplomacy bonus is typed racial where the body is untyped (a change replacement can't fix a type; held, as #370 did); Umbral Escort's exchange line says it replaces low-light vision and only modifies the spell-like abilities trait, while the header names both, so the importer marks both replaced; Ink Cloud's word-for-word Bestiary 3 monster row is kept as a lead (its book is not cited by the record, so it is not required).
- **Not modeled, listed:** senses, speeds, spell-like abilities and other actions, natural attacks, energy resistance, no breath, immunities, miss chances, creature types, class-skill grants, bonus feats (Illustrious Urbanite, Superior Shapeshifter), chosen skills (Wyrmcrowned, Vestigal Wings' class skill), languages, the Leadership score and army Morale, crafting progress (Eternal Smith) and Oread Gem Magic's gem augmentations.

## Importer and data gaps

- **Defensive Abilities (Yaddithian)** links pf1-content's unassigned pf-universal-monster-rules No Breath record (no source), which is no catalog entry. The import strips the link and the record fails admission with "Broken structure or reference: unresolved imported reference." in any preview. This reference gap is neither a #738 journal link nor a #739 prerequisite finding; it is reported here as its own entry (as #395 did for Orc Atavism), and the rule is recorded from the Universal Monster Rules journal (PZO1116).
- **Alternate Spell-Like Ability (Dhampir - Ru-Shi)**'s header ("Replaced Trait(s):" with no space before the link) is not read, so the importer lists the record's own name as unresolved; the replaced trait is Spell-Like Ability (Dhampir). Reported as an importer gap, as #387 did for Svetocher.
- **Linked records with empty source fields:** Draconic Heritage's Eldritch Heritage and Superior Shapeshifter's Fox Shape (pf-feats records) carry no sources; that alone is no hold reason (Sol's #548 ruling), so their books come from the inherited-rule evidence above.
- The racial subtypes (Mystic, Avenging, Cosmopolitan) keep "Base Statistics" unmatched, as designed.
- No #738 or #739 finding, no missing pf-items reference, and the raw upstream keys in `mapRacialTrait` caused no reference failure. Untested cases from the run notes: none in this batch (no counts-as replacement, no `local/` heritage beyond the curated ability line, no multi-race "Base Statistics" folder). Orc Atavism is not in this batch.

## Outstanding mechanics

Each record lists its calculation gaps in `mechanicsReview.outstandingCalculations`; none is an attribution hold. The main ones are the items under Notable cases ("Not modeled").

## Cross-batch bindings and protected records

Curated on `41cbb0b9`. Every re-bind uses `buildAssessmentBinding` over the final full `catalog:preview` with this batch's records, with the earlier batch's fixture copies of this batch's keys replaced by the full-preview entries, the inventory `currentBinding` updated and the fixture-based binding checked to agree (all 56 agree). Only the content fingerprints changed; no disposition, evidence, notice or hold changed in the earlier batches. The 56 are every assessment whose full-corpus closure reaches a batch key and that was fresh on the base (checked with the binding code over the baseline full preview, and re-checked over the final one: all 56 fresh, the other 26 unchanged): 5 from #387, 3 from #388, 4 from #389, 3 from #390, 3 from #391, 7 from #392, 6 from #393, 6 from #394, 9 from #395, 4 from #396, 5 from #397 and 1 from traits-370.

| Batch, assessment                                        | Reaches (this batch)          | Content fingerprint       |
| -------------------------------------------------------- | ----------------------------- | ------------------------- |
| #387 Alternate Skill Modifiers (Skinwalker - Fanglord)   | Animal-Minded                 | `dfc4d65f…` → `7da651ce…` |
| #387 Ekujae Elves                                        | Elven Magic (Elf)             | `8943f182…` → `2741ca2b…` |
| #387 Frightening                                         | Nocturnal (Strix)             | `3a45c33e…` → `a3a4456f…` |
| #387 Jininese Elves                                      | Elven Magic (Elf)             | `ac9edd53…` → `47246392…` |
| #387 Shadowhunter (Halfling)                             | Weapon Familiarity (Halfling) | `2c706fab…` → `05897d47…` |
| #388 Archon-Blooded (Lawbringers)                        | Native Outsider (Aasimar)     | `a53c3015…` → `ff2a03eb…` |
| #388 Boundary Walker                                     | Shadow Blending               | `d8d640fc…` → `753cd9f0…` |
| #388 Deep Jungle                                         | Weapon Familiarity (Halfling) | `3ae9b9b5…` → `3b09ea8e…` |
| #389 Emissary                                            | Shadow Blending               | `5f6ee7ca…` → `0cce69a1…` |
| #389 Human-Raised (Elf)                                  | Elven Magic (Elf)             | `63bbf110…` → `4f38681c…` |
| #389 Light against Darkness                              | Elven Magic (Elf)             | `a6b4002c…` → `047a12fa…` |
| #389 Silent Hunter                                       | Elven Magic (Elf)             | `e35027c8…` → `88e42019…` |
| #390 Alternate Skill Modifiers (Skinwalker - Witchwolf)  | Animal-Minded                 | `cc8b06f3…` → `7f631cd5…` |
| #390 Energy Strike (Fire)                                | Energy Strike (Electricity)   | `1aaccd12…` → `2a8b4ea9…` |
| #390 Forlorn Elves                                       | Elven Magic (Elf)             | `89168475…` → `1426be24…` |
| #391 Dragon Magic                                        | Elven Magic (Elf)             | `07eee0ff…` → `3c71689b…` |
| #391 Garrulous                                           | Ink Cloud                     | `caef7bfa…` → `9af47999…` |
| #391 Poison Minion (Elf)                                 | Elven Magic (Elf)             | `89025f55…` → `72af9f3b…` |
| #392 Alternate Skill Modifiers (Skinwalker - Nightskulk) | Animal-Minded                 | `cb968825…` → `3120896c…` |
| #392 Alternate Weakness (Dhampir - Ancient-Born)         | Light Sensitivity (Dhampir)   | `47f2eac2…` → `60ef0032…` |
| #392 Dayguard                                            | Nocturnal (Strix)             | `9f2e32e5…` → `bc5c387b…` |
| #392 Lightbringer                                        | Elven Magic (Elf)             | `92403b5e…` → `f1184d28…` |
| #392 Peri-Blooded (Emberkin)                             | Native Outsider (Aasimar)     | `1c874f01…` → `6123307c…` |
| #392 Shadowplay                                          | Elven Magic (Elf)             | `65d0081c…` → `ce80fa08…` |
| #392 Spirit of the Waters                                | Elven Magic (Elf)             | `6bf298d8…` → `60e42b73…` |
| #393 Alternate Skill Modifiers (Skinwalker - Coldborn)   | Animal-Minded                 | `987a9123…` → `d3fd0582…` |
| #393 Alternate Weakness (Dhampir - Ru-Shi)               | Light Sensitivity (Dhampir)   | `93e8eec7…` → `f460f47d…` |
| #393 Behind the Veil (Halfling)                          | Weapon Familiarity (Halfling) | `290a0817…` → `60d31e5a…` |
| #393 Creepy                                              | Elven Magic (Elf)             | `631abf2a…` → `164e740c…` |
| #393 Frostmelding                                        | Elven Magic (Elf)             | `3e3de3b4…` → `927a4517…` |
| #393 Underfoot Dodger                                    | Weapon Familiarity (Halfling) | `c22f3396…` → `85859400…` |
| #394 Eternal Grudge                                      | Elven Magic (Elf)             | `13388889…` → `f5b69194…` |
| #394 Memories Beyond Death                               | Elven Magic (Elf)             | `ba25eed5…` → `8429293f…` |
| #394 Skilled (Kitsune)                                   | Agile (Kitsune)               | `cd444950…` → `30b47d3b…` |
| #394 Song'o Halflings                                    | Weapon Familiarity (Halfling) | `f6dfdfee…` → `bbdba92d…` |
| #394 Spiresworn Elves                                    | Elven Magic (Elf)             | `afb4ad69…` → `e4773048…` |
| #394 Vigilance                                           | Elven Magic (Elf)             | `ec04b9c5…` → `cc19d07f…` |
| #395 Arctic Elf                                          | Elven Magic (Elf)             | `a719e219…` → `76e7da80…` |
| #395 Caretaker                                           | Weapon Familiarity (Halfling) | `921f0ce1…` → `c25e83e5…` |
| #395 Desert Runner                                       | Elven Magic (Elf)             | `e3cf97d9…` → `2cf8388f…` |
| #395 Energy Strike (Acid)                                | Energy Strike (Electricity)   | `1aaccd12…` → `2a8b4ea9…` |
| #395 Garuda-Blooded (Plumekith)                          | Native Outsider (Aasimar)     | `4afa7adb…` → `ac37dc5a…` |
| #395 Joyous Companion                                    | Weapon Familiarity (Halfling) | `445ab18d…` → `d00282f9…` |
| #395 Nosferatu-Born (Ancient-Born)                       | Light Sensitivity (Dhampir)   | `30f202d0…` → `1ab3f9ac…` |
| #395 Trailblazer                                         | Heart of the Sea              | `0f065595…` → `ee90bae1…` |
| #395 Wereraptor-Kin (Aerieborn)                          | Animal-Minded                 | `2c66118b…` → `297832ce…` |
| #396 Alternate Skill Modifiers (Skinwalker - Aerieborn)  | Animal-Minded                 | `31aa53a7…` → `e0d04a02…` |
| #396 Azata-Blooded (Musetouched)                         | Native Outsider (Aasimar)     | `52e8e960…` → `94b90fa9…` |
| #396 Energy Strike (Cold)                                | Energy Strike (Electricity)   | `1aaccd12…` → `2a8b4ea9…` |
| #396 Woodcraft                                           | Elven Magic (Elf)             | `8d6deb64…` → `a67dcb69…` |
| #397 Keeper of Secrets                                   | Elven Magic (Elf)             | `fc8f9da0…` → `9f1032bc…` |
| #397 Overwhelming Magic                                  | Elven Magic (Elf)             | `7f56a4df…` → `4f0d0467…` |
| #397 Savage Elf                                          | Elven Magic (Elf)             | `885a0518…` → `44e09944…` |
| #397 Snowcaster Elves                                    | Elven Magic (Elf)             | `ea78c5e7…` → `c02ce9cb…` |
| #397 Werebear-Kin (Coldborn)                             | Animal-Minded                 | `a6389132…` → `4744c6d6…` |
| #370 Shadow Stalker (Fetchling)                          | Shadow Blending               | `6d9fa593…` → `a4f5ea91…` |

They are recorded in each batch's inventory `currentBinding` and `tests/fixtures/<batch>/preview.json`. `racial-traits-395.json`, `racial-traits-396.json`, `racial-traits-397.json` and their preview fixtures keep their landed `JSON.stringify` layout, so their diff is the re-bind only.

- **Already stale, not re-bound:** 26 assessments that reach batch keys were stale on the base and are unchanged: 25 #328 race records and Extra Feature (feats-330).
- **Protected records (spells-534):** #534's `protected-context.json` pins the definition fingerprint of Weapon Familiarity (Halfling), which its `binding-preview.json` copies. This batch gives it its evidence-backed description Note, so its #534 copy and protected definition are re-bound from #534's own re-import (`2606e845…` → `f8fb4702…`), as #392 and #397 did; only that row changes, and no #534 spell binding changes (0 of its assessments). No batch key is a protected root.
- **Other fixture copies:** `feats-355/binding-preview.json` copies 6 batch keys (Darkvision (Aphorite), Languages (Goblin), Seed, Crystalline Dust, Goblinoid (Goblin), Spell-Like Ability (Aphorite)) that no #355 assessment's closure reaches; the #529 to #536 `preserved.json`, #350 to #355 and #530 to #536 `protected-context.json` and the #719, #720, #721, #348 and #355 `provenance.json` lists name batch keys only as seed, closure and source keys. `spells-534` and `feats-355` tests are run below.
- **In-flight batches:** no #548 (pf-buffs) key is in this batch's closures (the linked buffs are inert supplements).

## Binding

Every assessment is bound with `buildAssessmentBinding` against the full-corpus content closure: the final full `catalog:preview` artifact, with the batch's 77 entries and their 76 closure entries. The [preview fixture](../../tests/fixtures/racial-traits-398/preview.json) keeps both, so the batch test rebuilds every binding from a clean shared-store tree (0 mismatches). The race note outputs re-homed onto Elven Magic (Elf) and Nocturnal (Strix) are absent from a bounded tree without the race; the test lists them as relocated.

## Tests

The [resolver tests](../../tests/catalog/racial-traits-398.test.ts) pin Werewolf-Kin (Witchwolf) replacing the skinwalker's ability score trait on a skinwalker identity sheet (Constitution 10 to 12, Wisdom 12 to 10, Intelligence 8), every Situation-gated bonus (off by default, on when selected) and its published type, Attentive's +4 total, the re-homed shared and local Situations, distinct racial Sources stacking (+4), the imported and relocated values not curated twice and no `ac.other` armor, shield or natural armor bonus; all 40 required and 77 description records checked, the three covered records and the Note targets; the race, alternate, monster-ability, inherited and Unchained notice dependencies (24 PZO1131 keys, own action versus bound body), every hold registered; the importer reading of races and replacements; the literal PCGen and PRD evidence in the shared store; and a clean-tree re-extraction that keeps every record held on its own holds (Defensive Abilities on its import gap).

The [isolated saved-sheet test](../../tests/catalog/racialTraits398.integration.test.ts) exercises public Convex reads and writes: a skinwalker-identity race granting its ability score trait and Animal-Minded takes the held Werewolf-Kin (Witchwolf) (Constitution +2, Wisdom -2, Sense Motive -1) and turns it off again, with saved totals equal to the preview; outsiders, anonymous callers and another campaign's entry are refused without changing the sheet. The shared held-release round trip is covered once by the release test in [`traits367.integration.test.ts`](../../tests/catalog/traits367.integration.test.ts).

## Preservation and gates

The shared canonical files gain only this batch's entries: 117 curation records (77 description and 40 note records), 77 assessments, 77 evidence entries and 44 notice holds. The other changes are the listed re-binds (content fingerprints only) with their `currentBinding` and fixture copies and the spells-534 protected copy. Shared-file diff stat against `41cbb0b9` (`git diff --stat HEAD`):

```text
 scripts/catalog/legal/held-notices.json           |  403 ++++
 scripts/catalog/legal/racial-traits-387.json      |   10 +-
 scripts/catalog/legal/racial-traits-388.json      |    6 +-
 scripts/catalog/legal/racial-traits-389.json      |    8 +-
 scripts/catalog/legal/racial-traits-390.json      |    6 +-
 scripts/catalog/legal/racial-traits-391.json      |    6 +-
 scripts/catalog/legal/racial-traits-392.json      |   14 +-
 scripts/catalog/legal/racial-traits-393.json      |   12 +-
 scripts/catalog/legal/racial-traits-394.json      |   12 +-
 scripts/catalog/legal/racial-traits-395.json      |   18 +-
 scripts/catalog/legal/racial-traits-396.json      |    8 +-
 scripts/catalog/legal/racial-traits-397.json      |   10 +-
 scripts/catalog/legal/traits-370.json             |    2 +-
 scripts/catalog/reviewed-curation.json            | 2587 ++++++++++++++++++++-
 src/lib/catalog/data/attribution-assessments.json | 1974 +++++++++++++++-
 src/lib/catalog/data/attribution-evidence.json    |  231 ++
 tests/fixtures/racial-traits-387/preview.json     |   33 +-
 tests/fixtures/racial-traits-388/preview.json     |   24 +-
 tests/fixtures/racial-traits-389/preview.json     |   21 +-
 tests/fixtures/racial-traits-390/preview.json     |   33 +-
 tests/fixtures/racial-traits-391/preview.json     |   12 +-
 tests/fixtures/racial-traits-392/preview.json     |   55 +-
 tests/fixtures/racial-traits-393/preview.json     |   48 +-
 tests/fixtures/racial-traits-394/preview.json     |   19 +-
 tests/fixtures/racial-traits-395/preview.json     |  103 +-
 tests/fixtures/racial-traits-396/preview.json     |   38 +-
 tests/fixtures/racial-traits-397/preview.json     |   21 +-
 tests/fixtures/spells-534/binding-preview.json    |    5 +
 tests/fixtures/spells-534/protected-context.json  |    2 +-
 tests/fixtures/traits-370/preview.json            |   14 +-
 30 files changed, 5369 insertions(+), 366 deletions(-)
```

<!-- prep:shared-store-count -->

New shared-store files (`tests/fixtures/pinned/`), counted by prep after the rebase onto `5a50978b`: **88** (pcgen 1, pf1-content 87).

<!-- /prep:shared-store-count -->

The batch adds to the shared store the pinned records of its 100 keys the store lacked, the pf-racial-traits folder records above them and the linked racial traits, the Eldritch Heritage pf-feats record, and one PCGen file (Blood of the Elements race abilities); the race records, the linked pf1 spells and feats, the other PCGen files and the PRD pages were already on the base and are reused.

The complete preview of `41cbb0b9` plus this batch reported **102 admitted, 23,151 held, 3 dependent omissions and 2,232 failures**, 40 fewer than the base's 2,272 (this batch's required note records). The only batch key among the failures is Defensive Abilities (the import gap above). The import report's race summary is unchanged except one more fully resolved alternate (Werewolf-Kin's "Base Statistics"); stale race notes stay at 4.

## Commands

| Command                                                                                                                                                                                                                                                                                | Result                                                                                                                                                           |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `catalog:curate --candidates …` (required) and `--descriptions` (prose pass)                                                                                                                                                                                                           | pass; 40 required drafts and 16 prose drafts for the batch, 0 missing; 44 s with the bounded preview                                                             |
| `catalog:preview --candidates …`                                                                                                                                                                                                                                                       | exit 1 as expected (the bounded tree lacks linked races and traits); 77 entries, 40 required and 77 description records checked, 0 missing, 0 stale              |
| Full `catalog:curate`                                                                                                                                                                                                                                                                  | pass; 1,126 new drafts, none for this batch; 0 missing; about 3 min (capped)                                                                                     |
| Full `catalog:preview` (baseline, then final records)                                                                                                                                                                                                                                  | exit 1 as on the base (admission failures); final: 102 admitted, 23,151 held, 3 dependent omissions, 2,232 failures (base 2,272); about 7 min each plus queueing |
| Full re-bind (`bind.ts`, `xrebind398.ts` and the spells-534 re-import over the final full preview)                                                                                                                                                                                     | 77 assessments bound (0 mismatches); 56 earlier assessments re-bound, all fixture bindings agree; 0 #534 spell bindings changed                                  |
| `pnpm test` of the batch tests, the guards (`notice-holds`, `pinned-sources`, `cross-batch-bindings`, `batch-ownership-sweep`, `ac-other-defense-bonuses`), `racial-traits-719`, `race-facts-720`, `race-ability-721`, `spells-534` and `feats-355` (unit and integration; one worker) | pass; 14 files / 470 tests                                                                                                                                       |
| `pnpm -s typecheck`                                                                                                                                                                                                                                                                    | pass                                                                                                                                                             |
| `pnpm -s lint`                                                                                                                                                                                                                                                                         | pass; about 3 min                                                                                                                                                |
| `pnpm -s check:initial-migration-writers`                                                                                                                                                                                                                                              | pass; 185 registrations                                                                                                                                          |
| `pnpm catalog:pin`                                                                                                                                                                                                                                                                     | pass; `sha256:005ef0b9…`                                                                                                                                         |
| `pnpm catalog:notice-deps`                                                                                                                                                                                                                                                             | pass; 0 gaps; 39 advisory warnings, none for this batch                                                                                                          |
| `pnpm catalog:format --check`                                                                                                                                                                                                                                                          | pass                                                                                                                                                             |

`pnpm test tests/catalog` was left to the orchestrator's prep run on the rebased commit, as the brief directs.

## Review fix

Sol's review (fix first) found two missing inherited dependencies: Draconic Heritage now requires PZO1117 for Eldritch Heritage (new notice hold `racial-traits-398-notice-PZO1117-complete-chain`) and Superior Shapeshifter PZO1120 for Fox Shape's fox; both drop the "cites no source" origin holds. Only their required notices, notice holds, evidence and notice fingerprints change; their content and mapping fingerprints and every other binding are unchanged, and both are re-bound with `buildAssessmentBinding` over the committed closure fixture.
