# Racial traits #388: pf1-content pf-racial-traits batch 2

Reviewed by **Opus (AI curator) for the owner**, 2026-10-19.

Exactly the issue's 100 ordered, unique keys were reviewed: **0 admitted, 71 specifically held, 0 dependent omissions, 0 whole-entry unsupported/prose-only dispositions, 29 exclusions, 0 record-level 3.5 holds**. The exclusions are 12 Foundry `!folders!` records, which the importer's folder contract leaves out of the Catalog Entries (PRD Decision 17), and 17 records in the Advanced Race Guide Race Builder subtree, which the import contract excludes by folder ancestry ([README](README.md), explicit exclusions) and the [Racial Trait contract](../character-sheet/racial-traits.md) puts out of scope. No candidate carries a `3.5` tag. The 71 in-scope records are 23 standard racial traits, 39 alternates, 4 Subrace Standard heritage parts and 5 Subraces-folder heritages or racial subtypes.

The [machine-readable inventory and evidence](../../scripts/catalog/legal/racial-traits-388.json) records, per key, the complete pinned body and inert fields with their source hash and cited sources; the PCGen race-ability rows, PRD Advanced Race Guide paragraphs and leads; the inherited-rule notices with their evidence, the linked bodies and the unresolved origins; the importer's reading of race, standard flag and replacements; every checked curation record, source discrepancies and calculation gaps; and the current assessment binding and mapped facts. This report summarizes them and does not repeat the evidence.

## #328 S4-B launch update

