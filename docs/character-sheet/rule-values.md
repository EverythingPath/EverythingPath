## Rule values

A **rule value** is a number a Catalog Entry gives that is not a Modifier, such as Channel Energy's dice. Each kind has its own combining rule, so none of them goes through [stacking](stacking.md). A Catalog Entry lists them in `ruleValues`; an entry stored before they existed has none and reads as before (`convex/characterSheetRuleValues.integration.test.ts`).

```ts
type RuleValue =
  | { kind: 'dice'; die: number; amount: RuleValueAmount } // Channel Energy: d6
  | {
      kind: 'damageReduction';
      amount: RuleValueAmount;
      bypass: string; // '-' is DR x/—; 'cold iron', 'magic' …
      condition?: { situation: RuleValueSituation };
    }
  | {
      kind: 'spellResistance';
      amount: RuleValueAmount;
      condition?: { situation: RuleValueSituation };
    }
  | {
      kind: 'dailyMaximum'; // per-day maximum (owner 2026-11-17)
      key: string; // the Foundry tag: 'classFeat_rage', 'classFeat_channelEnergy' …
      unit: 'uses' | 'rounds' | 'points';
      amount: RuleValueAmount;
    }
  | { kind: 'dailyMaximumIncrease'; key: string; amount: RuleValueAmount }; // Extra Channel

type RuleValueSituation = SituationKey | { local: string }; // no option Situation

type RuleValueAmount =
  | number // a whole number, 0 or more
  | { rows: { per?: number } } // the entry's active rows counted, times per (1)
  | { formula: string }; // the closed formula grammar, as a Modifier's
```

The schema is `ruleValueSchema` (`src/lib/character-sheet.ts`). The stored Catalog Entry (`convex/schema.ts`) carries it; the imported entry (`importedCatalogEntrySchema`) carries `storedRuleValuesSchema`, nonempty, and a release's candidate definition takes it from the imported entry. A Catalog Copy carries it through its spread.

**Limits.** Convex's storage validator is derived from the schema and keeps only its types, so every write that stores rule values parses them: `createOneOff` checks them beside its Modifier and Situational Note limits ("An entry supports at most 16 Rule values", "Rule value is invalid"), and `writeCatalogDefinition` parses `storedRuleValuesSchema` ("Catalog definition is invalid"). Release staging (`catalogRelease.writeBatch`) stores a definition row and a retirement report's last usable definition without `writeCatalogDefinition`, so it parses both through `importedCatalogEntrySchema`'s field (`convex/catalogRelease.integration.test.ts`); discovery and candidate reads parse the same schema. At most 16 per entry; a formula of at most 4096 characters, a bypass of at most 64, a per-day key of at most 64, and a Situation as a Situational Note's. Each limit's reason is beside it in `src/lib/character-sheet-feature-numbers.ts`. A one-sided die, a fractional or negative amount, `rows.per` 0, an empty bypass, an empty or over-long per-day key, an unknown unit, and any field outside the kind (a tally of uses, an increase's unit) are refused (`convex/characterSheetSpeedMaxima.integration.test.ts` for the per-day kinds); an unsupported but well-formed formula is stored and warns when evaluated (`convex/characterSheetRuleValues.integration.test.ts`).

### Amounts

- **Rows:** the entry itself plus each counting entry whose `detail.parentFeature` is the entry's rule identity and that the entry's own class granted (rotation-4): the class's reviewed increments, such as the Cleric's Channel Energy rows at 3rd, 5th … 19th level. A row an Archetype replaces is dormant and a row switched off is not counting, so neither is counted: an Ecclesitheurge Cleric 5 channels 2d6, not 3d6. A parent entry two classes share (the Barbarian's and the Bloodrager's Damage Reduction) counts each class's rows apart: a Barbarian 10 / Bloodrager 10 has two 2/— lines and DR 2/—, not 3/—. A row's class is the class whose Class Level granted it, through nested grants, or the class of the Archetype that added it; an entry no class granted counts only rows no class granted (`src/lib/character-sheet-resistances.test.ts`).
- **Formula:** evaluated as a Modifier on an internal dependent-stage target, so it reads the variables a Modifier reads (`@classLevel.paladin`, ability modifiers, `@bab`), and a Spell Effect's reads its recorded caster level as `@casterLevel`, as that effect's Modifiers do: the spell spell resistance's `12 + @casterLevel` at caster level 9 gives SR 21. A class feature's has no caster level to read. A formula that can't be evaluated gives no number and a rules warning on the entry (`<entry>:ruleValue:<index>`).
- Each amount is evaluated by `evaluateModifier`, so an entry a condition suppresses gives nothing.

