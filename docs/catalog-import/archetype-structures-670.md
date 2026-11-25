# Archetype structures: two mechanical Fighter archetypes (#670)

A #716 structure batch by class (batch name `archetype-fighter-1`; discriminator 670, the owning curation issue: [#670](https://github.com/AndreasUnunger/EverythingPath/issues/670) owns the fighter Archetypes). Since `archetype-select-2` the import emits 46 Fighter archetypes behind `--pcgen`, every row held on its structure gate or omitted behind a held feature. This batch writes the structure records of two of them, 11 rows, in `scripts/catalog/reviewed-curation.json` `structures`: nine feature records, written `drafted`; six are checked by the record step, four on review `t3-review-af9e9ccc0a2103b68e2b6182b482c9251e628f741d690e8440629dfd727b80bf` and two on review `t3-review-6fec4f2a72ae81c8a2d08e5ae97e81c1a83672761ca7a07a14028838eed5b3a0`, and three stay drafted and held ([Review state](#review-state)). The rows are preview-only: no release scope names them (owner decision 2026-11-10).

Sources: PCGen at `25523dbc` (`roleplaying_game/advanced_class_guide/acg_abilities_class.lst`, `roleplaying_game/ultimate_combat/uc_abilities_class.lst`) and the PRD capture `prd-2026-10-20` (`advancedClassGuide/classOptions/fighter.html` and `ultimateCombat/classArchetypes/fighter.html`, both added to the pinned store byte-identical by this batch). Each `sourceSha256` is the one the structure report of a `--pcgen` preview on the base `06cefcf0` gives. No owner or feature record, and no `.MOD` line naming one, carries a Product Identity flag.

## The batch

Ten of the 46 have no review item but `stackingGuard` and owned features by the selection's count. Two of them pass the further checks: an allowed text names every row the mapper replaces, at the level the Fighter gains it, no text carries a `%` token, a conditioned fragment or a scanning error, the text and the mapper agree, and no feature gives a number, feat, proficiency or count the sheet computes (root's description-only bar, 2026-11-18); the first promotion review found that two do, Strapped Shield and Hardbuckler, which are held ([Review state](#review-state)).

| Archetype        | Book    | Rows | Records                        | Replaces (level)                                                                          |
| ---------------- | ------- | ---: | ------------------------------ | ----------------------------------------------------------------------------------------- |
| Mutation Warrior | PZO1129 |    3 | two features (`description`)   | Armor Training 1-4 (3, 7, 11, 15, parts), Armor Mastery 19 (whole)                        |
| Thunderstriker   | PZO1118 |    8 | seven features (`description`) | Armor Training 1-4 (parts), Armor Mastery 19 (whole), Weapon Training 3-4 (13, 17, parts) |

- **The roots.** Neither has a review item, so neither has a record; each is omitted behind its held features until they pass, and then carries the mapper's rows. Each was checked row by row against its features' "This ability replaces …" in the PRD and the base Fighter's levels (CRB `coreRulebook/classes/fighter.html:382-404`; the reviewed schedule's numbered parts of Armor Training and Weapon Training). The Thunderstriker keeps Weapon Training at 5th and 9th.
- **The descriptions.** Each is the PRD's paragraph for the feature, without its heading, with links as plain text and entities as characters. After flattening, two differ from PCGen's DESC and take the PRD's: Mutagen (PCGen lacks "At 3rd level," and adds "(APG p.28)") and Mutagen Discovery (PCGen lacks "and" before "wings" and the sentence naming the rows it replaces, and words its last clause differently). The seven Thunderstriker texts equal PCGen's DESC.
- **Weapon Training.** It and its parts are held under #227 on the owner-owed PZO9493 hold, and the Fighter class is a dependent omission behind them. A root depends on the rows it replaces, so with the records checked the Mutation Warrior's root is admitted and the Thunderstriker's, which replaces Weapon Training at 13th and 17th, stays a dependent omission behind them.

## Review state

Two promotion reviews (gpt-6.2-sol, 2026-11-23) confirmed six records, and the record step checked them on their receipts: the first Knockback Smash, Hammer and Anvil, Balanced Bashing and Improved Buckler Defense (`t3-review-af9e9ccc…`); the second, after their rationales were corrected, Mutagen and Buckler Defense (`t3-review-6fec4f2a…`). Three stay drafted and held; root takes all three up with the `thunderstriker-buckler` slice:

| Feature           | Why it is held                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mutagen Discovery | The second review found the description honest under the description-only bar but withheld its verdict on the rationale: it omits that Nauseating Flesh also acts on a creature that engulfs him and that he is immune to its poison, and it should say that Vestigial Arm's extra limb is a number the player enters for the attack routine, as the Tentacle entry is. The record is unchanged; it waits for that correction and a review. |
| Strapped Shield   | It removes the buckler's −1 melee penalty in the two-handed case, which the checked buckler Modifier applies under a Situation; no record field carries that. Waits for a code slice.                                                                                                                                                                                                                                                       |
| Hardbuckler       | It grants a light-shield bash with the buckler, which the attack model computes only for an item with weapon detail; the catalog's buckler has none. Waits for a code slice.                                                                                                                                                                                                                                                                |

As committed, the six checked features are admitted under #227 on their declared books (6 of the 11 rows): Mutagen on PZO1129, the five Thunderstriker features on PZO1118. Both roots are dependent omissions: the Mutation Warrior's behind Mutagen Discovery alone, the Thunderstriker's behind Hardbuckler and Strapped Shield and behind Weapon Training and its parts at 13th and 17th. No release scope includes either archetype.

## Left out

| Archetype               | Why                                                                                                                                                                                                               |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Phalanx Soldier         | Deft Shield reduces a tower shield's armor check penalty (PRD `advancedPlayersGuide/coreClasses/fighter.html:392`), which the sheet applies to skills; no record field changes an item's penalty.                 |
| Roughrider              | Armored Charger waives armor check penalties on Ride (`:411`), which the sheet applies whenever armor is worn.                                                                                                    |
| Savage Warrior          | Natural Savagery gives an unconditional attack and damage bonus with natural weapons (`:421`); no Modifier condition limits a bonus to natural attacks alone (`$unarmedOrNatural` also takes the unarmed strike). |
| Two-Weapon Warrior      | Improved Balance and Perfect Balance reduce the two-weapon penalties the sheet applies (`:449`, `:451`), and Twin Blades adds to a two-weapon full attack (`:447`).                                               |
| Cavern Sniper           | Sniper Training gives an unconditional bonus with a chosen bow or crossbow group (`advancedRaceGuide/featuredRaces/drow.html:399`); no record field gives that choice.                                            |
| Cad                     | It loses medium armor, heavy armor and tower shield proficiency and gains Catch Off-Guard as a bonus feat (`ultimateCombat/classArchetypes/fighter.html:366`, `:369`): grants no record field holds.              |
| Gladiator               | It loses heavy armor and tower shield proficiency and gains Performance Weapon Mastery as a bonus feat (`:391`), and performance feats as fighter bonus feats (`:392`).                                           |
| Tower Shield Specialist | Tower Shield Training changes Armor Training's numbers while a tower shield is used (`:415`), a code rule no record field adjusts.                                                                                |

## What the sheet computes

No record gives a number: every feature keeps `modifiers: []`. Both archetypes replace Armor Training's 3rd-level row, the identity the sheet's Armor Training rule keys on (`src/lib/character-sheet-equipment.ts`), so a Mutation Warrior or Thunderstriker has no Armor Training tier: a breastplate keeps its own max Dex (+3) and armor check penalty (−4) at Fighter 4 and 8, where a Fighter has +4/−3 and +5/−2. Weapon Training and Armor Mastery carry nothing the sheet computes. What stays prose, each situational or nothing the sheet computes:

- Mutagen's bonuses and penalties, only while the mutagen is in effect; Mutagen Discovery's discoveries, a choice the sheet does not hold and no slot it counts. Five options work through the mutagen; nauseating flesh acts only on a creature that bites, engulfs or swallows him (he is immune to its poison), and preserve organs only when he is critically hit or sneak attacked; vestigial arm gives no extra attack, and its limb is a number the player enters for the attack routine; a tentacle is a natural attack entry the player adds, as every natural attack is; spontaneous healing's and wings' daily allowances are computed for neither.
- The Thunderstriker's checked buckler features: the sheet has no buckler bash (the catalog's buckler has no weapon detail), so Knockback Smash, Hammer and Anvil and Balanced Bashing change no attack it computes, and Improved Buckler Defense keeps the full shield bonus the sheet already shows. Buckler Defense is situational: its +1 without the buckler's magic applies only in a turn with a weapon in both hands or in each hand, a turn-long loss the sheet does not model. Strapped Shield and Hardbuckler are held (above).

