# Special qualities #501: pf1-content pf-special-qualities batch 1

Reviewed by **Opus (AI curator) for the owner**, 2026-10-21.

Exactly the issue's 100 keys were reviewed: **0 admitted, 98 specifically held, 0 dependent omissions, 0 whole-entry unsupported/prose-only dispositions, 2 exclusions, 0 record-level 3.5 holds**. The pf1-content `pf-special-qualities` pack is not creature special qualities: it holds the weapon, armor and shield special abilities the importer maps as `itemAbility` Catalog Entries (`scripts/catalog/inventory.ts`, `map('itemAbility')`; [weapons and armor contract](../character-sheet/weapons-and-armor.md#item-abilities)). The exclusions are the pack's two Foundry `!folders!` records in the batch (Weapons, Ranged Weapons). No candidate carries a `3.5` tag. By tag, the 98 abilities are 25 armor, 24 melee, 15 universal weapon, 14 ranged, 12 shield and 8 universal armor-and-shield qualities.

The [machine-readable inventory and evidence](../../scripts/catalog/legal/pf-special-qualities-501.json) records, per key, the complete pinned body with its source hash, tags and cited sources; the PCGen EQMOD rows (comparison, further rows and rejected rows); the inherited-rule notices with the pinned same-pack records, Universal Monster Rules page and PCGen rows that evidence them; the checked curation record, outstanding calculations and source discrepancies; the Item Ability review (tag, mapped `appliesTo`, slot, price line, bonus equivalent and end state); and the current assessment binding and mapped facts. This report summarizes them and does not repeat the evidence.

## Family rulings (first batch of the family; for review)

This is the family's first batch, so these choices are proposed as its precedent for #502 to #504.

