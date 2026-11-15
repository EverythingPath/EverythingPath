import { expect, test } from 'vitest';
import {
  abilityKeys,
  abilityTargets,
  calculateCharacterSheet,
  calculateCharacterSheetProjections,
  isTemporaryEffect,
  type CharacterSheetCatalogEntry,
  type CharacterSheetInput,
  type ItemAbilityDetail,
  type SheetEntry,
} from './character-sheet';
import type { WeaponDetail } from './character-sheet-attacks';
import {
  spellEffectBindings,
  spellEffectDefaultCasterLevel,
  spellEffectDuration,
} from './character-sheet-spell-effects';

// Pathfinder RPG Core Rulebook spell descriptions: magic weapon and greater
// magic weapon (p. 307), keen edge (p. 302), magic fang (p. 306), magic
// vestment (p. 310), align weapon (p. 239), bless weapon (p. 249) and haste
// (p. 294); spells per day tables per class (Chapter 3). #236 item 10 settles
// the modelling ("Spells on an item").

type ItemRow = {
  id: string;
  definition: string;
  state?: Omit<Extract<SheetEntry, { kind: 'item' }>['state'], 'kind'>;
  active?: boolean;
};
type EffectRow = {
  id: string;
  definition: string;
  casterLevel?: number;
  onItem?: { entry: string; end?: 'otherEnd' | 'bash' };
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
): CharacterSheetCatalogEntry {
  return {
    _id: id,
    name,
    ruleIdentity: id,
    modifiers: [],
    detail: { kind: 'itemAbility', ...detail },
  };
}

function spell(
  id: string,
  name: string,
  levels: Record<string, number>,
): CharacterSheetCatalogEntry {
  return {
    _id: id,
    name,
    ruleIdentity: `${id}-identity`,
    modifiers: [],
    detail: { kind: 'spell', levels },
  };
}

const onTarget = { weapon: '$target' } as const;
const greaterBonus = { formula: 'min(5, floor(@casterLevel / 4))' };

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
  {
    _id: 'bite',
    name: 'Bite',
    ruleIdentity: 'natural-bite',
    modifiers: [],
    detail: {
      kind: 'item',
      weapon: {
        baseType: 'bite',
        proficiency: 'simple',
        handedness: 'light',
        attackType: 'melee',
        dice: '1d6',
        threat: 20,
        mult: 2,
        naturalAttack: { type: 'bite' },
      },
    },
  },
  // An amulet of mighty fists +1 (CRB p. 496): enhancement on unarmed
  // strikes and natural weapons.
  {
    _id: 'amulet',
    name: 'Amulet of mighty fists',
    ruleIdentity: 'amulet-of-mighty-fists',
    modifiers: [
      {
        target: 'attack',
        bonusType: 'enhancement',
        value: 1,
        condition: { weapon: '$unarmedOrNatural' },
      },
      {
        target: 'damage',
        bonusType: 'enhancement',
        value: 1,
        condition: { weapon: '$unarmedOrNatural' },
      },
    ],
    detail: { kind: 'item' },
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
  }),
  ability('holy', 'Holy', { appliesTo: 'weapon', bonusEquivalent: 2 }),
  ability('keen', 'Keen', {
    appliesTo: 'melee',
    bonusEquivalent: 1,
    doublesThreat: true,
    weaponDamageTypes: ['piercing', 'slashing'],
  }),
  {
    _id: 'improved-critical',
    name: 'Improved Critical',
    ruleIdentity: 'improved-critical',
    modifiers: [],
    detail: { kind: 'feat' },
  },
  spell('magic-weapon-spell', 'Magic Weapon', {
    cleric: 1,
    paladin: 1,
    sorcerer: 1,
    wizard: 1,
  }),
  spell('greater-magic-weapon-spell', 'Magic Weapon, Greater', {
    cleric: 4,
    paladin: 3,
    sorcerer: 3,
    wizard: 3,
  }),
  spell('keen-edge-spell', 'Keen Edge', { sorcerer: 3, wizard: 3 }),
  spell('magic-fang-spell', 'Magic Fang', { druid: 1, ranger: 1 }),
  spell('magic-vestment-spell', 'Magic Vestment', { cleric: 3 }),
  spell('bless-weapon-spell', 'Bless Weapon', { paladin: 1 }),
  // CRB p. 294 lists summoner 2nd level among Haste's classes.
  spell('haste-spell', 'Haste', {
    bard: 3,
    magus: 3,
    sorcerer: 3,
    summoner: 2,
    wizard: 3,
  }),
  {
    _id: 'magic-weapon',
    name: 'Magic weapon',
    ruleIdentity: 'magic-weapon',
    modifiers: [
      {
        target: 'attack',
        bonusType: 'enhancement',
        value: 1,
        condition: onTarget,
      },
      {
        target: 'damage',
        bonusType: 'enhancement',
        value: 1,
        condition: onTarget,
      },
    ],
    detail: {
      kind: 'spellEffect',
      lastsOverOneDay: false,
      defaultCasterLevel: 1,
      spellKey: 'magic-weapon-spell-identity',
      itemTarget: 'weapon',
    },
  },
  {
    _id: 'greater-magic-weapon',
    name: 'Greater magic weapon',
    ruleIdentity: 'greater-magic-weapon',
    modifiers: [
      {
        target: 'attack',
        bonusType: 'enhancement',
        value: greaterBonus,
        condition: onTarget,
      },
      {
        target: 'damage',
        bonusType: 'enhancement',
        value: greaterBonus,
        condition: onTarget,
      },
    ],
    detail: {
      kind: 'spellEffect',
      lastsOverOneDay: false,
      defaultCasterLevel: 5,
      spellKey: 'greater-magic-weapon-spell-identity',
      itemTarget: 'weapon',
    },
  },
  {
    _id: 'keen-edge',
    name: 'Keen edge',
    ruleIdentity: 'keen-edge',
    modifiers: [],
    detail: {
      kind: 'spellEffect',
      lastsOverOneDay: false,
      defaultCasterLevel: 5,
      spellKey: 'keen-edge-spell-identity',
      doublesThreat: true,
      itemTarget: 'weapon',
    },
  },
  {
    _id: 'magic-fang',
    name: 'Magic fang',
    ruleIdentity: 'magic-fang',
    modifiers: [
      {
        target: 'attack',
        bonusType: 'enhancement',
        value: 1,
        condition: onTarget,
      },
      {
        target: 'damage',
        bonusType: 'enhancement',
        value: 1,
        condition: onTarget,
      },
    ],
    detail: {
      kind: 'spellEffect',
      lastsOverOneDay: false,
      defaultCasterLevel: 1,
      spellKey: 'magic-fang-spell-identity',
      itemTarget: 'natural',
    },
  },
  // Magic fang made permanent with permanency (CRB p. 306).
  {
    _id: 'permanent-fang',
    name: 'Magic fang (permanent)',
    ruleIdentity: 'permanent-magic-fang',
    modifiers: [
      {
        target: 'attack',
        bonusType: 'enhancement',
        value: 1,
        condition: onTarget,
      },
    ],
    detail: {
      kind: 'spellEffect',
      lastsOverOneDay: true,
      defaultCasterLevel: 1,
      itemTarget: 'natural',
    },
  },
  {
    _id: 'magic-vestment',
    name: 'Magic vestment',
    ruleIdentity: 'magic-vestment',
    modifiers: [
      {
        target: 'ac',
        bonusType: 'enhancement',
        value: greaterBonus,
        condition: onTarget,
      },
    ],
    detail: {
      kind: 'spellEffect',
      lastsOverOneDay: false,
      defaultCasterLevel: 5,
      spellKey: 'magic-vestment-spell-identity',
      itemTarget: 'armorOrShield',
    },
  },
  {
    _id: 'align-weapon',
    name: 'Align weapon',
    ruleIdentity: 'align-weapon',
    modifiers: [],
    situationalNotes: [
      {
        target: 'damage',
        text: 'Bypasses damage reduction of the chosen alignment.',
        condition: onTarget,
      },
    ],
    detail: {
      kind: 'spellEffect',
      lastsOverOneDay: false,
      defaultCasterLevel: 3,
      itemTarget: 'weapon',
    },
  },
  {
    _id: 'bulls-strength',
    name: "Bull's strength",
    ruleIdentity: 'bulls-strength',
    modifiers: [{ target: 'ability.str', bonusType: 'enhancement', value: 4 }],
    detail: {
      kind: 'spellEffect',
      lastsOverOneDay: false,
      defaultCasterLevel: 3,
    },
  },
];

