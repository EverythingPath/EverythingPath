import { expect, test } from 'vitest';
import {
  abilityKeys,
  abilityTargets,
  calculateCharacterSheet,
  calculateCharacterSheetProjections,
  type CharacterSheetCatalogEntry,
  type CharacterSheetInput,
  type ItemAbilityDetail,
  type ItemMagic,
  type ResolveOptions,
  type SheetEntry,
} from './character-sheet';
import { createCatalogSheetEntryState } from './character-sheet-entries';
import { createItemDefinitionLookup } from './character-sheet-items';
import type { WeaponDetail } from './character-sheet-attacks';

// Pathfinder RPG Core Rulebook, Chapter 15: weapon special abilities
// (pp. 469–471), armor special abilities (pp. 461–463), specific weapons
// (pp. 471–478) and specific armor and shields (pp. 464–467); special
// materials, Chapter 6 (pp. 154–155). #236 and #237 settle the modelling.

type ItemRow = {
  id: string;
  definition: string;
  state?: Omit<Extract<SheetEntry, { kind: 'item' }>['state'], 'kind'>;
  active?: boolean;
};
type RoutineRow = {
  id: string;
  weapon: string;
  hands?: 'one' | 'two';
  mode?: 'melee' | 'ranged' | 'thrown';
  offHand?: Extract<SheetEntry, { kind: 'attackRoutine' }>['state']['offHand'];
  ammunitionEntryId?: string;
};

const longsword: WeaponDetail = {
  baseType: 'longsword',
  proficiency: 'martial',
  handedness: 'oneHanded',
  attackType: 'melee',
  dice: '1d8',
  damageTypes: ['slashing'],
  threat: 19,
  mult: 2,
  strengthDamage: 'melee',
};

function ability(
  id: string,
  name: string,
  detail: Omit<ItemAbilityDetail, 'kind'>,
  modifiers: CharacterSheetCatalogEntry['modifiers'] = [],
): CharacterSheetCatalogEntry {
  return {
    _id: id,
    name,
    ruleIdentity: id,
    modifiers,
    detail: { kind: 'itemAbility', ...detail },
  };
}

const HUNTSMAN_DAMAGE =
  'against a creature the wielder has tracked with Survival in the past day';
const HUNTSMAN_SURVIVAL =
  'to track a creature the weapon has damaged in the past day';

