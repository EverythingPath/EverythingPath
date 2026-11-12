# Racial traits #387: pf1-content pf-racial-traits batch 1

Reviewed by **Opus (AI curator) for the owner**, 2026-10-19.

Exactly the issue's 100 ordered, unique keys were reviewed: **0 admitted, 71 specifically held, 0 dependent omissions, 0 whole-entry unsupported/prose-only dispositions, 29 exclusions, 0 record-level 3.5 holds**. The exclusions are 19 Foundry `!folders!` records, which the importer's folder contract leaves out of the Catalog Entries (PRD Decision 17), and 10 records in the Advanced Race Guide Race Builder subtree, which the import contract excludes by folder ancestry ([README](README.md), explicit exclusions) and the [Racial Trait contract](../character-sheet/racial-traits.md) puts out of scope. No candidate carries a `3.5` tag. The 71 in-scope records are 25 standard racial traits, 34 alternates, 7 Subrace Standard heritage parts and 5 Subraces-folder heritages or racial subtypes.

The [machine-readable inventory and evidence](../../scripts/catalog/legal/racial-traits-387.json) records, per key, the complete pinned body and inert fields with their source hash and cited sources; the PCGen race-ability rows, PRD Advanced Race Guide paragraphs, leads and rejected same-name rows; the inherited-rule notices with their evidence, the linked bodies and the unresolved origins; the importer's reading of race, standard flag and replacements; every checked curation record, source discrepancies and calculation gaps; and the current assessment binding and mapped facts. This report summarizes them and does not repeat the evidence.

## #328 S4-B launch update

