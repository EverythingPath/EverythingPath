# Racial traits #393: pf1-content pf-racial-traits batch 7

Reviewed by **Opus (AI curator) for the owner**, 2026-10-19.

Exactly the issue's 100 ordered, unique keys were reviewed: **0 admitted, 74 specifically held, 0 dependent omissions, 0 whole-entry unsupported/prose-only dispositions, 26 exclusions, 0 record-level 3.5 holds**. The exclusions are 15 Foundry `!folders!` records (one of them the Race Builder's "Other" folder), which the importer's folder contract leaves out of the Catalog Entries (PRD Decision 17), and 11 records in the Advanced Race Guide Race Builder subtree, which the import contract excludes by folder ancestry ([README](README.md), explicit exclusions) and the [Racial Trait contract](../character-sheet/racial-traits.md) puts out of scope. No candidate carries a `3.5` tag. The 74 in-scope records are 26 standard racial traits (7 of them in flat race folders), 37 alternates, 6 Subrace Standard heritage parts and 5 Subraces-folder heritages or racial subtypes.

The [machine-readable inventory and evidence](../../scripts/catalog/legal/racial-traits-393.json) records, per key, the complete pinned body and inert fields with their source hash and cited sources; the PCGen race-ability rows, PRD Advanced Race Guide paragraphs, leads and rejected rows; the inherited-rule notices with their evidence, the linked bodies and the unresolved origins; the importer's reading of race, standard flag and replacements; every checked curation record, source discrepancies and calculation gaps; and the current assessment binding and mapped facts. This report summarizes them and does not repeat the evidence.

## #328 S4-B launch update

