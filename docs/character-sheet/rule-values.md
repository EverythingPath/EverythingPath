## Rule values

A **rule value** is a number a Catalog Entry gives that is not a Modifier, such as Channel Energy's dice. Each kind has its own combining rule, so none of them goes through [stacking](stacking.md). A Catalog Entry lists them in `ruleValues`; an entry stored before they existed has none and reads as before (`convex/characterSheetRuleValues.integration.test.ts`).

```ts
type RuleValue =
  | { kind: 'dice'; die: number; amount: RuleValueAmount; key?: string } // Channel Energy: d6
  | { kind: 'diceIncrease'; key: string; amount: RuleValueAmount } // the Phylactery of Positive Channeling: 2
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

**Limits.** Convex's storage validator is derived from the schema and keeps only its types, so every write that stores rule values parses them: `createOneOff` checks them beside its Modifier and Situational Note limits ("An entry supports at most 16 Rule values", "Rule value is invalid"), and `writeCatalogDefinition` parses `storedRuleValuesSchema` ("Catalog definition is invalid"). Release staging (`catalogRelease.writeBatch`) stores a definition row and a retirement report's last usable definition without `writeCatalogDefinition`, so it parses both through `importedCatalogEntrySchema`'s field (`convex/catalogRelease.integration.test.ts`); discovery and candidate reads parse the same schema. At most 16 per entry; a formula of at most 4096 characters, a bypass of at most 64, a per-day or dice key of at most 64, and a Situation as a Situational Note's. Each limit's reason is beside it in `src/lib/character-sheet-feature-numbers.ts`. A one-sided die, a fractional or negative amount, `rows.per` 0, an empty bypass, an empty or over-long per-day or dice key, an unknown unit, and any field outside the kind (a tally of uses, an increase's unit, a dice increase's own die or condition) are refused (`convex/characterSheetSpeedMaxima.integration.test.ts` for the per-day kinds, `convex/characterSheetArmorNoneDice.integration.test.ts` for the dice key and increase, both through `createOneOff` and `writeCatalogDefinition`; `src/lib/character-sheet-dice-increase.test.ts` for the imported schema and the curation output); an unsupported but well-formed formula is stored and warns when evaluated (`convex/characterSheetRuleValues.integration.test.ts`).

### Amounts

- **Rows:** the entry itself plus each counting entry whose `detail.parentFeature` is the entry's rule identity and that the entry's own class granted (rotation-4): the class's reviewed increments, such as the Cleric's Channel Energy rows at 3rd, 5th … 19th level. A row an Archetype replaces is dormant and a row switched off is not counting, so neither is counted: an Ecclesitheurge Cleric 5 channels 2d6, not 3d6. A parent entry two classes share (the Barbarian's and the Bloodrager's Damage Reduction) counts each class's rows apart: a Barbarian 10 / Bloodrager 10 has two 2/— lines and DR 2/—, not 3/—. A row's class is the class whose Class Level granted it, through nested grants, or the class of the Archetype that added it; an entry no class granted counts only rows no class granted (`src/lib/character-sheet-resistances.test.ts`).
- **Formula:** evaluated as a Modifier on an internal dependent-stage target, so it reads the variables a Modifier reads (`@classLevel.paladin`, ability modifiers, `@bab`), and a Spell Effect's reads its recorded caster level as `@casterLevel`, as that effect's Modifiers do: the spell spell resistance's `12 + @casterLevel` at caster level 9 gives SR 21. A class feature's has no caster level to read. A formula that can't be evaluated gives no number and a rules warning on the entry (`<entry>:ruleValue:<index>`).
- Each amount is evaluated by `evaluateModifier`, so an entry a condition suppresses gives nothing.

Rule values come from the same counting entries as Modifiers; the permanent projection leaves out Temporary Effects.

### Dice

`resolveFeatureNumbers` (`src/lib/character-sheet-feature-numbers.ts`) gives `calculated.featureNumbers`: one feature number per dice rule value of a counting entry, `{ kind: 'dice', entryId, ruleValueIndex, count, die, sources }`. `count` is null while its formula can't be evaluated; `sources` names the rows counted, or the entry for a number or formula. Two classes' dice stay apart: a Cleric 5 / Paladin 4 channels 3d6 as a cleric and 2d6 as a paladin, never 5d6.

**Dice increases** (rotation-5). A dice rule value may carry a `key` (the Foundry tag, as a per-day key), and a `diceIncrease { key, amount }` on another counting entry adds its amount to every dice value of that key, in that value's die: a Cleric 8 holding the Phylactery of Positive Channeling (`+2d6`) channels 4d6 + 2d6 = 6d6.

- **Per copy or item:** each counting entry with an increase of the key adds once; an item switched off is not counting, and a suppressed entry gives none. `sources` names the dice's rows or entry, then each increase's entry, and `increases` (fix r1), present once any adds, gives each one's `{ entryId, name, count }`: the row shows each beside the total as its own chip, "+2d6 from Phylactery of Positive Channeling".
- **Once per entry, never its own dice** (fix r1): "per copy" is per active copy of the increasing entry (two copies of a feat taken twice), never per line, so one entry's rule values repeat no `diceIncrease` key (two increases of one key on the same entry are refused; increases of one key on different entries, or on independent copies of one entry, each add); and an increase raises another entry's dice, so none names a key its own entry's dice carry. Both are refused at write, never ignored: `storedRuleValuesSchema` (so `writeCatalogDefinition`, release staging, discovery and candidate reads through the imported entry schema), `createOneOff` (`validatePersonalAdjustment`, naming the reason) and a rule-value record (`scripts/catalog/curation.ts`, naming the reason). Increases of two keys on one entry (the Phylactery's), or a `dailyMaximumIncrease` and a `diceIncrease` of one key, are stored.
- **Apart per key:** a Cleric 5 / Paladin 4 with an increase of the Cleric's key alone channels 5d6 and 2d6.
- **No key, no increase:** a dice value without a key is exactly as before. An increase is evaluated only while an unsuppressed keyed dice value of its key is on the sheet (fix r1), so one with none gives nothing and no warning, whatever its formula (a holder with no channel is a valid sheet).
- **Suppressed:** an increase whose entry a condition suppresses (a Grappled Condition that Pinned replaces) is never evaluated: its formula gives no warning and the dice read as without it (fix r1). So is a keyed dice value whose entry a condition suppresses: suppression is decided before its formula, so it gives no number, warns nothing even with a formula that can't be evaluated, and is no match for an increase of its key (fix r2). A dice value without a key is evaluated as before.
- **Unresolved:** an increase whose formula can't be evaluated adds nothing and has its own rules warning on its entry (`<entry>:ruleValue:<index>`); the dice keep their count and sources as without it, with every other increase added (fix r1).
- **Unresolved dice:** while the keyed value's own formula can't be evaluated, the row shows it as unresolved ("Unresolved d6") with its own warning, and no increase as applied: `count` is null, `sources` names only its rows or entry, and the number has no `increases`, since that list holds only increases that add and none adds to dice with no count (fix r2; the output type has no unresolved variant with `increases`). Each increase of its key is still evaluated, as the value is unsuppressed and on the sheet, so an unresolved increase still warns on its own line.
- A conditional extra die, such as Greater Mercy's (only when the target has no condition the paladin's mercies can remove), is not an increase: it stays the feat's Situational Note.

Every combination of a keyed base die (resolved, unresolved, suppressed, absent) and an increase (resolved, unresolved, suppressed, unmatched, repeated, self-targeted) has its case in `src/lib/character-sheet-dice-increase-table.test.ts` (fix r2: 24, what the row shows and which rows warn, or the write's refusal).

Tests: `src/lib/character-sheet-dice-increase.test.ts` (the Cleric 8, copies and an item switched off, no key, two keys, no keyed value whatever the formula, a suppressed increase and a suppressed base, an unresolved increase beside a resolved one, both projections, the schemas and their illegal shapes, a repeated or self-targeted increase, an entry stored before keys), `convex/characterSheetArmorNoneDice.integration.test.ts` (an old one-off reads as before; a Catalog Copy stored before rotation-5, with its provenance, unkeyed dice, a per-day maximum and an `armorAtMost: 'medium'` Modifier, reads and computes exactly as at the rotation's base; the saved sheet; the write paths' refusals).

The sheet shows each one as a chip on its entry's row in the class features list (`grant-entry-row.tsx`), such as "3d6", or "Unresolved d6", followed by a muted chip per dice increase that added, naming its source.

Tests: `src/lib/character-sheet-feature-numbers.test.ts` (dice by level, the Ecclesitheurge, two channel classes, an unresolved formula, both projections, the schema and its illegal shapes), `convex/characterSheetRuleValues.integration.test.ts` (the saved sheet for owner, member and outsider), `src/components/character-sheet/character-sheet-grants.test.tsx` (the chip; each increase with its source).

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
- **Floored at 0** (rotation-5; root, 2026-11-18: a negative count is not a number of uses, and no rules text is claimed for it): the total, the amount plus every increase, is never below 0. The amount itself may be negative inside the sum, so a Cleric 1 with Charisma 1 and Extra Channel channels 3 − 5 + 2 = 0 times, and without the feat 0, not −2. While the floor applies the maximum carries `floor: { sum }` (a calculation field), and its row shows a muted chip beside the maximum, "Floored at 0 (sum −2)": the Cleric without the feat shows "0/day" and that chip; with Extra Channel the sum is 0, nothing is floored, and the row shows "0/day" alone. A record's own stated minimum, such as `max(1, …)` in its formula, applies to its amount before the increases are added. Each key is floored apart.
- **Permanent ability modifiers:** a maximum's or increase's formula reads the permanent ability modifiers, so rage's own +4 Constitution adds no rounds: a Barbarian 4 with Con 14 rages 12 rounds per day, raging or not.
- **Unresolved:** a formula that can't be evaluated, the maximum's or an increase's, gives `value: null` and a rules warning on its entry.

The sheet shows each one as a chip on its entry's row in the class features list (`grant-entry-row.tsx`), such as "5/day", "12 rounds/day" or "Unresolved points/day", with no control to spend a use.

Tests: `src/lib/character-sheet-daily-maxima.test.ts` (rage by level and Constitution, rage's own Constitution, Extra Channel copies, two classes, an unresolved maximum and increase, the schema and its illegal shapes), `src/lib/character-sheet-daily-maxima-floor.test.ts` (the floor: the Cleric 1 with and without Extra Channel, a positive total, a formula's own minimum, two keys), `convex/characterSheetSpeedMaxima.integration.test.ts` (the saved sheet for owner, member and outsider; the write paths' refusals), `src/components/character-sheet/character-sheet-grants.test.tsx` (the maximum's chip and the floor's).

### Which entries carry rule values

A catalog entry gets them from a checked rule-value record, the curation output kind `ruleValue` ([Rule-value records](../catalog-import/curation.md#rule-value-records-stats-d1)). stats-d1 wrote four and stats-dr one. All five are checked by the record step on captured reviews: the three dice records on run `t3-review-39c11ce78df040ad2a4d6b32ded1f4950209fdd7a420f3670f6110f90bc51363`, so the released Channel Energy, Channel Positive Energy and Lay on Hands rows carry their dice, and the two damage reduction records together on run `t3-review-2201b12a0aa65199ff87ed0c0f01f8618aac02f36cb6ab41722f79903359c10a`, so the shared Damage Reduction row and the Mad Dog's carry their damage reduction:

| Entry                                                                                 | Rule value                                                                | At three levels                                            | Record  |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------- | ------- |
| Channel Energy (Cleric, `pf1/kXXz1lO4i7CibHJ9`)                                       | dice, d6, its active rows                                                 | Cleric 1: 1d6; Cleric 8: 4d6; Ecclesitheurge Cleric 5: 2d6 | checked |
| Channel Positive Energy (Paladin, `pf1/tHObxrPeyhimmz9V`)                             | dice, d6, `ceil(@classLevel.paladin / 2)`                                 | Paladin 4: 2d6; 5: 3d6; 20: 10d6                           | checked |
| Lay on Hands (Paladin, `pf1/WhE4j0Jc82npdMCP`)                                        | dice, d6, `floor(@classLevel.paladin / 2)`                                | Paladin 2: 1d6; 4: 2d6; 12: 6d6                            | checked |
| Damage Reduction (Barbarian, Unchained Barbarian, Bloodrager, `pf1/RENIeTVjWB7Mq6Mw`) | damage reduction `-`, its active rows (each class's own)                  | Barbarian 7: 1/—; 10: 2/—; 19: 5/— (each class alike)      | checked |
| Damage Reduction (Mad Dog, `everythingpath/barbarian-mad-dog-damage-reduction`)       | damage reduction `-`, `floor((@classLevel.barbarian - 7) / 3)`, from 10th | Barbarian 10: 1/—; 13: 2/—; 19: 4/—                        | checked |

**What the sheet shows.** A Cleric's Channel Energy row has its dice chip from 1st level ("4d6" at Cleric 8), a Paladin's Lay on Hands row from 2nd and its Channel Positive Energy row from 4th ("2d6" each at Paladin 4); a Cleric / Paladin has each class's chips apart. These are the dice the class gives: the sheet takes a dice increase (rotation-5, [Dice](#dice)), but no checked record gives one yet and these records carry no `key`, so an item or feat that adds dice, such as the Phylactery of Positive Channeling, still leaves the chip at the class's dice; Greater Mercy's conditional die stays its Situational Note. The Defenses block shows the Barbarian's, Unchained Barbarian's and Bloodrager's damage reduction from 7th level and the Mad Dog's from 10th (below); no checked record gives spell resistance yet.

**Damage reduction.** The Damage Reduction the Barbarian, the Unchained Barbarian and the Bloodrager share (`pf1/RENIeTVjWB7Mq6Mw`) counts its rows class by class (rotation-4, [Amounts](#amounts)): each class has DR 1/— at 7th and 1 more at 10th, 13th, 16th and 19th, a Barbarian 10 / Bloodrager 10 has two 2/— lines and DR 2/—, and a Barbarian 6 / Bloodrager 6 has none. With both Grants on, a Mad Dog keeps the Barbarian's line and adds its own from 10th: Barbarian 8 DR 1/—, Barbarian 10 lines 2/— and 1/— and DR 2/—, Barbarian 13 3/— and 2/— and DR 3/—, Barbarian 19 5/— and 4/— and DR 5/—. The record step checked the two records together (root, 2026-11-17), so both lines are available. The reviewer found the Mad Dog's text silent on replacing the Barbarian's damage reduction, so the two lines stand as a reading of it; the owner's confirmation against the printed Animal Archive is open. Each line comes from its own Grant: a player who switches off the Barbarian's Damage Reduction Grant on a Mad Dog keeps the Mad Dog's own line, 1/— at 10th, so the sheet then shows that lower line.

Each record's sources are in its rationale; [`rule-values-d1.test.ts`](../../tests/catalog/rule-values-d1.test.ts) (the dice) and [`rule-values-dr.test.ts`](../../tests/catalog/rule-values-dr.test.ts) (the two damage reductions, every step of the schedule and the Grant of each line) check them drafted, checked in memory and as committed, on the pinned rows. The Robes of the Archmagi's spell resistance, Foundry's per-day `uses` and Extra Channel follow as their own catalog slices. Other classes' channel and damage reduction features have none yet: the Warpriest's and Antipaladin's channel, the Skald's and Stalwart Defender's damage reduction, the rage power Increased Damage Reduction, and the archetypes that change channel energy or damage reduction. A player can give one to a feat or other entry they make in the app (`catalogCopies.createOneOff`). Item Abilities' damage reduction and spell resistance stay Situational Notes ([Weapons and armor](weapons-and-armor.md)).