Reviewed 2026-11-01 by **Sol (AI curator) for the owner** ([races-328.md](races-328.md#s4-b-launch-half-elf-elf-gnome-and-halfling)). The S4-B launch review confirms 1 standard racial trait of Half-Elf, Elf, Gnome and Halfling with content-bound assessments; counts are now **2 admitted, 69 held**, with 29 exclusions unchanged. The earlier Opus review of each row stays in its `assessmentHistory`; every other candidate keeps its review and holds.

- **Keen Senses (Half-Elf)** (`pf1-content/1HOWCThotIz5ztx0`): matches the PRD ARG paragraph (`advancedRaceGuide/coreRaces/halfElves.html:371`) word for word; PCGen's Core Essentials row (`half_elf/halfelf_abilities_race.lst:25`) with the recorded DESC differences. Its Modifier is +2 racial Perception (skill.per). Required notices: PZO9280, PZO1121, PZO1110.

Each row's whole-content hold ("Book PDFs unavailable") is superseded by this comparison, and it records no notice hold: PZO1110 is reviewed, PZO1121's Registry hold and `racial-traits-387-notice-PZO1121-complete-chain` are cleared (`notice-clearances.json`, owner 2026-10-30), and PZO9280's reviewed confirmation waives `racial-traits-387-notice-PZO9280-complete-chain`. The batch's `noticeRequirements` rows keep these keys as history. Content fingerprints are unchanged (the imported entries are identical); only the status, rationale, evidence and notice bindings move.

Tests: `racial-traits-387.test.ts` checks the confirmed rows with the held ones (`assessedTraits` in the fixture), expects them admitted by the committed gate and records no hold for them. `racialTraits387.integration` moves its held release control from Keen Senses (Half-Elf) to Fast Swimmer (Locathah).

## #328 S4-A launch update

Reviewed 2026-11-01 by **Sol (AI curator) for the owner** ([races-328.md](races-328.md#s4-a-launch-human-dwarf-and-half-orc)). The launch review admits 1 standard racial trait of Human, Dwarf and Half-Orc with confirmed, content-bound assessments; counts are now **1 admitted, 70 held**, with 29 exclusions unchanged. The earlier Opus review of each admitted row stays in its `assessmentHistory`; every other candidate keeps its review and holds.

- **Greed (Dwarf)** (`pf1-content/2F4IRW8AAicQ3VYc`): matches the PRD ARG paragraph (`advancedRaceGuide/coreRaces/dwarves.html:365`) apart from "receive" for "gain"; PCGen's Core Essentials row (`dwarf/dwarf_abilities_race.lst:23`). Its Modifier is +2 racial Appraise in a local Situation (to determine the price of nonmagical goods containing precious metals or gemstones), re-homed from the Dwarf's checked note record. Required notices: PZO9280, PZO1121, PZO1110.

Each admitted row's whole-content hold ("Book PDFs unavailable") is superseded by this comparison, and it records no notice hold: PZO1110 is reviewed, PZO1121's Registry hold is cleared (owner, 2026-10-30), and PZO9280's reviewed confirmation waives `racial-traits-387-notice-PZO9280-complete-chain`. The batch's `noticeRequirements` rows keep these keys as history. Content fingerprints are unchanged (the imported entries are identical); only the status, rationale, evidence and notice bindings move.

Tests: `racial-traits-387.test.ts` checks the admitted rows with the held ones (`assessedTraits` in the fixture), expects them admitted by the committed gate and records no hold for them.

## Family-level choices

This is the first pf-racial-traits batch, so these choices are proposed as the precedent for #388–#405 and listed for review:

1. **Every in-scope record is held.** The race records stay held (#328), every cited book's notice chain is held, and no book PDFs are available, so each record keeps a whole-content hold, as the pf-traits family does. The two CRB-cited standard traits (Keen Senses (Half-Elf), Greed (Dwarf)) also cite Inner Sea Races and the Advanced Race Guide; the batch test shows a confirmed Keen Senses stays held on those notices.
2. **Race abilities.** Every record requires the books its pinned race record cites (docs/catalog-import/curation.md, Race abilities), recorded as an inherited rule with the race record's location. Drow Heritage also requires the drow record's book, since it counts as drow.
3. **Alternate framework.** Every alternate with a "Replaced Trait(s)" header records the APG alternate racial trait rule (PZO1115), evidenced by PCGen's APG race-ability row (Scavenger, `apg_abilities_race.lst:86`) and the product contract. Subrace Standard and Subraces-folder heritages do not: their own books define them.
4. **Monster abilities.** A record that grants a universal monster rule records the earliest book the pinned Universal Monster Rules journal page lists: darkvision PZO1127; low-light vision, scent, amphibious, natural attacks, ferocity, light blindness, breath weapon and resistance PZO1112; negative energy affinity PZO1116 (the settled rule, extended to traits by #370–#376).
5. **Creature types** (native outsider, fey, humanoid subtypes, living machine) have no pinned rules record, so they stay named unresolved origins rather than invented dependencies.
6. **PZO1131** for Unchained action-cost metadata anywhere in the bound closure: 20 records (15 on their own actions, 16 through bound bodies).
7. **Comparisons.** PCGen race-ability rows from a pinned book are the `comparison`; PCGen Core Essentials support rows (no SOURCELONG book, `SOURCEPAGE:p.xx`) are leads whose book is not required. The PRD capture's Advanced Race Guide pages are a new permitted comparison: 21 records carry a `prdComparison` with the literal paragraph, its hash and a word comparison (19 match word for word; Greed reads "receive" for the PRD's "gain", Negative Energy Affinity uses plural wording). The 14 captured pages were added to the shared store.
8. **Description pass.** Every in-scope record has a checked description record: its reviewed Modifiers plus one entry-level Note with the body, Foundry `@Distance` enrichers read as feet and `@Toggle` buff controls removed.
9. **Heritage ability lines.** Rimesoul (Frost Undine) and Div-Spawn (Spitespawn), two of the 37 `reviewedAbilityLineSubraces`, get their ability lines as racial ability Modifiers, so "Base Statistics" now resolves to their race's `local/race-ability-scores/` trait (the first heritage to do so; see Notable cases). Sea-Born (Brine May) does not: the changeling subrace's own ability record replaces the changeling trait by name.

## Dispositions

| Key                            | Name                                                  | Kind             | Disposition                                                      |
| ------------------------------ | ----------------------------------------------------- | ---------------- | ---------------------------------------------------------------- |
| `pf1-content/03lDLNTSNRDEgNrh` | Languages (Aquatic Elf)                               | standard         | held: `racial-traits-387-whole-content-03lDLNTSNRDEgNrh`         |
| `pf1-content/0732ZhCzO00426kM` | Deep Tradition                                        | alternate        | held: `racial-traits-387-whole-content-0732ZhCzO00426kM`         |
| `pf1-content/07mYrADfuCRzN0E6` | Standard                                              | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/09c76EsW9zGXAEZ0` | Alternate Spell-Like Ability (Dhampir - Ancient-Born) | subrace standard | held: `racial-traits-387-whole-content-09c76EsW9zGXAEZ0`         |
| `pf1-content/0CISUAPF2V91vvoo` | Rimesoul (Frost Undine)                               | subrace          | held: `racial-traits-387-whole-content-0CISUAPF2V91vvoo`         |
| `pf1-content/0HcXO1YYEXC3TDlc` | Energy Resistance (Suli)                              | standard         | held: `racial-traits-387-whole-content-0HcXO1YYEXC3TDlc`         |
| `pf1-content/0JIgdy0PM9C4PxKC` | Native Outsider (Aphorite)                            | standard         | held: `racial-traits-387-whole-content-0JIgdy0PM9C4PxKC`         |
| `pf1-content/0N742nfnJEnmb3e8` | Fey Nature                                            | standard         | held: `racial-traits-387-whole-content-0N742nfnJEnmb3e8`         |
| `pf1-content/0XgGpXLyrJnfXKTy` | Low-Light Vision (Naiad)                              | standard         | held: `racial-traits-387-whole-content-0XgGpXLyrJnfXKTy`         |
| `pf1-content/0Z7LoIqKFrjU0YGN` | Elf                                                   | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/0ZRPR97KwKUmWMfV` | Shards of the Past                                    | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/0bLTBltwiwx7EmGy` | Negative Energy Affinity                              | standard         | held: `racial-traits-387-whole-content-0bLTBltwiwx7EmGy`         |
| `pf1-content/0bZz3zIC0J5tuIF0` | Darkvision, 60 feet                                   | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/0batsU6Vpae72HiU` | Tentacle Attacks                                      | standard         | held: `racial-traits-387-whole-content-0batsU6Vpae72HiU`         |
| `pf1-content/0iD20IfHg4DJTX3X` | Final Change                                          | standard         | held: `racial-traits-387-whole-content-0iD20IfHg4DJTX3X`         |
| `pf1-content/0iFqZXfHNt2vAJ8h` | Div-Spawn (Spitespawn)                                | subrace          | held: `racial-traits-387-whole-content-0iFqZXfHNt2vAJ8h`         |
| `pf1-content/0iTSWckzDB9oMu4Q` | Dreamer                                               | alternate        | held: `racial-traits-387-whole-content-0iTSWckzDB9oMu4Q`         |
| `pf1-content/0kgOCeTSzC3Zg5v6` | Light from the Darkness                               | alternate        | held: `racial-traits-387-whole-content-0kgOCeTSzC3Zg5v6`         |
| `pf1-content/0lwUQ9hM3gWjZzki` | Darkvision (Fetchling)                                | standard         | held: `racial-traits-387-whole-content-0lwUQ9hM3gWjZzki`         |
| `pf1-content/0mr3QMbLIx0WHoBV` | Unfettered                                            | alternate        | held: `racial-traits-387-whole-content-0mr3QMbLIx0WHoBV`         |
| `pf1-content/0njM63yOJ0z2N0D9` | Subrace Standard                                      | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/0o0xVtWRdjHIExjd` | Fey Damage Resistance                                 | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/0padhC2cSPeYhbuU` | Smite Good                                            | alternate        | held: `racial-traits-387-whole-content-0padhC2cSPeYhbuU`         |
| `pf1-content/0safJrWJGu9FvC5n` | Standard                                              | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/0xPskB6ehhq5g5f6` | Minesight (Dwarf)                                     | alternate        | held: `racial-traits-387-whole-content-0xPskB6ehhq5g5f6`         |
| `pf1-content/0zCDh21K2n1mqfJO` | Dusksight (Dwarf)                                     | alternate        | held: `racial-traits-387-whole-content-0zCDh21K2n1mqfJO`         |
| `pf1-content/0zwAyNsw272Wm9Xg` | Alternate Skill Modifiers (Skinwalker - Fanglord)     | subrace standard | held: `racial-traits-387-whole-content-0zwAyNsw272Wm9Xg`         |
| `pf1-content/10fI7Q5jTGYhav06` | Low-Light Vision (Kitsune)                            | standard         | held: `racial-traits-387-whole-content-10fI7Q5jTGYhav06`         |
| `pf1-content/14Yg8GAjRW3tW486` | Curiosity                                             | alternate        | held: `racial-traits-387-whole-content-14Yg8GAjRW3tW486`         |
| `pf1-content/17nj8pGeCnDOhExG` | Blended View (Half-Elf)                               | alternate        | held: `racial-traits-387-whole-content-17nj8pGeCnDOhExG`         |
| `pf1-content/1AmHSWuqAMrEBChf` | Irrepressible                                         | alternate        | held: `racial-traits-387-whole-content-1AmHSWuqAMrEBChf`         |
| `pf1-content/1AsRiSma7Ig8qAgf` | Living Machine                                        | alternate        | held: `racial-traits-387-whole-content-1AsRiSma7Ig8qAgf`         |
| `pf1-content/1HOWCThotIz5ztx0` | Keen Senses (Half-Elf)                                | standard         | held: `racial-traits-387-whole-content-1HOWCThotIz5ztx0`         |
| `pf1-content/1J9wfQY8uCA3Q5oM` | Standard                                              | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/1JlE7WfSvWMead3S` | Deepsight                                             | alternate        | held: `racial-traits-387-whole-content-1JlE7WfSvWMead3S`         |
| `pf1-content/1MzKaqJwwWClm9vd` | Hard Head, Big Teeth                                  | alternate        | held: `racial-traits-387-whole-content-1MzKaqJwwWClm9vd`         |
| `pf1-content/1OWNsl3OovdHDbuP` | Magical                                               | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/1OXMUAUKknfsmQAv` | Type                                                  | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/1UHvZuP40K00NYLU` | Frightening                                           | alternate        | held: `racial-traits-387-whole-content-1UHvZuP40K00NYLU`         |
| `pf1-content/1XqRrec5Ag0n0yM2` | Alternate                                             | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/1ZKTeS0OhLZLRca0` | Standard                                              | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/1a6WuPBFKqhIk4DC` | Sea-Born (Brine May)                                  | subrace          | held: `racial-traits-387-whole-content-1a6WuPBFKqhIk4DC`         |
| `pf1-content/1a9UeeKPwwMOMNoR` | Standard                                              | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/1alOGz6KPvdQB44E` | Alternate                                             | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/1bZoIL5ZYzbjTHnQ` | Alternate Spell-Like Ability (Dhampir - Svetocher)    | subrace standard | held: `racial-traits-387-whole-content-1bZoIL5ZYzbjTHnQ`         |
| `pf1-content/1g77OsLX5gc6iYzL` | Alternate                                             | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/1kZ5mKCyb6CjEjFT` | Ekujae Elves                                          | subrace          | held: `racial-traits-387-whole-content-1kZ5mKCyb6CjEjFT`         |
| `pf1-content/1npK4cEPv3XOSIT2` | Camouflage                                            | standard         | held: `racial-traits-387-whole-content-1npK4cEPv3XOSIT2`         |
| `pf1-content/1oIneGLuXoO7VeNn` | Alternate                                             | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/1qrbRN0QHorkF29R` | Poison Resistance                                     | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/1s61apBo9a9REri8` | Drow Heritage                                         | alternate        | held: `racial-traits-387-whole-content-1s61apBo9a9REri8`         |
| `pf1-content/1tOycM1c53b1tOsL` | Fey                                                   | standard         | held: `racial-traits-387-whole-content-1tOycM1c53b1tOsL`         |
| `pf1-content/1vPof37VgEYpfIxo` | Scavenger                                             | alternate        | held: `racial-traits-387-whole-content-1vPof37VgEYpfIxo`         |
| `pf1-content/1zFEagiB7rG5o0ks` | Conservative Diplomacy                                | alternate        | held: `racial-traits-387-whole-content-1zFEagiB7rG5o0ks`         |
| `pf1-content/1zv4iK55HmIBhNmF` | Amphibious (Locathah)                                 | standard         | held: `racial-traits-387-whole-content-1zv4iK55HmIBhNmF`         |
| `pf1-content/20MZKzAdXq7r91VL` | Darklands Guide                                       | alternate        | held: `racial-traits-387-whole-content-20MZKzAdXq7r91VL`         |
| `pf1-content/20tBxcHiLRujQYvC` | Crystalline Form                                      | alternate        | held: `racial-traits-387-whole-content-20tBxcHiLRujQYvC`         |
| `pf1-content/23HcNMKrQH3EnOQS` | Seducer                                               | alternate        | held: `racial-traits-387-whole-content-23HcNMKrQH3EnOQS`         |
| `pf1-content/27NShcUlmj6wDaAW` | Shadowhunter (Halfling)                               | alternate        | held: `racial-traits-387-whole-content-27NShcUlmj6wDaAW`         |
| `pf1-content/27mzZu02Xb9oYCqD` | Changeling                                            | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/2AJOaBUtrLSKx6n4` | Intoxicating Aroma                                    | alternate        | held: `racial-traits-387-whole-content-2AJOaBUtrLSKx6n4`         |
| `pf1-content/2Apl0Nfjo4HelVN1` | Blood Frenzy                                          | standard         | held: `racial-traits-387-whole-content-2Apl0Nfjo4HelVN1`         |
| `pf1-content/2CcPWXsRKYa0Za5s` | Tengu                                                 | standard         | held: `racial-traits-387-whole-content-2CcPWXsRKYa0Za5s`         |
| `pf1-content/2D0gZsqUawS3Rd0O` | Light Blindness (Drow)                                | standard         | held: `racial-traits-387-whole-content-2D0gZsqUawS3Rd0O`         |
| `pf1-content/2Do0WTfTNBwfKgjU` | Change Shape (Skinwalker - Scaleheart)                | subrace standard | held: `racial-traits-387-whole-content-2Do0WTfTNBwfKgjU`         |
| `pf1-content/2ED711WOchfPENKx` | Heavenborn                                            | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/2F03Jn6ktkcleGIz` | Deep Magic                                            | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/2F4IRW8AAicQ3VYc` | Greed (Dwarf)                                         | standard         | held: `racial-traits-387-whole-content-2F4IRW8AAicQ3VYc`         |
| `pf1-content/2Gz1809xjufRnaum` | Subrace Standard                                      | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/2HJVv18LjvN5cW1c` | Skilled (Aasimar - Angelkin)                          | subrace standard | held: `racial-traits-387-whole-content-2HJVv18LjvN5cW1c`         |
| `pf1-content/2HKpQJWvyFGjOd87` | Dhampir                                               | standard         | held: `racial-traits-387-whole-content-2HKpQJWvyFGjOd87`         |
| `pf1-content/2NXp8S2ZZ2Lh5LS3` | Halo                                                  | alternate        | held: `racial-traits-387-whole-content-2NXp8S2ZZ2Lh5LS3`         |
| `pf1-content/2Ool05yDjjzZueOo` | Reborn Samsaran                                       | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/2P6GMxnBmxrFmNTM` | Reptilian Ancestry                                    | alternate        | held: `racial-traits-387-whole-content-2P6GMxnBmxrFmNTM`         |
| `pf1-content/2SMtlRt0fDdsm0xZ` | Fast Swimmer (Locathah)                               | standard         | held: `racial-traits-387-whole-content-2SMtlRt0fDdsm0xZ`         |
| `pf1-content/2Sfr16Du1PcB739m` | Ooze Breath                                           | alternate        | held: `racial-traits-387-whole-content-2Sfr16Du1PcB739m`         |
| `pf1-content/2UbTDmZJKKlBmOxn` | Low-Light Vision (Fetchling)                          | standard         | held: `racial-traits-387-whole-content-2UbTDmZJKKlBmOxn`         |
| `pf1-content/2XbX9NjWXjQFAqAf` | Sprinter                                              | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/2aTXOPJqZ8DpLi36` | Fey Thoughts (Dwarf)                                  | alternate        | held: `racial-traits-387-whole-content-2aTXOPJqZ8DpLi36`         |
| `pf1-content/2bzaqSpNN046f9ne` | Armor (Kobold)                                        | standard         | held: `racial-traits-387-whole-content-2bzaqSpNN046f9ne`         |
| `pf1-content/2fWyJqNdoARq7kA2` | Standard                                              | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/2grfqw7hTZjurhUP` | Suli                                                  | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/2hvOVmG4lyZ6PZ2G` | Subraces                                              | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/2jJkIYgBDpnVusfr` | Utilitarian Magic                                     | alternate        | held: `racial-traits-387-whole-content-2jJkIYgBDpnVusfr`         |
| `pf1-content/2l2fKoeqwAjHyiOa` | Stoneseer                                             | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/2l6HA11NcCajETFk` | Mountaineer                                           | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/2ltiVrbIQHhbrSGQ` | Dragon Sight                                          | alternate        | held: `racial-traits-387-whole-content-2ltiVrbIQHhbrSGQ`         |
| `pf1-content/2m3sETitdW1uwabS` | Own Two Feet                                          | standard         | held: `racial-traits-387-whole-content-2m3sETitdW1uwabS`         |
| `pf1-content/2mlJ9zKk5DkyT0Mm` | Spell-Like Ability (Oread - Ironsoul)                 | subrace standard | held: `racial-traits-387-whole-content-2mlJ9zKk5DkyT0Mm`         |
| `pf1-content/2ppVDApnWAEYnzHO` | Jininese Elves                                        | subrace          | held: `racial-traits-387-whole-content-2ppVDApnWAEYnzHO`         |
| `pf1-content/2pxpHYnC1lhwLDso` | Forest Walker (Orang-Pendak)                          | standard         | held: `racial-traits-387-whole-content-2pxpHYnC1lhwLDso`         |
| `pf1-content/2qthbnn32qDWelLM` | Change Shape, Lesser                                  | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/2t6pdfDHRiX6UbEQ` | Submerged                                             | alternate        | held: `racial-traits-387-whole-content-2t6pdfDHRiX6UbEQ`         |
| `pf1-content/2uXjoDFad7NaBCOG` | Spell-Like Ability (Undine - Rimesoul)                | subrace standard | held: `racial-traits-387-whole-content-2uXjoDFad7NaBCOG`         |
| `pf1-content/2y6Om4T1c7V7Stll` | Magical Absorption                                    | alternate        | held: `racial-traits-387-whole-content-2y6Om4T1c7V7Stll`         |
| `pf1-content/2zJmqweobLpf54yh` | Native Outsider (Undine)                              | standard         | held: `racial-traits-387-whole-content-2zJmqweobLpf54yh`         |
| `pf1-content/2zJzdyvZ61GVbC0H` | Scent (Catfolk)                                       | alternate        | held: `racial-traits-387-whole-content-2zJzdyvZ61GVbC0H`         |
| `pf1-content/2zhilqoeGrOO3yeI` | Lab Rat                                               | alternate        | held: `racial-traits-387-whole-content-2zhilqoeGrOO3yeI`         |
| `pf1-content/355MFgN4senDv0w7` | Like the Wind                                         | alternate        | held: `racial-traits-387-whole-content-355MFgN4senDv0w7`         |
| `pf1-content/3640BjAlEPrnmAlP` | Sense Aberration                                      | alternate        | held: `racial-traits-387-whole-content-3640BjAlEPrnmAlP`         |

## Notable cases

- **Heritages resolving to a `local/` trait (untested case).** Curated Modifiers trigger the replacement (README, Mapped replacement): Rimesoul replaces `local/race-ability-scores/pf1/iqJvhd7NbmybUl0y` and Div-Spawn replaces the tiefling's. Their content closures therefore reach the race and all its standard traits (88 and 71 entries). The resolver and the saved-sheet test show the undine's +2 Dex, +2 Wis, −2 Str going dormant for Rimesoul's +2 Dex, +2 Int, −2 Cha and coming back when it is turned off. When a later batch curates an Undine or Tiefling standard trait, it re-binds these two assessments.
- **Orang-Pendak uncovered notes (counted once).** Forest Walker's two notes are the race's uncovered trait notes. Their checked records carry the same outputs as the race's #328 note records (+4 untyped on Climb and Stealth in forests and in jungles). A checked trait note record supersedes the race note records, so `pf1/m5cdZ1RG7c1mkhqF` `skill.clm` and `skill.ste` are now reported stale and apply nothing. Removing those two stale #328 records is a follow-up (curation.md, Record contract); this batch leaves #328's rows unchanged. Own Two Feet's −2 while riding is on the race entry, from #328's description record (a latent overlap). Its three Modifier notes are therefore covered/no-output, and only the ability-check Note is added.
- **Race-covered notes.** Camouflage's and Greed's Foundry notes are covered by checked race records (`coveredTraitNotes`), so they have no required record of their own; their bonuses are the race's re-homed Modifiers.
- **Darklands Guide.** The +2 initiative applies always and the save bonus only against traps and hazards underground. That follows PCGen's row (`BONUS:COMBAT|INITIATIVE|2`); Foundry's underground-only reading is recorded but not adopted.
- **School DCs.** Seducer (enchantment) and Utilitarian Magic (transmutation) get a reviewed `spellDC` Modifier with a school condition, as the #328 Gnome and Kitsune records do; the raw `dc.school.*` changes don't map.
- **Irrepressible** stacks with halfling luck as published: racial bonuses from different Sources stack, so its +2 and halfling luck's +1 give +3 on saves against dominate and possession effects (the batch test resolves it).
- **Not modeled, listed:** Drow Heritage's counting as drow (`countsAsRaces` needs a reviewed racial-trait rule), senses, speeds, spell-like abilities, class-skill grants, natural attacks and creature types.
- **Shared Situations** only where the condition matches exactly: illusions (Dreamer), mind-affecting and poison (Reptilian Ancestry), poison (Lab Rat), forests (Forest Walker). Everything else stays local.

## Importer and data gaps

- **Header not read (own entry; neither #738 nor #739).** Alternate Spell-Like Ability (Dhampir - Ancient-Born) and (Dhampir - Svetocher) write `Replaced Trait(s):` with the colon inside the bold label, followed by a link. The importer misses the header, falls back to the same-name rule and lists the record's own name as unresolved.
- **Unresolved replaced names:** Living Machine ("Type", a race fact), Drow Heritage ("Bonus Languages", no record), Magical Absorption ("Nature Magic", a pf1-content typo for Natural Magic). The changeling subrace and the two elf ethnicities keep "Base Statistics" unmatched, as designed.
- **Ownerless race output:** the Orang-Pendak riding penalty stays on the race until a reviewed description re-home rule (`reviewedDescriptionRehomes`) moves it onto Own Two Feet.
- **`countsAsRaces`** can't be set through the Curation Overlay (Drow Heritage).
- The raw upstream keys in `mapRacialTrait` caused no reference failure here: the full preview has no failure for any batch key. The bounded preview's 42 reference failures are links and replacements outside the selection.
- No linked pf-items record is missing. There is no Orc Atavism, no replacement of a counts-as trait and no multi-race "Base Statistics" folder in this batch.

## Outstanding mechanics

Each record lists its calculation gaps in `mechanicsReview.outstandingCalculations`; none is an attribution hold. The main ones are senses (darkvision, low-light vision, scent), speeds, spell-like abilities and breath weapons, natural attacks, creature types, class-skill grants, languages, conditions applied by light, Drow Heritage's race counting and the Orang-Pendak riding penalty's owner.

## Cross-batch bindings and protected records

- **Re-bound:** #524's Fey Boon (`pf1/JYgzYISWlo5CQQg3`, `spells-524`) covers Greed (Dwarf) through the Dwarf race and was current before this batch. Its content fingerprint moved from `f26e293d…` to `5d7a59a6…`. The Greed entry in `tests/fixtures/spells-524/binding-preview.json` was updated to the entry #524's own re-import now produces (its new description Note), and the fixture-based binding agrees. #524's inventory records no `currentBinding`; nothing else in #524 changed.
- **Already stale, not re-bound:** the 21 #328 race assessments and #331's Tail Terror also reach batch keys, but their bindings were already stale on the base (the deferred stale set, curation.md). They are left for the post-curation cleanup.
- Earlier fixtures that copy batch keys (#355, #719, #720, #721, #328, #524) were checked by running their tests. Batch keys sit in no landed pf-traits closure, and no pf-traits key is in this batch's closures.

## Binding

Every assessment is bound with `buildAssessmentBinding` against the full-corpus content closure: the final full `catalog:preview` artifact, with the batch's 71 entries and their 206 closure entries. The [preview fixture](../../tests/fixtures/racial-traits-387/preview.json) keeps both, so the batch test rebuilds every binding from a clean shared-store tree.

## Tests

The [resolver tests](../../tests/catalog/racial-traits-387.test.ts) pin:

- the reviewed values through the public resolver: the heritage replacements against their race sheets, every Situation-gated bonus (off by default, on when selected), the shared Situations not stacking within an entry, the school DCs, imported changes not curated twice, the race-supplied bonuses, Final Change contributing nothing, and no `ac.other` armor, shield or natural armor bonus;
- all 35 required and 71 description records checked, the four covered/no-output records, the entry-level and retargeted Notes, and an outstanding calculation on every record;
- the race, alternate, monster-ability, cited and Unchained notice dependencies (the 20 PZO1131 keys, own action versus bound body, read from the pinned records), the creature-type origins and the enforced holds;
- the importer's race, standard and replacement reading for every record, and the exact unresolved names;
- every pinned body, inert field, literal PCGen row and PRD paragraph in the shared store, and the excluded records;
- re-extraction from a clean shared-store tree (records, folder chains and race records): every record checked, no gate failure, all 71 held on their own reasons, every binding reproduced, and a confirmed Keen Senses still held.

The [isolated saved-sheet test](../../tests/catalog/racialTraits387.integration.test.ts) exercises public Convex reads and writes. An Undine with its standard traits takes the held Rimesoul (the ability score trait goes dormant), then Deepsight, then turns Rimesoul off again, with saved totals equal to the preview. Outsiders, anonymous callers and another campaign's entry are refused without changing the sheet. The shared held-release round trip is covered once by the release test in [`traits367.integration.test.ts`](../../tests/catalog/traits367.integration.test.ts). No deployment or production activation occurred.

## Preservation and gates

The shared canonical files gain only this batch's entries: 106 curation records (71 description and 35 note records), 71 assessments, 71 evidence entries and 35 notice holds. The one other change is the listed Fey Boon re-bind and its fixture entry. Shared-file diff stat (`git diff --stat --diff-algorithm=histogram`):

```text
 scripts/catalog/legal/held-notices.json           |  335 +++
 scripts/catalog/reviewed-curation.json            | 2270 +++++++++++++++++++++
 src/lib/catalog/data/attribution-assessments.json | 1722 +++++++++++++++-
 src/lib/catalog/data/attribution-evidence.json    |  213 ++
 tests/fixtures/spells-524/binding-preview.json    |    7 +-
 5 files changed, 4545 insertions(+), 2 deletions(-)
```

<!-- prep:shared-store-count -->

New shared-store files (`tests/fixtures/pinned/`), counted by prep after the rebase onto `9974c36c`: **280** (pcgen 35, pf1 32, pf1-content 199, prd 14).

<!-- /prep:shared-store-count -->

The batch adds to the shared store its 100 pinned records, the pf-racial-traits folder records above them, the pinned race records they bind to, the linked bodies (spells, Deflect Arrows and racial traits), the PCGen race-ability, APG and anchor files the evidence cites, and 14 PRD capture pages (the Advanced Race Guide race pages). Files already on the base were reused.

The complete preview reported **86 admitted, 23,168 held, 2 dependent omissions and 2,778 failures** (on `9b1441f8`): 1,672 missing curation records, 715 unaccounted records and 391 structure or reference failures. That is 35 fewer than the base's 2,813, this batch's required note records, and no batch key is among the failures. The full-corpus gate is therefore a documented failure, not a claim of whole-corpus readiness.

| Command                                                                                                                                                                                                                                                                                                                          | Result                                                                                                                                  |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `catalog:curate --candidates …` (required) and `--descriptions` (prose pass)                                                                                                                                                                                                                                                     | pass; 35 required drafts, 22 prose drafts                                                                                               |
| `catalog:preview --candidates …`                                                                                                                                                                                                                                                                                                 | exit 1; 0 admitted / 29 held / 42 failures: links and replacements outside the selection (the full preview has none for this batch)     |
| Full `catalog:curate`                                                                                                                                                                                                                                                                                                            | pass; 1,672 new drafts, none for this batch; 0 missing; the two superseded Orang-Pendak race note records reported stale; about 2.7 min |
| Full `catalog:preview`                                                                                                                                                                                                                                                                                                           | exit 1; 2,778 failures, none for this batch; about 3.5 min                                                                              |
| Full re-bind (`buildAssessmentBinding` over the final full preview)                                                                                                                                                                                                                                                              | inventory, assessments and preview fixture reproduced; 0 mismatches against the clean-tree reconstruction                               |
| `pnpm test tests/catalog/racial-traits-387.test.ts tests/catalog/racialTraits387.integration.test.ts tests/catalog/notice-holds.test.ts tests/catalog/pinned-sources.test.ts tests/catalog/cross-batch-bindings.test.ts tests/catalog/ac-other-defense-bonuses.test.ts tests/catalog/batch-ownership-sweep.test.ts` (one worker) | pass; 7 files / 153 tests; about 2.7 min                                                                                                |
| Affected earlier tests: `spells-524`, `feats-355`, `racial-traits-719`, `race-facts-720`, `race-ability-721`, `races-328` (one worker)                                                                                                                                                                                           | pass; with the four guards above, 10 files / 362 tests                                                                                  |
| `pnpm -s typecheck`                                                                                                                                                                                                                                                                                                              | pass                                                                                                                                    |
| `pnpm -s lint`                                                                                                                                                                                                                                                                                                                   | pass; about 2.5 min                                                                                                                     |
| `pnpm -s check:initial-migration-writers`                                                                                                                                                                                                                                                                                        | pass; 185 registrations                                                                                                                 |
| `pnpm catalog:pin`                                                                                                                                                                                                                                                                                                               | pass; `sha256:005ef0b9…`                                                                                                                |
| `pnpm catalog:notice-deps`                                                                                                                                                                                                                                                                                                       | pass; 0 gaps; 38 advisory warnings, none for this batch                                                                                 |
| `pnpm catalog:format --check`                                                                                                                                                                                                                                                                                                    | pass                                                                                                                                    |

`pnpm test tests/catalog` was left to the orchestrator's prep run on the rebased commit, as the brief directs.