Reviewed 2026-11-01 by **Sol (AI curator) for the owner** ([races-328.md](races-328.md#s4-b-launch-half-elf-elf-gnome-and-halfling)). The S4-B launch review confirms 3 standard racial traits of Half-Elf, Elf, Gnome and Halfling with content-bound assessments; counts are now **3 admitted, 70 held, 1 dependently omitted**, with 26 exclusions unchanged. The earlier Opus review of each row stays in its `assessmentHistory`; every other candidate keeps its review and holds.

- **Keen Senses (Gnome)** (`pf1-content/L4yOFpviuO9WvCyT`): matches the PRD ARG paragraph (`advancedRaceGuide/coreRaces/gnomes.html:374`) word for word; PCGen's Core Essentials row (`gnome/gnome_abilities_race.lst:26`) with the recorded DESC differences. Its Modifier is +2 racial Perception (skill.per). Required notices: PZO9280, PZO1121, PZO1110.
- **Obsessive** (`pf1-content/LcZE7cPw87DMzJYl`): matches the PRD ARG paragraph (`advancedRaceGuide/coreRaces/gnomes.html:375`) word for word; PCGen's Core Essentials row (`gnome/gnome_abilities_race.lst:27`) word for word. No Modifier: the untargeted raw change is unmapped (unsupported "changes"), so no Craft or Profession skill gets a default bonus. Required notices: PZO9280, PZO1121, PZO1110. Outstanding: The +2 racial bonus on one chosen Craft or Profession skill: the sheet cannot take the choice yet (#740); it stays readable, with no default skill.
- **Gnome Magic (Gnome)** (`pf1-content/MiPbhGqPRX7H4C7a`): matches the PRD ARG paragraph (`advancedRaceGuide/coreRaces/gnomes.html:371`) apart from no "+"; "DCs" for "DC"; "to resist" for "against"; an added "a"; no "scores"; "day-dancing" for "day — dancing"; an added "character"; PCGen's Core Essentials row (`gnome/gnome_abilities_race.lst:23`) with the recorded DESC differences. Its Modifier is +1 spellDC with condition school illusion, which the sheet resolves per school (src/lib/character-sheet-spellcasting.ts:409-413). The spell-like abilities link the four cantrips, which are held in their own batches, so the trait is dependently omitted. Required notices: PZO9280, PZO1121, PZO1131, PZO1110. Outstanding: The four 1/day spell-like abilities, their caster level and their DC are permitted prose on the action; no uses-per-day statistic. **Flagged for the reviewer:** Judgement 2: the body reads "the gnome's character level" where the ARG and PCGen read "the gnome's level"; for a player character these are the same number, so it is lexical. "add 1 to the DCs … to resist" for "add +1 to the DC … against" and "a Charisma of 11" (PCGen's own wording) change nothing. My tokenizer also splits "+1" and the "1/day—" dash differently from the recorded comparison; the wording differences are the same.

Each row's whole-content hold ("Book PDFs unavailable") is superseded by this comparison, and it records no notice hold: PZO1110 is reviewed, PZO1121's Registry hold and `racial-traits-393-notice-PZO1121-complete-chain` are cleared (`notice-clearances.json`, owner 2026-10-30), and PZO9280's reviewed confirmation waives `racial-traits-393-notice-PZO9280-complete-chain`; the PZO1112 (low-light vision) and PZO1131 (Unchained action costs) batch holds are cleared too. The batch's `noticeRequirements` rows keep these keys as history. Content fingerprints are unchanged (the imported entries are identical); only the status, rationale, evidence and notice bindings move.

Gnome Magic (Gnome) is confirmed but **dependently omitted**: its spell-like abilities link Dancing Lights (#546), Ghost Sound (#535), Prestidigitation (#525) and Speak with Animals (#527), which are held in their own batches (curation-reachable, no slice scheduled). It admits with no re-review once they are admitted.

Tests: `racial-traits-393.test.ts` checks the confirmed rows with the held ones (`assessedTraits` in the fixture), expects them admitted by the committed gate and records no hold for them. It also expects Gnome Magic dependently omitted by the committed gate, and its fixture tree now pins the linked content of every assessed row, so the cantrips stay in the bounded import.

## #328 S4-A launch update

Reviewed 2026-11-01 by **Sol (AI curator) for the owner** ([races-328.md](races-328.md#s4-a-launch-human-dwarf-and-half-orc)). The launch review admits 1 standard racial trait of Human, Dwarf and Half-Orc with confirmed, content-bound assessments; counts are now **1 admitted, 73 held**, with 26 exclusions unchanged. The earlier Opus review of each admitted row stays in its `assessmentHistory`; every other candidate keeps its review and holds.

- **Skilled (Human)** (`pf1-content/LwDcZanOEHqVaYoh`): matches the PRD ARG paragraph (`advancedRaceGuide/coreRaces/humans.html:363`) apart from "1" for "an"; "1st" for "first"; "1" for "one"; PCGen's Core Essentials row (`human/human_abilities_race.lst:22`). Its detail gives bonusSkillRanksPerLevel 1: one extra skill rank at 1st level and at every level after (Foundry's bonusSkillRanks change is relocated here from the race). Required notices: PZO9280, PZO1121, PZO1110.

Each admitted row's whole-content hold ("Book PDFs unavailable") is superseded by this comparison, and it records no notice hold: PZO1110 is reviewed, PZO1121's Registry hold is cleared (owner, 2026-10-30), and PZO9280's reviewed confirmation waives `racial-traits-393-notice-PZO9280-complete-chain`. The batch's `noticeRequirements` rows keep these keys as history. Content fingerprints are unchanged (the imported entries are identical); only the status, rationale, evidence and notice bindings move.

Tests: `racial-traits-393.test.ts` checks the admitted rows with the held ones (`assessedTraits` in the fixture), expects them admitted by the committed gate (its uncleared-holds gate still holds them on their notice chains) and records no hold for them.

## Family rulings applied

This batch follows the #387 rulings Sol approved for the family:

1. **Every in-scope record is held** with a whole-content hold: the race records stay held (#328), every cited book's notice chain is held, and no book PDFs are available.
2. **Race abilities.** Every record requires the books its pinned race record cites. Knowledgeable's folder binds no race (the two lashunta race records), so both lashunta records' books are recorded, as #392 did for Sexual Dimorphism.
3. **Alternate framework.** Every alternate records the APG alternate racial trait rule (PZO1115, `apg_abilities_race.lst:86`).
4. **Monster abilities** take the earliest book the pinned Universal Monster Rules page lists: darkvision PZO1127; low-light vision, light sensitivity, scent, natural attacks, amphibious, spell resistance and vulnerabilities PZO1112.
5. **Creature types** (the vine leshy's plant type and leshy subtype, the triton's outsider type, the aquatic subtype) stay named unresolved origins.
6. **PZO1131** for Unchained action-cost metadata anywhere in the bound closure: 20 records (14 on their own actions, 17 through bound bodies, 11 both). Asura-Spawn (Faultspawn) reaches it through the tiefling's traits once its ability line replaces the tiefling's ability score trait.
7. **Comparisons.** PCGen race-ability rows from a pinned book are the `comparison`; Core Essentials support rows (no SOURCELONG book) are leads whose book is not required. 22 records carry a PRD `prdComparison` from the pinned capture (14 match word for word).
8. **Description pass.** Every in-scope record has a checked description record: its reviewed Modifiers plus one entry-level Note with the body (`@Distance` read as feet, `@Condition` as the condition, `@Toggle` buff controls removed).
9. **Racial bonuses from distinct Sources stack**; the resolver test shows Trusted Mediator and Cold-Blooded giving +4 together against mind-affecting effects. The #735 admission policies don't bear on this batch (no spells or CRB feats).

## Dispositions

| Key                            | Name                                              | Kind             | Disposition                                                      |
| ------------------------------ | ------------------------------------------------- | ---------------- | ---------------------------------------------------------------- |
| `pf1-content/KP5QLO1nPv43LcXI` | Alternate                                         | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/KRvHN3FECPuGS3AM` | Warslinger                                        | alternate        | held: `racial-traits-393-whole-content-KRvHN3FECPuGS3AM`         |
| `pf1-content/KW6G6g9qFZLryJxQ` | Mwangi Dwarves                                    | subrace          | held: `racial-traits-393-whole-content-KW6G6g9qFZLryJxQ`         |
| `pf1-content/KXcFJRaHS35vdjSn` | Ability Modifiers (Changeling - Moon May)         | subrace standard | held: `racial-traits-393-whole-content-KXcFJRaHS35vdjSn`         |
| `pf1-content/KhGAH8JFwRVIEt2j` | Darkvision (Vine Leshy)                           | standard         | held: `racial-traits-393-whole-content-KhGAH8JFwRVIEt2j`         |
| `pf1-content/KiEX7l7gq46EN7ac` | Alternate                                         | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/KmjXeSUMKkcMhhKg` | Static Bonus Feat                                 | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/Knp7L2HErvfmxF5k` | Dusksight (Gnome)                                 | alternate        | held: `racial-traits-393-whole-content-Knp7L2HErvfmxF5k`         |
| `pf1-content/KokxNNPmyhxyC2tO` | Deep Dweller                                      | alternate        | held: `racial-traits-393-whole-content-KokxNNPmyhxyC2tO`         |
| `pf1-content/KqmKgeDMWBIS2qNP` | Festive                                           | alternate        | held: `racial-traits-393-whole-content-KqmKgeDMWBIS2qNP`         |
| `pf1-content/KtxhspNWZ4l2W6IR` | Air Affinity                                      | standard         | held: `racial-traits-393-whole-content-KtxhspNWZ4l2W6IR`         |
| `pf1-content/KyDZk9dCBMAHnW4L` | Sea Legs                                          | alternate        | held: `racial-traits-393-whole-content-KyDZk9dCBMAHnW4L`         |
| `pf1-content/KzjAfSvpNuqDcnZj` | Hydrated Vitality                                 | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/L29PhfCXx2qEXpEH` | Flight                                            | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/L2ucOsiHPXq7FKKF` | Cold-Blooded                                      | standard         | held: `racial-traits-393-whole-content-L2ucOsiHPXq7FKKF`         |
| `pf1-content/L4yOFpviuO9WvCyT` | Keen Senses (Gnome)                               | standard         | held: `racial-traits-393-whole-content-L4yOFpviuO9WvCyT`         |
| `pf1-content/L6hDTTsdEWKBj4gE` | Suspicious                                        | standard         | held: `racial-traits-393-whole-content-L6hDTTsdEWKBj4gE`         |
| `pf1-content/L7un1Ilxj5RuL7zH` | Fell Magic                                        | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/LAxucaDDMsbYmW6G` | Orc Ferocity                                      | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/LDa7NQVd0jYOofi3` | Multitalented                                     | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/LGR5l1wSNOiTc4xq` | Draconic Consular                                 | alternate        | held: `racial-traits-393-whole-content-LGR5l1wSNOiTc4xq`         |
| `pf1-content/LJMqyMRGo5QrUASa` | Weapon Familiarity (Drow)                         | standard         | held: `racial-traits-393-whole-content-LJMqyMRGo5QrUASa`         |
| `pf1-content/LMZrndmHCbiQ1DZ7` | Dwarf                                             | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/LPQ68hAXI4lYQTYx` | Natural Armor (Sahuagin)                          | standard         | held: `racial-traits-393-whole-content-LPQ68hAXI4lYQTYx`         |
| `pf1-content/LTXZC6b60cP69ZeD` | Magehunter                                        | alternate        | held: `racial-traits-393-whole-content-LTXZC6b60cP69ZeD`         |
| `pf1-content/LUlO5qY8jJdj6gtz` | Fell Magic (Gnome)                                | alternate        | held: `racial-traits-393-whole-content-LUlO5qY8jJdj6gtz`         |
| `pf1-content/LVFFlvan4N1BQTEg` | Ability Modifiers (Changeling - Hearth May)       | subrace standard | held: `racial-traits-393-whole-content-LVFFlvan4N1BQTEg`         |
| `pf1-content/LVToSTaVYtVk7Sa3` | Spell-Like Ability (Aasimar)                      | standard         | held: `racial-traits-393-whole-content-LVToSTaVYtVk7Sa3`         |
| `pf1-content/LYHxu819kk0ZQjEs` | Amphibious (Merfolk)                              | standard         | held: `racial-traits-393-whole-content-LYHxu819kk0ZQjEs`         |
| `pf1-content/LYX6NwyRtyurYLEa` | Leshy                                             | standard         | held: `racial-traits-393-whole-content-LYX6NwyRtyurYLEa`         |
| `pf1-content/LZ8WLQwF8ObuuJpJ` | Multi-Armed (Green Martian)                       | standard         | held: `racial-traits-393-whole-content-LZ8WLQwF8ObuuJpJ`         |
| `pf1-content/LcNmShAWgSJlqeMG` | Lesser Spell-Like Abilities                       | alternate        | held: `racial-traits-393-whole-content-LcNmShAWgSJlqeMG`         |
| `pf1-content/LcZE7cPw87DMzJYl` | Obsessive                                         | standard         | held: `racial-traits-393-whole-content-LcZE7cPw87DMzJYl`         |
| `pf1-content/LdbfPqPoza3xBUde` | Alternate Weakness (Dhampir - Ru-Shi)             | subrace standard | held: `racial-traits-393-whole-content-LdbfPqPoza3xBUde`         |
| `pf1-content/LgS28VNVT3n6hCKH` | Flexible Half-Breed                               | alternate        | held: `racial-traits-393-whole-content-LgS28VNVT3n6hCKH`         |
| `pf1-content/LiMQiDGYaqLMHPQM` | Riverfolk                                         | alternate        | held: `racial-traits-393-whole-content-LiMQiDGYaqLMHPQM`         |
| `pf1-content/Lu5fwnybIjW7E4KB` | Voice in the Darkness (Elf)                       | alternate        | held: `racial-traits-393-whole-content-Lu5fwnybIjW7E4KB`         |
| `pf1-content/Lv5ztInkUx9RmQDk` | Deep Shadow Explorer                              | alternate        | held: `racial-traits-393-whole-content-Lv5ztInkUx9RmQDk`         |
| `pf1-content/LwDcZanOEHqVaYoh` | Skilled (Human)                                   | standard         | held: `racial-traits-393-whole-content-LwDcZanOEHqVaYoh`         |
| `pf1-content/LxJrzlRjZraZ1lA5` | Gnome                                             | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/LzFbBJDJsOh7wy8t` | Dreamthief-Born (Waker May)                       | subrace          | held: `racial-traits-393-whole-content-LzFbBJDJsOh7wy8t`         |
| `pf1-content/LzVmMiyx87KxfDai` | Stoic Negotiator                                  | alternate        | held: `racial-traits-393-whole-content-LzVmMiyx87KxfDai`         |
| `pf1-content/M1lkxA7VFDzlRtIB` | Alternate                                         | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/M571aaxrlWRfFqiS` | Outsider (Native)                                 | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/M7504nqBO2IVR3Kd` | Subraces                                          | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/M7iCedGNTrldJq5R` | Dragon                                            | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/M8L159eLa2EZlLWg` | Change Shape (Skinwalker - Coldborn)              | subrace standard | held: `racial-traits-393-whole-content-M8L159eLa2EZlLWg`         |
| `pf1-content/MA2VzVJZ9Xvso5qb` | Swim Speed (Triton)                               | standard         | held: `racial-traits-393-whole-content-MA2VzVJZ9Xvso5qb`         |
| `pf1-content/MFJmheGs8O0Q7Q1u` | Poison Use (Adaro)                                | standard         | held: `racial-traits-393-whole-content-MFJmheGs8O0Q7Q1u`         |
| `pf1-content/MHNxeoT3fFxa3kL2` | Change Shape (Skinwalker - Aerieborn)             | subrace standard | held: `racial-traits-393-whole-content-MHNxeoT3fFxa3kL2`         |
| `pf1-content/MN4QiTzzMKS4qO0e` | Shabti                                            | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/MNr30PKDqT4GLw8q` | Mist Child                                        | alternate        | held: `racial-traits-393-whole-content-MNr30PKDqT4GLw8q`         |
| `pf1-content/MNzGZ2cMsU7bh6RN` | Behind the Veil (Halfling)                        | alternate        | held: `racial-traits-393-whole-content-MNzGZ2cMsU7bh6RN`         |
| `pf1-content/MQnZG0JAiMqtO91T` | Frostmelding                                      | alternate        | held: `racial-traits-393-whole-content-MQnZG0JAiMqtO91T`         |
| `pf1-content/Mb0hz0BAj51wOmUr` | Wereboar-Kin (Ragebred)                           | subrace          | held: `racial-traits-393-whole-content-Mb0hz0BAj51wOmUr`         |
| `pf1-content/MboeefX07pfct1hx` | Darkvision (Gnome)                                | alternate        | held: `racial-traits-393-whole-content-MboeefX07pfct1hx`         |
| `pf1-content/McXN9Ox4pWf7xQ8E` | Natural Weapon (Tengu)                            | standard         | held: `racial-traits-393-whole-content-McXN9Ox4pWf7xQ8E`         |
| `pf1-content/Mcn12mWoyj1AY6j1` | Triton Magic                                      | alternate        | held: `racial-traits-393-whole-content-Mcn12mWoyj1AY6j1`         |
| `pf1-content/MhFMYfP5kHTZOunS` | Amphibious (Grindylow)                            | standard         | held: `racial-traits-393-whole-content-MhFMYfP5kHTZOunS`         |
| `pf1-content/MhxehLhTo8dKx5Wn` | Seasoned                                          | standard         | held: `racial-traits-393-whole-content-MhxehLhTo8dKx5Wn`         |
| `pf1-content/MiPbhGqPRX7H4C7a` | Gnome Magic (Gnome)                               | standard         | held: `racial-traits-393-whole-content-MiPbhGqPRX7H4C7a`         |
| `pf1-content/MjM2hFpV8MHQTEwC` | Creepy                                            | alternate        | held: `racial-traits-393-whole-content-MjM2hFpV8MHQTEwC`         |
| `pf1-content/MnzLO4mXaLGzzWKC` | Amphibious                                        | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/MqJQbPsttOKcQidO` | Dusksight (Halfling)                              | alternate        | held: `racial-traits-393-whole-content-MqJQbPsttOKcQidO`         |
| `pf1-content/MtFsqvoTAnmxR7Du` | Jininese Weapon Mastery                           | alternate        | held: `racial-traits-393-whole-content-MtFsqvoTAnmxR7Du`         |
| `pf1-content/MtvuVPQzQH0cULmd` | Construct                                         | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/MvSLvnvs1jpqtzKq` | Trusted Mediator                                  | alternate        | held: `racial-traits-393-whole-content-MvSLvnvs1jpqtzKq`         |
| `pf1-content/MvyTbqu9jQCwjLwg` | Alternate                                         | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/MwigLwh0rjG0FsNO` | Alternate                                         | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/MzrlHdX4eG9oXoB5` | Alternate Skill Modifiers (Skinwalker - Coldborn) | subrace standard | held: `racial-traits-393-whole-content-MzrlHdX4eG9oXoB5`         |
| `pf1-content/N0trYSSeG9hrMCPR` | Knowledgeable                                     | standard         | held: `racial-traits-393-whole-content-N0trYSSeG9hrMCPR`         |
| `pf1-content/N3Yn4wWnzP8UwZp2` | Standard                                          | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/N4jPEdoaDwu4EJ4v` | Senses (Dhampir)                                  | standard         | held: `racial-traits-393-whole-content-N4jPEdoaDwu4EJ4v`         |
| `pf1-content/N8o5WfhpMLQFylpb` | Standard                                          | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/NApPIjNkVNBxzQS3` | Gatecrasher                                       | alternate        | held: `racial-traits-393-whole-content-NApPIjNkVNBxzQS3`         |
| `pf1-content/NBbiF9fQTgRfNaFb` | Hag Magic (AoE)                                   | alternate        | held: `racial-traits-393-whole-content-NBbiF9fQTgRfNaFb`         |
| `pf1-content/NBmeuhkyRCjD3kV4` | Asura-Spawn (Faultspawn)                          | subrace          | held: `racial-traits-393-whole-content-NBmeuhkyRCjD3kV4`         |
| `pf1-content/NC1bwUXvNsP7XkKe` | Heart of the Slums                                | alternate        | held: `racial-traits-393-whole-content-NC1bwUXvNsP7XkKe`         |
| `pf1-content/NCkgefj8p80D4P5O` | Other                                             | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/NGOeal2hFl2QMV92` | Alternate                                         | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/NI34es9rqCqaY9mu` | Unnatural                                         | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/NINkLcayOe5Zk7vQ` | Outsider                                          | standard         | held: `racial-traits-393-whole-content-NINkLcayOe5Zk7vQ`         |
| `pf1-content/NNo2plkEqcGzHrDO` | Memories of the Forgotten                         | alternate        | held: `racial-traits-393-whole-content-NNo2plkEqcGzHrDO`         |
| `pf1-content/NQsZRny6Ed9oGDDP` | Shadow Inheritor                                  | alternate        | held: `racial-traits-393-whole-content-NQsZRny6Ed9oGDDP`         |
| `pf1-content/NRRo5ExVy4cqWWUR` | Silver Tongued                                    | alternate        | held: `racial-traits-393-whole-content-NRRo5ExVy4cqWWUR`         |
| `pf1-content/NWKhtsaVcMZHOhJU` | Languages (Ganzi)                                 | standard         | held: `racial-traits-393-whole-content-NWKhtsaVcMZHOhJU`         |
| `pf1-content/NXo6ienQYsNzSdIr` | Low Blow                                          | alternate        | held: `racial-traits-393-whole-content-NXo6ienQYsNzSdIr`         |
| `pf1-content/NZKgmlXsLylQzlvf` | Slave Hunter                                      | alternate        | held: `racial-traits-393-whole-content-NZKgmlXsLylQzlvf`         |
| `pf1-content/NZqjZG4BTjWh0ZaQ` | Underfoot Dodger                                  | alternate        | held: `racial-traits-393-whole-content-NZqjZG4BTjWh0ZaQ`         |
| `pf1-content/NbYp94wEAcVHg28i` | Fey Magic (Human)                                 | alternate        | held: `racial-traits-393-whole-content-NbYp94wEAcVHg28i`         |
| `pf1-content/NdT5ee0UBJbBGxOc` | Languages (Aphorite)                              | standard         | held: `racial-traits-393-whole-content-NdT5ee0UBJbBGxOc`         |
| `pf1-content/NdqSKNr56WP9EuED` | Alternate                                         | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/NhAdmRaVFFow7cN0` | Alternate                                         | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/NhfWDtVQtBcpKMBP` | Eternal Hope                                      | alternate        | held: `racial-traits-393-whole-content-NhfWDtVQtBcpKMBP`         |
| `pf1-content/Nhhd0xS2XSQ2luEe` | Cosmic Mind                                       | standard         | held: `racial-traits-393-whole-content-Nhhd0xS2XSQ2luEe`         |
| `pf1-content/Ni5twdUyps9MQyOX` | Jiang-Shi Born (Ru-Shi)                           | subrace          | held: `racial-traits-393-whole-content-Ni5twdUyps9MQyOX`         |
| `pf1-content/NlrWvpPCsJMVC7Qp` | Spell Resistance (Drow)                           | standard         | held: `racial-traits-393-whole-content-NlrWvpPCsJMVC7Qp`         |
| `pf1-content/Nrfb2H4Ll6lnjzUt` | Vampire Hunter                                    | alternate        | held: `racial-traits-393-whole-content-Nrfb2H4Ll6lnjzUt`         |
| `pf1-content/NuCT6chK7Td1ef47` | Claw Attack                                       | alternate        | held: `racial-traits-393-whole-content-NuCT6chK7Td1ef47`         |
| `pf1-content/NuYBojmRnuwgyASW` | Treacherous Earth (Oread)                         | alternate        | held: `racial-traits-393-whole-content-NuYBojmRnuwgyASW`         |

## Notable cases

- **Asura-Spawn (Faultspawn)** is one of the 37 `reviewedAbilityLineSubraces`; its ability line (+2 Dex, +2 Wis, −2 Int, matching PCGen's Core Essentials ability row) is curated as racial ability Modifiers, so "Base Statistics" resolves to the tiefling's `local/` ability trait. The resolver test shows the tiefling's +2 Dex, +2 Int, −2 Cha going dormant for the heritage's line.
- **Disputed ability lines, listed for review.** Wereboar-Kin (Ragebred) and Jiang-Shi Born (Ru-Shi) are also `reviewedAbilityLineSubraces`, but the pinned body and PCGen's Core Essentials ability row disagree (Wereboar-Kin: pinned +2 Wis, −2 Cha against PCGen +2 Str, −2 Cha; Jiang-Shi Born: pinned +2 Str, +2 Int, −2 Dex against PCGen +2 Dex, +2 Int, −2 Wis). No book is available to decide, so neither line is curated: each "Base Statistics" stays unresolved with the importer's prose reason and the race's ability score trait stays active. This is an outstanding calculation, not an attribution hold.
- **Changeling ability records.** Ability Modifiers (Changeling - Moon May) and (Hearth May) replace the changeling's ability trait by name with their imported untyped changes; the resolver and saved-sheet tests show Moon May's +2 Wis, +2 Cha, −2 Dex.
- **Race-covered and re-homed outputs.** Cold-Blooded and Suspicious carry their race's checked #328 note outputs (coveredTraitNotes), and Gnome Magic carries the Gnome race's re-homed illusion DC; their description records add only the Note.
- **School DCs.** Fell Magic (Gnome) and Hag Magic (AoE) get a reviewed `spellDC` Modifier for their school (the raw `dc.school.*` changes don't map), as #387 did.
- **Choice skills** are one Modifier per Knowledge skill under its own manual Situation (Knowledgeable, Memories of the Forgotten). Obsessive, a standard gnome trait, stays prose and outstanding: Craft and Profession Modifiers would change the Gnome race's totals, which the #719 race-total check pins to the race's checked #328 record (listed for review with that record).
- **Shared Situations** only where the condition matches exactly: fear (Deep Shadow Explorer, Eternal Hope), mindAffecting (Trusted Mediator), sunder (Gatecrasher, on CMB) and the race-covered mindAffecting, poison and illusions. Eternal Hope's despair half and everything else are local.
- **Drafter outputs not used:** Gatecrasher's and Low Blow's placeholders are a Note (no Strength check or critical confirmation statistic); Alternate Skill Modifiers (Skinwalker - Coldborn)'s wild empathy Modifier is a Note on Diplomacy, as earlier batches keep wild empathy; Vampire Hunter's `+1` formula is the number 1; the split Situations of Eternal Hope and Alternate Weakness (Dhampir - Ru-Shi) are kept as the published phrase.
- **Notes follow the body, not the Foundry note:** Seasoned's comfort ranges (90 to 140 and 40 to −20 degrees, where the Foundry notes give 110 and 0); Creepy's "non-elf humanoids".
- **Bonus types listed for review (#370):** Draconic Consular's raw changes are typed racial where the body says "a +1 bonus"; a change replacement replaces only the formula.
- **Inherited rules beyond the race:** Shadow Inheritor cites Ultimate Magic for the shadow descriptor with a "UM" superscript (no page), so PZO1117 is its minimum dependency (#385 ruling), with the APG shadow bloodline and oracle; Jininese Weapon Mastery requires Ultimate Equipment (PZO1123), the only book its weapons' pinned item records cite. Triton Magic's dolphin has no sourced pinned record and stays a named unresolved origin.
- **Trusted Mediator, listed for review:** the record cites only ARG p.216, and PCGen's only copy is an Inner Sea Races row; it is a lead, so Inner Sea Races is required only through the Suli race record.
- **Not modeled, listed:** senses, speeds, spell-like abilities and other actions, natural attacks, energy resistance, spell resistance and vulnerability, creature types, class-skill grants, languages, miss chances and rerolls, environmental comfort, sorcerer and domain affinities, and the fey magic choices.

## Importer and data gaps

- **Journal-page link (#738).** Amphibious (Merfolk) links the Universal Monster Rules Amphibious journal page. The importer strips the link, so the record fails admission with `Broken structure or reference: unresolved imported reference.` in any preview. The failure does not depend on curation; it stays editorially held.
- **Unresolved replaced name (own entry; neither #738 nor #739).** Mist Child names "Hulking Changeling", the annis hag daughter's trait, which no pinned changeling record carries (the standard trait is "Hag Racial Trait (Changeling)"), as Pyrophile's "Hag Trait" in #390.
- The racial subtypes Mwangi Dwarves and Dreamthief-Born (Waker May) keep "Base Statistics" unmatched, as designed.
- The raw upstream keys in `mapRacialTrait` caused no reference failure: the full preview's only batch failure is the journal-link gap; the bounded preview's 44 failures are links and replacements outside the selection.
- No linked pf-items record is missing. There is no Orc Atavism, no replacement of a counts-as trait and no multi-race "Base Statistics" folder in this batch.

## Outstanding mechanics

Each record lists its calculation gaps in `mechanicsReview.outstandingCalculations`; none is an attribution hold. The main ones are the two disputed ability lines above and the items under Notable cases ("Not modeled").

## Cross-batch bindings and protected records

Rebased onto `76d629a0` (#391 and #392 landed after this batch was curated on `1fe016bc`). Every re-bind below uses `buildAssessmentBinding` over a full `catalog:preview` of the rebased tree with this batch's records, with the earlier batch's fixture copies of this batch's keys replaced by the full-preview entries, the inventory `currentBinding` updated and the fixture-based binding checked to agree (all 30 agree). Fingerprints run from the rebased base to now. No disposition, evidence, notice or hold changed in the earlier batches. The 30 are every assessment, outside the deferred stale set, whose full-corpus closure reaches a batch key: 12 from #387 to #390, 11 from #391 and 7 from #392.

| Batch, assessment                 | Reaches (this batch)           | Content fingerprint       |
| --------------------------------- | ------------------------------ | ------------------------- |
| #387 Light from the Darkness      | Spell-Like Ability (Aasimar)   | `fc4b998e…` → `52afb5f8…` |
| #387 Utilitarian Magic            | Gnome Magic (Gnome)            | `a505c1dc…` → `2f1a1631…` |
| #387 Jininese Elves               | Jininese Weapon Mastery        | `6b97f584…` → `98345451…` |
| #388 Archon-Blooded (Lawbringers) | Spell-Like Ability (Aasimar)   | `e7cdc0ec…` → `4c3d96c1…` |
| #388 Fey Magic (Gnome - HotW)     | Obsessive                      | `cf90afe9…` → `ba2e4e4b…` |
| #388 Giant Ancestry               | Skilled (Human)                | `be7490b2…` → `adc6b4f9…` |
| #389 Round Ears                   | Skilled (Human)                | `86d3b83f…` → `6dfd2ba0…` |
| #389 Knack with Poison            | Obsessive                      | `58b03b05…` → `f6e13f58…` |
| #390 Transitional Lore            | Seasoned                       | `c32b20a8…` → `e10709f3…` |
| #390 Dirty Trickster              | Keen Senses (Gnome)            | `105cd14d…` → `039c9333…` |
| #390 Nature Affinity              | Keen Senses (Gnome)            | `8ddb859b…` → `e3069401…` |
| #390 Smokesoul (Fume Sylph)       | Air Affinity                   | `d101f6a6…` → `192ce010…` |
| #391 Heart of the Sun             | Skilled (Human)                | `3788de8b…` → `4744d94a…` |
| #391 Institutional Memory         | Skilled (Human)                | `664d5339…` → `e69fcf68…` |
| #391 Shadowplay (Gnome)           | Gnome Magic (Gnome)            | `23c6fb39…` → `c7a7e121…` |
| #391 Heart of the Streets         | Skilled (Human)                | `3d6f5423…` → `e2ff85ad…` |
| #391 Deft Swords                  | Natural Weapon (Tengu)         | `1cbe0c2f…` → `a2e118f8…` |
| #391 Comprehensive Education      | Skilled (Human)                | `e044846b…` → `d706e9de…` |
| #391 Daylight Adaptation          | Spell Resistance (Drow)        | `03e3aaea…` → `284f5485…` |
| #391 Immortal Spark               | Spell-Like Ability (Aasimar)   | `e1852b68…` → `04555023…` |
| #391 Heart of the Mountains       | Skilled (Human)                | `63a1b77a…` → `d1f91181…` |
| #391 Fey Magic (Gnome - HftF)     | Obsessive, Gnome Magic (Gnome) | `2f3f3b0b…` → `ae38849e…` |
| #391 Cautious Brawler             | Suspicious                     | `d932771e…` → `0361ec64…` |
| #392 Intrepid Settler             | Keen Senses (Gnome), Obsessive | `85dd43ce…` → `97fd3b1e…` |
| #392 Imposter-Wary                | Skilled (Human)                | `e966456a…` → `090f5146…` |
| #392 Student of the City          | Obsessive                      | `2ffd6b1f…` → `badf3d88…` |
| #392 Industrious                  | Skilled (Human)                | `b5f9e6dd…` → `69b2f22b…` |
| #392 Breeze-Kissed (Sylph)        | Air Affinity                   | `2a613d29…` → `bb969fd7…` |
| #392 Poison Minion (Human)        | Skilled (Human)                | `4196cc06…` → `0f407d30…` |
| #392 Peri-Blooded (Emberkin)      | Spell-Like Ability (Aasimar)   | `8da921df…` → `f4b33154…` |

They are recorded in each batch's inventory `currentBinding` and `tests/fixtures/<batch>/preview.json` (`racial-traits-387` to `racial-traits-392`). The rebase's data-merge conflicts (Jininese Elves, Archon-Blooded, Round Ears and Dirty Trickster, which #392 also re-bound) are resolved by these re-binds over the rebased tree.

- **Already stale, not re-bound:** the 20 #328 race assessments and #333's Extra Gnome Magic that reach batch keys were stale on the base (the deferred stale set, curation.md).
- **This batch's closures reach** #391's Weapon Familiarity (Elf), Weapon Familiarity (Dwarf) and Hatred (Gnome) and #392's Sneaky (Hobgoblin), Defensive Training (Gnome) and Hatred (Dwarf); those entries are bound as the rebased full preview has them.
- **Protected and fixture copies:** no batch key is a protected root of an earlier batch. `feats-355/binding-preview.json` copies eight batch keys that no #355 assessment's closure reaches, and the #530 to #536 and #350 to #355 `protected-context.json` lists name 26 batch keys only as context; `feats-355.test.ts` and `cross-batch-bindings.test.ts` pass with them.

## Binding

Every assessment is bound with `buildAssessmentBinding` against the full-corpus content closure: the final full `catalog:preview` artifact, with the batch's 74 entries and their 131 closure entries. The [preview fixture](../../tests/fixtures/racial-traits-393/preview.json) keeps both, so the batch test rebuilds every binding from a clean shared-store tree (0 mismatches).

## Tests

The [resolver tests](../../tests/catalog/racial-traits-393.test.ts) pin Asura-Spawn's heritage replacement against the tiefling sheet, the two disputed ability lines left prose, every Situation-gated bonus (off by default, on when selected), the shared Situations, distinct racial Sources stacking, imported and race-supplied values not curated twice, the school DCs, the Moon May replacement and no `ac.other` armor, shield or natural armor bonus; all 38 required and 74 description records checked and their Note targets; the race, alternate, monster-ability, cited and Unchained notice dependencies (20 PZO1131 keys, own action versus bound body) and every enforced hold; the importer's reading and the exact unresolved names; every pinned body, PCGen row and PRD paragraph in the shared store; and re-extraction from a clean shared-store tree with every binding reproduced, 73 records held (72 on their own reasons, Multi-Armed on the Dynamite source-matched hold), only the journal-link gap failing, and a confirmed Keen Senses (Gnome) still held.

The [isolated saved-sheet test](../../tests/catalog/racialTraits393.integration.test.ts) exercises public Convex reads and writes: a changeling-identity race granting its ability, claws and natural armor traits takes the held Moon May ability record and Hag Magic (AoE), whose natural armor replacement drops `ac.natural` from 1 to 0, and turns them off again, with saved totals equal to the preview; outsiders, anonymous callers and another campaign's entry are refused without changing the sheet. The shared held-release round trip is covered once by the release test in [`traits367.integration.test.ts`](../../tests/catalog/traits367.integration.test.ts). No deployment or production activation occurred.

## Preservation and gates

The shared canonical files gain only this batch's entries: 112 curation records (74 description and 38 note records), 74 assessments, 74 evidence entries and 35 notice holds. The other changes are the listed re-binds with their `currentBinding` and fixture copies. Shared-file diff stat against the rebased base `76d629a0` (`git diff --cached --stat --diff-algorithm=histogram HEAD`):

```text
 scripts/catalog/legal/held-notices.json           |  329 +++
 scripts/catalog/legal/racial-traits-387.json      |    6 +-
 scripts/catalog/legal/racial-traits-388.json      |    6 +-
 scripts/catalog/legal/racial-traits-389.json      |    4 +-
 scripts/catalog/legal/racial-traits-390.json      |    8 +-
 scripts/catalog/legal/racial-traits-391.json      |   22 +-
 scripts/catalog/legal/racial-traits-392.json      |   14 +-
 scripts/catalog/reviewed-curation.json            | 2573 +++++++++++++++++++++
 src/lib/catalog/data/attribution-assessments.json | 1808 ++++++++++++++-
 src/lib/catalog/data/attribution-evidence.json    |  222 ++
 tests/fixtures/racial-traits-387/preview.json     |   15 +
 tests/fixtures/racial-traits-388/preview.json     |   17 +-
 tests/fixtures/racial-traits-389/preview.json     |   12 +-
 tests/fixtures/racial-traits-390/preview.json     |   36 +-
 tests/fixtures/racial-traits-391/preview.json     |   39 +-
 tests/fixtures/racial-traits-392/preview.json     |   31 +-
 16 files changed, 5060 insertions(+), 82 deletions(-)
```

<!-- prep:shared-store-count -->

New shared-store files (`tests/fixtures/pinned/`), counted by prep after the rebase onto `76d629a0`: **93** (pcgen 2, pf1 3, pf1-content 88).

<!-- /prep:shared-store-count -->

The batch adds to the shared store its 100 pinned records, the pf-racial-traits folder records above them, the pinned race records they bind to, the linked bodies (spells and racial traits), the PCGen race-ability, class and anchor files the evidence cites, and the PRD capture pages; files already on the base were reused.

The complete preview of the rebased tree (`76d629a0` plus this batch) reported **86 admitted, 23,168 held, 2 dependent omissions and 2,451 failures**; before the rebase it reported 2,521 on `1fe016bc`, 38 fewer than that base's 2,559 (this batch's required note records). The only batch key among the failures is the journal-link gap, which the base already had. The full-corpus gate is therefore a documented failure, not a claim of whole-corpus readiness.

| Command                                                                                                                                                                                                                                                                                                                                 | Result                                                                                                                                                                                    |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `catalog:curate --candidates …` (required) and `--descriptions` (prose pass)                                                                                                                                                                                                                                                            | pass; 38 required drafts, 23 prose drafts                                                                                                                                                 |
| `catalog:preview --candidates …`                                                                                                                                                                                                                                                                                                        | exit 1; 0 admitted / 30 held / 44 failures, all links and replacements outside the selection (plus Amphibious (Merfolk)'s journal link)                                                   |
| Full `catalog:curate`                                                                                                                                                                                                                                                                                                                   | pass; 1,415 new drafts, none for this batch; 0 missing; the known Orang-Pendak and Dwarf race note records stale (as on the base); about 3.5 min                                          |
| Full `catalog:preview` (final records; rebased: 2,451 failures)                                                                                                                                                                                                                                                                         | exit 1; 2,521 failures (base 2,559), the journal-link gap the only batch key; about 4 min plus admission queue                                                                            |
| Full re-bind (`bind.ts`, `xrebind393.ts` over the final full preview)                                                                                                                                                                                                                                                                   | 74 assessments bound, 131 closure entries, 0 mismatches against the clean-tree reconstruction; 30 earlier assessments re-bound on the rebased tree (12 before the rebase), fixtures agree |
| `pnpm test` of the batch tests, the guards (`notice-holds`, `pinned-sources`, `cross-batch-bindings`, `ac-other-defense-bonuses`, `notice-dependencies`, `data-files`) and the affected earlier tests (`racial-traits-387` to `-390`, `racial-traits-719`, `race-facts-720`, `race-ability-721`, `races-328`, `feats-355`) (one worker) | pass; 17 files / 410 tests; about 4.1 min                                                                                                                                                 |
| After the rebase onto `76d629a0`: `pnpm test` of the batch tests, `cross-batch-bindings` and `racial-traits-387` to `-392`, one file at a time (one worker)                                                                                                                                                                             | pass; 9 files (8 runs)                                                                                                                                                                    |
| `pnpm -s typecheck`                                                                                                                                                                                                                                                                                                                     | pass                                                                                                                                                                                      |
| `pnpm -s lint`                                                                                                                                                                                                                                                                                                                          | pass (after removing one unused test import); about 3 min                                                                                                                                 |
| `pnpm -s check:initial-migration-writers`                                                                                                                                                                                                                                                                                               | pass; 185 registrations                                                                                                                                                                   |
| `pnpm catalog:pin`                                                                                                                                                                                                                                                                                                                      | pass; `sha256:005ef0b9…`                                                                                                                                                                  |
| `pnpm catalog:notice-deps`                                                                                                                                                                                                                                                                                                              | pass; 0 gaps; 38 advisory warnings, none for this batch                                                                                                                                   |
| `pnpm catalog:format --check`                                                                                                                                                                                                                                                                                                           | pass                                                                                                                                                                                      |

`pnpm test tests/catalog` was left to the orchestrator's prep run on the rebased commit, as the brief directs.
