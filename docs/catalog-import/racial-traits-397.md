# Racial traits #397: pf1-content pf-racial-traits batch 11

Reviewed by **Opus (AI curator) for the owner**, 2026-10-20.

Exactly the issue's 100 ordered, unique keys were reviewed: **0 admitted, 82 specifically held, 0 dependent omissions, 0 whole-entry unsupported/prose-only dispositions, 18 exclusions, 0 record-level 3.5 holds**. The exclusions are 6 Foundry `!folders!` records, which the importer's folder contract leaves out of the Catalog Entries (PRD Decision 17), and 12 records in the Advanced Race Guide Race Builder subtree, which the import contract excludes by folder ancestry ([README](README.md), explicit exclusions) and the [Racial Trait contract](../character-sheet/racial-traits.md) puts out of scope. No candidate carries a `3.5` tag. The 82 in-scope records are 29 standard racial traits (9 of them in flat race folders), 41 alternates (one, Repairing Nanites, in a flat folder with a "Replaced Trait(s)" header), 5 Subrace Standard heritage parts and 7 Subraces-folder heritages, racial subtypes or ethnicities.

The [machine-readable inventory and evidence](../../scripts/catalog/legal/racial-traits-397.json) records, per key, the complete pinned body and inert fields with their source hash and cited sources; the PCGen race-ability rows, PRD Advanced Race Guide paragraphs, leads and rejected rows; the inherited-rule notices with their evidence, the linked bodies and the unresolved origins; the importer's reading of race, standard flag and replacements; every checked curation record, source discrepancies and calculation gaps; and the current assessment binding and mapped facts. This report summarizes them and does not repeat the evidence.

## #328 S4-B launch update