No per-day maximum is bound: none of the nine has uses per day. PCGen gives Mutagen and Mutagen Discovery selection pools (`BONUS:ABILITYPOOL`: the mutagen's physical scores, and the discoveries), which are choices, not daily resources; two of the discoveries offered, spontaneous healing and wings, have daily allowances of their own, which the sheet computes for neither.

## Tests

[`archetype-structures-670.test.ts`](../../tests/catalog/archetype-structures-670.test.ts) runs on the pinned tree from one table: each archetype's file, page, book and reviewed replacements, and each feature's level, source hash and PRD line.

- The committed records have exactly these fields, items and hashes; six are checked under the record step's receipts (four on the first review, Mutagen and Buckler Defense on the second) and three drafted, each with why. Each description is read from the pinned PRD page. The eight left-out archetypes have no record.
- Each root's rows, feature changes and additions are the mapper's, and neither root has a review item.
- As committed, the six checked records apply and their six rows are admitted under #227 on PZO1129 or PZO1118; the three drafted features stay held on structure, both roots are omitted behind them (the Mutation Warrior's behind Mutagen Discovery, the Thunderstriker's behind Hardbuckler and Strapped Shield and also Weapon Training and its parts at 13th and 17th), and no other key changes.
- Drafted in memory, no emitted key changes state against the overlay without the records. Every feature is held on structure; both roots are omitted behind their features.
- With the nine checked in memory, every gate passes and the records apply. Ten rows are admitted under #227 on their declared books (PZO1129, PZO1118); the Thunderstriker's root stays a dependent omission behind Weapon Training and its parts at 13th and 17th; no other key changes.
- With the nine checked in memory, a Fighter 4 or 8 of either archetype in a breastplate has the breastplate's own max Dex and penalty.

The two status-dependent cases are marked in the test. It reads the ACG and UC fighter pages, which the pinned store lacked, added byte-identical from the capture.

<!-- prep:shared-store-count -->
New shared-store files (`tests/fixtures/pinned/`), counted by prep after the rebase onto `d062f857`: **2** (prd 2).
<!-- /prep:shared-store-count -->
