# Buffs #547: pf1 buffs batch 1

Reviewed by **Opus (AI curator) for the owner**, 2026-10-20.

Exactly the issue's 82 keys were reviewed, the whole pinned pf1 `buffs` pack: **0 admitted, 73 specifically held, 1 dependent omission, 0 whole-entry unsupported/prose-only dispositions, 8 exclusions, 0 record-level 3.5 holds**. The exclusions are the pack's eight Foundry `!folders!` records (Alchemist, Barbarian, Bard, Class Abilities, Placeholder Buffs, Spells, Technology, Witch), which the importer's folder contract leaves out of the Catalog Entries (PRD Decision 17). The 74 buffs are 35 Spell Effects (`subType: spell`), 18 class buffs (`feat`, mapped as `classFeature`), 19 technology buffs (`item`) and 2 combat options with no subtype (`manual`).

The [machine-readable inventory and evidence](../../scripts/catalog/legal/buffs-547.json) records, per key, the complete pinned body, changes, context notes, actions, flags and inert fields with the source hash and cited sources; the governing linked record and every linked body with their books, assessment and full-preview admission; the closure dependencies; the PCGen comparison rows and leads; the inherited-rule and Unchained notices; every checked description and context-note record; the effect review (kind, spellKey, default caster level, each imported change mapped or unsupported, the reviewed outputs); source discrepancies, calculation gaps and the reviewed change replacements; and the current assessment binding and mapped facts. This report summarizes them and doesn't repeat the evidence.

## Family rulings (first batch of the family)

This is the family's first batch, so each choice below is proposed as the family's precedent for review.