const catalog: CharacterSheetCatalogEntry[] = [
  {
    _id: 'longsword',
    name: 'Longsword',
    ruleIdentity: 'longsword',
    modifiers: [],
    detail: { kind: 'item', weapon: longsword },
  },
  {
    _id: 'club',
    name: 'Club',
    ruleIdentity: 'club',
    modifiers: [],
    detail: {
      kind: 'item',
      weapon: {
        baseType: 'club',
        proficiency: 'simple',
        handedness: 'oneHanded',
        attackType: 'melee',
        dice: '1d6',
        damageTypes: ['bludgeoning'],
        threat: 20,
        mult: 2,
        strengthDamage: 'melee',
      },
    },
  },
  {
    _id: 'mace',
    name: 'Heavy mace',
    ruleIdentity: 'heavy-mace',
    modifiers: [],
    detail: {
      kind: 'item',
      weapon: {
        baseType: 'heavy mace',
        proficiency: 'simple',
        handedness: 'oneHanded',
        attackType: 'melee',
        dice: '1d8',
        damageTypes: ['bludgeoning'],
        threat: 20,
        mult: 2,
        strengthDamage: 'melee',
      },
    },
  },
  {
    _id: 'dagger',
    name: 'Dagger',
    ruleIdentity: 'dagger',
    modifiers: [],
    detail: {
      kind: 'item',
      weapon: {
        baseType: 'dagger',
        proficiency: 'simple',
        handedness: 'light',
        attackType: 'melee',
        dice: '1d4',
        damageTypes: ['piercing', 'slashing'],
        threat: 19,
        mult: 2,
        thrown: true,
        thrownRangeIncrement: 10,
        strengthDamage: 'melee',
      },
    },
  },
  {
    _id: 'hammer',
    name: 'Gnome hooked hammer',
    ruleIdentity: 'gnome-hooked-hammer',
    modifiers: [],
    detail: {
      kind: 'item',
      weapon: {
        baseType: 'gnome hooked hammer',
        proficiency: 'exotic',
        handedness: 'twoHanded',
        attackType: 'melee',
        dice: '1d8',
        damageTypes: ['bludgeoning'],
        threat: 20,
        mult: 3,
        strengthDamage: 'melee',
        otherEnd: {
          dice: '1d6',
          damageTypes: ['piercing'],
          threat: 20,
          mult: 4,
        },
      },
    },
  },
  {
    _id: 'longbow',
    name: 'Longbow',
    ruleIdentity: 'longbow',
    modifiers: [],
    detail: {
      kind: 'item',
      weapon: {
        baseType: 'longbow',
        proficiency: 'martial',
        handedness: 'twoHanded',
        attackType: 'ranged',
        dice: '1d8',
        damageTypes: ['piercing'],
        threat: 20,
        mult: 3,
        rangeIncrement: 100,
        strengthDamage: 'bow',
      },
    },
  },
  {
    _id: 'arrows',
    name: 'Arrows',
    ruleIdentity: 'arrows',
    modifiers: [],
    detail: { kind: 'item', consumable: true, ammunition: true },
  },
  {
    _id: 'heavy-shield',
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
      weapon: {
        baseType: 'heavy shield',
        proficiency: 'martial',
        handedness: 'oneHanded',
        attackType: 'melee',
        dice: '1d4',
        damageTypes: ['bludgeoning'],
        threat: 20,
        mult: 2,
        strengthDamage: 'melee',
      },
    },
  },
  // CRB p. 152: light steel shield, bash 1d3.
  {
    _id: 'light-shield',
    name: 'Light steel shield',
    ruleIdentity: 'light-steel-shield',
    modifiers: [],
    detail: {
      kind: 'item',
      armor: {
        slot: 'shield',
        category: 'lightShield',
        bonus: 1,
        maxDex: null,
        armorCheckPenalty: 1,
        asf: 5,
      },
      weapon: {
        baseType: 'light shield',
        proficiency: 'martial',
        handedness: 'light',
        attackType: 'melee',
        dice: '1d3',
        damageTypes: ['bludgeoning'],
        threat: 20,
        mult: 2,
        strengthDamage: 'melee',
      },
    },
  },
  {
    _id: 'heavy-wooden-shield',
    name: 'Heavy wooden shield',
    ruleIdentity: 'heavy-wooden-shield',
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
  {
    _id: 'full-plate',
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
    _id: 'chain-shirt',
    name: 'Chain shirt',
    ruleIdentity: 'chain-shirt',
    modifiers: [],
    detail: {
      kind: 'item',
      armor: {
        slot: 'armor',
        category: 'light',
        bonus: 4,
        maxDex: 4,
        armorCheckPenalty: 2,
        asf: 20,
      },
    },
  },
  // CRB p. 473: a +1 flaming burst longsword. Upstream weapon data is a
  // placeholder; the Base Item supplies the real statistics.
  {
    _id: 'flame-tongue',
    name: 'Flame tongue',
    ruleIdentity: 'flame-tongue',
    modifiers: [],
    detail: {
      kind: 'item',
      baseItem: 'longsword',
      weapon: {
        baseType: 'longsword',
        proficiency: 'simple',
        dice: '1d4',
        threat: 20,
        mult: 2,
      },
      magic: {
        enhancement: 1,
        abilities: [{ catalogEntryId: 'flaming-burst' }],
      },
    },
  },
  // CRB specific armor (pp. 464–465): its own numbers already include mithral.
  {
    _id: 'mithral-shirt',
    name: 'Mithral shirt',
    ruleIdentity: 'mithral-shirt',
    modifiers: [],
    detail: {
      kind: 'item',
      baseItem: 'chain-shirt',
      material: 'mithral',
      armor: {
        slot: 'armor',
        category: 'light',
        bonus: 4,
        maxDex: 6,
        armorCheckPenalty: 0,
        asf: 10,
      },
    },
  },
  // CRB specific armor (pp. 464–465): no armor numbers of its own; the Base
  // Item's apply.
  {
    _id: 'dwarven-plate',
    name: 'Dwarven plate',
    ruleIdentity: 'dwarven-plate',
    modifiers: [],
    detail: { kind: 'item', baseItem: 'full-plate', material: 'adamantine' },
  },
  {
    _id: 'darkwood-shield',
    name: 'Darkwood shield',
    ruleIdentity: 'darkwood-shield',
    modifiers: [],
    detail: {
      kind: 'item',
      baseItem: 'heavy-wooden-shield',
      material: 'darkwood',
      armor: { slot: 'shield', bonus: 2, maxDex: null, armorCheckPenalty: 0 },
    },
  },
  {
    _id: 'lost-base',
    name: 'Orphaned blade',
    ruleIdentity: 'orphaned-blade',
    modifiers: [],
    detail: { kind: 'item', baseItem: 'missing-base' },
  },
  ability('flaming', 'Flaming', {
    appliesTo: 'weapon',
    bonusEquivalent: 1,
    damageDice: [{ dice: '1d6', damageType: 'fire', on: 'hit' }],
  }),
  ability('frost', 'Frost', {
    appliesTo: 'weapon',
    bonusEquivalent: 1,
    damageDice: [{ dice: '1d6', damageType: 'cold', on: 'hit' }],
  }),
  ability('flaming-burst', 'Flaming burst', {
    appliesTo: 'weapon',
    bonusEquivalent: 2,
    damageDice: [
      { dice: '1d6', damageType: 'fire', on: 'hit' },
      { dice: '1d10', damageType: 'fire', on: 'crit' },
    ],
  }),
  ability('keen', 'Keen', {
    appliesTo: 'melee',
    bonusEquivalent: 1,
    doublesThreat: true,
    weaponDamageTypes: ['piercing', 'slashing'],
  }),
  ability('holy', 'Holy', {
    appliesTo: 'weapon',
    bonusEquivalent: 2,
    damageDice: [{ dice: '2d6', on: 'hit', situation: 'evil' }],
  }),
  ability('bane', 'Bane', {
    appliesTo: 'weapon',
    bonusEquivalent: 1,
    choice: 'creatureType',
    foeEnhancement: 2,
    damageDice: [{ dice: '2d6', on: 'hit', situation: '$choice' }],
  }),
  ability('shadow', 'Shadow', { appliesTo: 'armor', bonusEquivalent: 0 }, [
    { target: 'skill.ste', bonusType: 'competence', value: 5 },
  ]),
  ability(
    'seeking-edge',
    'Honed edge',
    { appliesTo: 'weapon', bonusEquivalent: 1 },
    [
      {
        target: 'attack',
        bonusType: 'competence',
        value: 1,
        condition: { weapon: '$self' },
      },
    ],
  ),
  // Ultimate Equipment and APG abilities, from their pinned pf1-content
  // bodies (#764): huntsman, bashing (a shield's), speed (also CRB p. 471)
  // and arrow catching (another shield ability).
  ability(
    'huntsman',
    'Huntsman',
    {
      appliesTo: 'weapon',
      bonusEquivalent: 1,
      damageDice: [
        {
          dice: '1d6',
          damageType: 'untyped',
          on: 'hit',
          situation: { local: HUNTSMAN_DAMAGE },
        },
      ],
    },
    [
      {
        target: 'skill.sur',
        bonusType: 'enhancement',
        value: { formula: '@item.enhancement' },
        condition: { situation: { local: HUNTSMAN_SURVIVAL } },
      },
    ],
  ),
  {
    ...ability('bashing', 'Bashing', { appliesTo: 'shield', bonusEquivalent: 1 }, [
      {
        target: 'attack',
        bonusType: 'enhancement',
        value: 1,
        condition: { weapon: '$self' },
      },
      {
        target: 'damage',
        bonusType: 'enhancement',
        value: 1,
        condition: { weapon: '$self' },
      },
    ]),
    sourceKey: 'bashing',
  },
  {
    ...ability('speed', 'Speed', { appliesTo: 'weapon', bonusEquivalent: 3 }),
    sourceKey: 'haste',
  },
  ability('arrow-catching', 'Arrow catching', {
    appliesTo: 'shield',
    bonusEquivalent: 1,
  }),
  // CRB p. 211: the haste spell's extra attack shares the haste Source.
  {
    _id: 'haste',
    name: 'Haste',
    ruleIdentity: 'haste',
    modifiers: [],
    detail: { kind: 'spellEffect' },
  },
  {
    _id: 'improved-critical',
    name: 'Improved Critical',
    ruleIdentity: 'improved-critical',
    modifiers: [],
    detail: { kind: 'feat' },
  },
  {
    _id: 'shield-master',
    name: 'Shield Master',
    ruleIdentity: 'shield-master',
    modifiers: [],
    detail: { kind: 'feat' },
  },
  {
    _id: 'two-weapon-fighting',
    name: 'Two-Weapon Fighting',
    ruleIdentity: 'two-weapon-fighting',
    modifiers: [],
    detail: { kind: 'feat' },
  },
];

function sheet({
  items = [],
  routines = [],
  feats = [],
  bab = 11,
}: {
  items?: ItemRow[];
  routines?: RoutineRow[];
  feats?: { id: string; choice?: string }[];
  bab?: number;
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
              { category: 'light' },
              { category: 'heavy' },
              { category: 'shield' },
              { baseType: 'gnome hooked hammer' },
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
        ({ id, definition, state = {}, active = true }): SheetEntry => ({
          _id: id,
          kind: 'item',
          active,
          catalogEntryId: definition,
          state: { kind: 'item', ...state },
        }),
      ),
      ...routines.map(
        ({
          id,
          weapon,
          hands = 'one',
          mode = 'melee',
          offHand,
          ammunitionEntryId,
        }): SheetEntry => ({
          _id: id,
          kind: 'attackRoutine',
          active: true,
          state: {
            kind: 'attackRoutine',
            name: id,
            weaponEntryId: weapon,
            hands,
            mode,
            ...(offHand ? { offHand } : {}),
            ...(ammunitionEntryId ? { ammunitionEntryId } : {}),
          },
        }),
      ),
      ...feats.map(
        ({ id, choice }): SheetEntry => ({
          _id: `${id}-row`,
          kind: 'feat',
          active: true,
          catalogEntryId: id,
          state: { kind: 'feat', ...(choice ? { choice } : {}) },
        }),
      ),
    ],
    catalogEntries: [
      {
        _id: 'base',
        ruleIdentity: 'base',
        modifiers: abilityKeys.map((key) => ({
          target: abilityTargets[key],
          bonusType: 'base' as const,
          value: key === 'strength' ? 18 : key === 'dexterity' ? 14 : 10,
        })),
      },
      {
        _id: 'bab',
        ruleIdentity: 'bab',
        modifiers: [{ target: 'bab', bonusType: 'untyped', value: bab }],
      },
      ...catalog,
    ],
  };
}