Reviewed 2026-11-01 by **Sol (AI curator) for the owner** ([races-328.md](races-328.md#s4-b-launch-half-elf-elf-gnome-and-halfling)). The S4-B launch review confirms 1 standard racial trait of Half-Elf, Elf, Gnome and Halfling with content-bound assessments; counts are now **2 admitted, 69 held**, with 29 exclusions unchanged. The earlier Opus review of each row stays in its `assessmentHistory`; every other candidate keeps its review and holds.

- **Languages (Half-Elf)** (`pf1-content/3HbUyHrEVeDiTH1d`): matches the PRD ARG paragraph (`advancedRaceGuide/coreRaces/halfElves.html:373`) word for word; PCGen's Core Essentials row (`half_elf/halfelf_abilities_race.lst:27`) word for word. Languages (Common and Elven; any non-secret bonus language) stay readable prose; the record's languages field stays in gameContent. Required notices: PZO9280, PZO1121, PZO1110. Outstanding: Languages are permitted prose; no language statistic.

Each row's whole-content hold ("Book PDFs unavailable") is superseded by this comparison, and it records no notice hold: PZO1110 is reviewed, PZO1121's Registry hold and `racial-traits-388-notice-PZO1121-complete-chain` are cleared (`notice-clearances.json`, owner 2026-10-30), and PZO9280's reviewed confirmation waives `racial-traits-388-notice-PZO9280-complete-chain`. The batch's `noticeRequirements` rows keep these keys as history. Content fingerprints are unchanged (the imported entries are identical); only the status, rationale, evidence and notice bindings move.

Tests: `racial-traits-388.test.ts` checks the confirmed rows with the held ones (`assessedTraits` in the fixture), expects them admitted by the committed gate and records no hold for them.

## #328 S4-A launch update

Reviewed 2026-11-01 by **Sol (AI curator) for the owner** ([races-328.md](races-328.md#s4-a-launch-human-dwarf-and-half-orc)). The launch review admits 1 standard racial trait of Human, Dwarf and Half-Orc with confirmed, content-bound assessments; counts are now **1 admitted, 70 held**, with 29 exclusions unchanged. The earlier Opus review of each admitted row stays in its `assessmentHistory`; every other candidate keeps its review and holds.

- **Stonecunning (Dwarf)** (`pf1-content/6JCG0ei0s0ossrtx`): matches the PRD ARG paragraph (`advancedRaceGuide/coreRaces/dwarves.html:369`) apart from "receive" for "gain"; an added "potentially"; an added "any"; "that" for "whenever"; no "them"; PCGen's Core Essentials row (`dwarf/dwarf_abilities_race.lst:27`). Its own checked skill.per record gives +2 untyped Perception in a local Situation (to notice unusual stonework) and the automatic-check Note; the Dwarf's skill.per note record is superseded (staleNotes), so the bonus counts once. Required notices: PZO9280, PZO1121, PZO1110. Outstanding: The automatic Perception check within 10 feet stays a Note.

Each admitted row's whole-content hold ("Book PDFs unavailable") is superseded by this comparison, and it records no notice hold: PZO1110 is reviewed, PZO1121's Registry hold is cleared (owner, 2026-10-30), and PZO9280's reviewed confirmation waives `racial-traits-388-notice-PZO9280-complete-chain`. The batch's `noticeRequirements` rows keep these keys as history. Content fingerprints are unchanged (the imported entries are identical); only the status, rationale, evidence and notice bindings move.

Tests: `racial-traits-388.test.ts` checks the admitted rows with the held ones (`assessedTraits` in the fixture), expects them admitted by the committed gate (its uncleared-holds gate still holds them on their notice chains) and records no hold for them. `racialTraits388.integration` replaces its held control Stonecunning (Dwarf) with Languages (Vanara).

## Family rulings applied

This batch follows the rulings Sol approved for #387 ([racial-traits-387.md](racial-traits-387.md)):

1. **Every in-scope record is held.** The race records stay held (#328), every cited book's notice chain is held, and no book PDFs are available, so each record keeps a whole-content hold. The CRB-cited standard traits (Languages (Half-Elf), Stonecunning (Dwarf)) also cite Inner Sea Races and the Advanced Race Guide; the batch test shows a confirmed Stonecunning stays held on those notices.
2. **Race books.** Every record requires the books its pinned race record cites (curation.md, Race abilities).
3. **Alternate framework.** All 39 alternates record the APG alternate racial trait rule (PZO1115, `apg_abilities_race.lst:86`).
4. **Monster abilities** take the earliest book the pinned Universal Monster Rules page lists: darkvision and all-around vision PZO1127; see in darkness PZO1116; low-light vision, scent, amphibious, natural attacks, light sensitivity, resistance, damage reduction, spell resistance, tremorsense and telepathy PZO1112.
5. **Creature types** (the reptilian, kasatha and aquatic subtypes) stay named unresolved origins.
6. **PZO1131** for Unchained action-cost metadata anywhere in the bound closure: 15 records (11 on their own actions, 13 through bound bodies).
7. **Comparisons.** 34 records have a PCGen row from a cited book as their comparison; Core Essentials rows (no book) are leads. 22 records carry a PRD Advanced Race Guide paragraph (18 word for word). The 13 PRD pages they cite were added to the shared store.
8. **Description pass.** Every in-scope record has a checked description record: its reviewed Modifiers plus the body as an entry-level Note (`@Distance` read as feet, `@Weight` as pounds, `@Condition` as the condition, `@Toggle` lines removed).
9. **Shared Situations** only where the condition matches exactly: fear (Craven), mind-affecting (Stalwart Watcher), poison (Share Knowledge). Xenophobic's fear exception keeps its Situation local.

## Dispositions

| Key                            | Name                                                  | Kind             | Disposition                                                      |
| ------------------------------ | ----------------------------------------------------- | ---------------- | ---------------------------------------------------------------- |
| `pf1-content/38bfb1KFwr3za7kA` | Thunderous Resilience                                 | alternate        | held: `racial-traits-388-whole-content-38bfb1KFwr3za7kA`         |
| `pf1-content/3BX3LlcsJ91SHSaW` | Fearless (Green Martian)                              | standard         | held: `racial-traits-388-whole-content-3BX3LlcsJ91SHSaW`         |
| `pf1-content/3DZDrCBIKjspaS47` | Standard                                              | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/3HbUyHrEVeDiTH1d` | Languages (Half-Elf)                                  | standard         | held: `racial-traits-388-whole-content-3HbUyHrEVeDiTH1d`         |
| `pf1-content/3J3lWu2Lm9aJSNXg` | Reptilian (Nagaji)                                    | standard         | held: `racial-traits-388-whole-content-3J3lWu2Lm9aJSNXg`         |
| `pf1-content/3PzAYj5qRX4uJs3O` | Share Knowledge                                       | alternate        | held: `racial-traits-388-whole-content-3PzAYj5qRX4uJs3O`         |
| `pf1-content/3QD84x1vNvsYqfbr` | Advanced Constitution                                 | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/3RZF7jBAcKGjU8Lc` | Spell-Like Ability (Shabti)                           | standard         | held: `racial-traits-388-whole-content-3RZF7jBAcKGjU8Lc`         |
| `pf1-content/3XixtpyBV5vwGgKd` | Sociable                                              | alternate        | held: `racial-traits-388-whole-content-3XixtpyBV5vwGgKd`         |
| `pf1-content/3Z2cUyMD0Y57p7YO` | Alternate                                             | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/3cpvYmnO0BSmgGwh` | Aquatic Elves                                         | subrace          | held: `racial-traits-388-whole-content-3cpvYmnO0BSmgGwh`         |
| `pf1-content/3dgiIO3A3f0Ml8xt` | Vishkanya                                             | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/3e5TxgPBqVgYqWmQ` | Eye for Opportunity                                   | alternate        | held: `racial-traits-388-whole-content-3e5TxgPBqVgYqWmQ`         |
| `pf1-content/3esx06PLNyon0S0I` | Spell Resistance, Greater                             | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/3gVV8juxNQF8nTYx` | Sensual                                               | alternate        | held: `racial-traits-388-whole-content-3gVV8juxNQF8nTYx`         |
| `pf1-content/3haIOIRYDeFc1YZH` | Archon-Blooded (Lawbringers)                          | subrace          | held: `racial-traits-388-whole-content-3haIOIRYDeFc1YZH`         |
| `pf1-content/3hnHDHLFtNDxJYCp` | Low-Light Vision (Vanara)                             | standard         | held: `racial-traits-388-whole-content-3hnHDHLFtNDxJYCp`         |
| `pf1-content/3j4O8P5rShZBFdtY` | Alternate                                             | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/3o1rw23ElDPjD5FE` | Adoptive Parentage (Skill Focus)                      | alternate        | held: `racial-traits-388-whole-content-3o1rw23ElDPjD5FE`         |
| `pf1-content/3rMyzHeDptW8wAaR` | Monstrous Humanoid                                    | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/3sFVS1F5eFcCUABV` | Pharaonic Will                                        | alternate        | held: `racial-traits-388-whole-content-3sFVS1F5eFcCUABV`         |
| `pf1-content/3tCsYXDaPFsm02UA` | Sure Step (Half-Elf)                                  | alternate        | held: `racial-traits-388-whole-content-3tCsYXDaPFsm02UA`         |
| `pf1-content/3vSL52yi5JvMMdeU` | Subrace Standard                                      | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/3vfffr4tidJuzisG` | Nimble Faller                                         | alternate        | held: `racial-traits-388-whole-content-3vfffr4tidJuzisG`         |
| `pf1-content/3z3EDcQxrBgW8hIu` | Xenophobic                                            | alternate        | held: `racial-traits-388-whole-content-3z3EDcQxrBgW8hIu`         |
| `pf1-content/3zmCFKlW8eB3B9B9` | Half-Construct                                        | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/42xBVIOgC8pa5RyR` | Ferocity                                              | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/44BPe30qTi4504PW` | Scent                                                 | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/45JT6jtMXWs5Dald` | Grabbing Appendages                                   | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/45xNKgDQ3SvKpW58` | Craven                                                | alternate        | held: `racial-traits-388-whole-content-45xNKgDQ3SvKpW58`         |
| `pf1-content/48atSTzun3LaxtWe` | Acquisitive                                           | alternate        | held: `racial-traits-388-whole-content-48atSTzun3LaxtWe`         |
| `pf1-content/4EnFrSO7n6EO5fxO` | Delicious                                             | standard         | held: `racial-traits-388-whole-content-4EnFrSO7n6EO5fxO`         |
| `pf1-content/4FwBwy4DCsyVzEzI` | Dreamspeaker                                          | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/4G4E4KbCE45gMnhL` | Siege Survivor                                        | alternate        | held: `racial-traits-388-whole-content-4G4E4KbCE45gMnhL`         |
| `pf1-content/4LypGODo155PBk96` | Plantspeech                                           | standard         | held: `racial-traits-388-whole-content-4LypGODo155PBk96`         |
| `pf1-content/4MyvbEuO6QOS28bR` | Ability Modifiers (Changeling - Waker May)            | subrace standard | held: `racial-traits-388-whole-content-4MyvbEuO6QOS28bR`         |
| `pf1-content/4NSgjZqYScI33X8K` | Subraces                                              | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/4OV6db7IrcSr0odh` | Alternate                                             | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/4UEQHzt67Dp4FIhc` | Normal Speed (Goblin)                                 | standard         | held: `racial-traits-388-whole-content-4UEQHzt67Dp4FIhc`         |
| `pf1-content/4UPvvBKe9UXgCLj2` | Unnatural                                             | alternate        | held: `racial-traits-388-whole-content-4UPvvBKe9UXgCLj2`         |
| `pf1-content/4Uxg5Lm3DxKHb9wn` | Standard                                              | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/4VSNnpW9YGpm4xC0` | Oread                                                 | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/4XBCUrlQKhc9tVi0` | Low-Light Vision (Orang-Pendak)                       | standard         | held: `racial-traits-388-whole-content-4XBCUrlQKhc9tVi0`         |
| `pf1-content/4YSG4vJPoip8XFRd` | Greed (Wyvaran)                                       | alternate        | held: `racial-traits-388-whole-content-4YSG4vJPoip8XFRd`         |
| `pf1-content/4ZedJI3dIy2S7RCU` | Exotic Weapon Training                                | alternate        | held: `racial-traits-388-whole-content-4ZedJI3dIy2S7RCU`         |
| `pf1-content/4eZSNsHGXAwZm4dk` | Experimental Body: Scorched                           | alternate        | held: `racial-traits-388-whole-content-4eZSNsHGXAwZm4dk`         |
| `pf1-content/4hngB1Dheo1oKAK2` | Carrion Sense                                         | alternate        | held: `racial-traits-388-whole-content-4hngB1Dheo1oKAK2`         |
| `pf1-content/4hyGfPUOr8BiIZH2` | Hardy                                                 | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/4krEstETNnsuTsCl` | Languages (Vanara)                                    | standard         | held: `racial-traits-388-whole-content-4krEstETNnsuTsCl`         |
| `pf1-content/4m3vBWg6qo6oNpAf` | Shade Magic                                           | alternate        | held: `racial-traits-388-whole-content-4m3vBWg6qo6oNpAf`         |
| `pf1-content/4mraNuLbTgXENeoV` | Monkey Goblin                                         | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/4oBIdiWGwsIqgHJW` | Deep Jungle                                           | alternate        | held: `racial-traits-388-whole-content-4oBIdiWGwsIqgHJW`         |
| `pf1-content/4qveM7bUNizrOvka` | Divided Attention                                     | alternate        | held: `racial-traits-388-whole-content-4qveM7bUNizrOvka`         |
| `pf1-content/4rlpda5ZIGArGsiY` | Slave Born                                            | subrace          | held: `racial-traits-388-whole-content-4rlpda5ZIGArGsiY`         |
| `pf1-content/4sqgRGhlx1KPagLI` | Tongue of the Sea                                     | alternate        | held: `racial-traits-388-whole-content-4sqgRGhlx1KPagLI`         |
| `pf1-content/4tT7hExEjO6bLoDC` | Nereid Fascination (Undine)                           | alternate        | held: `racial-traits-388-whole-content-4tT7hExEjO6bLoDC`         |
| `pf1-content/4tq1PgGZzIsYSVkH` | Experimental Body: Enchanted                          | alternate        | held: `racial-traits-388-whole-content-4tq1PgGZzIsYSVkH`         |
| `pf1-content/4yq4e33DdCjnLDFT` | Stalwart Watcher                                      | alternate        | held: `racial-traits-388-whole-content-4yq4e33DdCjnLDFT`         |
| `pf1-content/539xDsN3QbslLsz8` | Darkvision (Undine)                                   | standard         | held: `racial-traits-388-whole-content-539xDsN3QbslLsz8`         |
| `pf1-content/59KDrhHa6MuC4Rev` | Arena-Bred                                            | subrace          | held: `racial-traits-388-whole-content-59KDrhHa6MuC4Rev`         |
| `pf1-content/5D8qTCeINYsd7lFp` | Frightener                                            | alternate        | held: `racial-traits-388-whole-content-5D8qTCeINYsd7lFp`         |
| `pf1-content/5FoiVQ9OY4UMIE1I` | Languages (Android)                                   | standard         | held: `racial-traits-388-whole-content-5FoiVQ9OY4UMIE1I`         |
| `pf1-content/5GahxXf5d4aAosVh` | Shadowhunter (Half-Elf)                               | alternate        | held: `racial-traits-388-whole-content-5GahxXf5d4aAosVh`         |
| `pf1-content/5JT4Frvc6yDSM99X` | Stability (Duergar)                                   | standard         | held: `racial-traits-388-whole-content-5JT4Frvc6yDSM99X`         |
| `pf1-content/5Pf9onFX3srkyard` | Integrated                                            | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/5VyX82W0Q16bkypr` | Kasatha                                               | standard         | held: `racial-traits-388-whole-content-5VyX82W0Q16bkypr`         |
| `pf1-content/5YDsKDGSzLMoH1dv` | Variant Tiefling Abilities                            | alternate        | held: `racial-traits-388-whole-content-5YDsKDGSzLMoH1dv`         |
| `pf1-content/5a4cHF6UEIcKge9j` | Fey Magic (Gnome - HotW)                              | alternate        | held: `racial-traits-388-whole-content-5a4cHF6UEIcKge9j`         |
| `pf1-content/5aAT2BdFhvV4ukc2` | Death Throes                                          | standard         | held: `racial-traits-388-whole-content-5aAT2BdFhvV4ukc2`         |
| `pf1-content/5kZIEbynbijiGYTn` | Greed                                                 | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/5lsAtsSAJ25y69ST` | Vampiric Empathy                                      | alternate        | held: `racial-traits-388-whole-content-5lsAtsSAJ25y69ST`         |
| `pf1-content/5sk6uZ73lZRbwWWZ` | Taskmaster                                            | alternate        | held: `racial-traits-388-whole-content-5sk6uZ73lZRbwWWZ`         |
| `pf1-content/5vCAwHAD1BICLt1d` | Reach                                                 | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/65qkbJnrIWRphU3Q` | Climber                                               | standard         | held: `racial-traits-388-whole-content-65qkbJnrIWRphU3Q`         |
| `pf1-content/67AX54HYIzwc8xC5` | Emissary                                              | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/6922em9qimkrOqPG` | Ancestral Arms                                        | alternate        | held: `racial-traits-388-whole-content-6922em9qimkrOqPG`         |
| `pf1-content/6AA4khYton1MWeXO` | Alternate Spell-Like Ability (Skinwalker - Fanglord)  | subrace standard | held: `racial-traits-388-whole-content-6AA4khYton1MWeXO`         |
| `pf1-content/6BfXi2cAz6NupBHm` | Giant Ancestry                                        | alternate        | held: `racial-traits-388-whole-content-6BfXi2cAz6NupBHm`         |
| `pf1-content/6DFp3gbxSJ3e8Slt` | Cave Crawler                                          | alternate        | held: `racial-traits-388-whole-content-6DFp3gbxSJ3e8Slt`         |
| `pf1-content/6F7yKc2ohf4Qw3lo` | Boundary Walker                                       | alternate        | held: `racial-traits-388-whole-content-6F7yKc2ohf4Qw3lo`         |
| `pf1-content/6JCG0ei0s0ossrtx` | Stonecunning (Dwarf)                                  | standard         | held: `racial-traits-388-whole-content-6JCG0ei0s0ossrtx`         |
| `pf1-content/6KO6a0MXHwYeUpLn` | Market Dweller                                        | alternate        | held: `racial-traits-388-whole-content-6KO6a0MXHwYeUpLn`         |
| `pf1-content/6NCgYBE5gSmI5O6K` | Human-Raised (Half-Elf)                               | subrace          | held: `racial-traits-388-whole-content-6NCgYBE5gSmI5O6K`         |
| `pf1-content/6OY5h900pP7EN2eX` | Size                                                  | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/6UseFxKxt2Ax4l2O` | Elven Magic                                           | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/6WC8EhYUUZEhNT8t` | Forest Walker (Half-Orc)                              | alternate        | held: `racial-traits-388-whole-content-6WC8EhYUUZEhNT8t`         |
| `pf1-content/6am3c1HIosN3E6vk` | Half-Undead                                           | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/6bm6Fe3jqhiVoURA` | Darkvision (Ganzi)                                    | standard         | held: `racial-traits-388-whole-content-6bm6Fe3jqhiVoURA`         |
| `pf1-content/6d96mOZtn3WCCN1A` | Surface Survivalist                                   | alternate        | held: `racial-traits-388-whole-content-6d96mOZtn3WCCN1A`         |
| `pf1-content/6eYkzFOhZc6mL1Sc` | Alternate Spell-Like Ability (Skinwalker - Aerieborn) | subrace standard | held: `racial-traits-388-whole-content-6eYkzFOhZc6mL1Sc`         |
| `pf1-content/6jqXMlYzrcoMyHde` | Light Sensitivity (Kobold)                            | standard         | held: `racial-traits-388-whole-content-6jqXMlYzrcoMyHde`         |
| `pf1-content/6oTxfx1zD9qb1TbI` | Amphibious (Adaro)                                    | standard         | held: `racial-traits-388-whole-content-6oTxfx1zD9qb1TbI`         |
| `pf1-content/6tmkzGAbCFuUIclP` | Plant                                                 | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/6yUgkL8nRaoWTl41` | Ability Score Modifiers (Kitsune)                     | standard         | held: `racial-traits-388-whole-content-6yUgkL8nRaoWTl41`         |
| `pf1-content/70vPWRmINBsSQ90K` | Kobold                                                | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/748xpeIEFeiucTjV` | Fiendish Sorcery                                      | standard         | held: `racial-traits-388-whole-content-748xpeIEFeiucTjV`         |
| `pf1-content/75LOlnGJh2e6OAZc` | Alternate Spell-Like Ability (Skinwalker - Coldborn)  | subrace standard | held: `racial-traits-388-whole-content-75LOlnGJh2e6OAZc`         |
| `pf1-content/79Bq0RavQyZx0IPA` | Cannibalistic Vitality                                | standard         | held: `racial-traits-388-whole-content-79Bq0RavQyZx0IPA`         |
| `pf1-content/7B9RkslHip58EzP8` | Ocean's Daughter                                      | alternate        | held: `racial-traits-388-whole-content-7B9RkslHip58EzP8`         |
| `pf1-content/7BVIiJLxMcXsI6IF` | Alternate                                             | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |

## Notable cases

- **Archon-Blooded (Lawbringers)** is the third of the 37 `reviewedAbilityLineSubraces` curated with its ability line (+2 Con, +2 Wis, racial), after #387's Rimesoul and Div-Spawn. Its curated Modifiers make "Base Statistics" resolve to `local/race-ability-scores/pf1/FHY3oIk5zSOFncJH` (curated Modifiers triggering a replacement; a heritage resolving to a `local/` trait). The resolver test and the saved-sheet test show the aasimar's +2 Wis, +2 Cha going dormant and coming back.
- **Stonecunning (Dwarf)'s uncovered note** (one of the four the #387 notes list; counted once here). Its checked record carries exactly the outputs of the Dwarf race's #328 `skill.per` note record (+2 untyped Perception to notice unusual stonework, and the passive-check Note), which it supersedes, so the bonus counts once, on the trait. The race record is now reported stale in a full import. It stays in the overlay, as #387's two Orang-Pendak records do: a race-only import (the #328 fixture) still requires it for the race's own note, so removing it is a follow-up (curation.md, Record contract).
- **Delicious (Ghoran)** is a latent overlap, like #387's Own Two Feet: the Ghoran race's #328 description record already supplies the −2 combat maneuver Modifier and the Escape Artist Situation Note on the race entry, so Delicious's two notes are covered/no-output. Moving them onto the trait needs a reviewed description re-home (`reviewedDescriptionRehomes`), reported as a gap.
- **Race-covered notes.** Fearless (Green Martian) and Stability (Duergar) have no required record (`coveredTraitNotes`); their bonuses are the race's re-homed Modifiers.
- **Cited-source conflicts (named holds).** Divided Attention cites PZO9466 p.212, a page Blood of Shadows does not reach, while PCGen files the identical body under Inner Sea Races p.212. Exotic Weapon Training cites PZO9280 p.163, while PCGen and the PRD give the identical body as the ARG p.163 tengu trait. The rows are recorded as leads; their books are not required from them; the origin stays a named hold.
- **Third-party record.** Fearless (Green Martian) cites only DYN0032-E (Worldscape #2, Dynamite); the admission gate holds it on the existing Dynamite comics hold (#227/#241) before its own.
- **Imported bonus types against the text** (listed for review, as #370 did): Craven's initiative change is typed racial (the body says "a +1 bonus"); Ocean's Daughter's Swim change is typed racial (the body says "a +1 trait bonus"). A change replacement replaces only the formula.
- **Variant Tiefling Abilities**' d% table (9,777 characters) is split at table rows into three Notes; no result is applied.
- **Curated where the raw data doesn't map:** Sensual's +2 on one Perform skill (the raw change has no target), Acquisitive's +4 hoard total (racial bonuses on one entry don't stack, so the Situation raises the total), Unnatural's −4 on the seven Charisma-based skills, Frightener's fear-descriptor DC (a local Situation: conditions name schools, not descriptors).
- **Not modeled, listed:** senses, speeds, spell-like abilities, languages, class-skill grants, bonus feats (Adoptive Parentage, Ancestral Arms, Siege Survivor), weapon proficiency choices (Exotic Weapon Training, Deep Jungle's blowgun), spell resistance and energy resistance.

## Importer and data gaps

- **Unresolved replaced names (own entry; neither #738 nor #739):** Cave Crawler ("Fast Movement": the goblin's speed trait is Normal Speed (Goblin)) and Ocean's Daughter ("Sea Lungs": no changeling record has that name). The racial subtypes and the aquatic elf ethnicity keep "Base Statistics" unmatched, as designed.
- **Drafter target mapping (own entry):** the drafter maps Foundry's `conChecks` (Constitution checks) to `concentration` (Amphibious (Adaro)); the reviewed Note is entry-level.
- **Foundry note paraphrases** that differ from the body (Carrion Sense 25% for 50%, Ocean's Daughter "from exhaustion", Boundary Walker Hit Dice for character level): the reviewed Notes follow the body.
- **Ownerless race output:** the Ghoran's Delicious penalties stay on the race until a reviewed description re-home moves them.
- The raw upstream keys in `mapRacialTrait` caused no reference failure: the full preview has no failure for any batch key. The bounded preview's 47 reference failures are links and replacements outside the selection.
- No linked pf-items record is missing. There is no Orc Atavism, no replacement of a counts-as trait and no multi-race "Base Statistics" folder in this batch.

## Outstanding mechanics

Each record lists its calculation gaps in `mechanicsReview.outstandingCalculations`; none is an attribution hold. The main ones are senses, speeds, spell-like abilities and supernatural actions, languages, bonus feats and weapon proficiency choices, spell and energy resistance, Variant Tiefling Abilities' table results, and Delicious's penalties on the race entry.

## Cross-batch bindings and protected records

- **Re-bound (#756), on the rebased tree (`a1fc7966`, after #387 and #389):** ten landed assessments whose full-corpus closure covers a batch key. Each fixture copy was updated, each inventory's `currentBinding` too where the batch records one, and every fixture-based binding agrees with the full-corpus one.
  - #524 Fey Boon (`pf1/JYgzYISWlo5CQQg3`, covers Stonecunning (Dwarf) through the Dwarf race): `b3b04e7f…` (as #387 left it) → `de980657…`; the Stonecunning entry in `tests/fixtures/spells-524/binding-preview.json` is #524's own re-import (equal to the full preview's). #524's inventory records no `currentBinding`.
  - #367 Nanite Revival (Android) (`pf1-content/1mbmoRuwMNs86gAg`, covers Languages (Android)): `e2008a9a…` → `e0e9ca61…`; `tests/fixtures/traits-367/preview.json` and `traits-367.json`.
  - #371 Carnation Scales (Kobold) (`pf1-content/ByCw1feEKg0UfrDC`, covers Light Sensitivity (Kobold)): `7e3c0467…` → `aa2e9b8c…`; `tests/fixtures/traits-371/preview.json` and `traits-371.json`.
  - #387, in `tests/fixtures/racial-traits-387/preview.json` (three closure copies) and `racial-traits-387.json`: Rimesoul (Frost Undine) `d105cb0e…` → `fc7d9004…` and Deepsight `8e6289fd…` → `91990fc6…` (Darkvision (Undine)); Div-Spawn (Spitespawn) `f6a92a39…` → `62455a14…` and Smite Good `548f2241…` → `5dcd7b0c…` (Fiendish Sorcery); Conservative Diplomacy `c9f95e96…` → `7ea7b6b8…` and Sense Aberration `ed6bf686…` → `9254af52…` (Stonecunning (Dwarf)).
  - #389 Feral (`pf1-content/7JHnhD96PeWEnf7U`, covers Forest Walker (Half-Orc)): `89e21235…` → `1720b16f…`; `tests/fixtures/racial-traits-389/preview.json` and `racial-traits-389.json`.
- **This batch's own bindings** were re-bound on the rebased tree, so the closures that reach #387 and #389 keys (Keen Senses (Half-Elf), Armor (Kobold), Greed (Dwarf), Darkvision (Dwarf) for Surface Survivalist) bind their curated entries.
- **Already stale, not re-bound:** 22 #328 race assessments and #331's Tail Terror also reach batch keys, but their bindings were already stale on the base (the deferred stale set, curation.md).
- **Superseded #328 record:** the Dwarf race's `skill.per` note record (see Notable cases) stays and is reported stale; #328's rows are unchanged.
- **#719 test:** `tests/catalog/racial-traits-719.test.ts` asserted the pre-#388 overlay: Craven contributing nothing to fear saves (now its own −2), Stonecunning's note left uncovered and no stale record. Those cases now assert the curated values and name the one superseded Dwarf record; the uncovered-note rule is rebuilt in the test without Stonecunning's record. Delicious is covered/no-output precisely so the test's Ghoran totals (traits never change a race's totals) keep holding.

## Binding

Every assessment is bound with `buildAssessmentBinding` against the full-corpus content closure: the final full `catalog:preview` artifact, with the batch's 71 entries and their 91 closure entries. The [preview fixture](../../tests/fixtures/racial-traits-388/preview.json) keeps both, so the batch test rebuilds every binding from a clean shared-store tree (0 mismatches).

## Tests

The [resolver tests](../../tests/catalog/racial-traits-388.test.ts) pin the reviewed values through the public resolver (Archon-Blooded's replacement against the aasimar sheet, every Situation-gated bonus off by default and on when selected, the shared Situations, Acquisitive's total, imported changes not curated twice, the race-supplied bonuses, no `ac.other` armor, shield or natural armor bonus); all 51 required and 71 description records checked, the six covered/no-output records, the split table and enrichers; the race, alternate, monster-ability, linked, third-party and Unchained notice dependencies (the 15 PZO1131 keys, own action versus bound body), the creature-type and cited-source origins and the enforced holds; the importer's reading and exact unresolved names; every pinned body, literal PCGen row and PRD paragraph in the shared store; and the clean-tree re-extraction with every binding reproduced.

The [isolated saved-sheet test](../../tests/catalog/racialTraits388.integration.test.ts) exercises public Convex reads and writes: an Aasimar takes the held Archon-Blooded heritage (the ability score trait goes dormant) and turns it off again, with saved totals equal to the preview; outsiders, anonymous callers and another campaign's entry are refused. The shared held-release round trip is covered once by the release test in [`traits367.integration.test.ts`](../../tests/catalog/traits367.integration.test.ts). No deployment or production activation occurred.

## Preservation and gates

The shared canonical files gain only this batch's entries: 122 curation records (71 description and 51 note records), 71 assessments, 71 evidence entries and 36 notice holds. The other changes are the listed re-binds and fixture entries and the #719 test. Shared-file diff stat as curated on `9974c36c` (`git diff --stat --diff-algorithm=histogram`; the rebased change adds the #387 and #389 re-binds above):

```text
 scripts/catalog/legal/held-notices.json           |  342 +++
 scripts/catalog/legal/traits-367.json             |    2 +-
 scripts/catalog/legal/traits-371.json             |    2 +-
 scripts/catalog/reviewed-curation.json            | 2555 +++++++++++++++++++++
 src/lib/catalog/data/attribution-assessments.json | 1696 +++++++++++++-
 src/lib/catalog/data/attribution-evidence.json    |  213 ++
 tests/catalog/racial-traits-719.test.ts           |   73 +-
 tests/fixtures/spells-524/binding-preview.json    |   14 +-
 tests/fixtures/traits-367/preview.json            |    5 +
 tests/fixtures/traits-371/preview.json            |   22 +-
 10 files changed, 4882 insertions(+), 42 deletions(-)
```

<!-- prep:shared-store-count -->

New shared-store files (`tests/fixtures/pinned/`), counted by prep after the rebase onto `a1fc7966`: **145** (pcgen 6, pf1 15, pf1-content 123, prd 1).

<!-- /prep:shared-store-count -->

The batch adds to the shared store its 100 pinned records, the pf-racial-traits folder records above them, the pinned race records they bind to, the linked bodies (spells, racial traits, Poison Use and the Rage (Spell) buff), the PCGen race-ability and anchor files the evidence cites, and 13 PRD capture pages. As curated on `9974c36c` that is 286 files (pcgen 21, pf1 41, pf1-content 211, prd 13); 108 of them are byte-identical to files #387 added, which reuses them after the rebase.

The complete preview reported **86 admitted, 23,168 held, 2 dependent omissions and 2,663 failures** (on `9974c36c`): 51 fewer than the base's 2,714, this batch's required note records. On the rebased tree (`a1fc7966`) it reports 2,596 failures, none for a batch key. The full-corpus gate is therefore a documented failure, not a claim of whole-corpus readiness.

| Command                                                                                                                                                                                                                                                                                                                               | Result                                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `catalog:curate --candidates …` (required) and `--descriptions` (prose pass)                                                                                                                                                                                                                                                          | pass; 51 required drafts, 26 prose drafts                                                                                                                                |
| `catalog:preview --candidates …`                                                                                                                                                                                                                                                                                                      | exit 1; 0 admitted / 24 held / 47 failures: links and replacements outside the selection (the full preview has none for this batch)                                      |
| Full `catalog:curate`                                                                                                                                                                                                                                                                                                                 | pass; 1,557 new drafts, none for this batch; 0 missing; the superseded Dwarf `skill.per` race note record reported stale; about 2.5 min after a 23 min memory queue      |
| Full `catalog:preview`                                                                                                                                                                                                                                                                                                                | exit 1; 2,663 failures, none for this batch; about 4.5 min                                                                                                               |
| Full re-bind (`buildAssessmentBinding` over the final full preview)                                                                                                                                                                                                                                                                   | inventory, assessments and preview fixture reproduced; 0 mismatches against the clean-tree reconstruction; the three landed re-binds agree with their fixtures           |
| `pnpm test` on the batch tests, the guards (`notice-holds`, `pinned-sources`, `cross-batch-bindings`, `ac-other-defense-bonuses`, `batch-ownership-sweep`) and the affected earlier tests (`spells-524`, `traits-367`, `traits-371`, `feats-355`, `racial-traits-719`, `race-facts-720`, `race-ability-721`, `races-328`), one worker | 15 files / 474 tests; the only failures were the #719 expectations listed above, fixed and re-run (`racial-traits-719` and `racial-traits-388`: 2 files / 70 tests pass) |
| `pnpm -s typecheck`                                                                                                                                                                                                                                                                                                                   | pass                                                                                                                                                                     |
| `pnpm -s lint`                                                                                                                                                                                                                                                                                                                        | pass                                                                                                                                                                     |
| `pnpm -s check:initial-migration-writers`                                                                                                                                                                                                                                                                                             | pass; 185 registrations                                                                                                                                                  |
| `pnpm catalog:pin`                                                                                                                                                                                                                                                                                                                    | pass; `sha256:005ef0b9…`                                                                                                                                                 |
| `pnpm catalog:notice-deps`                                                                                                                                                                                                                                                                                                            | pass; 0 gaps; 38 advisory warnings, none for this batch                                                                                                                  |
| `pnpm catalog:format --check`                                                                                                                                                                                                                                                                                                         | pass                                                                                                                                                                     |

`pnpm test tests/catalog` was left to the orchestrator's prep run on the rebased commit, as the brief directs.
