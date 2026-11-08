# Racial traits #389: pf1-content pf-racial-traits batch 3

Reviewed by **Opus (AI curator) for the owner**, 2026-10-19.

Exactly the issue's 100 ordered, unique keys were reviewed: **0 admitted, 70 specifically held, 0 dependent omissions, 0 whole-entry unsupported/prose-only dispositions, 30 exclusions, 0 record-level 3.5 holds**. The exclusions are 11 Foundry `!folders!` records, which the importer's folder contract leaves out of the Catalog Entries (PRD Decision 17), and 19 records in the Advanced Race Guide Race Builder subtree, which the import contract excludes by folder ancestry ([README](README.md), explicit exclusions) and the [Racial Trait contract](../character-sheet/racial-traits.md) puts out of scope. No candidate carries a `3.5` tag. The 70 in-scope records are 28 standard racial traits, 36 alternates, 4 Subrace Standard heritage parts and 2 Subraces-folder racial subtypes.

The [machine-readable inventory and evidence](../../scripts/catalog/legal/racial-traits-389.json) records, per key, the complete pinned body and inert fields with their source hash and cited sources; the PCGen race-ability rows, PRD Advanced Race Guide paragraphs, leads and rejected same-name rows; the inherited-rule notices with their evidence, the linked bodies and the unresolved origins; the importer's reading of race, standard flag and replacements; every checked curation record, source discrepancies and calculation gaps; and the current assessment binding and mapped facts. This report summarizes them and does not repeat the evidence.

## #328 S4-A launch update