function routine(input: CharacterSheetInput, id = 'routine', options = {}) {
  const result = calculateCharacterSheet(input, options).attackRoutines.find(
    (row) => row.entryId === id,
  );
  if (!result) throw new Error(`Missing routine ${id}`);
  return result;
}

function extra(line: { extraDamage: readonly object[] } | undefined) {
  return line?.extraDamage.map((part) => {
    const { dice, damageType, on, situation, applies } = part as {
      dice: string;
      damageType: string | null;
      on: string;
      situation: string | null;
      applies: boolean;
    };
    return { dice, damageType, on, situation, applies };
  });
}

test('adding a specific magic item copies its editable defaults once', () => {
  const magic: ItemMagic = {
    enhancement: 1,
    abilities: [{ catalogEntryId: 'flaming-burst' }],
    otherEnd: { enhancement: 2 },
  };
  const state = createCatalogSheetEntryState({
    kind: 'item',
    itemMagic: magic,
  });
  expect(state).toEqual({
    kind: 'item',
    state: {
      kind: 'item',
      enhancement: 1,
      abilities: [{ catalogEntryId: 'flaming-burst' }],
      otherEnd: { enhancement: 2 },
    },
  });
  // The copy is the sheet's own: later definition edits do not reach it.
  magic.abilities = [];
  expect(state.state).toMatchObject({
    abilities: [{ catalogEntryId: 'flaming-burst' }],
  });
  expect(createCatalogSheetEntryState({ kind: 'item' })).toEqual({
    kind: 'item',
    state: { kind: 'item' },
  });
});

// CRB p. 473; #236: a specific weapon takes its weapon statistics and
// proficiency from its Base Item, never from the upstream placeholder.
test('a specific magic weapon resolves its Base Item and the copied flaming burst state', () => {
  const input = sheet({
    items: [
      {
        id: 'tongue',
        definition: 'flame-tongue',
        state: {
          enhancement: 1,
          abilities: [{ catalogEntryId: 'flaming-burst' }],
        },
      },
    ],
    routines: [{ id: 'routine', weapon: 'tongue' }],
  });
  const [line] = routine(input).single;
  expect(line).toMatchObject({ damageDice: '1d8', damageType: 'slashing' });
  expect(line?.criticalThreat.total).toBe(19);
  // BAB 11 + Str 4 + enhancement 1.
  expect(line?.attackBonus.total).toBe(16);
  expect(line?.damageBonus.total).toBe(5);
  expect(extra(line)).toEqual([
    {
      dice: '1d6',
      damageType: 'fire',
      on: 'hit',
      situation: null,
      applies: true,
    },
    {
      dice: '1d10',
      damageType: 'fire',
      on: 'crit',
      situation: null,
      applies: true,
    },
  ]);
  const simpleOnly: CharacterSheetInput = {
    ...input,
    entries: input.entries.map((entry) =>
      entry.kind === 'base'
        ? {
            ...entry,
            state: {
              ...entry.state,
              proficiencies: { added: [{ category: 'simple' }], removed: [] },
            },
          }
        : entry,
    ),
  };
  // The placeholder says simple; the Base Item's martial proficiency applies.
  expect(routine(simpleOnly).single[0]?.attackBonus.total).toBe(12);
  const calculated = calculateCharacterSheet(input);
  expect(calculated.itemParts).toEqual([
    expect.objectContaining({
      entryId: 'tongue',
      baseItemId: 'longsword',
      parts: [
        expect.objectContaining({
          part: 'primary',
          enhancement: 1,
          masterwork: true,
          bonusEquivalent: 3,
          abilities: [
            expect.objectContaining({
              catalogEntryId: 'flaming-burst',
              name: 'Flaming burst',
              choiceMissing: false,
            }),
          ],
        }),
      ],
    }),
  ]);
});

test('a specific item whose Base Item is unavailable warns instead of using its placeholder', () => {
  const calculated = calculateCharacterSheet(
    sheet({
      items: [{ id: 'blade', definition: 'lost-base' }],
      routines: [{ id: 'routine', weapon: 'blade' }],
    }),
  );
  expect(calculated.warnings).toContainEqual(
    expect.objectContaining({
      kind: 'unresolved',
      check: 'itemBaseItemUnresolved',
      subject: 'blade',
    }),
  );
  expect(calculated.attackRoutines[0]?.single).toEqual([]);
});

// CRB p. 469: burst dice scale with the weapon's printed multiplier (#237 A13).
test('burst dice follow each end’s printed multiplier and never multiply otherwise', () => {
  const input = sheet({
    items: [
      {
        id: 'hammer-row',
        definition: 'hammer',
        state: {
          enhancement: 1,
          abilities: [{ catalogEntryId: 'flaming-burst' }],
          otherEnd: {
            enhancement: 2,
            abilities: [{ catalogEntryId: 'flaming-burst' }],
          },
        },
      },
    ],
    routines: [
      {
        id: 'routine',
        weapon: 'hammer-row',
        hands: 'two',
        offHand: { kind: 'otherEnd', mode: 'melee' },
      },
    ],
  });
  const full = routine(input).full;
  const primary = full.find((line) => line.end === 'primary');
  const other = full.find((line) => line.end === 'otherEnd');
  expect(extra(primary)?.find((part) => part.on === 'crit')?.dice).toBe('2d10');
  expect(extra(other)?.find((part) => part.on === 'crit')?.dice).toBe('3d10');
  expect(primary?.damageBonus.applied).toContainEqual(
    expect.objectContaining({ value: 1, bonusType: 'enhancement' }),
  );
  expect(other?.damageBonus.applied).toContainEqual(
    expect.objectContaining({ value: 2, bonusType: 'enhancement' }),
  );
});

test('each double-weapon end keeps its own abilities', () => {
  const input = sheet({
    items: [
      {
        id: 'hammer-row',
        definition: 'hammer',
        state: {
          otherEnd: {
            enhancement: 1,
            abilities: [
              { catalogEntryId: 'flaming' },
              { catalogEntryId: 'seeking-edge' },
            ],
          },
        },
      },
    ],
    routines: [
      {
        id: 'routine',
        weapon: 'hammer-row',
        hands: 'two',
        offHand: { kind: 'otherEnd', mode: 'melee' },
      },
    ],
  });
  const full = routine(input).full;
  const primary = full.find((line) => line.end === 'primary');
  const other = full.find((line) => line.end === 'otherEnd');
  expect(extra(primary)).toEqual([]);
  expect(extra(other)?.map((part) => part.dice)).toEqual(['1d6']);
  // A weapon-scoped ability Modifier applies only to its own end's lines.
  expect(
    primary?.attackBonus.applied.some((row) =>
      row.entryName.includes('Honed edge'),
    ),
  ).toBe(false);
  expect(other?.attackBonus.applied).toContainEqual(
    expect.objectContaining({ bonusType: 'competence', value: 1 }),
  );
});

