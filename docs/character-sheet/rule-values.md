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
    };

type RuleValueSituation = SituationKey | { local: string }; // no option Situation

type RuleValueAmount =
  | number // a whole number, 0 or more
  | { rows: { per?: number } } // the entry's active rows counted, times per (1)
  | { formula: string }; // the closed formula grammar, as a Modifier's
```

The schema is `ruleValueSchema` (`src/lib/character-sheet.ts`). The stored Catalog Entry (`convex/schema.ts`) carries it; the imported entry (`importedCatalogEntrySchema`) carries `storedRuleValuesSchema`, nonempty, and a release's candidate definition takes it from the imported entry. A Catalog Copy carries it through its spread.

**Limits.** Convex's storage validator is derived from the schema and keeps only its types, so every write that stores rule values parses them: `createOneOff` checks them beside its Modifier and Situational Note limits ("An entry supports at most 16 Rule values", "Rule value is invalid"), and `writeCatalogDefinition` parses `storedRuleValuesSchema` ("Catalog definition is invalid"). Release staging (`catalogRelease.writeBatch`) stores a definition row and a retirement report's last usable definition without `writeCatalogDefinition`, so it parses both through `importedCatalogEntrySchema`'s field (`convex/catalogRelease.integration.test.ts`); discovery and candidate reads parse the same schema. At most 16 per entry; a formula of at most 4096 characters, a bypass of at most 64, and a Situation as a Situational Note's. Each limit's reason is beside it in `src/lib/character-sheet-feature-numbers.ts`. A one-sided die, a fractional or negative amount, `rows.per` 0 and an empty bypass are refused; an unsupported but well-formed formula is stored and warns when evaluated (`convex/characterSheetRuleValues.integration.test.ts`).

### Amounts

- **Rows:** the entry itself plus each counting entry whose `detail.parentFeature` is the entry's rule identity: the class's reviewed increments, such as the Cleric's Channel Energy rows at 3rd, 5th … 19th level. A row an Archetype replaces is dormant and a row switched off is not counting, so neither is counted: an Ecclesitheurge Cleric 5 channels 2d6, not 3d6.
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

### What carries no rule value yet

No released row gives one yet. The reviewed data that does (Channel Energy, Lay on Hands, the Barbarian's and Bloodrager's damage reduction, the Robes of the Archmagi) follows as its own catalog slices, through a curation output kind that is not built yet. A player can give one to a feat or other entry they make in the app (`catalogCopies.createOneOff`). Item Abilities' damage reduction and spell resistance stay Situational Notes ([Weapons and armor](weapons-and-armor.md)).
