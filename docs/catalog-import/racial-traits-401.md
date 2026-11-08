# Racial traits #401: pf1-content pf-racial-traits batch 15

Reviewed by **Opus (AI curator) for the owner**, 2026-10-21.

Exactly the issue's 100 ordered, unique keys were reviewed: **0 admitted, 75 specifically held, 0 dependent omissions, 0 whole-entry unsupported/prose-only dispositions, 25 exclusions, 0 record-level 3.5 holds**. The exclusions are 11 Foundry `!folders!` records, which the importer's folder contract leaves out of the Catalog Entries (PRD Decision 17), and 14 records in the Advanced Race Guide Race Builder subtree, which the import contract excludes by folder ancestry ([README](README.md), explicit exclusions) and the [Racial Trait contract](../character-sheet/racial-traits.md) puts out of scope. No candidate carries a `3.5` tag. The 75 in-scope records are 23 standard racial traits (3 of them in flat race folders), 38 alternates (Oppressive among them: a flat Syrinx-folder record with a "Replaced Trait(s)" header, read as an alternate), 8 Subrace Standard heritage parts and 6 Subraces-folder heritages or racial subtypes.

The [machine-readable inventory and evidence](../../scripts/catalog/legal/racial-traits-401.json) records, per key, the complete pinned body and inert fields with their source hash and cited sources; the PCGen race-ability rows, PRD Advanced Race Guide paragraphs, leads and rejected rows; the inherited-rule notices with their evidence, the linked bodies and the unresolved origins; the importer's reading of race, standard flag and replacements; every checked curation record, source discrepancies and calculation gaps; and the current assessment binding and mapped facts. This report summarizes them and does not repeat the evidence.

## #328 S4-B launch update