function sheet({
  items = [],
  effects = [],
  routines = [],
  feats = [],
}: {
  items?: ItemRow[];
  effects?: EffectRow[];
  routines?: RoutineRow[];
  feats?: string[];
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
      ...effects.map(
        ({
          id,
          definition,
          casterLevel = 1,
          onItem,
          active = true,
        }): SheetEntry => ({
          _id: id,
          kind: 'spellEffect',
          active,
          catalogEntryId: definition,
          state: {
            kind: 'spellEffect',
            casterLevel,
            ...(onItem ? { onItem } : {}),
          },
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
        (id): SheetEntry => ({
          _id: `${id}-row`,
          kind: 'feat',
          active: true,
          catalogEntryId: id,
          state: { kind: 'feat', choice: 'longsword' },
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
        modifiers: [{ target: 'bab', bonusType: 'untyped', value: 11 }],
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

function spellEffect(input: CharacterSheetInput, id: string) {
  const result = calculateCharacterSheet(input).spellEffects.find(
    (row) => row.entryId === id,
  );
  if (!result) throw new Error(`Missing Spell Effect ${id}`);
  return result;
}

const sword = { id: 'sword', definition: 'longsword' };
const swordRoutine = { id: 'routine', weapon: 'sword' };

// CRB Chapter 3 spells per day; a Spell Effect's caster level defaults to
// the lowest caster level at which any listed class casts the Spell.
test.each([
  // Wizard and cleric cast 1st-level spells at CL 1.
  ['magic-weapon', 1],
  // Sorcerer/wizard 3rd level at wizard 5; cleric 4th at 7; paladin 3rd at
  // paladin 10, CL 7.
  ['greater-magic-weapon', 5],
  // Summoner 2nd-level spells at summoner 4 (CRB p. 294 lists summoner 2).
  ['haste', 4],
  // A paladin's 1st-level spells start at paladin 4, CL 1 (offset −3).
  ['bless-weapon', 1],
  // Ranger 1st-level spells start at ranger 4, CL 1; druid at CL 1.
  ['magic-fang', 1],
  ['magic-vestment', 5],
] as const)(
  'the %s default caster level is the lowest legal one',
  (spellId, expected) => {
    const detail = {
      defaultCasterLevel: 12,
      spellKey: `${spellId}-spell-identity`,
    };
    expect(spellEffectDefaultCasterLevel(detail, catalog)).toBe(expected);
  },
);

test('an unlinked Spell Effect or one whose Spell is unavailable uses its defined default', () => {
  const unlinked = { defaultCasterLevel: 7 };
  expect(spellEffectDefaultCasterLevel(unlinked, catalog)).toBe(7);
  expect(
    spellEffectDefaultCasterLevel({ ...unlinked, spellKey: 'gone' }, catalog),
  ).toBe(7);
  // A Spell listing no reviewed casting class has no legal caster level.
  expect(
    spellEffectDefaultCasterLevel(
      { ...unlinked, spellKey: 'homebrew-identity' },
      [...catalog, spell('homebrew', 'Homebrew', { tinkerer: 2 })],
    ),
  ).toBe(7);
});

test('the sheet reports each Spell Effect with its caster levels and duration', () => {
  const input = sheet({
    items: [sword],
    effects: [
      { id: 'mw', definition: 'magic-weapon', casterLevel: 6 },
      { id: 'fang', definition: 'permanent-fang', casterLevel: 3 },
      { id: 'bull', definition: 'bulls-strength', casterLevel: 3 },
    ],
  });
  expect(spellEffect(input, 'mw')).toMatchObject({
    name: 'Magic weapon',
    active: true,
    casterLevel: 6,
    defaultCasterLevel: 1,
    // Ties go to the earliest class level, then the class tag.
    defaultSource: { classTag: 'cleric', classLevel: 1, spellLevel: 1 },
    spell: { name: 'Magic Weapon' },
    duration: 'temporary',
    target: { itemTarget: 'weapon', onItem: null, status: 'missing' },
  });
  expect(spellEffect(input, 'fang')).toMatchObject({
    duration: 'permanent',
    spell: null,
    defaultCasterLevel: 1,
    defaultSource: null,
  });
  // CRB p. 294: summoner 4 casts 2nd-level spells.
  const haste = sheet({
    effects: [{ id: 'haste', definition: 'haste-effect', casterLevel: 4 }],
  });
  haste.catalogEntries = [
    ...haste.catalogEntries,
    {
      _id: 'haste-effect',
      name: 'Haste',
      ruleIdentity: 'haste-effect',
      modifiers: [],
      detail: {
        kind: 'spellEffect',
        lastsOverOneDay: false,
        defaultCasterLevel: 3,
        spellKey: 'haste-spell-identity',
      },
    },
  ];
  expect(spellEffect(haste, 'haste')).toMatchObject({
    defaultCasterLevel: 4,
    defaultSource: { classTag: 'summoner', classLevel: 4, spellLevel: 2 },
  });
  // No item target: nothing to choose.
  expect(spellEffect(input, 'bull')).toMatchObject({
    target: null,
    duration: 'temporary',
  });
});

// CRB p. 307: magic weapon gives one weapon +1 enhancement on attack and
// damage rolls; it does not stack with a masterwork weapon's +1 on attack.
test('magic weapon enhances only its target weapon and contributes nothing until one is chosen', () => {
  const untargeted = sheet({
    items: [sword, { id: 'club', definition: 'club' }],
    effects: [{ id: 'mw', definition: 'magic-weapon' }],
    routines: [swordRoutine, { id: 'club-routine', weapon: 'club' }],
  });
  // BAB 11 + Str 4.
  expect(routine(untargeted).single[0]?.attackBonus.total).toBe(15);
  expect(routine(untargeted).single[0]?.damageBonus.total).toBe(4);
  expect(
    calculateCharacterSheet(untargeted).breakdowns['attack.melee'].total,
  ).toBe(0);
  const targeted = sheet({
    items: [sword, { id: 'club', definition: 'club' }],
    effects: [
      { id: 'mw', definition: 'magic-weapon', onItem: { entry: 'sword' } },
    ],
    routines: [swordRoutine, { id: 'club-routine', weapon: 'club' }],
  });
  const [line] = routine(targeted).single;
  expect(line?.attackBonus.total).toBe(16);
  expect(line?.damageBonus.total).toBe(5);
  expect(line?.attackBonus.applied).toContainEqual(
    expect.objectContaining({ entryName: 'Magic weapon', value: 1 }),
  );
  expect(routine(targeted, 'club-routine').single[0]?.attackBonus.total).toBe(
    15,
  );
  // The weapon condition never reaches the sheet-level attack statistics.
  expect(
    calculateCharacterSheet(targeted).breakdowns['attack.melee'].total,
  ).toBe(0);
  expect(spellEffect(targeted, 'mw').target).toMatchObject({
    onItem: { entry: 'sword', end: null },
    status: 'available',
    name: 'Longsword',
    suitable: true,
  });
});

test('targeted enhancement competes highest-only with the weapon’s own', () => {
  const plusOne = { ...sword, state: { enhancement: 1 } };
  const withMagicWeapon = sheet({
    items: [plusOne],
    effects: [
      { id: 'mw', definition: 'magic-weapon', onItem: { entry: 'sword' } },
    ],
    routines: [swordRoutine],
  });
  const [line] = routine(withMagicWeapon).single;
  expect(line?.attackBonus.total).toBe(16);
  expect(line?.damageBonus.total).toBe(5);
  expect(line?.attackBonus.suppressed).toHaveLength(1);
  // Greater magic weapon: +1 per four caster levels.
  const greater = (casterLevel: number) =>
    routine(
      sheet({
        items: [plusOne],
        effects: [
          {
            id: 'gmw',
            definition: 'greater-magic-weapon',
            casterLevel,
            onItem: { entry: 'sword' },
          },
        ],
        routines: [swordRoutine],
      }),
    ).single[0];
  expect(greater(5)?.attackBonus.total).toBe(16);
  expect(greater(8)?.attackBonus.total).toBe(17);
  expect(greater(8)?.damageBonus.total).toBe(6);
  expect(greater(8)?.attackBonus.suppressed).toContainEqual(
    expect.objectContaining({ entryName: 'Longsword enhancement', value: 1 }),
  );
  // CRB p. 307: an enhancement bonus doesn't stack with masterwork's +1.
  const masterwork = routine(
    sheet({
      items: [{ ...sword, state: { masterwork: true } }],
      effects: [
        { id: 'mw', definition: 'magic-weapon', onItem: { entry: 'sword' } },
      ],
      routines: [swordRoutine],
    }),
  ).single[0];
  expect(masterwork?.attackBonus.total).toBe(16);
  expect(masterwork?.damageBonus.total).toBe(5);
});

test('a targeted end, bash or ammunition receives the effect alone', () => {
  const hammerSheet = (onItem?: { entry: string; end?: 'otherEnd' }) =>
    sheet({
      items: [{ id: 'hammer', definition: 'hammer' }],
      effects: onItem ? [{ id: 'mw', definition: 'magic-weapon', onItem }] : [],
      routines: [
        {
          id: 'routine',
          weapon: 'hammer',
          hands: 'two',
          offHand: { kind: 'otherEnd', mode: 'melee' },
        },
      ],
    });
  const lines = (onItem?: { entry: string; end?: 'otherEnd' }) =>
    routine(hammerSheet(onItem)).full.map((line) => ({
      end: line.end,
      attack: line.attackBonus.total,
    }));
  const plain = lines();
  const otherEnd = lines({ entry: 'hammer', end: 'otherEnd' });
  const primary = lines({ entry: 'hammer' });
  for (const [index, line] of plain.entries()) {
    expect(otherEnd[index]?.attack).toBe(
      line.attack + (line.end === 'otherEnd' ? 1 : 0),
    );
    expect(primary[index]?.attack).toBe(
      line.attack + (line.end === 'otherEnd' ? 0 : 1),
    );
  }
  // A shield's bash, not its AC.
  const shield = (end?: 'bash') =>
    sheet({
      items: [{ id: 'shield', definition: 'heavy-shield' }],
      effects: [
        {
          id: 'mw',
          definition: 'magic-weapon',
          onItem: { entry: 'shield', ...(end ? { end } : {}) },
        },
      ],
      routines: [{ id: 'routine', weapon: 'shield' }],
    });
  expect(routine(shield('bash')).single[0]?.attackBonus.total).toBe(16);
  expect(routine(shield()).single[0]?.attackBonus.total).toBe(15);
  expect(
    calculateCharacterSheet(shield('bash')).breakdowns['ac.shield'].total,
  ).toBe(2);
  // CRB p. 307: greater magic weapon on 50 arrows competes highest-only
  // with the launcher's enhancement (CRB p. 468).
  const archery = (casterLevel: number) =>
    routine(
      sheet({
        items: [
          { id: 'bow', definition: 'longbow', state: { enhancement: 1 } },
          { id: 'arrows', definition: 'arrows' },
        ],
        effects: [
          {
            id: 'gmw',
            definition: 'greater-magic-weapon',
            casterLevel,
            onItem: { entry: 'arrows' },
          },
        ],
        routines: [
          {
            id: 'routine',
            weapon: 'bow',
            hands: 'two',
            mode: 'ranged',
            ammunitionEntryId: 'arrows',
          },
        ],
      }),
    ).single[0];
  // BAB 11 + Dex 2 + launcher +1; the arrows' +2 wins at CL 8.
  expect(archery(5)?.attackBonus.total).toBe(14);
  expect(archery(8)?.attackBonus.total).toBe(15);
});

// CRB p. 307: a monk's unarmed strike is a weapon for magic weapon; CRB
// p. 306: magic fang enhances one natural weapon or unarmed strike.
test('unarmed strikes and natural weapons take targeted effects and compete with mighty fists', () => {
  const unarmed = routine(
    sheet({
      effects: [
        { id: 'mw', definition: 'magic-weapon', onItem: { entry: 'unarmed' } },
      ],
      routines: [{ id: 'routine', weapon: 'unarmed' }],
    }),
  ).single[0];
  expect(unarmed?.attackBonus.total).toBe(16);
  const bite = (effects: EffectRow[], items: ItemRow[] = []) =>
    routine(
      sheet({
        items: [{ id: 'bite', definition: 'bite' }, ...items],
        effects,
        routines: [{ id: 'routine', weapon: 'bite' }],
      }),
    ).single[0]?.attackBonus;
  expect(bite([])?.total).toBe(15);
  const fang = [
    { id: 'fang', definition: 'magic-fang', onItem: { entry: 'bite' } },
  ];
  expect(bite(fang)?.total).toBe(16);
  const amulet = [{ id: 'amulet', definition: 'amulet' }];
  expect(bite([], amulet)?.total).toBe(16);
  // Both are enhancement bonuses: only the higher applies.
  expect(bite(fang, amulet)?.total).toBe(16);
  expect(bite(fang, amulet)?.suppressed).toHaveLength(1);
});

// CRB p. 302: keen edge doubles the threat range; threat-range increases
// don't stack (#237 A15).
test('keen edge doubles its target’s threat range once alongside keen and Improved Critical', () => {
  const threat = (items: ItemRow[], feats: string[] = [], onItem = 'sword') =>
    routine(
      sheet({
        items,
        effects: [
          { id: 'edge', definition: 'keen-edge', onItem: { entry: onItem } },
        ],
        routines: [swordRoutine],
        feats,
      }),
    ).single[0]?.criticalThreat;
  expect(threat([sword])?.total).toBe(17);
  const keenSword = {
    ...sword,
    state: { enhancement: 1, abilities: [{ catalogEntryId: 'keen' }] },
  };
  expect(threat([keenSword])?.total).toBe(17);
  expect(threat([keenSword])?.suppressed).toHaveLength(1);
  expect(threat([sword], ['improved-critical'])?.total).toBe(17);
  // On another weapon it changes nothing here.
  expect(
    threat([sword, { id: 'club', definition: 'club' }], [], 'club')?.total,
  ).toBe(19);
});

// CRB p. 310: magic vestment gives armor or a shield +1 enhancement per four
// caster levels on its own AC leaf.
test('magic vestment lands on its target’s armor or shield leaf, highest-only', () => {
  const vestment = (items: ItemRow[], entry: string, casterLevel = 8) =>
    calculateCharacterSheet(
      sheet({
        items,
        effects: [
          {
            id: 'vestment',
            definition: 'magic-vestment',
            casterLevel,
            onItem: { entry },
          },
        ],
      }),
    ).breakdowns;
  const shirt = { id: 'shirt', definition: 'chain-shirt' };
  expect(
    vestment([{ ...shirt, state: { enhancement: 1 } }], 'shirt')['ac.armor']
      .total,
  ).toBe(6);
  const shield = { id: 'shield', definition: 'heavy-shield' };
  expect(vestment([shirt, shield], 'shirt')['ac.armor'].total).toBe(6);
  expect(vestment([shirt, shield], 'shirt')['ac.shield'].total).toBe(2);
  expect(vestment([shirt, shield], 'shield')['ac.shield'].total).toBe(4);
  expect(vestment([shirt, shield], 'shield')['ac.armor'].total).toBe(4);
  // The armor's own +3 beats CL 8's +2.
  expect(
    vestment([{ ...shirt, state: { enhancement: 3 } }], 'shirt')['ac.armor']
      .total,
  ).toBe(7);
  // Not worn: no armor bonus and nothing to enhance.
  expect(
    vestment([{ ...shirt, active: false }], 'shirt')['ac.armor'].total,
  ).toBe(0);
  // Without a target nothing reaches AC.
  const untargeted = calculateCharacterSheet(
    sheet({
      items: [shirt],
      effects: [
        { id: 'vestment', definition: 'magic-vestment', casterLevel: 8 },
      ],
    }),
  );
  expect(untargeted.breakdowns['ac.armor'].total).toBe(4);
  expect(untargeted.breakdowns['ac.other'].total).toBe(0);
  expect(untargeted.derivedStatistics.ac.total).toBe(16);
});

test('a targeted effect’s notes join the weapon’s own abilities on its lines', () => {
  const input = sheet({
    items: [
      {
        ...sword,
        state: { enhancement: 1, abilities: [{ catalogEntryId: 'flaming' }] },
      },
    ],
    effects: [
      { id: 'align', definition: 'align-weapon', onItem: { entry: 'sword' } },
    ],
    routines: [swordRoutine],
  });
  const [line] = routine(input).single;
  expect(line?.extraDamage.map((part) => part.dice)).toEqual(['1d6']);
  expect(line?.damageBonus.notes).toContainEqual(
    expect.objectContaining({
      entryName: 'Align weapon',
      text: 'Bypasses damage reduction of the chosen alignment.',
    }),
  );
  const elsewhere = sheet({
    items: [sword, { id: 'club', definition: 'club' }],
    effects: [
      { id: 'align', definition: 'align-weapon', onItem: { entry: 'club' } },
    ],
    routines: [swordRoutine],
  });
  expect(routine(elsewhere).single[0]?.damageBonus.notes ?? []).toEqual([]);
});

// CRB p. 469 and #236: the +10 total counts enhancement from spells, the
// higher of the item's own and the targeted effect's.
test('the bonus-equivalent limit counts a targeted enhancement', () => {
  const heavyBlade = {
    ...sword,
    state: {
      enhancement: 3,
      abilities: [
        { catalogEntryId: 'flaming-burst' },
        { catalogEntryId: 'holy' },
        { catalogEntryId: 'keen' },
        { catalogEntryId: 'frost' },
      ],
    },
  };
  const warnings = (casterLevel?: number) =>
    calculateCharacterSheet(
      sheet({
        items: [heavyBlade],
        effects:
          casterLevel === undefined
            ? []
            : [
                {
                  id: 'gmw',
                  definition: 'greater-magic-weapon',
                  casterLevel,
                  onItem: { entry: 'sword' },
                },
              ],
      }),
    ).warnings.filter((warning) => warning.check === 'itemBonusEquivalent');
  expect(warnings()).toEqual([]);
  // +4 doesn't beat the item's +3 by enough: 4 + 6 = 10.
  expect(warnings(16)).toEqual([]);
  expect(warnings(20)).toEqual([
    expect.objectContaining({
      subject: 'sword',
      message:
        'Longsword has a total bonus equivalent of +11; the maximum is +10.',
    }),
  ]);
});

test('permanent calculations keep only Spell Effects lasting more than a day', () => {
  const input = sheet({
    items: [{ id: 'bite', definition: 'bite' }],
    effects: [
      { id: 'fang', definition: 'magic-fang', onItem: { entry: 'bite' } },
      { id: 'edge', definition: 'keen-edge', onItem: { entry: 'bite' } },
      { id: 'bull', definition: 'bulls-strength' },
    ],
    routines: [{ id: 'routine', weapon: 'bite' }],
  });
  const { current, permanent } = calculateCharacterSheetProjections(input);
  const line = (result: typeof current) =>
    result.attackRoutines.find((row) => row.entryId === 'routine')?.single[0];
  // Str 22 with bull's strength: +6, plus magic fang.
  expect(line(current)?.attackBonus.total).toBe(18);
  expect(line(current)?.criticalThreat.total).toBe(19);
  expect(line(permanent)?.attackBonus.total).toBe(15);
  expect(line(permanent)?.criticalThreat.total).toBe(20);
  const lasting = sheet({
    items: [{ id: 'bite', definition: 'bite' }],
    effects: [
      { id: 'fang', definition: 'permanent-fang', onItem: { entry: 'bite' } },
    ],
    routines: [{ id: 'routine', weapon: 'bite' }],
  });
  expect(
    line(calculateCharacterSheetProjections(lasting).permanent)?.attackBonus
      .total,
  ).toBe(16);
});

test('an inactive effect, or one whose target is gone, contributes nothing', () => {
  const inactive = sheet({
    items: [sword],
    effects: [
      {
        id: 'mw',
        definition: 'magic-weapon',
        onItem: { entry: 'sword' },
        active: false,
      },
    ],
    routines: [swordRoutine],
  });
  expect(routine(inactive).single[0]?.attackBonus.total).toBe(15);
  const removed = sheet({
    items: [sword],
    effects: [
      { id: 'mw', definition: 'magic-weapon', onItem: { entry: 'old-sword' } },
    ],
    routines: [swordRoutine],
  });
  expect(routine(removed).single[0]?.attackBonus.total).toBe(15);
  expect(spellEffect(removed, 'mw').target).toMatchObject({
    status: 'unavailable',
    name: null,
  });
  expect(calculateCharacterSheet(removed).warnings).toContainEqual(
    expect.objectContaining({
      kind: 'rules',
      check: 'spellEffectTargetUnavailable',
      subject: 'mw',
      target: { kind: 'entry', entryId: 'mw' },
      message:
        "Magic weapon's target is no longer on the sheet. Choose another target; until then it adds nothing.",
    }),
  );
  // An end the weapon doesn't have is unavailable too.
  const noEnd = sheet({
    items: [sword],
    effects: [
      {
        id: 'mw',
        definition: 'magic-weapon',
        onItem: { entry: 'sword', end: 'otherEnd' },
      },
    ],
  });
  expect(spellEffect(noEnd, 'mw').target?.status).toBe('unavailable');
  const unequipped = sheet({
    items: [{ ...sword, active: false }],
    effects: [
      { id: 'mw', definition: 'magic-weapon', onItem: { entry: 'sword' } },
    ],
  });
  expect(spellEffect(unequipped, 'mw').target?.status).toBe('inactive');
});

test('an unsuitable target is advisory and offered targets follow the effect', () => {
  const input = sheet({
    items: [
      sword,
      { id: 'hammer', definition: 'hammer' },
      { id: 'shield', definition: 'heavy-shield' },
      { id: 'shirt', definition: 'chain-shirt' },
      { id: 'bite', definition: 'bite' },
      { id: 'arrows', definition: 'arrows' },
    ],
    effects: [
      { id: 'fang', definition: 'magic-fang', onItem: { entry: 'sword' } },
      { id: 'mw', definition: 'magic-weapon' },
      { id: 'vestment', definition: 'magic-vestment' },
    ],
    routines: [swordRoutine],
  });
  // Magic fang still applies to the chosen longsword; the check advises.
  expect(routine(input).single[0]?.attackBonus.total).toBe(16);
  expect(spellEffect(input, 'fang').target?.suitable).toBe(false);
  expect(calculateCharacterSheet(input).warnings).toContainEqual(
    expect.objectContaining({
      check: 'spellEffectTargetUnsuitable',
      subject: 'fang',
      message: "Magic fang normally can't target Longsword.",
    }),
  );
  const offered = (id: string) =>
    spellEffect(input, id)
      .target?.options.filter((option) => option.suitable)
      .map(({ entry, end, name }) => ({ entry, end, name }));
  expect(offered('mw')).toEqual([
    { entry: 'sword', end: null, name: 'Longsword' },
    { entry: 'hammer', end: null, name: 'Gnome hooked hammer' },
    {
      entry: 'hammer',
      end: 'otherEnd',
      name: 'Gnome hooked hammer (other end)',
    },
    { entry: 'shield', end: 'bash', name: 'Heavy steel shield bash' },
    { entry: 'arrows', end: null, name: 'Arrows' },
    { entry: 'unarmed', end: null, name: 'Unarmed strike' },
  ]);
  expect(offered('fang')).toEqual([
    { entry: 'bite', end: null, name: 'Bite' },
    { entry: 'unarmed', end: null, name: 'Unarmed strike' },
  ]);
  expect(offered('vestment')).toEqual([
    { entry: 'shield', end: null, name: 'Heavy steel shield' },
    { entry: 'shirt', end: null, name: 'Chain shirt' },
  ]);
});

// CRB p. 302: keen edge "can be cast only on piercing or slashing weapons".
// The check is advisory, so a bludgeoning target still doubles its threat.
test('keen edge on a bludgeoning-only target is advisory', () => {
  const edge = (onItem: { entry: string; end?: 'otherEnd' }) =>
    sheet({
      items: [
        sword,
        { id: 'club', definition: 'club' },
        { id: 'hammer', definition: 'hammer' },
        { id: 'arrows', definition: 'arrows' },
      ],
      effects: [{ id: 'edge', definition: 'keen-edge', onItem }],
      routines: [{ id: 'routine', weapon: 'club' }],
    });
  const club = edge({ entry: 'club' });
  expect(routine(club).single[0]?.criticalThreat.total).toBe(19);
  expect(spellEffect(club, 'edge').target?.suitable).toBe(false);
  expect(calculateCharacterSheet(club).warnings).toContainEqual(
    expect.objectContaining({
      kind: 'rules',
      check: 'spellEffectTargetUnsuitable',
      subject: 'edge',
      target: { kind: 'entry', entryId: 'edge' },
      message:
        'Keen edge can be cast only on piercing or slashing weapons, not on Club.',
    }),
  );
  // The hooked hammer's piercing other end suits; its head and the unarmed
  // strike deal bludgeoning damage. Arrows record no damage type.
  expect(
    spellEffect(club, 'edge')
      .target?.options.filter((option) => option.suitable)
      .map(({ entry, end }) => ({ entry, end })),
  ).toEqual([
    { entry: 'sword', end: null },
    { entry: 'hammer', end: 'otherEnd' },
    { entry: 'arrows', end: null },
  ]);
  const otherEnd = edge({ entry: 'hammer', end: 'otherEnd' });
  expect(
    calculateCharacterSheet(otherEnd).warnings.filter(
      (warning) => warning.subject === 'edge',
    ),
  ).toEqual([]);
});

// CRB p. 310: magic vestment enhances armor or a shield. An AC `$target`
// Modifier on anything else, a shield's bash included, contributes nothing.
test('magic vestment on a weapon or a shield bash adds nothing to AC, with the advisory', () => {
  const vestment = (onItem?: { entry: string; end?: 'bash' }) =>
    calculateCharacterSheet(
      sheet({
        items: [sword, { id: 'shield', definition: 'heavy-shield' }],
        effects: [
          {
            id: 'vestment',
            definition: 'magic-vestment',
            casterLevel: 8,
            ...(onItem ? { onItem } : {}),
          },
        ],
        routines: [swordRoutine],
      }),
    );
  const untargeted = vestment();
  for (const onItem of [
    { entry: 'sword' },
    { entry: 'shield', end: 'bash' as const },
    { entry: 'unarmed' },
  ]) {
    const result = vestment(onItem);
    for (const leaf of ['ac.armor', 'ac.shield', 'ac.other'] as const)
      expect(result.breakdowns[leaf].total).toBe(
        untargeted.breakdowns[leaf].total,
      );
    expect(result.derivedStatistics.ac.total).toBe(
      untargeted.derivedStatistics.ac.total,
    );
    expect(
      result.attackRoutines.find((row) => row.entryId === 'routine')?.single[0]
        ?.attackBonus.total,
    ).toBe(15);
    expect(result.warnings).toContainEqual(
      expect.objectContaining({
        check: 'spellEffectTargetUnsuitable',
        subject: 'vestment',
      }),
    );
  }
});

test('a Spell Effect lasting a day or less is a Temporary Effect wherever it is read', () => {
  for (const lastsOverOneDay of [false, true, undefined]) {
    const detail = { kind: 'spellEffect' as const, lastsOverOneDay };
    expect(spellEffectDuration(detail)).toBe(
      lastsOverOneDay ? 'permanent' : 'temporary',
    );
    expect(isTemporaryEffect({ kind: 'spellEffect' }, detail)).toBe(
      spellEffectDuration(detail) === 'temporary',
    );
  }
  expect(spellEffectDuration(undefined)).toBe('temporary');
});

test('one binding lookup per calculation input serves every Spell Effect', () => {
  const input = sheet({
    items: [
      sword,
      { id: 'shirt', definition: 'chain-shirt' },
      { id: 'hammer', definition: 'hammer' },
    ],
    effects: [
      { id: 'mw', definition: 'magic-weapon', onItem: { entry: 'sword' } },
      {
        id: 'gmw',
        definition: 'greater-magic-weapon',
        onItem: { entry: 'hammer', end: 'otherEnd' },
      },
      {
        id: 'vestment',
        definition: 'magic-vestment',
        onItem: { entry: 'shirt' },
      },
      { id: 'fang', definition: 'magic-fang' },
      { id: 'gone', definition: 'magic-weapon', onItem: { entry: 'old' } },
    ],
  });
  const bindingFor = spellEffectBindings(input);
  const entry = (id: string) => {
    const row = input.entries.find((candidate) => candidate._id === id);
    if (!row) throw new Error(`Missing ${id}`);
    return row;
  };
  expect(bindingFor(entry('mw'))).toEqual({
    entry: 'sword',
    part: 'primary',
    armorSlot: null,
  });
  expect(bindingFor(entry('gmw'))).toEqual({
    entry: 'hammer',
    part: 'otherEnd',
    armorSlot: null,
  });
  expect(bindingFor(entry('vestment'))).toEqual({
    entry: 'shirt',
    part: 'primary',
    armorSlot: 'armor',
  });
  expect(bindingFor(entry('fang'))).toBeNull();
  expect(bindingFor(entry('gone'))).toBeNull();
  expect(bindingFor(entry('sword'))).toBeNull();
});

// App-creatable copies of the pinned CRB p.151 leather and p.504 bracers.
function vestmentWithBracers(casterLevel = 8) {
  const input = sheet({
    items: [
      { id: 'leather', definition: 'leather', state: { enhancement: 1 } },
      { id: 'bracers', definition: 'bracers' },
    ],
    effects: [
      {
        id: 'vestment',
        definition: 'magic-vestment',
        casterLevel,
        onItem: { entry: 'leather' },
      },
    ],
  });
  input.catalogEntries = [
    ...input.catalogEntries,
    {
      _id: 'leather',
      name: 'Homebrew leather',
      ruleIdentity: 'leather',
      modifiers: [],
      detail: {
        kind: 'item',
        armor: {
          slot: 'armor',
          category: 'light',
          bonus: 2,
          maxDex: 6,
          armorCheckPenalty: 0,
          asf: 10,
        },
      },
    },
    {
      _id: 'bracers',
      name: 'Homebrew bracers +4',
      ruleIdentity: 'bracers',
      modifiers: [{ target: 'ac.armor', bonusType: 'armor', value: 4 }],
      detail: { kind: 'item' },
    },
  ];
  return input;
}

test('Magic Vestment enhances its recipient before competing with bracers, retaining attribution', () => {
  expect(
    calculateCharacterSheet(vestmentWithBracers()).breakdowns['ac.armor'].total,
  ).toBe(4);
  const input = vestmentWithBracers(12);
  const { current, permanent } = calculateCharacterSheetProjections(input);
  expect(current.breakdowns['ac.armor'].total).toBe(5);
  expect(permanent.breakdowns['ac.armor'].total).toBe(4);
  expect(current.breakdowns['ac.armor'].applied[0]?.armorComponents).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        value: 3,
        source: 'magic-vestment',
        sheetEntryId: 'vestment',
        armorItem: { entryId: 'leather', component: 'enhancement' },
      }),
    ]),
  );
  input.entries = [
    ...input.entries,
    {
      _id: 'vestment-two',
      kind: 'spellEffect',
      catalogEntryId: 'magic-vestment',
      active: true,
      state: {
        kind: 'spellEffect',
        casterLevel: 8,
        onItem: { entry: 'leather' },
      },
    },
  ];
  expect(calculateCharacterSheet(input).breakdowns['ac.armor'].total).toBe(5);
  // A different enhancement Source competes too: the published Sanctify
  // Armor slot output, represented as an app-creatable homebrew effect.
  input.catalogEntries = [
    ...input.catalogEntries,
    {
      _id: 'sanctify',
      name: 'Homebrew Sanctify Armor',
      ruleIdentity: 'sanctify',
      modifiers: [
        { target: 'ac.armor', bonusType: 'enhancement', value: greaterBonus },
      ],
      detail: { kind: 'spellEffect', lastsOverOneDay: false },
    },
  ];
  input.entries = [
    ...input.entries,
    {
      _id: 'sanctify',
      kind: 'spellEffect',
      catalogEntryId: 'sanctify',
      active: true,
      state: { kind: 'spellEffect', casterLevel: 8 },
    },
  ];
  expect(calculateCharacterSheet(input).breakdowns['ac.armor'].total).toBe(5);
});

test.each([
  'inactive-target',
  'removed-target',
  'missing-target',
  'inactive-effect',
] as const)('targeted AC enhancement cannot survive %s', (mode) => {
  const input = vestmentWithBracers(12);
  if (mode === 'removed-target')
    input.entries = input.entries.filter((row) => row._id !== 'leather');
  else if (mode === 'missing-target')
    input.entries = input.entries.map((row) =>
      row._id === 'vestment' && row.kind === 'spellEffect'
        ? { ...row, state: { ...row.state, onItem: { entry: 'missing' } } }
        : row,
    );
  else
    input.entries = input.entries.map((row) =>
      (row.kind === 'item' || row.kind === 'spellEffect') &&
      row._id === (mode === 'inactive-target' ? 'leather' : 'vestment')
        ? { ...row, active: false }
        : row,
    );
  expect(calculateCharacterSheet(input).breakdowns['ac.armor'].total).toBe(4);
});

test('legacy Sanctify Armor slot enhancement competes with saved enhancement and never enhances bracers', () => {
  const input = vestmentWithBracers();
  input.entries = input.entries.filter((row) => row.kind !== 'spellEffect');
  input.entries = [
    ...input.entries,
    {
      _id: 'sanctify',
      kind: 'spellEffect',
      active: true,
      catalogEntryId: 'sanctify',
      state: { kind: 'spellEffect', casterLevel: 8 },
    },
  ];
  // Exact held pf1-content/K8fLIVFxynjNjWVv output; app-creatable homebrew.
  input.catalogEntries = [
    ...input.catalogEntries,
    {
      _id: 'sanctify',
      name: 'Homebrew Sanctify Armor',
      ruleIdentity: 'sanctify',
      modifiers: [
        { target: 'ac.armor', bonusType: 'enhancement', value: greaterBonus },
      ],
      detail: { kind: 'spellEffect', lastsOverOneDay: false },
    },
  ];
  expect(calculateCharacterSheet(input).breakdowns['ac.armor'].total).toBe(4);
  input.entries = input.entries.map((row) =>
    row._id === 'leather' && row.kind === 'item'
      ? { ...row, state: { ...row.state, enhancement: 3 } }
      : row,
  );
  expect(calculateCharacterSheet(input).breakdowns['ac.armor'].total).toBe(5);
  input.entries = input.entries.filter((row) => row._id !== 'leather');
  expect(calculateCharacterSheet(input).breakdowns['ac.armor'].total).toBe(4);
});

test('conditional recipient enhancement is evaluated independently for current and permanent projections', () => {
  const input = vestmentWithBracers(12);
  input.catalogEntries = input.catalogEntries.map((row) =>
    row._id === 'magic-vestment'
      ? {
          ...row,
          name: 'Homebrew conditional vestment',
          modifiers: row.modifiers.map((modifier) => ({
            ...modifier,
            condition: {
              ...modifier.condition,
              situation: { local: 'while blessed' },
            },
          })),
        }
      : row,
  );
  expect(calculateCharacterSheet(input).breakdowns['ac.armor'].total).toBe(4);
  const options = {
    situations: [{ local: 'while blessed', sheetEntryId: 'vestment' }],
  };
  const { current, permanent } = calculateCharacterSheetProjections(
    input,
    options,
  );
  expect(current.breakdowns['ac.armor'].total).toBe(5);
  expect(permanent.breakdowns['ac.armor'].total).toBe(4);
  const effect = input.entries.find((row) => row._id === 'vestment');
  if (!effect) throw new Error('Missing effect');
  effect.active = false;
  expect(
    calculateCharacterSheet(input, options).breakdowns['ac.armor'].total,
  ).toBe(4);
});

test.each([0, 2])(
  'Barkskin competes with the amulet on base natural armor %i while deflection stays separate',
  (baseNatural) => {
    const input = vestmentWithBracers();
    input.entries = input.entries.filter((row) => row._id !== 'vestment');
    input.entries = [
      ...input.entries,
      {
        _id: 'barkskin',
        kind: 'spellEffect',
        active: true,
        catalogEntryId: 'barkskin',
        state: { kind: 'spellEffect', casterLevel: 6 },
      },
      {
        _id: 'amulet',
        kind: 'item',
        active: true,
        catalogEntryId: 'amulet',
        state: { kind: 'item' },
      },
      {
        _id: 'ring',
        kind: 'item',
        active: true,
        catalogEntryId: 'ring',
        state: { kind: 'item' },
      },
      {
        _id: 'natural',
        kind: 'manual',
        active: true,
        catalogEntryId: 'natural',
        state: { kind: 'manual' },
      },
    ];
    // Reproductions of pinned Barkskin (CRB p.246), amulet2 (p.500), ring2
    // (p.479), plus a labeled player-created base-natural-armor adjustment.
    input.catalogEntries = [
      ...input.catalogEntries,
      {
        _id: 'barkskin',
        name: 'Homebrew Barkskin',
        ruleIdentity: 'barkskin',
        modifiers: [
          {
            target: 'ac.natural',
            bonusType: 'enhancement',
            value: { formula: 'min(5, 2 + floor((@casterLevel - 3) / 3))' },
          },
        ],
        detail: { kind: 'spellEffect', lastsOverOneDay: false },
      },
      {
        _id: 'amulet',
        name: 'Homebrew amulet2',
        ruleIdentity: 'amulet',
        modifiers: [
          { target: 'ac.natural', bonusType: 'enhancement', value: 2 },
        ],
        detail: { kind: 'item' },
      },
      {
        _id: 'ring',
        name: 'Homebrew ring2',
        ruleIdentity: 'ring',
        modifiers: [{ target: 'ac', bonusType: 'deflection', value: 2 }],
        detail: { kind: 'item' },
      },
      {
        _id: 'natural',
        name: 'Homebrew base natural armor',
        ruleIdentity: 'natural',
        modifiers: [
          {
            target: 'ac.natural',
            bonusType: 'naturalArmor',
            value: baseNatural,
          },
        ],
        detail: { kind: 'manual' },
      },
    ];
    const result = calculateCharacterSheet(input);
    expect(result.breakdowns['ac.natural'].total).toBe(
      baseNatural === 0 ? 3 : 5,
    );
    expect(result.breakdowns['ac.other'].total).toBe(2);
    expect(result.breakdowns['ac.armor'].total).toBe(4);
    expect(result.derivedStatistics.touchAc.total).toBe(14);
    expect(result.derivedStatistics.cmd.total).toBe(29);
  },
);

test('an enhancement on one ordinary armor cannot improve another ordinary armor', () => {
  const input = vestmentWithBracers(12);
  input.entries = [
    ...input.entries,
    {
      _id: 'shirt',
      kind: 'item',
      catalogEntryId: 'chain-shirt',
      active: true,
      state: { kind: 'item' },
    },
  ];
  expect(calculateCharacterSheet(input).breakdowns['ac.armor'].total).toBe(5);
  input.entries = input.entries.map((row) =>
    row._id === 'vestment' && row.kind === 'spellEffect'
      ? { ...row, state: { ...row.state, onItem: { entry: 'shirt' } } }
      : row,
  );
  expect(calculateCharacterSheet(input).breakdowns['ac.armor'].total).toBe(7);
});

test('legacy Magic Vestment armor/shield Situations retain their own leaf and enhancement competition', () => {
  const input = vestmentWithBracers();
  input.entries = input.entries.filter((row) => row._id !== 'vestment');
  input.entries = [
    ...input.entries,
    {
      _id: 'legacy',
      kind: 'spellEffect',
      catalogEntryId: 'legacy',
      active: true,
      state: { kind: 'spellEffect', casterLevel: 8 },
    },
  ];
  // Exact held pf1-content/Qqo3DLdlbnXhXe7G outputs, reproduced as homebrew.
  input.catalogEntries = [
    ...input.catalogEntries,
    {
      _id: 'legacy',
      name: 'Homebrew Magic Vestment buff',
      ruleIdentity: 'legacy',
      detail: { kind: 'spellEffect', lastsOverOneDay: false },
      modifiers: [
        {
          target: 'ac.armor',
          bonusType: 'enhancement',
          value: greaterBonus,
          condition: {
            situation: {
              local: 'magic vestment cast on your armor or clothing',
            },
          },
        },
        {
          target: 'ac.shield',
          bonusType: 'enhancement',
          value: greaterBonus,
          condition: {
            situation: { local: 'magic vestment cast on your shield' },
          },
        },
      ],
    },
  ];
  const armor = {
    situations: [
      {
        local: 'magic vestment cast on your armor or clothing',
        sheetEntryId: 'legacy',
      },
    ],
  };
  const shield = {
    situations: [
      { local: 'magic vestment cast on your shield', sheetEntryId: 'legacy' },
    ],
  };
  expect(calculateCharacterSheet(input).breakdowns['ac.armor'].total).toBe(4);
  expect(
    calculateCharacterSheet(input, armor).breakdowns['ac.armor'].total,
  ).toBe(4);
  expect(
    calculateCharacterSheet(input, armor).breakdowns['ac.shield'].total,
  ).toBe(0);
  expect(
    calculateCharacterSheet(input, shield).breakdowns['ac.armor'].total,
  ).toBe(4);
  expect(
    calculateCharacterSheet(input, shield).breakdowns['ac.shield'].total,
  ).toBe(2);
});