Rule values come from the same counting entries as Modifiers; the permanent projection leaves out Temporary Effects.

### Dice

`resolveFeatureNumbers` (`src/lib/character-sheet-feature-numbers.ts`) gives `calculated.featureNumbers`: one feature number per dice rule value of a counting entry, `{ kind: 'dice', entryId, ruleValueIndex, count, die, sources }`. `count` is null while its formula can't be evaluated; `sources` names the rows counted, or the entry for a number or formula. Two classes' dice stay apart: a Cleric 5 / Paladin 4 channels 3d6 as a cleric and 2d6 as a paladin, never 5d6.

The sheet shows each one as a chip on its entry's row in the class features list (`grant-entry-row.tsx`), such as "3d6", or "Unresolved d6".

Tests: `src/lib/character-sheet-feature-numbers.test.ts` (dice by level, the Ecclesitheurge, two channel classes, an unresolved formula, both projections, the schema and its illegal shapes), `convex/characterSheetRuleValues.integration.test.ts` (the saved sheet for owner, member and outsider), `src/components/character-sheet/character-sheet-grants.test.tsx` (the chip).

### Damage reduction and spell resistance

`resolveResistances` (`src/lib/character-sheet-resistances.ts`) gives `calculated.damageReduction` and `calculated.spellResistanceStatistic`. Each lists every line of a counting entry, `{ entryId, name, ruleValueIndex, value, applies }` (a damage reduction line also has its `bypass`); `value` is null while its formula can't be evaluated, and such a line never applies.

- **Damage reduction:** the statistic is the highest value per bypass, never a sum (root's default of 2026-11-17), highest first: `values: { bypass, value, entryId }[]`. The line that gives its bypass's value is marked `applies`; of equal lines the first does. A Barbarian 10 Mad Dog lists the Barbarian's 2/— and the Mad Dog's 1/— and has DR 2/—.
- **Spell resistance:** the highest applying line, `value` (null with no line), never a sum. It is the Character's own spell resistance, not the Situation "to overcome spell resistance" (`spellResistance`), which stays a Situation of caster level checks.
- **Conditional lines:** a line whose Situation is not selected goes to `conditional` with its `situation` and never reaches the statistic; selecting the Situation moves it in.
- A Temporary Effect's line (Stoneskin's 10/adamantine) is left out of the permanent projection.

The sheet shows each one in Defenses, under CMD, once the Character has any line of it (`defenses-block.tsx`), as a row like CMD's (`RuleValueRow` in `rule-value-row.tsx`: the label in the body font on the row's solid rule, the statistic right-aligned on it with its dotted underline, "10/adamantine, 2/—"; spell resistance "21"). Beneath the label it lists each line, keyed by its entry and rule value, the one that applies marked "(applies)", and each conditional line with "only when …". It has no breakdown: a rule value is not a Modifier total.