1. **Governing record.** A buff applies its rules "as per" the record its description links first: the Spell for a Spell Effect (also its `spellKey`), the class ability for a class buff, the technology item for a technology buff. That record is the buff's rule source (`inheritedRuleSourceEvidence`), its books are required notices, and the comparison is PCGen's row for that book: the Core Rulebook spell rows (`cr_spells.lst`: the summary row, the `.MOD` row with `TEMPBONUS`/`TEMPDESC`, and the full-text `.MOD` row), Ultimate Magic, Advanced Class Guide and Orcs of Golarion spell rows, the class-ability rows (`cr_abilities_class.lst`, `apg_abilities_class.lst`, `um_abilities_class.lst`, `pu_abilities_class.lst`), the Core Rulebook combat templates (`cr_templates.lst:374-375`) and the Technology Guide equipment rows (`tg_equip.lst`). Every Modifier's target, bonus type and value is checked against the governing pinned body and the row.
2. **Status.** An assessment is `confirmed` when the governing body and a PCGen row of its book state every rule the buff's body states (an exact row suffices, partial evidence doesn't; #507's Bonus Tricks). Otherwise it's `unresolved` with a named content hold: `whole-content` (a rule no permitted source states, or a contradiction), `source-page` (the cited page contradicts the governing Spell), `uncited` (no source at all), `broken-reference` and `bonus-type` (an imported bonus type contradicts the text, #370).
3. **Spell Effects depend on their Spell.** Every linked Spell is held (its own batch's whole-content hold), so a Spell Effect is at best a dependent omission. Its Spell's own notice set stays on the Spell's assessment; the effect requires PZO1110, its cited books, the Spell's books and the books of what it grants.
4. **PZO1131 through the closure (S-02, #736).** Every Foundry spell action keeps `activation.unchained`, so every Spell Effect reaches Unchained action-cost metadata through its Spell. The Unchained stances and both rages reach it through their class abilities, the alchemist, witch and Dire Prophecy buffs through theirs, and the technology buffs through their items. 71 of the 74 buffs require the held PZO1131; only Inspire Courage, Fighting Defensively and Total Defense don't. The set is pinned by key in the batch test.
5. **Monster abilities (as #541).** A buff granting a sense requires the book of its pinned monster-ability record or Universal Monster Rules entry: darkvision PZO1127 (Darkvision, Greater Darkvision, Blessing of the Mole, Veemod (Red), Veemod (Powered Armor)), low-light vision PZO1112 (Veemod (Gray), Veemod (Powered Armor)), see in darkness PZO1116 (Veemod (Orange)) and all-around vision PZO1127 (Veemod (Blue), Veemod (Powered Armor)).
6. **Caster level and class level.** Foundry's `@item.level` maps to nothing, so its changes import as unsupported. A Spell Effect's reviewed Modifiers read the effect's recorded caster level (`@casterLevel`): Divine Favor, Shield of Faith, Barkskin and Fly. Class buffs read the class level (`@classLevel.barbarian`, `@classLevel.barbarianUnchained`). Fighting Defensively and Total Defense read the recorded Acrobatics ranks (`@skillRanks.acr`, as Skill Focus does).
7. **Another creature's level is a tier.** Inspire Courage depends on the performing bard's level and Ward on the warding witch's, which the affected creature's sheet can't read. Each tier is a local Situation, the tiers are mutually exclusive, and the player selects the one that applies: Inspire Courage +1 to +4 (bard level 1-4, 5-10, 11-16, 17-20), each with a second Situation for its morale bonus on saves against charm and fear; Ward +2 to +4 (witch level 1-7, 8-15, 16-20).
8. **Types and leaves.** Foundry's private `haste` and `resist` types and its `base` type on `aac`/`sac` import as unsupported; the reviewed Modifiers use the text's types. Armor, shield and natural armor bonuses sit on their own leaves (#734): Mage Armor on `ac.armor`, Shield and Hard Light Shield on `ac.shield`, Barkskin's enhancement on `ac.natural`.
9. **Shared Situations.** Bless, Aid and Bane use the shared `fear` Situation for saves against fear effects, which matches their bodies exactly. Other conditions are local.
10. **Notes.** Senses, speeds, size changes, reach, temporary hit points, conditions, immunities and play-time restrictions have no sheet statistic: the reviewed records state them as Notes, in the body's or the governing record's words, on the statistic they qualify where one fits. They are outstanding calculations, never holds.

## Dispositions

One line per key. Held notices omit PZO1110, which every buff requires and which has a reviewed Registry identity. A hold kind is `buffs-547-<kind>-<id>`; each held buff's reason is its assessment rationale in the inventory.

| Key                    | Name                    | Kind          | Disposition                                                       | Held notices                       |
| ---------------------- | ----------------------- | ------------- | ----------------------------------------------------------------- | ---------------------------------- |
| `pf1/CjQ4VmDIRBb3k7Dg` | Accurate Stance         | class buff    | held (notices)                                                    | PZO1131                            |
| `pf1/6PwPlGZVTqg3VUEd` | Age Resistance          | Spell Effect  | held (notices)                                                    | PZO1117, PZO1131                   |
| `pf1/U067K8fH1HcnJhI1` | Age Resistance, Greater | Spell Effect  | held (notices)                                                    | PZO1117, PZO1131                   |
| `pf1/8MI2BpO4ewblrCvp` | Age Resistance, Lesser  | Spell Effect  | held: `broken-reference-8MI2BpO4ewblrCvp`                         | PZO1117, PZO1131                   |
| `pf1/qmwVJUZ7ZuvF3tAB` | Aid                     | Spell Effect  | held (notices)                                                    | PZO1131                            |
| `pf1/g1c5Qbc5VpuXHPcl` | Alchemist               | folder        | excluded: folder record                                           | —                                  |
| `pf1/D2huasedfGMSetP7` | Bane                    | Spell Effect  | held: `source-page-D2huasedfGMSetP7`                              | PZO1131                            |
| `pf1/GoxdX8voXN2V3OVY` | Barbarian               | folder        | excluded: folder record                                           | —                                  |
| `pf1/XabT4ksgafPj4Gm7` | Bard                    | folder        | excluded: folder record                                           | —                                  |
| `pf1/kG8EriOOSJmDmYZd` | Barkskin                | Spell Effect  | held (notices)                                                    | PZO1131                            |
| `pf1/lV9zpEnZrArmfEFZ` | Bear's Endurance        | Spell Effect  | held (notices)                                                    | PZO1131                            |
| `pf1/QYVZS8MfOKzjpCm1` | Bless                   | Spell Effect  | held (notices)                                                    | PZO1131                            |
| `pf1/KkpKycN7WMwnjlxU` | Blessing of the Mole    | Spell Effect  | held (notices)                                                    | PZO1117, PZO1127, PZO1131          |
| `pf1/Rh3wrAV3ZfgSviyN` | Blood Rage (Spell)      | Spell Effect  | held (notices)                                                    | PZO9413, PZO1131                   |
| `pf1/ClOy4KHJFDdt0ALh` | Bull's Strength         | Spell Effect  | held (notices)                                                    | PZO1131                            |
| `pf1/o0U6E2WvMBTectrc` | Calm Stance             | class buff    | held (notices)                                                    | PZO1131                            |
| `pf1/dVqLY99ECYnLeoB5` | Cat's Grace             | Spell Effect  | held (notices)                                                    | PZO1131                            |
| `pf1/0MmlqFG4XodHOIzn` | Chameleon Suit          | technology    | held (notices)                                                    | PZO9272, PZO1131                   |
| `pf1/ws0RqS477A2LHCan` | Class Abilities         | folder        | excluded: folder record                                           | —                                  |
| `pf1/fKqcMkjlkUL70WJ0` | Darkvision              | Spell Effect  | held: `uncited-fKqcMkjlkUL70WJ0`                                  | PZO1127, PZO1131                   |
| `pf1/IwthEw2sCUq4GfxY` | Darkvision, Greater     | Spell Effect  | held: `uncited-IwthEw2sCUq4GfxY`                                  | PZO1117, PZO1127, PZO1131          |
| `pf1/B1lq0g41olpQMfzK` | Dire Prophecy           | class buff    | held (notices)                                                    | PZO1117, PZO1131                   |
| `pf1/3czZB6whbQo9WhxR` | Divine Favor            | Spell Effect  | held (notices)                                                    | PZO1131                            |
| `pf1/KsgdOd5vzGu7UDBe` | Eagle's Splendor        | Spell Effect  | held (notices)                                                    | PZO1131                            |
| `pf1/v9JaHLaVkP9O36TS` | Elemental Stance        | class buff    | held (notices)                                                    | PZO1131                            |
| `pf1/1ovEWVzSp5yZXeVm` | Enlarge Person          | Spell Effect  | held: `whole-content-1ovEWVzSp5yZXeVm`                            | PZO1131                            |
| `pf1/V8cRFtOQA6ltklEl` | Fighting Defensively    | combat option | held: `whole-content-V8cRFtOQA6ltklEl`                            | —                                  |
| `pf1/EaNmiARTiepLXfcV` | Filter Mask             | technology    | held: `whole-content-EaNmiARTiepLXfcV`                            | PZO9272, PZO1131                   |
| `pf1/sfmKrukx8vFoXLBf` | Fly                     | Spell Effect  | held (notices)                                                    | PZO1131                            |
| `pf1/EDreDkg4ESQIwmEd` | Force Field             | technology    | held: `whole-content-EDreDkg4ESQIwmEd`                            | PZO9272, PZO1131                   |
| `pf1/1z7euBqoJ1ZDCRW4` | Fox's Cunning           | Spell Effect  | held (notices)                                                    | PZO1131                            |
| `pf1/UTsRSrDTUDDEvwT5` | Guarded Stance          | class buff    | held (notices)                                                    | PZO1131                            |
| `pf1/0AfEoAsDnhvMUW2D` | Hard Light Shield       | technology    | held (notices)                                                    | PZO9272, PZO1131                   |
| `pf1/NWImcWGTjCtw1Zf0` | Haste                   | Spell Effect  | held (notices)                                                    | PZO1131                            |
| `pf1/ulvEcJsFba6Fg4g9` | Heroism                 | Spell Effect  | held (notices)                                                    | PZO1131                            |
| `pf1/T2j3SnpatLbS32O1` | Heroism, Greater        | Spell Effect  | held (notices)                                                    | PZO1131                            |
| `pf1/3p34GJemfcLdKckV` | Inspire Courage         | class buff    | dependent omission: governing `pf1/h56K6HEBOItImPPL` not admitted | —                                  |
| `pf1/sIogsaNU2T2Qe3l9` | Invisibility            | Spell Effect  | held (notices)                                                    | PZO1131                            |
| `pf1/a7hnzLkLPrqRti14` | Invisibility, Greater   | Spell Effect  | held: `source-page-a7hnzLkLPrqRti14`                              | PZO1131                            |
| `pf1/aRpdBq0hSvter9wi` | Jetpack                 | technology    | held: `whole-content-aRpdBq0hSvter9wi`                            | PZO9272, PZO1131                   |
| `pf1/fqDf4Cbv8tqRbygg` | Knockdown Stance        | class buff    | held (notices)                                                    | PZO1131                            |
| `pf1/GLQo0kv6iZEvBGto` | Long Arm                | Spell Effect  | held (notices)                                                    | PZO1129, PZO1131                   |
| `pf1/eKiKTrSBNLubVI6g` | Magboots                | technology    | held: `whole-content-eKiKTrSBNLubVI6g`                            | PZO9272, PZO1131                   |
| `pf1/IlO0CNpAIKZtNYu8` | Mage Armor              | Spell Effect  | held (notices)                                                    | PZO1131                            |
| `pf1/L6gBfTUHFJMiY9Uj` | Mutagen, Con            | class buff    | held: `bonus-type-L6gBfTUHFJMiY9Uj`                               | PZO1115, PZO1131                   |
| `pf1/bleCnwZmMAOu4nE4` | Mutagen, Dex            | class buff    | held: `bonus-type-bleCnwZmMAOu4nE4`                               | PZO1115, PZO1131                   |
| `pf1/a3P821aUxxJbSpVV` | Mutagen, Str            | class buff    | held: `bonus-type-a3P821aUxxJbSpVV`                               | PZO1115, PZO1131                   |
| `pf1/AclErIDcanB7Kd8D` | Neraplast Armor         | technology    | held: `whole-content-AclErIDcanB7Kd8D`                            | PZO9085, PZO1131                   |
| `pf1/1W9YmqCqawLmMXmf` | Owl's Wisdom            | Spell Effect  | held (notices)                                                    | PZO1131                            |
| `pf1/H4f7Rs5PFd3IA3ey` | Placeholder Buffs       | folder        | excluded: folder record                                           | —                                  |
| `pf1/iy10UP3d0lEgwy2i` | Powered Armor           | technology    | held: `whole-content-iy10UP3d0lEgwy2i`                            | PZO9272, PZO1131                   |
| `pf1/HC9wMz9Ko93PgB8D` | Powerful Stance         | class buff    | held (notices)                                                    | PZO1131                            |
| `pf1/MFogxSkB5dBmUI5i` | Prayer (Negative)       | Spell Effect  | held: `whole-content-MFogxSkB5dBmUI5i`                            | PZO1131                            |
| `pf1/kXvipUvebDtVfxEv` | Prayer (Positive)       | Spell Effect  | held (notices)                                                    | PZO1131                            |
| `pf1/UgjpRD8vtiSWRxuL` | Rage                    | class buff    | held (notices)                                                    | PZO1131                            |
| `pf1/ciAO4KwMonUzAGY0` | Rage (Unchained)        | class buff    | held (notices)                                                    | PZO1131                            |
| `pf1/KLUCuieSvkTD4qem` | Reckless Stance         | class buff    | held: `whole-content-KLUCuieSvkTD4qem`                            | PZO1131                            |
| `pf1/Z140LMTwEKHQXdW5` | Reduce Person           | Spell Effect  | held: `whole-content-Z140LMTwEKHQXdW5`                            | PZO1131                            |
| `pf1/HdNb6j7U9qA2tnr1` | Regenerative Stance     | class buff    | held (notices)                                                    | PZO1131                            |
| `pf1/pDKUOiA1UuKAoAX5` | Scatterlight suit       | technology    | held (notices)                                                    | PZO9272, PZO1131                   |
| `pf1/U7fqIfaTpWEcpamb` | See Invisibility        | Spell Effect  | held (notices)                                                    | PZO1131                            |
| `pf1/olTpyao476hOEzzm` | Shield                  | Spell Effect  | held (notices)                                                    | PZO1131                            |
| `pf1/WgCWQxR53UdVSGPB` | Shield of Faith         | Spell Effect  | held (notices)                                                    | PZO1131                            |
| `pf1/OQQYaNxXsb974T8j` | Slow                    | Spell Effect  | held (notices)                                                    | PZO1131                            |
| `pf1/abSp08elNrsecBYc` | Spells                  | folder        | excluded: folder record                                           | —                                  |
| `pf1/aqCSTZjMKDXU0DeT` | Strength Stance         | class buff    | held (notices)                                                    | PZO1131                            |
| `pf1/43eVSSa6rSTl7ieD` | Taunting Stance         | class buff    | held (notices)                                                    | PZO1131                            |
| `pf1/HKTsCi1OUug346MZ` | Technology              | folder        | excluded: folder record                                           | —                                  |
| `pf1/DvcRWaWndZ1s2tB4` | Total Defense           | combat option | held: `whole-content-DvcRWaWndZ1s2tB4`                            | —                                  |
| `pf1/hiSHFDTHqBYTvsaR` | True Seeing             | Spell Effect  | held (notices)                                                    | PZO1131                            |
| `pf1/G4KDVMpA5nH0r9sF` | Veemod (Black)          | technology    | held: `whole-content-G4KDVMpA5nH0r9sF`                            | PZO9272, PZO1131                   |
| `pf1/8e8Iqdi721djMcSi` | Veemod (Blue)           | technology    | held: `whole-content-8e8Iqdi721djMcSi`                            | PZO9272, PZO1127, PZO1131          |
| `pf1/64LMZn1hx4DeI08O` | Veemod (Brown)          | technology    | held: `whole-content-64LMZn1hx4DeI08O`                            | PZO9272, PZO1131                   |
| `pf1/l9l2uKTWEAuTqXVq` | Veemod (Gray)           | technology    | held (notices)                                                    | PZO9272, PZO1112, PZO1131          |
| `pf1/1MspZVYeg3IMlGVL` | Veemod (Green)          | technology    | held: `whole-content-1MspZVYeg3IMlGVL`                            | PZO9272, PZO1131                   |
| `pf1/YUrObSwqLffrici4` | Veemod (Orange)         | technology    | held (notices)                                                    | PZO9272, PZO1116, PZO1131          |
| `pf1/WRwcMIspQq9acUQW` | Veemod (Powered Armor)  | technology    | held: `whole-content-WRwcMIspQq9acUQW`                            | PZO9272, PZO1112, PZO1127, PZO1131 |
| `pf1/pbyW9fpqSA3qAwmI` | Veemod (Prismatic)      | technology    | held (notices)                                                    | PZO9272, PZO1131                   |
| `pf1/4pD4QNKhhbbGuY6i` | Veemod (Red)            | technology    | held: `whole-content-4pD4QNKhhbbGuY6i`                            | PZO9272, PZO1127, PZO1131          |
| `pf1/FA4nPvdBteR2pzqK` | Veemod (White)          | technology    | held: `whole-content-FA4nPvdBteR2pzqK`                            | PZO9272, PZO1131                   |
| `pf1/e6LhyzMnHZc5Vlni` | Ward                    | class buff    | held (notices)                                                    | PZO1115, PZO1129, PZO1131          |
| `pf1/pWAnXIA75Y5ZNsCL` | Witch                   | folder        | excluded: folder record                                           | —                                  |

## Notable cases

- **Fighting Defensively is held** (`whole-content`; Sol review, 2026-10-20). Its body (CRB p.184) gives a −4 penalty on attacks and a +2 dodge bonus to AC until the start of your next turn. The imported −4 change maps; the AC change, `if(gte(@skills.acr.rank, 3), 1) + 2`, is outside the grammar, so the reviewed Modifier is `2 + min(1, floor(@skillRanks.acr / 3))` dodge on `ac`. PCGen's Core Rulebook Fighting Defensively template (`cr_templates.lst:374`) states the trigger and both numbers and the +1 with 3 Acrobatics ranks, `cr_abilities.lst:16` the −4, and `cr__stats.lst:5` the dodge type, but no permitted pinned source states the duration, so the complete mechanics aren't covered (as #507's Bonus Tricks). Only its assessment and evidence changed in the review fix; its content fingerprint is unchanged and its evidence was re-bound. With the hold, no buff is admitted.
- **Total Defense is held** (`whole-content`). PCGen's template supports the +4 dodge bonus (+6 with 3 Acrobatics ranks) and that it doesn't combine with fighting defensively, but no permitted source states its other rules (the AC improves at the start of the action, no combination with Combat Expertise, no attacks of opportunity), as for #507's Bonus Tricks. Its Modifier and Note are curated.
- **Inspire Courage is a dependent omission.** Its content is confirmed against PCGen's Core Rulebook rows (`cr_abilities.lst:84` and `:95`, `cr_abilities_class.lst:524`) and needs only PZO1110, but its governing class ability (`pf1/h56K6HEBOItImPPL`) has no Attribution Assessment yet, so the gate omits it.
- **Reviewed change replacements.** Veemod (Black)'s change is +10 on Perception, the green veemod's value; its body and PCGen's "Magnification +2" (`tg_equip.lst:263`) give +2. Veemod (Powered Armor)'s change is +5; its body and PCGen's Powered Armor row (`tg_equip.lst:280`, "a +10 bonus on Perception checks") give +10. Two rows in `reviewed-change-replacements.ts` replace the formulas and keep the competence type. Both buffs stay held: no permitted source types magnification as a competence bonus on Perception, and PCGen's powered armor row gives an untyped bonus and all-around vision that the body doesn't.
- **Mutagens.** The body's "+2 natural armor bonus" imports as an alchemical bonus on `ac.natural` (Foundry type `alchemical` on `nac`), which would stack with a natural armor bonus, and the "−2 penalty" to the mental ability is typed alchemical too. A replacement changes only the formula, so the three mutagens are held (`bonus-type`) and listed for review (#370).
- **Rage and Calm Stance formulas.** Foundry's rage formulas lack a floor of 0: the Core Rulebook rage gives +2 Strength at barbarian level 1 (`4 + floor((level - 2) / 9) * 2`) and Calm Stance cancels only −1 there. The changes import as unsupported, so the reviewed Modifiers use `max(0, ...)`, with Greater Rage and Mighty Rage (`cr_abilities_class.lst:425`, `:427`) raising the bonus at 11 and 20.
- **Reckless Stance's body is Powerful Stance's text** ("+1 bonus on melee damage rolls and thrown weapon damage rolls"); its changes and PCGen (`pu_abilities_class.lst:360`) give an attack bonus and an equal AC penalty, which the Modifiers follow. Held (`whole-content`).
- **Citations.** Bane cites PZO1110 p.346 and Greater Invisibility p.301; their Spells are on pp.246 and 302 (pinned Spells and PCGen `SOURCEPAGE`). The overlay can't replace sources, so both are held (`source-page`). Darkvision and Greater Darkvision cite no source at all (`uncited`).
- **Prayer (Negative)** calls the foes' penalty "a −1 luck penalty"; the Spell and the imported changes give an untyped −1. Held (`whole-content`). Enlarge Person and Reduce Person describe Foundry's carrying-capacity changes, which no printed rule states; held (`whole-content`).
- **Age Resistance, Lesser** links Age Resistance (`pf1/li8zwqjorsww6o82`), not Lesser Age Resistance (`pf1/w8v617tw8wjlcl53`). The importer's name match leaves its `spellKey` unset and the gate fails it as an unresolved reference, on the base and here.
- **Haste.** Its extra attack and speeds are Notes; its +1 on attack rolls (untyped) and +1 dodge on AC and Reflex are Modifiers. The extra attack is equated with a speed weapon's, but it isn't calculated, so no `sourceKey` is set.

## Importer and data gaps

- **Spell association (#738, spell reference gaps).** The import contract says the Curation Overlay decides a Spell Effect's `spellKey` when the name match fails, but the overlay has no such record kind. Reproduction: `packs/buffs/age-resistance-lesser.8MI2BpO4ewblrCvp.yaml` links `@UUID[Compendium.pf1.spells.Item.li8zwqjorsww6o82]` (Age Resistance); `mapSpellAssociation` (`scripts/catalog/details.ts`) compares "age resistance" with "lesser age resistance", reports `spellKey` unsupported, and the gate fails the entry.
- **Wrong source pages** (Bane, Greater Invisibility) and **missing sources** (Darkvision, Greater Darkvision) can't be corrected by the overlay; upstream data, recorded and held.
- **Senses, speeds, size, reach and conditions** in buff changes (`sensedv`, `sensetr`, `changeFlags`, `flySpeed`, `landSpeed`, `size`, `reach`, `carryStr`, `conditions`) have no sheet targets; they're Notes here.

- **Ownership reader (test tool fix).** `tests/catalog/batch-ownership.ts` read only `held`, `admitted` and `excluded` rows, so the ownership sweep failed on Inspire Courage's `dependently-omitted` disposition (PRD Decision 17). The fix adds that value to the reader's enum; `batch-ownership.test.ts` gains a case showing the row is checked like any assessed row.

No importer or shared-loader code changed. Apart from the spell association above (#738), no gap for #738 or #739 arose: the buffs' description links all resolve in the full corpus.

## Outstanding mechanics

These are calculation gaps, not attribution holds:

- durations and expiry, rounds of rage, mutagen doses and charges;
- temporary hit points (Aid, Greater Heroism, Rage (Unchained), Force Field), damage taken (Blood Rage);
- size changes and their size modifiers, reach, carrying capacity (Enlarge Person, Reduce Person, Long Arm);
- senses, speeds and maneuverability (darkvision, true seeing, see invisibility, the veemods, Fly, Haste, Jetpack, Powered Armor, Slow);
- conditions applied by an effect (Slow's staggered, Invisibility's invisible), immunities (Greater Heroism, Filter Mask), flanking (Veemod (Blue));
- touch AC against beams and rays (Hard Light Shield, Scatterlight suit), Strength checks (Strength Stance, Powered Armor) and ability checks (Dire Prophecy);
- thrown weapon attacks and damage, which have no target apart from ranged (the Unchained stances);
- Haste's extra attack; total defense combined with fighting defensively or Combat Expertise isn't prevented;
- the tier for another creature's level (Inspire Courage, Ward) is chosen by the player.

## Cross-batch bindings and protected records

A full-corpus closure scan over the base found two landed assessments whose content closure reaches a batch key, and this batch re-binds both with `buildAssessmentBinding` over the final full-corpus preview:

| Batch | Assessment                                                    | Linked batch entry                                           | Content fingerprint (old → new)                                                                                                         | Re-bound in                                                                                                                                                                           |
| ----- | ------------------------------------------------------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #391  | Immortal Spark (racial trait, `pf1-content/FkNwNCexIJKOgtY2`) | Lesser Age Resistance (`pf1/8MI2BpO4ewblrCvp`, its new Note) | `937599a43f4ef3098397c82c75b87faddf9e48ed6549725bff6373e752ce7fba` → `d3e535e5c30e16340ef27febd0d2fba49af89d2079e1b4170a5e084f57b1082f` | [`racial-traits-391.json`](../../scripts/catalog/legal/racial-traits-391.json) `currentBinding`; `tests/fixtures/racial-traits-391/preview.json` closure; `racial-traits-391.test.ts` |
| #524  | Fey Boon (Spell, `pf1/JYgzYISWlo5CQQg3`)                      | Haste (`pf1/NWImcWGTjCtw1Zf0`, its new Modifiers and Notes)  | `a26fa8efbb4f9a82f3d1d27b27350741fc5869efd8741eaf20aea115d3094f33` → `853b39755f77cae2394fd13719c9551e4cf4f1271922ce953c8cc0a81292b672` | `tests/fixtures/spells-524/binding-preview.json` entry (the inventory records no binding snapshot); `spells-524.test.ts`                                                              |

The batch was rebased onto `909a4813` (after #395 and #716 P7a), where #395 had already re-bound both for its own closure changes; the old fingerprints above are those #395 recorded, and the new ones are bound over the full-corpus preview of the rebased tree. Each fixture-based binding agrees with the full-corpus one. On the rebased tree no other landed assessment's closure reaches a batch key, and none of the 74 batch bindings changed.

Only their content fingerprints changed; their mapping, evidence and notice fingerprints, dispositions and holds are unchanged. No other earlier batch's fixture holds a batch entry's copy. No batch key is a protected root of an earlier fixture. None of the batches in flight during curation (#395 racial traits, #427 weapons, #716 P7a; all since landed) has a key in these closures, and no closure here reaches one of theirs.

## Binding

Assessments are bound with `buildAssessmentBinding` over the full-corpus `catalog:preview` of the merged overlay, the authority. The committed [preview fixture](../../tests/fixtures/buffs-547/preview.json) holds the 74 entries and their closure (85 entries: the linked Spells, class abilities and technology items and what those link). The batch test reproduces every binding from a clean shared-store tree plus that fixture.

## Tests

- [`buffs-547.test.ts`](../../tests/catalog/buffs-547.test.ts) checks the counts, dispositions and named holds; the reviewed Modifiers through the public resolver (Fighting Defensively and Total Defense by Acrobatics ranks; Shield of Faith, Divine Favor, Barkskin and Fly by caster level; Rage at barbarian 1, 10, 11, 19 and 20; Rage (Unchained), Calm Stance and the stances; Haste; the AC leaves; the change replacements); each Situation-gated Modifier, with Inspire Courage's and Ward's tiers mutually exclusive; every description and context-note record; the notices, holds and the Unchained set by key; the pinned bodies, linked bodies and literal PCGen rows; and the re-extraction from a clean tree with the gate's 0 admitted, 1 dependent omission, 1 failure and 72 held, that confirming Fighting Defensively would admit it, binding reproduction and invalidation, and batch ownership.
- [`buffs547.integration.test.ts`](../../tests/catalog/buffs547.integration.test.ts) builds an isolated saved sheet with 3 Acrobatics ranks: a copy of the held Fighting Defensively's reviewed Modifiers adds +3 dodge to AC and −4 on attacks, a running Shield of Faith at caster level 12 adds +4 deflection, the client catalog preview matches, switching both off restores the sheet, and an outsider is refused.

## Preservation and gates

The shared canonical files gain only this batch's entries: 93 curation records (74 description records and 19 context-note records), 74 assessments, 74 evidence entries and 10 notice holds, plus the two re-bound assessments' content fingerprints and two rows in `reviewed-change-replacements.ts`. Diff stat against the base `909a4813` (after the rebase), shared-store files omitted:

```text
docs/catalog-import/buffs-547.md                  | new
scripts/catalog/legal/buffs-547.json              | new, 28466 lines
scripts/catalog/legal/held-notices.json           |    +97
scripts/catalog/legal/racial-traits-391.json      |   1 line (re-bound currentBinding)
scripts/catalog/reviewed-change-replacements.ts   |    +22
scripts/catalog/reviewed-curation.json            |  +2090
src/lib/catalog/data/attribution-assessments.json |  +1558, 2 lines changed (re-bound)
src/lib/catalog/data/attribution-evidence.json    |   +222
tests/catalog/batch-ownership.test.ts             |    +22
tests/catalog/batch-ownership.ts                  |   +3, 1 line changed
tests/catalog/buffs-547.test.ts                   | new
tests/catalog/buffs547.integration.test.ts        | new
tests/fixtures/buffs-547/data.ts                  | new
tests/fixtures/buffs-547/preview.json             | new, 9156 lines
tests/fixtures/buffs-547/sheet.ts                 | new
tests/fixtures/racial-traits-391/preview.json     |     +5 (re-bound closure copy)
tests/fixtures/spells-524/binding-preview.json    |   +25, 1 line changed (re-bound entry copy)
```

<!-- prep:shared-store-count -->
New shared-store files (`tests/fixtures/pinned/`), counted by prep after the rebase onto `ede3d3eb`: **129** (pcgen 4, pf1 125).
<!-- /prep:shared-store-count -->

The batch adds to the shared store 81 of the 82 pinned buff records (Age Resistance, Lesser, was already on the base for #391), 44 linked records that weren't on the base (11 Spells, 14 class abilities and 19 technology items) and four PCGen files, 129 files in all: `core_rulebook/cr_templates.lst`, `cr_abilities.lst`, `cr__stats.lst` and `campaign_setting/technology_guide/tg_equip.lst`.

The final full-corpus preview on the original base `69244a26` reported **103 admitted, 23,150 held, 3 dependent omissions and 2,391 failures**, against 102, 23,152, 2 and 2,410 for that base alone: Fighting Defensively admitted, Inspire Courage dependently omitted, and 19 fewer failures for the batch's 19 required context-note records. After the rebase onto `909a4813` it reported 103 admitted, 23,150 held, 3 dependent omissions and 2,340 failures. The review fix holds Fighting Defensively, which changes only its assessment and evidence, not the catalog, so the gate's counts become 102 admitted and 23,151 held on the rebased tree, and the batch's 0 admitted, 1 dependent omission, 72 held and 1 failure. The full preview was not rerun for the fix; the batch test reproduces the gate. No failure is added; the one batch key among the failures is Age Resistance, Lesser's unresolved Spell, which also failed on the base.

| Command                                                                                                                                                                                                                             | Result                                                                                                                                                                                        |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `catalog:curate --candidates …` and `--descriptions` (prose pass)                                                                                                                                                                   | pass; 19 required drafts (context notes) and 9 prose drafts, all replaced by checked records; a rerun against the overlay: 19 required and 74 description records checked, 0 missing, 0 stale |
| `catalog:preview --candidates …`                                                                                                                                                                                                    | exit 1 (bounded: every linked Spell, class ability and technology item is outside the selection); 0 missing curation                                                                          |
| Full `catalog:curate`                                                                                                                                                                                                               | pass; 0 missing; 3 stale records on the base, no batch key; about 3 min                                                                                                                       |
| Full `catalog:preview`                                                                                                                                                                                                              | exit 1; 2,391 failures, 1 of them a batch key (above); 1 admitted, 1 dependent omission, 71 held for the batch before the review fix (0, 1 and 72 after it); about 4 min                      |
| Full bind (`buildAssessmentBinding` over the full preview)                                                                                                                                                                          | 74 bound; 0 mismatches against the clean-tree reconstruction; 2 landed assessments re-bound (above)                                                                                           |
| `pnpm test` of this batch's two files, `batch-ownership`, `batch-ownership-sweep`, `notice-holds`, `pinned-sources` and `cross-batch-bindings` (one worker)                                                                         | pass; 7 files / 183 tests                                                                                                                                                                     |
| Affected earlier batches: `racial-traits-391.test.ts`, `racialTraits391.integration.test.ts`, `spells-524.test.ts`, `catalogSpells524.integration.test.ts`, with `ac-other-defense-bonuses`, `notice-dependencies` and `data-files` | pass; 12 files / 249 tests (one run with the guards)                                                                                                                                          |
| `pnpm -s typecheck`                                                                                                                                                                                                                 | pass (the first run failed on test typing, fixed and re-run)                                                                                                                                  |
| `pnpm -s lint`                                                                                                                                                                                                                      | pass (the first run failed on one unnecessary assertion in the batch test, fixed and re-run)                                                                                                  |
| `pnpm -s check:initial-migration-writers`                                                                                                                                                                                           | pass; 185 registrations                                                                                                                                                                       |
| `pnpm catalog:pin`                                                                                                                                                                                                                  | pass; `sha256:005ef0b9…`                                                                                                                                                                      |
| `pnpm catalog:notice-deps`                                                                                                                                                                                                          | pass; 0 gaps; 39 advisory warnings, none for this batch                                                                                                                                       |
| `pnpm catalog:format --check`                                                                                                                                                                                                       | pass                                                                                                                                                                                          |

`pnpm test tests/catalog` was left to the orchestrator's prep run on the rebased commit, as the brief directs.
