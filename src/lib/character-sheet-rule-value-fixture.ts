// Shared imported-shaped setup for the rule-value tests (rotation-5): a base
// entry with every ability at 10 unless named, a base class with its level
// features, and a sheet of class levels in order.
import {
  abilityKeys,
  abilityTargets,
  type Ability,
  type CharacterSheetCatalogEntry,
  type CharacterSheetInput,
  type SheetEntry,
} from './character-sheet';

export function baseScores(
  scores: Partial<Record<Ability, number>> = {},
): CharacterSheetCatalogEntry {
  return {
    _id: 'base',
    ruleIdentity: 'base',
    modifiers: abilityKeys.map((key) => ({
      target: abilityTargets[key],
      bonusType: 'base',
      value: scores[key] ?? 10,
    })),
  };
}

/** A base class: its tag and identity are `id`; only its features matter. */
export function baseClass(
  id: string,
  name: string,
  featuresByLevel: { classLevel: number; catalogEntryId: string }[],
): CharacterSheetCatalogEntry {
  return {
    _id: id,
    ruleIdentity: id,
    name,
    modifiers: [],
    detail: {
      kind: 'class',
      classKind: 'base',
      tag: id,
      hitDie: 8,
      bab: 'threeQuarters',
      saves: { fort: 'good', ref: 'poor', will: 'good' },
      skillRanksPerLevel: 2,
      featuresByLevel,
    },
  };
}

/** The base row, one Class Level per class named (in order), then `extra`. */
export function classLevelSheet(
  classes: readonly string[],
  extra: readonly SheetEntry[],
  catalogEntries: CharacterSheetCatalogEntry[],
): CharacterSheetInput {
  return {
    characterKind: 'pc',
    entries: [
      {
        _id: 'base-row',
        kind: 'base',
        active: true,
        catalogEntryId: 'base',
        state: { kind: 'base' },
      },
      ...classes.map(
        (classEntryId, index): SheetEntry => ({
          _id: `level-${index + 1}`,
          kind: 'classLevel',
          active: true,
          state: {
            kind: 'classLevel',
            classEntryId,
            position: index + 1,
            hpGained: 6,
          },
        }),
      ),
      ...extra,
    ],
    catalogEntries,
  };
}
