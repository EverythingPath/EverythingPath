import {
  abilityKeys,
  abilityTargets,
  type CharacterSheetCatalogEntry,
  type CharacterSheetInput,
  type SheetEntry,
} from './character-sheet';

export function prerequisiteSheet(
  entries: SheetEntry[] = [],
  definitions: CharacterSheetCatalogEntry[] = [],
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
      {
        _id: 'level-1',
        kind: 'classLevel',
        active: true,
        state: {
          kind: 'classLevel',
          position: 1,
          classEntryId: 'fighter',
          hpGained: 10,
        },
      },
      ...entries,
    ],
    catalogEntries: [
      {
        _id: 'base',
        ruleIdentity: 'base',
        modifiers: abilityKeys.map((ability) => ({
          target: abilityTargets[ability],
          bonusType: 'base',
          value: 10,
        })),
      },
      {
        _id: 'fighter',
        ruleIdentity: 'class/fighter',
        name: 'Fighter',
        modifiers: [],
        detail: {
          kind: 'class',
          classKind: 'base',
          hitDie: 10,
          bab: 'full',
          saves: { fort: 'good', ref: 'poor', will: 'poor' },
          skillRanksPerLevel: 2,
        },
      },
      ...definitions,
    ],
  };
}
export function selectedFeat(
  id: string,
  order = 0,
): Extract<SheetEntry, { kind: 'feat' }> {
  return {
    _id: id,
    catalogEntryId: id,
    kind: 'feat',
    active: true,
    gainedAtClassLevel: 'level-1',
    choiceOrder: order,
    state: { kind: 'feat', slot: 'general' },
  };
}