// CRB p. 469: bane is +2 better against its foe and deals +2d6; #236: until
// a foe is chosen it contributes nothing.
test('bane contributes nothing until its foe is chosen, then only in that Situation', () => {
  const unchosen = sheet({
    items: [
      {
        id: 'sword',
        definition: 'longsword',
        state: { enhancement: 1, abilities: [{ catalogEntryId: 'bane' }] },
      },
    ],
    routines: [{ id: 'routine', weapon: 'sword' }],
  });
  expect(extra(routine(unchosen).single[0])).toEqual([]);
  expect(
    calculateCharacterSheet(unchosen).itemParts[0]?.parts[0]?.abilities[0],
  ).toMatchObject({ choice: null, choiceMissing: true });
  const chosen = sheet({
    items: [
      {
        id: 'sword',
        definition: 'longsword',
        state: {
          enhancement: 1,
          abilities: [{ catalogEntryId: 'bane', choice: 'undead' }],
        },
      },
    ],
    routines: [{ id: 'routine', weapon: 'sword' }],
  });
  const [ordinary] = routine(chosen).single;
  expect(ordinary?.attackBonus.total).toBe(16);
  expect(extra(ordinary)).toEqual([
    {
      dice: '2d6',
      damageType: null,
      on: 'hit',
      situation: 'undead',
      applies: false,
    },
  ]);
  const [preview] = routine(chosen, 'routine', {
    situations: ['undead'],
  }).single;
  // The weapon's +1 becomes +3 against undead.
  expect(preview?.attackBonus.total).toBe(18);
  expect(preview?.damageBonus.total).toBe(7);
  expect(extra(preview)?.[0]?.applies).toBe(true);
});

test('holy dice are Situational damage against evil', () => {
  const input = sheet({
    items: [
      {
        id: 'sword',
        definition: 'longsword',
        state: { enhancement: 1, abilities: [{ catalogEntryId: 'holy' }] },
      },
    ],
    routines: [{ id: 'routine', weapon: 'sword' }],
  });
  expect(extra(routine(input).single[0])).toEqual([
    {
      dice: '2d6',
      damageType: null,
      on: 'hit',
      situation: 'evil',
      applies: false,
    },
  ]);
  expect(
    extra(routine(input, 'routine', { situations: ['evil'] }).single[0])?.[0]
      ?.applies,
  ).toBe(true);
});

// Huntsman (#764): "+1d6 points of damage to creatures the wielder has
// tracked with Survival in the past day" is a die under a local Situation of
// the weapon carrying it.
test('a local-Situation die waits on that Situation of its own weapon', () => {
  const input = sheet({
    items: [
      {
        id: 'sword',
        definition: 'longsword',
        state: { enhancement: 1, abilities: [{ catalogEntryId: 'huntsman' }] },
      },
      { id: 'plate', definition: 'full-plate' },
    ],
    routines: [{ id: 'routine', weapon: 'sword' }],
  });
  const die = {
    dice: '1d6',
    damageType: 'untyped',
    on: 'hit',
    situation: { local: HUNTSMAN_DAMAGE },
  };
  expect(extra(routine(input).single[0])).toEqual([
    { ...die, applies: false },
  ]);
  const picked = (sheetEntryId: string) =>
    extra(
      routine(input, 'routine', {
        situations: [{ local: HUNTSMAN_DAMAGE, sheetEntryId }],
      }).single[0],
    );
  expect(picked('sword')).toEqual([{ ...die, applies: true }]);
  // An equally named Situation of another entry is another Situation.
  expect(picked('plate')).toEqual([{ ...die, applies: false }]);
});

// Huntsman (#764): "the weapon's enhancement bonus on Survival checks made to
// track any creature the weapon has damaged in the past day", while held.
test("an item-enhancement formula reads the enhancement of the part carrying the ability", () => {
  const survival = (
    items: ItemRow[],
    situations = [{ local: HUNTSMAN_SURVIVAL, sheetEntryId: 'hammer-row' }],
  ) => {
    const calculated = calculateCharacterSheet(sheet({ items }), {
      situations,
    });
    return {
      total: calculated.breakdowns['skill.sur'].total,
      applied: calculated.breakdowns['skill.sur'].applied
        .filter(({ entryName }) => entryName === 'Huntsman')
        .map(({ bonusType, value, entryName }) => ({
          bonusType,
          value,
          entryName,
        })),
      warnings: calculated.warnings.filter((warning) =>
        warning.check.includes('ormula'),
      ),
    };
  };
  const huntsman = [{ catalogEntryId: 'huntsman' }];
  // On the other end: that end's +3, not the head's +1.
  expect(
    survival([
      {
        id: 'hammer-row',
        definition: 'hammer',
        state: { enhancement: 1, otherEnd: { enhancement: 3, abilities: huntsman } },
      },
    ]),
  ).toEqual({
    total: 3,
    applied: [{ bonusType: 'enhancement', value: 3, entryName: 'Huntsman' }],
    warnings: [],
  });
  // Without an enhancement bonus the weapon has none to give: +0.
  expect(
    survival([
      { id: 'hammer-row', definition: 'hammer', state: { abilities: huntsman } },
    ]),
  ).toMatchObject({ total: 0, warnings: [] });
  // Only while tracking such a creature, and only while the weapon is held.
  expect(
    survival(
      [
        {
          id: 'hammer-row',
          definition: 'hammer',
          state: { enhancement: 2, abilities: huntsman },
        },
      ],
      [],
    ).total,
  ).toBe(0);
  expect(
    survival([
      {
        id: 'hammer-row',
        definition: 'hammer',
        active: false,
        state: { enhancement: 2, abilities: huntsman },
      },
    ]).total,
  ).toBe(0);
});