1. **The `itemAbility` record is the description record.** `collectCurationInputs` makes every Item Ability's raw description a required `itemAbility` input, and `collectDescriptionInputs` gives Item Abilities no prose-pass input, so a `description` record for one would only be stale. Each ability has exactly one checked `itemAbility` record (98), which carries all its reviewed outputs. The #749 ownership check (`tests/catalog/batch-ownership.ts`) accepted only `description` records; it now takes an Item Ability's `itemAbility` record (target `description`) as its description record, with a test in `batch-ownership.test.ts` and a line in [curation.md](curation.md#preservation-checks). No other batch has an `itemAbility` record, so no earlier check changes.
2. **Outputs.** The record's `itemAbility` output carries `bonusEquivalent` from the price line ("+N bonus" is N; a flat gold price is 0; a tiered body takes its entry's tier: Spell Resistance (19) 5, Fortification (light) 1, Greater Aquadynamic 0), then structured facts where the body states them for the item itself: unconditional damage dice (Corrosive Burst: 1d6 acid, 1d10 acid on a critical hit, kept on its helper seed; Sapping: 2d6 nonlethal), `weaponDamageTypes` for a damage-type placement limit (Underwater, Smashing, Flamboyant, Bloodsong, Vorpal), `sourceKey: haste` for Speed (the reviewed policy) and `choice: creatureType` for Defiant (Armor) (the bane table). A Modifier is used only where a sheet statistic, bonus type and Situation fit the body exactly (33 Modifiers on 20 abilities, such as Greater Shadow's +15 competence on Stealth, Mind Buttressing's +2 resistance on Will, Arrow Catching's +1 deflection to AC against ranged weapons and Bashing's +1 enhancement on attack and damage with `weapon: '$self'`). Every other rule is a Note: the body's own sentences, verbatim, on the statistic they qualify where one fits (325 Notes). Aura, slot, price and construction lines, flavor, random-roll tables and placement rules that `appliesTo` and `weaponDamageTypes` cover are not Notes.
3. **Situations.** Two shared Situations match a body exactly: `poison` (Poison-Resistant) and `reposition` (Repositioning); Courageous' Notes use `fear`. All others are local. Situational damage dice under a local Situation (Smashing, Huntsman, Neutralizing, Valiant, Blood-Hunting) stay Notes: the stored Item Ability detail (`convex/schema.ts`, `itemAbilityDetailValidator`) takes only a shared Situation key or the chosen foe, so such a record could never be released.
4. **Attribution bar and holds.** No permitted source states a complete body: PCGen's EQMOD rows name an ability, its type and cost and summarize it (`SPROP`), and the pinned PRD captures have no magic item pages. Every ability is held `whole-content` (as #430's items), naming its PCGen row or its lack of one. Ten are also held `applies-to`: eight tagged "Universal Armor & Shield Qualities", which the importer doesn't read (gap 1, #764), Brawling (an armor quality tagged Melee Qualities) and Defiant (Armor) (an armor-and-shield quality tagged Armor Qualities); the overlay can't set `appliesTo`.
5. **Books.** Every ability requires PZO1110 (the core magic arms and armor rules), its cited books, the books of its PCGen comparison and further rows (as #430), the books of rules its body inherits, and the book of each pinned same-pack record it builds on ("as slick", "functions as a corrosive weapon", "acts as a dancing weapon", "bane", "keen", "planar", "guarding", "concealed", "sniping"). Inherited rules from other books, each evidenced by a pinned PCGen row or journal page: PZO1115 for the reposition and steal maneuvers (Repositioning, which cites APG p.322; Adhesive, Sticky, Ki Intensifying) and the cavalier's challenge (Valiant); PZO1118 for firearms (Dry Load) and grit (Corsair); PZO1129 for panache (Corsair); PZO1112 for the natural attack rules of Dread Wing's wings (as #506) and the rust monster Rusting is immune to. Rejected PCGen rows (Amulet of Mighty Fists versions, and different abilities that share a name: ACG's weapon Brawling, the non-magical Jarring quality, the weapon Defiant and Advancing) add no book. Construction requirements are crafting prerequisites, not inherited rules. No ability has an action or a link, so no closure reaches Unchained action costs: no PZO1131. Codes without a reviewed Registry identity are held as `pf-special-qualities-501-notice-<code>-complete-chain` (26 holds, registered in `held-notices.json`); PZO90100 (Hell's Rebels #4) and PZO9235 (Pathfinder Society Field Guide) are required for the first time. `pcgen:<code>` Registry records (#716) are not aliases of the codes and are not claimed.
6. **Gear review.** An Item Ability has no Base Item or magic defaults; its end state is the imported `itemAbility` entry with the record's facts (`mechanicsReview.itemAbilityReview`).

## Dispositions

One line per key; a held record's reason is its assessment rationale in the inventory, and its hold IDs are `pf-special-qualities-501-<kind>-<id>`. Held notices omit PZO1110, which every ability requires and which has a reviewed Registry identity.

| Key                            | Name                        | appliesTo, bonus | Disposition                                                      | Held notices              |
| ------------------------------ | --------------------------- | ---------------- | ---------------------------------------------------------------- | ------------------------- |
| `pf1-content/GWEmWfngvQvEqjkY` | Adaptive                    | ranged, +0       | held: `whole-content`                                            | PZO1123                   |
| `pf1-content/GelmnVEp62GQJRiK` | Adhesive                    | armor, +0        | held: `whole-content`                                            | PZO1123, PZO1115          |
| `pf1-content/HpBIIDCEuBanx6OI` | Advancing                   | melee, +2        | held: `whole-content`                                            | PZO1123                   |
| `pf1-content/DaZMtTHcqd5colrz` | Advancing (Armor)           | armor, +1        | held: `whole-content`                                            | PZO9467                   |
| `pf1-content/5BDDxVM0QS9zJMkR` | Agile                       | melee, +1        | held: `whole-content`                                            | PZO90100, PZO9235         |
| `pf1-content/AbviDKQpdEJkzRH3` | Arrow Catching              | shield, +1       | held: `whole-content`                                            | PZO1123                   |
| `pf1-content/JEMOQ1rWJuPjYE3Y` | Arrow Deflection            | shield, +2       | held: `whole-content`                                            | PZO1123                   |
| `pf1-content/C1QoYqp2W4lIoWJs` | Bashing                     | shield, +1       | held: `whole-content`                                            | PZO1123                   |
| `pf1-content/8VA336eJRW3B8GhW` | Bastion                     | shield, +4       | held: `whole-content`                                            | PZO9467                   |
| `pf1-content/FEykXTn6oR0PWKn2` | Blinding                    | shield, +1       | held: `whole-content`                                            | PZO1123                   |
| `pf1-content/6jpkHSPYLaGhgOw6` | Blood-Hunting               | weapon, +1       | held: `whole-content`                                            | PZO1129, PZO1123          |
| `pf1-content/9LhCuuEOtw3z0ZkL` | Bloodsong                   | melee, +1        | held: `whole-content`                                            | PZO1129, PZO1123          |
| `pf1-content/7RZHBGxdecIbAqbz` | Brawling                    | melee, +3        | held: `whole-content`, `applies-to`                              | PZO1123                   |
| `pf1-content/1ZKtmktEk4za36nm` | Buoyant (shield)            | shield, +0       | held: `whole-content`                                            | PZO9440                   |
| `pf1-content/Cnr3KLmajjgLo22f` | Burdenless                  | armor, +0        | held: `whole-content`                                            | PZO1129                   |
| `pf1-content/B93hPhBUnXDXKNBt` | Calming                     | armor, +1        | held: `whole-content`                                            | PZO1129                   |
| `pf1-content/1ywyc84me8yK0Bau` | Clangorous                  | shield, +1       | held: `whole-content`                                            | PZO1123                   |
| `pf1-content/EbMvtdTfBOUGczcy` | Clustershot                 | ranged, +1       | held: `whole-content`                                            | PZO9402                   |
| `pf1-content/3mtia22foEU8CA8y` | Concealed, Lesser           | melee, +0        | held: `whole-content`                                            | PZO9469                   |
| `pf1-content/18qjMjleexi1wO7R` | Corrosive Burst             | weapon, +2       | held: `whole-content`                                            | PZO1123, PZO1115          |
| `pf1-content/IG36xYuXJzzvobjM` | Corsair                     | armor, +0        | held: `whole-content`                                            | PZO9451, PZO1118, PZO1129 |
| `pf1-content/4XqrcCdeUcqQSqKp` | Cotraveling                 | armor, +3        | held: `whole-content`                                            | PZO1141                   |
| `pf1-content/GeB93KLI83vfW64j` | Courageous                  | melee, +1        | held: `whole-content`                                            | PZO1123                   |
| `pf1-content/C6AUebRJctWVhZI4` | Creeping                    | armor, +0        | held: `whole-content`                                            | PZO1123                   |
| `pf1-content/Ii2yw8yoj7FFtOJj` | Dazzling Radiance           | melee, +1        | held: `whole-content`                                            | PZO9459                   |
| `pf1-content/ErHgYTMtC7fVFUTN` | Deceiving                   | armor, +0        | held: `whole-content`                                            | PZO9464                   |
| `pf1-content/ImsFX0ll29kkrRlH` | Deceptive                   | weapon, +1       | held: `whole-content`                                            | PZO9435                   |
| `pf1-content/8XFHtmGIuSTSGsS1` | Defiant (Armor)             | armor, +1        | held: `whole-content`, `applies-to`                              | PZO1123                   |
| `pf1-content/1z9eTs6uxIAjoQHC` | Delving                     | armor, +0        | held: `whole-content`                                            | PZO1123                   |
| `pf1-content/3lGeXAtaPAMM1QYP` | Denying                     | armor, +4        | held: `whole-content`                                            | PZO1126                   |
| `pf1-content/0wTHpOq0DwKVzpdr` | Designating (greater)       | ranged, +4       | held: `whole-content`                                            | PZO1123                   |
| `pf1-content/8eEuMLcS3IX2WkI7` | Designating (lesser)        | ranged, +2       | held: `whole-content`                                            | PZO1123                   |
| `pf1-content/17dPLHjA3j6BKfIH` | Dread Wing                  | armor, +5        | held: `whole-content`                                            | PZO9467, PZO1112          |
| `pf1-content/7YygZ0xtPXaE3WUz` | Driving                     | ranged, +1       | held: `whole-content`                                            | PZO9463                   |
| `pf1-content/5t22SvLyN9ou1TlC` | Dry Load                    | ranged, +0       | held: `whole-content`                                            | PZO1123, PZO1118          |
| `pf1-content/47R7dzs488PktZ0N` | Endless Ammunition          | ranged, +2       | held: `whole-content`                                            | PZO1123                   |
| `pf1-content/4OyCfYX4wp02wesU` | Energy Resistance, Greater  | armorOrShield, +0 | held: `whole-content`                                            | PZO1123                   |
| `pf1-content/44AmrK1t4uDywex6` | Energy Resistance, Improved | armorOrShield, +0 | held: `whole-content`                                            | PZO1123                   |
| `pf1-content/IiBaJz4vhmuKk6y4` | Exclusionary                | weapon, +0       | held: `whole-content`                                            | PZO1129                   |
| `pf1-content/9eJlwjX0CSpGSSNI` | Exhausting                  | melee, +3        | held: `whole-content`                                            | PZO1129                   |
| `pf1-content/90I0SDekCD84WpH6` | Expeditious                 | armor, +0        | held: `whole-content`                                            | PZO1123                   |
| `pf1-content/5RwAF7SPxLZSkU9I` | Fervent                     | weapon, +1       | held: `whole-content`                                            | PZO9433                   |
| `pf1-content/B2KAHgk7GdtzAU5R` | Fitting                     | armorOrShield, +0 | held: `whole-content`                                            | PZO9453                   |
| `pf1-content/93qmS50ukqnnzrAL` | Flamboyant                  | melee, +1        | held: `whole-content`                                            | PZO1129                   |
| `pf1-content/DAlEgkoi3Ar16Sbs` | Flying                      | melee, +5        | held: `whole-content`                                            | PZO1129, PZO1123          |
| `pf1-content/ESa4zBfizx2LWPGx` | Fortification (light)       | armorOrShield, +1 | held: `whole-content`                                            | PZO1123                   |
| `pf1-content/6tQ7vviaExYHUJAe` | Glitterwake                 | ranged, +2       | held: `whole-content`                                            | PZO9452                   |
| `pf1-content/BvL8j0FzVJuGJrjZ` | Greater Aquadynamic         | armor, +0        | held: `whole-content`                                            | PZO92102                  |
| `pf1-content/BiquORGSwwA0ZzMK` | Growing                     | melee, +1        | held: `whole-content`                                            | PZO9455                   |
| `pf1-content/CM8GyE1jGgZG196v` | Guarding, Greater           | shield, +2       | held: `whole-content`                                            | PZO1121                   |
| `pf1-content/28mZaOq3CfDqL9O4` | Harvesting                  | melee, +2        | held: `whole-content`                                            | PZO1126                   |
| `pf1-content/9CcdDASLZSOQm5Y3` | Heartseeker                 | melee, +1        | held: `whole-content`                                            | PZO1123                   |
| `pf1-content/6moCHpaNcqmJbQSs` | Huntsman                    | weapon, +1       | held: `whole-content`                                            | PZO1123, PZO1115          |
| `pf1-content/CooESOIAcPJ1Q5s6` | Impact                      | melee, +2        | held: `whole-content`                                            | PZO1123                   |
| `pf1-content/CLpsUU5y1nKMJOqH` | Injecting                   | weapon, +1       | held: `whole-content`                                            | PZO9464                   |
| `pf1-content/HdND5N1lvTdJPZhT` | Jarring                     | armorOrShield, +2 | held: `whole-content`                                            | PZO1129                   |
| `pf1-content/IfHEHbLRBFpC85Dp` | Ki Intensifying             | melee, +2        | held: `whole-content`                                            | PZO1123, PZO1115          |
| `pf1-content/EPlL3UMiOp0ayBU4` | Limning                     | weapon, +1       | held: `whole-content`                                            | PZO1123                   |
| `pf1-content/GT0akONArUpmFmPy` | Locksmith                   | armor, +0        | held: `whole-content`                                            | PZO9467                   |
| `pf1-content/DkboXHWEmWAKrS1O` | Malevolent                  | armor, +0        | held: `whole-content`                                            | PZO9464                   |
| `pf1-content/Bpy6935X1nKbZ2pS` | Mastering                   | shield, +2       | held: `whole-content`                                            | PZO9467                   |
| `pf1-content/0RRzAISUevCLqcrZ` | Merging                     | shield, +2       | held: `whole-content`                                            | PZO1123                   |
| `pf1-content/A8j4ZpDkqgl8e2yb` | Mind Buttressing            | armor, +2        | held: `whole-content`                                            | PZO9440                   |
| `pf1-content/EbYg8o7SI2E7Dwcm` | Neutralizing                | melee, +1        | held: `whole-content`                                            | PZO1123                   |
| `pf1-content/GsUGX1vNeH8t0bls` | Phantom Ammunition          | ranged, +0       | held: `whole-content`                                            | PZO1129                   |
| `pf1-content/5wxzZrLbI7VXiGgN` | Phase Lurching              | armor, +0        | held: `whole-content`                                            | PZO9467                   |
| `pf1-content/EgBFCQmcAkuF2Xmq` | Planestriking               | weapon, +2       | held: `whole-content`                                            | PZO1141, PZO1123          |
| `pf1-content/Bd0lZDCWLWjgEJzv` | Plummeting                  | ranged, +1       | held: `whole-content`                                            | PZO1140                   |
| `pf1-content/6vSSaXW9jhdn976n` | Poison-Resistant            | armorOrShield, +0 | held: `whole-content`                                            | PZO1123                   |
| `pf1-content/9hXZpZlWsV5ejf4e` | Potent                      | weapon, +2       | held: `whole-content`                                            | PZO1126                   |
| `pf1-content/5ZfByFMfpQ2xsJsE` | Ramming                     | shield, +1       | held: `whole-content`                                            | PZO1123                   |
| `pf1-content/4DXOvYyjpcciEjGL` | Ranged Weapons              | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |                           |
| `pf1-content/DR161atTx3xeLuR3` | Repositioning               | melee, +3        | held: `whole-content`                                            | PZO1123, PZO1115          |
| `pf1-content/HnjpvtpaVj6KSX9N` | Resizing                    | weapon, +0       | held: `whole-content`                                            | PZO9453                   |
| `pf1-content/73KsLBovvqUtczcP` | Restful                     | armor, +0        | held: `whole-content`                                            | PZO1129                   |
| `pf1-content/88ERXWXRioVhUKWK` | Righteous                   | armor, +0        | held: `whole-content`                                            | PZO1123, PZO1115          |
| `pf1-content/78XqKvmqNkAImdK0` | Runeforged                  | weapon, +2       | held: `whole-content`                                            | PZO1002, PZO1123          |
| `pf1-content/5yzou4GrccvAA3sb` | Rusting                     | melee, +1        | held: `whole-content`                                            | PZO9440, PZO1112          |
| `pf1-content/9bXtjuH2QvRblIkH` | Sacrosanct                  | weapon, +0       | held: `whole-content`                                            | PZO1126                   |
| `pf1-content/FsOY4SRWAqWVf6WB` | Sapping                     | melee, +1        | held: `whole-content`                                            | PZO9459                   |
| `pf1-content/EiB85MCGNZYd1uQG` | Second Chance               | ranged, +4       | held: `whole-content`                                            | PZO1123                   |
| `pf1-content/1TO09L6Wa8VasAVe` | Seeking                     | ranged, +1       | held: `whole-content`                                            | PZO1123                   |
| `pf1-content/4FpsrdOdZN2Guv6H` | Shadow, Greater             | armor, +0        | held: `whole-content`                                            | PZO1123                   |
| `pf1-content/28McsVsX40Cyt0qN` | Singing                     | shield, +1       | held: `whole-content`                                            | PZO9455                   |
| `pf1-content/2vmaLzoKk7Ri4Lkl` | Slick, Greater              | armor, +0        | held: `whole-content`                                            | PZO1123                   |
| `pf1-content/ACzoYPDdehPgL2Fk` | Slick, Improved             | armor, +0        | held: `whole-content`                                            | PZO1123                   |
| `pf1-content/0sY03JuSvzQcMHja` | Smashing                    | melee, +1        | held: `whole-content`                                            | PZO9455                   |
| `pf1-content/9yJWvdUkS0fVUG84` | Sniping                     | ranged, +2       | held: `whole-content`                                            | PZO9440                   |
| `pf1-content/7fHKRzJYYwizpUMo` | Sniping (greater)           | ranged, +0       | held: `whole-content`                                            | PZO9452                   |
| `pf1-content/E5jfgma2vpopfrkr` | Speed                       | weapon, +3       | held: `whole-content`                                            | PZO1123                   |
| `pf1-content/3pGnFgpDimSEwHhs` | Spell Resistance (19)       | armorOrShield, +5 | held: `whole-content`                                            | PZO1123                   |
| `pf1-content/Ib74ZPp13bNo6K38` | Sticky                      | melee, +1        | held: `whole-content`                                            | PZO9455, PZO1115          |
| `pf1-content/D15nrpSqMUZMb076` | Unaligned                   | weapon, +1       | held: `whole-content`                                            | PZO1141                   |
| `pf1-content/ItkNjxs4dChOdyzd` | Unbowed                     | armor, +5        | held: `whole-content`                                            | PZO9467                   |
| `pf1-content/3Vz0BnUvfPxl0g6q` | Undead Controlling          | armorOrShield, +0 | held: `whole-content`                                            | PZO1123                   |
| `pf1-content/0VOzNrORXJjHEEHe` | Underwater                  | melee, +1        | held: `whole-content`                                            | PZO92102                  |
| `pf1-content/C5npQL4wTJI5x2Ts` | Valiant                     | melee, +1        | held: `whole-content`                                            | PZO1123, PZO1115          |
| `pf1-content/9fivEFrDK7Cmq1AC` | Vigilant                    | armor, +0        | held: `whole-content`                                            | PZO1123                   |
| `pf1-content/I2hjMefCiSOzrj3D` | Vorpal                      | melee, +5        | held: `whole-content`                                            | PZO1123                   |
| `pf1-content/AqjqWFWInPuTJU1V` | Weapons                     | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |                           |

## Notable cases

- **Sniping (greater)** "functions as sniping": Ranged Tactics Toolbox's sniping (pinned Sniping (normal), `jQlpalTBDSkGsJpb`, +5 Stealth to remain hidden), not the batch's Sniping (`9yJWvdUkS0fVUG84`, Magical Marketplace, sneak attack range), which shares the name.
- **Corrosive Burst** keeps its pf1-content helper seed (1d6 acid, 1d10 acid on a critical hit), the dice its body inherits from the pinned Corrosive record. Agile's, Blood-Hunting's and Vorpal's seeds are dropped: Agile's formula is outside the closed grammar and ignores Weapon Finesse, Blood-Hunting's needs a designated-foe Situation, and Vorpal's 999 damage is not the rule.
- **Runeforged** holds all seven types in one body: its general rules are Modifiers under local Situations (+2 morale on saves against the opposed school, -2 Diplomacy, -5 while carrying two, +2 insight on initiative and +1 dodge for a matching sinful or virtuous wielder), the types are Notes.
- **Brawling's** PCGen Ultimate Equipment row prices it +1; the body says +3. Upstream slips are kept verbatim and listed (`"T he"`, `"I f"`, `"They wielder"`, `"liming"`, `"3 abilities minutes"`, `"nap stackAPG"`).
- **Buoyant (shield)** and **Greater Aquadynamic** carry bodies shared with other variants; each record takes its own tier.

## Importer and data gaps

[#764](https://github.com/AndreasUnunger/EverythingPath/issues/764) owned gaps 1 to 5. It resolved the importer and sheet gaps; the inventory's `importerGaps` keeps only what remains, with its keys. Gap 6 is a data note (`dataNotes`) under the `applies-to` holds.

1. **"Universal Armor & Shield Qualities" (resolved, #764).** `mapItemAbility` (`scripts/catalog/details.ts`) maps the pinned tag to `armorOrShield`, so Undead Controlling, Spell Resistance (19), Energy Resistance (Improved, Greater), Poison-Resistant, Fitting, Fortification (light) and Jarring import with it and store. Their `applies-to` holds are gone; the whole-content and notice holds remain.
2. **Situational dice (storage resolved, #764).** The stored Item Ability detail takes a local or option Situation on a die, as the curation output does, and the sheet applies the die only while that Situation of the carrying item is picked. Huntsman is curated with it; the other four abilities' situational dice stay Notes until their records are curated (`importerGaps`, `local-situation-dice`).
3. **Speed's haste Source (resolved, #764).** A full attack with the speed weapon, end or bash gains one extra attack with it, never a second one beside haste.
4. **Bashing (resolved, #764).** Its `sourceKey: bashing` binds its +1 enhancement to the bash, legitimately listed on the shield or the bash, and its bash dice step two sizes up (root-approved extension: Medium light 1d6, heavy 1d8).
5. **Enhancement-equal and foe enhancement (vocabulary resolved, #764).** `@item.enhancement` reads the listing part's enhancement and a `foeEnhancement` curation output reaches the stored detail. Huntsman's Survival bonus is curated with the formula; Blood-Hunting's and Defiant's +2 against the designated foe and the other enhancement-equal bonuses stay Notes until their records are curated (`importerGaps`, `enhancement-equivalent-and-foe-enhancement`). A curated die under the chosen foe (`$choice`) is still refused by the curation Situation check.
6. **Data note (no importer change):** Brawling is tagged Melee Qualities for an armor quality, and Defiant (Armor) Armor Qualities for an armor-and-shield quality (upstream; `applies-to` holds).

The other abilities' outstanding calculations still name the gap their record waits on; their wording was not re-bound by #764.

## Outstanding mechanics

These are calculation gaps, not attribution holds (each ability's list is `mechanicsReview.outstandingCalculations`; 45 abilities have one (48 before #764 calculated Huntsman's, Speed's and Bashing's), and the inventory's `importerGaps` lists the keys each #764 gap covers): situational damage dice and bonuses equal to an item's enhancement or against a designated foe on abilities not yet curated with them (gaps 2 and 5); spell resistance, energy resistance and fortification (contract: Notes); speeds (burrow, climb, fly, enhancement to movement); armor check penalty exemptions on one skill (Buoyant, Creeping, Locksmith); allies' bonuses (Designating); Agile's Dexterity to damage; keen during a raging song (Bloodsong); larger damage dice (Impact, Growing); miss chances; carrying capacity; and play-time effects (Potent, Advancing, Corsair's doubling, Guarding).

## #764 repairs

[#764](https://github.com/AndreasUnunger/EverythingPath/issues/764) changed 11 of the 98 entries and nothing else in the corpus: the eight Universal Armor & Shield Qualities now import as `armorOrShield` and lose their `applies-to` holds, and Huntsman, Speed and Bashing have new checked records (Huntsman's Survival Modifier and die, Speed's calculated extra attack with no Notes left, Bashing's `sourceKey: bashing` with only its shield-type Note). A clean-tree re-extraction reproduces the other 87 entries byte for byte. All 98 stay held on their whole-content and notice holds; none is admitted.

- **Re-binds.** The 11 assessments are re-bound with `buildAssessmentBinding` over the committed fixture entries (content and evidence fingerprints; mapping and notice fingerprints unchanged), and so is #367's Fortified (Shadow Lodge), whose closure holds Fortification (light): content fingerprint only. Its `traits-367.json` binding and the Fortification (light) copy in `tests/fixtures/traits-367/preview.json` follow. Unchanged-entry controls reproduce their committed bindings.
- **Launch inventory.** The notice authority binds every legal inventory's bytes, so it was reproduced from pinned inputs (its `pf-special-qualities-501`, `traits-367` and, already stale on the base, `pf-companions-508` input hashes) and its `noticeAuthoritySha256` pin re-set, then `catalog:launch-inventory --write` regenerated storage. The five required tag keys' `applies-to` launch failures cleared; none was added.

## Cross-batch bindings and protected records

A full-corpus closure scan over the base (`a4ba996b`) found no batch key that links another entry: each ability's closure is the entry alone. Two entries outside the batch link a batch key:

- **Fortified (Shadow Lodge)** (`pf1-content/2V8vm122Y4d4WzCZ`, #367 traits) links Fortification (light) in its description, so its full-corpus closure holds it. Curating Fortification (light) changes that closure, so its binding is re-bound with `buildAssessmentBinding` over the full-corpus preview with this batch's entry in place (#756): content fingerprint `c11172eb…` to `6d69d52b…` (the full-corpus re-bind and a re-bind over #367's own fixture with this batch's entry in place agree); mapping, evidence and notice fingerprints, disposition, evidence, notices and holds unchanged. Its assessment, `scripts/catalog/legal/traits-367.json` `currentBinding` and the Fortification (light) copy in `tests/fixtures/traits-367/preview.json` (`closure`) are updated; `traits-367.test.ts` and `cross-batch-bindings.test.ts` were run.
- **Canopic Wrap** (`pf1-content/RcoqQc82iOJcSpKz`, pf-wondrous) links Fortification (light) too, but has no Attribution Assessment: nothing to re-bind.

No batch key is a curated root in an earlier batch's `protected-context.json`, `binding-preview.json` or `preserved.json`. Corrosive Burst and Limning appear as pinned supporting-source snapshots in #343's evidence and fixtures (and their hashes in #529 to #536's `preserved.json`); the raw records are unchanged, so nothing there changes. The folders appear only as raw `folder` fields in #534's and #535's evidence. The batches in flight (#401 racial traits, #549 pf-buffs, #508 companions, #431 items, #716 P7e) have no key in these closures.

## Binding

Assessments are bound with `buildAssessmentBinding` against the full-corpus content closure: the full `catalog:preview` of the base, with the batch's 98 entries taken from the bounded preview of the merged overlay. Each closure is the entry alone, so the final full-corpus preview reproduces the same entries (checked in the gates below). The committed [preview fixture](../../tests/fixtures/pf-special-qualities-501/preview.json) holds the 98 entries and an empty closure. The batch test reproduces every binding from a clean shared-store tree plus that fixture.

## Tests

- [`pf-special-qualities-501.test.ts`](../../tests/catalog/pf-special-qualities-501.test.ts) checks the counts, dispositions and named holds; the bonus equivalent of every ability against its price line; the structured dice, damage types, Source and choice; every Modifier; one checked `itemAbility` record per ability whose Notes are the body's own sentences; the notices and holds; the pinned bodies, base records and literal PCGen rows; the re-extraction from a clean tree (98 held, no failure, every binding reproduced, Greater Shadow held on PZO1123 when confirmed and invalidated by a changed Modifier); the resolver on a sheet with full plate, a heavy steel shield and a longsword (Greater Shadow +15 Stealth, Mind Buttressing +2 Will, Arrow Catching's conditional +1 deflection, Corrosive Burst's dice, and gaps 3 and 4); the abilities without `appliesTo`; the #367 re-bind; and batch ownership.
- [`pfSpecialQualities501.integration.test.ts`](../../tests/catalog/pfSpecialQualities501.integration.test.ts) covers an isolated saved sheet wearing character-scoped copies of the held Greater Shadow, Mind Buttressing, Arrow Catching and Corrosive Burst on seeded full plate, heavy steel shield and longsword (Stealth, Will, AC and the sword's extra dice; the client preview matches; outsiders, anonymous callers and another campaign's entry are refused; Poison-Resistant can't be stored), and an isolated release that holds four abilities and publishes none.

## Preservation and gates

The shared canonical files gain only this batch's entries: 98 `itemAbility` records, 98 assessments, 98 evidence entries and 26 notice holds; the one cross-batch change is #367's Fortified re-bind above. `reviewed-change-replacements.ts` is untouched. Diff stat against the base `a4ba996b`, shared-store files omitted:

```text
docs/catalog-import/curation.md                         |     2 +- (one sentence: Item Ability description records)
docs/catalog-import/pf-special-qualities-501.md         | new
scripts/catalog/legal/held-notices.json                 |  +249 (26 notice holds)
scripts/catalog/legal/pf-special-qualities-501.json     | new, 26,416 lines
scripts/catalog/legal/traits-367.json                   |     2 +- (Fortified's currentBinding)
scripts/catalog/reviewed-curation.json                  | +3578 (98 itemAbility records)
src/lib/catalog/data/attribution-assessments.json       | +2000, 2 +- (98 assessments; Fortified re-bound)
src/lib/catalog/data/attribution-evidence.json          |  +294 (98 evidence entries)
tests/catalog/batch-ownership.ts                        |     6 +- (Item Ability description record)
tests/catalog/batch-ownership.test.ts                   |   +33
tests/catalog/pf-special-qualities-501.test.ts          | new
tests/catalog/pfSpecialQualities501.integration.test.ts | new
tests/fixtures/pf-special-qualities-501/data.ts         | new
tests/fixtures/pf-special-qualities-501/sheet.ts        | new
tests/fixtures/pf-special-qualities-501/preview.json    | new, 3,505 lines
tests/fixtures/traits-367/preview.json                  |    19 +- (its Fortification (light) copy)
```

<!-- prep:shared-store-count -->
New shared-store files (`tests/fixtures/pinned/`), counted by prep after the rebase onto `6bf9b559`: **140** (pcgen 28, pf1-content 112).
<!-- /prep:shared-store-count -->

The batch adds to the shared store, as curated on `a4ba996b`, 112 pinned pf-special-qualities records (the 100 batch keys, 11 of the 12 same-pack base records its bodies build on, and the helper record Corrosive Burst's seed binds) and 29 of the 58 PCGen files its comparisons cite (EQMOD, feat, class-ability and Bestiary race files and their `.pcc` files); the other PCGen files and the Universal Monster Rules journal were already there and the PCGen EQMOD, feat, class-ability and Bestiary race files and `.pcc` files its comparisons cite.

The final full-corpus preview reported **103 admitted, 23,148 held, 5 dependent omissions and 1,969 failures**; the base `a4ba996b` had 2,067 failures with the same admitted, held and omitted counts. The 98 failures gone are exactly the batch's entries (missing curation on the base); no new failure. For the batch it holds all 98 (each on its rationale), and the committed fixture's 98 entries equal the final preview's.

| Command                                                                                                                                                   | Result                                                                                                                                                                                                                                                                                                     |
| --------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `catalog:curate --candidates …` (drafter)                                                                                                                 | pass; 98 required `itemAbility` records drafted (32 with diagnostics); the prose pass drafts none (Item Abilities have no description input)                                                                                                                                                               |
| `catalog:curate --candidates … --records` overlay, `catalog:preview --candidates …`                                                                       | pass; 98 required, 98 checked, 0 missing, 0 stale; 0 admitted, 98 held, 0 failures                                                                                                                                                                                                                         |
| Full `catalog:curate`                                                                                                                                     | pass; 0 missing; 4 stale records, no batch key; about 3 min after a 28 min memory queue                                                                                                                                                                                                                    |
| Full `catalog:preview`                                                                                                                                    | exit 1; 1,969 failures, none a batch key (base 2,067); run after the last evidence change                                                                                                                                                                                                                  |
| Bind (`buildAssessmentBinding` over the full-corpus closure)                                                                                              | 98 bound; closures self-only; 0 mismatches against the clean-tree reconstruction; #367 Fortified re-bound                                                                                                                                                                                                  |
| `pnpm test` of this batch's two files, `notice-holds`, `pinned-sources`, `cross-batch-bindings`, `batch-ownership-sweep`, `batch-ownership`, `traits-367` | pass; 8 files / 208 tests (an earlier run failed this batch's Note check on `&nbsp;` in two bodies; the test's normalization was fixed and re-run)                                                                                                                                                         |
| `pnpm -s typecheck`                                                                                                                                       | pass (the first run failed on the test adapter's typing, fixed; this batch's test re-run after it: 11 tests pass)                                                                                                                                                                                          |
| `pnpm -s lint`                                                                                                                                            | pass                                                                                                                                                                                                                                                                                                       |
| `pnpm -s check:initial-migration-writers`                                                                                                                 | pass                                                                                                                                                                                                                                                                                                       |
| `pnpm catalog:pin`                                                                                                                                        | pass; `sha256:005ef0b9…`                                                                                                                                                                                                                                                                                   |
| `pnpm catalog:notice-deps`                                                                                                                                | pass; 0 gaps; 40 advisory warnings, one for this batch: Exhausting "mentions stamina" ("sap the struck creature's strength and stamina", ordinary wording, not Unchained stamina; a false positive). The first run failed on the Universal Monster Rules evidence row lacking a `name`; fixed and re-bound |
| `pnpm catalog:format --check`                                                                                                                             | pass                                                                                                                                                                                                                                                                                                       |

`pnpm test tests/catalog` was left to the orchestrator's prep run on the rebased commit, as the brief directs.

**Test tool change.** `tests/catalog/batch-ownership.ts` takes an Item Ability's checked `itemAbility` record as its description record (family ruling 1), shown by a new case in `batch-ownership.test.ts`.

## Fix round 1

Sol's review (two hard findings) is addressed; the disposition, outputs, notices and holds are unchanged.

- **Speed and Bashing outstanding mechanics.** Their machine-readable outstanding calculations now record what the batch test shows: Speed's `sourceKey: haste` gives no extra attack (the sheet's haste source isn't read from Item Abilities), and Bashing's +1 enhancement doesn't reach the bash. Their curation record rationales say so too. 48 abilities now have an outstanding calculation (was 47; Bashing already had one).
- **Owning ticket.** #764 owns importer and calculation gaps 1 to 5. The inventory's new `importerGaps` names it with each gap's keys, every affected outstanding calculation and the eight unread-tag `applies-to` hold rationales cite it, and `dataNotes` keeps gap 6.
- **Bindings.** 23 abilities' evidence changed (outstanding calculations or rationale), so their evidence fingerprints were re-bound with `buildAssessmentBinding` over the committed fixture entries (each closure is the entry alone). Their content and mapping fingerprints are unchanged. No other batch's binding changes.
