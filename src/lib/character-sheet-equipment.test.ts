import { expect, test } from 'vitest';
import {
  calculateCharacterSheet,
  type CharacterSheetInput,
  type SheetEntry,
} from './character-sheet';

import { equipmentSheet } from './character-sheet-equipment-fixture';

test('equipped full plate and shield cap AC alone and share the single summed skill penalty', () => {
  const result = calculateCharacterSheet(equipmentSheet());
  expect(result.derivedStatistics.ac.total).toBe(24);
  expect(result.derivedStatistics.touchAc.total).toBe(11);
  expect(result.derivedStatistics.cmd.total).toBe(14);
  expect(result.breakdowns['ac.armor'].total).toBe(11);
  expect(result.breakdowns['ac.shield'].total).toBe(2);
  expect(result.breakdowns['skill.acr'].total).toBe(-3);
  expect(result.equipment).toMatchObject({
    armorCheckPenalty: -7,
    spellFailure: 50,
    maxDexterityBonus: 1,
    nonproficiencyAttackPenalty: -7,
  });
  expect(result.breakdowns['attack.melee'].applied).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        entryName: 'Not proficient: Full plate',
        value: -5,
      }),
    ]),
  );
  expect(
    result.warnings.some((warning) =>
      warning.message.includes('Not proficient'),
    ),
  ).toBe(false);
});

test.each([
  {
    name: 'Leather',
    bonus: 2,
    dex: 6,
    acp: 0,
    asf: 10,
    category: 'light',
    ac: 16,
  },
  {
    name: 'Chain shirt',
    bonus: 4,
    dex: 4,
    acp: 2,
    asf: 20,
    category: 'light',
    ac: 18,
  },
  {
    name: 'Full plate',
    bonus: 9,
    dex: 1,
    acp: 6,
    asf: 35,
    category: 'heavy',
    ac: 20,
  },
  {
    name: 'Heavy steel shield',
    bonus: 2,
    dex: null,
    acp: 2,
    asf: 15,
    category: 'heavyShield',
    ac: 16,
  },
] as const)(
  'representative CRB $name statistics derive through the sheet',
  ({ name, bonus, dex, acp, asf, category, ac }) => {
    const input = equipmentSheet();
    const item = input.entries.find((row) => row._id === 'armor-row');
    if (item?.kind !== 'item') throw new Error('Missing item');
    const result = calculateCharacterSheet({
      ...input,
      entries: [input.entries[0], { ...item, state: { kind: 'item' } }],
      catalogEntries: [
        input.catalogEntries[0],
        {
          _id: 'armor',
          name,
          ruleIdentity: name,
          modifiers: [],
          detail: {
            kind: 'item',
            armor: {
              slot: category === 'heavyShield' ? 'shield' : 'armor',
              category,
              bonus,
              maxDex: dex,
              armorCheckPenalty: acp,
              asf,
            },
          },
        },
      ],
    });
    expect(result.derivedStatistics.ac.total).toBe(ac);
    expect(result.equipment.armorCheckPenalty).toBe(acp ? -acp : 0);
    expect(result.equipment.spellFailure).toBe(asf);
  },
);

test('lowest cap and all penalties apply even when a weaker armor bonus is suppressed', () => {
  const input = equipmentSheet();
  const result = calculateCharacterSheet({
    ...input,
    entries: [
      ...input.entries,
      {
        _id: 'second-armor',
        kind: 'item',
        active: true,
        catalogEntryId: 'other',
        state: { kind: 'item' },
      },
    ],
    catalogEntries: [
      ...input.catalogEntries,
      {
        _id: 'other',
        name: 'Chain shirt',
        ruleIdentity: 'other',
        modifiers: [],
        detail: {
          kind: 'item',
          armor: {
            slot: 'armor',
            bonus: 4,
            maxDex: 0,
            armorCheckPenalty: 2,
            asf: 20,
          },
        },
      },
    ],
  });
  expect(result.derivedStatistics.ac.total).toBe(23);
  expect(result.derivedStatistics.cmd.total).toBe(14);
  expect(result.equipment).toMatchObject({
    maxDexterityBonus: 0,
    armorCheckPenalty: -9,
    spellFailure: 70,
  });
});

test.each([
  { material: 'mithral', masterwork: true, cap: 3, penalty: -3, asf: 25 },
  { material: 'adamantine', masterwork: false, cap: 1, penalty: -5, asf: 35 },
])(
  '$material adjusts raw armor once and implies masterwork',
  ({ material, masterwork, cap, penalty, asf }) => {
    const input = equipmentSheet();
    const armor = input.entries[1];
    if (armor.kind !== 'item') throw new Error('Missing armor');
    const result = calculateCharacterSheet({
      ...input,
      entries: [
        input.entries[0],
        { ...armor, state: { kind: 'item', material, masterwork } },
      ],
    });
    expect(result.equipment).toMatchObject({
      maxDexterityBonus: cap,
      armorCheckPenalty: penalty,
      spellFailure: asf,
    });
  },
);