// Huntsman with greater magic weapon (CRB p. 307: +1 per four caster levels,
// at most +5): the weapon's enhancement bonus is the higher of its own and the
// spell's, never their sum, and the spell is temporary, so the permanent
// projection keeps the weapon's own (#764).
test("an item-enhancement formula reads the part's effective enhancement under a targeted Spell Effect", () => {
  const greaterMagicWeapon: CharacterSheetCatalogEntry = {
    _id: 'greater-magic-weapon',
    name: 'Greater magic weapon',
    ruleIdentity: 'greater-magic-weapon',
    modifiers: (['attack', 'damage'] as const).map((target) => ({
      target,
      bonusType: 'enhancement' as const,
      value: { formula: 'min(5, floor(@casterLevel / 4))' },
      condition: { weapon: '$target' as const },
    })),
    detail: {
      kind: 'spellEffect',
      lastsOverOneDay: false,
      defaultCasterLevel: 5,
      itemTarget: 'weapon',
    },
  };
  const huntsmanSword = (enhancement: number, casterLevel: number) => {
    const input = sheet({
      items: [
        {
          id: 'sword',
          definition: 'longsword',
          state: { enhancement, abilities: [{ catalogEntryId: 'huntsman' }] },
        },
      ],
    });
    return {
      ...input,
      entries: [
        ...input.entries,
        {
          _id: 'gmw',
          kind: 'spellEffect' as const,
          active: true,
          catalogEntryId: 'greater-magic-weapon',
          state: {
            kind: 'spellEffect' as const,
            casterLevel,
            onItem: { entry: 'sword' },
          },
        },
      ],
      catalogEntries: [...input.catalogEntries, greaterMagicWeapon],
    };
  };
  const situations = [{ local: HUNTSMAN_SURVIVAL, sheetEntryId: 'sword' }];
  const survival = (input: CharacterSheetInput) => {
    const { current, permanent } = calculateCharacterSheetProjections(input, {
      situations,
    });
    return [current, permanent].map(
      (calculated) => calculated.breakdowns['skill.sur'].total,
    );
  };
  // +1 sword, caster level 12: +3 now, the sword's +1 permanently.
  expect(survival(huntsmanSword(1, 12))).toEqual([3, 1]);
  // +2 sword, caster level 4: the spell's +1 loses to the sword's +2.
  expect(survival(huntsmanSword(2, 4))).toEqual([2, 2]);
  // Unenchanted, caster level 8: the spell's +2 alone; permanently +0.
  expect(survival(huntsmanSword(0, 8))).toEqual([2, 0]);
});

// A player's own targeted +3 enhancement effect (homebrew, modelled on
// greater magic weapon) whose Modifiers carry a prerequisite or a Situation of
// their own: Huntsman counts it only where the weapon's attacks do (#764).
test('an item-enhancement formula counts a targeted enhancement only while its own conditions hold', () => {
  const RAGING = 'while the wielder rages';
  const effect = (
    condition: CharacterSheetCatalogEntry['modifiers'][number]['condition'],
  ): CharacterSheetCatalogEntry => ({
    _id: 'keyed-blade',
    name: 'Keyed blade',
    ruleIdentity: 'keyed-blade',
    modifiers: (['attack', 'damage'] as const).map((target) => ({
      target,
      bonusType: 'enhancement' as const,
      value: 3,
      condition: { weapon: '$target' as const, ...condition },
    })),
    detail: {
      kind: 'spellEffect',
      lastsOverOneDay: false,
      defaultCasterLevel: 1,
      itemTarget: 'weapon',
    },
  });
  const huntsmanSword = (
    definition: CharacterSheetCatalogEntry,
    feats: { id: string }[] = [],
  ) => {
    const input = sheet({
      items: [
        {
          id: 'sword',
          definition: 'longsword',
          state: { enhancement: 1, abilities: [{ catalogEntryId: 'huntsman' }] },
        },
      ],
      routines: [{ id: 'routine', weapon: 'sword' }],
      feats,
    });
    return {
      ...input,
      entries: [
        ...input.entries,
        {
          _id: 'keyed',
          kind: 'spellEffect' as const,
          active: true,
          catalogEntryId: 'keyed-blade',
          state: {
            kind: 'spellEffect' as const,
            casterLevel: 1,
            onItem: { entry: 'sword' },
          },
        },
      ],
      catalogEntries: [...input.catalogEntries, definition],
    };
  };
  const tracking = { local: HUNTSMAN_SURVIVAL, sheetEntryId: 'sword' };
  // [current, permanent] as [sword enhancement on its attack, Survival]:
  // BAB 11 + Str 4 + enhancement on the attack, the same enhancement on
  // Survival. The effect is temporary, so the permanent sword keeps its +1.
  const read = (
    input: CharacterSheetInput,
    situations: ResolveOptions['situations'] = [tracking],
  ) => {
    const { current, permanent } = calculateCharacterSheetProjections(input, {
      situations,
    });
    return [current, permanent].map((calculated) => [
      (calculated.attackRoutines[0]?.single[0]?.attackBonus.total ?? 0) -
        11 -
        4,
      calculated.breakdowns['skill.sur'].total,
    ]);
  };
  // Prerequisite: the effect works only while Shield Master is active.
  const keyed = effect({ whileActive: 'shield-master' });
  expect(read(huntsmanSword(keyed))).toEqual([
    [1, 1],
    [1, 1],
  ]);
  expect(read(huntsmanSword(keyed, [{ id: 'shield-master' }]))).toEqual([
    [3, 3],
    [1, 1],
  ]);
  // Situation: the effect's own, until picked.
  const raging = effect({ situation: { local: RAGING } });
  expect(read(huntsmanSword(raging))).toEqual([
    [1, 1],
    [1, 1],
  ]);
  expect(
    read(huntsmanSword(raging), [
      tracking,
      { local: RAGING, sheetEntryId: 'keyed' },
    ]),
  ).toEqual([
    [3, 3],
    [1, 1],
  ]);
});

// Bashing (#764; pinned body): "deals damage as if it were a weapon of two
// size categories larger (a Medium light shield thus deals 1d6 points of
// damage and a Medium heavy shield deals 1d8 points of damage). The shield
// acts as a +1 weapon when used to bash."
test('bashing makes the bash a +1 weapon two size categories larger and leaves the shield AC alone', () => {
  const bashing = [{ catalogEntryId: 'bashing' }];
  const bash = (
    items: ItemRow[],
    feats: { id: string }[] = [],
    weapon = 'shield',
  ) => {
    const calculated = calculateCharacterSheet(
      sheet({ items, routines: [{ id: 'routine', weapon }], feats }),
    );
    const line = calculated.attackRoutines[0]?.single[0];
    return {
      dice: line?.damageDice,
      attack: line?.attackBonus.total,
      damage: line?.damageBonus.total,
      shieldAc: calculated.breakdowns['ac.shield'].total,
      appliesTo: calculated.warnings.filter(
        (warning) => warning.check === 'itemAbilityAppliesTo',
      ),
    };
  };
  // BAB 11 + Str 4 + 1; Str 4 + 1; heavy steel shield +2, +1 enhancement.
  expect(
    bash([
      {
        id: 'shield',
        definition: 'heavy-shield',
        state: { enhancement: 1, abilities: bashing },
      },
    ]),
  ).toEqual({ dice: '1d8', attack: 16, damage: 5, shieldAc: 3, appliesTo: [] });
  expect(
    bash([
      { id: 'shield', definition: 'light-shield', state: { abilities: bashing } },
    ]),
  ).toMatchObject({ dice: '1d6', attack: 16, damage: 5, shieldAc: 1 });
  // Without it: the printed 1d4 and Strength alone.
  expect(
    bash([{ id: 'shield', definition: 'heavy-shield', state: { enhancement: 1 } }]),
  ).toMatchObject({ dice: '1d4', attack: 15, damage: 4 });
  // Enhancement bonuses don't stack: the bash's own +2 wins over Bashing's +1,
  // and so does the shield's +3 through Shield Master.
  expect(
    bash([
      {
        id: 'shield',
        definition: 'heavy-shield',
        state: { abilities: bashing, bash: { enhancement: 2 } },
      },
    ]),
  ).toMatchObject({ dice: '1d8', attack: 17, damage: 6 });
  expect(
    bash(
      [
        {
          id: 'shield',
          definition: 'heavy-shield',
          state: { enhancement: 3, abilities: bashing },
        },
      ],
      [{ id: 'shield-master' }],
    ),
  ).toMatchObject({ dice: '1d8', attack: 18, damage: 7, shieldAc: 5 });
  // Listed on the bash itself it is just as legitimate; another shield
  // ability on the bash is still flagged.
  expect(
    bash([
      {
        id: 'shield',
        definition: 'heavy-shield',
        state: { bash: { enhancement: 1, abilities: bashing } },
      },
    ]),
  ).toEqual({ dice: '1d8', attack: 16, damage: 5, shieldAc: 2, appliesTo: [] });
  expect(
    bash([
      {
        id: 'shield',
        definition: 'heavy-shield',
        state: {
          bash: {
            enhancement: 1,
            abilities: [{ catalogEntryId: 'arrow-catching' }],
          },
        },
      },
    ]).appliesTo,
  ).toEqual([expect.objectContaining({ subject: 'shield:bash' })]);
  // A sword attack is untouched by the shield's Bashing.
  expect(
    bash(
      [
        { id: 'sword', definition: 'longsword' },
        { id: 'shield', definition: 'heavy-shield', state: { abilities: bashing } },
      ],
      [],
      'sword',
    ),
  ).toMatchObject({ dice: '1d8', attack: 15, damage: 4 });
});