Tests: `src/lib/character-sheet-resistances.test.ts` (Barbarian damage reduction by level, the Mad Dog at 10th, two bypasses, a Temporary Effect, a race and an item, a conditional line and its Situation, an unresolved formula, the schema), `convex/characterSheetRuleValues.integration.test.ts` (a player's feats on the saved sheet), `src/components/character-sheet/defenses-block.test.tsx`.

### Per-day maxima

The owner decided on 2026-11-17 that the sheet shows how many times per day a limited ability can be used: rage rounds, channel energy and lay on hands uses, a ki or arcane pool's points. **The maximum only:** no tally, no uses remaining, no reset, and nothing stores a count.

`resolveDailyMaxima` (`src/lib/character-sheet-feature-numbers.ts`) gives `calculated.dailyMaxima`: one per `dailyMaximum` rule value of a counting entry, `{ entryId, ruleValueIndex, key, unit, value, sources }`.

- **Apart per entry and key:** a Cleric 5 / Paladin 4 has its channel uses and its lay on hands uses as two maxima.
- **Increases add per copy:** each counting entry with a `dailyMaximumIncrease` of the same key adds its amount, so two copies of Extra Channel add 4. `sources` names the maximum's entry, then each increase. An increase whose key no maximum has gives nothing.
- **Permanent ability modifiers:** a maximum's or increase's formula reads the permanent ability modifiers, so rage's own +4 Constitution adds no rounds: a Barbarian 4 with Con 14 rages 12 rounds per day, raging or not.
- **Unresolved:** a formula that can't be evaluated, the maximum's or an increase's, gives `value: null` and a rules warning on its entry.

The sheet shows each one as a chip on its entry's row in the class features list (`grant-entry-row.tsx`), such as "5/day", "12 rounds/day" or "Unresolved points/day", with no control to spend a use.

Tests: `src/lib/character-sheet-daily-maxima.test.ts` (rage by level and Constitution, rage's own Constitution, Extra Channel copies, two classes, an unresolved maximum and increase, the schema and its illegal shapes), `convex/characterSheetSpeedMaxima.integration.test.ts` (the saved sheet for owner, member and outsider; the write paths' refusals), `src/components/character-sheet/character-sheet-grants.test.tsx` (the chip).

### Which entries carry rule values

A catalog entry gets them from a checked rule-value record, the curation output kind `ruleValue` ([Rule-value records](../catalog-import/curation.md#rule-value-records-stats-d1)). stats-d1 wrote four and stats-dr one. All five are checked by the record step on captured reviews: the three dice records on run `t3-review-39c11ce78df040ad2a4d6b32ded1f4950209fdd7a420f3670f6110f90bc51363`, so the released Channel Energy, Channel Positive Energy and Lay on Hands rows carry their dice, and the two damage reduction records together on run `t3-review-2201b12a0aa65199ff87ed0c0f01f8618aac02f36cb6ab41722f79903359c10a`, so the shared Damage Reduction row and the Mad Dog's carry their damage reduction:

| Entry                                                                                 | Rule value                                                                | At three levels                                            | Record  |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------- | ------- |
| Channel Energy (Cleric, `pf1/kXXz1lO4i7CibHJ9`)                                       | dice, d6, its active rows                                                 | Cleric 1: 1d6; Cleric 8: 4d6; Ecclesitheurge Cleric 5: 2d6 | checked |
| Channel Positive Energy (Paladin, `pf1/tHObxrPeyhimmz9V`)                             | dice, d6, `ceil(@classLevel.paladin / 2)`                                 | Paladin 4: 2d6; 5: 3d6; 20: 10d6                           | checked |
| Lay on Hands (Paladin, `pf1/WhE4j0Jc82npdMCP`)                                        | dice, d6, `floor(@classLevel.paladin / 2)`                                | Paladin 2: 1d6; 4: 2d6; 12: 6d6                            | checked |
| Damage Reduction (Barbarian, Unchained Barbarian, Bloodrager, `pf1/RENIeTVjWB7Mq6Mw`) | damage reduction `-`, its active rows (each class's own)                  | Barbarian 7: 1/—; 10: 2/—; 19: 5/— (each class alike)      | checked |
| Damage Reduction (Mad Dog, `everythingpath/barbarian-mad-dog-damage-reduction`)       | damage reduction `-`, `floor((@classLevel.barbarian - 7) / 3)`, from 10th | Barbarian 10: 1/—; 13: 2/—; 19: 4/—                        | checked |

**What the sheet shows.** A Cleric's Channel Energy row has its dice chip from 1st level ("4d6" at Cleric 8), a Paladin's Lay on Hands row from 2nd and its Channel Positive Energy row from 4th ("2d6" each at Paladin 4); a Cleric / Paladin has each class's chips apart. These are the dice the class gives: nothing yet adds to them, so an item or feat that adds dice, such as the Phylactery of Positive Channeling or Greater Mercy, leaves the chip at the class's dice. The Defenses block shows the Barbarian's, Unchained Barbarian's and Bloodrager's damage reduction from 7th level and the Mad Dog's from 10th (below); no checked record gives spell resistance yet.

**Damage reduction.** The Damage Reduction the Barbarian, the Unchained Barbarian and the Bloodrager share (`pf1/RENIeTVjWB7Mq6Mw`) counts its rows class by class (rotation-4, [Amounts](#amounts)): each class has DR 1/— at 7th and 1 more at 10th, 13th, 16th and 19th, a Barbarian 10 / Bloodrager 10 has two 2/— lines and DR 2/—, and a Barbarian 6 / Bloodrager 6 has none. With both Grants on, a Mad Dog keeps the Barbarian's line and adds its own from 10th: Barbarian 8 DR 1/—, Barbarian 10 lines 2/— and 1/— and DR 2/—, Barbarian 13 3/— and 2/— and DR 3/—, Barbarian 19 5/— and 4/— and DR 5/—. The record step checked the two records together (root, 2026-11-17), so both lines are available. The reviewer found the Mad Dog's text silent on replacing the Barbarian's damage reduction, so the two lines stand as a reading of it; the owner's confirmation against the printed Animal Archive is open. Each line comes from its own Grant: a player who switches off the Barbarian's Damage Reduction Grant on a Mad Dog keeps the Mad Dog's own line, 1/— at 10th, so the sheet then shows that lower line.

Each record's sources are in its rationale; [`rule-values-d1.test.ts`](../../tests/catalog/rule-values-d1.test.ts) (the dice) and [`rule-values-dr.test.ts`](../../tests/catalog/rule-values-dr.test.ts) (the two damage reductions, every step of the schedule and the Grant of each line) check them drafted, checked in memory and as committed, on the pinned rows. The Robes of the Archmagi's spell resistance follows as its own catalog slice. Other classes' channel and damage reduction features have none yet: the Warpriest's and Antipaladin's channel, the Skald's and Stalwart Defender's damage reduction, the rage power Increased Damage Reduction, and the archetypes that change channel energy or damage reduction. A player can give one to a feat or other entry they make in the app (`catalogCopies.createOneOff`). Item Abilities' damage reduction and spell resistance stay Situational Notes ([Weapons and armor](weapons-and-armor.md)).

### Per-day maxima on catalog rows (stats-d3)

**Checked: nine.** The record step checked nine of the 30 per-day records on a captured review (run `t3-review-b9b390102ed6d3c97affa618747d99f5f5d908d77fabea28e6ad28636350f4b6`): Bane, Discern Lies and Judgment (Inquisitor), Challenge (Cavalier), Slayer's Advance, and the Summoner's Summon Monster I, Bond Senses, Maker's Call and Merge Forms. The released rows of these nine carry their maxima. The review refused the tenth, Lore Master: the Solacer keeps the Bard's row and alters it, its Learned Physician giving one take 20 a day where the rows give 2 at 11th and 3 at 17th, so it is held with the others (below).

**What the sheet shows.** Each of the nine is a chip on its entry's row in the class features list, the maximum only (no tally, no uses remaining): an Inquisitor 5's Bane and Discern Lies "5 rounds/day" and Judgment "2/day", a Summoner 16 with Charisma 18 "16 rounds/day" on Bond Senses and Merge Forms, "3/day" on Maker's Call and "7/day" on Summon Monster I, a Cavalier 10's Challenge "4/day" and a Slayer 17's Slayer's Advance "2/day". A row before its feature's level shows no chip. **No party character shows a per-day maximum from them** (Constitution 14, Intelligence 16, Wisdom 12, Charisma 18): the party has no Inquisitor, Summoner, Cavalier or Slayer. 3, 4, 6, 7, 8, 10, 12 and 13 would show maxima only from held records (below), and 13's Bard 4 is below Lore Master's 5th level. 11 shows none from any record: the Exploiter's Arcane Reservoir was left out, not held, because its maximum, 3 + the wizard level, is the most the reservoir holds, while each day it refills to only 3 + half the level and loses the rest, so a "7 points/day" chip would mislead. Of the nine, only Summon Monster I reads an ability modifier, floored at 0 (below), so none goes below 0 at the lowest legal score, 1. [`rule-values-d3.test.ts`](../../tests/catalog/rule-values-d3.test.ts) checks each of these as committed.

stats-d3 wrote 30 per-day records, all **drafted**; the record step checked the nine, and the other 21 stay drafted and give nothing. Rows marked _held_ in the table are drafted and not for promotion; every example below that needs one says so. Each maximum names its entry's Foundry tag as its key, a unit Foundry's `uses` does not carry, and an amount; the rows and the sources of each are in its rationale and in the batch's boundary. The importer still keeps Foundry's `uses` as retained game content: no unit, no class for `@class.level`, and formulas such as Smite Evil's Hit Dice are why every maximum is reviewed. Channel Energy and Lay on Hands keep their checked dice record and have a per-day record beside it, both per-day records _held_ ([Rule-value records](../catalog-import/curation.md#rule-value-records-stats-d1)).

| Entry                                                      | Key, unit                             | Amount                                                            |
| ---------------------------------------------------------- | ------------------------------------- | ----------------------------------------------------------------- |
| Channel Energy (Cleric), _held_                            | `classFeat_channelEnergy`, uses       | `3 + @ability.cha.mod`                                            |
| Rage (Barbarian), _held_                                   | `classFeat_rage`, rounds              | `4 + @ability.con.mod + 2 * (@classLevel.barbarian - 1)`          |
| Rage (Mad Dog, from 4th; replaces the Barbarian's), _held_ | `classFeat_rage`, rounds              | `4 + @ability.con.mod + 2 * (@classLevel.barbarian - 4)`          |
| Bloodrage, _held_                                          | `classFeat_bloodrage`, rounds         | `4 + @ability.con.mod + 2 * (@classLevel.bloodrager - 1)`         |
| Bardic Performance, _held_                                 | `classFeat_bardicPerformance`, rounds | `4 + @ability.cha.mod + 2 * (@classLevel.bard - 1)`               |
| Stunning Fist (Monk, Unchained Monk), _held_               | `classFeat_stunningFist`, uses        | monk level + 1 per 4 other Hit Dice                               |
| Arcane Pool (Magus), _held_                                | `classFeat_arcanePool`, points        | `max(1, floor(@classLevel.magus / 2)) + @ability.int.mod`         |
| Arcane Pool (Bladebound; replaces the Magus's), _held_     | `classFeat_arcanePool`, points        | `max(1, floor(@classLevel.magus / 3)) + max(0, @ability.int.mod)` |
| Lay on Hands, _held_                                       | `classFeat_layOnHands`, uses          | `floor(@classLevel.paladin / 2) + @ability.cha.mod`               |
| Smite Evil, _held_                                         | `classFeat_smiteEvil`, uses           | the active rows                                                   |
| Judgment, Challenge (Cavalier)                             | their tags, uses                      | the active rows                                                   |
| Lore Master (Bard), _held_                                 | `classFeat_loreMaster`, uses          | the active rows                                                   |
| Ki Pool (Unchained Monk), _held_                           | `classFeat_kiPoolUc`, points          | `floor(@classLevel.monkUnchained / 2) + @ability.wis.mod`         |
| Quivering Palm, _held_                                     | `classFeat_quiveringPalm`, uses       | 1                                                                 |
| Bane, Discern Lies                                         | their tags, rounds                    | the inquisitor level                                              |
| Bomb, _held_                                               | `classFeat_bomb`, uses                | `max(0, @classLevel.alchemist + @ability.int.mod)`                |
| Tactician, _held_                                          | `classFeat_tactician`, uses           | `1 + floor(@classLevel.cavalier / 5)`                             |
| Slayer's Advance                                           | `classFeat_slayersAdvance`, uses      | `1 + min(1, floor(@classLevel.slayer / 17))`                      |
| Summon Monster I (Summoner)                                | `classFeat_summonMonster`, uses       | `max(0, 3 + @ability.cha.mod)`                                    |
| Bond Senses, Merge Forms                                   | their tags, rounds                    | the summoner level                                                |
| Maker's Call                                               | `classFeat_makersCall`, uses          | `floor((@classLevel.summoner - 2) / 4)`                           |

**Keys.** A maximum's key is its own entry's Foundry tag. An increase names the key of the feature it raises, that feature's tag, not its own: Extra Rage names `classFeat_rage` and `classFeat_bloodrage`. An archetype's replacement keeps the key of the entry it replaces whole, so the increases of that feature reach it: the Mad Dog's Rage is `classFeat_rage` as the Barbarian's is, and the Bladebound's pool is `classFeat_arcanePool` as the Magus's is. So Extra Arcane Pool would raise the Bladebound's pool and Extra Rage the Mad Dog's Rage (all _held_; a probe with every record checked shows the first, below). Two maxima of one key on one character stay two numbers, apart per entry.

**Two records on one entry.** Channel Energy and Lay on Hands carry a checked dice record and a per-day record, the per-day one _held_: today they give their dice only. Once a per-day record of theirs is checked, the dice record applies first and the per-day record's values follow it, so Channel Energy's rule values would be its dice, then its maximum; the probe with every record checked shows this. When two records together would give more than the stored limit of 16 rule values, the later one is refused, naming both records and the limit, the earlier one still applies, and the preview and the release build fail on the refusal; the record step does not check such a pair ([Two records on one entry](../catalog-import/curation.md#two-records-on-one-entry-stats-d3)). Each of these entries would give one dice value and one maximum, so neither is near the limit.

**Increases**, each copy adding, all _held_: Extra Performance 6 rounds; Extra Lay On Hands 2 uses; Extra Ki 2 points to either monk's pool; Extra Arcane Pool 2 points, the Bladebound's pool included; Extra Channel 2 channel uses; Extra Rage 6 rounds of rage and 6 of bloodrage. The first four wait with the maxima they raise, every one held or left out (an increase with no maximum to raise shows nothing). Extra Channel's record gives its 2 uses to the Cleric's channel whichever class the feat was taken for, and Extra Rage's 6 rounds to each pool, which the text does not settle for a character with both (below). Extra Channel's four lay on hands uses for a paladin, for channeling only, are conditional and never enter the maximum. By the rules Extra Channel gives the Cleric's channel 2 uses only when taken for it, and neither its text nor PCGen lets it be taken twice; the sheet adds 2 for each copy, so a second copy is a table override.

**Left out:** Wild Shape (at will at 20th), Twin Eidolon (minutes), the Arcane Reservoir (its maximum is what the reservoir holds; each day it fills with 3 + half the level), the Monk's Ki Pool (the Scaled Fist bases it on Charisma while keeping the entry), Channel Positive Energy (it spends lay on hands), and every per-day power a domain, school, bloodline, mystery or order gives.

**Below 0 (fix r1).** An ability modifier can take a maximum below 0: a Cleric with Charisma 1 would channel −2 times (Channel Energy, _held_). No text here gives a minimum of the total (the Magus's "minimum 1" is of the half level, which its formula carries), and a negative count is not a number of uses, so a maximum is floored at 0 with the formula grammar's `max`: Summon Monster I shows 0 at Charisma 1, and Bomb (_held_) would show 0 at Intelligence 1. The Bladebound's pool (_held_), at least 1 plus the Intelligence bonus, never goes below 1. The grammar floors only a record's own amount, and an increase adds after it, so a record whose key an increase names cannot carry the floor: flooring it would add Extra Channel's 2 to 0 instead of to −2 (2 uses where the rules give 0; both _held_). Those records are held. For the same reason Summon Monster I's and Bomb's floors hold only while no increase names their key. A test (fix r7, r8) pins every pairing in the committed records of a maximum with an increase on its key, whatever either record's status: the key, both records' full IDs as the record step lists them (`rule-value <entry> per-day sha256:<description hash>`), the maximum's exact formula (or rows, or fixed amount), the increase's amount, and why the shown total is right. There are nine: the eight held below 0, whose formulas have no clamp, so the own amount plus the increase is the total, and the Bladebound's pool, whose text clamps a component ("plus his Intelligence bonus", never below 0) that Extra Arcane Pool's 2 adds after, as the sheet does. The records' pairings, each maximum output with each increase output on its key and each occurrence counted, must equal the list as multisets: the test fails, naming the pairing, on a new, changed, repeated or rebound pairing (an Extra Bombs record, a rewritten formula, a new amount, an output given twice, a description hash that moved) and on an entry the records no longer pair or pair less often, and a record giving two outputs of one kind on one key fails by itself, until the pairing is reviewed against its records' text and its entry added or corrected; it is a review gate, not a proof, and judges nothing about a formula. Once the sheet floors a maximum's total after its increases (rotation-5 part F), a maximum clamped in its own formula only to keep that total from going below 0 is rewritten to use that; a floor the rules put on a component stays, as the Bladebound's on its Intelligence bonus does.

**Checked: 9.** Bane, Discern Lies, Judgment, Challenge (Cavalier), Slayer's Advance, Summon Monster I, Bond Senses, Maker's Call and Merge Forms.

**Held, drafted and not for promotion: 21**, each saying why first in its rationale:

- Extra Channel: the feat is taken for one class's channel (PCGen gives one choice, the Cleric's +2 channel uses or the Paladin's +4 lay on hands uses for channeling), and no landed kind reads the choice, so it would raise a Cleric 5 / Paladin 4's cleric channel either way. It needs the feat's choice on the sheet, or a key per class.
- Extra Rage: for a character with both rage and bloodrage the text does not say whether the 6 rounds go to each pool, to one, or where the player chooses; the record gives 6 to each. Bloodrage counts as rage for feat abilities, which settles a Bloodrager without rage only.
- Channel Energy, Rage, the Mad Dog's Rage, Bloodrage, Bardic Performance, the Magus's Arcane Pool, Lay on Hands and the Unchained Monk's Ki Pool: below 0 at a low score, with an increase naming their key. They need the floor of a maximum with its increases.
- Refused by the promotion review, an archetype or a second class keeping the entry and changing its uses: the Bladebound's Arcane Pool (the black blade's Transfer Arcana from 13th and Life Drinker from 19th restore points during the day), Smite Evil (Oath of Vengeance and Tortured Crusader turn two lay on hands uses into a smite; Silver Champion loses uses), Stunning Fist (a Brawler's levels count as monk levels), Bomb (First World Innovator uses half the level, minimum 1), Tactician (Strategist's earlier uses; a Tactician Fighter's levels stack) and Quivering Palm (Martial Artist's extra uses above 15th).
- Refused by the second promotion review: Lore Master (the Solacer keeps the row and alters it; its Learned Physician gives one take 20 a day, on Heal checks, from 5th).
- Refused by the promotion review, an increase with no maximum to raise: Extra Arcane Pool, Extra Performance, Extra Ki and Extra Lay On Hands. They wait with the maxima above.

**A probe, all 30 checked, the held ones included** (not what the committed records give; that is the first paragraphs): a Cleric 8 with Extra Channel and Charisma 18 would channel 9 times a day; a Mad Dog Barbarian 8 with Constitution 14 would rage 14 rounds; a Paladin 4 with Charisma 18 would lay on hands 6 times and smite twice; a Bladebound Magus 4 with Intelligence 16 would have 4 points, 6 with Extra Arcane Pool and 2 more per copy; each of these needs a held record. [`rule-values-d3.test.ts`](../../tests/catalog/rule-values-d3.test.ts) checks, in separate parts:

- **As committed:** the nine checked on the record step's review and the 21 drafted, the held ones by their rationale; exactly the nine entries changed, as checking only the nine in memory gives; each party character's maxima (none), the nine on their own classes, and Summon Monster I at Charisma 1.
- **All 30 checked (the probe):** each party character's maxima, a Cleric 5 / Paladin 4, Extra Channel twice, Extra Rage on a Barbarian 4 / Bloodrager 4, Extra Arcane Pool on the Bladebound's pool, each maximum with an ability modifier at score 1 (Bomb and the Bladebound's pool floored, the other held ones below 0), a temporary Constitution increase and features gained at later levels, on the pinned rows.
- **The pairings guard:** every committed pairing of a maximum with an increase on its key against the reviewed list, by full record ID and as multisets, and a new increase, a pairing the list lacks, a changed formula, a changed increase amount, a pairing the records no longer have, a maximum or an increase output given twice in its record, an obsolete amount listed beside its replacement, one pairing listed twice and a record rebound to a changed description, each refused with its pairing named (fix r7, r8).