test('one-handed exotic use explains -4 and warns only for that use; two hands accepts martial', () => {
  const input = equipmentSheet();
  const weapon: CharacterSheetInput = {
    ...input,
    entries: [
      input.entries[0],
      {
        _id: 'sword',
        kind: 'item',
        active: true,
        catalogEntryId: 'sword',
        state: { kind: 'item' },
      },
    ],
    catalogEntries: [
      ...input.catalogEntries,
      {
        _id: 'sword',
        name: 'Bastard sword',
        ruleIdentity: 'sword',
        modifiers: [],
        detail: {
          kind: 'item',
          weapon: {
            baseType: 'bastard sword',
            proficiency: 'exotic',
            groups: ['heavy blades'],
          },
        },
      },
    ],
  };
  const base = weapon.entries.find((row) => row.kind === 'base');
  if (base?.kind !== 'base') throw new Error('Missing base');
  const trained = {
    ...weapon,
    entries: [
      {
        ...base,
        state: {
          kind: 'base' as const,
          proficiencies: {
            added: [{ category: 'martial' as const }],
            removed: [],
          },
        },
      },
      ...weapon.entries.filter((row) => row.kind !== 'base'),
    ],
  };
  expect(
    calculateCharacterSheet(trained).warnings.some(
      (warning) => warning.check === 'oneHandedExotic',
    ),
  ).toBe(false);
  const one = calculateCharacterSheet(trained, {
    weaponUses: [{ entryId: 'sword', hands: 'one' }],
  });
  expect(one.weaponProficiencies[0]).toMatchObject({
    proficient: false,
    attackPenalty: -4,
  });
  expect(one.weaponProficiencies[0]?.breakdown.applied).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        entryName: 'Not proficient: Bastard sword',
        value: -4,
      }),
    ]),
  );
  expect(
    one.warnings.filter((warning) => warning.check === 'oneHandedExotic'),
  ).toHaveLength(1);
  expect(
    calculateCharacterSheet(trained, {
      weaponUses: [{ entryId: 'sword', hands: 'two' }],
    }).weaponProficiencies[0]?.attackPenalty,
  ).toBe(0);
});

test('specific mithral armor statistics already include material and masterwork reductions', () => {
  const input = equipmentSheet();
  const armor = input.entries[1];
  if (armor.kind !== 'item') throw new Error('Missing armor');
  const result = calculateCharacterSheet({
    ...input,
    entries: [
      input.entries[0],
      {
        ...armor,
        state: {
          kind: 'item',
          enhancement: 1,
          masterwork: true,
          material: 'mithral',
        },
      },
    ],
    catalogEntries: [
      input.catalogEntries[0],
      {
        _id: 'armor',
        name: 'Mithral full plate',
        ruleIdentity: 'mithral-plate',
        modifiers: [],
        detail: {
          kind: 'item',
          material: 'mithral',
          armor: {
            slot: 'armor',
            category: 'heavyArmor',
            bonus: 9,
            maxDex: 3,
            armorCheckPenalty: 3,
            asf: 25,
          },
        },
      },
    ],
  });
  expect(result.equipment).toMatchObject({
    armorCheckPenalty: -3,
    maxDexterityBonus: 3,
    spellFailure: 25,
  });
});

test('weapon-use breakdown includes every nonproficient armor penalty once', () => {
  const input = equipmentSheet();
  const result = calculateCharacterSheet(
    {
      ...input,
      entries: [
        ...input.entries,
        {
          _id: 'weapon',
          kind: 'item',
          active: true,
          catalogEntryId: 'weapon',
          state: { kind: 'item' },
        },
      ],
      catalogEntries: [
        ...input.catalogEntries,
        {
          _id: 'weapon',
          name: 'Longsword',
          ruleIdentity: 'weapon',
          modifiers: [],
          detail: {
            kind: 'item',
            weapon: { baseType: 'longsword', proficiency: 'martial' },
          },
        },
      ],
    },
    { weaponUses: [{ entryId: 'weapon', hands: 'one' }] },
  );
  expect(result.weaponProficiencies[0]).toMatchObject({
    attackPenalty: -4,
    armorNonproficiencyPenalty: -7,
    totalAttackPenalty: -11,
    breakdown: { total: -11 },
  });
  expect(
    result.weaponProficiencies[0]?.breakdown.applied.map((row) => row.value),
  ).toEqual([-4, -5, -2]);
});