Reviewed 2026-11-01 by **Sol (AI curator) for the owner** ([races-328.md](races-328.md#s4-b-launch-half-elf-elf-gnome-and-halfling)). The S4-B launch review confirms 1 standard racial trait of Half-Elf, Elf, Gnome and Halfling with content-bound assessments; counts are now **1 admitted, 74 held**, with 25 exclusions unchanged. The earlier Opus review of each row stays in its `assessmentHistory`; every other candidate keeps its review and holds.

- **Weapon Familiarity (Gnome)** (`pf1-content/mPD0yR9P3IGAC6nJ`): matches the PRD ARG paragraph (`advancedRaceGuide/coreRaces/gnomes.html:376`) word for word; PCGen's Core Essentials row (`gnome/gnome_abilities_race.lst:28`) word for word. No Modifier or Proficiency: the body grants none. Required notices: PZO9280, PZO1121, PZO1110. Outstanding: Treating weapons with "gnome" in their name as martial weapons stays prose (#740).

Each row's whole-content hold ("Book PDFs unavailable") is superseded by this comparison, and it records no notice hold: PZO1110 is reviewed, PZO1121's Registry hold and `racial-traits-401-notice-PZO1121-complete-chain` are cleared (`notice-clearances.json`, owner 2026-10-30), and PZO9280's reviewed confirmation waives `racial-traits-401-notice-PZO9280-complete-chain`. The batch's `noticeRequirements` rows keep these keys as history. Content fingerprints are unchanged (the imported entries are identical); only the status, rationale, evidence and notice bindings move.

Tests: `racial-traits-401.test.ts` checks the confirmed rows with the held ones (`assessedTraits` in the fixture), expects them admitted by the committed gate and records no hold for them. The uncleared-holds control moves from the admitted Weapon Familiarity (Gnome) to Orc.

## Family rulings applied

This batch follows the #387 rulings Sol approved for the family:

1. **Every in-scope record is held** with a whole-content hold: the race records stay held (#328), every cited book's notice chain is held (36 batch notice holds, registered in `held-notices.json`, among them `racial-traits-401-notice-primitive-human-blog-complete-chain` for the Paizo blog source of Frightened by Magic, as #389, #399 and #400 held it), and no book PDFs are available. Skill Training (Green Martian) is also held on the source-matched Dynamite comics hold.
2. **Race abilities.** Every record requires the books its pinned race record cites.
3. **Alternate framework.** Every alternate records the APG alternate racial trait rule (PZO1115, `apg_abilities_race.lst:86`).
4. **Monster abilities** take the earliest book the pinned Universal Monster Rules page lists: darkvision PZO1127; low-light vision, scent, natural attacks, damage reduction (Pain Tolerance) and gaze (Dead Eyes) PZO1112; see in darkness (Weretiger-Kin) PZO1116.
5. **Creature types** (the orc, aquatic, human, native, elf, dwarf and dragon types and subtypes) stay named unresolved origins.
6. **PZO1131** for Unchained action-cost metadata anywhere in the bound closure: 29 records (13 on their own actions, 22 through bound bodies, 6 both). The four curated heritages reach their race's standard traits through the race's ability score trait; the half-orc alternates that replace orc ferocity (Beastmaster, Bestial, Hatred, Pain Tolerance, Plagueborn, Projection) reach its action, and the other bound records reach Unchained metadata through the traits they replace or link (such as the aasimar's, ifrit's and drow's spell-like abilities).
7. **Comparisons.** PCGen race-ability rows from a pinned book the record cites are the `comparison` (35 records); Core Essentials support rows (no SOURCELONG book) are leads whose book is not required; the half-orc's and hobgoblin's rows for the orc's and goblin's darkvision and languages, the heritage parts' parent rows, the Legacy of the First World sticky tendrils speed row and the Inner Sea Races beast talker change shape row are rejected rows; 13 records have no PCGen row, lead or PRD paragraph and say so as a named root hold. 17 records carry a PRD `prdComparison` from the pinned capture (12 match word for word). Subrace Standard parts take no PRD paragraph. Where the pinned body follows the APG wording (Beastmaster) the APG row is the comparison and the ARG row a lead; where it follows the ARG (Magical Linguist, Bestial, Heart of the Wilderness, Heart of the Fields) the reverse. Tangling Tentacles' Bestiary 2 monster-ability row is a lead whose book the record does not cite and does not require.
8. **Description pass.** Every in-scope record has a checked description record: its reviewed Modifiers plus an entry-level Note with the body (`@Distance` read as feet, "N-foot" before "racial bonus", `@Toggle` controls and "Related buff" lines removed). No body exceeds 4,096 characters.
9. **Racial bonuses from distinct Sources stack**: the resolver test shows Jungle Stalker's and Plumekith's +2 racial Acrobatics giving +4 together. The #735 admission policies don't bear on this batch (no spells or CRB feats).

## Dispositions

| Key                            | Name                                                 | Kind             | Disposition                                                      |
| ------------------------------ | ---------------------------------------------------- | ---------------- | ---------------------------------------------------------------- |
| `pf1-content/kwKfKfG5vVc0rrRd` | Fire in the Blood                                    | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/kzJsHq7Ar918kvOw` | Duergar Immunities                                   | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/l2VaAn7tTKcac2xZ` | Urban Memories                                       | alternate        | held: `racial-traits-401-whole-content-l2VaAn7tTKcac2xZ`         |
| `pf1-content/l3nc7GFcj5yKPNlS` | Darklands Guide (Half-Elf)                           | alternate        | held: `racial-traits-401-whole-content-l3nc7GFcj5yKPNlS`         |
| `pf1-content/l7CqdrmNxsmEsBBG` | Orc                                                  | standard         | held: `racial-traits-401-whole-content-l7CqdrmNxsmEsBBG`         |
| `pf1-content/lBS1mSrNfigoro8L` | Thinblood Resistance                                 | alternate        | held: `racial-traits-401-whole-content-lBS1mSrNfigoro8L`         |
| `pf1-content/lGtOuDb5QxTmJ4OW` | Standard                                             | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/lL4OLlxglFqgdSZu` | Astomoi                                              | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/lNkG5OnOXSt64aEY` | Dusksight (Half-Orc)                                 | alternate        | held: `racial-traits-401-whole-content-lNkG5OnOXSt64aEY`         |
| `pf1-content/lTBjKajyJWEfK2nA` | Skulker                                              | alternate        | held: `racial-traits-401-whole-content-lTBjKajyJWEfK2nA`         |
| `pf1-content/lUqi7xK2vxQvAnTX` | Child of the Sea                                     | alternate        | held: `racial-traits-401-whole-content-lUqi7xK2vxQvAnTX`         |
| `pf1-content/lWQAddC6GTZXQbIx` | Standard                                             | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/lcgrEdEWJvVEU4Ii` | Darkvision (Shabti)                                  | standard         | held: `racial-traits-401-whole-content-lcgrEdEWJvVEU4Ii`         |
| `pf1-content/leUhvuim6HknT0fn` | Mostly Human (Ifrit)                                 | alternate        | held: `racial-traits-401-whole-content-leUhvuim6HknT0fn`         |
| `pf1-content/lea9JOFyO8bGiD0v` | Alternate Skill Modifiers (Dhampir - Ru-Shi)         | subrace standard | held: `racial-traits-401-whole-content-lea9JOFyO8bGiD0v`         |
| `pf1-content/lf3okrZiPzE3W4zj` | Crusading Magic                                      | alternate        | held: `racial-traits-401-whole-content-lf3okrZiPzE3W4zj`         |
| `pf1-content/lg9gbMhma1yFcUxR` | Languages (Vishkanya)                                | standard         | held: `racial-traits-401-whole-content-lg9gbMhma1yFcUxR`         |
| `pf1-content/lhDGN1bu2IsaabX4` | Normal Speed (Gathlain)                              | standard         | held: `racial-traits-401-whole-content-lhDGN1bu2IsaabX4`         |
| `pf1-content/lhZkqVMbX0RfVTj0` | Jungle Stalker                                       | alternate        | held: `racial-traits-401-whole-content-lhZkqVMbX0RfVTj0`         |
| `pf1-content/ljJ0jMjxTVcfOiJ3` | Tangling Tentacles                                   | standard         | held: `racial-traits-401-whole-content-ljJ0jMjxTVcfOiJ3`         |
| `pf1-content/ljPIg07fyYZyCaMn` | Jumper                                               | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/lk84xweDXJrZvoq4` | Curosity                                             | alternate        | held: `racial-traits-401-whole-content-lk84xweDXJrZvoq4`         |
| `pf1-content/lmjkMFGLqqAjHE0g` | Squalid                                              | alternate        | held: `racial-traits-401-whole-content-lmjkMFGLqqAjHE0g`         |
| `pf1-content/lnahx05blmymRHUA` | Stalker                                              | alternate        | held: `racial-traits-401-whole-content-lnahx05blmymRHUA`         |
| `pf1-content/lqFhyqE7frSbHfEA` | Magical Linguist (Gnome)                             | alternate        | held: `racial-traits-401-whole-content-lqFhyqE7frSbHfEA`         |
| `pf1-content/lrZtYK3baHZY6JnK` | Skilled (Tiefling - Hellspawn)                       | subrace standard | held: `racial-traits-401-whole-content-lrZtYK3baHZY6JnK`         |
| `pf1-content/ls4DBb0m4J086nVI` | Standard                                             | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/luTbBy7qnmgPBslD` | Medium                                               | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/lvV61h2tNXC2KqQF` | Skill Training                                       | standard         | held: `racial-traits-401-whole-content-lvV61h2tNXC2KqQF`         |
| `pf1-content/lwZTXQ8zz2awYQh9` | Pain Tolerance                                       | alternate        | held: `racial-traits-401-whole-content-lwZTXQ8zz2awYQh9`         |
| `pf1-content/lwgS9uNbbbpTvyVP` | Urbanite                                             | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/lxy3jlEeL5CozHqr` | Gregarious                                           | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/m3HLD2cA05cDMdNf` | Frightened by Magic                                  | standard         | held: `racial-traits-401-whole-content-m3HLD2cA05cDMdNf`         |
| `pf1-content/m3MNeFYo6ZHhEq1Q` | Gillman                                              | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/m6anXBE7DQrCaNPS` | Change Shape (Skinwalker - Ragebred)                 | subrace standard | held: `racial-traits-401-whole-content-m6anXBE7DQrCaNPS`         |
| `pf1-content/mBfn8hCLwEsAxlnl` | Werebat-Kin (Bloodmarked)                            | subrace          | held: `racial-traits-401-whole-content-mBfn8hCLwEsAxlnl`         |
| `pf1-content/mCQvy9sQgS937eTg` | Languages (Skinwalker)                               | standard         | held: `racial-traits-401-whole-content-mCQvy9sQgS937eTg`         |
| `pf1-content/mDDre98oyYIFLJy5` | Alternate Skill Modifiers (Skinwalker - Bloodmarked) | subrace standard | held: `racial-traits-401-whole-content-mDDre98oyYIFLJy5`         |
| `pf1-content/mEpFXnHR6usjAvNK` | Low-Light Vision (Locathah)                          | standard         | held: `racial-traits-401-whole-content-mEpFXnHR6usjAvNK`         |
| `pf1-content/mH8xEPH9wXFCmIgM` | Beastmaster                                          | alternate        | held: `racial-traits-401-whole-content-mH8xEPH9wXFCmIgM`         |
| `pf1-content/mIoJHEWhujpANeaM` | Luckbringer                                          | alternate        | held: `racial-traits-401-whole-content-mIoJHEWhujpANeaM`         |
| `pf1-content/mLxAldGcZ0UnEfd7` | Change Shape (Skinwalker)                            | standard         | held: `racial-traits-401-whole-content-mLxAldGcZ0UnEfd7`         |
| `pf1-content/mNPzfPRAdgvumhww` | Wererat-Kin (Nightskulk)                             | subrace          | held: `racial-traits-401-whole-content-mNPzfPRAdgvumhww`         |
| `pf1-content/mNlVIIoVtpgvuqT8` | Shamanic Enhancement                                 | alternate        | held: `racial-traits-401-whole-content-mNlVIIoVtpgvuqT8`         |
| `pf1-content/mObpPwXSbBNVoXRJ` | Munavri                                              | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/mPD0yR9P3IGAC6nJ` | Weapon Familiarity (Gnome)                           | standard         | held: `racial-traits-401-whole-content-mPD0yR9P3IGAC6nJ`         |
| `pf1-content/mQB3T4teSUz4sMGf` | Air Insight                                          | alternate        | held: `racial-traits-401-whole-content-mQB3T4teSUz4sMGf`         |
| `pf1-content/mVCF3gYPZ46lmcO1` | Fast                                                 | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/mWu5e6p5urTpiqQ7` | Alternate                                            | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/mXtf2wP2c6ZHGIsL` | Monstrous Humanoid (Cecaelia)                        | standard         | held: `racial-traits-401-whole-content-mXtf2wP2c6ZHGIsL`         |
| `pf1-content/mY7BKb69IKI38A3I` | Rock Throwing                                        | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/mYFFsgYWIM1U53xJ` | Princely                                             | alternate        | held: `racial-traits-401-whole-content-mYFFsgYWIM1U53xJ`         |
| `pf1-content/mZlhtYzG64k6EMHp` | Jumper                                               | alternate        | held: `racial-traits-401-whole-content-mZlhtYzG64k6EMHp`         |
| `pf1-content/meOrv0z16wHP4nEE` | Shadowplay (Half-Orc)                                | alternate        | held: `racial-traits-401-whole-content-meOrv0z16wHP4nEE`         |
| `pf1-content/mvGTb4RoFxrIpHMF` | Subrace                                              | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/mwZTMvi4yCHeh5FC` | Weapon Familiarity (Vishkanya)                       | standard         | held: `racial-traits-401-whole-content-mwZTMvi4yCHeh5FC`         |
| `pf1-content/myff7Z3hssdT7leV` | Blank Slate                                          | alternate        | held: `racial-traits-401-whole-content-myff7Z3hssdT7leV`         |
| `pf1-content/n2lCTokOhbEJ35Nu` | Oppressive                                           | alternate        | held: `racial-traits-401-whole-content-n2lCTokOhbEJ35Nu`         |
| `pf1-content/n4wxE73ZItt77fLt` | Darkvision (Orc)                                     | standard         | held: `racial-traits-401-whole-content-n4wxE73ZItt77fLt`         |
| `pf1-content/n8T5HDk4GBP7dsjx` | Darklands Stalker                                    | alternate        | held: `racial-traits-401-whole-content-n8T5HDk4GBP7dsjx`         |
| `pf1-content/n98kLjKTeMEM5rdx` | Spell-Like Ability (Tiefling - the Motherless)       | subrace standard | held: `racial-traits-401-whole-content-n98kLjKTeMEM5rdx`         |
| `pf1-content/nBNMonZzsoPLtAKL` | Change Shape (Kitsune)                               | standard         | held: `racial-traits-401-whole-content-nBNMonZzsoPLtAKL`         |
| `pf1-content/nHtjEPEMGTSLs6AG` | Skilled (Aphorite)                                   | standard         | held: `racial-traits-401-whole-content-nHtjEPEMGTSLs6AG`         |
| `pf1-content/nIONejbfENvh4nQC` | Planar Envoy                                         | alternate        | held: `racial-traits-401-whole-content-nIONejbfENvh4nQC`         |
| `pf1-content/nIhtofd7nMqG4cKF` | Hag Racial Trait (Changeling - Dead Eyes)            | standard         | held: `racial-traits-401-whole-content-nIhtofd7nMqG4cKF`         |
| `pf1-content/nJPqvH6AoY22MBAl` | Natural Attack                                       | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/nJm4z2g5Xxv3TprR` | Unflinching Valor (Frostkin)                         | alternate        | held: `racial-traits-401-whole-content-nJm4z2g5Xxv3TprR`         |
| `pf1-content/nLkZUFT3i2sZ0wkL` | Darkvision (Goblin)                                  | standard         | held: `racial-traits-401-whole-content-nLkZUFT3i2sZ0wkL`         |
| `pf1-content/nM1ZZgnbE390Enat` | Skilled (Aasimar - Plumekith)                        | subrace standard | held: `racial-traits-401-whole-content-nM1ZZgnbE390Enat`         |
| `pf1-content/nMk4AVoYM8UxiJqg` | Low-Light Vision (Wyrwood)                           | standard         | held: `racial-traits-401-whole-content-nMk4AVoYM8UxiJqg`         |
| `pf1-content/nNgJ1VbtPCMoIOFJ` | Exalted Resistance                                   | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/nOZ9tdmFZ4sWgXv0` | Elf-Scorned                                          | alternate        | held: `racial-traits-401-whole-content-nOZ9tdmFZ4sWgXv0`         |
| `pf1-content/nPKsivL973H9L7y7` | Agathion-Blooded (Idyllkin)                          | subrace          | held: `racial-traits-401-whole-content-nPKsivL973H9L7y7`         |
| `pf1-content/nPnz19oJfnZKSFdI` | Lava Gnomes                                          | subrace          | held: `racial-traits-401-whole-content-nPnz19oJfnZKSFdI`         |
| `pf1-content/nQ9j793ikC9orJQA` | Languages (Orc)                                      | standard         | held: `racial-traits-401-whole-content-nQ9j793ikC9orJQA`         |
| `pf1-content/nUET7BmXTWwpAoi3` | Standard                                             | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/nUoNHbRSnWezuvy4` | Swarming                                             | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/nWMwiyydGWx5S05m` | Bestial                                              | alternate        | held: `racial-traits-401-whole-content-nWMwiyydGWx5S05m`         |
| `pf1-content/naQ5kacMK4kyrhfW` | Heart of the Wilderness                              | alternate        | held: `racial-traits-401-whole-content-naQ5kacMK4kyrhfW`         |
| `pf1-content/nb7WkJkqL3bnhkU5` | Fey                                                  | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/nfHng6a21r2pANDD` | Ability Modifiers (Changeling - Veil May)            | subrace standard | held: `racial-traits-401-whole-content-nfHng6a21r2pANDD`         |
| `pf1-content/nkri33C3iqcYSE7k` | Crossbow Training                                    | alternate        | held: `racial-traits-401-whole-content-nkri33C3iqcYSE7k`         |
| `pf1-content/nmkrU4JipjabVhKM` | Gliding Wings                                        | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/nmthVcIFBg9PNqhb` | Hatred (Half-Orc)                                    | alternate        | held: `racial-traits-401-whole-content-nmthVcIFBg9PNqhb`         |
| `pf1-content/nnyOoCfyIRKs3xcQ` | Wyrmscourged                                         | alternate        | held: `racial-traits-401-whole-content-nnyOoCfyIRKs3xcQ`         |
| `pf1-content/noLFpNL6xVCMBkRp` | Heart of the Fields                                  | alternate        | held: `racial-traits-401-whole-content-noLFpNL6xVCMBkRp`         |
| `pf1-content/nopyUgzhxcD4G8uD` | Weretiger-Kin (Fanglord)                             | subrace          | held: `racial-traits-401-whole-content-nopyUgzhxcD4G8uD`         |
| `pf1-content/nr88lEu9l12sMZqO` | Jumper                                               | standard         | held: `racial-traits-401-whole-content-nr88lEu9l12sMZqO`         |
| `pf1-content/nsTVmSX9Xm4O1zqo` | Darkvision (Strix)                                   | standard         | held: `racial-traits-401-whole-content-nsTVmSX9Xm4O1zqo`         |
| `pf1-content/ntICYwpS9NmCaXKI` | Skilled (Tiefling - Grimspawn)                       | subrace standard | held: `racial-traits-401-whole-content-ntICYwpS9NmCaXKI`         |
| `pf1-content/o0ooSUUjwVjL79XE` | Fecund Earth                                         | alternate        | held: `racial-traits-401-whole-content-o0ooSUUjwVjL79XE`         |
| `pf1-content/o1nSxKcbPwxbxxD5` | Subrace Standard                                     | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/o4Uk5x9MPYEVfz9P` | Darkvision (Oread)                                   | standard         | held: `racial-traits-401-whole-content-o4Uk5x9MPYEVfz9P`         |
| `pf1-content/o4qjsfHulsHFsLI1` | Projection                                           | alternate        | held: `racial-traits-401-whole-content-o4qjsfHulsHFsLI1`         |
| `pf1-content/o8YypRycSCackHdm` | Plagueborn                                           | alternate        | held: `racial-traits-401-whole-content-o8YypRycSCackHdm`         |
| `pf1-content/o9IVTGXGOqHixS7z` | Brazen Flame                                         | alternate        | held: `racial-traits-401-whole-content-o9IVTGXGOqHixS7z`         |
| `pf1-content/oAmGMMG6eBg7FlCM` | Rodent Empathy                                       | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/oB8Ff3b2HNB2eddC` | Tower Elf                                            | subrace          | held: `racial-traits-401-whole-content-oB8Ff3b2HNB2eddC`         |
| `pf1-content/oBIBlHuA3E69EEuN` | Venomkissed                                          | alternate        | held: `racial-traits-401-whole-content-oBIBlHuA3E69EEuN`         |
| `pf1-content/oDZJj9N4i2p4QUIT` | Alternate                                            | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |

## Notable cases

- **Heritage ability lines curated (#387 to #400 precedent).** Werebat-Kin (Bloodmarked) (+2 Int, -2 Wis), Wererat-Kin (Nightskulk) (+2 Int, -2 Str), Weretiger-Kin (Fanglord) (+2 Dex, -2 Wis) and Agathion-Blooded (Idyllkin) (+2 Con, +2 Cha) are `reviewedAbilityLineSubraces` heritages whose lines agree with PCGen's Core Essentials "<Heritage> ~ Ability Scores" rows (`skinwalker_abilities_race_subrace.lst:19`, `:115`, `:163`; `aasimar_abilities_race_subrace.lst:24`). Each is racial ability Modifiers, and "Base Statistics" resolves to the race's ability score trait, which goes dormant. The shapechanged bonus in each skinwalker line belongs to the heritage's Change Shape part. `race-ability-721` and `racial-traits-719` pin none of the four. Lava Gnomes and Tower Elf bundle nothing (racial subtypes) and keep "Base Statistics" unresolved.
- **Overstated imported change fixed (Heart of the Wilderness).** The body and PCGen `arg_abilities_race.lst:268` give a racial bonus equal to half the character level on Survival; Foundry's change grants the full Hit Dice. A row in `reviewed-change-replacements.ts` halves the formula (`floor(@attributes.hd.total / 2)`, +3 at 7th level), as #394 did for Aquatic Ancestry, with a curation.md paragraph ([curation.md](curation.md#reviewed-change-replacements)). The fix changes this record's content, so its own binding changes, and Trailblazer (#395), whose full-corpus closure reaches Heart of the Wilderness, is re-bound (see Cross-batch bindings); no other landed assessment's closure reaches it.
- **Race outputs checked first (#391).** The import report's only overlap with a batch key is the Kitsune race's latent overlap on Change Shape (Kitsune): the race's checked #328 description record already gives +10 racial Disguise "to appear human while in the specific human form", so the trait's Disguise note record is covered/no-output. The Grindylow race's #328 description record likewise carries Tangling Tentacles' +4 racial trip bonus ("to trip with tangling tentacles"); the trait (which has no Foundry note) adds none. No Modifier is added to a standard trait of a #719 race, and no other relocated change, covered trait note or latent overlap names a batch key.
- **Situational bonuses** (manual Situations): Darklands Guide (Half-Elf) (saves against traps and hazards underground; untyped initiative always, as #387's drow record), Thinblood Resistance (disease), Skulker, Child of the Sea (Profession (sailor) to pilot a sea vessel, as PCGen reads it), Stalker (+1 untyped on Bluff, the ten Knowledge skills, Perception, Sense Motive, Survival and weapon attack and damage against the observed creature), Magical Linguist (+1 spell DC and +2 racial saves for language-dependent and glyph spells), Pain Tolerance, Shadowplay (Half-Orc) (+1 caster level), Unflinching Valor (CMD against grapple), Elf-Scorned and Wyrmscourged (dodge on `ac`, never `ac.other`), Hatred (Half-Orc), Plagueborn, Squalid, Projection (+1 DC), Oppressive (+4 racial Intimidate), the Bloodmarked Perception at night, and the skinwalker change shape bonuses (+2 racial chosen ability score and +1 natural armor on `ac.natural`; +2 racial Constitution for the Ragebred part). **Shared Situations:** poison (Thinblood Resistance's Fortitude bonus, Venomkissed), fear (Unflinching Valor) and spellResistance (Crusading Magic's caster level checks).
- **Covered/no-output records (1):** Change Shape (Kitsune)'s Disguise note (latent overlap above).
- **Inherited rules beyond the race:** the UM pain and shadow descriptor superscripts of Projection and Shadowplay (Half-Orc) (PZO1117, the #385 ruling; Pain Tolerance's pain descriptor has no citation and stays an unresolved origin); Shamanic Enhancement the ACG shaman spirit animal (PZO1129, `acg_classes.lst:231`); Wererat-Kin the Bestiary distraction it cites ("Pathfinder RPG Bestiary 299", PZO1112); the linked spells', feats' and traits' books (Poison Use (Drow) and Spell-Like Abilities (Drow) PZO9280, PZO1112, PZO1121; the gnome's Illusion Resistance; the Darkborn, Shoreborn and Frostkin heritages PZO9491 and PZO9442; urban grace PZO1121; Nimble Moves and Rapid Reload PZO1110).
- **Mistyped imported change fixed (Beastmaster; fix round 1).** The pinned body follows the APG printing ("gains a +2 bonus on Handle Animal checks", untyped, as PCGen `apg_abilities_race.lst:78`), while Foundry's change is typed racial, as the later ARG printing reads. The batch follows the version the pinned text matches (curation.md, Notice guidance, Rejected alternates): a row in `reviewed-change-replacements.ts` sets the racial formula to 0 and the description record supplies the untyped +2, as for Gift of Tongues (#400), with a curation.md paragraph. Only Beastmaster's own binding changes: no landed assessment's closure reaches it.
- **Listed for review:** Change Shape (Skinwalker - Ragebred)'s "Race:" header reads "Skinwalker - Nightskulk" although its name, action and features are the ragebred's (a pf1-content data error, recorded). Child of the Sea's and Wyrmscourged's readings of their conditions (recorded with the PCGen and Foundry readings; a book check would settle them).
- **Not modeled, listed:** senses, speeds and difficult terrain, spell-like abilities and other actions (Urban Memories, Magical Linguist, Fecund Earth, Darklands Stalker's bonus feat, Luckbringer's token, Oppressive's check, Blank Slate's ranks, Spell-Like Ability (Tiefling - the Motherless)), the bestial features, creature types, languages (Planar Envoy's two languages per Linguistics rank), class-skill grants (Curosity, Skill Training), weapon familiarity and martial-weapon clauses (Weapon Familiarity (Gnome), Beastmaster, Princely's rapier proficiency), companion bonuses (Shamanic Enhancement), damage reduction, extra fire damage (Brazen Flame), crossbow reloading, the hag racial trait choice (Dead Eyes, as #391 to #396 kept the other options) and the chosen Craft or Profession skills (Skilled (Aphorite), Heart of the Fields).
- **Blog source:** Frightened by Magic cites only a Paizo blog post (custom source), held as #389, #399 and #400 held the other Primitive Human records.

## Importer and data gaps

- **Reference gap (admission failure in any preview, not curation-dependent):** Dusksight (Half-Orc) links Low-Light Vision (`pf1-content/DVHvbNX8hupYkCoJ`), a record of the excluded ARG Race Builder subtree (#390 records it excluded), so the importer strips the link and the record fails with "unresolved imported reference", as #400's Deep Delver does for Stonesinger. It is neither #738 nor #739 and is reported here as its own entry; `tests/catalog/cross-batch-bindings.ts` lists the link among its dangling catalog links.
- **Partial alterations and unmatched headers:** Mostly Human (Ifrit) names "Languages, Subtype, Type" and Fecund Earth "Past-Life Knowledge, Nature Magic"; neither matches the race's trait names ("Languages (Ifrit)", "Native Outsider (Ifrit)"; "Past-Life Knowledge (Ghoran)", "Natural Magic"), so with any unmatched name the importer resolves none (#304), as #395 and #399 recorded for the suli and undine.
- No #739 finding, no missing pf-items reference, and the raw upstream keys in `mapRacialTrait` caused no reference failure. Untested cases from the run notes: none in this batch. Orc Atavism and the four uncovered trait notes are not in this batch.

## Outstanding mechanics

Each record lists its calculation gaps in `mechanicsReview.outstandingCalculations`; none is an attribution hold. Beyond the "Not modeled" items above: Skilled (Aphorite)'s +2 racial bonus and Heart of the Fields' half-level racial bonus on one chosen Craft (or Profession) skill (the raw changes name no target, and a racial trait has no skill choice); the Wisdom check bonus of Child of the Sea; Constitution checks to stabilize and the negative hit point threshold of Heart of the Wilderness; the +1 fear effect DC of Oppressive; and Dead Eyes' +2 on saves against gaze attacks and visual illusions, which stays a Note because the importer grants every hag racial trait option at once.

## Cross-batch bindings and protected records

Curated on `a4ba996b`. Every re-bind uses `buildAssessmentBinding` over the final full `catalog:preview` with this batch's records, with the earlier batch's fixture copies of this batch's keys replaced by the full-preview entries, the inventory `currentBinding` updated and the fixture-based binding checked to agree (all 38 agree). Only the content fingerprints changed; no disposition, evidence, notice or hold changed in the earlier batches. The 38 re-binds listed here (47 in all with the nine #549 re-binds, see Re-bind after #549) are every assessment whose full-corpus closure reaches a batch key and that was fresh on the base (checked with the binding code over the baseline full preview; the final preview's closures reach the same 60 assessments): 1 from #387, 2 from #388, 3 from #389, 3 from #392, 3 from #393, 5 from #394, 2 from #395, 2 from #396, 5 from #397, 1 from #398, 1 from #399, 1 from #400, 1 from items-430 and 8 from pf-buffs-548.

| Batch        | Assessment                                              | Reaches (this batch)                              | Content fingerprint       |
| ------------ | ------------------------------------------------------- | ------------------------------------------------- | ------------------------- |
| #387         | Change Shape (Skinwalker - Scaleheart)                  | Change Shape (Skinwalker)                         | `b9bc7b63…` → `b7a46891…` |
| #388         | Experimental Body: Enchanted                            | Low-Light Vision (Wyrwood)                        | `d32fa87a…` → `ad0a39bc…` |
| #388         | Experimental Body: Scorched                             | Low-Light Vision (Wyrwood)                        | `ac5dea1c…` → `aea05abb…` |
| #389         | Feral                                                   | Languages (Orc)                                   | `843a745d…` → `a1fc0fc6…` |
| #389         | Fey Fortitude                                           | Weapon Familiarity (Gnome)                        | `0996aae9…` → `41ace815…` |
| #389         | Sound Mimicry                                           | Weapon Familiarity (Gnome)                        | `2064780f…` → `1bf168dc…` |
| #392         | Change Shape (Skinwalker - Bloodmarked)                 | Change Shape (Skinwalker)                         | `63600438…` → `87a14741…` |
| #392         | Change Shape (Skinwalker - Seascarred)                  | Change Shape (Skinwalker)                         | `86f400c5…` → `c1c03c98…` |
| #392         | Ironsoul (Metal Oread)                                  | Darkvision (Oread)                                | `7b8f316f…` → `a86cf7d3…` |
| #393         | Change Shape (Skinwalker - Aerieborn)                   | Change Shape (Skinwalker)                         | `a6813cce…` → `2f1e6330…` |
| #393         | Change Shape (Skinwalker - Coldborn)                    | Change Shape (Skinwalker)                         | `a4dca66b…` → `bfbf5676…` |
| #393         | Deep Dweller                                            | Low-Light Vision (Locathah)                       | `4d63a8b9…` → `57b70c31…` |
| #394         | Change Shape (Skinwalker - Witchwolf)                   | Change Shape (Skinwalker)                         | `6145b6cc…` → `0671150c…` |
| #394         | Exiled Dwarf                                            | Wyrmscourged                                      | `d298bebd…` → `d6a1eb15…` |
| #394         | Experimental Body: Blessed                              | Low-Light Vision (Wyrwood)                        | `09e08b7e…` → `4fc532c4…` |
| #394         | Mountain Clan                                           | Bestial                                           | `7d99089c…` → `00ed698b…` |
| #394         | Spiresworn Elves                                        | Crossbow Training                                 | `cff511a7…` → `003dd4e4…` |
| #395         | Trailblazer                                             | Heart of the Wilderness                           | `9025e423…` → `8050704a…` |
| #395         | Wereraptor-Kin (Aerieborn)                              | Languages (Skinwalker), Change Shape (Skinwalker) | `297832ce…` → `d549a187…` |
| #396         | Experimental Body: Fey-Touched                          | Low-Light Vision (Wyrwood)                        | `e3f8bcdb…` → `62a727da…` |
| #396         | First World Gnomes                                      | Weapon Familiarity (Gnome)                        | `ad551a17…` → `878a50dc…` |
| #397         | Fey Thoughts (Gnome)                                    | Weapon Familiarity (Gnome)                        | `c0f2c46a…` → `5ddc3b9d…` |
| #397         | Gemsoul (Crystal Oread)                                 | Darkvision (Oread)                                | `910fe74d…` → `fc054ed7…` |
| #397         | Sky Citadel Dwarves                                     | Wyrmscourged                                      | `8511d99b…` → `d64522ee…` |
| #397         | Tree-Born                                               | Normal Speed (Gathlain)                           | `7bd140fb…` → `8c5d22ff…` |
| #397         | Werebear-Kin (Coldborn)                                 | Languages (Skinwalker), Change Shape (Skinwalker) | `4744c6d6…` → `898131eb…` |
| #398         | Werewolf-Kin (Witchwolf)                                | Languages (Skinwalker), Change Shape (Skinwalker) | `00b48c1d…` → `c508bfd3…` |
| #399         | Shadowhunter (Gnome)                                    | Weapon Familiarity (Gnome)                        | `c12513e5…` → `ed8e373d…` |
| #400         | Moonkissed                                              | Crossbow Training                                 | `cff511a7…` → `003dd4e4…` |
| items-430    | Outfit, Dilettante's                                    | Weapon Familiarity (Gnome)                        | `5c57e773…` → `51ac566b…` |
| pf-buffs-548 | Change Shape (Skinwalker - Beast Talker, Natural Armor) | Change Shape (Skinwalker)                         | `8c763087…` → `3a9c5426…` |
| pf-buffs-548 | Change Shape (Skinwalker, Climb Speed, Long)            | Change Shape (Skinwalker)                         | `0d727259…` → `630e88f2…` |
| pf-buffs-548 | Change Shape (Skinwalker, Climb Speed, Short)           | Change Shape (Skinwalker)                         | `c1afe0a0…` → `035dee78…` |
| pf-buffs-548 | Change Shape (Skinwalker, Distraction)                  | Change Shape (Skinwalker)                         | `f9a31f33…` → `12223777…` |
| pf-buffs-548 | Change Shape (Skinwalker, Ferocity)                     | Change Shape (Skinwalker)                         | `d974a16c…` → `00b10e20…` |
| pf-buffs-548 | Change Shape (Skinwalker, Saving Throws)                | Change Shape (Skinwalker)                         | `a57d6b09…` → `bd7c2d85…` |
| pf-buffs-548 | Change Shape (Skinwalker, See in Darkness)              | Change Shape (Skinwalker)                         | `da98429c…` → `0d0a8510…` |
| pf-buffs-548 | Luckbringer                                             | Luckbringer                                       | `107f05e0…` → `d8e067e4…` |

They are recorded in each batch's inventory `currentBinding` and `tests/fixtures/<batch>/preview.json`. `racial-traits-395.json` to `racial-traits-398.json` and their preview fixtures keep their landed `JSON.stringify` layout, so their diff is the re-bind only.

- **Already stale, not re-bound:** 22 assessments that reach batch keys were stale on the base and are unchanged: the #328 race records of the 19 races whose standard traits are in this batch, Lifecrafting (pf1/HoN8pq9Q72T8WbOX), Extra Feature (pf1/3KKtUz4ayCMaHeXQ) and Extra Gnome Magic (pf1/yQ06clVxFV6dOjc1).
- **Protected records:** no batch key is a protected root, and none is an entry of any batch's `binding-preview.json` import except eight standard traits (Orc, Languages (Vishkanya), Weapon Familiarity (Gnome), Weapon Familiarity (Vishkanya), Darkvision (Orc), Skilled (Aphorite), Darkvision (Goblin), Languages (Orc)) in `feats-355/binding-preview.json`, which no #355 assessment's closure reaches. The #350 to #355 and #530 to #536 `protected-context.json` and the #529 to #536 `preserved.json` name batch keys only as seed, closure and source keys; the #355, #719, #720 and #721 `provenance.json` lists name them only as closure, dependency and source keys. `racial-traits-397.test.ts` and `race-ability-721.test.ts` name Normal Speed (Gathlain) and `racial-traits-719.test.ts` four orc and gnome standard traits for their structure only (replacements, granted lists, no proficiency), which this batch doesn't change. `racial-traits-719`, `race-facts-720`, `race-ability-721`, `feats-355`, `pf-buffs-548` and `items-430` pass with this batch (see Commands).
- **In-flight batches:** no key of #431 (pf1 items), #549 (pf-buffs) or #508 (pf-companions) is in this batch's closures. #549's preview fixture copies Change Shape (Skinwalker) and Change Shape (Skinwalker - Ragebred): its closures reach these batch keys, so whichever batch lands later re-binds those assessments: #549 landed first, so this batch re-binds its nine reaching assessments (Re-bind after #549).

## Binding

Every assessment is bound with `buildAssessmentBinding` against the full-corpus content closure: the final full `catalog:preview` artifact, with the batch's 75 entries and their 89 closure entries. The [preview fixture](../../tests/fixtures/racial-traits-401/preview.json) keeps both, so the batch test rebuilds every binding from a clean shared-store tree (0 mismatches). No race output is relocated or re-homed onto a batch key, so the bounded tree reproduces every entry's Modifiers and Notes; only Dusksight (Half-Orc)'s description differs there, because the clean tree holds its linked Race Builder record without the folders that exclude it (the test strips that link before comparing).

## Tests

The [resolver tests](../../tests/catalog/racial-traits-401.test.ts) pin the four curated heritages replacing their race's ability score trait on race identity sheets, every Situation-gated bonus (off by default, on when selected) and its published type, the shared poison, fear and spellResistance Situations, Heart of the Wilderness's halved Survival formula (+3 at 7th level), distinct racial Sources stacking (+4), the imported values not curated twice, the race-covered Kitsune and Grindylow bonuses and no `ac.other` armor, shield or natural armor bonus; all 53 required and 75 description records checked, the covered record and Note targets, the Vishkanya weapon proficiencies; the race, alternate, monster-ability, inherited, linked, blog and Unchained notice dependencies (29 PZO1131 keys, own action versus bound body), every hold registered; the importer reading of races and replacements; the literal PCGen and PRD evidence in the shared store; and a clean-tree re-extraction that keeps every record held on its own hold (Skill Training on the Dynamite hold), except Dusksight (Half-Orc), which fails admission on its reference gap.

The [isolated saved-sheet test](../../tests/catalog/racialTraits401.integration.test.ts) exercises public Convex reads and writes: a skinwalker-identity race granting its ability score trait and Animal-Minded takes the held Werebat-Kin (Bloodmarked) (Intelligence 12, Wisdom 8; Perception follows Wisdom) and Alternate Skill Modifiers (Skinwalker - Bloodmarked) (Animal-Minded's Handle Animal bonus goes dormant, Fly +2), then turns both off again, with saved totals equal to the preview; outsiders, anonymous callers and another campaign's entry are refused without changing the sheet. The shared held-release round trip is covered once by the release test in [`traits367.integration.test.ts`](../../tests/catalog/traits367.integration.test.ts).

## Preservation and gates

The shared canonical files gain only this batch's entries: 128 curation records (75 description and 53 note records), 75 assessments, 75 evidence entries and 36 notice holds. The other changes are the 38 listed re-binds (content fingerprints only) with their `currentBinding` and fixture copies, the Heart of the Wilderness and (fix round 1) Beastmaster change replacements with their curation.md paragraphs, and the Low-Light Vision dangling link in `cross-batch-bindings.ts`. Shared-file diff stat against `a4ba996b`, as curated before fix round 1 (`git diff --diff-algorithm=histogram --stat HEAD`, which shows the overlay's additions as insertions only; the shared store and this batch's own new files excluded):

```text
 docs/catalog-import/curation.md                   |    2 +
 scripts/catalog/legal/held-notices.json           |  341 +++
 scripts/catalog/legal/items-430.json              |    2 +-
 scripts/catalog/legal/pf-buffs-548.json           |   16 +-
 scripts/catalog/legal/racial-traits-387.json      |    2 +-
 scripts/catalog/legal/racial-traits-388.json      |    4 +-
 scripts/catalog/legal/racial-traits-389.json      |    6 +-
 scripts/catalog/legal/racial-traits-392.json      |    6 +-
 scripts/catalog/legal/racial-traits-393.json      |    6 +-
 scripts/catalog/legal/racial-traits-394.json      |   10 +-
 scripts/catalog/legal/racial-traits-395.json      |    4 +-
 scripts/catalog/legal/racial-traits-396.json      |    4 +-
 scripts/catalog/legal/racial-traits-397.json      |   10 +-
 scripts/catalog/legal/racial-traits-398.json      |    2 +-
 scripts/catalog/legal/racial-traits-399.json      |    2 +-
 scripts/catalog/legal/racial-traits-400.json      |    2 +-
 scripts/catalog/reviewed-change-replacements.ts   |   15 +
 scripts/catalog/reviewed-curation.json            | 2882 +++++++++++++++++++++
 src/lib/catalog/data/attribution-assessments.json | 1894 +++++++++++++-
 src/lib/catalog/data/attribution-evidence.json    |  225 ++
 tests/catalog/cross-batch-bindings.ts             |    5 +
 tests/fixtures/items-430/preview.json             |    7 +-
 tests/fixtures/pf-buffs-548/preview.json          |   53 +-
 tests/fixtures/racial-traits-387/preview.json     |   48 +-
 tests/fixtures/racial-traits-388/preview.json     |    7 +-
 tests/fixtures/racial-traits-389/preview.json     |   12 +-
 tests/fixtures/racial-traits-392/preview.json     |   53 +-
 tests/fixtures/racial-traits-393/preview.json     |   55 +-
 tests/fixtures/racial-traits-394/preview.json     |  137 +-
 tests/fixtures/racial-traits-395/preview.json     |   71 +-
 tests/fixtures/racial-traits-396/preview.json     |   14 +-
 tests/fixtures/racial-traits-397/preview.json     |  131 +-
 tests/fixtures/racial-traits-398/preview.json     |   53 +-
 tests/fixtures/racial-traits-399/preview.json     |    7 +-
 tests/fixtures/racial-traits-400/preview.json     |   14 +-
 35 files changed, 5942 insertions(+), 160 deletions(-)
```

<!-- prep:shared-store-count -->

New shared-store files (`tests/fixtures/pinned/`), counted by prep after the rebase onto `6e7e1a09`: **86** (pf1 2, pf1-content 84).

<!-- /prep:shared-store-count -->

The batch adds to the shared store the pinned records of its 100 keys and of linked records the store lacked (85 pf1-content and 2 pf1 files); the race records, the folder records, the other linked spells, feats and racial traits, the PCGen files and the PRD pages were already on the base and are reused.

The complete preview of `a4ba996b` reported **103 admitted, 23,148 held, 5 dependent omissions and 2,067 failures**; with this batch's records it reports **103 admitted, 23,148 held, 5 dependent omissions and 2,014 failures**, 53 fewer (this batch's required note records). The only batch key among the failures is the Dusksight (Half-Orc) reference gap above.

## Commands

| Command                                                                                                                                                                   | Result                                                                                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `catalog:curate --candidates …` (required) and `--descriptions` (prose pass)                                                                                              | pass; 53 required and 24 prose drafts for the batch; 43 s with the bounded preview                                                                                             |
| `catalog:preview --candidates …`                                                                                                                                          | exit 1 as expected (the bounded tree lacks linked races and traits); 75 entries, 53 required and 75 description records checked, 0 missing, 0 stale                            |
| Full `catalog:curate`                                                                                                                                                     | pass; 908 new drafts, none for this batch; 0 missing (capped, 3 min)                                                                                                           |
| Full `catalog:preview` (baseline, then final records)                                                                                                                     | exit 1 as on the base (admission failures); final: 103 admitted, 23,148 held, 5 dependent omissions, 2,014 failures (base 2,067); capped, mostly queued behind gates and preps |
| Full re-bind (`bind.ts` and `xrebind401.ts` over the final full preview)                                                                                                  | 75 assessments bound (0 mismatches); 38 earlier assessments re-bound, all fixture bindings agree                                                                               |
| `pnpm test` of the batch test and the guards (`notice-holds`, `pinned-sources`, `cross-batch-bindings`, `batch-ownership-sweep`, `ac-other-defense-bonuses`) (one worker) | pass; 6 files / 179 tests                                                                                                                                                      |
| `pnpm test` of the batch integration test, `racial-traits-719`, `race-facts-720`, `race-ability-721`, `feats-355`, `pf-buffs-548` and `items-430` (one worker)            | pass                                                                                                                                                                           |
| `pnpm -s typecheck`                                                                                                                                                       | pass                                                                                                                                                                           |
| `pnpm -s lint`                                                                                                                                                            | pass; about 3 min                                                                                                                                                              |
| `pnpm -s check:initial-migration-writers`                                                                                                                                 | pass; 185 registrations                                                                                                                                                        |
| `pnpm catalog:pin`                                                                                                                                                        | pass; `sha256:005ef0b9…`                                                                                                                                                       |
| `pnpm catalog:notice-deps`                                                                                                                                                | pass; 0 gaps; 39 advisory warnings, none for this batch                                                                                                                        |
| `pnpm catalog:format --check`                                                                                                                                             | pass                                                                                                                                                                           |

`pnpm test tests/catalog` was left to the orchestrator's prep run on the rebased commit, as the brief directs.

## Fix round 1

Sol's review (fix first) asked for two changes; both are made on `3a3b2be2` (this batch rebased onto `5447e207`, #508):

1. **Beastmaster follows its pinned (APG) text.** A reviewed change replacement sets the imported racial `skill.han` formula to 0, and the description record supplies the untyped +2 on Handle Animal the pinned body and PCGen `apg_abilities_race.lst:78` give, as for Gift of Tongues (#400); curation.md has one added paragraph. The batch test pins the replaced racial 0 and the untyped +2 through the resolver. Only Beastmaster's content fingerprint changes (`acb58796…` → `45bea92f…`, with its inventory `currentBinding`, mapped facts and preview fixture entry): the binding code over the new full preview finds no landed assessment whose closure reaches Beastmaster, and the other 60 assessments that reach batch keys are as before (38 fresh, including Trailblazer, 22 stale on the base). #508's assessments reach no batch key.
2. **Heart of the Wilderness's binding note is corrected** (Notable cases): Trailblazer (#395), whose closure reaches it, was re-bound in the original curation (Cross-batch bindings table); the sentence no longer says only the record's own binding changes.

| Command (fix round 1)                                                                                                                  | Result                                                                                  |
| -------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Full `catalog:preview`                                                                                                                 | exit 1 as on the base; 103 admitted, 23,148 held, 5 dependent omissions, 2,014 failures |
| `bind.ts` over it (`regen.sh`)                                                                                                         | 75 assessments bound (0 mismatches); only Beastmaster's binding changed                 |
| `pnpm test` of the batch tests (unit and integration), `cross-batch-bindings`, `batch-ownership-sweep` and `notice-holds` (one worker) | pass; 5 files / 143 tests                                                               |
| `pnpm -s typecheck`, `pnpm -s lint`                                                                                                    | pass                                                                                    |
| `pnpm catalog:format --check`                                                                                                          | pass                                                                                    |
| `pnpm catalog:notice-deps`                                                                                                             | pass; 0 gaps; 39 advisory warnings, none for this batch                                 |

## Re-bind after #549

#549 (pf-buffs batch 2) landed as `6279642e` before this batch, and #759's table merge after it; this batch now sits on `6e7e1a09`. Nine #549 assessments, the skinwalker Change Shape buffs, reach Change Shape (Skinwalker) and, for two of them, Change Shape (Skinwalker - Ragebred), which this batch curated, so `cross-batch-bindings` reported them stale. As the later-landing batch, this batch re-binds them with `buildAssessmentBinding` over a full `catalog:preview` of `6e7e1a09` plus this batch (104 admitted, 23,147 held, 5 dependent omissions, 1,922 failures). For each one, the assessment, #549's inventory `currentBinding` and its preview fixture copies of the two batch entries are updated, and the fixture-based binding agrees. Only the content fingerprints changed.

| Batch        | Assessment                                | Reaches (this batch)                                            | Content fingerprint       |
| ------------ | ----------------------------------------- | --------------------------------------------------------------- | ------------------------- |
| pf-buffs-549 | Change Shape (Skinwalker, Amphibious)     | Change Shape (Skinwalker)                                       | `da9a12fc…` → `a37b1871…` |
| pf-buffs-549 | Change Shape (Skinwalker, Base Speed)     | Change Shape (Skinwalker - Ragebred), Change Shape (Skinwalker) | `06eec782…` → `54d17260…` |
| pf-buffs-549 | Change Shape (Skinwalker, Darkvision)     | Change Shape (Skinwalker)                                       | `5dd36d0a…` → `aa1a9e34…` |
| pf-buffs-549 | Change Shape (Skinwalker, Falling Damage) | Change Shape (Skinwalker)                                       | `e0339449…` → `273ac7ab…` |
| pf-buffs-549 | Change Shape (Skinwalker, Natural Armor)  | Change Shape (Skinwalker)                                       | `3332702b…` → `722e15e5…` |
| pf-buffs-549 | Change Shape (Skinwalker, STR)            | Change Shape (Skinwalker)                                       | `145dae98…` → `06a9ea9a…` |
| pf-buffs-549 | Change Shape (Skinwalker, Scent)          | Change Shape (Skinwalker - Ragebred), Change Shape (Skinwalker) | `c1b2bd0d…` → `c98952d6…` |
| pf-buffs-549 | Change Shape (Skinwalker, Swim Speed)     | Change Shape (Skinwalker)                                       | `437194da…` → `ecaa3f02…` |
| pf-buffs-549 | Change Shape (Skinwalker, WIS)            | Change Shape (Skinwalker)                                       | `f6cc60bc…` → `97094fca…` |

Nothing else moved. The binding code over the same preview finds all 75 batch assessments and the earlier 38 re-binds unchanged. 69 assessments now reach batch keys: the 60 from before and these nine. All are fresh except the same 22 that were stale on the base. **Re-binds in total: 47** (38 + 9).
