import {
  abilityKeys,
  abilityTargets,
  type CharacterSheetInput,
} from './character-sheet';

export function equipmentSheet() {
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
        _id: 'armor-row',
        kind: 'item',
        active: true,
        catalogEntryId: 'armor',
        state: { kind: 'item', enhancement: 2 },
      },
      {
        _id: 'shield-row',
        kind: 'item',
        active: true,
        catalogEntryId: 'shield',
        state: { kind: 'item' },
      },
    ],
    catalogEntries: [
      {
        _id: 'base',
        ruleIdentity: 'base',
        modifiers: abilityKeys.map((ability) => ({
          target: abilityTargets[ability],
          bonusType: 'base',
          value: ability === 'dexterity' ? 18 : 10,
        })),
      },
      {
        _id: 'armor',
        name: 'Full plate',
        ruleIdentity: 'full-plate',
        modifiers: [],
        detail: {
          kind: 'item',
          armor: {
            slot: 'armor',
            category: 'heavy',
            bonus: 9,
            maxDex: 1,
            armorCheckPenalty: 6,
            asf: 35,
          },
        },
      },
      {
        _id: 'shield',
        name: 'Heavy steel shield',
        ruleIdentity: 'heavy-steel-shield',
        modifiers: [],
        detail: {
          kind: 'item',
          armor: {
            slot: 'shield',
            category: 'heavyShield',
            bonus: 2,
            maxDex: null,
            armorCheckPenalty: 2,
            asf: 15,
          },
        },
      },
    ],
  } as const satisfies CharacterSheetInput;
}
