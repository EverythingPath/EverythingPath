// pbl-reseed-generic (PRD #251): the sheet the party's weapon Item Ability
// test (item-abilities-party-502.test.ts) places its imported abilities on,
// built as the pf-special-qualities-501 batch adapter built it, without that
// adapter's Item Ability definitions read from the batch preview.
import {
  abilityKeys,
  abilityTargets,
  type CharacterSheetCatalogEntry,
  type CharacterSheetInput,
  type SheetEntry,
} from '../../src/lib/character-sheet';
import type { WeaponDetail } from '../../src/lib/character-sheet-attacks';

// Core Rulebook statistics (Table 6-4, p. 142; Table 6-6, p. 150) of the
// published items the abilities are placed on.
const weapon = (
  baseType: string,
  detail: Omit<WeaponDetail, 'baseType' | 'strengthDamage'>,
): WeaponDetail => ({ baseType, strengthDamage: 'melee', ...detail });
const armorItem = (
  id: string,
  name: string,
  detail: Extract<CharacterSheetCatalogEntry['detail'], { kind: 'item' }>,
): CharacterSheetCatalogEntry => ({
  _id: id,
  name,
  ruleIdentity: id,
  modifiers: [],
  detail,
});
export const baseItems: CharacterSheetCatalogEntry[] = [
  armorItem('longsword', 'Longsword', {
    kind: 'item',
    weapon: weapon('longsword', {
      proficiency: 'martial',
      handedness: 'oneHanded',
      attackType: 'melee',
      dice: '1d8',
      damageTypes: ['slashing'],
      threat: 19,
      mult: 2,
    }),
  }),
  armorItem('heavy-shield', 'Heavy steel shield', {
    kind: 'item',
    armor: {
      slot: 'shield',
      category: 'heavyShield',
      bonus: 2,
      maxDex: null,
      armorCheckPenalty: 2,
      asf: 15,
    },
    weapon: weapon('heavy shield', {
      proficiency: 'martial',
      handedness: 'oneHanded',
      attackType: 'melee',
      dice: '1d4',
      damageTypes: ['bludgeoning'],
      threat: 20,
      mult: 2,
    }),
  }),
  armorItem('full-plate', 'Full plate', {
    kind: 'item',
    armor: {
      slot: 'armor',
      category: 'heavy',
      bonus: 9,
      maxDex: 1,
      armorCheckPenalty: 6,
      asf: 35,
    },
  }),
];

export type ItemRow = {
  id: string;
  definition: string;
  state?: Omit<Extract<SheetEntry, { kind: 'item' }>['state'], 'kind'>;
};
export type RoutineRow = {
  id: string;
  weapon: string;
  offHand?: Extract<SheetEntry, { kind: 'attackRoutine' }>['state']['offHand'];
};

/**
 * A proficient sheet (Str 16, Dex 12, the rest 10, BAB 11) with the listed
 * items and attack routines; the caller adds the Item Ability definitions.
 */
export function abilitySheet({
  items,
  routines = [],
}: {
  items: ItemRow[];
  routines?: RoutineRow[];
}): CharacterSheetInput {
  return {
    characterKind: 'pc',
    entries: [
      {
        _id: 'base-row',
        kind: 'base',
        active: true,
        catalogEntryId: 'base',
        state: {
          kind: 'base',
          proficiencies: {
            added: [
              { category: 'simple' },
              { category: 'martial' },
              { category: 'heavy' },
              { category: 'shield' },
            ],
            removed: [],
          },
        },
      },
      {
        _id: 'bab-row',
        kind: 'manual',
        active: true,
        catalogEntryId: 'bab',
        state: { kind: 'manual' },
      },
      ...items.map(
        ({ id, definition, state = {} }): SheetEntry => ({
          _id: id,
          kind: 'item',
          active: true,
          catalogEntryId: definition,
          state: { kind: 'item', ...state },
        }),
      ),
      ...routines.map(
        ({ id, weapon, offHand }): SheetEntry => ({
          _id: id,
          kind: 'attackRoutine',
          active: true,
          state: {
            kind: 'attackRoutine',
            name: id,
            weaponEntryId: weapon,
            hands: 'one',
            mode: 'melee',
            ...(offHand ? { offHand } : {}),
          },
        }),
      ),
    ],
    catalogEntries: [
      {
        _id: 'base',
        ruleIdentity: 'fixture-base',
        modifiers: abilityKeys.map((key) => ({
          target: abilityTargets[key],
          bonusType: 'base' as const,
          value: key === 'strength' ? 16 : key === 'dexterity' ? 12 : 10,
        })),
      },
      {
        _id: 'bab',
        ruleIdentity: 'fixture-bab',
        modifiers: [{ target: 'bab', bonusType: 'untyped', value: 11 }],
      },
      ...baseItems,
    ],
  };
}