test('one-handed exotic acceptance fingerprints ignore unrelated grants and copied identities', () => {
  const input = equipmentSheet();
  const base = input.entries[0];
  const sword: CharacterSheetInput = {
    ...input,
    entries: [
      base,
      {
        _id: 'sword',
        kind: 'item',
        active: true,
        catalogEntryId: 'sword',
        state: { kind: 'item' },
      },
    ],
    catalogEntries: [
      ...input.catalogEntries,
      {
        _id: 'sword',
        name: 'Bastard sword',
        ruleIdentity: 'sword',
        modifiers: [],
        detail: {
          kind: 'item',
          weapon: {
            baseType: 'bastard sword',
            proficiency: 'exotic',
            groups: ['heavy blades'],
          },
        },
      },
    ],
  };
  const fingerprint = (sheet: CharacterSheetInput) =>
    calculateCharacterSheet(sheet, {
      weaponUses: [{ entryId: 'sword', hands: 'one' }],
    }).warnings.find((row) => row.check === 'oneHandedExotic')?.fingerprint;
  const before = fingerprint(sword);
  const unrelated = {
    ...sword,
    catalogEntries: sword.catalogEntries.map((row) =>
      row._id === 'base'
        ? { ...row, proficiencies: [{ baseType: 'longbow' }] }
        : row,
    ),
  } satisfies CharacterSheetInput;
  expect(fingerprint(unrelated)).toBe(before);
  const removed = {
    ...sword,
    entries: [
      {
        ...base,
        state: {
          kind: 'base',
          proficiencies: {
            added: [],
            removed: [{ baseType: 'bastard sword' }],
          },
        },
      },
      ...sword.entries.filter((row) => row.kind !== 'base'),
    ],
  } satisfies CharacterSheetInput;
  expect(fingerprint(removed)).not.toBe(before);
});

test('mithral shields reduce ACP and spell failure and increase a finite max-Dex cap', () => {
  const input = equipmentSheet();
  const shield = input.entries[2];
  const result = calculateCharacterSheet({
    ...input,
    entries: [
      input.entries[0],
      { ...shield, state: { kind: 'item', material: 'mithral' } },
    ],
    catalogEntries: input.catalogEntries.map((row) =>
      row._id === 'shield'
        ? {
            ...row,
            detail: {
              ...row.detail,
              armor: { ...row.detail.armor, armorCheckPenalty: 5, maxDex: 2 },
            },
          }
        : row,
    ),
  });
  expect(result.equipment.items[0]).toMatchObject({
    armorCheckPenalty: -2,
    maxDexterityBonus: 4,
    spellFailure: 5,
    masterwork: true,
  });
});

test('one-handed exotic warnings normalize surrounding spaces in weapon names', () => {
  const input = equipmentSheet();
  const result = calculateCharacterSheet(
    {
      ...input,
      entries: [
        input.entries[0],
        {
          _id: 'sword',
          kind: 'item',
          active: true,
          catalogEntryId: 'sword',
          state: { kind: 'item' },
        },
      ],
      catalogEntries: [
        ...input.catalogEntries,
        {
          _id: 'sword',
          ruleIdentity: 'sword',
          modifiers: [],
          detail: {
            kind: 'item',
            weapon: { baseType: ' Bastard Sword ', proficiency: 'exotic' },
          },
        },
      ],
    },
    { weaponUses: [{ entryId: 'sword', hands: 'one' }] },
  );
  expect(
    result.warnings.filter((warning) => warning.check === 'oneHandedExotic'),
  ).toHaveLength(1);
});

test('ranged weapon-use breakdown attributes weapon and armor penalties to ranged attacks', () => {
  const input = equipmentSheet();
  const result = calculateCharacterSheet(
    {
      ...input,
      entries: [
        ...input.entries,
        {
          _id: 'bow',
          kind: 'item',
          active: true,
          catalogEntryId: 'bow',
          state: { kind: 'item' },
        },
      ],
      catalogEntries: [
        ...input.catalogEntries,
        {
          _id: 'bow',
          name: 'Longbow',
          ruleIdentity: 'bow',
          modifiers: [],
          detail: {
            kind: 'item',
            weapon: { baseType: 'longbow', proficiency: 'martial' },
          },
        },
      ],
    },
    { weaponUses: [{ entryId: 'bow', hands: 'two', attack: 'ranged' }] },
  );
  const breakdown = result.weaponProficiencies[0]?.breakdown;
  expect(breakdown?.total).toBe(-11);
  expect(
    breakdown?.applied.map(({ target, value }) => ({ target, value })),
  ).toEqual([
    { target: 'attack.ranged', value: -4 },
    { target: 'attack.ranged', value: -5 },
    { target: 'attack.ranged', value: -2 },
  ]);
});

