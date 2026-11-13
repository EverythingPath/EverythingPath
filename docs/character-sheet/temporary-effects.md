## Temporary Effects

An entry is a Temporary Effect according to its kind:

| Temporary                                   | Permanent                                                                          |
| ------------------------------------------- | ---------------------------------------------------------------------------------- |
| `spellEffect` with `lastsOverOneDay: false` | every other kind, including Spell Effects with `lastsOverOneDay: true` and `spell` |
| `condition`                                 |                                                                                    |
| `item` with `consumable: true`              |                                                                                    |
| `abilityDamage`                             | `abilityDrain`                                                                     |

The derived sheet applies every active entry to every statistic, HP included. Hit points from a temporary Con bonus are not temporary hit points. For ordinary single-sheet calculations, three calculations count permanent entries only:

- Militia Character Facts;
- the skill-rank budget;
- bonus spells.

This narrows "running spells" in [Decide what the militia reads from a Character Sheet, and when](https://github.com/AndreasUnunger/EverythingPath/issues/205) to Spell Effects lasting a day or less, which is the official 24-hour rule. A recorded `spell` grants no Modifiers, so it never affects these.

Permanent-only filtering follows every linked dependency: a temporary effect on an associated Character cannot enter Militia Character Facts through a Companion's derived value. Current sheet calculations still use the rule-specific inputs described under "Companions"; filtering changes which effects contribute, not which statistic a rule reads.

The prepared calculation interface is `calculateCharacterSheet(input, { permanentOnly: true })` or `calculateCharacterSheetProjections(input)`, which returns `{ current, permanent }`. Conditional `whileActive` references are rebuilt after filtering, and formulas read the filtered ability modifiers. The projections interface accepts paired `projectionInputs.current` / `.permanent` for already-resolved class and casting inputs from linked calculations; callers must propagate the corresponding projection at every link. These inputs are calculated data, never persisted. Actual Companion Relationship persistence and rule-specific linked input assembly remain with the companion tickets. Class progression assembly remains with #299; the formula resolver accepts its built-in numeric BAB and class/casting contexts rather than duplicating progression tables.

`calculateCharacterSheetProjections(input).permanent` remains the exported ordinary permanent projection for Militia Character Facts (#261). Structural advancement is assembled in the named `characterLevelInputs` step; formula rules read the resulting `options.level` and `options.hitDice`, while named class counts come from `options.classLevels`. #299 can replace that assembly with its advancement inputs without changing the formula grammar or variable rules.

The public calculator's `advancementBudgets` in `src/lib/character-sheet-advancement.ts` consumes the permanent Intelligence modifier retroactively, floors each level's base-plus-Int budget at one, then adds favored-class ranks. Racial Hit Dice supply their separate ordinary rank budget through the same `ordinarySkillRanksPerLevel` formula. This ordinary formula must not replace fixed or allocated companion budgets. `calculateBonusSpells` selects replacement casting abilities using current modifiers and alphabetical ability-name ties, then reads the selected ability's permanent score. Only available positive spell-level table entries receive bonuses (a zero-valued entry is available; `null` is unavailable); level zero and levels above nine receive none. Skill budgets are integrated into the public calculator; the bonus-spell reader remains prepared for the later Spellcasting integration, without persisted spells-known counts or casting tables.