// Speed (#764; pinned body; CRB p. 471): "one extra attack with it… not
// cumulative with similar effects, such as a haste spell".
test('a speed weapon gives its own full attack one extra attack, never more with haste', () => {
  const full = (
    items: ItemRow[],
    routines: RoutineRow[] = [{ id: 'routine', weapon: 'sword' }],
    haste = false,
  ) => {
    const input = sheet({ items, routines });
    const hasted: CharacterSheetInput = haste
      ? {
          ...input,
          entries: [
            ...input.entries,
            {
              _id: 'effect:haste',
              kind: 'spellEffect',
              active: true,
              catalogEntryId: 'haste',
              state: { kind: 'spellEffect', casterLevel: 5 },
            },
          ],
        }
      : input;
    return routine(hasted).full.map((line) => [
      line.end,
      line.attackBonus.total,
      line.extraAttack ?? null,
    ]);
  };
  const speed = [{ catalogEntryId: 'speed' }];
  const speedSword: ItemRow = {
    id: 'sword',
    definition: 'longsword',
    state: { enhancement: 1, abilities: speed },
  };
  const extraWith = (sheetEntryId: string, name: string) => ({
    kind: 'haste',
    sheetEntryId,
    name,
  });
  // BAB 11, Str 4, +1: 16/16/11/6, the extra attack at the full bonus.
  expect(full([speedSword])).toEqual([
    ['primary', 16, null],
    ['primary', 16, extraWith('sword', 'Speed')],
    ['primary', 11, null],
    ['primary', 6, null],
  ]);
  // With haste as well: still one extra attack.
  expect(full([speedSword], undefined, true)).toHaveLength(4);
  // Another weapon's routine, or a speed weapon left off, gains nothing.
  const mace: RoutineRow[] = [{ id: 'routine', weapon: 'mace-row' }];
  const maceRow: ItemRow = { id: 'mace-row', definition: 'mace' };
  expect(full([speedSword, maceRow], mace)).toHaveLength(3);
  expect(full([{ ...speedSword, active: false }, maceRow], mace)).toHaveLength(
    3,
  );
  // On a shield, whose bash is the part that attacks, it gives none.
  expect(
    full(
      [{ id: 'shield', definition: 'heavy-shield', state: { abilities: speed } }],
      [{ id: 'routine', weapon: 'shield' }],
    ),
  ).toHaveLength(3);
  // A double weapon's speed end: the extra attack is with that end.
  const hammer = (state: ItemRow['state']): ItemRow[] => [
    { id: 'hammer-row', definition: 'hammer', state },
  ];
  expect(
    full(hammer({ otherEnd: { enhancement: 1, abilities: speed } }), [
      { id: 'routine', weapon: 'hammer-row', hands: 'two' },
    ]),
  ).toHaveLength(3);
  const ends = full(hammer({ otherEnd: { enhancement: 1, abilities: speed } }), [
    {
      id: 'routine',
      weapon: 'hammer-row',
      hands: 'two',
      offHand: { kind: 'otherEnd', mode: 'melee' },
    },
  ]);
  expect(ends.filter(([, , extraAttack]) => extraAttack)).toEqual([
    ['otherEnd', expect.any(Number), extraWith('hammer-row', 'Speed')],
  ]);
  expect(ends.filter(([end]) => end === 'otherEnd')).toHaveLength(2);
});

// CRB pp. 127, 470; #237 A15: keen and Improved Critical double once.
test('keen doubles the threat range once and never stacks with Improved Critical', () => {
  const keen = sheet({
    items: [
      {
        id: 'sword',
        definition: 'longsword',
        state: { enhancement: 1, abilities: [{ catalogEntryId: 'keen' }] },
      },
    ],
    routines: [{ id: 'routine', weapon: 'sword' }],
  });
  expect(routine(keen).single[0]?.criticalThreat.total).toBe(17);
  const both = sheet({
    items: [
      {
        id: 'sword',
        definition: 'longsword',
        state: { enhancement: 1, abilities: [{ catalogEntryId: 'keen' }] },
      },
    ],
    routines: [{ id: 'routine', weapon: 'sword' }],
    feats: [{ id: 'improved-critical', choice: 'longsword' }],
  });
  const threat = routine(both).single[0]?.criticalThreat;
  expect(threat?.total).toBe(17);
  expect(threat?.suppressed).toEqual([
    expect.objectContaining({
      entryName: 'Keen',
      reason: 'Threat-range expanders double the threat range only once.',
    }),
  ]);
  const hammer = sheet({
    items: [
      {
        id: 'hammer-row',
        definition: 'hammer',
        state: {
          otherEnd: { enhancement: 1, abilities: [{ catalogEntryId: 'keen' }] },
        },
      },
    ],
    routines: [
      {
        id: 'routine',
        weapon: 'hammer-row',
        hands: 'two',
        offHand: { kind: 'otherEnd', mode: 'melee' },
      },
    ],
  });
  const full = routine(hammer).full;
  expect(
    full.find((line) => line.end === 'primary')?.criticalThreat.total,
  ).toBe(20);
  expect(
    full.find((line) => line.end === 'otherEnd')?.criticalThreat.total,
  ).toBe(19);
});