Reviewed 2026-11-01 by **Sol (AI curator) for the owner** ([races-328.md](races-328.md#s4-a-launch-human-dwarf-and-half-orc)). The launch review admits 1 standard racial trait of Human, Dwarf and Half-Orc with confirmed, content-bound assessments; counts are now **1 admitted, 69 held**, with 30 exclusions unchanged. The earlier Opus review of each admitted row stays in its `assessmentHistory`; every other candidate keeps its review and holds.

- **Darkvision (Dwarf)** (`pf1-content/ACFSI8aOJAYr89QM`): matches the PRD ARG paragraph (`advancedRaceGuide/coreRaces/dwarves.html:363`) word for word; PCGen's Core Essentials row (`dwarf/dwarf_abilities_race.lst:21`). Darkvision 60 feet stays readable; Foundry's set change on sensedv is unmapped and contributes nothing. Required notices: PZO9280, PZO1121, PZO1127, PZO1110. Outstanding: Darkvision is permitted prose; no sense statistic.

Each admitted row's whole-content hold ("Book PDFs unavailable") is superseded by this comparison, and it records no notice hold: PZO1110 is reviewed, PZO1121's Registry hold is cleared (owner, 2026-10-30), and PZO9280's reviewed confirmation waives `racial-traits-389-notice-PZO9280-complete-chain`. The batch's `noticeRequirements` rows keep these keys as history. Content fingerprints are unchanged (the imported entries are identical); only the status, rationale, evidence and notice bindings move.

Tests: `racial-traits-389.test.ts` checks the admitted rows with the held ones (`assessedTraits` in the fixture), expects them admitted by the committed gate and records no hold for them.

## Family rulings applied

This batch follows the #387 rulings Sol approved for the family:

1. **Every in-scope record is held** with a whole-content hold: the race records stay held (#328), every cited book's notice chain is held, and no book PDFs are available.
2. **Race abilities.** Every record requires the books its pinned race record cites, recorded as an inherited rule with the race record's location.
3. **Alternate framework.** Every record in an Alternate folder records the APG alternate racial trait rule (PZO1115, `apg_abilities_race.lst:86`). Drow-Descended, an ARG half-elf racial subtype that pf1-content files under Alternate, is read as an alternate, as the importer reads it; the traits it bundles are alternates.
4. **Monster abilities** take the earliest book the pinned Universal Monster Rules page lists: darkvision PZO1127; low-light vision, scent, natural attacks, breath weapon, resistance and poison PZO1112.
5. **Creature types** (Vishkanya, Kitsune) stay named unresolved origins.
6. **PZO1131** for Unchained action-cost metadata anywhere in the bound closure: 17 records (11 on their own actions, 13 through bound bodies).
7. **Comparisons.** PCGen race-ability rows from a pinned book are the `comparison`; Core Essentials support rows (no SOURCELONG book) are leads whose book is not required. 20 records carry a PRD `prdComparison` from the pinned capture (16 match word for word).
8. **Description pass.** Every in-scope record has a checked description record: its reviewed Modifiers plus one entry-level Note with the body, `@Distance` read as feet.
9. **Racial bonuses from distinct Sources stack**; no gap claims otherwise.

## Dispositions

| Key                            | Name                                                 | Kind             | Disposition                                                      |
| ------------------------------ | ---------------------------------------------------- | ---------------- | ---------------------------------------------------------------- |
| `pf1-content/7FYX5JLKL7oYGulN` | Speed (Being of Ib)                                  | standard         | held: `racial-traits-389-whole-content-7FYX5JLKL7oYGulN`         |
| `pf1-content/7IMx5MBTrYTOhTnf` | Ability Score Modifiers (Gathlain)                   | standard         | held: `racial-traits-389-whole-content-7IMx5MBTrYTOhTnf`         |
| `pf1-content/7JHnhD96PeWEnf7U` | Feral                                                | subrace          | held: `racial-traits-389-whole-content-7JHnhD96PeWEnf7U`         |
| `pf1-content/7JWZErgiHFTPrman` | Scarred                                              | alternate        | held: `racial-traits-389-whole-content-7JWZErgiHFTPrman`         |
| `pf1-content/7KMw9IErP1W9vQsO` | Spell-Like Ability (Dhampir)                         | standard         | held: `racial-traits-389-whole-content-7KMw9IErP1W9vQsO`         |
| `pf1-content/7LMPWVsKB0u2krDQ` | Serpent Affinity                                     | alternate        | held: `racial-traits-389-whole-content-7LMPWVsKB0u2krDQ`         |
| `pf1-content/7LSKyC0eM1uQgBvm` | Deep Warrior                                         | alternate        | held: `racial-traits-389-whole-content-7LSKyC0eM1uQgBvm`         |
| `pf1-content/7Q9gsyY1fJON8Bm7` | Nimble Attacks                                       | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/7TQQjCCfgoP7GexZ` | Mixed Heritage                                       | alternate        | held: `racial-traits-389-whole-content-7TQQjCCfgoP7GexZ`         |
| `pf1-content/7VH3Akj7yTzcw8Qx` | Soaring Agility                                      | alternate        | held: `racial-traits-389-whole-content-7VH3Akj7yTzcw8Qx`         |
| `pf1-content/7aQlj321iJl2pCo8` | Minesight                                            | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/7cHKd5w3VKNTyFLW` | Repair Magic                                         | alternate        | held: `racial-traits-389-whole-content-7cHKd5w3VKNTyFLW`         |
| `pf1-content/7cNjfrDIdpHxu8YJ` | Shaman's Apprentice                                  | alternate        | held: `racial-traits-389-whole-content-7cNjfrDIdpHxu8YJ`         |
| `pf1-content/7e1d54HYrKOs66G2` | Alternate                                            | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/7fL4TAWC0d05MIyv` | Past-Life Knowledge (Ghoran)                         | standard         | held: `racial-traits-389-whole-content-7fL4TAWC0d05MIyv`         |
| `pf1-content/7g3F8YEFDlNPiGkA` | Adoptive Parentage (Weapon Focus)                    | alternate        | held: `racial-traits-389-whole-content-7g3F8YEFDlNPiGkA`         |
| `pf1-content/7lquuXyjHJKCYDOU` | Ability Modifiers (Changeling - Sorrow May)          | subrace standard | held: `racial-traits-389-whole-content-7lquuXyjHJKCYDOU`         |
| `pf1-content/7tA7QryetJUIsI9M` | Emissary                                             | alternate        | held: `racial-traits-389-whole-content-7tA7QryetJUIsI9M`         |
| `pf1-content/7uMIbqiuCgGkVFWx` | Bond to the Land                                     | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/7uXh24sfHB4VJBhL` | Round Ears                                           | alternate        | held: `racial-traits-389-whole-content-7uXh24sfHB4VJBhL`         |
| `pf1-content/7ungQuC9iDjjX2vP` | Silent Hunter                                        | alternate        | held: `racial-traits-389-whole-content-7ungQuC9iDjjX2vP`         |
| `pf1-content/7yKmMTrVOrcDObZj` | Flight (Wyvaran)                                     | standard         | held: `racial-traits-389-whole-content-7yKmMTrVOrcDObZj`         |
| `pf1-content/7yZpbgZLUjYFlFNr` | Past Life Knowledge (Shabti)                         | standard         | held: `racial-traits-389-whole-content-7yZpbgZLUjYFlFNr`         |
| `pf1-content/84BWLCPhOyIzE3Xv` | Creator's Legacy                                     | alternate        | held: `racial-traits-389-whole-content-84BWLCPhOyIzE3Xv`         |
| `pf1-content/86Fah2rrPRam2WF0` | Dragon-Scaled                                        | alternate        | held: `racial-traits-389-whole-content-86Fah2rrPRam2WF0`         |
| `pf1-content/86RjOnR8BfPNmEie` | Stability                                            | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/86ckozGTUZvWb8dW` | Secretive                                            | alternate        | held: `racial-traits-389-whole-content-86ckozGTUZvWb8dW`         |
| `pf1-content/87aXXEDJDUH8e0XD` | Water Dependent                                      | standard         | held: `racial-traits-389-whole-content-87aXXEDJDUH8e0XD`         |
| `pf1-content/88rQ9iJdzI8Cmr18` | Light against Darkness                               | alternate        | held: `racial-traits-389-whole-content-88rQ9iJdzI8Cmr18`         |
| `pf1-content/89B2pdN07oWOrnwN` | Languages (Reborn Samsaran)                          | standard         | held: `racial-traits-389-whole-content-89B2pdN07oWOrnwN`         |
| `pf1-content/89ENmvsXsZYGFVBm` | Viscous Blood                                        | alternate        | held: `racial-traits-389-whole-content-89ENmvsXsZYGFVBm`         |
| `pf1-content/8AC7FY68Vf5KcBJw` | Paragon                                              | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/8FVoYW1DHtypWyW6` | Standard                                             | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/8Fcp5fwVESw51Dgm` | Stoic                                                | alternate        | held: `racial-traits-389-whole-content-8Fcp5fwVESw51Dgm`         |
| `pf1-content/8OaWgmorew8NgJ3d` | Shiftless                                            | alternate        | held: `racial-traits-389-whole-content-8OaWgmorew8NgJ3d`         |
| `pf1-content/8S3LbLY78NiCmXT8` | Lashvine                                             | alternate        | held: `racial-traits-389-whole-content-8S3LbLY78NiCmXT8`         |
| `pf1-content/8S5F3TatyTW9rRSB` | Alternate Spell-Like Ability (Skinwalker - Ragebred) | subrace standard | held: `racial-traits-389-whole-content-8S5F3TatyTW9rRSB`         |
| `pf1-content/8S7WdHboDUYzMC0s` | Darkvision (Duskwalker)                              | standard         | held: `racial-traits-389-whole-content-8S7WdHboDUYzMC0s`         |
| `pf1-content/8SYQX3mBlIw2yMrU` | Shards of the Past                                   | standard         | held: `racial-traits-389-whole-content-8SYQX3mBlIw2yMrU`         |
| `pf1-content/8TRPKeNOCnCT91oP` | Flexible Bonus Feat                                  | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/8dxrQ9BRuv0eR6P1` | Ability Modifiers (Changeling - Virga May)           | subrace standard | held: `racial-traits-389-whole-content-8dxrQ9BRuv0eR6P1`         |
| `pf1-content/8fDdrkadAWzd49se` | Resist Level Drain                                   | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/8faRAII4NRHmr6IC` | Languages (Naiad)                                    | standard         | held: `racial-traits-389-whole-content-8faRAII4NRHmr6IC`         |
| `pf1-content/8gIlEIGMp5PaAUpL` | Tenacious                                            | alternate        | held: `racial-traits-389-whole-content-8gIlEIGMp5PaAUpL`         |
| `pf1-content/8iH64U7HbUz0gQo9` | Low-Light Vision (Vine Leshy)                        | standard         | held: `racial-traits-389-whole-content-8iH64U7HbUz0gQo9`         |
| `pf1-content/8l8dbrq85930xouu` | Standard                                             | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/8lSKScxOqbUF5X1H` | Drow-Descended                                       | alternate        | held: `racial-traits-389-whole-content-8lSKScxOqbUF5X1H`         |
| `pf1-content/8llDUy987n44CJS2` | Vigilant Gaze                                        | alternate        | held: `racial-traits-389-whole-content-8llDUy987n44CJS2`         |
| `pf1-content/8nAoswunyxzzvQEB` | Fey Thoughts (Elf)                                   | alternate        | held: `racial-traits-389-whole-content-8nAoswunyxzzvQEB`         |
| `pf1-content/8nBdNng8y9E3AC5o` | Take to the Water                                    | standard         | held: `racial-traits-389-whole-content-8nBdNng8y9E3AC5o`         |
| `pf1-content/8nCDInPZ48zvuu1D` | Poison Minion (wayang)                               | alternate        | held: `racial-traits-389-whole-content-8nCDInPZ48zvuu1D`         |
| `pf1-content/8pL6ADeKtZt2FTum` | Armor (Merfolk)                                      | standard         | held: `racial-traits-389-whole-content-8pL6ADeKtZt2FTum`         |
| `pf1-content/8q9es0syBXGYhZSS` | Vishkanya                                            | standard         | held: `racial-traits-389-whole-content-8q9es0syBXGYhZSS`         |
| `pf1-content/8tPc9LAjl0PpW5CZ` | Low-Light Vision (Deep One Hybrid)                   | standard         | held: `racial-traits-389-whole-content-8tPc9LAjl0PpW5CZ`         |
| `pf1-content/8twsvpFy4V7CsT8P` | Fiendish Sorcery                                     | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/8vByVIUdiF70ApWv` | Stoneseer (Svirfneblin)                              | alternate        | held: `racial-traits-389-whole-content-8vByVIUdiF70ApWv`         |
| `pf1-content/8vJZseDShMzcl6Oz` | Hag Magic (ISR)                                      | alternate        | held: `racial-traits-389-whole-content-8vJZseDShMzcl6Oz`         |
| `pf1-content/8zuQiFz3p29tdJKe` | Undine                                               | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/901VteaGCjg0FTKQ` | Object of Desire                                     | alternate        | held: `racial-traits-389-whole-content-901VteaGCjg0FTKQ`         |
| `pf1-content/93KXq6n1wiX0ifEy` | Spell-Like Ability (Tiefling - Shackleborn)          | subrace standard | held: `racial-traits-389-whole-content-93KXq6n1wiX0ifEy`         |
| `pf1-content/94u0I9hX8LLAzvmk` | Fey Fortitude                                        | alternate        | held: `racial-traits-389-whole-content-94u0I9hX8LLAzvmk`         |
| `pf1-content/96UasAu9CBvgf5hT` | Alternate                                            | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/96blPHvnxXt0b0cn` | Subraces                                             | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/99pNNIwi4JrK0nDc` | Languages (Gathlain)                                 | standard         | held: `racial-traits-389-whole-content-99pNNIwi4JrK0nDc`         |
| `pf1-content/9CFWFY7SgYQcanu3` | Nomadic                                              | subrace          | held: `racial-traits-389-whole-content-9CFWFY7SgYQcanu3`         |
| `pf1-content/9ITJPJ5KKTMdfflG` | Natural Armor                                        | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/9KCqZVsgXUMe94xF` | Rock Catching                                        | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/9KPG9fnmkN8bUNZ1` | Ratfolk                                              | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/9N7VsvYAiSscXsrO` | Human-Raised (Elf)                                   | alternate        | held: `racial-traits-389-whole-content-9N7VsvYAiSscXsrO`         |
| `pf1-content/9OUQasjjI37WIe73` | Crystalline Form                                     | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/9OwO9MvEVZTmwTch` | Pyromaniac                                           | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/9bVCgccjlCuW7YyP` | Primitive Feat                                       | standard         | held: `racial-traits-389-whole-content-9bVCgccjlCuW7YyP`         |
| `pf1-content/9gJfWz14zoOymrv3` | Languages (Deep One Hybrid)                          | standard         | held: `racial-traits-389-whole-content-9gJfWz14zoOymrv3`         |
| `pf1-content/9iLQf70RGSRIPYMK` | Sound Mimicry                                        | alternate        | held: `racial-traits-389-whole-content-9iLQf70RGSRIPYMK`         |
| `pf1-content/9j5vSsuKVhLdukD1` | Speed (Naiad)                                        | standard         | held: `racial-traits-389-whole-content-9j5vSsuKVhLdukD1`         |
| `pf1-content/9jQBQeKCWdpqTw8e` | Water Child                                          | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/9k7IPymCwkmHyI9O` | Kitsune                                              | standard         | held: `racial-traits-389-whole-content-9k7IPymCwkmHyI9O`         |
| `pf1-content/9krrIkXBMYXxnEaE` | Ancestral Grudge                                     | alternate        | held: `racial-traits-389-whole-content-9krrIkXBMYXxnEaE`         |
| `pf1-content/9lCx7sugVXLoYbIW` | Energy Resistance (Undine)                           | standard         | held: `racial-traits-389-whole-content-9lCx7sugVXLoYbIW`         |
| `pf1-content/9pH6zwWU6Dx2iFOf` | Darkvision (Grippli)                                 | standard         | held: `racial-traits-389-whole-content-9pH6zwWU6Dx2iFOf`         |
| `pf1-content/9qNVpJF05oCI1Yys` | Scent                                                | standard         | held: `racial-traits-389-whole-content-9qNVpJF05oCI1Yys`         |
| `pf1-content/9rgAk3kusF0mIBqN` | Duskwalker                                           | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/9sUmaDnJrKxJ9cWs` | Improved Resistance                                  | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/9yQcbZtiXfYObTnT` | Normal Speed (Strix)                                 | standard         | held: `racial-traits-389-whole-content-9yQcbZtiXfYObTnT`         |
| `pf1-content/A10bGnJLwJi8CJF1` | Vine Leshy                                           | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/A1z2rNp515JFLlYf` | Hatred                                               | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/A25WUoiogbprnnzS` | Shadowhunter (Elf)                                   | alternate        | held: `racial-traits-389-whole-content-A25WUoiogbprnnzS`         |
| `pf1-content/A7bikGavod3dmWDl` | Feral                                                | alternate        | held: `racial-traits-389-whole-content-A7bikGavod3dmWDl`         |
| `pf1-content/A7tmAPKpiadhaETe` | Aphorite                                             | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/AB09rH3NmgxxXdPf` | Darkvision (Trox)                                    | standard         | held: `racial-traits-389-whole-content-AB09rH3NmgxxXdPf`         |
| `pf1-content/ACFSI8aOJAYr89QM` | Darkvision (Dwarf)                                   | standard         | held: `racial-traits-389-whole-content-ACFSI8aOJAYr89QM`         |
| `pf1-content/ACSn93JmJ1nTtpeY` | Acid Breath                                          | alternate        | held: `racial-traits-389-whole-content-ACSn93JmJ1nTtpeY`         |
| `pf1-content/AE3fr8WwJINix2Gr` | Standard                                             | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/AEFbxJZ9Hr6LIT9l` | Knack with Poison                                    | alternate        | held: `racial-traits-389-whole-content-AEFbxJZ9Hr6LIT9l`         |
| `pf1-content/AFP9GQ29lljZExvS` | Arcane Focus                                         | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/AFcmD01ppFbl5l9P` | Drow-Trained                                         | alternate        | held: `racial-traits-389-whole-content-AFcmD01ppFbl5l9P`         |
| `pf1-content/AGG9Qo3pfg5Z2aag` | Racial Traits                                        | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/AGGcFN0G8bNdPlmt` | Healthy                                              | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/AJ0skaMigV1GU6fG` | See in Darkness                                      | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/AKuDJrwJUZULsJcS` | Skilled (Tiefling)                                   | standard         | held: `racial-traits-389-whole-content-AKuDJrwJUZULsJcS`         |

## Notable cases

- **Changeling heritages.** Ability Modifiers (Sorrow May) and (Virga May) are Subrace Standard ability records: their imported untyped changes are their Modifiers and they replace the changeling's Ability Modifiers trait by name. The resolver test shows the changeling's +2 Wis, +2 Cha, −2 Con going dormant for Sorrow May's +2 Int, +2 Wis, −2 Con; the saved-sheet test does the same through public Convex writes, with Hag Magic (ISR) making the changeling's natural armor dormant.
- **Round Ears** replaces Keen Senses (Half-Elf) (#387): the resolver test shows its +2 Perception going dormant. Gaining the human skilled trait stays readable.
- **Caster level Situations.** Serpent Affinity (racial, Scalykind domain), Creator's Legacy (untyped, Plant domain), Stoneseer (earth spells) and Object of Desire (charm person and charm monster) are local Situations on `casterLevel`.
- **Shared Situations** only where the condition matches exactly: enchantment (Secretive), fear (Stoic), death (Fey Fortitude), poison (Knack with Poison). The divination, emotion and accidental-poisoning conditions stay local; Knack with Poison's +2 and +4 are racial in one entry, so the larger applies.
- **Feral (Orc)** gains a damage Modifier beside the drafter's attack Modifier: the body gives the +1 on melee attack and damage rolls at negative hit points.
- **Foundry `conChecks`** (Constitution checks) is never put on concentration (the drafter's mapping, `scripts/catalog/curation.ts:519`, already reported in #357 and #370): Tenacious and Take to the Water keep their rules as Notes and their `conChecks` records are covered/no-output.
- **Primitive Feat** cites only a Paizo blog post: its notice is held as `racial-traits-389-notice-primitive-human-blog-complete-chain` (the same notice #328 holds for the race), and the bonus feat stays unsupported by the existing reviewed rule.
- **Inherited rules the bodies name:** the Scalykind domain (Serpent Affinity cites the Inner Sea World Guide, PZO9226), the verdant sorcerer bloodline (APG) and the bloodrager class (ACG) for Creator's Legacy, the witch spell list (APG) for Hag Magic (ISR), and the scorpion whip (Ultimate Equipment, its pinned weapon record) for Lashvine.
- **PRD differences recorded, not resolved:** Spell-Like Ability (Dhampir) reads "character level" where the PRD reads "class level"; Deep Warrior and Silent Hunter follow their APG rows' wording; Skilled (Tiefling) adds the bloodline sentence.
- **Not modeled, listed:** senses, speeds, spell-like abilities and breath weapon, natural attacks, creature types, class-skill grants, languages, bonus feat grants (Shaman's Apprentice, Human-Raised, Adoptive Parentage, Primitive Feat), Shards of the Past's two chosen skills, energy resistance, morale-bonus and Intimidate DC rules.

## Importer and data gaps

- **Header not read (own entry; neither #738 nor #739).** Adoptive Parentage (Weapon Focus) splits "Replaced Trait(s)" over two bold tags (`<strong>Replaced</strong> <strong>Trait(s)</strong>`), so the importer reports a missing header and reads no replacement of Bonus Feat.
- **Drafter target (own entry, known):** `conChecks` maps to `concentration` in `scripts/catalog/curation.ts:519`; Foundry's `conChecks` is Constitution checks.
- **Unresolved replaced names:** Object of Desire ("Green Widow", the green hag changeling trait, which pf1-content has no record of). Feral (Half-Orc), Drow-Descended and Nomadic keep "Base Statistics" unmatched, as racial subtypes do.
- **Bundled traits:** the racial subtypes' bundled alternates are not granted (no reviewed bundle rule).
- The raw upstream keys in `mapRacialTrait` caused no reference failure: the full preview has no failure for any batch key; the bounded preview's 41 failures are links and replacements outside the selection.
- No linked pf-items record is missing. There is no Orc Atavism, no replacement of a counts-as trait, no heritage resolving to a `local/` trait and no multi-race "Base Statistics" folder in this batch.

## Outstanding mechanics

Each record lists its calculation gaps in `mechanicsReview.outstandingCalculations`; none is an attribution hold. The main ones are listed under Notable cases ("Not modeled").

## Cross-batch bindings and protected records

- **Rebased onto #387 (`00023d38`).** All re-binds below use `buildAssessmentBinding` over a full `catalog:preview` of the rebased tree, which has both batches' records, with the matching inventory `currentBinding` and preview fixture updated. Nothing else changed in the earlier batches.
- **#524 Fey Boon** (`pf1/JYgzYISWlo5CQQg3`, `spells-524`) covers Greed (Dwarf) (#387) and Darkvision (Dwarf) (this batch) through the Dwarf race. Its content fingerprint is now `b3b04e7f…` (it was `f26e293d…` on the old base, `5d7a59a6…` after #387). Both entries in `tests/fixtures/spells-524/binding-preview.json` equal #524's own re-import, and the fixture-based binding agrees. #524's inventory records no `currentBinding`.
- **#387, eight re-bound assessments** whose closures reach this batch's keys:

  | #387 record                                           | Reaches                                                 | Content fingerprint       |
  | ----------------------------------------------------- | ------------------------------------------------------- | ------------------------- |
  | Alternate Spell-Like Ability (Dhampir - Ancient-Born) | Spell-Like Ability (Dhampir)                            | `2e0d605d…` → `53df6868…` |
  | Alternate Spell-Like Ability (Dhampir - Svetocher)    | Spell-Like Ability (Dhampir)                            | `2a3a2452…` → `e9ee3131…` |
  | Minesight (Dwarf)                                     | Darkvision (Dwarf)                                      | `b5970bf8…` → `3a070bc6…` |
  | Dusksight (Dwarf)                                     | Darkvision (Dwarf)                                      | `f2e07b7c…` → `49d92b43…` |
  | Ekujae Elves                                          | Silent Hunter, Light against Darkness                   | `3db24538…` → `f50133fe…` |
  | Submerged                                             | Water Dependent                                         | `56d552d8…` → `7bc2a1ce…` |
  | Rimesoul (Frost Undine)                               | Energy Resistance (Undine), through the undine's traits | `c7beb4da…` → `d105cb0e…` |
  | Div-Spawn (Spitespawn)                                | Skilled (Tiefling), through the tiefling's traits       | `266c6abb…` → `f6a92a39…` |

  `scripts/catalog/legal/racial-traits-387.json` (`currentBinding`) and `tests/fixtures/racial-traits-387/preview.json` (closure copies) record them; `racial-traits-387.test.ts` checks them.

- **This batch, re-bound after the rebase:** Round Ears (`87be4f77…` → `9dba302a…`, reaches #387's Keen Senses (Half-Elf)) and Dragon-Scaled (`6cee3281…` → `c4ee93d4…`, reaches #387's Armor (Kobold)).
- **Already stale, not re-bound:** the 25 #328 race assessments that reach batch keys were stale on the base (the deferred stale set, curation.md) and are left for the post-curation cleanup.
- **#388 (in parallel):** Feral (Half-Orc) reaches #388's Forest Walker (Half-Orc), and #388's Surface Survivalist reaches Darkvision (Dwarf); the later lander re-binds.
- Earlier fixtures that copy batch keys (#355's `binding-preview.json` copies Past-Life Knowledge (Ghoran) and Vishkanya; #524, #719, #720, #721) were checked by their tests and `cross-batch-bindings.test.ts`: no other binding changes. No pf-traits key is in this batch's closures.

## Binding

Every assessment is bound with `buildAssessmentBinding` against the full-corpus content closure: the final full `catalog:preview` artifact, with the batch's 70 entries and their 73 closure entries. The [preview fixture](../../tests/fixtures/racial-traits-389/preview.json) keeps both, so the batch test rebuilds every binding from a clean shared-store tree (0 mismatches).

## Tests

The [resolver tests](../../tests/catalog/racial-traits-389.test.ts) pin the reviewed values through the public resolver (every Situation-gated bonus off by default and on when selected, the shared Situations not stacking within an entry, imported changes not curated twice, the changeling heritages replacing the changeling ability trait, Round Ears making Keen Senses dormant, no `ac.other` armor, shield or natural armor bonus); all 32 required and 70 description records checked, the three covered/no-output records and the Note targets; the race, alternate, monster-ability, cited and Unchained notice dependencies (17 PZO1131 keys, own action versus bound body) and every enforced hold; the importer's reading of race, standard flag and replacements; every pinned body, PCGen row and PRD paragraph in the shared store; and re-extraction from a clean shared-store tree with every binding reproduced and a confirmed Darkvision (Dwarf) still held.

The [isolated saved-sheet test](../../tests/catalog/racialTraits389.integration.test.ts) exercises public Convex reads and writes: a changeling-identity race granting its ability and natural armor traits takes the held Sorrow May heritage and Hag Magic (ISR), and turns the heritage off again, with saved totals equal to the preview; outsiders, anonymous callers and another campaign's entry are refused without changing the sheet. The shared held-release round trip is covered once by the release test in [`traits367.integration.test.ts`](../../tests/catalog/traits367.integration.test.ts). No deployment or production activation occurred.

## Preservation and gates

The shared canonical files gain only this batch's entries: 102 curation records (70 description and 32 note records), 70 assessments, 70 evidence entries and 37 notice holds. The other changes are the listed re-binds: Fey Boon and its fixture entry, and the eight #387 assessments with their `currentBinding` and preview fixture copies. Diff stat against `00023d38` (`git diff --cached --stat --diff-algorithm=histogram`):

```text
 scripts/catalog/legal/held-notices.json           |  347 ++++
 scripts/catalog/legal/racial-traits-387.json      |   16 +-
 scripts/catalog/reviewed-curation.json            | 2127 +++++++++++++++++++++
 src/lib/catalog/data/attribution-assessments.json | 1674 +++++++++++++++-
 src/lib/catalog/data/attribution-evidence.json    |  210 ++
 tests/fixtures/racial-traits-387/preview.json     |   72 +-
 tests/fixtures/spells-524/binding-preview.json    |    5 +
 7 files changed, 4411 insertions(+), 40 deletions(-)
```

<!-- prep:shared-store-count -->
New shared-store files (`tests/fixtures/pinned/`), counted by prep after the rebase onto `00023d38`: **180** (pcgen 12, pf1 20, pf1-content 141, prd 7).
<!-- /prep:shared-store-count -->

The batch adds to the shared store its 100 pinned records, the pf-racial-traits folder records above them, the pinned race records they bind to, the linked bodies (spells, feats and racial traits), the PCGen race-ability, class and anchor files the evidence cites, and the PRD capture pages; files already on the base were reused. Many of these are also added by #387, byte-identical.

The complete preview reported **86 admitted, 23,168 held, 2 dependent omissions and 2,682 failures** on `9974c36c`, 32 fewer than that base's 2,714: this batch's required note records. Rebased onto `00023d38` (#387), it reports 2,647, 32 fewer than that base's 2,679. No batch key is among the failures. The full-corpus gate is therefore a documented failure, not a claim of whole-corpus readiness.

| Command                                                                                                                                                                                                                                                                                               | Result                                                                                                                              |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `catalog:curate --candidates …` (required) and `--descriptions` (prose pass)                                                                                                                                                                                                                          | pass; 32 required drafts, 11 prose drafts                                                                                           |
| `catalog:preview --candidates …`                                                                                                                                                                                                                                                                      | exit 1; 0 admitted / 29 held / 41 failures: links and replacements outside the selection (the full preview has none for this batch) |
| Full `catalog:curate`                                                                                                                                                                                                                                                                                 | pass; 1,576 new drafts, none for this batch; 0 missing; 0 stale; about 2.8 min                                                      |
| Full `catalog:preview`                                                                                                                                                                                                                                                                                | exit 1; 2,682 failures, none for this batch; about 3.8 min                                                                          |
| Full re-bind (`buildAssessmentBinding` over the final full preview)                                                                                                                                                                                                                                   | inventory, assessments and preview fixture reproduced; 0 mismatches against the clean-tree reconstruction                           |
| `pnpm test tests/catalog/racial-traits-389.test.ts tests/catalog/racialTraits389.integration.test.ts` (one worker)                                                                                                                                                                                    | pass; 2 files / 8 tests                                                                                                             |
| `pnpm test` of the guards (`notice-holds`, `pinned-sources`, `cross-batch-bindings`, `ac-other-defense-bonuses`, `notice-dependencies`, `data-files`) and the affected earlier tests (`spells-524`, `feats-355`, `racial-traits-719`, `race-facts-720`, `race-ability-721`, `races-328`) (one worker) | pass; 12 files / 399 tests; about 3.2 min                                                                                           |
| `pnpm -s typecheck`                                                                                                                                                                                                                                                                                   | pass                                                                                                                                |
| `pnpm -s lint`                                                                                                                                                                                                                                                                                        | pass; about 2.6 min                                                                                                                 |
| `pnpm -s check:initial-migration-writers`                                                                                                                                                                                                                                                             | pass; 185 registrations                                                                                                             |
| `pnpm catalog:pin`                                                                                                                                                                                                                                                                                    | pass; `sha256:005ef0b9…`                                                                                                            |
| `pnpm catalog:notice-deps`                                                                                                                                                                                                                                                                            | pass; 0 gaps; 38 advisory warnings, none for this batch                                                                             |
| `pnpm catalog:format --check`                                                                                                                                                                                                                                                                         | pass                                                                                                                                |

`pnpm test tests/catalog` was left to the orchestrator's prep run on the rebased commit, as the brief directs.