Reviewed 2026-11-01 by **Sol (AI curator) for the owner** ([races-328.md](races-328.md#s4-b-launch-half-elf-elf-gnome-and-halfling)). The S4-B launch review confirms 4 standard racial traits of Half-Elf, Elf, Gnome and Halfling with content-bound assessments; counts are now **4 admitted, 78 held**, with 18 exclusions unchanged. The earlier Opus review of each row stays in its `assessmentHistory`; every other candidate keeps its review and holds.

- **Keen Senses (Halfling)** (`pf1-content/XVo4DApULZaETYcz`): matches the PRD ARG paragraph (`advancedRaceGuide/coreRaces/halflings.html:369`) word for word; PCGen's Core Essentials row (`halfling/halfling_abilities_race.lst:23`) with the recorded DESC differences. Its Modifier is +2 racial Perception (skill.per). Required notices: PZO9280, PZO1121, PZO1110.
- **Illusion Resistance** (`pf1-content/YHwpeek5IHtcZNDF`): matches the PRD ARG paragraph (`advancedRaceGuide/coreRaces/gnomes.html:373`) apart from "get" for "gain"; no "saving throw"; an added "on saving throws"; "or" for "and"; PCGen's Core Essentials row (`gnome/gnome_abilities_race.lst:25`) with the recorded DESC differences. Its Modifier is +2 racial on saves in the shared Situation illusions, re-homed from the Gnome's checked note record. Required notices: PZO9280, PZO1121, PZO1110.
- **Languages (Halfling)** (`pf1-content/YMocjN3SlwHoQgW1`): matches the PRD ARG paragraph (`advancedRaceGuide/coreRaces/halflings.html:372`) apart from an added "languages"; PCGen's Core Essentials row (`halfling/halfling_abilities_race.lst:26`) with the recorded DESC differences. Languages (Common and Halfling; the bonus-language list) stay readable prose; the record's languages field stays in gameContent. Required notices: PZO9280, PZO1121, PZO1110. Outstanding: Languages are permitted prose; no language statistic.
- **Languages (Gnome)** (`pf1-content/ZaTEe0kZxKJuYYjT`): matches the PRD ARG paragraph (`advancedRaceGuide/coreRaces/gnomes.html:377`) apart from an added "languages"; PCGen's Core Essentials row (`gnome/gnome_abilities_race.lst:29`) with the recorded DESC differences. Languages (Common, Gnome and Sylvan; the bonus-language list) stay readable prose; the record's languages field stays in gameContent. Required notices: PZO9280, PZO1121, PZO1110. Outstanding: Languages are permitted prose; no language statistic.

Each row's whole-content hold ("Book PDFs unavailable") is superseded by this comparison, and it records no notice hold: PZO1110 is reviewed, PZO1121's Registry hold and `racial-traits-397-notice-PZO1121-complete-chain` are cleared (`notice-clearances.json`, owner 2026-10-30), and PZO9280's reviewed confirmation waives `racial-traits-397-notice-PZO9280-complete-chain`. The batch's `noticeRequirements` rows keep these keys as history. Content fingerprints are unchanged (the imported entries are identical); only the status, rationale, evidence and notice bindings move.

Tests: `racial-traits-397.test.ts` checks the confirmed rows with the held ones (`assessedTraits` in the fixture), expects them admitted by the committed gate and records no hold for them. The uncleared-holds control moves from the admitted Keen Senses (Halfling) to Duergar Immunities.

## Family rulings applied

This batch follows the #387 rulings Sol approved for the family:

1. **Every in-scope record is held** with a whole-content hold: the race records stay held (#328), every cited book's notice chain is held (37 batch notice holds, registered in `held-notices.json`), and no book PDFs are available.
2. **Race abilities.** Every record requires the books its pinned race record cites. Lashunta Magic's folder binds no race record (raceKeys empty), so both Lashunta race records' books are recorded, as #393 did.
3. **Alternate framework.** Every alternate records the APG alternate racial trait rule (PZO1115, `apg_abilities_race.lst:86`).
4. **Monster abilities** take the earliest book the pinned Universal Monster Rules page lists: darkvision PZO1127; low-light vision, telepathy, ferocity, breath weapon, spell resistance, natural attacks, scent, damage reduction and resistance PZO1112; freeze and unnatural aura PZO1116.
5. **Creature types** (aberration, humanoid/sasquatch, dragon, plant, the native outsider type Scion of Shadows counts as, and the giant subtype, undead and humans the Situations name) stay named unresolved origins.
6. **PZO1131** for Unchained action-cost metadata anywhere in the bound closure: 24 records (16 on their own actions, 19 through bound bodies, 11 both). The two heritages with a curated ability line reach their race's standard traits through the race's ability score trait.
7. **Comparisons.** PCGen race-ability rows from a pinned book are the `comparison` (40 records); Core Essentials support rows (no SOURCELONG book) are leads whose book is not required (23 records with only leads). 18 records carry a PRD `prdComparison` from the pinned capture (11 match word for word). Subrace Standard parts take no PRD paragraph.
8. **Description pass.** Every in-scope record has a checked description record: its reviewed Modifiers plus an entry-level Note with the body (`@Distance` read as feet, `@Toggle` buff controls and empty "Related buff" lines removed, HTML entities decoded). Variant Aasimar Abilities' d% table exceeds 4,096 characters, so its Note is split at line boundaries into three.
9. **Racial bonuses from distinct Sources stack**; the resolver test shows Slag Child's and Abandoned's +2 racial Stealth giving +4 together. The #735 admission policies don't bear on this batch (no spells or CRB feats).

## Dispositions

| Key                            | Name                                     | Kind             | Disposition                                                      |
| ------------------------------ | ---------------------------------------- | ---------------- | ---------------------------------------------------------------- |
| `pf1-content/XVm7uHb6cw0AiUOh` | Voice in the Darkness (Dwarf)            | alternate        | held: `racial-traits-397-whole-content-XVm7uHb6cw0AiUOh`         |
| `pf1-content/XVo4DApULZaETYcz` | Keen Senses (Halfling)                   | standard         | held: `racial-traits-397-whole-content-XVo4DApULZaETYcz`         |
| `pf1-content/XWa9YUpaCR5IIqUp` | Keeper of Secrets                        | alternate        | held: `racial-traits-397-whole-content-XWa9YUpaCR5IIqUp`         |
| `pf1-content/XXB7Lnp9pMBlS5Or` | Mountain-Born                            | alternate        | held: `racial-traits-397-whole-content-XXB7Lnp9pMBlS5Or`         |
| `pf1-content/XZ3s0IdjhSq3q7ty` | Duergar Immunities                       | standard         | held: `racial-traits-397-whole-content-XZ3s0IdjhSq3q7ty`         |
| `pf1-content/XdFu6LxD4n4AqxwW` | Low-Light Vision (Triaxian)              | standard         | held: `racial-traits-397-whole-content-XdFu6LxD4n4AqxwW`         |
| `pf1-content/XeTk87emHjwZG6SF` | Elven Immunities                         | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/XhtOzYgJSTJCxIU9` | Emotionless                              | standard         | held: `racial-traits-397-whole-content-XhtOzYgJSTJCxIU9`         |
| `pf1-content/XimaceQ6IAlJuIDD` | Skilled (Aasimar - Musetouched)          | subrace standard | held: `racial-traits-397-whole-content-XimaceQ6IAlJuIDD`         |
| `pf1-content/XixpDZG7W0XELNni` | Shadow Magic (Wayang)                    | standard         | held: `racial-traits-397-whole-content-XixpDZG7W0XELNni`         |
| `pf1-content/XlXhCGpR8I2KUNA5` | Aberration                               | standard         | held: `racial-traits-397-whole-content-XlXhCGpR8I2KUNA5`         |
| `pf1-content/XpZ3k2gmqEF6xnuE` | Abandoned                                | alternate        | held: `racial-traits-397-whole-content-XpZ3k2gmqEF6xnuE`         |
| `pf1-content/Xq02Qwpj4FBfGGJn` | Surfacer Antagonist                      | alternate        | held: `racial-traits-397-whole-content-Xq02Qwpj4FBfGGJn`         |
| `pf1-content/Xx0q0xnySBBY3OUr` | Giant Hunter                             | alternate        | held: `racial-traits-397-whole-content-Xx0q0xnySBBY3OUr`         |
| `pf1-content/Y1iG4W1jyaklHBvd` | Shadow Magic (Fetchling)                 | alternate        | held: `racial-traits-397-whole-content-Y1iG4W1jyaklHBvd`         |
| `pf1-content/YAHItKOPu2o8Mrsd` | Spiritual Support                        | alternate        | held: `racial-traits-397-whole-content-YAHItKOPu2o8Mrsd`         |
| `pf1-content/YGtcHB3bvToAoHdx` | Languages (Astomoi)                      | standard         | held: `racial-traits-397-whole-content-YGtcHB3bvToAoHdx`         |
| `pf1-content/YHwpeek5IHtcZNDF` | Illusion Resistance                      | standard         | held: `racial-traits-397-whole-content-YHwpeek5IHtcZNDF`         |
| `pf1-content/YIkZ9egduASu6nLh` | Savage Elf                               | subrace          | held: `racial-traits-397-whole-content-YIkZ9egduASu6nLh`         |
| `pf1-content/YKpeR15lHx8u2iZc` | Fire Affinity                            | standard         | held: `racial-traits-397-whole-content-YKpeR15lHx8u2iZc`         |
| `pf1-content/YLr7f3djG85wvbAT` | Kitsune Magic                            | standard         | held: `racial-traits-397-whole-content-YLr7f3djG85wvbAT`         |
| `pf1-content/YMocjN3SlwHoQgW1` | Languages (Halfling)                     | standard         | held: `racial-traits-397-whole-content-YMocjN3SlwHoQgW1`         |
| `pf1-content/YQqgLh49YxGpID1c` | Keen Kitsune                             | alternate        | held: `racial-traits-397-whole-content-YQqgLh49YxGpID1c`         |
| `pf1-content/YSxpFFK2fBXMUzvg` | Overwhelming Magic                       | alternate        | held: `racial-traits-397-whole-content-YSxpFFK2fBXMUzvg`         |
| `pf1-content/YT2mzeumGiD8Jpjx` | Elemental Summoner                       | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/YVLqOvoVgCUaKNZc` | Bonus Feat (Triaxian)                    | standard         | held: `racial-traits-397-whole-content-YVLqOvoVgCUaKNZc`         |
| `pf1-content/YXENRUGtna36lnM6` | Ferocity (Green Martian)                 | standard         | held: `racial-traits-397-whole-content-YXENRUGtna36lnM6`         |
| `pf1-content/YZ1WIRlAYAAfvbBR` | Creepy Doll                              | alternate        | held: `racial-traits-397-whole-content-YZ1WIRlAYAAfvbBR`         |
| `pf1-content/Yauhqdv1M3VrpYQr` | Skinwalker                               | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/Yf2qON3uChdJ12SK` | Shadow Sorcery                           | alternate        | held: `racial-traits-397-whole-content-Yf2qON3uChdJ12SK`         |
| `pf1-content/Yfywu8kU3UraGzlN` | Drow Immunities                          | standard         | held: `racial-traits-397-whole-content-Yfywu8kU3UraGzlN`         |
| `pf1-content/Yjq7MRAd5xn6GdPo` | Blended View (Gnome)                     | alternate        | held: `racial-traits-397-whole-content-Yjq7MRAd5xn6GdPo`         |
| `pf1-content/YlKYsD3BivO85L7h` | Fey Thoughts (Gnome)                     | alternate        | held: `racial-traits-397-whole-content-YlKYsD3BivO85L7h`         |
| `pf1-content/Ym8MKzritdKsuKGX` | Mountain Dwarf                           | subrace          | held: `racial-traits-397-whole-content-Ym8MKzritdKsuKGX`         |
| `pf1-content/Yo8LrR6TY4Hq0T6A` | Arcane Focus                             | alternate        | held: `racial-traits-397-whole-content-Yo8LrR6TY4Hq0T6A`         |
| `pf1-content/YoZiTsd9x0KSCOi7` | Repairing Nanites                        | alternate        | held: `racial-traits-397-whole-content-YoZiTsd9x0KSCOi7`         |
| `pf1-content/YrJvLipI70b73JIP` | Hag Racial Trait (Changeling - Moon May) | subrace standard | held: `racial-traits-397-whole-content-YrJvLipI70b73JIP`         |
| `pf1-content/YsUd35wRZBO17r05` | Ekujae Half-Elves (Wildborn)             | subrace          | held: `racial-traits-397-whole-content-YsUd35wRZBO17r05`         |
| `pf1-content/Yu6sNWsnd5R2TDkF` | Alternate                                | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/Yw9TH7PWecvfDLfo` | Senses (Svirfneblin)                     | standard         | held: `racial-traits-397-whole-content-Yw9TH7PWecvfDLfo`         |
| `pf1-content/Z1Ocephff1ZmBels` | Type                                     | standard         | held: `racial-traits-397-whole-content-Z1Ocephff1ZmBels`         |
| `pf1-content/Z4bfgptrjWdN7Ugb` | Neglected Heritage                       | alternate        | held: `racial-traits-397-whole-content-Z4bfgptrjWdN7Ugb`         |
| `pf1-content/Z7uj8OS11fVPBEnf` | Slow Speed (Grindylow)                   | standard         | held: `racial-traits-397-whole-content-Z7uj8OS11fVPBEnf`         |
| `pf1-content/ZDYzHXisxHABCWza` | Stoic Defender                           | alternate        | held: `racial-traits-397-whole-content-ZDYzHXisxHABCWza`         |
| `pf1-content/ZEVsEIPpOyHmpmEe` | Spell-Like Ability (Skinwalker)          | standard         | held: `racial-traits-397-whole-content-ZEVsEIPpOyHmpmEe`         |
| `pf1-content/ZFVNOsJgL22XRdCf` | Keen Senses (Triaxian)                   | standard         | held: `racial-traits-397-whole-content-ZFVNOsJgL22XRdCf`         |
| `pf1-content/ZJVdNI7JLIsgnQYz` | Lashunta Magic                           | standard         | held: `racial-traits-397-whole-content-ZJVdNI7JLIsgnQYz`         |
| `pf1-content/ZLFxIufcHBwiIZrl` | Werebear-Kin (Coldborn)                  | subrace          | held: `racial-traits-397-whole-content-ZLFxIufcHBwiIZrl`         |
| `pf1-content/ZLN55d8hUbX0lqfm` | Tree-Born                                | alternate        | held: `racial-traits-397-whole-content-ZLN55d8hUbX0lqfm`         |
| `pf1-content/ZMQQj44B2SyxuQfa` | Sky Sentinel                             | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/ZNVm3oevo81HnWIj` | Burrow                                   | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/ZP4KHOyP79pyrBpj` | Warded Skin (Rainkin)                    | alternate        | held: `racial-traits-397-whole-content-ZP4KHOyP79pyrBpj`         |
| `pf1-content/ZR7KbJlVZV68puBM` | Mental Potency                           | standard         | held: `racial-traits-397-whole-content-ZR7KbJlVZV68puBM`         |
| `pf1-content/ZTMNDc8mw9C76y6N` | Spell-Like Ability (Sylph - Stormsoul)   | subrace standard | held: `racial-traits-397-whole-content-ZTMNDc8mw9C76y6N`         |
| `pf1-content/ZTWGeyfa4ZAfOEUg` | Weakness                                 | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/ZUlAuMYGeCq9IacX` | Slag Child                               | alternate        | held: `racial-traits-397-whole-content-ZUlAuMYGeCq9IacX`         |
| `pf1-content/ZW41vB78wXvRWWfs` | Variant Aasimar Abilities                | alternate        | held: `racial-traits-397-whole-content-ZW41vB78wXvRWWfs`         |
| `pf1-content/ZaTEe0kZxKJuYYjT` | Languages (Gnome)                        | standard         | held: `racial-traits-397-whole-content-ZaTEe0kZxKJuYYjT`         |
| `pf1-content/ZbgLHBTJ3bRT1EOL` | Low-Light Vision (Human)                 | alternate        | held: `racial-traits-397-whole-content-ZbgLHBTJ3bRT1EOL`         |
| `pf1-content/ZcsLGOJvBPgRU44u` | Mixed Weakness                           | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/ZgLH2eQ5rU5fIacW` | Multidisciplined                         | alternate        | held: `racial-traits-397-whole-content-ZgLH2eQ5rU5fIacW`         |
| `pf1-content/ZhYhsUrSYFcjmhFP` | World Walker                             | alternate        | held: `racial-traits-397-whole-content-ZhYhsUrSYFcjmhFP`         |
| `pf1-content/ZnBQOspblXzYNloj` | Barrow Warden                            | alternate        | held: `racial-traits-397-whole-content-ZnBQOspblXzYNloj`         |
| `pf1-content/ZneAhwOUybzPmMju` | Vulnerable to Sunlight                   | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/ZqhbmdIOaUZZ0XR2` | Standard                                 | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/ZrJZFJuLYsZjVWQZ` | Normal Speed                             | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/Zty4nj3QFPOC0hYX` | Breath Weapon (Dwarf)                    | alternate        | held: `racial-traits-397-whole-content-Zty4nj3QFPOC0hYX`         |
| `pf1-content/a03q4Mfcd53p7Gor` | Alternate                                | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/a1AfZ5mrHLJQp6gs` | Dragon                                   | standard         | held: `racial-traits-397-whole-content-a1AfZ5mrHLJQp6gs`         |
| `pf1-content/a1otKF9eFw6gSfvB` | Gemsoul (Crystal Oread)                  | subrace          | held: `racial-traits-397-whole-content-a1otKF9eFw6gSfvB`         |
| `pf1-content/a6QMB7qmZaaw9Gqs` | Fey-Quickened                            | alternate        | held: `racial-traits-397-whole-content-a6QMB7qmZaaw9Gqs`         |
| `pf1-content/a7nraRpo1VzmXYAj` | Prehensile Tail (Monkey Goblin)          | standard         | held: `racial-traits-397-whole-content-a7nraRpo1VzmXYAj`         |
| `pf1-content/a95VioTuysgFg9EZ` | Adaptable Luck                           | alternate        | held: `racial-traits-397-whole-content-a95VioTuysgFg9EZ`         |
| `pf1-content/aCf51qt2IfxdhWix` | Shadow Agent                             | alternate        | held: `racial-traits-397-whole-content-aCf51qt2IfxdhWix`         |
| `pf1-content/aD19XOFMcxvFTIYY` | Granite Skin                             | alternate        | held: `racial-traits-397-whole-content-aD19XOFMcxvFTIYY`         |
| `pf1-content/aHQ7gYW240ZT65u9` | Languages (Sahuagin)                     | standard         | held: `racial-traits-397-whole-content-aHQ7gYW240ZT65u9`         |
| `pf1-content/aHYxkCLY8pQBIoLm` | Carrion Sense                            | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/aI17hJ5XWlzRbIyx` | Subrace                                  | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/aJGZNcrbFJhbzUaz` | Light Dependent                          | standard         | held: `racial-traits-397-whole-content-aJGZNcrbFJhbzUaz`         |
| `pf1-content/aLTD5kME13aY9UWk` | Scion of Shadows                         | alternate        | held: `racial-traits-397-whole-content-aLTD5kME13aY9UWk`         |
| `pf1-content/aMGMC5XWT62jCouw` | Inspire Imitation                        | alternate        | held: `racial-traits-397-whole-content-aMGMC5XWT62jCouw`         |
| `pf1-content/aMyZawGDkcx9ueCa` | Nimble (Strix)                           | alternate        | held: `racial-traits-397-whole-content-aMyZawGDkcx9ueCa`         |
| `pf1-content/aR6GbtT8EtOqN1XR` | Snowcaster Elves                         | subrace          | held: `racial-traits-397-whole-content-aR6GbtT8EtOqN1XR`         |
| `pf1-content/aTGw0rDBfEtCVnnM` | Nimble Faller                            | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/aUSbW2f3raanHRwv` | Ferrous Growth                           | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/aUftnyakUTetdxwJ` | Standard                                 | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/aVWHlRt22VE801jt` | Darkvision (Yaddithian)                  | standard         | held: `racial-traits-397-whole-content-aVWHlRt22VE801jt`         |
| `pf1-content/aZ0NT0LR405tLHHB` | Occult Scion                             | alternate        | held: `racial-traits-397-whole-content-aZ0NT0LR405tLHHB`         |
| `pf1-content/adLgjvqxTWpAWxFJ` | Plant                                    | standard         | held: `racial-traits-397-whole-content-adLgjvqxTWpAWxFJ`         |
| `pf1-content/afX2SurqCJrV7f4B` | Solar Affinity (Ifrit - Sunsoul)         | subrace standard | held: `racial-traits-397-whole-content-afX2SurqCJrV7f4B`         |
| `pf1-content/agV4JlEfsL4HLNZo` | Truespeaker                              | alternate        | held: `racial-traits-397-whole-content-agV4JlEfsL4HLNZo`         |
| `pf1-content/agovSwSID6zOPIDN` | Sense Thoughts                           | alternate        | held: `racial-traits-397-whole-content-agovSwSID6zOPIDN`         |
| `pf1-content/aqfQQbZuntXaiXS0` | Heavenborn                               | alternate        | held: `racial-traits-397-whole-content-aqfQQbZuntXaiXS0`         |
| `pf1-content/auhlm92jQNA1fE1k` | Sky Citadel Dwarves                      | subrace          | held: `racial-traits-397-whole-content-auhlm92jQNA1fE1k`         |
| `pf1-content/axfKJGcBpA7GCcAC` | Dusksight (Elf)                          | alternate        | held: `racial-traits-397-whole-content-axfKJGcBpA7GCcAC`         |
| `pf1-content/azfCgXs1xkctIQnd` | Energy Resistance                        | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/b4nkYIUM9HzTUL76` | Whispers from Shadow                     | alternate        | held: `racial-traits-397-whole-content-b4nkYIUM9HzTUL76`         |
| `pf1-content/b6I8HENTNj6Gyyg1` | Spell-Like Ability (Aasimar - Emberkin)  | subrace standard | held: `racial-traits-397-whole-content-b6I8HENTNj6Gyyg1`         |
| `pf1-content/b7b9LL5pcA63eOv1` | Spell-Like Ability (Oread)               | standard         | held: `racial-traits-397-whole-content-b7b9LL5pcA63eOv1`         |
| `pf1-content/b8mD388daeaoKidm` | Natural Bounty                           | alternate        | held: `racial-traits-397-whole-content-b8mD388daeaoKidm`         |

## Notable cases

- **Heritage ability lines curated (#387 to #396 precedent).** Gemsoul (Crystal Oread) (+2 Str, +2 Cha, -2 Wis; no PCGen row, as #396's Sunsoul) and Werebear-Kin (Coldborn) (+2 Con, -2 Cha; PCGen's Core Essentials "Werebear-Kin ~ Ability Scores" row agrees) are `reviewedAbilityLineSubraces` heritages. Each line is racial ability Modifiers, so "Base Statistics" resolves to the race's ability score trait, which goes dormant. Werebear-Kin's +2 Wisdom while shapechanged stays readable.
- **Race outputs already on the traits:** Illusion Resistance (Gnome) and Drow Immunities carry their races' re-homed #328 note records (`coveredTraitNotes`); Kitsune Magic and Shadow Magic (Wayang) carry their races' re-homed description spell DCs (`reviewedDescriptionRehomes`); Emotionless carries the Android race's relocated -4 racial Sense Motive change. None gets a second Modifier. **Latent overlap:** Duergar Immunities' "+2 racial vs. spells and spell-like abilities" note is covered/no-output, because the Duergar race's checked #328 description record already gives it. Checked against the race outputs first (#391): no other standard trait duplicates a race Modifier.
- **Pinned records stay unchanged:** Keen Senses (Halfling), Illusion Resistance, Languages (Halfling and Gnome), Shadow Magic (Wayang), Kitsune Magic and Drow Immunities (`racial-traits-719`), Keen Kitsune and Tree-Born (`race-ability-721`), Granite Skin (`race-facts-720`), Abandoned (`import.test.ts`) and Spell-Like Ability (Skinwalker) (`racial-traits-388`) keep their imported outputs; no Modifier is added to a standard trait of a #719 race.
- **Situational bonuses** (manual Situations): Voice in the Darkness (Dwarf), Keeper of Secrets (enchantment DCs against humanoids; Bluff and Linguistics), Giant Hunter, Spiritual Support, Barrow Warden (dodge on `ac`), Arcane Focus (concentration), Surfacer Antagonist, Shadow Magic (Fetchling), Whispers from Shadow, Mountain-Born, Heavenborn (caster level), Neglected Heritage and Hag Racial Trait (Changeling - Moon May) (saves against disease; a Subrace Standard part, so not granted to every changeling). Published types are kept: Giant Hunter, Surfacer Antagonist and Barrow Warden's attack bonus are untyped although the Foundry notes call them racial. No shared Situation matched a new record's condition exactly.
- **Covered/no-output records:** Adaptable Luck's allSavingThrows, attack and skills notes (one entry-level Note states the rule the four Foundry notes repeat) and Duergar Immunities' save bonus note (latent overlap).
- **Inherited rules beyond the race:** Shadow Sorcery records the APG shadow bloodline and the Ultimate Magic shadow descriptor its body cites with a "UM" superscript (PZO1117, the #385 descriptor ruling); Gemsoul the APG deep earth bloodline; Mental Potency the Occult Adventures mesmerist; Occult Scion the Psychic Sensitivity feat (PZO1132); Variant Aasimar Abilities its 18 linked bodies (spells, the Blessing of Courage and Life buff and the Holy weapon ability, PZO1123) and the universal monster rules its results name; Giant Hunter the Rival Guide it cites (PZO9232).
- **Listed for review:** Keen Senses (Triaxian)'s imported Perception bonus is typed racial where the body is untyped, and Emotionless's relocated Sense Motive penalty is typed racial where the body is untyped (a change replacement can't fix a type; held, as #370 did); Inspire Imitation's exchange line says it replaces skilled (the half-elf has none) while its header names Adaptability; Breath Weapon (Dwarf)'s actions add acid to the body's energy types; Ferocity (Green Martian)'s body reads "It it does".
- **Not modeled, listed:** senses, speeds, spell-like abilities and other actions, natural attacks, breath weapons, energy resistance, spell resistance, immunities, creature types and counts-as types, class-skill grants, bonus feats (Overwhelming Magic, Fey-Quickened, Bonus Feat (Triaxian), Occult Scion), languages, per-class Charisma and domain caster level (Fire Affinity, Solar Affinity, Gemsoul's Crystal Affinity), Adaptable Luck's chosen roll and the 100 Variant Aasimar Abilities results.

## Importer and data gaps

- **Creepy Doll** links the pf1 monster-abilities Freeze record, which is no catalog entry (only the generic natural attacks are admitted from that pack). The import strips the link and the record fails admission with "Broken structure or reference: unresolved imported reference." in any preview. This reference gap is neither a #738 journal link nor a #739 prerequisite finding; it is reported here as its own entry, and the rule is recorded from the Universal Monster Rules journal (PZO1116).
- **Natural Bounty's** header names "Spell-Like Ability" where the gathlain trait is "Spell-Like Abilities (Gathlain)", so the importer resolves neither replaced name (#304 behavior, as #394's alternates). **Solar Affinity (Ifrit - Sunsoul)** is a Subrace Standard part whose own name matches no ifrit trait, so it stays unresolved, as #395's Metal Affinity.
- The racial subtypes and ethnicities (Savage Elf, Mountain Dwarf, Snowcaster Elves, Sky Citadel Dwarves, Ekujae Half-Elves (Wildborn)) keep "Base Statistics" unmatched, as designed.
- No #738 or #739 finding, no missing pf-items reference, and the raw upstream keys in `mapRacialTrait` caused no reference failure. Untested cases from the run notes: none in this batch (no counts-as replacement, no `local/` heritage beyond the two curated ability lines, no multi-race "Base Statistics" folder).

## Outstanding mechanics

Each record lists its calculation gaps in `mechanicsReview.outstandingCalculations`; none is an attribution hold. The main ones are the items under Notable cases ("Not modeled").

## Cross-batch bindings and protected records

Curated on `41008f08`. Every re-bind uses `buildAssessmentBinding` over the final full `catalog:preview` with this batch's records, with the earlier batch's fixture copies of this batch's keys replaced by the full-preview entries, the inventory `currentBinding` updated and the fixture-based binding checked to agree (all 43 agree). Only the content fingerprints changed; no disposition, evidence, notice or hold changed in the earlier batches. The 43 are every assessment whose full-corpus closure reaches a batch key and that was fresh on the base (checked with the binding code over the baseline full preview, and re-checked over the final one: all 43 fresh, the other 24 unchanged): 4 from #387, 5 from #388, 2 from #389, 2 from #390, 5 from #391, 3 from #392, 5 from #393, 4 from #394, 4 from #395, 8 from #396 and 1 from #367.

| Batch, assessment                                            | Reaches (this batch)            | Content fingerprint       |
| ------------------------------------------------------------ | ------------------------------- | ------------------------- |
| #387 Unfettered                                              | Keen Senses (Halfling)          | `85267fc5…` → `3932fb4a…` |
| #387 Ekujae Elves                                            | Sense Thoughts                  | `c3f4cfa3…` → `8943f182…` |
| #387 Seducer                                                 | Drow Immunities                 | `27311f76…` → `1dc41cb5…` |
| #387 Spell-Like Ability (Oread - Ironsoul)                   | Spell-Like Ability (Oread)      | `720196e6…` → `f432fc3e…` |
| #388 Acquisitive                                             | Keen Senses (Halfling)          | `1c096ba6…` → `073e452d…` |
| #388 Slave Born                                              | Keen Senses (Halfling)          | `a57d1477…` → `0ab843ad…` |
| #388 Alternate Spell-Like Ability (Skinwalker - Fanglord)    | Spell-Like Ability (Skinwalker) | `4aa98bea…` → `6a87d4e6…` |
| #388 Alternate Spell-Like Ability (Skinwalker - Aerieborn)   | Spell-Like Ability (Skinwalker) | `0546e25e…` → `665a79ce…` |
| #388 Alternate Spell-Like Ability (Skinwalker - Coldborn)    | Spell-Like Ability (Skinwalker) | `b4ece2df…` → `4fb3bf21…` |
| #389 Alternate Spell-Like Ability (Skinwalker - Ragebred)    | Spell-Like Ability (Skinwalker) | `6077edf3…` → `a6ea1a85…` |
| #389 Knack with Poison                                       | Illusion Resistance             | `f6e13f58…` → `0023a7f7…` |
| #390 Dwarf Traits                                            | Duergar Immunities              | `4e76421f…` → `a976c76c…` |
| #390 Shadow Dodger                                           | Illusion Resistance             | `cd36ca22…` → `6547abfd…` |
| #391 Insidious Telepathy                                     | Lashunta Magic                  | `9cfae90b…` → `d2068560…` |
| #391 Shadow Speaker                                          | Shadow Magic (Wayang)           | `76858429…` → `266680f4…` |
| #391 Alternate Spell-Like Ability (Skinwalker - Bloodmarked) | Spell-Like Ability (Skinwalker) | `78edaf59…` → `b2f692be…` |
| #391 Alternate Spell-Like Ability (Skinwalker - Nightskulk)  | Spell-Like Ability (Skinwalker) | `530b20bc…` → `db0b4fd5…` |
| #391 Fey Magic (Gnome - HftF)                                | Illusion Resistance             | `ae38849e…` → `17719319…` |
| #392 Intrepid Settler                                        | Illusion Resistance             | `97fd3b1e…` → `3b5f8537…` |
| #392 Ironsoul (Metal Oread)                                  | Spell-Like Ability (Oread)      | `1e3464ab…` → `7b8f316f…` |
| #392 Ingratiating                                            | Keen Senses (Halfling)          | `40a4cb6a…` → `dc064313…` |
| #393 Mwangi Dwarves                                          | Breath Weapon (Dwarf)           | `5d5fd49f…` → `8c13e21a…` |
| #393 Dusksight (Halfling)                                    | Keen Senses (Halfling)          | `c3de94f0…` → `c5857c70…` |
| #393 Shadow Inheritor                                        | Shadow Magic (Wayang)           | `bcad4e87…` → `7357039d…` |
| #393 Low Blow                                                | Keen Senses (Halfling)          | `28202262…` → `eaa9d2ba…` |
| #393 Treacherous Earth (Oread)                               | Spell-Like Ability (Oread)      | `11192fae…` → `98832a0b…` |
| #394 Spiresworn Elves                                        | Keeper of Secrets               | `87c9db55…` → `afb4ad69…` |
| #394 Song'o Halflings                                        | Keen Senses (Halfling)          | `a606acd9…` → `f6dfdfee…` |
| #394 Fey Magic (Halfling)                                    | Keen Senses (Halfling)          | `e4123b1f…` → `463b59f6…` |
| #394 Skilled (Kitsune)                                       | Kitsune Magic                   | `708f6c32…` → `cd444950…` |
| #395 Alternate Spell-Like Ability (Skinwalker - Seascarred)  | Spell-Like Ability (Skinwalker) | `0b6050da…` → `6b78b175…` |
| #395 Wereraptor-Kin (Aerieborn)                              | Spell-Like Ability (Skinwalker) | `0eaa64be…` → `2c66118b…` |
| #395 Duplicitous                                             | Kitsune Magic                   | `8a0dd619…` → `eded5b8c…` |
| #395 Outsear Sahuagin                                        | Stoic Defender                  | `35e716f8…` → `5000982f…` |
| #396 Pyromaniac                                              | Illusion Resistance             | `fb42c6fe…` → `bad4b07d…` |
| #396 Alternate Spell-Like Ability (Skinwalker - Witchwolf)   | Spell-Like Ability (Skinwalker) | `766f9c41…` → `ec4584f8…` |
| #396 Fire Insight                                            | Fire Affinity                   | `d5530251…` → `856461cc…` |
| #396 Sunsoul (Solar Ifrit)                                   | Fire Affinity                   | `e184b939…` → `0dbaa4b4…` |
| #396 Hypnotic                                                | Fire Affinity                   | `0211f478…` → `794b2578…` |
| #396 First World Gnomes                                      | Illusion Resistance             | `5e56e613…` → `ad551a17…` |
| #396 Jungle Affinity                                         | Ekujae Half-Elves (Wildborn)    | `7de05271…` → `3428ae2b…` |
| #396 Poison Minion (Gnome)                                   | Illusion Resistance             | `1e701e17…` → `ed3019b4…` |
| #367 Nanite Revival (Android)                                | Emotionless                     | `e0e9ca61…` → `b7414f60…` |

They are recorded in each batch's inventory `currentBinding` and `tests/fixtures/<batch>/preview.json`. `racial-traits-395.json`, `racial-traits-396.json` and their preview fixtures keep their landed `JSON.stringify` layout, so their diff is the re-bind only.

- **Already stale, not re-bound:** 24 assessments that reach batch keys were stale on the base and are unchanged: 22 #328 race records, and Extra Feature and Extra Gnome Magic (feats-330/333).
- **Skilled (Kitsune) (#394):** its closure reaches Kitsune Magic, so it is re-bound above, and its hold explanation is corrected as the brief directs: `racial-traits-394.json` `missingEvidence` and `rationale` (and the identical assessment rationale the gate reports) now say its only PCGen lead is the Blood of the Beast row (PZO9473 p.12), not a lead "without a pinned book identity". Its evidence record is unchanged.
- **Protected records (spells-534):** #534's `protected-context.json` pins the definition fingerprints of Keen Senses (Halfling) and Languages (Halfling), which its `binding-preview.json` copies. This batch gives both their evidence-backed description Note, so their #534 copies and protected definitions are re-bound from #534's own re-import (`f99b4eb6…` → `9b727ec6…` and `0a614bc3…` → `cb35f266…`), as #392 did for Halfling Luck; only those two rows change, and no #534 spell binding changes (0 of its assessments). `spells-534` tests pass. No batch key is a protected root.
- **Other fixture copies:** `feats-355/binding-preview.json` copies 6 batch keys that no #355 assessment's closure reaches, and the #530 to #536 and #350 to #355 `protected-context.json` lists name batch keys only as seed, closure and source keys (their definitions are checked only for entries their own re-import extracts). `feats-355` tests pass.
- **Guard adjusted (`tests/catalog/cross-batch-bindings.ts`):** Variant Aasimar Abilities' closure copy of Summon Monster III resolves a label-less link that spells-517's bounded copy renders "Reference unavailable"; the guard compared only labelled stripped links, so it now treats that rendering as the same content (with a test that a real description change is still caught). The Freeze link is added to the dangling-link list with its reason.
- **In-flight batches:** no #428 (weapons) key is in this batch's closures.

## Binding

Every assessment is bound with `buildAssessmentBinding` against the full-corpus content closure: the final full `catalog:preview` artifact, with the batch's 82 entries and their 179 closure entries. The [preview fixture](../../tests/fixtures/racial-traits-397/preview.json) keeps both, so the batch test rebuilds every binding from a clean shared-store tree (0 mismatches). The race outputs re-homed or relocated onto Emotionless, Shadow Magic (Wayang), Illusion Resistance, Kitsune Magic and Drow Immunities are absent from a bounded tree without the race; the test lists them as relocated.

## Tests

The [resolver tests](../../tests/catalog/racial-traits-397.test.ts) pin Gemsoul (Crystal Oread) replacing the oread's ability score trait on an oread identity sheet (Wisdom 12 to 8, Charisma 8 to 12), Werebear-Kin's line, every Situation-gated bonus (off by default, on when selected) and its published type, the re-homed shared Situations, distinct racial Sources stacking (+4), the imported and re-homed values not curated twice and no `ac.other` armor, shield or natural armor bonus; all 35 required and 82 description records checked, the four covered records and the Note targets; the race, alternate, monster-ability, inherited and Unchained notice dependencies (24 PZO1131 keys, own action versus bound body) and every enforced hold; the importer's reading and the exact unresolved names; every pinned body, PCGen row and PRD paragraph in the shared store; and re-extraction from a clean shared-store tree with every binding reproduced, Creepy Doll failing only on its stripped link, Ferocity (Green Martian) held on the Dynamite source hold, every other record held on its own reasons, and a confirmed Keen Senses (Halfling) still held.

The [isolated saved-sheet test](../../tests/catalog/racialTraits397.integration.test.ts) exercises public Convex reads and writes: an oread-identity race granting its ability score trait, Energy Resistance (Oread) and Spell-Like Ability (Oread) takes the held Gemsoul (Crystal Oread), Granite Skin and Mountain-Born (Wisdom -4, Charisma +4, natural armor +1, Sense Motive -2; Mountain-Born's Acrobatics bonus stays a Situation) and turns them off again, with saved totals equal to the preview; outsiders, anonymous callers and another campaign's entry are refused without changing the sheet. The shared held-release round trip is covered once by the release test in [`traits367.integration.test.ts`](../../tests/catalog/traits367.integration.test.ts). No deployment or production activation occurred.

## Preservation and gates

The shared canonical files gain only this batch's entries: 117 curation records (82 description and 35 note records), 82 assessments, 82 evidence entries and 37 notice holds. The other changes are the listed re-binds (content fingerprints only) with their `currentBinding` and fixture copies, the spells-534 protected copies, the Skilled (Kitsune) explanation and the guard adjustment above. Shared-file diff stat against `41008f08` (`git diff --stat HEAD`):

```text
 scripts/catalog/legal/held-notices.json           |  349 +++
 scripts/catalog/legal/racial-traits-387.json      |    8 +-
 scripts/catalog/legal/racial-traits-388.json      |   10 +-
 scripts/catalog/legal/racial-traits-389.json      |    4 +-
 scripts/catalog/legal/racial-traits-390.json      |    4 +-
 scripts/catalog/legal/racial-traits-391.json      |   10 +-
 scripts/catalog/legal/racial-traits-392.json      |    6 +-
 scripts/catalog/legal/racial-traits-393.json      |   10 +-
 scripts/catalog/legal/racial-traits-394.json      |   12 +-
 scripts/catalog/legal/racial-traits-395.json      |    8 +-
 scripts/catalog/legal/racial-traits-396.json      |   16 +-
 scripts/catalog/legal/traits-367.json             |    2 +-
 scripts/catalog/reviewed-curation.json            | 2439 ++++++++++++++++++++-
 src/lib/catalog/data/attribution-assessments.json | 2062 ++++++++++++++++-
 src/lib/catalog/data/attribution-evidence.json    |  246 +++
 tests/catalog/cross-batch-bindings.test.ts        |   33 +
 tests/catalog/cross-batch-bindings.ts             |   38 +
 tests/fixtures/racial-traits-387/preview.json     |   20 +-
 tests/fixtures/racial-traits-388/preview.json     |   12 +-
 tests/fixtures/racial-traits-389/preview.json     |   12 +-
 tests/fixtures/racial-traits-390/preview.json     |   24 +-
 tests/fixtures/racial-traits-391/preview.json     |   22 +-
 tests/fixtures/racial-traits-392/preview.json     |   19 +-
 tests/fixtures/racial-traits-393/preview.json     |   22 +-
 tests/fixtures/racial-traits-394/preview.json     |   57 +-
 tests/fixtures/racial-traits-395/preview.json     |   15 +
 tests/fixtures/racial-traits-396/preview.json     |   26 +-
 tests/fixtures/spells-534/binding-preview.json    |   12 +-
 tests/fixtures/spells-534/protected-context.json  |    4 +-
 tests/fixtures/traits-367/preview.json            |    5 +
 30 files changed, 5342 insertions(+), 165 deletions(-)
```

<!-- prep:shared-store-count -->

New shared-store files (`tests/fixtures/pinned/`), counted by prep after the rebase onto `7d26f5e2`: **102** (pcgen 1, pf1 7, pf1-content 94).

<!-- /prep:shared-store-count -->

The batch adds to the shared store the pinned records of its 100 keys the store lacked, the pf-racial-traits folder records above them, the linked racial traits, five pf1 spells and two pf1 feats (Spell Focus, Run), the Blessing of Courage and Life buff and the Holy special quality, and one PCGen file (the Ultimate Wilderness Occult Adventures support file); the race records, the other PCGen files and the PRD pages were already on the base and are reused.

The complete preview of `41008f08` plus this batch reported **102 admitted, 23,151 held, 3 dependent omissions and 2,272 failures**, 35 fewer than the base's 2,307 (this batch's required note records). The only batch key among the failures is Creepy Doll (the stripped Freeze link above). The full-corpus gate is therefore a documented failure, not a claim of whole-corpus readiness.

| Command                                                                                                                                                                                                                                                    | Result                                                                                                                                                                                                             |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `catalog:curate --candidates …` (required) and `--descriptions` (prose pass)                                                                                                                                                                               | pass; 35 required drafts, 21 prose drafts; about 15 s each                                                                                                                                                         |
| `catalog:preview --candidates …`                                                                                                                                                                                                                           | exit 1; 0 admitted / 27 held / 55 failures, all links and replacements outside the selection                                                                                                                       |
| Full `catalog:curate`                                                                                                                                                                                                                                      | pass; 1,166 new drafts, none for this batch; 0 missing; about 3 min (capped)                                                                                                                                       |
| Full `catalog:preview` (baseline, then final records)                                                                                                                                                                                                      | exit 1; 2,307 failures on the base, 2,272 with this batch, Creepy Doll the only batch key among them; about 7 min each plus admission queue                                                                        |
| Full re-bind (`bind.ts`, `xrebind397.ts` over the final full preview)                                                                                                                                                                                      | 82 assessments bound, 179 closure entries, 0 mismatches against the clean-tree reconstruction; 43 earlier assessments re-bound, fixtures agree; spells-534's two halfling copies re-bound, 0 #534 bindings changed |
| `pnpm test` of the batch tests, the guards (`notice-holds`, `pinned-sources`, `cross-batch-bindings`, `batch-ownership-sweep`, `ac-other-defense-bonuses`) and `racial-traits-719`, `race-facts-720`, `race-ability-721`, `racial-traits-394` (one worker) | pass after the fixes above (cross-batch guard; test expectations); 11 files / 441 tests                                                                                                                            |
| `pnpm test` of `spells-534` (unit and integration) and `feats-355` (protected copies)                                                                                                                                                                      | pass after the #534 re-bind                                                                                                                                                                                        |
| `pnpm -s typecheck`                                                                                                                                                                                                                                        | pass                                                                                                                                                                                                               |
| `pnpm -s lint`                                                                                                                                                                                                                                             | pass; about 3 min                                                                                                                                                                                                  |
| `pnpm -s check:initial-migration-writers`                                                                                                                                                                                                                  | pass; 185 registrations                                                                                                                                                                                            |
| `pnpm catalog:pin`                                                                                                                                                                                                                                         | pass; `sha256:005ef0b9…`                                                                                                                                                                                           |
| `pnpm catalog:notice-deps`                                                                                                                                                                                                                                 | pass; 0 gaps; 39 advisory warnings, none for this batch                                                                                                                                                            |
| `pnpm catalog:format --check`                                                                                                                                                                                                                              | pass                                                                                                                                                                                                               |

`pnpm test tests/catalog` was left to the orchestrator's prep run on the rebased commit, as the brief directs.