// CRB pp. 152, 128: a shield's enhancement stays on its AC; its bash has
// its own. Shield Master (#237) removes the bash's two-weapon
// penalty and lets the shield's enhancement reach the bash without stacking.
test('a shield bash uses its own enhancement and abilities until Shield Master lends the AC enhancement', () => {
  const items: ItemRow[] = [
    { id: 'sword', definition: 'longsword' },
    {
      id: 'shield',
      definition: 'heavy-shield',
      state: { enhancement: 2, masterwork: true, bash: { enhancement: 1 } },
    },
  ];
  const routines: RoutineRow[] = [
    {
      id: 'routine',
      weapon: 'sword',
      offHand: { kind: 'weapon', weaponEntryId: 'shield', mode: 'melee' },
    },
  ];
  const ordinary = calculateCharacterSheet(sheet({ items, routines }));
  expect(ordinary.breakdowns['ac.shield'].total).toBe(4);
  const bash = ordinary.attackRoutines[0]?.full.find(
    (line) => line.hand === 'off',
  );
  // BAB 11 + Str 4 + bash +1 − 10 (heavy off hand without the feat).
  expect(bash?.attackBonus.total).toBe(6);
  expect(bash?.damageBonus.total).toBe(2 + 1);
  const master = calculateCharacterSheet(
    sheet({ items, routines, feats: [{ id: 'shield-master' }] }),
  );
  const masterBash = master.attackRoutines[0]?.full.find(
    (line) => line.hand === 'off',
  );
  // No two-weapon penalty and the shield's +2 instead of the bash's +1.
  expect(masterBash?.attackBonus.total).toBe(17);
  expect(masterBash?.damageBonus.total).toBe(2 + 2);
  expect(masterBash?.attackBonus.suppressed).toContainEqual(
    expect.objectContaining({ value: 1, bonusType: 'enhancement' }),
  );
  const main = master.attackRoutines[0]?.full.find(
    (line) => line.hand === 'main',
  );
  expect(main?.attackBonus.total).toBe(11 + 4 - 6);
  expect(
    master.itemParts.find((item) => item.entryId === 'shield')?.parts,
  ).toEqual([
    expect.objectContaining({
      part: 'primary',
      kind: 'shield',
      enhancement: 2,
    }),
    expect.objectContaining({
      part: 'bash',
      kind: 'melee',
      enhancement: 1,
      masterwork: true,
    }),
  ]);
});

test('a masterwork shield adds nothing to a bash without enhancement', () => {
  const calculated = calculateCharacterSheet(
    sheet({
      items: [
        {
          id: 'shield',
          definition: 'heavy-shield',
          state: { masterwork: true },
        },
      ],
      routines: [{ id: 'routine', weapon: 'shield' }],
    }),
  );
  expect(calculated.attackRoutines[0]?.single[0]?.attackBonus.total).toBe(15);
});

// CRB p. 468: only the higher of launcher and ammunition enhancement
// applies; the abilities of both apply.
test('ammunition and launcher enhancements compete while both items’ abilities apply', () => {
  const items: ItemRow[] = [
    {
      id: 'bow',
      definition: 'longbow',
      state: { enhancement: 1, abilities: [{ catalogEntryId: 'frost' }] },
    },
    {
      id: 'arrows-row',
      definition: 'arrows',
      state: { enhancement: 2, abilities: [{ catalogEntryId: 'flaming' }] },
    },
  ];
  const withArrows = routine(
    sheet({
      items,
      routines: [
        {
          id: 'routine',
          weapon: 'bow',
          hands: 'two',
          mode: 'ranged',
          ammunitionEntryId: 'arrows-row',
        },
      ],
    }),
  ).single[0];
  // BAB 11 + Dex 2 + the arrows' +2; the bow's +1 is suppressed.
  expect(withArrows?.attackBonus.total).toBe(15);
  expect(withArrows?.damageBonus.total).toBe(2);
  expect(withArrows?.attackBonus.suppressed).toContainEqual(
    expect.objectContaining({ value: 1, bonusType: 'enhancement' }),
  );
  expect(
    extra(withArrows)
      ?.map((part) => part.damageType)
      .sort(),
  ).toEqual(['cold', 'fire']);
  const without = routine(
    sheet({
      items,
      routines: [
        { id: 'routine', weapon: 'bow', hands: 'two', mode: 'ranged' },
      ],
    }),
  ).single[0];
  expect(without?.attackBonus.total).toBe(14);
  expect(extra(without)?.map((part) => part.damageType)).toEqual(['cold']);
});

// CRB pp. 154–155, #236's materials table and the 2026-10-05 silver decision.
test('weapon materials apply once per end', () => {
  const silver = routine(
    sheet({
      items: [
        {
          id: 'sword',
          definition: 'longsword',
          state: { material: 'alchemical silver' },
        },
      ],
      routines: [{ id: 'routine', weapon: 'sword' }],
    }),
  ).single[0];
  expect(silver?.damageBonus.total).toBe(3);
  const silverDagger = routine(
    sheet({
      items: [
        {
          id: 'dagger-row',
          definition: 'dagger',
          state: { material: 'alchemical-silver' },
        },
      ],
      routines: [{ id: 'routine', weapon: 'dagger-row' }],
    }),
  ).single[0];
  expect(silverDagger?.damageBonus.total).toBe(3);
  // CRB p. 154 names no damage type: a bludgeoning weapon takes −1 too.
  const silverMace = routine(
    sheet({
      items: [
        {
          id: 'mace-row',
          definition: 'mace',
          state: { material: 'alchemicalSilver' },
        },
      ],
      routines: [{ id: 'routine', weapon: 'mace-row' }],
    }),
  ).single[0];
  expect(silverMace?.damageBonus.total).toBe(3);
  expect(silverMace?.damageBonus.applied).toContainEqual(
    expect.objectContaining({
      value: -1,
      entryName: expect.stringContaining('alchemical silver'),
    }),
  );
  const adamantine = routine(
    sheet({
      items: [
        {
          id: 'dagger-row',
          definition: 'dagger',
          state: { material: 'adamantine' },
        },
      ],
      routines: [{ id: 'routine', weapon: 'dagger-row' }],
    }),
  ).single[0];
  // Adamantine is masterwork: +1 on attacks only.
  expect(adamantine?.attackBonus.total).toBe(16);
  expect(adamantine?.damageBonus.total).toBe(4);
  const coldIron = routine(
    sheet({
      items: [
        {
          id: 'sword',
          definition: 'longsword',
          state: { material: 'cold iron' },
        },
      ],
      routines: [{ id: 'routine', weapon: 'sword' }],
    }),
  ).single[0];
  expect(coldIron?.attackBonus.total).toBe(15);
  expect(coldIron?.damageBonus.total).toBe(4);
});

test('specific armor uses its own numbers or falls back to its Base Item', () => {
  const calculated = calculateCharacterSheet(
    sheet({
      items: [
        { id: 'shirt', definition: 'mithral-shirt', state: { enhancement: 1 } },
        { id: 'darkwood', definition: 'darkwood-shield' },
      ],
    }),
  );
  expect(calculated.equipment.items).toEqual([
    expect.objectContaining({
      entryId: 'shirt',
      armorBonus: 4,
      maxDexterityBonus: 6,
      spellFailure: 10,
      masterwork: true,
    }),
    // The category comes from the Base Item.
    expect.objectContaining({ entryId: 'darkwood', category: 'heavyShield' }),
  ]);
  expect(Math.abs(calculated.equipment.items[0]?.armorCheckPenalty ?? 1)).toBe(
    0,
  );
  const plate = calculateCharacterSheet(
    sheet({
      items: [
        { id: 'plate', definition: 'dwarven-plate', state: { enhancement: 2 } },
      ],
    }),
  );
  expect(plate.breakdowns['ac.armor'].total).toBe(11);
  // Its numbers come from the Base Item, so its adamantine still makes it
  // masterwork (CRB p. 154): the −1 armor check penalty applies.
  expect(plate.equipment.items[0]).toMatchObject({
    armorCheckPenalty: -5,
    maxDexterityBonus: 1,
  });
});