test('one-handed exotic warning fingerprints include martial training used by manual familiarity', () => {
  const input = equipmentSheet();
  const fingerprint = (martial: boolean) =>
    calculateCharacterSheet(
      {
        ...input,
        entries: [
          {
            ...input.entries[0],
            state: {
              kind: 'base',
              proficiencies: {
                added: [
                  { baseType: 'dwarven waraxe', asMartial: true },
                  ...(martial ? [{ category: 'martial' as const }] : []),
                ],
                removed: [{ baseType: 'dwarven waraxe' }],
              },
            },
          },
          {
            _id: 'axe',
            kind: 'item',
            active: true,
            catalogEntryId: 'axe',
            state: { kind: 'item' },
          },
        ],
        catalogEntries: [
          ...input.catalogEntries,
          {
            _id: 'axe',
            ruleIdentity: 'axe',
            modifiers: [],
            detail: {
              kind: 'item',
              weapon: { baseType: 'dwarven waraxe', proficiency: 'exotic' },
            },
          },
        ],
      },
      { weaponUses: [{ entryId: 'axe', hands: 'one' }] },
    ).warnings.find((warning) => warning.check === 'oneHandedExotic')
      ?.fingerprint;
  const withoutTraining = fingerprint(false);
  expect(withoutTraining).toBeDefined();
  expect(fingerprint(true)).not.toBe(withoutTraining);
});

test('one-handed exotic warning fingerprints ignore group grants that cannot cover one-handed use', () => {
  const input = equipmentSheet();
  const fingerprint = (groupGrant: boolean) =>
    calculateCharacterSheet(
      {
        ...input,
        entries: [
          input.entries[0],
          {
            _id: 'sword',
            kind: 'item',
            active: true,
            catalogEntryId: 'sword',
            state: { kind: 'item' },
          },
        ],
        catalogEntries: [
          ...input.catalogEntries.map((row) =>
            row._id === 'base'
              ? {
                  ...row,
                  proficiencies: groupGrant ? [{ group: 'heavy blades' }] : [],
                }
              : row,
          ),
          {
            _id: 'sword',
            ruleIdentity: 'sword',
            modifiers: [],
            detail: {
              kind: 'item',
              weapon: {
                baseType: 'bastard sword',
                proficiency: 'exotic',
                groups: ['heavy blades'],
              },
            },
          },
        ],
      },
      { weaponUses: [{ entryId: 'sword', hands: 'one' }] },
    ).warnings.find((warning) => warning.check === 'oneHandedExotic')
      ?.fingerprint;
  const before = fingerprint(false);
  expect(before).toBeDefined();
  expect(fingerprint(true)).toBe(before);
});

// App-creatable reproductions of leather, full plate, bracers +4, heavy steel
// shield and Shield: pinned CRB equipment pp. 151–152 and spells/items pp. 342, 504.
test.each([
  [2, 0, 1, 4, 4],
  [2, 1, 1, 4, 4],
  [2, 2, 1, 4, 4],
  [2, 3, 3, 5, 5],
  [9, 1, 1, 10, 4],
])(
  'effective armor %i+%i and shield enhancement %i compete independently',
  (base, enhancement, shieldEnhancement, armor, shield) => {
    const input = equipmentSheet();
    const entries: SheetEntry[] = input.entries.map((row) =>
      row.kind === 'item'
        ? {
            ...row,
            state: {
              kind: 'item',
              enhancement:
                row._id === 'armor-row' ? enhancement : shieldEnhancement,
            },
          }
        : row,
    );
    entries.push({
      _id: 'bonuses',
      kind: 'item',
      active: true,
      catalogEntryId: 'bonuses',
      state: { kind: 'item' },
    });
    const result = calculateCharacterSheet({
      ...input,
      entries,
      catalogEntries: [
        ...input.catalogEntries.map((row) =>
          row._id === 'armor'
            ? {
                ...row,
                detail: {
                  ...row.detail,
                  armor: { ...row.detail.armor, bonus: base },
                },
              }
            : row,
        ),
        {
          _id: 'bonuses',
          name: 'Homebrew bracers +4 and Shield',
          ruleIdentity: 'bonuses',
          detail: { kind: 'item' },
          modifiers: [
            { target: 'ac.armor', bonusType: 'armor', value: 4 },
            { target: 'ac.shield', bonusType: 'shield', value: 4 },
          ],
        },
      ],
    });
    expect(result.breakdowns['ac.armor'].total).toBe(armor);
    expect(result.breakdowns['ac.shield'].total).toBe(shield);
    expect(result.derivedStatistics.ac.total).toBe(11 + armor + shield);
    expect(result.derivedStatistics.flatFootedAc.total).toBe(
      10 + armor + shield,
    );
    expect(result.derivedStatistics.touchAc.total).toBe(11);
    expect(result.derivedStatistics.cmd.total).toBe(14);
  },
);