test('an armor ability’s own Modifiers apply while the armor is worn', () => {
  const worn = calculateCharacterSheet(
    sheet({
      items: [
        {
          id: 'shirt',
          definition: 'chain-shirt',
          state: { enhancement: 1, abilities: [{ catalogEntryId: 'shadow' }] },
        },
      ],
    }),
  );
  expect(worn.breakdowns['skill.ste'].applied).toContainEqual(
    expect.objectContaining({ bonusType: 'competence', value: 5 }),
  );
  const stowed = calculateCharacterSheet(
    sheet({
      items: [
        {
          id: 'shirt',
          definition: 'chain-shirt',
          active: false,
          state: { enhancement: 1, abilities: [{ catalogEntryId: 'shadow' }] },
        },
      ],
    }),
  );
  expect(
    stowed.breakdowns['skill.ste'].applied.some(
      (row) => row.bonusType === 'competence',
    ),
  ).toBe(false);
});

// #236 and CRB pp. 461, 467–468: construction checks per end and per bash.
test('construction warnings are advisory and separate for each end and bash', () => {
  const calculated = calculateCharacterSheet(
    sheet({
      items: [
        {
          id: 'shield',
          definition: 'heavy-shield',
          state: {
            enhancement: 1,
            abilities: [{ catalogEntryId: 'flaming' }],
            bash: {
              enhancement: 6,
              abilities: [
                { catalogEntryId: 'flaming' },
                { catalogEntryId: 'flaming' },
                { catalogEntryId: 'keen' },
              ],
            },
          },
        },
        {
          id: 'hammer-row',
          definition: 'hammer',
          state: {
            enhancement: 5,
            abilities: [
              { catalogEntryId: 'holy' },
              { catalogEntryId: 'flaming-burst' },
              { catalogEntryId: 'frost' },
              { catalogEntryId: 'keen' },
            ],
            otherEnd: { abilities: [{ catalogEntryId: 'frost' }] },
          },
        },
      ],
    }),
  );
  const warnings = calculated.warnings
    .filter(
      (warning) =>
        warning.check.startsWith('item') ||
        warning.check === 'equipmentEnhancement',
    )
    .map(({ check, subject, kind }) => ({ check, subject, kind }));
  expect(warnings).toEqual(
    expect.arrayContaining([
      // A flaming shield: a weapon ability on the shield itself.
      { check: 'itemAbilityAppliesTo', subject: 'shield', kind: 'rules' },
      { check: 'equipmentEnhancement', subject: 'shield:bash', kind: 'rules' },
      { check: 'itemDuplicateAbility', subject: 'shield:bash', kind: 'rules' },
      // Keen needs a piercing or slashing weapon; the bash is bludgeoning.
      { check: 'itemAbilityAppliesTo', subject: 'shield:bash', kind: 'rules' },
      { check: 'itemBonusEquivalent', subject: 'hammer-row', kind: 'rules' },
      { check: 'itemAbilityAppliesTo', subject: 'hammer-row', kind: 'rules' },
      {
        check: 'itemAbilityWithoutEnhancement',
        subject: 'hammer-row:otherEnd',
        kind: 'rules',
      },
    ]),
  );
  expect(warnings).not.toContainEqual(
    expect.objectContaining({
      check: 'equipmentEnhancement',
      subject: 'shield',
    }),
  );
  expect(warnings).not.toContainEqual(
    expect.objectContaining({
      check: 'itemBonusEquivalent',
      subject: 'shield',
    }),
  );
});

test('construction warning fingerprints change only with their own part', () => {
  const build = (otherEnd: number) =>
    calculateCharacterSheet(
      sheet({
        items: [
          {
            id: 'hammer-row',
            definition: 'hammer',
            state: {
              enhancement: 6,
              otherEnd: { enhancement: otherEnd },
            },
          },
        ],
      }),
    ).warnings.find(
      (warning) =>
        warning.check === 'equipmentEnhancement' &&
        warning.subject === 'hammer-row',
    )?.fingerprint;
  expect(build(1)).toBeDefined();
  expect(build(1)).toBe(build(2));
});

// #236: construction checks come from state only, so an unequipped item
// keeps its parts and its warnings.
test('an unequipped item keeps its parts and its construction warnings', () => {
  const calculated = calculateCharacterSheet(
    sheet({
      items: [
        {
          id: 'shield',
          definition: 'heavy-shield',
          active: false,
          state: {
            enhancement: 6,
            bash: {
              abilities: [
                { catalogEntryId: 'flaming' },
                { catalogEntryId: 'flaming' },
              ],
            },
          },
        },
      ],
    }),
  );
  expect(calculated.itemParts).toEqual([
    expect.objectContaining({
      entryId: 'shield',
      active: false,
      parts: [
        expect.objectContaining({ part: 'primary', enhancement: 6 }),
        expect.objectContaining({ part: 'bash', enhancement: 0 }),
      ],
    }),
  ]);
  expect(
    calculated.warnings
      .filter(
        (warning) =>
          warning.check.startsWith('item') ||
          warning.check === 'equipmentEnhancement',
      )
      .map(({ check, subject }) => ({ check, subject })),
  ).toEqual(
    expect.arrayContaining([
      { check: 'equipmentEnhancement', subject: 'shield' },
      { check: 'itemAbilityWithoutEnhancement', subject: 'shield:bash' },
      { check: 'itemDuplicateAbility', subject: 'shield:bash' },
    ]),
  );
});

test('a specific item’s own material is in its numbers only when its armor is its own', () => {
  const calculated = calculateCharacterSheet(
    sheet({
      items: [
        { id: 'shirt', definition: 'mithral-shirt' },
        { id: 'plate', definition: 'dwarven-plate' },
        { id: 'tongue', definition: 'flame-tongue' },
      ],
    }),
  );
  const material = (entryId: string) =>
    calculated.itemParts.find((item) => item.entryId === entryId)
      ?.bakedMaterial;
  expect(material('shirt')).toEqual({
    name: 'mithral',
    includedInNumbers: true,
  });
  expect(material('plate')).toEqual({
    name: 'adamantine',
    includedInNumbers: false,
  });
  expect(material('tongue')).toBeNull();
});

test('the definition lookup resolves through Base Items and never restores a placeholder', () => {
  const lookup = createItemDefinitionLookup(catalog);
  expect(lookup('flame-tongue')?.detail).toMatchObject({
    kind: 'item',
    weapon: longsword,
  });
  const orphan: CharacterSheetCatalogEntry = {
    _id: 'orphan',
    name: 'Orphan',
    ruleIdentity: 'orphan',
    modifiers: [],
    detail: {
      kind: 'item',
      baseItem: 'missing-base',
      weapon: { baseType: 'longsword', proficiency: 'simple' },
    },
  };
  const detail = createItemDefinitionLookup([...catalog, orphan])(
    'orphan',
  )?.detail;
  expect(detail).toMatchObject({ kind: 'item', baseItem: 'missing-base' });
  expect(detail).not.toHaveProperty('weapon');
  expect(lookup('missing')).toBeUndefined();
});
